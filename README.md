# EV Exec website and database

The customer website, booking and payment API, and database migrations for the EV Exec platform (a multi-tenant booking, dispatch and payments system). The Operator app and Driver App are separate repositories and share the same Supabase project.

**Start with `CLAUDE.md`, then `docs/HANDOVER.md` (runbook) and `docs/TASKS.md` (live checklist).**

## Set up

- Node 24 (`.nvmrc`). `npm ci` installs the dev tools; the site itself has no runtime dependencies.
- Copy `.env.example` into your host's environment settings (Vercel) and fill every value. Never commit values. **Set `SUPABASE_URL`**: if it is missing the code falls back to the live project and logs a warning (`lib/supabaseUrl.js`).
- Twilio is switched off by owner decision. Do not set `SMS_ENABLED`.

## Test

| What | Command |
|---|---|
| Website unit tests (211) | `npm run test:unit` |
| Browser tests | `npm run test:browser` (needs Playwright and Chromium) |
| Database tests (pgTAP, 12 files) | `bash scripts/db-test.sh` (needs Postgres 17 and pgTAP; see `docs/HANDOVER.md`) |

## Build

`npm run build:pages` regenerates the marketing pages and `sitemap.xml` from `scripts/site/`; never edit the generated HTML. `npm run build:domains` writes per-business domain routes into `vercel.json`.

## Deploy

Production deploys are manual and need the owner's approval (`.github/workflows/deploy.yml`). Merging to `main` does not deploy through GitHub Actions.

## EV Exec specifics that are on purpose

The canonical host `www.evexec.co.uk`, the first business's id (`00000000-0000-0000-0000-000000000001`, used when a domain matches no other business) and EV Exec's built-in price list are defaults for the first customer, not mistakes. Other businesses are configured in the database and the Operator app.
