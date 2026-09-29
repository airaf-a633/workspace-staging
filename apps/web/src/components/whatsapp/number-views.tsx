import Link from "next/link";
import { ArrowLeft, CaretRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { ListSurface } from "@/components/settings-frame";
import { aed } from "@/components/inbox/format";
import { DISCONNECT_DAYS, QUALITY, RATE_FILS, REMIND_FROM_DAY, daysLeft, estimatedCostFils, limitText, type WaNumber } from "./numbers";

const STATUS = {
  connected: { label: "Connected", tone: "done" },
  attention: { label: "Needs attention", tone: "warn" },
  disconnected: { label: "Disconnected", tone: "fail" },
} as const;

/* Settings › WhatsApp numbers: one row per number, then "Connect a number" (decided 2026-09-30). */
export function NumberList({ numbers, teamName, base, isOwner, plan, now }: { numbers: WaNumber[]; teamName: (key: string) => string; base: string; isOwner: boolean; plan: { name: string; max: number }; now: number }) {
  const full = numbers.length >= plan.max;
  return (
    <div className="grid gap-4">
      <ListSurface>
        {numbers.map((n) => {
          const left = daysLeft(n, now);
          return (
            <li key={n.id} className="border-b border-border last:border-0">
              <Link href={`${base}/whatsapp/${n.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                <span className="bg-hero grid size-10 shrink-0 place-items-center rounded-full font-serif text-lg text-white" aria-hidden="true">{n.displayName.charAt(0)}</span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {n.displayName}
                    <Badge tone={STATUS[n.status].tone}>{STATUS[n.status].label}</Badge>
                  </span>
                  <span className="text-sm text-muted">
                    <span dir="ltr" className="tabular-nums">{n.number}</span> · {teamName(n.teamKey)} · Quality {QUALITY[n.quality].label.toLowerCase()}
                  </span>
                  {n.status === "attention" && (
                    <span className="flex items-center gap-1.5 text-sm text-warn">
                      <WarningCircle size={16} aria-hidden="true" /> Open WhatsApp Business on the phone within {left} {left === 1 ? "day" : "days"}
                    </span>
                  )}
                </span>
                <CaretRight size={18} className="shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ListSurface>
      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{numbers.length} of {plan.max} numbers on your {plan.name} plan.</p>
          <button type="button" disabled={full} className={buttonClass("secondary", "sm")} title={full ? "Your plan's numbers are all in use" : undefined}>Connect a number</button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {action}
      </div>
      <div className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">{children}</div>
    </section>
  );
}

function Row({ label, children, help }: { label: string; children: React.ReactNode; help?: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <p className="text-sm text-muted">{label}</p>
      <div className="grid gap-0.5">
        <div>{children}</div>
        {help && <p className="text-sm text-muted">{help}</p>}
      </div>
    </div>
  );
}

/* One number's page: Health, Routing, Profile, Usage; Disconnect at the bottom behind an inline confirm. */
export function NumberDetail({ n, teams, base, isOwner, now, people }: { n: WaNumber; teams: { key: string; name: string }[]; base: string; isOwner: boolean; now: number; people: string[] }) {
  const left = daysLeft(n, now);
  const opened = DISCONNECT_DAYS - left;
  const q = QUALITY[n.quality];
  const cost = estimatedCostFils(n);
  const control = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base disabled:opacity-100";

  return (
    <div className="grid gap-8">
      <Link href={`${base}/whatsapp`} className="-mb-4 inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> WhatsApp numbers
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <span className="bg-hero grid size-12 place-items-center rounded-full font-serif text-xl text-white" aria-hidden="true">{n.displayName.charAt(0)}</span>
        <div className="grid">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {n.displayName} <Badge tone={STATUS[n.status].tone}>{STATUS[n.status].label}</Badge>
          </h2>
          <p className="text-muted"><span dir="ltr" className="tabular-nums">{n.number}</span></p>
        </div>
      </header>

      <Section title="Health">
        <Row label="Phone app" help={`WhatsApp disconnects a number when the WhatsApp Business app isn't opened for ${DISCONNECT_DAYS} days. We remind you from day ${REMIND_FROM_DAY}.`}>
          <div className="grid gap-2">
            <p className={left <= DISCONNECT_DAYS - REMIND_FROM_DAY ? "font-medium text-warn" : ""}>
              Last opened {opened === 0 ? "today" : opened === 1 ? "yesterday" : `${opened} days ago`}. {left <= DISCONNECT_DAYS - REMIND_FROM_DAY ? `Open it within ${left} ${left === 1 ? "day" : "days"}.` : `${left} days to go.`}
            </p>
            <span className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${opened} of ${DISCONNECT_DAYS} days used`}>
              <span className={`block h-full rounded-full ${left <= DISCONNECT_DAYS - REMIND_FROM_DAY ? "bg-warn" : "bg-primary"}`} style={{ width: `${(opened / DISCONNECT_DAYS) * 100}%` }} />
            </span>
          </div>
        </Row>
        <Row label="Quality" help={q.help}>
          <Badge tone={q.tone}>{q.label}</Badge>
        </Row>
        <Row label="Daily limit" help="Set by Meta. Meta raises it over time while quality stays good.">
          {limitText(n.limit)}
        </Row>
      </Section>

      <Section title="Routing">
        <Row label="Team">
          <select disabled={!isOwner} defaultValue={n.teamKey} className={control} aria-label="Team">
            {teams.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </Row>
        <Row label="New chats go to">
          <fieldset disabled={!isOwner} className="grid gap-2">
            <legend className="sr-only">New chats go to</legend>
            {[
              ["team", "The team's queue", "First person to claim takes it."],
              ["person", "One person", people.join(", ")],
              ["rules", "Routing rules", "Keywords, the ad clicked or the customer's language. Coming with automations."],
            ].map(([value, title, help]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="radio" name={`route-${n.id}`} value={value} defaultChecked={n.newChats === value} disabled={value === "rules"} className="mt-1 size-4 accent-[var(--primary)]" />
                <span className="grid">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm text-muted">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Row>
      </Section>

      <Section title="Profile">
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_16rem]">
          <div className="grid gap-4">
            <Row label="Display name" help={n.displayNameStatus === "approved" ? "Approved by Meta." : n.displayNameStatus === "pending" ? "Meta is reviewing this name. Customers see the number until it's approved." : "Meta rejected this name. It must match your business name."}>
              <span className="flex flex-wrap items-center gap-2">{n.displayName} {n.displayNameStatus !== "approved" && <Badge tone={n.displayNameStatus === "pending" ? "warn" : "fail"}>{n.displayNameStatus === "pending" ? "In review" : "Rejected"}</Badge>}</span>
            </Row>
            <Row label="About">
              <textarea disabled={!isOwner} defaultValue={n.about} rows={2} maxLength={139} className={`${control} resize-none py-2`} aria-label="About" />
            </Row>
            <Row label="Category">{n.category}</Row>
          </div>
          {/* How customers see the profile */}
          <div aria-label="What customers see" className="grid w-full max-w-64 justify-items-center gap-2 justify-self-center rounded-[1.75rem] border-[6px] border-text/80 bg-bg px-4 pb-6 pt-8 text-center">
            <span className="bg-hero grid size-16 place-items-center rounded-full font-serif text-2xl text-white" aria-hidden="true">{n.displayName.charAt(0)}</span>
            <p className="font-semibold">{n.displayNameStatus === "approved" ? n.displayName : n.number}</p>
            <p className="text-xs text-muted">Business account · {n.category}</p>
            <p className="text-sm">{n.about}</p>
          </div>
        </div>
      </Section>

      <Section title="Usage this month">
        <dl className="grid grid-cols-3 gap-4">
          {[
            ["Customer service", n.usage.service, "Free in September"],
            ["Utility", n.usage.utility, `${aed(RATE_FILS.utility)} each`],
            ["Marketing", n.usage.marketing, `${aed(RATE_FILS.marketing)} each`],
          ].map(([label, count, help]) => (
            <div key={label as string} className="grid gap-0.5">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="display text-3xl">{count}</dd>
              <dd className="text-xs text-muted">{help}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-border pt-4 text-sm">
          Estimated Meta charges: <strong className="font-semibold tabular-nums">{aed(cost)}</strong>. Meta bills your card directly; we add nothing on top.
        </p>
        {n.cardOnMeta ? (
          <p className="text-sm text-muted">A card is on file with Meta.</p>
        ) : (
          <p className="flex gap-2 rounded-[var(--radius-control)] bg-warn-soft p-3 text-sm">
            <WarningCircle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            No card on file with Meta. Messages that cost money won&apos;t send until you add one in Meta Business Suite, under Billing.
          </p>
        )}
      </Section>

      {isOwner && (
        <details className="group rounded-[var(--radius-panel)] border border-border p-5">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-medium text-fail [&::-webkit-details-marker]:hidden">
            Disconnect this number…
          </summary>
          <div className="mt-3 grid gap-3">
            <p className="text-sm">
              Sending and receiving in Workspace stops for {n.number}. Chats and history stay here, and the WhatsApp Business app on the phone keeps working. You can connect it again later.
            </p>
            <button type="button" disabled className={buttonClass("destructive", "sm", "w-fit")} title="Turned off in the preview">Disconnect {n.displayName}</button>
          </div>
        </details>
      )}
    </div>
  );
}
