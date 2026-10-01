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
  /** What a voice note says, written out by AI on request (1 credit). */
  transcript?: string;
}

/**
 * Something that happened in a chat, stored as who-did-what (ids) and worded when shown, so each
 * person reads it in their own language: "Sara handed this chat to Priya (Operations manager)".
 */
export interface ChatEvent {
  key: "claimed" | "handedToPerson" | "handedToTeam" | "resolved" | "reopened" | "spam" | "notSpam" | "askedCollab" | "imported";
  by?: string;
  to?: string;
  team?: string;
  holder?: string | null;
}

export interface Message {
  id: string;
  kind: "in" | "out" | "note" | "event";
  at: number;
  /** For kind "event". */
  event?: ChatEvent;
  text?: string;
  subject?: string;
  media?: Media;
  authorId?: string;
  /** Where an outgoing message came from: the inbox, or the WhatsApp phone app (coexistence). */
  source?: "inbox" | "phone";
  status?: "sent" | "delivered" | "read" | "failed";
  /** Why a message failed, as a key under message.errors (from WhatsApp's error code). */
  error?: "unknown";
  edited?: boolean;
  deleted?: boolean;
  imported?: boolean;
  replyTo?: { author: string; text: string };
  /** AI translation of a customer message into each app language, shown on request. */
  translation?: { en?: string; ar?: string };
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
  /** The reply AI would suggest, written in the customer's language (sample; the real one is generated on click). */
  aiSuggestion?: string;
}

export interface InboxData {
  now: number;
  people: Person[];
  teams: Team[];
  viewer: ViewerInfo;
  conversations: Conversation[];
}
