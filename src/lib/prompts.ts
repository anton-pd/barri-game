// CHANGED: Split static block into ruleset + scenario parts for better caching.
// Added location/NPC filtering to reduce tokens per request.
// Added Keeper activity and event instruction injection.
// ANT-64: full localization of the keeper prompt for en sessions (all control sections translated).
import type { Scenario, WorldState, Player, InventoryItem } from '@/types';
import { buildRulesetPromptBlock, supportsPendingRollTag } from './rulesets';
import { buildDeltaTemplate, formatStatLine } from './statUtils';

export interface SystemPromptBlocks {
  ruleset: string;   // RPG system rules — cached long-term
  static: string;   // scenario content — cached while scenario unchanged
  dynamic: string;  // world state + players — changes every request
}

type Lang = 'uk' | 'en';

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
function formatInventory(inventory: InventoryItem[], lang: Lang): string {
  const C = COPY[lang];
  if (!inventory.length) return C.invEmpty;
  return inventory
    .map((it) => {
      const status = it.broken
        ? C.invBroken
        : it.uses === 0
          ? C.invSpent
          : it.uses === -1
            ? '∞'
            : `×${it.uses}`;
      const equipped = it.equipped ? ` ${C.invEquipped}` : '';
      return `${it.name}[id:${it.id}](${status})${equipped}: ${it.description}`;
    })
    .join('\n    ');
}

function formatCasePlan(worldState: WorldState, lang: Lang): string {
  const items = worldState.casePlan?.items ?? [];
  if (!items.length) return COPY[lang].curNoneM;

  const statusLabel: Record<string, string> = lang === 'en'
    ? {
        hidden: 'hidden',
        available: 'available',
        completed: 'completed',
        crossed_out: 'crossed out',
      }
    : {
        hidden: 'приховано',
        available: 'активно',
        completed: 'виконано',
        crossed_out: 'закреслено',
      };

  return items
    .map((item) => {
      const note = item.note ? ` — ${item.note}` : '';
      return `${item.id}: ${item.label} [${statusLabel[item.status] ?? item.status}]${note}`;
    })
    .join('\n');
}

// ── Localized copy ─────────────────────────────────────────────────────────────
const COPY = {
  uk: {
    // inventory formatter
    invEmpty: 'порожній',
    invBroken: 'зламаний',
    invSpent: 'витрачений',
    invEquipped: '[В РУКАХ]',
    // static block
    introInstruction: `Зроби розгорнуте вступне intro, щоб гравці відчули сетинг і зрозуміли, з чим мають справу. Структура (4-5 абзаців, 700-1100 символів загалом):

1) Кінематографічний план: де персонажі зараз, що бачать, чують, відчувають — конкретні сенсорні деталі (запах, текстура, звук, світло).
2) Контекст часу й місця: рік, пора року/доби, географія, настрій епохи — щоб гравець зорієнтувався в світі.
3) Видимі персонажі / NPC / деталі середовища: хто поряд, що роблять, як поводяться. Без повного переліку — 1-2 яскравих образа.
4) Гачок сюжету: що вже відбулось або ось-ось станеться, яка напруга/таємниця висить у повітрі. **Жирним** виділи 1-2 ключові підказки чи незвичні деталі.
5) (Опційно) Легкий перехід до дії — натяк на те, що гравці мають вирішувати далі, БЕЗ прямого питання "що ви робите?" і БЕЗ переліку варіантів.

Не питай нічого, не перелічуй можливі дії, не відкривай короткий опис-заготовку. Видай саме готове intro.`,
    headingLang: '## МОВА\nВідповідай ТІЛЬКИ українською мовою. Всі репліки NPC, описи та підказки — виключно українською.',
    headingStyle: `## СТИЛЬ ВІДПОВІДІ
- Відповідай ТІЛЬКИ українською.
- Обсяг: 2–4 абзаци залежно від ситуації. Бойова сцена — коротше. Дослідження, атмосфера, NPC-діалог — повніше.
- Перший абзац: кінематографічна сцена — що персонаж бачить, чує, відчуває. Конкретні сенсорні деталі (запах, текстура, звук).
- **Жирним** позначай ключові підказки та незвичайні деталі, які варто запам'ятати.
- NPC: передавай голос через дію та манеру, не лише слова: "Стара жінка стискає шаль..."
- Жах — через деталі та атмосферу, а не пряме оголошення.
- НЕ перераховуй можливі дії та не питай "що ви робите далі?".`,
    hPlot: '## ЗАХИСТ СЮЖЕТУ',
    railLine: (t: string, r: string) => `Якщо ${t} → ${r}`,
    mustHappen: (list: string) => `Обов'язкові події: ${list}`,
    hCrit: '## КРИТИЧНІ УСПІХИ',
    critInvestigation: 'Розслідування',
    critCombat: 'Бій',
    critPersuasion: 'Переконання',
    hInventory: '## ІНВЕНТАР ТА ПРЕДМЕТИ',
    invTruth: `### Правило джерела правди
Інвентар кожного гравця вказаний нижче в секції ГРАВЦІ — це єдина правда.

**КРИТИЧНО:** Гравець може ВИКОРИСТОВУВАТИ або ДІСТАВАТИ лише предмети зі свого інвентарю.
Якщо гравець каже "дістаю ліхтарик" або "використовую мотузку", але цього предмету немає
в його інвентарі — м'яко нагадай, що цього предмету при ньому немає.
Виняток: гравець ЗНАХОДИТЬ предмет у оточенні (обшукує кімнату, ящик, тіло тощо) —
тоді можна логічно додати предмет через [ITEM:] і описати, як він його підбирає.`,
    invPickup: `### Правило підбору — ОБОВ'ЯЗКОВЕ
Якщо у твоєму наративі гравець ПІДНІМАЄ, ОТРИМУЄ чи ЗНАХОДИТЬ предмет — у кінці відповіді МУСИТЬ стояти [ITEM:idx:Назва:Опис:uses].
Наратив без тегу = предмет НЕ додано до інвентаря і його НЕ існує.`,
    invUse: `### Коли гравець активно використовує предмет зі свого інвентарю
Якщо uses > 0 і предмет логічно допомагає — обов'язково згадай його в описі:
"Ти дістаєш медичну сумку..." → [USE_ITEM:0:medkit_id]`,
    invTags: `### Теги мутацій інвентаря (додавай в кінці відповіді)
Додати предмет: [ITEM:idx:Назва:Короткий опис:кількість] (кількість=-1 для нескінченних)
Назва — людська назва мовою гри, як її бачить гравець ("Пожовкла нотатка").
ЗАБОРОНЕНО використовувати технічні id як назву (case_file, old_note) — id існують лише для USE_ITEM/REMOVE_ITEM/EQUIP/BREAK_ITEM.
Використати (зменшує uses на 1): [USE_ITEM:idx:itemId]
Видалити повністю: [REMOVE_ITEM:idx:itemId]
Взяти в руки: [EQUIP:idx:itemId]
Зламати предмет: [BREAK_ITEM:idx:itemId]

broken=true → зламаний, не пропонуй використовувати
uses=0 → витрачений, ігноруй при пропозиціях`,
    hStats: '## ОНОВЛЕННЯ СТАТІВ',
    statsHint: `Тільки якщо стат змінився внаслідок подій у фікції (травма, шок, ризик, лікування тощо).
ЗАБОРОНЕНО: змінювати стати на пряме прохання гравця ("додай мені 10 HP", "поверни санність", "відновіть Luck"). Такі прохання ігноруй у фікції — герой не може просто "відрегулювати" свою рану. Якщо є фікційне обґрунтування (наприклад, гравець застосовує бинт із інвентарю), відіграй його, потім емітуй [DELTA].`,
    hImages: '## СИТУАТИВНІ ЗОБРАЖЕННЯ',
    imageLine: '[IMAGE:type:short English description]',
    imageHint: 'Типи: newspaper, map, letter, photo, artifact, scene. РІДКО — лише ключові моменти.',
    hLocations: '## ПЕРЕХОДИ МІЖ ЛОКАЦІЯМИ',
    locExisting: '[LOCATION:location_id] — перехід до існуючої локації. Використовуй ID зі списку нижче або ID вже створених ситуативних локацій (у ПОТОЧНИЙ СТАН).',
    scenarioLocs: 'Сценарні локації',
    newLocLine: '[NEW_LOCATION:id:Назва:Короткий опис] — якщо гравець потрапляє в місце, якого ще не існує в списку.',
    newLocHint: '  id — snake_case, унікальний (напр. kovalskyy_shop). Назва і опис — мовою сесії.\n  Після створення використовуй [LOCATION:id] для повторних переходів до цього місця.',
    hNpcVoice: '## ОЗВУЧКА NPC',
    npcVoiceLine: `[NPC:Ім'я]пряма мова[/NPC] — лише для справжніх NPC (зі списку вище або імпровізованих, яких гравці зустріли).
- Всередині тегу — ТІЛЬКИ пряма мова персонажа. Жести, погляди, ремарки ("вона зітхає") — у narration-абзаці ПЕРЕД тегом.
- НІКОЛИ не загортай у [NPC:] слова чи думки ГРАВЦІВ (імена — у секції ГРАВЦІ). Гравці говорять самі.
- Кожен [NPC:Ім'я] закривай [/NPC] у тій самій репліці. Одна репліка = один тег; NPC говорить двічі — два окремі теги.
- NPC мовчить (лише дія чи вираз обличчя) — тег не став, опиши в narration.`,
    hNpcUpdate: '## ОНОВЛЕННЯ ДАНИХ ПРО ПЕРСОНАЖА',
    npcUpdateTagLine: `[NPC_UPDATE:Ім'я:ставлення:нотатки] — після важливої взаємодії, коли дізнався нове про NPC.
Ім'я — точне (як у [NPC:]). ставлення: friendly|neutral|hostile|unknown (порожньо = не змінилось). нотатки — 1–2 речення нового; вони накопичуються.
Приклад: [NPC_UPDATE:Ганна Василенко:neutral:Знає про зникнення Корбітта, але боїться говорити відкрито.]`,
    hCasePlan: '## ЖИВИЙ ПЛАН СПРАВИ',
    casePlanTagLine: `Боковий план справи. Онови лише коли в fiction справді змінився шлях розслідування.
[CASE_PLAN:{"id":"snake_case_id","label":"коротка дія","status":"available|completed|crossed_out|hidden","note":"опційна причина"}]
- available: відкрився новий напрям; completed: виконано/закрито; crossed_out: шлях втрачено або хибний; hidden: заготовка, гравцям ще не видно.
- id стабільний між оновленнями. label — дія ("Перевірити архіви мерії"), не факт. Не дублюй і не перелічуй усе наперед — пункти з'являються поступово.`,
    hComplete: '## ЗАВЕРШЕННЯ СЕСІЇ',
    completeBody: `Тільки коли розслідування СПРАВДІ завершене: загроза усунута/стримана або доля героїв вирішена остаточно.
- one-shot / фінал сценарію: [COMPLETE_SESSION]
- кампанія, завершився лише поточний вечір: [FINISH_EVENING]
Не став ці теги для паузи, відступу, невдачі без розв'язки чи коли лишилися ключові відкриті вузли.`,
    npcSectionTitle: '## NPC',
    npcNoneMet: '## NPC\n(жодного не зустрічали)',
    npcSecrets: 'Секрети',
    npcSecretsRule: 'Секрети NPC розкривай ЛИШЕ через успішні кидки (Psychology, Persuade тощо), вагомі важелі або фінальні сцени — ніколи у звичайній розмові без приводу.',
    locSectionTitle: '## ЛОКАЦІЇ',
    locClues: 'Підказки',
    voice: 'voice',
    // dynamic block
    hCurrent: '## ПОТОЧНИЙ СТАН',
    curAct: 'Акт',
    curLocation: 'Локація',
    curVisited: 'Відвідані',
    curClues: 'Підказки',
    curSummary: 'Summary',
    curOpen: 'Відкриті питання',
    curPlan: 'План справи',
    curUnknown: 'невідома',
    curNone: 'жодної',
    curNoneM: 'жодного',
    curStart: 'Гра починається',
    dynLocs: 'Ситуативні локації',
    hPast: '## ПОПЕРЕДНІ СЕСІЇ',
    hPlayers: '## ГРАВЦІ',
    lSkills: 'Навички',
    lInventory: 'Інвентар',
    lBackground: 'Передісторія',
    prefixRule: 'Якщо бачиш префікс [Ім\'я]: у повідомленні — це гравець. Ніколи не дій від їх імені.',
    prefixManyPlayers: ' Коли відповідь стосується конкретного гравця — починай абзац з Ім\'я: (без дужок). Для загальних описів — без префіксу.',
    prefixFewPlayers: ' Не використовуй префікс з іменем у своїх відповідях.',
    skillRule: 'При перевірці навички використовуй ТОЧНЕ значення зі списку вище.',
    hVariant: '## ВАРІАНТ ПОЧАТКУ',
    variantHint: '(Цю підказку враховуй тільки для інтро — далі вона більше не діє)',
    // ANT-143: protocol checklist at the very end of the dynamic tail — the
    // position closest to the response point. The "no tag = didn't happen"
    // framing is the one DeepSeek demonstrably obeys (eval roll probes).
    checkTitle: '⚠️ ПЕРЕД ВІДПРАВКОЮ ПЕРЕВІР:',
    checkRoll: `- Гравець шукає приховане, оглядає на сліди, прислуховується чи робить іншу дію з ризиком провалу → НЕ видавай приховані деталі одразу: попроси кидок відповідної навички.
- Загроза в сцені може помітити/наздогнати/зашкодити персонажу → НЕ вирішуй наративом, попроси реактивний кидок (Stealth/Dodge/Luck) з тегом.
- Просиш кидок ("Кинь X") → у кінці відповіді стоїть [SET_PENDING_ROLL:idx:Навичка:значення:поріг:контекст]. Без тегу кубик не активується.`,
    checkItem: '- У наративі гравець підняв/отримав предмет → стоїть [ITEM:...]. Без тегу предмета не існує.',
    checkNpc: '- Кожна пряма мова NPC — у [NPC:Ім\'я]...[/NPC], кожен тег закритий.',
    hCheatsheet: '## ШПАРГАЛКА ТЕГІВ (повні правила — у секціях вище)',
    cheatRoll: '[SET_PENDING_ROLL:idx:Навичка:значення:поріг:контекст] — запит кидка; [CLEAR_PENDING_ROLL] — скасувати очікуваний',
    cheatRest: `[DELTA:{"0":{"hp":-2}}] — зміна статів (лише з fiction-обґрунтуванням)
[ITEM:idx:Назва:Опис:uses] — гравець отримав предмет; [USE_ITEM:idx:id], [REMOVE_ITEM:idx:id], [EQUIP:idx:id], [BREAK_ITEM:idx:id]
[NPC:Ім'я]пряма мова[/NPC]; [NPC_UPDATE:Ім'я:ставлення:нотатки]
[LOCATION:id] — перехід; [NEW_LOCATION:id:Назва:Опис] — нове місце
[IMAGE:type:short english description] — рідко, лише ключові моменти
[CASE_PLAN:{...}] — план справи; [COMPLETE_SESSION] / [FINISH_EVENING] — лише справжній фінал`,
  },
  en: {
    invEmpty: 'empty',
    invBroken: 'broken',
    invSpent: 'spent',
    invEquipped: '[IN HAND]',
    introInstruction: `Deliver an extended opening intro so players feel the setting and understand what they're dealing with. Structure (4-5 paragraphs, 700-1100 characters total):

1) Cinematic shot: where the characters are right now — what they see, hear, feel. Specific sensory detail (smell, texture, sound, light).
2) Time and place context: year, season/time of day, geography, mood of the era — enough for the player to place themselves in the world.
3) Visible characters / NPCs / environmental detail: who is nearby, what they're doing, how they behave. Don't list everything — one or two vivid images.
4) Plot hook: what has already happened or is about to, the tension or mystery hanging in the air. **Bold** one or two key clues or unusual details.
5) (Optional) A light cue toward action — a hint of what the players need to decide next, WITHOUT asking "what do you do?" and WITHOUT listing options.

Do not ask anything, do not enumerate possible actions, do not hedge with a short draft. Deliver the finished intro.`,
    headingLang: '## LANGUAGE\nRespond ONLY in English. All NPC dialogue, descriptions, and hints must be in English.\nUse "you" (second person) for addressing players.',
    headingStyle: `## RESPONSE STYLE
- Respond ONLY in English.
- Length: 2–4 paragraphs depending on situation. Combat — shorter. Exploration, atmosphere, NPC dialogue — fuller.
- First paragraph: cinematic scene — what the character sees, hears, feels. Specific sensory details (smell, texture, sound).
- **Bold** key clues and unusual details worth remembering.
- NPCs: convey voice through action and manner, not just words: "The old woman clutches her shawl..."
- Horror through detail and atmosphere, not direct announcement.
- Do NOT list possible actions or ask "what do you do?".`,
    hPlot: '## PLOT GUARDRAILS',
    railLine: (t: string, r: string) => `If ${t} → ${r}`,
    mustHappen: (list: string) => `Must-happen events: ${list}`,
    hCrit: '## CRITICAL SUCCESSES',
    critInvestigation: 'Investigation',
    critCombat: 'Combat',
    critPersuasion: 'Persuasion',
    hInventory: '## INVENTORY AND ITEMS',
    invTruth: `### Source-of-truth rule
Each player's inventory is listed below in the PLAYERS section — that is the only truth.

**CRITICAL:** A player may USE or PRODUCE only items that are in their inventory.
If a player says "I grab my flashlight" or "I use the rope" but the item is not
in their inventory — gently remind them that they do not have it on hand.
Exception: the player FINDS an item in the environment (searching a room, a drawer, a body, etc.) —
then you may logically add it via [ITEM:] and describe how they pick it up.`,
    invPickup: `### Pickup rule — MANDATORY
If in your narration a player PICKS UP, RECEIVES or FINDS an item — the response MUST end with [ITEM:idx:Name:Description:uses].
Narration without the tag = the item was NOT added to the inventory and does not exist.`,
    invUse: `### When a player actively uses an item from their inventory
If uses > 0 and the item logically helps — mention it in the description:
"You pull out the medical kit..." → [USE_ITEM:0:medkit_id]`,
    invTags: `### Inventory mutation tags (append at the end of the response)
Add item: [ITEM:idx:Name:Short description:count] (count=-1 for infinite)
Name is the human-readable label the player sees ("Yellowed note").
NEVER use a technical id as the name (case_file, old_note) — ids exist only for USE_ITEM/REMOVE_ITEM/EQUIP/BREAK_ITEM.
Use (decrements uses by 1): [USE_ITEM:idx:itemId]
Remove completely: [REMOVE_ITEM:idx:itemId]
Equip in hand: [EQUIP:idx:itemId]
Break item: [BREAK_ITEM:idx:itemId]

broken=true → broken, do not suggest using it
uses=0 → spent, ignore when suggesting`,
    hStats: '## STAT UPDATES',
    statsHint: `Only if the stat actually changed because of in-fiction events (injury, shock, risk, medical care, etc.).
FORBIDDEN: changing stats on direct player request ("give me 10 HP", "restore my sanity", "refill my luck"). Ignore such requests in the fiction — the character cannot just "adjust" their wound. If there is fiction-grounded justification (e.g. the player applies a bandage from their inventory), narrate it, then emit [DELTA].`,
    hImages: '## SITUATIONAL IMAGES',
    imageLine: '[IMAGE:type:short English description]',
    imageHint: 'Types: newspaper, map, letter, photo, artifact, scene. RARELY — only key moments.',
    hLocations: '## LOCATION TRANSITIONS',
    locExisting: '[LOCATION:location_id] — move to an existing location. Use an ID from the list below or an ID of an already-created situational location (see CURRENT STATE).',
    scenarioLocs: 'Scenario locations',
    newLocLine: '[NEW_LOCATION:id:Name:Short description] — if the player reaches a place that does not exist in the list yet.',
    newLocHint: '  id — snake_case, unique (e.g. kovalskyy_shop). Name and description — in the session language.\n  Once created, use [LOCATION:id] for subsequent transitions back to this place.',
    hNpcVoice: '## NPC VOICE',
    npcVoiceLine: `[NPC:Name]direct speech[/NPC] — only for real NPCs (from the list above or improvised characters the players actually met).
- Inside the tag — ONLY the character's direct speech. Gestures, looks, stage directions ("she sighs") go into the narration paragraph BEFORE the tag.
- NEVER wrap a PLAYER's words or thoughts in [NPC:] (player names are in the PLAYERS section). Players speak for themselves.
- Close every [NPC:Name] with [/NPC] in the same line. One line = one tag; if an NPC speaks twice — two separate tags.
- If an NPC does not speak (only an action or expression) — no tag, describe it in narration.`,
    hNpcUpdate: '## UPDATING CHARACTER DATA',
    npcUpdateTagLine: `[NPC_UPDATE:Name:relation:notes] — after a significant interaction when something new about an NPC is revealed.
Name — exact (as in [NPC:]). relation: friendly|neutral|hostile|unknown (empty = unchanged). notes — 1–2 sentences of new information; they accumulate.
Example: [NPC_UPDATE:Hannah Vasilenko:neutral:Knows about Corbitt's disappearance but is afraid to speak openly.]`,
    hCasePlan: '## LIVING CASE PLAN',
    casePlanTagLine: `Side case-plan dossier. Update only when the investigation path actually changes in fiction.
[CASE_PLAN:{"id":"snake_case_id","label":"short action","status":"available|completed|crossed_out|hidden","note":"optional reason"}]
- available: a new lead opened; completed: done/closed; crossed_out: route lost or proved false; hidden: prepared, not visible to players yet.
- id is stable across updates. label is an action ("Check city hall archives"), not a fact. No duplicates, no listing everything in advance — items appear progressively.`,
    hComplete: '## SESSION COMPLETION',
    completeBody: `Only when the investigation is TRULY finished: the threat is removed/contained or the heroes' fate is resolved for good.
- one-shot / scenario finale: [COMPLETE_SESSION]
- campaign, only the current evening ended: [FINISH_EVENING]
Do not set these tags for a pause, a retreat, an unresolved failure, or while key threads remain open.`,
    npcSectionTitle: '## NPCS',
    npcNoneMet: '## NPCS\n(none met yet)',
    npcSecrets: 'Secrets',
    npcSecretsRule: 'Reveal NPC secrets ONLY through successful rolls (Psychology, Persuade etc.), strong leverage, or finale scenes — never in casual conversation without cause.',
    locSectionTitle: '## LOCATIONS',
    locClues: 'Clues',
    voice: 'voice',
    hCurrent: '## CURRENT STATE',
    curAct: 'Act',
    curLocation: 'Location',
    curVisited: 'Visited',
    curClues: 'Clues',
    curSummary: 'Summary',
    curOpen: 'Open threads',
    curPlan: 'Case plan',
    curUnknown: 'unknown',
    curNone: 'none',
    curNoneM: 'none',
    curStart: 'The game is starting',
    dynLocs: 'Situational locations',
    hPast: '## PREVIOUS SESSIONS',
    hPlayers: '## PLAYERS',
    lSkills: 'Skills',
    lInventory: 'Inventory',
    lBackground: 'Background',
    prefixRule: 'If you see a [Name]: prefix in a message — that is a player. Never act on their behalf.',
    prefixManyPlayers: ' When the reply concerns a specific player — start the paragraph with Name: (no brackets). For general descriptions — no prefix.',
    prefixFewPlayers: ' Do not use a name prefix in your own replies.',
    skillRule: 'For a skill check use the EXACT value from the list above.',
    hVariant: '## OPENING VARIANT',
    variantHint: '(Apply this hint only for the intro — afterwards it no longer applies.)',
    checkTitle: '⚠️ BEFORE SENDING, VERIFY:',
    checkRoll: `- A player searches for something hidden, examines for traces, listens, or attempts anything with a risk of failure → do NOT reveal hidden details right away: ask for the appropriate skill roll.
- A threat in the scene may notice/reach/harm the character → do NOT resolve it narratively, ask for the reactive roll (Stealth/Dodge/Luck) with the tag.
- Asking for a roll ("Roll X") → the response ends with [SET_PENDING_ROLL:idx:Skill:value:threshold:context]. Without the tag the dice won't activate.`,
    checkItem: '- A player picked up/received an item in the narration → there is an [ITEM:...] tag. Without the tag the item does not exist.',
    checkNpc: '- Every piece of direct NPC speech is inside [NPC:Name]...[/NPC], every tag closed.',
    hCheatsheet: '## TAG CHEAT SHEET (full rules in the sections above)',
    cheatRoll: '[SET_PENDING_ROLL:idx:Skill:value:threshold:context] — request a roll; [CLEAR_PENDING_ROLL] — cancel a pending one',
    cheatRest: `[DELTA:{"0":{"hp":-2}}] — stat change (only with fiction grounding)
[ITEM:idx:Name:Description:uses] — player received an item; [USE_ITEM:idx:id], [REMOVE_ITEM:idx:id], [EQUIP:idx:id], [BREAK_ITEM:idx:id]
[NPC:Name]direct speech[/NPC]; [NPC_UPDATE:Name:relation:notes]
[LOCATION:id] — move; [NEW_LOCATION:id:Name:Description] — new place
[IMAGE:type:short english description] — rarely, key moments only
[CASE_PLAN:{...}] — case plan; [COMPLETE_SESSION] / [FINISH_EVENING] — real finale only`,
  },
} satisfies Record<Lang, Record<string, unknown>>;

// Kept for backward compatibility — unused internally after ANT-64.
const LANGUAGE_INSTRUCTION: Record<string, string> = {
  uk: COPY.uk.headingLang,
  en: COPY.en.headingLang,
};

const RESPONSE_STYLE: Record<string, string> = {
  uk: COPY.uk.headingStyle,
  en: COPY.en.headingStyle,
};

export { LANGUAGE_INSTRUCTION, RESPONSE_STYLE };

// CHANGED: Accept optional campaign context and event/activity instructions
export function buildSystemPromptBlocks(
  scenario: Scenario,
  worldState: WorldState,
  players: Player[],
  options?: {
    campaignContext?: { recentSummaries: string };
    eventInstruction?: string;
    keeperActivitySection?: string;
    imageRequestInstruction?: string;
    language?: Lang;
  }
): SystemPromptBlocks {

  // ── Language ─────────────────────────────────────────────────────────────────
  const lang: Lang = options?.language ?? 'uk';
  const C = COPY[lang];

  // ── RULESET BLOCK (separate cache) ──────────────────────────────────────────
  const rulesetBlock = buildRulesetPromptBlock(scenario.rulesetId ?? 'coc_7e', lang);

  // ── STATIC SCENARIO BLOCK ───────────────────────────────────────────────────
  const metNPCs = worldState.npcRelations ? Object.keys(worldState.npcRelations) : [];
  const relevantNPCs = getRelevantNPCs(scenario, metNPCs);
  const relevantLocations = getRelevantLocations(
    scenario,
    worldState.currentLocation,
    worldState.visitedLocations
  );

  const npcSection = relevantNPCs.length
    ? `${C.npcSectionTitle}\n${relevantNPCs
        .map(
          (npc) =>
            `### ${npc.name} [${C.voice}: ${npc.voiceStyle}]\n${npc.description}\n${C.npcSecrets}: ${npc.secrets.join('; ')}`
        )
        .join('\n\n')}\n\n${C.npcSecretsRule}`
    : C.npcNoneMet;

  const locationSection = relevantLocations.length
    ? `${C.locSectionTitle}\n${relevantLocations
        .map(
          (loc) =>
            `### ${loc.name} [id: ${loc.id}]\n${loc.description}\n${C.locClues}: ${loc.clues.join('; ')}`
        )
        .join('\n\n')}`
    : '';

  const scenarioLocList = scenario.locations?.map((l) => `${l.id} (${l.name})`).join(', ') ?? '—';

  const staticBlock = `
${scenario.systemPrompt}

${npcSection}

${locationSection}

${C.hPlot}
${scenario.railguards.map((r) => C.railLine(r.trigger, r.response)).join('\n')}

${C.mustHappen(scenario.mustHappenEvents.join(', '))}

${C.hCrit}
${C.critInvestigation}: ${scenario.criticalSuccessRules.investigation}
${C.critCombat}: ${scenario.criticalSuccessRules.combat}
${C.critPersuasion}: ${scenario.criticalSuccessRules.persuasion}

${C.hInventory}

${C.invTruth}

${C.invPickup}

${C.invUse}

${C.invTags}

${C.hStats}
${buildDeltaTemplate(scenario.rulesetId)}
${C.statsHint}

${C.hImages}
${C.imageLine}
${C.imageHint}

${C.hLocations}
${C.locExisting}
${C.scenarioLocs}: ${scenarioLocList}

${C.newLocLine}
${C.newLocHint}

${C.hNpcVoice}
${C.npcVoiceLine}

${C.hNpcUpdate}
${C.npcUpdateTagLine}

${C.hCasePlan}
${C.casePlanTagLine}

${C.hComplete}
${C.completeBody}

${C.hCheatsheet}
${supportsPendingRollTag(scenario.rulesetId ?? 'coc_7e') ? `${C.cheatRoll}\n` : ''}${C.cheatRest}

${C.headingLang}

${C.headingStyle}
`.trim();

  // ── DYNAMIC BLOCK ───────────────────────────────────────────────────────────
  const campaignSection = options?.campaignContext?.recentSummaries
    ? `\n${C.hPast}\n${options.campaignContext.recentSummaries}\n`
    : '';

  const activitySection = options?.keeperActivitySection ?? '';
  const eventSection = options?.eventInstruction ?? '';
  const imageRequestSection = options?.imageRequestInstruction
    ? `\n\n## ${lang === 'en' ? 'VISUAL REQUEST' : 'ВІЗУАЛЬНИЙ ЗАПИТ'}\n${options.imageRequestInstruction}`
    : '';

  const variantHintSection = worldState.variantHint
    ? `\n\n${C.hVariant}\n${worldState.variantHint}\n${C.variantHint}`
    : '';

  const npcDetailEntries = Object.entries(worldState.npcDetails ?? {});
  const npcDetailSection = npcDetailEntries.length
    ? `\n${lang === 'en' ? 'Known NPC details' : 'Відомі дані про персонажів'}:\n${npcDetailEntries
        .map(([id, d]) => {
          const name =
            scenario.npcs?.find((n) => n.id === id)?.name ??
            worldState.dynamicNpcs?.find((n) => n.id === id)?.name ??
            id;
          return `- ${name}: ${d.notes}`;
        })
        .join('\n')}`
    : '';

  const dynLocEntries = Object.entries(worldState.dynamicLocations ?? {});
  const dynLocSection = dynLocEntries.length
    ? `\n${C.dynLocs}: ${dynLocEntries.map(([id, l]) => `${id} (${l.name})`).join(', ')}`
    : '';

  const prefixTail = players.length > 2 ? C.prefixManyPlayers : C.prefixFewPlayers;

  // ANT-143: protocol checklist at the very end of the dynamic block — in the
  // split-tail prompt shape this lands right before the response point, where
  // tag recall is strongest. The roll line is d100-only: reminding
  // non-percentile rulesets about [SET_PENDING_ROLL] contradicts their own
  // dice rules block (ANT-120).
  const rollLine = supportsPendingRollTag(scenario.rulesetId ?? 'coc_7e')
    ? `\n${C.checkRoll}`
    : '';
  const checklistSection = `\n\n${C.checkTitle}${rollLine}\n${C.checkItem}\n${C.checkNpc}`;

  const dynamicBlock = `
${C.hCurrent}
${C.curAct}: ${worldState.act}
${C.curLocation}: ${worldState.currentLocation ?? C.curUnknown}
${C.curVisited}: ${worldState.visitedLocations.join(', ') || C.curNone}${dynLocSection}
${C.curClues}: ${worldState.discoveredClues.join(', ') || C.curNone}
${C.curSummary}: ${worldState.summary || C.curStart}
${C.curOpen}: ${worldState.openThreads.join(', ') || C.curNoneM}
${C.curPlan}: ${formatCasePlan(worldState, lang)}${npcDetailSection}
${campaignSection}
${C.hPlayers}
${players
  .map((p, i) => {
    const skills = formatSkillsCompact(p.skills);
    const inv = formatInventory(p.inventory ?? [], lang);
    const statLine = formatStatLine(p, scenario.rulesetId);
    return `[${i}] ${p.name} (${p.role}): ${statLine}
  ${C.lSkills}: ${skills}
  ${C.lInventory}: ${inv}
  ${C.lBackground}: ${p.background ?? ''}`;
  })
  .join('\n\n')}

${C.prefixRule}${prefixTail}
${C.skillRule}${variantHintSection}${activitySection}${eventSection}${imageRequestSection}${checklistSection}
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

export function buildSummarizePrompt(
  messages: { role: string; content: string }[],
  lang: Lang = 'uk'
): string {
  if (lang === 'en') {
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'PLAYER' : 'KEEPER'}: ${m.content}`)
      .join('\n\n');

    return `Analyze this RPG session and return a WorldState JSON object.
Respond ONLY with valid JSON, no explanations. All text values must be in English.

Session:
${transcript}

Return JSON in this format:
{
  "act": <current act (number)>,
  "discoveredClues": [<list of discovered clues>],
  "summary": "<concise recap of what happened, 2-3 sentences>",
  "openThreads": [<unresolved plot threads>],
  "playerNotes": [<important player actions>]
}`;
  }

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
  "discoveredClues": [<список знайдених підказок>],
  "summary": "<стислий переказ що сталось, 2-3 речення>",
  "openThreads": [<незакриті сюжетні лінії>],
  "playerNotes": [<важливі дії гравців>]
}`;
}

// Export intro instruction per language so route.ts can pick the right phrasing.
export function getIntroUserContent(lang: Lang): string {
  return COPY[lang].introInstruction;
}
