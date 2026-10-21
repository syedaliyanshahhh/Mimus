import { getCurrentWorkspaceContext } from '@/src/server/workspaces/getCurrentWorkspaceContext';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Card } from '@/components/ui/card';

const LOG_LIMIT = 200;

export default function AuditLogPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <AuditLogContent />
    </Suspense>
  );
}

async function AuditLogContent() {
  await connection();
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return (
      <Card>
        <Link
          href="/sign-in?next=/audit-log"
          className="font-medium text-accent-strong hover:text-accent"
        >
          Sign in
        </Link>
      </Card>
    );
  }

  const { supabase, workspaceId, role } = context;

  if (role !== 'owner') {
    return (
      <Card>
        <h1 className="mb-2 text-2xl font-semibold text-ink">AI usage log</h1>
        <p className="text-sm text-ink-muted">Only workspace Owners can see the AI usage log.</p>
      </Card>
    );
  }

  // RLS (migration 0008) already limits agent_logs to the workspace Owner;
  // the role check above only picks which message to show.
  const { data: logs } = await supabase
    .from('agent_logs')
    .select(
      'id, created_at, user_id, nature, model_id, input_tokens, output_tokens, cost_usd, status',
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(LOG_LIMIT);

  const userIds = [
    ...new Set((logs ?? []).map((log) => log.user_id).filter((id): id is string => !!id)),
  ];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from('profiles').select('id, email').in('id', userIds)
      : { data: [] as { id: string; email: string }[] };
  const emailByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  return (
    <Card>
      <h1 className="mb-2 text-2xl font-semibold text-ink">AI usage log</h1>
      <p className="mb-4 text-sm text-ink-muted">
        Every request Ask Mimus handled in this workspace: who asked, which model answered, and what
        it cost. Questions and answers themselves aren&apos;t stored. Showing the latest {LOG_LIMIT}
        .
      </p>
      {(logs ?? []).length === 0 ? (
        <p className="text-sm text-ink-muted">No AI requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Time (UTC)</th>
                <th className="py-2 pr-4 font-medium">Who</th>
                <th className="py-2 pr-4 font-medium">Request</th>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">Tokens in/out</th>
                <th className="py-2 pr-4 font-medium">Cost</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-muted text-ink">
              {(logs ?? []).map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(log.created_at).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-2 pr-4">
                    {log.user_id ? (emailByUserId.get(log.user_id) ?? log.user_id) : 'Deleted user'}
                  </td>
                  <td className="py-2 pr-4">{log.nature}</td>
                  <td className="py-2 pr-4">{log.model_id ?? '—'}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {log.input_tokens ?? 0} / {log.output_tokens ?? 0}
                  </td>
                  <td className="py-2 pr-4">
                    {log.cost_usd == null ? '—' : `$${Number(log.cost_usd).toFixed(4)}`}
                  </td>
                  <td className="py-2">{log.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
