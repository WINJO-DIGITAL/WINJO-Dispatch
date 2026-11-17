# Handover and onboarding runbook (14/11/2026)

Read this first, then `docs/OUTSTANDING.md` for the open checklist (only open items, including the owner's go-live checklist) and `docs/TASKS.md` for what is done. `docs/ENVIRONMENT.md` explains every setting, `docs/DEPLOYMENT.md` how deploys and the build guard work. Written so the work can be picked up without anyone re-explaining it.

## What exists

One platform, three apps, many businesses, one repository:

- **Website** (repository root): a branded website for each business on its own domain (`lib/tenantSite.js`: home page with booking form, booking and payment page). Booking, payment, account and operator APIs are per business (each booking carries its own business). The platform's own address shows the public landing page for operators (`index.html`), `/signup` is the self-serve sign-up, `/platform-terms` the contract an applicant reads.
- **Operator app** (`apps/operator`, served under `/operator` on the platform address): the office app. Each business has its own staff, prices, branding, legal settings, Stripe connection and drivers. The platform owner (super admin) also has Settings, Platform: set up businesses, set each one's website address, record fees, and review sign-up applications.
- **Driver App** (`apps/driver`, served under `/driver`): drivers sign in through their business's own link (`/driver/login?b=<short name>`).
- **Database** (Supabase project WINJO DISPATCH, `lztbivgmhcgohhvgakyu`): every business-owned row has a `tenant_id`; row-level security limits staff to their own business. Verified by the local database suite (`scripts/db-test.sh`).
- **There is no built-in business.** A business has only what its own database row holds (name, contact details, brand, prices). On the shared platform an address that is no business's own gets no business: the booking API answers "No business found for this address". A dedicated deployment for one business can set `TENANT_ID` (and `STRIPE_PLATFORM_TENANT_ID` if that business holds the deployment's Stripe account).

## Live addresses and deploys (14/11/2026)

- Two Vercel projects (team `winjodigital`, `team_RhhxQIJqo6pFuKaXFV7lWZuW`), both deployed to production from this repository on 14/11/2026 with the owner's approval:
  - `winjo-dispatch` (`prj_1TscAwPpnsRSyx3xhYXRK0nrppN2`): website + Operator app, address `https://winjo-dispatch.vercel.app`. The root `vercel.json` also forwards `/driver` to the Driver project.
  - `winjo-driver` (`prj_Zf6uGdTX4FtCeSwPQvSu54BOpRGW`, root directory `apps/driver`): Driver App, address `https://winjo-driver.vercel.app`. Test deployments use its custom environment `staging`.
- Two Next apps cannot share one project's `builds` (the builds collide), which is why the Driver App is a separate project. The Driver App's pages live in `apps/driver/app/driver/` (no `basePath`), links go through `withBase()`, and `/driver/_next/*` is rewritten to `/_next/*`.
- Git deployments are off in both; deploys are triggered through the Vercel API. Each project's ignore-build-step skips production, so a production deploy lifts the guard for that one deploy and restores it. **Every production deploy needs the owner's explicit approval.**
- No custom domains yet. A business's own domain is served by its own site only when it is listed in `config/tenant-domains.json` and `npm run build:domains` has written its route into `vercel.json`.

## How the website chooses the business

The visitor's domain is matched to the business whose website address (`tenants.brand.site_url`) is that domain (`tenantIdFor` in `lib/brand.js`). Two businesses can never share a domain (database unique index; owner-only `set_tenant_site`).

## Onboarding a new business: who does what

| Step | Who | Where |
|---|---|---|
| 1. Business applies on `/signup`, accepts the Operator Services Agreement and Schedule A, pays the £999 set-up fee outside the app | Customer | `/signup`, `docs/legal/operator-contract.md` |
| 2. Owner confirms payment and approves the application (this creates the business) and invites its first admin | Owner | Operator app, Settings, Platform, Applications |
| 3. Admin sets business details, prices, logo and colours, legal details, cancellation policy, and ticks the responsibilities confirmation | Customer | Operator app, Settings (Business, Prices, Branding, Legal) |
| 4. Admin connects its Stripe account (test mode first) | Customer | Operator app, Settings, Payments |
| 5. Admin adds drivers and invites them to the Driver App | Customer | Operator app, Drivers |
| 6. Customer buys its domain (a few pounds a year, in its own name) | Customer | Any registrar |
| 7. Add the domain to the website's Vercel project and set DNS as Vercel says. **May cost money on the hosting plan: ask the owner first.** | Owner | Vercel, Project, Domains |
| 8. Save the website address (`https://www.example.co.uk`) for the business | Owner | Operator app, Settings, Platform, Website address |
| 9. Add the domain (no www) to `config/tenant-domains.json`, run `npm run build:domains`, merge, deploy | Engineer | This repository |
| 10. Test end to end on the real domain: book, accept in the Operator app, pay (Stripe test mode), check the emails | Owner and engineer | Customer's domain |
| 11. Go live: Stripe live mode and webhook for that business, remove test bookings | Owner | Stripe, Vercel |

## Owner login and platform settings

- **Owner login:** `hello@winjodigital.co.uk` is an **email-only** account (no password) with one `tenant_users` row, role `super_admin`, no business. Sign in by requesting an email link on the Operator app's sign-in page (`/api/auth/email-link`); tested end to end on the live address (14/11/2026). Settings, Platform then appears.
- **Website project settings** (none secret): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PLATFORM_FROM` (`Winjo Digital <hello@winjodigital.co.uk>`), `PLATFORM_REPLY_TO`, `PLATFORM_OWNER_EMAIL`, plus `DRIVER_APP_URL`, `NEXT_PUBLIC_DRIVER_APP_URL` and `NEXT_PUBLIC_OPERATOR_URL`. **The two driver values must include the path: `https://winjo-dispatch.vercel.app/driver`.** Secret (Sensitive): `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (sending access only, limited to winjodigital.co.uk).
- **Driver project settings:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public values), set for production/preview and separately for the `staging` environment.
- Resend: domain winjodigital.co.uk verified, sending enabled, eu-west-1.
- Stripe: **test mode** is set up (15/11/2026): `STRIPE_PLATFORM_SECRET_KEY` (test key), `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` on the main project, all Sensitive, Production only. Webhook address: `/api/payment/stripe-webhook`. Connected accounts are created with Stripe's Accounts v2 call (`apps/operator/src/lib/server/stripeConnect.ts`); onboarding links, status and payments use v1. The environment also holds a saved test credential for `api.stripe.com`. Never live without the owner's go-ahead. Stripe's checkout and onboarding pages block automated browsers, so a real card-page test needs a person.
- The temporary Supabase access token and the full-access Resend key used for set-up are still held; the owner keeps them until go-live is finished.

## Push alerts

- `public.push_config` holds one row (set 15/11/2026): the VAPID key pair, the subject `mailto:hello@winjodigital.co.uk` and the shared secret the database triggers send. New-booking and no-show triggers post to `https://winjo-dispatch.vercel.app/api/push/dispatch`, which checks that secret.
- Driver alerts: triggers call the edge functions `send-push` and `notify-job-update` on this Supabase project with the vault secret `driver_alert_webhook_secret`. The functions read `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` from the project's Edge Function secrets (the same pair as `push_config`). The Driver App's public key is in `apps/driver/lib/config.ts`; if the pair ever changes, change all three places and redeploy the Driver App.
- Nothing has been pushed to a real device yet: there is no business, driver or subscribed device on live.

## Deploying from a session

The cloud environment holds saved credentials for `api.vercel.com` and `api.supabase.com` (entered by the owner through the secure form, never visible to the session). Deploys and read-only database checks can be made with plain HTTPS calls to those APIs; the Vercel and Supabase connectors are not needed. A production deploy: clear the project's ignore-build-step, create the deployment with `target: production`, wait for READY, put the ignore-build-step back.

## How to run the tests

- Website: `npm run test:unit` (265 tests; Node 24 per `.nvmrc`) and `npm run test:browser` (Chromium; screenshots in `tests/browser/out/`).
- Database: `bash scripts/db-test.sh` (builds a throwaway Postgres 17 from `supabase/baseline/schema.sql`; pgTAP). It needs Postgres 17 and pgTAP from the PostgreSQL apt repository (see `.github/workflows/db-tests.yml`). Docker is not used. If Postgres 17 is missing it exits 2 with a message.
- Operator app (`apps/operator`): `npm test` (428 tests), `npx tsc --noEmit`, `npm run lint`.
- Driver App (`apps/driver`): `npm test`, `npm run test:functions`, `npx tsc --noEmit`, `npm run lint`.

## Known limits (honest list)

- Not yet tested on a real second domain (needs a domain and a hosting decision).
- Stripe Connect has had a full test-mode payment (a test card on a sample business's own Stripe account, marked Paid by the webhook), but never a live one.
- A real push alert has not reached a real phone yet: the "Send a test notification" button exists for that check (see `docs/OUTSTANDING.md`).
- The platform has no privacy notice for people who apply on `/signup` yet (see `docs/OUTSTANDING.md`).
- Customer accounts and Privilege Points exist on the platform's customer pages; a business's own website has the booking form, booking page, payment and look-up.
- Invitation and password emails come from the platform's sender address.
- Monthly billing of businesses is not built (fees are recorded only). It needs the owner's approval, because Stripe Billing has its own fees.
- No SMS is sent by the platform (Twilio is off by owner decision); customer texts are two-tap messages sent from the office's or a driver's own phone. The text-message link format has not been confirmed on a real iPhone.
- Real-device checks (touch targets, keyboard, push) are not covered by the screenshot reviews.

## Decisions already made by the owner

£999 set-up and £99 a month; the customer buys its own domain; the platform takes no percentage of card payments; no solicitor (wording checked against official UK sources, see `docs/legal/audit-2026-11-12.md`); no paid services without asking first; the platform is software only and each operator is responsible for its own licences, insurance and compliance.
