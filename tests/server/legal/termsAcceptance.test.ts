import { createServiceClient } from '@/src/db/service';
import {
  CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms,
  recordTermsAcceptance,
} from '@/src/server/legal/termsAcceptance';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

describe('terms acceptance', () => {
  const supabase = createServiceClient();
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdUserIds.map((id) => supabase.auth.admin.deleteUser(id)));
    createdUserIds.length = 0;
  });

  async function newUser() {
    const id = randomUUID();
    const { error } = await supabase.auth.admin.createUser({
      id,
      email: `terms-${id}@example.com`,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(id);
    return id;
  }

  it('is false until the current version is recorded, then true', async () => {
    const userId = await newUser();
    expect(await hasAcceptedCurrentTerms(supabase, userId)).toBe(false);

    await recordTermsAcceptance(supabase, userId);

    expect(await hasAcceptedCurrentTerms(supabase, userId)).toBe(true);
    const { data } = await supabase
      .from('terms_acceptances')
      .select('terms_version, age_confirmed')
      .eq('user_id', userId)
      .throwOnError();
    expect(data).toEqual([{ terms_version: CURRENT_TERMS_VERSION, age_confirmed: true }]);
  });

  it('asks again when only an older version was accepted', async () => {
    const userId = await newUser();
    await supabase
      .from('terms_acceptances')
      .insert({ user_id: userId, terms_version: '2000-01-01', age_confirmed: true })
      .throwOnError();

    expect(await hasAcceptedCurrentTerms(supabase, userId)).toBe(false);
  });

  it('recording twice keeps one row', async () => {
    const userId = await newUser();
    await recordTermsAcceptance(supabase, userId);
    await recordTermsAcceptance(supabase, userId);

    const { count } = await supabase
      .from('terms_acceptances')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    expect(count).toBe(1);
  });
});
