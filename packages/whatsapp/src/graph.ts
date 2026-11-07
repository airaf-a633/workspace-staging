/**
 * The few Graph API calls M2.2–2.3 need. The access token is passed in each time (it lives in Vault
 * and is fetched by the caller); nothing here logs or stores it.
 */

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
  ) {
    super(message);
  }
}

const base = (version: string) => `https://graph.facebook.com/${version}`;

async function call<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } };
  if (!res.ok) throw new GraphError(body.error?.message ?? `Graph API ${res.status}`, res.status, body.error?.code ?? null);
  return body as T;
}

/** Checks a number and token together, and returns how Meta shows the number. */
export function getPhoneNumber(version: string, phoneNumberId: string, token: string) {
  return call<{ id: string; display_phone_number: string; verified_name?: string; quality_rating?: string }>(
    `${base(version)}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    token,
  );
}

/** Subscribes our app to the WhatsApp Business Account so its webhooks reach us. */
export function subscribeApp(version: string, wabaId: string, token: string) {
  return call<{ success: boolean }>(`${base(version)}/${wabaId}/subscribed_apps`, token, { method: "POST" });
}

/** Media lookup (the URL is short-lived), then the bytes. */
export async function downloadMedia(version: string, mediaId: string, token: string) {
  const info = await call<{ url: string; mime_type: string; sha256?: string; file_size?: number }>(`${base(version)}/${mediaId}`, token);
  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new GraphError(`Media download ${res.status}`, res.status, null);
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: info.mime_type, sha256: info.sha256 ?? null, size: info.file_size ?? null };
}

/** A file extension for a stored media file. */
export function extensionFor(mime: string | null, filename: string | null) {
  const fromName = filename?.match(/\.([a-z0-9]{1,8})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr", "application/pdf": "pdf",
  };
  return map[(mime ?? "").split(";")[0]!.trim()] ?? "bin";
}
