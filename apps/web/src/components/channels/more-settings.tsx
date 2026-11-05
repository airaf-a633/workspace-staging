import type { ReactNode } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { getT } from "@/i18n/server";

/**
 * Rarely used settings of a channel (its name, replacing a password, disconnecting) behind one clearly labelled control, so the
 * channel page opens on what matters: is it working, and what to do next. It opens by itself when the channel is disconnected,
 * because reconnecting is then the main thing to do (simplicity audit, rules 5 and 6).
 */
export async function MoreSettings({ open = false, children }: { open?: boolean; children: ReactNode }) {
  const t = await getT("channelsPage");
  return (
    <details open={open} className="group grid gap-6">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-medium text-primary [&::-webkit-details-marker]:hidden">
        <Plus size={16} className="transition-transform group-open:rotate-45" aria-hidden="true" /> {t("moreSettings")}
      </summary>
      <div className="mt-4 grid gap-6">{children}</div>
    </details>
  );
}

/** What a channel costs or can't do, kept one tap away once it is connected (the connect page shows it up front). */
export async function GoodToKnow({ children }: { children: ReactNode }) {
  const t = await getT("channelsPage");
  return (
    <details className="group grid gap-6">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-medium text-primary [&::-webkit-details-marker]:hidden">
        <Plus size={16} className="transition-transform group-open:rotate-45" aria-hidden="true" /> {t("goodToKnow")}
      </summary>
      <div className="mt-4 grid gap-3">{children}</div>
    </details>
  );
}
