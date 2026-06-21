"use client";

import { clearFallbackAnalyticsConsent, type CookiebotApi } from "@/lib/consent";

declare global {
  interface Window { Cookiebot?: CookiebotApi }
}

export function CookieSettingsButton() {
  const openSettings = () => {
    if (window.Cookiebot?.renew) {
      window.Cookiebot.renew();
      return;
    }

    clearFallbackAnalyticsConsent();
    window.location.reload();
  };

  return (
    <button type="button" className="legal-button" onClick={openSettings}>
      Change cookie settings
    </button>
  );
}
