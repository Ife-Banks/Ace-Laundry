"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  requestOtp,
  verifyOtp,
  getVerifiedPhone,
  customerCancelOrder,
} from "@/lib/otp";

// Customer-initiated cancellation (docs/01 §1.3). Shown on the order status
// page while the order is still `booked`. Ownership is proven with the same
// phone + OTP code as order history — someone with a shared order link can't
// cancel an order that isn't theirs.
//
// Flow: tap Cancel -> verify the order's phone via OTP (skipped if this
// device already holds a valid session for that phone) -> confirm with a
// required reason -> backend cancels (booked-only).
type Step = "idle" | "verify_send" | "verify_code" | "confirm" | "working" | "done";

const inputClass =
  "w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none";

export default function CancelOrder({
  orderId,
  phone,
  paymentStatus,
}: {
  orderId: string;
  phone: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    setCode("");
    setNote("");
    setStep(getVerifiedPhone() === phone ? "confirm" : "verify_send");
  }

  async function sendCode() {
    setError(null);
    try {
      await requestOtp(phone);
      setStep("verify_code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code. Try again.");
    }
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code you received.");
      return;
    }
    setError(null);
    try {
      await verifyOtp(phone, code);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify the code. Try again.");
    }
  }

  async function confirmCancel() {
    if (note.trim().length < 3) {
      setError("Tell us a reason (at least 3 characters).");
      return;
    }
    setError(null);
    setStep("working");
    try {
      await customerCancelOrder(orderId, note.trim());
      setStep("done");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "unauthorized") {
        // Stored session expired — ask for a fresh code instead of failing.
        setError("Your session expired — please verify your number again.");
        setStep("verify_send");
      } else {
        setStep("confirm");
        setError(
          err instanceof ApiError ? err.message : "Could not cancel the order. Try again."
        );
      }
    }
  }

  if (step === "idle") {
    return (
      <button
        type="button"
        onClick={start}
        className="w-full min-h-11 rounded-lg border border-danger bg-white px-4 py-3 text-center font-bold text-danger hover:bg-danger/10"
      >
        Cancel order
      </button>
    );
  }

  if (step === "verify_send") {
    return (
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-ink-muted">
          To cancel this order, confirm it belongs to you. We&apos;ll send a code to{" "}
          <span className="font-semibold text-ink">{phone}</span>.
        </p>
        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={sendCode}
          className="w-full min-h-11 rounded-lg bg-primary font-bold text-white hover:bg-primary-dark"
        >
          Send code
        </button>
        <button
          type="button"
          onClick={() => setStep("idle")}
          className="w-full text-sm font-semibold text-primary hover:underline"
        >
          Go back
        </button>
      </section>
    );
  }

  if (step === "verify_code") {
    return (
      <form onSubmit={verifyCode} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-ink-muted">
          Enter the 6-digit code sent to <span className="font-semibold text-ink">{phone}</span>.
        </p>
        <label htmlFor="cancel-code" className="block text-sm font-semibold text-ink">
          Verification code
        </label>
        <input
          id="cancel-code"
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
          disabled={code.length !== 6}
          className="w-full min-h-11 rounded-lg bg-primary font-bold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Verify
        </button>
        <button
          type="button"
          onClick={() => setStep("verify_send")}
          className="w-full text-sm font-semibold text-primary hover:underline"
        >
          Go back
        </button>
      </form>
    );
  }

  if (step === "confirm") {
    return (
      <section className="space-y-4 rounded-xl border border-danger/40 bg-danger/5 p-4">
        <h2 className="font-display text-base font-bold text-danger">Cancel this order?</h2>
        <p className="text-sm text-ink">
          Your laundry hasn&apos;t been picked up yet, so we can cancel it. This can&apos;t be undone.
        </p>
        {paymentStatus === "paid" ? (
          <p className="text-sm text-ink-muted">
            You&apos;ve already paid — we&apos;ll arrange a refund or credit.
          </p>
        ) : null}
        <label htmlFor="cancel-note" className="block text-sm font-semibold text-ink">
          Reason (required)
        </label>
        <textarea
          id="cancel-note"
          rows={2}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError(null);
          }}
          placeholder="e.g. I booked the wrong date"
          className={inputClass}
        />
        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3">
          <button
            type="button"
            onClick={confirmCancel}
            className="min-h-11 rounded-lg border border-danger bg-white px-4 py-3 font-bold text-danger hover:bg-danger/10"
          >
            Cancel order
          </button>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="min-h-11 rounded-lg bg-secondary px-4 py-3 font-bold text-white hover:bg-secondary-dark"
          >
            Keep my order
          </button>
        </div>
      </section>
    );
  }

  if (step === "working") {
    return (
      <p role="status" className="py-2 text-center text-sm text-ink-muted">
        Cancelling your order…
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
      Your order has been cancelled. No further steps are needed from you.
    </div>
  );
}
