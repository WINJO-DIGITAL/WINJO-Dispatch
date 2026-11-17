'use strict';

// The settings the platform reads from its environment, and what happens without each one.
// One list drives three things so they cannot disagree: the one-time warnings in the logs, the
// /api/health report and docs/ENVIRONMENT.md. Names and true/false only: values are never read
// out, logged or returned from here.

// `any` = the setting counts as present if any of these names is set (a public twin of the same value).
// `required` = launch cannot work without it. `without` = what stops working.
const SETTINGS = [
  { name: 'SUPABASE_URL', any: ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'], required: true, without: 'Nothing works: there is no database to talk to. Production refuses to start.' },
  { name: 'SUPABASE_ANON_KEY', any: ['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'], required: true, without: 'Public reads (reviews, price list, the booking form config) fail.' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, without: 'Server writes fail: bookings, sign-up applications, reminders, flight re-checks.' },
  { name: 'CRON_SECRET', required: true, without: 'Daily reminders, flight re-checks and the email retry sweep are refused (401).' },
  { name: 'OPERATOR_ACTION_SECRET', required: true, without: 'The Accept, Reject and Cancel links in emails cannot be signed. Emails tell staff to open the booking in the operator app instead.' },
  { name: 'RESEND_API_KEY', required: true, without: 'No email is sent.' },
  { name: 'PLATFORM_FROM', required: true, without: 'No sign-up or platform emails are sent.' },
  { name: 'STRIPE_PLATFORM_SECRET_KEY', required: true, without: 'No card payments and no "Connect Stripe" button. Cash still works.' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, without: 'A paid card checkout is not marked Paid by the webhook.' },
  { name: 'STRIPE_CONNECT_WEBHOOK_SECRET', required: true, without: 'Payments on a business\'s own Stripe account are not marked Paid by the webhook.' },
  { name: 'GOOGLE_MAPS_API_KEY', any: ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'], required: false, without: 'No map or address suggestions: the booking form uses plain address fields instead.' },
  { name: 'VAPID_PUBLIC_KEY', any: ['VAPID_PUBLIC_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY'], required: false, without: 'Website-side web push to customers is off. Office alerts use the keys stored in the database.' },
  { name: 'VAPID_PRIVATE_KEY', required: false, without: 'Website-side web push to customers is off.' },
  { name: 'PLATFORM_OWNER_EMAIL', required: false, without: 'The owner is not emailed about new sign-up applications.' },
  { name: 'PLATFORM_REPLY_TO', required: false, without: 'Platform emails have no reply-to address.' },
  { name: 'SITE_URL', required: false, without: 'The platform address is used for links.' },
];

const isSet = (env, s) => (s.any || [s.name]).some((n) => String(env[n] == null ? '' : env[n]).trim() !== '');

/** True or false for every setting, and which required ones are missing. No values. */
function health(env = process.env) {
  const settings = {};
  const missing = [];
  for (const s of SETTINGS) {
    const ok = isSet(env, s);
    settings[s.name] = ok;
    if (s.required && !ok) missing.push(s.name);
  }
  return { ok: missing.length === 0, settings, missingRequired: missing };
}

const warned = new Set();
/** Logs a warning once per server instance, so a missing setting is obvious without flooding the logs. */
function warnOnce(key, message) {
  if (warned.has(key)) return false;
  warned.add(key);
  console.warn(`[config] ${message}`);
  return true;
}
const _resetWarnings = () => warned.clear();

const CRON_MESSAGE = 'CRON_SECRET is not set, so the scheduled routes (/api/reminders/trigger, /api/flight/reverify, /api/notifications/retry) refuse every request with 401: daily reminders, flight re-checks and the email retry sweep are NOT running. Set CRON_SECRET in Vercel (generate one with: openssl rand -hex 32) and redeploy.';

/**
 * Cron routes: true only when the request carries `Authorization: Bearer $CRON_SECRET`.
 * With no CRON_SECRET it refuses everything (fail closed) and says why, once.
 */
function cronAuthorised(req, env = process.env) {
  const secret = env.CRON_SECRET;
  if (!secret) { warnOnce('CRON_SECRET', CRON_MESSAGE); return false; }
  const header = (req.headers && req.headers.authorization) || '';
  const want = `Bearer ${secret}`;
  if (header.length !== want.length) return false;
  return require('crypto').timingSafeEqual(Buffer.from(header), Buffer.from(want));
}

module.exports = { SETTINGS, health, warnOnce, cronAuthorised, _resetWarnings, CRON_MESSAGE };
