import crypto from "node:crypto";
import { env } from "../lib/env.js";

const BASE_URL = "https://api.flutterwave.com/v3";

export class PaymentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.flutterwaveSecretKey}`,
    "Content-Type": "application/json",
  };
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new PaymentError("gateway_unreadable", `${context}: non-JSON response.`);
  }
  if (!res.ok) {
    const detail = (body as { message?: string })?.message ?? `HTTP ${res.status}`;
    throw new PaymentError("gateway_error", `${context}: ${detail}`);
  }
  return body as T;
}

export interface PaymentLink {
  link: string;
  id: string;
}

/**
 * Initiate a hosted bank-transfer payment. The gateway returns a checkout link;
 * the customer is redirected there and can pay via their bank app. The gateway
 * fires a `charge.completed` webhook when the transfer lands.
 *
 * NOTE: the product collects no customer email, but the gateway requires one —
 * a fixed business address (FLUTTERWAVE_PAYMENT_EMAIL) is used for the charge.
 */
export async function initiateBankTransferPayment(opts: {
  tx_ref: string;
  amount: number; // whole naira
  phone: string;
}): Promise<PaymentLink> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      tx_ref: opts.tx_ref,
      amount: opts.amount,
      currency: "NGN",
      // Restrict the hosted page to bank transfer only — no card in v1.
      // (Verify the exact accepted value against the dashboard on first live test.)
      payment_options: "banktransfer",
      redirect_url: `${env.frontendUrl}/order/${opts.tx_ref.replace(/^ACE-/, "")}`,
      customer: {
        email: env.flutterwavePaymentEmail,
        name: "Ace Laundry Customer",
        phonenumber: opts.phone,
      },
    }),
  });
  const body = await handleResponse<{
    status?: string;
    data?: { link?: string; id?: string };
  }>(res, "initiate bank transfer");

  if (body.status !== "success" || !body.data?.link) {
    throw new PaymentError("gateway_no_link", "The gateway did not return a payment link.");
  }
  return { link: body.data.link, id: String(body.data.id ?? "") };
}

export interface VerifiedTransaction {
  id: string;
  status: string; // successful | failed | ...
  amount: number | null;
  currency: string | null;
}

/**
 * Verify a transaction by reference. Used by the reconciliation job and as a
 * server-side double-check before crediting a webhook (docs: never trust the
 * webhook alone).
 */
export async function verifyTransaction(txRef: string): Promise<VerifiedTransaction> {
  const res = await fetch(
    `${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    { headers: authHeaders() }
  );
  const body = await handleResponse<{
    status?: string;
    data?: { id?: string | number; status?: string; amount?: number | string; currency?: string };
  }>(res, "verify transaction");

  if (body.status !== "success" || !body.data) {
    throw new PaymentError("transaction_not_found", `No gateway transaction for ${txRef}.`);
  }
  return {
    id: String(body.data.id ?? ""),
    status: body.data.status ?? "",
    amount: body.data.amount == null ? null : Number(body.data.amount),
    currency: body.data.currency ?? null,
  };
}

export function isSuccessfulGatewayStatus(status: string | null | undefined): boolean {
  // v3 uses "successful"; newer API docs use "succeeded". Accept both.
  return status === "successful" || status === "succeeded";
}

/**
 * Webhook authenticity check. Supports both documented mechanisms:
 *  - legacy: `verif-hash` header compared to the configured secret hash
 *  - current: `flutterwave-signature` = HMAC-SHA256(raw body, secret hash)
 *
 * When no secret hash is configured (local dev before gateway setup), requests
 * are accepted but every received event is still logged.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  headers: Record<string, string | undefined>,
  secretHash: string = env.flutterwaveSecretHash
): boolean {
  if (!secretHash) return true; // dev mode — no hash configured yet

  const verifHash = headers["verif-hash"];
  if (verifHash && verifHash === secretHash) return true;

  const signature = headers["flutterwave-signature"];
  if (signature) {
    const expected = crypto
      .createHmac("sha256", secretHash)
      .update(rawBody)
      .digest("hex");
    const sig = Buffer.from(signature, "hex");
    const exp = Buffer.from(expected, "hex");
    if (sig.length === exp.length && crypto.timingSafeEqual(sig, exp)) return true;
  }
  return false;
}
