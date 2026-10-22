import { safeNextPath } from '@/src/server/http/safeNextPath';
import { MINIMUM_AGE } from '@/src/server/legal/termsAcceptance';
import Link from 'next/link';
import { Suspense } from 'react';
import { MimusLogo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { acceptTerms } from './actions';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The clickwrap: shown after first sign-in and again whenever
// CURRENT_TERMS_VERSION changes. The (app) layout and the auth callback
// send users here until they've accepted.
export default function AcceptTermsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-paper px-4 py-12">
      <ThemeToggle className="absolute top-4 right-4" />
      <Link href="/" aria-label="Mimus home" className="text-ink">
        <MimusLogo className="h-[34px] w-auto" />
      </Link>
      <div className="w-full max-w-md rounded-card border border-line-muted bg-paper-raised p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-ink">Before you start</h1>
        <p className="mb-6 text-sm text-ink-muted">
          Please read and accept our terms. If they change, we&apos;ll ask you again.
        </p>
        <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
          <AcceptTermsForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function AcceptTermsForm({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;

  return (
    <form action={acceptTerms} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="next"
        value={safeNextPath(typeof next === 'string' ? next : null)}
      />
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="agree" required className="mt-1" />
        <span>
          I agree to the{' '}
          <Link href="/terms" target="_blank" className="underline underline-offset-2">
            Terms of Service
          </Link>{' '}
          and the{' '}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="age" required className="mt-1" />
        <span>I am {MINIMUM_AGE} or older.</span>
      </label>
      <Button type="submit">Continue</Button>
    </form>
  );
}
