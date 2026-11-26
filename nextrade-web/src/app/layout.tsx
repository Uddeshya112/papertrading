import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeGuru AI — 100% Free Paper Trading Terminal & AI Trading Teacher",
  description:
    "Professional Indian paper trading simulator (₹10,00,000 virtual capital, 10 timeframes, market depth, Options Chain, Basket Orders) with 16-Mistake AI Trading Teacher, 28-Course Bilingual Academy, Risk Center, Backtesting Lab, and 12-Report Download Center.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
