# Outstanding checklist

Only open items are listed here. What is done is in `docs/TASKS.md`. Last updated 17/11/2026 (after the launch-readiness deploy).

## Go-live checklist: only what the owner must do himself

Done on 17/11/2026: PR #3 merged (`3b19ffd`), `CRON_SECRET` and `OPERATOR_ACTION_SECRET` set in Vercel (Production, Sensitive), main site deployed to production, and `GET /api/health` answers `"ok": true` with nothing under `missingRequired`. The three cron routes now answer 401 to anyone without the secret; Vercel sends it to its own cron calls.

Still to do, in this order:

1. **Test a push alert on your phone.** Open `https://winjo-dispatch.vercel.app/operator` from the Home Screen icon (iPhone: Share, Add to Home Screen first), sign in with the six-digit code emailed to `hello@winjodigital.co.uk`, go to More, Settings, Notifications, tap **Enable**, allow notifications, then tap **Send a test notification to this device**. The page says whether it arrived. Until a real phone has received one, push is untested.
2. **Keep Stripe in test mode until you say go.** The test payment has passed. Live mode is your decision; nothing is switched to live without it.
3. **After go-live, revoke the temporary Supabase access token and the full-access Resend key** that were used for set-up.
4. **Approve the first operator** (Operator app, Settings, Platform, Applications) once its set-up fee is paid, and **add its custom domain** (`docs/HANDOVER.md`, onboarding steps 6 to 9). Adding a domain to Vercel may cost money: ask first.
5. **Optional: the manual GitHub deploy Action.** Add the secret `VERCEL_TOKEN` and the variables `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as listed in `docs/DEPLOYMENT.md`. The API route works without it.

Optional settings that show `false` in `/api/health` and are not needed: `GOOGLE_MAPS_API_KEY` (there is no map), `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (website-side customer push; office alerts use the keys in the database) and `SITE_URL`.

## Open decisions and gaps

- [ ] **A privacy notice for people who apply.** `/signup` collects a name, email, phone number and a free-text message, and the site has no privacy notice for the platform itself (the agreement's data terms cover operators' customers' data, and each business gets its own privacy page). UK data protection law expects one before collecting personal data. Per the project's legal rule it must be written from official sources (ICO guidance) and recorded in `docs/legal/audit-2026-11-12.md`. Claude can draft it from the ICO's privacy-notice guidance when asked; it has not been written because it is a new legal document.
- [ ] **Monthly billing of operators is not built.** A design note is ready for approval: `docs/billing-design.md`. Stripe Billing has its own fees, so nothing is built without approval.
- [ ] **Live mode for Stripe Connect.** Review the Connect payment code once more before it, as agreed.
- [ ] Supabase size: needs approval for VACUUM FULL, a 5-minute job schedule and a keep period.

## Optional, only if wanted

- [ ] Driver App: 8 lint warnings (no errors), all the standard load-on-open effect pattern. Explained in `docs/TASKS.md`, "Left on purpose".
- [ ] More site-builder design directions and separate pages.
- [ ] An email to an applicant when approved or rejected; card payment of the set-up fee (adds fees, touches the payment webhook, so ask first).
