export const AI_TURN_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
// The total upstream budget starts as soon as the lease is claimed. Keeping a
// full minute between abort and stale recovery prevents overlapping retries.
export const AI_TURN_UPSTREAM_TIMEOUT_MS = 120_000;
export const AI_TURN_LEASE_SECONDS = 180;
export const AI_TURN_RESULT_MAX_BYTES = 128 * 1024;

export function isValidAiTurnRequestId(value: unknown): value is string {
  return typeof value === 'string' && AI_TURN_REQUEST_ID_PATTERN.test(value);
}

export function aiTurnResultByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function createCompletedTurnResponse(result: unknown): Response {
  return new Response(`event: done\ndata: ${JSON.stringify(result)}\n\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-AI-Turn-Replayed': 'true',
    },
  });
}
