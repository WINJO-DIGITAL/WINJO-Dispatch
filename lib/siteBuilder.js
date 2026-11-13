'use strict';
// Draws a business's own website sections from the content it entered (lib/siteContent.js).
// Pure: takes a tenants row, returns HTML and CSS strings, no network. Every value is escaped
// and photos are <img> tags (never CSS urls), so business-supplied content cannot add markup.
// A business's page uses this only when it has published its site; otherwise nothing here runs.
//
// Design directions (content.design.direction) change the layout, typography and component
// shapes, not just colours, so two businesses do not end up with the same page:
//   classic    cards in grids (the plainest, safest layout)
//   editorial  serif headings, numbered hairline lists, alternating image rows, pull quotes
//   bold       heavy type, large numerals, full-width rows, a dark reviews band
// See .claude/skills/anti-ai-design for the standard these follow.

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
const num = (i) => String(i + 1).padStart(2, '0');
const section = (id, title, inner, cls = '') => `<section class="sec wrap sb ${cls}" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${inner}</section>`;

// ── one renderer per section, one variant per direction ──────────────────────────────────────

const services = {
  classic: (c) => section('services', 'Our services', `<div class="grid three">${c.services.map((s) => `<article class="card sb-card">${img(s.image_url, s.title, 'sb-img')}<h3>${esc(s.title)}</h3>${s.text ? para(s.text) : ''}</article>`).join('')}</div>`),
  editorial: (c) => section('services', 'What we do', `<ol class="sb-list">${c.services.map((s, i) => `<li><span class="sb-n">${num(i)}</span><div><h3>${esc(s.title)}</h3>${s.text ? para(s.text) : ''}</div>${img(s.image_url, s.title, 'sb-thumb')}</li>`).join('')}</ol>`),
  bold: (c) => section('services', 'Services', `<div class="sb-rows">${c.services.map((s, i) => `<article class="sb-row"><span class="sb-big">${i + 1}</span><div><h3>${esc(s.title)}</h3>${s.text ? para(s.text) : ''}</div>${img(s.image_url, s.title, 'sb-thumb')}</article>`).join('')}</div>`),
};

const fleetRows = (c) => c.fleet.map((f, i) => `<article class="sb-feature${i % 2 ? ' flip' : ''}${f.image_url ? '' : ' noimg'}">${img(f.image_url, f.name, 'sb-photo')}<div><h3>${esc(f.name)}</h3>${f.seats ? `<p class="sb-meta">Up to ${f.seats} passengers</p>` : ''}${f.text ? para(f.text) : ''}</div></article>`).join('');
const fleet = {
  classic: (c) => section('fleet', 'Our vehicles', `<div class="grid three">${c.fleet.map((f) => `<article class="card sb-card">${img(f.image_url, f.name, 'sb-img')}<h3>${esc(f.name)}</h3>${f.seats ? `<p class="hint">Up to ${f.seats} passengers</p>` : ''}${f.text ? para(f.text) : ''}</article>`).join('')}</div>`),
  editorial: (c) => section('fleet', 'The vehicles', fleetRows(c), 'sb-features'),
  bold: (c) => section('fleet', 'Vehicles', fleetRows(c), 'sb-features'),
};

const reviews = {
  classic: (c) => section('reviews', 'What customers say', `<div class="grid three">${c.reviews.map((r) => `<figure class="card sb-card" style="margin:0">${stars(r.rating)}<blockquote style="margin:8px 0">${para(r.text)}</blockquote><figcaption class="hint">${esc(r.name)}</figcaption></figure>`).join('')}</div>`),
  editorial: (c) => section('reviews', 'In their words', c.reviews.map((r) => `<figure class="sb-pull"><blockquote>${para(r.text)}</blockquote><figcaption>${esc(r.name)} ${stars(r.rating)}</figcaption></figure>`).join('')),
  bold: (c) => section('reviews', 'Customers', c.reviews.map((r) => `<figure class="sb-pull"><blockquote>${para(r.text)}</blockquote><figcaption>${esc(r.name)} ${stars(r.rating)}</figcaption></figure>`).join(''), 'sb-band'),
};

const areas = {
  classic: (c) => section('areas', 'Areas we cover', `<ul class="sb-chips">${c.areas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`),
  editorial: (c) => section('areas', 'Where we go', `<p class="sb-run">${c.areas.map((a) => esc(a)).join(' <span aria-hidden="true">/</span> ')}</p>`),
  bold: (c) => section('areas', 'Where we go', `<p class="sb-run">${c.areas.map((a) => esc(a)).join(' <span aria-hidden="true">/</span> ')}</p>`),
};

const faq = {
  classic: (c) => section('faq', 'Questions', `<div class="stack">${c.faqs.map((f) => `<details class="card sb-faq"><summary>${esc(f.q)}</summary>${para(f.a)}</details>`).join('')}</div>`),
  editorial: (c) => section('faq', 'Good to know', `<div class="sb-hair">${c.faqs.map((f) => `<details class="sb-faq"><summary>${esc(f.q)}</summary>${para(f.a)}</details>`).join('')}</div>`),
  bold: (c) => section('faq', 'Questions', `<div class="sb-hair">${c.faqs.map((f) => `<details class="sb-faq"><summary>${esc(f.q)}</summary>${para(f.a)}</details>`).join('')}</div>`),
};

function about(c, t, dir) {
  if (!c.about.body) return '';
  const paras = c.about.body.split(/\n{2,}/);
  const lead = dir === 'editorial' && paras.length > 1 ? `<p class="sb-lead">${esc(paras[0]).replace(/\n/g, '<br>')}</p>${para(paras.slice(1).join('\n\n'))}` : para(c.about.body);
  return section('about', c.about.title || `About ${t.name || 'us'}`, `<div class="sb-about">${img(c.about.image_url, '', 'sb-img sb-about-img')}<div>${lead}</div></div>`);
}

function contact(c) {
  const k = c.contact;
  if (!(k.address || k.hours || k.whatsapp)) return '';
  const wa = k.whatsapp ? `https://wa.me/${k.whatsapp.replace(/^\+/, '')}` : '';
  return section('contact', 'Contact', `<div class="sb-contact">${k.address ? `<p><strong>Address</strong><br>${esc(k.address)}</p>` : ''}${k.hours ? `<p><strong>Opening hours</strong><br>${esc(k.hours)}</p>` : ''}${wa ? `<p><a class="btn alt" href="${esc(wa)}" rel="noopener">Message on WhatsApp</a></p>` : ''}</div>`);
}

// The order also differs: an editorial site leads with who the business is, a bold one with what it sells.
const ORDER = {
  classic: ['services', 'about', 'fleet', 'areas', 'reviews', 'faq', 'contact'],
  editorial: ['about', 'services', 'fleet', 'reviews', 'areas', 'faq', 'contact'],
  bold: ['services', 'fleet', 'reviews', 'about', 'areas', 'faq', 'contact'],
};

function sections(c, t) {
  const dir = c.design && ORDER[c.design.direction] ? c.design.direction : 'classic';
  const parts = {
    services: () => (c.services.length ? services[dir](c) : ''),
    about: () => about(c, t, dir),
    fleet: () => (c.fleet.length ? fleet[dir](c) : ''),
    areas: () => (c.areas.length ? areas[dir](c) : ''),
    reviews: () => (c.reviews.length ? reviews[dir](c) : ''),
    faq: () => (c.faqs.length ? faq[dir](c) : ''),
    contact: () => contact(c),
  };
  return `<div class="sbx dir-${dir}">${ORDER[dir].map((k) => parts[k]()).filter(Boolean).join('\n')}</div>`;
}

const CSS = `
.hero.sb-hero{position:relative;overflow:hidden}.hero .sb-herobg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}.hero .wrap{position:relative}
.sb h2{font-size:1.4rem}.sb-card h3{margin-top:0}.sb-card p{margin:0 0 8px;color:#41516d}
.sb-img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:10px;margin:0 0 12px;background:#e8edf5}
.sb-about{display:grid;gap:16px}@media(min-width:720px){.sb-about:has(.sb-about-img){grid-template-columns:minmax(0,2fr) minmax(0,3fr);align-items:start}}
.sb-chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}.sb-chips li{padding:6px 14px;border-radius:999px;background:#fff;border:1px solid #dde3ee}
.sb-stars{color:var(--a);letter-spacing:2px}.sb-faq summary{cursor:pointer;font-weight:600}.sb-faq p{margin:10px 0 0}
.sb-contact p{margin:0 0 12px}
.sb-list,.sb-rows{list-style:none;margin:0;padding:0}.sb-list li,.sb-row{display:grid;gap:12px;padding:20px 0;border-top:1px solid #cfd6e4;grid-template-columns:minmax(0,1fr)}
.sb-thumb{display:block;width:100%;max-width:240px;aspect-ratio:4/3;object-fit:cover;background:#e8edf5}
@media(min-width:720px){.sb-list li{grid-template-columns:3.5rem minmax(0,1fr) 220px;align-items:start}.sb-row{grid-template-columns:5rem minmax(0,1fr) 220px;align-items:center}}
.sb-n{font-size:.9rem;color:#5b6b85;padding-top:.35rem}.sb-list h3,.sb-row h3{margin:0 0 6px;font-size:1.2rem}.sb-list p,.sb-row p{margin:0 0 8px;max-width:38rem;color:#41516d}
.sb-features{padding-top:12px}.sb-feature{display:grid;gap:16px;padding:20px 0;border-top:1px solid #cfd6e4}.sb-photo{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#e8edf5}
@media(min-width:760px){.sb-feature:not(.noimg){grid-template-columns:minmax(0,3fr) minmax(0,2fr);align-items:center;gap:32px}.sb-feature.flip .sb-photo{order:2}}
.sb-feature h3{margin:0 0 4px;font-size:1.3rem}.sb-meta{margin:0 0 8px;color:#5b6b85;font-size:.9rem}.sb-feature p{max-width:34rem}
.sb-pull{margin:0;padding:22px 0;border-top:1px solid #cfd6e4}.sb-pull blockquote{margin:0 0 8px;font-size:1.3rem;line-height:1.4;max-width:40rem}.sb-pull p{margin:0}.sb-pull figcaption{font-size:.9rem;color:#5b6b85}
.sb-run{font-size:1.35rem;line-height:1.7;max-width:44rem;margin:0}.sb-run span{color:var(--a);padding:0 .15em}
.sb-hair .sb-faq{border-top:1px solid #cfd6e4;padding:14px 0}.sb-hair .sb-faq:last-child{border-bottom:1px solid #cfd6e4}
.sb-lead{font-size:1.25rem;line-height:1.5}
.sbx.dir-editorial h2,.sbx.dir-editorial h3,.dir-editorial h1,.sbx.dir-editorial .sb-pull blockquote,.sbx.dir-editorial .sb-lead,.sbx.dir-editorial .sb-run{font-family:Georgia,"Times New Roman",serif;font-weight:400}
.sbx.dir-editorial h2{font-size:1.9rem;margin-bottom:8px}.sbx.dir-editorial .sb-img,.sbx.dir-editorial .sb-thumb,.sbx.dir-editorial .sb-photo{border-radius:0}
.hero.dir-editorial h1{font-weight:400;font-size:clamp(2rem,5.5vw,3.3rem);max-width:20ch}.hero.dir-editorial .btn{border-radius:2px}
.sbx.dir-bold h2{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:700;line-height:1.05;margin-bottom:6px}.sbx.dir-bold .sb-thumb,.sbx.dir-bold .sb-photo,.sbx.dir-bold .sb-img{border-radius:0}
.sb-big{font-size:clamp(2.6rem,7vw,4.4rem);font-weight:700;line-height:.9;color:var(--a)}.sbx.dir-bold .sb-row h3{font-size:1.35rem;font-weight:700}
.hero.dir-bold h1{font-weight:700;font-size:clamp(2.2rem,7vw,4rem);line-height:1.02;max-width:16ch}.hero.dir-bold h1{border-left:8px solid var(--a);padding-left:16px}@media(min-width:720px){.hero.dir-bold h1{margin-left:-24px}}.hero.dir-bold .btn{border-radius:0}
.sbx.dir-bold .sb-band{max-width:none;background:var(--p);color:#fff;padding-left:max(16px,calc((100% - 1040px)/2 + 16px));padding-right:max(16px,calc((100% - 1040px)/2 + 16px))}
.sbx.dir-bold .sb-band .sb-pull{border-top-color:rgba(255,255,255,.25)}.sbx.dir-bold .sb-band figcaption{color:#d3dbea}
.sbx .btn{box-shadow:none}
@media(prefers-reduced-motion:no-preference){.sb-feature .sb-photo,.sb-card .sb-img{transition:filter .25s}.sb-feature:hover .sb-photo,.sb-card:hover .sb-img{filter:saturate(1.08)}}
`;

module.exports = { contentFor, sections, CSS };
