import 'server-only';

import { ensureSchema, getAllAppSettings } from './queries';
import { loadRegistrationMode } from './registrationMode';

export async function getRegistrationMode() {
  return loadRegistrationMode(
    async () => {
      await ensureSchema();
      return getAllAppSettings();
    },
    (error) => console.error('Registration mode lookup failed; using waitlist fallback:', error)
  );
}
