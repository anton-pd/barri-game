"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { ConsentBanner, hasConsent } from "@/components/ConsentBanner";

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
type CookiebotConsent = { consent?: { statistics?: boolean } };
declare global {
  interface Window { Cookiebot?: CookiebotConsent }
}

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
      const sync = () => setConsented(!!window.Cookiebot?.consent?.statistics);
      sync(); // consent may already be resolved (returning visitor)
      window.addEventListener("CookiebotOnConsentReady", sync);
      window.addEventListener("CookiebotOnAccept", sync);
      window.addEventListener("CookiebotOnDecline", sync);
      // If Cookiebot hasn't loaded after a few seconds, assume it's blocked and
      // fall back to our own banner + localStorage consent.
      const fallbackTimer = setTimeout(() => {
        if (!window.Cookiebot) {
          setCookiebotBlocked(true);
          setConsented(hasConsent());
        }
      }, 4000);
      return () => {
        clearTimeout(fallbackTimer);
        window.removeEventListener("CookiebotOnConsentReady", sync);
        window.removeEventListener("CookiebotOnAccept", sync);
        window.removeEventListener("CookiebotOnDecline", sync);
      };
    }
    setConsented(hasConsent());
  }, [cookiebotId]);

  useEffect(() => {
    if (!apiKey) return;
    if (consented) {
      if (!posthog.__loaded) {
        posthog.init(apiKey, {
          // First-party reverse proxy so adblockers cannot block analytics
          // (ANT-170): `/ingest/*` is rewritten to PostHog in next.config.ts.
          api_host: "/ingest",
          ui_host: "https://eu.posthog.com",
          defaults: "2025-05-24",
          capture_pageview: false, // captured manually (initial + on route change)
          persistence: "localStorage+cookie",
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
      {!cookiebotId && <ConsentBanner onAccept={() => setConsented(true)} />}
    </PHProvider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    let url = window.origin + pathname;
    const qs = searchParams.toString();
    if (qs) url += "?" + qs;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
