'use strict';

// The sample business the unit tests run as (a dedicated deployment of one business, see
// tests/unit/_setup.cjs): its row for lib/brand.js and its prices for lib/pricing.js. Test data only.

const ID = 'a0000000-0000-4000-8000-000000000001';

const ROW = {
  name: 'Acme Cars', contact_email: 'bookings@acme-cars.test', contact_phone: '07700900123', ref_prefix: 'ACM',
  brand: { licence: 'PHO0001', site_url: 'https://www.acme-cars.test', tagline: 'Airport transfers from Exampleton' },
};

const PRICING = {
  airports: [
    { name: 'Manchester Airport', code: 'MAN', oneWay: 90, ret: 160 },
    { name: 'Liverpool Airport', code: 'LPL', oneWay: 95, ret: 170 },
    { name: 'Leeds Bradford Airport', code: 'LBA', oneWay: 135, ret: 250 },
    { name: 'Birmingham Airport', code: 'BHX', oneWay: 215, ret: 410 },
    { name: 'Newcastle Airport', code: 'NCL', oneWay: 250, ret: 480 },
  ],
  extraStop: 5,
};

/** Make the sample business the loaded one: its brand details and its prices. */
function load(extraBrands = {}) {
  require('../../lib/brand')._setBrands({ [ID]: ROW, ...extraBrands });
  require('../../lib/pricing')._setPricing(PRICING, ID);
}

module.exports = { ID, ROW, PRICING, load };
