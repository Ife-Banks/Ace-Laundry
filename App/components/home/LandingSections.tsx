import type { RateConfig } from "@/lib/api";

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

// "08123456789" -> "https://wa.me/2348123456789"
const toWhatsAppLink = (phone: string) => `https://wa.me/234${phone.replace(/^0/, "")}`;

const STEPS = [
  {
    title: "Book a pickup",
    body: "Tell us what to wash, where to pick it up, and when to return it.",
  },
  {
    title: "We wash & fold",
    body: "We collect your laundry, wash and fold it, and keep you posted.",
  },
  {
    title: "Back to your door",
    body: "Your laundry is delivered clean, on the day you chose.",
  },
];

export function Hero({ rates, businessPhone }: { rates: RateConfig | null; businessPhone: string }) {
  const hasPhone = /^0\d{10}$/.test(businessPhone);

  return (
    <section className="border-b border-line bg-surface">
      <div className="px-4 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Ace <span className="text-primary">Laundry</span>
        </h1>
        <p className="mt-1 text-sm font-medium text-secondary">Your ease is our goal.</p>

        <p className="mt-6 text-base leading-relaxed text-ink">
          We pick up, wash, fold, and deliver your laundry — so you never have to.
          Book in under a minute and follow your order from pickup to doorstep.
        </p>

        {rates ? (
          <p className="mt-3 text-sm text-ink-muted">
            Wash &amp; Fold <span className="font-semibold text-ink">{formatNaira(rates.wash_and_fold)}/item</span>
            {" · "}Iron Only <span className="font-semibold text-ink">{formatNaira(rates.iron_only)}/item</span>
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <a
            href="#book"
            className="block min-h-11 rounded-lg bg-primary px-6 py-3 text-center font-bold text-white shadow-sm hover:bg-primary-dark"
          >
            Book a pickup
          </a>
          {hasPhone ? (
            <a
              href={toWhatsAppLink(businessPhone)}
              target="_blank"
              rel="noreferrer"
              className="block min-h-11 rounded-lg bg-secondary px-6 py-3 text-center font-bold text-white hover:bg-secondary-dark"
            >
              Chat with us on WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="px-4 py-10">
      <h2 className="font-display text-xl font-semibold">How it works</h2>
      <div className="mt-5 space-y-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-base font-bold text-primary">
              {i + 1}
            </div>
            <div>
              <h3 className="font-semibold text-ink">{step.title}</h3>
              <p className="mt-0.5 text-sm text-ink-muted">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Services({ rates }: { rates: RateConfig | null }) {
  return (
    <section className="border-t border-line bg-surface px-4 py-10">
      <h2 className="font-display text-xl font-semibold">Our services</h2>
      <div className="mt-5 grid gap-4">
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="font-semibold text-ink">Wash &amp; Fold</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Everything washed, dried, and neatly folded. Your go-to for everyday laundry.
          </p>
          <p className="mt-3 font-display text-lg font-bold tabular-nums text-primary">
            {rates ? formatNaira(rates.wash_and_fold) : "—"}
            <span className="text-sm font-medium text-ink-muted"> per item</span>
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="font-semibold text-ink">Iron Only</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Freshly pressed and ready to wear. For shirts, trousers, and office wear.
          </p>
          <p className="mt-3 font-display text-lg font-bold tabular-nums text-primary">
            {rates ? formatNaira(rates.iron_only) : "—"}
            <span className="text-sm font-medium text-ink-muted"> per item</span>
          </p>
        </div>
      </div>
      {!rates ? (
        <p className="mt-3 text-sm text-ink-muted">
          Prices are unavailable right now — contact us and we&apos;ll confirm.
        </p>
      ) : null}
    </section>
  );
}

export function Contact({ businessPhone }: { businessPhone: string }) {
  const hasPhone = /^0\d{10}$/.test(businessPhone);
  if (!hasPhone) return null;

  return (
    <section className="border-t border-line px-4 py-10">
      <h2 className="font-display text-xl font-semibold">Questions?</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Call or message us on WhatsApp — we&apos;re happy to help with scheduling, pickup areas, or anything else.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href={`tel:${businessPhone}`}
          className="block min-h-11 rounded-lg bg-primary px-4 py-3 text-center font-bold text-white hover:bg-primary-dark"
        >
          Call us
        </a>
        <a
          href={toWhatsAppLink(businessPhone)}
          target="_blank"
          rel="noreferrer"
          className="block min-h-11 rounded-lg bg-secondary px-4 py-3 text-center font-bold text-white hover:bg-secondary-dark"
        >
          WhatsApp
        </a>
      </div>
    </section>
  );
}
