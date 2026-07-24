export const FALLBACK_CONSENT_KEY = "barri_analytics_consent";

export type FallbackAnalyticsConsent = "granted" | "denied";

export type CookiebotApi = {
  consent?: {
    statistics?: boolean;
  };
  renew?: () => void;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function getFallbackAnalyticsConsent(
  storage: StorageLike | undefined = browserStorage()
): FallbackAnalyticsConsent | null {
  const value = storage?.getItem(FALLBACK_CONSENT_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function hasFallbackAnalyticsConsent(
  storage: StorageLike | undefined = browserStorage()
): boolean {
  return getFallbackAnalyticsConsent(storage) === "granted";
}

export function canInitializeAnalytics(
  apiKey: string | undefined,
  statisticsConsent: boolean
): apiKey is string {
  return Boolean(apiKey) && statisticsConsent;
}

export function setFallbackAnalyticsConsent(
  consent: FallbackAnalyticsConsent,
  storage: StorageLike | undefined = browserStorage()
) {
  storage?.setItem(FALLBACK_CONSENT_KEY, consent);
}

export function clearFallbackAnalyticsConsent(
  storage: StorageLike | undefined = browserStorage()
) {
  storage?.removeItem(FALLBACK_CONSENT_KEY);
}

export function readCookiebotStatisticsConsent(
  cookiebot: CookiebotApi | undefined
): boolean | null {
  if (!cookiebot?.consent) return null;
  return cookiebot.consent.statistics === true;
}
