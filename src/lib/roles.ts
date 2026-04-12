import type { Player } from '@/types';

export interface RolePreset {
  id: string;
  name: string;
  description: string;
  hp: number;
  sanity: number;
  skills: Record<string, number>;
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'detective',
    name: 'Детектив',
    description: 'Колишній поліцейський. Слідчий з бездоганним нюхом на брехню.',
    hp: 12,
    sanity: 65,
    skills: { 'Слухати': 70, 'Переконання': 65, 'Право': 60, 'Рукопашний бій': 55 },
  },
  {
    id: 'journalist',
    name: 'Журналіст',
    description: 'Репортер-слідчий. Відкриває двері через слова та архіви.',
    hp: 8,
    sanity: 75,
    skills: { 'Бібліотека': 75, 'Психологія': 65, 'Фотографія': 60, 'Переконання': 55 },
  },
  {
    id: 'doctor',
    name: 'Лікар',
    description: 'Медик з психіатричним нахилом. Тримає команду живою.',
    hp: 10,
    sanity: 70,
    skills: { 'Медицина': 80, 'Перша допомога': 75, 'Наука': 65, 'Психологія': 55 },
  },
  {
    id: 'antiquarian',
    name: 'Антиквар',
    description: 'Знавець старовини й окультизму. Бачить те, що інші ігнорують.',
    hp: 8,
    sanity: 60,
    skills: { 'Окультизм': 75, 'Бібліотека': 70, 'Оцінка артефактів': 65, 'Мови': 55 },
  },
  {
    id: 'soldier',
    name: 'Ветеран',
    description: 'Солдат Першої світової. Міцний тілом, але надприродне його зламає.',
    hp: 14,
    sanity: 55,
    skills: { 'Вогнепальна зброя': 75, 'Перша допомога': 60, 'Слухати': 65, 'Механіка': 50 },
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
  };
}
