import { createServiceClient } from '@/src/db/service';
import { deleteConnectedAccount } from '@/src/server/connectors/deleteConnectedAccount';
import { revokeToken } from '@/src/server/connectors/google/oauth';
import { stopGmailWatch } from '@/src/server/connectors/google/webhook';
import { decryptToken, pgByteaToBuffer } from '@/src/server/crypto/tokenVault';

// One Google OAuth grant backs two sibling connected_accounts rows
// (email + calendar, same owner_user_id and external_account_id) sharing one token pair, so the provider token is
// only revoked once no sibling row is still connected -- disconnecting
// one sibling must leave the other's access untouched. Each sibling's
// own row, content and secrets are deleted regardless, since those are
// scoped to this one connected_account_id.
export async function disconnectGoogleAccount(connectedAccountId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: account, error: accountError } = await supabase
    .from('connected_accounts')
    .select(
      'workspace_id, owner_user_id, provider, account_type, external_account_id, watch_expires_at',
    )
    .eq('id', connectedAccountId)
    .single();
  if (accountError) throw accountError;

  const { data: siblings, error: siblingsError } = await supabase
    .from('connected_accounts')
    .select('id, status')
    .eq('workspace_id', account.workspace_id)
    .eq('owner_user_id', account.owner_user_id)
    .eq('provider', account.provider)
    .eq('external_account_id', account.external_account_id);
  if (siblingsError) throw siblingsError;

  // Only the email row carries a Gmail watch. It's stopped while the token
  // still works, even when a calendar sibling keeps the grant alive.
  // Best-effort: a token that's already dead can't stop anything, and the
  // watch then lapses on its own within 7 days.
  if (account.account_type === 'email' && account.watch_expires_at) {
    try {
      await stopGmailWatch(connectedAccountId);
    } catch (error) {
      console.warn(`[disconnectGoogleAccount] stopping Gmail watch failed: ${String(error)}`);
    }
  }

  const otherSiblingStillConnected = (siblings ?? []).some(
    (sibling) => sibling.id !== connectedAccountId && sibling.status !== 'disconnected',
  );

  if (!otherSiblingStillConnected) {
    const { data: secret } = await supabase
      .from('connected_account_secrets')
      .select('encrypted_access_token, key_version')
      .eq('connected_account_id', connectedAccountId)
      .maybeSingle();

    if (secret?.encrypted_access_token && secret.key_version != null) {
      const accessToken = await decryptToken(
        pgByteaToBuffer(secret.encrypted_access_token as string),
        secret.key_version,
      );
      await revokeToken(accessToken);
    }
  }

  await deleteConnectedAccount(connectedAccountId);
}
