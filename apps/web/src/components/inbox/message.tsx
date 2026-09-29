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
import { fileSize, messageTime } from "./format";
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
    <div className="grid gap-1">
      <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2">
        <Icon size={24} className="shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {detail && <p className="truncate text-sm text-muted" dir="auto">{detail}</p>}
        </div>
      </div>
      {media.caption && <p dir="auto">{media.caption}</p>}
    </div>
  );
}

const STATUS = { sent: "Sent", delivered: "Delivered", read: "Read", failed: "Not delivered" } as const;

export function MessageItem({ m, people, now, customer }: { m: Message; people: Person[]; now: number; customer: string }) {
  const author = people.find((p) => p.id === m.authorId);
  const when = messageTime(m.at, now);

  if (m.kind === "event") {
    return (
      <p className="justify-self-center px-4 text-center text-sm text-muted">
        {m.text} · <span className="num">{when}</span>
      </p>
    );
  }

  if (m.kind === "note") {
    return (
      <div className="grid max-w-[85%] gap-1 justify-self-end rounded-[var(--radius-panel)] border border-dashed border-note-border bg-note-soft px-3 py-2">
        <p className="text-sm font-medium">Internal note · only your team sees this</p>
        <p className="whitespace-pre-line" dir="auto">{m.text}</p>
        <p className="text-sm text-muted">
          {author?.name ?? "Someone"} · <span className="num">{when}</span>
        </p>
      </div>
    );
  }

  const out = m.kind === "out";
  const phone = out && m.source === "phone";
  const failed = m.status === "failed";
  const box = out
    ? `justify-self-end bg-primary-soft ${phone ? "border border-primary" : "border border-transparent"}`
    : "justify-self-start border border-border bg-surface";

  const meta = [
    out ? `${author?.name ?? "Team"}, ${author?.role ?? ""}`.replace(/, $/, "") : null,
    phone ? "sent from phone" : null,
    m.imported ? "imported" : null,
    m.edited ? "edited" : null,
  ].filter(Boolean);

  return (
    <div className={`relative grid max-w-[85%] gap-1.5 rounded-[var(--radius-panel)] px-3 py-2 ${box} ${failed ? "!border-fail" : ""}`}>
      {m.replyTo && (
        <div className="border-s-2 border-primary ps-2 text-sm text-muted">
          <p className="font-medium">{m.replyTo.author}</p>
          <p className="line-clamp-2" dir="auto">{m.replyTo.text}</p>
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
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
        {phone && <DeviceMobile size={16} aria-hidden="true" />}
        {meta.length > 0 && <span>{meta.join(" · ")}</span>}
        {meta.length > 0 && <span aria-hidden="true">·</span>}
        <span className="num">{when}</span>
        {out && m.status && !failed && <span>· {STATUS[m.status]}</span>}
      </p>
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
