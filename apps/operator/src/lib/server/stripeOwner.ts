// Where one business holds the deployment's Stripe account itself (a dedicated deployment:
// STRIPE_PLATFORM_TENANT_ID), that business is the account owner and uses the deployment's own
// key. On the shared platform there is no owner (unset): every business takes card payments on
// its own connected account. Same rule as the website (lib/stripeAccount.js).

export const stripeOwnerTenant = (): string => (process.env.STRIPE_PLATFORM_TENANT_ID ?? "").trim();
