// CHANGED: New file — ruleset configurations for different RPG systems
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

// Generates the ruleset rules block for the system prompt.
// This block is cached separately from scenario content.
export function buildRulesetPromptBlock(rulesetId: string): string {
  if (rulesetId === 'coc_7e') {
    return `## ПРАВИЛА КУБИКІВ (Call of Cthulhu 7e)

### Коли питати кидок
Питай ТІЛЬКИ коли гравець явно намагається щось зробити з ризиком провалу:
- Шукає приховане → Spot Hidden
- Прислуховується → Listen
- Переконує/залякує NPC → Persuade/Intimidate/Fast Talk
- Аналізує поведінку NPC → Psychology
- Шукає в архівах → Library Use
- Спеціальні знання → Occult/History/Medicine/Law тощо
- Непомітні дії → Stealth
- Злом замків → Locksmith
- Перша допомога → First Aid
- Бій → Fighting/Firearms (ЗАВЖДИ)
НЕ питай: звичайна розмова, ходьба, тривіальні дії.

### Як запитувати кидок — ОБОВ'ЯЗКОВИЙ порядок
КОЖЕН кидок (будь-який: навичка, SAN, Удача, Бій) вимагає тегу. Текстового "Кинь X" без тегу — недостатньо.

1. Напиши текст: "Кинь [Навичка] (1к100, треба X або менше)"
2. Одразу в кінці відповіді постав тег: [SET_PENDING_ROLL:playerIdx:Навичка:значення:поріг:контекст]
   - playerIdx: 0, 1, 2... (індекс гравця)
   - Навичка: назва (напр. Психологія)
   - значення: точне число навички
   - поріг: те саме число (для Regular success)
   - контекст: одне речення що вирішується цим кидком
3. Зупинись. Не описуй наслідки поки не отримаєш число від гравця.
4. Після числа — розгалужуй: ≤ поріг = успіх, > поріг = провал.

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

  return `## ПРАВИЛА КУБИКІВ (${rulesetId})\n[Ruleset rules placeholder]`;
}
