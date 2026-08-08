import Link from "next/link";
import { fetchOrder, fetchPublicConfig, type Order } from "@/lib/api";
import {
  serviceLabels,
  paymentMethodLabels,
} from "@/lib/orderLabels";
import StatusTimeline from "@/components/order/StatusTimeline";
import CancelOrder from "@/components/order/CancelOrder";

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

// "08123456789" -> "https://wa.me/2348123456789"
const toWhatsAppLink = (phone: string) => `https://wa.me/234${phone.replace(/^0/, "")}`;

function ContactButtons({ phone }: { phone: string }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-3 font-display text-base font-semibold">Questions?</h2>
      <div className="grid grid-cols-2 gap-3">
        <a
          href={`tel:${phone}`}
          className="block rounded-lg bg-primary px-4 py-3 text-center font-bold text-white hover:bg-primary-dark"
        >
          Call us
        </a>
        <a
          href={toWhatsAppLink(phone)}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg bg-secondary px-4 py-3 text-center font-bold text-white hover:bg-secondary-dark"
        >
          WhatsApp
        </a>
      </div>
    </section>
  );
}

function PaymentBanner({ order }: { order: Order }) {
  if (order.status === "cancelled") {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        This order was cancelled. No further steps are needed from you.
      </div>
    );
  }

  if (order.payment_method === "transfer" && order.payment_status === "pending") {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink">
        <span className="font-semibold text-warning">Payment pending.</span>{" "}
        Your bank transfer is being confirmed — this usually takes a few minutes.
      </div>
    );
  }

  if (order.payment_method === "transfer" && order.payment_status === "failed") {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        We couldn&apos;t confirm your payment. Please reach out and we&apos;ll sort it out.
      </div>
    );
  }

  if (order.payment_status === "paid") {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <span className="font-semibold">Payment confirmed.</span>{" "}
        {order.payment_method === "transfer" ? "Thank you!" : "You're all set."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
      You&apos;ll pay on delivery.
    </div>
  );
}

export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;

  let order: Order | null = null;
  let loadError = false;
  try {
    order = await fetchOrder(id);
  } catch {
    loadError = true;
  }

  let businessPhone = "";
  try {
    businessPhone = (await fetchPublicConfig()).business_phone ?? "";
  } catch {
    // Contact button is optional — never block the status page on it.
  }

  if (loadError || !order) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="font-display text-xl font-semibold">Order not found.</p>
        <p className="mt-2 text-sm text-ink-muted">
          Double-check the link, or head back to booking.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-primary px-6 py-3 font-bold text-white hover:bg-primary-dark"
        >
          Back to booking
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 flex-col px-4 py-10">
      <header className="mb-6">
        <p className="font-display text-2xl font-bold tracking-tight">Ace Laundry</p>
        <p className="mt-3 text-sm text-ink-muted">
          Order <span className="font-semibold text-ink">#{order.id.slice(0, 8)}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-display text-xl font-bold tabular-nums">
            {formatNaira(order.final_cost)}
          </span>
          <span className="text-ink-muted">· {serviceLabels[order.service_type]}</span>
        </div>
      </header>

      <div className="space-y-4">
        <PaymentBanner order={order} />

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-4 font-display text-base font-semibold">Your laundry&apos;s journey</h2>
          <StatusTimeline
            statusLogs={order.status_logs ?? []}
            currentStatus={order.status}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Items</span>
            <span className="font-semibold">{order.item_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Pickup</span>
            <span className="max-w-[60%] text-right font-semibold">{order.pickup_address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Payment</span>
            <span className="font-semibold">{paymentMethodLabels[order.payment_method]}</span>
          </div>
        </section>

        {/^0\d{10}$/.test(businessPhone) && <ContactButtons phone={businessPhone} />}

        {order.status === "booked" && order.customer?.phone ? (
          <CancelOrder
            orderId={order.id}
            phone={order.customer.phone}
            paymentStatus={order.payment_status}
          />
        ) : null}

        <Link
          href="/"
          className="block rounded-lg bg-secondary py-3 text-center font-bold text-white hover:bg-secondary-dark"
        >
          Book another order
        </Link>
      </div>
    </main>
  );
}
