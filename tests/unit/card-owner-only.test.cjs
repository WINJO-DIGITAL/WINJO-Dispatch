'use strict';
// Card payments for a business go only to that business's own Stripe account: its connected
// account, or (where one business holds the deployment's account, STRIPE_PLATFORM_TENANT_ID) the
// deployment's own.
process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_siteHarness.cjs');

const EV = 'a0000000-0000-4000-8000-000000000001';
const OTHER = 'dddddddd-0000-4000-8000-000000000002';
const BOOKING_ID = 'cccccccc-0000-4000-8000-00000000f001';
H.install([{ id: OTHER, name: 'Coastal Cars', contact_email: 'hello@coastal.test', brand: {}, pricing: null }, { id: EV, name: 'Acme Cars', brand: { site_url: 'https://www.acme-cars.test' }, pricing: null }]);

let stripeCalls = 0;
let tenantOfBooking = OTHER;
const base = global.fetch;
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('api.stripe.com')) { stripeCalls++; return { ok: true, status: 200, json: async () => ({ id: 'cs_test', url: 'https://stripe.test/pay', status: 'open' }), text: async () => '{}' }; }
  if (u.includes('/rest/v1/bookings') && (opts.method || 'GET') === 'GET') {
    return { ok: true, status: 200, text: async () => '[]', json: async () => ([{
      id: BOOKING_ID, ref: 'ACM-CARD1', tenant_id: tenantOfBooking, status: 'Dispatched', operator_response: 'accepted', payment_status: 'Unpaid',
      customer_name: 'Jo', customer_email: 'jo@example.test', quoted_price: 90, airport: 'Manchester Airport', journey_type: 'To Airport',
      travel_date: '2099-01-01', travel_time: '09:00', terms_version: '4',
    }]) };
  }
  return base(url, opts);
};

const payment = require('../../api/payment/index.js');
const { stripeContext } = require('../../lib/stripeAccount');

test('with no connected account and no platform key, another business gets no Stripe account; the holder business gets the deployment\'s own', async () => {
  assert.equal(await stripeContext(OTHER), null);
  const own = await stripeContext(EV);
  assert.equal(own && own.kind, 'own');
  assert.equal(await stripeContext(null), null, 'a booking with no business gets no Stripe account');
});

test('a card checkout for another business is refused and never reaches Stripe', async () => {
  tenantOfBooking = OTHER; stripeCalls = 0;
  const r = await H.call(payment, '/api/payment/create-checkout-session', { bookingId: BOOKING_ID });
  assert.equal(r.status, 400, r.body);
  assert.match(JSON.parse(r.body).error, /Coastal Cars does not take card payments online yet/);
  assert.equal(stripeCalls, 0, 'no Stripe request was made');
});

test('the Stripe-holding business\'s own bookings reach Stripe', async () => {
  tenantOfBooking = EV; stripeCalls = 0;
  const r = await H.call(payment, '/api/payment/create-checkout-session', { bookingId: BOOKING_ID });
  assert.notEqual(JSON.parse(r.body).error && /does not take card payments/.test(JSON.parse(r.body).error), true, r.body);
  assert.ok(stripeCalls >= 1, `Stripe was called (${r.status} ${r.body})`);
});
