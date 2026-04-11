import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockgap Fuels | LPG Cylinder Distribution Platform",
  description:
    "Stockgap Fuels is building a digital LPG cylinder distribution platform for booking, tracking, dealer operations, and customer support across Nigeria.",
  icons: {
    icon: "/stockgas-logo.jpeg",
    shortcut: "/stockgas-logo.jpeg",
    apple: "/stockgas-logo.jpeg"
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
