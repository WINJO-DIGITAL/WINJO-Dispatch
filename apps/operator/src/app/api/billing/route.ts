// Settings → Subscription: the business's own subscription to the platform.
//   GET                                  -> the state: fees, status, last confirmation number
//   POST { action: "checkout" }          -> { url } a Stripe Checkout page (admins only)
//   POST { action: "confirm", sessionId} -> the confirmation after paying (checked with Stripe)
//   POST { action: "portal" }            -> { url } Stripe's page to change card or cancel (admins only)
// Amounts come from the database, never from the request. Server only.
import { BillingError, billingState, confirmCheckout, portalLink, startCheckout } from "@/lib/server/billing";
import { adminClient, appOrigin, getCaller, json } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof BillingError) return json({ error: e.message }, e.status);
  console.error("billing:", e);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

export async function GET(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "not configured" }, 503);
  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "Not authorised." }, 401);
  try { return json(await billingState(admin, caller)); } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "not configured" }, 503);
  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "Not authorised." }, 401);
  let body: { action?: string; sessionId?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  try {
    if (body.action === "checkout") return json(await startCheckout(admin, caller, appOrigin(req)));
    if (body.action === "confirm") return json(await confirmCheckout(admin, caller, String(body.sessionId ?? "")));
    if (body.action === "portal") return json(await portalLink(admin, caller, appOrigin(req)));
    return json({ error: "Unknown action." }, 400);
  } catch (e) { return fail(e); }
}
