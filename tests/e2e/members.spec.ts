import { expect, test } from '@playwright/test';
import { createServiceClient } from '@/src/db/service';
import {
  addWorkspaceMember,
  latestInviteToken,
  latestMagicLink,
  signInViaMagicLink,
} from './helpers';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

test('owner invites, promotes, and removes a teammate through real RLS', async ({
  page,
  browser,
}) => {
  const ownerEmail = `e2e-members-owner-${Date.now()}@example.com`;
  const inviteeEmail = `e2e-members-invitee-${Date.now()}@example.com`;

  await signInViaMagicLink(page, ownerEmail);
  await page.goto('/members');

  await page.getByLabel('Email').fill(inviteeEmail);
  await page.getByRole('button', { name: /send invite/i }).click();
  // The form clears its own email field on success, proving the invite
  // action resolved rather than threw.
  await expect(page.getByLabel('Email')).toHaveValue('');

  const inviteToken = await latestInviteToken(inviteeEmail);
  const inviteLink = `${BASE_URL}/invite/${inviteToken}`;

  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();

  await inviteePage.goto(inviteLink);
  await inviteePage.getByRole('link', { name: 'Sign in' }).click();
  await inviteePage.getByLabel('Email').fill(inviteeEmail);
  await inviteePage.getByRole('button', { name: /send magic link/i }).click();
  await expect(inviteePage.getByText(/check your email/i)).toBeVisible();

  const magicLink = await latestMagicLink(inviteeEmail);
  await inviteePage.goto(magicLink);
  await expect(inviteePage.getByText(/joined the workspace/i)).toBeVisible();
  await inviteeContext.close();

  // Signing in through the invite must not also auto-provision the
  // invitee's own workspace: exactly one membership, the owner's.
  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', [ownerEmail, inviteeEmail])
    .throwOnError();
  const idOf = (email: string) => profiles!.find((p) => p.email === email)!.id;
  const { data: ownerMembership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', idOf(ownerEmail))
    .single()
    .throwOnError();
  const { data: inviteeMemberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', idOf(inviteeEmail))
    .throwOnError();
  expect(inviteeMemberships).toEqual([{ workspace_id: ownerMembership!.workspace_id }]);

  await page.reload();
  const row = page.getByRole('listitem').filter({ hasText: inviteeEmail });
  await expect(row).toBeVisible();
  await expect(row.getByRole('combobox', { name: 'Role' })).toHaveValue('member');

  await row.getByRole('combobox', { name: 'Role' }).selectOption('manager');
  await expect(row.getByRole('combobox', { name: 'Role' })).toHaveValue('manager');
  // RoleSelect's onChange awaits the server action and only re-enables the
  // select once it resolves -- wait for that before reloading, otherwise
  // the reload can race the still-in-flight write and read back the old role.
  await expect(row.getByRole('combobox', { name: 'Role' })).not.toBeDisabled();

  // Reload to prove the role change was persisted through the real
  // RLS-respecting write path (migration 0011's UPDATE policy), not just
  // held in client-side state.
  await page.reload();
  const rowAfterReload = page.getByRole('listitem').filter({ hasText: inviteeEmail });
  await expect(rowAfterReload.getByRole('combobox', { name: 'Role' })).toHaveValue('manager');

  await rowAfterReload.getByRole('button', { name: /remove/i }).click();
  await expect(page.getByRole('listitem').filter({ hasText: inviteeEmail })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: inviteeEmail })).toHaveCount(0);
});

test('owner assigns who a member reports to', async ({ page }) => {
  const stamp = Date.now();
  const ownerEmail = `e2e-reports-owner-${stamp}@example.com`;
  const managerEmail = `e2e-reports-manager-${stamp}@example.com`;
  const memberEmail = `e2e-reports-member-${stamp}@example.com`;

  await signInViaMagicLink(page, ownerEmail);
  const manager = await addWorkspaceMember(ownerEmail, { email: managerEmail, role: 'manager' });
  const member = await addWorkspaceMember(ownerEmail, { email: memberEmail, role: 'member' });

  await page.goto('/members');
  const row = page.getByRole('listitem').filter({ hasText: memberEmail });
  const reportsTo = row.getByRole('combobox', { name: 'Reports to' });
  await expect(reportsTo).toHaveValue('');

  await reportsTo.selectOption({ label: managerEmail });
  await expect(reportsTo).not.toBeDisabled();

  await page.reload();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: memberEmail })
      .getByRole('combobox', { name: 'Reports to' }),
  ).toHaveValue(manager.membershipId);

  const { data } = await createServiceClient()
    .from('workspace_members')
    .select('manager_id')
    .eq('id', member.membershipId)
    .single()
    .throwOnError();
  expect(data!.manager_id).toBe(manager.membershipId);
});

test('a removed member can still reach Settings → Account to delete their account', async ({
  page,
}) => {
  const stamp = Date.now();
  const ownerEmail = `e2e-removed-owner-${stamp}@example.com`;
  const memberEmail = `e2e-removed-member-${stamp}@example.com`;

  await signInViaMagicLink(page, ownerEmail);
  const member = await addWorkspaceMember(ownerEmail, { email: memberEmail, role: 'member' });
  await createServiceClient()
    .from('workspace_members')
    .update({ status: 'removed' })
    .eq('id', member.membershipId)
    .throwOnError();

  await page.context().clearCookies();
  await signInViaMagicLink(page, memberEmail);
  await page.goto('/settings/account');
  await expect(page.getByText(`Signed in as ${memberEmail}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Delete account' })).toBeVisible();
});
