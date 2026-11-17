# Design note: monthly billing of operators (not built)

**Status: a proposal for the owner to approve. Nothing here is built, and nothing in it may be started without approval**, because Stripe Billing has its own fees and a new billed service needs the owner's go-ahead (`CLAUDE.md`, cost policy). Today the fees are only a record: `platform_fees` holds the defaults (£999 set-up, £99 a month, in pence) and each business can carry its own (`tenants`, `set_tenant_fees`). The owner confirms payment of the set-up fee by hand and approves the sign-up; nobody is billed automatically.

## What the contract already says (so the design must match it)

From `docs/legal/operator-contract.md` (version 3):

- **3.1** The set-up fee (£999) is paid in full before set-up work starts.
- **3.2** The monthly fee (£99) is paid monthly in advance from the date the Service is made available.
- **3.3** Not VAT registered, so no VAT. "We will invoice you; you pay within 14 days of the invoice date by the method on the invoice."
- **3.4** Late payment: statutory interest and compensation under the Late Payment of Commercial Debts (Interest) Act 1998, and the Service may be suspended after **7 days' written notice** until the operator pays.
- **3.5** The monthly fee may change on at least **30 days' written notice**; an operator who does not accept may end the agreement first.

No price in this note is new. Amounts are the ones already in `platform_fees`.

## Recommended shape

Use **Stripe Billing on the platform's own Stripe account** (the Winjo Digital account, not any operator's connected account, so the platform still never touches an operator's customer payments).

1. **One Stripe customer per business**, created when the owner approves the application. Store `stripe_customer_id` on `tenants`.
2. **One subscription per business** on a recurring price of £99 a month, created in **test mode first** by the owner or an owner-only action in Operator app, Settings, Platform. Start it **on the go-live date** (`billing_cycle_anchor` set to that date, `proration_behavior: none`), because clause 3.2 bills from the day the Service is made available, not from sign-up.
3. **Collection method `send_invoice`, 14 days to pay.** This is the closest match to clause 3.3 (an invoice, payable within 14 days by the method on it): Stripe emails the invoice with a hosted payment page, the operator pays it there, and nothing is charged without a person acting. Which payment methods the hosted page offers (card, and whether bank transfer is available for GBP on this account) is **not checked** and must be confirmed in Stripe before approval. `charge_automatically` (saved card or Direct Debit) is smoother for the owner and needs the operator's consent to a recurring charge, so it should be offered later as an option, not the default.
4. **The set-up fee stays a separate one-off invoice** (a Stripe invoice for £999, or the current manual process). Clause 3.1 requires payment before work starts, which is exactly today's flow, so this can stay manual until the monthly side is proven.
5. **Not VAT registered:** no tax rates on any price or invoice. If registration ever happens, this design, the contract and the sign-up page all change together.

## Data

Add to `tenants` (nothing else is needed at first): `stripe_customer_id`, `stripe_subscription_id`, `billing_status` (`none`, `active`, `past_due`, `suspended`, `cancelled`), `billing_status_changed_at`. Written only by the webhook handler and owner-only functions, never by an operator; RLS as for the other platform columns. The price shown to the operator stays read from `platform_fees` / `tenants`, so a fee change is made in one place and pushed to Stripe by an owner-only action.

## Webhook

Reuse the existing signature-checked webhook pattern (`/api/payment/stripe-webhook`, `stripe_webhook_events` for duplicates and unknown objects) with a **separate signing secret** and a separate endpoint for the platform's billing events:

- `invoice.paid` → `billing_status = active`; clear any past-due notice.
- `invoice.payment_failed`, and Stripe's overdue-invoice event (check its current event list at build time) → `past_due`; start the notice clock (below).
- `customer.subscription.updated` / `deleted` → mirror the status and the cancel date.

Handlers must be idempotent (Stripe retries and delivers out of order), the same rule the payment webhook already follows.

## Failed and late payments

For `send_invoice` there is no automatic retry of a card; Stripe can send reminder emails around the due date, configured in its dashboard (not checked here). The contract then drives the steps, and **a person decides each one**:

1. Day 0: invoice due date passes. Status becomes `past_due`; the owner sees it in Settings, Platform and is emailed.
2. After the due date, the owner may send the **written notice** clause 3.4 requires (an email from the platform owner, text to be written and checked against the sources in `docs/legal/audit-2026-11-12.md`).
3. **Suspension no sooner than 7 days after that notice.** Suspending is an owner action, not automatic: it removes the business's staff and driver sign-in and turns off its website, and it is reversed the moment the invoice is paid. Customer bookings already accepted need a stated rule (for example the website shows "temporarily unavailable"). Decision for the owner.
4. Interest and compensation under the 1998 Act are the owner's choice to claim; the design records the amounts but does not charge them automatically.

## Fee changes

Clause 3.5 needs 30 days' written notice. The owner-only action should refuse to change a live subscription's price until a notice date at least 30 days earlier has been recorded, then change the price at the next cycle with `proration_behavior: none`.

## Cost and approval

Stripe Billing is charged **on top of** normal payment processing and Stripe's pricing changes, so the current figures must be read from Stripe's own pricing page at approval time; they are not quoted here and have not been checked. At £99 a month per business the fee is a real share of revenue, so the decision should compare: the Billing fee, paying by bank transfer (if available, probably with different fees) and the plain alternative of continuing to invoice by hand. **Approval needed before any of this is built or enabled.**

## Build order, if approved

1. Owner approves cost and the collection method; creates the product and £99 price in Stripe test mode.
2. Migration for the `tenants` columns and an owner-only function to create a customer and subscription; pgTAP tests (an operator cannot read or change another business's billing data, nor its own).
3. Billing webhook endpoint with tests for duplicates, bad signatures and out-of-order events.
4. Settings, Platform: billing status per business, "Start billing on go-live" and "Change fee (30 days' notice)".
5. Run a full cycle in test mode with Stripe test clocks: invoice, paid, late, notice, suspend, pay, restore.
6. Owner approves live mode separately. Never live without that.

## Open decisions for the owner

- `send_invoice` first, or ask operators for a saved card or Direct Debit from the start?
- Grace period and exact wording of the late-payment notice (written from official UK sources, per the legal rule).
- What a suspended business's customers see.
- First month: billed on go-live day in full, or pro rata to a calendar month?
- Whether an annual option is wanted. It would be a new price, so it needs the owner's decision.
- Whether the set-up fee should also move into Stripe (it would add Stripe's fees and touch the payment webhook).
