/**
 * ANT-140 — Model matrix replay eval for the game engine.
 *
 * Replays real session state + history against a matrix of models and scores:
 *  - tag-protocol compliance (required / forbidden / malformed / fallback-rescued)
 *  - language purity (Cyrillic share of the narrative text)
 *  - latency (TTFT for streaming providers, total wall time)
 *  - token usage + estimated cost per turn
 *  - optional blind LLM-judge score (--judge)
 *
 * Prompt assembly deliberately mirrors src/app/api/ai/route.ts so every model
 * sees exactly what production would send it.
 *
 * Usage (from repo root, keys come from /opt/apps/.env):
 *   npx tsx scripts/eval/run-eval.ts [--models sonnet,haiku,flash,flash-lite] [--probes all] [--judge]
 */
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPromptBlocks } from '@/lib/prompts';
import type { Player, Scenario, WorldState } from '@/types';

// ── Config ───────────────────────────────────────────────────────────────────

const FIXTURES = path.join(__dirname, 'fixtures');
const SCENARIOS_DIR = '/opt/apps/shared_data/scenarios';
const MAX_TOKENS = 1200; // mirrors route.ts main-turn cap (ANT-129)
const HISTORY_WINDOW = 30; // mirrors getLastNMessages(sessionId, 30)

interface ModelArm {
  key: string;
  provider: 'anthropic' | 'gemini' | 'deepseek';
  modelId: string;
  // USD per 1M tokens (2026-06; Anthropic from claude-api skill, Gemini from
  // ai.google.dev, DeepSeek from api-docs.deepseek.com — cache-miss rate)
  inPer1M: number;
  outPer1M: number;
  cacheHitPer1M?: number;
  baseUrl?: string;
  apiKeyEnv?: string;
  orProvider?: string;
}

const ARMS: ModelArm[] = [
  { key: 'sonnet', provider: 'anthropic', modelId: 'claude-sonnet-4-6', inPer1M: 3.0, outPer1M: 15.0, cacheHitPer1M: 0.3 },
  { key: 'haiku', provider: 'anthropic', modelId: 'claude-haiku-4-5', inPer1M: 1.0, outPer1M: 5.0, cacheHitPer1M: 0.1 },
  { key: 'flash', provider: 'gemini', modelId: 'gemini-2.5-flash', inPer1M: 0.3, outPer1M: 2.5, cacheHitPer1M: 0.03 },
  { key: 'flash-lite', provider: 'gemini', modelId: 'gemini-2.5-flash-lite', inPer1M: 0.1, outPer1M: 0.4 },
  { key: 'ds-flash', provider: 'deepseek', modelId: 'deepseek-v4-flash', inPer1M: 0.14, outPer1M: 0.28, cacheHitPer1M: 0.0028 },
  // OpenRouter → Cloudflare-hosted DeepSeek V4 Flash (TTFT winner in bench-openrouter)
  {
    key: 'or-cf', provider: 'deepseek', modelId: 'deepseek/deepseek-v4-flash',
    inPer1M: 0.1, outPer1M: 0.2, cacheHitPer1M: 0.04,
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', orProvider: 'Cloudflare',
  },
];

// ── Fixtures ─────────────────────────────────────────────────────────────────

interface SessionFixture {
  id: string;
  scenario_id: string;
  language: 'uk' | 'en';
  keeper_style: string;
  world_state: WorldState;
  players: Player[];
}
interface MessageRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  player_idx: number | null;
}

function loadSession(prefix: string): { session: SessionFixture; messages: MessageRow[] } {
  const session = JSON.parse(fs.readFileSync(path.join(FIXTURES, `session_${prefix}.json`), 'utf8'));
  const messages = JSON.parse(fs.readFileSync(path.join(FIXTURES, `messages_${prefix}.json`), 'utf8'));
  return { session, messages };
}

function loadScenario(id: string): Scenario {
  return JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, `${id}.json`), 'utf8'));
}

// ── Probes ───────────────────────────────────────────────────────────────────

interface Probe {
  id: string;
  sessionPrefix: string;
  playerIdx: number;
  message: string;
  // World-state override applied before prompt build (e.g. synthetic pending roll).
  worldStatePatch?: Partial<WorldState>;
  // Extra prompt sections, mirroring route.ts injection points.
  keeperActivitySection?: string;
  imageRequestInstruction?: string;
  requiredTags: RegExp[];
  requiredLabels: string[];
  forbiddenTags: RegExp[];
  forbiddenLabels: string[];
}

const IMAGE_INSTRUCTION_UK =
  'Гравець прямо просить щось ПОКАЗАТИ. У цій відповіді ОБОВʼЯЗКОВО додай рівно один тег [IMAGE:type:short English description] для найрелевантнішого обʼєкта або сцени, яку він просить побачити. Обирай type змістовно: map / letter / photo / artifact / scene / newspaper. Опис у тегі має бути коротким, конкретним і англійською.';

function awaitingRollSection(idx: number, skill: string, threshold: number): string {
  // Mirrors buildKeeperActivitySection() pending-roll branch in route.ts.
  return `\n\n## ОЧІКУВАНИЙ КИДОК
Гравець ${idx} ще не повідомив результат кидка "${skill}".
Якщо повідомлення містить число — це результат кидка.
Порівняй з порогом ${threshold}: ≤ поріг → успіх, > поріг → провал.
Після результату — зніми його тегом [CLEAR_PENDING_ROLL].`;
}

const RX = {
  setPendingRoll: /\[SET_PENDING_ROLL:[^\]]+\]/,
  clearPendingRoll: /\[CLEAR_PENDING_ROLL\]/,
  image: /\[IMAGE:\w+:[^\]]+\]/,
  item: /\[ITEM:\d+:[^:\]]+:.+?:-?\d+\]/,
  npc: /\[NPC:[^\]]+\][\s\S]+?\[\/NPC\]/,
  delta: /\[DELTA:\{[\s\S]*?\}\]/,
};

function buildProbes(): Probe[] {
  return [
    {
      id: 'haunting/roll_request',
      sessionPrefix: 'ef137c56',
      playerIdx: 0,
      message: 'Я обережно обшукую ґанок і двері — шукаю сліди злому чи приховані позначки.',
      requiredTags: [RX.setPendingRoll],
      requiredLabels: ['SET_PENDING_ROLL'],
      forbiddenTags: [RX.image],
      forbiddenLabels: ['IMAGE'],
    },
    {
      id: 'haunting/explicit_image',
      sessionPrefix: 'ef137c56',
      playerIdx: 0,
      message: 'Покажи мені, як виглядає цей будинок зовні.',
      imageRequestInstruction: IMAGE_INSTRUCTION_UK,
      requiredTags: [RX.image],
      requiredLabels: ['IMAGE'],
      forbiddenTags: [],
      forbiddenLabels: [],
    },
    {
      id: 'haunting/dice_result',
      sessionPrefix: 'ef137c56',
      playerIdx: 0,
      message: '27',
      worldStatePatch: {
        pendingRollResult: {
          characterIdx: 0,
          skillName: 'Listen',
          skillValue: 60,
          goodThreshold: 60,
          context: 'Прислухатися до звуків усередині будинку',
        },
      },
      keeperActivitySection: awaitingRollSection(0, 'Listen', 60),
      requiredTags: [RX.clearPendingRoll],
      requiredLabels: ['CLEAR_PENDING_ROLL'],
      forbiddenTags: [RX.setPendingRoll],
      forbiddenLabels: ['SET_PENDING_ROLL'],
    },
    {
      id: 'haunting/item_pickup',
      sessionPrefix: 'ef137c56',
      playerIdx: 0,
      message: 'Я піднімаю з ґанку стару газету і забираю її собі — може, згодиться.',
      requiredTags: [RX.item],
      requiredLabels: ['ITEM'],
      forbiddenTags: [RX.image],
      forbiddenLabels: ['IMAGE'],
    },
    {
      id: 'haunting/neutral_continue',
      sessionPrefix: 'ef137c56',
      playerIdx: 0,
      message: 'Добре, продовжуй.',
      requiredTags: [],
      requiredLabels: [],
      forbiddenTags: [RX.image, RX.item, RX.delta],
      forbiddenLabels: ['IMAGE', 'ITEM', 'DELTA'],
    },
    {
      id: 'telegram/npc_talk',
      sessionPrefix: '1ec276ae',
      playerIdx: 0,
      message: 'Я звертаюся до Джима: «Що ти знаєш про останню телеграму з цієї станції?»',
      requiredTags: [RX.npc],
      requiredLabels: ['NPC dialogue'],
      forbiddenTags: [RX.image],
      forbiddenLabels: ['IMAGE'],
    },
    {
      id: 'telegram/roll_request_deep',
      sessionPrefix: '1ec276ae',
      playerIdx: 0,
      message: 'Я уважно оглядаю телеграфний апарат — шукаю сліди стороннього втручання в механізм.',
      requiredTags: [RX.setPendingRoll],
      requiredLabels: ['SET_PENDING_ROLL'],
      forbiddenTags: [RX.image],
      forbiddenLabels: ['IMAGE'],
    },
    {
      id: 'telegram/neutral_deep',
      sessionPrefix: '1ec276ae',
      playerIdx: 0,
      message: 'Зрозуміло. Що далі?',
      requiredTags: [],
      requiredLabels: [],
      forbiddenTags: [RX.image, RX.item, RX.delta],
      forbiddenLabels: ['IMAGE', 'ITEM', 'DELTA'],
    },
  ];
}

// ── Prompt assembly (mirrors route.ts) ───────────────────────────────────────

interface BuiltPrompt {
  ruleset: string;
  static: string;
  dynamic: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  userContent: string;
}

function buildPrompt(probe: Probe): BuiltPrompt {
  const { session, messages } = loadSession(probe.sessionPrefix);
  const scenario = loadScenario(session.scenario_id);
  const worldState: WorldState = { ...session.world_state, ...(probe.worldStatePatch ?? {}) };

  const blocks = buildSystemPromptBlocks(scenario, worldState, session.players, {
    keeperActivitySection: probe.keeperActivitySection ?? '',
    imageRequestInstruction: probe.imageRequestInstruction ?? '',
    language: session.language ?? 'uk',
  });

  const recent = messages.slice(-HISTORY_WINDOW);
  const history = recent.map((m) => {
    if (m.role === 'user' && m.player_idx !== null && session.players[m.player_idx]) {
      return { role: 'user' as const, content: `[${session.players[m.player_idx].name}]: ${m.content}` };
    }
    return { role: m.role, content: m.content };
  });

  const playerName = session.players[probe.playerIdx]?.name ?? 'Гравець';
  const userContent = `[${playerName}]: ${probe.message}`;

  return { ruleset: blocks.ruleset, static: blocks.static, dynamic: blocks.dynamic, history, userContent };
}

// ── Model callers ────────────────────────────────────────────────────────────

interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  ttftMs: number | null;
  totalMs: number;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callAnthropic(modelId: string, p: BuiltPrompt): Promise<CallResult> {
  const start = Date.now();
  let ttftMs: number | null = null;
  const stream = anthropic.messages.stream(
    {
      model: modelId,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: p.ruleset, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: p.static, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: p.dynamic },
      ],
      messages: [...p.history, { role: 'user', content: p.userContent }],
    },
    { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } }
  );
  let text = '';
  for await (const ev of stream) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
      if (ttftMs === null) ttftMs = Date.now() - start;
      text += ev.delta.text;
    }
  }
  const final = await stream.finalMessage();
  return {
    text,
    inputTokens: final.usage?.input_tokens ?? 0,
    outputTokens: final.usage?.output_tokens ?? 0,
    cacheReadTokens: (final.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0,
    ttftMs,
    totalMs: Date.now() - start,
  };
}

async function callGemini(modelId: string, p: BuiltPrompt): Promise<CallResult> {
  // Mirrors route.ts geminiCacheEnabled=true: ruleset+static as systemInstruction,
  // dynamic as a [СТАН СЕСІЇ] turn at the tail (ANT-126), thinking disabled.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const contents = [
    ...p.history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: `[СТАН СЕСІЇ]\n${p.dynamic}` }] },
    { role: 'model', parts: [{ text: 'Зрозумів.' }] },
    { role: 'user', parts: [{ text: p.userContent }] },
  ];
  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${p.ruleset}\n\n${p.static}` }] },
        contents,
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 1.0, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${modelId}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number };
  };
  const totalMs = Date.now() - start;
  return {
    text: data.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') ?? '',
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    cacheReadTokens: data.usageMetadata?.cachedContentTokenCount ?? 0,
    ttftMs: null, // non-streaming in prod path
    totalMs,
  };
}

async function callDeepSeek(arm: ModelArm, p: BuiltPrompt): Promise<CallResult> {
  // OpenAI-compatible API, streaming for TTFT. Prompt structure mirrors the
  // Gemini split-tail mode (ANT-126): stable system prefix, dynamic state as a
  // tail turn — DeepSeek implicit prefix caching rewards exactly this shape.
  // Also serves OpenRouter arms (baseUrl/apiKeyEnv/orProvider overrides).
  const keyEnv = arm.apiKeyEnv ?? 'DEEPSEEK_API_KEY';
  const apiKey = process.env[keyEnv];
  if (!apiKey) throw new Error(keyEnv + ' not set');
  const modelId = arm.modelId;
  const messages = [
    { role: 'system', content: `${p.ruleset}\n\n${p.static}` },
    ...p.history,
    { role: 'user', content: `[СТАН СЕСІЇ]\n${p.dynamic}` },
    { role: 'assistant', content: 'Зрозумів.' },
    { role: 'user', content: p.userContent },
  ];
  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: 1.0,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (arm.orProvider) body.provider = { order: [arm.orProvider], allow_fallbacks: false };
  const start = Date.now();
  const res = await fetch(arm.baseUrl ?? 'https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`DeepSeek ${modelId}: ${res.status} ${(await res.text()).slice(0, 200)}`);

  let text = '';
  let ttftMs: number | null = null;
  let usage: {
    prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  } = {};
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          if (ttftMs === null) ttftMs = Date.now() - start;
          text += delta;
        }
        if (chunk.usage) usage = chunk.usage;
      } catch { /* partial line */ }
    }
  }
  return {
    text,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    cacheReadTokens: usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0,
    ttftMs,
    totalMs: Date.now() - start,
  };
}

// ── Tool-calling mode (ANT-141) ──────────────────────────────────────────────
// Hypothesis: state mutations as tool calls are more reliable than inline DSL
// tags, especially in deep history where inline instructions "wash out".
// [NPC:] stays inline (positional presentation markup).

interface GameTool {
  name: string;
  description: string;
  schema: Record<string, unknown>; // JSON Schema (object)
}

const GAME_TOOLS: GameTool[] = [
  {
    name: 'request_dice_roll',
    description:
      'Запроси у гравця перевірку навички (d100, roll-under). Викликай, коли дія ризикована і її результат невизначений. good_threshold = значення навички для звичайного успіху.',
    schema: {
      type: 'object',
      properties: {
        character_idx: { type: 'integer', description: 'Індекс гравця (0-based)' },
        skill_name: { type: 'string', description: 'Назва навички з листа персонажа' },
        skill_value: { type: 'integer', description: 'Значення навички з листа персонажа' },
        good_threshold: { type: 'integer', description: 'Поріг успіху (зазвичай = skill_value)' },
        context: { type: 'string', description: 'Що саме перевіряється, коротко' },
      },
      required: ['character_idx', 'skill_name', 'skill_value', 'good_threshold', 'context'],
    },
  },
  {
    name: 'clear_pending_roll',
    description: 'Зніми очікуваний кидок після того, як гравець повідомив число-результат.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'show_image',
    description:
      'Покажи гравцеві зображення. Викликай ТІЛЬКИ коли гравець прямо просить щось побачити/показати.',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['map', 'letter', 'photo', 'artifact', 'scene', 'newspaper'] },
        description_en: { type: 'string', description: 'Short specific English description' },
      },
      required: ['type', 'description_en'],
    },
  },
  {
    name: 'grant_item',
    description: 'Додай предмет в інвентар гравця, коли він бере щось у фікшні.',
    schema: {
      type: 'object',
      properties: {
        character_idx: { type: 'integer' },
        name: { type: 'string', description: 'Людська назва предмета українською' },
        description: { type: 'string' },
        uses: { type: 'integer', description: 'Кількість використань, -1 = безліміт' },
      },
      required: ['character_idx', 'name', 'description', 'uses'],
    },
  },
  {
    name: 'apply_stat_change',
    description: 'Зміни HP/SAN/LUCK гравця після наслідків у фікшні (поранення, жах, удача).',
    schema: {
      type: 'object',
      properties: {
        character_idx: { type: 'integer' },
        hp: { type: 'integer', description: 'Дельта HP, може бути відʼємною' },
        sanity: { type: 'integer', description: 'Дельта SAN' },
        luck: { type: 'integer', description: 'Дельта LUCK' },
      },
      required: ['character_idx'],
    },
  },
  {
    name: 'move_to_location',
    description: 'Перемісти гру в іншу локацію, коли партія фактично переходить туди.',
    schema: {
      type: 'object',
      properties: { location_id: { type: 'string', description: 'id локації зі сценарію' } },
      required: ['location_id'],
    },
  },
];

const TOOLS_MODE_SECTION = `

## РЕЖИМ ІНСТРУМЕНТІВ
У цій сесії механічні теги ВИМКНЕНО. Замість тегів [SET_PENDING_ROLL], [CLEAR_PENDING_ROLL], [IMAGE:], [ITEM:], [USE_ITEM:], [DELTA:], [LOCATION:], [NEW_LOCATION:] використовуй відповідні інструменти (tools): request_dice_roll, clear_pending_roll, show_image, grant_item, apply_stat_change, move_to_location.
Виклик інструмента йде ПОРЯД з повноцінною художньою відповіддю — ніколи не замінюй наратив викликом. Теги [NPC:Імʼя]...[/NPC] залишаються в тексті як раніше.`;

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

// Per-probe expectations in tools mode. npc_talk keeps its inline [NPC:] check.
const TOOL_EXPECTATIONS: Record<string, { required?: string; forbidden: string[] }> = {
  'haunting/roll_request': { required: 'request_dice_roll', forbidden: ['show_image'] },
  'haunting/explicit_image': { required: 'show_image', forbidden: [] },
  'haunting/dice_result': { required: 'clear_pending_roll', forbidden: ['request_dice_roll'] },
  'haunting/item_pickup': { required: 'grant_item', forbidden: ['show_image'] },
  'haunting/neutral_continue': { forbidden: ['show_image', 'grant_item', 'apply_stat_change'] },
  'telegram/npc_talk': { forbidden: ['show_image'] },
  'telegram/roll_request_deep': { required: 'request_dice_roll', forbidden: ['show_image'] },
  'telegram/neutral_deep': { forbidden: ['show_image', 'grant_item', 'apply_stat_change'] },
};

async function callAnthropicTools(modelId: string, p: BuiltPrompt): Promise<CallResult & { toolCalls: ToolCall[] }> {
  const start = Date.now();
  let ttftMs: number | null = null;
  const stream = anthropic.messages.stream(
    {
      model: modelId,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: p.ruleset, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: p.static + TOOLS_MODE_SECTION, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: p.dynamic },
      ],
      tools: GAME_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.schema as Anthropic.Tool.InputSchema,
      })),
      messages: [...p.history, { role: 'user', content: p.userContent }],
    },
    { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } }
  );
  let text = '';
  for await (const ev of stream) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
      if (ttftMs === null) ttftMs = Date.now() - start;
      text += ev.delta.text;
    }
  }
  const final = await stream.finalMessage();
  const toolCalls: ToolCall[] = final.content
    .filter((b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use')
    .map((b) => ({ name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));
  return {
    text,
    toolCalls,
    inputTokens: final.usage?.input_tokens ?? 0,
    outputTokens: final.usage?.output_tokens ?? 0,
    cacheReadTokens: (final.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0,
    ttftMs,
    totalMs: Date.now() - start,
  };
}

async function callGeminiTools(modelId: string, p: BuiltPrompt): Promise<CallResult & { toolCalls: ToolCall[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const contents = [
    ...p.history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: `[СТАН СЕСІЇ]\n${p.dynamic}` }] },
    { role: 'model', parts: [{ text: 'Зрозумів.' }] },
    { role: 'user', parts: [{ text: p.userContent }] },
  ];
  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${p.ruleset}\n\n${p.static}${TOOLS_MODE_SECTION}` }] },
        contents,
        tools: [{ functionDeclarations: GAME_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.schema })) }],
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 1.0, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${modelId}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args: Record<string, unknown> } }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number };
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return {
    text: parts.map((x) => x.text ?? '').join(''),
    toolCalls: parts.filter((x) => x.functionCall).map((x) => ({ name: x.functionCall!.name, args: x.functionCall!.args ?? {} })),
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    cacheReadTokens: data.usageMetadata?.cachedContentTokenCount ?? 0,
    ttftMs: null,
    totalMs: Date.now() - start,
  };
}

async function callDeepSeekTools(modelId: string, p: BuiltPrompt): Promise<CallResult & { toolCalls: ToolCall[] }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');
  const messages = [
    { role: 'system', content: `${p.ruleset}\n\n${p.static}${TOOLS_MODE_SECTION}` },
    ...p.history,
    { role: 'user', content: `[СТАН СЕСІЇ]\n${p.dynamic}` },
    { role: 'assistant', content: 'Зрозумів.' },
    { role: 'user', content: p.userContent },
  ];
  const start = Date.now();
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: 1.0,
      tools: GAME_TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.schema } })),
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${modelId}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string; tool_calls?: { function: { name: string; arguments: string } }[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number };
  };
  const msg = data.choices?.[0]?.message;
  const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map((tc) => {
    try {
      return { name: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') };
    } catch {
      return { name: tc.function.name, args: { __malformed_json: tc.function.arguments?.slice(0, 80) } };
    }
  });
  return {
    text: msg?.content ?? '',
    toolCalls,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    cacheReadTokens: data.usage?.prompt_cache_hit_tokens ?? 0,
    ttftMs: null,
    totalMs: Date.now() - start,
  };
}

function scoreToolCalls(
  probe: Probe,
  text: string,
  toolCalls: ToolCall[]
): { required: string[]; forbidden: string[]; argErrors: string[]; tagLeakage: string[] } {
  const exp = TOOL_EXPECTATIONS[probe.id] ?? { forbidden: [] };
  const required: string[] = [];
  if (exp.required) {
    const hit = toolCalls.find((c) => c.name === exp.required);
    required.push(`${exp.required}:${hit ? 'PASS' : 'FAIL'}`);
  }
  if (probe.id === 'telegram/npc_talk') {
    required.push(`NPC dialogue:${RX.npc.test(text) ? 'PASS' : 'FAIL'}`);
  }
  const forbidden = exp.forbidden.map(
    (name) => `${name}:${toolCalls.some((c) => c.name === name) ? 'FIRED' : 'ok'}`
  );
  // Schema-required args missing (API usually enforces, but Gemini can be lax).
  const argErrors: string[] = [];
  for (const call of toolCalls) {
    const tool = GAME_TOOLS.find((t) => t.name === call.name);
    if (!tool) { argErrors.push(`unknown tool: ${call.name}`); continue; }
    if (call.args.__malformed_json) { argErrors.push(`${call.name}: malformed JSON args`); continue; }
    for (const req of (tool.schema.required as string[]) ?? []) {
      if (call.args[req] === undefined) argErrors.push(`${call.name}: missing ${req}`);
    }
  }
  // Inline mechanical tags leaking despite tools mode ([NPC:] is allowed).
  const tagLeakage = [...text.matchAll(LOOSE_TAG)].map((m) => m[0].slice(0, 40));
  return { required, forbidden, argErrors, tagLeakage };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

// Loose pattern: anything that *looks* like one of our tags. Strict parse uses RX.
const LOOSE_TAG = /\[(SET_PENDING_ROLL|CLEAR_PENDING_ROLL|IMAGE|ITEM|USE_ITEM|REMOVE_ITEM|EQUIP|BREAK_ITEM|DELTA|LOCATION|NEW_LOCATION|NPC_UPDATE|CASE_PLAN|RANDOM_EVENT|COMPLETE_SESSION|FINISH_EVENING)\b[^\]]*\]?/g;
const STRICT: Record<string, RegExp> = {
  SET_PENDING_ROLL: /^\[SET_PENDING_ROLL:\d+:[^:\]]+:\d+:\d+:[^\]]*\]$/,
  CLEAR_PENDING_ROLL: /^\[CLEAR_PENDING_ROLL\]$/,
  IMAGE: /^\[IMAGE:\w+:[^\]]+\]$/,
  ITEM: /^\[ITEM:\d+:[^:\]]+:.+:-?\d+\]$/,
  USE_ITEM: /^\[USE_ITEM:\d+:[^\]]+\]$/,
  REMOVE_ITEM: /^\[REMOVE_ITEM:\d+:[^\]]+\]$/,
  EQUIP: /^\[EQUIP:\d+:[^\]]+\]$/,
  BREAK_ITEM: /^\[BREAK_ITEM:\d+:[^\]]+\]$/,
  DELTA: /^\[DELTA:\{[\s\S]*\}\]$/,
  LOCATION: /^\[LOCATION:[\w-]+\]$/,
  NEW_LOCATION: /^\[NEW_LOCATION:[\w-]+:[^:]+:[^\]]+\]$/,
  NPC_UPDATE: /^\[NPC_UPDATE:[^\]]+\]$/,
  CASE_PLAN: /^\[CASE_PLAN:[^\]]*\]$/,
  RANDOM_EVENT: /^\[RANDOM_EVENT:[^\]]+\]$/,
  COMPLETE_SESSION: /^\[COMPLETE_SESSION\]$/,
  FINISH_EVENING: /^\[FINISH_EVENING\]$/,
};

// Mirrors the ANT-119 auto-inject fallback in route.ts — a roll request the
// engine would rescue even though the tag is missing.
const FALLBACK_ROLL =
  /(?:Кинь|Кидай)\s+\**([\wА-ЯҐЄІЇа-яґєії'’\s\/]+?)\**\s*\([^)]*?(?:1к100|1d100)[^)]*?(\d{1,3})[^)]*\)/i;

interface Score {
  requiredHit: boolean[];
  forbiddenFired: boolean[];
  malformedTags: string[];
  rescuedByFallback: boolean;
  cyrillicShare: number;
  chars: number;
}

function scoreOutput(probe: Probe, text: string): Score {
  const requiredHit = probe.requiredTags.map((r) => r.test(text));
  const forbiddenFired = probe.forbiddenTags.map((r) => r.test(text));

  const malformedTags: string[] = [];
  for (const m of text.matchAll(LOOSE_TAG)) {
    const name = m[1];
    const candidate = m[0].endsWith(']') ? m[0] : `${m[0]}]`;
    if (STRICT[name] && !STRICT[name].test(candidate)) malformedTags.push(m[0].slice(0, 60));
  }

  const rescuedByFallback =
    probe.requiredLabels.includes('SET_PENDING_ROLL') && !requiredHit[0] && FALLBACK_ROLL.test(text);

  // Language purity over narrative text only (tags stripped).
  const narrative = text.replace(LOOSE_TAG, '').replace(/\[\/?NPC[^\]]*\]/g, '');
  const letters = narrative.match(/\p{L}/gu) ?? [];
  const cyr = narrative.match(/[Ѐ-ӿ]/gu) ?? [];
  const cyrillicShare = letters.length ? cyr.length / letters.length : 1;

  return { requiredHit, forbiddenFired, malformedTags, rescuedByFallback, cyrillicShare, chars: text.length };
}

// ── Judge (blind, rubric 1–5) ────────────────────────────────────────────────

async function judge(probe: Probe, text: string): Promise<{ style: number; fluency: number; coherence: number }> {
  const p = buildPrompt(probe);
  const lastTurns = p.history.slice(-6).map((m) => `${m.role}: ${m.content.slice(0, 400)}`).join('\n');
  const narrative = text.replace(LOOSE_TAG, '').replace(/\[\/?NPC[^\]]*\]/g, ' ');
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system:
      'You are a strict evaluator of an AI Keeper (game master) reply for a Ukrainian-language Call of Cthulhu session. Score the CANDIDATE REPLY on three axes, each 1-5: "style" (noir keeper tone, atmosphere, shows-not-tells), "fluency" (natural Ukrainian, no language drift or calques), "coherence" (consistent with the recent transcript, no contradictions or invented state). Respond with ONLY a JSON object {"style":n,"fluency":n,"coherence":n}.',
    messages: [
      {
        role: 'user',
        content: `RECENT TRANSCRIPT:\n${lastTurns}\n\nPLAYER MESSAGE:\n${p.userContent}\n\nCANDIDATE REPLY:\n${narrative.slice(0, 2500)}`,
      },
    ],
  });
  const out = res.content.find((b) => b.type === 'text');
  try {
    const j = JSON.parse((out && 'text' in out ? out.text : '{}').match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return { style: j.style ?? 0, fluency: j.fluency ?? 0, coherence: j.coherence ?? 0 };
  } catch {
    return { style: 0, fluency: 0, coherence: 0 };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const modelsArg = args.includes('--models') ? args[args.indexOf('--models') + 1] : 'sonnet,haiku,flash,flash-lite';
  const withJudge = args.includes('--judge');
  const toolsMode = args.includes('--tools');
  const probesArg = args.includes('--probes') ? args[args.indexOf('--probes') + 1] : '';
  const arms = ARMS.filter((a) => modelsArg.split(',').includes(a.key));
  const probes = buildProbes().filter((p) => !probesArg || p.id.includes(probesArg));

  console.log(`Eval${toolsMode ? ' [TOOLS MODE]' : ''}: ${arms.length} models × ${probes.length} probes${withJudge ? ' + judge' : ''}\n`);

  const rows: Record<string, unknown>[] = [];
  for (const probe of probes) {
    const prompt = buildPrompt(probe);
    for (const arm of arms) {
      process.stdout.write(`${probe.id} × ${arm.key} ... `);
      try {
        const call = toolsMode
          ? arm.provider === 'anthropic'
            ? await callAnthropicTools(arm.modelId, prompt)
            : arm.provider === 'deepseek'
              ? await callDeepSeekTools(arm.modelId, prompt)
              : await callGeminiTools(arm.modelId, prompt)
          : arm.provider === 'anthropic'
            ? await callAnthropic(arm.modelId, prompt)
            : arm.provider === 'deepseek'
              ? await callDeepSeek(arm, prompt)
              : await callGemini(arm.modelId, prompt);
        const toolScore = toolsMode
          ? scoreToolCalls(probe, call.text, (call as CallResult & { toolCalls: ToolCall[] }).toolCalls)
          : null;
        const score = scoreOutput(probe, call.text);
        // Cache-aware cost: cacheReadTokens billed at the hit rate when known.
        // (For DeepSeek prompt_tokens includes hits; for Anthropic input_tokens
        // excludes them — subtract only when the provider folds hits into input.)
        const missTokens =
          arm.provider === 'deepseek' || arm.provider === 'gemini'
            ? Math.max(0, call.inputTokens - call.cacheReadTokens)
            : call.inputTokens;
        const costUsd =
          (missTokens / 1e6) * arm.inPer1M +
          (call.cacheReadTokens / 1e6) * (arm.cacheHitPer1M ?? arm.inPer1M) +
          (call.outputTokens / 1e6) * arm.outPer1M;
        const judgeScores = withJudge ? await judge(probe, call.text) : null;
        rows.push({
          probe: probe.id, model: arm.key, mode: toolsMode ? 'tools' : 'tags',
          required: toolsMode
            ? toolScore!.required
            : probe.requiredLabels.map((l, i) => `${l}:${score.requiredHit[i] ? 'PASS' : score.rescuedByFallback ? 'RESCUED' : 'FAIL'}`),
          forbidden: toolsMode
            ? toolScore!.forbidden
            : probe.forbiddenLabels.map((l, i) => `${l}:${score.forbiddenFired[i] ? 'FIRED' : 'ok'}`),
          malformed: toolsMode ? toolScore!.argErrors : score.malformedTags,
          tagLeakage: toolsMode ? toolScore!.tagLeakage : undefined,
          toolCalls: toolsMode ? (call as CallResult & { toolCalls: ToolCall[] }).toolCalls : undefined,
          cyrillicShare: +score.cyrillicShare.toFixed(3), chars: score.chars,
          ttftMs: call.ttftMs, totalMs: call.totalMs,
          inputTokens: call.inputTokens, outputTokens: call.outputTokens, cacheReadTokens: call.cacheReadTokens,
          costUsd: +costUsd.toFixed(6), judge: judgeScores, text: call.text,
        });
        console.log(`ok (${call.totalMs}ms, $${costUsd.toFixed(5)})`);
      } catch (e) {
        rows.push({ probe: probe.id, model: arm.key, error: String(e).slice(0, 300) });
        console.log(`ERROR: ${String(e).slice(0, 120)}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const outFile = path.join(__dirname, `results_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
  console.log(`\nSaved: ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
