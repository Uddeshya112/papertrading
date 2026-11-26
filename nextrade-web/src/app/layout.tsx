import type { Metadata } from "next";
import { DM_Sans, Manrope, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TradeGuru AI — 100% Free Paper Trading Terminal & AI Trading Teacher",
  description:
    "Professional Indian paper trading simulator (₹10,00,000 virtual capital, 10 timeframes, market depth, Options Chain, Basket Orders) with 16-Mistake AI Trading Teacher, 28-Course Bilingual Academy, Risk Center, Backtesting Lab, and 12-Report Download Center.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${manrope.variable} ${notoDevanagari.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
