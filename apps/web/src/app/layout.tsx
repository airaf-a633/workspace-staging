import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Visual direction v2 (2026-09-30): Fraunces light for display, Google Sans for text and UI, Plex Arabic for Arabic.
// Google Sans (OFL, see fonts/GoogleSans-OFL.txt) only covers Basic Latin + Latin-1, so Geist stays next in the
// stack for the letters it lacks (ş ğ ł č, arrows).
const googleSans = localFont({ src: "./fonts/GoogleSans-Variable.woff2", variable: "--font-google-sans", weight: "400 700", display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"], display: "swap" });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({ variable: "--font-plex-arabic", subsets: ["arabic"], weight: ["300", "400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s · Workspace" },
  description: "WhatsApp, email and customers in one place, for every manager.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#111416" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className={`${googleSans.variable} ${fraunces.variable} ${geist.variable} ${geistMono.variable} ${plexArabic.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
