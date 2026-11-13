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
  assert.match(html, /<p>Family run since 2010\.<\/p><p>Local drivers\.<\/p>/);
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
