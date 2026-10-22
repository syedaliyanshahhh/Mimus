import { readLegalDoc } from '@/app/(legal)/legal-markdown';
import { CURRENT_TERMS_VERSION } from '@/src/server/legal/termsAcceptance';
import { describe, expect, it } from 'vitest';

// These three files render as-is at /terms, /privacy and /dpa, which Google's
// verification reviewers read, so none of them may ship a placeholder.
const PUBLISHED = ['terms-of-service.md', 'privacy-policy.md', 'dpa.md'];

describe('published legal documents', () => {
  it.each(PUBLISHED)('%s has no TODO placeholders', (file) => {
    expect(readLegalDoc(file)).not.toMatch(/\[TODO/);
  });

  it.each(PUBLISHED)('%s has no draft banner', (file) => {
    expect(readLegalDoc(file)).not.toMatch(/^> \*\*Draft/m);
  });

  it.each(PUBLISHED)('%s is effective from the current Terms version', (file) => {
    expect(readLegalDoc(file)).toContain('**Effective date:** October 22, 2026');
    expect(CURRENT_TERMS_VERSION).toBe('2026-10-22');
  });
});
