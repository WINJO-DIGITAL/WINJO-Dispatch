// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkDomain, connectDomain, domainOf, domainProblem, DomainError, recordsFrom, vercelConfigured } from "./vercelDomains";

const env = { VERCEL_TOKEN: "vt_test_secret_value", VERCEL_PROJECT_ID: "prj_1TscAwPpnsRSyx3xhYXRK0nrppN2", VERCEL_TEAM_ID: "team_RhhxQIJqo6pFuKaXFV7lWZuW" } as unknown as NodeJS.ProcessEnv;

type Call = { url: string; method: string; auth: string; body: unknown };
function fakeVercel(replies: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  let i = 0;
  const f = (async (u: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    calls.push({ url: String(u), method: init?.method ?? "GET", auth: init?.headers?.Authorization ?? "", body: init?.body ? JSON.parse(init.body) : null });
    const r = replies[Math.min(i++, replies.length - 1)];
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("setup", () => {
  it("is off without the token or the project id, and calls nothing", async () => {
    expect(vercelConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    const { f, calls } = fakeVercel([{ body: {} }]);
    await expect(connectDomain("www.cars.co.uk", f, {} as NodeJS.ProcessEnv)).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(0);
  });
});

describe("the domain", () => {
  it("takes the bare domain from the https address", () => {
    expect(domainOf("https://www.Cars.co.uk/")).toBe("www.cars.co.uk");
    expect(domainOf("https://cars.co.uk")).toBe("cars.co.uk");
  });
  it("refuses the platform's own addresses and anything that is not a domain", () => {
    expect(domainProblem("winjo-dispatch.vercel.app")).toMatch(/belongs to the platform/);
    expect(domainProblem("winjodigital.co.uk")).toMatch(/belongs to the platform/);
    expect(domainProblem("localhost")).toMatch(/isn't a domain/);
    expect(domainProblem("not a domain")).toMatch(/isn't a domain/);
    expect(domainProblem("www.cars.co.uk")).toBeNull();
  });
});

describe("connecting", () => {
  it("adds the domain to the platform's project with the business's own domain, authorised by the token", async () => {
    const { f, calls } = fakeVercel([{ body: { name: "www.cars.co.uk", verified: true } }]);
    const s = await connectDomain("www.cars.co.uk", f, env);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toContain("/v10/projects/prj_1TscAwPpnsRSyx3xhYXRK0nrppN2/domains");
    expect(calls[0].url).toContain("teamId=team_RhhxQIJqo6pFuKaXFV7lWZuW");
    expect(calls[0].body).toEqual({ name: "www.cars.co.uk" });
    expect(calls[0].auth).toBe("Bearer vt_test_secret_value");
    expect(s).toMatchObject({ domain: "www.cars.co.uk", verified: true, records: [] });
  });

  it("gives the DNS records to add when it is not verified yet", async () => {
    const { f } = fakeVercel([
      { body: { name: "www.cars.co.uk", verified: false, verification: [{ type: "TXT", domain: "_vercel.www.cars.co.uk", value: "vc-domain-verify=abc" }] } },
      { body: { recommendedCNAME: [{ value: "cname.vercel-dns.com", rank: 1 }] } },
    ]);
    const s = await connectDomain("www.cars.co.uk", f, env);
    expect(s.verified).toBe(false);
    expect(s.records).toEqual([
      { type: "TXT", name: "_vercel.www.cars.co.uk", value: "vc-domain-verify=abc" },
      { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
    ]);
    expect(s.next).toMatch(/press Check/);
  });

  it("an address already added is read back, not added twice", async () => {
    const { f, calls } = fakeVercel([
      { status: 409, body: { error: { code: "domain_already_in_use", message: "in use" } } },
      { body: { name: "www.cars.co.uk", verified: true } },
    ]);
    const s = await connectDomain("www.cars.co.uk", f, env);
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET"]);
    expect(s.verified).toBe(true);
  });

  it("refuses the platform's address before calling Vercel", async () => {
    const { f, calls } = fakeVercel([{ body: {} }]);
    await expect(connectDomain("winjo-dispatch.vercel.app", f, env)).rejects.toBeInstanceOf(DomainError);
    expect(calls).toHaveLength(0);
  });

  it("keeps Vercel's own refusal in plain words and never includes the token", async () => {
    const { f } = fakeVercel([{ status: 400, body: { error: { message: "Invalid domain" } } }]);
    try { await connectDomain("www.cars.co.uk", f, env); throw new Error("should not get here"); }
    catch (e) {
      expect((e as Error).message).toBe("Invalid domain");
      expect((e as Error).message).not.toContain("vt_test_secret_value");
    }
  });
});

describe("checking", () => {
  it("asks Vercel to re-check the DNS, then reports the result", async () => {
    const { f, calls } = fakeVercel([{ body: { name: "www.cars.co.uk", verified: true } }]);
    const s = await checkDomain("www.cars.co.uk", f, env);
    expect(calls[0].url).toContain("/v9/projects/prj_1TscAwPpnsRSyx3xhYXRK0nrppN2/domains/www.cars.co.uk/verify");
    expect(s.verified).toBe(true);
  });
  it("still answers when the check call itself fails: it reads the domain instead", async () => {
    const { f, calls } = fakeVercel([{ status: 500, body: {} }, { body: { name: "www.cars.co.uk", verified: false } }, { status: 404, body: {} }]);
    const s = await checkDomain("www.cars.co.uk", f, env);
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "GET"]);
    expect(s.verified).toBe(false);
  });
});

describe("reading the DNS records", () => {
  it("uses an A record for a bare domain and a CNAME for a subdomain", () => {
    expect(recordsFrom("cars.co.uk", {}, { recommendedIPv4: [{ value: ["76.76.21.21"] }] })).toEqual([{ type: "A", name: "@", value: "76.76.21.21" }]);
    expect(recordsFrom("cars.com", {}, { recommendedIPv4: [{ value: ["76.76.21.21"] }] })).toEqual([{ type: "A", name: "@", value: "76.76.21.21" }]);
    expect(recordsFrom("www.cars.co.uk", {}, { recommendedCNAME: [{ value: "cname.vercel-dns.com" }] })).toEqual([{ type: "CNAME", name: "www", value: "cname.vercel-dns.com" }]);
    expect(recordsFrom("book.cars.co.uk", {}, { recommendedCNAME: [{ value: "cname.vercel-dns.com" }] })).toEqual([{ type: "CNAME", name: "book", value: "cname.vercel-dns.com" }]);
  });
  it("skips anything Vercel did not send, rather than inventing it", () => {
    expect(recordsFrom("cars.co.uk", { verification: [{ type: "TXT" }] }, {})).toEqual([]);
  });
});
