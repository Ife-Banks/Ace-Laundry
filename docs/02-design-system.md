# Ace Laundry App — Design System

Derived from the existing Ace Laundry brand (logo + flyer: orange/blue on white, "Your ease is our goal"). Approximate hex values below — get exact brand hex/logo files from your senior if precision matters for print/brand consistency, but these are close matches suitable for a v1 build.

## 1. Color palette

| Token | Hex (approx.) | Use |
|---|---|---|
| `--color-primary` (Ace Orange) | `#F1791E` | Primary actions, brand accents, active states |
| `--color-primary-dark` | `#D0640F` | Hover/pressed states on primary |
| `--color-secondary` (Ace Blue) | `#1E8FC9` | Secondary actions, links, WhatsApp/call icons |
| `--color-secondary-dark` | `#146D9C` | Hover/pressed on secondary |
| `--color-bg` | `#FFFFFF` | Base background |
| `--color-surface` | `#F7F7F7` | Cards, form containers |
| `--color-text-primary` | `#1A1A1A` | Body text |
| `--color-text-secondary` | `#6B6B6B` | Helper text, timestamps, placeholders |
| `--color-border` | `#E2E2E2` | Dividers, input borders |
| `--color-success` | `#2E9E4C` | `paid`, `delivered` |
| `--color-warning` | `#E0A500` | `pending` |
| `--color-danger` | `#D9483F` | `failed`, `unpaid`, `cancelled` |
| `--color-info` | `#1E8FC9` | `booked`, `picked_up`, `in_progress`, `ready_for_delivery` (reuse secondary blue) |

Status badges should use a consistent 10% tint of the state color as background with the full color as text/border — keeps the two-badge row (fulfillment + payment) legible without visual noise.

## 2. Typography

- **Headings:** a bold, slightly rounded sans-serif (the flyer's "Hiring!" treatment suggests something like Poppins or Nunito Sans at Bold/ExtraBold weight) — use for screen titles, "Confirm pickup," order totals.
- **Body:** a neutral, highly legible sans-serif (Inter, or system font stack) for form labels, list rows, timeline text — legibility on low-end Android screens over 3G matters more than personality here.
- **Scale (mobile-first):**
  - H1 (screen title): 24px / bold
  - H2 (section header): 18px / semibold
  - Body: 15px / regular
  - Small (timestamps, helper text): 13px / regular
  - Cost/total display: 20px / bold (should visually stand out — it's the number both parties care about most)

## 3. Spacing & layout

- 8px base spacing unit (8/16/24/32).
- Single-column, mobile-first layout throughout — no split-pane or sidebar on the customer-facing side.
- Form fields: full-width, generous tap targets (min 44px height) — expect real use on cheap Android devices with imprecise touch input.
- Bottom-anchored primary action button on the booking form ("Confirm pickup") — stays reachable with one thumb on tall screens.

## 4. Core components

### Buttons
- **Primary** (orange fill, white text): main actions — "Confirm pickup," "Advance status," "Pay now."
- **Secondary** (blue outline or blue fill, contextual): "Call," "WhatsApp," "View order status."
- **Destructive** (red outline, red text, not filled — deliberately less visually loud than primary): "Cancel order." Should require a confirmation step (see below) — this is a real operational/financial action, not a dismiss action.

### Status badge
Rounded-pill, colored per §1 status mapping, always paired: one fulfillment badge + one payment badge shown together wherever an order is listed (operator list, order history, order status screen).

### Timeline (order status screen)
Vertical stepper, 5 fulfillment states. Reached states: filled circle + primary/success color + timestamp. Current state: filled circle, pulsing or highlighted. Unreached states: greyed-out outline circle, no timestamp. If `cancelled`: replace the stepper with a single clear banner state ("Order cancelled — [reason]") rather than trying to show it as a stopped-mid-timeline state, since it's a branch not a step.

### Form inputs
- Text/tel inputs: bordered, label above (not placeholder-only — placeholder-as-label disappears on focus and hurts low-literacy or first-time users).
- Stepper (item count): large +/- tap targets either side of the number, not a raw number input — reduces mis-taps and matches how the field is actually used.
- Single-select (service type, windows, payment method): segmented control or radio list, not a dropdown — fewer taps, and every option stays visible so nothing gets missed on the "pickup window" or "payment method" choice, which materially affects cost/flow.

### Cost display
Live-updating, always visible (sticky within the form or clearly separated at the bottom) — the plan's principle of "customer sees cost upfront" should be reflected visually, not buried at the end of a long form.

### Confirmation dialogs
Required before: cancelling an order, applying a cost adjustment, marking a cash order `paid`/`unpaid`. Simple modal, one clear action + one clear cancel, no more than one line of explanatory text.

## 5. Operator-view specific notes

Your senior is the primary user of this view and may not be deeply technical — per the flyer's "willingness to learn" hiring language, assume the operator screen may eventually be used by staff, not just your senior. Design implications:

- Two-badge rows (§1) over raw enum text.
- "Advance status" as a single obvious button showing the *next* state only (e.g. "Mark as Picked Up"), not a dropdown of all five states — reduces the chance of skipping a state by accident.
- Cancel and adjustment actions visually separated (§4) from the advance action, each behind their own confirmation step.
- Search-by-phone as a prominent, always-visible field at the top of the list — not buried behind a filter icon — since it's the fastest path when a customer messages asking about their order.

## 6. Iconography

Simple, filled (not outline-only) icons for clarity at small sizes on low-end screens: phone, WhatsApp, checkmark (paid/delivered), clock (pending), X (failed/cancelled), washing machine or basket motif reused from the existing logo mark for empty states / branding touches.
