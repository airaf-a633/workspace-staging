"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle, FileCsv, UploadSimple } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import type { CustomFieldDef, Customer } from "./types";

/**
 * Import contacts from a spreadsheet (decided 2026-10-07): upload, match columns, then review. Exact matches
 * (same email or phone) update the existing contact; likely matches (same name) wait for a person to merge or
 * keep apart; rows without a name or a way to reach them are skipped with a reason. Nothing is silently overwritten.
 */
type Target = "name" | "email" | "phone" | "company" | "tags" | "skip" | `field:${string}`;
type Kind = "new" | "update" | "likely" | "invalid";
const STEP_KEYS = ["upload", "map", "review", "done"] as const;

const SAMPLE = `Full name,Email,Phone,Company,Tags
Mariam Haddad,mariam@haddadinteriors.co.uk,+44 7700 900412,Haddad Interiors,Wholesale
Grace Kim,,+1 212 555 0148,,
Sofia Martins,sofia.martins@sapo.pt,,,
Hannah Schmidt,hannah@coworkhamburg.de,+49 151 555 0199,Cowork Hamburg,Wholesale
Liam O'Brien,liam.obrien@example.ie,,,
,no-name@example.com,,,
Priyanka Das,priyanka.das@,,,`;

/** A small CSV reader: commas, quoted fields with commas or doubled quotes, \n or \r\n line ends. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((c) => c)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

function guess(header: string, fields: CustomFieldDef[]): Target {
  const h = header.toLowerCase();
  if (/name/.test(h) && !/company|business/.test(h)) return "name";
  if (/mail/.test(h)) return "email";
  if (/phone|mobile|whatsapp|tel/.test(h)) return "phone";
  if (/company|business|organi/.test(h)) return "company";
  if (/tag|label/.test(h)) return "tags";
  const f = fields.find((x) => x.label.toLowerCase() === h);
  return f ? `field:${f.key}` : "skip";
}

const digits = (s = "") => s.replace(/\D/g, "");

export function ImportFlow({ base, existing, fields }: { base: string; existing: Customer[]; fields: CustomFieldDef[] }) {
  const t = useT("importContacts");
  const tAll = useT();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Target[]>([]);
  const [decisions, setDecisions] = useState<Record<number, "merge" | "apart">>({});
  const [error, setError] = useState<string | null>(null);

  function load(text: string, name: string) {
    const parsed = parseCsv(text);
    if (parsed.length < 2) return setError(t("errors.empty"));
    if (parsed.length > 10_001) return setError(t("errors.tooMany"));
    setError(null);
    setFileName(name);
    setRows(parsed);
    setMap(parsed[0].map((h) => guess(h, fields)));
    setStep(1);
  }

  const header = rows[0] ?? [];
  const body = rows.slice(1);
  const col = (target: Target) => map.indexOf(target);
  const value = (r: string[], target: Target) => (col(target) >= 0 ? r[col(target)] ?? "" : "");
  const mapped = col("name") >= 0 && (col("email") >= 0 || col("phone") >= 0);

  const review = body.map((r, i) => {
    const name = value(r, "name");
    const email = value(r, "email").toLowerCase();
    const phone = value(r, "phone");
    const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!name) return { i, name, kind: "invalid" as Kind, reason: t("reasons.noName") };
    if (!validEmail && digits(phone).length < 7) return { i, name, kind: "invalid" as Kind, reason: t("reasons.noReach") };
    const exact = existing.find((c) => (validEmail && c.email?.toLowerCase() === email) || (digits(phone).length >= 9 && digits(c.phone).endsWith(digits(phone).slice(-9))));
    if (exact) return { i, name, kind: "update" as Kind, match: exact };
    const likely = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (likely) return { i, name, kind: "likely" as Kind, match: likely };
    return { i, name, kind: "new" as Kind };
  });
  const count = (k: Kind) => review.filter((x) => x.kind === k).length;
  const undecided = review.filter((x) => x.kind === "likely" && !decisions[x.i]).length;
  const field = "min-h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";

  return (
    <div className="grid gap-6">
      <Link href={`${base}/customers`} className="-mb-2 inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <header className="grid gap-1">
        <h1 className="title text-3xl">{t("title")}</h1>
        <p className="text-muted">{t("stepOf", { n: step + 1, total: 4 })} · {t(`steps.${STEP_KEYS[step]}`)}</p>
      </header>
      <ol className="flex gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map((k) => <li key={k} className={`h-1 flex-1 rounded-full ${k <= step ? "bg-primary" : "bg-border"}`} />)}</ol>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6">
        {step === 0 && (
          <div className="grid gap-4">
            <label className="grid cursor-pointer justify-items-center gap-3 rounded-[var(--radius-panel)] border-2 border-dashed border-border px-6 py-10 text-center hover:bg-surface-2">
              <UploadSimple size={32} className="text-muted" aria-hidden="true" />
              <span className="font-medium">{t("drop")}</span>
              <span className="text-sm text-muted">{t("dropHelp")}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5_000_000) return setError(t("errors.tooBig"));
                  void f.text().then((text) => load(text, f.name));
                }}
              />
            </label>
            {error && <p role="alert" className="text-sm text-fail">{error}</p>}
            <button type="button" onClick={() => load(SAMPLE, "northwind-contacts.csv")} className={buttonClass("secondary", "sm", "w-fit")}>
              <FileCsv size={16} aria-hidden="true" /> {t("useSample")}
            </button>
            <p className="text-sm text-muted">{t("consentNote")}</p>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <p className="text-sm text-muted">{t("mapHelp", { file: fileName, count: body.length })}</p>
            <div className="grid gap-2">
              {header.map((h, k) => (
                <label key={k} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <span className="grid">
                    <span className="text-sm font-medium" dir="auto">{h || t("unnamed")}</span>
                    <span className="truncate text-xs text-muted" dir="auto">{body.slice(0, 2).map((r) => r[k]).filter(Boolean).join(", ")}</span>
                  </span>
                  <span className="hidden text-muted sm:block" aria-hidden="true">→</span>
                  <select value={map[k]} onChange={(e) => setMap(map.map((m, j) => (j === k ? (e.target.value as Target) : m)))} className={field} aria-label={t("mapTo", { column: h })}>
                    {(["name", "email", "phone", "company", "tags"] as const).map((x) => <option key={x} value={x}>{t(`targets.${x}`)}</option>)}
                    {fields.map((f) => <option key={f.key} value={`field:${f.key}`}>{f.label}</option>)}
                    <option value="skip">{t("targets.skip")}</option>
                  </select>
                </label>
              ))}
            </div>
            {!mapped && <p role="alert" className="text-sm text-fail">{t("errors.needColumns")}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-control)] bg-border ring-1 ring-border sm:grid-cols-4">
              {(["new", "update", "likely", "invalid"] as const).map((k) => (
                <div key={k} className="grid gap-0.5 bg-surface px-4 py-3">
                  <dt className="text-xs text-muted">{t(`kinds.${k}`)}</dt>
                  <dd className="text-xl font-medium tabular-nums">{count(k)}</dd>
                </div>
              ))}
            </dl>
            {count("likely") > 0 && (
              <section className="grid gap-2">
                <h2 className="text-sm font-semibold">{t("likelyTitle")}</h2>
                <ul className="grid gap-2">
                  {review.filter((x) => x.kind === "likely").map((x) => (
                    <li key={x.i} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border p-3 text-sm">
                      <span>{t.rich("likelyRow", { row: <bdi className="font-medium">{x.name}</bdi>, existing: <Link href={`${base}/customers/${x.match!.id}`} className="underline underline-offset-2">{x.match!.name}</Link> })}</span>
                      <span role="radiogroup" aria-label={x.name} className="inline-flex rounded-full bg-surface-2 p-0.5">
                        {(["merge", "apart"] as const).map((d) => (
                          <button key={d} type="button" role="radio" aria-checked={decisions[x.i] === d} onClick={() => setDecisions({ ...decisions, [x.i]: d })} className={`min-h-8 rounded-full px-3 text-xs font-medium ${decisions[x.i] === d ? "bg-surface text-text shadow-[var(--shadow-1)]" : "text-muted"}`}>
                            {t(`decisions.${d}`)}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {count("update") > 0 && (
              <section className="grid gap-1 text-sm">
                <h2 className="font-semibold">{t("updateTitle")}</h2>
                <p className="text-muted">{t("updateBody")}</p>
                <p>{review.filter((x) => x.kind === "update").map((x) => x.match!.name).join(", ")}</p>
              </section>
            )}
            {count("invalid") > 0 && (
              <section className="grid gap-1 text-sm">
                <h2 className="font-semibold">{t("invalidTitle")}</h2>
                <ul className="grid gap-1 text-muted">
                  {review.filter((x) => x.kind === "invalid").map((x) => <li key={x.i}>{t("rowN", { n: x.i + 2 })}: {x.reason}</li>)}
                </ul>
              </section>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid justify-items-start gap-3">
            <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle size={24} weight="fill" className="text-done" aria-hidden="true" />{t("doneTitle")}</p>
            <p className="text-muted">
              {t("doneBody", {
                created: count("new") + review.filter((x) => x.kind === "likely" && decisions[x.i] === "apart").length,
                updated: count("update") + review.filter((x) => x.kind === "likely" && decisions[x.i] === "merge").length,
                skipped: count("invalid"),
              })}
            </p>
            <p className="text-sm text-muted">{t("previewNote")}</p>
            <Link href={`${base}/customers`} className={buttonClass("primary", "md")}>{t("back")}</Link>
          </div>
        )}
      </section>

      {step > 0 && step < 3 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {step === 2 && undecided > 0 && <span className="me-auto text-sm text-muted">{t("decideAll", { count: undecided })}</span>}
          <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("ghost", "md")}>{tAll("connect.backStep")}</button>
          <button type="button" disabled={(step === 1 && !mapped) || (step === 2 && undecided > 0)} onClick={() => setStep(step + 1)} className={buttonClass("primary", "md")}>
            {step === 2 ? t("importN", { count: body.length - count("invalid") }) : tAll("connect.next")}
          </button>
        </div>
      )}
    </div>
  );
}
