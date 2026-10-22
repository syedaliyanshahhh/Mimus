import { safeNextPath } from '@/src/server/http/safeNextPath';
import { describe, expect, it } from 'vitest';

describe('safeNextPath', () => {
  it.each([
    ['/sky', '/sky'],
    ['/invite/abc-123', '/invite/abc-123'],
    ['/settings/connections?error=x#top', '/settings/connections?error=x#top'],
  ])('keeps the same-site path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ['https://evil.example.com'],
    ['//evil.example.com'],
    ['/\\evil.example.com'],
    ['/\t/evil.example.com'],
    ['javascript:alert(1)'],
    ['sky'],
    [''],
  ])('falls back to / for %j', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });

  it('falls back to / when there is no value', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
  });
});
