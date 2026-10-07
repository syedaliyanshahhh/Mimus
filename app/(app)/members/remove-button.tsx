'use client';

import { useState } from 'react';
import { removeMember } from './actions';

export function RemoveButton({ memberId }: { memberId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await removeMember(memberId);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not remove member.');
          } finally {
            setPending(false);
          }
        }}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Remove
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
