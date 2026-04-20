import { Special_Elite, Playfair_Display, IM_Fell_English, UnifrakturMaguntia } from "next/font/google";
import "./landing.css";

const typewriter = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-typewriter",
  display: "swap",
});

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const oldprint = IM_Fell_English({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-oldprint",
  display: "swap",
});

const blackletter = UnifrakturMaguntia({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-blackletter",
  display: "swap",
});

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${typewriter.variable} ${serif.variable} ${oldprint.variable} ${blackletter.variable} landing-root`}>
      {children}
    </div>
  );
}
