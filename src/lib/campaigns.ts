// CHANGED: New file — campaign management layer for multi-session play
import sql from './db';
import type { Campaign, Player } from '@/types';
import Anthropic from '@anthropic-ai/sdk';
import {
  createCampaignRecord,
  getRecentSessionSummaries,
  saveSessionSummary,
} from './queries';

const anthropic = new Anthropic();

// Get campaign context for injection into prompts
export async function getCampaignContext(campaignId: string): Promise<{
  recentSummaries: string;
}> {
  const summaries = await getRecentSessionSummaries(campaignId, 3);

  const ordered = [...summaries].reverse();
  const recentSummaries = ordered.length
    ? ordered.map((s) => `Вечір ${s.sessionNumber}: ${s.summary}`).join('\n')
    : '';

  return { recentSummaries };
}

// Create a new campaign
export async function createCampaign(
  userId: string,
  scenarioId: string,
  name: string
) {
  const { createSession } = await import('./queries');
  const initialWorldState = {
    act: 1,
    visitedLocations: [],
    discoveredClues: [],
    npcRelations: {},
    summary: '',
    openThreads: [],
    playerNotes: [],
    passiveMessageCount: 0,
    totalMessageCount: 0,
    locationRisk: {},
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createCampaignRecord(userId, scenarioId, name, initialWorldState as any);
}

// Close a session and save its summary to the campaign
export async function closeSession(
  sessionId: string,
  campaignId: string,
  sessionNumber: number,
  players: Player[],
  messages: Array<{ role: string; content: string }>
): Promise<void> {
  const summarizePrompt = buildCloseSessionPrompt(messages);
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: summarizePrompt }],
  });

  let summaryData: { summary: string; keyEvents: string[]; npcChanges: Record<string, unknown> };
  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    summaryData = match ? JSON.parse(match[0]) : null;
    if (!summaryData) throw new Error('no json');
  } catch {
    summaryData = { summary: 'Сесія завершена.', keyEvents: [], npcChanges: {} };
  }

  await saveSessionSummary(
    campaignId,
    sessionId,
    sessionNumber,
    summaryData.summary,
    summaryData.keyEvents || [],
    summaryData.npcChanges || {},
    players
  );
}

function buildCloseSessionPrompt(messages: Array<{ role: string; content: string }>): string {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'ГРАВЕЦЬ' : 'КІПЕР'}: ${m.content}`)
    .join('\n\n');

  return `Проаналізуй цю RPG сесію. Відповідай ТІЛЬКИ валідним JSON.

${transcript}

Поверни JSON:
{
  "summary": "<2-3 речення що сталось>",
  "keyEvents": ["<подія 1>", "<подія 2>"],
  "npcChanges": {"<npc_id>": {"attitude": "friendly|neutral|hostile"}}
}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export { createCampaignRecord as _createCampaignRecord, Campaign, sql };
