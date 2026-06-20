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
  const posthogHost = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";

  return (
    <html lang="uk" className="h-full">
      <body className="h-full bg-stone-950">
        <PostHogProvider apiKey={posthogKey} apiHost={posthogHost}>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
