import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Call of Cthulhu — AI Keeper",
  description: "Настільна RPG з AI Кіпером",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full">
      <body className="h-full bg-stone-950">{children}</body>
    </html>
  );
}
