/** Turns the database's export (export_contacts) into a CSV list. One row per customer; the full record stays in the JSON export. */

interface Exported {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  lifecycle: string;
  tags: string[];
  language: string | null;
  area: string | null;
  do_not_contact: boolean;
  created_at: string;
  consent: { channel: string; status: string }[];
}

// A cell starting with = + - @ would run as a formula when the file opens in a spreadsheet, so it gets a leading quote mark.
function cell(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const COLUMNS = ["Name", "Email", "Phone", "Company", "Stage", "Tags", "Language", "Area", "Marketing consent", "Do not contact", "Added"];

export function customersCsv(rows: Exported[]): string {
  const lines = rows.map((c) =>
    [
      c.name ?? "", c.email ?? "", c.phone ?? "", c.company ?? "", c.lifecycle, c.tags.join("; "), c.language ?? "", c.area ?? "",
      c.consent.filter((k) => k.status === "in").map((k) => k.channel).join("; "), c.do_not_contact ? "yes" : "no", c.created_at.slice(0, 10),
    ].map((v) => cell(String(v))).join(","),
  );
  return [COLUMNS.join(","), ...lines].join("\r\n");
}
