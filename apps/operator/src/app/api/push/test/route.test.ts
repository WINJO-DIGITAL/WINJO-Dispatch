// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

type Sub = { endpoint: string; p256dh: string; auth: string; user_id: string };
const db: { roles: Record<string, string[]>; subs: Sub[]; cfg: Record<string, string> | null; deleted: Array<{ endpoint: string; user_id: string }>; tokens: Record<string, string> } = {
  roles: {}, subs: [], cfg: null, deleted: [], tokens: {},
};
const sent: Array<{ endpoint: string; payload: string }> = [];
const failWith: Record<string, number> = {};
const vapid: unknown[][] = [];

// A tiny fake of the parts of the Supabase client the route uses.
function query(table: string) {
  const filters: Array<[string, unknown]> = [];
  let op: "select" | "delete" = "select";
  const rows = (): Record<string, unknown>[] => {
    if (table === "tenant_users") return (Object.entries(db.roles) as Array<[string, string[]]>).flatMap(([user_id, rs]) => rs.map((role) => ({ user_id, role })));
    if (table === "operator_push_subscriptions") return db.subs as unknown as Record<string, unknown>[];
    if (table === "push_config") return db.cfg ? [db.cfg] : [];
    return [];
  };
  const matched = () => rows().filter((r) => filters.every(([k, v]) => k === "id" ? true : r[k] === v));
  const q: Record<string, unknown> = {
    select: () => q,
    delete: () => { op = "delete"; return q; },
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) => {
      if (op === "delete" && table === "operator_push_subscriptions") {
        const gone = matched() as unknown as Sub[];
        gone.forEach((g) => db.deleted.push({ endpoint: g.endpoint, user_id: g.user_id }));
        db.subs = db.subs.filter((s) => !gone.includes(s));
        return res({ data: null, error: null });
      }
      return res({ data: matched(), error: null });
    },
  };
  return q;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: query,
    auth: { getUser: async (token: string) => (db.tokens[token] ? { data: { user: { id: db.tokens[token] } }, error: null } : { data: { user: null }, error: { message: "bad" } }) },
  }),
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...a: unknown[]) => { vapid.push(a); },
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (failWith[sub.endpoint]) { const e = new Error("push failed") as Error & { statusCode: number }; e.statusCode = failWith[sub.endpoint]; throw e; }
      sent.push({ endpoint: sub.endpoint, payload });
    },
  },
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const post = async (token: string | null, body?: unknown) => {
  const { POST, _resetLimits } = await import("./route");
  void _resetLimits;
  const res = await POST(new Request("http://localhost/api/push/test", {
    method: "POST",
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

beforeEach(async () => {
  const { _resetLimits } = await import("./route");
  _resetLimits();
  db.roles = { owner: ["super_admin"], sam: ["dispatcher"], dee: ["operator_admin"], cust: ["driver"], nobody: [] };
  db.tokens = { "tok-owner": "owner", "tok-sam": "sam", "tok-dee": "dee", "tok-cust": "cust", "tok-nobody": "nobody" };
  db.subs = [
    { endpoint: "https://push.test/owner-phone", p256dh: "k1", auth: "a1", user_id: "owner" },
    { endpoint: "https://push.test/sam-phone", p256dh: "k2", auth: "a2", user_id: "sam" },
    { endpoint: "https://push.test/sam-laptop", p256dh: "k3", auth: "a3", user_id: "sam" },
  ];
  db.cfg = { vapid_public: "PUB", vapid_private: "PRIV", vapid_subject: "mailto:hello@example.test" };
  db.deleted = [];
  sent.length = 0; vapid.length = 0;
  for (const k of Object.keys(failWith)) delete failWith[k];
});

describe("POST /api/push/test", () => {
  it("needs a signed-in person: no token, or a bad token, is refused and nothing is sent", async () => {
    expect((await post(null, {})).status).toBe(401);
    expect((await post("not-a-token", {})).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it("is for office staff only: a driver or an account with no role gets 403 and nothing is sent", async () => {
    expect((await post("tok-cust", {})).status).toBe(403);
    expect((await post("tok-nobody", {})).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it("works for the platform owner with no business, sending only to the owner's own device", async () => {
    const r = await post("tok-owner", {});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, sent: 1, total: 1 });
    expect(r.body.message).toMatch(/sent to 1 device/i);
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push.test/owner-phone"]);
  });

  it("sends to the caller's own devices only, never anyone else's", async () => {
    const r = await post("tok-sam", {});
    expect(r.status).toBe(200);
    expect(sent.map((s) => s.endpoint).sort()).toEqual(["https://push.test/sam-laptop", "https://push.test/sam-phone"]);
    expect(sent.some((s) => s.endpoint.includes("owner"))).toBe(false);
  });

  it("ignores any user id in the request: it cannot be aimed at someone else", async () => {
    const r = await post("tok-sam", { user_id: "owner", userId: "owner", email: "owner@example.test", user: "owner" });
    expect(r.status).toBe(200);
    expect(sent.map((s) => s.endpoint)).not.toContain("https://push.test/owner-phone");
    expect(r.body.total).toBe(2);
  });

  it("can test one named device of the caller's own", async () => {
    const r = await post("tok-sam", { endpoint: "https://push.test/sam-phone" });
    expect(r.status).toBe(200);
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push.test/sam-phone"]);
  });

  it("refuses to test somebody else's device even if its address is guessed", async () => {
    const r = await post("tok-sam", { endpoint: "https://push.test/owner-phone" });
    expect(r.status).toBe(404);
    expect(r.body.ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("says plainly when the person has no subscribed device", async () => {
    const r = await post("tok-dee", {});
    expect(r.status).toBe(404);
    expect(r.body.error).toMatch(/No device is subscribed/);
    expect(sent).toHaveLength(0);
  });

  it("says plainly when the platform's alert keys are not set up, without sending", async () => {
    db.cfg = null;
    const r = await post("tok-sam", {});
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/alert keys aren't set up/);
    db.cfg = { vapid_public: "PUB", vapid_private: "", vapid_subject: "" };
    expect((await post("tok-sam", {})).status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  it("signs the message with the platform's keys and sends a fixed harmless message", async () => {
    await post("tok-owner", {});
    expect(vapid[0]).toEqual(["mailto:hello@example.test", "PUB", "PRIV"]);
    expect(JSON.parse(sent[0].payload)).toEqual({ title: "Test notification", body: "Alerts are working on this device.", url: "/operator/settings?section=notifications", tag: "push-test" });
  });

  it("never returns a key or a subscription secret", async () => {
    const r = await post("tok-sam", {});
    const text = JSON.stringify(r.body);
    for (const secret of ["PRIV", "PUB", "k2", "a2", "push.test"]) expect(text).not.toContain(secret);
  });

  it("reports a partly failed test, and removes an expired device (only the caller's own)", async () => {
    failWith["https://push.test/sam-laptop"] = 410;
    const r = await post("tok-sam", {});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, sent: 1, removed: 1, total: 2 });
    expect(r.body.message).toMatch(/Sent to 1 of 2 devices/);
    expect(db.deleted).toEqual([{ endpoint: "https://push.test/sam-laptop", user_id: "sam" }]);
    expect(db.subs.map((s) => s.endpoint)).toContain("https://push.test/owner-phone");
  });

  it("explains an expired-only result and a refusal from the push service", async () => {
    failWith["https://push.test/owner-phone"] = 410;
    const gone = await post("tok-owner", {});
    expect(gone.status).toBe(502);
    expect(gone.body.error).toMatch(/expired and was removed/);
    db.subs.push({ endpoint: "https://push.test/owner-phone-2", p256dh: "k", auth: "a", user_id: "owner" });
    failWith["https://push.test/owner-phone-2"] = 500;
    const refused = await post("tok-owner", {});
    expect(refused.status).toBe(502);
    expect(refused.body.error).toMatch(/refused the test message/);
  });

  it("limits tests: six in ten minutes per person", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await post("tok-owner", {})).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 200, 429]);
    expect((await post("tok-sam", {})).status).toBe(200);
  });
});
