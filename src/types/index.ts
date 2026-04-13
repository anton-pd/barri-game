export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

// CHANGED: Added currentLocation, passiveMessageCount, activity tracking, locationRisk
export interface WorldState {
  act: number;
  currentLocation?: string;
  visitedLocations: string[];
  discoveredClues: string[];
  npcRelations: Record<string, 'friendly' | 'neutral' | 'hostile' | 'unknown'>;
  summary: string;
  openThreads: string[];
  playerNotes: string[];
  // Keeper activity tracking (phase 12)
  passiveMessageCount?: number;
  lastSkillCheckAt?: number;
  totalMessageCount?: number;
  pendingRollResult?: {
    characterIdx: number;
    skillName: string;
    skillValue: number;
    context: string;
    goodThreshold: number;
  };
  // Random event engine (phase 13)
  currentLocationGroup?: string;
  locationRisk?: Record<string, LocationRiskState>;
  activeRandomEvent?: {
    id: string;
    type: 'positive' | 'negative' | 'neutral' | 'roll_event';
    description: string;
    groupId: string;
  };
}

// CHANGED: Added equipped and broken state
export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  uses: number; // -1 = infinite, 0 = spent
  equipped?: boolean;
  broken?: boolean;
}

// CHANGED: Added generic stats for multi-ruleset support (backward compat)
export interface StatEntry {
  value: number;
  max: number | null;
}

export interface Player {
  name: string;
  role: string;
  roleId: string;
  // Legacy CoC fields — kept for backward compat
  hp: number;
  maxHp: number;
  sanity: number;
  maxSanity: number;
  luck: number;
  maxLuck: number;
  // Generic stats — new field for multi-ruleset
  stats?: Record<string, StatEntry>;
  equippedItemId?: string;
  skills: Record<string, number>;
  inventory: InventoryItem[];
  background?: string;
}

export interface GameSession {
  id: string;
  scenario_id: string;
  name: string;
  act: number;
  status: string;
  world_state: WorldState;
  players: Player[];
  user_id: string | null;
  // Campaign fields (phase 5)
  campaign_id?: string;
  session_number?: number;
  current_turn_idx?: number;
  turn_queue?: number[];
  // Keeper style (phase 12)
  keeper_style?: 'passive' | 'balanced' | 'active';
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
  soundPrompt?: string;
  ambientFile?: string; // CHANGED: path to generated ambient mp3
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

export interface ScenarioBriefing {
  setting: string;
  premise: string;
  objective: string;
}

// CHANGED: New types for ruleset system (phase 2)
export interface RulesetStatDef {
  id: string;
  label: string;
  color: string;
  hasMax: boolean;
  defaultValue: number;
}

export interface RulesetConfig {
  id: string;
  name: string;
  diceType: 'percentile' | 'stat_vs_difficulty' | 'd20';
  stats: RulesetStatDef[];
  skillCheckFormat: string;
}

// CHANGED: New types for campaign system (phase 5)
export interface NPCState {
  id: string;
  attitude: 'friendly' | 'neutral' | 'hostile' | 'unknown';
  revealedSecrets: string[];
  lastSeenSession: number;
  notes: string;
}

export interface Campaign {
  id: string;
  userId: string;
  scenarioId: string;
  name: string;
  worldState: WorldState;
  npcStates: Record<string, NPCState>;
  sessionCount: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionSummary {
  id: string;
  campaignId: string;
  sessionNumber: number;
  summary: string;
  keyEvents: string[];
  npcChanges: Record<string, Partial<NPCState>>;
  characterSnapshots: Player[];
  createdAt: Date;
}

// CHANGED: New types for API cost tracking (phase 8)
export interface APIUsageRecord {
  id: string;
  sessionId: string;
  campaignId?: string;
  userId: string;
  provider: 'anthropic' | 'gemini' | 'openai' | 'elevenlabs' | 'pollinations';
  type: 'llm' | 'tts' | 'stt' | 'image' | 'summarize';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  characters?: number;
  imageCount?: number;
  costUSD: number;
  createdAt: Date;
}

// CHANGED: New types for asset management (phase 7)
export interface ScenarioAsset {
  id: string;
  scenarioId: string;
  type: 'image' | 'ambient';
  locationId?: string;
  npcId?: string;
  tags: string[];
  url: string;
  prompt: string;
  createdAt: Date;
}

export interface CampaignAsset {
  id: string;
  campaignId: string;
  scenarioId: string;
  type: 'image';
  tags: string[];
  url: string;
  prompt: string;
  sceneId?: string;
  createdAt: Date;
}

// CHANGED: Location groups for ambient audio and risk isolation (phase 13)
export interface LocationGroup {
  id: string;
  name: string;
  locationIds: string[];
  soundPrompt?: string;
  ambientFile?: string;
}

// CHANGED: Risk state per location group (phase 13)
export interface LocationRiskState {
  currentChance: number;
  incrementRate: number;
  eventCycleCount: number;
  lastEventAt: number;
}

// CHANGED: Role preset with ruleset binding (phase 3)
export interface RolePreset {
  id: string;
  name: string;
  description: string;
  rulesetId?: string;
  scenarioId?: string;
  hp?: number;
  sanity?: number;
  luck?: number;
  stats?: Record<string, StatEntry>;
  skills: Record<string, number>;
  inventory: InventoryItem[];
  background: string;
}

export interface Scenario {
  id: string;
  title: string;
  titleUk: string;
  era: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  briefing?: ScenarioBriefing;
  systemPrompt: string;
  railguards: Railguard[];
  criticalSuccessRules: CriticalSuccessRules;
  mustHappenEvents: string[];
  npcs: NPC[];
  locations: Location[];
  staticImages?: StaticImage[];
  // CHANGED: New fields for multi-ruleset and campaign support (phases 1, 3, 13)
  rulesetId?: string;
  supportedRoles?: string[];
  defaultRoles?: string[];
  sessionConfig?: {
    minPlayers: number;
    maxPlayers: number;
    estimatedSessions: number;
    isCampaign: boolean;
    defaultKeeperStyle?: 'passive' | 'balanced' | 'active';
  };
  rolePresets?: RolePreset[];
  locationGroups?: LocationGroup[];
  eventHints?: {
    positive: string[];
    negative: string[];
    neutral: string[];
    roll_event: string[];
  };
}
