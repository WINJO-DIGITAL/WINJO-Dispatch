# Handover and onboarding runbook (13/11/2026)

Read this first, then `docs/TASKS.md` for the live checklist. Written so the work can be picked up without anyone re-explaining it.

## What exists

One platform, three apps, many businesses:

- **Website** (this repository, Vercel): a branded website for each business on its own domain (`lib/tenantSite.js`: home page with booking form, booking and payment page). Booking, payment, account and operator APIs are per business (each booking carries its own business). The platform's own address shows a neutral placeholder page.
- **Operator app** (`evexecoperator`): the office app. Each business has its own staff, prices, branding, legal settings, Stripe connection and drivers. The platform owner (super admin) also has Settings, Platform: set up businesses, set each one's website address, and record fees.
- **Driver App** (`evexecdriverapp`): drivers sign in through their business's own link (`/login?b=<short name>`).
- **Database** (Supabase, one project): every business-owned row has a `tenant_id`; row-level security limits staff to their own business. Verified by the local database suite (`scripts/db-test.sh`, 13 files).

## How the website chooses the business

The visitor's domain is matched to the business whose website address (`tenants.brand.site_url`) is that domain (`tenantIdFor` in `lib/brand.js`). A domain that matches none (a preview address) gets EV Exec. Two businesses can never share a domain (database unique index; owner-only `set_tenant_site`).

A business's domain is only served by its own website when it is listed in `config/tenant-domains.json` and `npm run build:domains` has written its route into `vercel.json`. The list is empty today, so EV Exec's site is untouched.

## Onboarding a new business: who does what

| Step | Who | Where |
|---|---|---|
| 1. Contract signed (Operator Services Agreement, responsibilities statement) and £999 set-up fee paid | Owner and customer | `docs/legal/operator-contract.md` |
| 2. Create the business and invite its first admin | Owner | Operator app, Settings, Platform, "Set up a business" then Invite |
| 3. Admin sets business details, prices, logo and colours, legal details, cancellation policy, and ticks the responsibilities confirmation | Customer | Operator app, Settings (Business, Prices, Branding, Legal) |
| 4. Admin connects its Stripe account (test mode first) | Customer | Operator app, Settings, Payments |
| 5. Admin adds drivers and invites them to the Driver App | Customer | Operator app, Drivers |
| 6. Customer buys its domain (a few pounds a year, in its own name) | Customer | Any registrar |
| 7. Add the domain to the website's Vercel project and set DNS as Vercel says. **May cost money on the hosting plan: ask the owner first.** | Owner | Vercel, Project, Domains |
| 8. Save the website address (`https://www.example.co.uk`) for the business | Owner | Operator app, Settings, Platform, Website address |
| 9. Add the domain (no www) to `config/tenant-domains.json`, run `npm run build:domains`, open a pull request, merge, deploy | Engineer | `evexec` repo |
| 10. Test end to end on the real domain: book, accept in the Operator app, pay (Stripe test mode), check the emails | Owner and engineer | Customer's domain |
| 11. Go live: Stripe live mode and webhook for that business, remove test bookings | Owner | Stripe, Vercel |

## Pending on the live database (needs the Supabase connection)

Apply in this order (all additive; each file is in `supabase/migrations/`):

1. `20261113160000_platform_fee_monthly_99.sql`: default monthly platform fee £99 (record only).
2. `20261113170000_close_anon_direct_inserts.sql`: removes the direct public inserts into quote requests and contact messages (the website writes them through its server).
3. `20261113180000_tenant_site_address.sql`: owner-only website address and one-domain-per-business index.

Until they are applied: the Fees screen shows £49, anonymous direct inserts remain open, and "Save" on a website address will report the function is missing. Also give the owner's login the `super_admin` role in `tenant_users` (so the Platform screen shows).

## Sign-up: what the owner sets up (14/11/2026)

1. **Owner login** (Supabase dashboard, project WINJO DISPATCH, Authentication, Users, "Add user", email `hello@winjodigital.co.uk`, tick "Auto confirm user", choose a password and keep it yourself; never send it in chat). Then tell the engineer, who adds its `tenant_users` row with role `super_admin` and no business. That row is what makes Settings, Platform (Applications, Fees, set up a business) appear in the Operator app.
2. **Website settings** (the hosting project's environment variables; none is a secret):
   - `PLATFORM_FROM` = `Winjo Digital <hello@winjodigital.co.uk>` (the domain winjodigital.co.uk must be verified in Resend, or the emails are refused; not checked from here)
   - `PLATFORM_REPLY_TO` = `hello@winjodigital.co.uk`
   - `PLATFORM_OWNER_EMAIL` = `hello@winjodigital.co.uk`
   - optional `PLATFORM_SITE_URL` = the platform's public address (https, no trailing slash)
   Also needed, and secret: `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` for this project, entered by the owner in the dashboard only.
3. **Nothing is live until a deploy is approved**: the pages and the form exist in the repository only.

### The Vercel project (created 14/11/2026, owner approved; Pro plan, so usage counts)
- Team `winjodigital` (`team_RhhxQIJqo6pFuKaXFV7lWZuW`), project `winjo-dispatch` (`prj_1TscAwPpnsRSyx3xhYXRK0nrppN2`), linked to `WINJO-DIGITAL/WINJO-Dispatch`, production branch `main`, Node 24.x. **Zero deployments so far.**
- Git-triggered deployments are **switched off** on the project, and its "ignored build step" also skips any Git-triggered production build. A production deploy therefore only happens when the owner approves it and runs `.github/workflows/deploy.yml` (or deploys from the Vercel dashboard). To get preview builds on branches, turn Git deployments on in the project's Git settings (the Vercel GitHub app must have access to the repository).
- Set (not secret, production and preview): `SUPABASE_URL` (the WINJO DISPATCH project), `SUPABASE_ANON_KEY` (the public browser key), `PLATFORM_FROM`, `PLATFORM_REPLY_TO`, `PLATFORM_OWNER_EMAIL`.
- **Still to be entered by the owner in the Vercel dashboard (secrets, Sensitive):** `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY`. Without the first, `/api/signup/apply` answers "not available right now".
- For the manual deploy workflow, the repository variables are `VERCEL_ORG_ID` = `team_RhhxQIJqo6pFuKaXFV7lWZuW` and `VERCEL_PROJECT_ID` = `prj_1TscAwPpnsRSyx3xhYXRK0nrppN2`, plus the secret `VERCEL_TOKEN`. (The IDs quoted earlier in the session were the retired account's; ignore them.)
- The other project on that account, `winjodigital` (repository `wnjo`), is Winjo Digital's own site and was not touched.

## Environment and secrets (names only; values never go in the repo or in chat)

- Website: `STRIPE_SECRET_KEY` (EV Exec's own), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLATFORM_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET` (Winjo Digital's, for other businesses), `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OPERATOR_EMAIL` (platform staff alerts; each business uses its own contact email).
- Operator app: `STRIPE_PLATFORM_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `INVOICE_FROM` (sender of invitation and password emails; today EV Exec's address, decision pending).
- Sensitive variables must be created as "Sensitive" in Vercel.

## How to run the tests

- Website: `npm run test:unit` (264 tests; `npm ci` now works, Node 24 per `.nvmrc`) and `npm run test:browser` (18 tests in Chromium; screenshots in `tests/browser/out/`).
- Database: `bash scripts/db-test.sh` (builds a throwaway Postgres 17; 13 files). It needs Postgres 17 and pgTAP from the PostgreSQL apt repository (`postgresql-17`, `postgresql-17-pgtap`, see `.github/workflows/db-tests.yml` for the exact steps). Docker is not used. If Postgres 17 is missing it exits 2 with a message.
- Operator app: `npm test`, `npx tsc --noEmit`, `npm run lint`.
- Driver App: `npm test`, `npm run test:functions`, `npm run typecheck`, `npm run lint`.

## Deployment status (checked 13/11/2026, read-only)

- **Production is behind main in all three projects.** The last production build in each Vercel project is an older commit: website `44878db` (PR #75; main is now at `949398b`), Operator app `2f69ca6` (PR #47; main is at `ea19f18`), Driver App `9b02c2a` (PR #20; main is at `b6577f9`). No deployment exists for the newer commits, and a few earlier ones show as cancelled. Preview builds of branches were still succeeding, and all three stopped at the same time, which looks like a Vercel platform limit rather than a code problem (I could not confirm the cause). Everything merged is tested; it simply is not live yet.
- **What is not live yet:** the website's per-business domain matching and branded business website, the booking look-up fix for other prefixes, the Operator app's website address field and density changes, the Driver App's phone polish.
- **To fix:** in Vercel, open each project's Deployments, check why the latest `main` commit has no build (an alert or limit notice, or an ignored-build setting), then redeploy `main`. A redeploy is a production action, so it needs the owner's go-ahead.

## Visual review (13/11/2026)

Ran the signed-in Operator app and Driver App locally against stand-in data and reviewed screenshots at phone (390 and 360 wide), iPad portrait and landscape, and desktop widths. No sideways scrolling anywhere. Fixed and merged: booking rows on iPad landscape (names were cut to three letters), shorter setup checklist, tile label, drivers screen (three per row, repeated tags removed), Driver App notification prompt (slim, hidden on a job), Jobs opens on Upcoming, neutral search hint, Settings tab cue.
Still open (small, judgement calls): on a phone the setup checklist sits above "Needs you" on Today; driver cards on the Drivers screen are tall; the text-message link format needs a real iPhone test; real-device checks (touch targets, keyboard, push) are not covered by screenshots.

## Known limits (honest list)

- Not yet tested on a real second domain (needs a domain and a hosting decision).
- Stripe Connect has not had a live end-to-end payment (test mode needs the Test Operator's Stripe onboarding).
- Customer accounts and Privilege Points exist on EV Exec's site only; a business's website has the booking form, booking page, payment and look-up.
- Invitation and password emails still come from the platform's sender address.
- Monthly billing of businesses is not built (fees are recorded only). Needs the owner's approval, because Stripe Billing has its own fees.
- The Winjo Digital website's platform page and its terms contradictions are outside these repositories (draft copy exists).
- No SMS is sent by the platform (Twilio is off by owner decision); customer texts are two-tap messages sent from the office's or a driver's own phone. The text-message link format has not been confirmed on a real iPhone.

## Decisions already made by the owner

£999 set-up and £99 a month; the customer buys its own domain; EV Exec is a customer at £0 with its own Stripe account; platform takes no percentage of card payments; no solicitor (wording checked against official UK sources, see `docs/legal/audit-2026-11-12.md`); no paid services without asking first.
