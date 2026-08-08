import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "./env.js";
import { HttpError } from "./errors.js";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const HEADER = "Authorization";

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function signOperatorToken(): string {
  const payload = JSON.stringify({
    role: "operator",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });
  const encoded = base64url(payload);
  const sig = crypto
    .createHmac("sha256", env.operatorSessionSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyOperatorToken(token: string): boolean {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return false;
    const expected = crypto
      .createHmac("sha256", env.operatorSessionSecret)
      .update(encoded)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as {
      role?: string;
      exp?: number;
    };
    if (payload.role !== "operator") return false;
    if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/** Extract a `Bearer <token>` value from a request's Authorization header. */
export function getBearerToken(req: Request): string | undefined {
  const header = req.headers[HEADER.toLowerCase()] ?? req.headers.authorization;
  return typeof header === "string" && header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : undefined;
}

export function requireOperator(req: Request, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token || !verifyOperatorToken(token)) {
    throw new HttpError(401, "unauthorized", "Operator login required.");
  }
  next();
}

// ---- Customer tokens (OTP-verified, docs/05 §2.6) ----
//
// A phone-scoped token that proves the caller verified that number via OTP.
// Currently used to read a phone's order history AND to cancel that phone's
// orders. Not a general auth token — it cannot be used for booking or anything
// else, and never grants access to another phone's data. Persists 7 days so a
// customer stays remembered on their device (docs/06 §5).

const HISTORY_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function signHistoryToken(phone: string): string {
  const payload = JSON.stringify({
    scope: "order_history",
    phone,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + HISTORY_TOKEN_TTL_SECONDS,
  });
  const encoded = base64url(payload);
  const sig = crypto
    .createHmac("sha256", env.operatorSessionSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

/** Returns the token's phone claim if the token is valid and unexpired, else null. */
export function verifyHistoryToken(token: string): string | null {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;
    const expected = crypto
      .createHmac("sha256", env.operatorSessionSecret)
      .update(encoded)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as {
      scope?: string;
      phone?: string;
      exp?: number;
    };
    if (payload.scope !== "order_history") return null;
    if (typeof payload.phone !== "string" || !payload.phone) return null;
    if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) return null;
    return payload.phone;
  } catch {
    return null;
  }
}

/**
 * Requires a valid history token whose phone claim matches the :phone route
 * param — a token minted for one phone can't read another's history.
 */
export function requireHistoryToken(req: Request, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  const phone = token ? verifyHistoryToken(token) : null;
  if (!phone || phone !== req.params.phone) {
    throw new HttpError(401, "unauthorized", "Valid order-history access token required.");
  }
  next();
}
