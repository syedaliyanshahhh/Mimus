import { isWorkspaceReadOnly } from '@/src/server/billing/killSwitch';
import { hasAcceptedCurrentTerms } from '@/src/server/legal/termsAcceptance';
import { getCurrentWorkspaceContext } from '@/src/server/workspaces/getCurrentWorkspaceContext';
import { getInitials } from '@/src/lib/get-display-name';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ReadOnlyBanner } from './read-only-banner';
import { TopNav } from './top-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line-muted bg-paper-raised">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <Suspense fallback={<TopNav identity={null} />}>
            <TopNavServer />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Suspense fallback={null}>
          <TermsGate />
        </Suspense>
        <Suspense fallback={null}>
          <ReadOnlyBannerServer />
        </Suspense>
        {children}
      </main>
    </div>
  );
}

// Sends a signed-in user who hasn't accepted the current Terms version to
// the clickwrap -- covers sessions that predate it or a version bump. New
// sign-ins are caught earlier, in the auth callback.
async function TermsGate() {
  await connection();
  const context = await getCurrentWorkspaceContext();
  if (context && !(await hasAcceptedCurrentTerms(context.supabase, context.userId))) {
    redirect('/accept-terms');
  }
  return null;
}

async function TopNavServer() {
  await connection();
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return <TopNav identity={null} />;
  }

  // Proposals waiting on the user's decision (RLS: their own only).
  const { count } = await context.supabase
    .from('scheduling_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', context.workspaceId)
    .eq('status', 'pending');

  return (
    <TopNav
      identity={{ initials: getInitials(context.fullName, context.email), email: context.email }}
      pendingApprovals={count ?? 0}
    />
  );
}

async function ReadOnlyBannerServer() {
  await connection();
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return null;
  }

  const readOnly = await isWorkspaceReadOnly(context.workspaceId);
  return <ReadOnlyBanner isReadOnly={readOnly} />;
}
