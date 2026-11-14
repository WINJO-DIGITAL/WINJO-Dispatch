import { describe, it, expect, afterEach } from "vitest";
import { stripeOwnerTenant } from "./stripeOwner";

const OWNER = "a0000000-0000-4000-8000-000000000001";

describe("stripeOwnerTenant", () => {
  afterEach(() => { delete process.env.STRIPE_PLATFORM_TENANT_ID; });

  it("is empty on the shared platform: no business holds the deployment's Stripe account", () => {
    expect(stripeOwnerTenant()).toBe("");
  });

  it("follows STRIPE_PLATFORM_TENANT_ID when a dedicated deployment sets it", () => {
    process.env.STRIPE_PLATFORM_TENANT_ID = ` ${OWNER} `;
    expect(stripeOwnerTenant()).toBe(OWNER);
  });
});
