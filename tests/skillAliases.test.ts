import { describe, it, expect } from 'vitest';
import {
  resolveSkillOnSheet,
  resolveStatForRoll,
  resolveRollSkillValue,
  skillAliasNames,
} from '@/lib/skillAliases';
import { makePlayer } from './fixtures';

const UK_SHEET = {
  'Помітити приховане': 65,
  'Слухати': 55,
  'Психологія': 60,
  'Вогнепальна зброя (пістолет)': 65,
  'Злом замків': 35,
  'Перша допомога': 35,
};

const EN_SHEET = {
  'Spot Hidden': 45,
  'Listen': 60,
  'Library Use': 70,
  'Firearms (Handgun)': 55,
  'Language (Catalan)': 50,
  'First Aid': 40,
};

describe('resolveSkillOnSheet', () => {
  it('matches exact names case-insensitively', () => {
    expect(resolveSkillOnSheet(EN_SHEET, 'spot hidden')).toEqual({ name: 'Spot Hidden', value: 45 });
    expect(resolveSkillOnSheet(UK_SHEET, 'психологія')).toEqual({ name: 'Психологія', value: 60 });
  });

  it('resolves an English tag name against a Ukrainian sheet', () => {
    expect(resolveSkillOnSheet(UK_SHEET, 'Spot Hidden')).toEqual({ name: 'Помітити приховане', value: 65 });
    expect(resolveSkillOnSheet(UK_SHEET, 'Listen')).toEqual({ name: 'Слухати', value: 55 });
    expect(resolveSkillOnSheet(UK_SHEET, 'Locksmith')).toEqual({ name: 'Злом замків', value: 35 });
  });

  it('resolves a Ukrainian tag name against an English sheet', () => {
    expect(resolveSkillOnSheet(EN_SHEET, 'Помітити приховане')).toEqual({ name: 'Spot Hidden', value: 45 });
    expect(resolveSkillOnSheet(EN_SHEET, 'Бібліотека')).toEqual({ name: 'Library Use', value: 70 });
    expect(resolveSkillOnSheet(EN_SHEET, 'Перша допомога')).toEqual({ name: 'First Aid', value: 40 });
  });

  it('matches a bare base name against a specialized sheet entry', () => {
    expect(resolveSkillOnSheet(EN_SHEET, 'Firearms')).toEqual({ name: 'Firearms (Handgun)', value: 55 });
    expect(resolveSkillOnSheet(UK_SHEET, 'Вогнепальна зброя')).toEqual({
      name: 'Вогнепальна зброя (пістолет)',
      value: 65,
    });
    // Cross-language: uk alias base → en specialized entry
    expect(resolveSkillOnSheet(EN_SHEET, 'Вогнепальна зброя')).toEqual({
      name: 'Firearms (Handgun)',
      value: 55,
    });
  });

  it('never cross-matches two different specializations of the same base', () => {
    expect(resolveSkillOnSheet(EN_SHEET, 'Language (Spanish)')).toBeNull();
    expect(resolveSkillOnSheet(EN_SHEET, 'Language (Catalan)')).toEqual({
      name: 'Language (Catalan)',
      value: 50,
    });
  });

  it('returns null for unknown skills and empty sheets', () => {
    expect(resolveSkillOnSheet(EN_SHEET, 'Cthulhu Mythos')).toBeNull();
    expect(resolveSkillOnSheet({}, 'Listen')).toBeNull();
    expect(resolveSkillOnSheet(undefined, 'Listen')).toBeNull();
  });
});

describe('resolveStatForRoll', () => {
  it('detects Luck in both languages', () => {
    expect(resolveStatForRoll('Luck')).toBe('luck');
    expect(resolveStatForRoll('Удача')).toBe('luck');
    expect(resolveStatForRoll('удача')).toBe('luck');
  });

  it('detects SAN roll names in both languages', () => {
    expect(resolveStatForRoll('Sanity')).toBe('sanity');
    expect(resolveStatForRoll('Stability')).toBe('sanity');
    expect(resolveStatForRoll('Стійкість')).toBe('sanity');
  });

  it('returns null for regular skills', () => {
    expect(resolveStatForRoll('Listen')).toBeNull();
    expect(resolveStatForRoll('Помітити приховане')).toBeNull();
  });
});

describe('resolveRollSkillValue', () => {
  it('prefers the sheet skill and reports the source', () => {
    const player = makePlayer({ skills: UK_SHEET });
    expect(resolveRollSkillValue(player, 'coc_7e', 'Spot Hidden')).toEqual({
      value: 65,
      source: 'skill',
    });
  });

  it('falls through to Luck/SAN stats for stat-roll names', () => {
    const player = makePlayer({ skills: UK_SHEET, luck: 40, sanity: 55 });
    expect(resolveRollSkillValue(player, 'coc_7e', 'Удача')).toEqual({ value: 40, source: 'stat' });
    expect(resolveRollSkillValue(player, 'coc_7e', 'Стійкість')).toEqual({ value: 55, source: 'stat' });
    expect(resolveRollSkillValue(player, 'coc_7e', 'Sanity')).toEqual({ value: 55, source: 'stat' });
  });

  it('returns null for names on neither the sheet nor the stat list', () => {
    const player = makePlayer({ skills: EN_SHEET });
    expect(resolveRollSkillValue(player, 'coc_7e', 'Нюх Пінкертона')).toBeNull();
  });
});

describe('skillAliasNames', () => {
  it('expands a name to all known variants including itself first', () => {
    const names = skillAliasNames('Spot Hidden');
    expect(names[0]).toBe('Spot Hidden');
    expect(names).toContain('Помітити приховане');
  });

  it('returns just the name itself for unknown skills', () => {
    expect(skillAliasNames('Нюх Пінкертона')).toEqual(['Нюх Пінкертона']);
  });
});
