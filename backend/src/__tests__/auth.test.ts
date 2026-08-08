import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signOperatorToken, verifyOperatorToken } from "../lib/auth.js";

describe("operator auth", () => {
  it("signs a token that verifies", () => {
    const token = signOperatorToken();
    assert.equal(verifyOperatorToken(token), true);
  });

  it("rejects a token whose signature was tampered with", () => {
    const token = signOperatorToken();
    const [payload] = token.split(".");
    assert.equal(verifyOperatorToken(`${payload}.not-the-signature`), false);
  });

  it("rejects an empty token", () => {
    assert.equal(verifyOperatorToken(""), false);
  });

  it("rejects garbage", () => {
    assert.equal(verifyOperatorToken("hello.world.more"), false);
  });
});
