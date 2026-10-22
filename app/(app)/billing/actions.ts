'use server';

import { createCheckoutSession } from '@/src/server/billing/createCheckoutSession';
import { createBillingPortalSession } from '@/src/server/billing/createPortalSession';
import { getBaseUrl } from '@/src/server/http/getBaseUrl';
import { getCurrentWorkspaceContext } from '@/src/server/workspaces/getCurrentWorkspaceContext';

// Deliberately does NOT call assertWorkspaceWritable: starting a new
// checkout is the recovery path out of a read-only (past-due/canceled)
// workspace, so it must stay available precisely when writes are blocked.
export async function startCheckout(planId: string): Promise<string> {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    throw new Error('Not signed in');
  }
  if (context.role !== 'owner') {
    throw new Error('Only the workspace owner can manage billing');
  }

  const { data: workspace, error } = await context.supabase
    .from('workspaces')
    .select('company_id')
    .eq('id', context.workspaceId)
    .single();
  if (error) throw error;

  const { data: plan, error: planError } = await context.supabase
    .from('plans')
    .select('stripe_price_id')
    .eq('id', planId)
    .single();
  if (planError) throw planError;
  if (!plan.stripe_price_id) {
    throw new Error('This plan has no Stripe price configured yet');
  }

  const baseUrl = await getBaseUrl();
  return createCheckoutSession({
    workspaceId: context.workspaceId,
    companyId: workspace.company_id,
    planId,
    priceId: plan.stripe_price_id,
    successUrl: `${baseUrl}/billing?checkout=success`,
    cancelUrl: `${baseUrl}/billing?checkout=canceled`,
  });
}

// Also skips assertWorkspaceWritable: cancelling or fixing a failed
// payment has to work while the workspace is read-only.
export async function openBillingPortal(): Promise<string> {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    throw new Error('Not signed in');
  }
  if (context.role !== 'owner') {
    throw new Error('Only the workspace owner can manage billing');
  }

  const { data: workspace, error } = await context.supabase
    .from('workspaces')
    .select('company_id')
    .eq('id', context.workspaceId)
    .single();
  if (error) throw error;

  const baseUrl = await getBaseUrl();
  return createBillingPortalSession({
    companyId: workspace.company_id,
    returnUrl: `${baseUrl}/billing`,
  });
}
