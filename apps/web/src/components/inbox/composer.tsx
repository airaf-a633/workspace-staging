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

const field =
  "w-full resize-y rounded-[var(--radius-control)] border border-input bg-surface px-3 py-2 text-base text-text placeholder:text-muted";

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
  const at = () => Date.now();

  function send() {
    setNotSent(true);
  }

  function addNote() {
    if (!note.trim()) return;
    dispatch({ type: "note", id: c.id, by: me, text: note, at: at() });
    setNote("");
  }

  const tab = (m: ComposerMode, label: string, key: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      title={`${label} (${key})`}
      onClick={() => setMode(m)}
      className={`min-h-11 border-b-2 px-3 text-sm font-medium ${mode === m ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="border-t border-border bg-surface">
      <div role="tablist" aria-label="Reply or note" className="flex gap-1 px-3">
        {tab("reply", "Reply", "R")}
        {actions.canWriteNotes && tab("note", "Internal note", "N")}
      </div>

      <div className="grid gap-3 px-4 pb-4 pt-2">
        {mode === "note" && actions.canWriteNotes ? (
          <form
            className="grid gap-2"
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
              placeholder="Write a note for your team"
              className={`${field} border-dashed border-note-border bg-note-soft`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">Only your team sees notes. {first} never does.</p>
              <button type="submit" disabled={!note.trim()} className={buttonClass("secondary", "md")}>Add note</button>
            </div>
          </form>
        ) : c.status === "spam" ? (
          <p className="text-muted">This chat is in Spam. Move it out of Spam to reply.</p>
        ) : actions.access === "claim" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Nobody is handling this chat yet.</p>
            <button type="button" className={buttonClass("primary")} onClick={() => dispatch({ type: "claim", id: c.id, by: me, at: at() })}>
              Claim chat
            </button>
          </div>
        ) : !canType ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">
              {holder ? (
                <>
                  <strong className="font-semibold text-text">{holder.name}</strong> ({holder.role}) is handling this chat. You can read it
                  {actions.canWriteNotes ? " and add internal notes" : ""}.
                </>
              ) : (
                "Nobody is handling this chat yet, and your role can't claim it."
              )}
            </p>
            {actions.canAskToCollaborate && (
              <button type="button" className={buttonClass("secondary")} onClick={() => dispatch({ type: "askCollab", id: c.id, by: me, at: at() })}>
                Ask to collaborate
              </button>
            )}
          </div>
        ) : (
          <>
            {actions.access === "override" && holder && (
              <p className="flex gap-2 text-sm text-muted">
                <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                You&apos;re replying as a manager. {holder.name} stays in charge and is told you replied.
              </p>
            )}

            {c.phoneReply && phoneAuthor && (
              <div role="alert" className="grid gap-2 rounded-[var(--radius-control)] border border-warn bg-warn-soft p-3">
                <p className="flex gap-2">
                  <WarningCircle size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">{phoneAuthor.name}</strong> replied from the WhatsApp app while this reply was waiting. Check it so {first} doesn&apos;t get two answers.
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href={`#last-${c.id}`} onClick={() => dispatch({ type: "dismissPhoneReply", id: c.id })} className={buttonClass("secondary", "sm")}>
                    Review reply
                  </a>
                  <button type="button" className={buttonClass("ghost", "sm")} onClick={() => dispatch({ type: "dismissPhoneReply", id: c.id })}>
                    Send anyway
                  </button>
                </div>
              </div>
            )}

            {needsTemplate ? (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm">
                  {first} last wrote over 24 hours ago, so WhatsApp only allows an approved template until they reply.
                </legend>
                {TEMPLATES.map((t) => (
                  <label key={t.name} className={`flex cursor-pointer gap-3 rounded-[var(--radius-control)] border p-3 ${template === t.name ? "border-primary bg-primary-soft" : "border-border"}`}>
                    <input type="radio" name={`tpl-${c.id}`} value={t.name} checked={template === t.name} onChange={() => setTemplate(t.name)} className="mt-1 accent-[var(--primary)]" />
                    <span className="grid gap-0.5">
                      <span className="font-medium">{t.label} <span className="text-sm font-normal text-muted">· {t.category}</span></span>
                      <span className="text-sm text-muted">{t.preview}</span>
                      <span className="text-sm">Meta charges {aed(t.costFils)} per message</span>
                    </span>
                  </label>
                ))}
                <div className="flex justify-end">
                  <button type="button" className={buttonClass("primary")} onClick={send}>Send template</button>
                </div>
              </fieldset>
            ) : (
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
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
                  onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && !c.phoneReply && draft.trim() && send()}
                  placeholder={c.channel === "email" ? `Reply to ${first} by email` : `Reply to ${first} on WhatsApp`}
                  className={field}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted">
                    {c.status === "resolved" ? "Replying reopens this chat. " : ""}
                    {actions.access === "holder" && c.channel === "whatsapp" ? `${first} sees "typing…" while you write.` : ""}
                  </p>
                  <button type="submit" disabled={!draft.trim() || !!c.phoneReply} title="Send (Ctrl + Enter)" className={buttonClass("primary")}>
                    Send
                  </button>
                </div>
              </form>
            )}

            {notSent && (
              <p role="status" className="flex gap-2 rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm">
                <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                This is a sample chat, so nothing was sent. Replies go out once your {c.channel === "email" ? "Outlook mailbox" : "WhatsApp number"} is connected.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
