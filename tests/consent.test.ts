import { describe, expect, it } from 'vitest';
import {
  FALLBACK_CONSENT_KEY,
  clearFallbackAnalyticsConsent,
  getFallbackAnalyticsConsent,
  hasFallbackAnalyticsConsent,
  readCookiebotStatisticsConsent,
  setFallbackAnalyticsConsent,
} from '@/lib/consent';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('fallback analytics consent', () => {
  it('accepts only granted or denied values', () => {
    expect(getFallbackAnalyticsConsent(storage())).toBeNull();
    expect(getFallbackAnalyticsConsent(storage({ [FALLBACK_CONSENT_KEY]: 'maybe' }))).toBeNull();
    expect(getFallbackAnalyticsConsent(storage({ [FALLBACK_CONSENT_KEY]: 'granted' }))).toBe('granted');
    expect(getFallbackAnalyticsConsent(storage({ [FALLBACK_CONSENT_KEY]: 'denied' }))).toBe('denied');
  });

  it('reports granted consent only for the granted fallback value', () => {
    expect(hasFallbackAnalyticsConsent(storage({ [FALLBACK_CONSENT_KEY]: 'granted' }))).toBe(true);
    expect(hasFallbackAnalyticsConsent(storage({ [FALLBACK_CONSENT_KEY]: 'denied' }))).toBe(false);
    expect(hasFallbackAnalyticsConsent(storage())).toBe(false);
  });

  it('sets and clears fallback consent', () => {
    const s = storage();
    setFallbackAnalyticsConsent('granted', s);
    expect(getFallbackAnalyticsConsent(s)).toBe('granted');
    clearFallbackAnalyticsConsent(s);
    expect(getFallbackAnalyticsConsent(s)).toBeNull();
  });
});

describe('Cookiebot statistics consent', () => {
  it('treats a missing or stubbed Cookiebot object as not ready', () => {
    expect(readCookiebotStatisticsConsent(undefined)).toBeNull();
    expect(readCookiebotStatisticsConsent({})).toBeNull();
  });

  it('reads statistics consent only from a ready Cookiebot consent object', () => {
    expect(readCookiebotStatisticsConsent({ consent: { statistics: true } })).toBe(true);
    expect(readCookiebotStatisticsConsent({ consent: { statistics: false } })).toBe(false);
    expect(readCookiebotStatisticsConsent({ consent: {} })).toBe(false);
  });
});
