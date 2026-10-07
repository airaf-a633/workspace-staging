import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { dirOf } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import { MESSAGES, getLocale, getT, getTimeZone } from "@/i18n/server";
import { TimeZoneSync } from "@/components/time-zone-sync";
import "./globals.css";

// Relay v1 (2026-10-07): Geist for everything, Geist Mono for numbers. English only, so no Arabic face is loaded.
const geist = Geist({ variable: "--font-geist", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("meta");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1214" },
  ],
};

/* The language comes from the person's cookie (Settings › Account, or the preview's EN / عربي switch). */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const tz = await getTimeZone();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale} messages={MESSAGES[locale]} tz={tz}>
          <TimeZoneSync current={tz} />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
