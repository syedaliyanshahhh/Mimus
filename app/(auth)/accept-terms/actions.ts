'use server';

import { createClient } from '@/src/db/server';
import { safeNextPath } from '@/src/server/http/safeNextPath';
import { recordTermsAcceptance } from '@/src/server/legal/termsAcceptance';
import { redirect } from 'next/navigation';

export async function acceptTerms(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get('next')?.toString());
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;
  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  // The checkboxes are `required` in the form; this is the server-side
  // check for a submission that skipped the browser's.
  if (formData.get('agree') !== 'on' || formData.get('age') !== 'on') {
    redirect(`/accept-terms?next=${encodeURIComponent(next)}`);
  }

  await recordTermsAcceptance(supabase, userId);
  redirect(next);
}
