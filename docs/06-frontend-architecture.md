# Ace Laundry App — Frontend Structure & Architecture

Assumes a mobile-first Next.js web app (per `03-technical-requirements.md` §1) — adjust folder conventions if you end up going React Native/Flutter instead, but the module boundaries and state ownership described here still apply.

## 1. High-level structure

```mermaid
flowchart TD
    subgraph Public["Public routes (no auth)"]
        A[/ - New Order form]
        B[/order/:id - Order Status]
        C[/pay/:orderId - Gateway payment step]
    end

    subgraph OTPGated["OTP-gated routes"]
        D[/history - OTP request/verify]
        E[/history/orders - Order History list]
    end

    subgraph OperatorGated["Operator-auth-gated routes"]
        F[/admin/login]
        G[/admin/orders - Operator list]
        H[/admin/orders/:id - Operator order detail]
        I[/admin/rates - Rate config]
    end

    A --> B
    B -.->|only if payment_method=transfer| C
    C --> B
    B -.->|customer wants history| D
    D --> E
    E --> B
    F --> G
    G --> H
    G --> I
```

## 2. Folder structure (Next.js App Router convention)

```
/app
  /(customer)
    /page.tsx                  -- New Order form (1.1)
    /order/[id]/page.tsx        -- Order Status (1.3)
    /pay/[orderId]/page.tsx     -- Gateway payment step
    /history/
      /page.tsx                -- Phone + OTP entry
      /orders/page.tsx          -- Order History list (1.4), OTP-token gated
  /(operator)
    /admin/login/page.tsx
    /admin/orders/page.tsx      -- Operator list view
    /admin/orders/[id]/page.tsx -- Operator order detail
    /admin/rates/page.tsx       -- Rate config screen
  /api                          -- if using Next.js API routes instead of a separate backend
    ...mirrors backend structure in 05-backend-architecture.md

/components
  /forms
    ServiceTypeSelect.tsx
    ItemCountStepper.tsx
    AddressInput.tsx
    WindowSelect.tsx            -- reused for pickup + delivery windows
    PhoneInput.tsx
    PaymentMethodSelect.tsx
    CostDisplay.tsx              -- live-updating, sticky
  /status
    StatusBadge.tsx              -- fulfillment + payment badges (design system §1)
    OrderTimeline.tsx            -- vertical stepper (1.3)
    CancelledBanner.tsx
  /operator
    OrderListRow.tsx             -- two-badge row (design system §5)
    AdvanceStatusButton.tsx      -- single "Mark as X" button, not a dropdown
    CancelOrderDialog.tsx
    PaymentToggleDialog.tsx      -- cash-only manual toggle
    AdjustmentDialog.tsx
    PhoneSearchBar.tsx
    StatusFilter.tsx
    PaymentFilter.tsx
  /shared
    Button.tsx                   -- primary/secondary/destructive variants
    ConfirmDialog.tsx
    OTPInput.tsx

/lib
  api.ts                         -- typed fetch wrapper for backend calls
  validation.ts                  -- shared form validation (phone format, min address length, etc.)
  currency.ts                    -- integer-naira formatting helpers, single source of truth so no float ever leaks into display logic
  otpToken.ts                    -- reads/writes the 7-day phone-scoped history token in localStorage (see §5)

/hooks
  useOrderCost.ts                 -- live cost calc (item_count × rate + adjustment), shared between booking form and operator adjustment dialog
  useOrderPolling.ts               -- optional: light polling on the status screen so a customer sees status updates without a manual refresh (see §4)
  useOTPFlow.ts                    -- request/verify/expiry state machine for history access

/styles
  tokens.css                      -- design system CSS variables (colors, spacing) from 02-design-system.md
```

## 3. State management

No heavy global state library needed — the app's state is mostly per-screen, server-driven, and short-lived. Recommended approach:

- **Server state** (orders, rate config, customer history): fetch-on-load via `lib/api.ts`, using React Query / SWR (or Next's built-in server components + revalidation) rather than hand-rolled fetch + `useState` everywhere — gives you caching, retry, and loading/error states for free, which matters given the offline-resilience requirement.
- **Form state** (booking form): local component state is sufficient — this is a single form, not a multi-step wizard, so no need for a form-state library beyond something like React Hook Form for validation ergonomics if the team wants it.
- **OTP/history-access token**: 7-day, phone-scoped, in `localStorage` (see §5 for the deliberate tradeoff). It covers history reads and pre-pickup cancellation for one phone — nothing else. The verified phone is stored alongside it so the UI knows which number the token belongs to.
- **Operator auth**: standard session/JWT cookie pattern, separate from the OTP token entirely — these are two unrelated auth mechanisms serving two unrelated user types and should never share code paths or storage keys.

## 4. Offline resilience (booking form specifically)

Per `03-technical-requirements.md` §2, the booking form must not lose entered data on a failed submit:

- Hold form state in component state until a submit is **confirmed successful** — never clear on a fetch rejection.
- Wrap the submit call in a retry-with-backoff wrapper (`lib/api.ts`) rather than a raw one-shot fetch.
- Show a clear inline state ("Couldn't reach the server — retrying…") rather than a silent failure or a generic error toast that implies the data was lost.
- Consider a `Prompt if leaving page with unsaved submit pending` guard, low priority but cheap to add.

## 5. Critical constraint: no browser storage in any Artifact-built prototypes

If you use Claude artifacts to prototype any piece of this UI before handing off to your coding agent, note that `localStorage`/`sessionStorage` aren't available there — use in-memory React state for prototypes. This doesn't apply to your real Next.js app.

**Storage decision (v1):** the customer's OTP-verified token (7-day expiry, phone-scoped, docs/05 §2.6) lives in `localStorage` so the customer stays remembered on their device and `/history` skips the OTP step. This is a deliberate tradeoff — `localStorage` is reachable by any client-side script (XSS exposure), and a 7-day bearer token is a wider window than a session cookie. It's accepted here because the token only grants order-history reads and pre-pickup cancellation for one phone number, and the alternative (re-entering an OTP on every visit) is precisely the friction the business wants gone. **Operator auth must never move into `localStorage`** — that stays a separate, server-side session.

## 6. Component reuse notes

- `WindowSelect.tsx` is shared between pickup window and delivery window fields (§1.1) — same segmented-control pattern, different option sets.
- `StatusBadge.tsx` is the single source of truth for status color-mapping (design system §1) — used in the operator list, order history rows, and the order status screen, so a color/label change only happens in one place.
- `CostDisplay.tsx` is shared between the booking form (live estimate) and the operator adjustment dialog (final cost after adjustment) — both need the same integer-naira formatting from `lib/currency.ts`.
- `ConfirmDialog.tsx` is the base for cancel/adjustment/payment-toggle confirmations (design system §4) — one component, different copy/actions passed in as props, so the "require confirmation for destructive/financial actions" rule can't accidentally be skipped on a new feature later.

## 7. Rendering strategy

- **Customer-facing pages** (booking, status, history): server-render the initial shell where possible (Next.js server components) for fast first paint on 3G, hydrate for interactivity. Keep client-side JS bundle scoped tightly to what each route needs — don't let the operator dashboard's code ship to the customer booking bundle (route-based code splitting, which Next.js App Router gives you by default as long as you don't share heavy client components across the `(customer)` and `(operator)` route groups).
- **Operator dashboard**: can be a fuller client-rendered SPA-style experience — operator is presumably on better connectivity than a customer mid-booking, and the list/filter/search interactions benefit from client-side state.

## 8. Status polling vs. manual refresh (open decision)

The plan explicitly rules out real-time infrastructure (websockets/live subscriptions) since status changes are operator-triggered, not continuous. For the customer's Order Status screen (1.3), decide between:
- **Manual refresh only** (simplest, zero extra load) — customer re-opens the page/pulls to refresh.
- **Light polling** (`useOrderPolling.ts`, e.g. every 30–60s while the tab is active) — slightly better UX, still far short of real-time infra, negligible backend cost at this order volume.

Given the "keep it lean" principle running through this whole plan, manual refresh is a reasonable v1 default — polling can be added as a fast-follow without any backend changes, since it's just a client-side interval calling the existing `GET /orders/:id` endpoint.
