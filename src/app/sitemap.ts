import type { MetadataRoute } from "next";
import { absoluteUrl } from "./seo";

const lastModified = new Date("2026-06-21T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/demo"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
