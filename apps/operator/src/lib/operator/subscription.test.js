import { describe, it, expect } from "vitest";
import { money, nextStep, statusLabel } from "./subscription";

describe("subscription display rules", () => {
  it("writes pence as pounds", () => {
    expect(money(9900)).toBe("£99");
    expect(money(99900)).toBe("£999");
    expect(money(109800)).toBe("£1,098");
    expect(money(9950)).toBe("£99.50");
    expect(money(0)).toBe("£0");
    expect(money(undefined)).toBe("");
  });
  it("offers Pay until a subscription exists, then Manage", () => {
    expect(nextStep({ status: "none" })).toBe("pay");
    expect(nextStep({ status: "cancelled" })).toBe("pay");
    expect(nextStep({ status: "active" })).toBe("manage");
    expect(nextStep({ status: "past_due" })).toBe("manage");
    expect(nextStep(null)).toBe("pay");
  });
  it("says the status in words", () => {
    expect(statusLabel({ status: "active" })).toBe("Active");
    expect(statusLabel({ status: "active", cancelAtPeriodEnd: true })).toBe("Active, ending");
    expect(statusLabel({ status: "past_due" })).toBe("Payment failed");
    expect(statusLabel({ status: "cancelled" })).toBe("Cancelled");
    expect(statusLabel({ status: "none" })).toBe("Not started");
  });
});
