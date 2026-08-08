import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyWebhookSignature,
  isSuccessfulGatewayStatus,
} from "../services/flutterwave.js";

const SECRET = "my-secret-hash";

function hmacSignature(body: Buffer, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = Buffer.from(JSON.stringify({ event: "charge.completed", data: {} }));

  it("accepts the legacy verif-hash header", () => {
    assert.equal(
      verifyWebhookSignature(body, { "verif-hash": SECRET }, SECRET),
      true
    );
  });

  it("rejects a mismatched verif-hash", () => {
    assert.equal(
      verifyWebhookSignature(body, { "verif-hash": "wrong" }, SECRET),
      false
    );
  });

  it("accepts the flutterwave-signature HMAC header", () => {
    assert.equal(
      verifyWebhookSignature(body, { "flutterwave-signature": hmacSignature(body, SECRET) }, SECRET),
      true
    );
  });

  it("rejects a tampered HMAC (body changed after signing)", () => {
    const signed = Buffer.from(JSON.stringify({ event: "charge.completed", data: { id: 1 } }));
    const signature = hmacSignature(signed, SECRET);
    const tampered = Buffer.from(JSON.stringify({ event: "charge.completed", data: { id: 2 } }));
    assert.equal(
      verifyWebhookSignature(tampered, { "flutterwave-signature": signature }, SECRET),
      false
    );
  });

  it("accepts everything in dev mode when no hash is configured", () => {
    assert.equal(verifyWebhookSignature(body, {}, ""), true);
  });
});

describe("isSuccessfulGatewayStatus", () => {
  it("accepts both v3 status spellings", () => {
    assert.equal(isSuccessfulGatewayStatus("successful"), true);
    assert.equal(isSuccessfulGatewayStatus("succeeded"), true);
  });

  it("rejects non-success statuses", () => {
    assert.equal(isSuccessfulGatewayStatus("failed"), false);
    assert.equal(isSuccessfulGatewayStatus("pending"), false);
    assert.equal(isSuccessfulGatewayStatus(undefined), false);
  });
});
