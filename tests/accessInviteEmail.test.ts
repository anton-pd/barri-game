import { afterEach, describe, expect, it } from 'vitest';
import { buildAccessInviteEmail, getEmailSender } from '@/lib/email';

const originalAppUrl = process.env.APP_URL;
const originalResendFrom = process.env.RESEND_FROM;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }

  if (originalResendFrom === undefined) {
    delete process.env.RESEND_FROM;
  } else {
    process.env.RESEND_FROM = originalResendFrom;
  }
});

describe('getEmailSender', () => {
  it('uses Barri Bureau as the default sender display name', () => {
    delete process.env.RESEND_FROM;

    expect(getEmailSender()).toBe('Barri Bureau <noreply@barrigame.es>');
  });
});

describe('buildAccessInviteEmail', () => {
  it('builds a Ukrainian new-account invitation with a register token link', () => {
    process.env.APP_URL = 'https://staging.barrigame.es';

    const email = buildAccessInviteEmail({
      to: 'investigator@example.com',
      locale: 'uk',
      inviteToken: 'abc123',
    });

    expect(email.locale).toBe('uk');
    expect(email.subject).toContain('доступ');
    expect(email.href).toBe('https://staging.barrigame.es/auth/register?invite=abc123');
    expect(email.text).toContain('Створіть акаунт');
    expect(email.html).toContain('Створити акаунт');
  });

  it('builds a Spanish existing-account email with a login link', () => {
    process.env.APP_URL = 'https://barrigame.es';

    const email = buildAccessInviteEmail({
      to: 'investigador@example.com',
      locale: 'es',
      existingAccount: true,
    });

    expect(email.locale).toBe('es');
    expect(email.href).toBe('https://barrigame.es/auth/login');
    expect(email.text).toContain('Inicia sesión');
    expect(email.html).toContain('Entrar en Barri');
  });

  it('falls back to English for unknown locales', () => {
    const email = buildAccessInviteEmail({
      to: 'investigator@example.com',
      locale: 'fr',
      inviteToken: 'token',
    });

    expect(email.locale).toBe('en');
    expect(email.subject).toBe('Your Barri access is open — create your account');
    expect(email.text).toContain('Create your Barri account');
  });
});
