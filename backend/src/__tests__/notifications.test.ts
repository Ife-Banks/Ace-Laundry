import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { env } from "../lib/env.js";
import {
  operatorNewOrderText,
  customerStatusChangedText,
  operatorPaymentFailedText,
  shortTrackCode,
} from "../services/notifications/notificationService.js";
import {
  toInternational,
  sendEmail,
  sendSmsViaTermii,
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "../services/notifications/providers.js";

const order = {
  id: "2d4d5411-fcd8-4c52-bab3-147b15cfc5e0",
  service_type: "wash_and_fold",
  item_count: 3,
  final_cost: 1500,
  pickup_address: "12 Allen Avenue, Ikeja",
  pickup_window: "morning",
  delivery_window: "next_day",
  payment_method: "transfer",
  payment_status: "pending",
  customer: { phone: "08012345678", whatsapp_ok: true },
};

describe("notification message templates", () => {
  it("operator new-order email includes the order summary", () => {
    const { subject, text } = operatorNewOrderText(order);
    assert.match(subject, /New order/i);
    assert.match(text, /wash and fold/i);
    assert.match(text, /₦1,500/);
    assert.match(text, /08012345678/);
    assert.match(text, /12 Allen Avenue/);
  });

  it("customer status messages cover every fulfillment state", () => {
    for (const status of [
      "picked_up",
      "in_progress",
      "ready_for_delivery",
      "delivered",
      "cancelled",
    ]) {
      const text = customerStatusChangedText({ ...order, status });
      assert.match(text, /Ace Laundry/i);
      assert.ok(text.length > 20);
    }
  });

  it("payment-failed operator email flags the blocked pickup", () => {
    const { subject, text } = operatorPaymentFailedText({
      id: order.id,
      final_cost: order.final_cost,
      payment_status: "failed",
      customer: { phone: order.customer.phone },
    });
    assert.match(subject, /failed/i);
    assert.match(text, /blocked until payment is confirmed/i);
  });
});

describe("provider helpers", () => {
  it("converts Nigerian local format to international", () => {
    assert.equal(toInternational("08012345678"), "2348012345678");
  });

  it("derives an 8-char short tracking code from an order id", () => {
    assert.equal(shortTrackCode(order.id), order.id.slice(0, 8).toUpperCase());
  });

  it("skips SMS when Termii is unconfigured", async () => {
    const original = env.termiiApiKey;
    env.termiiApiKey = "";
    try {
      const result = await sendSmsViaTermii({ to: "08012345678", text: "hi" });
      assert.equal(result.ok, false);
      assert.equal(result.error, "not configured");
    } finally {
      env.termiiApiKey = original;
    }
  });

  it("skips WhatsApp when the Business API is unconfigured", async () => {
    const phoneOriginal = env.whatsappPhoneNumberId;
    const tokenOriginal = env.whatsappAccessToken;
    env.whatsappPhoneNumberId = "";
    env.whatsappAccessToken = "";
    try {
      const result = await sendWhatsAppMessage({ to: "08012345678", text: "hi" });
      assert.equal(result.ok, false);
      assert.equal(result.error, "not configured");
    } finally {
      env.whatsappPhoneNumberId = phoneOriginal;
      env.whatsappAccessToken = tokenOriginal;
    }
  });

  it("skips email when SendLib is unconfigured", async () => {
    const original = env.slApiKey;
    env.slApiKey = "";
    try {
      const result = await sendEmail({ to: "op@example.com", subject: "s", text: "t" });
      assert.equal(result.ok, false);
      assert.equal(result.error, "not configured");
    } finally {
      env.slApiKey = original;
    }
  });

  it("sends a template message with ordered parameters", async () => {
    const phoneOriginal = env.whatsappPhoneNumberId;
    const tokenOriginal = env.whatsappAccessToken;
    env.whatsappPhoneNumberId = "12345";
    env.whatsappAccessToken = "tok";
    const originalFetch = globalThis.fetch;
    const calls: { url: string; body: any }[] = [];
    (globalThis as any).fetch = async (url: any, init: any) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return { ok: true } as Response;
    };
    try {
      const result = await sendWhatsAppTemplate({
        to: "08012345678",
        templateName: "laundry_update",
        language: "en",
        parameters: ["Ace Laundry", "AB12CD34"],
      });
      assert.equal(result.ok, true);
      assert.equal(calls.length, 1, "expected a fetch call");
      assert.match(calls[0].url, /graph\.facebook\.com/);
      assert.equal(calls[0].body.type, "template");
      assert.equal(calls[0].body.to, "2348012345678");
      assert.equal(calls[0].body.template.name, "laundry_update");
      assert.equal(calls[0].body.template.language.code, "en");
      assert.equal(calls[0].body.template.components[0].parameters.length, 2);
      assert.equal(calls[0].body.template.components[0].parameters[0].text, "Ace Laundry");
    } finally {
      env.whatsappPhoneNumberId = phoneOriginal;
      env.whatsappAccessToken = tokenOriginal;
      globalThis.fetch = originalFetch;
    }
  });

  it("omits the components block when a template has no parameters", async () => {
    const phoneOriginal = env.whatsappPhoneNumberId;
    const tokenOriginal = env.whatsappAccessToken;
    env.whatsappPhoneNumberId = "12345";
    env.whatsappAccessToken = "tok";
    const originalFetch = globalThis.fetch;
    const calls: { body: any }[] = [];
    (globalThis as any).fetch = async (_url: any, init: any) => {
      calls.push({ body: JSON.parse(init.body) });
      return { ok: true } as Response;
    };
    try {
      const result = await sendWhatsAppTemplate({
        to: "08012345678",
        templateName: "static_notice",
        language: "en",
      });
      assert.equal(result.ok, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].body.template.components, undefined);
    } finally {
      env.whatsappPhoneNumberId = phoneOriginal;
      env.whatsappAccessToken = tokenOriginal;
      globalThis.fetch = originalFetch;
    }
  });
});
