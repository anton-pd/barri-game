import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
        {cookiebotId && (
          <Script
            id="Cookiebot"
            src="https://consent.cookiebot.com/uc.js"
            data-cbid={cookiebotId}
            data-blockingmode="manual"
            strategy="beforeInteractive"
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
