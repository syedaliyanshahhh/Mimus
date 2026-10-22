import { pollDueCalendlyAccounts } from '@/src/server/connectors/pollCalendly';
import { cronAuthError } from '@/src/server/http/cronAuth';
import { type NextRequest } from 'next/server';

// The Vercel Hobby limit. Raise to 800 on Pro (see README, "Deploying to
// Vercel"). Accounts a run doesn't reach are first in line next run.
export const maxDuration = 300;

// Picks up new and cancelled bookings for Calendly accounts without a
// webhook subscription (Calendly's Free plan has none). Scheduled by
// Vercel Cron (vercel.json); POST is for a manual run. Both need
// `Authorization: Bearer $CRON_SECRET`.
async function run(request: NextRequest) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  const result = await pollDueCalendlyAccounts();
  return Response.json(result);
}

export const GET = run;
export const POST = run;
