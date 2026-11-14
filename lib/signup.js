'use strict';
// Self-serve sign-up: what an applicant must give and agree to. Pure, no network.
// Mirrors the database rules in supabase/pending/20261114100000_signup_applications.sql so the
// applicant gets a clear message here before the database would refuse anything.

// The versions of the documents an applicant accepts. A test checks these against the headings
// of docs/legal/operator-contract.md and operator-responsibilities.md, so changing a document
// without bumping its version here fails the build.
const CONTRACT_VERSION = '1';
const RESPONSIBILITIES_VERSION = '1';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Short names that would clash with a page, an app or a route of the platform.
const RESERVED = new Set(['admin', 'api', 'app', 'www', 'platform', 'operator', 'driver', 'login', 'signup', 'support', 'help', 'dispatch', 'booking', 'account', 'public', 't', 'terms', 'privacy', 'platform-terms', 'ev-exec']);

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const text = (v, max) => String(v == null ? '' : v).replace(CONTROL, '').trim().slice(0, max);

/** A short name suggested from a business name: lowercase letters, numbers and hyphens, up to 40. */
function suggestSlug(name) {
  return String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
}

/**
 * Check an application. Returns { errors: { field: message }, clean } where clean is the
 * trimmed, length-capped row to store (only when there are no errors).
 */
function validate(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const clean = {
    business_name: text(b.business_name, 100),
    slug: text(b.slug, 40).toLowerCase(),
    contact_name: text(b.contact_name, 100),
    contact_email: text(b.contact_email, 254).toLowerCase(),
    contact_phone: text(b.contact_phone, 40) || null,
    message: text(b.message, 1000) || null,
  };
  if (!clean.business_name) errors.business_name = 'Tell us the name of your business.';
  if (!clean.slug) errors.slug = 'Choose a short name for your business.';
  else if (String(b.slug).trim().length > 40) errors.slug = 'Use 40 characters or fewer.';
  else if (!SLUG.test(clean.slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens only.';
  else if (RESERVED.has(clean.slug)) errors.slug = 'That short name is not available. Please choose another.';
  if (!clean.contact_name) errors.contact_name = 'Tell us your name.';
  if (!clean.contact_email) errors.contact_email = 'Enter your email address.';
  else if (!EMAIL.test(clean.contact_email)) errors.contact_email = 'That email address does not look right.';
  if (clean.contact_phone && !/^\+?[0-9 ()-]{7,20}$/.test(clean.contact_phone)) errors.contact_phone = 'Use digits and spaces only, for example 07700 900123.';
  if (b.accept_contract !== true) errors.accept_contract = 'You need to accept the Operator Services Agreement to apply.';
  if (b.accept_responsibilities !== true) errors.accept_responsibilities = 'You need to confirm Schedule A (your responsibilities) to apply.';
  return { errors, clean: Object.keys(errors).length ? null : clean };
}

const gbp = (pence) => `£${(Number(pence) / 100).toFixed(Number(pence) % 100 ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

module.exports = { CONTRACT_VERSION, RESPONSIBILITIES_VERSION, RESERVED, suggestSlug, validate, gbp };
