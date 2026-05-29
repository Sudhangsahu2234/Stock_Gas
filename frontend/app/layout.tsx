import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockGas | Fuelling Nigeria's Future",
  description:
    "StockGas is a digital LPG cylinder distribution platform for ordering, payment, tracking, terminal information, and customer support across Nigeria.",
  icons: {
    icon: "/stockgas-logo.png",
    shortcut: "/stockgas-logo.png",
    apple: "/stockgas-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
