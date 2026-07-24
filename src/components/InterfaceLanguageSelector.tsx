'use client';

import {
  INTERFACE_LANGUAGE_LABELS,
  INTERFACE_LANGUAGE_NAMES,
  INTERFACE_LANGUAGES,
  type InterfaceLanguage,
} from '@/lib/interfaceLanguage';

export function InterfaceLanguageSelector({
  value,
  onChange,
  className = '',
  ariaLabel = 'Interface language',
}: {
  value: InterfaceLanguage;
  onChange: (lang: InterfaceLanguage) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {INTERFACE_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          className={value === lang ? 'active' : ''}
          onClick={() => onChange(lang)}
          aria-pressed={value === lang}
          title={INTERFACE_LANGUAGE_NAMES[lang]}
        >
          {INTERFACE_LANGUAGE_LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
