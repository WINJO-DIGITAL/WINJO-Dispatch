// The operator's subscription to the platform: the one-off set-up fee and the monthly fee
// (contract clauses 3.1, 3.2 and 3.8). Paid by card through Stripe Checkout on the PLATFORM's own
// Stripe account (STRIPE_PLATFORM_SECRET_KEY, no Stripe-Account header). This is separate from a
// business's customers' payments, which go to the business's own connected account.
//
// Amounts never come from the browser: they are read from the database (the business's own rate,
// or the platform default). A payment is only recorded after it has been checked with Stripe, and
// only by the server (table tenant_billing, service role). Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Caller } from "@/lib/server/staff";

const STRIPE = "https://api.stripe.com/v1";
type Fetch = typeof fetch;
type Obj = Record<string, unknown>;

export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export const billingKey = (): string => (process.env.STRIPE_PLATFORM_SECRET_KEY ?? "").trim();
export const billingConfigured = (): boolean => /^sk_(test|live)_/.test(billingKey());
export const billingTestMode = (): boolean => billingKey().startsWith("sk_test_");

async function stripe(f: Fetch, method: "GET" | "POST", path: string, form?: Array<[string, string]>): Promise<Obj> {
  if (!billingConfigured()) throw new BillingError("Card payment of the subscription isn't set up on this platform yet.", 503);
  const res = await f(`${STRIPE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${billingKey()}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as Obj;
  if (!res.ok) throw new BillingError(String((body.error as Obj | undefined)?.message || `Stripe error ${res.status}`), res.status >= 500 ? 502 : 400);
  return body;
}

export type BillingRow = {
  tenant_id: string; status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null;
  setup_paid_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean;
  last_invoice_number: string | null; last_invoice_paid_at: string | null; last_invoice_amount_pence: number | null;
};

const iso = (unix: unknown): string | null => (typeof unix === "number" && unix > 0 ? new Date(unix * 1000).toISOString() : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : v && typeof v === "object" && typeof (v as Obj).id === "string" ? String((v as Obj).id) : null);

export async function readBilling(admin: SupabaseClient, tenantId: string): Promise<BillingRow | null> {
  const { data, error } = await admin.from("tenant_billing").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new BillingError("The subscription records aren't set up in the database yet.", 503);
  return (data as BillingRow | null) ?? null;
}

/** The fees that apply to a business: its own rate, or the platform default. In pence. */
export async function feesFor(admin: SupabaseClient, tenantId: string): Promise<{ monthlyPence: number; setupPence: number }> {
  const [{ data: t }, { data: f }] = await Promise.all([
    admin.from("tenants").select("monthly_fee_pence, setup_fee_pence").eq("id", tenantId).maybeSingle(),
    admin.from("platform_fees").select("default_monthly_pence, default_setup_pence").eq("id", true).maybeSingle(),
  ]);
  const monthlyPence = Number(t?.monthly_fee_pence ?? f?.default_monthly_pence);
  const setupPence = Number(t?.setup_fee_pence ?? f?.default_setup_pence);
  if (!Number.isInteger(monthlyPence) || !Number.isInteger(setupPence) || monthlyPence < 0 || setupPence < 0) {
    throw new BillingError("The fees for this business aren't set. Ask the platform owner.", 503);
  }
  return { monthlyPence, setupPence };
}

export async function billingState(admin: SupabaseClient, caller: Caller) {
  const [row, fees] = await Promise.all([readBilling(admin, caller.tenantId), feesFor(admin, caller.tenantId)]);
  return {
    configured: billingConfigured(),
    testMode: billingTestMode(),
    canManage: caller.isAdmin,
    businessName: caller.tenantName,
    status: row?.status ?? "none",
    monthlyPence: fees.monthlyPence,
    setupPence: fees.setupPence,
    setupPaid: !!row?.setup_paid_at,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    lastInvoice: row?.last_invoice_number || row?.last_invoice_paid_at
      ? { number: row?.last_invoice_number ?? null, paidAt: row?.last_invoice_paid_at ?? null, amountPence: row?.last_invoice_amount_pence ?? null }
      : null,
  };
}

/** Starts a Stripe Checkout for the monthly fee (and the set-up fee, if it has not been paid). Admins only. */
export async function startCheckout(admin: SupabaseClient, caller: Caller, origin: string, f: Fetch = fetch): Promise<{ url: string }> {
  if (!caller.isAdmin) throw new BillingError("Only an admin of the business can pay the subscription.", 403);
  const [row, fees] = await Promise.all([readBilling(admin, caller.tenantId), feesFor(admin, caller.tenantId)]);
  if (row?.status === "active" || row?.status === "past_due") {
    throw new BillingError(row.status === "active" ? "Your subscription is already active." : "Your subscription has a failed payment. Use Manage payment to update your card.", 409);
  }
  if (fees.monthlyPence <= 0) throw new BillingError("There is no monthly fee to pay for this business.", 409);
  const includeSetup = !row?.setup_paid_at && fees.setupPence > 0;

  const back = `${origin}/operator/settings?section=subscription`;
  const form: Array<[string, string]> = [
    ["mode", "subscription"],
    ["line_items[0][price_data][currency]", "gbp"],
    ["line_items[0][price_data][product_data][name]", "Winjo Dispatch monthly fee"],
    ["line_items[0][price_data][unit_amount]", String(fees.monthlyPence)],
    ["line_items[0][price_data][recurring][interval]", "month"],
    ["line_items[0][quantity]", "1"],
    ["client_reference_id", caller.tenantId],
    ["metadata[tenant_id]", caller.tenantId],
    ["metadata[includes_setup]", includeSetup ? "1" : "0"],
    ["subscription_data[metadata][tenant_id]", caller.tenantId],
    ["subscription_data[description]", `${caller.tenantName}: Winjo Dispatch`],
    // {CHECKOUT_SESSION_ID} is filled in by Stripe; it must not be URL-encoded.
    ["success_url", `${back}&billing=success&session_id={CHECKOUT_SESSION_ID}`],
    ["cancel_url", `${back}&billing=cancelled`],
  ];
  if (includeSetup) {
    form.push(
      ["line_items[1][price_data][currency]", "gbp"],
      ["line_items[1][price_data][product_data][name]", "Winjo Dispatch set-up fee (one-off)"],
      ["line_items[1][price_data][unit_amount]", String(fees.setupPence)],
      ["line_items[1][quantity]", "1"],
    );
  }
  if (row?.stripe_customer_id) form.push(["customer", row.stripe_customer_id]);
  else if (caller.email) form.push(["customer_email", caller.email]);

  const session = await stripe(f, "POST", "/checkout/sessions", form);
  if (typeof session.url !== "string") throw new BillingError("Stripe did not return a payment page. Try again.", 502);
  return { url: session.url };
}

export type Confirmation = { paid: boolean; confirmationNumber: string | null; amountPence: number | null; paidAt: string | null; nextPaymentOn: string | null; includedSetup: boolean };

const periodEndOf = (sub: Obj | null): string | null => {
  if (!sub) return null;
  const item = (((sub.items as Obj | undefined)?.data as Obj[] | undefined) ?? [])[0];
  return iso(sub.current_period_end) ?? iso(item?.current_period_end);
};

/** Records a paid subscription checkout (idempotent: safe from the return page and the webhook together). */
export async function applyPaidSession(admin: SupabaseClient, session: Obj): Promise<Confirmation> {
  const tenantId = String((session.metadata as Obj | undefined)?.tenant_id ?? "");
  const invoice = (session.invoice && typeof session.invoice === "object" ? session.invoice : null) as Obj | null;
  const sub = (session.subscription && typeof session.subscription === "object" ? session.subscription : null) as Obj | null;
  const includedSetup = (session.metadata as Obj | undefined)?.includes_setup === "1";
  const paidAt = iso((invoice?.status_transitions as Obj | undefined)?.paid_at) ?? iso(session.created) ?? new Date().toISOString();
  const amountPence = typeof invoice?.amount_paid === "number" ? invoice.amount_paid : typeof session.amount_total === "number" ? session.amount_total : null;
  // The invoice number is the confirmation number; without one, the end of the session id.
  const confirmationNumber = str(invoice?.number) ?? `WD-${String(session.id ?? "").slice(-10).toUpperCase()}`;
  const nextPaymentOn = periodEndOf(sub);

  const existing = await readBilling(admin, tenantId);
  const row = {
    tenant_id: tenantId,
    status: "active",
    stripe_customer_id: str(session.customer) ?? existing?.stripe_customer_id ?? null,
    stripe_subscription_id: str(session.subscription) ?? existing?.stripe_subscription_id ?? null,
    setup_paid_at: existing?.setup_paid_at ?? (includedSetup ? paidAt : null),
    current_period_end: nextPaymentOn ?? existing?.current_period_end ?? null,
    cancel_at_period_end: false,
    last_invoice_number: confirmationNumber,
    last_invoice_paid_at: paidAt,
    last_invoice_amount_pence: amountPence,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("tenant_billing").upsert(row, { onConflict: "tenant_id" });
  if (error) throw new BillingError("The payment went through, but it could not be recorded. Refresh this page in a minute.", 500);
  return { paid: true, confirmationNumber, amountPence, paidAt, nextPaymentOn, includedSetup };
}

const NOT_PAID: Confirmation = { paid: false, confirmationNumber: null, amountPence: null, paidAt: null, nextPaymentOn: null, includedSetup: false };

/** The return page: checks the checkout with Stripe and, if paid and it is this business's own, records it. */
export async function confirmCheckout(admin: SupabaseClient, caller: Caller, sessionId: string, f: Fetch = fetch): Promise<Confirmation> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new BillingError("That payment reference isn't valid.", 422);
  const session = await stripe(f, "GET", `/checkout/sessions/${sessionId}?expand[]=invoice&expand[]=subscription`);
  if ((session.metadata as Obj | undefined)?.tenant_id !== caller.tenantId || session.mode !== "subscription") {
    throw new BillingError("That payment belongs to a different business.", 403);
  }
  if (session.payment_status !== "paid") return NOT_PAID;
  return applyPaidSession(admin, session);
}

/** Stripe's own page for changing the card, seeing invoices and cancelling. Admins only. */
export async function portalLink(admin: SupabaseClient, caller: Caller, origin: string, f: Fetch = fetch): Promise<{ url: string }> {
  if (!caller.isAdmin) throw new BillingError("Only an admin of the business can manage the subscription.", 403);
  const row = await readBilling(admin, caller.tenantId);
  if (!row?.stripe_customer_id) throw new BillingError("There is no subscription to manage yet.", 409);
  const s = await stripe(f, "POST", "/billing_portal/sessions", [["customer", row.stripe_customer_id], ["return_url", `${origin}/operator/settings?section=subscription`]]);
  if (typeof s.url !== "string") throw new BillingError("Stripe did not return a page. Try again.", 502);
  return { url: s.url };
}

const STATUS_FROM_STRIPE: Record<string, string> = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", incomplete: "none", incomplete_expired: "none", canceled: "cancelled", paused: "past_due" };

async function rowFor(admin: SupabaseClient, by: { customer?: string | null; subscription?: string | null; tenantId?: string | null }): Promise<BillingRow | null> {
  for (const [col, val] of [["tenant_id", by.tenantId], ["stripe_subscription_id", by.subscription], ["stripe_customer_id", by.customer]] as const) {
    if (!val) continue;
    const { data } = await admin.from("tenant_billing").select("*").eq(col, val).maybeSingle();
    if (data) return data as BillingRow;
  }
  return null;
}

/**
 * One Stripe billing event (already signature-checked). Returns what it did, for the log.
 * Every branch sets values rather than adding to them, so a repeated or late event is harmless.
 */
export async function applyBillingEvent(admin: SupabaseClient, event: { type?: string; data?: { object?: Obj } }, f: Fetch = fetch): Promise<string> {
  const o = event.data?.object ?? {};
  const now = new Date().toISOString();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (o.mode !== "subscription" || !(o.metadata as Obj | undefined)?.tenant_id) return "ignored: not a subscription checkout";
    if (o.payment_status !== "paid") return "ignored: not paid";
    const session = await stripe(f, "GET", `/checkout/sessions/${String(o.id)}?expand[]=invoice&expand[]=subscription`);
    if (session.payment_status !== "paid") return "ignored: not paid";
    await applyPaidSession(admin, session);
    return "recorded: subscription started";
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const row = await rowFor(admin, { customer: str(o.customer), subscription: str(o.subscription) });
    if (!row) return "ignored: no business for this customer";
    const patch: Obj = event.type === "invoice.paid"
      ? {
          status: "active",
          last_invoice_number: str(o.number) ?? row.last_invoice_number,
          last_invoice_paid_at: iso((o.status_transitions as Obj | undefined)?.paid_at) ?? now,
          last_invoice_amount_pence: typeof o.amount_paid === "number" ? o.amount_paid : row.last_invoice_amount_pence,
          current_period_end: iso((((o.lines as Obj | undefined)?.data as Obj[] | undefined)?.[0]?.period as Obj | undefined)?.end) ?? row.current_period_end,
          updated_at: now,
        }
      : { status: "past_due", updated_at: now };
    await admin.from("tenant_billing").update(patch).eq("tenant_id", row.tenant_id);
    return event.type === "invoice.paid" ? "recorded: invoice paid" : "recorded: payment failed";
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const row = await rowFor(admin, { subscription: str(o.id), customer: str(o.customer), tenantId: str((o.metadata as Obj | undefined)?.tenant_id) });
    if (!row) return "ignored: no business for this subscription";
    // An old subscription's events must not overwrite a newer one's state.
    if (row.stripe_subscription_id && str(o.id) && row.stripe_subscription_id !== str(o.id)) return "ignored: not the current subscription";
    const status = event.type === "customer.subscription.deleted" ? "cancelled" : STATUS_FROM_STRIPE[String(o.status)] ?? row.status;
    await admin.from("tenant_billing").update({
      status,
      cancel_at_period_end: event.type === "customer.subscription.deleted" ? false : o.cancel_at_period_end === true,
      current_period_end: periodEndOf(o) ?? row.current_period_end,
      updated_at: now,
    }).eq("tenant_id", row.tenant_id);
    return `recorded: subscription ${status}`;
  }

  return "ignored: event type not used";
}
