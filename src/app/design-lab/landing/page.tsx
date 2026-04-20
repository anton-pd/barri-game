import LandingClient from "./LandingClient";

export const metadata = {
  title: "Barri — The Keeper is Listening",
  description:
    "An AI-run Call of Cthulhu investigation, played in your browser. Your party, your choices, your unspeakable failures.",
};

export default function LandingPage() {
  return <LandingClient />;
}
