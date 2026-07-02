// CHANGED: New file — ruleset configurations for different RPG systems
// ANT-64: buildRulesetPromptBlock now accepts a language ('uk' | 'en') so the
// dice-rules section matches the session language.
import type { RulesetConfig } from '@/types';

export const RULESETS: Record<string, RulesetConfig> = {
  coc_7e: {
    id: 'coc_7e',
    name: 'Call of Cthulhu 7th Edition',
    diceType: 'percentile',
    stats: [
      { id: 'hp',     label: 'HP',   color: '#e05555', hasMax: true,  defaultValue: 10 },
      { id: 'sanity', label: 'SAN',  color: '#5577dd', hasMax: true,  defaultValue: 65 },
      { id: 'luck',   label: 'LUCK', color: '#4aaa66', hasMax: true,  defaultValue: 50 },
    ],
    skillCheckFormat: 'Roll 1D100 under skill value. Lower = better.',
  },

  kids_on_bikes: {
    id: 'kids_on_bikes',
    name: 'Kids on Bikes',
    diceType: 'stat_vs_difficulty',
    stats: [
      { id: 'brains', label: 'Brains', color: '#5577dd', hasMax: false, defaultValue: 8  },
      { id: 'brawn',  label: 'Brawn',  color: '#e05555', hasMax: false, defaultValue: 6  },
      { id: 'fight',  label: 'Fight',  color: '#cc3333', hasMax: false, defaultValue: 4  },
      { id: 'flight', label: 'Flight', color: '#4aaa66', hasMax: false, defaultValue: 6  },
      { id: 'charm',  label: 'Charm',  color: '#c8a96e', hasMax: false, defaultValue: 8  },
      { id: 'grit',   label: 'Grit',   color: '#888888', hasMax: false, defaultValue: 6  },
    ],
    skillCheckFormat: 'Roll the stat die. Roll >= difficulty = success. Natural max = Lucky Break (roll again, add).',
  },

  dnd_5e: {
    id: 'dnd_5e',
    name: 'Dungeons & Dragons 5e',
    diceType: 'd20',
    stats: [
      { id: 'hp',          label: 'HP',    color: '#e05555', hasMax: true,  defaultValue: 10 },
      { id: 'ac',          label: 'AC',    color: '#5577dd', hasMax: false, defaultValue: 10 },
      { id: 'spell_slots', label: 'Slots', color: '#c8a96e', hasMax: true,  defaultValue: 0  },
    ],
    skillCheckFormat: 'Roll 1D20 + modifier vs DC. Natural 20 = critical success.',
  },
};

export function getRuleset(id: string): RulesetConfig {
  const ruleset = RULESETS[id];
  if (!ruleset) throw new Error(`Unknown ruleset: ${id}`);
  return ruleset;
}

// The virtual-dice pipeline ([SET_PENDING_ROLL] → DiceRoller → numeric result)
// implements d100 roll-under only. Other systems resolve rolls in plain text —
// injecting the tag protocol for them contradicts their own dice rules and
// would render inverted success/fail verdicts in the d100 roller (ANT-120).
export function supportsPendingRollTag(rulesetId: string | undefined | null): boolean {
  const r = rulesetId ? RULESETS[rulesetId] : undefined;
  return (r ?? RULESETS.coc_7e).diceType === 'percentile';
}

type Lang = 'uk' | 'en';

// Generates the ruleset rules block for the system prompt.
// This block is cached separately from scenario content.
export function buildRulesetPromptBlock(rulesetId: string, lang: Lang = 'uk'): string {
  if (rulesetId === 'coc_7e') {
    if (lang === 'en') {
      return `## DICE RULES (Call of Cthulhu 7e)

### When to ask for a roll
Ask ONLY when the player clearly attempts something with a risk of failure:
- Searches for something hidden → Spot Hidden
- Listens → Listen
- Persuades/intimidates an NPC → Persuade/Intimidate/Fast Talk
- Analyzes NPC behavior → Psychology
- Searches archives → Library Use
- Specialist knowledge → Occult/History/Medicine/Law etc.
- Sneaking → Stealth
- Picking locks → Locksmith
- First aid → First Aid
- Combat → Fighting/Firearms (ALWAYS)
The character sheet may name skills in English or Ukrainian — in the tag, use the name EXACTLY as written in that player's Skills list.

### Reactive rolls — the world acts on the player
When a threat may notice / catch / harm the character, do NOT resolve it by narration — ask for the matching roll:
- Someone searches the room while the player hides; a guard sweeps a flashlight toward the hiding spot → Stealth
- A chase, falling debris, a sudden attack → Dodge
- A noise the player must catch in time → Listen
- An NPC may spot a lie or a sneaking player → Stealth (or opposed skill)
- No skill fits → Luck (1d100, need Luck or less)
NEVER resolve "did the threat notice / reach / hit the character" by narration alone — that outcome MUST go through a roll.

### Roll cadence
In a tense or dangerous scene, roughly every 2nd–3rd meaningful action should go through a roll. NEVER more than ONE [SET_PENDING_ROLL] per response. Trivial actions (talking, walking in safety) still never trigger a roll.

Do NOT ask for: normal conversation, walking, trivial actions.
Hidden details, traces and clues are revealed ONLY through a successful roll — never give them away for free in narration.

### If a skill is NOT in the player's list
Check the player's skill list BEFORE every roll request.
- Skill IS in the list → ask for the roll with the exact value.
- Skill is NOT in the list → do NOT ask for a roll. Instead:
  • Describe narratively why the character cannot do this (untrained, no tools, etc.).
  • OR find a related skill from the list and offer it as a substitute (e.g. Electrical Repair instead of Locksmith for an electric lock).
  • OR if the situation allows, ask for a Luck roll (1d100, need Luck or less).
Never set a threshold below 10 in [SET_PENDING_ROLL].

### How to ask for a roll — MANDATORY order
EVERY roll (skill, SAN, Luck, combat) requires a tag. Plain "Roll X" without a tag is not enough.

1. Write the text: "Roll [Skill] (1d100, need X or less)"
2. Immediately at the end of the response place the tag: [SET_PENDING_ROLL:playerIdx:Skill:value:threshold:context]
   - playerIdx: 0, 1, 2… (player index)
   - Skill: name EXACTLY as it appears in the player's Skills list (same language as the sheet)
   - value: exact skill number
   - threshold: the same number (for Regular success)
   - context: one sentence describing what this roll decides
3. Stop. Do not describe consequences until you get a number from the player.
4. After the number — branch: ≤ threshold = success, > threshold = failure.

### Example of a correct roll response
The flashlight beam crawls under the stairs. Something glints dully in the dust — too even a gleam for stone.
Roll Spot Hidden (1d100, need 45 or less).
[SET_PENDING_ROLL:0:Spot Hidden:45:45:Will the investigator notice the object under the stairs]

### Example of a reactive roll (threat acts on the player)
The door bangs open and two guards step in, boots heavy on the boards. A flashlight beam swings across the shelves — closer, closer to the gap where you crouch.
Roll Stealth (1d100, need 40 or less).
[SET_PENDING_ROLL:0:Stealth:40:40:Will the investigator stay unnoticed behind the shelf]

### Results
- ≤ X/5 → Extreme success: maximum detail, reveals an NPC secret
- ≤ X/2 → Hard success: extra detail, advantage
- ≤ X   → Regular success
- > X   → Fail: nothing or a wrong interpretation
- 96-100 → Fumble: complication, new danger

### SAN checks
- Corpse/violence: "Roll Stability (1d100, need X or less)" + [SET_PENDING_ROLL:idx:Stability:X:X:SAN check — corpse/violence]
- Supernatural: same with context "SAN check — supernatural"
- Mythos: same with context "SAN check — Mythos"
On the result → [DELTA] with the appropriate SAN loss.

### Luck roll
"Roll Luck (1d100, need X or less)" + [SET_PENDING_ROLL:idx:Luck:X:X:Luck check]
On failure → [DELTA] with Luck spend.

### Pushed roll
On failure (not a fumble): "You can try again — but if you fail, [consequences]."
A pushed roll is IMPOSSIBLE in combat.`;
    }
    return `## ПРАВИЛА КУБИКІВ (Call of Cthulhu 7e)

### Коли питати кидок
Питай ТІЛЬКИ коли гравець явно намагається щось зробити з ризиком провалу:
- Шукає приховане → Spot Hidden / Помітити приховане
- Прислуховується → Listen / Слухати
- Переконує/залякує NPC → Persuade / Переконання, Intimidate / Залякування, Fast Talk / Швидка мова
- Аналізує поведінку NPC → Psychology / Психологія
- Шукає в архівах → Library Use / Бібліотека
- Спеціальні знання → Occult / Окультизм, History / Історія, Medicine / Медицина, Law / Право тощо
- Непомітні дії → Stealth / Скрадання
- Злом замків → Locksmith / Злом замків
- Перша допомога → First Aid / Перша допомога
- Бій → Fighting / Рукопашний бій, Firearms / Вогнепальна зброя (ЗАВЖДИ)
Аркуш персонажа може називати навички англійською або українською — у тегу вживай назву ТОЧНО так, як вона записана в списку Навички цього гравця.

### Реактивні кидки — світ діє на гравця
Коли загроза може помітити / наздогнати / зашкодити персонажу — НЕ вирішуй це наративом, попроси відповідний кидок:
- Хтось обшукує кімнату, поки гравець ховається; вартовий веде промінь ліхтаря до схованки → Stealth
- Погоня, падіння уламків, раптовий напад → Dodge
- Шум, який гравець мусить вчасно вловити → Listen
- NPC може помітити брехню чи гравця, що крадеться → Stealth (або протиставлена навичка)
- Жодна навичка не пасує → Luck (1к100, треба Luck або менше)
НІКОЛИ не вирішуй "чи помітили / наздогнали / влучили в персонажа" самим наративом — цей результат МУСИТЬ пройти через кидок.

### Частота кидків
У напруженій чи небезпечній сцені приблизно кожна 2-га–3-тя значуща дія має проходити через кидок. НІКОЛИ не став більше ОДНОГО [SET_PENDING_ROLL] за відповідь. Тривіальні дії (розмова, ходьба в безпеці) кидок усе одно не викликають.

НЕ питай: звичайна розмова, ходьба, тривіальні дії.
Приховані деталі, сліди й підказки видавай ЛИШЕ через успішний кидок — не розкривай їх у наративі безкоштовно.

### Якщо навичка відсутня в списку гравця
Перед кожним запитом кидка перевіряй список навичок гравця.
- Навичка Є в списку → питай кидок з точним значенням.
- Навичка ВІДСУТНЯ в списку → НЕ питай кидок. Натомість:
  • Опиши наративно, чому персонаж не може це зробити (не навчений, немає інструментів тощо).
  • АБО знайди суміжну навичку зі списку та запропонуй її як заміну (напр. Electrical Repair замість Locksmith для електричного замку).
  • АБО якщо ситуація дозволяє — запитай Удачу (1к100, треба Luck або менше).
Ніколи не встановлюй поріг < 10 у тегу [SET_PENDING_ROLL].

### Як запитувати кидок — ОБОВ'ЯЗКОВИЙ порядок
КОЖЕН кидок (будь-який: навичка, SAN, Удача, Бій) вимагає тегу. Текстового "Кинь X" без тегу — недостатньо.

1. Напиши текст: "Кинь [Навичка] (1к100, треба X або менше)"
2. Одразу в кінці відповіді постав тег: [SET_PENDING_ROLL:playerIdx:Навичка:значення:поріг:контекст]
   - playerIdx: 0, 1, 2... (індекс гравця)
   - Навичка: назва ТОЧНО як у списку Навички гравця (тією ж мовою, що на аркуші)
   - значення: точне число навички
   - поріг: те саме число (для Regular success)
   - контекст: одне речення що вирішується цим кидком
3. Зупинись. Не описуй наслідки поки не отримаєш число від гравця.
4. Після числа — розгалужуй: ≤ поріг = успіх, > поріг = провал.

### Приклад правильної відповіді з кидком
Промінь ліхтарика повзе попід сходами. Серед пилу щось тьмяно зблискує — надто рівний відблиск для каменю.
Кинь Spot Hidden (1к100, треба 45 або менше).
[SET_PENDING_ROLL:0:Spot Hidden:45:45:Чи помітить слідчий предмет під сходами]

### Приклад реактивного кидка (загроза діє на гравця)
Двері з гуркотом розчахуються, заходять двоє вартових, чоботи важко гупають по дошках. Промінь ліхтаря ковзає по стелажах — ближче, ближче до щілини, де ти зачаївся.
Кинь Stealth (1к100, треба 40 або менше).
[SET_PENDING_ROLL:0:Stealth:40:40:Чи залишиться слідчий непоміченим за стелажем]

### Результати
- ≤ X/5 → Extreme success: максимум деталей, розкриває секрет NPC
- ≤ X/2 → Hard success: додаткова деталь, перевага
- ≤ X   → Regular success
- > X   → Fail: нічого або хибна інтерпретація
- 96-100 → Fumble: ускладнення, нова небезпека

### SAN checks
- Труп/насилля: "Кинь Стійкість (1к100, треба X або менше)" + [SET_PENDING_ROLL:idx:Стійкість:X:X:SAN check — труп/насилля]
- Надприродне: те саме з контекстом "SAN check — надприродне"
- Mythos: те саме з контекстом "SAN check — Mythos"
Результат кидка → [DELTA] з відповідною втратою SAN.

### Luck roll
"Кинь Удачу (1к100, треба X або менше)" + [SET_PENDING_ROLL:idx:Удача:X:X:Luck check]
При провалі → [DELTA] з витратою Luck.

### Pushed roll
При провалі (не фумблі): "Можеш спробувати ще раз — але якщо провалиш, [наслідки]."
Pushed roll НЕМОЖЛИВИЙ у бою.`;
  }

  if (rulesetId === 'kids_on_bikes') {
    if (lang === 'en') {
      return `## DICE RULES (Kids on Bikes)

### Stats and dice
Each stat is tied to a die (d4/d6/d8/d10/d12/d20). Bigger die = better in that area.

### When to ask for a roll
Only in dramatic situations with an uncertain outcome:
- Brains: analysis, search, memory, solving puzzles
- Brawn: physical strength, lifting, swimming
- Fight: combat, intimidation, threats
- Flight: running, dodging, driving, speed
- Charm: persuasion, deception, social interaction
- Grit: resisting fear, endurance, willpower

### Roll format
"Roll [Stat]. Need X or more." — where X is the difficulty (usually 5–15).

### Resolving rolls
Ask for the roll in plain text and wait for the player to report their result in chat.
Do NOT use [SET_PENDING_ROLL] — it is a d100-only mechanism and is not available in this system.

### Results
- Roll >= difficulty → Success
- Roll < difficulty → Failure
- Natural max on the die → Lucky Break: roll again, add the result

### Adversity Tokens
Players start with 3 tokens.
- Spend: +1 to a roll per token
- Gain: on failure +1 token (on Flaw-driven failure +2)
Keep the player informed of their current token count.

### Injuries
3 failures in a row → the character is drained; the next roll takes a penalty.`;
    }
    return `## ПРАВИЛА КУБИКІВ (Kids on Bikes)

### Характеристики і кубики
Кожна характеристика прив'язана до кубика (d4/d6/d8/d10/d12/d20).
Більший кубик = краще в цій сфері.

### Коли питати кидок
Тільки при драматичних ситуаціях з невизначеним результатом:
- Brains: аналіз, пошук, пам'ять, вирішення загадок
- Brawn: фізична сила, підняття, плавання
- Fight: бій, залякування, погрози
- Flight: втеча, ухилення, водіння, швидкість
- Charm: переконання, обман, соціальна взаємодія
- Grit: опір страху, витривалість, сила волі

### Формат кидка
"Кинь [Характеристика]. Потрібно X або більше."
де X = складність (зазвичай 5-15).

### Вирішення кидків
Проси кидок звичайним текстом і чекай, поки гравець повідомить результат у чаті.
НЕ використовуй [SET_PENDING_ROLL] — це механізм лише для d100 і в цій системі недоступний.

### Результати
- Roll >= складність → Успіх
- Roll < складність → Провал
- Natural max на кубику → Lucky Break: кидай ще раз, додай до результату

### Adversity Tokens
Гравці починають з 3 токенами.
- Витрачати: +1 до кидка per токен
- Отримувати: при провалі +1 токен (при провалі через Flaw +2)
Повідомляй гравця про поточний запас токенів.

### Травми
3 провали поспіль → персонаж виснажений, наступний кидок з пенальті.`;
  }

  return `## ПРАВИЛА КУБИКІВ (${rulesetId})
[Ruleset rules placeholder]
Кидки вирішуй звичайним текстом: проси кидок і чекай на результат від гравця.
НЕ використовуй [SET_PENDING_ROLL] — це механізм лише для d100-систем.`;
}
