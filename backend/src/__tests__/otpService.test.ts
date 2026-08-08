import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/errors.js";
import {
  hashOtpCode,
  requestOtp,
  verifyOtp,
  OTP_RATE_MAX,
} from "../services/otpService.js";

// Minimal in-memory stand-in for the Prisma methods the OTP service touches.
function makeDb() {
  const rows: any[] = [];
  return {
    rows,
    db: {
      otpCode: {
        count: async ({ where }: any) =>
          rows.filter((r) => r.phone === where.phone).length,
        create: async ({ data }: any) => {
          const row = { ...data, created_at: new Date(), consumed: false };
          rows.push(row);
          return row;
        },
        findFirst: async ({ where }: any) =>
          rows
            .filter(
              (r) =>
                r.phone === where.phone &&
                !r.consumed &&
                r.expires_at > where.expires_at.gt
            )
            .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ??
          null,
        updateMany: async ({ where, data }: any) => {
          for (const r of rows) if (r.phone === where.phone) r.consumed = data.consumed;
        },
      },
      customer: {
        findUnique: async () => null,
      },
      notificationLog: {
        create: async () => ({}),
      },
    } as any,
  };
}

const PHONE = "08012345678";

describe("otp request", () => {
  it("creates a hashed, short-lived code and does not throw when no provider is configured", async () => {
    const { db, rows } = makeDb();
    await requestOtp(db, PHONE);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].code_hash, "");
    assert.notEqual(rows[0].code_hash, "123456");
    assert.equal(rows[0].consumed, false);
    assert.ok(rows[0].expires_at.getTime() > Date.now());
  });

  it("rate-limits requests beyond the window budget", async () => {
    const { db, rows } = makeDb();
    for (let i = 0; i < OTP_RATE_MAX; i++) {
      rows.push({
        phone: PHONE,
        code_hash: hashOtpCode("000000"),
        consumed: false,
        expires_at: new Date(Date.now() + 60_000),
        created_at: new Date(Date.now() - i * 1000),
      });
    }
    await assert.rejects(() => requestOtp(db, PHONE), (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 429);
      assert.equal((err as HttpError).code, "otp_rate_limited");
      return true;
    });
  });
});

describe("otp verify", () => {
  function seedRow(rows: any[], code: string, overrides: Partial<any> = {}) {
    rows.push({
      phone: PHONE,
      code_hash: hashOtpCode(code),
      consumed: false,
      expires_at: new Date(Date.now() + 60_000),
      created_at: new Date(),
      ...overrides,
    });
  }

  it("issues a token for the matching code and consumes it", async () => {
    const { db, rows } = makeDb();
    seedRow(rows, "123456");
    const { token } = await verifyOtp(db, PHONE, "123456");
    assert.ok(token.length > 0);
    assert.equal(rows[0].consumed, true);
  });

  it("rejects a wrong code", async () => {
    const { db, rows } = makeDb();
    seedRow(rows, "123456");
    await assert.rejects(() => verifyOtp(db, PHONE, "654321"), (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 401);
      assert.equal((err as HttpError).code, "invalid_or_expired_code");
      return true;
    });
    assert.equal(rows[0].consumed, false);
  });

  it("rejects an expired code", async () => {
    const { db, rows } = makeDb();
    seedRow(rows, "123456", { expires_at: new Date(Date.now() - 1000) });
    await assert.rejects(() => verifyOtp(db, PHONE, "123456"), (err: unknown) => {
      assert.equal((err as HttpError).code, "invalid_or_expired_code");
      return true;
    });
  });

  it("rejects when no code exists for the phone", async () => {
    const { db } = makeDb();
    await assert.rejects(() => verifyOtp(db, PHONE, "123456"), (err: unknown) => {
      assert.equal((err as HttpError).code, "invalid_or_expired_code");
      return true;
    });
  });
});
