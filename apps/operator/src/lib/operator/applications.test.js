import { describe, expect, it } from "vitest";
import { actionsFor, openCount, sortApplications, statusLabel } from "./applications";

const app = (over) => ({ id: "x", status: "awaiting_payment", setup_pence: 99900, created_at: "2026-11-14T10:00:00Z", ...over });

describe("actionsFor", () => {
  it("lets the owner confirm payment or reject while waiting for payment", () => {
    expect(actionsFor(app())).toEqual(["confirm_payment", "reject"]);
  });
  it("lets the owner approve or reject once paid", () => {
    expect(actionsFor(app({ status: "paid" }))).toEqual(["approve", "reject"]);
  });
  it("skips the payment step when the set-up fee is zero", () => {
    expect(actionsFor(app({ setup_pence: 0 }))).toEqual(["approve", "reject"]);
  });
  it("offers nothing once an application is closed", () => {
    expect(actionsFor(app({ status: "approved" }))).toEqual([]);
    expect(actionsFor(app({ status: "rejected" }))).toEqual([]);
    expect(actionsFor(null)).toEqual([]);
  });
});

describe("statusLabel", () => {
  it("uses plain words and never shows a raw status", () => {
    expect(statusLabel("awaiting_payment")).toBe("Waiting for payment");
    expect(statusLabel("paid")).toBe("Paid, ready to approve");
    expect(statusLabel("whatever")).toBe("Unknown");
  });
});

describe("sortApplications", () => {
  it("puts open ones first, oldest first, then closed ones newest first", () => {
    const list = [
      app({ id: "closed-old", status: "rejected", created_at: "2026-11-01T00:00:00Z" }),
      app({ id: "open-new", created_at: "2026-11-13T00:00:00Z" }),
      app({ id: "closed-new", status: "approved", created_at: "2026-11-10T00:00:00Z" }),
      app({ id: "open-old", status: "paid", created_at: "2026-11-12T00:00:00Z" }),
    ];
    expect(sortApplications(list).map((a) => a.id)).toEqual(["open-old", "open-new", "closed-new", "closed-old"]);
  });
  it("does not change the list it is given, and copes with nothing", () => {
    const list = [app({ id: "b" }), app({ id: "a", created_at: "2026-11-01T00:00:00Z" })];
    sortApplications(list);
    expect(list[0].id).toBe("b");
    expect(sortApplications(undefined)).toEqual([]);
  });
});

describe("openCount", () => {
  it("counts only applications that still need the owner", () => {
    expect(openCount([app(), app({ status: "paid" }), app({ status: "approved" }), app({ status: "rejected" })])).toBe(2);
    expect(openCount(undefined)).toBe(0);
  });
});
