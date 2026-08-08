"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createOrder,
  fetchRateConfig,
  type CreateOrderInput,
  type CreateOrderResult,
  type DeliveryWindow,
  type PaymentMethod,
  type PickupWindow,
  type ServiceType,
} from "@/lib/api";
import Segmented from "@/components/ui/Segmented";
import Stepper from "@/components/ui/Stepper";
import Field from "@/components/ui/Field";

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

const normalizePhone = (raw: string) => raw.replace(/[\s-]/g, "").trim();
const isValidPhone = (phone: string) => /^0\d{10}$/.test(phone);

const MAX_RETRIES = 3;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function defaultDeliveryWindowFor(service: ServiceType): DeliveryWindow {
  return service === "wash_and_fold" ? "next_day" : "same_day";
}

/**
 * Values carried over from the customer's order history when they tap
 * "Reorder" (docs/04). Only the stable details are prefilled — schedule and
 * payment are deliberately left for the customer to reconfirm.
 */
export interface ReorderPrefill {
  service_type?: ServiceType;
  item_count?: number;
  pickup_address?: string;
  phone?: string;
  whatsapp_ok?: boolean;
}

export default function BookingForm({ initialValues }: { initialValues?: ReorderPrefill }) {
  const router = useRouter();

  const [rates, setRates] = useState<{ wash_and_fold: number; iron_only: number } | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const [serviceType, setServiceType] = useState<ServiceType>(
    initialValues?.service_type ?? "wash_and_fold"
  );
  const [itemCount, setItemCount] = useState(initialValues?.item_count ?? 1);
  const [pickupAddress, setPickupAddress] = useState(initialValues?.pickup_address ?? "");
  const [pickupWindow, setPickupWindow] = useState<PickupWindow>("morning");
  const [deliveryWindow, setDeliveryWindow] = useState<DeliveryWindow>("next_day");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [whatsappOk, setWhatsappOk] = useState(initialValues?.whatsapp_ok ?? true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "retrying" | "submitting" | "done">("idle");
  const deliveryTouched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchRateConfig()
      .then((r) => {
        if (!cancelled) setRates(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRatesError(
            err instanceof ApiError ? err.message : "Could not load prices. Please refresh."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deliveryTouched.current) {
      setDeliveryWindow(defaultDeliveryWindowFor(serviceType));
    }
  }, [serviceType]);

  const rate = rates ? rates[serviceType] : null;
  const estimatedCost = rate !== null ? itemCount * rate : null;
  const today = new Date().toISOString().slice(0, 10);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!rates) next.serviceType = "Prices are still loading. Please wait a moment.";
    if (!isValidPhone(normalizePhone(phone))) {
      next.phone = "Enter a valid 11-digit phone number starting with 0.";
    }
    if (pickupAddress.trim().length < 5) {
      next.pickupAddress = "Enter a pickup address (at least 5 characters).";
    }
    if (deliveryWindow === "custom" && !deliveryDate) {
      next.deliveryDate = "Choose a delivery date.";
    }
    return next;
  }

  async function submitWithRetry(
    input: CreateOrderInput,
    attempt: number
  ): Promise<CreateOrderResult> {
    try {
      return await createOrder(input);
    } catch (err) {
      if (err instanceof ApiError && err.isNetwork && attempt < MAX_RETRIES) {
        setStatus("retrying");
        setSubmitError(
          `Connection lost. Retrying… (attempt ${attempt + 1} of ${MAX_RETRIES})`
        );
        await delay(1000 * 2 ** attempt);
        return submitWithRetry(input, attempt + 1);
      }
      throw err;
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting" || status === "retrying") return;

    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      const first = Object.values(nextErrors)[0];
      setSubmitError(first);
      return;
    }

    const payload: CreateOrderInput = {
      phone: normalizePhone(phone),
      whatsapp_ok: whatsappOk,
      service_type: serviceType,
      item_count: itemCount,
      pickup_address: pickupAddress.trim(),
      pickup_window: pickupWindow,
      delivery_window: deliveryWindow,
      delivery_date: deliveryWindow === "custom" ? deliveryDate : null,
      payment_method: paymentMethod,
    };

    setStatus("submitting");
    try {
      const result = await submitWithRetry(payload, 0);
      setStatus("done");
      if (result.payment_link) {
        // Transfer order — hand off to the payment page, then the customer
        // returns to /order/[id] where the timeline shows live progress.
        window.location.assign(result.payment_link);
      } else {
        router.push(`/confirm/${result.order.id}`);
      }
    } catch (err) {
      setStatus("idle");
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong submitting your order. Please try again."
      );
    }
  }

  const inputClass =
    "w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none";

  const busy = status === "submitting" || status === "retrying";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {ratesError ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {ratesError}
        </p>
      ) : null}

      {initialValues?.service_type ? (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          Prefilled from your last order — just pick a schedule and payment, then confirm.
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <Field label="Service type" required>
          <Segmented
            name="service type"
            disabled={!rates}
            value={serviceType}
            onChange={(v) => {
              setServiceType(v);
              if (rates) setErrors((p) => ({ ...p, serviceType: "" }));
            }}
            options={[
              {
                value: "wash_and_fold",
                label: "Wash & Fold",
                hint: rates ? `${formatNaira(rates.wash_and_fold)} per item` : "…",
              },
              {
                value: "iron_only",
                label: "Iron Only",
                hint: rates ? `${formatNaira(rates.iron_only)} per item` : "…",
              },
            ]}
          />
          {errors.serviceType ? (
            <p className="text-xs font-medium text-danger">{errors.serviceType}</p>
          ) : null}
        </Field>

        <Field label="Number of items" required htmlFor="item-count">
          <Stepper value={itemCount} min={1} onChange={setItemCount} />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <Field label="Pickup address" required htmlFor="pickup-address">
          <input
            id="pickup-address"
            type="text"
            autoComplete="street-address"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            placeholder="House no, street, area"
            className={inputClass}
          />
          {errors.pickupAddress ? (
            <p className="text-xs font-medium text-danger">{errors.pickupAddress}</p>
          ) : null}
        </Field>

        <Field label="Pickup window" required>
          <Segmented
            name="pickup window"
            value={pickupWindow}
            onChange={setPickupWindow}
            options={[
              { value: "morning", label: "Morning" },
              { value: "afternoon", label: "Afternoon" },
              { value: "evening", label: "Evening" },
            ]}
          />
        </Field>

        <Field label="Delivery window" required hint="When you want your laundry back.">
          <Segmented
            name="delivery window"
            value={deliveryWindow}
            onChange={(v) => {
              deliveryTouched.current = true;
              setDeliveryWindow(v);
              if (v !== "custom") setErrors((p) => ({ ...p, deliveryDate: "" }));
            }}
            options={[
              { value: "same_day", label: "Same day" },
              { value: "next_day", label: "Next day" },
              { value: "custom", label: "Custom date" },
            ]}
          />
        </Field>

        {deliveryWindow === "custom" ? (
          <Field label="Delivery date" required htmlFor="delivery-date">
            <input
              id="delivery-date"
              type="date"
              min={today}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className={inputClass}
            />
            {errors.deliveryDate ? (
              <p className="text-xs font-medium text-danger">{errors.deliveryDate}</p>
            ) : null}
          </Field>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <Field label="Phone number" required htmlFor="phone">
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^\d\s-]/g, ""));
              setErrors((p) => ({ ...p, phone: "" }));
            }}
            placeholder="0812 345 6789"
            className={inputClass}
          />
          {errors.phone ? (
            <p className="text-xs font-medium text-danger">{errors.phone}</p>
          ) : null}
        </Field>

        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
          <input
            type="checkbox"
            checked={whatsappOk}
            onChange={(e) => setWhatsappOk(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span className="text-sm text-ink">
            I can be reached on WhatsApp{" "}
            <span className="text-xs text-ink-muted">(updates sent there if checked)</span>
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <Field label="Payment method" required hint="Bank transfer or pay on delivery.">
          <Segmented
            name="payment method"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={[
              { value: "transfer", label: "Bank transfer" },
              { value: "cash", label: "Pay on delivery" },
            ]}
          />
        </Field>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        {status === "retrying" ? (
          <p role="status" className="mb-2 text-center text-sm text-warning">
            {submitError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-ink-muted">Estimated cost</p>
            <p className="text-xl font-bold tabular-nums">
              {estimatedCost !== null ? formatNaira(estimatedCost) : "—"}
            </p>
          </div>
          <button
            type="submit"
            disabled={busy || !rates}
            className="min-h-11 rounded-lg bg-primary px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Sending…" : "Confirm pickup"}
          </button>
        </div>
        {submitError && status === "idle" ? (
          <p role="alert" className="mt-2 text-center text-sm font-medium text-danger">
            {submitError}
          </p>
        ) : null}
      </div>
    </form>
  );
}
