import { createServiceClient } from '@/src/db/service';
import { CalendlyTokenError, refreshAndStoreTokens } from '@/src/server/connectors/calendly/oauth';
import { decryptToken, pgByteaToBuffer } from '@/src/server/crypto/tokenVault';

const API_BASE = 'https://api.calendly.com';

// Deliberately has no `method` parameter -- there is no way to construct
// a write call (POST/PATCH/DELETE against scheduled_events/invitees)
// through this function, by construction. This is what backs sync.ts's
// "no outbound write call exists in this module" guarantee: it isn't
// just that nothing currently calls a write endpoint, it's that nothing
// *can*, short of bypassing this module and calling fetch() directly.
export async function calendlyGet<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Calendly API request to ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// Calendly access tokens last two hours. Refreshing this long before
// expiry leaves a sync that starts with the token enough time to finish
// with it.
const REFRESH_AFTER_MS = 90 * 60 * 1000;

async function readStoredAccessToken(connectedAccountId: string) {
  const { data: secret, error } = await createServiceClient()
    .from('connected_account_secrets')
    .select('encrypted_access_token, key_version, updated_at')
    .eq('connected_account_id', connectedAccountId)
    .single();
  if (error) throw error;
  if (!secret.encrypted_access_token || secret.key_version == null) {
    throw new Error(`No stored Calendly credentials for connected account ${connectedAccountId}`);
  }

  const accessToken = await decryptToken(
    pgByteaToBuffer(secret.encrypted_access_token as string),
    secret.key_version,
  );
  return { accessToken, storedAt: secret.updated_at as string };
}

// The access token to call Calendly with, refreshed first when it's near
// expiry. connected_account_secrets.updated_at is when the current pair
// was issued: connect, reconnect and refresh all rewrite it.
export async function getValidAccessToken(connectedAccountId: string): Promise<string> {
  const stored = await readStoredAccessToken(connectedAccountId);
  if (Date.now() - new Date(stored.storedAt).getTime() < REFRESH_AFTER_MS) {
    return stored.accessToken;
  }

  try {
    await refreshAndStoreTokens(connectedAccountId);
  } catch (err) {
    // Calendly rotates the refresh token on every use, so when two runs
    // refresh at once (a webhook landing mid-poll), the slower one is
    // refused -- after the faster one stored a working pair.
    const latest = await readStoredAccessToken(connectedAccountId);
    if (latest.storedAt !== stored.storedAt) {
      return latest.accessToken;
    }
    // A refused refresh token means the grant is gone (revoked in
    // Calendly, or the app's access removed): only reconnecting fixes it.
    if (err instanceof CalendlyTokenError && err.code === 'invalid_grant') {
      await createServiceClient()
        .from('connected_accounts')
        .update({ status: 'needs_reauth' })
        .eq('id', connectedAccountId)
        .throwOnError();
    }
    throw err;
  }

  return (await readStoredAccessToken(connectedAccountId)).accessToken;
}
