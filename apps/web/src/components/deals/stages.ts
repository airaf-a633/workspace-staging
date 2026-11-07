/**
 * Deal stages (decided 2026-09-30): New → Quoted → Negotiating on the board; Won and Lost are outcomes.
 * [English name, badge tone]; screens show the name from the language files (stages.<key>).
 */
export const STAGE = {
  new: ["New", "new"],
  quoted: ["Quoted", "transit"],
  negotiating: ["Negotiating", "transit"],
  won: ["Won", "done"],
  lost: ["Lost", "fail"],
} as const;

export const OPEN_STAGES = ["new", "quoted", "negotiating"] as const;
export type OpenStage = (typeof OPEN_STAGES)[number];

/** Stored as these words; shown through values.lostReason.<word>. */
export const LOST_REASONS = ["Price", "Stock", "Went silent", "Competitor", "Other"] as const;
