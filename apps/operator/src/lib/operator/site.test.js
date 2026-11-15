import { describe, expect, it } from "vitest";
import {
  siteFormFromTenant, sitePayload, siteProblem, photoProblem, photoFileName, photoPath, sitePhotos, SITE_LIMITS,
} from "./site";

const TENANT = "a0000000-0000-4000-8000-000000000001";
const photo = (name) => `https://abc.supabase.co/storage/v1/object/public/brand-assets/${TENANT}/${name}`;

describe("siteFormFromTenant", () => {
  it("gives a blank form for a business with nothing saved", () => {
    const f = siteFormFromTenant({ id: TENANT, brand: {} });
    expect(f.published).toBe(false);
    expect(f.direction).toBe("classic");
    expect(f.hero.headline).toBe("");
    expect(f.services).toEqual([]);
    expect(f.areas).toBe("");
  });

  it("reads saved content", () => {
    const f = siteFormFromTenant({ brand: { site_published: true, site: {
      hero: { headline: "Airport transfers" }, design: { direction: "bold" },
      fleet: [{ name: "Saloon", seats: 4 }], areas: ["Leeds", "York"], reviews: [{ name: "Sam", text: "Great", rating: 4 }],
    } } });
    expect(f.published).toBe(true);
    expect(f.direction).toBe("bold");
    expect(f.fleet[0]).toEqual({ name: "Saloon", text: "", seats: "4", image_url: "" });
    expect(f.areas).toBe("Leeds\nYork");
    expect(f.reviews[0].rating).toBe("4");
  });

  it("ignores an unknown design direction and odd shapes", () => {
    const f = siteFormFromTenant({ brand: { site: { design: { direction: "neon" }, services: "x", hero: [] } } });
    expect(f.direction).toBe("classic");
    expect(f.services).toEqual([]);
  });
});

describe("sitePayload", () => {
  const base = () => siteFormFromTenant({ brand: {} });

  it("trims, caps and drops empty rows", () => {
    const f = base();
    f.hero.headline = `  ${"x".repeat(200)}  `;
    f.services = [{ title: " Airport runs ", text: "", image_url: "" }, { title: "", text: "no title", image_url: "" }];
    f.fleet = [{ name: "MPV", text: "", seats: "7", image_url: photo("site-1.jpg") }, { name: "Van", text: "", seats: "abc", image_url: "" }];
    f.areas = "Leeds, York\n\nHarrogate";
    f.reviews = [{ name: "Sam", text: "Great", rating: "9" }, { name: "", text: "", rating: "5" }];
    f.faqs = [{ q: "Do you take cards?", a: "Yes" }, { q: "", a: "" }];
    f.contact.whatsapp = "+44 7123 456-789";
    const p = sitePayload(f);
    expect(p.hero.headline).toHaveLength(SITE_LIMITS.headline);
    expect(p.services).toEqual([{ title: "Airport runs", text: "", image_url: "" }]);
    expect(p.fleet.map((v) => v.seats)).toEqual([7, null]);
    expect(p.areas).toEqual(["Leeds", "York", "Harrogate"]);
    expect(p.reviews).toEqual([{ name: "Sam", text: "Great", rating: 5 }]);
    expect(p.faqs).toHaveLength(1);
    expect(p.contact.whatsapp).toBe("+447123456789");
    expect(p.design).toEqual({ direction: "classic" });
  });

  it("keeps lists within their limits", () => {
    const f = base();
    f.services = Array.from({ length: 20 }, (_, i) => ({ title: `S${i}`, text: "", image_url: "" }));
    expect(sitePayload(f).services).toHaveLength(SITE_LIMITS.services);
  });

  it("round-trips through the form", () => {
    const f = base();
    f.hero.headline = "Hello";
    f.fleet = [{ name: "Saloon", text: "Comfortable", seats: "4", image_url: "" }];
    const again = siteFormFromTenant({ brand: { site: sitePayload(f) } });
    expect(sitePayload(again)).toEqual(sitePayload(f));
  });
});

describe("siteProblem", () => {
  const base = () => siteFormFromTenant({ brand: {} });

  it("allows saving a draft with no headline but not publishing one", () => {
    expect(siteProblem(base())).toBe("");
    expect(siteProblem(base(), { publishing: true })).toMatch(/headline/);
  });

  it("flags half-filled reviews and questions, bad seats and odd hours", () => {
    const a = base(); a.reviews = [{ name: "Sam", text: "", rating: "5" }];
    expect(siteProblem(a)).toMatch(/review/);
    const b = base(); b.faqs = [{ q: "Why?", a: "" }];
    expect(siteProblem(b)).toMatch(/answer/);
    const c = base(); c.fleet = [{ name: "Bus", text: "", seats: "100", image_url: "" }];
    expect(siteProblem(c)).toMatch(/Seats/);
    const d = base(); d.contact.hours = "<b>always</b>";
    expect(siteProblem(d)).toMatch(/hours/);
    const e = base(); e.contact.hours = "Mon-Fri 08:00-18:00";
    expect(siteProblem(e)).toBe("");
  });
});

describe("photos", () => {
  it("accepts only PNG, JPG and WebP up to 5 MB", () => {
    expect(photoProblem({ type: "image/jpeg", size: 1000 })).toBe("");
    expect(photoProblem({ type: "image/gif", size: 1000 })).toMatch(/PNG/);
    expect(photoProblem({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(photoProblem(null)).toMatch(/Choose/);
  });

  it("names files with safe characters only", () => {
    expect(photoFileName({ type: "image/webp" }, 1700000000000, 0.5)).toMatch(/^site-1700000000000-[a-z0-9]+\.webp$/);
    expect(photoFileName({ type: "image/jpeg" })).toMatch(/^[A-Za-z0-9._-]{1,120}$/);
  });

  it("finds the storage path only for this business's own photos", () => {
    expect(photoPath(photo("site-1.jpg"), TENANT)).toBe(`${TENANT}/site-1.jpg`);
    expect(photoPath(photo("site-1.jpg"), "b0000000-0000-4000-8000-000000000002")).toBe("");
    expect(photoPath(photo("../x.jpg"), TENANT)).toBe("");
    expect(photoPath("", TENANT)).toBe("");
  });

  it("lists every photo in use", () => {
    const f = siteFormFromTenant({ brand: { site: { hero: { image_url: photo("a.jpg") }, fleet: [{ name: "X", image_url: photo("b.jpg") }] } } });
    expect(sitePhotos(f)).toEqual([photo("a.jpg"), photo("b.jpg")]);
  });
});
