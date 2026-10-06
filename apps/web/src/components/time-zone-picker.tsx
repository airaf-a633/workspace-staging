"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useT, useTimeZone } from "@/i18n/client";
import { TZ_COOKIE, TZ_MANUAL_COOKIE } from "@/i18n/zone";

const YEAR = 31_536_000;
const noop = () => () => {};

/** Settings › Account: the person's time zone. Automatic follows the browser; a chosen zone stays put. */
export function TimeZonePicker() {
  const t = useT("account");
  const current = useTimeZone();
  const router = useRouter();
  // The browser's zone list and choice only exist in the browser; the server renders the current zone alone.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [manualChoice, setManual] = useState<boolean | null>(null);
  const browser = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : current;
  const manual = manualChoice ?? (mounted && document.cookie.includes(`${TZ_MANUAL_COOKIE}=1`));
  const listed = mounted && typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  // Some browsers leave "UTC" out of their list; keep whatever zone is in use selectable.
  const zones = listed.includes(current) ? listed : [current, ...listed];

  function choose(value: string) {
    const auto = value === "auto";
    const zone = auto ? browser : value;
    document.cookie = `${TZ_COOKIE}=${zone}; path=/; max-age=${YEAR}; samesite=lax`;
    document.cookie = `${TZ_MANUAL_COOKIE}=${auto ? "" : "1"}; path=/; max-age=${auto ? 0 : YEAR}; samesite=lax`;
    setManual(!auto);
    router.refresh();
  }

  return (
    <label className="grid gap-1">
      <span className="sr-only">{t("timeZone.title")}</span>
      <select
        value={manual ? current : "auto"}
        onChange={(e) => choose(e.target.value)}
        className="min-h-11 max-w-72 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm"
      >
        <option value="auto">{t("timeZone.automatic", { zone: browser.replaceAll("_", " ") })}</option>
        {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}
