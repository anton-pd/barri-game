import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_TURN_LEASE_SECONDS,
  AI_TURN_RESULT_MAX_BYTES,
  AI_TURN_UPSTREAM_TIMEOUT_MS,
  aiTurnResultByteLength,
  createCompletedTurnResponse,
  isValidAiTurnRequestId,
} from '@/lib/aiTurnIdempotency';

const projectRoot = process.cwd();

describe('AI turn request IDs and replay', () => {
  it('accepts only bounded URL-safe opaque IDs', () => {
    expect(isValidAiTurnRequestId('turn_0123456789abcdef')).toBe(true);
    expect(isValidAiTurnRequestId('a'.repeat(64))).toBe(true);
    expect(isValidAiTurnRequestId('short')).toBe(false);
    expect(isValidAiTurnRequestId('a'.repeat(65))).toBe(false);
    expect(isValidAiTurnRequestId('turn/with/slashes')).toBe(false);
    expect(isValidAiTurnRequestId(null)).toBe(false);
  });

  it('measures replay payloads in UTF-8 bytes against the database limit', () => {
    expect(aiTurnResultByteLength({ response: '🙂' })).toBeGreaterThan(
      JSON.stringify({ response: '🙂' }).length,
    );
    expect(AI_TURN_RESULT_MAX_BYTES).toBe(128 * 1024);
  });

  it('keeps the total provider timeout safely below stale-lease recovery', () => {
    expect(AI_TURN_UPSTREAM_TIMEOUT_MS).toBe(120_000);
    expect(AI_TURN_LEASE_SECONDS).toBe(180);
    expect(AI_TURN_UPSTREAM_TIMEOUT_MS).toBeLessThan(AI_TURN_LEASE_SECONDS * 1000);
  });

  it('replays a completed result using the same SSE done contract', async () => {
    const result = { response: 'Already committed', messageId: 'message-1' };
    const response = createCompletedTurnResponse(result);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('x-ai-turn-replayed')).toBe('true');
    expect(await response.text()).toBe(
      `event: done\ndata: ${JSON.stringify(result)}\n\n`,
    );
  });
});

describe('AI route durable single-flight wiring', () => {
  const routeSource = readFileSync(
    join(projectRoot, 'src/app/api/ai/route.ts'),
    'utf8',
  );
  const querySource = readFileSync(
    join(projectRoot, 'src/lib/queries.ts'),
    'utf8',
  );
  const clientSource = readFileSync(
    join(projectRoot, 'src/components/GameChat.tsx'),
    'utf8',
  );

  it('claims before the paid provider and finalizes only after it returns', () => {
    const claim = routeSource.indexOf('const claim = await claimAiTurn');
    const provider = routeSource.indexOf('const dsResult = await callDeepSeekChatStream');
    const finalize = routeSource.indexOf('const completed = await finalizeAiTurn');

    expect(claim).toBeGreaterThan(0);
    expect(provider).toBeGreaterThan(claim);
    expect(finalize).toBeGreaterThan(provider);
    expect(routeSource).not.toContain('await saveMessage(');
  });

  it('bounds the turn body and revalidates access after winning the lease', () => {
    const claim = routeSource.indexOf('const claim = await claimAiTurn');
    const claimedAccess = routeSource.indexOf('const claimedAccess = evaluateSessionAccess');
    const provider = routeSource.indexOf('const dsResult = await callDeepSeekChatStream');

    expect(routeSource).toContain('readJsonWithLimit(request, AI_TURN_BODY_MAX_BYTES)');
    expect(routeSource).toContain('message.length > AI_TURN_MESSAGE_MAX_CHARS');
    expect(routeSource).toContain('allActions.length > AI_TURN_ACTIONS_MAX');
    expect(routeSource).toContain("releaseAiTurn(sessionId, requestId, leaseToken, 'access_changed')");
    expect(claimedAccess).toBeGreaterThan(claim);
    expect(provider).toBeGreaterThan(claimedAccess);
  });

  it('aborts upstream work before releasing ownership', () => {
    expect(routeSource).toContain("'client_aborted'");
    expect(routeSource).toContain("'provider_timeout'");
    expect(routeSource).toContain("'ai_turn_failed'");
    expect(routeSource).toContain("'pre_stream_failed'");
    expect(routeSource).toContain('const turnSignal = AbortSignal.any([');
    expect(routeSource).toContain('providerAbortController.signal');
    expect(routeSource).toContain('providerAbortController.abort(error)');
    expect(routeSource).toContain('await reader.cancel()');
    expect(routeSource).toContain('turnSignal,');
    expect(routeSource).not.toContain("request.signal.addEventListener('abort'");
    expect(routeSource.indexOf('await releaseAiTurn(sessionId, requestId, leaseToken, errorCode)'))
      .toBeGreaterThan(routeSource.indexOf('const dsResult = await callDeepSeekChatStream'));
    expect(routeSource.indexOf('prefetchGemini(cleanText, voiceStyle, segments)'))
      .toBeGreaterThan(routeSource.indexOf('const completed = await finalizeAiTurn'));
  });

  it('migrates a bounded replay table with a session-wide processing invariant', () => {
    expect(querySource).toContain('CREATE TABLE IF NOT EXISTS ai_turn_requests');
    expect(querySource).toContain('PRIMARY KEY (session_id, request_id)');
    expect(querySource).toContain('idx_ai_turn_one_processing_per_session');
    expect(querySource).toContain("WHERE status = 'processing'");
    expect(querySource).toContain('octet_length(response_json::text) <= 131072');
  });

  it('commits messages, session state, and completed replay in one transaction', () => {
    const finalizeStart = querySource.indexOf('export async function finalizeAiTurn');
    const finalizeSource = querySource.slice(finalizeStart);

    expect(finalizeSource).toContain('return sql.begin(async (tx)');
    expect(finalizeSource).toContain('INSERT INTO messages');
    expect(finalizeSource).toContain('UPDATE game_sessions');
    expect(finalizeSource).toContain("SET status = 'completed'");
    expect(finalizeSource).toContain('lease_token = ${input.leaseToken}');
  });

  it('derives cross-tab-stable opaque IDs and sends them for intro and player turns', () => {
    expect(clientSource).toContain("crypto.subtle.digest(");
    expect(clientSource).toContain('predecessorId');
    expect(clientSource.match(/\brequestId,\n/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
