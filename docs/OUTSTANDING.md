# Outstanding checklist

Only open items are listed here. Completed work is recorded in `docs/TASKS.md` and `docs/HANDOVER.md`. Last updated 16/11/2026.

## Waiting on the owner

- [ ] **Data terms:** sign off, or keep the "draft" label. Recommendation: keep the label.
- [ ] **Support hours:** decide what to publish. Recommendation: leave unpublished.
- [ ] **VAT wording:** confirm or change. Recommendation: keep the current wording.
- [ ] **Live Stripe keys:** only after the test payment passes and the owner says go live. Recommendation: stay in test mode until then.
- [ ] **Push alert on a real phone:** subscribe a driver or office device in the app, then send a test alert.

## Owner housekeeping

- [ ] Revoke the temporary Supabase access token and the full-access Resend key at go-live.
- [ ] Delete the old disabled test webhook for an earlier domain in the Stripe account.

## Engineering, only if wanted

- [ ] Driver App: 21 lint warnings (no errors) in the job screens. Left on purpose until those screens have better test cover.
