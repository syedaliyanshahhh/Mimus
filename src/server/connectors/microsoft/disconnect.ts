import { createServiceClient } from '@/src/db/service';
import { getAuthorizedGraphClient } from '@/src/server/connectors/microsoft/client';
import { deleteConnectedAccount } from '@/src/server/connectors/deleteConnectedAccount';

// Microsoft Graph/Entra expose no per-app token revocation API analogous to
// Google's OAuth2Client.revokeToken(). The closest equivalent --
// POST /me/revokeSignInSessions -- invalidates the user's refresh tokens
// for *every* app they've consented to, not just this one (confirmed
// against Microsoft Learn's current docs for that API), so calling it here
// would sign the user out of every other Microsoft app too, which is far
// too broad a side effect for disconnecting one connection. What is within
// this connector's control: deleting the Graph change-notification
// subscription and our own cached MSAL token cache. The user's underlying
// Microsoft refresh token stays valid at Microsoft's end until it naturally
// expires or the user removes Mimus under their Microsoft account's app
// permissions -- the Privacy Policy points them there.
//
// Each sibling connected_accounts row (email + calendar, see connect.ts)
// holds its own independent copy of the same underlying cache and its own
// subscription, so deleting one sibling leaves the other's access and data
// untouched.
export async function disconnectMicrosoftAccount(connectedAccountId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: account } = await supabase
    .from('connected_accounts')
    .select('watch_channel_id')
    .eq('id', connectedAccountId)
    .maybeSingle()
    .throwOnError();

  // Best-effort: a subscription that already lapsed (or a token that no
  // longer works) leaves nothing to delete, and Graph drops it within 3
  // days anyway.
  if (account?.watch_channel_id) {
    try {
      const client = await getAuthorizedGraphClient(connectedAccountId);
      await client.api(`/subscriptions/${account.watch_channel_id}`).delete();
    } catch (error) {
      console.warn(
        `[disconnectMicrosoftAccount] deleting Graph subscription failed: ${String(error)}`,
      );
    }
  }

  await deleteConnectedAccount(connectedAccountId);
}
