# Winjo Dispatch platform: what is done

The history of the build. **What is still open, including the owner's go-live checklist, is in `docs/OUTSTANDING.md`** (one list, so the two cannot disagree). The onboarding runbook, addresses and settings are in `docs/HANDOVER.md`; deploys in `docs/DEPLOYMENT.md`; every setting in `docs/ENVIRONMENT.md`.

## Objective

A multi-tenant booking, dispatch and payments platform (website, Operator app, Driver App) that Winjo Digital owns and sells to operators. Operators take card payments directly on their own Stripe account (Stripe Connect, no platform percentage). Platform fees are recorded, not billed. Cost rule: nothing may create a billed resource without the owner's approval. Twilio stays dormant. The platform is software only; each operator is responsible for its own licences, insurance and compliance.

## Done

**Platform and apps**
- One repository, three apps (14/11/2026): website at the root, `apps/operator`, `apps/driver`; two Vercel projects; `/driver` forwarded from the main address.
- Multi-tenant schema, per-business pricing, branding, legal pages, team and driver invites, platform business set-up, platform fees record. The database baseline matches the live project (14 to 15/11/2026); seed business and old helper functions removed.
- Self-serve sign-up (`/signup`, `/platform-terms`, applications table, Operator app Settings, Platform, Applications). Contract version 3, Schedule A version 2.
- Owner login `hello@winjodigital.co.uk` (email only, `super_admin`). Sign-in is a six-digit code typed into the app, with the emailed link as a fallback (16/11/2026), so an iPhone Home Screen app signs in in place.
- Site builder (three design directions, per-business sitemap) and the Operator app's Settings, Website editor (design direction, wording, photos, draft and publish).
- Operator app and customer pages redesigned (16/11/2026): visible panels, calmer labels, light customer pages.
- **Public home page and sign-up** (17/11/2026): a real landing page in cream, dark brown and burnt orange, indexable, with a sitemap; the staff areas stay out of search.

**Payments**
- Stripe Connect: connect an account (Accounts v2), checkout, payment check, payment links, receipts and webhooks on the operator's own account; a payment can only mark its own business's booking Paid.
- Stripe test mode set up (15/11/2026): test key and both webhook secrets on the main Vercel project. Two bugs found by testing and fixed: Checkout no longer accepts `payment_method_types`, and connected accounts must be created with Accounts v2.
- **Full test payment passed** (15 to 16/11/2026): a £25 test card payment on a sample business's own Stripe account marked its booking Paid by card through the webhook. The sample business and its test account were then removed.

**Alerts**
- Web push set up (15/11/2026): `push_config` row, keys as edge function secrets, edge functions `send-push` and `notify-job-update`, Driver App on the new public key.
- **Send a test notification** (17/11/2026): Settings, Notifications, "Send a test notification to this device", staff only, own devices only, rate limited.

**Launch readiness (17/11/2026, PR #3, merged and deployed to production the same day)**
- Missing settings fail safely and say so: `CRON_SECRET` (cron routes refuse, one clear warning; the email retry route used to be open and is now closed), `OPERATOR_ACTION_SECRET` (emails and texts say "open your booking in the operator app" instead of carrying dead Accept and Reject links), `SUPABASE_URL` (no fallback to any live project; production refuses to start without it), Google Maps key (optional, the booking form has no map). `GET /api/health` reports each setting as true or false. Every setting is documented in `docs/ENVIRONMENT.md`.
- Driver App: tests for the job screen (start, arrive, on board, complete with payment, errors, offline) and the jobs list; the job screen and list say "couldn't be loaded, Try again" and "No signal, so this was not saved" instead of "Booking not found" or "No jobs"; an offline banner; lint warnings 21 to 8 (the rest are standard load-on-open effects).
- Docs: README corrected, `docs/DEPLOYMENT.md` (how the guard works), `docs/billing-design.md` (monthly billing, not built).

**Legal wording** (16/11/2026, recorded with sources and residual risks in `docs/legal/audit-2026-11-12.md`): data terms signed off (version 1); support hours 24 hours a day, every day, by email; not VAT registered.

## Test results (17/11/2026)

| Suite | Result |
|---|---|
| Website unit tests | 294 pass |
| Website browser tests | 18 pass |
| Database tests (pgTAP) | 14 files, 372 checks, 0 failed |
| Operator app | 459 pass; typecheck, lint and build clean |
| Driver App | 128 pass, 22 edge function tests pass; typecheck and build clean; 8 lint warnings (no errors) |

## Left on purpose

- **Driver App, 8 lint warnings.** All are `react-hooks/set-state-in-effect` on screens that load their data when they open (`useEffect(() => { load() }, [load])`: calendar, dashboard, earnings, jobs, job detail, my jobs, notifications, profile). The loader sets state after waiting for the network, which is the standard pattern. Getting the warning to go away means moving every screen to a shared data-loading hook, a larger change than a lint fix, so it was not done blind. The job detail and jobs list now have tests, so that change can be made safely later if wanted.
- **Monthly billing of operators** is not built: see `docs/billing-design.md`.
