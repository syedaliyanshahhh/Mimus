// Re-syncs Calendly accounts that have no webhook subscription: Calendly's
// Free plan has none, so polling is the only way their new and cancelled
// bookings arrive. Kept at the connectors root, like resumeBackfills.ts,
// so the cron route can import it.
import { createServiceClient } from '@/src/db/service';
import { getConnector } from '@/src/server/connectors/bootstrap';

// An account synced more recently than this isn't due again yet.
const POLL_INTERVAL_MS = 10 * 60 * 1000;

// Longest-waiting first. Accounts whose first import never finished are
// left to resume-backfills, and accounts that need reconnecting are
// skipped (the token refresh that failed for them would only fail again).
export async function pollDueCalendlyAccounts({
  limit = 10,
  now = new Date(),
}: { limit?: number; now?: Date } = {}): Promise<{ polled: string[]; failed: string[] }> {
  const { data } = await createServiceClient()
    .from('connected_accounts')
    .select('id')
    .eq('provider', 'calendly')
    .eq('status', 'connected')
    .is('watch_channel_id', null)
    .lt('last_synced_at', new Date(now.getTime() - POLL_INTERVAL_MS).toISOString())
    .order('last_synced_at', { ascending: true })
    .limit(limit)
    .throwOnError();

  const polled: string[] = [];
  const failed: string[] = [];
  // One at a time, so a run stays well inside one function's time limit
  // and one account's failure doesn't stop the rest.
  for (const account of data ?? []) {
    try {
      await getConnector('calendly').poll(account.id);
      polled.push(account.id);
    } catch (err) {
      console.error(`Polling Calendly account ${account.id} failed`, err);
      failed.push(account.id);
    }
  }
  return { polled, failed };
}
