import type { Scope, ConversationPermission } from "@app/domain";
import type { ChannelKey } from "@/components/channels/catalog";

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
  /** Conversation permissions, plus numbers.manage for reconnecting a broken channel. */
  scopes: Partial<Record<ConversationPermission | "numbers.manage", Scope>>;
}

export type MediaType = "photo" | "video" | "voice" | "document" | "location" | "contact" | "sticker" | "unsupported";

export interface Media {
  type: MediaType;
  name?: string;
  size?: number;
  duration?: string;
  caption?: string;
  phone?: string;
  /** A short-lived signed link to the stored file (real inbox only). */
  url?: string;
  /** The file couldn't be downloaded from WhatsApp. */
  failed?: boolean;
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
  /** WhatsApp's own failure reason, when a real message failed. */
  errorText?: string;
  edited?: boolean;
  deleted?: boolean;
  imported?: boolean;
  replyTo?: { author: string; text: string };
  /** Email: who else it went to, and the earlier mail it quotes (folded away until asked for). */
  email?: { to?: string; cc?: string[]; quoted?: string };
  /** Instagram and Messenger: the customer answered or mentioned one of your stories. */
  story?: { kind: "reply" | "mention"; caption: string };
  /** Voice: a phone call rather than a message. */
  call?: { direction: "in" | "out"; missed?: boolean; duration?: string; recording?: string; voicemail?: string };
  /** Slack and Discord: replies inside this message's thread. */
  thread?: { replies: number; lastName: string; lastText: string };
  /** WhatsApp: sent as an approved template (outside the 24-hour window). */
  template?: string;
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

/** One way to reach a contact: the channel, and their handle there (number, address, @name). */
export interface Identity {
  ch: ChannelKey;
  handle: string;
}

/** Relay thinks another contact is the same person; a person confirms before anything merges (decided 2026-10-07). */
export interface MergeSuggestion {
  name: string;
  ch: ChannelKey;
  handle: string;
  reason: "sameEmail" | "samePhone" | "sameName";
}

/** An earlier conversation with the same contact, shown in the side panel. */
export interface PastConversation {
  id: string;
  ch: ChannelKey;
  at: number;
  summary: string;
  /** Opens in this inbox when it's one of the loaded conversations. */
  conversationId?: string;
}

export interface Contact {
  /** Shared by every conversation with this person, across channels. */
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  /** City and country, as the customer gave it or the channel reported it. */
  location?: string;
  language: string;
  tags: string[];
  identities: Identity[];
  merge?: MergeSuggestion;
  past?: PastConversation[];
  deals: Deal[];
  tasks: Task[];
  orders: Order[];
}

export interface Conversation {
  id: string;
  channel: ChannelKey;
  /** The connected inbox it arrived in (one WhatsApp number, one email address, one Instagram account…). */
  inboxId: string;
  contact: Contact;
  labels?: string[];
  /** Email: the thread's subject. Slack and Discord: the channel it was posted in. */
  subject?: string;
  /** Website chat: where the visitor is and whether they're still on the site. */
  visitor?: { page: string; browser: string; online: boolean };
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
  /** AI flagged this chat as sensitive: it never answers it and alerts the owner and manager (decided 2026-10-01). */
  sensitive?: "payment" | "legal" | "health" | "abuse";
}

/** A connected channel account: Chatwoot calls these inboxes, and so does the sidebar. */
export interface ChannelInbox {
  id: string;
  channel: ChannelKey;
  /** The name the business gave it. */
  name: string;
  /** The number, address, page or handle customers write to. */
  address: string;
  /** Why it can't send right now. Shown in the inbox, on the owner's home and in the reply box. */
  broken?: "tokenExpired" | "domainBounced" | "numberFlagged";
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface InboxData {
  now: number;
  people: Person[];
  teams: Team[];
  inboxes: ChannelInbox[];
  labels: Label[];
  viewer: ViewerInfo;
  conversations: Conversation[];
  /** Real data from the database (not the sample chats). */
  live?: boolean;
}
