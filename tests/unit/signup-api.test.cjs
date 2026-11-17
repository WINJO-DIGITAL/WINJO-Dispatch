'use strict';
process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-unit';
process.env.RESEND_API_KEY = 're_unit';
process.env.PLATFORM_FROM = 'Winjo Digital <hello@platform.test>';
process.env.PLATFORM_OWNER_EMAIL = 'owner@platform.test';
process.env.PLATFORM_SITE_URL = 'https://platform.test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const handler = require('../../api/signup/index.js');

let db; let sent; let reject;
function reset(over = {}) {
  db = { tenants: [], open: [], fees: [{ default_setup_pence: 99900, default_monthly_pence: 9900 }], saved: [], saveStatus: 201, ...over };
  sent = []; reject = false;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(url); const method = (opts.method || 'GET').toUpperCase();
    const json = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b, text: async () => JSON.stringify(b) });
    if (u.host === 'api.resend.com') { if (reject) return json({}, 500); sent.push(JSON.parse(opts.body)); return json({ id: 'x' }); }
    const t = u.pathname.replace('/rest/v1/', '');
    if (method === 'POST' && t === 'signup_applications') {
      if (db.saveStatus !== 201) return json({}, db.saveStatus);
      const row = { id: '11111111-2222-3333-4444-555555555555', ...JSON.parse(opts.body) }; db.saved.push(row); return json([row], 201);
    }
    if (t === 'tenants') return json(db.tenants);
    if (t === 'signup_applications') return json(db.open);
    if (t === 'platform_fees') return json(db.fees);
    return json([]);
  };
}
let n = 0;
function call(body, { method = 'POST', ip } = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body || {}))]);
  req.url = '/api/signup/apply'; req.method = method; req.query = {};
  req.headers = { 'x-forwarded-for': ip || `10.0.0.${++n}`, host: 'platform.test' };
  let done; const finished = new Promise((r) => { done = r; });
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { done({ status: this.statusCode, body: b ? JSON.parse(b) : null, headers: this.headers }); } };
  return Promise.race([handler(req, res).then(() => finished), new Promise((r) => setTimeout(() => r({ status: 0 }), 2000))]);
}
const good = (o = {}) => ({ business_name: 'Moor Cars Ltd', slug: 'moor-cars', contact_name: 'Sam Moor', contact_email: 'sam@moor.test', contact_phone: '07700 900001', accept_contract: true, accept_responsibilities: true, ...o });

test('a valid application is stored with the current fees and the accepted versions', async () => {
  reset();
  const r = await call(good());
  assert.equal(r.status, 201);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.reference, '11111111');
  assert.equal(db.saved.length, 1);
  const s = db.saved[0];
  assert.equal(s.slug, 'moor-cars'); assert.equal(s.setup_pence, 99900); assert.equal(s.monthly_pence, 9900);
  assert.equal(s.contract_version, '4'); assert.equal(s.responsibilities_version, '2');
  assert.equal(r.headers['Cache-Control'], 'no-store');
});

test('the fees come from the database settings, not from the browser', async () => {
  reset({ fees: [{ default_setup_pence: 50000, default_monthly_pence: 4900 }] });
  await call(good({ setup_pence: 1, monthly_pence: 1 }));
  assert.equal(db.saved[0].setup_pence, 50000); assert.equal(db.saved[0].monthly_pence, 4900);
});

test('if the fee settings cannot be read the standard fees are used', async () => {
  reset({ fees: 'broken' });
  await call(good());
  assert.equal(db.saved[0].setup_pence, 99900);
});

test('the applicant and the owner are both emailed, from the platform address only', async () => {
  reset();
  await call(good());
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((m) => m.to[0]).sort(), ['owner@platform.test', 'sam@moor.test']);
  for (const m of sent) assert.equal(m.from, 'Winjo Digital <hello@platform.test>');
  const ack = sent.find((m) => m.to[0] === 'sam@moor.test');
  assert.match(ack.text, /£999/); assert.match(ack.text, /£99/); assert.match(ack.text, /https:\/\/platform\.test\/platform-terms/);
  assert.doesNotMatch(JSON.stringify(sent), /Acme Cars/i);
});

test('nothing is stored unless both boxes are ticked', async () => {
  reset();
  const a = await call(good({ accept_contract: false }));
  const b = await call(good({ accept_responsibilities: undefined }));
  assert.equal(a.status, 422); assert.ok(a.body.fields.accept_contract);
  assert.equal(b.status, 422); assert.ok(b.body.fields.accept_responsibilities);
  assert.equal(db.saved.length, 0); assert.equal(sent.length, 0);
});

test('bad details give a 422 naming each field', async () => {
  reset();
  const r = await call(good({ contact_email: 'nope', slug: 'Bad Name', business_name: '' }));
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(r.body.fields).sort(), ['business_name', 'contact_email', 'slug']);
  assert.equal(db.saved.length, 0);
});

test('a short name already used by a business or an open application is refused', async () => {
  reset({ tenants: [{ id: 't1' }] });
  assert.equal((await call(good())).status, 409);
  reset({ open: [{ id: 'a1' }] });
  const r = await call(good());
  assert.equal(r.status, 409); assert.ok(r.body.fields.slug);
  assert.equal(db.saved.length, 0);
});

test('a race on the same short name is turned into the same friendly answer', async () => {
  reset({ saveStatus: 409 });
  const r = await call(good());
  assert.equal(r.status, 409); assert.ok(r.body.fields.slug);
});

test('the hidden field catches bots: a fake success and nothing stored or sent', async () => {
  reset();
  const r = await call(good({ company_website: 'http://spam.test' }));
  assert.equal(r.status, 201);
  assert.equal(db.saved.length, 0); assert.equal(sent.length, 0);
});

test('an email problem never loses the application', async () => {
  reset(); reject = true;
  const r = await call(good());
  assert.equal(r.status, 201);
  assert.equal(db.saved.length, 1);
});

test('with no platform sender configured nothing is emailed (never from a business address)', async () => {
  reset();
  const keep = process.env.PLATFORM_FROM; delete process.env.PLATFORM_FROM;
  const r = await call(good());
  process.env.PLATFORM_FROM = keep;
  assert.equal(r.status, 201); assert.equal(sent.length, 0); assert.equal(db.saved.length, 1);
});

test('one visitor can only send five applications an hour', async () => {
  reset();
  const ip = '203.0.113.9';
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await call(good({ slug: `co-${i}` }), { ip })).status);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
});

test('only POST is accepted, and unknown paths are 404', async () => {
  reset();
  assert.equal((await call(good(), { method: 'GET' })).status, 405);
  const req = Readable.from([]); req.url = '/api/signup/other'; req.method = 'POST'; req.headers = {};
  let status; await handler(req, { setHeader() {}, end() {}, set statusCode(v) { status = v; } });
  assert.equal(status, 404);
});

test('without the database key the form says it is unavailable instead of failing oddly', async () => {
  reset();
  const keep = process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await call(good());
  process.env.SUPABASE_SERVICE_ROLE_KEY = keep;
  assert.equal(r.status, 503);
});
