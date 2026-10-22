import { createServiceClient } from '@/src/db/service';
import { expect, test } from '@playwright/test';
import { acceptTermsOnPage, signInViaMagicLink } from './helpers';

async function acceptancesFor(email: string) {
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()
    .throwOnError();
  const { data } = await supabase
    .from('terms_acceptances')
    .select('terms_version, age_confirmed')
    .eq('user_id', profile!.id)
    .throwOnError();
  return { userId: profile!.id as string, rows: data ?? [] };
}

test('a new user accepts the Terms and confirms their age before using Mimus', async ({ page }) => {
  const email = `e2e-terms-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email, { acceptTerms: false });

  await expect(page).toHaveURL(/\/accept-terms/);
  await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();

  // Both boxes are required; the browser blocks submitting without them.
  await page.getByLabel(/i agree to the terms of service/i).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/accept-terms/);
  expect((await acceptancesFor(email)).rows).toHaveLength(0);

  await acceptTermsOnPage(page);
  await expect(page).toHaveURL(/\/sky$/);
  expect((await acceptancesFor(email)).rows).toEqual([
    { terms_version: expect.any(String), age_confirmed: true },
  ]);

  await page.goto('/members');
  await expect(page).toHaveURL(/\/members$/);
});

test('a user who has not accepted the current version is asked again', async ({ page }) => {
  const email = `e2e-terms-again-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);
  const { userId } = await acceptancesFor(email);

  // As if the Terms changed: their acceptance is for an older version.
  const supabase = createServiceClient();
  await supabase
    .from('terms_acceptances')
    .update({ terms_version: '2000-01-01' })
    .eq('user_id', userId)
    .throwOnError();

  await page.goto('/members');
  await expect(page).toHaveURL(/\/accept-terms/);
  await acceptTermsOnPage(page);
  expect((await acceptancesFor(email)).rows).toHaveLength(2);
});
