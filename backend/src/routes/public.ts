import { Router } from "express";
import { prisma } from "../lib/db.js";
import { getBusinessPhone } from "../services/settingsService.js";

export const publicRouter = Router();

// Public, unauthenticated settings the customer-facing app needs at render
// time: the business contact number for the Call/WhatsApp button on the order
// status screen (docs/01 §1.3). Editable from the operator Settings screen;
// falls back to BUSINESS_PHONE env until first saved.
publicRouter.get("/config", async (_req, res, next) => {
  try {
    res.json({ business_phone: await getBusinessPhone(prisma) });
  } catch (err) {
    next(err);
  }
});

/**
 * Resolve a short tracking code (the first 8 hex chars of an order id, see
 * shortTrackCode in notificationService) back to the order id. The Next.js app
 * serves `/s/{code}` on the frontend host and calls this to learn the target
 * before redirecting to the live order page.
 */
publicRouter.get("/track/:code", async (req, res, next) => {
  try {
    const code = req.params.code?.toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(code)) {
      res.status(404).json({ error: { code: "not_found", message: "Link not found." } });
      return;
    }
    const order = await prisma.order.findFirst({
      where: { id: { startsWith: code } },
      select: { id: true },
    });
    if (!order) {
      res.status(404).json({ error: { code: "not_found", message: "Link not found." } });
      return;
    }
    res.json({ order_id: order.id });
  } catch (err) {
    next(err);
  }
});
