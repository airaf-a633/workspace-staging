import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { dirOf } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import { MESSAGES, getLocale, getT, getTimeZone } from "@/i18n/server";
import { TimeZoneSync } from "@/components/time-zone-sync";
import { ThemeProvider } from "@/components/theme";
import { THEME_COOKIE, isTheme } from "@/lib/theme";
import { cookies } from "next/headers";
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

/* Language, time zone and theme come from the person's cookies; the theme is set on <html> so the first paint is right. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const tz = await getTimeZone();
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(cookieTheme) ? cookieTheme : "system";
  return (
    <html lang={locale} dir={dirOf(locale)} data-theme={theme === "system" ? undefined : theme} className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale} messages={MESSAGES[locale]} tz={tz}>
          <TimeZoneSync current={tz} />
          <ThemeProvider initial={theme}>{children}</ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
