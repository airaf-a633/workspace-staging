"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useT, useTimeZone } from "@/i18n/client";
import { TZ_COOKIE, TZ_MANUAL_COOKIE } from "@/i18n/zone";

const YEAR = 31_536_000;
const noop = () => () => {};

/** "Europe/London" → "London", "America/Argentina/La_Rioja" → "La Rioja". */
const city = (zone: string) => zone.split("/").at(-1)!.replaceAll("_", " ");
/** "London (GMT+1)": what people recognise, with the offset as the tiebreaker. */
function label(zone: string) {
  try {
    const off = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts().find((p) => p.type === "timeZoneName")?.value;
    return off ? `${city(zone)} (${off})` : city(zone);
  } catch {
    return city(zone);
  }
}

/**
 * Settings › Account: the person's time zone (simplicity pass 2026-10-19). Search by city instead of scrolling
 * 400 codes; "Use my device's time zone" follows the browser, and a chosen zone stays put.
 */
export function TimeZonePicker() {
  const t = useT("account");
  const current = useTimeZone();
  const router = useRouter();
  const listId = useId();
  // The browser's zone list and choice only exist in the browser; the server renders the current zone alone.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [manualChoice, setManual] = useState<boolean | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const browser = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : current;
  const manual = manualChoice ?? (mounted && document.cookie.includes(`${TZ_MANUAL_COOKIE}=1`));
  const zones = useMemo(() => {
    const listed = mounted && typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    // Some browsers leave "UTC" out of their list; keep whatever zone is in use selectable.
    const all = listed.includes(current) ? listed : [current, ...listed];
    return all.map((z) => ({ zone: z, label: label(z) }));
  }, [mounted, current]);

  function save(zone: string, auto: boolean) {
    document.cookie = `${TZ_COOKIE}=${zone}; path=/; max-age=${YEAR}; samesite=lax`;
    document.cookie = `${TZ_MANUAL_COOKIE}=${auto ? "" : "1"}; path=/; max-age=${auto ? 0 : YEAR}; samesite=lax`;
    setManual(!auto);
    setQuery(null);
    router.refresh();
  }

  function pick(text: string) {
    setQuery(text);
    const hit = zones.find((z) => z.label === text);
    if (hit) save(hit.zone, false);
  }

  return (
    <div className="grid w-full max-w-72 gap-1.5">
      <label className="grid gap-1">
        <span className="sr-only">{t("timeZone.title")}</span>
        <input
          type="search"
          list={listId}
          value={query ?? label(current)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => pick(e.target.value)}
          placeholder={t("timeZone.search")}
          autoComplete="off"
          className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm"
        />
        <datalist id={listId}>
          {zones.map((z) => <option key={z.zone} value={z.label} />)}
        </datalist>
      </label>
      {manual ? (
        <button type="button" onClick={() => save(browser, true)} className="w-fit text-start text-sm text-primary underline-offset-4 hover:underline">
          {t("timeZone.useDevice", { zone: label(browser) })}
        </button>
      ) : (
        <span className="text-xs text-muted">{t("timeZone.followingDevice")}</span>
      )}
    </div>
  );
}
