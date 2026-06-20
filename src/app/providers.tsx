"use client";

import { useEffect, Suspense } from "react";
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
  useEffect(() => {
    if (!apiKey) return; // no key (e.g. staging) → never initialize, never track
    posthog.init(apiKey, {
      api_host: apiHost || "https://eu.i.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: false, // captured manually below on route change
      // GDPR: do not track until the visitor explicitly consents.
      opt_out_capturing_by_default: !hasConsent(),
      persistence: hasConsent() ? "localStorage+cookie" : "memory",
    });
  }, [apiKey, apiHost]);

  if (!apiKey) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
      <ConsentBanner />
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
