import type { WorldState } from '@/types';

// [EVENT_DONE:n] — the model marks must-happen event №n (1-based index into
// scenario.mustHappenEvents, numbered in the static prompt block) as having
// occurred in the fiction (ANT-148). The list of completed indices lives in
// world_state.completedMustEvents and is engine-owned: the summarize cycle
// never overwrites it (see worldStateMerge.ts).
//
// Indices outside [1, eventCount] and non-numeric payloads are ignored, but
// the tag is data-only and is stripped from narration either way.
export function applyEventDoneTags(
  text: string,
  worldState: WorldState,
  eventCount: number
): { cleanText: string; worldState: WorldState } {
  const completed = new Set(worldState.completedMustEvents ?? []);
  let changed = false;

  const cleanText = text.replace(/\s*\[EVENT_DONE:([^\]]*)\]/g, (_full, rawN: string) => {
    const n = Number(rawN.trim());
    if (Number.isInteger(n) && n >= 1 && n <= eventCount && !completed.has(n)) {
      completed.add(n);
      changed = true;
    }
    return '';
  });

  if (!changed) {
    return { cleanText, worldState };
  }

  return {
    cleanText,
    worldState: {
      ...worldState,
      completedMustEvents: [...completed].sort((a, b) => a - b),
    },
  };
}
