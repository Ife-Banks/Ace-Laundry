import type { OrderStatus, PaymentStatus } from "@/lib/api";
import { fulfillmentLabels, paymentStatusLabels } from "@/lib/orderLabels";

const statusTone: Record<OrderStatus, string> = {
  booked: "bg-surface text-ink border-line",
  picked_up: "bg-[#e8f4fa] text-[#146d9c] border-[#bfe0f0]",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  ready_for_delivery: "bg-[#fef0e3] text-primary border-[#f5cba0]",
  delivered: "bg-success/10 text-success border-success/30",
  cancelled: "bg-danger/10 text-danger border-danger/30",
};

const paymentTone: Record<PaymentStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  paid: "bg-success/10 text-success border-success/30",
  unpaid: "bg-surface text-ink-muted border-line",
  failed: "bg-danger/10 text-danger border-danger/30",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone[status]}`}
    >
      {fulfillmentLabels[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${paymentTone[status]}`}
    >
      {paymentStatusLabels[status]}
    </span>
  );
}
