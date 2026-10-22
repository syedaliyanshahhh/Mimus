import { createServiceClient } from '@/src/db/service';
import { getConnector } from '@/src/server/connectors/bootstrap';
import type { Provider } from '@/src/server/connectors/types';

// A removed member's connected accounts in that workspace go through each
// connector's own disconnect (token revoked, push stopped, content
// deleted), so the workspace keeps none of their data, as the Privacy
// Policy says. Accounts they connected in other workspaces are untouched.
// Runs as the service role: callers must have authorized the removal
// first, through the RLS-scoped update.
export async function purgeRemovedMember(params: {
  workspaceId: string;
  userId: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const { data: accounts } = await supabase
    .from('connected_accounts')
    .select('id, provider')
    .eq('workspace_id', params.workspaceId)
    .eq('owner_user_id', params.userId)
    .throwOnError();

  for (const account of accounts ?? []) {
    try {
      await getConnector(account.provider as Provider).disconnect(account.id as string);
    } catch (error) {
      // Same posture as account deletion: an already-revoked token must not
      // leave the data behind. Delete the row (and its content, by cascade).
      console.error(`member removal: disconnect failed for ${account.id}`, error);
      await supabase.from('connected_accounts').delete().eq('id', account.id).throwOnError();
    }
  }
}
