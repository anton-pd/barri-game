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

function applyDemoStateHints(
  userMessage: string,
  rawAssistantText: string,
  worldState: WorldState,
  players: Player[],
  completed: boolean
): { worldState: WorldState; players: Player[] } {
  const userText = userMessage.toLowerCase();
  const assistantText = rawAssistantText.toLowerCase();
  const text = `${userText}\n${assistantText}`;
  let nextWorld = worldState;
  let nextPlayers = players;

  if (/(inspect|examine|look|plaque|brass|door)/.test(text)) {
    nextWorld = addClue(nextWorld, 'door_inspected');
  }
  if (/(search|desk|drawer|blotter|filing pin|silver pin)/.test(text)) {
    nextWorld = addClue(nextWorld, 'silver_pin');
    if (/(search|desk|drawer|blotter|filing pin|silver pin)/.test(text)) {
      nextPlayers = ensureSilverPin(nextPlayers);
    }
  }
  if (
    /(listen|hear|sound|keyhole)/.test(userText) ||
    /(passphrase|silence has a spine|typewriter clacks)/.test(assistantText)
  ) {
    nextWorld = addClue(nextWorld, 'passphrase');
  }
  if (completed || /(archive admits|archive opens|door opens|inside the archive|enter the archive)/.test(text)) {
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
    if (
      worldState.discoveredClues.includes('silver_pin') ||
      /(silver filing pin|silver pin|filing pin)/i.test(message)
    ) {
      players = ensureSilverPin(players);
    }
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
      language: 'en',
      keeperActivitySection: `\n\n## DEMO KEEPER MODE
This is a public instant demo. Keep momentum high, keep replies short, and guide the fiction toward opening Archive 7 without railroading the player's exact method.
If the player has solved the doorway, entered the archive, spoken the passphrase, or used a fitting tool, append [LOCATION:inner_archive] and [COMPLETE_SESSION].`,
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

    if (locationMatch) {
      worldState = ensureVisited(worldState, locationMatch[1]);
    }

    const completed = completionAction === 'complete-session' || worldState.currentLocation === 'inner_archive';
    const hinted = applyDemoStateHints(message, result.text, worldState, players, completed);
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
