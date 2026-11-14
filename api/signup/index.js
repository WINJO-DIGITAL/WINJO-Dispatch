'use strict';

// Self-serve sign-up.  POST /api/signup/apply
//
// A business gives its details and accepts the Operator Services Agreement and Schedule A. The
// application is stored (service role) and the platform owner is told. Nothing is created for
// the business and nothing is charged: the owner invoices the set-up fee, confirms payment and
// approves (database functions in supabase/pending/20261114100000_signup_applications.sql).

const { tooMany } = require('../../lib/rateLimit');
const { parseBody } = require('../../lib/parse');
const { validate, CONTRACT_VERSION, RESPONSIBILITIES_VERSION } = require('../../lib/signup');
const { sendPlatformMail, applicantAck, ownerAlert, ref } = require('../../lib/platformMail');

const SUPABASE_URL = () => require('../../lib/supabaseUrl')();
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
// Used only if the fee settings cannot be read. They match the platform_fees defaults.
const FALLBACK_FEES = { setup_pence: 99900, monthly_pence: 9900 };

const db = (extra = {}) => ({ 'Content-Type': 'application/json', apikey: KEY(), Authorization: `Bearer ${KEY()}`, ...extra });
const send = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.end(JSON.stringify(body)); };

async function rows(path) {
  const r = await fetch(`${SUPABASE_URL()}/rest/v1/${path}`, { headers: db() });
  if (!r.ok) throw new Error(`lookup failed ${r.status}`);
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

async function currentFees() {
  try {
    const [f] = await rows('platform_fees?select=default_setup_pence,default_monthly_pence&limit=1');
    if (f && Number.isInteger(f.default_setup_pence) && Number.isInteger(f.default_monthly_pence)) return { setup_pence: f.default_setup_pence, monthly_pence: f.default_monthly_pence };
  } catch (_) { /* use the fallback */ }
  return FALLBACK_FEES;
}

async function apply(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  if (tooMany(req, res, 'signup', 5, 3600)) return;
  if (!KEY()) return send(res, 503, { error: 'Sign-up is not available right now. Please try again later.' });

  let body;
  try { body = await parseBody(req); } catch { return send(res, 400, { error: 'We could not read that. Please try again.' }); }
  body = body && typeof body === 'object' ? body : {};

  // A hidden field real visitors never fill in: pretend it worked, store nothing.
  if (String(body.company_website || '').trim()) return send(res, 201, { ok: true, reference: 'PENDING' });

  const { errors, clean } = validate(body);
  if (!clean) return send(res, 422, { error: 'Please check the highlighted details.', fields: errors });

  try {
    const [tenant, open] = await Promise.all([
      rows(`tenants?slug=eq.${encodeURIComponent(clean.slug)}&select=id&limit=1`),
      rows(`signup_applications?slug=eq.${encodeURIComponent(clean.slug)}&status=in.(awaiting_payment,paid,approved)&select=id&limit=1`),
    ]);
    if (tenant.length || open.length) return send(res, 409, { error: 'That short name is already taken. Please choose another.', fields: { slug: 'That short name is already taken.' } });

    const fees = await currentFees();
    const row = { ...clean, contract_version: CONTRACT_VERSION, responsibilities_version: RESPONSIBILITIES_VERSION, ...fees };
    const r = await fetch(`${SUPABASE_URL()}/rest/v1/signup_applications`, { method: 'POST', headers: db({ Prefer: 'return=representation' }), body: JSON.stringify(row) });
    if (r.status === 409) return send(res, 409, { error: 'That short name is already taken. Please choose another.', fields: { slug: 'That short name is already taken.' } });
    if (!r.ok) throw new Error(`save failed ${r.status}`);
    const [saved] = await r.json();
    const app = { ...row, ...(saved || {}) };

    // Emails are best effort: the application is already saved, so a mail problem never loses it.
    const host = String((req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '').split(',')[0];
    const termsUrl = process.env.PLATFORM_SITE_URL ? `${String(process.env.PLATFORM_SITE_URL).replace(/\/$/, '')}/platform-terms` : (host ? `https://${host}/platform-terms` : '');
    const jobs = [sendPlatformMail({ to: clean.contact_email, ...applicantAck(app, { termsUrl }) })];
    const owner = String(process.env.PLATFORM_OWNER_EMAIL || '').trim();
    if (owner) jobs.push(sendPlatformMail({ to: owner, ...ownerAlert(app) }));
    else console.warn('[signup] PLATFORM_OWNER_EMAIL is not set: the owner was not emailed about this application');
    (await Promise.allSettled(jobs)).forEach((x) => { if (x.status === 'rejected') console.error('[signup] email failed:', x.reason && x.reason.message); else if (x.value && x.value.skipped) console.warn('[signup] email skipped: PLATFORM_FROM or RESEND_API_KEY not set'); });

    return send(res, 201, { ok: true, reference: ref(app.id), setup_pence: fees.setup_pence, monthly_pence: fees.monthly_pence });
  } catch (err) {
    console.error('[signup] failed:', err.message);
    return send(res, 500, { error: 'We could not save your application. Please try again in a few minutes.' });
  }
}

module.exports = async function handler(req, res) {
  const path = String(req.url || '').split('?')[0];
  if (path.endsWith('/apply')) return apply(req, res);
  return send(res, 404, { error: 'Not found' });
};
module.exports.apply = apply;
