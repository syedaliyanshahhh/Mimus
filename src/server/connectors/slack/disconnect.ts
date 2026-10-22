import { createServiceClient } from '@/src/db/service';
import { deleteConnectedAccount } from '@/src/server/connectors/deleteConnectedAccount';
import { deleteSlackInstallationIfUnused } from '@/src/server/connectors/slack/installations';
import { revokeToken } from '@/src/server/connectors/slack/oauth';
import { decryptToken, pgByteaToBuffer } from '@/src/server/crypto/tokenVault';

// No sibling-row fan-out needed (see connect.ts) -- disconnecting always
// revokes exactly this one user token and deletes exactly this one
// connected_account (its messages and people go with it by cascade).
export async function disconnectSlackAccount(connectedAccountId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: account } = await supabase
    .from('connected_accounts')
    .select('provider_team_id')
    .eq('id', connectedAccountId)
    .maybeSingle()
    .throwOnError();

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

  await deleteConnectedAccount(connectedAccountId);

  // The Slack workspace's bot token is shared by every member who
  // connected it, so it goes only when this was the last one.
  if (account?.provider_team_id) {
    await deleteSlackInstallationIfUnused(account.provider_team_id as string);
  }
}
