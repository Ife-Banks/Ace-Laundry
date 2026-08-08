# Ace Laundry App — Product Plan (Finalized)

**Purpose:** Let a customer book a pickup, see cost upfront, and track status through to delivery. Built for a growing Nigerian laundry business expanding beyond a single campus — no assumptions about fixed addresses, card-only payment, or precise time slots.

**Design principle for every decision below:** if a feature exists only because "that's what laundry apps have," cut it. Keep only what a customer needs to book, and what the operator needs to fulfill and monitor.

Status: finalized after brainstorming round. Ready for design system + technical spec.

---

## 1. Screens

### 1.1 New order (booking form)
Single scrollable form, no multi-step wizard. The only way to create an order.

| # | Field | Type | Rules |
|---|---|---|---|
| 1 | Service type | single-select: `wash_and_fold`, `iron_only` | Required, default `wash_and_fold`. Rate shown inline per option. |
| 2 | Item count | stepper (+/-), integer | Required, min 1, default 1, no max |
| 3 | Pickup address | free text | Required, min 5 chars. No map pin, no GPS, no structured fields. |
| 4 | Pickup window | single-select: `morning`, `afternoon`, `evening` | Required, no exact time picker |
| 5 | Delivery window | single-select: `same_day`, `next_day`, `custom` | Required, default depends on service type. `custom` reveals a date picker (date only, no time). |
| 6 | Phone number | tel input | Required, 11 digits, `0XXXXXXXXXX`. Customer's unique identifier — no email field anywhere in the app. |
| 7 | WhatsApp reachable | checkbox | Optional, default checked. Determines customer notification channel. |
| 8 | Payment method | single-select: `transfer`, `cash` | Required, default `transfer`. No card payment in v1. |
| 9 | Estimated cost | read-only | `item_count × rate[service_type]`. Recalculates live on fields 1–2. |

Submit → "Confirm pickup" → creates the order → 1.2.

**If `payment_method = transfer`:** after order creation, the customer is routed into the gateway payment step (virtual account / payment link) before landing on 1.2. See `03-technical-requirements.md` §4.

**Explicitly not built:** address autocomplete/maps API, saved-address book, multi-item cart (mixed service types per order), delivery-fee-by-distance, promo codes.

### 1.2 Order confirmation
Transient screen shown immediately after submit — not a route the user revisits. Shows order summary and: *"You'll get a call or WhatsApp message to confirm pickup."* Sets the expectation a human still verifies. Button: "View order status" → 1.3.

### 1.3 Order status
One screen per order. Vertical timeline, states in order:

`booked` → `picked_up` → `in_progress` ("Washing") → `ready_for_delivery` ("Ready") → `delivered`

Plus a branch state: `cancelled` (see §2 state machine).

Each reached state shows a timestamp; unreached states greyed out. No live GPS, no rider map, no ETA countdown — status is set manually by the operator (fulfillment states), or automatically by the gateway webhook (payment state). Also shows: final cost, payment method, payment status badge, a Call/WhatsApp button pre-filled with the operator's number, and — while the order is still `booked` — a **Cancel order** button. Customer cancellation is verified with the same phone + OTP as history (§1.4) and is only allowed before pickup (see §2.1).

### 1.4 Order history
**Gated behind phone + OTP.** Booking itself (1.1) stays login-free — this is the one screen in the app that requires verification, since it exposes a customer's past addresses and costs. Flow: customer enters their phone number → receives OTP via SMS/WhatsApp → enters code → gains access to their order history for that session.

Once unlocked: customer's past orders, most recent first. Each row: date, service type, item count, final cost, fulfillment status badge. Tap → 1.3. "Reorder" pre-fills a new 1.1 form with same service type, item count, address — windows and payment left for the customer to reconfirm.

The session is remembered on the customer's device for ~7 days (no re-OTP until it expires or they switch numbers) — persistent enough to be convenient, short enough to be safe on a shared phone. This is not building toward a full account system: no password, no email, no cross-device sync.

---

## 2. Order state machine

### 2.1 Fulfillment status
```
booked → picked_up → in_progress → ready_for_delivery → delivered
```
One direction only for the "advance" action. **`cancelled` is a branch, not a step** — the operator can cancel from `booked`, `picked_up`, or `in_progress`. **Blocked once `ready_for_delivery`** (items are already processed — cancelling stops making operational sense past this point).

**Customers can also cancel, but only from `booked`** (before pickup) — the instant their laundry is picked up, cancellation moves to the operator's hands. Customer cancellation is phone-verified via the same OTP as history (1.4).

In the operator UI, "Advance status" and "Cancel order" must be visually distinct actions — never options in the same dropdown, to avoid mis-taps on a real financial/operational action.

### 2.2 Payment status
```
enum: pending, paid, unpaid, failed
```
- `cash` orders: start `pending`, operator manually flips to `paid` at delivery (or `unpaid` if it fell through). Never touched by webhook logic.
- `transfer` (gateway-routed) orders: start `pending`, flipped to `paid` or `failed` **only by the webhook handler**. Operator does not manually edit this field for transfer orders — removing the one place human error matters most.

### 2.3 The pickup gate (payment × fulfillment interaction)
This is the rule that ties the two state fields together — it lives in the backend, not just the UI, so it can't be bypassed by a client-side quirk:

- **`payment_method = cash`** → advancing `booked → picked_up` is **allowed regardless of `payment_status`**. Pay-on-delivery is the whole point of cash.
- **`payment_method = transfer`** → advancing `booked → picked_up` is **blocked until `payment_status = paid`**. If the operator tries to advance a transfer order that's still `pending` or `failed`, the API rejects it with a clear reason, and the UI surfaces "Waiting on payment confirmation" instead of an active "Advance" button.

This means for transfer orders, `payment_status` flipping to `paid` (via webhook) is what unblocks the operator's advance action — it's a gate, not just a badge.

---

## 3. Data model

**Customer**
```
id            uuid, primary key
phone         string, unique, required
whatsapp_ok   boolean, default true
created_at    timestamp
```

**Order**
```
id                 uuid, primary key
customer_id        uuid, foreign key -> Customer.id
service_type       enum('wash_and_fold', 'iron_only'), required
item_count         integer, required, >= 1
rate_applied       integer, required        -- rate at time of order; don't recompute if prices change later
cost               integer, required        -- item_count * rate_applied, stored not derived
adjustment         integer, default 0       -- can be negative; same currency unit as cost
adjustment_note    text, nullable           -- required if adjustment != 0
final_cost         integer, required        -- cost + adjustment, stored not derived
pickup_address     text, required
pickup_window      enum('morning', 'afternoon', 'evening'), required
delivery_window    enum('same_day', 'next_day', 'custom'), required
delivery_date      date, nullable           -- only if delivery_window = 'custom'
payment_method     enum('transfer', 'cash'), required
payment_status     enum('pending', 'paid', 'unpaid', 'failed'), default 'pending'
payment_reference  string, nullable         -- gateway transaction ref, for transfer orders only
status             enum('booked', 'picked_up', 'in_progress', 'ready_for_delivery', 'delivered', 'cancelled'), default 'booked'
status_updated_at  timestamp
note               text, nullable           -- cancellation reason, or any operator annotation
created_at         timestamp
```

Store all money fields as integers (kobo or whole naira — pick one, document it, never floats). `cost` stays as the clean computed value for reporting integrity; `final_cost` is what's actually charged and shown to the customer.

---

## 4. Operator side (required for v1)

- **List view** of all orders, with:
  - Filter by fulfillment status
  - Filter by payment status
  - Search by phone number (instant filter to that customer's orders — this is the "customer messaged asking where their laundry is" lookup path)
  - Sort by pickup window, then creation time
- Each row shows **two badges**: fulfillment status + payment status.
- Tapping an order lets the operator:
  - Advance fulfillment status one direction only (subject to the pickup gate in §2.3)
  - Cancel the order (from `booked`/`picked_up`/`in_progress` only), with a required note — note that customers may also cancel their own `booked` orders, see §1.3/§2.1
  - For `cash` orders only: manually set `payment_status` to `paid`/`unpaid`
  - Add/edit a cost `adjustment` with a required `adjustment_note`
- On fulfillment status change → message the customer: WhatsApp if `whatsapp_ok`, else SMS.
- On new order creation → **email alert to the operator** (v1). WhatsApp alert to the operator is a fast-follow once gateway/API onboarding is settled — not a launch blocker.
- On payment webhook resolving `paid`/`failed` → operator list updates the payment badge; no message needed to the operator beyond the badge itself refreshing (email alert here is optional, see `03-technical-requirements.md`).

Role-gated — either a second screen in the same app or a separate admin view (developer's call, see `05-backend-architecture.md`).

---

## 5. Pricing configuration

Rates are not hardcoded in the UI — stored as configuration the operator can change without a code deploy:

```
rate_config:
  wash_and_fold: 500   -- naira per item
  iron_only: 200        -- naira per item
```

A single-row settings table is sufficient for v1.

---

## 6. Explicitly out of scope for v1

Card payment (beyond what the gateway's transfer/virtual-account flow requires), map-based address input or geolocation, rider assignment or route optimization, live GPS tracking, multi-service-type single order (cart behavior), push notifications, delivery-fee-by-distance, multi-branch or multi-vendor support.

---

## 7. Build order

1. Data model + rate config
2. New order screen, writing to the Order table
3. Payment gateway integration (transfer flow + webhook handler + reconciliation cron)
4. Operator order list + status update (incl. pickup gate logic) — needed to test the flow end to end
5. Order confirmation and status screens
6. Email alert to operator on new order
7. WhatsApp/SMS status notifications to customer
8. Order history + reorder
9. WhatsApp alert to operator (fast-follow)

Steps 1–5 make a usable v1. Steps 6–9 are fast-follows, not launch blockers — except step 3, which is now load-bearing for the pickup gate and can't be deferred past launch for transfer orders.
