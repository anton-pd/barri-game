"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { ConsentBanner } from "@/components/ConsentBanner";
import { sanitizeAnalyticsEvent, sanitizeAnalyticsUrl } from "@/lib/analyticsPrivacy";
import {
  canInitializeAnalytics,
  hasFallbackAnalyticsConsent,
  readCookiebotStatisticsConsent,
  type CookiebotApi,
} from "@/lib/consent";

/**
 * PostHog provider. The API key is injected at RUNTIME (server `layout.tsx`
 * reads `process.env.POSTHOG_KEY` and passes it here as a prop) rather than via
 * a build-time `NEXT_PUBLIC_*` var. This keeps a single git/code base for both
 * staging and prod: only the prod container sets `POSTHOG_KEY`, so staging never
 * initializes PostHog and is never tracked. See ANT-168 / PROJECT_CONTEXT.md.
 *
 * GDPR (ANT-169 fix): PostHog is NOT initialized until consent is granted. The
 * earlier opt-out-by-default + `opt_in_capturing()` flow did not actually start
 * capturing in posthog-js 1.39x. Gating `init()` on consent is correct + safer.
 *
 * Consent source (ANT-171): when a Cookiebot CMP is active (`cookiebotId` set,
 * prod only), consent for the `statistics` category drives PostHog. Without
 * Cookiebot (staging / no CBID) we fall back to the built-in `ConsentBanner`.
 */
declare global {
  interface Window { Cookiebot?: CookiebotApi }
}

const COOKIEBOT_READY_TIMEOUT_MS = 4000;
const COOKIEBOT_CONSENT_EVENTS = [
  "CookiebotOnConsentReady",
  "CookiebotOnLoad",
  "CookiebotOnAccept",
  "CookiebotOnDecline",
] as const;
const COOKIEBOT_DIALOG_EVENTS = [
  "CookiebotOnDialogInit",
  "CookiebotOnDialogDisplay",
] as const;

export function PostHogProvider({
  apiKey,
  cookiebotId,
  children,
}: {
  apiKey?: string;
  cookiebotId?: string;
  children: React.ReactNode;
}) {
  const [consented, setConsented] = useState(false);
  // Adblockers block consent.cookiebot.com by domain (ERR_BLOCKED_BY_CONTENT_BLOCKER),
  // so the CMP never loads and no consent UI appears. When that happens we fall back
  // to the built-in first-party banner (served from our domain, unblockable). ANT-171.
  const [cookiebotBlocked, setCookiebotBlocked] = useState(false);

  // Resolve consent: Cookiebot `statistics` when the CMP loads, else our banner.
  useEffect(() => {
    if (cookiebotId) {
      let cookiebotReady = false;
      const markCookiebotReady = () => {
        cookiebotReady = true;
        setCookiebotBlocked(false);
      };
      const syncFromCookiebot = () => {
        const statisticsConsent = readCookiebotStatisticsConsent(window.Cookiebot);
        if (statisticsConsent === null) return;
        markCookiebotReady();
        setConsented(statisticsConsent);
      };
      // consent may already be resolved (returning visitor)
      const syncTimer = window.setTimeout(syncFromCookiebot, 0);
      COOKIEBOT_CONSENT_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, syncFromCookiebot);
      });
      COOKIEBOT_DIALOG_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, markCookiebotReady);
      });
      // If Cookiebot hasn't loaded after a few seconds, assume it's blocked and
      // fall back to our own banner + localStorage consent.
      const fallbackTimer = setTimeout(() => {
        if (!cookiebotReady) {
          setCookiebotBlocked(true);
          setConsented(hasFallbackAnalyticsConsent());
        }
      }, COOKIEBOT_READY_TIMEOUT_MS);
      return () => {
        clearTimeout(syncTimer);
        clearTimeout(fallbackTimer);
        COOKIEBOT_CONSENT_EVENTS.forEach((eventName) => {
          window.removeEventListener(eventName, syncFromCookiebot);
        });
        COOKIEBOT_DIALOG_EVENTS.forEach((eventName) => {
          window.removeEventListener(eventName, markCookiebotReady);
        });
      };
    }
    const localConsentTimer = window.setTimeout(
      () => setConsented(hasFallbackAnalyticsConsent()),
      0
    );
    return () => clearTimeout(localConsentTimer);
  }, [cookiebotId]);

  useEffect(() => {
    if (!apiKey) return;
    if (canInitializeAnalytics(apiKey, consented)) {
      if (!posthog.__loaded) {
        posthog.init(apiKey, {
          // First-party reverse proxy so adblockers cannot block analytics
          // (ANT-170): `/ingest/*` is rewritten to PostHog in next.config.ts.
          api_host: "/ingest",
          ui_host: "https://eu.posthog.com",
          defaults: "2025-05-24",
          capture_pageview: false, // captured manually (initial + on route change)
          persistence: "localStorage+cookie",
          // Applied to every event, including PostHog's standard $current_url
          // property on autocaptured interactions.
          before_send: sanitizeAnalyticsEvent,
        });
        posthog.capture("$pageview");
      } else {
        posthog.opt_in_capturing();
      }
    } else if (posthog.__loaded) {
      posthog.opt_out_capturing(); // consent withdrawn
    }
  }, [apiKey, consented]);

  if (!apiKey) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
      {(!cookiebotId || cookiebotBlocked) && (
        <ConsentBanner onAccept={() => setConsented(true)} />
      )}
    </PHProvider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    const url = sanitizeAnalyticsUrl(window.origin + pathname);
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
