'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validate, build } = require('../../scripts/template/new-business.js');

const example = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../../template/replica.config.example.json'), 'utf8'));

test('the example config is valid and builds the three files', () => {
  const r = build(example());
  assert.equal(r.errors, undefined);
  assert.deepEqual(Object.keys(r.files), ['01-provision.sql', '02-operator-app-checklist.md', '03-website-and-links.md']);
  assert.match(r.files['01-provision.sql'], /provision_tenant\('example-cars', 'Example Cars Ltd'/);
  assert.match(r.files['02-operator-app-checklist.md'], /Example Airport \| EXA \| £80\.00 \| £150\.00/);
});

test('slug, name, email and colour rules match the database', () => {
  const c = example();
  c.slug = 'Bad Slug'; c.name = ''; c.contact_email = 'nope'; c.branding.primary = 'red';
  const e = validate(c).join('\n');
  assert.match(e, /slug/); assert.match(e, /name/); assert.match(e, /contact_email/); assert.match(e, /branding\.primary/);
});

test('prices are checked: range, duplicates, code', () => {
  const c = example();
  c.pricing.airports = [{ name: 'A', one_way: 0, return_fare: 5 }, { name: 'a', code: 'TOOLONG', one_way: 10, return_fare: 20 }];
  const e = validate(c).join('\n');
  assert.match(e, /one_way/); assert.match(e, /repeated/); assert.match(e, /code/);
});

test('quotes in names cannot break out of the SQL', () => {
  const c = example();
  c.name = "O'Brien Cars'); drop table x; --";
  const s = build(c).files['01-provision.sql'];
  assert.match(s, /'O''Brien Cars''\); drop table x; --'/);
});

test('keys, tokens and passwords are refused anywhere in the file', () => {
  let c = example(); c.stripe_secret_key = 'x';
  assert.match(validate(c).join('\n'), /secret/);
  c = example(); c.invoice.address = 'sk_live_abcdefghijkl';
  assert.match(validate(c).join('\n'), /key or token/);
});

test('another business domain cannot be claimed', () => {
  const c = example(); c.website = 'https://www.evexec.co.uk';
  assert.match(validate(c).join('\n'), /belongs to another business/);
});

test('the domain step is only written when a website is given', () => {
  const c = example(); delete c.website;
  assert.doesNotMatch(build(c).files['03-website-and-links.md'], /tenant-domains/);
  assert.match(build(example()).files['03-website-and-links.md'], /"example\.test"/);
});
