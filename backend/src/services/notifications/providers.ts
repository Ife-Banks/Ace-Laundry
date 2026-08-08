// One provider per channel, each returning { ok, error } and never throwing.
// An unconfigured provider is reported as a failed attempt ("not configured");
// the notifier turns that into a `skipped` log entry, so dev mode (no keys in
// .env) never touches a real provider API.
//
// NOTE: WhatsApp goes through the official Business Cloud API (or a compliant
// wrapper) only — never an unofficial library like Baileys/whatsapp-web.js
// (docs/03 §5.2).

import { env } from "../../lib/env.js";

export type ProviderResult = { ok: boolean; error?: string };

export function toInternational(phone: string): string {
  // "08012345678" -> "2348012345678" (Nigerian international format)
  return phone.startsWith("0") ? `234${phone.slice(1)}` : phone;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<ProviderResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, error: `${res.status} ${await res.text()}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---- Email: SendLib ----

/**
 * Send email through SendLib. `from` is optional — when SL_FROM is blank the
 * API uses the first Gmail account connected to the SendLib account.
 */
export async function sendEmailViaSendLib(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<ProviderResult> {
  if (!env.slApiKey) return { ok: false, error: "not configured" };
  return postJson(
    "https://sendlib.samueltuoyo.com/api/send",
    {
      ...(env.slFrom ? { from: env.slFrom } : {}),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    },
    { Authorization: `Bearer ${env.slApiKey}`, Origin: env.slOrigin }
  );
}

export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<ProviderResult> {
  return sendEmailViaSendLib(opts);
}

// ---- SMS: Termii (Nigerian carriers) ----

export async function sendSmsViaTermii(opts: {
  to: string;
  text: string;
}): Promise<ProviderResult> {
  if (!env.termiiApiKey) return { ok: false, error: "not configured" };
  return postJson(
    "https://api.ng.termii.com/api/sms/send",
    {
      api_key: env.termiiApiKey,
      to: toInternational(opts.to),
      from: env.termiiSenderId,
      sms: opts.text,
      type: "plain",
      channel: "generic",
    },
    {}
  );
}

// ---- WhatsApp: Meta Business Cloud API ----

export async function sendWhatsAppMessage(opts: {
  to: string;
  text: string;
}): Promise<ProviderResult> {
  if (!env.whatsappPhoneNumberId || !env.whatsappAccessToken) {
    return { ok: false, error: "not configured" };
  }
  return postJson(
    `https://graph.facebook.com/v21.0/${env.whatsappPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toInternational(opts.to),
      type: "text",
      text: { body: opts.text },
    },
    { Authorization: `Bearer ${env.whatsappAccessToken}` }
  );
}
