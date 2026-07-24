import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWithTimeout', () => {
  it('combines caller cancellation with the timeout signal', async () => {
    const caller = new AbortController();
    let combinedSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
      combinedSignal = init?.signal ?? undefined;
      return new Response('ok');
    }));

    await fetchWithTimeout('https://example.test', { signal: caller.signal }, 10_000);
    expect(combinedSignal?.aborted).toBe(false);

    caller.abort(new Error('client disconnected'));
    expect(combinedSignal?.aborted).toBe(true);
  });

  it('keeps the timeout active while the response body is being consumed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
      const signal = init?.signal;
      return new Response(new ReadableStream({
        start(controller) {
          signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        },
      }));
    }));

    const response = await fetchWithTimeout('https://example.test', {}, 5);
    await expect(response.text()).rejects.toBeTruthy();
  });
});

describe('player-facing upstream coverage', () => {
  it('passes request cancellation through demo, image, TTS and STT routes', () => {
    for (const file of [
      'src/app/api/demo/keeper/route.ts',
      'src/app/api/image/route.ts',
      'src/app/api/tts/route.ts',
      'src/app/api/stt/route.ts',
      'src/app/api/scenarios/[id]/ambient/route.ts',
      'src/app/api/sessions/[id]/complete/route.ts',
    ]) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).toContain('request.signal');
    }
  });
});
