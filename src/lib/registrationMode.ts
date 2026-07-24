export type RegistrationMode = 'open' | 'waitlist';

export const REGISTRATION_MODE_FALLBACK: RegistrationMode = 'waitlist';
export type PublicLocale = 'en' | 'uk' | 'es';

export function getPublicAccess(mode: RegistrationMode, locale: PublicLocale) {
  return {
    registrationHref: `/auth/register?lang=${locale}`,
    captureEmail: mode === 'waitlist',
  };
}

export function normalizeRegistrationMode(value: unknown): RegistrationMode {
  return value === 'open' ? 'open' : REGISTRATION_MODE_FALLBACK;
}

export async function loadRegistrationMode(
  loadSettings: () => Promise<Record<string, string>>,
  onError?: (error: unknown) => void
): Promise<RegistrationMode> {
  try {
    const settings = await loadSettings();
    return normalizeRegistrationMode(settings.registration_mode);
  } catch (error) {
    onError?.(error);
    return REGISTRATION_MODE_FALLBACK;
  }
}
