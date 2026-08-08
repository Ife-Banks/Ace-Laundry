import express, { Router } from "express";
import { prisma } from "../lib/db.js";
import { handlePaymentWebhook } from "../services/paymentService.js";

export const webhooksRouter = Router();

const rawJson = express.raw({ type: "application/json" });

/**
 * Payment-gateway webhook. Registered BEFORE the global express.json() so the
 * raw request body is available for HMAC signature verification.
 *
 * Acks fast (200) and processes in the background: the gateway stops retrying
 * on a 200, and a slow gateway re-verification should never block the ack.
 */
webhooksRouter.post("/payments", rawJson, (req, res) => {
  const rawBody = req.body as Buffer;
  res.status(200).json({ received: true });
  void handlePaymentWebhook(
    prisma,
    rawBody,
    req.headers as Record<string, string | undefined>
  ).catch((err) => console.error("[webhook] processing failed:", err));
});
