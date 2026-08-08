import { Prisma, type PrismaClient } from "@prisma/client";
import {
  initiateBankTransferPayment,
  verifyTransaction,
  verifyWebhookSignature,
  isSuccessfulGatewayStatus,
} from "./flutterwave.js";
import { publish } from "../lib/events.js";
export const GATEWAY = "flutterwave";
const TX_REF_PREFIX = "ACE-";

export function buildTxRef(orderId: string): string {
  return `${TX_REF_PREFIX}${orderId}`;
}

export function orderIdFromTxRef(txRef: string): string | null {
  return txRef.startsWith(TX_REF_PREFIX) ? txRef.slice(TX_REF_PREFIX.length) : null;
}

/**
 * Initiate payment for a transfer order and persist the gateway reference.
 * Returns the hosted checkout link.
 *
 * The reference stored is OUR tx_ref (ACE-{orderId}) — the same string the
 * gateway echoes back in webhooks and the same key used for verify_by_reference.
 * Orders are matched on this reference only, never on amount/phone alone.
 */
export async function requestPayment(
  db: PrismaClient,
  order: {
    id: string;
    final_cost: number;
    payment_reference: string | null;
    customer: { phone: string };
  }
): Promise<string> {
  const txRef = buildTxRef(order.id);
  const { link } = await initiateBankTransferPayment({
    tx_ref: txRef,
    amount: order.final_cost,
    phone: order.customer.phone,
  });
  order.payment_reference = txRef;
  await db.order.update({
    where: { id: order.id },
    data: { payment_reference: txRef },
  });
  return link;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Handle a payment-gateway webhook. Idempotent by gateway transaction id, and
 * always re-verifies with the gateway before crediting (docs: never trust the
 * webhook alone). Every event is persisted so "I paid but it shows pending"
 * is debuggable.
 */
export async function handlePaymentWebhook(
  db: PrismaClient,
  rawBody: Buffer,
  headers: Record<string, string | undefined>
): Promise<void> {
  const signatureValid = verifyWebhookSignature(rawBody, headers);

  let payload: { event?: string; data?: Record<string, unknown> } | null = null;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as {
      event?: string;
      data?: Record<string, unknown>;
    };
  } catch {
    // Not JSON — nothing to record (no gateway event key to key on).
    return;
  }

  const data = payload.data ?? {};
  const txRef = typeof data.tx_ref === "string" ? data.tx_ref : "";
  const txId = typeof data.id === "number" || typeof data.id === "string" ? String(data.id) : "";
  const gatewayEventKey = `${GATEWAY}:${txId || txRef}`;

  // Record the event idempotently. A duplicate delivery hits the unique key and
  // is acked without touching the order again.
  let event;
  try {
    event = await db.webhookEvent.create({
      data: {
        gateway: GATEWAY,
        gateway_event_key: gatewayEventKey,
        event_type: payload.event ?? null,
        status: signatureValid ? "received" : "unverified",
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      await db.webhookEvent.update({
        where: { gateway_event_key: gatewayEventKey },
        data: { status: "duplicate" },
      });
      return;
    }
    throw err;
  }

  const mark = (patch: Prisma.WebhookEventUncheckedUpdateInput) =>
    db.webhookEvent.update({ where: { id: event.id }, data: patch });

  if (!signatureValid) {
    await mark({ status: "unverified" });
    return;
  }

  if (payload.event !== "charge.completed") {
    await mark({ status: "ignored_type" });
    return;
  }

  // Re-verify with the gateway before crediting.
  let verified;
  try {
    verified = await verifyTransaction(txRef);
  } catch {
    // Verification unavailable right now — leave as "received"; the
    // reconciliation job picks it up later.
    return;
  }

  if (!isSuccessfulGatewayStatus(verified.status)) {
    await mark({ status: "processed" });
    return;
  }

  const order = await db.order.findFirst({
    where: { payment_reference: txRef },
    select: { id: true, payment_method: true, payment_status: true },
  });
  if (!order) {
    await mark({ status: "ignored_unmatched" });
    return;
  }
  if (order.payment_method !== "transfer") {
    // Only transfer orders carry a payment_reference; guard against drift.
    await mark({ status: "ignored_owner", order_id: order.id });
    return;
  }

  if (order.payment_status !== "paid") {
    await db.order.update({
      where: { id: order.id },
      data: { payment_status: "paid" },
    });
  }
  await mark({ status: "processed", order_id: order.id });
}

/** A transfer payment is "overdue" when it has been pending for too long. */
export const OVERDUE_AFTER_MS = 30 * 60 * 1000;

export function isPaymentOverdue(order: {
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: Date;
}): boolean {
  if (order.payment_method !== "transfer") return false;
  if (order.payment_status !== "pending") return false;
  if (order.status === "cancelled") return false;
  return Date.now() - order.created_at.getTime() > OVERDUE_AFTER_MS;
}

/**
 * Reconciliation sweep (runs on a timer). Checks transfer orders stuck in
 * `pending` past the overdue window against the gateway and flips them.
 */
export async function reconcilePendingPayments(
  db: PrismaClient
): Promise<{ checked: number; paid: number; failed: number }> {
  const cutoff = new Date(Date.now() - OVERDUE_AFTER_MS);
  const pending = await db.order.findMany({
    where: {
      payment_method: "transfer",
      payment_status: "pending",
      status: { not: "cancelled" },
      created_at: { lt: cutoff },
      payment_reference: { not: null },
    },
    select: {
      id: true,
      payment_reference: true,
      final_cost: true,
      payment_status: true,
      customer: { select: { phone: true } },
    },
  });

  let paid = 0;
  let failed = 0;
  for (const order of pending) {
    const txRef = order.payment_reference as string;
    try {
      const tx = await verifyTransaction(txRef);
      if (isSuccessfulGatewayStatus(tx.status)) {
        await db.order.update({
          where: { id: order.id },
          data: { payment_status: "paid" },
        });
        paid++;
      } else if (tx.status === "failed") {
        await db.order.update({
          where: { id: order.id },
          data: { payment_status: "failed" },
        });
        failed++;
        publish("payment.failed", {
          id: order.id,
          final_cost: order.final_cost,
          payment_status: "failed",
          customer: order.customer,
        });
      }
      // still pending/processing — leave for the next sweep
    } catch {
      // gateway hiccup — leave for the next sweep
    }
  }
  return { checked: pending.length, paid, failed };
}
