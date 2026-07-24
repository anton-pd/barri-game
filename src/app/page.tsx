import { Special_Elite, Playfair_Display, IM_Fell_English, UnifrakturMaguntia, PT_Mono, PT_Serif } from "next/font/google";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";
import LandingClient from "./LandingClient";
import "./landing.css";
import { absoluteUrl, DEFAULT_DESCRIPTION, jsonLd, publicMetadata } from "./seo";
import { getRegistrationMode } from "@/lib/registrationMode.server";

const typewriter = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-typewriter", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin", "cyrillic"], variable: "--font-serif", display: "swap" });
const oldprint = IM_Fell_English({ subsets: ["latin"], weight: ["400"], style: ["normal", "italic"], variable: "--font-oldprint", display: "swap" });
const blackletter = UnifrakturMaguntia({ subsets: ["latin"], weight: "400", variable: "--font-blackletter", display: "swap" });
// Cyrillic-capable fallbacks for Ukrainian text
const ptmono = PT_Mono({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-ptmono", display: "swap" });
const ptserif = PT_Serif({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-ptserif", display: "swap" });

export const metadata = publicMetadata({
  title: "Barri — AI Case Curator for Browser Tabletop RPGs",
  description: DEFAULT_DESCRIPTION,
});

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  if (payload) redirect('/sessions');
  const registrationMode = await getRegistrationMode();

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Barri",
      url: absoluteUrl("/"),
      description: DEFAULT_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Barri",
      applicationCategory: "GameApplication",
      operatingSystem: "Web browser",
      url: absoluteUrl("/"),
      image: absoluteUrl("/opengraph-image"),
      description: DEFAULT_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
    },
  ];

  return (
    <div className={`${typewriter.variable} ${serif.variable} ${oldprint.variable} ${blackletter.variable} ${ptmono.variable} ${ptserif.variable} landing-root`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <LandingClient registrationMode={registrationMode} />
    </div>
  );
}
