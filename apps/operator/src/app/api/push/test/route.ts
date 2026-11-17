import webpush from "web-push";
import { adminClient, json, userFromToken } from "@/lib/server/staff";

// "Send a test notification to this device" (Settings, Notifications).
//
// Staff only (the same roles that may register a device: super_admin, operator_admin, dispatcher),
// and it only ever sends to the CALLER'S OWN subscriptions. The request body may name one of the
// caller's devices (`endpoint`) to test just that one; any other field, including a user id, is
// ignored. It sends a fixed harmless message. The platform's alert keys come from the locked
// push_config table through the server's service-role key; nothing about them is returned.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFICE_ROLES = ["super_admin", "operator_admin", "dispatcher"];

// At most 6 tests per person in 10 minutes, so the button cannot be used to flood a phone.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TESTS = 6;
const hits = new Map<string, number[]>();
function limited(key: string, now = Date.now()) {
  const fresh = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= MAX_TESTS) { hits.set(key, fresh); return true; }
  fresh.push(now); hits.set(key, fresh);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}
export const _resetLimits = () => hits.clear();

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ ok: false, error: "Push isn't set up on the server yet." }, 503);

  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "Sign in again, then try the test." }, 401);
  const user = await userFromToken(admin, token);
  if (!user) return json({ ok: false, error: "Sign in again, then try the test." }, 401);

  const { data: roles } = await admin.from("tenant_users").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r) => OFFICE_ROLES.includes(String(r.role)))) {
    return json({ ok: false, error: "Only office staff can send a test notification." }, 403);
  }

  if (limited(user.id)) return json({ ok: false, error: "That's enough tests for now. Wait a few minutes and try again." }, 429);

  let endpoint = "";
  try {
    const body = await req.json();
    if (body && typeof body.endpoint === "string") endpoint = body.endpoint.trim();
  } catch { /* no body: test every device of this account */ }

  const { data: cfg } = await admin.from("push_config").select("vapid_public, vapid_private, vapid_subject").eq("id", true).maybeSingle();
  if (!cfg?.vapid_public || !cfg?.vapid_private) {
    return json({ ok: false, error: "The platform's alert keys aren't set up yet, so no alert can be sent. Ask the platform owner." }, 503);
  }

  // Only this person's own devices, whatever the request says.
  let q = admin.from("operator_push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user.id);
  if (endpoint) q = q.eq("endpoint", endpoint);
  const { data: subs } = await q;
  const devices = subs ?? [];
  if (devices.length === 0) {
    return json({
      ok: false,
      error: endpoint
        ? "This device isn't registered for your account. Turn notifications off, then on again, and retry."
        : "No device is subscribed for your account yet. Turn on notifications on this device first.",
    }, 404);
  }

  webpush.setVapidDetails(cfg.vapid_subject || "mailto:hello@winjodigital.co.uk", cfg.vapid_public, cfg.vapid_private);
  const payload = JSON.stringify({
    title: "Test notification",
    body: "Alerts are working on this device.",
    url: "/operator/settings?section=notifications",
    tag: "push-test",
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;
  await Promise.all(devices.map(async (d) => {
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload);
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        // The device has unsubscribed or expired: forget it, so it stops counting as a working device.
        await admin.from("operator_push_subscriptions").delete().eq("endpoint", d.endpoint).eq("user_id", user.id);
        removed++;
      } else {
        failed++;
      }
    }
  }));

  const total = devices.length;
  if (sent === total) {
    return json({ ok: true, sent, failed, removed, total, message: `Test notification sent to ${plural(sent, "device", "devices")}. It should arrive in a few seconds.` });
  }
  if (sent > 0) {
    const bad = failed + removed;
    return json({ ok: true, sent, failed, removed, total, message: `Sent to ${sent} of ${plural(total, "device", "devices")}. ${plural(bad, "device didn't", "devices didn't")} receive it${removed ? ` (${removed} expired and ${removed === 1 ? "was" : "were"} removed: turn notifications off and on again on ${removed === 1 ? "it" : "them"})` : ""}.` });
  }
  return json({
    ok: false, sent, failed, removed, total,
    error: removed === total
      ? "This device's subscription has expired and was removed. Turn notifications off, then on again, and retry."
      : "The push service refused the test message. Try again in a minute; if it keeps failing, turn notifications off and on again.",
  }, 502);
}
