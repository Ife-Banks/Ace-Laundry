// Notification Service (docs/05 §2.5). Subscribes to domain events and
// dispatches to the right channel:
//   - order.created        -> email operator (v1)
//   - order.status_changed -> email customer for every status (primary channel);
//                             WhatsApp additionally on `delivered` when opted in;
//                             SMS only as an email-failure fallback
//   - payment.failed       -> email operator (overdue transfer order)
//
// Every dispatch attempt is written to the NotificationLog so a silently
// failed alert is visible in the DB. With no provider keys configured (dev),
// attempts are logged as `skipped` and never touch a real provider API.

import { on } from "../../lib/events.js";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/db.js";
import {
  sendEmail,
  sendSmsViaTermii,
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "./providers.js";
import {
  getWhatsappTemplateName,
  getWhatsappTemplateLanguage,
} from "../settingsService.js";

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
  customer: { phone: string; email?: string | null; whatsapp_ok: boolean };
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
      `Customer: ${order.customer.phone}${order.customer.email ? ` (${order.customer.email})` : ""}`,
    ].join("\n"),
  };
}

const STATUS_COPY: Record<string, string> = {
  picked_up: "your laundry has been picked up",
  in_progress: "your laundry is now being processed",
  ready_for_delivery: "your laundry is ready for delivery",
  delivered: "your laundry has been delivered",
  cancelled: "your order has been cancelled",
};

function statusPhrase(status: string): string {
  return STATUS_COPY[status] ?? `your order status is now '${status}'`;
}

export function customerStatusChangedText(order: {
  id: string;
  status: string;
  final_cost: number;
}): string {
  return [
    `Ace Laundry: ${statusPhrase(order.status)}.`,
    `Reference ${shortId(order.id)}. Total ${naira(order.final_cost)}.`,
    `Track: ${env.frontendUrl}/s/${shortTrackCode(order.id)}`,
    `Thank you for using Ace Laundry!`,
  ].join(" ");
}

/**
 * The {{1}}..{{4}} values for the status-update WhatsApp template. Create the
 * approved template with these placeholders in this exact order:
 *   {{1}} status copy   {{2}} reference   {{3}} total   {{4}} track link
 */
export function customerTemplateParameters(order: {
  id: string;
  status: string;
  final_cost: number;
}): { statusCopy: string; reference: string; total: string; trackUrl: string } {
  return {
    statusCopy: statusPhrase(order.status),
    reference: shortId(order.id),
    total: naira(order.final_cost),
    trackUrl: `${env.frontendUrl}/s/${shortTrackCode(order.id)}`,
  };
}

/** The email sent to the customer for every fulfillment-status change. */
export function customerStatusEmail(order: {
  id: string;
  status: string;
  final_cost: number;
}): { subject: string; text: string } {
  const heading: Record<string, string> = {
    picked_up: "Your laundry has been picked up",
    in_progress: "Your laundry is now being processed",
    ready_for_delivery: "Your laundry is ready for delivery",
    delivered: "Your laundry has been delivered",
    cancelled: "Your order has been cancelled",
  };
  const title = heading[order.status] ?? `Order status: ${order.status}`;
  return {
    subject: `${title} — ${shortId(order.id)}`,
    text: [
      title,
      "",
      `Reference: ${shortId(order.id)}`,
      `Total: ${naira(order.final_cost)}`,
      `Track your order: ${env.frontendUrl}/s/${shortTrackCode(order.id)}`,
      "",
      "Thank you for using Ace Laundry!",
    ].join("\n"),
  };
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

/**
 * Customer status notification (email-primary, docs/03 §5.1):
 *   1. email the customer for every status change
 *   2. on `delivered` only, ALSO WhatsApp when the customer opted in
 *   3. if the email send failed, fall back to SMS so the customer still hears
 * Returns the email-channel outcome ("sent" | "failed" | "skipped").
 */
async function dispatchCustomerStatus(
  orderId: string,
  order: { id: string; status: string; final_cost: number },
  customer: { phone: string; email: string | null; whatsapp_ok: boolean },
  text: string,
  templateParams: { statusCopy: string; reference: string; total: string; trackUrl: string }
): Promise<string> {
  // WhatsApp prefers an approved template (bypasses the 24h customer-service
  // window) when the operator has set one on the Settings screen; otherwise it
  // falls back to free-form text.
  const whatsappSend = async (): Promise<{ ok: boolean; error?: string }> => {
    const templateName = await getWhatsappTemplateName(prisma);
    if (templateName) {
      const language = (await getWhatsappTemplateLanguage(prisma)) || "en";
      return sendWhatsAppTemplate({
        to: customer.phone,
        templateName,
        language,
        parameters: [
          templateParams.statusCopy,
          templateParams.reference,
          templateParams.total,
          templateParams.trackUrl,
        ],
      });
    }
    return sendWhatsAppMessage({ to: customer.phone, text });
  };

  // 1. Email — primary channel.
  let emailOutcome: string;
  if (!customer.email) {
    emailOutcome = "skipped";
    await logNotification(prisma, {
      order_id: orderId,
      recipient: customer.phone,
      channel: "email",
      event: "status_changed",
      status: "skipped",
      error: "no customer email on record",
    });
  } else {
    const email = customerStatusEmail(order);
    const result = await sendEmail({ to: customer.email, subject: email.subject, text: email.text });
    emailOutcome = result.ok ? "sent" : "failed";
    await logNotification(prisma, {
      order_id: orderId,
      recipient: customer.email,
      channel: "email",
      event: "status_changed",
      status: emailOutcome,
      error: result.ok ? null : result.error,
    });
  }

  // 2. Delivered-only WhatsApp nudge.
  let whatsappOk = false;
  if (order.status === "delivered" && customer.whatsapp_ok) {
    const result = await whatsappSend();
    whatsappOk = result.ok;
    await logNotification(prisma, {
      order_id: orderId,
      recipient: customer.phone,
      channel: "whatsapp",
      event: "status_changed",
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
    });
  }

  // 3. SMS fallback for a failed email — unless the delivered WhatsApp already
  // reached the customer (no double-messaging).
  if (emailOutcome === "failed" && !whatsappOk) {
    const result = await sendSmsViaTermii({ to: customer.phone, text });
    await logNotification(prisma, {
      order_id: orderId,
      recipient: customer.phone,
      channel: "sms",
      event: "status_changed",
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
    });
  }

  return emailOutcome;
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
      customer: { phone: string; email: string | null; whatsapp_ok: boolean };
    };
    void dispatchCustomerStatus(
      order.id,
      order,
      customer,
      customerStatusChangedText(order),
      customerTemplateParameters(order)
    );
  });

  on("payment.failed", (payload) => {
    const order = payload as Parameters<typeof operatorPaymentFailedText>[0];
    const email = operatorPaymentFailedText(order);
    void dispatchOperatorEmail(order.id, email.subject, email.text);
  });
}
