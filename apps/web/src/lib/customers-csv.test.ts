import { describe, expect, it } from "vitest";
import { customersCsv } from "./customers-csv";

const person = (over: Partial<Parameters<typeof customersCsv>[0][number]> = {}) => ({
  name: "Ana Silva", email: "ana@example.com", phone: null, company: "Acme", lifecycle: "customer", tags: ["VIP", "Wholesale"],
  language: "en", area: null, do_not_contact: false, created_at: "2026-10-12T09:00:00Z", consent: [{ channel: "email", status: "in" }, { channel: "sms", status: "out" }],
  ...over,
});

describe("the customer CSV", () => {
  it("has a header and one row per person", () => {
    const lines = customersCsv([person(), person({ name: "Ben" })]).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Name,Email,Phone,Company,Stage,Tags,Language,Area,Marketing consent,Do not contact,Added");
    expect(lines[1]).toBe("Ana Silva,ana@example.com,,Acme,customer,VIP; Wholesale,en,,email,no,2026-10-12");
  });

  it("lists only the channels they opted in to", () => {
    expect(customersCsv([person()])).toContain(",email,no,");
    expect(customersCsv([person({ consent: [] })])).toContain(",,no,");
  });

  it("quotes commas, quotes and line breaks", () => {
    const line = customersCsv([person({ name: 'Smith, "Bob"\nJr' })]).split("\r\n").slice(1).join("\r\n");
    expect(line.startsWith('"Smith, ""Bob""\nJr",')).toBe(true);
  });

  it("stops a spreadsheet from running a name as a formula", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2", "@SUM(A1)"]) {
      const row = customersCsv([person({ name: evil })]).split("\r\n")[1]!;
      expect(row.startsWith("'") || row.startsWith('"\'')).toBe(true);
    }
  });

  it("is just the header when nobody is selected", () => {
    expect(customersCsv([])).toBe("Name,Email,Phone,Company,Stage,Tags,Language,Area,Marketing consent,Do not contact,Added");
  });
});
