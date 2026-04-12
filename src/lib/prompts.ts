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
${players.map((p, i) => `- ${p.name} (${p.role}): HP ${p.hp}/10, Стійкість ${p.sanity}/99`).join('\n')}

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
