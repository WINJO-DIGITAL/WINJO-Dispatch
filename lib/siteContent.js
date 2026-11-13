'use strict';
// What a business can put on its own website (the site builder's content).
//
// Stored per business (planned: tenants.brand.site). A business never supplies HTML or
// code: only short plain text, numbers and photos from its own folder in the public
// brand-assets bucket. clean() drops anything unknown, trims and caps every value, and
// reports what was wrong, so the editor, the database function and the page renderer
// can all trust the same shape. Pure: no network, no database.

const LIMITS = {
  services: 8, fleet: 12, areas: 30, reviews: 12, faqs: 12,
  headline: 90, sub: 220, label: 40, title: 80, text: 600, body: 3000, name: 80, short: 120, url: 300,
};
const DIRECTIONS = ['classic', 'editorial', 'bold'];
const HOURS_RE = /^[0-9A-Za-z ,:.\-–()/&]{0,120}$/;

const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

// A photo must be in this business's own folder of the brand-assets bucket.
function photoOk(url, tenantId, supabaseUrl) {
  if (!url) return true;
  const prefix = `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/brand-assets/${tenantId}/`;
  return typeof url === 'string' && url.length <= LIMITS.url && url.startsWith(prefix) && /\.(png|jpe?g|webp)(\?[A-Za-z0-9=&_-]*)?$/i.test(url) && /^[A-Za-z0-9:/._%\-]+(\?[A-Za-z0-9=&_-]*)?$/.test(url) && !/\.\./.test(url);
}

function clean(input, { tenantId, supabaseUrl } = {}) {
  const errors = [];
  const c = input && typeof input === 'object' ? input : {};
  if (!tenantId || !supabaseUrl) throw new Error('clean() needs tenantId and supabaseUrl');
  const photo = (url, where) => {
    const u = str(url, LIMITS.url);
    if (u && !photoOk(u, tenantId, supabaseUrl)) { errors.push(`${where}: photos must be uploaded to this business's own folder`); return ''; }
    return u;
  };
  const out = {};

  const h = c.hero || {};
  out.hero = { headline: str(h.headline, LIMITS.headline), subheadline: str(h.subheadline, LIMITS.sub), cta_label: str(h.cta_label, LIMITS.label) || 'Book now', image_url: photo(h.image_url, 'hero.image_url') };

  const a = c.about || {};
  out.about = { title: str(a.title, LIMITS.title), body: str(a.body, LIMITS.body), image_url: photo(a.image_url, 'about.image_url') };

  out.services = arr(c.services, LIMITS.services).map((s, i) => ({ title: str(s && s.title, LIMITS.title), text: str(s && s.text, LIMITS.text), image_url: photo(s && s.image_url, `services[${i}].image_url`) })).filter((s) => s.title);
  out.fleet = arr(c.fleet, LIMITS.fleet).map((f, i) => {
    const seats = Math.round(Number(f && f.seats));
    return { name: str(f && f.name, LIMITS.name), text: str(f && f.text, LIMITS.text), seats: seats >= 1 && seats <= 60 ? seats : null, image_url: photo(f && f.image_url, `fleet[${i}].image_url`) };
  }).filter((f) => f.name);
  out.areas = arr(c.areas, LIMITS.areas).map((x) => str(x, LIMITS.name)).filter(Boolean);
  out.reviews = arr(c.reviews, LIMITS.reviews).map((r) => {
    const rating = Math.round(Number(r && r.rating));
    return { name: str(r && r.name, LIMITS.name), text: str(r && r.text, LIMITS.text), rating: rating >= 1 && rating <= 5 ? rating : 5 };
  }).filter((r) => r.name && r.text);
  out.faqs = arr(c.faqs, LIMITS.faqs).map((f) => ({ q: str(f && f.q, LIMITS.short), a: str(f && f.a, LIMITS.text) })).filter((f) => f.q && f.a);

  const k = c.contact || {};
  const hours = str(k.hours, 120);
  if (hours && !HOURS_RE.test(hours)) errors.push('contact.hours: use letters, numbers and simple punctuation only');
  const wa = str(k.whatsapp, 20).replace(/[^0-9+]/g, '');
  out.contact = { address: str(k.address, LIMITS.short), hours: HOURS_RE.test(hours) ? hours : '', whatsapp: wa };

  const d = c.design || {};
  out.design = { direction: DIRECTIONS.includes(d.direction) ? d.direction : 'classic' };

  const seo = c.seo || {};
  out.seo = { title: str(seo.title, 70), description: str(seo.description, 160) };

  if (!out.hero.headline) errors.push('hero.headline: add a headline for the top of the home page');
  return { ok: errors.length === 0, errors, clean: out };
}

module.exports = { clean, photoOk, LIMITS, DIRECTIONS };
