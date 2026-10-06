/**
 * The Relay mark and wordmark (2026-10-07). The mark is two arcs passing between each other: a conversation
 * handed on without dropping it. A single geometric shape, drawn once here and reused everywhere.
 * Three variants are kept so the founder can choose; "arcs" is the default until then.
 */
export type MarkVariant = "arcs" | "baton" | "loop";

export function RelayMark({ size = 28, variant = "arcs", className = "" }: { size?: number; variant?: MarkVariant; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      {variant === "arcs" && (
        <g fill="none" stroke="var(--on-primary)" strokeWidth="3" strokeLinecap="round">
          <path d="M8.5 17.5a7.5 7.5 0 0 1 12.8-5.3" />
          <path d="M23.5 14.5a7.5 7.5 0 0 1-12.8 5.3" opacity="0.7" />
        </g>
      )}
      {variant === "baton" && (
        <g fill="var(--on-primary)">
          <circle cx="11" cy="16" r="3.5" />
          <rect x="15" y="14" width="10" height="4" rx="2" opacity="0.75" />
        </g>
      )}
      {variant === "loop" && (
        <path d="M9 21V13a4 4 0 0 1 4-4h2a4 4 0 0 1 0 8h-1l7 6" fill="none" stroke="var(--on-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}
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
