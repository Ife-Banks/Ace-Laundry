import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOrderSchema } from "../lib/schemas.js";

const validInput = {
  phone: "08123456789",
  service_type: "wash_and_fold",
  item_count: 2,
  pickup_address: "12 Adeola Street",
  pickup_window: "morning",
  delivery_window: "next_day",
  payment_method: "transfer",
};

function parse(input: Record<string, unknown>) {
  return createOrderSchema.safeParse(input);
}

describe("createOrderSchema", () => {
  it("accepts a valid order", () => {
    const result = parse(validInput);
    assert.equal(result.success, true);
  });

  it("defaults whatsapp_ok to true", () => {
    const result = parse(validInput);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.whatsapp_ok, true);
  });

  it("normalizes and validates phone", () => {
    const result = parse({ ...validInput, phone: " 0812-345-6789 " });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.phone, "08123456789");
  });

  it("rejects an invalid phone", () => {
    const result = parse({ ...validInput, phone: "12345" });
    assert.equal(result.success, false);
  });

  it("rejects item_count of 0", () => {
    const result = parse({ ...validInput, item_count: 0 });
    assert.equal(result.success, false);
  });

  it("rejects a short pickup address", () => {
    const result = parse({ ...validInput, pickup_address: "ab" });
    assert.equal(result.success, false);
  });

  it("requires delivery_date when delivery_window is custom", () => {
    const result = parse({ ...validInput, delivery_window: "custom" });
    assert.equal(result.success, false);
  });

  it("accepts delivery_date with custom window", () => {
    const result = parse({ ...validInput, delivery_window: "custom", delivery_date: "2026-08-10" });
    assert.equal(result.success, true);
  });

  it("rejects a malformed delivery_date", () => {
    const result = parse({ ...validInput, delivery_window: "custom", delivery_date: "10/08/2026" });
    assert.equal(result.success, false);
  });
});
