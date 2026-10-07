"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, DownloadSimple, Star, Table } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { ChannelMark } from "@/components/channels/channel-mark";
import type { ChannelKey } from "@/components/channels/catalog";
import { useFormat, useT } from "@/i18n/client";
import { buildReport, type Agent, type Range, type Report } from "./sample";

/**
 * Reports (decided 2026-10-07): conversations, team, satisfaction, sales and campaigns. One hue (the accent) for
 * every chart: bars and the heatmap show amounts, and channels and people are named rows, so nothing relies
 * on telling colours apart. Every chart has a hover read-out and a table view.
 */
type Tab = "conversations" | "team" | "csat" | "sales";
const TABS: Tab[] = ["conversations", "team", "csat", "sales"];

interface Props {
  agents: Agent[];
  teams: { id: string; name: string }[];
  /** "all" sees every team; "team" only their own (reports.view scope). */
  teamScope: "all" | "team";
  myTeams: string[];
  canMoney: boolean;
  canExport: boolean;
  now: number;
}

function Kpi({ label, value, delta, good }: { label: string; value: string; delta?: number; good?: "up" | "down" }) {
  const t = useT("reports");
  const better = delta === undefined || delta === 0 ? null : (delta > 0) === (good !== "down");
  return (
    <div className="grid gap-1 bg-surface px-5 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-medium tabular-nums">{value}</dd>
      {delta !== undefined && delta !== 0 && (
        <dd className={`flex items-center gap-1 text-xs ${better ? "text-done" : "text-warn"}`}>
          {delta > 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
          {t("vsPrevious", { pct: Math.abs(delta) })}
        </dd>
      )}
    </div>
  );
}

function Panel({ title, children, onTable, tableOn }: { title: string; children: React.ReactNode; onTable?: () => void; tableOn?: boolean }) {
  const t = useT("reports");
  return (
    <section className="grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {onTable && (
          <button type="button" onClick={onTable} aria-pressed={tableOn} className={buttonClass("ghost", "sm", tableOn ? "bg-surface-2" : "")}>
            <Table size={16} aria-hidden="true" /> {t("tableView")}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Conversations per day: thin bars on a recessive grid, a read-out on hover or focus. */
function DayBars({ days }: { days: Report["days"] }) {
  const t = useT("reports");
  const fmt = useFormat();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.n), 1);
  const top = Math.ceil(max / 10) * 10;
  const W = 640, H = 180, pad = 28;
  const bw = (W - pad) / days.length;
  const h = (n: number) => (n / top) * (H - 20);
  const shown = hover ?? days.length - 1;
  return (
    <div className="grid gap-2">
      <p className="text-sm" aria-live="polite">
        <span className="font-medium tabular-nums">{fmt.number(days[shown].n)}</span>{" "}
        <span className="text-muted">{t("onDay", { day: fmt.shortDate(days[shown].at) })}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={t("perDayLabel")}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={pad} x2={W} y1={H - g * (H - 20)} y2={H - g * (H - 20)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad - 6} y={H - g * (H - 20) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{Math.round(top * g)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = pad + i * bw;
          const bh = Math.max(2, h(d.n));
          const w = Math.max(2, bw - 2);
          return (
            <g key={d.at} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              <path
                d={`M${x},${H} v${-(bh - 4)} q0,-4 4,-4 h${w - 8 > 0 ? w - 8 : 0} q4,0 4,4 v${bh - 4} z`}
                fill="var(--primary)"
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            </g>
          );
        })}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text key={i} x={i === 0 ? pad : i === days.length - 1 ? W : pad + i * bw + bw / 2} y={H + 14} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="10" fill="var(--text-muted)">{fmt.shortDate(days[i].at)}</text>
        ))}
      </svg>
    </div>
  );
}

/** A named row with a single-hue bar: identity is the label, the bar only shows the amount. */
function BarRow({ label, mark, value, max, text }: { label: string; mark?: ChannelKey; value: number; max: number; text: string }) {
  return (
    <li className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_auto]" title={`${label}: ${text}`}>
      <span className="flex min-w-0 items-center gap-2">{mark && <ChannelMark ch={mark} size={18} label={false} />}<span className="truncate">{label}</span></span>
      <span className="h-2 rounded-full bg-surface-2"><span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.max(2, (value / Math.max(max, 1)) * 100)}%` }} /></span>
      <span className="text-end tabular-nums text-muted">{text}</span>
    </li>
  );
}

const STEPS = [0.08, 0.25, 0.45, 0.7, 1];
function Heatmap({ heat }: { heat: number[][] }) {
  const t = useT("reports");
  const fmt = useFormat();
  const max = Math.max(...heat.flat(), 1);
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const step = (v: number) => STEPS[Math.min(4, Math.floor((v / max) * 4.999))];
  return (
    <div className="grid gap-2 overflow-x-auto">
      <div className="grid min-w-[30rem] grid-cols-[3rem_repeat(12,1fr)] gap-0.5 text-xs" role="table" aria-label={t("busyLabel")}>
        <span role="columnheader" />
        {Array.from({ length: 12 }, (_, h) => <span key={h} role="columnheader" className="text-center text-muted tabular-nums">{h % 2 === 0 ? `${String(h * 2).padStart(2, "0")}` : ""}</span>)}
        {heat.map((row, d) => (
          <div key={d} role="row" className="contents">
            <span role="rowheader" className="self-center text-muted">{t(`days.${days[d]}`)}</span>
            {row.map((v, h) => (
              <span key={h} role="cell" title={t("busyCell", { day: t(`days.${days[d]}`), from: `${String(h * 2).padStart(2, "0")}:00`, count: fmt.number(v) })} className="h-6 rounded-[3px]" style={{ background: "var(--primary)", opacity: step(v) }}>
                <span className="sr-only">{fmt.number(v)}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {t("less")} {STEPS.map((s) => <span key={s} className="size-3 rounded-[3px]" style={{ background: "var(--primary)", opacity: s }} aria-hidden="true" />)} {t("more")}
      </p>
    </div>
  );
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Reports({ agents, teams, teamScope, myTeams, canMoney, canExport, now }: Props) {
  const t = useT("reports");
  const tAll = useT();
  const fmt = useFormat();
  const visibleTeams = teamScope === "all" ? teams : teams.filter((x) => myTeams.includes(x.id));
  const [tab, setTab] = useState<Tab>("conversations");
  const [range, setRange] = useState<Range>(30);
  const [team, setTeam] = useState(teamScope === "all" ? "all" : visibleTeams[0]?.id ?? "all");
  const [channel, setChannel] = useState<ChannelKey | "all">("all");
  const [tables, setTables] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => () => setTables((x) => ({ ...x, [k]: !x[k] }));
  const report = useMemo(() => buildReport({ range, team, channel }, agents, now), [range, team, channel, agents, now]);
  const delta = Math.round(((report.total - report.prevTotal) / Math.max(1, report.prevTotal)) * 100);
  const minutes = (m: number) => (m < 60 ? tAll("time.minutes", { count: m }) : t("hours", { h: (m / 60).toFixed(1) }));
  const maxCh = Math.max(...report.byChannel.map((c) => c.n), 1);
  const field = "min-h-9 rounded-full border border-input bg-surface px-3 text-sm";

  function exportTab() {
    const name = `relay-${tab}-${range}d`;
    if (tab === "conversations") downloadCsv(name, [["Channel", "Conversations", "First reply (min)", "Resolved %", "CSAT %"], ...report.byChannel.map((c) => [tAll(`channels.${c.key}`), c.n, c.firstReply ?? "", c.resolvedPct, c.csat])]);
    if (tab === "team") downloadCsv(name, [["Person", "Conversations", "First reply (min)", "Resolved", "CSAT %", "Handed over", "Received"], ...report.team.map((a) => [a.name, a.n, a.firstReply, a.resolved, a.csat, a.handoversOut, a.handoversIn])]);
    if (tab === "csat") downloadCsv(name, [["Rating", "Responses"], ...report.csat.dist.map((n, i) => [5 - i, n])]);
    if (tab === "sales") downloadCsv(name, [["Campaign", "Channel", "Sent", "Delivered", "Read", "Replied", "Orders"], ...report.campaigns.map((c) => [c.name, tAll(`channels.${c.channel}`), c.sent, c.delivered, c.read, c.replied, c.orders])]);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title text-3xl">{t("title")}</h1>
        {canExport && <button type="button" onClick={exportTab} className={buttonClass("secondary", "sm")}><DownloadSimple size={16} aria-hidden="true" /> {t("export")}</button>}
      </header>

      {/* Filters: one row above every chart, applying to all of them. */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={range} onChange={(e) => setRange(Number(e.target.value) as Range)} className={field} aria-label={t("range")}>
          {([7, 30, 90] as const).map((d) => <option key={d} value={d}>{t("lastDays", { count: d })}</option>)}
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)} className={field} aria-label={t("team")}>
          {teamScope === "all" && <option value="all">{t("allTeams")}</option>}
          {visibleTeams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value as ChannelKey | "all")} className={field} aria-label={t("channel")}>
          <option value="all">{t("allChannels")}</option>
          {buildReport({ range, team: "all", channel: "all" }, [], now).byChannel.map((c) => <option key={c.key} value={c.key}>{tAll(`channels.${c.key}`)}</option>)}
        </select>
        <span className="text-xs text-muted">{t("sample")}</span>
      </div>

      <div role="tablist" aria-label={t("title")} className="flex gap-5 border-b border-border">
        {TABS.map((k) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px min-h-10 border-b-2 text-sm font-medium ${tab === k ? "border-primary text-text" : "border-transparent text-muted hover:text-text"}`}>
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === "conversations" && (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] bg-border ring-1 ring-border lg:grid-cols-5">
            <Kpi label={t("kpi.conversations")} value={fmt.number(report.total)} delta={delta} good="up" />
            <Kpi label={t("kpi.firstReply")} value={minutes(report.firstReply)} />
            <Kpi label={t("kpi.resolution")} value={minutes(report.resolution)} />
            <Kpi label={t("kpi.resolved")} value={`${report.resolvedPct}%`} />
            <Kpi label={t("kpi.withinTarget")} value={`${report.withinTarget}%`} />
          </dl>
          <Panel title={t("perDay")} onTable={toggle("days")} tableOn={tables.days}>
            {tables.days ? (
              <table className="w-full text-sm"><thead><tr className="text-start text-muted"><th className="py-1 text-start font-medium">{t("day")}</th><th className="text-end font-medium">{t("kpi.conversations")}</th></tr></thead>
                <tbody>{report.days.map((d) => <tr key={d.at} className="border-t border-border"><td className="py-1.5">{fmt.shortDate(d.at)}</td><td className="text-end tabular-nums">{d.n}</td></tr>)}</tbody></table>
            ) : <DayBars days={report.days} />}
          </Panel>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title={t("byChannel")}>
              <ul className="grid gap-2.5">
                {report.byChannel.map((c) => <BarRow key={c.key} label={tAll(`channels.${c.key}`)} mark={c.key} value={c.n} max={maxCh} text={`${fmt.number(c.n)} · ${c.firstReply === null ? t("calls") : minutes(c.firstReply)}`} />)}
              </ul>
              <p className="text-xs text-muted">{t("byChannelHelp")}</p>
            </Panel>
            <Panel title={t("busy")}>
              <Heatmap heat={report.heat} />
            </Panel>
          </div>
        </>
      )}

      {tab === "team" && (
        <Panel title={t("teamTitle")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="text-muted">{(["person", "conversations", "firstReply", "resolved", "csat", "handedOver", "received"] as const).map((k) => <th key={k} scope="col" className={`py-2 font-medium ${k === "person" ? "text-start" : "text-end"}`}>{t(`cols.${k}`)}</th>)}</tr></thead>
              <tbody>
                {report.team.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <th scope="row" className="py-2.5 text-start font-medium">{a.name}</th>
                    <td className="text-end tabular-nums">{a.n}</td>
                    <td className="text-end tabular-nums">{minutes(a.firstReply)}</td>
                    <td className="text-end tabular-nums">{a.resolved}</td>
                    <td className="text-end tabular-nums">{a.csat}%</td>
                    <td className="text-end tabular-nums">{a.handoversOut}</td>
                    <td className="text-end tabular-nums">{a.handoversIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2.5 border-t border-border pt-4">
            <li className="text-xs font-medium text-muted">{t("workload")}</li>
            {report.team.map((a) => <BarRow key={a.id} label={a.name} value={a.n} max={report.team[0]?.n ?? 1} text={fmt.number(a.n)} />)}
          </ul>
        </Panel>
      )}

      {tab === "csat" && (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] bg-border ring-1 ring-border lg:grid-cols-3">
            <Kpi label={t("kpi.csat")} value={`${report.csat.score}%`} />
            <Kpi label={t("kpi.responses")} value={fmt.number(report.csat.responses)} />
            <Kpi label={t("kpi.responseRate")} value={`${Math.round((report.csat.responses / Math.max(1, report.total)) * 100)}%`} />
          </dl>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title={t("distribution")}>
              <ul className="grid gap-2.5">
                {report.csat.dist.map((n, i) => <BarRow key={i} label={t("stars", { count: 5 - i })} value={n} max={Math.max(...report.csat.dist)} text={fmt.number(n)} />)}
              </ul>
              <p className="text-xs text-muted">{t("csatHelp")}</p>
            </Panel>
            <Panel title={t("comments")}>
              <ul className="grid gap-3">
                {report.csat.comments.length === 0 && <li className="text-sm text-muted">{t("noComments")}</li>}
                {report.csat.comments.map((c) => (
                  <li key={c.name} className="grid gap-1 border-b border-border pb-3 text-sm last:border-0">
                    <span className="flex items-center gap-2">
                      <ChannelMark ch={c.channel} size={16} label={tAll(`channels.${c.channel}`)} />
                      <bdi className="font-medium">{c.name}</bdi>
                      <span className="ms-auto inline-flex items-center gap-0.5 text-xs tabular-nums" aria-label={t("stars", { count: c.score })}>{c.score}<Star size={12} weight="fill" aria-hidden="true" /></span>
                    </span>
                    <span dir="auto">{c.text}</span>
                    <span className="text-xs text-muted">{t("handledBy", { name: c.agent })}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}

      {tab === "sales" && (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title={t("pipeline")}>
              <ul className="grid gap-2.5">
                {report.pipeline.map((p) => (
                  <BarRow key={p.stage} label={tAll(`stages.${p.stage}`)} value={canMoney ? p.value : p.n} max={Math.max(...report.pipeline.map((x) => (canMoney ? x.value : x.n)))} text={canMoney ? `${fmt.moneyWhole(p.value)} · ${p.n}` : t("dealsN", { count: p.n })} />
                ))}
              </ul>
              {!canMoney && <p className="text-xs text-muted">{t("valuesHidden")}</p>}
            </Panel>
            <dl className="grid content-start gap-px overflow-hidden rounded-[var(--radius-panel)] bg-border ring-1 ring-border">
              <Kpi label={t("kpi.won")} value={canMoney ? fmt.moneyWhole(report.pipeline[3].value) : String(report.pipeline[3].n)} />
              <Kpi label={t("kpi.winRate")} value={`${Math.round((report.pipeline[3].n / Math.max(1, report.pipeline[3].n + 4)) * 100)}%`} />
            </dl>
          </div>
          <Panel title={t("campaigns")}>
            {report.campaigns.length === 0 ? <p className="text-sm text-muted">{t("noCampaigns")}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead><tr className="text-muted">{(["campaign", "sent", "delivered", "read", "replied", "orders"] as const).map((k) => <th key={k} scope="col" className={`py-2 font-medium ${k === "campaign" ? "text-start" : "text-end"}`}>{t(`cols.${k}`)}</th>)}</tr></thead>
                  <tbody>
                    {report.campaigns.map((c) => (
                      <tr key={c.name} className="border-t border-border">
                        <th scope="row" className="py-2.5 text-start font-medium"><span className="flex items-center gap-2"><ChannelMark ch={c.channel} size={16} label={tAll(`channels.${c.channel}`)} />{c.name}</span></th>
                        <td className="text-end tabular-nums">{fmt.number(c.sent)}</td>
                        <td className="text-end tabular-nums">{fmt.number(c.delivered)}</td>
                        <td className="text-end tabular-nums">{c.read ? fmt.number(c.read) : "—"}</td>
                        <td className="text-end tabular-nums">{fmt.number(c.replied)}</td>
                        <td className="text-end tabular-nums">{fmt.number(c.orders)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted">{t("smsRead")}</p>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
