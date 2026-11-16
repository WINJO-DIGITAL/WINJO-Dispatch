// Emails to operator staff about their own account (team invite, password
// reset). Operator-app only, so they live outside content.js/template.js,
// which are kept identical to the website's copies. Same layout via renderEmail.
import { renderEmail, renderText } from './template.js';
import { withBrandOf } from './brand.js';

const oneLine = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
function build(subject, spec) { return { subject: oneLine(subject), spec, html: renderEmail(spec), text: renderText(spec) }; }

const ROLE = { operator_admin: 'an admin', dispatcher: 'a dispatcher' };

/** Someone was added to the team. `newAccount` = they still need to set a password. */
function teamInvite__build({ businessName, inviterName, role, url, newAccount }) {
  const who = inviterName ? `${inviterName} has` : 'You have been';
  return build(`You've been added to ${businessName}`, {
    audience: 'staff', preheader: `${newAccount ? 'Set your password to' : 'Sign in to'} the ${businessName} operator app.`,
    status: { label: 'Team invite', tone: 'gold' }, title: `Join ${businessName}`,
    intro: [
      `${who} added you to ${businessName} as ${ROLE[role] || 'a team member'} on the operator app, where the team manages bookings, drivers and customers.`,
      newAccount ? 'Use the button to choose your password. The link works once; if it has expired, ask for a new invite.'
                 : 'You already have an account, so the button signs you straight in. The link works once.',
    ],
    button: { label: newAccount ? 'Set your password' : 'Open the operator app', url },
  });
}

function passwordReset__build({ businessName, url }) {
  return build(`Reset your ${businessName} operator password`, {
    audience: 'staff', preheader: 'Choose a new password for the operator app.',
    status: { label: 'Password reset', tone: 'gold' }, title: 'Choose a new password',
    intro: [
      'Someone asked to reset the password for this email address on the operator app. If it was you, use the button to choose a new one. The link works once.',
      "If it wasn't you, ignore this email; your password hasn't changed.",
    ],
    button: { label: 'Choose a new password', url },
  });
}

// A six-digit code is the main way in: on an iPhone, a link in an email opens Safari, not the
// Home Screen app, so the person would be signed in in the wrong place. The button stays as a
// fallback for computers.
const codeBlock = (code) => ({
  html: `<span style="display:inline-block;font-size:34px;line-height:40px;font-weight:800;letter-spacing:.28em;color:#0B132B;background:#F5F6F9;border:1px solid #DCE0E8;border-radius:10px;padding:10px 18px">${String(code).replace(/[^0-9]/g, '')}</span>`,
  text: `Your sign-in code: ${String(code).replace(/[^0-9]/g, '')}`,
});

function signInLink__build({ businessName, url, code }) {
  const hasCode = /^[0-9]{6,10}$/.test(String(code || ''));
  return build(`Your ${businessName} operator sign-in ${hasCode ? 'code' : 'link'}`, {
    audience: 'staff', preheader: hasCode ? `Your sign-in code is ${code}.` : 'Use this link to sign in to the operator app.',
    status: { label: 'Sign in', tone: 'gold' }, title: 'Sign in to the operator app',
    intro: hasCode
      ? [
        `Type this code into the ${businessName} operator app to sign in. You do not need a password. It works once and expires in an hour.`,
        codeBlock(code),
        'On a computer you can use the button instead. On an iPhone, type the code in the app: the button would open Safari.',
        "If you didn't ask for it, ignore this email; nobody can sign in without it.",
      ]
      : [
        `Use the button to sign in to the ${businessName} operator app. You do not need a password. The link works once and expires in an hour.`,
        "If you didn't ask for it, ignore this email; nobody can sign in without it.",
      ],
    button: { label: 'Sign in', url },
  });
}

/** A driver was invited to the Driver App. `newAccount` = they still need to set a password. */
function driverInvite__build({ businessName, driverName, inviterName, url, newAccount }) {
  const first = String(driverName || '').trim().split(/\s+/)[0];
  const who = inviterName ? `${inviterName} has` : `${businessName} has`;
  return build(`Your ${businessName} Driver App login`, {
    audience: 'driver', preheader: `${newAccount ? 'Set your password for' : 'Sign in to'} the ${businessName} Driver App.`,
    status: { label: 'Driver App', tone: 'gold' }, title: first ? `Welcome, ${first}` : 'Welcome to the Driver App',
    intro: [
      `${who} set you up as a driver on the ${businessName} Driver App. It shows the jobs assigned to you, lets you update each trip as you go and send customers their reminder texts.`,
      newAccount ? 'Use the button to choose your password, then add the app to your home screen. The link works once; if it has expired, ask the office to send a new one.'
                 : 'Use the button to choose a new password and sign in. The link works once.',
    ],
    button: { label: newAccount ? 'Set your password' : 'Choose a new password', url },
  });
}

// Built for the business named by `tenant_id` in the argument (the caller's own).
export const teamInvite = withBrandOf(teamInvite__build);
export const passwordReset = withBrandOf(passwordReset__build);
export const signInLink = withBrandOf(signInLink__build);
export const driverInvite = withBrandOf(driverInvite__build);
