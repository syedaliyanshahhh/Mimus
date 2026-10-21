'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { openBillingPortal } from './actions';

export function ManageSubscriptionButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            window.location.href = await openBillingPortal();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not open billing.');
            setPending(false);
          }
        }}
      >
        Manage or cancel subscription
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
