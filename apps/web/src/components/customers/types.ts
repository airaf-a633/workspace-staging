import type { Deal, Identity, Order, Task } from "@/components/inbox/types";
import type { Line } from "@/i18n/labels";
import type { ChannelKey } from "@/components/channels/catalog";

/** Shapes follow the planned contacts model (PRODUCT_DECISIONS §5, §18, and Contacts 2026-10-07) so real rows can replace the sample later. */

export type TimelineKind = "chat" | "email" | "note" | "handoff" | "deal" | "order" | "task" | "activity";

export interface TimelineItem {
  id: string;
  at: number;
  kind: TimelineKind;
  /** Worded when shown, in the reader's language. */
  title: Line;
  /** People's own words (a message, a note), or for deal / order / task rows the stage, order state or due word. */
  body?: string;
  /** Interface text in place of `body` (a "Photo" or "Deleted message" placeholder). */
  bodyLine?: Line;
  by?: string;
  href?: string;
}

/** Where someone is in their relationship with the business. */
export type Lifecycle = "lead" | "customer" | "repeat" | "churned";
export const LIFECYCLES: Lifecycle[] = ["lead", "customer", "repeat", "churned"];

/** Marketing consent on one channel: when it was given or withdrawn, and how. Service replies never need it. */
export interface Consent {
  status: "in" | "out" | "unknown";
  at?: number;
  /** "Checkout", "Website form", "Replied STOP"… shown as written. */
  source?: string;
}

/** A field the business defines for every contact (Settings › Contacts and privacy). */
export interface CustomFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  ownerId: string | null;
  tags: string[];
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  /** The company this person belongs to (one at most, decided 2026-10-07). */
  companyId?: string;
  /** A company that shares this person's email domain, waiting for a person to confirm the link. */
  companySuggestion?: string;
  phone?: string;
  email?: string;
  language: string;
  area?: string;
  type: "Individual" | "Business" | "VIP";
  lifecycle: Lifecycle;
  tags: string[];
  ownerId: string | null;
  teamId: string;
  source: string;
  createdAt: number;
  /** Every channel this person reaches you on. */
  identities: Identity[];
  consent: Partial<Record<ChannelKey, Consent>>;
  /** Never contact for marketing on any channel, whatever the per-channel consent says. */
  doNotContact?: boolean;
  fields: Record<string, string>;
  pinned?: { text: string; byId: string; at: number };
  lastContact: { at: number; channel: ChannelKey } | null;
  /** The inbox conversation for "Open chat". */
  conversationId?: string;
  /** Another customer that is probably the same person (merging is manual). */
  duplicateOf?: string;
  deals: Deal[];
  tasks: Task[];
  orders: Order[];
  timeline: TimelineItem[];
}
