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
 * GDPR (ANT-169 fix): PostHog is NOT initialized until the visitor accepts the
 * consent banner. The earlier opt-out-by-default + `opt_in_capturing()` flow did
 * not actually start capturing on consent in posthog-js 1.39x, so no events were
 * ever sent. Gating `init()` on consent is both correct and more privacy-safe.
 */
export function PostHogProvider({
  apiKey,
  apiHost,
  children,
}: {
  apiKey?: string;
  apiHost?: string;
  children: React.ReactNode;
}) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(hasConsent());
  }, []);

  useEffect(() => {
    if (!apiKey || !consented) return; // no key (staging) or no consent → never init
    if (posthog.__loaded) return;
    posthog.init(apiKey, {
      // First-party reverse proxy so adblockers cannot block analytics (ANT-170):
      // `/ingest/*` is rewritten to PostHog in next.config.ts, so requests are
      // same-origin (barrigame.es) and unblockable.
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: false, // captured manually (initial below + on route change)
      persistence: "localStorage+cookie",
    });
    posthog.capture("$pageview"); // first pageview right after consent/init
  }, [apiKey, apiHost, consented]);

  if (!apiKey) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
      <ConsentBanner onAccept={() => setConsented(true)} />
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
