import type { Scenario, Player, WorldState, NPC } from '@/types';

/** Minimal but type-valid Player. Override fields per test as needed. */
export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Айзек',
    role: 'Журналіст',
    roleId: 'journalist',
    hp: 12,
    maxHp: 12,
    sanity: 60,
    maxSanity: 60,
    luck: 50,
    maxLuck: 50,
    skills: { 'Бібліотека': 60, 'Переконання': 45 },
    inventory: [],
    ...overrides,
  };
}

/** Minimal but type-valid WorldState. */
export function makeWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    act: 1,
    currentLocation: 'study',
    visitedLocations: ['study'],
    discoveredClues: [],
    npcRelations: {},
    summary: '',
    openThreads: [],
    playerNotes: [],
    passiveMessageCount: 0,
    totalMessageCount: 0,
    locationRisk: {},
    ...overrides,
  };
}

const npc: NPC = {
  id: 'kovalska',
  name: 'Місіс Гаррієт Ковальська',
  description: 'Бібліотекарка з пронизливим поглядом.',
  voiceStyle: 'elderly_woman',
  secrets: ['Знає про підвал'],
} as NPC;

/** Minimal but type-valid Scenario. */
export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'the-haunting',
    title: 'The Haunting',
    titleUk: 'Привид',
    era: '1920s',
    difficulty: 'beginner',
    description: 'Тестовий сценарій.',
    systemPrompt: 'Ти Кіпер.',
    railguards: [{ trigger: 'гравець виходить', response: 'опиши вулицю' }],
    criticalSuccessRules: {
      investigation: 'додаткова підказка',
      combat: 'подвійна шкода',
      persuasion: 'повна довіра',
    },
    mustHappenEvents: ['Знайти щоденник'],
    npcs: [npc],
    locations: [
      { id: 'study', name: 'Кабінет', description: 'Запорошена кімната.', clues: ['лист'] },
    ],
    rulesetId: 'coc_7e',
    ...overrides,
  };
}
