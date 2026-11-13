# Starting a new business on the platform (the template)

The website, Operator app and Driver App are one multi-tenant platform. A new business is a row in `public.tenants`; the website serves it by its own domain (`lib/tenantSite.js`), the Operator app scopes staff, prices, branding and Stripe to it, and drivers sign in at `<driver-app>/login?b=<short name>`. This template is the repeatable way to start one. It does not copy code and it does not touch any database.

## How to use it (route A, owner decision 13/11/2026)

Every business is a tenant on the one platform the owner runs. There is no separate copy of the platform per business.

1. Copy `replica.config.example.json` and fill in the business's facts. No keys or passwords: the script refuses them.
2. `npm run new:business -- my-business.json` writes three files to `template/out/<slug>/` (git-ignored). Nothing is sent or changed anywhere.
3. Run `01-provision.sql` once in the Supabase SQL editor (platform owner only).
4. Invite the business's first admin (Operator app, Settings, Platform). They follow `02-operator-app-checklist.md`. Those screens save through the platform's checked functions (prices, branding, legal, Stripe), which need a signed-in admin, so they are not scripted.
5. `03-website-and-links.md` has the website address, the optional own-domain steps (the business buys its own domain; adding it to hosting may cost money, so ask the owner first) and the driver sign-in link.

A separate copy of the whole platform per business (its own database, hosting and payment accounts) is not supported and not planned.

## Not covered (needs decisions or accounts)

- A separate website design per business. Every business uses the same booking site, themed from its own colours, logo, prices and legal text. A custom design means changing `lib/tenantSite.js`.
- Automatic domain routing (each domain still needs a redeploy), per-business sending domains, automatic monthly billing.
- Any wording specific to the retired first business (its terms, licence, blog and SEO pages) is not part of a new business's site; its legal text comes from its own Settings, Legal.
