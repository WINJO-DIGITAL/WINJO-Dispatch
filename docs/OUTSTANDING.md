# Outstanding checklist

Only open items are listed here. What is done is in `docs/TASKS.md`. Last updated 17/11/2026.

## Go-live checklist: only what the owner must do himself

Claude has done everything that does not need a human decision, a secret only the owner holds, or a real phone. In this order:

1. **Review and merge the pull request** for `claude/dispatch-launch-ready` (say "merge" to have it merged) and approve a production deploy of the main site (see `docs/DEPLOYMENT.md`).
2. **Set `CRON_SECRET` and `OPERATOR_ACTION_SECRET` in Vercel** (project `winjo-dispatch`, Settings, Environment Variables, Production, type **Sensitive**), then redeploy. Generate each with `openssl rand -hex 32`, or any 64-character random string. **Do this at the same time as step 1**: until `CRON_SECRET` is set, the daily reminders and flight re-checks do not run, and the email retry route now refuses every request (it used to let everyone through). Open `https://winjo-dispatch.vercel.app/api/health` afterwards: it should say `"ok": true` and list nothing under `missingRequired`. Today it would list exactly these two. The Google Maps keys (`GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) are **not needed**: the booking form has no map and works without them.
3. **Test a push alert on your phone.** Open `https://winjo-dispatch.vercel.app/operator` from the Home Screen icon (iPhone: Share, Add to Home Screen first), sign in with the six-digit code emailed to `hello@winjodigital.co.uk`, go to More, Settings, Notifications, tap **Enable**, allow notifications, then tap **Send a test notification to this device**. The page says whether it arrived.
4. **Keep Stripe in test mode until you say go.** The test payment has passed. Live mode is your decision; nothing is switched to live without it.
5. **After go-live, revoke the temporary Supabase access token and the full-access Resend key** that were used for set-up.
6. **Approve the first operator** (Operator app, Settings, Platform, Applications) once its set-up fee is paid, and **add its custom domain** (`docs/HANDOVER.md`, onboarding steps 6 to 9). Adding a domain to Vercel may cost money: ask first.
7. **Optional: the manual GitHub deploy Action.** Add the secret `VERCEL_TOKEN` and the variables `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as listed in `docs/DEPLOYMENT.md`. The API route works without it.

## Open decisions and gaps

- [ ] **A privacy notice for people who apply.** `/signup` collects a name, email, phone number and a free-text message, and the site has no privacy notice for the platform itself (the agreement's data terms cover operators' customers' data, and each business gets its own privacy page). UK data protection law expects one before collecting personal data. Per the project's legal rule it must be written from official sources (ICO guidance) and recorded in `docs/legal/audit-2026-11-12.md`. Claude can draft it from the ICO's privacy-notice guidance when asked; it has not been written because it is a new legal document.
- [ ] **Monthly billing of operators is not built.** A design note is ready for approval: `docs/billing-design.md`. Stripe Billing has its own fees, so nothing is built without approval.
- [ ] **Live mode for Stripe Connect.** Review the Connect payment code once more before it, as agreed.
- [ ] Supabase size: needs approval for VACUUM FULL, a 5-minute job schedule and a keep period.

## Optional, only if wanted

- [ ] Driver App: 8 lint warnings (no errors), all the standard load-on-open effect pattern. Explained in `docs/TASKS.md`, "Left on purpose".
- [ ] More site-builder design directions and separate pages.
- [ ] An email to an applicant when approved or rejected; card payment of the set-up fee (adds fees, touches the payment webhook, so ask first).
