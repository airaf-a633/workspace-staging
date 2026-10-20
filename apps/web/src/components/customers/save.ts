/**
 * How the Contacts screens save in a real workspace (decided 2026-10-20). The preview passes nothing and keeps
 * changes on screen only. Each call returns an error key, or null when saved.
 */
export interface ContactPatch {
  name?: string;
  email?: string | null;
  phone?: string | null;
  lifecycle?: string;
  owner?: string | null;
  company?: string | null;
  tags?: string[];
  language?: string | null;
  area?: string | null;
  fields?: Record<string, string>;
}

export interface ListSave {
  add: (draft: { name: string; email: string; phone: string; company: string; tag: string }) => Promise<{ id?: string; error?: string }>;
  bulk: (kind: "tag" | "owner" | "stage", ids: string[], value: string) => Promise<string | null>;
}

export interface CustomerSave {
  patch: (id: string, patch: ContactPatch) => Promise<string | null>;
  pin: (id: string, text: string) => Promise<string | null>;
}
