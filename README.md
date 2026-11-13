# Booking platform: website, API and database

The customer booking website, booking and payment API, and database migrations for a multi-tenant booking, dispatch and payments platform that other businesses sign up to. The Operator app and Driver App are separate repositories and share the same Supabase project.

**Start with `CLAUDE.md`, then `docs/HANDOVER.md` (runbook) and `docs/TASKS.md` (live checklist).**

## Set up

- Node 24 (`.nvmrc`). `npm ci` installs the dev tools; the site itself has no runtime dependencies.
- Copy `.env.example` into your host's environment settings (Vercel) and fill every value. Never commit values. **Set `SUPABASE_URL`**: if it is missing the code falls back to the live project and logs a warning (`lib/supabaseUrl.js`).
- Twilio is switched off by owner decision. Do not set `SMS_ENABLED`.

## Test

| What | Command |
|---|---|
| Website unit tests (214) | `npm run test:unit` |
| Browser tests | `npm run test:browser` (needs Playwright and Chromium) |
| Database tests (pgTAP, 12 files) | `bash scripts/db-test.sh` (needs Postgres 17 and pgTAP; see `docs/HANDOVER.md`) |

## Build

`npm run build:domains` writes per-business domain routes into `vercel.json` from `config/tenant-domains.json`. To start a business, see `template/README.md`.

## Deploy

Production deploys are manual and need the owner's approval (`.github/workflows/deploy.yml`). Merging to `main` does not deploy through GitHub Actions.

## Leftover EV Exec code

EV Exec is no longer part of this project (owner decision, 13/11/2026). The canonical host `www.evexec.co.uk`, the first business's id (`00000000-0000-0000-0000-000000000001`, used when a domain matches no other business), the built-in price list and the generated marketing pages are leftovers from it, not designs to copy. Removal is tracked in `docs/TASKS.md`.
