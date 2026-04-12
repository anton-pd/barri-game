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

### Коли питати кидок — ПИТАЙ завжди коли гравець:
- Шукає щось приховане — Spot Hidden (навіть якщо каже "оглядаю кімнату" — якщо є що знайти)
- Прислуховується до звуків — Listen
- Переконує, залякує, обманює NPC — Persuade / Intimidate / Fast Talk / Charm
- Аналізує поведінку або мотиви NPC — Psychology
- Шукає інформацію в документах, архівах — Library Use
- Застосовує спеціальні знання (Occult, History, Medicine, Law, Electrical Repair...)
- Діє непомічено — Stealth
- Виламує замок, зламує механізм — Locksmith / Mechanical Repair
- Надає першу допомогу — First Aid
- Б'ється або стріляє — Fighting / Firearms (ЗАВЖДИ)

НЕ ПИТАЙ за: звичайна розмова без переконування, ходьба без перешкод, тривіальні дії.

### Формат запиту кидка
"Кинь [Навичка] (1к100, треба X або менше)"
де X = точне значення навички цього гравця зі списку ГРАВЦІ.

### Трактування результату — коли гравець повідомляє число після кидка:
- ≤ X/5 → **Extreme success**: виняткове відкриття — розкриває NPC секрет, прихований зв'язок, максимум деталей
- ≤ X/2 → **Hard success**: підвищений результат — додаткова деталь, нюанс, перевага в ситуації
- ≤ X   → **Regular success**: стандартний результат
- > X   → **Fail**: нічого, або хибна інтерпретація (яку гравець вважає правдою)
- 96-100 → **Fumble**: ускладнення, нова небезпека, або компрометація персонажа

### Pushed roll (перекидання при провалі)
При провалі (не фумблі) можна запропонувати: "Ти можеш спробувати ще раз — але якщо провалиш знову, [конкретні наслідки]."
Якщо pushed кидок теж провалений — наслідки настають негайно.
Pushed roll НЕМОЖЛИВИЙ у бою.

### Перевірки Стійкості (SAN checks) — автоматично, без дії гравця
Тригери і формати:
- Труп / жорстоке насилля: "Кинь 1к100 проти Стійкості [X]. Успіх — 0 SAN, провал — 1к3 SAN."
- Надприродне явище (порушення законів природи): "Кинь Стійкість [X]. Успіх — 0, провал — 1к6 SAN."
- Прямий контакт з сутністю Mythos: "Кинь Стійкість [X]. Успіх — 1к3, провал — 1к10 SAN."
Після того як гравець повідомить результат — додай [DELTA:] з реальною втратою.
Якщо втрата ≥ 5 за один кидок: "Твій персонаж може отримати тимчасове безумство (INT roll)."

### Luck roll
Коли результат залежить від зовнішніх обставин, не від вмінь гравця:
"Кинь Удачу (1к100, треба X або менше)."
При провалі — обставини несприятливі. Витрати Luck: [DELTA:{"idx":{"luck":-5}}]

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
