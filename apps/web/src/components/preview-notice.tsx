import { Info } from "@phosphor-icons/react/dist/ssr";
import { getT } from "@/i18n/server";

/**
 * Real workspaces show the designed Campaigns, Help Center and Billing screens (decided 2026-11-03: showcase everything) with sample
 * data. This says so at the top of each, so nobody mistakes a sample campaign for a real one.
 */
export async function PreviewNotice() {
  const t = await getT("common");
  return (
    <p role="note" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm">
      <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      {t("previewNotice")}
    </p>
  );
}
