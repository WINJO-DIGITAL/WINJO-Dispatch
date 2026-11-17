// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const applied: Array<{ type?: string }> = [];
let failNext = false;
vi.mock("@/lib/server/billing", () => ({
  applyBillingEvent: async (_admin: unknown, event: { type?: string }) => { if (failNext) throw new Error("db down"); applied.push(event); return "recorded: test"; },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
const SECRET = "whsec_test_billing_secret";

function signed(body: string, secret = SECRET) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}
const send = async (body: string, sig: string | null) => {
  const { POST } = await import("./route");
  const res = await POST(new Request("https://app.test/api/billing/webhook", { method: "POST", headers: sig ? { "stripe-signature": sig } : {}, body }));
  return { status: res.status, text: await res.text() };
};

beforeEach(() => { applied.length = 0; failNext = false; process.env.STRIPE_BILLING_WEBHOOK_SECRET = SECRET; });

describe("POST /api/billing/webhook", () => {
  const body = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: { customer: "cus_1" } } });

  it("applies a correctly signed event", async () => {
    const r = await send(body, signed(body));
    expect(r.status).toBe(200);
    expect(applied).toHaveLength(1);
    expect(applied[0].type).toBe("invoice.paid");
  });

  it("refuses a missing, wrong or other-secret signature, and applies nothing", async () => {
    expect((await send(body, null)).status).toBe(400);
    expect((await send(body, "t=1,v1=deadbeef")).status).toBe(400);
    expect((await send(body, signed(body, "whsec_another_endpoint"))).status).toBe(400);
    expect((await send(body + " ", signed(body))).status).toBe(400);
    expect(applied).toHaveLength(0);
  });

  it("is closed when the secret is not set or is not a signing secret", async () => {
    delete process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    expect((await send(body, signed(body))).status).toBe(503);
    process.env.STRIPE_BILLING_WEBHOOK_SECRET = "sk_test_wrong_kind_of_key";
    expect((await send(body, signed(body, "sk_test_wrong_kind_of_key"))).status).toBe(503);
    expect(applied).toHaveLength(0);
  });

  it("answers 500 when it could not be recorded, so Stripe tries again", async () => {
    failNext = true;
    expect((await send(body, signed(body))).status).toBe(500);
  });
});
