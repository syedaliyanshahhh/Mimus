import { createServiceClient } from '@/src/db/service';
import { pollDueCalendlyAccounts } from '@/src/server/connectors/pollCalendly';
import { getConnector, registerConnector } from '@/src/server/connectors/registry';
import type { Connector } from '@/src/server/connectors/types';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every run here pretends it's mid-2001, so only these rows -- not
// anything other test files or local dev data created -- were last synced
// long enough ago to be due.
const NOW = new Date('2001-06-01T00:00:00Z');
const LONG_AGO = '2001-01-01T00:00:00Z';
const JUST_NOW = '2001-05-31T23:58:00Z';

describe('pollDueCalendlyAccounts', () => {
  const supabase = createServiceClient();
  const createdUserIds: string[] = [];
  const poll = vi.fn<(id: string) => Promise<void>>(async () => {});
  let realCalendly: Connector | undefined;

  beforeEach(() => {
    try {
      realCalendly = getConnector('calendly');
    } catch {
      realCalendly = undefined;
    }
    registerConnector({
      provider: 'calendly',
      capabilities: ['scheduling'],
      getAuthUrl: async () => '',
      handleOAuthCallback: async () => [],
      backfill: async () => {},
      handleWebhook: async () => new Response(null),
      poll,
      refreshToken: async () => {},
      disconnect: async () => {},
    });
  });

  afterEach(async () => {
    poll.mockReset();
    if (realCalendly) registerConnector(realCalendly);
    await Promise.all(createdUserIds.map((id) => supabase.auth.admin.deleteUser(id)));
    createdUserIds.length = 0;
  });

  async function makeAccounts(
    rows: {
      lastSyncedAt: string | null;
      provider?: string;
      status?: string;
      webhook?: boolean;
    }[],
  ): Promise<string[]> {
    const { data: company } = await supabase
      .from('companies')
      .insert({ name: 'Calendly poll test co' })
      .select('id')
      .single()
      .throwOnError();
    const { data: workspace } = await supabase
      .from('workspaces')
      .insert({ company_id: company!.id, name: 'Calendly poll test ws' })
      .select('id')
      .single()
      .throwOnError();
    const userId = randomUUID();
    const { error } = await supabase.auth.admin.createUser({
      id: userId,
      email: `calendly-poll-${userId}@example.com`,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(userId);

    const ids: string[] = [];
    for (const row of rows) {
      const provider = row.provider ?? 'calendly';
      const { data: account } = await supabase
        .from('connected_accounts')
        .insert({
          workspace_id: workspace!.id,
          owner_user_id: userId,
          provider,
          account_type: provider === 'calendly' ? 'scheduling' : 'calendar',
          external_account_id: `https://api.calendly.com/users/${randomUUID()}`,
          status: row.status ?? 'connected',
          backfill_completed_at: row.lastSyncedAt,
          last_synced_at: row.lastSyncedAt,
          watch_channel_id: row.webhook
            ? 'https://api.calendly.com/webhook_subscriptions/sub-1'
            : null,
        })
        .select('id')
        .single()
        .throwOnError();
      ids.push(account!.id as string);
    }
    return ids;
  }

  it('re-syncs a Calendly account without a webhook that is due', async () => {
    const [due] = await makeAccounts([{ lastSyncedAt: LONG_AGO }]);

    const result = await pollDueCalendlyAccounts({ now: NOW });

    expect(result).toEqual({ polled: [due], failed: [] });
    expect(poll).toHaveBeenCalledWith(due);
  });

  it('skips accounts that synced recently, have a webhook, need reconnecting or never finished importing', async () => {
    await makeAccounts([
      { lastSyncedAt: JUST_NOW },
      { lastSyncedAt: LONG_AGO, webhook: true },
      { lastSyncedAt: LONG_AGO, status: 'needs_reauth' },
      // resume-backfills owns an import that never finished.
      { lastSyncedAt: null },
      { lastSyncedAt: LONG_AGO, provider: 'google' },
    ]);

    const result = await pollDueCalendlyAccounts({ now: NOW });

    expect(result).toEqual({ polled: [], failed: [] });
    expect(poll).not.toHaveBeenCalled();
  });

  it('polls the longest-waiting accounts first, up to the limit', async () => {
    const [newer, oldest, middle] = await makeAccounts([
      { lastSyncedAt: '2001-03-01T00:00:00Z' },
      { lastSyncedAt: '2001-01-01T00:00:00Z' },
      { lastSyncedAt: '2001-02-01T00:00:00Z' },
    ]);

    const result = await pollDueCalendlyAccounts({ now: NOW, limit: 2 });

    expect(result.polled).toEqual([oldest, middle]);
    expect(result.polled).not.toContain(newer);
  });

  it('carries on past an account whose sync fails', async () => {
    const [failing, working] = await makeAccounts([
      { lastSyncedAt: '2001-01-01T00:00:00Z' },
      { lastSyncedAt: '2001-02-01T00:00:00Z' },
    ]);
    poll.mockImplementation(async (id) => {
      if (id === failing) throw new Error('Calendly API request failed: 500');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await pollDueCalendlyAccounts({ now: NOW });

    expect(result).toEqual({ polled: [working], failed: [failing] });
  });
});
