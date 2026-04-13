import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { getSession, getLastNMessages, countMessages, saveMessage, updateSession } from '@/lib/queries';
import { buildSystemPrompt, buildSystemPromptBlocks, buildSummarizePrompt } from '@/lib/prompts';
import { parseSegments, stripNpcTags } from '@/lib/segments';
import { prefetchGemini } from '@/lib/ttsPrefetch';
import { verifyJwt } from '@/lib/auth';
import type { Scenario, WorldState, NPC } from '@/types';

export type AiProvider = 'claude-sonnet' | 'gemini-flash' | 'gemini-pro';

const GEMINI_MODELS: Record<string, string> = {
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro':   'gemini-2.5-pro',
};

function detectVoiceStyle(text: string, npcs: NPC[]): string {
  const lower = text.toLowerCase();
  for (const npc of npcs) {
    if (lower.includes(npc.name.toLowerCase())) return npc.voiceStyle;
  }
  return 'keeper';
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadScenario(scenarioId: string): Scenario {
  const filePath = path.join(process.cwd(), 'scenarios', `${scenarioId}.json`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Scenario;
}

// ── Summarize (always uses fast/cheap model) ──────────────────────────────────

async function summarizeAndUpdateWorldState(
  sessionId: string,
  scenarioId: string,
  aiProvider: AiProvider
): Promise<void> {
  try {
    const { getAllMessages } = await import('@/lib/queries');
    const allMessages = await getAllMessages(sessionId);
    const summarizePrompt = buildSummarizePrompt(allMessages);

    let text = '';

    if (aiProvider === 'claude-sonnet') {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: summarizePrompt }],
      });
      text = response.content[0].type === 'text' ? response.content[0].text : '';
    } else {
      text = await callGeminiText('gemini-2.5-flash', summarizePrompt, '');
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const worldState = JSON.parse(jsonMatch[0]) as WorldState;
      await updateSession(sessionId, { world_state: worldState });
    }
  } catch (error) {
    console.error('Error summarizing world state:', error);
  }
}

// ── Gemini REST helper ────────────────────────────────────────────────────────

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

async function callGeminiChat(
  modelId: string,
  systemPrompt: string,
  history: GeminiMessage[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: history,
        generationConfig: { maxOutputTokens: 1024, temperature: 1.0 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Gemini ${modelId} error:`, res.status, err);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[]
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGeminiText(modelId: string, prompt: string, _system: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[]
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, message, playerIdx, allActions, aiProvider = 'claude-sonnet', autoVoiceEnabled = false } = body as {
      sessionId: string;
      message: string;
      playerIdx: number;
      allActions?: { playerIdx: number; text: string }[];
      aiProvider?: AiProvider;
      autoVoiceEnabled?: boolean;
    };

    if (!sessionId || !message) {
      return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Ownership check
    const isOwner = session.user_id === null || session.user_id === payload.sub || payload.role === 'admin';
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scenario = loadScenario(session.scenario_id);
    const recentMessages = await getLastNMessages(sessionId, 30);
    const isIntro = message === '__intro__';

    const userContent = isIntro
      ? 'Почни гру: встанови атмосферу, опиши місце та ситуацію де знаходяться гравці. Не питай нічого, просто зроби інтро.'
      : (() => {
          const player = session.players[playerIdx];
          return player ? `[${player.name}]: ${message}` : message;
        })();

    // ── Call AI ───────────────────────────────────────────────────────────────

    let assistantText = '';

    if (aiProvider === 'claude-sonnet') {
      // Anthropic with prompt caching
      const conversationHistory = recentMessages.map((m) => {
        if (m.role === 'user' && m.player_idx !== null && session.players[m.player_idx]) {
          const name = session.players[m.player_idx].name;
          return { role: 'user' as const, content: `[${name}]: ${m.content}` };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });
      conversationHistory.push({ role: 'user', content: userContent });

      const USE_SPLIT_PROMPT = scenario.id === 'the-last-telegram';
      const systemBlocks = USE_SPLIT_PROMPT
        ? (() => {
            const { static: staticText, dynamic: dynamicText } = buildSystemPromptBlocks(
              scenario, session.world_state, session.players
            );
            return [
              { type: 'text' as const, text: staticText,  cache_control: { type: 'ephemeral' as const } },
              { type: 'text' as const, text: dynamicText },
            ];
          })()
        : [{ type: 'text' as const, text: buildSystemPrompt(scenario, session.world_state, session.players), cache_control: { type: 'ephemeral' as const } }];

      const aiResponse = await anthropic.messages.create(
        { model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemBlocks, messages: conversationHistory },
        { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } }
      );
      assistantText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';

    } else {
      // Gemini (flash or pro) via REST
      const modelId = GEMINI_MODELS[aiProvider];
      const systemPrompt = buildSystemPrompt(scenario, session.world_state, session.players);

      const geminiHistory: GeminiMessage[] = recentMessages.map((m) => {
        if (m.role === 'user' && m.player_idx !== null && session.players[m.player_idx]) {
          const name = session.players[m.player_idx].name;
          return { role: 'user', parts: [{ text: `[${name}]: ${m.content}` }] };
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        };
      });
      geminiHistory.push({ role: 'user', parts: [{ text: userContent }] });

      assistantText = await callGeminiChat(modelId, systemPrompt, geminiHistory);
    }

    // ── Parse tags ────────────────────────────────────────────────────────────

    const deltaMatch    = assistantText.match(/\[DELTA:(\{[\s\S]*?\})\]/);
    const imageMatch    = assistantText.match(/\[IMAGE:(\w+):([^\]]+)\]/);
    const locationMatch = assistantText.match(/\[LOCATION:([\w-]+)\]/);
    const itemMatches   = [...assistantText.matchAll(/\[ITEM:(\d+):([^:]+):([^:]+):(-?\d+)\]/g)];

    const segments = parseSegments(assistantText, scenario.npcs ?? []);

    const cleanText = stripNpcTags(assistantText)
      .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/g, '')
      .replace(/\s*\[ITEM:\d+:[^\]]+\]/g, '')
      .replace(/\s*\[LOCATION:[\w-]+\]/g, '')
      .trim();

    // ── Persist messages ──────────────────────────────────────────────────────

    if (!isIntro) {
      if (allActions && allActions.length > 1) {
        for (const action of allActions) {
          await saveMessage(sessionId, 'user', action.text, action.playerIdx);
        }
      } else {
        await saveMessage(sessionId, 'user', message, playerIdx);
      }
    }
    await saveMessage(sessionId, 'assistant', cleanText);

    const msgCount = await countMessages(sessionId);
    if (msgCount % 20 === 0) {
      summarizeAndUpdateWorldState(sessionId, session.scenario_id, aiProvider);
    }

    const updatedSession = await getSession(sessionId);

    // ── Apply DELTA ───────────────────────────────────────────────────────────

    let updatedPlayers = session.players;

    if (deltaMatch) {
      try {
        const delta = JSON.parse(deltaMatch[1]) as Record<string, { hp?: number; sanity?: number; luck?: number }>;
        updatedPlayers = updatedPlayers.map((p, i) => {
          const d = delta[String(i)];
          if (!d) return p;
          return {
            ...p,
            hp:     Math.max(0, Math.min(p.maxHp,         p.hp          + (d.hp     ?? 0))),
            sanity: Math.max(0, Math.min(p.maxSanity,      p.sanity      + (d.sanity ?? 0))),
            luck:   Math.max(0, Math.min(p.maxLuck ?? 99, (p.luck ?? 0) + (d.luck   ?? 0))),
          };
        });
      } catch { /* malformed — ignore */ }
    }

    // ── Apply ITEM grants ─────────────────────────────────────────────────────

    if (itemMatches.length > 0) {
      for (const m of itemMatches) {
        const pIdx = parseInt(m[1]);
        if (pIdx < 0 || pIdx >= updatedPlayers.length) continue;
        const newItem = {
          id: `item_${Date.now()}_${pIdx}`,
          name: m[2].trim(),
          description: m[3].trim(),
          uses: parseInt(m[4]),
        };
        updatedPlayers = updatedPlayers.map((p, i) =>
          i === pIdx ? { ...p, inventory: [...(p.inventory ?? []), newItem] } : p
        );
      }
    }

    if (deltaMatch || itemMatches.length > 0) {
      await updateSession(session.id, { players: updatedPlayers });
    }

    // ── TTS prefetch + response ───────────────────────────────────────────────

    const voiceStyle  = detectVoiceStyle(cleanText, scenario.npcs ?? []);
    if (autoVoiceEnabled) {
      prefetchGemini(cleanText, voiceStyle, segments);
    }

    const imageType   = imageMatch?.[1] ?? null;
    const imagePrompt = imageMatch?.[2]?.trim() ?? null;
    const location    = locationMatch?.[1] ?? null;
    const locationName = location
      ? (scenario.locations.find((l) => l.id === location)?.name ?? null)
      : null;

    return NextResponse.json({
      response: cleanText,
      voiceStyle,
      segments,
      aiProvider,
      players: updatedPlayers,
      world_state: updatedSession?.world_state,
      imageType,
      imagePrompt,
      location,
      locationName,
    });
  } catch (error) {
    console.error('Error in AI route:', error);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
}
