import { describeError } from '@/src/server/agent/describeError';
import { describe, expect, it } from 'vitest';

describe('describeError', () => {
  it("keeps only an Error's name and message", () => {
    const err = Object.assign(new TypeError('boom'), {
      request: { body: 'what did Acme say about the renewal?' },
    });
    expect(describeError(err)).toBe('TypeError: boom');
  });

  it('never stringifies a non-Error value, which could be a whole payload', () => {
    expect(describeError({ prompt: 'secret question' })).toBe('Non-Error value thrown (object)');
    expect(describeError('raw text')).toBe('Non-Error value thrown (string)');
  });
});
