import { z } from "zod";
import { normalizePhone, isValidPhone } from "./phone.js";

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().refine(isValidPhone, { message: "Phone must be 11 digits starting with 0." }));

export const createOrderSchema = z
  .object({
    phone: phoneSchema,
    whatsapp_ok: z.boolean().optional().default(true),
    service_type: z.enum(["wash_and_fold", "iron_only"]),
    item_count: z.number().int().min(1),
    pickup_address: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(5, "Pickup address must be at least 5 characters.")),
    pickup_window: z.enum(["morning", "afternoon", "evening"]),
    delivery_window: z.enum(["same_day", "next_day", "custom"]),
    delivery_date: z
      .string()
      .date("delivery_date must be a valid date (YYYY-MM-DD).")
      .optional()
      .nullable(),
    payment_method: z.enum(["transfer", "cash"]),
  })
  .superRefine((data, ctx) => {
    if (data.delivery_window === "custom" && !data.delivery_date) {
      ctx.addIssue({
        code: "custom",
        message: "delivery_date is required when delivery_window is 'custom'.",
        path: ["delivery_date"],
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ---- Operator endpoints ----

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required."),
});

export const cancelOrderSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "Cancellation reason is required (at least 3 characters)."),
});

export const paymentStatusSchema = z.object({
  payment_status: z.enum(["paid", "unpaid"]),
});

export const adjustmentSchema = z.object({
  adjustment: z.number().int(),
  note: z.string().trim().optional(),
});

export const rateConfigUpdateSchema = z.object({
  wash_and_fold: z.number().int().min(1, "Wash & fold rate must be at least 1."),
  iron_only: z.number().int().min(1, "Iron-only rate must be at least 1."),
});

// ---- OTP (customer order history, docs/05 §2.6) ----

export const otpRequestSchema = z.object({
  phone: phoneSchema,
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits."),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type PaymentStatusInput = z.infer<typeof paymentStatusSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type RateConfigUpdateInput = z.infer<typeof rateConfigUpdateSchema>;
