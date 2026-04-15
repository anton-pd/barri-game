// CHANGED: Split static block into ruleset + scenario parts for better caching.
// Added location/NPC filtering to reduce tokens per request.
// Added Keeper activity and event instruction injection.
import type { Scenario, WorldState, Player, InventoryItem } from '@/types';
import { buildRulesetPromptBlock } from './rulesets';

export interface SystemPromptBlocks {
  ruleset: string;   // RPG system rules — cached long-term
  static: string;   // scenario content — cached while scenario unchanged
  dynamic: string;  // world state + players — changes every request
}

// CHANGED: Filter locations to current + visited only (reduces tokens)
function getRelevantLocations(
  scenario: Scenario,
  currentLocationId: string | undefined,
  visitedLocations: string[]
) {
  if (!scenario.locations) return [];
  return scenario.locations.filter(
    (loc) => loc.id === currentLocationId || visitedLocations.includes(loc.id)
  );
}

// CHANGED: Filter NPCs to met-only (reduces tokens)
function getRelevantNPCs(scenario: Scenario, metNPCs: string[]) {
  if (!scenario.npcs) return [];
  if (!metNPCs || metNPCs.length === 0) return [];
  return scenario.npcs.filter((npc) => metNPCs.includes(npc.id));
}

// CHANGED: Compact skill format to reduce tokens
function formatSkillsCompact(skills: Record<string, number>): string {
  return Object.entries(skills)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
}

// CHANGED: Detailed inventory format with IDs to prevent LLM hallucinations
function formatInventory(inventory: InventoryItem[]): string {
  if (!inventory.length) return 'порожній';
  return inventory
    .map((it) => {
      const status = it.broken
        ? 'зламаний'
        : it.uses === 0
          ? 'витрачений'
          : it.uses === -1
            ? '∞'
            : `×${it.uses}`;
      const equipped = it.equipped ? ' [В РУКАХ]' : '';
      return `${it.name}[id:${it.id}](${status})${equipped}: ${it.description}`;
    })
    .join('\n    ');
}

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  uk: `## МОВА\nВідповідай ТІЛЬКИ українською мовою. Всі репліки NPC, описи та підказки — виключно українською.`,
  en: `## LANGUAGE\nRespond ONLY in English. All NPC dialogue, descriptions, and hints must be in English.\nUse "you" (second person) for addressing players.`,
};

const RESPONSE_STYLE: Record<string, string> = {
  uk: `## СТИЛЬ ВІДПОВІДІ
- Відповідай ТІЛЬКИ українською.
- Обсяг: 2–4 абзаци залежно від ситуації. Бойова сцена — коротше. Дослідження, атмосфера, NPC-діалог — повніше.
- Перший абзац: кінематографічна сцена — що персонаж бачить, чує, відчуває. Конкретні сенсорні деталі (запах, текстура, звук).
- **Жирним** позначай ключові підказки та незвичайні деталі, які варто запам'ятати.
- NPC: передавай голос через дію та манеру, не лише слова: "Стара жінка стискає шаль..."
- Жах — через деталі та атмосферу, а не пряме оголошення.
- НЕ перераховуй можливі дії та не питай "що ви робите далі?".`,
  en: `## RESPONSE STYLE
- Respond ONLY in English.
- Length: 2–4 paragraphs depending on situation. Combat — shorter. Exploration, atmosphere, NPC dialogue — fuller.
- First paragraph: cinematic scene — what the character sees, hears, feels. Specific sensory details (smell, texture, sound).
- **Bold** key clues and unusual details worth remembering.
- NPCs: convey voice through action and manner, not just words: "The old woman clutches her shawl..."
- Horror through detail and atmosphere, not direct announcement.
- Do NOT list possible actions or ask "what do you do?".`,
};

// CHANGED: Accept optional campaign context and event/activity instructions
export function buildSystemPromptBlocks(
  scenario: Scenario,
  worldState: WorldState,
  players: Player[],
  options?: {
    campaignContext?: { recentSummaries: string };
    eventInstruction?: string;
    keeperActivitySection?: string;
    language?: 'uk' | 'en';
  }
): SystemPromptBlocks {

  // ── Language ─────────────────────────────────────────────────────────────────
  const lang = options?.language ?? 'uk';

  // ── RULESET BLOCK (separate cache) ──────────────────────────────────────────
  const rulesetBlock = buildRulesetPromptBlock(scenario.rulesetId ?? 'coc_7e');

  // ── STATIC SCENARIO BLOCK ───────────────────────────────────────────────────
  const metNPCs = worldState.npcRelations ? Object.keys(worldState.npcRelations) : [];
  const relevantNPCs = getRelevantNPCs(scenario, metNPCs);
  const relevantLocations = getRelevantLocations(
    scenario,
    worldState.currentLocation,
    worldState.visitedLocations
  );

  const npcSection = relevantNPCs.length
    ? `## NPC\n${relevantNPCs
        .map(
          (npc) =>
            `### ${npc.name} [voice: ${npc.voiceStyle}]\n${npc.description}\nСекрети: ${npc.secrets.join('; ')}`
        )
        .join('\n\n')}`
    : '## NPC\n(жодного не зустрічали)';

  const locationSection = relevantLocations.length
    ? `## ЛОКАЦІЇ\n${relevantLocations
        .map(
          (loc) =>
            `### ${loc.name} [id: ${loc.id}]\n${loc.description}\nПідказки: ${loc.clues.join('; ')}`
        )
        .join('\n\n')}`
    : '';

  const staticBlock = `
${scenario.systemPrompt}

${npcSection}

${locationSection}

## ЗАХИСТ СЮЖЕТУ
${scenario.railguards.map((r) => `Якщо ${r.trigger} → ${r.response}`).join('\n')}

Обов'язкові події: ${scenario.mustHappenEvents.join(', ')}

## КРИТИЧНІ УСПІХИ
Розслідування: ${scenario.criticalSuccessRules.investigation}
Бій: ${scenario.criticalSuccessRules.combat}
Переконання: ${scenario.criticalSuccessRules.persuasion}

## ІНВЕНТАР ТА ПРЕДМЕТИ

### Правило джерела правди
Інвентар кожного гравця вказаний нижче в секції ГРАВЦІ — це єдина правда.

**КРИТИЧНО:** Гравець може ВИКОРИСТОВУВАТИ або ДІСТАВАТИ лише предмети зі свого інвентарю.
Якщо гравець каже "дістаю ліхтарик" або "використовую мотузку", але цього предмету немає
в його інвентарі — м'яко нагадай, що цього предмету при ньому немає.
Виняток: гравець ЗНАХОДИТЬ предмет у оточенні (обшукує кімнату, ящик, тіло тощо) —
тоді можна логічно додати предмет через [ITEM:] і описати, як він його підбирає.

### Коли гравець активно використовує предмет зі свого інвентарю
Якщо uses > 0 і предмет логічно допомагає — обов'язково згадай його в описі:
"Ти дістаєш медичну сумку..." → [USE_ITEM:0:medkit_id]

### Теги мутацій інвентаря (додавай в кінці відповіді)
Додати предмет: [ITEM:idx:Назва:Короткий опис:кількість] (кількість=-1 для нескінченних)
Використати (зменшує uses на 1): [USE_ITEM:idx:itemId]
Видалити повністю: [REMOVE_ITEM:idx:itemId]
Взяти в руки: [EQUIP:idx:itemId]
Зламати предмет: [BREAK_ITEM:idx:itemId]

broken=true → зламаний, не пропонуй використовувати
uses=0 → витрачений, ігноруй при пропозиціях

## ОНОВЛЕННЯ СТАТІВ
[DELTA:{"<idx>":{"hp":<±N>,"sanity":<±N>,"luck":<±N>}}]
Тільки якщо стат змінився.

## СИТУАТИВНІ ЗОБРАЖЕННЯ
[IMAGE:type:short English description]
Типи: newspaper, map, letter, photo, artifact, scene. РІДКО — лише ключові моменти.

## ПЕРЕХОДИ МІЖ ЛОКАЦІЯМИ
[LOCATION:location_id] — тільки при реальному фізичному переході. Використовуй ТІЛЬКИ ID зі списку нижче — ніколи не вигадуй нові ID.
Доступні локації: ${scenario.locations?.map((l) => `${l.id} (${l.name})`).join(', ') ?? '—'}

## ОЗВУЧКА NPC
[NPC:Ім'я]текст репліки[/NPC] — лише пряма мова NPC.

${LANGUAGE_INSTRUCTION[lang]}

${RESPONSE_STYLE[lang]}
`.trim();

  // ── DYNAMIC BLOCK ───────────────────────────────────────────────────────────
  const campaignSection = options?.campaignContext?.recentSummaries
    ? `\n## ПОПЕРЕДНІ СЕСІЇ\n${options.campaignContext.recentSummaries}\n`
    : '';

  const activitySection = options?.keeperActivitySection ?? '';
  const eventSection = options?.eventInstruction ?? '';

  const dynamicBlock = `
## ПОТОЧНИЙ СТАН
Акт: ${worldState.act}
Локація: ${worldState.currentLocation ?? 'невідома'}
Відвідані: ${worldState.visitedLocations.join(', ') || 'жодної'}
Підказки: ${worldState.discoveredClues.join(', ') || 'жодної'}
Summary: ${worldState.summary || 'Гра починається'}
Відкриті питання: ${worldState.openThreads.join(', ') || 'жодного'}
${campaignSection}
## ГРАВЦІ
${players
  .map((p, i) => {
    const skills = formatSkillsCompact(p.skills);
    const inv = formatInventory(p.inventory ?? []);
    return `[${i}] ${p.name} (${p.role}): HP ${p.hp}/${p.maxHp} SAN ${p.sanity}/${p.maxSanity} LCK ${p.luck}/${p.maxLuck ?? 99}
  Навички: ${skills}
  Інвентар: ${inv}
  Передісторія: ${p.background ?? ''}`;
  })
  .join('\n\n')}

Префікс [Ім'я]: — окремі гравці. Ніколи не дій від їх імені.
При перевірці навички використовуй ТОЧНЕ значення зі списку вище.${activitySection}${eventSection}
`.trim();

  return { ruleset: rulesetBlock, static: staticBlock, dynamic: dynamicBlock };
}

// DEPRECATED: use buildSystemPromptBlocks instead
export function buildSystemPrompt(
  scenario: Scenario,
  worldState: WorldState,
  players: Player[]
): string {
  const { ruleset, static: s, dynamic: d } = buildSystemPromptBlocks(scenario, worldState, players);
  return `${ruleset}\n\n${s}\n\n${d}`;
}

export function buildSummarizePrompt(messages: { role: string; content: string }[]): string {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'ГРАВЕЦЬ' : 'КІПЕР'}: ${m.content}`)
    .join('\n\n');

  return `Проаналізуй цю RPG сесію і поверни JSON об'єкт WorldState.
Відповідай ТІЛЬКИ валідним JSON без пояснень.

Сесія:
${transcript}

Поверни JSON у форматі:
{
  "act": <поточний акт (число)>,
  "currentLocation": "<id поточної локації або null>",
  "visitedLocations": [<список відвіданих локацій>],
  "discoveredClues": [<список знайдених підказок>],
  "npcRelations": {<id_npc>: "friendly"|"neutral"|"hostile"|"unknown"},
  "summary": "<стислий переказ що сталось, 2-3 речення>",
  "openThreads": [<незакриті сюжетні лінії>],
  "playerNotes": [<важливі дії гравців>]
}`;
}
