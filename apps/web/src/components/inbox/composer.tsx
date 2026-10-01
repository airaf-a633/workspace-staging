import { useState, type Ref } from "react";
import { Info, WarningCircle } from "@phosphor-icons/react";
import type { ConversationActions } from "@app/domain";
import { windowOpen } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { useFormat, useLocale, useT } from "@/i18n/client";
import { AiButton } from "@/components/ai/chat-ai";
import { AiTag } from "@/components/ai/ai-tag";
import { AiFeedback } from "@/components/ai/feedback";
import type { InboxAction } from "./store";
import type { Conversation, Person } from "./types";

export type ComposerMode = "reply" | "note";

// Meta's UAE rate card, per delivered template message (fils). Shown before sending, never marked up.
// Labels and previews live in the language files (composer.templates.<name>): each template has a version per language.
const TEMPLATES = [
  { name: "order_update", category: "Utility", costFils: 6 },
  { name: "follow_up", category: "Marketing", costFils: 21 },
] as const;

interface Props {
  c: Conversation;
  actions: ConversationActions;
  people: Person[];
  me: string;
  now: number;
  mode: ComposerMode;
  setMode: (m: ComposerMode) => void;
  replyRef: Ref<HTMLTextAreaElement>;
  noteRef: Ref<HTMLTextAreaElement>;
  dispatch: (a: InboxAction) => void;
}

/* The reply box: a floating card at the foot of the thread, with a small Reply / Note switch inside it. */
export function Composer({ c, actions, people, me, now, mode, setMode, replyRef, noteRef, dispatch }: Props) {
  const [draft, setDraft] = useState(c.phoneReply?.draft ?? "");
  const [aiDrafted, setAiDrafted] = useState(false);
  const aiT = useT("aiChat");
  const locale = useLocale();
  const [note, setNote] = useState("");
  const [template, setTemplate] = useState<string>(TEMPLATES[0].name);
  const t = useT("composer");
  const fmt = useFormat();
  const [notSent, setNotSent] = useState(false);
  const holder = people.find((p) => p.id === c.holderId);
  const phoneAuthor = people.find((p) => p.id === c.phoneReply?.authorId);
  const first = c.contact.name.split(" ")[0];
  const canType = actions.access === "holder" || actions.access === "collaborator" || actions.access === "override";
  const needsTemplate = c.channel === "whatsapp" && !windowOpen(c.lastCustomerAt, now);
  const noting = mode === "note" && actions.canWriteNotes;
  const at = () => Date.now();

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

  const card = `mx-auto w-full max-w-3xl rounded-[var(--radius-panel)] border shadow-[var(--shadow-2)] transition-colors focus-within:ring-2 focus-within:ring-ring ${
    noting ? "border-dashed border-note-border bg-note-soft" : "border-border bg-surface"
  }`;
  const field = "block w-full resize-none bg-transparent px-4 pt-3 text-base text-text placeholder:text-muted focus:outline-none";

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
  } else if (needsTemplate) {
    body = (
      <fieldset className="grid gap-2 p-3">
        <legend className="px-1 pb-2 text-sm text-muted">{t("windowClosed", { name: first })}</legend>
        {TEMPLATES.map((tpl) => (
          <label key={tpl.name} className={`flex cursor-pointer gap-3 rounded-[var(--radius-control)] border p-3 ${template === tpl.name ? "border-primary bg-primary-soft" : "border-border"}`}>
            <input type="radio" name={`tpl-${c.id}`} value={tpl.name} checked={template === tpl.name} onChange={() => setTemplate(tpl.name)} className="mt-1 accent-[var(--primary)]" />
            <span className="grid gap-0.5">
              <span className="font-medium">{t(`templates.${tpl.name}.label`)} <span className="text-sm font-normal text-muted">· {t("templateMeta", { category: t(`categories.${tpl.category}`), cost: fmt.aed(tpl.costFils) })}</span></span>
              <span className="text-sm text-muted" dir="auto">{t(`templates.${tpl.name}.preview`)}</span>
            </span>
          </label>
        ))}
        <div className="flex items-center justify-between gap-2 pt-1">
          {switcher}
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => setNotSent(true)}>{t("sendTemplate")}</button>
        </div>
      </fieldset>
    );
  } else {
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNotSent(true);
        }}
      >
        <label htmlFor={`reply-${c.id}`} className="sr-only">{t("replyTo", { name: first })}</label>
        <textarea
          ref={replyRef}
          id={`reply-${c.id}`}
          rows={2}
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && !c.phoneReply && draft.trim() && setNotSent(true)}
          placeholder={c.channel === "email" ? t("placeholderEmail", { name: first }) : t("placeholderWhatsapp", { name: first })}
          className={field}
        />
        {aiDrafted && (
          <p className="flex flex-wrap items-center gap-2 px-4 pt-1 text-xs text-muted">
            <AiTag label={aiT("draftTag")} /> {aiT("draftCheck")} <AiFeedback />
            {/* A suggestion in the customer's language, with what it says for the reader. */}
            {c.contact.language === "Arabic" && locale === "en" && aiT.has(`gloss.${c.id}`) && <span className="basis-full">{aiT(`gloss.${c.id}` as "gloss.lina")}</span>}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          <span className="flex min-w-0 items-center gap-2">
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
          {c.channel === "email" ? t("notSentEmail") : t("notSentWhatsapp")}
        </p>
      )}
    </div>
  );
}
