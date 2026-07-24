import { describe, expect, it } from 'vitest';
import {
  isValidSessionId,
  PayloadTooLargeError,
  readJsonWithLimit,
} from '@/lib/requestLimits';

describe('paid media request limits', () => {
  it('rejects an oversized declared body before parsing it', async () => {
    const request = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '101',
      },
      body: JSON.stringify({ text: 'short' }),
    });

    await expect(readJsonWithLimit(request, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('rejects an oversized body when content-length is absent', async () => {
    const request = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(200) }),
    });

    await expect(readJsonWithLimit(request, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('parses a valid body under the limit', async () => {
    const request = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hello', sessionId: 'session-1' }),
    });

    await expect(readJsonWithLimit(request, 1_000)).resolves.toEqual({
      text: 'hello',
      sessionId: 'session-1',
    });
  });

  it('requires a bounded non-empty session id', () => {
    expect(isValidSessionId('session-1')).toBe(true);
    expect(isValidSessionId('')).toBe(false);
    expect(isValidSessionId('x'.repeat(129))).toBe(false);
  });
});
