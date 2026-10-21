'use client';

import { useState } from 'react';
import { updateConnectionVisibility } from './actions';

type Visibility = 'private' | 'team' | 'company';

export function VisibilitySelect({
  accountId,
  visibility,
  canWiden,
}: {
  accountId: string;
  visibility: Visibility;
  canWiden: boolean;
}) {
  const [value, setValue] = useState(visibility);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        aria-label="Visibility"
        value={value}
        disabled={pending}
        onChange={async (event) => {
          const next = event.target.value as Visibility;
          const previous = value;
          setValue(next);
          setPending(true);
          setError(null);
          try {
            await updateConnectionVisibility(accountId, next);
          } catch (err) {
            setValue(previous);
            setError(err instanceof Error ? err.message : 'Could not change visibility.');
          } finally {
            setPending(false);
          }
        }}
        className="rounded-md border border-line-muted px-2 py-1 text-sm text-ink disabled:opacity-50"
      >
        <option value="private">Private</option>
        {/* Members can't widen above Private (RLS, migration 0005). */}
        <option value="team" disabled={!canWiden}>
          Team
        </option>
        <option value="company" disabled={!canWiden}>
          Company
        </option>
      </select>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
