"use client";

import { Plus, Prohibit, Tray, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { ChannelMark } from "@/components/channels/channel-mark";
import { useT } from "@/i18n/client";
import type { ChannelInbox, Label, Team } from "./types";

/**
 * The inbox's own sidebar (decided 2026-10-07, Chatwoot style): conversations, then one entry per connected
 * inbox, then teams and labels. Choosing an entry narrows the list; Mine / Unassigned / All sit above the list.
 */
export type Source = { kind: "all" } | { kind: "spam" } | { kind: "inbox"; id: string } | { kind: "team"; id: string } | { kind: "label"; id: string };

export const sourceKey = (s: Source) => (s.kind === "all" || s.kind === "spam" ? s.kind : `${s.kind}:${s.id}`);
export function parseSource(key: string): Source {
  if (key === "spam") return { kind: "spam" };
  const [kind, id] = key.split(":");
  if ((kind === "inbox" || kind === "team" || kind === "label") && id) return { kind, id };
  return { kind: "all" };
}

interface Props {
  source: Source;
  onSource: (s: Source) => void;
  inboxes: ChannelInbox[];
  teams: Team[];
  labels: Label[];
  /** Open conversations per source key. */
  count: (s: Source) => number;
  connectHref?: string;
}

function Item({ on, onClick, icon, label, count, warn }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number; warn?: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={on ? "true" : undefined}
        className={`flex min-h-9 w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-start text-sm transition-colors ${on ? "bg-primary-soft font-medium text-primary" : "text-text hover:bg-surface-2"}`}
      >
        <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
        <bdi className="min-w-0 flex-1 truncate">{label}</bdi>
        {warn && <WarningCircle size={16} weight="fill" className="shrink-0 text-fail" aria-label={warn} />}
        {!!count && <span className="shrink-0 text-xs tabular-nums text-muted">{count}</span>}
      </button>
    </li>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h3 className="px-2.5 pt-3 text-xs font-medium text-muted">{title}</h3>
      <ul className="grid gap-0.5">{children}</ul>
    </div>
  );
}

export function InboxNav({ source, onSource, inboxes, teams, labels, count, connectHref }: Props) {
  const t = useT("omni");
  const tAll = useT();
  const key = sourceKey(source);
  const pick = (s: Source) => () => onSource(s);

  return (
    <nav aria-label={t("nav.label")} className="grid content-start gap-1 overflow-y-auto p-2 pb-6">
      <Group title={t("nav.conversations")}>
        <Item on={key === "all"} onClick={pick({ kind: "all" })} icon={<Tray size={18} aria-hidden="true" />} label={t("nav.all")} count={count({ kind: "all" })} />
        <Item on={key === "spam"} onClick={pick({ kind: "spam" })} icon={<Prohibit size={18} aria-hidden="true" />} label={t("nav.spam")} />
      </Group>

      {inboxes.length > 0 && (
        <Group title={t("nav.inboxes")}>
          {inboxes.map((i) => {
            const s: Source = { kind: "inbox", id: i.id };
            return (
              <Item
                key={i.id}
                on={key === sourceKey(s)}
                onClick={pick(s)}
                icon={<ChannelMark ch={i.channel} size={18} label={tAll(`channels.${i.channel}`)} />}
                label={i.name}
                count={count(s)}
                warn={i.broken ? t("nav.disconnected") : undefined}
              />
            );
          })}
          {connectHref && (
            <li>
              <a href={connectHref} className="flex min-h-9 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text">
                <span className="grid size-5 place-items-center"><Plus size={16} aria-hidden="true" /></span>
                {t("nav.connect")}
              </a>
            </li>
          )}
        </Group>
      )}

      {teams.length > 0 && (
        <Group title={t("nav.teams")}>
          {teams.map((team) => {
            const s: Source = { kind: "team", id: team.id };
            return <Item key={team.id} on={key === sourceKey(s)} onClick={pick(s)} icon={<UsersThree size={18} aria-hidden="true" />} label={team.name} count={count(s)} />;
          })}
        </Group>
      )}

      {labels.length > 0 && (
        <Group title={t("nav.labels")}>
          {labels.map((l) => {
            const s: Source = { kind: "label", id: l.id };
            return (
              <Item
                key={l.id}
                on={key === sourceKey(s)}
                onClick={pick(s)}
                icon={<span className="size-2.5 rounded-full" style={{ background: l.color }} aria-hidden="true" />}
                label={l.name}
                count={count(s)}
              />
            );
          })}
        </Group>
      )}
    </nav>
  );
}
