"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, type OrderWithCustomer } from "@/lib/api";
import {
  requestOtp,
  verifyOtp,
  fetchHistoryOrders,
  clearHistoryToken,
  getVerifiedPhone,
} from "@/lib/otp";
import {
  serviceLabels,
  pickupWindowLabels,
  deliveryWindowLabels,
  paymentMethodLabels,
} from "@/lib/orderLabels";
import { StatusBadge, PaymentBadge } from "@/components/operator/Badges";

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

const normalizePhone = (raw: string) => raw.replace(/[\s-]/g, "").trim();
const isValidPhone = (phone: string) => /^0\d{10}$/.test(phone);

type Step = "phone" | "code" | "loading" | "orders";

function reorderHref(order: OrderWithCustomer): string {
  const params = new URLSearchParams({
    reorder: "1",
    service_type: order.service_type,
    item_count: String(order.item_count),
    pickup_address: order.pickup_address,
    phone: order.customer.phone,
    whatsapp_ok: order.customer.whatsapp_ok ? "true" : "false",
  });
  return `/?${params.toString()}`;
}

export default function HistoryPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Restore a remembered session (docs/06 §5): if this device holds a valid
  // OTP session for a phone, skip the entry steps and show the orders. A 401
  // (expired/cleared token) falls back to the phone step silently.
  useEffect(() => {
    const remembered = getVerifiedPhone();
    if (!remembered) return;
    let cancelled = false;
    const load = async () => {
      const list = await fetchHistoryOrders(remembered);
      if (cancelled) return;
      setPhone(remembered);
      setOrders(list);
      setStep("orders");
    };
    load().catch(() => {
      if (cancelled) return;
      clearHistoryToken();
      setStep("phone");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      setError("Enter a valid 11-digit phone number starting with 0.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestOtp(normalized);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code you received.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(normalizePhone(phone), code);
      setStep("loading");
      const list = await fetchHistoryOrders(normalizePhone(phone));
      setOrders(list);
      setStep("orders");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_or_expired_code") setStep("code");
      setError(err instanceof ApiError ? err.message : "Could not verify the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleStartOver() {
    clearHistoryToken();
    setOrders([]);
    setCode("");
    setError(null);
    setStep("phone");
  }

  const inputClass =
    "w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none";

  return (
    <main className="mx-auto w-full max-w-lg flex-1 flex-col px-4 py-10">
      <header className="mb-6">
        <p className="font-display text-2xl font-bold tracking-tight">Ace Laundry</p>
        <h1 className="mt-3 font-display text-xl font-semibold">Your order history</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Verify your phone number to see past orders and rebook.
        </p>
      </header>

      {step === "phone" ? (
        <form onSubmit={handleSendCode} noValidate className="space-y-4">
          <label htmlFor="history-phone" className="block text-sm font-semibold text-ink">
            Phone number
          </label>
          <input
            id="history-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^\d\s-]/g, ""));
              setError(null);
            }}
            placeholder="0812 345 6789"
            className={inputClass}
          />
          <p className="text-xs text-ink-muted">
            We&apos;ll text you a 6-digit code to this number.
          </p>
          {error ? (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !phone}
            className="w-full min-h-11 rounded-lg bg-primary px-6 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : null}

      {step === "code" ? (
        <form onSubmit={handleVerify} noValidate className="space-y-4">
          <p className="text-sm text-ink-muted">
            Enter the 6-digit code sent to{" "}
            <span className="font-semibold text-ink">{normalizePhone(phone)}</span>.
          </p>
          <label htmlFor="history-code" className="block text-sm font-semibold text-ink">
            Verification code
          </label>
          <input
            id="history-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            placeholder="000000"
            className={`${inputClass} text-center text-2xl font-bold tracking-[0.5em]`}
          />
          {error ? (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full min-h-11 rounded-lg bg-primary px-6 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Checking…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="w-full min-h-11 rounded-lg bg-secondary py-3 text-center font-bold text-white hover:bg-secondary-dark"
          >
            Change number
          </button>
        </form>
      ) : null}

      {step === "loading" ? (
        <p role="status" className="py-8 text-center text-sm text-ink-muted">
          Loading your orders…
        </p>
      ) : null}

      {step === "orders" ? (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <p className="font-semibold">No orders yet</p>
              <p className="mt-1 text-sm text-ink-muted">
                When you book a pickup, it&apos;ll show up here.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 font-bold text-white hover:bg-primary-dark"
              >
                Book a pickup
              </Link>
            </div>
          ) : (
            orders.map((order) => (
              <section
                key={order.id}
                className="space-y-3 rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-semibold">
                    {serviceLabels[order.service_type]}
                  </h2>
                  <span className="ml-auto text-xs text-ink-muted">
                    {formatDate(order.created_at)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentBadge status={order.payment_status} />
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Items</dt>
                    <dd className="font-semibold">{order.item_count}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Total</dt>
                    <dd className="font-semibold tabular-nums">{formatNaira(order.final_cost)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Pickup</dt>
                    <dd className="max-w-[60%] text-right font-semibold">{order.pickup_address}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Schedule</dt>
                    <dd className="font-semibold">
                      {pickupWindowLabels[order.pickup_window]} ·{" "}
                      {deliveryWindowLabels[order.delivery_window]}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Payment</dt>
                    <dd className="font-semibold">{paymentMethodLabels[order.payment_method]}</dd>
                  </div>
                </dl>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={`/order/${order.id}`}
                    className="block rounded-lg bg-secondary py-3 text-center font-bold text-white hover:bg-secondary-dark"
                  >
                    Track order
                  </Link>
                  <Link
                    href={reorderHref(order)}
                    className="block rounded-lg bg-primary py-3 text-center font-bold text-white hover:bg-primary-dark"
                  >
                    Reorder this
                  </Link>
                </div>
              </section>
            ))
          )}
          <button
            type="button"
            onClick={handleStartOver}
            className="w-full min-h-11 rounded-lg bg-secondary py-3 text-center font-bold text-white hover:bg-secondary-dark"
          >
            Use a different number
          </button>
        </div>
      ) : null}
    </main>
  );
}
