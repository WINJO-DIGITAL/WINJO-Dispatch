# Operator app

Rules (costs, legal wording, dates, secrets, deploys) are in the repository's root `CLAUDE.md` and apply here.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## How this app is served

Part of the platform's single site: pages under `/operator/*`, public files under `public/operator/` (icons, fonts, service worker with scope `/operator/`), plus `/set-password`, `/payment-complete`, `/payment-cancelled`, `/manifest.webmanifest` and the `/api/*` routes. The website and this app share one Vercel project (`winjo-dispatch`); the Driver App is a separate project reached through `/driver`.

## Facts that still describe the code

- **Shell and navigation**: `OperatorContext` (`src/components/operator/`) provides the one New Booking form (`openNewBooking`), the inbox (quotes, missed calls, messages) and the signed-in profile and business. Screens: Today, Bookings (List / Calendar / Board), Inbox, Customers, Drivers, Invoices, Analytics, Settings. Use the shell context instead of loading the same data again in a screen.
- **Bookings loading window**: `useBookings()` loads from 14 days ago (UK date) onwards plus undated, with "Show earlier bookings"; `scope: "all"` for Analytics and the customer look-up. Pickup times are UK time everywhere (`src/lib/dates.ts`: `ukToIso`, `ukDateOf`, `ukHourOf`).
- **Approval rule**: operator-made bookings are `accepted` on creation; website requests wait for Accept/Decline (`respondToBooking`). A return is one booking with the whole fare plus a £0 return leg (notes start "Return leg created automatically from return booking."), accepted and declined together; return legs show "With outbound", have no payment link, and are not counted unpaid. "Create Return Journey" is hidden on a booking that already includes its return.
- **Settings** saves to the business's own `tenants` row through RPCs: Business (`update_tenant_profile`), Prices (`update_tenant_pricing`, `src/lib/prices.ts`: `pricingFromTenant`, `pricingForSave`, `pricingProblem`, `fixedTripPrice`), Branding (`update_tenant_branding`, `src/lib/brand.js`: `brandFrom`, `contrastRatio`, logo upload to the public `brand-assets` bucket, PNG/JPEG/WebP up to 1 MB), Website (`update_tenant_site`, `src/lib/operator/site.js` mirroring the website's `lib/siteContent.js`, photos in the business's own `brand-assets` folder, save draft or publish), Legal (`update_tenant_legal`; the responsibilities wording is `RESPONSIBILITIES` in `src/lib/operator/legal.js`, mirroring `docs/legal/operator-responsibilities.md`), Team (`/api/team`, admins only, checked on the server), Payments (`/api/stripe-connect`), Platform (super admin only: businesses via `/api/platform/tenants` and `public.provision_tenant`, fees, applications).
- **Password and sign-in emails** do not use Supabase's redirect allow-list: `auth.admin.generateLink` plus our own link `<app>/set-password?token_hash=…&type=invite|recovery|magiclink` sent through Resend (`src/lib/email/staff.js`, `platform.js`). `/api/auth/email-link` sends a six-digit sign-in code (typed into the sign-in screen, `useAuth().verifyCode`, so an iPhone Home Screen app signs in in place) plus a one-time link as a fallback, only to staff (or the platform owner); every reply is identical so it cannot reveal who has an account. `NEXT_PUBLIC_OPERATOR_URL` fixes the link host.
- **Payment links** (`/api/payment-link`): charge on the business's own connected Stripe account (`src/lib/server/stripeAccount.ts`); email via Resend when the booking has an email, otherwise return an `sms:` link for the operator to send. One payable checkout per booking; Paid bookings and return legs are refused.
- **Driver invites** (`/api/drivers`): creates the login with the driver row's own id, adds a `driver` role and emails a one-time link to the Driver App. Partners (`drivers.kind = 'partner'`) are never invited.
- **Texts to send** (Today): pending `operator_sms_tasks` plus partner jobs' `driver_sms_reminders`, as pre-written `sms:` links with "Mark as sent". `queueCustomerText` (`src/lib/server/smsTask.ts`) replaces an earlier text of the same kind and never duplicates an identical one.
- **Push**: `/api/push/dispatch` checks the shared secret from `push_config` through `get_push_dispatch_bundle(_for_tenant)` and sends Web Push to the business's subscribed office devices.
- **Calendar** (`src/components/operator/calendar/`, rules in `src/lib/operator/calendarModel.js`): month / week / day / list, UK date keys, "possible" clash flags (bookings have no journey length), tokens `cal-*` in `tailwind.config.ts`.
- **Look and feel**: one font (Manrope, self-hosted under `public/operator/fonts`), the soft gold scale in `tailwind.config.ts`, status pills with dark text on pale fills. Grouped content sits in `className="card ..."` (white panel, hairline border, defined in `src/app/globals.css`); the top bar shows the page title once, so screens do not repeat it; small upper-case labels use `tracking-[0.06em]`.
- **Emails** use the shared template and wording copies in `src/lib/email/` (identical to the website's `lib/emailTemplate.js`, `lib/emailContent.js`, `lib/cancellation.js`); keep them in step.
- Tests: `npm test` (vitest), plus `npx tsc --noEmit`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
