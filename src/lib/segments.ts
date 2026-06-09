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
      // Look up voice: exact match first, then partial (AI may use short names like "Ковальська")
      const nameLower = name.toLowerCase();
      let npc = npcMap.get(nameLower);
      if (!npc) {
        npc = npcs.find((n) => {
          const npcLower = n.name.toLowerCase();
          // NPC full name contains the tag name, or any word of the tag name appears in NPC name
          return npcLower.includes(nameLower) ||
            nameLower.split(/\s+/).some((w) => w.length > 2 && npcLower.includes(w));
        });
      }
      const voiceStyle = npc?.voiceStyle ?? 'keeper';
      const gender = npc?.gender;
      segments.push({ type: 'npc', name, voiceStyle, gender, text });
    } else {
      // Strip other action tags from narration parts before storing
      const text = part
        // Remove malformed/orphan NPC markers so they don't leak to UI
        .replace(/\[NPC:[^\]]+\]/g, '')
        .replace(/\[\/NPC\]/g, '')
        .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/g, '')
        .replace(/\s*\[ITEM:\d+:[^\]]+\]/g, '')
        .replace(/\s*\[USE_ITEM:\d+:[^\]]+\]/g, '')
        .replace(/\s*\[REMOVE_ITEM:\d+:[^\]]+\]/g, '')
        .replace(/\s*\[EQUIP:\d+:[^\]]+\]/g, '')
        .replace(/\s*\[BREAK_ITEM:\d+:[^\]]+\]/g, '')
        .replace(/\s*\[LOCATION:[\w-]+\]/g, '')
        .replace(/\s*\[NEW_LOCATION:[\w-]+:[^:]+:[^\]]+\]/g, '')
        .replace(/\s*\[IMAGE:\w+:[^\]]+\]/g, '')
        .replace(/\s*\[SET_PENDING_ROLL:[^\]]+\]/g, '')
        .replace(/\s*\[CLEAR_PENDING_ROLL\]/g, '')
        .replace(/\s*\[RANDOM_EVENT:[^\]]+\]/g, '')
        .replace(/\s*\[COMPLETE_SESSION\]/g, '')
        .replace(/\s*\[FINISH_EVENING\]/g, '')
        .trim();
      if (text) segments.push({ type: 'narration', text });
    }
  }

  return segments;
}

/**
 * Strip control tags from text for live display while a response is streaming.
 * Removes all complete data-only tags plus any *partial* tag at the end of the
 * buffer (e.g. `[DELTA:{"0` mid-stream). NPC wrapper tags are left intact —
 * the display path unwraps them separately via stripNpcTags(). Harmless on
 * finished messages: the server already strips these before persisting.
 */
export function stripStreamingArtifacts(text: string): string {
  return text
    .replace(/\s*\[DELTA:\{[\s\S]*?\}\]/g, '')
    .replace(/\s*\[ITEM:\d+:[^\]]+\]/g, '')
    .replace(/\s*\[USE_ITEM:\d+:[^\]]+\]/g, '')
    .replace(/\s*\[REMOVE_ITEM:\d+:[^\]]+\]/g, '')
    .replace(/\s*\[EQUIP:\d+:[^\]]+\]/g, '')
    .replace(/\s*\[BREAK_ITEM:\d+:[^\]]+\]/g, '')
    .replace(/\s*\[LOCATION:[\w-]+\]/g, '')
    .replace(/\s*\[NEW_LOCATION:[\w-]+:[^:]+:[^\]]+\]/g, '')
    .replace(/\s*\[SET_PENDING_ROLL:[^\]]+\]/g, '')
    .replace(/\s*\[CLEAR_PENDING_ROLL\]/g, '')
    .replace(/\s*\[RANDOM_EVENT:[^\]]+\]/g, '')
    .replace(/\s*\[NPC_UPDATE:[^\]]+\]/g, '')
    .replace(/\s*\[CASE_PLAN:[^\]]*\]/g, '')
    .replace(/\s*\[COMPLETE_SESSION\]/g, '')
    .replace(/\s*\[FINISH_EVENING\]/g, '')
    // Trailing partial tag at the stream buffer edge: an opening bracket
    // followed by an (incomplete) uppercase tag name and whatever came after.
    .replace(/\s*\[\/?[A-Z_]*(?::[^\]]*)?$/, '');
}

/** Strip NPC wrapper tags from text, keeping the inner dialogue text intact. */
export function stripNpcTags(text: string): string {
  return text
    .replace(/\[NPC:[^\]]+\]([\s\S]*?)\[\/NPC\]/g, '$1')
    // Also strip malformed/orphan markers when model forgets a closing tag
    .replace(/\[NPC:[^\]]+\]/g, '')
    .replace(/\[\/NPC\]/g, '');
}

/**
 * Strip dice notation from text before TTS.
 * Keeps "Кинь Навичка" but removes "(1к100, треба 65 або менше)", "[65]", "1к3 SAN" etc.
 */
export function stripDiceForTts(text: string): string {
  return text
    // Remove dice parentheticals: (1к100, треба 65 або менше) or (1к20)
    .replace(/\s*\(1к\d+[^)]*\)/gi, '')
    // Remove bracket thresholds like [65] used in sanity checks
    .replace(/\s*\[\d+\]/g, '')
    // Remove "Успіх X, провал 1кY SAN" trailing clauses
    .replace(/[.,]?\s*Успіх[\s\S]*?SAN\.?/gi, '.')
    // Remove lone dice like "1к3 SAN." at end of sentence
    .replace(/\s+1к\d+\s+SAN\.?/gi, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** True when segments contain at least one NPC turn (worth using multi-speaker). */
export function hasNpcSpeech(segments: Segment[]): boolean {
  return segments.some((s) => s.type === 'npc');
}
