'use strict';

// Each operator's fixed prices live in tenants.pricing (set in the Operator
// app, Settings → Prices). A page reads the row of the business it is serving.
//
// getPrice()/lookupPrice() in lib/format.js are synchronous and used all over
// (emails, payments, the operator accept page), so every API handler that can
// price something calls `await refreshPricing()` first. That loads the row at
// most once a minute per server instance. If the database can't be reached or
// a business has no prices set, that business gets an empty list (no price
// available, "please contact us"): there is no built-in price list, and one
// business never sees another's prices.

const SUPABASE_URL = require('./supabaseUrl')();
// The one business a dedicated deployment serves (optional TENANT_ID); none on the shared platform.
const TENANT_ID = process.env.TENANT_ID || '';
const TTL_MS = 60 * 1000;

const EMPTY = { airports: [], extraStop: 0 };

// Every business's prices, loaded together (the tenants table is small), keyed by tenant id.
let byTenant = new Map();
let loadedAt = 0;
let inflight = null;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** tenants.pricing (snake_case, as stored) → { airports: [{name, code, oneWay, ret}], extraStop }, or null if unusable. */
function fromRow(pricing) {
  if (!pricing || !Array.isArray(pricing.airports)) return null;
  const airports = pricing.airports
    .map((a) => ({ name: String(a && a.name || '').trim(), code: a && a.code || null, oneWay: num(a && a.one_way), ret: num(a && a.return_fare) }))
    .filter((a) => a.name && a.oneWay != null && a.ret != null);
  if (!airports.length) return null;
  return { airports, extraStop: num(pricing.extra_stop) ?? 0 };
}

async function fetchPricing() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenants?select=id,pricing`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`pricing lookup ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) return null;
  const map = new Map();
  for (const r of rows) { const p = fromRow(r && r.pricing); if (p) map.set(r.id, p); }
  return map;
}

/** Load every business's prices if the copy in memory is over a minute old. Never throws. */
async function refreshPricing({ force = false } = {}) {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  if (!inflight) {
    inflight = fetchPricing()
      .then((m) => { if (m) byTenant = m; })
      .catch((err) => { console.warn('[pricing] keeping the last prices loaded:', err.message); })
      .finally(() => { loadedAt = Date.now(); inflight = null; });
  }
  await inflight;
}

/** A business's prices (no id: this deployment's own business, if it has one). A business with none set gets an empty list, never another's. */
function currentPricing(tenantId) {
  const id = tenantId || TENANT_ID;
  return byTenant.get(id) || EMPTY;
}

function findAirport(name, tenantId) {
  const s = String(name || '').trim().toLowerCase();
  if (!s) return null;
  return currentPricing(tenantId).airports.find((a) => a.name.toLowerCase() === s) || null;
}

// Test hooks.
function _setPricing(p, tenantId) {
  if (p) { byTenant.set(tenantId || TENANT_ID, p); loadedAt = Date.now(); }
  else if (tenantId) { byTenant.delete(tenantId); }
  else { byTenant = new Map(); loadedAt = 0; }
}

module.exports = { refreshPricing, currentPricing, findAirport, fromRow, _setPricing };
