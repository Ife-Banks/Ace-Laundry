import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTxRef,
  orderIdFromTxRef,
  isPaymentOverdue,
} from "../services/paymentService.js";

const UUID = "2d4d5411-fcd8-4c52-bab3-147b15cfc5e0";

describe("payment reference", () => {
  it("builds a gateway reference from an order id", () => {
    assert.equal(buildTxRef(UUID), `ACE-${UUID}`);
  });

  it("round-trips the order id out of a reference", () => {
    assert.equal(orderIdFromTxRef(`ACE-${UUID}`), UUID);
  });

  it("returns null for foreign references", () => {
    assert.equal(orderIdFromTxRef("FLW-12345"), null);
  });
});

describe("isPaymentOverdue", () => {
  const now = Date.now();
  const base = {
    payment_method: "transfer",
    payment_status: "pending",
    status: "booked",
  };

  it("flags a transfer payment pending past the 30-minute window", () => {
    assert.equal(
      isPaymentOverdue({ ...base, created_at: new Date(now - 31 * 60 * 1000) }),
      true
    );
  });

  it("does not flag a recent pending payment", () => {
    assert.equal(
      isPaymentOverdue({ ...base, created_at: new Date(now - 5 * 60 * 1000) }),
      false
    );
  });

  it("never flags cash orders", () => {
    assert.equal(
      isPaymentOverdue({
        ...base,
        payment_method: "cash",
        created_at: new Date(now - 60 * 60 * 1000),
      }),
      false
    );
  });

  it("does not flag paid or failed transfers", () => {
    assert.equal(
      isPaymentOverdue({
        ...base,
        payment_status: "paid",
        created_at: new Date(now - 60 * 60 * 1000),
      }),
      false
    );
    assert.equal(
      isPaymentOverdue({
        ...base,
        payment_status: "failed",
        created_at: new Date(now - 60 * 60 * 1000),
      }),
      false
    );
  });

  it("does not flag cancelled orders", () => {
    assert.equal(
      isPaymentOverdue({
        ...base,
        status: "cancelled",
        created_at: new Date(now - 60 * 60 * 1000),
      }),
      false
    );
  });
});
