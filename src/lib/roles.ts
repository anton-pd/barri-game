// CHANGED: Added rulesetId to all presets. Scenario-specific roles
// (private_investigator, telegraph_reporter) kept here for backward compat.
// Use getRolesForScenario() to get roles scoped to a scenario.
import type { Player, InventoryItem, Scenario } from '@/types';

export interface RolePreset {
  id: string;
  name: string;
  description: string;
  rulesetId?: string;
  hp: number;
  sanity: number;
  luck: number;
  skills: Record<string, number>;
  inventory: InventoryItem[];
  background: string;
}

export const ROLE_PRESETS: RolePreset[] = [
  // ── Стандартні ролі ───────────────────────────────────────────────────────
  {
    id: 'detective',
    rulesetId: 'coc_7e',
    name: 'Детектив',
    description: 'Колишній поліцейський. Слідчий з бездоганним нюхом на брехню.',
    hp: 12,
    sanity: 65,
    luck: 50,
    skills: {
      'Слухати': 70, 'Переконання': 65, 'Право': 60,
      'Рукопашний бій': 55, 'Вогнепальна зброя': 55,
      'Психологія': 50, 'Помітити приховане': 55, 'Залякування': 60,
    },
    background: 'Досвідчений детектив із поліції. Вміє читати людей і ситуації. Закон знає як свої п\'ять пальців.',
    inventory: [
      { id: 'badge', name: 'Бейдж детектива', description: 'Відкриває двері та розв\'язує язики. Авторитет поліції.', uses: -1 },
      { id: 'revolver', name: 'Службовий револьвер', description: '6 набоїв. .38 калібр.', uses: 6 },
      { id: 'handcuffs', name: 'Наручники', description: 'Можна зв\'язати або обмежити рух підозрюваного.', uses: 2 },
    ],
  },
  {
    id: 'journalist',
    rulesetId: 'coc_7e',
    name: 'Журналіст',
    description: 'Репортер-слідчий. Відкриває двері через слова та архіви.',
    hp: 8,
    sanity: 75,
    luck: 55,
    skills: {
      'Бібліотека': 75, 'Психологія': 65, 'Фотографія': 60,
      'Переконання': 55, 'Швидка мова': 55, 'Помітити приховане': 50,
      'Історія': 45, 'Слухати': 50,
    },
    background: 'Репортер-слідчий. Вміє розговорити будь-кого і знайти інформацію де її ніхто не шукає.',
    inventory: [
      { id: 'press_badge', name: 'Посвідчення преси', description: 'Дає доступ до публічних архівів і розташовує людей до розмови.', uses: -1 },
      { id: 'camera', name: 'Фотоапарат', description: 'Можна сфотографувати докази або підозрілі місця. 5 кадрів.', uses: 5 },
      { id: 'notepad', name: 'Блокнот з нотатками', description: 'Записи з попередніх розслідувань. +бонус до Бібліотеки при пошуку зв\'язків.', uses: -1 },
    ],
  },
  {
    id: 'doctor',
    rulesetId: 'coc_7e',
    name: 'Лікар',
    description: 'Медик з психіатричним нахилом. Тримає команду живою.',
    hp: 10,
    sanity: 70,
    luck: 50,
    skills: {
      'Медицина': 80, 'Перша допомога': 75, 'Наука': 65,
      'Психологія': 60, 'Переконання': 50, 'Бібліотека': 50,
      'Латинь': 40, 'Помітити приховане': 45,
    },
    background: 'Лікар з психіатричним досвідом. Вміє стабілізувати поранених і читати психологічні стани.',
    inventory: [
      { id: 'medkit', name: 'Медична сумка', description: 'Перев\'язки, ліки. Відновлює 2 HP при використанні.', uses: 3 },
      { id: 'morphine', name: 'Морфін', description: 'Заспокоює паніку, знімає біль. Відновлює 5 Стійкості.', uses: 2 },
      { id: 'stethoscope', name: 'Стетоскоп', description: 'Прослухати стіни, двері, живі організми. Бонус до Медицини.', uses: -1 },
    ],
  },
  {
    id: 'antiquarian',
    rulesetId: 'coc_7e',
    name: 'Антиквар',
    description: 'Знавець старовини й окультизму. Бачить те, що інші ігнорують.',
    hp: 8,
    sanity: 60,
    luck: 50,
    skills: {
      'Окультизм': 75, 'Бібліотека': 70, 'Оцінка артефактів': 65,
      'Мови': 55, 'Помітити приховане': 60, 'Історія': 60,
      'Психологія': 40, 'Слухати': 45,
    },
    background: 'Знавець старовини і темних мистецтв. Бачить містичні зв\'язки там де інші бачать збіг.',
    inventory: [
      { id: 'occult_book', name: 'Довідник з окультизму', description: 'Визначити ритуали, символи, прокляття. Бонус до Окультизму.', uses: -1 },
      { id: 'magnifier', name: 'Лупа', description: 'Детальний огляд предметів і написів. Бонус до пошуку прихованого.', uses: -1 },
      { id: 'amulet', name: 'Захисний амулет', description: 'Одноразовий захист від втрати Стійкості при зустрічі з надприродним.', uses: 1 },
    ],
  },
  {
    id: 'soldier',
    rulesetId: 'coc_7e',
    name: 'Ветеран',
    description: 'Солдат Першої світової. Міцний тілом, але надприродне його зламає.',
    hp: 14,
    sanity: 55,
    luck: 45,
    skills: {
      'Вогнепальна зброя': 75, 'Перша допомога': 60, 'Слухати': 65,
      'Механіка': 50, 'Рукопашний бій': 65, 'Залякування': 55,
      'Виживання': 50, 'Помітити приховане': 50,
    },
    background: 'Ветеран Першої світової. Бачив смерть і не боїться її — але надприродне його зламає.',
    inventory: [
      { id: 'pistol', name: 'Військовий пістолет', description: '8 набоїв. Надійна зброя часів війни.', uses: 8 },
      { id: 'knife', name: 'Бойовий ніж', description: 'Зближений бій. Завжди поруч.', uses: -1 },
      { id: 'field_dressing', name: 'Польовий бинт', description: 'Швидка перев\'язка в бою. Відновлює 3 HP.', uses: 2 },
    ],
  },

  // ── Детальні ролі для "Остання Телеграма" ────────────────────────────────
  {
    id: 'private_investigator',
    rulesetId: 'coc_7e',
    name: 'Приватний детектив',
    description: 'Колишній агент Пінкертона. Бачив надто багато, щоб дивуватися. П\'є забагато, щоб забути.',
    hp: 13,
    sanity: 50,
    luck: 55,
    skills: {
      // Бойові
      'Рукопашний бій': 60,
      'Вогнепальна зброя (пістолет)': 65,
      'Ухилення': 40,
      // Соціальні
      'Залякування': 65,
      'Переконання': 55,
      'Психологія': 60,
      'Швидка мова': 40,
      // Слідчі
      'Помітити приховане': 65,
      'Слухати': 55,
      'Бібліотека': 50,
      'Відслідкувати': 45,
      'Злом замків': 35,
      // Спеціальні
      'Право': 45,
      'Перша допомога': 35,
    },
    background: 'Колишній агент Пінкертона. 15 років охорони промисловців і придушення страйків. У 1919-му під час сталевих страйків у Пітсбурзі партнер Джо зник за нез\'ясованих обставин — офіційна версія "нещасний випадок" не тримається. Те що Калаган бачив тієї ночі у сталеплавильному цеху не вкладається в жоден рапорт. Відкрив власне бюро в Бостоні. Бере справи де поліція пасує або де є гроші. П\'є достатньо щоб спати. ПЕРК — "Нюх Пінкертона": 15 років польової роботи дозволяють розпізнати брехню, засідку або підготовлену сцену злочину — при огляді місця отримує бонусний кубик на Psychology та Spot Hidden.',
    inventory: [
      { id: 'revolver_38', name: 'Кольт .38 (6 набоїв)', description: 'Особистий револьвер. Надійний і добре знайомий.', uses: 6 },
      { id: 'pi_badge', name: 'Ліцензія детектива', description: 'Приватна ліцензія штату Массачусетс. Відкриває деякі двері, не всі.', uses: -1 },
      { id: 'lockpicks', name: 'Відмички', description: 'Компактний набір. +бонус до Злому замків.', uses: -1 },
      { id: 'flask', name: 'Фляга з бурбоном', description: 'Завжди при собі. Не лікує, але допомагає думати.', uses: -1 },
    ],
  },
  {
    id: 'telegraph_reporter',
    rulesetId: 'coc_7e',
    name: 'Репортер-телеграфістка',
    description: 'Колишня телеграфістка, тепер репортер Boston Evening Courier. Знає мову дротів. Отримала ту саму телеграму.',
    hp: 9,
    sanity: 65,
    luck: 65,
    skills: {
      // Дослідницькі
      'Бібліотека': 75,
      'Помітити приховане': 55,
      'Слухати': 65,
      'Історія': 55,
      // Соціальні
      'Психологія': 60,
      'Переконання': 65,
      'Швидка мова': 55,
      'Чарівність': 50,
      // Спеціальні
      'Азбука Морзе і телеграф': 90,
      'Фотографія': 55,
      'Електрика': 40,
      'Окультизм': 25,
      // Базові
      'Перша допомога': 35,
      'Ухилення': 30,
    },
    background: 'Елеонора Марш (або власне ім\'я). Телеграфістка з 1912 по 1918 — навчена самим Едгаром Вітмором, якого знала як "Містера В". Залишила телеграф 1919-го коли повернулись солдати. Зараз пише для Boston Evening Courier, спеціалізується на кримінальній хроніці. Отримала анонімну телеграму — і впізнала характерний "ритм" Вітмора в передачі, кожен телеграфіст має власний. ПЕРК — "Мова дротів": знає азбуку Морзе досконало; будь-яку телеграму або морзеанський шифр читає автоматично без кидка; при роботі з телеграфним обладнанням отримує бонусний кубик; єдина хто може спробувати відповісти "Голосу" через телеграфний ключ.',
    inventory: [
      { id: 'press_badge_adv', name: 'Посвідчення Boston Evening Courier', description: 'Відкриває двері архівів, поліційних записів, публічних установ.', uses: -1 },
      { id: 'graflex_camera', name: 'Graflex Camera (5 кадрів)', description: 'Професійний прес-фотоапарат. Фотодокази мають юридичну вагу.', uses: 5 },
      { id: 'telegraph_key', name: 'Телеграфний ключ Вітмора', description: 'Особистий ключ Едгара Вітмора — він подарував його при навчанні. ОСОБЛИВА ДІЯ: дозволяє спробувати зв\'язатися з Голосом через будь-яке обладнання.', uses: -1 },
      { id: 'reporter_notepad', name: 'Блокнот репортера', description: 'Нотатки з попередніх розслідувань. При дослідженні архівів — бонусний кубик.', uses: -1 },
    ],
  },
];

// CHANGED: Load roles from scenario if present, otherwise fallback to global presets
export function getRolesForScenario(scenario: Scenario): RolePreset[] {
  if (scenario.rolePresets && scenario.rolePresets.length > 0) {
    const supported = scenario.supportedRoles ?? [];
    return scenario.rolePresets.filter((r) =>
      supported.length === 0 || supported.includes(r.id)
    ) as RolePreset[];
  }
  // Fallback to global role presets
  const supported = scenario.supportedRoles;
  if (!supported || supported.length === 0) return ROLE_PRESETS;
  return ROLE_PRESETS.filter((r) => supported.includes(r.id));
}

export function makePlayer(name: string, preset: RolePreset): Player {
  return {
    name,
    role: preset.name,
    roleId: preset.id,
    hp: preset.hp,
    maxHp: preset.hp,
    sanity: preset.sanity,
    maxSanity: preset.sanity,
    luck: preset.luck,
    maxLuck: preset.luck,
    skills: preset.skills,
    inventory: preset.inventory.map((item) => ({ ...item })),
    background: preset.background,
  };
}
