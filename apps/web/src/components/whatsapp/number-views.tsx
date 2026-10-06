import Link from "next/link";
import { ArrowLeft, CaretRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { ListSurface } from "@/components/settings-frame";
import { getFormat, getT } from "@/i18n/server";
import { DISCONNECT_DAYS, QUALITY, RATE_FILS, REMIND_FROM_DAY, daysLeft, estimatedCostFils, type WaNumber } from "./numbers";

const STATUS_TONE = { connected: "done", attention: "warn", disconnected: "fail" } as const;

/* Settings › WhatsApp numbers: one row per number, then "Connect a number" (decided 2026-09-30). */
export async function NumberList({ numbers, teamName, base, isOwner, plan, now }: { numbers: WaNumber[]; teamName: (key: string) => string; base: string; isOwner: boolean; plan: { name: string; max: number }; now: number }) {
  const t = await getT("numbers");
  const full = numbers.length >= plan.max;
  return (
    <div className="grid gap-4">
      <ListSurface>
        {numbers.map((n) => {
          const left = daysLeft(n, now);
          return (
            <li key={n.id} className="border-b border-border last:border-0">
              <Link href={`${base}/whatsapp/${n.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                <span className="bg-primary grid size-10 shrink-0 place-items-center rounded-full font-semibold text-lg text-white" aria-hidden="true">{n.displayName.charAt(0)}</span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {n.displayName}
                    <Badge tone={STATUS_TONE[n.status]}>{t(`status.${n.status}`)}</Badge>
                  </span>
                  <span className="text-sm text-muted">
                    <span dir="ltr" className="tabular-nums">{n.number}</span> · {teamName(n.teamKey)} · {t("qualityIs", { quality: t(`quality.${n.quality}.word`) })}
                  </span>
                  {n.status === "attention" && (
                    <span className="flex items-center gap-1.5 text-sm text-warn">
                      <WarningCircle size={16} aria-hidden="true" /> {t("openAppWithin", { count: left })}
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
          <p className="text-sm text-muted">{t("planUsage", { used: numbers.length, max: plan.max, plan: plan.name })}</p>
          <button type="button" disabled={full} className={buttonClass("secondary", "sm")} title={full ? t("planFull") : undefined}>{t("connect")}</button>
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

const ROUTES = ["team", "person", "rules"] as const;
const USAGE = ["service", "utility", "marketing"] as const;

/* One number's page: Health, Routing, Profile, Usage; Disconnect at the bottom behind an inline confirm. */
export async function NumberDetail({ n, teams, base, isOwner, now, people }: { n: WaNumber; teams: { key: string; name: string }[]; base: string; isOwner: boolean; now: number; people: string[] }) {
  const t = await getT("numbers");
  const common = await getT("common");
  const fmt = await getFormat();
  const left = daysLeft(n, now);
  const opened = DISCONNECT_DAYS - left;
  const warn = left <= DISCONNECT_DAYS - REMIND_FROM_DAY;
  const cost = estimatedCostFils(n);
  const control = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base disabled:opacity-100";
  const usageHelp = { service: t("usage.free"), utility: t("usage.each", { cost: fmt.money(RATE_FILS.utility) }), marketing: t("usage.each", { cost: fmt.money(RATE_FILS.marketing) }) };

  return (
    <div className="grid gap-8">
      <Link href={`${base}/whatsapp`} className="-mb-4 inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <span className="bg-primary grid size-12 place-items-center rounded-full font-semibold text-xl text-white" aria-hidden="true">{n.displayName.charAt(0)}</span>
        <div className="grid">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {n.displayName} <Badge tone={STATUS_TONE[n.status]}>{t(`status.${n.status}`)}</Badge>
          </h2>
          <p className="text-muted"><span dir="ltr" className="tabular-nums">{n.number}</span></p>
        </div>
      </header>

      <Section title={t("health")}>
        <Row label={t("phoneApp")} help={t("phoneAppHelp", { days: DISCONNECT_DAYS, from: REMIND_FROM_DAY })}>
          <div className="grid gap-2">
            <p className={warn ? "font-medium text-warn" : ""}>
              {opened === 0 ? t("openedToday") : opened === 1 ? t("openedYesterday") : t("openedDaysAgo", { count: opened })}{" "}
              {warn ? t("openWithin", { count: left }) : t("daysToGo", { count: left })}
            </p>
            <span className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface-2" role="img" aria-label={t("daysUsed", { used: opened, total: DISCONNECT_DAYS })}>
              <span className={`block h-full rounded-full ${warn ? "bg-warn" : "bg-primary"}`} style={{ width: `${(opened / DISCONNECT_DAYS) * 100}%` }} />
            </span>
          </div>
        </Row>
        <Row label={t("qualityLabel")} help={t(`quality.${n.quality}.help`)}>
          <Badge tone={QUALITY[n.quality].tone}>{t(`quality.${n.quality}.label`)}</Badge>
        </Row>
        <Row label={t("dailyLimit")} help={t("dailyLimitHelp")}>
          {n.limit === "unlimited" ? t("noLimit") : t("limit", { count: n.limit })}
        </Row>
      </Section>

      <Section title={t("routing")}>
        <Row label={t("team")}>
          <select disabled={!isOwner} defaultValue={n.teamKey} className={control} aria-label={t("team")}>
            {teams.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
        </Row>
        <Row label={t("newChatsGo")}>
          <fieldset disabled={!isOwner} className="grid gap-2">
            <legend className="sr-only">{t("newChatsGo")}</legend>
            {ROUTES.map((value) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="radio" name={`route-${n.id}`} value={value} defaultChecked={n.newChats === value} disabled={value === "rules"} className="mt-1 size-4 accent-[var(--primary)]" />
                <span className="grid">
                  <span className="font-medium">{t(`routes.${value}.title`)}</span>
                  <span className="text-sm text-muted">{value === "person" ? fmt.list(people) : t(`routes.${value}.help`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Row>
      </Section>

      <Section title={t("profile")}>
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_16rem]">
          <div className="grid gap-4">
            <Row label={t("displayName")} help={t(`displayNameHelp.${n.displayNameStatus}`)}>
              <span className="flex flex-wrap items-center gap-2">{n.displayName} {n.displayNameStatus !== "approved" && <Badge tone={n.displayNameStatus === "pending" ? "warn" : "fail"}>{t(`displayNameBadge.${n.displayNameStatus}`)}</Badge>}</span>
            </Row>
            <Row label={t("about")}>
              <textarea disabled={!isOwner} defaultValue={n.about} rows={2} maxLength={139} dir="auto" className={`${control} resize-none py-2`} aria-label={t("about")} />
            </Row>
            <Row label={t("category")}>{n.category}</Row>
          </div>
          {/* How customers see the profile */}
          <div aria-label={t("customersSee")} className="grid w-full max-w-64 justify-items-center gap-2 justify-self-center rounded-[1.75rem] border-[6px] border-text/80 bg-bg px-4 pb-6 pt-8 text-center">
            <span className="bg-primary grid size-16 place-items-center rounded-full font-semibold text-2xl text-white" aria-hidden="true">{n.displayName.charAt(0)}</span>
            <p className="font-semibold">{n.displayNameStatus === "approved" ? n.displayName : <span dir="ltr">{n.number}</span>}</p>
            <p className="text-xs text-muted">{t("businessAccount", { category: n.category })}</p>
            <p className="text-sm" dir="auto">{n.about}</p>
          </div>
        </div>
      </Section>

      <Section title={t("usageTitle")}>
        <dl className="grid grid-cols-3 gap-4">
          {USAGE.map((k) => (
            <div key={k} className="grid gap-0.5">
              <dt className="text-sm text-muted">{t(`usage.${k}`)}</dt>
              <dd className="display text-3xl">{fmt.number(n.usage[k])}</dd>
              <dd className="text-xs text-muted">{usageHelp[k]}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-border pt-4 text-sm">
          {t.rich("estimated", { cost: <strong className="font-semibold tabular-nums">{fmt.money(cost)}</strong> })}
        </p>
        {n.cardOnMeta ? (
          <p className="text-sm text-muted">{t("cardOnFile")}</p>
        ) : (
          <p className="flex gap-2 rounded-[var(--radius-control)] bg-warn-soft p-3 text-sm">
            <WarningCircle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            {t("noCard")}
          </p>
        )}
      </Section>

      {isOwner && (
        <details className="group rounded-[var(--radius-panel)] border border-border p-5">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-medium text-fail [&::-webkit-details-marker]:hidden">
            {t("disconnectMenu")}
          </summary>
          <div className="mt-3 grid gap-3">
            <p className="text-sm">{t.rich("disconnectBody", { number: <span dir="ltr">{n.number}</span> })}</p>
            <button type="button" disabled className={buttonClass("destructive", "sm", "w-fit")} title={common("turnedOffInPreview")}>{t("disconnect", { name: n.displayName })}</button>
          </div>
        </details>
      )}
    </div>
  );
}
