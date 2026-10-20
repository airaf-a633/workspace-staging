import {
  AddressBook,
  ArrowBendDownRight,
  DeviceMobile,
  FileText,
  Image as ImageIcon,
  MapPin,
  Microphone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneX,
  Play,
  Question,
  Smiley,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useFormat, useT } from "@/i18n/client";
import { Transcribe, TranslateMessage } from "@/components/ai/chat-ai";
import { roleLabel } from "@/i18n/labels";
import type { Translator } from "@/i18n/types";
import type { ChatEvent, Media, MediaType, Message, Person, Team } from "./types";

const MEDIA: Record<MediaType, Icon> = {
  photo: ImageIcon,
  video: VideoCamera,
  voice: Microphone,
  document: FileText,
  location: MapPin,
  contact: AddressBook,
  sticker: Smiley,
  unsupported: Question,
};

export function mediaLabel(m: Media, t: Translator) {
  return t(`message.media.${m.type}`);
}

/** "Sara handed this chat to Priya (Operations manager)", in the reader's language. */
export function eventText(e: ChatEvent, people: Person[], teams: Team[], t: Translator) {
  const person = (id?: string | null) => people.find((p) => p.id === id);
  const name = (id?: string | null) => person(id)?.name ?? t("common.someone");
  const who = (id?: string) => {
    const p = person(id);
    return p ? `${p.name} (${roleLabel(t, p.role)})` : t("common.someone");
  };
  return t(`events.${e.key}`, {
    name: name(e.by),
    to: who(e.to),
    team: teams.find((x) => x.id === e.team)?.name ?? t("events.aTeam"),
    holder: name(e.holder),
  });
}

function MediaCard({ media }: { media: Media }) {
  const tAll = useT();
  const fmt = useFormat();
  const Icon = MEDIA[media.type];
  const label = mediaLabel(media, tAll);
  const detail = [media.name, media.duration, media.phone, media.size ? fmt.fileSize(media.size) : null].filter(Boolean).join(" · ");
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-bg/70 px-3 py-2">
        <Icon size={22} className="shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {detail && <p className="truncate text-xs text-muted" dir="auto">{detail}</p>}
        </div>
      </div>
      {media.url && media.type === "photo" && (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage links; next/image can't cache them
        <a href={media.url} target="_blank" rel="noreferrer"><img src={media.url} alt={media.caption ?? label} className="max-h-72 rounded-[var(--radius-control)] object-cover" /></a>
      )}
      {media.url && media.type === "voice" && <audio controls src={media.url} className="w-full max-w-xs" />}
      {media.url && media.type === "video" && <video controls src={media.url} className="max-h-72 rounded-[var(--radius-control)]" />}
      {media.url && (media.type === "document" || media.type === "sticker") && (
        <a href={media.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{tAll("message.open")}</a>
      )}
      {media.failed && <p className="text-sm text-fail">{tAll("message.mediaFailed")}</p>}
      {media.caption && <p dir="auto">{media.caption}</p>}
      <Transcribe transcript={media.transcript} />
    </div>
  );
}

/** A phone call in the thread: who called, how long, the recording, and a voicemail written out. */
function CallCard({ m }: { m: Message }) {
  const o = useT("omni");
  const { time } = useFormat();
  const call = m.call!;
  const Icon = call.missed ? PhoneX : call.direction === "in" ? PhoneIncoming : PhoneOutgoing;
  const title = call.missed ? o("message.call.missed") : o(`message.call.${call.direction}`);
  return (
    <div className={`grid w-full max-w-md gap-2 rounded-[var(--radius-panel)] border bg-surface px-4 py-3 ${call.direction === "out" ? "justify-self-end" : "justify-self-start"} ${call.missed ? "border-fail/40" : "border-border"}`}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon size={18} className={call.missed ? "text-fail" : "text-muted"} aria-hidden="true" />
        {title}
        {call.duration && <span className="font-normal tabular-nums text-muted">· {call.duration}</span>}
        <span className="ms-auto text-xs font-normal tabular-nums text-muted">{time(m.at)}</span>
      </p>
      {call.recording && (
        <button type="button" className="flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 text-sm text-muted hover:text-text">
          <Play size={14} weight="fill" aria-hidden="true" /> {o("message.call.recording", { time: call.recording })}
        </button>
      )}
      {call.voicemail && (
        <div className="grid gap-1 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm">
          <span className="text-xs font-medium text-muted">{o("message.call.voicemail")}</span>
          <span dir="auto">{call.voicemail}</span>
        </div>
      )}
    </div>
  );
}

/**
 * One item in a thread. `first` and `last` place it inside a run of messages from the same sender
 * (grouped within 5 minutes): the author's name shows on the first, the time and ticks on the last.
 */
export function MessageItem({ m, people, teams, customer, first = true, last = true }: { m: Message; people: Person[]; teams: Team[]; customer: string; first?: boolean; last?: boolean }) {
  const author = people.find((p) => p.id === m.authorId);
  const t = useT("message");
  const o = useT("omni");
  const tAll = useT();
  const { time } = useFormat();

  if (m.call) return <CallCard m={m} />;

  if (m.kind === "event") {
    return (
      <p className="justify-self-center rounded-full bg-surface-2 px-3 py-1 text-center text-xs text-muted">
        {m.event ? eventText(m.event, people, teams, tAll) : m.text} · <span className="tabular-nums">{time(m.at)}</span>
      </p>
    );
  }

  if (m.kind === "note") {
    return (
      <div className="grid max-w-[85%] gap-1 justify-self-end rounded-[var(--radius-panel)] border border-dashed border-note-border bg-note-soft px-3.5 py-2.5">
        {first && <p className="text-xs font-medium text-muted">{t("noteHeader", { name: author?.name ?? tAll("common.someone") })}</p>}
        <p className="whitespace-pre-line" dir="auto">{m.text}</p>
        {last && <p className="text-end text-xs tabular-nums text-muted">{time(m.at)}</p>}
      </div>
    );
  }

  const out = m.kind === "out";
  const phone = out && m.source === "phone";
  const failed = m.status === "failed";
  const box = out ? "justify-self-end bg-primary-soft" : "justify-self-start bg-surface shadow-[var(--shadow-1)]";
  const ring = failed ? "ring-1 ring-fail" : phone ? "ring-1 ring-primary" : "";
  const flags = [
    phone ? t("flags.phone") : null,
    m.template ? o("message.template", { name: m.template }) : null,
    m.imported ? t("flags.imported") : null,
    m.edited ? t("flags.edited") : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className={`relative grid gap-1 rounded-[var(--radius-panel)] px-3.5 py-2.5 ${m.email ? "max-w-[92%]" : "max-w-[80%]"} ${box} ${ring}`}>
      {out && first && (
        <p className="flex items-center gap-1 text-xs font-medium text-primary">
          {phone && <DeviceMobile size={14} aria-hidden="true" />}
          {author?.name ?? tAll("common.team")}
          <span className="font-normal text-muted">{author?.role ? `· ${roleLabel(tAll, author.role)}` : ""}</span>
        </p>
      )}
      {m.replyTo && (
        <div className="rounded-[8px] border-s-2 border-primary bg-bg/60 px-2.5 py-1.5 text-sm">
          <p className="text-xs font-medium text-muted">{m.replyTo.author}</p>
          <p className="line-clamp-2 text-muted" dir="auto">{m.replyTo.text}</p>
        </div>
      )}
      {m.deleted ? (
        <p className="italic text-muted">{t("deleted", { name: customer })}</p>
      ) : (
        <>
          {m.email && first && (m.email.to || m.email.cc?.length) && (
            <p className="flex flex-wrap gap-x-3 text-xs text-muted" dir="ltr">
              {m.email.to && <span>{o("message.to", { to: m.email.to })}</span>}
              {!!m.email.cc?.length && <span>{o("message.cc", { cc: m.email.cc.join(", ") })}</span>}
            </p>
          )}
          {m.story && (
            <p className="flex items-center gap-2 rounded-[8px] bg-bg/70 px-2.5 py-1.5 text-xs text-muted">
              <ImageIcon size={14} aria-hidden="true" />
              <span>{o(`message.story.${m.story.kind}`)}</span>
              <span className="truncate" dir="auto">“{m.story.caption}”</span>
            </p>
          )}
          {m.subject && <p className="font-semibold" dir="auto">{m.subject}</p>}
          {m.media && <MediaCard media={m.media} />}
          {m.text && <p className="whitespace-pre-line" dir="auto">{m.text}</p>}
          {m.email?.quoted && (
            <details className="text-sm">
              <summary className="w-fit cursor-pointer list-none text-xs font-medium text-muted hover:text-text [&::-webkit-details-marker]:hidden">{o("message.showQuoted")}</summary>
              <blockquote className="mt-1.5 whitespace-pre-line border-s-2 border-border ps-3 text-muted" dir="auto">{m.email.quoted}</blockquote>
            </details>
          )}
          {m.thread && (
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
              <ArrowBendDownRight size={14} className="shrink-0 rtl:-scale-x-100" aria-hidden="true" />
              <span className="shrink-0 font-medium text-primary">{o("message.thread", { count: m.thread.replies })}</span>
              <span className="truncate" dir="auto">{o("message.threadLast", { name: m.thread.lastName, text: m.thread.lastText })}</span>
            </p>
          )}
          {m.kind === "in" && <TranslateMessage translation={m.translation} />}
        </>
      )}
      {(last || flags) && (
        <p className="flex flex-wrap items-center justify-end gap-x-1.5 text-xs text-muted">
          {flags && <span>{flags}</span>}
          {last && <span className="tabular-nums">{time(m.at)}</span>}
          {last && out && m.status && !failed && <span>· {t(`status.${m.status}`)}</span>}
        </p>
      )}
      {failed && (
        <p className="flex gap-1.5 text-sm text-fail" role="note">
          <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {m.error ? t(`errors.${m.error}`) : m.errorText ?? t("notDelivered")}
        </p>
      )}
      {m.reaction && (
        <span className="absolute -bottom-3 end-3 rounded-full border border-border bg-surface px-1.5 text-sm" aria-label={t("reacted", { name: customer, reaction: m.reaction })}>
          {m.reaction}
        </span>
      )}
    </div>
  );
}
