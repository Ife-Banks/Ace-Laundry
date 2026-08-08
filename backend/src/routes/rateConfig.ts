import { Router } from "express";
import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { rateConfigUpdateSchema } from "../lib/schemas.js";
import { requireOperator } from "../lib/auth.js";

export const rateConfigRouter = Router();

rateConfigRouter.get("/", async (_req, res, next) => {
  try {
    const config = await prisma.rateConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      throw new HttpError(500, "rate_config_missing", "Pricing is not configured.");
    }
    res.json({ wash_and_fold: config.wash_and_fold, iron_only: config.iron_only });
  } catch (err) {
    next(err);
  }
});

rateConfigRouter.patch("/", requireOperator, async (req, res, next) => {
  try {
    const parsed = rateConfigUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join("; ")
      );
    }
    const config = await prisma.rateConfig.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { id: 1, ...parsed.data },
    });
    res.json({ wash_and_fold: config.wash_and_fold, iron_only: config.iron_only });
  } catch (err) {
    next(err);
  }
});
