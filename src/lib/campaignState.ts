import type { WorldState } from '@/types';

/**
 * Build the starting world state for the NEXT campaign evening from the
 * finalized state of the one that just ended.
 *
 * Carries forward persistent campaign knowledge (NPC relations, visited
 * locations, discovered clues, dynamic locations/NPCs, open threads, act) and
 * the rolling `summary`, while resetting per-evening transient state so a fresh
 * evening does not inherit stale rolls, events, risk accumulation or image cache.
 */
export function buildNextSessionWorldState(worldState: WorldState, summary: string): WorldState {
  return {
    ...worldState,
    summary,
    passiveMessageCount: 0,
    totalMessageCount: 0,
    pendingRollResult: undefined,
    activeRandomEvent: undefined,
    locationRisk: {},
    sessionImages: {},
    variantHint: undefined,
  };
}
