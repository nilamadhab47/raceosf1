import type { Metadata } from "next";
import "./globals.css";
import { Orbitron, JetBrains_Mono, Exo_2 } from "next/font/google";
import { cn } from "@/lib/utils";

const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const exo2 = Exo_2({ subsets: ["latin"], variable: "--font-exo2" });

export const metadata: Metadata = {
  title: "RaceOS F1",
  description: "See the race like the pit wall",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-body", orbitron.variable, jetbrains.variable, exo2.variable)}>
      <body>{children}</body>
    </html>
  );
}
