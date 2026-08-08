"use client";

import type { OrderStatus, OrderStatusLog } from "@/lib/api";
import {
  fulfillmentLabels,
  fulfillmentDescriptions,
} from "@/lib/orderLabels";

export const FULFILLMENT_FLOW: Exclude<OrderStatus, "cancelled">[] = [
  "booked",
  "picked_up",
  "in_progress",
  "ready_for_delivery",
  "delivered",
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface StatusTimelineProps {
  statusLogs: OrderStatusLog[];
  currentStatus: OrderStatus;
}

export default function StatusTimeline({ statusLogs, currentStatus }: StatusTimelineProps) {
  const reachedAt = new Map<string, string>();
  for (const log of statusLogs) reachedAt.set(log.status, log.created_at);

  const reached = new Set(reachedAt.keys());
  const cancelledAt = reachedAt.get("cancelled") ?? null;
  const isCancelled = currentStatus === "cancelled";

  return (
    <ol className="space-y-0">
      {FULFILLMENT_FLOW.map((status, index) => {
        const done = reached.has(status);
        const active = !isCancelled && status === currentStatus;
        const time = reachedAt.get(status);

        return (
          <li key={status} className="relative flex gap-4 pb-8 last:pb-0">
            {index < FULFILLMENT_FLOW.length - 1 ? (
              <span
                className={`absolute left-[13px] top-7 h-full w-0.5 ${
                  done && !isCancelled ? "bg-primary" : "bg-line"
                }`}
              />
            ) : null}
            <span
              className={`relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                done && !isCancelled
                  ? "border-primary bg-primary text-white"
                  : active
                    ? "border-primary bg-white text-primary"
                    : "border-line bg-white text-ink-muted"
              }`}
            >
              {done && !isCancelled ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : active ? (
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-line" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-sm font-semibold ${
                    done && !isCancelled ? "text-ink" : active ? "text-primary" : "text-ink-muted"
                  }`}
                >
                  {fulfillmentLabels[status]}
                </p>
                {time && !isCancelled ? (
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                    {formatTime(time)}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-ink-muted">{fulfillmentDescriptions[status]}</p>
            </div>
          </li>
        );
      })}

      {isCancelled ? (
        <li className="relative flex gap-4">
          <span className="relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-danger bg-danger text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-danger">Cancelled</p>
              {cancelledAt ? (
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                  {formatTime(cancelledAt)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-ink-muted">This order was cancelled.</p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}
