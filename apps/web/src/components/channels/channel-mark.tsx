import { channel, type ChannelKey } from "./catalog";

/**
 * The small round channel mark: on avatars, list rows and the channel strip. The brand colour lives here
 * and nowhere else, so the rest of the UI keeps one accent.
 */
export function ChannelMark({ ch, size = 18, label = true, className = "" }: { ch: ChannelKey; size?: number; label?: boolean; className?: string }) {
  const c = channel(ch);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full text-white ${className}`}
      style={{ width: size, height: size, background: c.color }}
      role={label ? "img" : undefined}
      aria-label={label ? c.name : undefined}
      aria-hidden={label ? undefined : true}
      title={label ? c.name : undefined}
    >
      <c.Icon size={Math.round(size * 0.6)} weight="fill" aria-hidden="true" />
    </span>
  );
}
