// Booking helpers the emails need (same rules as lib/format.js). Prices come from the booking's own
// business (tenants.pricing, loaded with its brand); there is no built-in price list.

import { brandFor } from './brand.js';

const listed = (b) => brandFor(b.tenant_id).prices[String(b.airport || '').trim().toLowerCase()] || null;
const isReturnLeg = (b) => /^Return leg created automatically/i.test(String(b.notes || ''));

export function getStops(b) {
  if (Array.isArray(b.additional_stops) && b.additional_stops.length) return b.additional_stops;
  return String(b.notes || '').split('\n').filter((l) => /^Stop \d+:/i.test(l))
    .map((l) => l.replace(/^Stop \d+:\s*/i, '').trim()).filter(Boolean);
}

// True when the airport is on the published price list (not a quoted job).
export function onPriceList(b) {
  return Boolean(listed(b));
}

export function getPrice(b) {
  const p = Number(b.price ?? b.quoted_price);
  if (Number.isFinite(p) && p > 0) return p;
  const t = listed(b);
  return t ? (b.return_journey ? t.ret : t.oneWay) : null;
}

export function paymentLine(b) {
  if (isReturnLeg(b)) {
    const m = String(b.notes).match(/Outbound ref:\s*(\S+)/i);
    return m ? `Included with booking ${m[1].replace(/[.,]$/, '')}` : 'Included with your outbound booking';
  }
  const method = String(b.payment_method || '').trim().toLowerCase();
  const status = String(b.payment_status || '').trim().toLowerCase();
  const bank = method === 'bank transfer' || method === 'bank_transfer';
  if (status === 'paid') {
    if (method === 'card' || method === 'payment link') return 'Paid by card';
    if (method === 'cash') return 'Paid in cash';
    if (bank) return 'Paid by bank transfer';
    return 'Paid';
  }
  if (method === 'cash') return 'Cash on the day';
  if (bank) return 'Bank transfer (payment pending)';
  if (method === 'payment link') return 'Payment link sent (payment pending)';
  if (method === 'card') return 'Card payment pending';
  return 'Payment required';
}

export function needsPayment(b) {
  const s = String(b.payment_status || '').toLowerCase();
  return s !== 'paid' && s !== 'invoiced' && !isReturnLeg(b) && Boolean(getPrice(b));
}
