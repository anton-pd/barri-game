import { Special_Elite, Playfair_Display, IM_Fell_English, UnifrakturMaguntia } from "next/font/google";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";
import LandingClient from "./LandingClient";
import "./landing.css";

const typewriter = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-typewriter", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const oldprint = IM_Fell_English({ subsets: ["latin"], weight: ["400"], style: ["normal", "italic"], variable: "--font-oldprint", display: "swap" });
const blackletter = UnifrakturMaguntia({ subsets: ["latin"], weight: "400", variable: "--font-blackletter", display: "swap" });

export const metadata = {
  title: "Barri — The Keeper is Listening",
  description: "An AI-run Call of Cthulhu investigation, played in your browser. Your party, your choices, your unspeakable failures.",
};

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  if (payload) redirect('/sessions');

  return (
    <div className={`${typewriter.variable} ${serif.variable} ${oldprint.variable} ${blackletter.variable} landing-root`}>
      <LandingClient />
    </div>
  );
}
