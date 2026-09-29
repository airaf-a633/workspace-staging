"use client";

import { useState } from "react";

/* Four homes over one set of sample data. A working preview, not a picture. */
const HOMES = {
  Owner: {
    who: "Khalid",
    numbers: [["Revenue this month", "AED 186,420"], ["Open pipeline", "AED 94,300"], ["Median first reply", "6 min"], ["Unassigned chats", "3"]],
    needs: ["Approve 8% off for Fatima Khoury", "Lina's 24-hour window closed", "Mariam's delivery is due Thursday"],
  },
  Sales: {
    who: "Sara",
    numbers: [["Open pipeline", "AED 94,300"], ["Won this month", "AED 71,850"], ["Leads from WhatsApp", "31"], ["Follow-ups today", "4"]],
    needs: ["Fatima Khoury wants 8% off", "Send Ahmed's quote for 20 monitors", "Call back Yousef about the laptops"],
  },
  Support: {
    who: "Omar",
    numbers: [["Open chats", "22"], ["Waiting on customer", "9"], ["Median first reply", "6 min"], ["Over reply target", "2"]],
    needs: ["Rahul has waited 48 min about a warranty", "2 chats nobody has claimed", "Lina needs a template reply"],
  },
  Operations: {
    who: "Priya",
    numbers: [["Tasks due today", "9"], ["Orders to fulfil", "5"], ["Meetings today", "2"], ["Overdue tasks", "1"]],
    needs: ["Confirm Mariam's Thursday delivery", "Book a courier for order #QE-2240", "11:00 supplier call"],
  },
} as const;
type Role = keyof typeof HOMES;

export function ManagerHomesPreview() {
  const [role, setRole] = useState<Role>("Owner");
  const home = HOMES[role];
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-2)]">
      <div role="tablist" aria-label="Manager home" className="flex flex-wrap gap-1 border-b border-border p-2">
        {(Object.keys(HOMES) as Role[]).map((r) => (
          <button key={r} role="tab" type="button" aria-selected={role === r} onClick={() => setRole(r)}
            className={`min-h-11 rounded-[var(--radius-control)] px-4 text-sm font-medium ${role === r ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2"}`}>
            {r}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="grid gap-5 p-5">
        <p className="text-lg font-semibold">Good morning, {home.who}</p>
        <div className="grid gap-2">
          <p className="text-sm font-medium text-muted">Needs you now</p>
          <ul className="grid gap-2">
            {home.needs.map((n) => <li key={n} className="rounded-[var(--radius-control)] border border-border px-3 py-2">{n}</li>)}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          {home.numbers.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="num text-xl font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
