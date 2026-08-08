import type { OrderStatus, PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/errors.js";
import { findOrCreateCustomer } from "./customerService.js";
import type { CreateOrderInput } from "../lib/schemas.js";
import {
  nextStatus,
  isCancellable,
  pickupGateBlockReason,
} from "../lib/orderMachine.js";
import { publish } from "../lib/events.js";

export function computeCost(itemCount: number, rate: number): number {
  return itemCount * rate;
}

export function computeFinalCost(cost: number, adjustment: number): number {
  return cost + adjustment;
}

/** Append a row to the fulfillment-status audit trail. */
export async function recordStatusLog(
  db: PrismaClient,
  orderId: string,
  status: OrderStatus
) {
  await db.orderStatusLog.create({ data: { order_id: orderId, status } });
}

export async function createOrder(db: PrismaClient, input: CreateOrderInput) {
  const rateConfig = await db.rateConfig.findUnique({ where: { id: 1 } });
  if (!rateConfig) {
    throw new HttpError(500, "rate_config_missing", "Pricing is not configured.");
  }

  const customer = await findOrCreateCustomer(db, input.phone, input.whatsapp_ok);

  const rateApplied = rateConfig[input.service_type];
  const cost = computeCost(input.item_count, rateApplied);
  const finalCost = computeFinalCost(cost, 0);

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customer_id: customer.id,
        service_type: input.service_type,
        item_count: input.item_count,
        rate_applied: rateApplied,
        cost,
        adjustment: 0,
        final_cost: finalCost,
        pickup_address: input.pickup_address,
        pickup_window: input.pickup_window,
        delivery_window: input.delivery_window,
        delivery_date: input.delivery_date ? new Date(input.delivery_date) : null,
        payment_method: input.payment_method,
        payment_status: "pending",
        status: "booked",
        payment_reference: null,
      },
      include: { customer: true },
    });
    // Initial timeline entry: the order was booked.
    await tx.orderStatusLog.create({
      data: { order_id: created.id, status: "booked" },
    });
    return created;
  });

  publish("order.created", order);

  return order;
}

export async function advanceOrderStatus(
  db: PrismaClient,
  orderId: string
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, payment_method: true, payment_status: true },
  });
  if (!order) {
    throw new HttpError(404, "not_found", "Order not found.");
  }

  const next = nextStatus(order.status);
  if (!next) {
    throw new HttpError(
      409,
      order.status === "cancelled" ? "cancelled" : "no_next_status",
      order.status === "cancelled"
        ? "Cancelled orders cannot advance."
        : "Order is already delivered."
    );
  }

  // Pickup gate: transfer orders cannot move booked -> picked_up before paid.
  const gateReason = pickupGateBlockReason(order);
  if (gateReason) {
    throw new HttpError(
      409,
      gateReason,
      "Payment must be confirmed before pickup for transfer orders."
    );
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: { status: next as OrderStatus, status_updated_at: new Date() },
    include: { customer: true },
  });
  await recordStatusLog(db, orderId, next as OrderStatus);
  publish("order.status_changed", { order: updated, customer: updated.customer });
  return updated;
}

export async function cancelOrder(
  db: PrismaClient,
  orderId: string,
  note: string
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) {
    throw new HttpError(404, "not_found", "Order not found.");
  }
  if (!isCancellable(order.status)) {
    throw new HttpError(
      409,
      "not_cancellable",
      `Orders in '${order.status}' cannot be cancelled.`
    );
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: { status: "cancelled", status_updated_at: new Date(), note },
    include: { customer: true },
  });
  await recordStatusLog(db, orderId, "cancelled");
  publish("order.status_changed", { order: updated, customer: updated.customer });
  return updated;
}

/**
 * Customer-initiated cancellation (docs/01 §1.3). Two extra guards on top of
 * the operator path:
 *   - the caller's OTP-verified phone MUST match the order's customer phone
 *   - only `booked` orders (not yet picked up) can be cancelled by the customer
 */
export async function customerCancelOrder(
  db: PrismaClient,
  orderId: string,
  verifiedPhone: string,
  note: string
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { phone: true } } },
  });
  if (!order) {
    throw new HttpError(404, "not_found", "Order not found.");
  }
  if (order.customer.phone !== verifiedPhone) {
    throw new HttpError(401, "unauthorized", "Verify your phone number to cancel this order.");
  }
  if (order.status !== "booked") {
    throw new HttpError(
      409,
      "customer_cancel_window",
      "Orders can only be cancelled before pickup."
    );
  }
  return cancelOrder(db, orderId, note);
}

export async function setOrderPaymentStatus(
  db: PrismaClient,
  orderId: string,
  paymentStatus: "paid" | "unpaid"
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, payment_method: true, payment_status: true, status: true },
  });
  if (!order) {
    throw new HttpError(404, "not_found", "Order not found.");
  }
  if (order.status === "cancelled") {
    throw new HttpError(409, "cancelled", "Cancelled orders cannot change payment status.");
  }
  if (order.payment_method === "transfer") {
    throw new HttpError(
      409,
      "payment_webhook_owned",
      "Transfer payments are confirmed by the payment gateway, not the operator."
    );
  }
  return db.order.update({
    where: { id: orderId },
    data: { payment_status: paymentStatus },
  });
}

export async function adjustOrderCost(
  db: PrismaClient,
  orderId: string,
  adjustment: number,
  note?: string
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, cost: true, status: true },
  });
  if (!order) {
    throw new HttpError(404, "not_found", "Order not found.");
  }
  if (order.status === "cancelled") {
    throw new HttpError(409, "cancelled", "Cancelled orders cannot be adjusted.");
  }
  if (adjustment !== 0 && !note) {
    throw new HttpError(400, "note_required", "A note is required when adjusting the cost.");
  }

  return db.order.update({
    where: { id: orderId },
    data: {
      adjustment,
      adjustment_note: adjustment !== 0 ? note ?? null : null,
      final_cost: computeFinalCost(order.cost, adjustment),
    },
  });
}
