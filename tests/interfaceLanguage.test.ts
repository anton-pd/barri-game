import { describe, expect, it } from 'vitest';
import { gameLanguageForInterface, normalizeInterfaceLanguage } from '@/lib/interfaceLanguage';

describe('interface language preferences', () => {
  it('accepts supported interface languages', () => {
    expect(normalizeInterfaceLanguage('uk')).toBe('uk');
    expect(normalizeInterfaceLanguage('en')).toBe('en');
    expect(normalizeInterfaceLanguage('es')).toBe('es');
  });

  it('defaults unknown values to Ukrainian', () => {
    expect(normalizeInterfaceLanguage(undefined)).toBe('uk');
    expect(normalizeInterfaceLanguage('fr')).toBe('uk');
    expect(normalizeInterfaceLanguage('')).toBe('uk');
  });

  it('maps Spanish interface to English game language until Spanish sessions exist', () => {
    expect(gameLanguageForInterface('uk')).toBe('uk');
    expect(gameLanguageForInterface('en')).toBe('en');
    expect(gameLanguageForInterface('es')).toBe('en');
  });
});
