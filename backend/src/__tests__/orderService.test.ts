import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCost, computeFinalCost } from "../services/orderService.js";

describe("computeCost", () => {
  it("multiplies item count by rate", () => {
    assert.equal(computeCost(3, 500), 1500);
  });

  it("handles a single item", () => {
    assert.equal(computeCost(1, 200), 200);
  });

  it("never produces fractional naira", () => {
    assert.equal(Number.isInteger(computeCost(7, 500)), true);
  });
});

describe("computeFinalCost", () => {
  it("adds a positive adjustment", () => {
    assert.equal(computeFinalCost(1000, 200), 1200);
  });

  it("applies a negative adjustment", () => {
    assert.equal(computeFinalCost(1000, -200), 800);
  });

  it("is unchanged with no adjustment", () => {
    assert.equal(computeFinalCost(1000, 0), 1000);
  });
});
