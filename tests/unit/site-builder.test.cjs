'use strict';
process.env.SUPABASE_URL = 'https://proj.supabase.co';
const test = require('node:test');
const assert = require('node:assert/strict');
const site = require('../../lib/tenantSite');

const T = '11111111-1111-1111-1111-111111111111';
const own = (f) => `https://proj.supabase.co/storage/v1/object/public/brand-assets/${T}/${f}`;
const content = () => ({
  hero: { headline: 'Leeds airport transfers', subheadline: 'Fixed prices, all day', cta_label: 'Get a price', image_url: own('hero.jpg') },
  about: { title: 'About us', body: 'Family run since 2010.\n\nLocal drivers.' },
  services: [{ title: 'Airport runs', text: 'To and from', image_url: own('a.webp') }],
  fleet: [{ name: 'Mercedes V-Class', seats: 7, text: 'Room for luggage', image_url: own('v.jpg') }],
  areas: ['Leeds', 'Harrogate'],
  reviews: [{ name: 'Sam', text: 'Brilliant service', rating: 4 }],
  faqs: [{ q: 'Do you track flights?', a: 'Yes, every time.' }],
  contact: { address: '1 High St, Leeds', hours: 'Open 24 hours', whatsapp: '+447700900123' },
  seo: { title: 'Leeds Cars | Airport transfers', description: 'Book Leeds airport transfers online.' },
});
const row = (over = {}) => ({ id: T, slug: 'leeds-cars', name: 'Leeds Cars', contact_email: 'a@b.test', contact_phone: '07700900123',
  brand: { site_url: 'https://www.leedscars.test', site_published: true, site: content() }, pricing: null, ...over });

test('a published site shows the business\'s own headline, sections, photos and SEO', () => {
  const html = site.homePage(row());
  assert.match(html, /<h1>Leeds airport transfers<\/h1>/);
  assert.match(html, /<title>Leeds Cars \| Airport transfers<\/title>/);
  assert.match(html, /name="description" content="Book Leeds airport transfers online\."/);
  for (const w of ['Airport runs', 'Mercedes V-Class', 'Up to 7 passengers', 'Harrogate', 'Brilliant service', 'Do you track flights?', 'Open 24 hours', 'https://wa.me/447700900123']) assert.ok(html.includes(w), w);
  assert.match(html, /<p>Family run since 2010\.<\/p><p>Local drivers\.<\/p>/); // classic keeps plain paragraphs
  assert.ok(html.includes(`src="${own('hero.jpg')}"`));
  assert.match(html, /id="bookForm"/, 'the booking form is still there');
});

test('an unpublished site, or one with no content, shows the plain page and none of the content', () => {
  for (const brand of [{ site_url: 'https://x.test', site_published: false, site: content() }, { site_url: 'https://x.test', site: content() }, { site_url: 'https://x.test', site_published: true }]) {
    const html = site.homePage(row({ brand }));
    assert.doesNotMatch(html, /Leeds airport transfers|Mercedes|sb-hero/);
    assert.match(html, /<h1>Leeds Cars<\/h1>/);
  }
});

test('markup in business-supplied text is escaped, everywhere', () => {
  const c = content();
  c.hero.headline = '<script>alert(1)</script>';
  c.services[0].title = '"><img src=x onerror=alert(1)>';
  c.faqs[0].q = '<b>q</b>'; c.reviews[0].name = '<i>n</i>'; c.areas[0] = '<u>a</u>'; c.about.body = '<iframe src=//evil.test></iframe>';
  const html = site.homePage(row({ brand: { site_url: 'https://x.test', site_published: true, site: c } }));
  assert.doesNotMatch(html, /<script>alert\(1\)|<img src=x|<b>q<|<i>n<|<u>a<|<iframe/);
  assert.match(html, /&lt;script&gt;alert\(1\)/);
});

test('a photo from another business\'s folder or another host never appears', () => {
  const c = content();
  c.hero.image_url = 'https://proj.supabase.co/storage/v1/object/public/brand-assets/22222222-2222-2222-2222-222222222222/x.jpg';
  c.services[0].image_url = 'https://evil.test/p.jpg'; c.fleet[0].image_url = own("x.jpg'onerror='1");
  const html = site.homePage(row({ brand: { site_url: 'https://x.test', site_published: true, site: c } }));
  assert.doesNotMatch(html, /22222222|evil\.test|onerror/);
});

test('one business\'s page never carries another\'s content', () => {
  const other = { ...row(), id: '33333333-3333-3333-3333-333333333333', slug: 'b', name: 'Other Ltd', brand: { site_url: 'https://other.test' } };
  assert.doesNotMatch(site.homePage(other), /Leeds|Mercedes/);
});

const dirRow = (direction, mut) => { const c = content(); c.design = { direction }; if (mut) mut(c); return row({ brand: { site_url: 'https://x.test', site_published: true, site: c } }); };
const order = (html, ids) => ids.map((i) => html.indexOf(`id="${i}"`));

test('the three directions draw genuinely different pages, not the same page recoloured', () => {
  const body = (h) => h.replace(/<style>[\s\S]*?<\/style>/, '');
  const c = body(site.homePage(dirRow('classic'))), e = body(site.homePage(dirRow('editorial'))), b = body(site.homePage(dirRow('bold')));
  assert.match(c, /class="card sb-card"/); assert.doesNotMatch(c, /sb-feature|sb-list|sb-band/);
  assert.match(e, /class="sb-list"/); assert.match(e, /sb-feature/); assert.match(e, /class="sb-pull"/); assert.match(e, /class="sb-run"/); assert.doesNotMatch(e, /class="card sb-card"/, 'editorial does not put everything in cards');
  assert.match(b, /class="sb-rows"/); assert.match(b, /sb-band/); assert.match(b, /sb-big/); assert.doesNotMatch(b, /class="card sb-card"/);
  assert.match(e, /hero sb-hero dir-editorial/); assert.match(b, /hero sb-hero dir-bold/);
});

test('sections come in a different order for each direction', () => {
  const ids = ['services', 'about', 'fleet', 'reviews'];
  const o = (d) => order(site.homePage(dirRow(d)), ids).map((p, i) => [p, ids[i]]).sort((x, y) => x[0] - y[0]).map((x) => x[1]).join();
  assert.equal(o('classic'), 'services,about,fleet,reviews');
  assert.equal(o('editorial'), 'about,services,fleet,reviews');
  assert.equal(o('bold'), 'services,fleet,reviews,about');
});

test('an unknown direction falls back to classic', () => {
  assert.match(site.homePage(dirRow('neon')), /class="sbx dir-classic"/);
});

test('every direction escapes business text and drops foreign photos', () => {
  for (const d of ['classic', 'editorial', 'bold']) {
    const html = site.homePage(dirRow(d, (c) => {
      c.services[0].title = '<img src=x onerror=1>'; c.fleet[0].name = '<script>1</script>'; c.reviews[0].text = '<iframe></iframe>'; c.areas[0] = '<u>a</u>';
      c.faqs[0].q = '<b>q</b>'; c.about.body = '<svg onload=1>\n\n<i>second</i>'; c.fleet[0].image_url = 'https://evil.test/x.jpg';
    }));
    assert.doesNotMatch(html, /<img src=x|<script>1|<iframe|<u>a<|<b>q<|<svg|<i>second|evil\.test/, d);
  }
});

test('an editorial about section leads with its first paragraph', () => {
  assert.match(site.homePage(dirRow('editorial')), /<p class="sb-lead">Family run since 2010\.<\/p><p>Local drivers\.<\/p>/);
});

test('a published site drops the generic claims strip; the plain page keeps it', () => {
  const claim = /class="facts"/;
  const body = (h) => h.replace(/<style>[\s\S]*?<\/style>/, '');
  assert.doesNotMatch(body(site.homePage(row())), claim);
  assert.match(body(site.homePage(row({ brand: { site_url: 'https://x.test' } }))), claim);
});
