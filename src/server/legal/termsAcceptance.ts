import type { SupabaseClient } from '@supabase/supabase-js';

// The version of the Terms of Service and Privacy Policy users accept at
// /accept-terms. Bump it (to the new effective date) when either document
// changes materially: everyone is asked to accept again on their next
// visit, which is the in-app change notice the Terms promise.
export const CURRENT_TERMS_VERSION = '2026-10-22';

// The minimum age the Terms and Privacy Policy set.
export const MINIMUM_AGE = 18;

// Takes the caller's client: the signed-in user's own session in the app,
// where RLS (migration 0023) limits them to their own rows.
export async function hasAcceptedCurrentTerms(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('terms_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('terms_version', CURRENT_TERMS_VERSION)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function recordTermsAcceptance(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('terms_acceptances')
    .upsert(
      { user_id: userId, terms_version: CURRENT_TERMS_VERSION, age_confirmed: true },
      { onConflict: 'user_id,terms_version', ignoreDuplicates: true },
    );
  if (error) throw error;
}
