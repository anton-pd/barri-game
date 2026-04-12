import type { Scenario, WorldState, Player } from '@/types';

export function buildSystemPrompt(
  scenario: Scenario,
  worldState: WorldState,
  players: Player[]
): string {
  return `
${scenario.systemPrompt}

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
  return `- ${p.name} (${p.role}): HP ${p.hp}/${p.maxHp}, Стійкість ${p.sanity}/${p.maxSanity}\n  Навички: ${skillList}`;
}).join('\n')}

Кожне повідомлення гравця має префікс [Ім'я]: — це окремі незалежні гравці, не NPC. Реагуй на кожного персонально. Ніколи не дій і не говори від імені гравців.
При перевірці навички використовуй ТОЧНЕ значення навички ЦЬОГО гравця зі списку вище. Якщо гравець не має потрібної навички — використовуй базове значення 20.

## ЗАХИСТ СЮЖЕТУ
${scenario.railguards.map((r) => `Якщо ${r.trigger} → ${r.response}`).join('\n')}

Обов'язкові події: ${scenario.mustHappenEvents.join(', ')}

## КРИТИЧНІ УСПІХИ ТА ФУМБЛИ
Розслідування: ${scenario.criticalSuccessRules.investigation}
Бій: ${scenario.criticalSuccessRules.combat}
Переконання: ${scenario.criticalSuccessRules.persuasion}

## ПРАВИЛА КУБИКІВ
При спробах дії: "Кинь [Навичка] (1к100, треба X або менше)"
Крит. успіх (≤ 1/5): більше інформації, але не пропуск сцени
Фумбл (96-100): ускладнення ситуації

## ОНОВЛЕННЯ СТАТУ ГРАВЦІВ
Якщо в результаті дії або події HP або Стійкість гравця змінюється — в самому кінці відповіді (після тексту) додай ОДИН рядок у форматі:
[DELTA:{"<індекс гравця>":{"hp":<дельта>,"sanity":<дельта>}}]
Де дельта — число зі знаком (від'ємне = втрата). Якщо змінюється лише один параметр — вказуй тільки його.
Приклади: [DELTA:{"0":{"hp":-3,"sanity":-5}}] або [DELTA:{"0":{"hp":-2},"1":{"sanity":-8}}]
Якщо статус не змінився — нічого не додавай.

## СИТУАТИВНІ ЗОБРАЖЕННЯ
Коли відбувається зміна сцени або гравці знаходять фізичний об'єкт (документ, улюка, місце) — додай в кінці відповіді:
[IMAGE:type:short English description]
Типи: newspaper, map, letter, photo, artifact, scene
Приклад: [IMAGE:letter:torn handwritten note warning about the basement signed W.C.]
Використовуй РІДКО — лише коли зображення реально підсилює момент. Не більше одного на відповідь. Якщо зображення не потрібне — нічого не додавай.

Відповідай ТІЛЬКИ українською. Максимум 4-5 речень — текст озвучується.
  `.trim();
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
