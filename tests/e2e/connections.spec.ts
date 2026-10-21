import { createServiceClient } from '@/src/db/service';
import { expect, test } from '@playwright/test';
import { addWorkspaceMember, seedConnectedAccount, signInViaMagicLink } from './helpers';

// Google's OAuth client is app-level config set once per deployment: a dev
// machine usually has it in .env.local, CI never does. The page must
// handle both, so these tests assert whichever state applies.
const googleConfigured = Boolean(
  process.env.GOOGLE_OAUTH_CLIENT_ID &&
  process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
  process.env.GOOGLE_OAUTH_REDIRECT_URI,
);
const slackConfigured = Boolean(
  process.env.SLACK_CLIENT_ID &&
  process.env.SLACK_CLIENT_SECRET &&
  process.env.SLACK_OAUTH_REDIRECT_URI,
);

test('changing a connected account visibility and disconnecting persists through RLS', async ({
  page,
}) => {
  const email = `e2e-connections-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);
  await seedConnectedAccount(email);

  await page.goto('/settings/connections');

  const row = page.getByRole('listitem').filter({ hasText: 'Google Gmail' });
  await expect(row).toBeVisible();
  await expect(page.getByRole('group', { name: email })).toBeVisible();
  await expect(row.getByRole('combobox', { name: 'Visibility' })).toHaveValue('private');

  await row.getByRole('combobox', { name: 'Visibility' }).selectOption('team');
  await expect(row.getByRole('combobox', { name: 'Visibility' })).toHaveValue('team');

  // Reload to prove the change was persisted through the real RLS-respecting
  // write path (this page uses the signed-in user's own session, not a
  // service-role bypass), not just held in client-side state. The select's
  // onChange fires the update as an unawaited Server Action call, so retry
  // the reload+check instead of assuming it has already landed.
  let rowAfterReload = page.getByRole('listitem').filter({ hasText: 'Google Gmail' });
  await expect(async () => {
    await page.reload();
    rowAfterReload = page.getByRole('listitem').filter({ hasText: 'Google Gmail' });
    await expect(rowAfterReload.getByRole('combobox', { name: 'Visibility' })).toHaveValue('team');
  }).toPass({ timeout: 10_000 });

  await rowAfterReload.getByRole('button', { name: /disconnect/i }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Google Gmail' })).toHaveCount(0);
});

test('several Google accounts each show as Google Gmail and Google Calendar under their address', async ({
  page,
}) => {
  const email = `e2e-connections-multi-${Date.now()}@example.com`;
  const work = `work-${Date.now()}@example.com`;
  const personal = `personal-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);
  for (const externalAccountId of [work, personal]) {
    await seedConnectedAccount(email, { accountType: 'email', externalAccountId });
    await seedConnectedAccount(email, { accountType: 'calendar', externalAccountId });
  }

  await page.goto('/settings/connections');

  for (const address of [work, personal]) {
    const group = page.getByRole('group', { name: address });
    await expect(group.getByRole('listitem').filter({ hasText: 'Google Gmail' })).toHaveCount(1);
    await expect(group.getByRole('listitem').filter({ hasText: 'Google Calendar' })).toHaveCount(1);
  }

  if (googleConfigured) {
    await expect(page.getByRole('link', { name: /add another google account/i })).toHaveAttribute(
      'href',
      '/api/connectors/google/start',
    );
  }
});

test('the Connect Google account link points at the OAuth start route when Google is configured', async ({
  page,
}) => {
  const email = `e2e-connections-link-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);

  await page.goto('/settings/connections');
  await expect(page.getByRole('heading', { name: 'Gmail & Google Calendar' })).toBeVisible();

  if (googleConfigured) {
    await expect(page.getByRole('link', { name: /connect google account/i })).toHaveAttribute(
      'href',
      '/api/connectors/google/start',
    );
  } else {
    await expect(page.getByText(/google connection isn't set up/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /connect google account/i })).toHaveCount(0);
  }
});

test('several Slack workspaces each show as their own named connection', async ({ page }) => {
  const email = `e2e-connections-slack-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);
  const workspaces = [
    { id: `T_ACME_${Date.now()}`, name: 'Acme Corp', domain: 'acme.slack.com' },
    { id: `T_GLOBEX_${Date.now()}`, name: 'Globex', domain: 'globex.slack.com' },
  ];
  for (const workspace of workspaces) {
    await seedConnectedAccount(email, {
      provider: 'slack',
      externalAccountId: 'U_E2E',
      providerTeamId: workspace.id,
      providerTeamName: workspace.name,
      providerTeamDomain: workspace.domain,
    });
  }

  await page.goto('/settings/connections');
  await expect(page.getByRole('heading', { name: 'Slack', exact: true })).toBeVisible();

  for (const workspace of workspaces) {
    const group = page.getByRole('group', { name: workspace.name });
    await expect(group.getByText(workspace.domain)).toBeVisible();
    await expect(group.getByRole('listitem').filter({ hasText: 'Slack' })).toHaveCount(1);
  }

  if (slackConfigured) {
    await expect(page.getByRole('link', { name: /add another slack workspace/i })).toHaveAttribute(
      'href',
      '/api/connectors/slack/start',
    );
  } else {
    await expect(page.getByText(/slack connection isn't set up/i)).toBeVisible();
  }
});

test('the Connect Slack workspace link points at the OAuth start route when Slack is configured', async ({
  page,
}) => {
  const email = `e2e-connections-slack-link-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);

  await page.goto('/settings/connections');

  if (slackConfigured) {
    await expect(page.getByRole('link', { name: /connect slack workspace/i })).toHaveAttribute(
      'href',
      '/api/connectors/slack/start',
    );
  } else {
    await expect(page.getByText(/slack connection isn't set up/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /connect slack/i })).toHaveCount(0);
  }
});

test('an own Google account offers “Allow sending and booking” until it has the write permissions', async ({
  page,
}) => {
  test.skip(!googleConfigured, 'The OAuth link only shows when Google is configured');
  const email = `e2e-connections-write-${Date.now()}@example.com`;
  const readOnly = `readonly-${Date.now()}@example.com`;
  const writable = `writable-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);
  const read = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ];
  const write = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
  ];
  for (const accountType of ['email', 'calendar'] as const) {
    await seedConnectedAccount(email, { accountType, externalAccountId: readOnly, scopes: read });
    await seedConnectedAccount(email, {
      accountType,
      externalAccountId: writable,
      scopes: [...read, ...write],
    });
  }

  await page.goto('/settings/connections');

  const allow = page
    .getByRole('group', { name: readOnly })
    .getByRole('link', { name: 'Allow sending and booking' });
  await expect(allow).toHaveAttribute(
    'href',
    `/api/connectors/google/start?access=write&account=${encodeURIComponent(readOnly)}`,
  );
  await expect(
    page.getByRole('group', { name: writable }).getByText('Can send and book'),
  ).toBeVisible();
});

test('a read-only workspace can still set an account back to Private and disconnect it', async ({
  page,
}) => {
  const email = `e2e-connections-readonly-${Date.now()}@example.com`;
  await signInViaMagicLink(page, email);
  const accountId = await seedConnectedAccount(email);

  const supabase = createServiceClient();
  const { data: account } = await supabase
    .from('connected_accounts')
    .update({ visibility: 'team' })
    .eq('id', accountId)
    .select('workspace_id')
    .single()
    .throwOnError();
  await supabase
    .from('workspace_subscriptions')
    .insert({ workspace_id: account!.workspace_id, status: 'past_due' })
    .throwOnError();

  await page.goto('/settings/connections');
  const row = page.getByRole('listitem').filter({ hasText: 'Google Gmail' });
  await row.getByRole('combobox', { name: 'Visibility' }).selectOption('private');
  await expect(row.getByRole('alert')).toHaveCount(0);
  await expect(async () => {
    await page.reload();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: 'Google Gmail' })
        .getByRole('combobox', { name: 'Visibility' }),
    ).toHaveValue('private');
  }).toPass({ timeout: 10_000 });

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Google Gmail' })
    .getByRole('button', { name: /disconnect/i })
    .click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Google Gmail' })).toHaveCount(0);
});

test('a Member is only offered Private for their own account', async ({ page }) => {
  const stamp = Date.now();
  const ownerEmail = `e2e-connections-owner-${stamp}@example.com`;
  const memberEmail = `e2e-connections-member-${stamp}@example.com`;
  await signInViaMagicLink(page, ownerEmail);
  await addWorkspaceMember(ownerEmail, { email: memberEmail, role: 'member' });

  await page.context().clearCookies();
  await signInViaMagicLink(page, memberEmail);
  await seedConnectedAccount(memberEmail);
  await page.goto('/settings/connections');

  const select = page
    .getByRole('listitem')
    .filter({ hasText: 'Google Gmail' })
    .getByRole('combobox', { name: 'Visibility' });
  await expect(select).toHaveValue('private');
  await expect(select.locator('option[value="team"]')).toBeDisabled();
  await expect(select.locator('option[value="company"]')).toBeDisabled();
});
