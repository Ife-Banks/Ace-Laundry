import express from "express";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "./lib/errors.js";
import { ordersRouter } from "./routes/orders.js";
import { rateConfigRouter } from "./routes/rateConfig.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { operatorRouter } from "./routes/operator.js";
import { otpRouter } from "./routes/otp.js";
import { customersRouter } from "./routes/customers.js";
import { publicRouter } from "./routes/public.js";
import { registerNotificationHandlers } from "./services/notifications/notificationService.js";

export function createApp() {
  const app = express();

  registerNotificationHandlers();

  app.use(cors());

  // Webhooks must be mounted BEFORE the global JSON body parser so the raw
  // request body survives for HMAC signature verification.
  app.use("/webhooks", webhooksRouter);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/rate-config", rateConfigRouter);
  app.use("/public", publicRouter);
  app.use("/orders", ordersRouter);
  app.use("/operator", operatorRouter);
  app.use("/otp", otpRouter);
  app.use("/customers", customersRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "validation_error",
          message: err.issues.map((i) => i.message).join("; "),
        },
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { code: "internal", message: "Something went wrong." } });
  });

  return app;
}
