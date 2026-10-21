import { expect, test } from '@playwright/test';
import { createServiceClient } from '@/src/db/service';
import { addWorkspaceMember, signInViaMagicLink } from './helpers';

test('the AI usage log is visible to Owners and hidden from Members', async ({ page, browser }) => {
  const stamp = Date.now();
  const ownerEmail = `e2e-audit-owner-${stamp}@example.com`;
  const memberEmail = `e2e-audit-member-${stamp}@example.com`;
  const modelId = `e2e-model-${stamp}`;

  await signInViaMagicLink(page, ownerEmail);
  const member = await addWorkspaceMember(ownerEmail, { email: memberEmail, role: 'member' });

  const supabase = createServiceClient();
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', member.userId)
    .single()
    .throwOnError();
  // Logged as the member, through the same RPC the agent uses.
  await supabase
    .rpc('log_agent_request', {
      p_workspace_id: membership!.workspace_id,
      p_user_id: member.userId,
      p_nature: 'question',
      p_priority: 'normal',
      p_model_tier: 'fast',
      p_model_id: modelId,
      p_input_tokens: 120,
      p_output_tokens: 40,
      p_cost_usd: 0.0123,
      p_source_ids: [],
      p_status: 'ok',
    })
    .throwOnError();

  await page.goto('/audit-log');
  await expect(page.getByRole('heading', { name: 'AI usage log' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: modelId });
  await expect(row).toBeVisible();
  await expect(row).toContainText(memberEmail);
  await expect(row).toContainText('$0.0123');

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signInViaMagicLink(memberPage, memberEmail);
  await memberPage.goto('/audit-log');
  await expect(memberPage.getByText(/only workspace owners can see/i)).toBeVisible();
  await expect(memberPage.getByText(modelId)).toHaveCount(0);
  await memberContext.close();
});
