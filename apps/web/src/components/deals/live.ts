/** What the Deals board can ask the server to do on real data. Each call answers ok, or a short error code the board words plainly. */
export type Outcome = { ok: true; id?: string } | { ok: false; error: string };

export interface DealActions {
  create(input: { title: string; contactId: string | null; valueMinor: number }): Promise<Outcome>;
  move(id: string, stage: string): Promise<Outcome>;
  win(id: string, finalMinor: number): Promise<Outcome>;
  lose(id: string, reason: string): Promise<Outcome>;
  reopen(id: string): Promise<Outcome>;
  note(id: string, body: string): Promise<Outcome>;
  askDiscount(id: string, percent: number, note: string): Promise<Outcome>;
  decide(approvalId: string, approve: boolean, note: string): Promise<Outcome>;
  /** The customers a new deal can be about. */
  customers: { id: string; name: string }[];
  /** Open the new-deal form already pointing at this customer (from the customer's page). */
  newFor?: { id: string; name: string } | null;
}

export interface TaskActions {
  create(input: { text: string; ownerId: string | null; contactId: string | null; due: number | null; hasTime: boolean; repeat: string | null }): Promise<Outcome>;
  complete(id: string): Promise<Outcome>;
  undo(id: string): Promise<Outcome>;
  snooze(id: string, due: number, hasTime: boolean): Promise<Outcome>;
  note(id: string, body: string): Promise<Outcome>;
}
