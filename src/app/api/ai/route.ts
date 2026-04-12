import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { getSession, getLastNMessages, countMessages, saveMessage, updateSession } from '@/lib/queries';
import { buildSystemPrompt, buildSummarizePrompt } from '@/lib/prompts';
import type { Scenario, WorldState } from '@/types';

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
    const { sessionId, message, playerIdx } = body as {
      sessionId: string;
      message: string;
      playerIdx: number;
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

    const conversationHistory = recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    conversationHistory.push({ role: 'user', content: message });

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

    await saveMessage(sessionId, 'user', message, playerIdx);
    await saveMessage(sessionId, 'assistant', assistantText);

    const msgCount = await countMessages(sessionId);
    if (msgCount % 20 === 0) {
      summarizeAndUpdateWorldState(sessionId, session.scenario_id);
    }

    const updatedSession = await getSession(sessionId);

    return NextResponse.json({
      response: assistantText,
      world_state: updatedSession?.world_state,
    });
  } catch (error) {
    console.error('Error in AI route:', error);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
}
