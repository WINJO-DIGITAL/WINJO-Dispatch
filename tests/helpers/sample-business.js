'use strict';

// Sample business record used as test data only (the retired first business, kept as a realistic example).
// It is not published anywhere and not used by any build.

module.exports = {
  name: 'EV Exec', contact_email: 'book@evexec.co.uk', contact_phone: '07721070370',
  brand: {
    licence: 'PHO0079',
    legal: {
      status: 'sole trader', base: 'Blackpool, Lancashire', area: 'Blackpool and the Fylde Coast',
      service: 'premium airport transfers and private hire',
      fleet: 'a fleet of electric vehicles (currently a Tesla Model Y, a Tesla Model Y Juniper and a Škoda Enyaq)',
      price_includes: ['Up to 4 passengers', 'Standard luggage (see section 13)', 'Live flight monitoring on all inbound transfers', 'Airport drop-off and pickup charges', 'All charging and running costs', 'Any extra stops you booked'],
      points_name: 'Privilege Points',
      insurance_confirmed: true,
    },
  },
  pricing: { extra_stop: 5 },
};
