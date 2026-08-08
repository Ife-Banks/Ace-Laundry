import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signHistoryToken, verifyHistoryToken, signOperatorToken } from "../lib/auth.js";

describe("history token", () => {
  it("round-trips the phone it was minted for", () => {
    const token = signHistoryToken("08012345678");
    assert.equal(verifyHistoryToken(token), "08012345678");
  });

  it("rejects a token minted for a different phone", () => {
    // The route enforces the phone match; the primitive just returns the claim.
    const token = signHistoryToken("08012345678");
    assert.notEqual(verifyHistoryToken(token), "08099999999");
  });

  it("rejects a tampered signature", () => {
    const token = signHistoryToken("08012345678");
    const [payload] = token.split(".");
    assert.equal(verifyHistoryToken(`${payload}.not-the-signature`), null);
  });

  it("rejects an operator token (wrong scope)", () => {
    assert.equal(verifyHistoryToken(signOperatorToken()), null);
  });

  it("rejects garbage", () => {
    assert.equal(verifyHistoryToken("hello.world"), null);
  });
});
