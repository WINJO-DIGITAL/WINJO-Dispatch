# Environment variables

Set these in the Vercel project's Environment Variables (Production, and Preview if you use it), then **redeploy**: a new value only takes effect on the next deploy. Mark every secret as **Sensitive**. Never commit a value, paste one into chat or put one in the repository; `.env.example` lists names only.

`GET /api/health` on the live address reports each setting below as `true` or `false` (never a value), and lists the required ones that are missing. It answers 200 when every required setting is present and 503 when any is missing, so it is also safe to point an uptime check at.

## How to generate a secret

```
openssl rand -hex 32
```

Run it in any terminal and paste the 64 characters into Vercel. If you have no terminal, any password generator set to 64 random letters and digits does the same job.

## Website and API (the Vercel project `winjo-dispatch`)

| Variable | Required | What it does | Without it |
|---|---|---|---|
| `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) | **Yes** | Address of the Supabase project, `https://<ref>.supabase.co`. | **Nothing works.** There is no fallback to any project: production refuses to start with a clear error, and other environments log a warning and fail every database call. |
| `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | **Yes** | Public key for reads the browser may make. | Public reads (price list, booking form config) fail. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** (Sensitive) | Full database access for the server. Never sent to a browser. | Bookings, sign-up applications, reminders and flight re-checks fail. |
| `CRON_SECRET` | **Yes** (Sensitive) | Vercel sends it as a bearer token on the three scheduled routes. Generate with `openssl rand -hex 32`. | Every cron route answers 401: **daily reminders, flight re-checks and the email retry sweep do not run.** The logs say so once. (The retry route used to be open without it; it now refuses.) |
| `OPERATOR_ACTION_SECRET` | **Yes** (Sensitive) | Signs the Accept, Reject and Cancel links in emails and texts. Generate with `openssl rand -hex 32`. | The links are not sent. Staff emails and texts say "open your booking in the operator app" with a button to it, and customer cancel links go to their booking page. The logs say so once. |
| `RESEND_API_KEY` | **Yes** (Sensitive) | Sends email. Use a key limited to sending, for the verified domain only. | No email is sent. |
| `PLATFORM_FROM` | **Yes** | Sender for sign-up and platform emails, e.g. `Winjo Digital <hello@winjodigital.co.uk>`; the address must be verified in Resend. | No sign-up or platform emails are sent. |
| `PLATFORM_REPLY_TO` | No | Reply-to for platform emails. | No reply-to address. |
| `PLATFORM_OWNER_EMAIL` | No | Where new sign-up applications are announced. | The owner is not emailed. |
| `PLATFORM_URL` | No | The platform's own address. Defaults to `https://winjo-dispatch.vercel.app`. | Default is used. |
| `SITE_URL`, `OPERATOR_APP_URL`, `DRIVER_APP_URL`, `NEXT_PUBLIC_OPERATOR_URL`, `NEXT_PUBLIC_DRIVER_APP_URL` | No | Override addresses for another environment. The Driver App address includes `/driver`. | Defaults from `PLATFORM_URL` are used. |
| `STRIPE_PLATFORM_SECRET_KEY` | **Yes** for card payments (Sensitive) | The platform's Stripe key (`sk_test_...` in test mode; **never `sk_live_...` until the owner says go live**). Connects businesses and takes card payments on their own accounts. | No card payments and no "Connect Stripe" button. Cash still works. |
| `STRIPE_WEBHOOK_SECRET` | **Yes** for card payments (Sensitive) | Signing secret (`whsec_...`) of the Stripe webhook for `/api/payment/stripe-webhook`. | A paid checkout is not marked Paid by the webhook (the booking page's own check still records it when the customer returns). |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | **Yes** for card payments (Sensitive) | Signing secret of the second webhook that listens to connected accounts. | Payments on a business's own account are not marked Paid by the webhook. |
| `STRIPE_PLATFORM_TENANT_ID`, `TENANT_ID` | No | For a dedicated deployment of one business only. Leave unset on the shared platform. | Not needed on the shared platform. |
| `GOOGLE_MAPS_API_KEY` (or `NEXT_PUBLIC_...`) | **No** | A browser key for Google Maps, returned by `/api/config`. Restrict it by domain in Google. | **Nothing breaks.** The booking form uses plain address fields and draws no map, frame or script. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` | No | Keys for web push sent from the website to customers (`npx web-push generate-vapid-keys`). Office alerts use the keys stored in the database table `push_config`. | Website-side customer push is off. |
| `ADMIN_PASSWORD` | No | Password for the leads endpoint. | The endpoint stays closed. |
| `SMS_ENABLED` and the `TWILIO_*` variables | **Leave unset** | Twilio sending is dormant by owner decision and billed. Customer texts are two-tap `sms:` messages from a person's own phone. | Nothing is sent by Twilio. |

## Driver App (the Vercel project `winjo-driver`)

| Variable | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** (public values) | The same project address and public key as above. Set for Production, Preview and the `staging` environment. |

## Operator app

It is served from the website project, so it reads the website's variables. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are mapped from `SUPABASE_URL` and `SUPABASE_ANON_KEY` at build time by `next.config`.

## Supabase edge functions

Set in Supabase (Edge Functions, Secrets), not Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (the same pair stored in `push_config`) and optionally `VAPID_SUBJECT`.
