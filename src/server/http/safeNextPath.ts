const PLACEHOLDER_ORIGIN = 'http://mimus.invalid';

// `next` arrives from the query string or a client-set cookie, so it's
// untrusted. Only a path on this same site is allowed through; anything
// else (absolute URLs, protocol-relative `//host`, `/\host` that browsers
// treat the same way, control characters) falls back to `/`.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || /[\\\u0000-\u001f]/.test(next)) {
    return '/';
  }
  const url = new URL(next, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN) {
    return '/';
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
