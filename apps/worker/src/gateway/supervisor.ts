import type { SupabaseClient } from "@supabase/supabase-js";
import { GatewayConnection, type GatewayState, type SocketFactory } from "./connection";

/**
 * Keeps one Gateway connection online for every connected Discord bot (decided 2026-11-02). Every thirty seconds it
 * asks the database which bots should be online, starts the new ones, stops the removed ones and restarts any whose
 * token was replaced. Relevant messages are queued exactly like a webhook, so the normal worker files them.
 *
 * Run exactly one of these. A second copy would not duplicate messages (each has its own id) but would double the
 * identifies, which Discord limits to 1,000 a day per bot.
 */

/** GUILD_MESSAGES (1 << 9) and DIRECT_MESSAGES (1 << 12). Not the privileged MESSAGE_CONTENT: bots still get direct
    messages and messages that mention them, which is all Relay files. */
export const INTENTS = (1 << 9) | (1 << 12);
const API = "https://discord.com/api/v10";
const SYNC_MS = 30_000;

export interface SupervisorDeps {
  db: SupabaseClient;
  fetch: typeof fetch;
  socket: SocketFactory;
  log: (message: string) => void;
  appUrl?: string | undefined;
  now?: () => number;
}

interface Bot {
  token: string;
  connection?: GatewayConnection | undefined;
  botUserId?: string;
  /** Don't try again before this time (a bad token, or Discord unreachable). */
  retryAt: number;
  health?: string;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export class Supervisor {
  private readonly bots = new Map<string, Bot>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly now: () => number;

  constructor(private readonly d: SupervisorDeps) {
    this.now = d.now ?? Date.now;
  }

  start() {
    void this.sync();
    this.timer = setInterval(() => void this.sync(), SYNC_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    for (const bot of this.bots.values()) bot.connection?.stop();
    this.bots.clear();
  }

  /** One pass: make the running connections match the connected bots. */
  async sync(): Promise<void> {
    const { data, error } = await this.d.db.rpc("discord_gateway_channels");
    if (error) {
      this.d.log(`gateway: could not list bots: ${error.message}`);
      return;
    }
    const wanted = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
    for (const [id, bot] of this.bots) {
      if (!wanted.has(id)) {
        bot.connection?.stop();
        this.bots.delete(id);
        this.d.log(`gateway: ${id} stopped (disconnected)`);
      }
    }
    for (const id of wanted) {
      try {
        await this.ensure(id);
      } catch (e) {
        this.d.log(`gateway: ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private async ensure(id: string) {
    const { data: secrets } = await this.d.db.rpc("channel_secrets", { p_channel: id });
    const token = (secrets as { bot_token?: string } | null)?.bot_token;
    if (!token) return;
    const known = this.bots.get(id);
    if (known && known.token !== token) {
      known.connection?.stop();
      this.bots.delete(id);
    }
    const bot = this.bots.get(id) ?? { token, retryAt: 0 };
    this.bots.set(id, bot);
    if (bot.connection || bot.retryAt > this.now()) return;

    // GET /gateway/bot needs a valid bot token, so it also checks the token and gives the address to connect to.
    let res: Response;
    try {
      res = await this.d.fetch(`${API}/gateway/bot`, {
        headers: { authorization: `Bot ${token}`, "user-agent": `DiscordBot (${this.d.appUrl ?? "https://relay.invalid"}, 1)` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      bot.retryAt = this.now() + 60_000;
      await this.report(id, bot, "unstable", "Relay couldn't reach Discord. It keeps trying.");
      return;
    }
    if (res.status === 401) {
      bot.retryAt = this.now() + 10 * 60_000;
      await this.report(id, bot, "rejected", "Discord doesn't accept this bot's token.");
      return;
    }
    const url = res.ok ? (obj(await res.json().catch(() => ({}))).url as string | undefined) : undefined;
    if (!url) {
      bot.retryAt = this.now() + 60_000;
      await this.report(id, bot, "unstable", `Discord wouldn't give Relay a connection address (${res.status}). It keeps trying.`);
      return;
    }

    bot.connection = new GatewayConnection({
      token,
      url,
      intents: INTENTS,
      socket: this.d.socket,
      onDispatch: (event, payload) => void this.dispatch(id, bot, event, payload),
      onState: (state) => void this.state(id, bot, state),
    });
    bot.connection.start();
    this.d.log(`gateway: ${id} starting`);
  }

  private async state(id: string, bot: Bot, state: GatewayState) {
    if (state.kind === "ready") {
      bot.botUserId = state.botUserId;
      await this.report(id, bot, "ok", "Connected to Discord.", { bot_user_id: state.botUserId, ...(state.applicationId ? { application_id: state.applicationId } : {}) });
    } else if (state.kind === "reconnecting" && state.failures >= 3) {
      await this.report(id, bot, "unstable", `Discord keeps closing the connection${state.code ? ` (code ${state.code})` : ""}. Relay keeps trying.`);
    } else if (state.kind === "stopped") {
      bot.connection = undefined;
      bot.retryAt = Number.POSITIVE_INFINITY; // until the token is replaced
      await this.report(id, bot, state.reason, state.reason === "intents" ? "Discord says the bot's intents are invalid." : "Discord says the bot asked for a permission that isn't switched on for it in the Developer Portal.");
    }
  }

  /** Writes health only when it changes, so a flapping connection doesn't flood the database. */
  private async report(id: string, bot: Bot, state: string, detail: string, settings: Record<string, string> = {}) {
    if (bot.health === state && Object.keys(settings).length === 0) return;
    bot.health = state;
    const { error } = await this.d.db.rpc("update_channel_runtime", { p_channel: id, p_state: state, p_detail: detail, p_settings: settings });
    if (error) this.d.log(`gateway: could not record health for ${id}: ${error.message}`);
  }

  private async dispatch(id: string, bot: Bot, event: string, data: unknown) {
    if (event !== "MESSAGE_CREATE") return;
    const d = obj(data);
    const author = obj(d.author);
    // The same rules the filing step applies, so nothing else is queued: no bots, and in a server only a mention of this bot.
    if (author.bot === true || d.webhook_id || !bot.botUserId || author.id === bot.botUserId) return;
    if (typeof d.guild_id === "string" && !(Array.isArray(d.mentions) ? d.mentions : []).some((m) => obj(m).id === bot.botUserId)) return;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await this.d.db.rpc("record_webhook", {
        p_provider: "channel",
        p_payload: { channel_id: id, type: "discord", body: { event, bot_user_id: bot.botUserId, d: data } },
        p_signature_valid: true,
      });
      if (!error) return;
      this.d.log(`gateway: could not queue a message for ${id} (try ${attempt}): ${error.message}`);
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}
