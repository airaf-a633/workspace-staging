/**
 * A business date is the calendar date in the workspace's timezone (Asia/Dubai by default).
 * Cash handovers and rider links are keyed by business date, so a delivery at 00:30 Dubai
 * time belongs to the new day even though it is still the previous day in UTC.
 */
export const DEFAULT_TIMEZONE = "Asia/Dubai";

export function businessDate(at: Date, timeZone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
