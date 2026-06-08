import { NextResponse } from 'next/server';
import { buildSystemPromptBlocks } from '@/lib/prompts';
import { detectCompletionAction } from '@/lib/completionTags';
import { parseInventoryTags } from '@/lib/inventoryTags';
import { stripNpcTags } from '@/lib/segments';
import { DEMO_PLAYERS, DEMO_SCENARIO, initialDemoWorldState } from '@/lib/demoScenario';
import type { Player, WorldState } from '@/types';

export const runtime = 'nodejs';

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 800;

interface DemoHistoryMessage {
  role: 'keeper' | 'player';
  text: string;
}

interface DemoKeeperRequest {
  message?: string;
  history?: DemoHistoryMessage[];
  worldState?: Partial<WorldState>;
  players?: Player[];
  language?: 'en' | 'uk' | 'es';
}

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

function normalizeHistory(input: unknown): DemoHistoryMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is DemoHistoryMessage => {
      if (!item || typeof item !== 'object') return false;
      const maybe = item as Partial<DemoHistoryMessage>;
      return (
        (maybe.role === 'keeper' || maybe.role === 'player') &&
        typeof maybe.text === 'string' &&
        maybe.text.trim().length > 0
      );
    })
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      text: item.text.slice(0, MAX_MESSAGE_CHARS),
    }));
}

function sanitizeWorldState(input: Partial<WorldState> | undefined): WorldState {
  const initial = initialDemoWorldState();
  const visited = Array.isArray(input?.visitedLocations)
    ? input.visitedLocations.filter((id): id is string => typeof id === 'string')
    : initial.visitedLocations;
  const clues = Array.isArray(input?.discoveredClues)
    ? input.discoveredClues.filter((id): id is string => typeof id === 'string')
    : initial.discoveredClues;

  return {
    ...initial,
    ...input,
    act: 1,
    currentLocation:
      typeof input?.currentLocation === 'string' ? input.currentLocation : initial.currentLocation,
    visitedLocations: Array.from(new Set([...initial.visitedLocations, ...visited])),
    discoveredClues: Array.from(new Set(clues)),
    npcRelations: {
      ...initial.npcRelations,
      ...(input?.npcRelations ?? {}),
    },
    openThreads: Array.isArray(input?.openThreads) ? input.openThreads : initial.openThreads,
    playerNotes: Array.isArray(input?.playerNotes) ? input.playerNotes : initial.playerNotes,
    totalMessageCount: Math.min((input?.totalMessageCount ?? 0) + 1, 10),
  };
}

function sanitizePlayers(input: Player[] | undefined): Player[] {
  if (!Array.isArray(input) || input.length === 0) {
    return DEMO_PLAYERS.map((player) => ({
      ...player,
      inventory: player.inventory.map((item) => ({ ...item })),
    }));
  }

  return input.slice(0, 1).map((player, idx) => ({
    ...DEMO_PLAYERS[idx],
    ...player,
    inventory: Array.isArray(player.inventory)
      ? player.inventory.map((item) => ({ ...item }))
      : DEMO_PLAYERS[idx].inventory.map((item) => ({ ...item })),
    skills: {
      ...DEMO_PLAYERS[idx].skills,
      ...(player.skills ?? {}),
    },
  }));
}

function addClue(worldState: WorldState, clue: string): WorldState {
  if (worldState.discoveredClues.includes(clue)) return worldState;
  return {
    ...worldState,
    discoveredClues: [...worldState.discoveredClues, clue],
  };
}

function ensureVisited(worldState: WorldState, locationId: string): WorldState {
  return {
    ...worldState,
    currentLocation: locationId,
    visitedLocations: worldState.visitedLocations.includes(locationId)
      ? worldState.visitedLocations
      : [...worldState.visitedLocations, locationId],
  };
}

function ensureSilverPin(players: Player[]): Player[] {
  return players.map((player, idx) => {
    if (idx !== 0) return player;
    if (player.inventory.some((item) => item.name.toLowerCase().includes('silver filing pin'))) {
      return player;
    }
    return {
      ...player,
      inventory: [
        ...player.inventory,
        {
          id: 'silver_filing_pin',
          name: 'Silver filing pin',
          description: "A sharpened filing pin narrow enough for Archive 7's lock.",
          uses: 1,
        },
      ],
    };
  });
}

function applyDemoTags(
  rawAssistantText: string,
  worldState: WorldState,
  players: Player[],
  completed: boolean
): { worldState: WorldState; players: Player[] } {
  let nextWorld = worldState;
  let nextPlayers = players;

  for (const match of rawAssistantText.matchAll(/\[DEMO_CLUE:(door_inspected|silver_pin|passphrase|archive_open)\]/g)) {
    const clue = match[1];
    nextWorld = addClue(nextWorld, clue);
    if (clue === 'silver_pin') {
      nextPlayers = ensureSilverPin(nextPlayers);
    }
  }

  if (completed) {
    nextWorld = addClue(ensureVisited(nextWorld, 'inner_archive'), 'archive_open');
  }

  return { worldState: nextWorld, players: nextPlayers };
}

function stripDataTags(text: string): string {
  return stripNpcTags(text)
    .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/g, '')
    .replace(/\s*\[LOCATION:[\w-]+\]/g, '')
    .replace(/\s*\[NEW_LOCATION:\w+:[^:]+:[^\]]+\]/g, '')
    .replace(/\s*\[NPC_UPDATE:[^\]]+\]/g, '')
    .replace(/\s*\[COMPLETE_SESSION\]/g, '')
    .replace(/\s*\[FINISH_EVENING\]/g, '')
    .replace(/\s*\[IMAGE:\w+:[^\]]+\]/g, '')
    .replace(/\s*\[SET_PENDING_ROLL:[^\]]+\]/g, '')
    .replace(/\s*\[CLEAR_PENDING_ROLL\]/g, '')
    .replace(/\s*\[DEMO_CLUE:[^\]]+\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function callGeminiDemo(
  systemPrompt: string,
  history: GeminiMessage[]
): Promise<{ text: string; inputTokens: number; outputTokens: number; finishReason: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: history,
        generationConfig: {
          maxOutputTokens: 520,
          temperature: 0.85,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini demo error:', res.status, err);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json() as {
    candidates?: {
      content?: { parts?: { text: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini returned no demo text (${data.promptFeedback?.blockReason ?? 'unknown'})`);
  }

  return {
    text,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    finishReason: data.candidates?.[0]?.finishReason ?? null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as DemoKeeperRequest;
    const message = body.message?.trim().slice(0, MAX_MESSAGE_CHARS) ?? '';
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const history = normalizeHistory(body.history);
    let worldState = sanitizeWorldState(body.worldState);
    let players = sanitizePlayers(body.players);
    if (worldState.discoveredClues.includes('silver_pin')) {
      players = ensureSilverPin(players);
    }
    const demoLang = body.language === 'uk' || body.language === 'es' ? body.language : 'en';
    const promptLang = demoLang === 'uk' ? 'uk' : 'en';
    const isDiceResult = Boolean(worldState.pendingRollResult && /^\d{1,3}$/.test(message));
    const priorUserTurns = history.filter((entry) => entry.role === 'player').length;
    if (priorUserTurns >= 10) {
      return NextResponse.json({
        text: 'The Keeper closes the preview file at ten entries. The full dossier waits beyond registration.',
        meta: 'Archive notice',
        completed: true,
        completionReason: 'message_limit',
        worldState,
        players,
      });
    }

    const blocks = buildSystemPromptBlocks(DEMO_SCENARIO, worldState, players, {
      language: promptLang,
      keeperActivitySection: buildDemoKeeperSection(demoLang, worldState),
    });

    const geminiHistory: GeminiMessage[] = history.map((entry) => ({
      role: entry.role === 'keeper' ? 'model' : 'user',
      parts: [{ text: entry.role === 'keeper' ? entry.text : `[Investigator]: ${entry.text}` }],
    }));
    geminiHistory.push({ role: 'user', parts: [{ text: `[Investigator]: ${message}` }] });

    const result = await callGeminiDemo(
      `${blocks.ruleset}\n\n${blocks.static}\n\n${blocks.dynamic}`,
      geminiHistory
    );
    const completionAction = detectCompletionAction(result.text);
    const locationMatch = result.text.match(/\[LOCATION:([\w-]+)\]/);
    const { cleanText: textAfterInventory, mutatedPlayers } = parseInventoryTags(result.text, players);

    players = mutatedPlayers;
    let textAfterRollTags = textAfterInventory;
    textAfterRollTags = textAfterRollTags.replace(
      /\[SET_PENDING_ROLL:(\d+):([^:]+):(\d+):(\d+)(?::([^\]]*))?\]/g,
      (_, idx, skillName, skillValue, threshold, context) => {
        worldState = {
          ...worldState,
          pendingRollResult: {
            characterIdx: Number(idx),
            skillName,
            skillValue: Number(skillValue),
            goodThreshold: Number(threshold),
            context: context ?? '',
          },
        };
        return '';
      }
    );
    textAfterRollTags = textAfterRollTags.replace(/\[CLEAR_PENDING_ROLL\]/g, () => {
      worldState = { ...worldState, pendingRollResult: undefined };
      return '';
    });

    if (isDiceResult && worldState.pendingRollResult) {
      worldState = { ...worldState, pendingRollResult: undefined };
    }

    if (!worldState.pendingRollResult && !isDiceResult) {
      const rollTextMatch =
        textAfterRollTags.match(/Roll\s+([\w\s/]+?)\s*\(1d100,\s*need\s*(\d+)\s*or\s*less\)/i) ??
        textAfterRollTags.match(/Кинь\s+([\wА-ЯҐЄІЇа-яґєії\s/]+?)\s*\(1к100,\s*треба\s*(\d+)\s*або\s*менше\)/i) ??
        textAfterRollTags.match(/Tira\s+([\wÁÉÍÓÚÜÑáéíóúüñ\s/]+?)\s*\(1d100,\s*(?:necesitas|objetivo)\s*(\d+)\s*o\s*menos\)/i);
      if (rollTextMatch) {
        const skillNameRaw = rollTextMatch[1].trim();
        const threshold = Number(rollTextMatch[2]);
        const skillValue =
          players[0]?.skills
            ? (Object.entries(players[0].skills).find(
                ([name]) => name.toLowerCase() === skillNameRaw.toLowerCase()
              )?.[1] ?? threshold)
            : threshold;
        worldState = {
          ...worldState,
          pendingRollResult: {
            characterIdx: 0,
            skillName: skillNameRaw,
            skillValue,
            goodThreshold: threshold,
            context: '',
          },
        };
      }
    }

    if (locationMatch) {
      worldState = ensureVisited(worldState, locationMatch[1]);
    }

    const completed = completionAction === 'complete-session' || worldState.currentLocation === 'inner_archive';
    const hinted = applyDemoTags(result.text, worldState, players, completed);
    worldState = hinted.worldState;
    players = hinted.players;

    const cleanText = stripDataTags(textAfterRollTags);
    const meta = completed
      ? 'Objective complete'
      : worldState.pendingRollResult
        ? `Roll ${worldState.pendingRollResult.skillName}: <= ${worldState.pendingRollResult.goodThreshold}`
        : 'Keeper';

    return NextResponse.json({
      text: cleanText,
      meta,
      completed: completed || worldState.currentLocation === 'inner_archive',
      completionReason: completed ? 'objective' : null,
      worldState,
      players,
      usage: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        finishReason: result.finishReason,
      },
    });
  } catch (error) {
    console.error('Demo Keeper route failed:', error);
    return NextResponse.json({ error: 'Failed to get Keeper response' }, { status: 500 });
  }
}

function buildDemoKeeperSection(lang: 'en' | 'uk' | 'es', worldState: WorldState): string {
  const pending = worldState.pendingRollResult;
  const languageLine =
    lang === 'uk'
      ? 'Відповідай ТІЛЬКИ українською мовою.'
      : lang === 'es'
        ? 'Respond ONLY in Spanish. This overrides any earlier English-language instruction.'
        : 'Respond ONLY in English.';
  const rollLine = pending
    ? lang === 'uk'
      ? `\n\n## ОЧІКУВАНИЙ КИДОК ДЕМО\nГравець зараз надсилає результат d100 для "${pending.skillName}". Поріг: ${pending.goodThreshold}. Якщо число ≤ поріг — успіх, інакше провал. Опиши наслідок, обов'язково додай [CLEAR_PENDING_ROLL]. Якщо успіх відкриває архів — додай [DEMO_CLUE:archive_open] [LOCATION:inner_archive] [COMPLETE_SESSION].`
      : lang === 'es'
        ? `\n\n## PENDING DEMO ROLL\nThe player is sending the d100 result for "${pending.skillName}". Threshold: ${pending.goodThreshold}. If the number is ≤ threshold, it succeeds; otherwise it fails. Narrate the consequence in Spanish and always append [CLEAR_PENDING_ROLL]. If success opens the archive, append [DEMO_CLUE:archive_open] [LOCATION:inner_archive] [COMPLETE_SESSION].`
        : `\n\n## PENDING DEMO ROLL\nThe player is sending the d100 result for "${pending.skillName}". Threshold: ${pending.goodThreshold}. If the number is ≤ threshold, it succeeds; otherwise it fails. Narrate the consequence and always append [CLEAR_PENDING_ROLL]. If success opens the archive, append [DEMO_CLUE:archive_open] [LOCATION:inner_archive] [COMPLETE_SESSION].`
    : '';

  return `\n\n## DEMO KEEPER MODE
${languageLine}
This is a public instant demo. Keep momentum high, keep replies short, and guide the fiction toward opening Archive 7 without railroading the player's exact method.

Progress tags are mandatory and must be truthful:
- If the player actually inspects/understands the brass door, append [DEMO_CLUE:door_inspected].
- If the player actually finds or takes the silver filing pin, append [DEMO_CLUE:silver_pin] and [ITEM:0:Silver filing pin:A sharpened filing pin narrow enough for Archive 7's lock:1].
- If the player actually overhears or learns the passphrase, append [DEMO_CLUE:passphrase].
- If the player reaches, opens, or enters the archive, append [DEMO_CLUE:archive_open] [LOCATION:inner_archive] [COMPLETE_SESSION].

Do not emit a progress tag for an action that did not actually reveal or achieve that thing.${rollLine}`;
}
