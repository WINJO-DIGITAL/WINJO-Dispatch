'use strict';
// The public home page and sign-up page: real, indexable, honest, and accessible. The staff areas
// stay out of search.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const home = read('index.html');
const signup = read('signup.html');
const S = require('../../lib/signup');

const text = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');

test('the home page is a real, indexable page with a title, description, canonical address and social tags', () => {
  assert.doesNotMatch(home, /name="robots"/i, 'no noindex on the home page');
  assert.match(home, /<html lang="en-GB">/);
  const title = home.match(/<title>([^<]+)<\/title>/)[1];
  assert.ok(title.length > 20 && title.length <= 90, title);
  const desc = home.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(desc.length >= 80 && desc.length <= 175, `description is ${desc.length} characters`);
  assert.match(home, /<link rel="canonical" href="https:\/\/winjo-dispatch\.vercel\.app\/">/);
  for (const t of ['og:title', 'og:description', 'og:type', 'og:url']) assert.match(home, new RegExp(`property="${t}"`));
  assert.doesNotMatch(home, /Booking platform<\/h1>/, 'the placeholder is gone');
});

test('/signup is indexable, has its own canonical address, and names the agreement version that is recorded', () => {
  assert.doesNotMatch(signup, /name="robots"/i);
  assert.match(signup, /<link rel="canonical" href="https:\/\/winjo-dispatch\.vercel\.app\/signup">/);
  assert.match(signup, /Operator Services Agreement<\/a> \(version 4\)/);
  assert.equal(S.CONTRACT_VERSION, '4', 'the page and the recorded version must change together');
});

test('the home page links to /signup from the nav, the hero and the closing call to action', () => {
  const links = home.match(/href="\/signup"/g) || [];
  assert.ok(links.length >= 4, `found ${links.length}`);
  assert.match(home, /<a class="join" href="\/signup">Apply to join<\/a>/);
});

test('the home page says what it must, and only what is true in the repository', () => {
  const t = text(home);
  assert.match(t, /own Stripe account/i);
  assert.match(t, /no percentage|None/i);
  assert.match(t, /£999/);
  assert.match(t, /£99/);
  assert.match(t, /Not VAT registered/);
  assert.match(t, /24 hours a day/);
  assert.match(t, /not a private hire operator/i);
  assert.match(t, /licences, insurance, vehicles, driver checks/i);
  for (const feature of [/bookings/i, /dispatch/i, /Driver App/, /Reminders/, /Two-tap customer texts/, /Flight checks/]) assert.match(t, feature);
  assert.match(t, /Stripe starts in test mode|test mode/);
  // Nothing invented, nothing guaranteed.
  assert.doesNotMatch(t, /testimonial|trusted by|\d+\s?%|guarantee[sd]?|best[- ]in[- ]class|award|\d{2,}\+? (customers|operators|businesses)/i);
  assert.doesNotMatch(t, /Acme|EV Exec|Johns Taxis/i);
});

test('the prices on the home page are the prices in the sign-up copy and the contract, and no others', () => {
  const prices = (html) => [...new Set(text(html).match(/£\d[\d,]*/g) || [])].sort();
  assert.deepEqual(prices(home), ['£99', '£999']);
  const contract = read('docs/legal/operator-contract.md');
  assert.match(contract, /£999/);
  assert.match(contract, /£99\b/);
});

test('the home page has an FAQ, a nav, a skip link, one h1 and footer links to the existing legal pages', () => {
  assert.match(home, /<details>/);
  assert.match(home, /<a class="skip" href="#main">/);
  assert.match(home, /<main id="main">/);
  assert.equal((home.match(/<h1[ >]/g) || []).length, 1);
  for (const href of ['/platform-terms#agreement', '/platform-terms#schedule-a', '/platform-terms#data-terms']) assert.ok(home.includes(`href="${href}"`), href);
  // Those anchors exist on the terms page.
  const terms = read('platform-terms.html');
  for (const id of ['agreement', 'schedule-a', 'data-terms']) assert.ok(terms.includes(`id="${id}"`), id);
  const heads = [...home.matchAll(/<h([1-6])/g)].map((m) => +m[1]);
  for (let i = 1; i < heads.length; i++) assert.ok(heads[i] - heads[i - 1] <= 1, 'headings do not skip a level');
});

test('every internal link on the home page goes somewhere that exists', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const routes = vercel.routes.filter((r) => r.dest).map((r) => new RegExp('^' + r.src + '$'));
  for (const m of home.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
    const p = m[1];
    if (p === '/' || fs.existsSync(path.join(ROOT, p.replace(/^\//, ''))) || routes.some((r) => r.test(p)) || p === '/operator') continue;
    assert.fail(`no page for ${p}`);
  }
});

test('the palette passes WCAG AA for the text it carries', () => {
  const lum = (hex) => {
    const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const css = read('public/css/platform.css');
  const v = (name) => css.match(new RegExp(`--${name}:(#[0-9a-fA-F]{6})`))[1];
  const paper = v('paper'), ink = v('ink'), soft = v('soft'), accent = v('accent');
  const pairs = { 'ink on paper': [ink, paper], 'soft on paper': [soft, paper], 'accent text on paper': [accent, paper], 'white on accent button': ['#ffffff', accent], 'paper on ink band': [paper, ink], 'band body text on ink': ['#e4d8c6', ink], 'band eyebrow on ink': ['#f0b48f', ink], 'white on orange band': ['#ffffff', accent] };
  for (const [name, [a, b]] of Object.entries(pairs)) assert.ok(ratio(a, b) >= 4.5, `${name} is ${ratio(a, b).toFixed(2)}:1, below 4.5:1`);
});

test('the staff areas stay out of search; the public pages are offered and in the sitemap', () => {
  const v = JSON.parse(read('vercel.json'));
  const noindex = v.routes.find((r) => r.headers && r.headers['X-Robots-Tag'] && /operator/.test(r.src));
  assert.ok(noindex && /noindex/.test(noindex.headers['X-Robots-Tag']) && noindex.continue === true);
  for (const p of ['/operator/today', '/driver/login', '/set-password']) assert.ok(new RegExp('^' + noindex.src + '$').test(p), p);
  assert.ok(!new RegExp('^' + noindex.src + '$').test('/signup'));
  assert.match(read('apps/operator/src/app/layout.tsx'), /robots:\s*\{\s*index:\s*false/);
  assert.match(read('apps/driver/app/layout.tsx'), /robots:\s*\{\s*index:\s*false/);
  const robots = read('robots.txt');
  for (const d of ['/operator', '/driver', '/api/', '/booking', '/account']) assert.ok(robots.includes(`Disallow: ${d}`), d);
  assert.match(robots, /Sitemap: https:\/\/winjo-dispatch\.vercel\.app\/sitemap\.xml/);
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, /<loc>https:\/\/winjo-dispatch\.vercel\.app\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/winjo-dispatch\.vercel\.app\/signup<\/loc>/);
  assert.ok(v.routes.some((r) => r.src === '/sitemap.xml'));
  assert.match(read('platform-terms.html'), /name="robots" content="noindex"/, 'the contract page stays out of search');
});
