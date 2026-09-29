import type { Deal, Order, Task } from "@/components/inbox/types";

/** Shapes follow the planned contacts model (PRODUCT_DECISIONS §5, §18) so real rows can replace the sample later. */

export type TimelineKind = "chat" | "email" | "note" | "handoff" | "deal" | "order" | "task";

export interface TimelineItem {
  id: string;
  at: number;
  kind: TimelineKind;
  title: string;
  body?: string;
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
