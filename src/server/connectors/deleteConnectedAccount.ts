import { createServiceClient } from '@/src/db/service';

// The last step of every connector's disconnect. Deleting the row cascades
// to its messages, events, people, secrets, sharing list and scheduling
// proposals (FKs in migrations 0005, 0012 and 0019), so nothing about the
// account -- not even its email address, scopes or Slack team name --
// outlives the disconnect.
export async function deleteConnectedAccount(connectedAccountId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('connected_accounts').delete().eq('id', connectedAccountId).throwOnError();
}
