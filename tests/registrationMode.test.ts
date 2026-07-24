import { describe, expect, it, vi } from 'vitest';
import {
  REGISTRATION_MODE_FALLBACK,
  getPublicAccess,
  loadRegistrationMode,
  normalizeRegistrationMode,
} from '@/lib/registrationMode';

describe('registration mode', () => {
  it('preserves the selected locale and selects the correct public intake', () => {
    expect(getPublicAccess('open', 'es')).toEqual({
      registrationHref: '/auth/register?lang=es',
      captureEmail: false,
    });
    expect(getPublicAccess('waitlist', 'uk')).toEqual({
      registrationHref: '/auth/register?lang=uk',
      captureEmail: true,
    });
  });

  it('keeps the two supported modes explicit', () => {
    expect(normalizeRegistrationMode('open')).toBe('open');
    expect(normalizeRegistrationMode('waitlist')).toBe('waitlist');
  });

  it('fails closed for missing or invalid values', () => {
    expect(normalizeRegistrationMode(undefined)).toBe(REGISTRATION_MODE_FALLBACK);
    expect(normalizeRegistrationMode('')).toBe(REGISTRATION_MODE_FALLBACK);
    expect(normalizeRegistrationMode('disabled')).toBe(REGISTRATION_MODE_FALLBACK);
  });

  it('reads the current setting from the supplied source', async () => {
    await expect(loadRegistrationMode(async () => ({ registration_mode: 'open' }))).resolves.toBe('open');
    await expect(loadRegistrationMode(async () => ({ registration_mode: 'waitlist' }))).resolves.toBe('waitlist');
  });

  it('uses the waitlist fallback and reports lookup failures', async () => {
    const error = new Error('database unavailable');
    const onError = vi.fn();

    await expect(loadRegistrationMode(async () => {
      throw error;
    }, onError)).resolves.toBe('waitlist');
    expect(onError).toHaveBeenCalledWith(error);
  });
});
