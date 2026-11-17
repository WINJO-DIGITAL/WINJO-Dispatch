// Platform owner only (Settings, Platform): connects a business's own domain to the platform's
// project, and reports whether its DNS is in place.
//   POST { domain, action: "connect" | "check" } -> { domain, verified, records, next }
// Nothing here changes a business's website address: that is still saved with set_tenant_site,
// and only after the domain is verified. Server only.
import { DomainError, checkDomain, connectDomain, domainOf } from "@/lib/server/vercelDomains";
import { adminClient, getSuperAdmin, json } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "not configured" }, 503);
  const owner = await getSuperAdmin(req, admin);
  if (!owner) return json({ error: "Only the platform owner can connect a domain." }, 403);

  let body: { domain?: string; action?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid body." }, 400); }
  const domain = domainOf(String(body.domain ?? ""));
  if (!domain) return json({ error: "Enter the business's domain, for example www.example.co.uk." }, 422);

  try {
    const state = body.action === "check" ? await checkDomain(domain) : await connectDomain(domain);
    return json(state);
  } catch (e) {
    if (e instanceof DomainError) return json({ error: e.message }, e.status);
    console.error("platform/domains:", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
