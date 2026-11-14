'use strict';
// A dedicated deployment (TENANT_ID set) files everything under its own business, on any address.
process.env.TENANT_ID = 'a0000000-0000-4000-8000-000000000001';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_siteHarness.cjs');

const EV = 'a0000000-0000-4000-8000-000000000001';
H.install([{ id: EV, name: 'Acme Cars', contact_email: 'bookings@acme-cars.test', contact_phone: '07700900123', ref_prefix: 'ACM', brand: {}, pricing: { airports: [{ name: 'Manchester Airport', one_way: 90, return_fare: 160 }], extra_stop: 5 } }]);

const booking = require('../../api/booking/index.js');
const leads = require('../../api/leads.js');
const tables = (name) => H.posts.filter((p) => p.table === name);

test('a dedicated deployment files a booking, a quote request and a message under its own business', async () => {
  H.posts.length = 0;
  const b = await H.call(booking, '/api/booking/create', H.bookingBody());
  assert.ok(b.status < 400, `create failed: ${b.status} ${b.body}`);
  await H.call(leads, '/api/quote-request', { customer_name: 'Jo', phone: '07000000001', pickup_location: 'A', destination: 'B' });
  await H.call(leads, '/api/contact', { name: 'Jo', message: 'Hello' });
  assert.equal(tables('bookings')[0].body.tenant_id, EV);
  assert.match(tables('bookings')[0].body.ref, /^ACM-[A-Z0-9]+$/, 'the business keeps its own prefix');
  assert.equal(tables('quote_requests')[0].body.tenant_id, EV);
  assert.equal(tables('contact_messages')[0].body.tenant_id, EV);
  assert.equal(tables('bookings')[0].body.quoted_price, 90, 'the business\'s own prices apply');
});

test('a dedicated deployment\'s site config names its business', async () => {
  const r = await H.call(booking, '/api/config', null, 'GET');
  assert.equal(JSON.parse(r.body).tenantId, EV);
});
