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
import {
  getBusinessPhone,
  setBusinessPhone,
  getWhatsappTestRecipient,
  setWhatsappTestRecipient,
  getWhatsappTemplateName,
  setWhatsappTemplateName,
  getWhatsappTemplateLanguage,
  setWhatsappTemplateLanguage,
  BUSINESS_NAME,
} from "../services/settingsService.js";
import { sendWhatsAppTemplate } from "../services/notifications/providers.js";
import { normalizePhone, isValidPhone } from "../lib/phone.js";

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

operatorRouter.get("/settings", requireOperator, async (_req, res, next) => {
  try {
    res.json({
      business_phone: await getBusinessPhone(prisma),
      whatsapp_test_recipient: await getWhatsappTestRecipient(prisma),
      whatsapp_template_name: await getWhatsappTemplateName(prisma),
      whatsapp_template_language: await getWhatsappTemplateLanguage(prisma),
    });
  } catch (err) {
    next(err);
  }
});

operatorRouter.put("/settings", requireOperator, async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const businessPhone =
      typeof body.business_phone === "string" ? normalizePhone(body.business_phone) : undefined;
    if (businessPhone !== undefined && !isValidPhone(businessPhone)) {
      throw new HttpError(
        400,
        "validation_error",
        "Enter a valid 11-digit Nigerian number starting with 0."
      );
    }
    const testRecipient =
      typeof body.whatsapp_test_recipient === "string"
        ? normalizePhone(body.whatsapp_test_recipient)
        : undefined;
    if (testRecipient !== undefined && testRecipient !== "" && !isValidPhone(testRecipient)) {
      throw new HttpError(
        400,
        "validation_error",
        "Enter a valid 11-digit Nigerian test number starting with 0."
      );
    }
    const templateName =
      typeof body.whatsapp_template_name === "string" ? body.whatsapp_template_name.trim() : undefined;
    const templateLanguage =
      typeof body.whatsapp_template_language === "string"
        ? body.whatsapp_template_language.trim()
        : undefined;

    const writes: Promise<string>[] = [];
    if (businessPhone !== undefined) writes.push(setBusinessPhone(prisma, businessPhone));
    if (testRecipient !== undefined) writes.push(setWhatsappTestRecipient(prisma, testRecipient));
    if (templateName !== undefined) writes.push(setWhatsappTemplateName(prisma, templateName));
    if (templateLanguage !== undefined)
      writes.push(setWhatsappTemplateLanguage(prisma, templateLanguage));
    await Promise.all(writes);

    res.json({
      business_phone: await getBusinessPhone(prisma),
      whatsapp_test_recipient: await getWhatsappTestRecipient(prisma),
      whatsapp_template_name: await getWhatsappTemplateName(prisma),
      whatsapp_template_language: await getWhatsappTemplateLanguage(prisma),
    });
  } catch (err) {
    next(err);
  }
});

operatorRouter.post("/settings/test-whatsapp", requireOperator, async (req, res, next) => {
  try {
    const recipient = await getWhatsappTestRecipient(prisma);
    if (!recipient) {
      throw new HttpError(
        400,
        "validation_error",
        "Set a WhatsApp test recipient in Settings first."
      );
    }
    const templateName = await getWhatsappTemplateName(prisma);
    if (!templateName) {
      throw new HttpError(
        400,
        "validation_error",
        "Set a WhatsApp template name in Settings first."
      );
    }
    const language = (await getWhatsappTemplateLanguage(prisma)) || "en";
    const body = (req.body ?? {}) as { parameters?: unknown };
    const parameters = Array.isArray(body.parameters)
      ? body.parameters.filter((p): p is string => typeof p === "string")
      : [];
    const result = await sendWhatsAppTemplate({
      to: recipient,
      templateName,
      language,
      parameters: parameters.length > 0 ? parameters : [BUSINESS_NAME],
    });
    if (!result.ok) {
      throw new HttpError(502, "whatsapp_send_failed", result.error ?? "WhatsApp send failed.");
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
