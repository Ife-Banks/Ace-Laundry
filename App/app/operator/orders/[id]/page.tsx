"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  type OrderWithCustomer,
} from "@/lib/api";
import {
  adjustOrder,
  advanceOrder,
  cancelOrder,
  clearOperatorToken,
  fetchCustomerOrders,
  fetchOperatorOrder,
  setOrderPaymentStatus,
} from "@/lib/operator";
import {
  fulfillmentLabels,
  nextFulfillment,
  paymentMethodLabels,
  pickupWindowLabels,
  deliveryWindowLabels,
} from "@/lib/orderLabels";
import OperatorShell from "@/components/operator/OperatorShell";
import { PaymentBadge, StatusBadge } from "@/components/operator/Badges";
import StatusTimeline from "@/components/order/StatusTimeline";
import { useAsyncEffect } from "@/lib/useAsyncEffect";

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

const CANCELLABLE = new Set(["booked", "picked_up", "in_progress"]);

export default function OperatorOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;

  const [order, setOrder] = useState<OrderWithCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjValue, setAdjValue] = useState("0");
  const [adjNote, setAdjNote] = useState("");

  const [history, setHistory] = useState<OrderWithCustomer[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchOperatorOrder(orderId);
      setError(null);
      setOrder(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearOperatorToken();
        router.replace("/operator/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not load the order.");
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useAsyncEffect(() => load(), [load]);

  async function run(action: string, fn: () => Promise<OrderWithCustomer>, success?: string) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const updated = await fn();
      setOrder(updated);
      setCancelOpen(false);
      setCancelNote("");
      setAdjOpen(false);
      setAdjNote("");
      setAdjValue("0");
      setHistory(null);
      setHistoryOpen(false);
      if (success) setNotice(success);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearOperatorToken();
        router.replace("/operator/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "That action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleHistory() {
    if (history) {
      setHistoryOpen((o) => !o);
      return;
    }
    if (!order) return;
    setHistoryOpen((o) => !o);
    try {
      const rows = await fetchCustomerOrders(order.customer.phone);
      setHistory(rows);
    } catch {
      setHistory(null);
    }
  }

  if (loading) {
    return (
      <OperatorShell>
        <p className="py-10 text-center text-sm text-ink-muted">Loading order…</p>
      </OperatorShell>
    );
  }

  if (!order) {
    return (
      <OperatorShell>
        <div className="space-y-4">
          {error ? (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Link href="/operator" className="text-sm font-semibold text-secondary hover:underline">
            ← Back to orders
          </Link>
        </div>
      </OperatorShell>
    );
  }

  const next = nextFulfillment[order.status];
  const cancellable = CANCELLABLE.has(order.status);
  const gateBlocked =
    order.status === "booked" &&
    order.payment_method === "transfer" &&
    order.payment_status !== "paid";
  const cashOrder = order.payment_method === "cash";
  const canEdit = order.status !== "cancelled";

  return (
    <OperatorShell>
      <div className="space-y-4">
        <Link href="/operator" className="text-sm font-semibold text-secondary hover:underline">
          ← Back to orders
        </Link>

        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Order #{order.id.slice(0, 8)}</h2>
            <p className="text-sm text-ink-muted">{order.customer.phone}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.payment_status} />
            {order.payment_overdue ? (
              <span className="inline-flex items-center rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                Payment overdue
              </span>
            ) : null}
          </div>
        </header>

        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            {notice}
          </p>
        ) : null}

        <section className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Service</span>
            <span className="font-semibold capitalize">{order.service_type.replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Items</span>
            <span className="font-semibold">{order.item_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Pickup</span>
            <span className="max-w-[55%] text-right font-semibold">{order.pickup_address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Pickup window</span>
            <span className="font-semibold">{pickupWindowLabels[order.pickup_window]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Delivery</span>
            <span className="font-semibold">
              {deliveryWindowLabels[order.delivery_window]}
              {order.delivery_date
                ? ` · ${new Date(order.delivery_date).toLocaleDateString("en-NG")}`
                : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Payment</span>
            <span className="font-semibold">{paymentMethodLabels[order.payment_method]}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2">
            <span className="text-ink-muted">Base cost</span>
            <span className="font-semibold tabular-nums">{formatNaira(order.cost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Adjustment</span>
            <span className="font-semibold tabular-nums">
              {order.adjustment === 0 ? "—" : `${order.adjustment > 0 ? "+" : ""}${formatNaira(order.adjustment)}`}
            </span>
          </div>
          <div className="flex justify-between border-t border-line pt-2">
            <span className="font-semibold text-ink">Total</span>
            <span className="font-display text-lg font-bold tabular-nums">
              {formatNaira(order.final_cost)}
            </span>
          </div>
          {order.adjustment_note ? (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-ink-muted">
              Adjustment note: {order.adjustment_note}
            </p>
          ) : null}
          {order.note ? (
            <p className="rounded-lg bg-danger/5 px-3 py-2 text-xs text-ink">
              <span className="font-semibold text-danger">Note: </span>
              {order.note}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-4 font-display text-base font-semibold">Progress</h3>
          <StatusTimeline statusLogs={order.status_logs ?? []} currentStatus={order.status} />
        </section>

        {canEdit ? (
          <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              {next ? (
                <button
                  type="button"
                  disabled={busy !== null || gateBlocked}
                  onClick={() =>
                    void run(
                      "advance",
                      () => advanceOrder(order.id),
                      `Order marked as ${fulfillmentLabels[next]}.`
                    )
                  }
                  className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "advance" ? "Updating…" : `Mark as ${fulfillmentLabels[next]}`}
                </button>
              ) : null}
              {cancellable ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setCancelOpen((o) => !o)}
                  className="min-h-11 rounded-lg border border-danger/40 bg-danger/5 px-5 font-bold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel order
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setAdjOpen((o) => !o)}
                className="min-h-11 rounded-lg border border-line bg-white px-5 font-semibold text-ink transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Adjust cost
              </button>
            </div>

            {gateBlocked ? (
              <p className="text-xs text-ink-muted">
                Pickup is locked until the transfer is confirmed as paid.
              </p>
            ) : null}

            {cashOrder ? (
              <div className="flex items-center gap-2 border-t border-line pt-3">
                <span className="text-xs font-semibold text-ink-muted">Cash payment</span>
                {(["paid", "unpaid"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy !== null || order.payment_status === value}
                    onClick={() =>
                      void run(
                        "payment",
                        () => setOrderPaymentStatus(order.id, value),
                        value === "paid" ? "Payment marked as paid." : "Payment marked as unpaid."
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      order.payment_status === value
                        ? value === "paid"
                          ? "bg-success text-white"
                          : "bg-ink-muted/20 text-ink"
                        : "bg-white text-ink hover:bg-line/50"
                    }`}
                  >
                    {value === "paid" ? "Mark paid" : "Mark unpaid"}
                  </button>
                ))}
              </div>
            ) : null}

            {cancelOpen ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("cancel", () => cancelOrder(order.id, cancelNote), "Order cancelled.");
                }}
                className="space-y-2 border-t border-line pt-3"
              >
                <label htmlFor="cancel-note" className="block text-xs font-semibold text-ink-muted">
                  Cancellation reason (required)
                </label>
                <textarea
                  id="cancel-note"
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  rows={2}
                  required
                  minLength={3}
                  placeholder="e.g. Customer changed their mind"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-danger focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="min-h-10 rounded-lg bg-danger px-4 text-sm font-bold text-white hover:bg-danger/90 disabled:opacity-60"
                  >
                    {busy === "cancel" ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelOpen(false)}
                    className="min-h-10 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink"
                  >
                    Keep order
                  </button>
                </div>
              </form>
            ) : null}

            {adjOpen ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    "adjust",
                    () => adjustOrder(order.id, Number(adjValue), adjNote || undefined),
                    "Cost adjusted."
                  );
                }}
                className="space-y-2 border-t border-line pt-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-muted">
                      Adjustment (₦, negative allowed)
                    </span>
                    <input
                      type="number"
                      value={adjValue}
                      onChange={(e) => setAdjValue(e.target.value)}
                      className="w-full min-h-10 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
                    />
                  </label>
                  <div className="flex flex-col justify-end">
                    <span className="text-xs text-ink-muted">New total</span>
                    <span className="font-display font-bold tabular-nums">
                      {formatNaira(order.cost + (Number(adjValue) || 0))}
                    </span>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-muted">Note</span>
                  <input
                    type="text"
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="e.g. Extra stain treatment"
                    className="w-full min-h-10 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy !== null || adjValue === ""}
                  className="min-h-10 rounded-lg bg-secondary px-4 text-sm font-bold text-white hover:bg-secondary-dark disabled:opacity-60"
                >
                  {busy === "adjust" ? "Saving…" : "Save adjustment"}
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl border border-line bg-surface p-4">
          <button
            type="button"
            onClick={() => void toggleHistory()}
            className="flex w-full items-center justify-between text-sm font-semibold text-ink"
          >
            <span>Order history for {order.customer.phone}</span>
            <span className="text-xs text-ink-muted">{historyOpen ? "Hide" : "Show"}</span>
          </button>
          {historyOpen ? (
            history === null ? (
              <p className="mt-3 text-xs text-ink-muted">Could not load history.</p>
            ) : history.length === 0 ? (
              <p className="mt-3 text-xs text-ink-muted">No other orders for this phone.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/operator/orders/${h.id}`}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                        h.id === order.id ? "border-primary/50 bg-[#fef0e3]" : "border-line bg-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <StatusBadge status={h.status} />
                        <span className="text-xs text-ink-muted">#{h.id.slice(0, 8)}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatNaira(h.final_cost)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      </div>
    </OperatorShell>
  );
}
