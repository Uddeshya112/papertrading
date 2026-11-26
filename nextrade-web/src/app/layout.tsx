import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TradeGuru AI — 100% Free Indian Paper Trading & AI Coach",
  description:
    "Modern Indian paper trading terminal (₹10,00,000 virtual capital, NSE/BSE/F&O/MCX simulation) with AI Trading Coach, 28-Course Bilingual Academy, Options Chain, Risk Center, and Backtesting Lab.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoDevanagari.variable}`}>
      <body>{children}</body>
    </html>
  );
}
