import { createServiceClient } from '@/src/db/service';
import { purgeRemovedMember } from '@/src/server/members/purgeRemovedMember';
import { upsertMessage } from '@/src/server/shared/normalize';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

describe('purgeRemovedMember', () => {
  const supabase = createServiceClient();
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdUserIds.map((id) => supabase.auth.admin.deleteUser(id)));
    createdUserIds.length = 0;
  });

  async function makeWorkspace() {
    const { data: company } = await supabase
      .from('companies')
      .insert({ name: 'Removal test co' })
      .select('id')
      .single()
      .throwOnError();
    const { data: workspace } = await supabase
      .from('workspaces')
      .insert({ company_id: company!.id, name: 'Removal test ws' })
      .select('id')
      .single()
      .throwOnError();
    return workspace!.id as string;
  }

  // Microsoft rows with no Graph subscription: disconnect makes no
  // network call, so the purge can run against the real local DB as-is.
  async function makeAccount(workspaceId: string, userId: string) {
    const { data } = await supabase
      .from('connected_accounts')
      .insert({
        workspace_id: workspaceId,
        owner_user_id: userId,
        provider: 'microsoft',
        account_type: 'email',
        external_account_id: `removed-${randomUUID()}@example.com`,
      })
      .select('id')
      .single()
      .throwOnError();
    return data!.id as string;
  }

  it("disconnects the member's accounts in that workspace only", async () => {
    const userId = randomUUID();
    const { error } = await supabase.auth.admin.createUser({
      id: userId,
      email: `removed-${userId}@example.com`,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(userId);

    const removedFrom = await makeWorkspace();
    const stillIn = await makeWorkspace();
    const removedAccountId = await makeAccount(removedFrom, userId);
    await upsertMessage(removedFrom, removedAccountId, {
      providerMessageId: 'msg-1',
      direction: 'inbound',
    });
    const keptAccountId = await makeAccount(stillIn, userId);

    await purgeRemovedMember({ workspaceId: removedFrom, userId });

    const { data: remaining } = await supabase
      .from('connected_accounts')
      .select('id')
      .in('id', [removedAccountId, keptAccountId])
      .throwOnError();
    expect(remaining!.map((row) => row.id)).toEqual([keptAccountId]);

    const { data: messages } = await supabase
      .from('messages')
      .select('id')
      .eq('connected_account_id', removedAccountId)
      .throwOnError();
    expect(messages).toHaveLength(0);
  });
});
