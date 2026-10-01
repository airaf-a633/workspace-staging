import type { Deal, Order, Task } from "@/components/inbox/types";
import type { Line } from "@/i18n/labels";

/** Shapes follow the planned contacts model (PRODUCT_DECISIONS §5, §18) so real rows can replace the sample later. */

export type TimelineKind = "chat" | "email" | "note" | "handoff" | "deal" | "order" | "task";

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

export interface Customer {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  language: string;
  area?: string;
  type: "Individual" | "Business" | "VIP";
  tags: string[];
  ownerId: string | null;
  teamId: string;
  source: string;
  createdAt: number;
  lastContact: { at: number; channel: "whatsapp" | "email" } | null;
  /** The inbox conversation for "Open chat". */
  conversationId?: string;
  /** Another customer that is probably the same person (merging is manual). */
  duplicateOf?: string;
  deals: Deal[];
  tasks: Task[];
  orders: Order[];
  timeline: TimelineItem[];
}
