// CHANGED: Three-part prompt caching (ruleset/static/dynamic), SSE streaming,
// cost tracking, inventory mutation tags, keeper activity, random event injection.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { cookies } from 'next/headers';
import { getSession, getLastNMessages, countMessages, saveMessage, saveMessageDebug, updateSession, getUserById, getUserDailyCost, getAllAppSettings } from '@/lib/queries';
import { evaluateAccessGate } from '@/lib/accessGate';
import { buildSystemPromptBlocks, buildSummarizePrompt, getIntroUserContent } from '@/lib/prompts';
import { parseSegments, stripNpcTags } from '@/lib/segments';
import { parseInventoryTags } from '@/lib/inventoryTags';
import { applyCasePlanTags } from '@/lib/casePlanTags';
import { detectCompletionAction } from '@/lib/completionTags';
import { prefetchGemini } from '@/lib/ttsPrefetch';
import { verifyJwt } from '@/lib/auth';
import { trackAPICall } from '@/lib/costTracker';
import { evaluateRandomEvent, applyEventDecision, resolveActiveEvent, clearActiveEvent, buildEventInstruction } from '@/lib/randomEvents';
import { getCampaignContext } from '@/lib/campaigns';
import { readScenarioFile, resolveAmbientFileForLocation, resolveLocationGroupIdForLocation } from '@/lib/scenarioFiles';
import { applyDeltaToPlayer } from '@/lib/statUtils';
import { mergeSummarizedWorldState } from '@/lib/worldStateMerge';
import type { WorldState } from '@/types';

export type AiProvider = 'claude-sonnet' | 'gemini-flash';

const GEMINI_MODELS: Record<string, string> = {
  'gemini-flash': 'gemini-2.5-flash',
};

function extractAnthropicTextContent(
  content: Array<{ type: string; text?: string }>
): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text ?? '')
    .join('');
}

function detectVoiceStyle(): string {
  // Keeper narrator always uses the same voice. NPC voices are handled
  // per-segment in multi-speaker Gemini TTS, not via the message-level voiceStyle.
  return 'keeper';
}

function isExplicitImageRequest(message: string): boolean {
  return [
    /\bпокаж[иі]\b/i,
    /\bпоказати\b/i,
    /\bдай побачити\b/i,
    /\bяк це виглядає\b/i,
    /\bshow me\b/i,
    /\bshow us\b/i,
    /\bwhat does .* look like\b/i,
    /\bcan i see\b/i,
    /\bimage\b/i,
    /\bphoto\b/i,
    /\bmap\b/i,
    /\bletter\b/i,
    /\bdraw\b/i,
  ].some((pattern) => pattern.test(message));
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Summarize (always uses fast/cheap model) ──────────────────────────────────

async function summarizeAndUpdateWorldState(
  sessionId: string,
  aiProvider: AiProvider,
  currentWorldState: WorldState
): Promise<void> {
  try {
    const { getAllMessages } = await import('@/lib/queries');
    const allMessages = await getAllMessages(sessionId);
    const summarizePrompt = buildSummarizePrompt(allMessages);

    let text = '';

    if (aiProvider === 'claude-sonnet') {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: summarizePrompt }],
      });
      text = response.content[0].type === 'text' ? response.content[0].text : '';
    } else {
      text = await callGeminiText('gemini-2.5-flash', summarizePrompt);
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<WorldState>;
      // Take narrative fields from the summary but keep authoritative
      // navigation/engine state (ANT-68 — see worldStateMerge.ts).
      const merged = mergeSummarizedWorldState(currentWorldState, parsed);
      await updateSession(sessionId, { world_state: merged });
    }
  } catch (error) {
    console.error('Error summarizing world state:', error);
  }
}

// ── Gemini REST helpers ───────────────────────────────────────────────────────

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

async function callGeminiChat(
  modelId: string,
  systemPrompt: string,
  history: GeminiMessage[],
  diag?: { sessionId: string; isIntro: boolean }
): Promise<{ text: string; inputTokens: number; outputTokens: number; finishReason: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: history,
    generationConfig: {
      // Intro needs more room for a 4-5 paragraph scene-setter (ANT-60).
      maxOutputTokens: diag?.isIntro ? 1400 : 900,
      temperature: 1.0,
      // Gemini 2.5 thinking tokens consume maxOutputTokens budget but aren't
      // returned as visible text → narrative replies get truncated. Disable
      // thinking for game chat (we want creative output, not reasoning).
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Gemini ${modelId} error:`, res.status, err);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json() as {
    candidates?: {
      content?: { parts?: { text: string }[] };
      finishReason?: string;
      safetyRatings?: { category: string; probability: string; blocked?: boolean }[];
    }[];
    promptFeedback?: { blockReason?: string; safetyRatings?: unknown };
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data.candidates?.[0]?.finishReason;
  const safetyRatings = data.candidates?.[0]?.safetyRatings;
  const blockReason = data.promptFeedback?.blockReason;
  const outTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  const thoughtTokens = data.usageMetadata?.thoughtsTokenCount ?? 0;

  // [ANT-58 diag] always log finishReason + safety for intro and short replies
  const textLen = text?.length ?? 0;
  if (diag?.isIntro || finishReason !== 'STOP' || textLen < 200) {
    console.log(
      `[ANT-58] Gemini ${modelId} session=${diag?.sessionId ?? '?'} intro=${diag?.isIntro ?? false} ` +
      `finishReason=${finishReason ?? 'null'} blockReason=${blockReason ?? 'null'} ` +
      `outTokens=${outTokens} thoughtTokens=${thoughtTokens} textLen=${textLen} ` +
      `head=${JSON.stringify(text?.slice(0, 120) ?? '')} tail=${JSON.stringify(text?.slice(-120) ?? '')} ` +
      `safety=${JSON.stringify(safetyRatings ?? [])}`
    );
  }

  if (!text) {
    const reason = finishReason ?? blockReason ?? 'unknown';
    console.error(`Gemini ${modelId} empty response. finishReason=${reason}`, JSON.stringify(data).slice(0, 500));
    throw new Error(`Gemini returned no text (${reason})`);
  }
  return {
    text,
    inputTokens:  data.usageMetadata?.promptTokenCount     ?? 0,
    outputTokens: outTokens,
    finishReason: finishReason ?? null,
  };
}

async function callGeminiText(modelId: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500 },
      }),
    }
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
  ];
  const passivePatterns = [
    /^(так|ні|добре|окей|гаразд|зрозуміло|продовжуй|далі)$/i,
  ];
  const isActive = activePatterns.some((p) => p.test(message));
  const isPassive = !isActive && (passivePatterns.some((p) => p.test(message)) || message.length < 20);
  return isPassive;
}

function buildKeeperActivitySection(
  keeperStyle: 'passive' | 'balanced' | 'active',
  worldState: WorldState
): string {
  const passive = worldState.passiveMessageCount ?? 0;
  const hasPendingRoll = !!worldState.pendingRollResult;

  if (hasPendingRoll) {
    const pending = worldState.pendingRollResult!;
    return `\n\n## ОЧІКУВАНИЙ КИДОК
Гравець ${pending.characterIdx} ще не повідомив результат кидка "${pending.skillName}".
Якщо повідомлення містить число — це результат кидка.
Порів з порогом ${pending.goodThreshold}: ≤ поріг → успіх, > поріг → провал.
Після результату — очисти через [CLEAR_PENDING_ROLL].`;
  }

  if (keeperStyle === 'active' || (keeperStyle === 'balanced' && passive >= 3)) {
    return `\n\n## ПІДКАЗКА ДІЙ (пасивних ходів: ${passive})
Гравці затихли. Вплітай нову деталь що провокує реакцію:
- Нова сенсорна деталь, поведінка NPC, нагадування про загрозу
НЕ перелічуй варіанти списком — опиши ситуацію що сама вимагає відповіді.`;
  }

  if (keeperStyle === 'passive') {
    return `\n\n## СТИЛЬ KEEPER: ПАСИВНИЙ\nЧекай дій гравців. Описуй лише поточний момент.`;
  }

  return '';
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── Auth & early validation (before stream) ───────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Access gate (ANT-108): waiting-list approval + per-user daily cost cap ──
  {
    const [user, settings, spentTodayUsd] = await Promise.all([
      getUserById(payload.sub),
      getAllAppSettings(),
      getUserDailyCost(payload.sub),
    ]);
    const gate = evaluateAccessGate({
      role: payload.role,
      accessStatus: user?.access_status ?? 'pending',
      enforceDailyCap: true,
      dailyLimitEnabled: settings.daily_limit_enabled === 'true',
      dailyLimitUsd: parseFloat(settings.daily_user_cost_limit_usd ?? '0'),
      spentTodayUsd,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.code, message: gate.message }, { status: gate.status });
    }
  }

  const body = await request.json();
  const {
    sessionId,
    message,
    playerIdx,
    allActions,
    aiProvider = 'claude-sonnet',
    autoVoiceEnabled = false,
    keeperStyle: keeperStyleFromBody,
    geminiCacheEnabled = false,
  } = body as {
    sessionId: string;
    message: string;
    playerIdx: number;
    allActions?: { playerIdx: number; text: string }[];
    aiProvider?: AiProvider;
    autoVoiceEnabled?: boolean;
    keeperStyle?: 'passive' | 'balanced' | 'active';
    geminiCacheEnabled?: boolean;
  };

  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const isOwner =
    session.user_id === null ||
    session.user_id === payload.sub ||
    payload.role === 'admin';
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (session.status === 'completed') {
    return NextResponse.json({ error: 'Session is read-only' }, { status: 409 });
  }

  // ── Prompt preparation (before stream — fast, no AI call) ─────────────────

  const scenario = readScenarioFile(session.scenario_id);
  const recentMessages = await getLastNMessages(sessionId, 30);
  const isIntro = message === '__intro__';
  const sessionLang: 'uk' | 'en' = (session.language ?? 'uk') as 'uk' | 'en';

  const userContent = isIntro
    ? getIntroUserContent(sessionLang)
    : (() => {
        // Multi-action batches arrive already formatted as "[Name]: action\n[Name]: action" —
        // wrapping again would produce "[Name]: [Name]: …" and mis-attribute the batch.
        if (allActions && allActions.length > 1) return message;
        const player = session.players[playerIdx];
        return player ? `[${player.name}]: ${message}` : message;
      })();

  let worldState: WorldState = session.world_state;
  const passive = isIntro ? false : isPassiveMessage(message);
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
  const activitySection = buildKeeperActivitySection(keeperStyle, worldState);
  const imageRequestInstruction = !isIntro && isExplicitImageRequest(message)
    ? 'Гравець прямо просить щось ПОКАЗАТИ. У цій відповіді ОБОВʼЯЗКОВО додай рівно один тег [IMAGE:type:short English description] для найрелевантнішого обʼєкта або сцени, яку він просить побачити. Обирай type змістовно: map / letter / photo / artifact / scene / newspaper. Опис у тегі має бути коротким, конкретним і англійською.'
    : '';
  const eventInstruction =
    eventDecision.shouldFire && eventDecision.eventType
      ? buildEventInstruction(eventDecision.eventType, eventDecision.isTransitionEvent, scenario)
      : '';
  const campaignContext = session.campaign_id
    ? await getCampaignContext(session.campaign_id)
    : undefined;
  const blocks = buildSystemPromptBlocks(scenario, worldState, session.players, {
    campaignContext,
    keeperActivitySection: activitySection,
    eventInstruction,
    imageRequestInstruction,
    language: sessionLang,
  });

  // Claude conversation history
  const conversationHistory = recentMessages.map((m) => {
    if (m.role === 'user' && m.player_idx !== null && session.players[m.player_idx]) {
      const name = session.players[m.player_idx].name;
      return { role: 'user' as const, content: `[${name}]: ${m.content}` };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });
  conversationHistory.push({ role: 'user', content: userContent });

  const systemBlocks = [
    { type: 'text' as const, text: blocks.ruleset, cache_control: { type: 'ephemeral' as const } },
    { type: 'text' as const, text: blocks.static,  cache_control: { type: 'ephemeral' as const } },
    { type: 'text' as const, text: blocks.dynamic },
  ];

  // Gemini history
  // geminiCacheEnabled: separate dynamic block from systemInstruction so the stable
  // ruleset+static prefix qualifies for Gemini implicit caching (75% token discount).
  // Without this, dynamic changes every request → systemInstruction is unique → no cache hit.
  const modelId = GEMINI_MODELS[aiProvider] ?? '';
  const systemPrompt = geminiCacheEnabled
    ? `${blocks.ruleset}\n\n${blocks.static}`
    : `${blocks.ruleset}\n\n${blocks.static}\n\n${blocks.dynamic}`;
  const geminiHistory: GeminiMessage[] = [
    ...(geminiCacheEnabled
      ? [
          { role: 'user'  as const, parts: [{ text: `[СТАН СЕСІЇ]\n${blocks.dynamic}` }] },
          { role: 'model' as const, parts: [{ text: 'Зрозумів.' }] },
        ]
      : []),
    ...recentMessages.map((m) => {
      if (m.role === 'user' && m.player_idx !== null && session.players[m.player_idx]) {
        const name = session.players[m.player_idx].name;
        return { role: 'user' as const, parts: [{ text: `[${name}]: ${m.content}` }] };
      }
      return { role: m.role === 'assistant' ? 'model' as const : 'user' as const, parts: [{ text: m.content }] };
    }),
  ];
  geminiHistory.push({ role: 'user', parts: [{ text: userContent }] });

  // ── SSE stream ────────────────────────────────────────────────────────────

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        let assistantText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let finishReason: string | null = null;
        let debugModel = '';
        let debugProvider: 'anthropic' | 'gemini' = 'gemini';

        if (aiProvider === 'claude-sonnet') {
          // CHANGED: Stream response so client sees text as it arrives
          const claudeStream = anthropic.messages.stream(
            {
              model: 'claude-sonnet-4-6',
              max_tokens: isIntro ? 1400 : 900,
              system: systemBlocks,
              messages: conversationHistory,
            },
            { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } }
          );

          for await (const ev of claudeStream) {
            if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
              assistantText += ev.delta.text;
              send('chunk', { text: ev.delta.text });
            }
          }

          const finalMsg = await claudeStream.finalMessage();
          const finalText = extractAnthropicTextContent(
            finalMsg.content as Array<{ type: string; text?: string }>
          );
          if (finalText.length > assistantText.length) {
            assistantText = finalText;
          }
          inputTokens = finalMsg.usage?.input_tokens ?? 0;
          outputTokens = finalMsg.usage?.output_tokens ?? 0;
          finishReason = finalMsg.stop_reason ?? null;
          debugModel = 'claude-sonnet-4-6';
          debugProvider = 'anthropic';

          trackAPICall({
            sessionId,
            userId: payload.sub,
            provider: 'anthropic',
            type: 'llm',
            model: 'claude-sonnet-4-6',
            inputTokens,
            outputTokens,
          }).catch(console.error);

        } else {
          const geminiResult = await callGeminiChat(modelId, systemPrompt, geminiHistory, { sessionId, isIntro });
          assistantText = geminiResult.text;
          inputTokens   = geminiResult.inputTokens;
          outputTokens  = geminiResult.outputTokens;
          finishReason  = geminiResult.finishReason;
          debugModel = modelId;
          debugProvider = 'gemini';

          trackAPICall({
            sessionId,
            userId: payload.sub,
            provider: 'gemini',
            type: 'llm',
            model: modelId,
            inputTokens,
            outputTokens,
          }).catch(console.error);
        }

        // ── Parse tags ──────────────────────────────────────────────────────

        const deltaMatch       = assistantText.match(/\[DELTA:(\{[\s\S]*?\})\]/);
        const imageMatch       = assistantText.match(/\[IMAGE:(\w+):([^\]]+)\]/);
        const locationMatch    = assistantText.match(/\[LOCATION:([\w-]+)\]/);
        const newLocationMatch = assistantText.match(/\[NEW_LOCATION:(\w+):([^:]+):([^\]]+)\]/);
        const completionAction = detectCompletionAction(assistantText);

        const { cleanText: textAfterInventory, mutatedPlayers } = parseInventoryTags(
          assistantText,
          session.players
        );

        let updatedWorldState = { ...worldState };
        let textAfterRollTags = textAfterInventory;

        textAfterRollTags = textAfterRollTags.replace(
          /\[SET_PENDING_ROLL:(\d+):([^:]+):(\d+):(\d+)(?::([^\]]*))?\]/g,
          (_, idx, skillName, skillValue, threshold, context) => {
            updatedWorldState.pendingRollResult = {
              characterIdx: Number(idx),
              skillName,
              skillValue: Number(skillValue),
              goodThreshold: Number(threshold),
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

        if (updatedWorldState.activeRandomEvent && updatedWorldState.activeRandomEvent.type !== 'roll_event') {
          updatedWorldState = clearActiveEvent(updatedWorldState);
        }
        if (!updatedWorldState.pendingRollResult && updatedWorldState.activeRandomEvent?.type === 'roll_event') {
          updatedWorldState = clearActiveEvent(updatedWorldState);
        }

        // Force-clear pendingRollResult if the player sent a dice result (plain number).
        // LLM often forgets [CLEAR_PENDING_ROLL]; without this the roll persists in DB
        // and the DiceRoller reopens on every page load.
        const isDiceResult = worldState.pendingRollResult && /^\d+$/.test(message.trim());
        if (isDiceResult && updatedWorldState.pendingRollResult === worldState.pendingRollResult) {
          updatedWorldState = { ...updatedWorldState, pendingRollResult: undefined };
        }

        // ── Auto-inject [SET_PENDING_ROLL] if AI wrote "Кинь X" / "Roll X" but forgot the tag ──
        // Gemini Flash often ignores the tag instruction despite explicit prompting.
        // Detect the roll request pattern and synthesize the tag from text.
        if (!updatedWorldState.pendingRollResult) {
          const rollTextMatch =
            textAfterRollTags.match(/Кинь\s+([\wА-ЯҐЄІЇа-яґєії\s\/]+?)\s*\(1к100,\s*треба\s*(\d+)\s*або\s*менше\)/) ??
            textAfterRollTags.match(/Roll\s+([\w\s\/]+?)\s*\(1d100,\s*need\s*(\d+)\s*or\s*less\)/);
          if (rollTextMatch) {
            const skillNameRaw = rollTextMatch[1].trim();
            const threshold = Number(rollTextMatch[2]);
            // Match skill to player's actual value; fallback to threshold
            const player = session.players[playerIdx] ?? session.players[0];
            const skillValue =
              player?.skills
                ? (Object.entries(player.skills).find(
                    ([k]) => k.toLowerCase() === skillNameRaw.toLowerCase()
                  )?.[1] ?? threshold)
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

        // ── Guard: strip [NPC:<PlayerName>]...[/NPC] (ANT-71) ───────────────
        // LLM occasionally voices a player character as if an NPC. Such tags
        // render as an NPC bubble and, worse, auto-register the player into
        // npcRelations. Unwrap the tag keeping the inner text so narration
        // is preserved but no NPC artifact leaks downstream.
        const playerNamesLower = session.players
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

        const segments = parseSegments(textAfterRollTags, scenario.npcs ?? []);

        // textForDB keeps NPC speech tags and IMAGE tags so the client can reconstruct
        // bubbles and dynamic images after session reload.  Only data-only tags are stripped.
        const textForDB = textAfterRollTags
          .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/g, '')
          .replace(/\s*\[LOCATION:[\w-]+\]/g, '')
          .replace(/\s*\[NEW_LOCATION:\w+:[^:]+:[^\]]+\]/g, '')
          .replace(/\s*\[NPC_UPDATE:[^\]]+\]/g, '')
          .replace(/\s*\[CASE_PLAN:[^\]]*\]/g, '')
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

        // ── Apply DELTA (ruleset-driven; legacy hp/sanity/luck still valid) ─

        let updatedPlayers = mutatedPlayers;
        if (deltaMatch) {
          try {
            const delta = JSON.parse(deltaMatch[1]) as Record<string, Record<string, number>>;
            updatedPlayers = updatedPlayers.map((p, i) => {
              const d = delta[String(i)];
              if (!d) return p;
              return applyDeltaToPlayer(p, scenario.rulesetId, d);
            });
          } catch { /* malformed — ignore */ }
        }

        // ── Apply LOCATION ──────────────────────────────────────────────────

        if (locationMatch) {
          const locId = locationMatch[1];
          updatedWorldState = {
            ...updatedWorldState,
            currentLocation: locId,
            visitedLocations: updatedWorldState.visitedLocations.includes(locId)
              ? updatedWorldState.visitedLocations
              : [...updatedWorldState.visitedLocations, locId],
          };
        }

        // ── Apply NEW_LOCATION (situational) ────────────────────────────────

        if (newLocationMatch) {
          const [, locId, locName, locDesc] = newLocationMatch;
          updatedWorldState = {
            ...updatedWorldState,
            currentLocation: locId,
            visitedLocations: updatedWorldState.visitedLocations.includes(locId)
              ? updatedWorldState.visitedLocations
              : [...updatedWorldState.visitedLocations, locId],
            dynamicLocations: {
              ...updatedWorldState.dynamicLocations,
              [locId]: { name: locName.trim(), description: locDesc.trim() },
            },
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

        // ── Persist messages ────────────────────────────────────────────────

        if (!isIntro) {
          if (allActions && allActions.length > 1) {
            for (const action of allActions) {
              await saveMessage(sessionId, 'user', action.text, action.playerIdx);
            }
          } else {
            await saveMessage(sessionId, 'user', message, playerIdx);
          }
        }
        const savedAssistantMsg = await saveMessage(sessionId, 'assistant', textForDB);

        // ── Persist state ───────────────────────────────────────────────────

        const needsPlayerUpdate =
          deltaMatch !== null ||
          JSON.stringify(mutatedPlayers) !== JSON.stringify(session.players);
        await updateSession(session.id, {
          world_state: updatedWorldState,
          ...(needsPlayerUpdate ? { players: updatedPlayers } : {}),
        });

        // ── Summarize periodically ──────────────────────────────────────────

        const msgCount = await countMessages(sessionId);
        if (msgCount % 20 === 0) {
          summarizeAndUpdateWorldState(sessionId, aiProvider, updatedWorldState);
        }

        const updatedSession = await getSession(sessionId);

        // ── Ambient ─────────────────────────────────────────────────────────

        const ambientFile = resolveAmbientFileForLocation(
          scenario,
          (newLocationMatch?.[1] ?? locationMatch?.[1]) ?? null
        );

        // ── TTS prefetch ────────────────────────────────────────────────────

        const voiceStyle = detectVoiceStyle();
        if (autoVoiceEnabled) {
          prefetchGemini(cleanText, voiceStyle, segments);
        }

        const imageType    = imageMatch?.[1] ?? null;
        const imagePrompt  = imageMatch?.[2]?.trim() ?? null;
        const location     = (newLocationMatch?.[1] ?? locationMatch?.[1]) ?? null;
        const locationName = location
          ? (scenario.locations.find((l) => l.id === location)?.name
              ?? updatedWorldState.dynamicLocations?.[location]?.name
              ?? null)
          : null;

        send('done', {
          response: cleanText,
          messageId: savedAssistantMsg.id,
          voiceStyle,
          segments,
          aiProvider,
          players: updatedPlayers,
          world_state: updatedSession?.world_state ?? updatedWorldState,
          imageType,
          imagePrompt,
          location,
          locationName,
          ambientFile,
          completionAction,
        });

        // ── Debug snapshot (admin-only, fire-and-forget) ────────────────────
        saveMessageDebug(savedAssistantMsg.id, {
          promptBlocks: {
            ruleset: blocks.ruleset,
            static:  blocks.static,
            dynamic: blocks.dynamic,
            history: debugProvider === 'anthropic' ? conversationHistory : geminiHistory,
            ...(debugProvider === 'gemini' && {
              geminiCacheMode: geminiCacheEnabled ? 'split' : 'combined',
            }),
          },
          rawOutput: assistantText,
          provider: debugProvider,
          model: debugModel,
          inputTokens,
          outputTokens,
          finishReason: finishReason ?? undefined,
        }).catch((e) => console.error('saveMessageDebug failed:', e));

      } catch (error) {
        console.error('Error in AI route:', error);
        send('error', { message: 'Failed to get AI response' });
      } finally {
        controller.close();
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
}
