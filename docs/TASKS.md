# Winjo Dispatch platform: progress tracker

Kept up to date by the engineering loop (assess, plan, build, test, fix, review, repeat). Read this first to pick up the work. The onboarding runbook, addresses and settings are in `docs/HANDOVER.md`.

## Objective

A multi-tenant booking, dispatch and payments platform (website, Operator app, Driver App) that Winjo Digital owns and sells to operators. Operators take card payments directly on their own Stripe account (Stripe Connect, no platform percentage). Platform fees are recorded, not billed. Cost rule: nothing may create a billed resource without the owner's approval. Twilio stays dormant. The platform is software only; each operator is responsible for its own licences, insurance and compliance.

## Done

- **One repository, three apps** (14/11/2026): website at the root, `apps/operator`, `apps/driver`; two Vercel projects, both deployed to production with the owner's approval; `/driver` forwarded from the main address. Merged to `main`.
- Multi-tenant schema, per-business pricing, branding, legal pages, team and driver invites, platform business set-up, platform fees record.
- Stripe Connect phases 1 and 2 (connect an account; checkout, payment check, payment links, receipts and webhook on the operator's account; a payment can only mark its own business's booking Paid).
- Self-serve sign-up (`/signup`, `/platform-terms`, applications table, Operator app Settings, Platform, Applications). Contract and Schedule A at version 2.
- Owner login `hello@winjodigital.co.uk` (email-only, `super_admin`); email sign-in tested end to end on the live address.
- Site builder (content format, renderer, three design directions, per-business sitemap).
- Database baseline applied to the platform's Supabase project (14/11/2026); database tests, website tests, Operator app tests and Driver App tests all pass.
- **Earlier-product references removed** (14/11/2026, owner instruction): no built-in business, price list, brand, Stripe owner or default tenant in the code, tests, docs or assets; neutral sample data in tests. Database items are tracked below.

- **Database clean-up** (14/11/2026): seed business removed, old helper functions dropped, defaults switched to `private.my_tenant_id()` and `WJD`; baseline matches live.
- **Push alerts set up** (15/11/2026): `push_config` row (new VAPID key pair and shared secret), the same keys as edge function secrets, edge functions `send-push` and `notify-job-update` deployed, Driver App on the new public key and deployed to production (commit `6614d54`). No device has subscribed yet (there is no business on live), so a real push is still untested.
- **Settings, Website editor** in the Operator app (15/11/2026): design direction, home page words, about, services, vehicles, areas, reviews, questions, contact, search wording, photos (own folder only, PNG/JPG/WebP up to 5 MB), save draft / publish. Saves through `update_tenant_site`. On the branch, not yet deployed.
- `DRIVER_APP_URL` and `NEXT_PUBLIC_DRIVER_APP_URL` on the main project include `/driver` (checked 15/11/2026).

## Open: needs the owner's approval

- [ ] **Production deploy of the website + Operator app** so the new Settings, Website editor goes live (built and tested on the branch, 15/11/2026).
- [ ] **A test business on live**, to run sign-up, set-up, a booking, emails and a push alert end to end (creates live data).
- [ ] Old profile and activity rows still filed under the removed seed business: clear them or leave them (data deletion).
- [ ] Automatic monthly billing of operators (Stripe Billing has its own fees). Live mode for Stripe Connect (after a test payment passes). Anything that costs money or turns Twilio on.
- [ ] Owner actions: revoke the temporary Supabase access token and the full-access Resend key when go-live is finished; GitHub repository variables `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` and secret `VERCEL_TOKEN` if the manual deploy workflow is wanted; link `/signup` from wherever it should be found; put the platform's home page copy in place (the home page is a neutral placeholder).

## Open: engineering

- [ ] One test-mode card payment through a second business on its connected account (needs Stripe test keys and a test operator).
- [ ] More design directions and separate pages for the site builder.
- [ ] Review the Connect payment code before live mode.
- [ ] Driver App lint warnings (the Operator app is clean).
- [ ] Driver App: coverage of the job screens is thin.
- [ ] Supabase size: needs owner approval for VACUUM FULL, a 5-minute job schedule and a keep period.
- [ ] Optional later: card payment of the set-up fee (adds fees and touches the payment webhook, so ask first); an email to the applicant when approved or rejected.

## Needs the owner's decision

- [ ] Support hours for operators (the Order Details decide these; none are published).
- [ ] VAT wording on the platform page.
- [ ] Data terms: still labelled "draft" until the owner signs them off.

## Test results (15/11/2026)

- Website: `npm run test:unit` 265 pass. Operator app: 428 pass, typecheck, lint and build clean. Driver App: 93 unit and 22 function tests pass, typecheck clean. Database tests: run with `bash scripts/db-test.sh` (see HANDOVER).
