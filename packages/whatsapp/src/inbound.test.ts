import { describe, expect, it } from "vitest";
import { extensionFor, parseMessagesValue } from "./index";

const meta = { messaging_product: "whatsapp", metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" } };
const contacts = [{ profile: { name: "Mariam" }, wa_id: "971501234567" }];
const m = (extra: object) => ({ from: "971501234567", id: `wamid.${Math.random()}`, timestamp: "1790500000", ...extra });

describe("inbound messages", () => {
  it("reads a text message with the sender's profile name and Meta's time", () => {
    const { messages } = parseMessagesValue({ ...meta, contacts, messages: [m({ id: "wamid.T", type: "text", text: { body: "Hi" } })] });
    expect(messages[0]).toMatchObject({ wamid: "wamid.T", from: "971501234567", profileName: "Mariam", type: "text", body: "Hi" });
    expect(messages[0]!.at.toISOString()).toBe(new Date(1790500000 * 1000).toISOString());
  });

  it("reads media with caption, and marks voice notes", () => {
    const { messages } = parseMessagesValue({
      ...meta, contacts,
      messages: [
        m({ type: "image", image: { id: "MEDIA1", mime_type: "image/jpeg", sha256: "abc", caption: "The loading entrance" } }),
        m({ type: "audio", audio: { id: "MEDIA2", mime_type: "audio/ogg; codecs=opus", voice: true } }),
        m({ type: "document", document: { id: "MEDIA3", mime_type: "application/pdf", filename: "Quote.pdf" } }),
      ],
    });
    expect(messages[0]).toMatchObject({ type: "image", caption: "The loading entrance", media: { id: "MEDIA1", mime: "image/jpeg" } });
    expect(messages[1]!.media).toMatchObject({ id: "MEDIA2", voice: true });
    expect(messages[2]!.media).toMatchObject({ filename: "Quote.pdf" });
  });

  it("reads location, shared contacts, replies and reactions", () => {
    const { messages } = parseMessagesValue({
      ...meta, contacts,
      messages: [
        m({ type: "location", location: { latitude: 25.18, longitude: 55.27, name: "Bay Square" } }),
        m({ type: "contacts", contacts: [{ name: { formatted_name: "Service Desk" }, phones: [{ phone: "+97145550191" }] }] }),
        m({ type: "text", text: { body: "Yes" }, context: { id: "wamid.ORIGINAL" } }),
        m({ type: "reaction", reaction: { message_id: "wamid.ORIGINAL", emoji: "👍" } }),
      ],
    });
    expect(messages[0]).toMatchObject({ type: "location", body: "Bay Square", data: { latitude: 25.18 } });
    expect(messages[1]).toMatchObject({ type: "contacts", body: "Service Desk" });
    expect(messages[2]!.replyTo).toBe("wamid.ORIGINAL");
    expect(messages[3]!.reaction).toEqual({ to: "wamid.ORIGINAL", emoji: "👍" });
  });

  it("keeps unknown types as unsupported instead of dropping them", () => {
    const { messages } = parseMessagesValue({ ...meta, contacts, messages: [m({ type: "order", order: {} })] });
    expect(messages[0]).toMatchObject({ type: "unsupported", data: { original_type: "order" } });
  });

  it("skips malformed entries without an id or sender", () => {
    expect(parseMessagesValue({ ...meta, messages: [{ type: "text" }] }).messages).toHaveLength(0);
  });
});

describe("statuses", () => {
  it("reads delivery statuses and failure reasons", () => {
    const { statuses } = parseMessagesValue({
      ...meta,
      statuses: [
        { id: "wamid.O1", status: "delivered", timestamp: "1790500100", recipient_id: "971501234567" },
        { id: "wamid.O2", status: "failed", timestamp: "1790500100", errors: [{ code: 131026, title: "Message undeliverable", error_data: { details: "Receiver incapable" } }] },
        { id: "wamid.O3", status: "weird" },
      ],
    });
    expect(statuses).toHaveLength(2);
    expect(statuses[1]).toMatchObject({ status: "failed", error: { code: "131026", title: "Message undeliverable" } });
  });
});

describe("media file names", () => {
  it("picks an extension from the filename or the type", () => {
    expect(extensionFor("application/pdf", "Quote.PDF")).toBe("pdf");
    expect(extensionFor("audio/ogg; codecs=opus", null)).toBe("ogg");
    expect(extensionFor("application/x-unknown", null)).toBe("bin");
  });
});
