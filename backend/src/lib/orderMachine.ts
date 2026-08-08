import type { Order } from "@prisma/client";

// Fulfillment flow — one direction only.
export const FULFILLMENT_FLOW = [
  "booked",
  "picked_up",
  "in_progress",
  "ready_for_delivery",
  "delivered",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_FLOW)[number];

export const NEXT_STATUS: Record<string, string> = {
  booked: "picked_up",
  picked_up: "in_progress",
  in_progress: "ready_for_delivery",
  ready_for_delivery: "delivered",
};

// Cancellation is a branch, not a step — allowed only from these states, and
// blocked once items have been processed.
export const CANCELLABLE_STATUSES = new Set(["booked", "picked_up", "in_progress"]);

export function nextStatus(status: string): string | null {
  return NEXT_STATUS[status] ?? null;
}

export function isCancellable(status: string): boolean {
  return CANCELLABLE_STATUSES.has(status);
}

/**
 * The pickup gate (product plan §2.3), as a pure function.
 * Returns a machine-readable reason when the booked -> picked_up transition
 * is blocked, or null when it is allowed.
 *
 * - cash: always allowed (pay-on-delivery is the point of cash).
 * - transfer: blocked until payment_status === "paid".
 */
export function pickupGateBlockReason(order: Pick<Order, "payment_method" | "payment_status" | "status">): string | null {
  if (order.status !== "booked") return null;
  if (order.payment_method === "cash") return null;
  if (order.payment_status === "paid") return null;
  return "payment_pending";
}
