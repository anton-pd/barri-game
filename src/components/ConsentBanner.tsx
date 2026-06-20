"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "barri_analytics_consent"; // "granted" | "denied"

export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "granted";
}

/**
 * Minimal GDPR consent banner. PostHog is only initialized after the visitor
 * accepts (see providers.tsx — `onAccept` flips consent and triggers init).
 * Choice is stored in localStorage so the banner is shown only once.
 */
export function ConsentBanner({ onAccept }: { onAccept?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored !== "granted" && stored !== "denied") setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    window.localStorage.setItem(CONSENT_KEY, "granted");
    setVisible(false);
    onAccept?.();
  };

  const decline = () => {
    window.localStorage.setItem(CONSENT_KEY, "denied");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-stone-700 bg-stone-900/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-300">
          Ми використовуємо аналітику, щоб покращувати гру. Дозволити анонімний
          збір статистики використання?
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={decline}
            className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 transition hover:bg-stone-800"
          >
            Відхилити
          </button>
          <button
            onClick={accept}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-stone-950 transition hover:bg-amber-500"
          >
            Дозволити
          </button>
        </div>
      </div>
    </div>
  );
}
