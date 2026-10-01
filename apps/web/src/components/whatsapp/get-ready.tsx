import Link from "next/link";
import { Clock } from "@phosphor-icons/react/dist/ssr";
import { ListSurface } from "@/components/settings-frame";
import { getT } from "@/i18n/server";

const STEPS = ["verify", "number", "card", "teams"] as const;

/**
 * The WhatsApp numbers page before Meta approves our platform (decided 2026-09-30): say honestly that
 * connecting isn't open yet, and list what the owner can prepare now.
 */
export async function GetReady({ teamsHref }: { teamsHref: string }) {
  const t = await getT("getReady");
  return (
    <div className="grid gap-5">
      <div className="flex gap-3 rounded-[var(--radius-panel)] bg-primary-soft p-4">
        <Clock size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <div className="grid gap-1">
          <p className="font-semibold">{t("title")}</p>
          <p className="text-sm text-muted">{t("body")}</p>
        </div>
      </div>
      <ListSurface>
        {STEPS.map((k, i) => (
          <li key={k} className="flex gap-4 border-b border-border px-5 py-4 last:border-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
            <span className="grid gap-1">
              <span className="font-medium">{t(`steps.${k}.title`)}</span>
              <span className="text-sm text-muted">{t(`steps.${k}.body`)}</span>
              {k === "teams" && <Link href={teamsHref} className="w-fit text-sm font-medium text-primary hover:underline">{t("setUpTeams")}</Link>}
            </span>
          </li>
        ))}
      </ListSurface>
    </div>
  );
}
