export interface WorldState {
  act: number;
  visitedLocations: string[];
  discoveredClues: string[];
  npcRelations: Record<string, 'friendly' | 'neutral' | 'hostile' | 'unknown'>;
  summary: string;
  openThreads: string[];
  playerNotes: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  uses: number; // -1 = infinite
}

export interface Player {
  name: string;
  role: string;
  roleId: string;
  hp: number;
  maxHp: number;
  sanity: number;
  maxSanity: number;
  skills: Record<string, number>;
  inventory: InventoryItem[];
}

export interface GameSession {
  id: string;
  scenario_id: string;
  name: string;
  act: number;
  status: string;
  world_state: WorldState;
  players: Player[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  player_idx: number | null;
  created_at: string;
}

export interface NPC {
  id: string;
  name: string;
  description: string;
  voiceStyle: string;
  secrets: string[];
}

export interface Location {
  id: string;
  name: string;
  description: string;
  clues: string[];
}

export interface Railguard {
  trigger: string;
  response: string;
}

export interface CriticalSuccessRules {
  investigation: string;
  combat: string;
  persuasion: string;
}

export interface StaticImage {
  id: string;
  type: string;
  prompt: string;
  label: string;
}

export interface Scenario {
  id: string;
  title: string;
  titleUk: string;
  era: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  systemPrompt: string;
  railguards: Railguard[];
  criticalSuccessRules: CriticalSuccessRules;
  mustHappenEvents: string[];
  npcs: NPC[];
  locations: Location[];
  staticImages?: StaticImage[];
}
