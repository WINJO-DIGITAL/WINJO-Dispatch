'use strict';

// A neutral sample business used as test data only. The phone number is in the range Ofcom
// reserves for drama use, and the email and website use the reserved ".test" domain.
// It is not published anywhere and not used by any build.

module.exports = {
  name: 'Acme Cars', contact_email: 'bookings@acme-cars.test', contact_phone: '07700900123',
  brand: {
    licence: 'PHO0001',
    legal: {
      status: 'sole trader', base: 'Exampleton, Lancashire', area: 'Exampleton and the surrounding area',
      service: 'airport transfers and private hire',
      fleet: 'a fleet of three electric saloon cars',
      price_includes: ['Up to 4 passengers', 'Standard luggage (see section 13)', 'Live flight monitoring on all inbound transfers', 'Airport drop-off and pickup charges', 'All charging and running costs', 'Any extra stops you booked'],
      points_name: 'Privilege Points',
      insurance_confirmed: true,
    },
  },
  pricing: { extra_stop: 5 },
};
