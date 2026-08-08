import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  nextStatus,
  isCancellable,
  pickupGateBlockReason,
} from "../lib/orderMachine.js";

describe("order state machine", () => {
  it("walks the fulfillment flow in one direction", () => {
    assert.equal(nextStatus("booked"), "picked_up");
    assert.equal(nextStatus("picked_up"), "in_progress");
    assert.equal(nextStatus("in_progress"), "ready_for_delivery");
    assert.equal(nextStatus("ready_for_delivery"), "delivered");
  });

  it("has no next status after delivered or cancelled", () => {
    assert.equal(nextStatus("delivered"), null);
    assert.equal(nextStatus("cancelled"), null);
  });

  it("only allows cancellation before processing completes", () => {
    assert.equal(isCancellable("booked"), true);
    assert.equal(isCancellable("picked_up"), true);
    assert.equal(isCancellable("in_progress"), true);
    assert.equal(isCancellable("ready_for_delivery"), false);
    assert.equal(isCancellable("delivered"), false);
    assert.equal(isCancellable("cancelled"), false);
  });
});

describe("pickup gate", () => {
  it("blocks transfer orders that have not paid", () => {
    const reason = pickupGateBlockReason({
      status: "booked",
      payment_method: "transfer",
      payment_status: "pending",
    });
    assert.equal(reason, "payment_pending");
  });

  it("allows a paid transfer order", () => {
    assert.equal(
      pickupGateBlockReason({
        status: "booked",
        payment_method: "transfer",
        payment_status: "paid",
      }),
      null
    );
  });

  it("always allows cash orders", () => {
    assert.equal(
      pickupGateBlockReason({
        status: "booked",
        payment_method: "cash",
        payment_status: "pending",
      }),
      null
    );
  });

  it("only gates the booked -> picked_up step", () => {
    assert.equal(
      pickupGateBlockReason({
        status: "in_progress",
        payment_method: "transfer",
        payment_status: "pending",
      }),
      null
    );
  });
});
