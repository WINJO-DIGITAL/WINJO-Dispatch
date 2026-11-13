# Starting a new business on the platform (the template)

The EV Exec website, Operator app and Driver App are already one multi-tenant platform. A new business is a row in `public.tenants`; the website serves it by its own domain (`lib/tenantSite.js`), the Operator app scopes staff, prices, branding and Stripe to it, and drivers sign in at `<driver-app>/login?b=<short name>`. This template is the repeatable way to start one. It does not copy code and it does not touch any database.

## Two ways to use it

**A. A business on a platform you already run (the normal way).** Use this folder as is.

1. Copy `replica.config.example.json`, fill in the business's facts. No keys or passwords: the script refuses them.
2. `npm run new:business -- my-business.json` writes three files to `template/out/<slug>/` (git-ignored).
3. Run `01-provision.sql` once in the Supabase SQL editor (the platform owner only).
4. Invite the business's first admin (Operator app, Settings, Platform), then they follow `02-operator-app-checklist.md`. Those screens save through the platform's checked functions (prices, branding, legal, Stripe), which need a signed-in admin, so they are not scripted.
5. `03-website-and-links.md` has the website address, the optional own-domain steps and the driver sign-in link.

**B. Your own separate copy of the whole platform (a replica you resell).** Needs your own accounts, so **every item below can cost money: ask the platform owner before creating any**.

1. New Supabase project: build the database from `supabase/baseline/schema.sql` (structure only, no data), then newer files in `supabase/migrations/`. Run `bash scripts/db-test.sh` (Postgres 17 and pgTAP).
2. Three Vercel projects (website, Operator app, Driver App) from the three repositories.
3. Your own Stripe platform account, Resend sending domain and Google Maps key.
4. Set the environment variables in `.env.example` (website) and each app's own list. Set **`SUPABASE_URL`** and **`SUPABASE_ANON_KEY`** explicitly: if they are missing the website falls back to the original live project.
5. Give your owner login the `super_admin` role in `tenant_users`, then follow A for each business.
6. Do not copy the original's keys, customer data, auth users, storage files or Stripe objects.

## Not covered (needs decisions or accounts)

- A separate website design per business. Every business uses the same booking site, themed from its own colours, logo, prices and legal text. A custom design means changing `lib/tenantSite.js`.
- Automatic domain routing (each domain still needs a redeploy), per-business sending domains, automatic monthly billing.
- Any wording specific to the original (now retired) business (its terms, licence, blog and SEO pages) is not part of a new business's site; its legal text comes from its own Settings, Legal.
