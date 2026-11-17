// Stripe webhook for the platform's own billing of operators (subscription started, invoice paid,
// payment failed, subscription changed or cancelled). Signature-checked with
// STRIPE_BILLING_WEBHOOK_SECRET (its own endpoint and secret, separate from customer payments).
// Stripe must be pointed at: https://<site>/api/billing/webhook
import { verifyStripeSignature } from "@/lib/stripeSignature";
import { applyBillingEvent } from "@/lib/server/billing";
import { adminClient } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const admin = adminClient();
  if (!secret || !secret.startsWith("whsec_") || !admin) return new Response("Webhook not configured", { status: 503 });

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig || !verifyStripeSignature(raw, sig, secret)) return new Response("Invalid signature", { status: 400 });

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(raw); } catch { return new Response("Invalid payload", { status: 400 }); }

  try {
    const result = await applyBillingEvent(admin, event);
    console.log(`[billing webhook] ${event.type} ${event.id ?? ""}: ${result}`);
    return new Response(result, { status: 200 });
  } catch (e) {
    // A 500 makes Stripe retry later, which is what we want if Stripe or the database was down.
    console.error("[billing webhook]", event.type, (e as Error).message);
    return new Response("Could not process", { status: 500 });
  }
}
