import type { WorldState } from '@/types';

// Merge the periodic Haiku/Gemini summary back into the live world state.
//
// The summary LLM returns a JSON blob (act, summary, discoveredClues,
// npcRelations, openThreads, playerNotes, AND currentLocation/visitedLocations).
// But navigation state is owned **deterministically** by the tag-parsing path
// ([LOCATION:]/[NEW_LOCATION:]) — the summary LLM only guesses at it and, in
// particular, doesn't reliably know the ids of situational (dynamic) locations
// like `my_apartments`. Letting `parsed.currentLocation` win clobbers the real
// location (ANT-68: "location stopped updating after a dynamic location").
//
// So we take narrative fields from the summary and keep every navigation /
// engine / cache field from the authoritative current state.
export function mergeSummarizedWorldState(
  current: WorldState,
  parsed: Partial<WorldState>
): WorldState {
  return {
    ...current,
    ...parsed,
    // Navigation — authoritative, maintained by tag parsing (ANT-68).
    currentLocation: current.currentLocation,
    visitedLocations: current.visitedLocations,
    dynamicLocations: current.dynamicLocations,
    currentLocationGroup: current.currentLocationGroup,
    // Activity / engine tracking — not represented in the summary.
    passiveMessageCount: current.passiveMessageCount ?? 0,
    totalMessageCount: current.totalMessageCount ?? 0,
    locationRisk: current.locationRisk ?? {},
    pendingRollResult: current.pendingRollResult,
    activeRandomEvent: current.activeRandomEvent,
    npcDetails: current.npcDetails,
    // Caches / per-session metadata the summary never owns.
    sessionImages: current.sessionImages,
    dynamicNpcs: current.dynamicNpcs,
    variantId: current.variantId,
    variantHint: current.variantHint,
  };
}
