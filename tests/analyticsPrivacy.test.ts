import { describe, expect, it } from 'vitest';
import {
  sanitizeAnalyticsEvent,
  sanitizeAnalyticsUrl,
} from '@/lib/analyticsPrivacy';

describe('analytics URL privacy', () => {
  it('removes a password-reset token from the tracked URL', () => {
    expect(sanitizeAnalyticsUrl('https://barrigame.es/auth/reset-password?token=reset-secret')).toBe(
      'https://barrigame.es/auth/reset-password'
    );
  });

  it('removes invitation and email query values from registration URLs', () => {
    expect(
      sanitizeAnalyticsUrl(
        'https://barrigame.es/auth/register?invite=invite-secret&email=player%40example.com'
      )
    ).toBe('https://barrigame.es/auth/register');
  });

  it('preserves an ordinary URL pathname', () => {
    expect(sanitizeAnalyticsUrl('https://barrigame.es/demo')).toBe('https://barrigame.es/demo');
  });

  it('redacts URL properties on standard PostHog events', () => {
    const event = sanitizeAnalyticsEvent({
      properties: {
        $current_url: 'https://barrigame.es/auth/reset-password?token=reset-secret',
        $referrer: 'https://barrigame.es/auth/register?invite=invite-secret',
        label: 'Reset password',
      },
      $set_once: {
        $initial_current_url: 'https://barrigame.es/auth/register?email=player%40example.com',
      },
    });

    expect(event?.properties).toEqual({
      $current_url: 'https://barrigame.es/auth/reset-password',
      $referrer: 'https://barrigame.es/auth/register',
      label: 'Reset password',
    });
    expect(event?.$set_once).toEqual({
      $initial_current_url: 'https://barrigame.es/auth/register',
    });
  });
});
