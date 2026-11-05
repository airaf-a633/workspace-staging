import { deflateSync } from "node:zlib";

/**
 * The Teams app file Relay generates for a company (decided 2026-11-02): a zip with manifest.json and two icons,
 * pre-filled with the company's bot, so their admin only has to upload it. Field names, limits and icon sizes are from
 * Microsoft's app manifest reference, read on 2 November 2026: required manifestVersion, version, id, developer
 * (name up to 32 characters, websiteUrl, privacyUrl, termsOfUseUrl), name (short up to 30, full up to 100),
 * description (short up to 80, full up to 4000), icons (color 192x192, outline 32x32 transparent), accentColor.
 * A bot entry needs botId and scopes. Everything else is left out.
 *
 * Not confirmed by the pages I read: that "1.30" is a valid manifestVersion (it is the version Microsoft's schema
 * pages show by default) and that the file must be called manifest.json (the usual name). If Teams refuses the
 * package, those two are the first things to check; they are single constants below.
 */
export const MANIFEST_VERSION = "1.30";
export const MANIFEST_FILE = "manifest.json";
const ACCENT = "#0A5670";

const fit = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

export interface PackageInput {
  /** The Teams app's own id: a GUID. Stable, so uploading a new copy updates the same app. */
  appId: string;
  botId: string;
  /** What the app is called in Teams, e.g. "Help desk". */
  name: string;
  company: string;
  origin: string;
}

export function teamsManifest(i: PackageInput): Record<string, unknown> {
  const origin = i.origin.replace(/\/$/, "");
  return {
    manifestVersion: MANIFEST_VERSION,
    version: "1.0.0",
    id: i.appId,
    developer: { name: fit(i.company || "Relay", 32), websiteUrl: `${origin}/`, privacyUrl: `${origin}/privacy`, termsOfUseUrl: `${origin}/terms` },
    name: { short: fit(i.name, 30), full: fit(i.name, 100) },
    description: { short: fit(`Ask ${i.company || "your team"} for help, right here in Teams.`, 80), full: `Message the ${fit(i.name, 60)} bot to ask ${i.company || "your team"} for help. Your messages go to the people who answer, and their replies arrive in this chat.` },
    icons: { outline: "outline.png", color: "color.png" },
    accentColor: ACCENT,
    bots: [{ botId: i.botId, scopes: ["personal"], supportsFiles: true, isNotificationOnly: false }],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// PNG icons, drawn in code so there are no image files to ship

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An RGBA PNG of `size` x `size` pixels, each pixel chosen by `pixel(x, y)`. */
export function png(size: number, pixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), row + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())]);
}

const ACCENT_RGB: [number, number, number] = [0x0a, 0x56, 0x70];

/** 192x192: the accent colour with a white ring in the middle. */
export function colorIcon(): Buffer {
  const size = 192;
  return png(size, (x, y) => {
    const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5);
    return d >= 44 && d <= 64 ? [255, 255, 255, 255] : [...ACCENT_RGB, 255];
  });
}

/** 32x32: transparent, with a white ring. */
export function outlineIcon(): Buffer {
  const size = 32;
  return png(size, (x, y) => {
    const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5);
    return d >= 8 && d <= 11 ? [255, 255, 255, 255] : [0, 0, 0, 0];
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// A minimal zip writer (files stored without compression: the files are tiny)

export function zip(files: { name: string; data: Uint8Array }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // names are UTF-8
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x21, 12); // date: 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(f.data.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, Buffer.from(f.data));
    centrals.push(central, name);
    offset += 30 + name.length + f.data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/** The whole app file for one company's bot. */
export function teamsPackage(i: PackageInput): Buffer {
  return zip([
    { name: MANIFEST_FILE, data: Buffer.from(JSON.stringify(teamsManifest(i), null, 2), "utf8") },
    { name: "color.png", data: colorIcon() },
    { name: "outline.png", data: outlineIcon() },
  ]);
}
