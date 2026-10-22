import { createServiceClient } from '@/src/db/service';
import { revokeToken } from '@/src/server/connectors/calendly/oauth';
import { deleteConnectedAccount } from '@/src/server/connectors/deleteConnectedAccount';
import { decryptToken, pgByteaToBuffer } from '@/src/server/crypto/tokenVault';

// No sibling-row fan-out needed (same posture as Slack's disconnect) --
// disconnecting always revokes exactly this one token and deletes exactly
// this one connected_account (its events and people go with it by
// cascade).
export async function disconnectCalendlyAccount(connectedAccountId: string): Promise<void> {
  const supabase = createServiceClient();

  const [{ data: account }, { data: secret }] = await Promise.all([
    supabase
      .from('connected_accounts')
      .select('watch_channel_id')
      .eq('id', connectedAccountId)
      .maybeSingle()
      .throwOnError(),
    supabase
      .from('connected_account_secrets')
      .select('encrypted_access_token, key_version')
      .eq('connected_account_id', connectedAccountId)
      .maybeSingle(),
  ]);

  if (secret?.encrypted_access_token && secret.key_version != null) {
    const accessToken = await decryptToken(
      pgByteaToBuffer(secret.encrypted_access_token as string),
      secret.key_version,
    );

    // Unlike Gmail/Graph subscriptions, Calendly's never expire, so the one
    // registerCalendlyWebhook created has to be deleted explicitly -- while
    // the token still works. Best-effort: it may already be gone.
    if (account?.watch_channel_id) {
      try {
        const response = await fetch(account.watch_channel_id as string, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`status ${response.status}`);
        }
      } catch (error) {
        console.warn(
          `[disconnectCalendlyAccount] deleting webhook subscription failed: ${String(error)}`,
        );
      }
    }

    await revokeToken(accessToken);
  }

  await deleteConnectedAccount(connectedAccountId);
}
