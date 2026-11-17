// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = { owner: true, vercel: [] as Array<{ status?: number; body: unknown }>, calls: [] as string[] };
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/server/staff", () => ({
  adminClient: () => ({}),
  json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  getSuperAdmin: async () => (state.owner ? { userId: "owner", email: "hello@winjodigital.co.uk", name: "Owner" } : null),
}));

process.env.VERCEL_TOKEN = "vt_test_secret_value";
process.env.VERCEL_PROJECT_ID = "prj_1TscAwPpnsRSyx3xhYXRK0nrppN2";
vi.stubGlobal("fetch", vi.fn(async (u: string) => {
  state.calls.push(String(u));
  const r = state.vercel.shift() ?? { body: {} };
  return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as Response;
}));

const post = async (body: unknown) => {
  const { POST } = await import("./route");
  const res = await POST(new Request("https://app.test/api/platform/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => { state.owner = true; state.vercel = []; state.calls = []; });

describe("POST /api/platform/domains", () => {
  it("is for the platform owner only, and calls nothing otherwise", async () => {
    state.owner = false;
    expect((await post({ domain: "www.cars.co.uk" })).status).toBe(403);
    expect(state.calls).toHaveLength(0);
  });

  it("connects a business's domain and returns the records to add", async () => {
    state.vercel = [
      { body: { name: "www.cars.co.uk", verified: false, verification: [{ type: "TXT", domain: "_vercel.www.cars.co.uk", value: "vc-domain-verify=abc" }] } },
      { body: { recommendedCNAME: [{ value: "cname.vercel-dns.com" }] } },
    ];
    const r = await post({ domain: "https://WWW.Cars.co.uk/", action: "connect" });
    expect(r.status).toBe(200);
    expect(r.body.verified).toBe(false);
    expect(r.body.records).toHaveLength(2);
  });

  it("checks an existing domain", async () => {
    state.vercel = [{ body: { name: "www.cars.co.uk", verified: true } }];
    const r = await post({ domain: "www.cars.co.uk", action: "check" });
    expect(r.body.verified).toBe(true);
    expect(state.calls[0]).toContain("/verify");
  });

  it("refuses an empty or a platform domain without calling Vercel", async () => {
    expect((await post({ domain: "" })).status).toBe(422);
    expect((await post({ domain: "winjo-dispatch.vercel.app" })).status).toBe(422);
    expect(state.calls).toHaveLength(0);
  });

  it("says plainly when Vercel is not set up yet", async () => {
    const keep = process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TOKEN;
    const r = await post({ domain: "www.cars.co.uk" });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/VERCEL_TOKEN/);
    process.env.VERCEL_TOKEN = keep;
  });
});
