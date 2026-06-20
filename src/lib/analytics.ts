import posthog from "posthog-js";

/**
 * Client-side product event tracking (ANT-169).
 *
 * Intentionally client-side (not posthog-node) so events:
 *  - respect the GDPR consent banner (no capture until opt-in),
 *  - share one distinct_id with $pageview (funnels work across events),
 *  - stay prod-only automatically (PostHog only initializes where POSTHOG_KEY
 *    is set, i.e. the prod container — see ANT-168 / providers.tsx).
 *
 * No-ops safely when PostHog is not loaded (staging, pre-consent, SSR).
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, props);
}
