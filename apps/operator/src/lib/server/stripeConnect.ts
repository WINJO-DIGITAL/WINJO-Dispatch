// Stripe Connect for operators (design: docs/payments/stripe-connect-design.md).
//
// Each operator connects its OWN Stripe account (a connected account) through
// Stripe-hosted onboarding. Payments are taken directly on that account and the
// operator pays Stripe's fees, so the platform never holds the money. No
// application fee is taken (owner decision 12/11/2026).
//
// Uses the PLATFORM's secret key (STRIPE_PLATFORM_SECRET_KEY, the Winjo Digital
// Stripe account) and nothing else; never a business's own STRIPE_SECRET_KEY.
// Server only: the key is never stored in the database or sent to the browser.
// Without the key, every function here refuses ("not configured") and nothing
// is called.

const STRIPE_API = "https://api.stripe.com/v1";

export type ConnectStatus = {
  accountId: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
};

type Fetch = typeof fetch;

// The parts of Stripe's account and account-link responses we read.
type StripeBody = {
  id?: string; url?: string; charges_enabled?: boolean; details_submitted?: boolean; payouts_enabled?: boolean;
  requirements?: { currently_due?: unknown[] }; error?: { message?: string };
};

export const connectKey = (): string => (process.env.STRIPE_PLATFORM_SECRET_KEY ?? "").trim();
export const connectConfigured = (): boolean => /^sk_(test|live)_/.test(connectKey());

export class ConnectError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function call(f: Fetch, method: "GET" | "POST", path: string, form?: Record<string, string>) {
  const key = connectKey();
  if (!/^sk_(test|live)_/.test(key)) throw new ConnectError("Stripe is not set up on this platform yet.", 503);
  const res = await f(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as StripeBody;
  if (!res.ok) throw new ConnectError(body?.error?.message || `Stripe error ${res.status}`, res.status >= 500 ? 502 : 400);
  return body;
}

const status = (a: StripeBody): ConnectStatus => ({
  accountId: String(a.id),
  chargesEnabled: a.charges_enabled === true,
  detailsSubmitted: a.details_submitted === true,
  payoutsEnabled: a.payouts_enabled === true,
  requirementsDue: Array.isArray(a.requirements?.currently_due) ? a.requirements.currently_due.map(String) : [],
});

// Stripe refuses new connected accounts on the old /v1/accounts call, so accounts
// are created with Accounts v2 (JSON). Everything else (onboarding links, status,
// payments with the Stripe-Account header) still uses v1, which v2 accounts accept.
const STRIPE_V2_ACCOUNTS = "https://api.stripe.com/v2/core/accounts";
const STRIPE_V2_VERSION = "2026-03-25.preview";

/**
 * A new connected account for a business. Behaves like a Standard account:
 * full Stripe Dashboard, the operator pays Stripe's fees, Stripe is liable for
 * its negative balances and collects its identity information.
 */
export async function createConnectedAccount(
  p: { tenantId: string; businessName: string; email?: string; country?: string },
  f: Fetch = fetch,
): Promise<ConnectStatus> {
  const key = connectKey();
  if (!/^sk_(test|live)_/.test(key)) throw new ConnectError("Stripe is not set up on this platform yet.", 503);
  const payload = {
    display_name: p.businessName.slice(0, 100),
    ...(p.email ? { contact_email: p.email } : {}),
    dashboard: "full",
    identity: { country: (p.country || "GB").toLowerCase() },
    defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
    configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
    metadata: { tenant_id: p.tenantId },
  };
  const res = await f(STRIPE_V2_ACCOUNTS, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Stripe-Version": STRIPE_V2_VERSION },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as StripeBody;
  if (!res.ok || !body.id) throw new ConnectError(body?.error?.message || `Stripe error ${res.status}`, res.status >= 500 ? 502 : 400);
  // A brand-new account can never take payments yet; its real state is read by connectStatus().
  return { accountId: String(body.id), chargesEnabled: false, detailsSubmitted: false, payoutsEnabled: false, requirementsDue: [] };
}

/** A one-time Stripe-hosted onboarding link for the connected account. */
export async function createOnboardingLink(
  accountId: string, returnUrl: string, refreshUrl: string, f: Fetch = fetch,
): Promise<string> {
  const a = await call(f, "POST", "/account_links", {
    account: accountId, return_url: returnUrl, refresh_url: refreshUrl, type: "account_onboarding",
  });
  if (typeof a.url !== "string") throw new ConnectError("Stripe did not return an onboarding link.");
  return a.url;
}

/** What Stripe currently says about the connected account. */
export async function readAccountStatus(accountId: string, f: Fetch = fetch): Promise<ConnectStatus> {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new ConnectError("That is not a Stripe account id.", 400);
  return status(await call(f, "GET", `/accounts/${accountId}`));
}
