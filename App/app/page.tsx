import Link from "next/link";
import BookingForm, { type ReorderPrefill } from "@/components/booking/BookingForm";
import {
  Hero,
  HowItWorks,
  Services,
  Contact,
} from "@/components/home/LandingSections";
import { fetchPublicConfig, fetchRateConfig, type RateConfig } from "@/lib/api";

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;

  let rates: RateConfig | null = null;
  try {
    rates = await fetchRateConfig();
  } catch {
    // Marketing sections degrade gracefully when the API is down.
  }

  let businessPhone = "";
  try {
    businessPhone = (await fetchPublicConfig()).business_phone ?? "";
  } catch {
    // Contact buttons are optional; never block the page on them.
  }

  // Reorder prefill from /history: same service type, item count, address and
  // phone — schedule and payment are deliberately left for the customer to
  // reconfirm (docs/04 reorder flow). Invalid values are ignored silently.
  const prefill: ReorderPrefill = {};
  const value = (key: string): string | undefined => {
    const raw = searchParams[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  if (value("reorder") === "1") {
    const service = value("service_type");
    if (service === "wash_and_fold" || service === "iron_only") {
      prefill.service_type = service;
    }
    const items = Number(value("item_count"));
    if (Number.isInteger(items) && items >= 1) prefill.item_count = items;
    const address = value("pickup_address");
    if (typeof address === "string" && address.trim().length >= 5) {
      prefill.pickup_address = address;
    }
    const phone = value("phone");
    if (typeof phone === "string" && /^0\d{10}$/.test(phone)) {
      prefill.phone = phone;
    }
    const whatsapp = value("whatsapp_ok");
    if (whatsapp === "true" || whatsapp === "false") {
      prefill.whatsapp_ok = whatsapp === "true";
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg">
      <Hero rates={rates} businessPhone={businessPhone} />
      <HowItWorks />
      <Services rates={rates} />

      <section id="book" className="px-4 py-10">
        <h2 className="font-display text-xl font-semibold">Book a pickup</h2>
        <p className="mb-2 mt-1 text-sm text-ink-muted">
          See the exact cost before you confirm. We pick up, wash, and return your laundry.
        </p>
        <Link
          href="/history"
          className="mb-6 inline-block text-sm font-semibold text-primary hover:underline"
        >
          View your order history
        </Link>

        <BookingForm initialValues={prefill} />
      </section>

      <Contact businessPhone={businessPhone} />
    </main>
  );
}
