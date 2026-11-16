'use strict';
// The platform's own emails (to people applying, and to the platform owner). These are not a
// business's emails, so they use their own sender and never fall back to a business's address:
// with PLATFORM_FROM unset nothing is sent (and the caller logs that).
//   PLATFORM_FROM         e.g. Winjo Digital <hello@yourdomain>  (an address verified in Resend)
//   PLATFORM_REPLY_TO     optional
//   PLATFORM_OWNER_EMAIL  where new applications are announced

const { esc } = require('./legal');
const { gbp } = require('./signup');

const configured = () => String(process.env.PLATFORM_FROM || '').trim();

async function sendPlatformMail({ to, subject, text, html }) {
  const from = configured();
  if (!process.env.RESEND_API_KEY || !/<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(from)) return { skipped: true };
  const { deliverableRecipients } = require('./reserved-mail');
  const recipients = deliverableRecipients((Array.isArray(to) ? to : [to]).map((x) => String(x || '').trim()).filter(Boolean), 'Platform email');
  if (!recipients.length) return { skipped: true };
  const replyTo = String(process.env.PLATFORM_REPLY_TO || '').trim();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: recipients, subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Email send error ${res.status}`);
  return { sent: true };
}

const shell = (inner) => `<!doctype html><html lang="en-GB"><body style="margin:0;padding:24px;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#1d1b17"><div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;border:1px solid #ded8ca">${inner}</div></body></html>`;
const p = (t) => `<p style="margin:0 0 14px;font-size:16px;line-height:24px">${t}</p>`;
const ref = (id) => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();

/** What the applicant is sent straight away. */
function applicantAck(app, { termsUrl } = {}) {
  const r = ref(app.id);
  const lines = [
    `Hello ${app.contact_name},`,
    `We have your application for ${app.business_name} (reference ${r}).`,
    `What happens next: we will email you an invoice for the set-up fee of ${gbp(app.setup_pence)}. We start setting up your business once it is paid, and then the monthly fee of ${gbp(app.monthly_pence)} applies from the day your service is made available. No VAT is charged.`,
    `We check every application ourselves. Nothing is created and nothing is charged until we have been in touch.`,
    `You accepted the Operator Services Agreement (version ${app.contract_version}) and Schedule A, your responsibilities, when you applied.${termsUrl ? ` You can read them here: ${termsUrl}` : ''}`,
    `If something here is wrong, reply to this email.`,
  ];
  const html = shell(
    p(`Hello ${esc(app.contact_name)},`) +
    p(`We have your application for <strong>${esc(app.business_name)}</strong> (reference <strong>${esc(r)}</strong>).`) +
    p(`<strong>What happens next.</strong> We will email you an invoice for the set-up fee of ${esc(gbp(app.setup_pence))}. We start setting up your business once it is paid, and then the monthly fee of ${esc(gbp(app.monthly_pence))} applies from the day your service is made available. No VAT is charged.`) +
    p('We check every application ourselves. Nothing is created and nothing is charged until we have been in touch.') +
    p(`You accepted the Operator Services Agreement (version ${esc(app.contract_version)}) and Schedule A, your responsibilities, when you applied.${termsUrl ? ` <a href="${esc(termsUrl)}">Read them here</a>.` : ''}`) +
    p('If something here is wrong, reply to this email.'));
  return { subject: `We have your application (${r})`, text: lines.join('\n\n'), html };
}

/** What the platform owner is sent when someone applies. */
function ownerAlert(app) {
  const r = ref(app.id);
  const rows = [['Business', app.business_name], ['Short name', app.slug], ['Contact', app.contact_name], ['Email', app.contact_email], ['Phone', app.contact_phone || 'none given'], ['Message', app.message || 'none'], ['Set-up fee', gbp(app.setup_pence)], ['Monthly fee', gbp(app.monthly_pence)], ['Accepted', `Agreement v${app.contract_version}, Schedule A v${app.responsibilities_version}`]];
  const textBody = [`New application ${r}`, ...rows.map(([k, v]) => `${k}: ${v}`), '', 'To go ahead: send the invoice, confirm payment, then approve it (Operator app, Settings, Platform).'].join('\n');
  const html = shell(p(`<strong>New application ${esc(r)}</strong>`) + rows.map(([k, v]) => p(`<span style="color:#6b665a">${esc(k)}</span><br>${esc(v)}`)).join('') + p('To go ahead: send the invoice, confirm payment, then approve it.'));
  return { subject: `New application: ${app.business_name} (${r})`, text: textBody, html };
}

module.exports = { sendPlatformMail, applicantAck, ownerAlert, ref };
