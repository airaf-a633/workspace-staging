import { useState, type Ref } from "react";
import { BookOpenText, Info, PhoneCall, WarningCircle } from "@phosphor-icons/react";
import type { ConversationActions } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { ChannelMark } from "@/components/channels/channel-mark";
import { replyRule, smsParts, THREADED } from "@/components/channels/rules";
import type { ChannelKey } from "@/components/channels/catalog";
import { useFormat, useT } from "@/i18n/client";
import { AiButton } from "@/components/ai/chat-ai";
import { AiTag } from "@/components/ai/ai-tag";
import { AiFeedback } from "@/components/ai/feedback";
import { HELP_SITE, liveVersion, suggestArticles } from "@/components/help/sample";
import type { InboxAction } from "./store";
import type { ChannelInbox, Conversation, Identity, Person } from "./types";

export type ComposerMode = "reply" | "note";

// WhatsApp templates for when the 24-hour window has closed. Meta bills them at its rate for the customer's
// country, shown as such and never marked up. Labels and previews live in the language files (composer.templates.<name>).
const TEMPLATES = [
  { name: "order_update", category: "Utility" },
  { name: "follow_up", category: "Marketing" },
] as const;

interface Props {
  c: Conversation;
  /** The connected inbox this conversation arrived in. */
  inbox: ChannelInbox | undefined;
  inboxes: ChannelInbox[];
  actions: ConversationActions;
  people: Person[];
  me: string;
  now: number;
  mode: ComposerMode;
  setMode: (m: ComposerMode) => void;
  replyRef: Ref<HTMLTextAreaElement>;
  noteRef: Ref<HTMLTextAreaElement>;
  dispatch: (a: InboxAction) => void;
  /** Real chat: sending arrives with M2.4, so say that instead of "sample". */
  live?: boolean;
}

const idKey = (i: Identity) => `${i.ch}|${i.handle}`;

/*
 * The reply box: a floating card at the foot of the thread, with a small Reply / Note switch inside it.
 * It follows the rules of the channel it replies on (decided 2026-10-07): email has To, Cc and a subject,
 * SMS counts its parts, WhatsApp needs a template after 24 hours, Messenger and Instagram allow a week with
 * the Human Agent tag, voice calls back, and a broken channel offers the customer's other channels instead.
 */
export function Composer({ c, inbox, inboxes, actions, people, me, now, mode, setMode, replyRef, noteRef, dispatch, live = false }: Props) {
  const [draft, setDraft] = useState(c.phoneReply?.draft ?? "");
  const [aiDrafted, setAiDrafted] = useState(false);
  const aiT = useT("aiChat");
  const [note, setNote] = useState("");
  const [template, setTemplate] = useState<string>(TEMPLATES[0].name);
  const t = useT("composer");
  const o = useT("omni");
  const tAll = useT();
  const fmt = useFormat();
  const [notSent, setNotSent] = useState(false);
  const holder = people.find((p) => p.id === c.holderId);
  const phoneAuthor = people.find((p) => p.id === c.phoneReply?.authorId);
  const first = c.contact.name.split(" ")[0];
  const canType = actions.access === "holder" || actions.access === "collaborator" || actions.access === "override";
  const noting = mode === "note" && actions.canWriteNotes;
  const at = () => Date.now();
  const chName = (ch: ChannelKey) => tAll(`channels.${ch}`);

  // Where the reply goes: this conversation's channel, or another one the customer uses (a linked conversation).
  const usable = (ch: ChannelKey) => inboxes.some((x) => x.channel === ch && !x.broken);
  const own = c.contact.identities.find((i) => i.ch === c.channel) ?? { ch: c.channel, handle: "" };
  const others = c.contact.identities.filter((i) => i.ch !== c.channel && i.ch !== "voice" && i.ch !== "webchat" && usable(i.ch));
  const [viaKey, setViaKey] = useState(idKey(own));
  const via = [own, ...others].find((i) => idKey(i) === viaKey) ?? own;
  const linked = via.ch !== c.channel;
  const channel = linked ? via.ch : c.channel;
  const rule = replyRule(c.channel, c.lastCustomerAt, now);
  const [cc, setCc] = useState((c.messages.findLast((m) => m.kind === "in" && m.email?.cc)?.email?.cc ?? []).join(", "));
  const [subject, setSubject] = useState(c.subject ? (c.subject.startsWith("Re:") ? c.subject : `Re: ${c.subject}`) : "");

  function addNote() {
    if (!note.trim()) return;
    dispatch({ type: "note", id: c.id, by: me, text: note, at: at() });
    setNote("");
  }

  const switcher = actions.canWriteNotes && (
    <div role="group" aria-label={t("switcher")} className="inline-flex rounded-full bg-surface-2 p-0.5 text-sm">
      {(["reply", "note"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          title={m === "reply" ? t("replyTitle") : t("noteTitle")}
          onClick={() => setMode(m)}
          className={`min-h-8 rounded-full px-3 font-medium transition-colors ${mode === m ? "bg-surface text-text shadow-[var(--shadow-1)]" : "text-muted hover:text-text"}`}
        >
          {m === "reply" ? t("reply") : t("note")}
        </button>
      ))}
    </div>
  );

  /** The customer's other channels, as buttons, for when this one can't be used. */
  const alternatives =
    others.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {others.map((i) => (
          <button key={idKey(i)} type="button" onClick={() => setViaKey(idKey(i))} className={buttonClass("secondary", "sm")}>
            <ChannelMark ch={i.ch} size={16} label={false} />
            {o("composer.viaOption", { channel: chName(i.ch), handle: i.handle })}
          </button>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted">{o("composer.noOther", { name: first })}</p>
    );

  const viaPicker = others.length > 0 && (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <span className="shrink-0">{o("composer.via")}</span>
      <select value={viaKey} onChange={(e) => setViaKey(e.target.value)} className="min-h-8 min-w-0 max-w-48 truncate rounded-full border border-input bg-surface px-2.5 text-xs text-text">
        {[own, ...others].map((i) => (
          <option key={idKey(i)} value={idKey(i)} disabled={i === own && !!inbox?.broken}>
            {o("composer.viaOption", { channel: chName(i.ch), handle: i.handle || inbox?.name || "" })}
          </option>
        ))}
      </select>
    </label>
  );

  const card = `mx-auto w-full max-w-3xl rounded-[var(--radius-panel)] border shadow-[var(--shadow-2)] transition-colors focus-within:ring-2 focus-within:ring-ring ${
    noting ? "border-dashed border-note-border bg-note-soft" : "border-border bg-surface"
  }`;
  const field = "block w-full resize-none bg-transparent px-4 pt-3 text-base text-text placeholder:text-muted focus:outline-none";
  const line = "min-h-9 w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none";

  let body: React.ReactNode;
  if (noting) {
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addNote();
        }}
      >
        <label htmlFor={`note-${c.id}`} className="sr-only">{t("noteLabel")}</label>
        <textarea
          ref={noteRef}
          id={`note-${c.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && addNote()}
          placeholder={t("notePlaceholder", { name: first })}
          className={field}
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          {switcher}
          <button type="submit" disabled={!note.trim()} className={buttonClass("secondary", "sm")}>{t("addNote")}</button>
        </div>
      </form>
    );
  } else if (c.status === "spam") {
    body = <p className="px-4 py-3 text-muted">{t("inSpam")}</p>;
  } else if (actions.access === "claim") {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p>{t("nobody")}</p>
        <div className="flex items-center gap-2">
          {switcher}
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => dispatch({ type: "claim", id: c.id, by: me, at: at() })}>
            {t("claim")}
          </button>
        </div>
      </div>
    );
  } else if (!canType) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-muted">
          {holder
            ? t.rich(actions.canWriteNotes ? "holderNotes" : "holderReadOnly", { name: <strong className="font-semibold text-text">{holder.name}</strong> })
            : t("cantClaim")}
        </p>
        <div className="flex items-center gap-2">
          {switcher}
          {actions.canAskToCollaborate && (
            <button type="button" className={buttonClass("secondary", "sm")} onClick={() => dispatch({ type: "askCollab", id: c.id, by: me, at: at() })}>
              {t("askCollab")}
            </button>
          )}
        </div>
      </div>
    );
  } else if (!linked && inbox?.broken) {
    body = (
      <div className="grid gap-3 p-4">
        <p className="flex gap-2 text-sm">
          <WarningCircle size={18} className="mt-0.5 shrink-0 text-fail" aria-hidden="true" />
          {o("composer.broken", { inbox: inbox.name })}
        </p>
        {alternatives}
        <div>{switcher}</div>
      </div>
    );
  } else if (!linked && rule.kind === "call") {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm">{o("composer.call", { name: first })}</p>
        <div className="flex flex-wrap items-center gap-2">
          {switcher}
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setNotSent(true)}>{o("composer.logCall")}</button>
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => setNotSent(true)}>
            <PhoneCall size={16} aria-hidden="true" /> {o("composer.callBack")}
          </button>
        </div>
      </div>
    );
  } else if (!linked && rule.kind === "closed") {
    body = (
      <div className="grid gap-3 p-4">
        <p className="text-sm">
          {rule.reason === "wechat" ? o("composer.closed.wechat") : o("composer.closed.metaWeek", { channel: chName(c.channel) })}{" "}
          <span className="text-muted">{o("composer.otherChannel", { name: first })}</span>
        </p>
        {alternatives}
        <div>{switcher}</div>
      </div>
    );
  } else if (!linked && rule.kind === "template") {
    body = (
      <fieldset className="grid gap-2 p-3">
        <legend className="px-1 pb-2 text-sm text-muted">{t("windowClosed", { name: first })}</legend>
        {TEMPLATES.map((tpl) => (
          <label key={tpl.name} className={`flex cursor-pointer gap-3 rounded-[var(--radius-control)] border p-3 ${template === tpl.name ? "border-primary bg-primary-soft" : "border-border"}`}>
            <input type="radio" name={`tpl-${c.id}`} value={tpl.name} checked={template === tpl.name} onChange={() => setTemplate(tpl.name)} className="mt-1 accent-[var(--primary)]" />
            <span className="grid gap-0.5">
              <span className="font-medium">{t(`templates.${tpl.name}.label`)} <span className="text-sm font-normal text-muted">· {t("templateMeta", { category: t(`categories.${tpl.category}`) })}</span></span>
              <span className="text-sm text-muted" dir="auto">{t(`templates.${tpl.name}.preview`)}</span>
            </span>
          </label>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="flex min-w-0 items-center gap-2">{switcher}{viaPicker}</span>
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => setNotSent(true)}>{t("sendTemplate")}</button>
        </div>
      </fieldset>
    );
  } else {
    const sms = channel === "sms" ? smsParts(draft) : null;
    // AI's article shortlist for the customer's last message (sample workspace only: real workspaces have their own).
    // Read the customer's last few messages together: the latest is often just "Hello?".
    const recentIn = c.messages.filter((m) => m.kind === "in" && m.text).slice(-3).map((m) => m.text).join(" ");
    const articles = !live && recentIn ? suggestArticles(recentIn) : [];
    const notice = linked
      ? o("composer.viaNew", { channel: chName(channel), name: first })
      : rule.kind === "humanAgent"
        ? o("composer.humanAgent", { name: first, when: fmt.messageTime(rule.closesAt, now) })
        : c.visitor && !c.visitor.online
          ? c.contact.email ? o("composer.visitorLeft", { name: first, email: c.contact.email }) : o("composer.visitorLeftNoEmail", { name: first })
          : THREADED.includes(c.channel) && c.subject
            ? o("composer.thread", { place: c.subject })
            : null;
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNotSent(true);
        }}
      >
        {(notice || viaPicker) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-4 py-2 text-xs text-muted">
            {viaPicker}
            {notice && (
              <p className="flex min-w-0 flex-1 basis-60 gap-2">
                <Info size={16} className="shrink-0" aria-hidden="true" />
                {notice}
              </p>
            )}
          </div>
        )}
        {channel === "email" && (
          <div className="grid border-b border-border px-4 text-sm">
            <p className="flex min-h-9 items-center gap-3 border-b border-border">
              <span className="w-14 shrink-0 text-muted">{o("composer.to")}</span>
              <span dir="ltr" className="truncate">{linked ? via.handle : c.contact.email ?? via.handle}</span>
            </p>
            <label className="flex items-center gap-3 border-b border-border">
              <span className="w-14 shrink-0 text-muted">{o("composer.cc")}</span>
              <input value={cc} onChange={(e) => setCc(e.target.value)} dir="ltr" placeholder={o("composer.ccPlaceholder")} className={line} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-muted">{o("composer.subject")}</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} dir="auto" className={line} />
            </label>
          </div>
        )}
        <label htmlFor={`reply-${c.id}`} className="sr-only">{t("replyTo", { name: first })}</label>
        <textarea
          ref={replyRef}
          id={`reply-${c.id}`}
          rows={channel === "email" ? 4 : 2}
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && !c.phoneReply && draft.trim() && setNotSent(true)}
          placeholder={
            channel === "email" ? t("placeholderEmail", { name: first })
            : channel === "whatsapp" ? t("placeholderWhatsapp", { name: first })
            : o("composer.placeholder", { name: first, channel: chName(channel) })
          }
          className={field}
        />
        {aiDrafted && (
          <p className="flex flex-wrap items-center gap-2 px-4 pt-1 text-xs text-muted">
            <AiTag label={aiT("draftTag")} /> {aiT("draftCheck")} <AiFeedback />
            {/* A suggestion in the customer's language, with what it says for the reader. */}
            {c.contact.language !== "English" && aiT.has(`gloss.${c.id}`) && <span className="basis-full">{aiT(`gloss.${c.id}` as "gloss.lucia")}</span>}
          </p>
        )}
        {articles.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 px-4 pt-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><BookOpenText size={14} aria-hidden="true" />{o("help.suggested")}</span>
            {articles.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setDraft((d) => `${d}${d && !d.endsWith("\n") ? "\n\n" : ""}${liveVersion(a, "en")!.title}: https://${HELP_SITE.domain}/a/${a.slug}`)}
                title={o("help.insertLink")}
                className="inline-flex min-h-7 items-center rounded-full border border-border px-2.5 text-text hover:bg-surface-2"
              >
                {liveVersion(a, "en")!.title}
              </button>
            ))}
          </p>
        )}
        {sms && draft && (
          <p className="px-4 pt-1 text-xs tabular-nums text-muted">
            {o("composer.smsParts", { count: sms.parts, used: draft.length, limit: sms.limit })} · {o("composer.smsStop")}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pt-1">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {switcher}
            <AiButton
              label={aiT("suggest")}
              credits={1}
              onClick={() => {
                setDraft(c.aiSuggestion ?? aiT("genericSuggestion", { name: first }));
                setAiDrafted(true);
              }}
            />
            {actions.access === "override" && holder && (
              <span className="truncate text-xs text-muted" title={t("asManagerTitle", { name: holder.name })}>
                {t("asManager", { name: holder.name })}
              </span>
            )}
          </span>
          <button type="submit" disabled={!draft.trim() || !!c.phoneReply} title={t("sendTitle")} className={buttonClass("primary", "sm")}>
            {t("send")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-2 px-3 pb-3 md:px-6 md:pb-5">
      {canType && !noting && c.phoneReply && phoneAuthor && (
        <div role="alert" className="mx-auto grid w-full max-w-3xl gap-2 rounded-[var(--radius-panel)] bg-warn-soft p-3 text-sm">
          <p className="flex gap-2">
            <WarningCircle size={20} className="shrink-0 text-warn" aria-hidden="true" />
            <span>
              {t.rich("phoneReplied", { name: <strong className="font-semibold">{phoneAuthor.name}</strong>, customer: first })}
            </span>
          </p>
          <div className="flex flex-wrap gap-2 ps-7">
            <a href={`#last-${c.id}`} onClick={() => dispatch({ type: "dismissPhoneReply", id: c.id })} className={buttonClass("secondary", "sm")}>{t("reviewReply")}</a>
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => dispatch({ type: "dismissPhoneReply", id: c.id })}>{t("sendAnyway")}</button>
          </div>
        </div>
      )}
      <div className={card}>{body}</div>
      {notSent && !noting && (
        <p role="status" className="mx-auto flex w-full max-w-3xl gap-2 px-1 text-sm text-muted">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {live ? t("notSentLive") : o("composer.notSent", { channel: chName(channel) })}
        </p>
      )}
    </div>
  );
}
