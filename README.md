# Booking platform: website, API and database

One repository for Winjo Dispatch, a multi-tenant booking, dispatch and payments platform that other businesses sign up to: the public home page, sign-up, customer booking website, booking and payment API and database at the root, the Operator app in `apps/operator` and the Driver App in `apps/driver`. All three share one Supabase project.

**Start with `CLAUDE.md`, then `docs/HANDOVER.md` (runbook), `docs/OUTSTANDING.md` (what is still open, including the owner's go-live checklist) and `docs/TASKS.md` (what is done).** Other docs: `docs/ENVIRONMENT.md` (every setting), `docs/DEPLOYMENT.md` (how deploys and the build guard work), `docs/billing-design.md` (monthly billing, not built).

## Set up

- Node 24 (`.nvmrc`). `npm ci` installs the dev tools; the site itself has no runtime dependencies.
- Copy `.env.example` into your host's environment settings (Vercel) and fill every value; each one is explained in `docs/ENVIRONMENT.md`. Never commit values. **`SUPABASE_URL` is required**: there is no fallback to any project, and production refuses to start without it (`lib/supabaseUrl.js`). `GET /api/health` reports which required settings are present, as true or false only.
- Twilio is switched off by owner decision. Do not set `SMS_ENABLED`.

## Test

| What | Command |
|---|---|
| Website unit tests (294) | `npm run test:unit` |
| Browser tests (18) | `npm run test:browser` (needs Playwright and Chromium) |
| Operator app (459) | `cd apps/operator && npm test`, then `npx tsc --noEmit`, `npm run lint`, `npm run build` |
| Driver App (128, plus 22 edge function tests) | `cd apps/driver && npm test`, `npm run test:functions`, `npx tsc --noEmit`, `npm run lint`, `npm run build` |
| Database tests (pgTAP, 14 files, 372 checks) | `bash scripts/db-test.sh` (needs Postgres 17 and pgTAP; see `docs/HANDOVER.md`) |

## Build

`npm run build:domains` writes per-business domain routes into `vercel.json` from `config/tenant-domains.json`. To start a business, see `template/README.md`.

## Deploy

Production deploys are manual and need the owner's approval each time; merging to `main` does not deploy. How the build guard works, how a production deploy is done through the Vercel API and what the optional GitHub Action needs are in `docs/DEPLOYMENT.md`. Test counts above were taken on 17/11/2026.

