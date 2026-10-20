"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE, TZ_MANUAL_COOKIE } from "@/i18n/zone";

/**
 * Picks up the browser's time zone (decided 2026-10-07: each person sees their own). On the first visit, or
 * after travelling, it saves the zone in a cookie and re-renders, unless the person chose one by hand.
 */
let refreshed = false;

export function TimeZoneSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser || browser === current || document.cookie.includes(`${TZ_MANUAL_COOKIE}=1`)) return;
    // Zone names (Europe/London) are cookie-safe as they are; the server reads them back unchanged.
    document.cookie = `${TZ_COOKIE}=${browser}; path=/; max-age=31536000; samesite=lax`;
    // Refresh once, and only if the cookie stuck: with cookies blocked this would otherwise loop.
    if (refreshed || !document.cookie.split("; ").includes(`${TZ_COOKIE}=${browser}`)) return;
    refreshed = true;
    router.refresh();
  }, [current, router]);
  return null;
}
