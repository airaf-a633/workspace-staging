import {
  AddressBook,
  DeviceMobile,
  FileText,
  Image as ImageIcon,
  MapPin,
  Microphone,
  Question,
  Smiley,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { fileSize, time } from "./format";
import type { Media, MediaType, Message, Person } from "./types";

const MEDIA: Record<MediaType, { label: string; Icon: Icon }> = {
  photo: { label: "Photo", Icon: ImageIcon },
  video: { label: "Video", Icon: VideoCamera },
  voice: { label: "Voice note", Icon: Microphone },
  document: { label: "Document", Icon: FileText },
  location: { label: "Location", Icon: MapPin },
  contact: { label: "Contact card", Icon: AddressBook },
  sticker: { label: "Sticker", Icon: Smiley },
  unsupported: { label: "This message type isn't supported yet", Icon: Question },
};

export function mediaLabel(m: Media) {
  return MEDIA[m.type].label;
}

function MediaCard({ media }: { media: Media }) {
  const { label, Icon } = MEDIA[media.type];
  const detail = [media.name, media.duration, media.phone, media.size ? fileSize(media.size) : null].filter(Boolean).join(" · ");
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-bg/70 px-3 py-2">
        <Icon size={22} className="shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {detail && <p className="truncate text-xs text-muted" dir="auto">{detail}</p>}
        </div>
      </div>
      {media.caption && <p dir="auto">{media.caption}</p>}
    </div>
  );
}

const STATUS = { sent: "Sent", delivered: "Delivered", read: "Read", failed: "Not delivered" } as const;

/**
 * One item in a thread. `first` and `last` place it inside a run of messages from the same sender
 * (grouped within 5 minutes): the author's name shows on the first, the time and ticks on the last.
 */
export function MessageItem({ m, people, customer, first = true, last = true }: { m: Message; people: Person[]; customer: string; first?: boolean; last?: boolean }) {
  const author = people.find((p) => p.id === m.authorId);

  if (m.kind === "event") {
    return (
      <p className="justify-self-center rounded-full bg-surface-2 px-3 py-1 text-center text-xs text-muted">
        {m.text} · <span className="tabular-nums">{time(m.at)}</span>
      </p>
    );
  }

  if (m.kind === "note") {
    return (
      <div className="grid max-w-[85%] gap-1 justify-self-end rounded-[var(--radius-panel)] border border-dashed border-note-border bg-note-soft px-3.5 py-2.5">
        {first && <p className="text-xs font-medium text-muted">Internal note · {author?.name ?? "Someone"} · only your team sees this</p>}
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
  const flags = [phone ? "sent from phone" : null, m.imported ? "imported" : null, m.edited ? "edited" : null].filter(Boolean).join(" · ");

  return (
    <div className={`relative grid max-w-[80%] gap-1 rounded-[var(--radius-panel)] px-3.5 py-2.5 ${box} ${ring}`}>
      {out && first && (
        <p className="flex items-center gap-1 text-xs font-medium text-primary">
          {phone && <DeviceMobile size={14} aria-hidden="true" />}
          {author?.name ?? "Team"}
          <span className="font-normal text-muted">{author?.role ? `· ${author.role}` : ""}</span>
        </p>
      )}
      {m.replyTo && (
        <div className="rounded-[8px] border-s-2 border-primary bg-bg/60 px-2.5 py-1.5 text-sm">
          <p className="text-xs font-medium text-muted">{m.replyTo.author}</p>
          <p className="line-clamp-2 text-muted" dir="auto">{m.replyTo.text}</p>
        </div>
      )}
      {m.deleted ? (
        <p className="italic text-muted">{customer} deleted this message</p>
      ) : (
        <>
          {m.subject && <p className="font-semibold" dir="auto">{m.subject}</p>}
          {m.media && <MediaCard media={m.media} />}
          {m.text && <p className="whitespace-pre-line" dir="auto">{m.text}</p>}
        </>
      )}
      {(last || flags) && (
        <p className="flex flex-wrap items-center justify-end gap-x-1.5 text-xs text-muted">
          {flags && <span>{flags}</span>}
          {last && <span className="tabular-nums">{time(m.at)}</span>}
          {last && out && m.status && !failed && <span>· {STATUS[m.status]}</span>}
        </p>
      )}
      {failed && (
        <p className="flex gap-1.5 text-sm text-fail" role="note">
          <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {m.error ?? "Not delivered."}
        </p>
      )}
      {m.reaction && (
        <span className="absolute -bottom-3 end-3 rounded-full border border-border bg-surface px-1.5 text-sm" aria-label={`${customer} reacted ${m.reaction}`}>
          {m.reaction}
        </span>
      )}
    </div>
  );
}
