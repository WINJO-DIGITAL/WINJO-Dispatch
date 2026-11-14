'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../../lib/signup');
const M = require('../../lib/markdown');
const T = require('../../scripts/build-platform-terms');

const ok = (over = {}) => ({ business_name: 'Moor Cars Ltd', slug: 'moor-cars', contact_name: 'Sam Moor', contact_email: 'Sam@Moor.test', contact_phone: '07700 900001', message: 'Hello', accept_contract: true, accept_responsibilities: true, ...over });
const docs = (f) => fs.readFileSync(path.join(__dirname, '../../docs/legal', f), 'utf8');

test('a complete application is accepted and tidied', () => {
  const r = S.validate(ok({ business_name: '  Moor Cars Ltd  ' }));
  assert.deepEqual(r.errors, {});
  assert.equal(r.clean.business_name, 'Moor Cars Ltd');
  assert.equal(r.clean.contact_email, 'sam@moor.test');
});

test('both acceptances are required, and only a real true counts', () => {
  for (const v of [false, undefined, 'true', 1, 'yes']) {
    assert.ok(S.validate(ok({ accept_contract: v })).errors.accept_contract, String(v));
    assert.ok(S.validate(ok({ accept_responsibilities: v })).errors.accept_responsibilities, String(v));
  }
});

test('required details and their formats are checked', () => {
  const e = S.validate({ accept_contract: true, accept_responsibilities: true }).errors;
  for (const k of ['business_name', 'slug', 'contact_name', 'contact_email']) assert.ok(e[k], k);
  assert.ok(S.validate(ok({ contact_email: 'nope' })).errors.contact_email);
  assert.ok(S.validate(ok({ contact_phone: 'call me' })).errors.contact_phone);
  assert.equal(S.validate(ok({ contact_phone: '' })).clean.contact_phone, null);
});

test('short names: format, reserved words and length', () => {
  for (const bad of ['Moor Cars', 'moor_cars', '-moor', 'moor-', 'moor--cars', 'x'.repeat(41)]) assert.ok(S.validate(ok({ slug: bad })).errors.slug, bad);
  for (const word of ['admin', 'api', 'operator', 'driver', 'login', 'signup', 'ev-exec']) assert.ok(S.validate(ok({ slug: word })).errors.slug, word);
  assert.deepEqual(S.validate(ok({ slug: 'moor-cars-2' })).errors, {});
});

test('a short name is suggested from the business name', () => {
  assert.equal(S.suggestSlug("Moor & Dale Cars Ltd."), 'moor-and-dale-cars-ltd');
  assert.equal(S.suggestSlug('Café Léon'), 'cafe-leon');
  assert.equal(S.suggestSlug('  --  '), '');
  assert.ok(S.suggestSlug('a'.repeat(80)).length <= 40);
});

test('control characters are stripped and long text is capped', () => {
  const r = S.validate(ok({ message: 'a\u0000b'.repeat(2000), business_name: 'X\u0007Y' }));
  assert.equal(r.clean.business_name, 'XY');
  assert.ok(r.clean.message.length <= 1000 && !r.clean.message.includes('\u0000'));
});

test('money is shown in pounds', () => {
  assert.equal(S.gbp(99900), '£999');
  assert.equal(S.gbp(9900), '£99');
  assert.equal(S.gbp(12345), '£123.45');
  assert.equal(S.gbp(0), '£0');
});

test('the accepted versions match the headings of the documents', () => {
  assert.match(docs('operator-contract.md').split('\n')[0], new RegExp(`\\(version ${S.CONTRACT_VERSION},`));
  assert.match(docs('operator-responsibilities.md').split('\n')[0], new RegExp(`\\(version ${S.RESPONSIBILITIES_VERSION},`));
});

// ── the markdown converter ────────────────────────────────────────────────
test('markdown: text is escaped before anything else, so a document cannot add markup', () => {
  const html = M.render('# Hi <script>alert(1)</script>\n\nA **bold** & `code <b>` line.\n\n- one <img src=x onerror=1>\n- two');
  assert.doesNotMatch(html, /<script|<img|<b>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<strong>bold<\/strong> &amp; <code>code &lt;b&gt;<\/code>/);
  assert.match(html, /<ul><li>one/);
});

test('markdown: tables, numbered lists and rules', () => {
  const html = M.render('| A | B |\n|---|---|\n| 1 | 2 |\n\n1. first\n2. second\n\n---\n\n| | |\n|---|---|\n| k | v |');
  assert.match(html, /<th>A<\/th><th>B<\/th>/);
  assert.match(html, /<td>1<\/td><td>2<\/td>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<hr>/);
  assert.doesNotMatch(html.split('<hr>')[1], /<thead>/, 'an empty header row is not drawn');
});

// ── the published terms page ───────────────────────────────────────────────
test('the published terms page is the one built from the documents (run npm run build:terms)', () => {
  const file = fs.readFileSync(path.join(__dirname, '../../platform-terms.html'), 'utf8');
  assert.equal(file, T.build());
});

test('the terms page leaves out the other business\'s details and the internal notes', () => {
  const html = T.build();
  for (const secret of ['Wheeler Hub', 'PHO0079', '07721', 'C2085772', 'book@evexec', 'a customer like any other']) assert.ok(!html.includes(secret), secret);
  for (const heading of ['Fill in before first use', 'Notes on how this was built', 'What the owner must fill in or check before use']) assert.doesNotMatch(html, new RegExp(`<h[1-3][^>]*>${heading}`), `${heading} is internal`);
  assert.match(html, /Schedule B: Fees/);
  assert.match(html, /£999/);
  assert.match(html, /Template \(for each new Operator\)/);
});

test('the published terms no longer name EV Exec (owner decision 13/11/2026; wording version 2, 14/11/2026)', () => {
  const hits = (T.build().match(/[^.<>]*EV Exec[^.<>]*/g) || []).map((x) => x.trim());
  assert.deepEqual(hits, []);
});

test('the status line no longer points to an unpublished section or internal file names', () => {
  const html = T.build();
  assert.doesNotMatch(html, /Fill in before first use/);
  assert.doesNotMatch(html, /audit-2026-11-12/);
});
