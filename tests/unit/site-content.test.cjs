'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { clean, photoOk } = require('../../lib/siteContent');

const T = '11111111-1111-1111-1111-111111111111';
const S = 'https://proj.supabase.co';
const own = (f) => `${S}/storage/v1/object/public/brand-assets/${T}/${f}`;
const opt = { tenantId: T, supabaseUrl: S };

test('a complete, valid site is kept as written', () => {
  const r = clean({ hero: { headline: 'Airport transfers', subheadline: 'Fixed prices', image_url: own('hero.jpg') }, about: { title: 'About us', body: 'Family run.' },
    services: [{ title: 'Airport', text: 'To and from', image_url: own('a.webp') }], fleet: [{ name: 'Tesla', seats: 4, text: 'Electric' }],
    areas: ['Leeds', 'York'], reviews: [{ name: 'Sam', text: 'Great', rating: 5 }], faqs: [{ q: 'Do you track flights?', a: 'Yes.' }],
    contact: { address: 'Leeds', hours: 'Mon-Sun 24 hours', whatsapp: '+44 7700 900123' }, seo: { title: 'T', description: 'D' } }, opt);
  assert.equal(r.ok, true, r.errors.join());
  assert.equal(r.clean.hero.image_url, own('hero.jpg'));
  assert.equal(r.clean.contact.whatsapp, '+447700900123');
  assert.equal(r.clean.fleet[0].seats, 4);
});

test('photos from anywhere except this business\'s own folder are refused', () => {
  const other = `${S}/storage/v1/object/public/brand-assets/22222222-2222-2222-2222-222222222222/x.jpg`;
  for (const bad of [other, 'https://evil.test/x.jpg', own('x.svg'), own('../x.jpg'), `javascript:alert(1)`, own('x.jpg') + ' onerror=1']) {
    const r = clean({ hero: { headline: 'H', image_url: bad } }, opt);
    assert.equal(r.ok, false, bad);
    assert.equal(r.clean.hero.image_url, '', bad);
  }
  assert.equal(photoOk('', T, S), true);
});

test('unknown fields and markup-bearing keys are dropped; text stays plain text', () => {
  const r = clean({ hero: { headline: '<script>alert(1)</script>Hi', onclick: 'x' }, script: '<b>', theme: { css: 'body{}' } }, opt);
  assert.deepEqual(Object.keys(r.clean).sort(), ['about', 'areas', 'contact', 'faqs', 'fleet', 'hero', 'reviews', 'seo', 'services']);
  assert.equal(r.clean.hero.headline, '<script>alert(1)</script>Hi', 'kept as text: the renderer must escape it');
  assert.equal(r.clean.hero.onclick, undefined);
});

test('lists are capped and empty entries removed', () => {
  const r = clean({ hero: { headline: 'H' }, services: Array.from({ length: 20 }, (_, i) => ({ title: `S${i}` })).concat([{ title: '' }]), areas: Array.from({ length: 50 }, (_, i) => `A${i}`),
    reviews: [{ name: 'x', text: '' }, { name: 'y', text: 'ok', rating: 9 }], fleet: [{ name: 'Car', seats: 999 }] }, opt);
  assert.equal(r.clean.services.length, 8);
  assert.equal(r.clean.areas.length, 30);
  assert.equal(r.clean.reviews.length, 1);
  assert.equal(r.clean.reviews[0].rating, 5, 'out-of-range rating falls back to 5');
  assert.equal(r.clean.fleet[0].seats, null);
});

test('a headline is required and long text is trimmed, not rejected', () => {
  assert.equal(clean({}, opt).ok, false);
  const r = clean({ hero: { headline: 'H'.repeat(500) }, about: { body: 'x'.repeat(9000) } }, opt);
  assert.equal(r.clean.hero.headline.length, 90);
  assert.equal(r.clean.about.body.length, 3000);
});

test('odd opening hours are refused, not stored', () => {
  const r = clean({ hero: { headline: 'H' }, contact: { hours: '<img src=x>' } }, opt);
  assert.equal(r.ok, false);
  assert.equal(r.clean.contact.hours, '');
});

test('it will not run without knowing whose photos to allow', () => {
  assert.throws(() => clean({ hero: { headline: 'H' } }, {}), /tenantId/);
});
