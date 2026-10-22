import { createServiceClient } from '@/src/db/service';
import { disconnectMicrosoftAccount } from '@/src/server/connectors/microsoft/disconnect';
import { bufferToPgBytea, encryptToken } from '@/src/server/crypto/tokenVault';
import { upsertEvent, upsertMessage } from '@/src/server/shared/normalize';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';

// Same fake-client seam webhook.test.ts uses: the Graph SDK's Client has no
// prototype-level network call to spy on.
vi.mock('@/src/server/connectors/microsoft/client', () => ({
  getAuthorizedGraphClient: vi.fn(),
}));

import { getAuthorizedGraphClient } from '@/src/server/connectors/microsoft/client';

describe('disconnectMicrosoftAccount', () => {
  const supabase = createServiceClient();
  const createdUserIds: string[] = [];

  beforeEach(() => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.mocked(getAuthorizedGraphClient).mockReset();
    await Promise.all(createdUserIds.map((id) => supabase.auth.admin.deleteUser(id)));
    createdUserIds.length = 0;
  });

  async function makeWorkspace() {
    const { data: company } = await supabase
      .from('companies')
      .insert({ name: 'MS disconnect test co' })
      .select('id')
      .single()
      .throwOnError();
    const { data: workspace } = await supabase
      .from('workspaces')
      .insert({ company_id: company!.id, name: 'MS disconnect test ws' })
      .select('id')
      .single()
      .throwOnError();
    const userId = randomUUID();
    const { error } = await supabase.auth.admin.createUser({
      id: userId,
      email: `ms-disconnect-${userId}@example.com`,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(userId);
    return { workspaceId: workspace!.id as string, userId };
  }

  async function makeConnectedAccount(
    workspaceId: string,
    userId: string,
    accountType: 'email' | 'calendar',
    externalAccountId: string,
  ) {
    const { data: account } = await supabase
      .from('connected_accounts')
      .insert({
        workspace_id: workspaceId,
        owner_user_id: userId,
        provider: 'microsoft',
        account_type: accountType,
        external_account_id: externalAccountId,
      })
      .select('id')
      .single()
      .throwOnError();

    const { ciphertext, keyVersion } = await encryptToken('cache-blob');
    await supabase
      .from('connected_account_secrets')
      .insert({
        connected_account_id: account!.id,
        encrypted_refresh_token: bufferToPgBytea(ciphertext),
        key_version: keyVersion,
      })
      .throwOnError();

    return account!.id as string;
  }

  it('purges content and deletes the secret for the disconnected account', async () => {
    const { workspaceId, userId } = await makeWorkspace();
    const connectedAccountId = await makeConnectedAccount(
      workspaceId,
      userId,
      'calendar',
      'founder@example.com',
    );
    await upsertEvent(workspaceId, connectedAccountId, {
      providerEventId: 'event-1',
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
    });

    await disconnectMicrosoftAccount(connectedAccountId);

    const { data: account } = await supabase
      .from('connected_accounts')
      .select('id')
      .eq('id', connectedAccountId)
      .maybeSingle()
      .throwOnError();
    expect(account).toBeNull();

    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('connected_account_id', connectedAccountId)
      .throwOnError();
    expect(events).toHaveLength(0);

    const { data: secret } = await supabase
      .from('connected_account_secrets')
      .select('connected_account_id')
      .eq('connected_account_id', connectedAccountId)
      .maybeSingle()
      .throwOnError();
    expect(secret).toBeNull();
  });

  it("disconnecting one sibling leaves the other's content and cache intact", async () => {
    const { workspaceId, userId } = await makeWorkspace();
    const calendarAccountId = await makeConnectedAccount(
      workspaceId,
      userId,
      'calendar',
      'founder@example.com',
    );
    const emailAccountId = await makeConnectedAccount(
      workspaceId,
      userId,
      'email',
      'founder@example.com',
    );
    await upsertMessage(workspaceId, emailAccountId, {
      providerMessageId: 'msg-1',
      direction: 'inbound',
    });

    await disconnectMicrosoftAccount(calendarAccountId);

    const { data: emailAccount } = await supabase
      .from('connected_accounts')
      .select('status')
      .eq('id', emailAccountId)
      .single()
      .throwOnError();
    expect(emailAccount!.status).toBe('connected');

    const { data: messages } = await supabase
      .from('messages')
      .select('id')
      .eq('connected_account_id', emailAccountId)
      .throwOnError();
    expect(messages).toHaveLength(1);

    const { data: emailSecret } = await supabase
      .from('connected_account_secrets')
      .select('connected_account_id')
      .eq('connected_account_id', emailAccountId)
      .maybeSingle()
      .throwOnError();
    expect(emailSecret).not.toBeNull();

    const { data: calendarSecret } = await supabase
      .from('connected_account_secrets')
      .select('connected_account_id')
      .eq('connected_account_id', calendarAccountId)
      .maybeSingle()
      .throwOnError();
    expect(calendarSecret).toBeNull();
  });

  it('deletes the Graph change-notification subscription before purging', async () => {
    // Unique: webhook.test.ts looks accounts up by subscription id in parallel.
    const subscriptionId = `sub-${randomUUID()}`;
    const { workspaceId, userId } = await makeWorkspace();
    const emailAccountId = await makeConnectedAccount(
      workspaceId,
      userId,
      'email',
      'founder@example.com',
    );
    await supabase
      .from('connected_accounts')
      .update({ watch_channel_id: subscriptionId })
      .eq('id', emailAccountId)
      .throwOnError();

    const del = vi.fn().mockResolvedValue(undefined);
    const api = vi.fn(() => ({ delete: del }));
    vi.mocked(getAuthorizedGraphClient).mockResolvedValue({ api } as unknown as Client);

    await disconnectMicrosoftAccount(emailAccountId);

    expect(api).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`);
    expect(del).toHaveBeenCalled();
  });

  it('still disconnects when the Graph subscription is already gone', async () => {
    const { workspaceId, userId } = await makeWorkspace();
    const emailAccountId = await makeConnectedAccount(
      workspaceId,
      userId,
      'email',
      'founder@example.com',
    );
    await supabase
      .from('connected_accounts')
      .update({ watch_channel_id: `sub-${randomUUID()}` })
      .eq('id', emailAccountId)
      .throwOnError();

    const api = vi.fn(() => ({ delete: vi.fn().mockRejectedValue(new Error('404')) }));
    vi.mocked(getAuthorizedGraphClient).mockResolvedValue({ api } as unknown as Client);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await disconnectMicrosoftAccount(emailAccountId);

    const { data: account } = await supabase
      .from('connected_accounts')
      .select('id')
      .eq('id', emailAccountId)
      .maybeSingle()
      .throwOnError();
    expect(account).toBeNull();
  });
});
