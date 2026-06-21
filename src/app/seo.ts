import type { Metadata } from "next";

export const SITE_URL = "https://barrigame.es";
export const SITE_NAME = "Barri";
export const DEFAULT_TITLE = "Barri — AI Keeper for Browser Tabletop RPGs";
export const DEFAULT_DESCRIPTION =
  "Play browser-based tabletop horror investigations with an AI Keeper that narrates scenes, tracks clues, handles d100 rolls, and remembers your choices.";
export const OG_IMAGE = "/opengraph-image";

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function publicMetadata({
  title,
  description,
  path = "/",
  noIndex = false,
}: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl(OG_IMAGE);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: "Barri AI Keeper tabletop horror investigation preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: noIndex
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
