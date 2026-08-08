# Ace Laundry App — Technical & System Requirements

## 1. Platform

Mobile-first responsive web app **or** a lightweight cross-platform mobile app (React Native / Flutter) — pick whichever you're fastest in. This feature doesn't need native-only capabilities (no camera, no background GPS, no native push required for v1). Given your existing stack history (Next.js across multiple projects), a mobile-first Next.js web app is the lower-friction choice unless there's a specific reason your senior wants an installable app.

## 2. Low-bandwidth & offline tolerance

- Assume 3G-equivalent connections on the customer-facing side.
- No heavy image/map assets on the booking flow. Keep the booking-screen JS payload lean — avoid large bundles, lazy-load anything off the critical path (e.g. order history, admin views should not be in the initial bundle for the booking screen).
- **Offline resilience:** if the network drops mid-submit, the form retains entered data and retries submission rather than clearing it. Practically: hold form state in memory/local component state (not lost on a failed fetch), retry with exponential backoff, and only clear the form on confirmed success. A losing a filled-out order is a real drop-off risk here.

## 3. Identity & auth

- **Customer:** phone number as identity key. No email, no password.
  - **Booking (1.1):** no login required — phone number simply keys repeat customers server-side. Keeps friction at zero for the core action.
  - **Order history (1.4):** gated behind phone + OTP (confirmed). Customer enters phone → receives one-time code via SMS or WhatsApp → verified access to that phone number's order history for the session. This is a lightweight verification step, not a full account system — no persistent session/password, no "logged in" state carried elsewhere in the app.
  - OTP delivery reuses the same SMS/WhatsApp provider already required for status notifications (§5) — no separate OTP-specific service needed.
- **Operator:** role-gated access — a simple hardcoded operator login (or basic email/password auth) is enough at this scale. Don't over-engineer this into a full RBAC system for a single-operator (possibly small-staff) business.

## 4. Payment gateway integration (transfer flow)

Given your existing Flutterwave V3 experience (student-choice-award project), Flutterwave is the natural default — but Paystack is an equally valid choice with strong Nigerian bank-transfer support; pick based on your existing familiarity to move faster.

**Flow:**
1. Customer selects `payment_method = transfer` on the booking form.
2. On order creation, backend requests a one-time virtual account (or hosted payment link, gateway-dependent) from the gateway, scoped to that order's `final_cost`.
3. Customer is shown the account details / redirected to the payment link.
4. Customer pays via their bank app (real bank transfer, not a card).
5. Gateway fires a **webhook** to your backend on payment success/failure.
6. Webhook handler verifies the signature, matches the transaction to the `order.payment_reference`, and updates `payment_status` to `paid` or `failed`.
7. This unblocks (or leaves blocked) the `booked → picked_up` transition per the pickup gate (see `01-product-plan.md` §2.3).

**Required hardening (based on your prior Flutterwave debugging experience):**
- Verify webhook signature/secret on every incoming request — never trust an unauthenticated payload to mark something `paid`.
- **Reconciliation cron:** webhooks can be delayed or dropped. Run a periodic job (e.g. every 5–10 min) that checks any `transfer` order still `pending` past a reasonable window against the gateway's transaction-status API directly, as a fallback — same pattern you already built for the student-choice-award app.
- Handle the "customer paid but webhook never arrives" case explicitly — don't leave an order permanently stuck at `pending` with no operator visibility. Surface a "payment verification overdue" flag in the operator list for anything `pending` past, say, 30 minutes.
- If using a hosted payment page (vs. embedded), watch for iframe/COEP header conflicts — you've hit this exact class of bug before (COEP blocking Flutterwave iframes on the voting app). Test this early, not at the end.

**Cash orders:** no gateway involvement at all — fully manual `payment_status` toggle by the operator.

## 5. Notifications

### 5.1 Customer-facing (on fulfillment status change)
- WhatsApp if `whatsapp_ok = true`, else SMS.
- Provider: one with solid Nigerian carrier coverage — Termii or Africa's Talking for SMS, WhatsApp Business Cloud API for WhatsApp (see note below on official vs. unofficial). Don't assume a generic international SMS gateway delivers reliably to Nigerian numbers.

### 5.2 Operator-facing (on new order)
- **v1 (launch):** email alert only, via SendLib (`https://sendlib.samueltuoyo.com/api/send`, key in `SL_API_KEY`) — new order created → email with order summary fires immediately. SendLib uses a Gmail account connected to your SendLib account as the sender, so `from` is optional.
- **Fast-follow:** WhatsApp alert to the operator's number. Since this is you messaging *him* (not replying to a customer within a support window), the WhatsApp Business Cloud API's 24-hour session-window template restriction is less of a blocker than it would be for arbitrary customer messaging, but it still requires business verification and template pre-approval — budget a few days lead time, don't let it block launch.
- **Do not use unofficial WhatsApp automation libraries** (e.g. Baileys, whatsapp-web.js) for this. They work by automating a real WhatsApp session and violate WhatsApp's ToS — a ban risk that's unacceptable given the business's WhatsApp number is also its primary customer contact channel (per the flyer). Use the official Business API or a compliant provider wrapper (Termii, Twilio) only.

### 5.3 Payment-status-driven alerts (optional, recommended)
- On webhook resolving a transfer order to `paid` → no customer message needed (they just paid, they know), but consider a lightweight internal signal to the operator list (badge refresh is enough for v1; a push/email alert here is not required).
- On `failed` → this is worth surfacing to the operator proactively (email or in-list flag), since a stuck `pending`/`failed` transfer order is now also a blocked pickup.

## 6. Currency handling

Integers only for all money fields (`cost`, `adjustment`, `final_cost`, gateway amounts) — kobo or whole naira, pick one unit and document it in code comments and the schema. Never floats, anywhere money touches storage, computation, or API payloads to/from the gateway.

## 7. Backend & API

- Simple REST (or lightweight GraphQL) API is sufficient — no need for real-time infrastructure (websockets, live subscriptions). Fulfillment status updates are operator-triggered; payment status updates are webhook-triggered. Neither needs a live push channel to the customer beyond the notification system in §5.
- See `05-backend-architecture.md` for endpoint structure, webhook handler design, and the pickup-gate enforcement point.

## 8. Database

Any relational database — Postgres, MySQL, or SQLite for early scale. The schema (`01-product-plan.md` §3) is small and relational by nature (Customer ↔ Order, enums, integer money fields) — no NoSQL justification here.

## 9. Hosting

Budget-conscious hosting (Render, Railway, a basic VPS) is entirely sufficient at this order volume. Note from your own project history: if you land on Render, watch for the memory/constrained-hosting issues you've hit before on other projects (AIMHER) — this app's load is far lighter, but keep an eye on cold-start latency for the webhook endpoint specifically, since a slow cold start on a webhook receiver risks the gateway's retry/timeout window.

## 10. Admin/operator access

Role-based gate so the order-management view isn't publicly reachable — even a simple hardcoded operator login is sufficient at this scale; don't over-build auth infrastructure for a one-or-few-person operator team.
