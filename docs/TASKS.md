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

## Open: needs the owner's approval

- [ ] **Database clean-up of the seed business and old names** (live changes): the seeded business row (`ev-exec`, name "Johns Taxis"), the `evexec_*` function names, the default `ref_prefix 'EVX'`, the `evexec_notification_email` helper, the backup function that points at another project, and old-project defaults in functions. Plan and list in `supabase/baseline/README.md` once prepared.
- [ ] **Operator push alerts**: `public.push_config` has no row, so new-booking and no-show alerts send nothing. Needs a generated shared secret and VAPID keys (live change).
- [ ] Fix `DRIVER_APP_URL` and `NEXT_PUBLIC_DRIVER_APP_URL` on the main project to `https://winjo-dispatch.vercel.app/driver` (they currently lack `/driver`), then redeploy production.
- [ ] Automatic monthly billing of operators (Stripe Billing has its own fees). Live mode for Stripe Connect (after a test payment passes). Anything that costs money or turns Twilio on.
- [ ] Owner actions: revoke the temporary Supabase access token and the full-access Resend key when go-live is finished; GitHub repository variables `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` and secret `VERCEL_TOKEN` if the manual deploy workflow is wanted; link `/signup` from wherever it should be found; put the platform's home page copy in place (the home page is a neutral placeholder).

## Open: engineering

- [ ] One test-mode card payment through a second business on its connected account (needs Stripe test keys and a test operator).
- [ ] Operator app Settings, Website editor (site content, photos, design direction).
- [ ] More design directions and separate pages for the site builder.
- [ ] Review the Connect payment code before live mode.
- [ ] Tidy two `react-hooks/set-state-in-effect` lint warnings in the Operator app (`FeesSection.jsx`, `PaymentsSettings.jsx`) and the Driver App warnings.
- [ ] Driver App: coverage of the job screens is thin.
- [ ] Supabase size: needs owner approval for VACUUM FULL, a 5-minute job schedule and a keep period.
- [ ] Optional later: card payment of the set-up fee (adds fees and touches the payment webhook, so ask first); an email to the applicant when approved or rejected.

## Needs the owner's decision

- [ ] Support hours for operators (the Order Details decide these; none are published).
- [ ] VAT wording on the platform page.
- [ ] Data terms: still labelled "draft" until the owner signs them off.

## Test results (14/11/2026)

- Website: `npm run test:unit` 265 pass. Operator app: 416 pass, typecheck clean. Driver App: 93 unit and 22 function tests pass, typecheck clean. Database tests: run with `bash scripts/db-test.sh` (see HANDOVER).
