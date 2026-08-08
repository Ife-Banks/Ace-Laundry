import { Router } from "express";
import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { createOrderSchema, cancelOrderSchema } from "../lib/schemas.js";
import { createOrder, customerCancelOrder } from "../services/orderService.js";
import { requestPayment } from "../services/paymentService.js";
import { getBearerToken, verifyHistoryToken } from "../lib/auth.js";

export const ordersRouter = Router();

ordersRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join("; ")
      );
    }

    const order = await createOrder(prisma, parsed.data);

    let payment_link: string | null = null;
    if (order.payment_method === "transfer") {
      try {
        payment_link = await requestPayment(prisma, order);
      } catch (err) {
        // A transfer order that can't be paid is useless — roll it back
        // (cascades to status_logs) and surface a friendly error.
        await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
        console.error("payment initiation failed:", err);
        throw new HttpError(
          502,
          "payment_initiation_failed",
          "Could not start the payment. Please try again."
        );
      }
    }

    res.status(201).json({ order, payment_link });
  } catch (err) {
    next(err);
  }
});

ordersRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const parsed = cancelOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join("; ")
      );
    }
    // The customer must prove ownership of the order's phone via OTP first.
    const token = getBearerToken(req);
    const phone = token ? verifyHistoryToken(token) : null;
    if (!phone) {
      throw new HttpError(401, "unauthorized", "Verify your phone number to cancel this order.");
    }
    const order = await customerCancelOrder(prisma, req.params.id, phone, parsed.data.note);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        status_logs: { orderBy: { created_at: "asc" } },
      },
    });
    if (!order) {
      throw new HttpError(404, "not_found", "Order not found.");
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
