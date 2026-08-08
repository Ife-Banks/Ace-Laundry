import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, isValidPhone } from "../lib/phone.js";

describe("normalizePhone", () => {
  it("strips spaces and dashes", () => {
    assert.equal(normalizePhone(" 0812 345-6789 "), "08123456789");
  });
});

describe("isValidPhone", () => {
  it("accepts an 11-digit number starting with 0", () => {
    assert.equal(isValidPhone("08123456789"), true);
  });

  it("rejects numbers not starting with 0", () => {
    assert.equal(isValidPhone("9123456789"), false);
  });

  it("rejects too short", () => {
    assert.equal(isValidPhone("0812345"), false);
  });

  it("rejects too long", () => {
    assert.equal(isValidPhone("081234567890"), false);
  });

  it("rejects non-numeric input", () => {
    assert.equal(isValidPhone("0812abc6789"), false);
  });
});
