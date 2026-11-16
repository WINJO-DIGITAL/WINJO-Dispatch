'use strict';

// The signed Accept, Reject and Cancel links that go in booking emails and texts. They are signed
// with OPERATOR_ACTION_SECRET (lib/token.js). Without it nothing is signed:
//   - staff are told to open the booking in the operator app (no Accept/Reject buttons that could
//     not work), and the customer's cancel link falls back to their booking page, which stays safe;
//   - the reason is logged once, in plain words, and /api/health shows the setting as false.
const { generateToken } = require('./token');
const { warnOnce } = require('./config');
const { OPERATOR_APP_URL } = require('./platform');

const MESSAGE = 'OPERATOR_ACTION_SECRET is not set, so the Accept, Reject and Cancel links in emails and texts cannot be signed. Staff emails now say "open your booking in the operator app" and customer cancel links go to the booking page. Set OPERATOR_ACTION_SECRET in Vercel (generate one with: openssl rand -hex 32) and redeploy.';

/** The address of the bookings screen in the operator app, for the "open it there" fallback. */
const operatorBookingsUrl = () => `${OPERATOR_APP_URL()}/operator/bookings`;

/**
 * @param {{ id: string }} booking
 * @param {string} site the business's website address (or '' when it has none)
 * @returns {{ signed: boolean, accept: string|null, reject: string|null, cancel: string, openUrl: string|null }}
 */
function actionLinks(booking, site) {
  const base = String(site || '').replace(/\/$/, '');
  try {
    const q = (a) => `${base}/api/${a === 'cancel' ? 'booking' : 'operator'}/${a}?id=${booking.id}&token=${generateToken(booking.id, a)}`;
    return { signed: true, accept: q('accept'), reject: q('reject'), cancel: q('cancel'), openUrl: null };
  } catch (e) {
    warnOnce('OPERATOR_ACTION_SECRET', MESSAGE);
    return { signed: false, accept: null, reject: null, cancel: `${base}/booking?id=${booking.id}`, openUrl: operatorBookingsUrl() };
  }
}

module.exports = { actionLinks, operatorBookingsUrl, MESSAGE };
