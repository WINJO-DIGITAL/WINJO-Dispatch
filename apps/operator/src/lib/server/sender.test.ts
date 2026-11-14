import { describe, it, expect, beforeAll, vi } from "vitest";

// senderFor fixes the sending address and reply-to when its module loads, so set them first.
vi.hoisted(() => {
  process.env.INVOICE_FROM = "Platform <hello@platform.test>";
  process.env.INVOICE_REPLY_TO = "replies@platform.test";
  process.env.TENANT_ID = "a0000000-0000-4000-8000-000000000001";
});

import { mergeBrands } from "@/lib/email/brand.js";
import { senderFor } from "./sender";

const EV = "a0000000-0000-4000-8000-000000000001";
const OTHER = "dddddddd-0000-4000-8000-000000000002";
const BARE = "eeeeeeee-0000-4000-8000-000000000003";

beforeAll(() => {
  mergeBrands([
    { id: EV, name: "Acme Cars", contact_email: "bookings@acme-cars.test", brand: {} },
    { id: OTHER, name: "Coastal Cars", contact_email: "hello@coastal.test", brand: {} },
    { id: BARE, name: "Bare Business", contact_email: null, brand: {} },
  ]);
});

describe("senderFor", () => {
  it("another business: its name as sender (platform address), replies to its own email", () => {
    expect(senderFor(OTHER)).toEqual({ from: "Coastal Cars <hello@platform.test>", reply_to: "hello@coastal.test" });
  });
  it("a business with no contact email gets no reply-to, never the platform's", () => {
    const s = senderFor(BARE);
    expect(s.reply_to).toBeUndefined();
    expect(s.from).toBe("Bare Business <hello@platform.test>");
  });
  it("a dedicated deployment's own business (and no tenant) keep the configured reply-to", () => {
    expect(senderFor(EV)).toEqual({ from: "Acme Cars <hello@platform.test>", reply_to: "replies@platform.test" });
    expect(senderFor(undefined).reply_to).toBe("replies@platform.test");
  });
});
