'use strict';
// Draws a business's own website sections from the content it entered (lib/siteContent.js).
// Pure: takes a tenants row, returns HTML and CSS strings, no network. Every value is escaped
// and photos are <img> tags (never CSS urls), so business-supplied content cannot add markup.
// A business's page uses this only when it has published its site; otherwise nothing here runs.

const { esc } = require('./legal');
const { clean } = require('./siteContent');

const brandOf = (t) => (t && t.brand && typeof t.brand === 'object' ? t.brand : {});

/** The business's validated site content, or null when it has not published one. */
function contentFor(t) {
  const b = brandOf(t);
  if (b.site_published !== true || !b.site || typeof b.site !== 'object') return null;
  const r = clean(b.site, { tenantId: t.id, supabaseUrl: require('./supabaseUrl')() });
  // Stored content is already checked on save; if a photo or the headline is now invalid, show what is valid.
  return r.clean.hero.headline ? r.clean : null;
}

const img = (url, alt, cls) => (url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : '');
const para = (text) => String(text).split(/\n{2,}/).map((x) => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
const stars = (n) => `<span class="sb-stars" role="img" aria-label="${n} out of 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
const section = (id, title, inner) => `<section class="sec wrap sb" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${inner}</section>`;

function sections(c, t) {
  const out = [];
  if (c.services.length) {
    out.push(section('services', 'Our services', `<div class="grid three">${c.services.map((s) => `<article class="card sb-card">${img(s.image_url, s.title, 'sb-img')}<h3>${esc(s.title)}</h3>${s.text ? para(s.text) : ''}</article>`).join('')}</div>`));
  }
  if (c.about.body) {
    out.push(section('about', c.about.title || `About ${t.name || 'us'}`, `<div class="sb-about">${img(c.about.image_url, '', 'sb-img sb-about-img')}<div>${para(c.about.body)}</div></div>`));
  }
  if (c.fleet.length) {
    out.push(section('fleet', 'Our vehicles', `<div class="grid three">${c.fleet.map((f) => `<article class="card sb-card">${img(f.image_url, f.name, 'sb-img')}<h3>${esc(f.name)}</h3>${f.seats ? `<p class="hint">Up to ${f.seats} passengers</p>` : ''}${f.text ? para(f.text) : ''}</article>`).join('')}</div>`));
  }
  if (c.areas.length) {
    out.push(section('areas', 'Areas we cover', `<ul class="sb-chips">${c.areas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`));
  }
  if (c.reviews.length) {
    out.push(section('reviews', 'What customers say', `<div class="grid three">${c.reviews.map((r) => `<figure class="card sb-card" style="margin:0">${stars(r.rating)}<blockquote style="margin:8px 0">${para(r.text)}</blockquote><figcaption class="hint">${esc(r.name)}</figcaption></figure>`).join('')}</div>`));
  }
  if (c.faqs.length) {
    out.push(section('faq', 'Questions', `<div class="stack">${c.faqs.map((f) => `<details class="card sb-faq"><summary>${esc(f.q)}</summary>${para(f.a)}</details>`).join('')}</div>`));
  }
  const k = c.contact;
  if (k.address || k.hours || k.whatsapp) {
    const wa = k.whatsapp ? `https://wa.me/${k.whatsapp.replace(/^\+/, '')}` : '';
    out.push(section('contact', 'Contact', `<div class="card sb-card">${k.address ? `<p><strong>Address</strong><br>${esc(k.address)}</p>` : ''}${k.hours ? `<p><strong>Opening hours</strong><br>${esc(k.hours)}</p>` : ''}${wa ? `<p><a class="btn alt" href="${esc(wa)}" rel="noopener">Message on WhatsApp</a></p>` : ''}</div>`));
  }
  return out.join('\n');
}

const CSS = `
.hero.sb-hero{position:relative;overflow:hidden}.hero .sb-herobg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}.hero .wrap{position:relative}
.sb h2{font-size:1.4rem}.sb-card h3{margin-top:0}.sb-card p{margin:0 0 8px;color:#41516d}
.sb-img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:10px;margin:0 0 12px;background:#e8edf5}
.sb-about{display:grid;gap:16px}@media(min-width:720px){.sb-about:has(.sb-about-img){grid-template-columns:minmax(0,2fr) minmax(0,3fr);align-items:start}}
.sb-chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}.sb-chips li{padding:6px 14px;border-radius:999px;background:#fff;border:1px solid #dde3ee}
.sb-stars{color:var(--a);letter-spacing:2px}.sb-faq summary{cursor:pointer;font-weight:600}.sb-faq p{margin:10px 0 0}
`;

module.exports = { contentFor, sections, CSS };
