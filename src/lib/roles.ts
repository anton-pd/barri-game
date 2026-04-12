import type { Player, InventoryItem } from '@/types';

export interface RolePreset {
  id: string;
  name: string;
  description: string;
  hp: number;
  sanity: number;
  skills: Record<string, number>;
  inventory: InventoryItem[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'detective',
    name: 'Детектив',
    description: 'Колишній поліцейський. Слідчий з бездоганним нюхом на брехню.',
    hp: 12,
    sanity: 65,
    skills: { 'Слухати': 70, 'Переконання': 65, 'Право': 60, 'Рукопашний бій': 55 },
    inventory: [
      { id: 'badge', name: 'Бейдж детектива', description: 'Відкриває двері та розв\'язує язики. Авторитет поліції.', uses: -1 },
      { id: 'revolver', name: 'Службовий револьвер', description: '6 набоїв. .38 калібр.', uses: 6 },
      { id: 'handcuffs', name: 'Наручники', description: 'Можна зв\'язати або обмежити рух підозрюваного.', uses: 2 },
    ],
  },
  {
    id: 'journalist',
    name: 'Журналіст',
    description: 'Репортер-слідчий. Відкриває двері через слова та архіви.',
    hp: 8,
    sanity: 75,
    skills: { 'Бібліотека': 75, 'Психологія': 65, 'Фотографія': 60, 'Переконання': 55 },
    inventory: [
      { id: 'press_badge', name: 'Посвідчення преси', description: 'Дає доступ до публічних архівів і розташовує людей до розмови.', uses: -1 },
      { id: 'camera', name: 'Фотоапарат', description: 'Можна сфотографувати докази або підозрілі місця. 5 кадрів.', uses: 5 },
      { id: 'notepad', name: 'Блокнот з нотатками', description: 'Записи з попередніх розслідувань. +бонус до Бібліотеки при пошуку зв\'язків.', uses: -1 },
    ],
  },
  {
    id: 'doctor',
    name: 'Лікар',
    description: 'Медик з психіатричним нахилом. Тримає команду живою.',
    hp: 10,
    sanity: 70,
    skills: { 'Медицина': 80, 'Перша допомога': 75, 'Наука': 65, 'Психологія': 55 },
    inventory: [
      { id: 'medkit', name: 'Медична сумка', description: 'Перев\'язки, ліки. Відновлює 2 HP при використанні.', uses: 3 },
      { id: 'morphine', name: 'Морфін', description: 'Заспокоює паніку, знімає біль. Відновлює 5 Стійкості.', uses: 2 },
      { id: 'stethoscope', name: 'Стетоскоп', description: 'Прослухати стіни, двері, живі організми. Бонус до Медицини.', uses: -1 },
    ],
  },
  {
    id: 'antiquarian',
    name: 'Антиквар',
    description: 'Знавець старовини й окультизму. Бачить те, що інші ігнорують.',
    hp: 8,
    sanity: 60,
    skills: { 'Окультизм': 75, 'Бібліотека': 70, 'Оцінка артефактів': 65, 'Мови': 55 },
    inventory: [
      { id: 'occult_book', name: 'Довідник з окультизму', description: 'Визначити ритуали, символи, прокляття. Бонус до Окультизму.', uses: -1 },
      { id: 'magnifier', name: 'Лупа', description: 'Детальний огляд предметів і написів. Бонус до пошуку прихованого.', uses: -1 },
      { id: 'amulet', name: 'Захисний амулет', description: 'Одноразовий захист від втрати Стійкості при зустрічі з надприродним.', uses: 1 },
    ],
  },
  {
    id: 'soldier',
    name: 'Ветеран',
    description: 'Солдат Першої світової. Міцний тілом, але надприродне його зламає.',
    hp: 14,
    sanity: 55,
    skills: { 'Вогнепальна зброя': 75, 'Перша допомога': 60, 'Слухати': 65, 'Механіка': 50 },
    inventory: [
      { id: 'pistol', name: 'Військовий пістолет', description: '8 набоїв. Надійна зброя часів війни.', uses: 8 },
      { id: 'knife', name: 'Бойовий ніж', description: 'Зближений бій. Завжди поруч.', uses: -1 },
      { id: 'field_dressing', name: 'Польовий бинт', description: 'Швидка перев\'язка в бою. Відновлює 3 HP.', uses: 2 },
    ],
  },
];

export function makePlayer(name: string, preset: RolePreset): Player {
  return {
    name,
    role: preset.name,
    roleId: preset.id,
    hp: preset.hp,
    maxHp: preset.hp,
    sanity: preset.sanity,
    maxSanity: preset.sanity,
    skills: preset.skills,
    inventory: preset.inventory.map((item) => ({ ...item })),
  };
}
