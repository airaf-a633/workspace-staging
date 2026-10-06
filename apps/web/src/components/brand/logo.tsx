/**
 * The Relay mark and wordmark (2026-10-07). The mark is two arcs passing between each other: a conversation
 * handed on without dropping it. Chosen over "baton" and "loop" on 2026-10-07; app/icon.svg is the same drawing.
 */
export function RelayMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <g fill="none" stroke="var(--on-primary)" strokeWidth="3" strokeLinecap="round">
        <path d="M8.5 17.5a7.5 7.5 0 0 1 12.8-5.3" />
        <path d="M23.5 14.5a7.5 7.5 0 0 1-12.8 5.3" opacity="0.7" />
      </g>
    </svg>
  );
}

export function RelayLogo({ size = 28, className = "", tone = "default" }: { size?: number; className?: string; tone?: "default" | "inverse" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <RelayMark size={size} />
      <span
        dir="ltr"
        className={`font-semibold lowercase tracking-[-0.04em] ${tone === "inverse" ? "text-white" : "text-text"}`}
        style={{ fontSize: Math.round(size * 0.78) }}
      >
        relay
      </span>
    </span>
  );
}
