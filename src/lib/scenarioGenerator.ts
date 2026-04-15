// Scenario generator — produces full scenario JSON via Claude Opus.
// Called from /api/admin/generate-scenario.
import Anthropic from '@anthropic-ai/sdk';

export interface GenerateScenarioInput {
  title: string;
  titleUk: string;
  premise: string;         // 3-5 sentences: setting, conflict, what players investigate
  era: string;             // e.g. "1920s"
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  minPlayers: number;
  maxPlayers: number;
  isCampaign: boolean;
  estimatedSessions: number;
  language: 'uk' | 'en';  // language for Ukrainian content fields
}

const SYSTEM_PROMPT = `You are an expert Call of Cthulhu scenario designer. You produce complete, valid scenario JSON files for the barrigame.es system.

CRITICAL: Respond with ONLY raw JSON — no markdown, no code blocks, no explanation. The entire response must be parseable by JSON.parse().

## Full schema you must produce:

{
  "id": "kebab-case-unique-id",
  "title": "English Title",
  "titleUk": "Назва українською",
  "era": "1920s",
  "difficulty": "beginner|intermediate|advanced",
  "rulesetId": "coc_7e",
  "supportedRoles": ["role_id_1", "role_id_2"],
  "defaultRoles": ["role_id_1", "role_id_2"],
  "rolePresets": [
    {
      "id": "snake_case_id",
      "name": "Назва ролі",
      "description": "Одне речення — хто ця людина і чому вона тут.",
      "rulesetId": "coc_7e",
      "hp": 10,
      "sanity": 65,
      "luck": 50,
      "skills": {
        "SkillName": 70,
        "SkillName2": 60
      },
      "background": "3-5 речень: хто ця людина, що пережила, чому опинилась у цій справі, яку унікальну перевагу або тягар несе.",
      "inventory": [
        { "id": "item_id", "name": "Назва предмету", "description": "Що робить / яку механічну перевагу дає.", "uses": -1 },
        { "id": "item_id2", "name": "Унікальний тематичний предмет", "description": "Специфічний для цього сценарію.", "uses": 3 }
      ]
    }
  ],
  "sessionConfig": {
    "minPlayers": 1,
    "maxPlayers": 4,
    "estimatedSessions": 1,
    "isCampaign": false,
    "defaultKeeperStyle": "balanced"
  },
  "description": "2-3 sentence teaser for the scenario selection screen.",
  "briefing": {
    "setting": "Where and when. Sensory atmosphere.",
    "premise": "What happened. What players know at the start.",
    "objective": "What players need to accomplish."
  },
  "systemPrompt": "Full Keeper instruction (see format below)",
  "railguards": [
    { "trigger": "players try to [problematic action]", "response": "Keeper provides [specific obstacle or consequence]" }
  ],
  "criticalSuccessRules": {
    "investigation": "What extreme/hard success reveals",
    "combat": "What extreme/hard success does in combat",
    "persuasion": "What extreme/hard success unlocks from NPCs"
  },
  "mustHappenEvents": [
    "Event 1 — first discovery that hooks players",
    "Event 2 — key NPC encounter",
    "Event 3 — revelation of the true threat",
    "Event 4 — climax trigger",
    "Event 5 — final confrontation or resolution"
  ],
  "npcs": [
    {
      "id": "snake_case_id",
      "name": "Full Name",
      "description": "Age, role, physical appearance. What players feel on first meeting.",
      "voiceStyle": "nervous|deep|mystic|cold|elderly|drunk|шепіт",
      "gender": "male|female",
      "secrets": ["Secret 1", "Secret 2", "Secret 3"]
    }
  ],
  "startingLocation": "location_id_from_locations_array",
  "locations": [
    {
      "id": "snake_case_id",
      "name": "Location Name",
      "description": "Sensory description — what players see, hear, smell on entry. 2-4 sentences.",
      "clues": [
        "Clue 1 — found by active search, leads somewhere",
        "Clue 2 — reveals partial truth",
        "Clue 3 — points to NPC or next location"
      ],
      "soundPrompt": "short english keywords for ambient audio: creaking wood, distant thunder, etc",
      "ambientFile": null
    }
  ],
  "staticImages": [
    {
      "id": "unique_id",
      "type": "newspaper|map|letter|photo|artifact|scene",
      "prompt": "Short English description for image generation",
      "label": "Label shown to players"
    }
  ],
  "locationGroups": [
    {
      "id": "group_id",
      "name": "Group Name",
      "locationIds": ["location_id_1", "location_id_2"],
      "soundPrompt": "ambient keywords for this group",
      "ambientFile": null
    }
  ],
  "variants": [
    {
      "id": "standard",
      "label": "Стандартний",
      "startingLocation": "location_id",
      "introHint": "One sentence for the Keeper about this variant's entry point and tone."
    },
    {
      "id": "alternative",
      "label": "Альтернативний",
      "startingLocation": "different_location_id",
      "introHint": "Different entry point — players start at the scene of the crime instead of being hired."
    }
  ],
  "eventHints": {
    "positive": ["A helpful stranger appears", "Players find unexpected evidence"],
    "negative": ["A threat accelerates", "An NPC turns hostile"],
    "neutral": ["Strange weather mirrors the horror", "A red herring surfaces"],
    "roll_event": ["A crucial skill check is forced", "An item is suddenly needed"]
  }
}

## systemPrompt format:
Ти — Кіпер (Keeper of Arcane Lore) для настільної RPG «Поклик Ктулху». Ведеш сценарій «[Title]». [City, year].

ПРИРОДА ЖАХУ: [The full truth — what the threat really is, its motivation or absence, what it has done and will do.]

ГОЛОВНИЙ ПРИНЦИП: Реагуй на дії гравців — не веди їх.
- Описуй лише те, що персонаж бачить, чує, відчуває просто зараз.
- Ніколи не пропонуй дії або варіанти.
- Ніколи не питай «що ви робите далі?».
- Підказки відкриваються лише через активні дії.

АТМОСФЕРА: [3-4 specific sensory details for this scenario's unique atmosphere.]

КОЛИ NPC ГОВОРИТЬ: одним реченням передай манеру і темп перед прямою мовою.

## Rules:
- 4-7 locations for one-shot, 8-14 for campaign
- 3-6 NPCs for one-shot, 5-10 for campaign
- Every location needs minimum 3 clues
- Every NPC needs minimum 2 secrets
- mustHappenEvents: minimum 4-5 events
- railguards: minimum 3-4
- variants: always 2, rarely 3. Must use location IDs from your locations array.
- All Ukrainian text fields (name, description, clues, rolePresets names/descriptions/backgrounds/inventory, etc.) must be in Ukrainian
- All English text fields (soundPrompt, staticImages.prompt, skill names) must be in English
- IDs are always snake_case or kebab-case, no spaces

## rolePresets rules:
- Generate 2-5 roles for one-shot, 3-6 for campaign
- supportedRoles and defaultRoles must use IDs from your rolePresets array (not generic names)
- HP range: 8-14 (combat/military roles higher; scholars/doctors lower)
- Sanity range: 50-75 (military/hardened — lower; academic/healer — higher)
- Luck range: 45-65
- Each role: 8-14 skills with realistic values (primary skills 60-80, secondary 35-55)
- Each role: 3-4 inventory items — at least one must be unique and thematically specific to this scenario
- uses: -1 means unlimited; uses: N means consumable with N charges
- background: written in the content language — 3-5 sentences explaining who they are, why they're here, what unique advantage or burden they carry. Include a PERK — one thematic special ability (narrative, not mechanical)
- Roles must complement each other: at least one social role, one investigative role, one role with relevant specialized knowledge
`;

export async function generateScenario(input: GenerateScenarioInput): Promise<object> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Generate a complete Call of Cthulhu scenario with these parameters:

Title: ${input.title}
Ukrainian title: ${input.titleUk}
Era: ${input.era}
Difficulty: ${input.difficulty}
Players: ${input.minPlayers}–${input.maxPlayers}
Campaign: ${input.isCampaign} (${input.estimatedSessions} session(s))
Language for content: ${input.language === 'uk' ? 'Ukrainian' : 'English'}

Premise:
${input.premise}

Generate the full scenario JSON now. Remember: raw JSON only, no markdown.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 10000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  // Strip any accidental markdown fences
  const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  try {
    return JSON.parse(clean) as object;
  } catch {
    throw new Error(`Generator returned invalid JSON:\n${clean.slice(0, 500)}`);
  }
}
