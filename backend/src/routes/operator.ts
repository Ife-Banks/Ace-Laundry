import { Router } from "express";
import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { requireOperator, signOperatorToken } from "../lib/auth.js";
import { env } from "../lib/env.js";
import {
  loginSchema,
  cancelOrderSchema,
  paymentStatusSchema,
  adjustmentSchema,
  phoneSchema,
} from "../lib/schemas.js";
import {
  advanceOrderStatus,
  cancelOrder,
  setOrderPaymentStatus,
  adjustOrderCost,
} from "../services/orderService.js";
import { isPaymentOverdue } from "../services/paymentService.js";

export const operatorRouter = Router();

operatorRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "validation_error", "Password is required.");
    }
    if (!env.operatorPassword) {
      throw new HttpError(500, "operator_not_configured", "Operator login is not configured.");
    }
    if (parsed.data.password !== env.operatorPassword) {
      throw new HttpError(401, "invalid_credentials", "Invalid operator password.");
    }
    res.json({ token: signOperatorToken() });
  } catch (err) {
    next(err);
  }
});

const ORDERS_TAKE_LIMIT = 100;

operatorRouter.get("/orders", requireOperator, async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const paymentStatus =
      typeof req.query.payment_status === "string" ? req.query.payment_status : undefined;
    const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : undefined;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "pickup";

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as OrderStatus;
    if (paymentStatus) where.payment_status = paymentStatus as PaymentStatus;
    if (phone) where.customer = { phone };

    const orders = await prisma.order.findMany({
      where,
      include: { customer: true },
      orderBy:
        sort === "created"
          ? { created_at: "desc" }
          : [{ pickup_window: "asc" }, { created_at: "asc" }],
      take: ORDERS_TAKE_LIMIT,
    });

    res.json({
      orders: orders.map((order) => ({ ...order, payment_overdue: isPaymentOverdue(order) })),
    });
  } catch (err) {
    next(err);
  }
});

operatorRouter.get("/orders/:id", requireOperator, async (req, res, next) => {
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
    res.json({ order: { ...order, payment_overdue: isPaymentOverdue(order) } });
  } catch (err) {
    next(err);
  }
});

operatorRouter.patch("/orders/:id/advance", requireOperator, async (req, res, next) => {
  try {
    const order = await advanceOrderStatus(prisma, req.params.id);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

operatorRouter.patch("/orders/:id/cancel", requireOperator, async (req, res, next) => {
  try {
    const parsed = cancelOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join("; ")
      );
    }
    const order = await cancelOrder(prisma, req.params.id, parsed.data.note);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

operatorRouter.patch("/orders/:id/payment-status", requireOperator, async (req, res, next) => {
  try {
    const parsed = paymentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join("; ")
      );
    }
    const order = await setOrderPaymentStatus(
      prisma,
      req.params.id,
      parsed.data.payment_status
    );
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

operatorRouter.patch("/orders/:id/adjustment", requireOperator, async (req, res, next) => {
  try {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_error",
        parsed.error.issues.map((i) => i.message).join("; ")
      );
    }
    const order = await adjustOrderCost(
      prisma,
      req.params.id,
      parsed.data.adjustment,
      parsed.data.note
    );
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

operatorRouter.get("/customers/:phone/orders", requireOperator, async (req, res, next) => {
  try {
    const phoneResult = phoneSchema.safeParse(req.params.phone);
    if (!phoneResult.success) {
      throw new HttpError(400, "validation_error", "Invalid phone number.");
    }
    const orders = await prisma.order.findMany({
      where: { customer: { phone: phoneResult.data } },
      include: { customer: true },
      orderBy: { created_at: "desc" },
      take: ORDERS_TAKE_LIMIT,
    });
    res.json({
      orders: orders.map((order) => ({ ...order, payment_overdue: isPaymentOverdue(order) })),
    });
  } catch (err) {
    next(err);
  }
});
