import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, fixedTripPrice, fixedOneWayPrice, pricingForSave, pricingFromTenant, pricingProblem } from "./prices";

// A sample business's price list (test data only).
const AIRPORT_PRICES = [
  { name: "Manchester Airport", code: "MAN", oneWay: 90, ret: 160 },
  { name: "Liverpool Airport", code: "LPL", oneWay: 95, ret: 170 },
  { name: "Leeds Bradford Airport", code: "LBA", oneWay: 135, ret: 250 },
  { name: "Birmingham Airport", code: "BHX", oneWay: 215, ret: 410 },
  { name: "Newcastle Airport", code: "NCL", oneWay: 250, ret: 480 },
];

describe("fixedOneWayPrice", () => {
  it("finds the listed one-way prices", () => {
    expect(fixedOneWayPrice("Manchester Airport (MAN)", AIRPORT_PRICES)).toBe(90);
    expect(fixedOneWayPrice("Liverpool Airport (LPL)", AIRPORT_PRICES)).toBe(95);
    expect(fixedOneWayPrice("Leeds Bradford Airport (LBA)", AIRPORT_PRICES)).toBe(135);
    expect(fixedOneWayPrice("Birmingham Airport (BHX)", AIRPORT_PRICES)).toBe(215);
    expect(fixedOneWayPrice("Newcastle Airport (NCL)", AIRPORT_PRICES)).toBe(250);
  });

  it("matches free-typed names and codes", () => {
    expect(fixedOneWayPrice("manchester airport T2", AIRPORT_PRICES)).toBe(90);
    expect(fixedOneWayPrice("LPL", AIRPORT_PRICES)).toBe(95);
  });

  it("has no fixed price for other airports or places", () => {
    expect(fixedOneWayPrice("London Heathrow (LHR)", AIRPORT_PRICES)).toBeNull();
    expect(fixedOneWayPrice("Blackpool Airport (BLK)", AIRPORT_PRICES)).toBeNull();
    expect(fixedOneWayPrice("Lytham St Annes", AIRPORT_PRICES)).toBeNull();
    expect(fixedOneWayPrice("", AIRPORT_PRICES)).toBeNull();
    expect(fixedOneWayPrice(null, AIRPORT_PRICES)).toBeNull();
  });

  it("keeps return prices above one-way", () => {
    for (const a of AIRPORT_PRICES) expect(a.ret).toBeGreaterThan(a.oneWay);
  });
});

describe("fixedTripPrice", () => {
  it("charges the one-way fare for a single journey", () => {
    expect(fixedTripPrice("Manchester Airport (MAN)", false, AIRPORT_PRICES)).toBe(90);
  });

  it("charges the whole return fare once, not half per leg", () => {
    expect(fixedTripPrice("Manchester Airport (MAN)", true, AIRPORT_PRICES)).toBe(160);
    for (const a of AIRPORT_PRICES) {
      expect(fixedTripPrice(a.name, true, AIRPORT_PRICES)).toBe(a.ret);
    }
  });

  it("has no fixed price off the price list", () => {
    expect(fixedTripPrice("London Heathrow (LHR)", true, AIRPORT_PRICES)).toBeNull();
  });
});

describe("per-operator prices", () => {
  const stored = {
    airports: [
      { name: "Manchester Airport", code: "MAN", one_way: 99, return_fare: 180 },
      { name: "Preston Station", one_way: 40, return_fare: 75 },
      { name: "Broken", one_way: "90", return_fare: 1 },
    ],
    extra_stop: 7,
  };

  it("reads the stored list and drops unusable rows", () => {
    const p = pricingFromTenant(stored);
    expect(p.airports.map((a) => a.name)).toEqual(["Manchester Airport", "Preston Station"]);
    expect(p.extraStop).toBe(7);
  });

  it("falls back to the default list when there is none", () => {
    expect(pricingFromTenant(null)).toBe(DEFAULT_PRICING);
    expect(pricingFromTenant({ airports: [] })).toBe(DEFAULT_PRICING);
  });

  it("suggests prices from the operator's own list", () => {
    const { airports } = pricingFromTenant(stored);
    expect(fixedTripPrice("Manchester Airport T2", false, airports)).toBe(99);
    expect(fixedTripPrice("MAN", true, airports)).toBe(180);
    expect(fixedTripPrice("Preston Station, Butler St", false, airports)).toBe(40);
    expect(fixedTripPrice("Liverpool Airport", false, airports)).toBeNull();
  });

  it("round-trips to the save shape", () => {
    const p = pricingFromTenant(stored);
    expect(pricingForSave(p)).toEqual({
      airports: [
        { name: "Manchester Airport", code: "MAN", one_way: 99, return_fare: 180 },
        { name: "Preston Station", one_way: 40, return_fare: 75 },
      ],
      extra_stop: 7,
    });
  });

  it("finds problems before saving", () => {
    const ok = pricingFromTenant(stored);
    expect(pricingProblem(ok)).toBeNull();
    expect(pricingProblem({ ...ok, airports: [...ok.airports, { name: "manchester airport", oneWay: 1, ret: 2 }] })).toMatch(/twice/);
    expect(pricingProblem({ ...ok, airports: [{ name: "X", code: "M1", oneWay: 1, ret: 2 }] })).toMatch(/3 or 4 letters/);
    expect(pricingProblem({ ...ok, airports: [{ name: "X", oneWay: 0, ret: 2 }] })).toMatch(/one-way/);
    expect(pricingProblem({ ...ok, airports: [{ name: " ", oneWay: 1, ret: 2 }] })).toMatch(/name/);
    expect(pricingProblem({ ...ok, extraStop: -1 })).toMatch(/extra stop/);
  });
});
