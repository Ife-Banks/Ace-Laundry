"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  type OrderStatus,
  type OrderWithCustomer,
  type PaymentStatus,
} from "@/lib/api";
import {
  clearOperatorToken,
  fetchOperatorOrders,
} from "@/lib/operator";
import { pickupWindowLabels } from "@/lib/orderLabels";
import OperatorShell from "@/components/operator/OperatorShell";
import { PaymentBadge, StatusBadge } from "@/components/operator/Badges";
import { useAsyncEffect } from "@/lib/useAsyncEffect";

const STATUSES: (OrderStatus | "")[] = [
  "",
  "booked",
  "picked_up",
  "in_progress",
  "ready_for_delivery",
  "delivered",
  "cancelled",
];
const PAYMENTS: (PaymentStatus | "")[] = ["", "pending", "paid", "unpaid", "failed"];

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export default function OperatorOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [phone, setPhone] = useState("");
  const [sort, setSort] = useState<"pickup" | "created">("pickup");

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [phoneInput, setPhoneInput] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await fetchOperatorOrders({
        status,
        payment_status: paymentStatus,
        phone: phone.trim() || undefined,
        sort,
      });
      setLoadError(null);
      setOrders(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearOperatorToken();
        router.replace("/operator/login");
        return;
      }
      setLoadError(err instanceof ApiError ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [status, paymentStatus, phone, sort, router]);

  useAsyncEffect(() => load(), [load]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPhone(phoneInput), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [phoneInput]);

  return (
    <OperatorShell>
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <input
            type="tel"
            inputMode="numeric"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Search by phone number…"
            className="w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-muted">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus | "")}
                className="w-full min-h-10 rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "" ? "All statuses" : s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-muted">Payment</span>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus | "")}
                className="w-full min-h-10 rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p === "" ? "Any payment" : p.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-ink-muted">Sort</span>
            {(["pickup", "created"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  sort === s ? "bg-primary text-white" : "bg-white text-ink hover:bg-line/50"
                }`}
              >
                {s === "pickup" ? "Pickup window" : "Newest"}
              </button>
            ))}
          </div>
        </div>

        {loadError ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No orders match.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/operator/orders/${order.id}`}
                  className="block rounded-xl border border-line bg-white p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={order.status} />
                        <PaymentBadge status={order.payment_status} />
                        {order.payment_overdue ? (
                          <span className="inline-flex items-center rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                            Payment overdue
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{order.customer.phone}</p>
                      <p className="text-xs text-ink-muted">
                        {order.item_count} items · {pickupWindowLabels[order.pickup_window]} pickup
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display font-bold tabular-nums">
                        {formatNaira(order.final_cost)}
                      </p>
                      <p className="text-xs tabular-nums text-ink-muted">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </OperatorShell>
  );
}
