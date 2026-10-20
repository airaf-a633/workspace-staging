"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PaperPlaneRight, X } from "@phosphor-icons/react";
import type { WidgetConfig } from "@/lib/widget/server";

/**
 * The visitor's side of website chat (decided 2026-10-19): a plain, light chat panel. The visitor's random secret
 * lives in this frame's local storage; while the panel is open it checks for replies every 4 seconds. After the
 * first message it offers an optional email so the team can answer if the visitor leaves. Copy is English only
 * for now and kept short.
 */
const SECRET_KEY = "relay.visitor";
const POLL_MS = 4000;

interface Line {
  id: string;
  mine: boolean;
  body: string;
  sent_at: string;
  author: string | null;
  pending?: boolean;
  failed?: boolean;
}

function visitorSecret() {
  try {
    const have = localStorage.getItem(SECRET_KEY);
    if (have && /^[A-Za-z0-9_-]{32,128}$/.test(have)) return have;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const fresh = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    localStorage.setItem(SECRET_KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked: a secret for this visit only.
    return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}

export function WidgetChat({ widgetKey, config }: { widgetKey: string; config: WidgetConfig }) {
  const [secret] = useState(visitorSecret);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [email, setEmail] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const api = `/api/widget/${widgetKey}/messages`;
  const headers = { "x-relay-visitor": secret, "content-type": "application/json" };

  const load = useCallback(async () => {
    const res = await fetch(api, { headers: { "x-relay-visitor": secret }, cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const { messages } = (await res.json()) as { messages: Line[] };
    // Keep messages still on their way; drop them once the server has them.
    setLines((now) => [...messages, ...now.filter((l) => (l.pending || l.failed) && !messages.some((m) => m.body === l.body && m.mine))]);
  }, [api, secret]);

  // Check for replies while the panel is open and the page is visible.
  useEffect(() => {
    if (!open) return;
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [open, load]);

  // The site's button tells the frame when it opens or closes.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.relay === "opened") setOpen(true);
      if (e.data?.relay === "closed") setOpen(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  async function send(text: string, withEmail?: string) {
    const body = text.trim();
    if (!body) return;
    const clientId = crypto.randomUUID();
    setDraft("");
    setProblem(null);
    setLines((l) => [...l, { id: clientId, mine: true, body, sent_at: new Date().toISOString(), author: null, pending: true }]);
    const res = await fetch(api, {
      method: "POST",
      headers,
      body: JSON.stringify({ clientId, body, email: withEmail ?? (emailSaved && email ? email.trim() : undefined) }),
    }).catch(() => null);
    if (res?.ok) {
      void load();
      return;
    }
    setLines((l) => l.map((x) => (x.id === clientId ? { ...x, pending: false, failed: true } : x)));
    setProblem(res?.status === 429 ? "You're sending messages very quickly. Wait a moment and try again." : "That didn't send. Check your connection and try again.");
  }

  async function saveEmail() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setProblem("That email doesn't look right.");
    setProblem(null);
    setEmailSaved(true);
    // Saved with the next message; send a short note now so the team has it even if the visitor leaves.
    await send(`My email is ${email.trim()}`, email.trim());
  }

  const hasMine = lines.some((l) => l.mine);

  return (
    <div className="force-light flex h-dvh flex-col bg-white text-[#111518]">
      <header className="flex items-start justify-between gap-3 px-4 py-4 text-white" style={{ background: config.color }}>
        <div className="grid gap-0.5">
          <p className="font-semibold">{config.business}</p>
          <p className="text-sm opacity-90">{config.greeting || "Ask us anything. We usually reply in a few minutes."}</p>
        </div>
        <button type="button" onClick={() => window.parent.postMessage({ relay: "close" }, "*")} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/15" aria-label="Close chat">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <ul className="grid gap-2">
          {lines.map((l) => (
            <li key={l.id} className={`grid max-w-[85%] gap-0.5 ${l.mine ? "justify-self-end" : "justify-self-start"}`}>
              {!l.mine && l.author && <span className="text-xs text-[#56616A]">{l.author}</span>}
              <p
                dir="auto"
                className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] ${l.mine ? "rounded-ee-sm text-white" : "rounded-ss-sm bg-[#EEF2F5]"} ${l.pending ? "opacity-70" : ""}`}
                style={l.mine ? { background: config.color } : undefined}
              >
                {l.body}
              </p>
              {l.failed && <span className="justify-self-end text-xs text-[#B42318]">Not sent</span>}
            </li>
          ))}
        </ul>
        {hasMine && !emailSaved && (
          <form
            className="mt-4 grid gap-2 rounded-2xl border border-[#E2E7EB] p-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void saveEmail();
            }}
          >
            <label htmlFor="relay-email" className="text-[#56616A]">{"Leave your email and we'll reply there if you go."}</label>
            <div className="flex gap-2">
              <input id="relay-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#CBD3D9] px-3" />
              <button type="submit" className="min-h-10 rounded-lg px-3 font-medium text-white" style={{ background: config.color }}>Save</button>
            </div>
          </form>
        )}
        <div ref={endRef} />
      </div>

      {problem && <p role="alert" className="px-4 pb-1 text-sm text-[#B42318]">{problem}</p>}
      <form
        className="flex items-end gap-2 border-t border-[#E2E7EB] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="relay-message" className="sr-only">Your message</label>
        <textarea
          id="relay-message"
          rows={1}
          dir="auto"
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Write a message…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[#CBD3D9] px-3 py-2.5 text-[15px]"
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-xl text-white disabled:opacity-50" style={{ background: config.color }}>
          <PaperPlaneRight size={20} weight="fill" aria-hidden="true" />
        </button>
      </form>
      <p className="pb-2 text-center text-[11px] text-[#56616A]">Chat by Relay</p>
    </div>
  );
}
