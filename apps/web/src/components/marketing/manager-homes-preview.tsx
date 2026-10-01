"use client";

import { useState } from "react";
import { useFormat, useT } from "@/i18n/client";

/* Four homes over one set of sample data. A working preview, not a picture. Words: homesDemo.<role>; stats: home.stats. */
type Value = { aed: number } | { min: number } | { n: number };
const HOMES = {
  owner: { who: "Khalid", numbers: [["revenue", { aed: 186_420 }], ["pipeline", { aed: 94_300 }], ["medianReply", { min: 6 }], ["unassigned", { n: 3 }]] },
  sales: { who: "Sara", numbers: [["pipeline", { aed: 94_300 }], ["won", { aed: 71_850 }], ["leads", { n: 31 }], ["followUpsToday", { n: 4 }]] },
  support: { who: "Omar", numbers: [["openChats", { n: 22 }], ["waitingCustomer", { n: 9 }], ["medianReply", { min: 6 }], ["overTarget", { n: 2 }]] },
  ops: { who: "Priya", numbers: [["tasksToday", { n: 9 }], ["ordersToFulfil", { n: 5 }], ["meetingsToday", { n: 2 }], ["overdueTasks", { n: 1 }]] },
} as const satisfies Record<string, { who: string; numbers: readonly (readonly [string, Value])[] }>;
type Role = keyof typeof HOMES;

export function ManagerHomesPreview() {
  const [role, setRole] = useState<Role>("owner");
  const home = HOMES[role];
  const t = useT("homesDemo");
  const tAll = useT();
  const fmt = useFormat();
  const value = (v: Value) => ("aed" in v ? fmt.aedWhole(v.aed) : "min" in v ? tAll("time.minutes", { count: v.min }) : fmt.number(v.n));
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-2)]">
      <div role="tablist" aria-label={t("label")} className="flex flex-wrap gap-1 border-b border-border p-2">
        {(Object.keys(HOMES) as Role[]).map((r) => (
          <button key={r} role="tab" type="button" aria-selected={role === r} onClick={() => setRole(r)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium ${role === r ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2"}`}>
            {t(`${r}.tab`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="grid gap-5 p-5">
        <p className="title text-2xl">{tAll("home.morning", { name: home.who })}</p>
        <div className="grid gap-2">
          <p className="text-sm font-medium text-muted">{tAll("home.needsNow")}</p>
          <ul className="grid gap-2">
            {(["one", "two", "three"] as const).map((n) => <li key={n} className="rounded-[var(--radius-control)] border border-border px-3 py-2">{t(`${role}.needs.${n}`)}</li>)}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          {home.numbers.map(([label, v]) => (
            <div key={label}>
              <dt className="text-sm text-muted">{tAll(`home.stats.${label}`)}</dt>
              <dd className="num text-xl font-medium">{value(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
