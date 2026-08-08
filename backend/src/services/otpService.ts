// OTP verification for customer order history (docs/05 §2.6).
// Lightweight and session-scoped — no password, no persistent login.
// Codes are 6 digits, single-use, 10-minute expiry, stored hashed. The request
// endpoint is rate-limited to 3 codes per phone per 15 minutes.

import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/errors.js";
import { env } from "../lib/env.js";
import { signHistoryToken } from "../lib/auth.js";
import { sendWhatsAppMessage, sendSmsViaTermii } from "./notifications/providers.js";
import { logNotification } from "./notifications/notificationService.js";

export const OTP_LIFETIME_MS = 10 * 60 * 1000;
export const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;
export const OTP_RATE_MAX = 3;

export function hashOtpCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(`${code}:${env.operatorSessionSecret}`)
    .digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate and dispatch a code. Deliberately returns a generic success so
 * callers can't enumerate which phones exist — an invalid phone gets the same
 * "code sent" response (the SMS just fails silently downstream and is logged).
 */
export async function requestOtp(db: PrismaClient, phone: string): Promise<void> {
  const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
  const recent = await db.otpCode.count({
    where: { phone, created_at: { gte: windowStart } },
  });
  if (recent >= OTP_RATE_MAX) {
    throw new HttpError(
      429,
      "otp_rate_limited",
      "Too many codes requested for this number. Try again in a few minutes."
    );
  }

  const code = generateCode();
  await db.otpCode.create({
    data: {
      phone,
      code_hash: hashOtpCode(code),
      expires_at: new Date(Date.now() + OTP_LIFETIME_MS),
    },
  });

  // Dev-only: no SMS/WhatsApp provider is configured locally, so print the
  // code so the flow can be tested end-to-end. Never enabled in production.
  if (env.nodeEnv !== "production") {
    console.log(`[otp] code for ${phone}: ${code}`);
  }

  // Channel preference follows the customer's stored whatsapp_ok (default
  // true); falls back to the other channel when the preferred one isn't
  // configured, so dev (no provider keys) never hits a real API.
  const customer = await db.customer.findUnique({ where: { phone } });
  const whatsappOk = customer ? customer.whatsapp_ok : true;

  const attempts = whatsappOk
    ? [
        { channel: "whatsapp", send: () => sendWhatsAppMessage({ to: phone, text: otpMessage(code) }) },
        { channel: "sms", send: () => sendSmsViaTermii({ to: phone, text: otpMessage(code) }) },
      ]
    : [
        { channel: "sms", send: () => sendSmsViaTermii({ to: phone, text: otpMessage(code) }) },
        { channel: "whatsapp", send: () => sendWhatsAppMessage({ to: phone, text: otpMessage(code) }) },
      ];

  let anyConfigured = false;
  for (const attempt of attempts) {
    const result = await attempt.send();
    if (result.ok) {
      await logNotification(db, {
        recipient: phone,
        channel: attempt.channel,
        event: "otp_request",
        status: "sent",
      });
      return;
    }
    if (result.error !== "not configured") anyConfigured = true;
  }

  if (!anyConfigured) {
    // No provider has keys (dev) — one clean "skipped" row, nothing to retry.
    await logNotification(db, {
      recipient: phone,
      channel: whatsappOk ? "whatsapp" : "sms",
      event: "otp_request",
      status: "skipped",
      error: "no messaging provider configured",
    });
    return;
  }

  // At least one provider was configured but every attempt failed.
  await logNotification(db, {
    recipient: phone,
    channel: whatsappOk ? "whatsapp" : "sms",
    event: "otp_request",
    status: "failed",
    error: "all messaging channels failed",
  });
}

function otpMessage(code: string): string {
  return `Ace Laundry: your order history code is ${code}. It expires in 10 minutes. Do not share it.`;
}

/**
 * Check the code. On match, consume it and mint the short-lived history token
 * scoped to this phone number. Wrong or expired codes are a 401.
 */
export async function verifyOtp(
  db: PrismaClient,
  phone: string,
  code: string
): Promise<{ token: string }> {
  const candidate = await db.otpCode.findFirst({
    where: {
      phone,
      consumed: false,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: "desc" },
    take: 1,
  });

  if (!candidate || !safeEqual(hashOtpCode(code), candidate.code_hash)) {
    throw new HttpError(401, "invalid_or_expired_code", "Invalid or expired code.");
  }

  await db.otpCode.updateMany({
    where: { phone, consumed: false },
    data: { consumed: true },
  });

  return { token: signHistoryToken(phone) };
}
