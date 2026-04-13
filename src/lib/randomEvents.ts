// CHANGED: New file — server-side random event probability engine.
// Server decides if event fires. LLM only receives inject instruction.
import type { WorldState, Scenario, LocationRiskState } from '@/types';

const BASE_CHANCE = 5;
const MAX_CHANCE = 60;
const INITIAL_INCREMENT = 5.5;
const LOCATION_TRANSITION_CHANCE = 15;
const MIN_INCREMENT = 0.5;

export interface RandomEventDecision {
  shouldFire: boolean;
  isTransitionEvent: boolean;
  eventType: 'positive' | 'negative' | 'neutral' | 'roll_event' | null;
  currentChance: number;
  updatedRisk: LocationRiskState;
}

// Main function — call in route.ts before building the prompt
export function evaluateRandomEvent(
  worldState: WorldState,
  scenario: Scenario,
  newLocationId: string | undefined,
  hasPendingRoll: boolean
): RandomEventDecision {
  // Don't fire while another roll/event is in progress
  if (hasPendingRoll || worldState.activeRandomEvent) {
    return noEvent(worldState, newLocationId, scenario);
  }

  const newGroup = resolveLocationGroup(newLocationId, scenario);
  const prevGroup = worldState.currentLocationGroup;
  const isTransition = !!newGroup && newGroup !== prevGroup;

  // Check on location group transition
  if (isTransition) {
    const roll = Math.random() * 100;
    if (roll < LOCATION_TRANSITION_CHANCE) {
      return {
        shouldFire: true,
        isTransitionEvent: true,
        eventType: pickEventType(),
        currentChance: LOCATION_TRANSITION_CHANCE,
        updatedRisk: getOrInitRisk(worldState, newGroup),
      };
    }
  }

  // Accumulating chance for current group
  const groupId = newGroup ?? prevGroup ?? 'default';
  const risk = getOrInitRisk(worldState, groupId);

  const newChance = Math.min(risk.currentChance + risk.incrementRate, MAX_CHANCE);
  const updatedRisk: LocationRiskState = { ...risk, currentChance: newChance };

  const roll = Math.random() * 100;
  if (roll < newChance) {
    // Fired — reset chance and halve the increment rate
    const newIncrement = Math.max(MIN_INCREMENT, risk.incrementRate / 2);
    return {
      shouldFire: true,
      isTransitionEvent: false,
      eventType: pickEventType(),
      currentChance: newChance,
      updatedRisk: {
        currentChance: BASE_CHANCE,
        incrementRate: newIncrement,
        eventCycleCount: risk.eventCycleCount + 1,
        lastEventAt: worldState.totalMessageCount ?? 0,
      },
    };
  }

  // Did not fire — store updated chance
  return {
    shouldFire: false,
    isTransitionEvent: false,
    eventType: null,
    currentChance: newChance,
    updatedRisk,
  };
}

// Apply event decision to WorldState
export function applyEventDecision(
  worldState: WorldState,
  decision: RandomEventDecision,
  newLocationId: string | undefined,
  scenario: Scenario
): WorldState {
  const groupId =
    resolveLocationGroup(newLocationId, scenario) ??
    worldState.currentLocationGroup ??
    'default';

  const updated: WorldState = {
    ...worldState,
    locationRisk: {
      ...worldState.locationRisk,
      [groupId]: decision.updatedRisk,
    },
  };

  if (newLocationId) {
    updated.currentLocationGroup = groupId;
  }

  if (decision.shouldFire && decision.eventType) {
    updated.activeRandomEvent = {
      id: `event_${Date.now()}`,
      type: decision.eventType,
      description: '',
      groupId,
    };
  }

  return updated;
}

// Called after LLM returns [RANDOM_EVENT] tag
export function resolveActiveEvent(worldState: WorldState, description: string): WorldState {
  if (!worldState.activeRandomEvent) return worldState;
  return {
    ...worldState,
    activeRandomEvent: { ...worldState.activeRandomEvent, description },
  };
}

// Clear active event after it has been resolved
export function clearActiveEvent(worldState: WorldState): WorldState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeRandomEvent, ...rest } = worldState;
  return rest as WorldState;
}

// Build event instruction injected into the dynamic prompt block
export function buildEventInstruction(
  eventType: 'positive' | 'negative' | 'neutral' | 'roll_event',
  isTransition: boolean,
  scenario: Scenario
): string {
  const hints = scenario.eventHints?.[eventType] ?? [];
  const hintLine = hints.length
    ? `\nДля натхнення: ${hints.slice(0, 2).join('; ')}`
    : '';

  const transitionNote = isTransition
    ? "Подія пов'язана з переходом між локаціями — вплітай природно в момент прибуття.\n"
    : '';

  const typeInstructions: Record<string, string> = {
    positive: `Введи ПОЗИТИВНУ випадкову подію:
  - Несподівана знахідка що допомагає розслідуванню
  - NPC раптово стає відвертішим або допомагає
  - Обставини складаються на користь гравців${hintLine}`,

    negative: `Введи НЕГАТИВНУ випадкову подію:
  - Щось ламається або зникає
  - Нова перешкода або загроза
  - NPC стає підозрілішим або ворожим${hintLine}`,

    neutral: `Введи НЕЙТРАЛЬНУ атмосферну подію:
  - Дивна деталь що підсилює атмосферу
  - Несподіваний відвідувач або звук
  - Момент що додає texture до сцени${hintLine}`,

    roll_event: `Введи подію що ВИРІШУЄТЬСЯ КИДКОМ:
  1. Опиши раптову ситуацію з фізичним або ментальним ризиком
  2. Попроси відповідний кидок навички
  3. Постав [SET_PENDING_ROLL:idx:Навичка:значення:поріг:контекст]
  4. Зупинись — не описуй наслідки до результату${hintLine}`,
  };

  return `\n\n## ⚡ ВИПАДКОВА ПОДІЯ (серверний тригер)
${transitionNote}${typeInstructions[eventType]}

Правила введення:
- Вплітай органічно в поточний момент
- Не повідомляй гравцям що це "випадкова подія"
- Після введення додай: [RANDOM_EVENT:${eventType}:короткий_id_події]
- Максимум 2 додаткових речення до звичайної відповіді`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveLocationGroup(
  locationId: string | undefined,
  scenario: Scenario
): string | undefined {
  if (!locationId || !scenario.locationGroups) return undefined;
  const group = scenario.locationGroups.find((g) => g.locationIds.includes(locationId));
  return group?.id;
}

function getOrInitRisk(worldState: WorldState, groupId: string): LocationRiskState {
  return (
    worldState.locationRisk?.[groupId] ?? {
      currentChance: BASE_CHANCE,
      incrementRate: INITIAL_INCREMENT,
      eventCycleCount: 0,
      lastEventAt: 0,
    }
  );
}

function pickEventType(): 'positive' | 'negative' | 'neutral' | 'roll_event' {
  // roll_event 35%, negative 30%, neutral 20%, positive 15%
  const roll = Math.random() * 100;
  if (roll < 35) return 'roll_event';
  if (roll < 65) return 'negative';
  if (roll < 85) return 'neutral';
  return 'positive';
}

function noEvent(
  worldState: WorldState,
  newLocationId: string | undefined,
  scenario: Scenario
): RandomEventDecision {
  const groupId =
    resolveLocationGroup(newLocationId, scenario) ??
    worldState.currentLocationGroup ??
    'default';
  return {
    shouldFire: false,
    isTransitionEvent: false,
    eventType: null,
    currentChance: worldState.locationRisk?.[groupId]?.currentChance ?? BASE_CHANCE,
    updatedRisk: getOrInitRisk(worldState, groupId),
  };
}
