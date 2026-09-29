import { useState, type Ref } from "react";
import { Info, WarningCircle } from "@phosphor-icons/react";
import type { ConversationActions } from "@app/domain";
import { windowOpen } from "@app/domain";
import { buttonClass } from "@/components/ui/button";
import { aed } from "./format";
import type { InboxAction } from "./store";
import type { Conversation, Person } from "./types";

export type ComposerMode = "reply" | "note";

// Meta's UAE rate card, per delivered template message (fils). Shown before sending, never marked up.
const TEMPLATES = [
  { name: "order_update", label: "Order update", category: "Utility", preview: "Hi {{1}}, an update on your order {{2}}: {{3}}", costFils: 6 },
  { name: "follow_up", label: "Follow-up offer", category: "Marketing", preview: "Hi {{1}}, still interested in {{2}}? This week only: {{3}}", costFils: 21 },
];

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
  const [note, setNote] = useState("");
  const [template, setTemplate] = useState(TEMPLATES[0].name);
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
    <div role="group" aria-label="Reply or internal note" className="inline-flex rounded-full bg-surface-2 p-0.5 text-sm">
      {(["reply", "note"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          title={m === "reply" ? "Reply (R)" : "Internal note (N)"}
          onClick={() => setMode(m)}
          className={`min-h-8 rounded-full px-3 font-medium transition-colors ${mode === m ? "bg-surface text-text shadow-[var(--shadow-1)]" : "text-muted hover:text-text"}`}
        >
          {m === "reply" ? "Reply" : "Note"}
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
        <label htmlFor={`note-${c.id}`} className="sr-only">Internal note</label>
        <textarea
          ref={noteRef}
          id={`note-${c.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && addNote()}
          placeholder={`A note for your team. ${first} never sees it.`}
          className={field}
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          {switcher}
          <button type="submit" disabled={!note.trim()} className={buttonClass("secondary", "sm")}>Add note</button>
        </div>
      </form>
    );
  } else if (c.status === "spam") {
    body = <p className="px-4 py-3 text-muted">This chat is in Spam. Move it out of Spam to reply.</p>;
  } else if (actions.access === "claim") {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p>Nobody is handling this chat yet.</p>
        <div className="flex items-center gap-2">
          {switcher}
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => dispatch({ type: "claim", id: c.id, by: me, at: at() })}>
            Claim chat
          </button>
        </div>
      </div>
    );
  } else if (!canType) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-muted">
          {holder ? (
            <>
              <strong className="font-semibold text-text">{holder.name}</strong> is handling this chat. You can read it{actions.canWriteNotes ? " and add notes" : ""}.
            </>
          ) : (
            "Nobody is handling this chat yet, and your role can't claim it."
          )}
        </p>
        <div className="flex items-center gap-2">
          {switcher}
          {actions.canAskToCollaborate && (
            <button type="button" className={buttonClass("secondary", "sm")} onClick={() => dispatch({ type: "askCollab", id: c.id, by: me, at: at() })}>
              Ask to collaborate
            </button>
          )}
        </div>
      </div>
    );
  } else if (needsTemplate) {
    body = (
      <fieldset className="grid gap-2 p-3">
        <legend className="px-1 pb-2 text-sm text-muted">{first} last wrote over 24 hours ago, so WhatsApp only allows an approved template until they reply.</legend>
        {TEMPLATES.map((t) => (
          <label key={t.name} className={`flex cursor-pointer gap-3 rounded-[var(--radius-control)] border p-3 ${template === t.name ? "border-primary bg-primary-soft" : "border-border"}`}>
            <input type="radio" name={`tpl-${c.id}`} value={t.name} checked={template === t.name} onChange={() => setTemplate(t.name)} className="mt-1 accent-[var(--primary)]" />
            <span className="grid gap-0.5">
              <span className="font-medium">{t.label} <span className="text-sm font-normal text-muted">· {t.category} · {aed(t.costFils)} per message</span></span>
              <span className="text-sm text-muted">{t.preview}</span>
            </span>
          </label>
        ))}
        <div className="flex items-center justify-between gap-2 pt-1">
          {switcher}
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => setNotSent(true)}>Send template</button>
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
        <label htmlFor={`reply-${c.id}`} className="sr-only">Reply to {first}</label>
        <textarea
          ref={replyRef}
          id={`reply-${c.id}`}
          rows={2}
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && !c.phoneReply && draft.trim() && setNotSent(true)}
          placeholder={c.channel === "email" ? `Reply to ${first} by email` : `Reply to ${first} on WhatsApp`}
          className={field}
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          <span className="flex min-w-0 items-center gap-2">
            {switcher}
            {actions.access === "override" && holder && (
              <span className="truncate text-xs text-muted" title={`You're replying as a manager. ${holder.name} stays in charge and is told you replied.`}>
                As manager · {holder.name} stays in charge
              </span>
            )}
          </span>
          <button type="submit" disabled={!draft.trim() || !!c.phoneReply} title="Send (Ctrl + Enter)" className={buttonClass("primary", "sm")}>
            Send
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
              <strong className="font-semibold">{phoneAuthor.name}</strong> replied from the WhatsApp app while this reply was waiting. Check it so {first} doesn&apos;t get two answers.
            </span>
          </p>
          <div className="flex flex-wrap gap-2 ps-7">
            <a href={`#last-${c.id}`} onClick={() => dispatch({ type: "dismissPhoneReply", id: c.id })} className={buttonClass("secondary", "sm")}>Review reply</a>
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => dispatch({ type: "dismissPhoneReply", id: c.id })}>Send anyway</button>
          </div>
        </div>
      )}
      <div className={card}>{body}</div>
      {notSent && !noting && (
        <p role="status" className="mx-auto flex w-full max-w-3xl gap-2 px-1 text-sm text-muted">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          Sample chat, so nothing was sent. Replies go out once your {c.channel === "email" ? "Outlook mailbox" : "WhatsApp number"} is connected.
        </p>
      )}
    </div>
  );
}
