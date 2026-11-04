import { channel, type ChannelKey } from "./catalog";

/**
 * The small round channel mark: on avatars, list rows and the channel strip. The brand colour lives here
 * and nowhere else, so the rest of the UI keeps one accent.
 */
/** `quiet` is for channels that do not work yet: one neutral tone for all of them, so colour only ever means "this works". */
export function ChannelMark({ ch, size = 18, label = true, className = "", quiet = false }: { ch: ChannelKey; size?: number; label?: boolean | string; className?: string; quiet?: boolean }) {
  const c = channel(ch);
  // A string is the channel's name in the reader's language; true falls back to the brand name.
  const name = typeof label === "string" ? label : c.name;
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full ${quiet ? "text-muted" : "text-white"} ${className}`}
      // Near-black brand marks (X, TikTok, Apple) get a hairline so they still read on dark surfaces.
      style={{ width: size, height: size, background: quiet ? "var(--surface-2)" : c.color, boxShadow: quiet || c.color === "#111518" ? "0 0 0 1px var(--border)" : undefined }}
      role={label ? "img" : undefined}
      aria-label={label ? name : undefined}
      aria-hidden={label ? undefined : true}
      title={label ? name : undefined}
    >
      <c.Icon size={Math.round(size * 0.6)} weight="fill" aria-hidden="true" />
    </span>
  );
}
