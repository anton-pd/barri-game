import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PostHogProvider } from "./providers";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE, SITE_NAME, SITE_URL } from "./seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Barri AI Keeper tabletop horror investigation preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
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
    <html lang="en" className="h-full">
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
