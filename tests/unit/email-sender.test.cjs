'use strict';
// Who an email is from and where replies go: a business's customers reply to
// that business, never to Acme Cars's inbox.
process.env.RESEND_API_KEY = 're_unit';
process.env.RESEND_FROM = 'Platform <bookings@platform.test>';
delete process.env.REPLY_TO;

const test = require('node:test');
const assert = require('node:assert/strict');
const brand = require('../../lib/brand');
const { sendEmail } = require('../../lib/channels');

const EV = 'a0000000-0000-4000-8000-000000000001';
const OTHER = 'dddddddd-0000-4000-8000-000000000002';
const BARE = 'eeeeeeee-0000-4000-8000-000000000003';
brand._setBrands({
  [EV]: { name: 'Acme Cars', contact_email: 'bookings@acme-cars.test', brand: {} },
  [OTHER]: { name: 'Coastal Cars', contact_email: 'hello@coastal.test', brand: {} },
  [BARE]: { name: 'Bare Business', contact_email: null, brand: {} },
});

let sent;
global.fetch = async (url, opts) => { sent = JSON.parse(opts.body); return { ok: true, status: 200, text: async () => '{}' }; };
const send = (tenantId) => sendEmail({ to: 'a@b.test', subject: 's', html: '<p>x</p>', tenantId });

test('another business: its name as sender, replies to its own email', async () => {
  await send(OTHER);
  assert.equal(sent.from, 'Coastal Cars <bookings@platform.test>');
  assert.equal(sent.reply_to, 'hello@coastal.test');
});

test('a business with no contact email gets no reply-to (never Acme Cars\'s)', async () => {
  process.env.REPLY_TO = 'bookings@acme-cars.test';
  await send(BARE);
  assert.equal(sent.reply_to, undefined);
  assert.equal(sent.from, 'Bare Business <bookings@platform.test>');
  delete process.env.REPLY_TO;
});

test('the site\'s own business keeps its configured REPLY_TO, else its contact email', async () => {
  process.env.REPLY_TO = 'replies@acme-cars.test';
  await send(EV);
  assert.equal(sent.reply_to, 'replies@acme-cars.test');
  assert.equal(sent.from, 'Acme Cars <bookings@platform.test>');
  delete process.env.REPLY_TO;
  await send(undefined);
  assert.equal(sent.reply_to, 'bookings@acme-cars.test');
});

test('characters that could break the sender name are removed', async () => {
  brand._setBrands({ [OTHER]: { name: 'A "B" <C>, Ltd', contact_email: 'x@y.test', brand: {} } });
  await send(OTHER);
  assert.equal(sent.from, 'A B C Ltd <bookings@platform.test>');
});
