// ANT-183: canonical skill-name alias groups bridging the two sheet languages.
// Character sheets exist in both languages in production: live scenario
// rolePresets use English CoC skill names ("Spot Hidden"), while the global
// fallback presets in roles.ts are Ukrainian («Помітити приховане»). The
// ruleset prompt block also names skills; whichever language the model picks
// for a [SET_PENDING_ROLL] tag, the server must still find the skill on the
// sheet — otherwise the ANT-119 value validation is silently bypassed.
import type { Player } from '@/types';
import { resolvePlayerStats } from './statUtils';

// Each group lists display-name variants of ONE skill (en + uk + common
// spellings). Order inside a group does not matter.
const ALIAS_GROUPS: string[][] = [
  ['Spot Hidden', 'Помітити приховане'],
  ['Listen', 'Слухати'],
  ['Persuade', 'Persuasion', 'Переконання'],
  ['Intimidate', 'Intimidation', 'Залякування'],
  ['Fast Talk', 'Швидка мова'],
  ['Charm', 'Чарівність'],
  ['Psychology', 'Психологія'],
  ['Library Use', 'Бібліотека'],
  ['Occult', 'Окультизм'],
  ['History', 'Історія'],
  ['Medicine', 'Медицина'],
  ['Law', 'Право'],
  ['Science', 'Наука'],
  ['Biology', 'Біологія'],
  ['Accounting', 'Бухгалтерія'],
  ['Anthropology', 'Антропологія'],
  ['Journalism', 'Журналістика'],
  ['Appraise', 'Оцінка артефактів', 'Оцінка'],
  ['Latin', 'Language (Latin)', 'Латинь'],
  ['Other Language', 'Languages', 'Мови'],
  ['Fighting', 'Fighting (Brawl)', 'Brawl', 'Рукопашний бій'],
  ['Firearms', 'Firearms (Handgun)', 'Handgun', 'Вогнепальна зброя'],
  ['Dodge', 'Ухилення'],
  ['Stealth', 'Скрадання', 'Непомітність'],
  ['Track', 'Відслідкувати'],
  ['Locksmith', 'Злом замків', 'Злам замків'],
  ['First Aid', 'Перша допомога'],
  ['Mechanical Repair', 'Mechanics', 'Механіка'],
  ['Electrical Repair', 'Електрика'],
  ['Drive Auto', 'Водіння', 'Водіння авто'],
  ['Climb', 'Лазіння'],
  ['Jump', 'Стрибки'],
  ['Swim', 'Плавання'],
  ['Survival', 'Виживання'],
  ['Photography', 'Фотографія'],
  ['Forbidden Lore', 'Заборонені знання', 'Cthulhu Mythos', 'Міфи Ктулху'],
];

// SAN and Luck rolls target stats, not sheet skills — the ruleset block asks
// for «Кинь Стійкість» / "Roll Luck" and no sheet lists those as skills.
const STAT_ROLL_NAMES: Record<'luck' | 'sanity', string[]> = {
  luck: ['luck', 'удача'],
  sanity: ['sanity', 'stability', 'san', 'стійкість', 'сан', 'глузд', 'розсудливість'],
};

interface ParsedName {
  full: string;
  base: string;
  qual: string | null;
}

// "Firearms (Handgun)" → base "firearms", qual "handgun". Qualifier-aware so
// a bare tag ("Вогнепальна зброя") matches a specialized sheet entry
// («Вогнепальна зброя (пістолет)»), but two DIFFERENT specializations of the
// same base never cross-match ("Language (Spanish)" ≠ "Language (Catalan)").
function parseName(raw: string): ParsedName {
  const full = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const m = full.match(/^(.*?)\s*\(([^)]*)\)$/);
  if (m && m[1].trim()) {
    return { full, base: m[1].trim(), qual: m[2].trim() || null };
  }
  return { full, base: full, qual: null };
}

function namesMatch(a: string, b: string): boolean {
  const pa = parseName(a);
  const pb = parseName(b);
  if (pa.full === pb.full) return true;
  return pa.base !== '' && pa.base === pb.base && (!pa.qual || !pb.qual);
}

function findGroup(rawName: string): string[] | null {
  const full = parseName(rawName).full;
  // Exact full-name membership wins over base-name matches so that
  // "Language (Latin)" lands in the Latin group, not a generic-language one.
  for (const group of ALIAS_GROUPS) {
    if (group.some((n) => parseName(n).full === full)) return group;
  }
  for (const group of ALIAS_GROUPS) {
    if (group.some((n) => namesMatch(n, rawName))) return group;
  }
  return null;
}

/** All known display-name variants for a skill, the name itself included. */
export function skillAliasNames(rawName: string): string[] {
  const group = findGroup(rawName) ?? [];
  const out = [rawName.trim()];
  for (const n of group) {
    if (parseName(n).full !== parseName(rawName).full) out.push(n);
  }
  return out;
}

/**
 * Find a skill on a character sheet by any known name variant.
 * Match order: exact (ci) → qualifier-aware base match → alias group.
 */
export function resolveSkillOnSheet(
  skills: Record<string, number> | undefined,
  rawName: string
): { name: string; value: number } | null {
  const entries = Object.entries(skills ?? {});
  if (!entries.length) return null;

  const full = parseName(rawName).full;
  const direct = entries.find(([k]) => parseName(k).full === full);
  if (direct) return { name: direct[0], value: direct[1] };

  const fuzzy = entries.find(([k]) => namesMatch(k, rawName));
  if (fuzzy) return { name: fuzzy[0], value: fuzzy[1] };

  for (const cand of skillAliasNames(rawName)) {
    const hit = entries.find(([k]) => namesMatch(k, cand));
    if (hit) return { name: hit[0], value: hit[1] };
  }
  return null;
}

/** Detect a stat-targeting roll name (Luck / SAN in either language). */
export function resolveStatForRoll(rawName: string): 'luck' | 'sanity' | null {
  const base = parseName(rawName).base;
  if (STAT_ROLL_NAMES.luck.includes(base)) return 'luck';
  if (STAT_ROLL_NAMES.sanity.includes(base)) return 'sanity';
  return null;
}

/**
 * Resolve the roll-under target for a [SET_PENDING_ROLL] skill name against
 * the character: sheet skills first (via aliases), then Luck/SAN stats.
 * Returns null when the name is unknown — the caller keeps the LLM's values.
 */
export function resolveRollSkillValue(
  player: Player,
  rulesetId: string | undefined | null,
  rawName: string
): { value: number; source: 'skill' | 'stat' } | null {
  const skill = resolveSkillOnSheet(player.skills, rawName);
  if (skill) return { value: skill.value, source: 'skill' };

  const statId = resolveStatForRoll(rawName);
  if (statId) {
    const stat = resolvePlayerStats(player, rulesetId).find((s) => s.id === statId);
    if (stat) return { value: stat.value, source: 'stat' };
  }
  return null;
}
