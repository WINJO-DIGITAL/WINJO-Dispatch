# Legal templates: notes (12/11/2026)

**No solicitor is used (owner decision, 12/11/2026).** The templates were checked against official UK sources instead: see `docs/legal/audit-2026-11-12.md` for what was checked, what was fixed and the owner actions.

## What exists

- `lib/legal/` builds a business's **Terms & Conditions** (20 sections) and **Privacy Policy** (10 sections) from its row in `public.tenants`: `name`, `contact_email`, `contact_phone`, `brand.licence`, `pricing.extra_stop`, and `brand.legal` (see `lib/legal/details.js` for every field).
- `termsDocument(tenant)` / `privacyDocument(tenant)` return the HTML, the plain text, `gaps` (details still missing, shown as highlighted placeholders, never guessed) and `advice` (things to do that do not block publishing, such as the ICO fee).
- Tests check that a business's documents carry only its own details (name, number, licence, town, fleet, loyalty scheme) and never a sample business's.
- Each business's pages are served at `/t/<short name>/terms` and `/privacy` once its details are complete and it has confirmed the responsibilities statement (Settings, Legal in the Operator app).

## Still to do

- **Per-business terms versions** and acceptance records beyond the platform's `TERMS_VERSION` (each booking records the version it accepted).
