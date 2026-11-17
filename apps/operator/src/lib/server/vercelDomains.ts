// Connects a business's own domain to the platform's Vercel project, so the business's website
// answers on it. Server only. Uses a Vercel access token held as the secret VERCEL_TOKEN (set by
// the owner in Vercel, never in the repository or in chat), with VERCEL_PROJECT_ID and optionally
// VERCEL_TEAM_ID. Without them nothing is called and the caller is told why.
//
// Adding a domain to the project is all the routing needs: the website picks the business by the
// visitor's address (brand.site_url), so no deploy is needed per business.

const API = "https://api.vercel.com";
type Fetch = typeof fetch;

export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export type DnsRecord = { type: string; name: string; value: string };
export type DomainState = {
  domain: string;
  verified: boolean;
  /** DNS records the business's domain provider needs. Empty once verified. */
  records: DnsRecord[];
  /** A plain-English next step for the owner. */
  next: string;
};

export function vercelConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.VERCEL_TOKEN ?? "").trim() && (env.VERCEL_PROJECT_ID ?? "").trim());
}

/** The bare domain from an https address: "https://www.cars.co.uk" -> "www.cars.co.uk". */
export function domainOf(siteUrl: string): string {
  return String(siteUrl ?? "").trim().toLowerCase().replace(/^https:\/\//, "").replace(/\/+$/, "");
}

const PLATFORM_HOSTS = [/(^|\.)vercel\.app$/, /(^|\.)winjodigital\.co\.uk$/, /^localhost$/];

/** A domain the platform itself uses cannot be given to a business, and it must look like a real domain. */
export function domainProblem(domain: string): string | null {
  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) return "That isn't a domain name. Use the business's own address, for example www.example.co.uk.";
  if (PLATFORM_HOSTS.some((re) => re.test(domain))) return "That address belongs to the platform, so it can't be given to a business.";
  return null;
}

function headers(env: NodeJS.ProcessEnv) {
  return { Authorization: `Bearer ${(env.VERCEL_TOKEN ?? "").trim()}`, "Content-Type": "application/json" };
}
function scope(env: NodeJS.ProcessEnv) {
  const team = (env.VERCEL_TEAM_ID ?? "").trim();
  return team ? `teamId=${encodeURIComponent(team)}` : "";
}
function url(env: NodeJS.ProcessEnv, path: string, extra = "") {
  const q = [scope(env), extra].filter(Boolean).join("&");
  return `${API}/${path.replace(/^\//, "")}${q ? (path.includes("?") ? "&" : "?") + q : ""}`;
}

async function call(f: Fetch, env: NodeJS.ProcessEnv, method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<Record<string, unknown>> {
  if (!vercelConfigured(env)) throw new DomainError("Custom domains aren't set up yet: the platform needs a Vercel access token (VERCEL_TOKEN) and its project id.", 503);
  const project = encodeURIComponent((env.VERCEL_PROJECT_ID ?? "").trim());
  const res = await f(url(env, path.replace("{project}", project)), { method, headers: headers(env), body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string; code?: string } };
  if (!res.ok) {
    if (data.error?.code === "domain_already_in_use" || data.error?.code === "forbidden") throw new DomainError("Vercel will not take that domain. It may already be in use on another account.", 409);
    throw new DomainError(data.error?.message || `Vercel error ${res.status}. Try again in a few minutes.`, res.status >= 500 ? 502 : 400);
  }
  return data;
}

type Verification = { type?: string; domain?: string; value?: string; reason?: string };

// Second-level labels used under a country code (cars.co.uk is a root domain; www.cars.co.uk is not).
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "ltd", "plc", "me", "sch"]);

/** How many labels a root (apex) domain has: 3 for cars.co.uk, 2 for cars.com. */
export function apexLabels(domain: string): number {
  const labels = domain.split(".");
  const tld = labels[labels.length - 1] ?? "";
  const sld = labels[labels.length - 2] ?? "";
  return labels.length >= 3 && tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
}

/** The DNS records to show the business, from Vercel's answer. Read defensively: a missing field is skipped. */
export function recordsFrom(domain: string, data: Record<string, unknown>, config?: Record<string, unknown>): DnsRecord[] {
  const out: DnsRecord[] = [];
  const verification = (data.verification as Verification[] | undefined) ?? [];
  for (const v of verification) {
    if (v.type && v.domain && v.value) out.push({ type: String(v.type).toUpperCase(), name: v.domain, value: v.value });
  }
  const cname = (config?.recommendedCNAME as Array<{ value?: string }> | undefined)?.[0]?.value;
  const aRecord = (config?.recommendedIPv4 as Array<{ value?: string[] }> | undefined)?.[0]?.value?.[0];
  const labels = domain.split(".");
  const apex = apexLabels(domain);
  if (labels.length === apex) {
    if (aRecord) out.push({ type: "A", name: "@", value: aRecord });
  } else if (cname) {
    out.push({ type: "CNAME", name: labels.slice(0, labels.length - apex).join("."), value: cname });
  }
  return out;
}

/** Adds the domain to the project. Safe to repeat: an existing domain is read back, not added twice. */
export async function connectDomain(domain: string, f: Fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<DomainState> {
  const problem = domainProblem(domain);
  if (problem) throw new DomainError(problem, 422);
  let data: Record<string, unknown>;
  try {
    data = await call(f, env, "POST", "/v10/projects/{project}/domains", { name: domain });
  } catch (e) {
    if (e instanceof DomainError && e.status === 409) data = await call(f, env, "GET", `/v9/projects/{project}/domains/${encodeURIComponent(domain)}`);
    else throw e;
  }
  return domainState(domain, data, f, env);
}

/** Where a domain has got to: verified, and the DNS records if not. */
export async function domainState(domain: string, data: Record<string, unknown> | null, f: Fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<DomainState> {
  const d = data ?? (await call(f, env, "GET", `/v9/projects/{project}/domains/${encodeURIComponent(domain)}`));
  const verified = d.verified === true;
  let config: Record<string, unknown> | undefined;
  if (!verified) {
    try { config = await call(f, env, "GET", `/v6/domains/${encodeURIComponent(domain)}/config`); } catch { config = undefined; }
  }
  const records = verified ? [] : recordsFrom(domain, d, config);
  return {
    domain,
    verified,
    records,
    next: verified
      ? "Connected. The website now answers on this address."
      : "Ask the business to add these DNS records at its domain provider, then press Check. It can take a few minutes to a day to take effect.",
  };
}

/** Asks Vercel to check the DNS again, then reports where the domain has got to. */
export async function checkDomain(domain: string, f: Fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<DomainState> {
  const problem = domainProblem(domain);
  if (problem) throw new DomainError(problem, 422);
  let data: Record<string, unknown>;
  try {
    data = await call(f, env, "POST", `/v9/projects/{project}/domains/${encodeURIComponent(domain)}/verify`);
  } catch {
    data = await call(f, env, "GET", `/v9/projects/{project}/domains/${encodeURIComponent(domain)}`);
  }
  return domainState(domain, data, f, env);
}
