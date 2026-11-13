# Site builder: each business gets its own website from its own details

Owner decision 13/11/2026: use the original first business's website as the design template. Each business signs in, enters its details and photos, and gets its own website, like Shopify. The first business's copy, photos, prices and local-SEO pages are deleted; only its **design** is reused (layout, sections, header, styles). The old files are in git history at `6b12d43` (`scripts/site/chrome.js`, `scripts/site/pages/`, `public/css/site.css`, `public/css/chrome.css`, `public/js/site.js`, `public/css/fonts.css` and the Jost font files).

## How it fits the existing system

- A business's site is served on its own domain by `lib/tenantSite.js`, chosen by the website address (`tenantIdFor`). No cross-site API is needed: the pages are rendered by the platform itself, so there is no separate front end to build or host.
- Photos use the existing public `brand-assets` bucket: one folder per business, PNG/JPEG/WebP, 1 MB, only that business's admins can upload. No new accounts, no new cost.
- Content lives in `tenants.brand.site` (planned), written only by a checked database function, like `update_tenant_branding`.

## Content a business can enter (done: `lib/siteContent.js`)

Hero (headline, sub-line, button label, photo), About (title, text, photo), Services (up to 8), Fleet (up to 12, with seats and photo), Areas (up to 30), Reviews (up to 12), FAQs (up to 12), Contact (address, hours, WhatsApp), SEO (title, description). Plain text only, length-capped; photos must be in the business's own folder; unknown fields are dropped. Never HTML, CSS or scripts.

## Design directions (owner instruction 13/11/2026: no two businesses should look alike)

The standard is the project skill `.claude/skills/anti-ai-design`. A business picks a direction (`content.design.direction`) and the renderer changes layout, type and component shapes, not only colours:

| Direction | Layout | Type | Notable parts |
|---|---|---|---|
| `classic` | cards in grids | Jost | the plainest, safest look |
| `editorial` | numbered hairline lists, alternating image rows, pull quotes, areas as a running line | Georgia headings | about first, square image corners |
| `bold` | large numerals, full-width rows, a dark reviews band | heavy Jost | services first, hard-edged buttons, accent bar on the headline |

Section order differs per direction. A published site shows only what the business entered: the generic three-card claims strip ("Fixed prices" and so on) is removed because it repeated on every site and asserted things the business had not said. Still to do: more directions, per-business typeface choice from free self-hosted fonts, and real photographs (the screenshots so far have none because photos only exist once a business uploads them).

## Build order

1. **Done:** content format and validation, with tests (`lib/siteContent.js`, `tests/unit/site-content.test.cjs`).
2. **Renderer (this repo): first version done** (`lib/siteBuilder.js`, one-page sections on the home page; separate pages, sitemap and the first site's full header are not done). Original plan: restore the design files from `6b12d43` into `public/`, write pure page builders (`home`, `about`, `fleet`, `areas`, `faq`, `contact`) that take a business row and its validated content, escape every value, theme with the business's colours and logo, and serve them from `lib/tenantSite.js`. Per-business `sitemap.xml` and `robots.txt`. Tests with fake data, including an injection test. A page with no content yet shows a clear "coming soon" page, never another business's text.
3. **Database: drafted, not run or applied** (`supabase/pending/20261113190000_tenant_site_content.sql` and its test). Plan: `update_tenant_site(tenant, content)` for that business's admin or the platform owner, re-checking size limits in SQL, plus a `site_published` switch. Needs the pgTAP suite run (Postgres 17) before it is applied to live. Applying it is an owner-approved action.
4. **Operator app (separate repository):** Settings, Website: simple forms for each section, photo upload to the business's folder, a preview, a Publish switch, and the live link.
5. **Later, only if asked:** more than one design, a custom page, blog.

## Rules to keep

- No page is generated per town or airport from a template: near-identical pages with a name swapped were a search-engine risk on the first site. A business writes its own areas text.
- Dates DD/MM/YYYY, 24-hour times, UK time. No claims the platform cannot back (the business is responsible for its licence, insurance and driver checks).
- A business's site shows only that business's data.
