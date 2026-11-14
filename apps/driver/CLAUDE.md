# Driver App

Rules (costs, legal wording, dates, secrets, deploys) are in the repository's root `CLAUDE.md` and apply here.

## How this app is served

Its own Vercel project (`winjo-driver`, root directory `apps/driver`), reached through the main site's `/driver` forward. Pages live in `app/driver/` (no `basePath`: Vercel's single-project build refuses one), public files in `public/driver/`, `assetPrefix` is `/driver` with `/driver/_next/*` rewritten to `/_next/*`. **Every link, redirect and router call goes through `withBase()`** (`lib/base-path.ts`); the middleware strips the prefix (`stripBase`) before checking the path. Next 16.

## Facts that still describe the code

- A driver's login id must equal `drivers.id` (the Operator app's invite flow creates it that way). Drivers see only their own assigned jobs for their own business. A driver can set `No Show` only from En Route or Arrived and can never set `Cancelled`.
- **Customer reminders**: the job screen offers "Send Week-Ahead Reminder" and "Send 24hr Reminder"; the "Customer reminder due" push links to `/jobs/<id>?reminder=7day|24hr`. The text is generated when the driver taps ("in 6 days" / "tomorrow" / "today"). Two-tap only: the driver sends it from their own phone, then confirms. Partner jobs' reminders go to the office instead.
- **Return legs** (`isReturnLeg()` in `lib/format.ts`; notes start "Return leg created automatically"): shown as "Paid with Outbound"; completing one asks nothing about payment. Card, payment link and bank transfer show "Paid to Office".
- **Dates** DD/MM/YYYY and `ukToday()` for "today" (never UTC).
- **Look and feel**: navy and gold theme, text on light backgrounds uses deep gold `#7a5c14` for contrast, Manrope font self-hosted in `public/driver/fonts`, app icon is a gold steering wheel on navy (`public/driver/icons`, regenerate PNGs from `icon.svg`), service worker `public/driver/sw.js` (scope `/driver/`, cache name bumped on changes).
- The Chat tab was removed; `/chat` redirects to the dashboard. Twilio is gated by `SMS_ENABLED` in every edge function. Edge functions live in `supabase/functions/` (tests: `npm run test:functions`).
- Tests: `npm test` (vitest), `npx tsc --noEmit`, `npx eslint .`.
