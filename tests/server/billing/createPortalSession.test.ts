import { createServiceClient } from '@/src/db/service';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Stripe is a paid external API, so it's mocked at our own client factory.
const createPortalSession = vi.fn();
vi.mock('@/src/server/billing/stripe', () => ({
  createStripeClient: () => ({ billingPortal: { sessions: { create: createPortalSession } } }),
}));

const { createBillingPortalSession } = await import('@/src/server/billing/createPortalSession');

describe('createBillingPortalSession', () => {
  const supabase = createServiceClient();
  const companyIds: string[] = [];

  afterEach(async () => {
    createPortalSession.mockReset();
    if (companyIds.length) {
      await supabase.from('companies').delete().in('id', companyIds);
      companyIds.length = 0;
    }
  });

  async function makeCompany(stripeCustomerId: string | null) {
    const { data } = await supabase
      .from('companies')
      .insert({ name: 'Portal test co', stripe_customer_id: stripeCustomerId })
      .select('id')
      .single()
      .throwOnError();
    companyIds.push(data!.id);
    return data!.id as string;
  }

  it("opens the Stripe customer portal for the company's customer", async () => {
    const companyId = await makeCompany('cus_test_123');
    createPortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/abc' });

    const url = await createBillingPortalSession({
      companyId,
      returnUrl: 'https://app.example.com/billing',
    });

    expect(url).toBe('https://billing.stripe.com/p/session/abc');
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: 'cus_test_123',
      return_url: 'https://app.example.com/billing',
    });
  });

  it('refuses when the company has never checked out', async () => {
    const companyId = await makeCompany(null);

    await expect(
      createBillingPortalSession({ companyId, returnUrl: 'https://app.example.com/billing' }),
    ).rejects.toThrow(/no billing account/i);
    expect(createPortalSession).not.toHaveBeenCalled();
  });
});
