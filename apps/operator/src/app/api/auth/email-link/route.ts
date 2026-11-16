// "Email me a sign-in code" on the operator sign-in screen: no password needed. Emails a six-digit
// code (typed into the app) and, as a fallback for computers, a one-time link to
// /set-password?type=magiclink, which signs the person in. Only people who already have a
// staff role (or the platform owner) get an email; everyone else gets the same reply and nothing is
// sent, so the form cannot be used to find out who has an account, and it never creates an account.
import { signInLink } from "@/lib/email/staff.js";
import { signInLinkPlatform } from "@/lib/email/platform.js";
import { loadBrand } from "@/lib/server/brands";
import { adminClient, appOrigin, isEmail, json, sendEmail, sendPlatformEmail, setPasswordUrl, STAFF_ROLES } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DONE = { ok: true, message: "If that email belongs to a team member, a sign-in code is on its way. It works once and expires in an hour." };

// A small best-effort limit so the form cannot be used to flood someone's inbox: at most 5 requests
// per address and 20 per visitor in 15 minutes. Kept in memory, so it slows a flood rather than
// counting exactly across servers.
const WINDOW_MS = 15 * 60 * 1000;
const hits = new Map<string, number[]>();
function limited(key: string, max: number, now = Date.now()) {
  const fresh = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= max) { hits.set(key, fresh); return true; }
  fresh.push(now); hits.set(key, fresh);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "Email sign-in isn't set up yet. Ask your admin." }, 503);
  let email = "";
  try { email = String((await req.json())?.email ?? "").trim().toLowerCase(); } catch { /* fall through */ }
  if (!isEmail(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 422);

  const visitor = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(`e:${email}`, 5) || limited(`ip:${visitor}`, 20)) return json({ error: "Too many requests. Please wait a few minutes and try again." }, 429);

  try {
    // A recovery link only exists for an account that already exists (it creates nothing).
    const probe = await admin.auth.admin.generateLink({ type: "recovery", email });
    const user = probe.data?.user;
    if (probe.error || !user) return json(DONE);
    const { data: roles } = await admin.from("tenant_users").select("tenant_id, role").eq("user_id", user.id);
    const staff = (roles ?? []).find((r) => r.role === "super_admin" || (STAFF_ROLES as readonly string[]).includes(r.role));
    if (!staff) return json(DONE);

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const token = link.data?.properties?.hashed_token;
    // The six-digit code for the same one-time sign-in: typed into the app, so an iPhone's
    // Home Screen app never has to hand over to Safari.
    const code = link.data?.properties?.email_otp ?? "";
    if (link.error || !token) return json(DONE);
    const url = setPasswordUrl(appOrigin(req), token, "magiclink");

    if (staff.tenant_id) {
      const { data: tenant } = await admin.from("tenants").select("name").eq("id", staff.tenant_id).maybeSingle();
      await loadBrand(admin, staff.tenant_id);
      await sendEmail(email, signInLink({ tenant_id: staff.tenant_id, businessName: tenant?.name || "your", url, code }), staff.tenant_id);
    } else {
      await sendPlatformEmail(email, signInLinkPlatform({ url, code }));
    }
  } catch (e) {
    console.error("[email-link]", (e as Error).message);
  }
  return json(DONE);
}
