import type { Scope, ConversationPermission } from "@app/domain";

/** Shapes follow the M2 data model (docs/milestones/M2-plan.md) so real rows can replace the sample later. */

export interface Person {
  id: string;
  name: string;
  role: string;
  canReply: boolean;
  /** True when this person exists only in the sample chats, not in the workspace. */
  sample?: boolean;
}

export interface Team {
  id: string;
  name: string;
}

export interface ViewerInfo {
  memberId: string;
  teamIds: string[];
  scopes: Partial<Record<ConversationPermission, Scope>>;
}

export type MediaType = "photo" | "video" | "voice" | "document" | "location" | "contact" | "sticker" | "unsupported";

export interface Media {
  type: MediaType;
  name?: string;
  size?: number;
  duration?: string;
  caption?: string;
  phone?: string;
}

export interface Message {
  id: string;
  kind: "in" | "out" | "note" | "event";
  at: number;
  text?: string;
  subject?: string;
  media?: Media;
  authorId?: string;
  /** Where an outgoing message came from: the inbox, or the WhatsApp phone app (coexistence). */
  source?: "inbox" | "phone";
  status?: "sent" | "delivered" | "read" | "failed";
  error?: string;
  edited?: boolean;
  deleted?: boolean;
  imported?: boolean;
  replyTo?: { author: string; text: string };
  reaction?: string;
}

export interface Handoff {
  fromId: string | null;
  toId: string | null;
  toTeamId: string | null;
  note: string;
  at: number;
}

export interface Deal {
  id: string;
  title: string;
  fils: number;
  stage: "new" | "quoted" | "negotiating" | "won" | "lost";
  ownerId: string;
}

export interface Task {
  id: string;
  text: string;
  ownerId: string;
  due: string;
  done: boolean;
}

export interface Order {
  no: string;
  fils: number;
  state: string;
  source: "Shopify" | "WooCommerce" | "Orders pack";
}

export interface Contact {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  language: string;
  tags: string[];
  possibleDuplicate?: string;
  deals: Deal[];
  tasks: Task[];
  orders: Order[];
}

export interface Conversation {
  id: string;
  channel: "whatsapp" | "email";
  contact: Contact;
  teamId: string;
  holderId: string | null;
  /** People who have held the chat, in order. The last one is the holder. */
  trail: string[];
  collaboratorIds: string[];
  status: "open" | "resolved" | "spam";
  unread: number;
  lastCustomerAt: number | null;
  imported?: boolean;
  /** Someone replied from the phone app while a draft was waiting in the inbox. */
  phoneReply?: { authorId: string; draft: string };
  messages: Message[];
  handoffs: Handoff[];
}

export interface InboxData {
  now: number;
  people: Person[];
  teams: Team[];
  viewer: ViewerInfo;
  conversations: Conversation[];
}
