import {
  AppleLogo,
  ChatCircleText,
  ChatsCircle,
  ChatText,
  DiscordLogo,
  EnvelopeSimple,
  InstagramLogo,
  MessengerLogo,
  MicrosoftTeamsLogo,
  PhoneCall,
  SlackLogo,
  TelegramLogo,
  TiktokLogo,
  WebhooksLogo,
  WechatLogo,
  WhatsappLogo,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * Every channel Relay supports (decided 2026-10-07: omnichannel, global). One entry per channel: its icon,
 * its brand colour (only ever used for the small channel mark, never for UI chrome), the group it belongs
 * to on the Channels page, and whether it needs a platform's review before going live.
 * LINE and Viber have no icon in our library, so they use a neutral chat glyph in their brand colour.
 */
export type ChannelKey =
  | "whatsapp" | "webchat" | "email" | "instagram" | "messenger"
  | "telegram" | "sms" | "voice" | "tiktok" | "x" | "line" | "viber" | "wechat"
  | "discord" | "slack" | "teams" | "apple" | "api";

export type ChannelGroup = "messaging" | "social" | "web" | "work" | "developer";

export interface Channel {
  key: ChannelKey;
  /** Brand names stay in English in every language. */
  name: string;
  Icon: Icon;
  color: string;
  group: ChannelGroup;
  /** The platform reviews the business or our app before messages flow. */
  review?: "meta" | "apple" | "tiktok";
}

export const CHANNELS: Channel[] = [
  { key: "whatsapp", name: "WhatsApp", Icon: WhatsappLogo, color: "#1FA855", group: "messaging", review: "meta" },
  { key: "webchat", name: "Website chat", Icon: ChatsCircle, color: "#0A5670", group: "web" },
  { key: "email", name: "Email", Icon: EnvelopeSimple, color: "#56616A", group: "web" },
  { key: "instagram", name: "Instagram", Icon: InstagramLogo, color: "#D62976", group: "social", review: "meta" },
  { key: "messenger", name: "Messenger", Icon: MessengerLogo, color: "#0A7CFF", group: "social", review: "meta" },
  { key: "telegram", name: "Telegram", Icon: TelegramLogo, color: "#229ED9", group: "messaging" },
  { key: "sms", name: "SMS", Icon: ChatText, color: "#3F6E8C", group: "messaging" },
  { key: "voice", name: "Voice", Icon: PhoneCall, color: "#0F7B6C", group: "messaging" },
  { key: "tiktok", name: "TikTok", Icon: TiktokLogo, color: "#111518", group: "social", review: "tiktok" },
  { key: "x", name: "X", Icon: XLogo, color: "#111518", group: "social" },
  { key: "line", name: "LINE", Icon: ChatCircleText, color: "#06C755", group: "messaging" },
  { key: "viber", name: "Viber", Icon: ChatCircleText, color: "#7360F2", group: "messaging" },
  { key: "wechat", name: "WeChat", Icon: WechatLogo, color: "#07C160", group: "messaging" },
  { key: "discord", name: "Discord", Icon: DiscordLogo, color: "#5865F2", group: "work" },
  { key: "slack", name: "Slack", Icon: SlackLogo, color: "#4A154B", group: "work" },
  { key: "teams", name: "Microsoft Teams", Icon: MicrosoftTeamsLogo, color: "#5059C9", group: "work" },
  { key: "apple", name: "Apple Messages", Icon: AppleLogo, color: "#111518", group: "messaging", review: "apple" },
  { key: "api", name: "API", Icon: WebhooksLogo, color: "#56616A", group: "developer" },
];

export const channel = (key: ChannelKey) => CHANNELS.find((c) => c.key === key)!;
