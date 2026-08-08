import Link from "next/link";
import { fetchOrder, type Order } from "@/lib/api";
import { serviceLabels } from "@/lib/orderLabels";

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function Summary({ order }: { order: Order }) {
  return (
    <dl className="space-y-3 rounded-xl border border-line bg-surface p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-ink-muted">Service</dt>
        <dd className="font-semibold">{serviceLabels[order.service_type]}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-ink-muted">Items</dt>
        <dd className="font-semibold">{order.item_count}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-ink-muted">Pickup</dt>
        <dd className="text-right font-semibold">{order.pickup_address}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-ink-muted">Payment</dt>
        <dd className="font-semibold">
          {order.payment_method === "transfer" ? "Bank transfer" : "Pay on delivery"}
        </dd>
      </div>
      <div className="flex justify-between border-t border-line pt-3">
        <dt className="font-semibold text-ink">Total</dt>
        <dd className="text-xl font-bold tabular-nums">{formatNaira(order.final_cost)}</dd>
      </div>
    </dl>
  );
}

export default async function ConfirmPage({ params }: PageProps<"/confirm/[id]">) {
  const { id } = await params;

  let order: Order | null = null;
  let loadError = false;
  try {
    order = await fetchOrder(id);
  } catch {
    loadError = true;
  }

  if (loadError || !order) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="font-display text-xl font-semibold">Hmm, we couldn&apos;t load your order.</p>
        <p className="mt-2 text-sm text-ink-muted">
          Your order may have gone through — check your phone for a message from us.
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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-7 w-7">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Pickup confirmed</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          Your order is booked. You&apos;ll get a call or WhatsApp message to confirm
          your pickup.
        </p>
      </div>

      <div className="mt-8">
        <Summary order={order} />
      </div>

      <Link
        href="/"
        className="mt-8 rounded-lg bg-secondary py-3 text-center font-bold text-white hover:bg-secondary-dark"
      >
        Book another order
      </Link>
    </main>
  );
}
