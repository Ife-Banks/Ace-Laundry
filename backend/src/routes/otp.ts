import { Router } from "express";
import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { otpRequestSchema, otpVerifySchema } from "../lib/schemas.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";

export const otpRouter = Router();

otpRouter.post("/request", async (req, res, next) => {
  try {
    const parsed = otpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "validation_error", "A valid phone number is required.");
    }
    await requestOtp(prisma, parsed.data.phone);
    // Always generic: don't reveal whether the number has orders or exists.
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

otpRouter.post("/verify", async (req, res, next) => {
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join("; ")
      );
    }
    const { token } = await verifyOtp(prisma, parsed.data.phone, parsed.data.code);
    res.json({ token });
  } catch (err) {
    next(err);
  }
});
