import { createServiceClient } from '@/src/db/service';
import { createStripeClient } from '@/src/server/billing/stripe';

// Stripe's hosted customer portal is where an Owner cancels, changes
// payment method or downloads invoices -- the "cancel at any time" path the
// Terms promise. What the portal allows is set in the Stripe dashboard
// (Settings -> Billing -> Customer portal), not here.
export async function createBillingPortalSession(params: {
  companyId: string;
  returnUrl: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data: company, error } = await supabase
    .from('companies')
    .select('stripe_customer_id')
    .eq('id', params.companyId)
    .single();
  if (error) throw error;
  if (!company.stripe_customer_id) {
    throw new Error('This workspace has no billing account yet');
  }

  const session = await createStripeClient().billingPortal.sessions.create({
    customer: company.stripe_customer_id,
    return_url: params.returnUrl,
  });
  return session.url;
}
