// Notification Service (docs/05 §2.5). Subscribes to domain events and
// dispatches to the right channel:
//   - order.created        -> email operator (v1)
//   - order.status_changed -> WhatsApp/SMS customer, channel by whatsapp_ok
//   - payment.failed       -> email operator (overdue transfer order)
//
// Every dispatch attempt is written to the NotificationLog so a silently
// failed alert is visible in the DB. With no provider keys configured (dev),
// attempts are logged as `skipped` and never touch a real provider API.

import { on } from "../../lib/events.js";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/db.js";
import { sendEmail, sendSmsViaTermii, sendWhatsAppMessage } from "./providers.js";

type LogInput = {
  order_id?: string | null;
  recipient: string;
  channel: string;
  event: string;
  status: string;
  error?: string | null;
};

export async function logNotification(db: typeof prisma, entry: LogInput) {
  try {
    await db.notificationLog.create({ data: { ...entry, error: entry.error ?? null } });
  } catch (err) {
    console.error("[notify] failed to write notification log:", err);
  }
}

function naira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** The short code used in tracking links and as the message reference. */
export function shortTrackCode(id: string): string {
  return shortId(id);
}

// ---- Message templates ----

export function operatorNewOrderText(order: {
  id: string;
  service_type: string;
  item_count: number;
  final_cost: number;
  pickup_address: string;
  pickup_window: string;
  delivery_window: string;
  payment_method: string;
  payment_status: string;
  customer: { phone: string; whatsapp_ok: boolean };
}): { subject: string; text: string } {
  return {
    subject: `New order ${shortId(order.id)} — Ace Laundry`,
    text: [
      `New order ${shortId(order.id)} received.`,
      ``,
      `Service: ${order.service_type.replaceAll("_", " ")}`,
      `Items: ${order.item_count}`,
      `Cost: ${naira(order.final_cost)}`,
      `Payment: ${order.payment_method} (${order.payment_status})`,
      `Pickup: ${order.pickup_address} (${order.pickup_window})`,
      `Delivery: ${order.delivery_window}`,
      `Customer phone: ${order.customer.phone} (WhatsApp ${order.customer.whatsapp_ok ? "yes" : "no"})`,
    ].join("\n"),
  };
}

export function customerStatusChangedText(order: {
  id: string;
  status: string;
  final_cost: number;
}): string {
  const statusCopy: Record<string, string> = {
    picked_up: "your laundry has been picked up",
    in_progress: "your laundry is now being processed",
    ready_for_delivery: "your laundry is ready for delivery",
    delivered: "your laundry has been delivered",
    cancelled: "your order has been cancelled",
  };
  const copy = statusCopy[order.status] ?? `your order status is now '${order.status}'`;
  return [
    `Ace Laundry: ${copy}.`,
    `Reference ${shortId(order.id)}. Total ${naira(order.final_cost)}.`,
    `Track: ${env.frontendUrl}/s/${shortTrackCode(order.id)}`,
    `Thank you for using Ace Laundry!`,
  ].join(" ");
}

export function operatorPaymentFailedText(order: {
  id: string;
  final_cost: number;
  payment_status: string;
  customer?: { phone: string };
}): { subject: string; text: string } {
  return {
    subject: `Payment ${order.payment_status} for order ${shortId(order.id)} — Ace Laundry`,
    text: [
      `Order ${shortId(order.id)} is ${order.payment_status}.`,
      `Amount: ${naira(order.final_cost)}`,
      order.customer ? `Customer phone: ${order.customer.phone}` : "",
      `The pickup is blocked until payment is confirmed for transfer orders.`,
    ].join("\n"),
  };
}

// ---- Dispatch helpers (each returns the log status) ----

async function dispatchOperatorEmail(
  orderId: string | null,
  subject: string,
  text: string
): Promise<string> {
  if (!env.operatorEmail) {
    await logNotification(prisma, {
      order_id: orderId,
      recipient: env.operatorEmail || "(operator email unset)",
      channel: "email",
      event: "operator_alert",
      status: "skipped",
      error: "operator email not configured",
    });
    return "skipped";
  }
  const result = await sendEmail({ to: env.operatorEmail, subject, text });
  await logNotification(prisma, {
    order_id: orderId,
    recipient: env.operatorEmail,
    channel: "email",
    event: "operator_alert",
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
  });
  return result.ok ? "sent" : "failed";
}

async function dispatchCustomerMessage(
  orderId: string,
  customer: { phone: string; whatsapp_ok: boolean },
  text: string
): Promise<string> {
  const preferred = customer.whatsapp_ok ? "whatsapp" : "sms";
  // Preferred channel first; fall back to the other when unconfigured.
  const attempts: { channel: string; send: () => Promise<{ ok: boolean; error?: string }> }[] =
    preferred === "whatsapp"
      ? [
          { channel: "whatsapp", send: () => sendWhatsAppMessage({ to: customer.phone, text }) },
          { channel: "sms", send: () => sendSmsViaTermii({ to: customer.phone, text }) },
        ]
      : [
          { channel: "sms", send: () => sendSmsViaTermii({ to: customer.phone, text }) },
          { channel: "whatsapp", send: () => sendWhatsAppMessage({ to: customer.phone, text }) },
        ];

  let anyConfigured = false;
  for (const attempt of attempts) {
    const result = await attempt.send();
    if (result.ok) {
      await logNotification(prisma, {
        order_id: orderId,
        recipient: customer.phone,
        channel: attempt.channel,
        event: "status_changed",
        status: "sent",
      });
      return "sent";
    }
    if (result.error !== "not configured") anyConfigured = true;
  }

  if (!anyConfigured) {
    // No provider has keys (dev) — one clean "skipped" row.
    await logNotification(prisma, {
      order_id: orderId,
      recipient: customer.phone,
      channel: preferred,
      event: "status_changed",
      status: "skipped",
      error: "no messaging provider configured",
    });
    return "skipped";
  }

  // Preferred configured but failed, fallback also failed -> log failure.
  await logNotification(prisma, {
    order_id: orderId,
    recipient: customer.phone,
    channel: preferred,
    event: "status_changed",
    status: "failed",
    error: "all messaging channels failed",
  });
  return "failed";
}

// ---- Event handlers ----

// Subscribes the notifier to domain events. Idempotent: `on` uses a Set, so
// calling this from every createApp() can't double-register.
export function registerNotificationHandlers() {
  on("order.created", (payload) => {
    const order = payload as Parameters<typeof operatorNewOrderText>[0];
    const email = operatorNewOrderText(order);
    void dispatchOperatorEmail(order.id, email.subject, email.text);
  });

  on("order.status_changed", (payload) => {
    const { order, customer } = payload as {
      order: { id: string; status: string; final_cost: number };
      customer: { phone: string; whatsapp_ok: boolean };
    };
    void dispatchCustomerMessage(order.id, customer, customerStatusChangedText(order));
  });

  on("payment.failed", (payload) => {
    const order = payload as Parameters<typeof operatorPaymentFailedText>[0];
    const email = operatorPaymentFailedText(order);
    void dispatchOperatorEmail(order.id, email.subject, email.text);
  });
}
