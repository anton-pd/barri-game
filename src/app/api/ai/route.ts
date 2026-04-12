import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { getSession, getLastNMessages, countMessages, saveMessage, updateSession } from '@/lib/queries';
import { buildSystemPrompt, buildSummarizePrompt } from '@/lib/prompts';
import type { Scenario, WorldState, NPC } from '@/types';

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

async function summarizeAndUpdateWorldState(sessionId: string, scenarioId: string): Promise<void> {
  try {
    const { getAllMessages } = await import('@/lib/queries');
    const allMessages = await getAllMessages(sessionId);
    const scenario = loadScenario(scenarioId);

    const summarizePrompt = buildSummarizePrompt(allMessages);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: summarizePrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const worldState = JSON.parse(jsonMatch[0]) as WorldState;
      await updateSession(sessionId, { world_state: worldState });
    }
  } catch (error) {
    console.error('Error summarizing world state:', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, message, playerIdx, allActions } = body as {
      sessionId: string;
      message: string;
      playerIdx: number;
      allActions?: { playerIdx: number; text: string }[];
    };

    if (!sessionId || !message) {
      return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const scenario = loadScenario(session.scenario_id);
    const recentMessages = await getLastNMessages(sessionId, 30);
    const systemPromptText = buildSystemPrompt(scenario, session.world_state, session.players);

    const isIntro = message === '__intro__';

    const conversationHistory = recentMessages.map((m) => {
      if (m.role === 'user' && m.player_idx !== null && session.players[m.player_idx]) {
        const name = session.players[m.player_idx].name;
        return { role: 'user' as const, content: `[${name}]: ${m.content}` };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

    const userContent = isIntro
      ? 'Почни гру: встанови атмосферу, опиши місце та ситуацію де знаходяться гравці. Не питай нічого, просто зроби інтро.'
      : (() => {
          const player = session.players[playerIdx];
          return player ? `[${player.name}]: ${message}` : message;
        })();

    conversationHistory.push({ role: 'user', content: userContent });

    const aiResponse = await anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: systemPromptText,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: conversationHistory,
      },
      {
        headers: {
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
      }
    );

    const assistantText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';

    if (!isIntro) {
      if (allActions && allActions.length > 1) {
        for (const action of allActions) {
          await saveMessage(sessionId, 'user', action.text, action.playerIdx);
        }
      } else {
        await saveMessage(sessionId, 'user', message, playerIdx);
      }
    }
    await saveMessage(sessionId, 'assistant', assistantText);

    const msgCount = await countMessages(sessionId);
    if (msgCount % 20 === 0) {
      summarizeAndUpdateWorldState(sessionId, session.scenario_id);
    }

    const updatedSession = await getSession(sessionId);

    // Parse and strip [DELTA:...] and [IMAGE:...] from response
    const deltaMatch = assistantText.match(/\[DELTA:(\{[\s\S]*?\})\]/);
    const imageMatch = assistantText.match(/\[IMAGE:(\w+):([^\]]+)\]/);
    const cleanText  = assistantText
      .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/, '')
      .replace(/\s*\[IMAGE:\w+:[^\]]+\]/, '')
      .trim();

    let updatedPlayers = session.players;
    if (deltaMatch) {
      try {
        const delta = JSON.parse(deltaMatch[1]) as Record<string, { hp?: number; sanity?: number }>;
        updatedPlayers = session.players.map((p, i) => {
          const d = delta[String(i)];
          if (!d) return p;
          return {
            ...p,
            hp:     Math.max(0, Math.min(p.maxHp,     p.hp     + (d.hp     ?? 0))),
            sanity: Math.max(0, Math.min(p.maxSanity,  p.sanity + (d.sanity ?? 0))),
          };
        });
        await updateSession(session.id, { players: updatedPlayers });
      } catch {
        // malformed delta — ignore
      }
    }

    const voiceStyle  = detectVoiceStyle(cleanText, scenario.npcs ?? []);
    const imageType   = imageMatch?.[1] ?? null;
    const imagePrompt = imageMatch?.[2]?.trim() ?? null;

    return NextResponse.json({
      response: cleanText,
      voiceStyle,
      players: updatedPlayers,
      world_state: updatedSession?.world_state,
      imageType,
      imagePrompt,
    });
  } catch (error) {
    console.error('Error in AI route:', error);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
}
