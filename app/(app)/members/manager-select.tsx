'use client';

import { useState } from 'react';
import { assignManager } from './actions';

export function ManagerSelect({
  memberId,
  managerId,
  managers,
}: {
  memberId: string;
  managerId: string | null;
  managers: { id: string; label: string }[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        aria-label="Reports to"
        defaultValue={managerId ?? ''}
        disabled={pending}
        onChange={async (event) => {
          setPending(true);
          setError(null);
          try {
            await assignManager(memberId, event.target.value || null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not change manager.');
          } finally {
            setPending(false);
          }
        }}
        className="rounded-md border border-line-muted px-2 py-1 text-sm text-ink disabled:opacity-50"
      >
        <option value="">No manager</option>
        {managers.map((manager) => (
          <option key={manager.id} value={manager.id}>
            {manager.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
