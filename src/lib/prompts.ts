import type { Scenario, WorldState, Player } from '@/types';

export interface SystemPromptBlocks {
  static: string;   // scenario lore, NPCs, locations, rules — never changes
  dynamic: string;  // world state + players — changes every few messages
}

export function buildSystemPromptBlocks(
  scenario: Scenario,
  worldState: WorldState,
  players: Player[]
): SystemPromptBlocks {
  // ── STATIC ──────────────────────────────────────────────────────────────────
  const npcSection = scenario.npcs?.length
    ? `## NPC\n${scenario.npcs.map((npc) =>
        `### ${npc.name} [voice: ${npc.voiceStyle}]\n${npc.description}\nСекрети: ${npc.secrets.join('; ')}`
      ).join('\n\n')}`
    : '';

  const locationSection = scenario.locations?.length
    ? `## ЛОКАЦІЇ\n${scenario.locations.map((loc) =>
        `### ${loc.name} [id: ${loc.id}]\n${loc.description}\nПідказки: ${loc.clues.join('; ')}`
      ).join('\n\n')}`
    : '';

  const staticBlock = `
${scenario.systemPrompt}

${npcSection}

${locationSection}

## ЗАХИСТ СЮЖЕТУ
${scenario.railguards.map((r) => `Якщо ${r.trigger} → ${r.response}`).join('\n')}

Обов'язкові події: ${scenario.mustHappenEvents.join(', ')}

## КРИТИЧНІ УСПІХИ ТА ФУМБЛИ
Розслідування: ${scenario.criticalSuccessRules.investigation}
Бій: ${scenario.criticalSuccessRules.combat}
Переконання: ${scenario.criticalSuccessRules.persuasion}

## ПРАВИЛА КУБИКІВ
Перевірку навички проси ЛИШЕ якщо одночасно виконані ТРИ умови:
1. Гравець явно і конкретно намагається щось зробити (не просто "дивлюсь" або "йду")
2. Є реальний ризик провалу з наслідками
3. Результат невідомий заздалегідь

Формат: "Кинь [Навичка] (1к100, треба X або менше)"
Крит. успіх (≤ 1/5 від значення): відкриває додаткову деталь — але не вирішує загадку
Фумбл (96-100): ускладнення або небезпека

НЕ проси перевірку за: пасивне спостереження, переміщення, звичайну розмову, тривіальні дії.

## ПРЕДМЕТИ
Якщо гравець використовує предмет — врахуй його ефект і опиши результат. Предмет зі ×0 вже витрачений, ігноруй його використання.
Коли за сюжетом гравці знаходять фізичний предмет — видай його через тег в кінці відповіді:
[ITEM:playerIdx:Назва предмету:Короткий опис ефекту:кількість_використань]
де playerIdx — індекс гравця (0, 1, 2...), кількість=-1 для нескінченних.
Приклад: [ITEM:0:Ключ від підвалу:Відкриває замок підвальних дверей:1]
Якщо предмет для всіх — видай окремий тег для кожного гравця.
Не давай предмети без причини — тільки якщо це логічно за сюжетом.

## ОНОВЛЕННЯ СТАТУ ГРАВЦІВ
Якщо в результаті дії або події HP, Стійкість або Удача гравця змінюється — в самому кінці відповіді (після тексту) додай ОДИН рядок у форматі:
[DELTA:{"<індекс гравця>":{"hp":<дельта>,"sanity":<дельта>,"luck":<дельта>}}]
Де дельта — число зі знаком (від'ємне = втрата). Вказуй тільки ті параметри що змінились.
Приклади: [DELTA:{"0":{"hp":-3,"sanity":-5}}] або [DELTA:{"0":{"hp":-2},"1":{"sanity":-8,"luck":-5}}]
Удача витрачається при Luck rolls — коли результат залежить від зовнішніх обставин поза контролем персонажа.
Якщо статус не змінився — нічого не додавай.

## СИТУАТИВНІ ЗОБРАЖЕННЯ
Коли відбувається зміна сцени або гравці знаходять фізичний об'єкт (документ, улюка, місце) — додай в кінці відповіді:
[IMAGE:type:short English description]
Типи: newspaper, map, letter, photo, artifact, scene
Приклад: [IMAGE:letter:torn handwritten note warning about the basement signed W.C.]
Використовуй РІДКО — лише коли зображення реально підсилює момент. Не більше одного на відповідь. Якщо зображення не потрібне — нічого не додавай.

## ПЕРЕХОДИ МІЖ ЛОКАЦІЯМИ
Коли гравці фізично переходять до нової локації — додай в кінці відповіді:
[LOCATION:location_id]
де location_id — точний id локації з переліку вище (секція ЛОКАЦІЇ). Тільки при реальному фізичному переході, не при згадці.

Відповідай ТІЛЬКИ українською. Максимум 4-5 речень — текст озвучується.
`.trim();

  // ── DYNAMIC ─────────────────────────────────────────────────────────────────
  const dynamicBlock = `
## ПОТОЧНИЙ СТАН СВІТУ
Акт: ${worldState.act}
Відвідані локації: ${worldState.visitedLocations.length ? worldState.visitedLocations.join(', ') : 'жодної'}
Знайдені підказки: ${worldState.discoveredClues.length ? worldState.discoveredClues.join(', ') : 'жодної'}
Стислий переказ: ${worldState.summary || 'Гра тільки починається'}
Незакриті питання: ${worldState.openThreads.length ? worldState.openThreads.join(', ') : 'жодного'}
Нотатки про гравців: ${worldState.playerNotes.length ? worldState.playerNotes.join('; ') : 'відсутні'}

## ГРАВЦІ
${players.map((p) => {
  const skillList = Object.entries(p.skills).map(([k, v]) => `${k} ${v}`).join(', ');
  const inventory = (p.inventory ?? []);
  const invList = inventory.length
    ? inventory.map((it) => `${it.name} (${it.uses === -1 ? '∞' : `×${it.uses}`}): ${it.description}`).join('; ')
    : 'порожній';
  const bgLine = p.background ? `\n  Передісторія: ${p.background}` : '';
  return `- ${p.name} (${p.role}): HP ${p.hp}/${p.maxHp}, Стійкість ${p.sanity}/${p.maxSanity}, Удача ${p.luck ?? '?'}/${p.maxLuck ?? 99}\n  Навички: ${skillList}\n  Інвентар: ${invList}${bgLine}`;
}).join('\n')}

Кожне повідомлення гравця має префікс [Ім'я]: — це окремі незалежні гравці, не NPC. Реагуй на кожного персонально. Ніколи не дій і не говори від імені гравців.
При перевірці навички використовуй ТОЧНЕ значення навички ЦЬОГО гравця зі списку вище. Якщо гравець не має потрібної навички — використовуй базове значення 20.
`.trim();

  return { static: staticBlock, dynamic: dynamicBlock };
}

// Legacy single-string version for scenarios that don't use the split yet
export function buildSystemPrompt(
  scenario: Scenario,
  worldState: WorldState,
  players: Player[]
): string {
  const { static: s, dynamic: d } = buildSystemPromptBlocks(scenario, worldState, players);
  return `${s}\n\n${d}`;
}

export function buildSummarizePrompt(messages: { role: string; content: string }[]): string {
  const transcript = messages.map((m) => `${m.role === 'user' ? 'ГРАВЕЦЬ' : 'КІПЕР'}: ${m.content}`).join('\n\n');

  return `Проаналізуй цю RPG сесію і поверни JSON об'єкт WorldState.
Відповідай ТІЛЬКИ валідним JSON без пояснень.

Сесія:
${transcript}

Поверни JSON у форматі:
{
  "act": <поточний акт (число)>,
  "visitedLocations": [<список відвіданих локацій>],
  "discoveredClues": [<список знайдених підказок>],
  "npcRelations": {<id_npc>: "friendly"|"neutral"|"hostile"|"unknown"},
  "summary": "<стислий переказ що сталось, 2-3 речення>",
  "openThreads": [<незакриті сюжетні лінії>],
  "playerNotes": [<важливі дії гравців>]
}`;
}
