import { createServiceClient } from '@/src/db/service';
import { getValidAccessToken } from '@/src/server/connectors/calendly/client';
import { bufferToPgBytea, encryptToken } from '@/src/server/crypto/tokenVault';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HOURS_AGO = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

describe('calendly getValidAccessToken', () => {
  const supabase = createServiceClient();
  const createdUserIds: string[] = [];

  beforeEach(() => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    vi.stubEnv('CALENDLY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('CALENDLY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv(
      'CALENDLY_OAUTH_REDIRECT_URI',
      'http://localhost:3000/api/connectors/calendly/callback',
    );
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await Promise.all(createdUserIds.map((id) => supabase.auth.admin.deleteUser(id)));
    createdUserIds.length = 0;
  });

  async function makeConnectedAccount(tokensStoredAt: string) {
    const { data: company } = await supabase
      .from('companies')
      .insert({ name: 'Calendly token test co' })
      .select('id')
      .single()
      .throwOnError();
    const { data: workspace } = await supabase
      .from('workspaces')
      .insert({ company_id: company!.id, name: 'Calendly token test ws' })
      .select('id')
      .single()
      .throwOnError();
    const userId = randomUUID();
    const { error } = await supabase.auth.admin.createUser({
      id: userId,
      email: `calendly-token-${userId}@example.com`,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(userId);

    const { data: account } = await supabase
      .from('connected_accounts')
      .insert({
        workspace_id: workspace!.id,
        owner_user_id: userId,
        provider: 'calendly',
        account_type: 'scheduling',
        external_account_id: 'https://api.calendly.com/users/abc',
      })
      .select('id')
      .single()
      .throwOnError();

    await storeTokens(account!.id as string, 'old-access', 'old-refresh', tokensStoredAt);
    return account!.id as string;
  }

  async function storeTokens(
    connectedAccountId: string,
    accessToken: string,
    refreshToken: string,
    updatedAt: string,
  ) {
    const { ciphertext: encryptedAccessToken, keyVersion } = await encryptToken(accessToken);
    const { ciphertext: encryptedRefreshToken } = await encryptToken(refreshToken);
    await supabase
      .from('connected_account_secrets')
      .upsert({
        connected_account_id: connectedAccountId,
        encrypted_access_token: bufferToPgBytea(encryptedAccessToken),
        encrypted_refresh_token: bufferToPgBytea(encryptedRefreshToken),
        key_version: keyVersion,
        updated_at: updatedAt,
      })
      .throwOnError();
  }

  // Intercepts only Calendly's token endpoint; the local Supabase calls
  // share this global fetch and pass through.
  function stubTokenEndpoint(respond: () => Promise<Response> | Response) {
    const realFetch = globalThis.fetch;
    return vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) =>
        String(input) === 'https://auth.calendly.com/oauth/token'
          ? respond()
          : realFetch(input, init),
      );
  }

  it('returns a recently stored token without refreshing it', async () => {
    const connectedAccountId = await makeConnectedAccount(HOURS_AGO(0.5));
    const fetchSpy = stubTokenEndpoint(() => new Response('unexpected', { status: 500 }));

    await expect(getValidAccessToken(connectedAccountId)).resolves.toBe('old-access');
    expect(
      fetchSpy.mock.calls.some(([input]) => String(input).startsWith('https://auth.calendly.com')),
    ).toBe(false);
  });

  it('refreshes a token close to its two-hour expiry and returns the new one', async () => {
    const connectedAccountId = await makeConnectedAccount(HOURS_AGO(1.9));
    stubTokenEndpoint(() =>
      Response.json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 7200,
        owner: 'https://api.calendly.com/users/abc',
        organization: 'https://api.calendly.com/organizations/def',
      }),
    );

    await expect(getValidAccessToken(connectedAccountId)).resolves.toBe('new-access');
    // Stored too, so the next caller doesn't refresh again.
    await expect(getValidAccessToken(connectedAccountId)).resolves.toBe('new-access');
  });

  it('uses the token another run just refreshed when its own refresh loses the race', async () => {
    const connectedAccountId = await makeConnectedAccount(HOURS_AGO(3));
    // Calendly rotates refresh tokens, so a run that refreshes with one
    // another run already used gets invalid_grant -- by then the other
    // run has stored a working pair.
    stubTokenEndpoint(async () => {
      await storeTokens(
        connectedAccountId,
        'raced-access',
        'raced-refresh',
        new Date().toISOString(),
      );
      return Response.json(
        {
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        },
        { status: 400 },
      );
    });

    await expect(getValidAccessToken(connectedAccountId)).resolves.toBe('raced-access');
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('status')
      .eq('id', connectedAccountId)
      .single()
      .throwOnError();
    expect(account!.status).toBe('connected');
  });

  it('marks the account for reconnecting when Calendly rejects the refresh token', async () => {
    const connectedAccountId = await makeConnectedAccount(HOURS_AGO(3));
    stubTokenEndpoint(() =>
      Response.json(
        {
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        },
        { status: 400 },
      ),
    );

    await expect(getValidAccessToken(connectedAccountId)).rejects.toThrow(/invalid_grant/);
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('status')
      .eq('id', connectedAccountId)
      .single()
      .throwOnError();
    expect(account!.status).toBe('needs_reauth');
  });

  it('leaves the account connected when the refresh fails for another reason', async () => {
    const connectedAccountId = await makeConnectedAccount(HOURS_AGO(3));
    stubTokenEndpoint(() => Response.json({ error: 'server_error' }, { status: 503 }));

    await expect(getValidAccessToken(connectedAccountId)).rejects.toThrow();
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('status')
      .eq('id', connectedAccountId)
      .single()
      .throwOnError();
    expect(account!.status).toBe('connected');
  });
});
