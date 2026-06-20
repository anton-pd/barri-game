import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PostHogProvider } from "./providers";

export const metadata: Metadata = {
  title: "Call of Cthulhu — AI Keeper",
  description: "Настільна RPG з AI Кіпером",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Runtime-injected: only the prod container sets POSTHOG_KEY, so staging stays
  // untracked while sharing the same code/git (ANT-168).
  const posthogKey = process.env.POSTHOG_KEY;
  // Cookiebot CMP (ANT-171): prod-only consent gate. When set, PostHog is gated
  // on Cookiebot's `statistics` consent and the built-in banner is hidden.
  const cookiebotId = process.env.COOKIEBOT_CBID;

  return (
    <html lang="uk" className="h-full">
      <head>
        {/* Cookiebot CMP — official snippet rendered as a plain, direct <script>
            in <head> (ANT-171). next/script `beforeInteractive` emitted a
            <link rel="preload"> + dynamic injection, which content blockers and
            browser heuristics treated differently than the normal install and
            blocked (ERR_BLOCKED_BY_CONTENT_BLOCKER). A direct tag matches how
            every other Cookiebot site loads it. */}
        {cookiebotId && (
          <script
            id="Cookiebot"
            src="https://consent.cookiebot.com/uc.js"
            data-cbid={cookiebotId}
            data-blockingmode="auto"
            type="text/javascript"
            async
          />
        )}
      </head>
      <body className="h-full bg-stone-950">
        <PostHogProvider apiKey={posthogKey} cookiebotId={cookiebotId}>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
