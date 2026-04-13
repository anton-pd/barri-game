import type { NPC } from '@/types';

export type Segment =
  | { type: 'narration'; text: string }
  | { type: 'npc'; name: string; voiceStyle: string; gender?: 'male' | 'female'; text: string };

/**
 * Parse NPC voice tags from raw AI response text.
 * Tags format: [NPC:Name]dialogue text[/NPC]
 * Returns ordered array of narration/npc segments.
 */
export function parseSegments(rawText: string, npcs: NPC[]): Segment[] {
  const npcMap = new Map(npcs.map((n) => [n.name.toLowerCase(), n]));
  const segments: Segment[] = [];

  // Split on NPC tags (keep delimiters via capture group)
  const parts = rawText.split(/(\[NPC:[^\]]+\][\s\S]*?\[\/NPC\])/g);

  for (const part of parts) {
    const npcMatch = part.match(/^\[NPC:([^\]]+)\]([\s\S]*?)\[\/NPC\]$/);
    if (npcMatch) {
      const name = npcMatch[1].trim();
      const text = npcMatch[2].trim();
      if (!text) continue;
      // Look up voice by name (case-insensitive fallback)
      const npc = npcMap.get(name.toLowerCase());
      const voiceStyle = npc?.voiceStyle ?? 'keeper';
      const gender = npc?.gender;
      segments.push({ type: 'npc', name, voiceStyle, gender, text });
    } else {
      // Strip other action tags from narration parts before storing
      const text = part
        .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/g, '')
        .replace(/\s*\[ITEM:\d+:[^\]]+\]/g, '')
        .replace(/\s*\[LOCATION:[\w-]+\]/g, '')
        .replace(/\s*\[IMAGE:\w+:[^\]]+\]/g, '')
        .trim();
      if (text) segments.push({ type: 'narration', text });
    }
  }

  return segments;
}

/** Strip NPC wrapper tags from text, keeping the inner dialogue text intact. */
export function stripNpcTags(text: string): string {
  return text.replace(/\[NPC:[^\]]+\]([\s\S]*?)\[\/NPC\]/g, '$1');
}

/** True when segments contain at least one NPC turn (worth using multi-speaker). */
export function hasNpcSpeech(segments: Segment[]): boolean {
  return segments.some((s) => s.type === 'npc');
}
