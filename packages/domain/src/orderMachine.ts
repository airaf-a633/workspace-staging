/**
 * Order lifecycle. The database enforces the same rules in its transition functions;
 * this module is the shared reference used by the UI (which buttons to show) and by tests.
 */
export const ORDER_STATUSES = [
  "draft",
  "confirmed",
  "assigned",
  "picked_up",
  "delivered",
  "failed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderAction = "confirm" | "assign" | "pick_up" | "deliver" | "fail" | "cancel" | "retry";

const TRANSITIONS: Record<OrderAction, { from: readonly OrderStatus[]; to: OrderStatus }> = {
  confirm: { from: ["draft"], to: "confirmed" },
  assign: { from: ["confirmed", "assigned"], to: "assigned" }, // reassign keeps status
  pick_up: { from: ["assigned"], to: "picked_up" },
  deliver: { from: ["picked_up"], to: "delivered" },
  fail: { from: ["assigned", "picked_up"], to: "failed" },
  cancel: { from: ["draft", "confirmed", "assigned", "picked_up"], to: "cancelled" },
  retry: { from: ["failed"], to: "assigned" },
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["delivered", "cancelled"];

export function canApply(status: OrderStatus, action: OrderAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

export function nextStatus(status: OrderStatus, action: OrderAction): OrderStatus {
  if (!canApply(status, action)) {
    throw new InvalidTransitionError(status, action);
  }
  return TRANSITIONS[action].to;
}

export function availableActions(status: OrderStatus): OrderAction[] {
  return (Object.keys(TRANSITIONS) as OrderAction[]).filter((a) => canApply(status, a));
}

/** The five stops of the order rail shown across the UI. */
export const RAIL_STOPS = ["placed", "assigned", "picked_up", "delivered", "cash_in"] as const;
export type RailStop = (typeof RAIL_STOPS)[number];

export class InvalidTransitionError extends Error {
  constructor(
    readonly status: OrderStatus,
    readonly action: OrderAction,
  ) {
    super(`Cannot ${action} an order that is ${status}`);
    this.name = "InvalidTransitionError";
  }
}
