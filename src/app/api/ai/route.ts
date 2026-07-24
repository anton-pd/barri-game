// CHANGED: Three-part prompt caching (ruleset/static/dynamic), SSE streaming,
// cost tracking, inventory mutation tags, keeper activity, random event injection.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  claimAiTurn,
  countMessages,
  ensureSchema,
  finalizeAiTurn,
  getAllAppSettings,
  getLastNMessages,
  getSession,
  getUserById,
  getUserDailyCost,
  releaseAiTurn,
  saveMessageDebug,
  updateSession,
} from '@/lib/queries';
import {
  AI_TURN_UPSTREAM_TIMEOUT_MS,
  createCompletedTurnResponse,
  isValidAiTurnRequestId,
} from '@/lib/aiTurnIdempotency';
import { evaluateAccessGate } from '@/lib/accessGate';
import { buildSystemPromptBlocks, buildSummarizePrompt, getIntroUserContent } from '@/lib/prompts';
import { parseSegments, stripNpcTags } from '@/lib/segments';
import { parseInventoryTags } from '@/lib/inventoryTags';
import { applyCasePlanTags } from '@/lib/casePlanTags';
import { applyEventDoneTags } from '@/lib/eventTags';
import { detectCompletionAction } from '@/lib/completionTags';
import { prefetchGemini } from '@/lib/ttsPrefetch';
import { verifyJwt } from '@/lib/auth';
import { trackAPICall } from '@/lib/costTracker';
import { evaluateRandomEvent, applyEventDecision, resolveActiveEvent, clearActiveEvent, buildEventInstruction } from '@/lib/randomEvents';
import { getCampaignContext } from '@/lib/campaigns';
import { readScenarioFile, resolveAmbientFileForLocation, resolveLocationGroupIdForLocation } from '@/lib/scenarioFiles';
import { applyDeltaToPlayer } from '@/lib/statUtils';
import { supportsPendingRollTag } from '@/lib/rulesets';
import { resolveRollSkillValue } from '@/lib/skillAliases';
import { mergeSummarizedWorldState } from '@/lib/worldStateMerge';
import { buildDeepSeekChatBody, extractDeepSeekContentDelta, type DeepSeekStreamChunk } from '@/lib/deepseekStream';
import { resolveAiProvider, type AiProvider } from '@/lib/aiProvider';
import { evaluateSessionAccess } from '@/lib/sessionAccess';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import {
  localizePlayersForScenario,
  localizeScenarioForPlayer,
} from '@/lib/scenarioPlayerLocalization';
import {
  InvalidJsonError,
  PayloadTooLargeError,
  readJsonWithLimit,
} from '@/lib/requestLimits';
import type { Player, WorldState } from '@/types';

const GEMINI_SUMMARY_TIMEOUT_MS = 30_000;
const AI_TURN_BODY_MAX_BYTES = 64 * 1024;
const AI_TURN_MESSAGE_MAX_CHARS = 20_000;
const AI_TURN_ACTION_MAX_CHARS = 5_000;
const AI_TURN_ACTIONS_MAX = 8;

// ANT-142: the game engine is DeepSeek V4 Flash, in two tiers:
//   'deepseek-base' — direct api.deepseek.com. Free/trial tier: cheapest, but cold
//                     TTFT ~6s (warm cache ~2-3s).
//   'deepseek-pro'  — via OpenRouter pinned to Cloudflare. Future paid tier:
//                     TTFT ~0.6s, ~99% prompt-cache hits, identical prose quality.
// Sonnet and Gemini are no longer engine options (legacy stored values fall back
// to 'deepseek-base'); Gemini still powers images, TTS and the summarize call.
interface EngineArm {
  url: string;
  apiKeyEnv: string;
  model: string;
  /** OpenRouter provider pin — preferred host, with fallbacks allowed. */
  orProvider?: string;
  trackProvider: 'deepseek' | 'openrouter';
  /**
   * Cache-read price as a fraction of the input (miss) rate. Cost tracking
   * converts cached tokens into equivalent miss tokens with this factor so
   * admin stats stay honest: direct bills hits at $0.014 vs $0.14 per 1M
   * (×0.1); Cloudflare via OpenRouter at ~$0.038 vs $0.10 per 1M (×0.4).
   */
  cacheReadFactor: number;
}

const ENGINE_ARMS: Record<AiProvider, EngineArm> = {
  'deepseek-base': {
    url: 'https://api.deepseek.com/chat/completions',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    model: 'deepseek-v4-flash',
    trackProvider: 'deepseek',
    cacheReadFactor: 0.1,
  },
  'deepseek-pro': {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    model: 'deepseek/deepseek-v4-flash',
    orProvider: 'Cloudflare',
    trackProvider: 'openrouter',
    cacheReadFactor: 0.4,
  },
};

function detectVoiceStyle(): string {
  // Keeper narrator always uses the same voice. NPC voices are handled
  // per-segment in multi-speaker Gemini TTS, not via the message-level voiceStyle.
  return 'keeper';
}

function isExplicitImageRequest(message: string): boolean {
  // ANT-123: show-intent verbs only. Bare nouns (letter/map/photo/draw) fired
  // on ordinary narration ("I read the letter") and forced an image-generation
  // instruction + cost on every such message.
  // NOTE: no \b around Cyrillic — JS word boundaries are ASCII-only, so
  // /\bпокажи\b/ can never match (the pre-ANT-123 patterns had this bug).
  return [
    /покаж/i,
    /показати/i,
    /дай побачити/i,
    /хочу побачити/i,
    /як (це|вона|він|воно) виглядає/i,
    /намалюй/i,
    /\bshow (me|us)\b/i,
    /\bwhat does .{0,50} look like\b/i,
    /\bcan (i|we) see\b/i,
    /\blet (me|us) see\b/i,
    /\bi want to see\b/i,
    /\bdraw (me|us|a|an|the|it)\b/i,
  ].some((pattern) => pattern.test(message));
}

// ── Summarize (always uses fast/cheap model) ──────────────────────────────────
// Stays on Gemini Flash: it's an auxiliary background call (every 20 messages),
// not the game engine — Gemini remains in the stack for images/TTS anyway.

async function summarizeAndUpdateWorldState(
  sessionId: string,
  lang: 'uk' | 'en'
): Promise<void> {
  try {
    const { getAllMessages } = await import('@/lib/queries');
    const allMessages = await getAllMessages(sessionId);
    const summarizePrompt = buildSummarizePrompt(allMessages, lang);

    const text = await callGeminiText('gemini-2.5-flash', summarizePrompt);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<WorldState>;
      // The LLM call above takes seconds and this runs fire-and-forget — the
      // player may have taken another turn meanwhile. Merge onto the freshest
      // state, not the snapshot from when the summary was requested (ANT-117).
      const freshSession = await getSession(sessionId);
      if (!freshSession || freshSession.status === 'completed') return;
      // Take narrative fields from the summary but keep authoritative
      // navigation/engine state (ANT-68 — see worldStateMerge.ts).
      const merged = mergeSummarizedWorldState(freshSession.world_state, parsed);
      await updateSession(sessionId, { world_state: merged });
    }
  } catch (error) {
    console.error('Error summarizing world state:', error);
  }
}

// ── DeepSeek (OpenAI-compatible, streaming) ───────────────────────────────────
// The game engine (ANT-142). Prompt shape mirrors the Gemini split-tail mode
// (ANT-126): stable system prefix (ruleset+static), dynamic state as a tail
// turn right before the player message — implicit prefix caching (both direct
// and OpenRouter/Cloudflare) bills the stable prefix at the cache-hit rate.

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callDeepSeekChatStream(
  arm: EngineArm,
  messages: DeepSeekMessage[],
  maxTokens: number,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  finishReason: string | null;
}> {
  const apiKey = process.env[arm.apiKeyEnv];
  if (!apiKey) throw new Error(`${arm.apiKeyEnv} not set`);

  const body = buildDeepSeekChatBody({
    model: arm.model,
    messages,
    maxTokens,
    // ANT-146: 0.7 beat 1.0 in the temperature A/B — better tag/roll
    // discipline, judge prose scores unchanged (0.85 wrote nicer but fired a
    // false IMAGE and lost roll tags).
    temperature: 0.7,
    orProvider: arm.orProvider,
  });

  const res = await fetchWithTimeout(arm.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  }, AI_TURN_UPSTREAM_TIMEOUT_MS);
  if (!res.ok || !res.body) {
    const err = await res.text();
    console.error('DeepSeek error:', res.status, err.slice(0, 300));
    throw new Error(`DeepSeek API error: ${res.status}`);
  }

  let text = '';
  let finishReason: string | null = null;
  let usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  } = {};
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let streamComplete = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        streamComplete = true;
        break;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
        let chunk: DeepSeekStreamChunk;
        try {
          chunk = JSON.parse(line.slice(6)) as DeepSeekStreamChunk;
        } catch {
          continue;
        }
        const delta = extractDeepSeekContentDelta(chunk);
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
        if (chunk.usage) usage = chunk.usage;
      }
    }
  } finally {
    if (!streamComplete) {
      await reader.cancel().catch(() => undefined);
    }
  }
  if (!text.trim()) {
    const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens;
    console.error(
      `[AI_EMPTY_OUTPUT] provider=${arm.trackProvider} model=${arm.model} finish=${finishReason ?? 'unknown'} ` +
      `completion_tokens=${usage.completion_tokens ?? 0} reasoning_tokens=${reasoningTokens ?? 0}`
    );
    throw new Error('DeepSeek returned no final content');
  }
  return {
    text,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    // Direct API reports prompt_cache_hit_tokens; OpenRouter uses the OpenAI
    // shape prompt_tokens_details.cached_tokens.
    cacheHitTokens: usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0,
    // OpenAI-style 'length' → our truncation marker so the ANT-129 recovery applies.
    finishReason: finishReason === 'length' ? 'max_tokens' : finishReason,
  };
}

// ── Gemini REST helper (summarize only — the engine is DeepSeek, ANT-142) ─────

async function callGeminiText(modelId: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500 },
      }),
    },
    GEMINI_SUMMARY_TIMEOUT_MS,
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[]
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Keeper activity helpers ───────────────────────────────────────────────────

function isPassiveMessage(message: string): boolean {
  const activePatterns = [
    /оглядаю|шукаю|іду|беру|кажу|питаю|відкриваю|перевіряю|досліджую/i,
    /використовую|дістаю|показую|читаю|слухаю|торкаюсь|намагаюсь/i,
    // EN sessions (ANT-116): without these, any short English action counted as passive
    /\b(look|search|examine|investigate|check|open|take|grab|pick|use|read|listen|ask|say|tell|talk|go|walk|run|climb|try|show|pull|touch|attack|follow|inspect)\b/i,
  ];
  const passivePatterns = [
    /^(так|ні|добре|окей|гаразд|зрозуміло|продовжуй|далі)$/i,
    /^(yes|no|ok|okay|sure|fine|alright|got it|go on|continue|next)$/i,
  ];
  const isActive = activePatterns.some((p) => p.test(message));
  const isPassive = !isActive && (passivePatterns.some((p) => p.test(message)) || message.length < 20);
  return isPassive;
}

function buildKeeperActivitySection(
  keeperStyle: 'passive' | 'balanced' | 'active',
  worldState: WorldState,
  lang: 'uk' | 'en',
  players: Player[]
): string {
  const passive = worldState.passiveMessageCount ?? 0;
  const hasPendingRoll = !!worldState.pendingRollResult;

  if (hasPendingRoll) {
    const pending = worldState.pendingRollResult!;
    // ANT-183: refer to the player by name — a bare index reads as jargon and
    // the model occasionally echoed "Гравець 0" into the narration.
    const pendingName = players[pending.characterIdx]?.name ?? `#${pending.characterIdx}`;
    if (lang === 'en') {
      return `\n\n## AWAITING ROLL
Player ${pendingName} has not reported the result of the "${pending.skillName}" roll yet.
If the message contains a number — that is the roll result.
Compare with threshold ${pending.goodThreshold}: ≤ threshold → success, > threshold → failure.
After the result — clear it with [CLEAR_PENDING_ROLL].`;
    }
    return `\n\n## ОЧІКУВАНИЙ КИДОК
Гравець ${pendingName} ще не повідомив результат кидка "${pending.skillName}".
Якщо повідомлення містить число — це результат кидка.
Порів з порогом ${pending.goodThreshold}: ≤ поріг → успіх, > поріг → провал.
Після результату — очисти через [CLEAR_PENDING_ROLL].`;
  }

  if (keeperStyle === 'active' || (keeperStyle === 'balanced' && passive >= 3)) {
    if (lang === 'en') {
      return `\n\n## ACTION NUDGE (passive turns: ${passive})
The players have gone quiet. Weave in a new detail that provokes a reaction:
- A new sensory detail, NPC behavior, a reminder of the threat
Do NOT enumerate options as a list — describe a situation that demands a response by itself.`;
    }
    return `\n\n## ПІДКАЗКА ДІЙ (пасивних ходів: ${passive})
Гравці затихли. Вплітай нову деталь що провокує реакцію:
- Нова сенсорна деталь, поведінка NPC, нагадування про загрозу
НЕ перелічуй варіанти списком — опиши ситуацію що сама вимагає відповіді.`;
  }

  if (keeperStyle === 'passive') {
    if (lang === 'en') {
      return `\n\n## CASE CURATOR STYLE: PASSIVE\nWait for the players' actions. Describe only the current moment.`;
    }
    return `\n\n## СТИЛЬ КУРАТОРА СПРАВИ: ПАСИВНИЙ\nЧекай дій гравців. Описуй лише поточний момент.`;
  }

  return '';
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── Auth & early validation (before stream) ───────────────────────────────
  await ensureSchema();
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Access gate (ANT-108): waiting-list approval + per-user daily cost cap ──
  const [currentUser, settings, spentTodayUsd] = await Promise.all([
    getUserById(payload.sub),
    getAllAppSettings(),
    getUserDailyCost(payload.sub),
  ]);
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const gate = evaluateAccessGate({
    role: currentUser.role,
    accessStatus: currentUser.access_status ?? 'pending',
    enforceDailyCap: true,
    dailyLimitEnabled: settings.daily_limit_enabled === 'true',
    dailyLimitUsd: parseFloat(settings.daily_user_cost_limit_usd ?? '0'),
    spentTodayUsd,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.code, message: gate.message }, { status: gate.status });
  }

  let body: unknown;
  try {
    body = await readJsonWithLimit(request, AI_TURN_BODY_MAX_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    if (error instanceof InvalidJsonError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    throw error;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const {
    sessionId,
    message,
    playerIdx,
    allActions,
    autoVoiceEnabled = false,
    keeperStyle: keeperStyleFromBody,
    requestId,
  } = body as {
    sessionId: string;
    message: string;
    playerIdx: number;
    allActions?: { playerIdx: number; text: string }[];
    autoVoiceEnabled?: boolean;
    keeperStyle?: 'passive' | 'balanced' | 'active';
    requestId?: string;
  };
  // The engine tier is a server-owned cost/entitlement decision. Legacy clients
  // may still send `aiProvider`, but the request value is intentionally ignored.
  const aiProvider = resolveAiProvider(settings.ai_provider);

  if (
    typeof sessionId !== 'string' ||
    sessionId.length === 0 ||
    sessionId.length > 128 ||
    typeof message !== 'string' ||
    message.length === 0 ||
    message.length > AI_TURN_MESSAGE_MAX_CHARS ||
    !Number.isInteger(playerIdx) ||
    playerIdx < 0 ||
    playerIdx > 7 ||
    (allActions !== undefined && (
      !Array.isArray(allActions) ||
      allActions.length > AI_TURN_ACTIONS_MAX ||
      allActions.some((action) => (
        !action ||
        typeof action !== 'object' ||
        !Number.isInteger(action.playerIdx) ||
        action.playerIdx < 0 ||
        action.playerIdx > 7 ||
        typeof action.text !== 'string' ||
        action.text.length === 0 ||
        action.text.length > AI_TURN_ACTION_MAX_CHARS
      ))
    )) ||
    (autoVoiceEnabled !== undefined && typeof autoVoiceEnabled !== 'boolean') ||
    (keeperStyleFromBody !== undefined && !['passive', 'balanced', 'active'].includes(keeperStyleFromBody))
  ) {
    return NextResponse.json({ error: 'Invalid AI turn payload' }, { status: 400 });
  }
  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 });
  }
  if (!isValidAiTurnRequestId(requestId)) {
    return NextResponse.json(
      { error: 'invalid_request_id', message: 'requestId must be 16-64 URL-safe characters' },
      { status: 400 },
    );
  }

  let session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const sessionAccess = evaluateSessionAccess({ authenticatedUserId: payload.sub, currentUser, session });
  if (!sessionAccess.ok) return NextResponse.json({ error: sessionAccess.code === 'unauthorized' ? 'Unauthorized' : 'Forbidden' }, { status: sessionAccess.status });

  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session is read-only' }, { status: 409 });
  }

  const claim = await claimAiTurn(sessionId, requestId, payload.sub);
  if (claim.kind === 'completed') {
    return createCompletedTurnResponse(claim.result);
  }
  if (claim.kind === 'in_flight' || claim.kind === 'session_busy') {
    const status = claim.kind === 'in_flight' ? 425 : 409;
    return NextResponse.json(
      {
        error: claim.kind,
        message: claim.kind === 'in_flight'
          ? 'This AI turn is already in progress'
          : 'Another AI turn is already in progress for this session',
        retryAfterSeconds: claim.retryAfterSeconds,
      },
      {
        status,
        headers: { 'Retry-After': String(claim.retryAfterSeconds) },
      },
    );
  }
  if (claim.kind === 'conflict') {
    return NextResponse.json({ error: 'request_id_conflict' }, { status: 409 });
  }
  if (claim.kind === 'session_missing') {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const leaseToken = claim.leaseToken;
  const providerAbortController = new AbortController();
  // The provider timeout starts with the lease, not with fetch(), so prompt
  // preparation cannot consume the safety margin and then start a full call.
  const turnSignal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(AI_TURN_UPSTREAM_TIMEOUT_MS),
    providerAbortController.signal,
  ]);

  try {
  // Re-read only after winning the database claim. This makes the prompt and
  // state transition derive from the latest committed turn, never a stale
  // snapshot observed while another replica was still processing.
  const [claimedSession, claimedUser] = await Promise.all([
    getSession(sessionId),
    getUserById(payload.sub),
  ]);
  if (!claimedSession) {
    await releaseAiTurn(sessionId, requestId, leaseToken, 'session_missing');
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  const claimedAccess = evaluateSessionAccess({
    authenticatedUserId: payload.sub,
    currentUser: claimedUser,
    session: claimedSession,
  });
  if (!claimedAccess.ok) {
    await releaseAiTurn(sessionId, requestId, leaseToken, 'access_changed');
    return NextResponse.json(
      { error: claimedAccess.code === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: claimedAccess.status },
    );
  }
  if (claimedSession.status !== 'active') {
    await releaseAiTurn(sessionId, requestId, leaseToken, 'session_completed');
    return NextResponse.json({ error: 'Session is read-only' }, { status: 409 });
  }
  session = claimedSession;
  const turnPlayers = claimedSession.players;

  // ── Prompt preparation (before stream — fast, no AI call) ─────────────────

  const scenario = readScenarioFile(session.scenario_id);
  const recentMessages = await getLastNMessages(sessionId, 30);
  const isIntro = message === '__intro__';
  const sessionLang: 'uk' | 'en' = (session.language ?? 'uk') as 'uk' | 'en';
  const playerFacingScenario = localizeScenarioForPlayer(scenario, sessionLang);

  const userContent = isIntro
    ? getIntroUserContent(sessionLang)
    : (() => {
        // Multi-action batches arrive already formatted as "[Name]: action\n[Name]: action" —
        // wrapping again would produce "[Name]: [Name]: …" and mis-attribute the batch.
        if (allActions && allActions.length > 1) return message;
        const player = turnPlayers[playerIdx];
        return player ? `[${player.name}]: ${message}` : message;
      })();

  let worldState: WorldState = session.world_state;
  // A dice result while a roll is pending is engagement, not passivity
  // (ANT-119). Without this, a few rolls in a row falsely trigger the
  // "players are silent" nudge. The client sends either a bare number
  // (legacy) or the structured "🎲 Skill: N проти M — verdict" line (ANT-134).
  const isDiceResult =
    !isIntro && !!session.world_state.pendingRollResult &&
    (/^\d+$/.test(message.trim()) || message.trim().startsWith('🎲'));
  const passive = isIntro || isDiceResult ? false : isPassiveMessage(message);
  worldState = {
    ...worldState,
    passiveMessageCount: passive ? (worldState.passiveMessageCount ?? 0) + 1 : 0,
    totalMessageCount: (worldState.totalMessageCount ?? 0) + 1,
    locationRisk: worldState.locationRisk ?? {},
  };

  // Use currentLocation from worldState directly — LOCATION tags are stripped before DB save
  const currentLocation = worldState.currentLocation;
  const eventDecision = evaluateRandomEvent(worldState, scenario, currentLocation, !!worldState.pendingRollResult);
  worldState = applyEventDecision(worldState, eventDecision, currentLocation, scenario);

  const keeperStyle = keeperStyleFromBody ?? (session.keeper_style as 'passive' | 'balanced' | 'active') ?? 'balanced';
  const activitySection = buildKeeperActivitySection(keeperStyle, worldState, sessionLang, turnPlayers);
  const imageRequestInstruction = !isIntro && isExplicitImageRequest(message)
    ? (sessionLang === 'en'
        ? 'The player explicitly asks to SEE something. In this response you MUST add exactly one [IMAGE:type:short English description] tag for the most relevant object or scene they ask to see. Pick the type meaningfully: map / letter / photo / artifact / scene / newspaper. The description in the tag must be short, specific, and in English.'
        : 'Гравець прямо просить щось ПОКАЗАТИ. У цій відповіді ОБОВʼЯЗКОВО додай рівно один тег [IMAGE:type:short English description] для найрелевантнішого обʼєкта або сцени, яку він просить побачити. Обирай type змістовно: map / letter / photo / artifact / scene / newspaper. Опис у тегі має бути коротким, конкретним і англійською.')
    : '';
  const eventInstruction =
    eventDecision.shouldFire && eventDecision.eventType
      ? buildEventInstruction(eventDecision.eventType, eventDecision.isTransitionEvent, scenario, sessionLang)
      : '';
  const campaignContext = session.campaign_id
    ? await getCampaignContext(session.campaign_id, sessionLang)
    : undefined;
  const blocks = buildSystemPromptBlocks(scenario, worldState, turnPlayers, {
    campaignContext,
    keeperActivitySection: activitySection,
    eventInstruction,
    imageRequestInstruction,
    language: sessionLang,
  });

  // DeepSeek history (ANT-142): split-tail shape (ANT-126) — stable system
  // prefix, dynamic state as a tail turn right before the player message.
  const deepseekMessages: DeepSeekMessage[] = [
    { role: 'system', content: `${blocks.ruleset}\n\n${blocks.static}` },
    ...recentMessages.map((m): DeepSeekMessage => {
      if (m.role === 'user' && m.player_idx !== null && turnPlayers[m.player_idx]) {
        return { role: 'user', content: `[${turnPlayers[m.player_idx].name}]: ${m.content}` };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    }),
    {
      role: 'user',
      content: `${sessionLang === 'en' ? '[SESSION STATE]' : '[СТАН СЕСІЇ]'}\n${blocks.dynamic}`,
    },
    { role: 'assistant', content: sessionLang === 'en' ? 'Understood.' : 'Зрозумів.' },
    { role: 'user', content: userContent },
  ];

  // ── SSE stream ────────────────────────────────────────────────────────────

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        const arm = ENGINE_ARMS[aiProvider];
        const dsResult = await callDeepSeekChatStream(
          arm,
          deepseekMessages,
          // ANT-129: 900 was tight for narration-heavy turns and produced
          // mid-word cuts; 1200 gives headroom. Intro gets more (ANT-60).
          isIntro ? 1400 : 1200,
          (delta) => send('chunk', { text: delta }),
          turnSignal,
        );
        const assistantText = dsResult.text;
        const inputTokens   = dsResult.inputTokens;
        const outputTokens  = dsResult.outputTokens;
        const finishReason  = dsResult.finishReason;

        trackAPICall({
          sessionId,
          userId: payload.sub,
          provider: arm.trackProvider,
          type: 'llm',
          model: arm.model,
          // Cached tokens are billed at a discounted rate — fold them into
          // equivalent miss tokens (see EngineArm.cacheReadFactor).
          inputTokens: Math.round(
            Math.max(0, inputTokens - dsResult.cacheHitTokens) +
            dsResult.cacheHitTokens * arm.cacheReadFactor
          ),
          outputTokens,
        }).catch(console.error);

        // ── Parse tags ──────────────────────────────────────────────────────

        // ANT-118: apply ALL tags, not just the first — the keeper may emit
        // several DELTA tags (one per player) or pass through several locations
        // in one reply. Tags were already stripped globally, so single .match()
        // silently discarded the rest and state diverged from the narration.
        const deltaMatches = [...assistantText.matchAll(/\[DELTA:(\{[\s\S]*?\})\]/g)];
        const imageMatch   = assistantText.match(/\[IMAGE:(\w+):([^\]]+)\]/);
        // Location moves in document order: every move counts as visited, every
        // NEW_LOCATION registers a dynamic location, the LAST move is current.
        const locationMoves: { id: string; name?: string; description?: string; at: number }[] = [
          ...[...assistantText.matchAll(/\[LOCATION:([\w-]+)\]/g)].map((m) => ({
            id: m[1],
            at: m.index ?? 0,
          })),
          ...[...assistantText.matchAll(/\[NEW_LOCATION:([\w-]+):([^:]+):([^\]]+)\]/g)].map((m) => ({
            id: m[1],
            name: m[2],
            description: m[3],
            at: m.index ?? 0,
          })),
        ].sort((a, b) => a.at - b.at);
        const finalMove = locationMoves.length > 0 ? locationMoves[locationMoves.length - 1] : null;
        const completionAction = detectCompletionAction(assistantText);

        const { cleanText: textAfterInventory, mutatedPlayers } = parseInventoryTags(
          assistantText,
          turnPlayers
        );

        let updatedWorldState = { ...worldState };
        let textAfterRollTags = textAfterInventory;

        // The [SET_PENDING_ROLL] → DiceRoller pipeline is d100 roll-under only.
        // For non-percentile rulesets the tag is stripped but ignored — the
        // d100 roller would render inverted verdicts there (ANT-120).
        const allowPendingRoll = supportsPendingRollTag(scenario.rulesetId);

        textAfterRollTags = textAfterRollTags.replace(
          /\[SET_PENDING_ROLL:(\d+):([^:]+):(\d+):(\d+)(?::([^\]]*))?\]/g,
          (_, idx, skillName, skillValue, threshold, context) => {
            if (!allowPendingRoll) return '';
            // ANT-119: validate tag values against real player data instead of
            // trusting the LLM blindly (the fallback path below already did).
            // ANT-183: resolution goes through the skill alias map (uk ↔ en
            // sheet names) and falls through to Luck/SAN stats — an exact-name
            // lookup silently skipped validation whenever the tag language
            // differed from the sheet language.
            const rawIdx = Number(idx);
            const characterIdx = turnPlayers[rawIdx] ? rawIdx : playerIdx;
            const trimmedSkill = String(skillName).trim();
            const tagValue = Number(skillValue);
            let goodThreshold = Number(threshold);
            let resolvedValue = tagValue;
            const rollTarget = turnPlayers[characterIdx]
              ? resolveRollSkillValue(turnPlayers[characterIdx], scenario.rulesetId, trimmedSkill)
              : null;
            if (rollTarget) {
              resolvedValue = rollTarget.value;
              // The prompt instructs threshold = skill value for a Regular
              // success; if the LLM followed that but used a wrong number,
              // correct both. An intentionally different threshold is kept.
              if (goodThreshold === tagValue) goodThreshold = resolvedValue;
              // Ruleset rule: never set a skill-roll threshold below 10.
              goodThreshold = Math.max(10, goodThreshold);
            }
            updatedWorldState.pendingRollResult = {
              characterIdx,
              skillName: trimmedSkill,
              skillValue: resolvedValue,
              goodThreshold,
              context: context ?? '',
            };
            return '';
          }
        );

        textAfterRollTags = textAfterRollTags.replace(/\[CLEAR_PENDING_ROLL\]/g, () => {
          updatedWorldState = { ...updatedWorldState, pendingRollResult: undefined };
          return '';
        });

        textAfterRollTags = textAfterRollTags.replace(
          /\[RANDOM_EVENT:([^:]+):([^\]]+)\]/g,
          (_, _type, description) => {
            updatedWorldState = resolveActiveEvent(updatedWorldState, description);
            return '';
          }
        );

        // Force-clear pendingRollResult if the player sent a dice result (plain number).
        // LLM often forgets [CLEAR_PENDING_ROLL]; without this the roll persists in DB
        // and the DiceRoller reopens on every page load.
        if (isDiceResult && updatedWorldState.pendingRollResult === worldState.pendingRollResult) {
          updatedWorldState = { ...updatedWorldState, pendingRollResult: undefined };
        }

        // ── Auto-inject [SET_PENDING_ROLL] if AI wrote "Кинь X" / "Roll X" but forgot the tag ──
        // Gemini Flash often ignores the tag instruction despite explicit prompting.
        // Detect the roll request pattern and synthesize the tag from text.
        if (allowPendingRoll && !updatedWorldState.pendingRollResult) {
          // ANT-119: tolerant shapes — bold markdown around the verb/skill,
          // any parenthetical that mentions 1к100/1d100 and a number
          // ("(1к100, треба 65)", "(1d100, under 45)", "(roll 1d100, need 30 or less)").
          const rollTextMatch =
            textAfterRollTags.match(/(?:Кинь|Кидай)\s+\**([\wА-ЯҐЄІЇа-яґєії'’\s\/]+?)\**\s*\([^)]*?(?:1к100|1d100)[^)]*?(\d{1,3})[^)]*\)/i) ??
            textAfterRollTags.match(/Roll\s+(?:a\s+|an\s+)?\**([\w\s\/]+?)\**\s*(?:check\s*)?\([^)]*?(?:1d100|1к100)[^)]*?(\d{1,3})[^)]*\)/i);
          if (rollTextMatch) {
            const skillNameRaw = rollTextMatch[1].trim();
            const threshold = Number(rollTextMatch[2]);
            // Match skill to player's actual value (alias-aware, ANT-183);
            // fallback to the threshold the model wrote in the text.
            const player = turnPlayers[playerIdx] ?? turnPlayers[0];
            const skillValue = player
              ? (resolveRollSkillValue(player, scenario.rulesetId, skillNameRaw)?.value ?? threshold)
              : threshold;
            updatedWorldState = {
              ...updatedWorldState,
              pendingRollResult: {
                characterIdx: playerIdx,
                skillName: skillNameRaw,
                skillValue,
                goodThreshold: threshold,
                context: '',
              },
            };
          }
        }

        // ── Random-event cleanup (ANT-124: AFTER force-clear + roll synthesis) ──
        // One-shot events (non-roll) end with this response. A roll_event lives
        // until its roll is resolved: it must survive a synthesized pending roll
        // (fallback above) and die in the same turn the dice force-clear fires.
        if (updatedWorldState.activeRandomEvent && updatedWorldState.activeRandomEvent.type !== 'roll_event') {
          updatedWorldState = clearActiveEvent(updatedWorldState);
        }
        if (!updatedWorldState.pendingRollResult && updatedWorldState.activeRandomEvent?.type === 'roll_event') {
          updatedWorldState = clearActiveEvent(updatedWorldState);
        }

        // ── Parse [NPC_UPDATE:Name:relation:notes] tags (ANT-70) ────────────
        // Same name-matching logic as auto-register below.
        textAfterRollTags = textAfterRollTags.replace(
          /\[NPC_UPDATE:([^:]+):([^:]*):([^\]]*)\]/g,
          (_, rawName: string, rawRelation: string, rawNotes: string) => {
            const tagName = rawName.trim().toLowerCase();
            const relation = rawRelation.trim() as 'friendly' | 'neutral' | 'hostile' | 'unknown' | '';
            const notes = rawNotes.trim();

            // Resolve name → id (scenario first, then dynamic)
            const npc = scenario.npcs?.find((n) => {
              const full = n.name.toLowerCase();
              return full === tagName || full.includes(tagName) || tagName.includes(full);
            });
            const npcId = npc
              ? npc.id
              : `dynamic_${tagName.replace(/\s+/g, '_')}`;

            if (relation && ['friendly', 'neutral', 'hostile', 'unknown'].includes(relation)) {
              updatedWorldState = {
                ...updatedWorldState,
                npcRelations: { ...updatedWorldState.npcRelations, [npcId]: relation },
              };
            }
            if (notes) {
              const existing = updatedWorldState.npcDetails?.[npcId]?.notes ?? '';
              const merged = existing ? `${existing}. ${notes}` : notes;
              updatedWorldState = {
                ...updatedWorldState,
                npcDetails: { ...(updatedWorldState.npcDetails ?? {}), [npcId]: { notes: merged } },
              };
            }
            return '';
          }
        );

        const planResult = applyCasePlanTags(textAfterRollTags, updatedWorldState);
        textAfterRollTags = planResult.cleanText;
        updatedWorldState = planResult.worldState;

        // ── Parse [EVENT_DONE:n] tags (ANT-148) ─────────────────────────────
        const eventResult = applyEventDoneTags(
          textAfterRollTags,
          updatedWorldState,
          scenario.mustHappenEvents?.length ?? 0
        );
        textAfterRollTags = eventResult.cleanText;
        updatedWorldState = eventResult.worldState;

        // ── Guard: strip [NPC:<PlayerName>]...[/NPC] (ANT-71) ───────────────
        // LLM occasionally voices a player character as if an NPC. Such tags
        // render as an NPC bubble and, worse, auto-register the player into
        // npcRelations. Unwrap the tag keeping the inner text so narration
        // is preserved but no NPC artifact leaks downstream.
        const playerNamesLower = turnPlayers
          .map((p) => p.name?.trim().toLowerCase())
          .filter((n): n is string => Boolean(n));
        if (playerNamesLower.length > 0) {
          textAfterRollTags = textAfterRollTags.replace(
            /\[NPC:([^\]]+)\]([\s\S]*?)\[\/NPC\]/g,
            (full, name: string, inner: string) => {
              const n = name.trim().toLowerCase();
              const isPlayer = playerNamesLower.some(
                (pn) => pn === n || pn.includes(n) || n.includes(pn)
              );
              return isPlayer ? inner : full;
            }
          );
        }

        // ANT-129: a max_tokens cut ends mid-word/mid-sentence (and can orphan
        // a `**` or a partial tag). Trim back to the last sentence boundary so
        // the player never reads a reply that just stops, and signal the client
        // so it can offer a "continue" affordance.
        const wasTruncated =
          finishReason === 'max_tokens' || finishReason === 'MAX_TOKENS';
        if (wasTruncated) {
          const upToBoundary = textAfterRollTags.match(/[\s\S]*[.!?…»”"\]]/);
          if (upToBoundary) textAfterRollTags = upToBoundary[0];
          const boldMarkers = textAfterRollTags.match(/\*\*/g);
          if (boldMarkers && boldMarkers.length % 2 === 1) {
            const i = textAfterRollTags.lastIndexOf('**');
            textAfterRollTags =
              textAfterRollTags.slice(0, i) + textAfterRollTags.slice(i + 2);
          }
          console.warn(
            `[ANT-129] reply truncated by token cap (session ${sessionId}), trimmed to sentence boundary`
          );
        }

        const segments = parseSegments(textAfterRollTags, scenario.npcs ?? []);

        // textForDB keeps NPC speech tags and IMAGE tags so the client can reconstruct
        // bubbles and dynamic images after session reload.  Only data-only tags are stripped.
        const textForDB = textAfterRollTags
          .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/g, '')
          .replace(/\s*\[LOCATION:[\w-]+\]/g, '')
          .replace(/\s*\[NEW_LOCATION:[\w-]+:[^:]+:[^\]]+\]/g, '')
          .replace(/\s*\[NPC_UPDATE:[^\]]+\]/g, '')
          .replace(/\s*\[CASE_PLAN:[^\]]*\]/g, '')
          .replace(/\s*\[EVENT_DONE:[^\]]*\]/g, '')
          .replace(/\s*\[COMPLETE_SESSION\]/g, '')
          .replace(/\s*\[FINISH_EVENING\]/g, '')
          .trim();

        // cleanText is used only for SSE streaming (already rendered in client) and TTS
        const cleanText = stripNpcTags(textForDB)
          .replace(/\s*\[IMAGE:\w+:[^\]]+\]/g, '')
          .trim();

        // ── Auto-register NPCs into npcRelations ────────────────────────────
        // Any NPC who speaks in this message is added as 'unknown' if not yet tracked.
        // Matching is partial: tag "Ковальська" matches scenario NPC "Місіс Гаррієт Ковальська".
        // If no scenario NPC matches at all, register as a dynamic NPC.
        // Register only well-formed NPC speech tags. Malformed orphan markers
        // (e.g. missing [/NPC]) should not create npcRelations artifacts.
        for (const m of textAfterRollTags.matchAll(/\[NPC:([^\]]+)\][\s\S]*?\[\/NPC\]/g)) {
          const npcName = m[1].trim().toLowerCase();
          const npc = scenario.npcs?.find((n) => {
            const fullName = n.name.toLowerCase();
            return fullName === npcName || fullName.includes(npcName) || npcName.includes(fullName);
          });
          if (npc) {
            if (!(npc.id in updatedWorldState.npcRelations)) {
              updatedWorldState = {
                ...updatedWorldState,
                npcRelations: { ...updatedWorldState.npcRelations, [npc.id]: 'unknown' },
              };
            }
          } else {
            // Improvised NPC — not in scenario, store in dynamicNpcs
            const dynamicId = `dynamic_${npcName.replace(/\s+/g, '_')}`;
            const existingDynamic = updatedWorldState.dynamicNpcs ?? [];
            if (!existingDynamic.some((d) => d.id === dynamicId)) {
              updatedWorldState = {
                ...updatedWorldState,
                dynamicNpcs: [...existingDynamic, { id: dynamicId, name: m[1].trim() }],
                npcRelations: { ...updatedWorldState.npcRelations, [dynamicId]: 'unknown' },
              };
            }
          }
        }

        // ── ANT-153: tag-compliance monitoring (no state mutation) ──────────
        // Dialogue punctuation (dash-led line or long quoted phrase) without a
        // single [NPC:] tag in the reply usually means the model voiced an NPC
        // untagged. Log it so prompt compliance can be tracked in container logs.
        if (!/\[NPC:/.test(textAfterRollTags)) {
          const hasUntaggedSpeech =
            /(^|\n)\s*[—–]\s*\S/.test(textAfterRollTags) ||
            /[«“][^»”]{15,}[»”]/.test(textAfterRollTags);
          if (hasUntaggedSpeech) {
            console.warn(
              `[ANT-153] possible untagged NPC speech (session ${sessionId})`
            );
          }
        }

        // ── Apply DELTA (all tags in order; legacy hp/sanity/luck still valid) ─

        let updatedPlayers = mutatedPlayers;
        for (const dm of deltaMatches) {
          try {
            const delta = JSON.parse(dm[1]) as Record<string, Record<string, number>>;
            updatedPlayers = updatedPlayers.map((p, i) => {
              const d = delta[String(i)];
              if (!d) return p;
              return applyDeltaToPlayer(p, scenario.rulesetId, d);
            });
          } catch { /* malformed — ignore */ }
        }

        // ── Apply LOCATION / NEW_LOCATION moves in document order ───────────

        for (const move of locationMoves) {
          updatedWorldState = {
            ...updatedWorldState,
            currentLocation: move.id,
            visitedLocations: updatedWorldState.visitedLocations.includes(move.id)
              ? updatedWorldState.visitedLocations
              : [...updatedWorldState.visitedLocations, move.id],
            ...(move.name
              ? {
                  dynamicLocations: {
                    ...updatedWorldState.dynamicLocations,
                    [move.id]: { name: move.name.trim(), description: (move.description ?? '').trim() },
                  },
                }
              : {}),
          };
        }

        const resolvedLocationGroup = resolveLocationGroupIdForLocation(
          scenario,
          updatedWorldState.currentLocation
        );
        updatedWorldState = {
          ...updatedWorldState,
          currentLocationGroup: resolvedLocationGroup ?? undefined,
        };

        // ── Clear one-time variant hint after intro ─────────────────────────
        if (isIntro && updatedWorldState.variantHint) {
          updatedWorldState = { ...updatedWorldState, variantHint: undefined };
        }

        // ── Prepare the atomic commit + replay payload ──────────────────────
        const needsPlayerUpdate =
          deltaMatches.length > 0 ||
          JSON.stringify(mutatedPlayers) !== JSON.stringify(turnPlayers);

        // ── Ambient ─────────────────────────────────────────────────────────

        const ambientFile = resolveAmbientFileForLocation(scenario, finalMove?.id ?? null);

        // ── TTS prefetch ────────────────────────────────────────────────────

        const voiceStyle = detectVoiceStyle();

        const imageType    = imageMatch?.[1] ?? null;
        const imagePrompt  = imageMatch?.[2]?.trim() ?? null;
        const location     = finalMove?.id ?? null;
        const locationName = location
          ? (playerFacingScenario.locations.find((l) => l.id === location)?.name
              ?? updatedWorldState.dynamicLocations?.[location]?.name
              ?? null)
          : null;
        const playerFacingPlayers = localizePlayersForScenario(
          updatedPlayers,
          playerFacingScenario,
        );

        const completed = await finalizeAiTurn({
          sessionId,
          requestId,
          leaseToken,
          userMessages: isIntro
            ? []
            : allActions && allActions.length > 1
              ? allActions.map((action) => ({
                  content: action.text,
                  playerIdx: action.playerIdx,
                }))
              : [{ content: message, playerIdx }],
          assistantContent: textForDB,
          baseSessionUpdatedAt: claimedSession.updated_at,
          worldState: updatedWorldState,
          players: needsPlayerUpdate ? updatedPlayers : undefined,
          result: {
          response: cleanText,
          voiceStyle,
          segments,
          aiProvider,
          players: playerFacingPlayers,
          world_state: updatedWorldState,
          imageType,
          imagePrompt,
          location,
          locationName,
          ambientFile,
          completionAction,
          truncated: wasTruncated || undefined,
          },
        });
        if (!completed) {
          throw new Error('AI turn lease was released or reclaimed before commit');
        }
        const savedAssistantMsg = completed.assistantMessage;

        if (autoVoiceEnabled) {
          prefetchGemini(cleanText, voiceStyle, segments);
        }

        send('done', completed.result);

        // ── Summarize periodically ──────────────────────────────────────────

        const msgCount = await countMessages(sessionId);
        if (msgCount % 20 === 0) {
          summarizeAndUpdateWorldState(sessionId, sessionLang);
        }

        // ── Debug snapshot (admin-only, fire-and-forget) ────────────────────
        saveMessageDebug(savedAssistantMsg.id, {
          promptBlocks: {
            ruleset: blocks.ruleset,
            static:  blocks.static,
            dynamic: blocks.dynamic,
            history: deepseekMessages,
          },
          rawOutput: assistantText,
          provider: arm.trackProvider,
          model: arm.model,
          inputTokens,
          outputTokens,
          finishReason: finishReason ?? undefined,
        }).catch((e) => console.error('saveMessageDebug failed:', e));

      } catch (error) {
        console.error('Error in AI route:', error);
        const errorCode = request.signal.aborted
          ? 'client_aborted'
          : turnSignal.aborted
            ? 'provider_timeout'
            : 'ai_turn_failed';
        providerAbortController.abort(error);
        // Releasing happens only after the provider fetch/body read has thrown,
        // so a retry cannot overlap work still running in this process.
        await releaseAiTurn(sessionId, requestId, leaseToken, errorCode)
          .catch((releaseError) => console.error('Failed to release AI turn:', releaseError));
        try {
          send('error', { message: 'Failed to get AI response' });
        } catch {
          // The client may already have disconnected; the durable lease above
          // is the important cleanup.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Closing an already-cancelled stream is harmless.
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
  } catch (error) {
    await releaseAiTurn(sessionId, requestId, leaseToken, 'pre_stream_failed')
      .catch((releaseError) => console.error('Failed to release AI turn:', releaseError));
    console.error('Error preparing AI turn:', error);
    return NextResponse.json({ error: 'Failed to prepare AI turn' }, { status: 500 });
  }
}
