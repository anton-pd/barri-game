import type { InterfaceLanguage } from '@/types';

export type { InterfaceLanguage };

export const INTERFACE_LANGUAGES = ['uk', 'en', 'es'] as const;

export const INTERFACE_LANGUAGE_LABELS: Record<InterfaceLanguage, string> = {
  uk: 'УК',
  en: 'EN',
  es: 'ES',
};

export const INTERFACE_LANGUAGE_NAMES: Record<InterfaceLanguage, string> = {
  uk: 'Українська',
  en: 'English',
  es: 'Español',
};

export function normalizeInterfaceLanguage(value: unknown): InterfaceLanguage {
  return value === 'en' || value === 'es' || value === 'uk' ? value : 'uk';
}

export function gameLanguageForInterface(lang: InterfaceLanguage): 'uk' | 'en' {
  return lang === 'uk' ? 'uk' : 'en';
}
