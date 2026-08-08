# Ace Laundry App — User Flow & App Flow

Diagrams below are in Mermaid syntax — render in any Mermaid-compatible viewer (GitHub, VS Code with the Mermaid extension, mermaid.live) for a visual version.

## 1. Customer flow — booking to delivery

```mermaid
flowchart TD
    A[Open app] --> B[New Order form 1.1]
    B --> C{Payment method?}
    C -->|cash| D[Submit order]
    C -->|transfer| E[Submit order]
    E --> F[Gateway payment step<br/>virtual account / link]
    F --> G{Payment result}
    G -->|success| H[Order Confirmation 1.2]
    G -->|failed/abandoned| I[Payment failed screen<br/>retry option]
    I --> F
    D --> H
    H --> J[Order Status screen 1.3]
    J --> K[Customer receives WhatsApp/SMS<br/>on each fulfillment status change]
    J --> M{Wants Order History?}
    M --> N[Enter phone number]
    N --> O[Receive OTP via SMS/WhatsApp]
    O --> P{Code valid?}
    P -->|no| N
    P -->|yes| L[Order History 1.4]
    L -->|tap order| J
    L -->|Reorder| B
```

## 2. Operator flow — order lifecycle management

```mermaid
flowchart TD
    A[New order created] --> B[Email alert to operator]
    B --> C[Operator list view]
    C --> D{Search/filter}
    D -->|by phone| E[Customer's orders]
    D -->|by status| F[Filtered list]
    D -->|by payment status| G[Filtered list]
    C --> H[Tap an order]
    H --> I{Payment method?}
    I -->|cash| J[Advance status allowed<br/>regardless of payment_status]
    I -->|transfer| K{payment_status == paid?}
    K -->|yes| J
    K -->|no| L[Advance blocked<br/>Waiting on payment confirmation]
    J --> M[Advance: booked -> picked_up -> in_progress -> ready_for_delivery -> delivered]
    M --> N[Customer notified WhatsApp/SMS<br/>on each step]
    H --> O[Cancel order<br/>booked/picked_up/in_progress only]
    O --> P[Requires note/reason<br/>confirmation dialog]
    H --> Q[cash only: toggle payment_status<br/>paid/unpaid manually]
    H --> R[Add cost adjustment<br/>requires adjustment_note]
```

## 3. Payment webhook flow (transfer orders)

```mermaid
sequenceDiagram
    participant C as Customer
    participant App as Ace Laundry Backend
    participant GW as Payment Gateway

    C->>App: Submits order (payment_method = transfer)
    App->>GW: Request virtual account / payment link for order
    GW-->>App: Account details / link
    App-->>C: Show payment details
    C->>GW: Pays via bank app
    GW->>App: Webhook: payment success/failed
    App->>App: Verify signature, match payment_reference
    App->>App: Update payment_status (paid/failed)
    App-->>C: (paid) unblock nothing further needed from customer
    Note over App: Reconciliation cron checks any<br/>pending transfer order > 30 min<br/>against gateway API directly
```

## 4. Order state machine (combined fulfillment + payment)

```mermaid
stateDiagram-v2
    [*] --> booked
    booked --> picked_up: operator advances<br/>(gated by payment for transfer)
    picked_up --> in_progress: operator advances
    in_progress --> ready_for_delivery: operator advances
    ready_for_delivery --> delivered: operator advances
    booked --> cancelled: operator cancels
    picked_up --> cancelled: operator cancels
    in_progress --> cancelled: operator cancels
    ready_for_delivery --> [*]: cancel blocked here
    delivered --> [*]
    cancelled --> [*]
```

Payment status runs alongside this as a separate field, gating only the `booked → picked_up` transition for `transfer` orders (see `01-product-plan.md` §2.3).

## 5. Notification touchpoints summary

| Trigger | Recipient | Channel | Timing |
|---|---|---|---|
| New order created | Operator | Email (v1), WhatsApp (fast-follow) | Immediate |
| Fulfillment status changes | Customer | WhatsApp if `whatsapp_ok`, else SMS | Immediate on each change |
| Transfer payment webhook: `paid` | System (badge update) | In-app only | Immediate |
| Transfer payment webhook: `failed` | Operator | Email or in-list flag | Immediate |
| Transfer order `pending` > 30 min | Operator | In-list flag | Via reconciliation cron |
| Order History access requested | Customer | SMS or WhatsApp (OTP code) | Immediate, on request |
