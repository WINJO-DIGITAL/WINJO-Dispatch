# Outstanding checklist

Only open items are listed here. Completed work is recorded in `docs/TASKS.md` and `docs/HANDOVER.md`. Last updated 16/11/2026.

## Waiting on the owner

- [ ] **Live Stripe keys:** the test payment has passed. Switch to live only when the owner says go live. Recommendation: stay in test mode until the first real customer is ready.
- [ ] **Push alert on a real phone:** the owner signs in at `/operator` on a phone, opens Settings, Notifications, turns on alerts on that device, allows notifications, and tells Claude, who then sends a test alert.

## Owner housekeeping

- [ ] Revoke the temporary Supabase access token and the full-access Resend key at go-live.

## Engineering, only if wanted

- [ ] Driver App: 21 lint warnings (no errors) in the job screens. Left on purpose until those screens have better test cover.
