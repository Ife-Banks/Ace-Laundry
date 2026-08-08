import { Router } from "express";
import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { requireHistoryToken } from "../lib/auth.js";
import { phoneSchema } from "../lib/schemas.js";

export const customersRouter = Router();

// Customer-facing order history (docs/05 §2.2 + §2.6). Gated by an OTP-minted
// history token whose phone claim must equal the :phone route param — a token
// for one number can never read another's orders. The operator's phone-search
// variant lives under /operator/customers/:phone/orders instead.
customersRouter.get("/:phone/orders", requireHistoryToken, async (req, res, next) => {
  try {
    const parsed = phoneSchema.safeParse(req.params.phone);
    if (!parsed.success) {
      throw new HttpError(400, "validation_error", "Invalid phone number.");
    }
    const orders = await prisma.order.findMany({
      where: { customer: { phone: parsed.data } },
      include: {
        customer: true,
        status_logs: { orderBy: { created_at: "asc" } },
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});
