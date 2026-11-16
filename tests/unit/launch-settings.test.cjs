'use strict';
// Launch readiness, part 1: the platform fails safely when settings are missing, says so clearly,
// never reports a value, and never falls back to a hard-coded live database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const cfg = require('../../lib/config');

function withEnv(vars, fn) {
  const keep = {};
  for (const k of Object.keys(vars)) { keep[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of Object.keys(vars)) { if (keep[k] == null) delete process.env[k]; else process.env[k] = keep[k]; } }
}
async function withEnvAsync(vars, fn) {
  const keep = {};
  for (const k of Object.keys(vars)) { keep[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(vars)) { if (keep[k] == null) delete process.env[k]; else process.env[k] = keep[k]; } }
}
function captureWarnings(fn) {
  const seen = []; const orig = console.warn;
  console.warn = (...a) => seen.push(a.join(' '));
  try { fn(); } finally { console.warn = orig; }
  return seen;
}
const fakeRes = () => ({ statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b || ''; } });

test.beforeEach(() => cfg._resetWarnings());

// ── health ──────────────────────────────────────────────────────────────────────────────────
test('health reports every setting as true or false, and lists the required ones that are missing', () => {
  const none = cfg.health({});
  assert.equal(none.ok, false);
  for (const v of Object.values(none.settings)) assert.equal(typeof v, 'boolean');
  assert.ok(none.missingRequired.includes('CRON_SECRET'));
  assert.ok(none.missingRequired.includes('OPERATOR_ACTION_SECRET'));
  assert.ok(none.missingRequired.includes('SUPABASE_URL'));
  assert.ok(!none.missingRequired.includes('GOOGLE_MAPS_API_KEY'), 'the Maps key is optional');
});

test('health counts a public twin as the same setting, and is ok once every required one is set', () => {
  const env = {};
  for (const s of cfg.SETTINGS) if (s.required) env[(s.any || [s.name]).slice(-1)[0]] = 'x';
  const h = cfg.health(env);
  assert.equal(h.ok, true, JSON.stringify(h.missingRequired));
  assert.equal(h.settings.SUPABASE_URL, true, 'NEXT_PUBLIC_SUPABASE_URL counts');
});

test('health never returns a value, only names and true or false', () => {
  const secret = 'sk_live_THIS_MUST_NEVER_APPEAR_1234567890';
  const h = cfg.health({ CRON_SECRET: secret, STRIPE_PLATFORM_SECRET_KEY: secret, SUPABASE_URL: 'https://leak.supabase.co', RESEND_API_KEY: secret });
  const text = JSON.stringify(h);
  assert.ok(!text.includes('THIS_MUST_NEVER_APPEAR'));
  assert.ok(!text.includes('leak.supabase.co'));
  assert.equal(h.settings.CRON_SECRET, true);
});

test('GET /api/health answers 503 with the missing names when settings are absent, and 200 when all are set', async () => {
  const handler = require('../../api/booking/index.js');
  const names = cfg.SETTINGS.filter((s) => s.required).flatMap((s) => (s.any || [s.name]));
  const cleared = Object.fromEntries(names.map((n) => [n, null]));
  const bad = fakeRes();
  await withEnvAsync(cleared, () => handler({ method: 'GET', url: '/api/booking/index.js?r=health', headers: {} }, bad));
  assert.equal(bad.statusCode, 503);
  const body = JSON.parse(bad.body);
  assert.equal(body.ok, false);
  assert.ok(body.missingRequired.includes('CRON_SECRET'));
  assert.match(bad.headers['Cache-Control'], /no-store/);

  const set = Object.fromEntries(names.map((n) => [n, 'present-but-never-shown']));
  const good = fakeRes();
  await withEnvAsync(set, () => handler({ method: 'GET', url: '/api/booking/index.js?r=health', headers: {} }, good));
  assert.equal(good.statusCode, 200);
  assert.ok(!good.body.includes('present-but-never-shown'));
  assert.equal(JSON.parse(good.body).ok, true);
});

test('the health route is wired in vercel.json without adding a function', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const r = v.routes.find((x) => x.src === '/api/health');
  assert.ok(r && /r=health/.test(r.dest));
  assert.ok(!v.builds.some((b) => /health/.test(b.src)), 'it rides on the booking function');
});

// ── CRON_SECRET ─────────────────────────────────────────────────────────────────────────────
test('cron routes refuse everything without CRON_SECRET and say why, once, without any secret value', () => {
  const warnings = captureWarnings(() => {
    assert.equal(cfg.cronAuthorised({ headers: { authorization: 'Bearer anything' } }, {}), false);
    assert.equal(cfg.cronAuthorised({ headers: {} }, {}), false);
    assert.equal(cfg.cronAuthorised({ headers: { authorization: 'Bearer anything' } }, {}), false);
  });
  assert.equal(warnings.length, 1, 'one clear warning, not one per request');
  assert.match(warnings[0], /CRON_SECRET is not set/);
  assert.match(warnings[0], /openssl rand -hex 32/);
});

test('cron routes accept only the exact bearer token when CRON_SECRET is set', () => {
  const env = { CRON_SECRET: 'abc123def456' };
  assert.equal(cfg.cronAuthorised({ headers: { authorization: 'Bearer abc123def456' } }, env), true);
  assert.equal(cfg.cronAuthorised({ headers: { authorization: 'Bearer abc123def457' } }, env), false);
  assert.equal(cfg.cronAuthorised({ headers: { authorization: 'abc123def456' } }, env), false);
  assert.equal(cfg.cronAuthorised({ headers: {} }, env), false);
});

test('the reminders, flight and retry routes all return 401 without CRON_SECRET (the retry sweep used to be open)', async () => {
  for (const [file, url] of [['../../api/reminders/trigger.js', '/api/reminders/trigger'], ['../../api/flight/reverify.js', '/api/flight/reverify'], ['../../api/notifications/index.js', '/api/notifications/retry']]) {
    const handler = require(file);
    const res = fakeRes();
    await withEnvAsync({ CRON_SECRET: null }, () => handler({ method: 'GET', url, headers: {} }, res));
    assert.equal(res.statusCode, 401, `${url} must refuse without a secret`);
    assert.doesNotMatch(res.body, /Bearer/);
  }
});

// ── SUPABASE_URL ────────────────────────────────────────────────────────────────────────────
test('SUPABASE_URL: production refuses to start without it, and nothing falls back to a live project', () => {
  const supabaseUrl = require('../../lib/supabaseUrl');
  withEnv({ SUPABASE_URL: null, NEXT_PUBLIC_SUPABASE_URL: null, VERCEL_ENV: 'production' }, () => {
    assert.throws(() => supabaseUrl(), /SUPABASE_URL is not set/);
  });
  const warnings = captureWarnings(() => withEnv({ SUPABASE_URL: null, NEXT_PUBLIC_SUPABASE_URL: null, VERCEL_ENV: 'preview' }, () => {
    assert.equal(supabaseUrl(), '', 'no guessing outside production either');
  }));
  assert.ok(warnings.every((w) => /SUPABASE_URL is not set/.test(w)));
  withEnv({ SUPABASE_URL: 'https://mine.supabase.co/', VERCEL_ENV: 'production' }, () => assert.equal(supabaseUrl(), 'https://mine.supabase.co'));
  withEnv({ SUPABASE_URL: null, NEXT_PUBLIC_SUPABASE_URL: 'https://pub.supabase.co', VERCEL_ENV: 'production' }, () => assert.equal(supabaseUrl(), 'https://pub.supabase.co'));
});

test('no website code hard-codes a Supabase project address', () => {
  const offenders = [];
  const skip = new Set(['node_modules', '.next', '.git', 'docs', 'tests', 'supabase']);
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!p.includes(path.join('apps', 'operator', '.next'))) walk(p); continue; }
      if (!/\.(js|cjs|mjs|html|json)$/.test(e.name) || e.name === 'package-lock.json') continue;
      if (/https:\/\/[a-z0-9]{20}\.supabase\.co/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(ROOT, p));
    }
  })(ROOT);
  assert.deepEqual(offenders, []);
});

// ── OPERATOR_ACTION_SECRET ──────────────────────────────────────────────────────────────────
test('action links are signed when OPERATOR_ACTION_SECRET is set', () => {
  withEnv({ OPERATOR_ACTION_SECRET: 'test-secret-value' }, () => {
    const { actionLinks } = require('../../lib/actionLinks');
    const l = actionLinks({ id: 'b-1' }, 'https://cars.example.test/');
    assert.equal(l.signed, true);
    assert.match(l.accept, /^https:\/\/cars\.example\.test\/api\/operator\/accept\?id=b-1&token=[0-9a-f]{64}$/);
    assert.match(l.reject, /\/api\/operator\/reject\?id=b-1&token=/);
    assert.match(l.cancel, /\/api\/booking\/cancel\?id=b-1&token=/);
    assert.equal(l.openUrl, null);
  });
});

test('without OPERATOR_ACTION_SECRET nothing is signed, the cancel link falls back to the booking page, and it is logged once', () => {
  const { actionLinks } = require('../../lib/actionLinks');
  const warnings = captureWarnings(() => withEnv({ OPERATOR_ACTION_SECRET: null }, () => {
    const l = actionLinks({ id: 'b-2' }, 'https://cars.example.test');
    assert.equal(l.signed, false);
    assert.equal(l.accept, null);
    assert.equal(l.reject, null);
    assert.equal(l.cancel, 'https://cars.example.test/booking?id=b-2');
    assert.match(l.openUrl, /\/operator\/bookings$/);
    actionLinks({ id: 'b-3' }, 'https://cars.example.test');
  }));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /OPERATOR_ACTION_SECRET is not set/);
});

test('the staff email says "open your booking in the operator app" when signing is not available, with no dead Accept and Reject buttons', () => {
  const E = require('../../lib/emailContent');
  const b = { customer_name: 'Priya Shah', customer_phone: '07700900123', travel_date: '2027-01-05', travel_time: '09:30:00', pickup_location: '14 Mill Lane, Leeds', dropoff_address: 'Leeds Bradford Airport' };
  const unsigned = E.staffNewBooking(b, { acceptUrl: null, rejectUrl: null, openUrl: 'https://app.example.test/operator/bookings' });
  assert.match(unsigned.text, /Open your booking in the operator app/);
  assert.match(unsigned.html, /Open in the operator app/);
  assert.doesNotMatch(unsigned.html, />Accept</);
  assert.doesNotMatch(unsigned.html, />Reject</);
  const signed = E.staffNewBooking(b, { acceptUrl: 'https://x.test/a', rejectUrl: 'https://x.test/r' });
  assert.match(signed.html, />Accept</);
  assert.match(signed.html, />Reject</);
  assert.doesNotMatch(signed.text, /Open your booking in the operator app to accept/);
});

test('the operator job-offer text message says where to act when there are no signed links', () => {
  const { buildOperatorJobOfferSms } = require('../../lib/format');
  const b = { customer_name: 'Priya Shah', customer_phone: '07700900123', travel_date: '2027-01-05', travel_time: '09:30:00', pickup_location: '14 Mill Lane', dropoff_address: 'Airport', quoted_price: 70 };
  assert.match(buildOperatorJobOfferSms(b, null, null, 'https://app.example.test/operator/bookings'), /Open your booking in the operator app to accept or reject: https:\/\/app\.example\.test/);
  const signed = buildOperatorJobOfferSms(b, 'https://x.test/a', 'https://x.test/r');
  assert.match(signed, /Accept: https:\/\/x\.test\/a/);
  assert.match(signed, /Reject: https:\/\/x\.test\/r/);
});

test('both copies of the staff email are in step (website and Operator app)', () => {
  const grab = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').match(/function staffNewBooking[\s\S]*?\n}\n/)[0];
  assert.equal(grab('lib/emailContent.js'), grab('apps/operator/src/lib/email/content.js'));
});

// ── Google Maps ─────────────────────────────────────────────────────────────────────────────
test('the booking form works with plain address fields and draws no map, frame or Maps script, key or no key', () => {
  const site = require('../../lib/tenantSite');
  const T = { id: 'cccccccc-0000-4000-8000-000000000002', slug: 'sample-cars', name: 'Sample Cars', contact_email: 'desk@sample.test', contact_phone: '07700900123', brand: { site_url: 'https://www.sample-cars.test' }, pricing: { airports: [{ name: 'Leeds Bradford Airport', code: 'LBA', one_way: 70, return_fare: 130 }], extra_stop: 8 }, updated_at: '2026-11-13T10:00:00Z' };
  site._setTenants([T]);
  for (const key of [null, 'AIza-not-a-real-key']) {
    withEnv({ GOOGLE_MAPS_API_KEY: key, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: key }, () => {
      const home = site.homePage(T);
      for (const html of [home, site.bookingPage(T)]) assert.doesNotMatch(html, /maps\.googleapis\.com|google\.maps|<iframe/i);
      assert.match(home, /<input id="address" name="address"[^>]*required>/, 'a plain address field');
    });
  }
});

test('/api/config hands the browser an empty Maps key rather than failing when none is set', async () => {
  const handler = require('../../api/booking/index.js');
  const res = fakeRes();
  await withEnvAsync({ GOOGLE_MAPS_API_KEY: null, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: null }, () => handler({ method: 'GET', url: '/api/config', headers: { host: 'winjo-dispatch.vercel.app' } }, res));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).googleMapsApiKey, '');
});

// ── Docs ────────────────────────────────────────────────────────────────────────────────────
test('every setting the platform checks is explained in docs/ENVIRONMENT.md and listed in .env.example', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'ENVIRONMENT.md'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  for (const s of cfg.SETTINGS) {
    assert.ok(doc.includes('`' + s.name), `docs/ENVIRONMENT.md does not mention ${s.name}`);
    assert.ok(new RegExp('^#?\\s*' + s.name + '=', 'm').test(example), `.env.example does not list ${s.name}`);
  }
  assert.match(doc, /openssl rand -hex 32/);
});
