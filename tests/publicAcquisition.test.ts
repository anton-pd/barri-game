import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '@/app/content';
import { DEMO_COPY } from '@/app/demo/DemoClient';

describe('public beta acquisition copy', () => {
  it('describes the demo as text-only, single-player, and capped at 10 AI turns or 15 minutes', () => {
    expect(CONTENT.en.hero.proofs).toEqual([
      'Text only',
      '1 investigator',
      '10 AI turns · 15 min',
    ]);
    expect(CONTENT.en.hero.lede).toContain('full beta adds voice and parties of 1–4 investigators');
    expect(DEMO_COPY.en.stageLabel).toContain('single-player text demo');
    expect(DEMO_COPY.en.description).toContain('10 AI turns or 15 minutes');

    const landing = readFileSync(new URL('../src/app/LandingClient.tsx', import.meta.url), 'utf8');
    expect(landing).toContain('10 AI turns / 15 min');
    expect(landing).not.toContain('Five minutes with the Case Curator');
    expect(landing).not.toContain('≈ 2 min');
  });

  it('keeps open and waitlist outcomes distinct in every locale', () => {
    for (const locale of ['en', 'uk', 'es'] as const) {
      const access = DEMO_COPY[locale].access;
      expect(access.open.action).not.toBe(access.waitlist.action);
      expect(access.open.modal.manual).toBeTruthy();
      expect(access.waitlist.modal.manual).toBeTruthy();
    }
  });

  it('warns Spanish demo players before the English/Ukrainian full-product transition', () => {
    expect(CONTENT.es.access.open.nav).toContain('EN/UK');
    expect(CONTENT.es.access.availability).toContain('inglés y ucraniano');
    expect(DEMO_COPY.es.access.open.cta).toContain('EN/UK');
    expect(DEMO_COPY.es.access.availability).toContain('inglés y ucraniano');

    const register = readFileSync(new URL('../src/app/auth/register/page.tsx', import.meta.url), 'utf8');
    expect(register).toContain("queryLang === 'es'");
    expect(register).toContain('locale: intakeLocale');
    expect(register).toContain('La demo sigue disponible en español.');
  });

  it('localizes visible transcript speaker labels instead of trusting provider metadata', () => {
    expect(DEMO_COPY.en.player).toBe('You');
    expect(DEMO_COPY.uk.player).toBe('Ви');
    expect(DEMO_COPY.es.player).toBe('Tú');

    const demo = readFileSync(new URL('../src/app/demo/DemoClient.tsx', import.meta.url), 'utf8');
    expect(demo).toContain('meta: copy.player');
    expect(demo).toContain('meta: copy.keeper');
    expect(demo).not.toContain("meta: reply.meta ?? 'Keeper'");
  });
});
