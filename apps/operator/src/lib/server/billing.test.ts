// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Caller } from "@/lib/server/staff";
import { applyBillingEvent, billingState, BillingError, confirmCheckout, portalLink, startCheckout, type BillingRow } from "./billing";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";

// A small fake of the database: tenants, platform_fees and tenant_billing.
const db: { billing: Record<string, Partial<BillingRow>>; tenants: Record<string, { monthly_fee_pence: number | null; setup_fee_pence: number | null }>; fees: { default_monthly_pence: number; default_setup_pence: number } } =
  { billing: {}, tenants: {}, fees: { default_monthly_pence: 9900, default_setup_pence: 99900 } };

function fakeAdmin(): SupabaseClient {
  const from = (table: string) => {
    const eqs: Array<[string, unknown]> = [];
    let patch: Record<string, unknown> | null = null;
    const rows = (): Array<Record<string, unknown>> =>
      table === "tenant_billing" ? Object.values(db.billing) as Array<Record<string, unknown>>
        : table === "tenants" ? Object.entries(db.tenants).map(([id, t]) => ({ id, ...t }))
          : table === "platform_fees" ? [{ id: true, ...db.fees }] : [];
    const match = () => rows().filter((r) => eqs.every(([k, v]) => r[k] === v));
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => { eqs.push([k, v]); return q; },
      maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
      upsert: async (row: Partial<BillingRow>) => { db.billing[row.tenant_id as string] = { ...db.billing[row.tenant_id as string], ...row }; return { error: null }; },
      update: (p: Record<string, unknown>) => { patch = p; return q; },
      then: (resolve: (v: unknown) => unknown) => {
        if (patch) for (const r of match()) Object.assign(db.billing[r.tenant_id as string], patch);
        return resolve({ data: null, error: null });
      },
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const caller = (over: Partial<Caller> = {}): Caller => ({ userId: "u1", email: "admin@sample.test", name: "Sam", tenantId: T1, tenantName: "Sample Cars", isAdmin: true, ...over });

// A fake Stripe: records every call and answers from a table.
type Call = { url: string; method: string; body: URLSearchParams | null; auth: string };
let calls: Call[] = [];
let replies: Record<string, { status?: number; body: unknown }> = {};
const stripeFetch = (async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
  calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ? new URLSearchParams(init.body) : null, auth: init?.headers?.Authorization ?? "" });
  const key = Object.keys(replies).find((k) => String(url).includes(k));
  const r = key ? replies[key] : { body: {} };
  return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as Response;
}) as unknown as typeof fetch;

const paidSession = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_abc123XYZ9", mode: "subscription", payment_status: "paid", created: 1794700000, amount_total: 109800,
  customer: "cus_1", metadata: { tenant_id: T1, includes_setup: "1" },
  subscription: { id: "sub_1", status: "active", items: { data: [{ current_period_end: 1797300000 }] } },
  invoice: { number: "WJD-0001", amount_paid: 109800, status_transitions: { paid_at: 1794700100 } },
  ...over,
});

beforeEach(() => {
  process.env.STRIPE_PLATFORM_SECRET_KEY = "sk_test_platform";
  db.billing = {}; db.tenants = { [T1]: { monthly_fee_pence: null, setup_fee_pence: null }, [T2]: { monthly_fee_pence: 4900, setup_fee_pence: 0 } };
  db.fees = { default_monthly_pence: 9900, default_setup_pence: 99900 };
  calls = []; replies = {};
});

describe("subscription state", () => {
  it("shows the fees that apply and 'none' before anything is paid", async () => {
    const s = await billingState(fakeAdmin(), caller());
    expect(s).toMatchObject({ status: "none", monthlyPence: 9900, setupPence: 99900, setupPaid: false, configured: true, testMode: true, canManage: true, lastInvoice: null });
  });

  it("uses a business's own rate over the default", async () => {
    expect(await billingState(fakeAdmin(), caller({ tenantId: T2 }))).toMatchObject({ monthlyPence: 4900, setupPence: 0 });
  });

  it("reports not configured without the platform key, and never calls Stripe", async () => {
    delete process.env.STRIPE_PLATFORM_SECRET_KEY;
    expect((await billingState(fakeAdmin(), caller())).configured).toBe(false);
    await expect(startCheckout(fakeAdmin(), caller(), "https://app.test", stripeFetch)).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(0);
  });
});

describe("starting the checkout", () => {
  it("charges the database's amounts (set-up once plus the monthly fee), on the platform's own Stripe account", async () => {
    replies["/checkout/sessions"] = { body: { url: "https://checkout.stripe.test/pay" } };
    const r = await startCheckout(fakeAdmin(), caller(), "https://app.test", stripeFetch);
    expect(r.url).toBe("https://checkout.stripe.test/pay");
    const b = calls[0].body!;
    expect(calls[0].auth).toBe("Bearer sk_test_platform");
    expect(b.get("mode")).toBe("subscription");
    expect(b.get("line_items[0][price_data][unit_amount]")).toBe("9900");
    expect(b.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(b.get("line_items[0][price_data][currency]")).toBe("gbp");
    expect(b.get("line_items[1][price_data][unit_amount]")).toBe("99900");
    expect(b.get("line_items[1][price_data][recurring][interval]")).toBeNull();
    expect(b.get("metadata[tenant_id]")).toBe(T1);
    expect(b.get("metadata[includes_setup]")).toBe("1");
    expect(b.get("subscription_data[metadata][tenant_id]")).toBe(T1);
    expect(b.get("customer_email")).toBe("admin@sample.test");
    expect(b.get("success_url")).toBe("https://app.test/operator/settings?section=subscription&billing=success&session_id={CHECKOUT_SESSION_ID}");
    expect(b.get("cancel_url")).toBe("https://app.test/operator/settings?section=subscription&billing=cancelled");
    // No tax, no application fee, no connected account.
    expect([...b.keys()].some((k) => /tax|application_fee/.test(k))).toBe(false);
  });

  it("does not charge the set-up fee twice", async () => {
    db.billing[T1] = { tenant_id: T1, status: "cancelled", setup_paid_at: "2026-11-01T00:00:00Z", stripe_customer_id: "cus_1" };
    replies["/checkout/sessions"] = { body: { url: "https://checkout.stripe.test/pay" } };
    await startCheckout(fakeAdmin(), caller(), "https://app.test", stripeFetch);
    const b = calls[0].body!;
    expect(b.get("line_items[1][price_data][unit_amount]")).toBeNull();
    expect(b.get("metadata[includes_setup]")).toBe("0");
    expect(b.get("customer")).toBe("cus_1");
    expect(b.get("customer_email")).toBeNull();
  });

  it("is for admins only, and refuses a second subscription", async () => {
    await expect(startCheckout(fakeAdmin(), caller({ isAdmin: false }), "https://app.test", stripeFetch)).rejects.toMatchObject({ status: 403 });
    db.billing[T1] = { tenant_id: T1, status: "active" };
    await expect(startCheckout(fakeAdmin(), caller(), "https://app.test", stripeFetch)).rejects.toMatchObject({ status: 409 });
    expect(calls).toHaveLength(0);
  });

  it("passes on Stripe's own error message", async () => {
    replies["/checkout/sessions"] = { status: 400, body: { error: { message: "Your card was declined." } } };
    await expect(startCheckout(fakeAdmin(), caller(), "https://app.test", stripeFetch)).rejects.toThrow("Your card was declined.");
  });
});

describe("the confirmation after paying", () => {
  it("records a paid checkout and returns the confirmation number, amount and dates", async () => {
    replies["/checkout/sessions/cs_test_abc123XYZ9"] = { body: paidSession() };
    const c = await confirmCheckout(fakeAdmin(), caller(), "cs_test_abc123XYZ9", stripeFetch);
    expect(c).toMatchObject({ paid: true, confirmationNumber: "WJD-0001", amountPence: 109800, includedSetup: true });
    expect(c.paidAt).toBe(new Date(1794700100 * 1000).toISOString());
    expect(c.nextPaymentOn).toBe(new Date(1797300000 * 1000).toISOString());
    expect(db.billing[T1]).toMatchObject({ status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", last_invoice_number: "WJD-0001", last_invoice_amount_pence: 109800 });
    expect(db.billing[T1].setup_paid_at).toBeTruthy();
    expect(calls[0].url).toContain("expand[]=invoice");
  });

  it("is safe to run twice (a page refresh): same record, set-up date unchanged", async () => {
    replies["/checkout/sessions/cs_test_abc123XYZ9"] = { body: paidSession() };
    await confirmCheckout(fakeAdmin(), caller(), "cs_test_abc123XYZ9", stripeFetch);
    const first = { ...db.billing[T1] };
    await confirmCheckout(fakeAdmin(), caller(), "cs_test_abc123XYZ9", stripeFetch);
    expect(db.billing[T1].setup_paid_at).toBe(first.setup_paid_at);
    expect(db.billing[T1].last_invoice_number).toBe("WJD-0001");
  });

  it("records nothing for a checkout that has not been paid", async () => {
    replies["/checkout/sessions/cs_test_abc123XYZ9"] = { body: paidSession({ payment_status: "unpaid" }) };
    expect((await confirmCheckout(fakeAdmin(), caller(), "cs_test_abc123XYZ9", stripeFetch)).paid).toBe(false);
    expect(db.billing[T1]).toBeUndefined();
  });

  it("refuses another business's payment, and records nothing", async () => {
    replies["/checkout/sessions/cs_test_abc123XYZ9"] = { body: paidSession() };
    await expect(confirmCheckout(fakeAdmin(), caller({ tenantId: T2 }), "cs_test_abc123XYZ9", stripeFetch)).rejects.toMatchObject({ status: 403 });
    expect(db.billing[T1]).toBeUndefined();
    expect(db.billing[T2]).toBeUndefined();
  });

  it("refuses a customer booking payment passed off as a subscription, and a malformed reference", async () => {
    replies["/checkout/sessions/cs_test_abc123XYZ9"] = { body: paidSession({ mode: "payment" }) };
    await expect(confirmCheckout(fakeAdmin(), caller(), "cs_test_abc123XYZ9", stripeFetch)).rejects.toBeInstanceOf(BillingError);
    await expect(confirmCheckout(fakeAdmin(), caller(), "../../accounts", stripeFetch)).rejects.toMatchObject({ status: 422 });
    expect(calls).toHaveLength(1);
  });

  it("makes a confirmation number from the payment reference when Stripe gives no invoice number", async () => {
    replies["/checkout/sessions/cs_test_abc123XYZ9"] = { body: paidSession({ invoice: null }) };
    const c = await confirmCheckout(fakeAdmin(), caller(), "cs_test_abc123XYZ9", stripeFetch);
    expect(c.confirmationNumber).toBe("WD-ABC123XYZ9");
    expect(c.amountPence).toBe(109800);
  });
});

describe("billing events from Stripe", () => {
  const active = (): Partial<BillingRow> => ({ tenant_id: T1, status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", setup_paid_at: "2026-11-01T00:00:00Z", last_invoice_number: "WJD-0001", cancel_at_period_end: false });

  it("a completed subscription checkout starts the subscription (checked again with Stripe)", async () => {
    replies["/checkout/sessions/cs_test_abc123XYZ9"] = { body: paidSession() };
    const r = await applyBillingEvent(fakeAdmin(), { type: "checkout.session.completed", data: { object: { id: "cs_test_abc123XYZ9", mode: "subscription", payment_status: "paid", metadata: { tenant_id: T1 } } } }, stripeFetch);
    expect(r).toMatch(/subscription started/);
    expect(db.billing[T1].status).toBe("active");
  });

  it("ignores a customer's booking payment and anything it does not use", async () => {
    expect(await applyBillingEvent(fakeAdmin(), { type: "checkout.session.completed", data: { object: { id: "cs_x", mode: "payment", payment_status: "paid", metadata: { bookingId: "b1" } } } }, stripeFetch)).toMatch(/ignored/);
    expect(await applyBillingEvent(fakeAdmin(), { type: "charge.refunded", data: { object: {} } }, stripeFetch)).toMatch(/ignored/);
    expect(calls).toHaveLength(0);
    expect(db.billing).toEqual({});
  });

  it("a paid monthly invoice updates the confirmation number, amount and next date", async () => {
    db.billing[T1] = active();
    await applyBillingEvent(fakeAdmin(), { type: "invoice.paid", data: { object: { customer: "cus_1", number: "WJD-0002", amount_paid: 9900, status_transitions: { paid_at: 1797300100 }, lines: { data: [{ period: { end: 1799900000 } }] } } } }, stripeFetch);
    expect(db.billing[T1]).toMatchObject({ status: "active", last_invoice_number: "WJD-0002", last_invoice_amount_pence: 9900 });
    expect(db.billing[T1].current_period_end).toBe(new Date(1799900000 * 1000).toISOString());
  });

  it("a failed payment marks it past due; a later paid invoice makes it active again", async () => {
    db.billing[T1] = active();
    await applyBillingEvent(fakeAdmin(), { type: "invoice.payment_failed", data: { object: { customer: "cus_1" } } }, stripeFetch);
    expect(db.billing[T1].status).toBe("past_due");
    expect(db.billing[T1].last_invoice_number).toBe("WJD-0001");
    await applyBillingEvent(fakeAdmin(), { type: "invoice.paid", data: { object: { customer: "cus_1", number: "WJD-0003", amount_paid: 9900 } } }, stripeFetch);
    expect(db.billing[T1].status).toBe("active");
  });

  it("follows a cancellation: at period end, then ended", async () => {
    db.billing[T1] = active();
    await applyBillingEvent(fakeAdmin(), { type: "customer.subscription.updated", data: { object: { id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: true, current_period_end: 1797300000 } } }, stripeFetch);
    expect(db.billing[T1]).toMatchObject({ status: "active", cancel_at_period_end: true });
    await applyBillingEvent(fakeAdmin(), { type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1", status: "canceled" } } }, stripeFetch);
    expect(db.billing[T1]).toMatchObject({ status: "cancelled", cancel_at_period_end: false });
    expect(db.billing[T1].setup_paid_at).toBe("2026-11-01T00:00:00Z");
  });

  it("an old subscription's late event cannot overwrite the current one", async () => {
    db.billing[T1] = active();
    const r = await applyBillingEvent(fakeAdmin(), { type: "customer.subscription.deleted", data: { object: { id: "sub_OLD", customer: "cus_1", status: "canceled" } } }, stripeFetch);
    expect(r).toMatch(/not the current subscription/);
    expect(db.billing[T1].status).toBe("active");
  });

  it("an event for a customer no business owns changes nothing", async () => {
    db.billing[T1] = active();
    expect(await applyBillingEvent(fakeAdmin(), { type: "invoice.payment_failed", data: { object: { customer: "cus_STRANGER" } } }, stripeFetch)).toMatch(/no business/);
    expect(db.billing[T1].status).toBe("active");
  });
});

describe("managing the subscription", () => {
  it("opens Stripe's page for the business's own customer, admins only", async () => {
    db.billing[T1] = { tenant_id: T1, status: "active", stripe_customer_id: "cus_1" };
    replies["/billing_portal/sessions"] = { body: { url: "https://billing.stripe.test/p" } };
    expect((await portalLink(fakeAdmin(), caller(), "https://app.test", stripeFetch)).url).toBe("https://billing.stripe.test/p");
    expect(calls[0].body!.get("customer")).toBe("cus_1");
    await expect(portalLink(fakeAdmin(), caller({ isAdmin: false }), "https://app.test", stripeFetch)).rejects.toMatchObject({ status: 403 });
    await expect(portalLink(fakeAdmin(), caller({ tenantId: T2 }), "https://app.test", stripeFetch)).rejects.toMatchObject({ status: 409 });
  });
});
