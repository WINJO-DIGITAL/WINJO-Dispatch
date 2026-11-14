// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
const T1 = "11111111-1111-4111-8111-111111111111";
const db: { users: Record<string, string>; roles: Row[]; calls: Array<{ type: string; email: string }>; sent: Array<{ from: string; to: string[]; subject: string; html: string; text: string }>; mailOk: boolean } =
  { users: {}, roles: [], calls: [], sent: [], mailOk: true };

function query(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  const rows = () => (table === "tenant_users" ? db.roles : table === "tenants" ? [{ id: T1, name: "Moor Cars Ltd" }] : []);
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (col: string, v: unknown) => { filters.push((r) => r[col] === v); return q; },
    maybeSingle: async () => ({ data: rows().filter((r) => filters.every((f) => f(r)))[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) => res({ data: rows().filter((r) => filters.every((f) => f(r))), error: null }),
  };
  return q;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: query,
    auth: {
      admin: {
        generateLink: async ({ type, email }: { type: string; email: string }) => {
          db.calls.push({ type, email });
          const id = db.users[email];
          if (!id) return { data: null, error: { message: "User not found" } };
          return { data: { user: { id }, properties: { hashed_token: type === "magiclink" ? "magic-token-1" : "recovery-token-1" } }, error: null };
        },
      },
    },
  }),
}));
vi.mock("@/lib/server/brands", () => ({ loadBrand: vi.fn(async () => undefined) }));

vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: string }) => {
  if (String(url).includes("api.resend.com")) {
    if (!db.mailOk) return { ok: false, status: 500, json: async () => ({ message: "down" }) };
    db.sent.push(JSON.parse(init?.body ?? "{}"));
    return { ok: true, status: 200, json: async () => ({}) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.RESEND_API_KEY = "re_x";
process.env.INVOICE_FROM = "Platform <hello@platform.test>";
process.env.PLATFORM_FROM = "Winjo Digital <hello@platform.test>";
process.env.NEXT_PUBLIC_OPERATOR_URL = "https://app.platform.test";

let n = 0;
const post = async (email: unknown, ip = `10.1.0.${++n}`) => {
  const { POST } = await import("./route");
  const res = await POST(new Request("https://app.platform.test/api/auth/email-link", { method: "POST", headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: JSON.stringify({ email }) }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => { db.users = {}; db.roles = []; db.calls = []; db.sent = []; db.mailOk = true; });

describe("POST /api/auth/email-link", () => {
  it("emails a one-time sign-in link to a business's staff member, with no password step", async () => {
    db.users["sam@moor.test"] = "u1"; db.roles = [{ user_id: "u1", tenant_id: T1, role: "operator_admin" }];
    const r = await post("Sam@Moor.test");
    expect(r.status).toBe(200);
    expect(db.sent).toHaveLength(1);
    expect(db.sent[0].to).toEqual(["sam@moor.test"]);
    // In HTML a link's & is written &amp;; the plain-text version carries the bare link.
    expect(db.sent[0].html).toContain("https://app.platform.test/set-password?token_hash=magic-token-1&amp;type=magiclink");
    expect(db.sent[0].text).toContain("https://app.platform.test/set-password?token_hash=magic-token-1&type=magiclink");
    expect(db.sent[0].subject).toContain("Moor Cars Ltd");
  });

  it("emails the platform owner (no business) from the platform sender, with no business branding", async () => {
    db.users["hello@winjodigital.co.uk"] = "owner"; db.roles = [{ user_id: "owner", tenant_id: null, role: "super_admin" }];
    const r = await post("hello@winjodigital.co.uk");
    expect(r.status).toBe(200);
    expect(db.sent).toHaveLength(1);
    expect(db.sent[0].from).toBe("Winjo Digital <hello@platform.test>");
    expect(db.sent[0].html).toContain("type=magiclink");
    expect(JSON.stringify(db.sent[0])).not.toMatch(/EV Exec|evexec/i);
  });

  it("gives an unknown address the same reply, sends nothing and creates no account", async () => {
    const r = await post("nobody@nowhere.test");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(db.sent).toHaveLength(0);
    expect(db.calls.map((c) => c.type)).toEqual(["recovery"]);
    expect(db.calls.some((c) => c.type === "magiclink")).toBe(false);
  });

  it("sends nothing to an existing account that has no staff role (customers, drivers)", async () => {
    db.users["cust@x.test"] = "c1"; db.roles = [{ user_id: "c1", tenant_id: T1, role: "driver" }];
    const r = await post("cust@x.test");
    expect(r.status).toBe(200);
    expect(db.sent).toHaveLength(0);
    expect(db.calls.some((c) => c.type === "magiclink")).toBe(false);
  });

  it("answers the same for staff and non-staff, so it cannot reveal who has an account", async () => {
    db.users["a@x.test"] = "a"; db.roles = [{ user_id: "a", tenant_id: T1, role: "dispatcher" }];
    const staff = await post("a@x.test");
    const stranger = await post("zzz@x.test");
    expect(staff.body).toEqual(stranger.body);
  });

  it("rejects a malformed address", async () => {
    for (const bad of ["", "nope", "a@b", 5, null]) expect((await post(bad)).status).toBe(422);
  });

  it("limits requests: five per address in a quarter of an hour", async () => {
    db.users["spam@x.test"] = "s"; db.roles = [{ user_id: "s", tenant_id: T1, role: "operator_admin" }];
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await post("spam@x.test")).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
    expect(db.sent).toHaveLength(5);
  });

  it("never reveals a mail failure or a missing sender, and sends nothing then", async () => {
    db.users["owner2@x.test"] = "o2"; db.roles = [{ user_id: "o2", tenant_id: null, role: "super_admin" }];
    db.mailOk = false;
    expect((await post("owner2@x.test")).status).toBe(200);
    db.mailOk = true;
    const keep = process.env.PLATFORM_FROM; const keep2 = process.env.INVOICE_FROM;
    delete process.env.PLATFORM_FROM; delete process.env.INVOICE_FROM;
    expect((await post("owner2@x.test")).status).toBe(200);
    process.env.PLATFORM_FROM = keep; process.env.INVOICE_FROM = keep2;
    expect(db.sent).toHaveLength(0);
  });
});
