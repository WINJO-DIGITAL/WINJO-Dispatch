// Settings → Website: the form behind a business's own website content.
//
// The stored shape (tenants.brand.site) and its limits are the website's
// lib/siteContent.js; keep the two in step. The website cleans the content
// again when it draws a page and update_tenant_site() checks it in the
// database, so this file only shapes the form and gives friendly messages.

export const SITE_LIMITS = {
  services: 8, fleet: 12, areas: 30, reviews: 12, faqs: 12,
  headline: 90, sub: 220, label: 40, title: 80, text: 600, body: 3000, name: 80, short: 120,
  seoTitle: 70, seoDescription: 160,
};

export const SITE_DIRECTIONS = [
  { key: "classic", label: "Classic", hint: "Calm and traditional. Centred headings, plenty of space." },
  { key: "editorial", label: "Editorial", hint: "Magazine feel. Large type, photos beside the words." },
  { key: "bold", label: "Bold", hint: "Strong colour blocks and big headlines." },
];

export const PHOTO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const s = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const list = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export const blankService = () => ({ title: "", text: "", image_url: "" });
export const blankVehicle = () => ({ name: "", text: "", seats: "", image_url: "" });
export const blankReview = () => ({ name: "", text: "", rating: "5" });
export const blankFaq = () => ({ q: "", a: "" });

/** The editable form for a business (blank when it has saved nothing yet). */
export function siteFormFromTenant(tenant) {
  const brand = obj(tenant?.brand);
  const site = obj(brand.site);
  const hero = obj(site.hero), about = obj(site.about), contact = obj(site.contact), seo = obj(site.seo), design = obj(site.design);
  return {
    published: brand.site_published === true,
    direction: SITE_DIRECTIONS.some((d) => d.key === design.direction) ? design.direction : "classic",
    hero: { headline: s(hero.headline), subheadline: s(hero.subheadline), cta_label: s(hero.cta_label), image_url: s(hero.image_url) },
    about: { title: s(about.title), body: s(about.body), image_url: s(about.image_url) },
    services: list(site.services).map((x) => ({ title: s(x?.title), text: s(x?.text), image_url: s(x?.image_url) })),
    fleet: list(site.fleet).map((x) => ({ name: s(x?.name), text: s(x?.text), seats: x?.seats ? s(x.seats) : "", image_url: s(x?.image_url) })),
    areas: list(site.areas).map(s).join("\n"),
    reviews: list(site.reviews).map((x) => ({ name: s(x?.name), text: s(x?.text), rating: s(x?.rating || 5) })),
    faqs: list(site.faqs).map((x) => ({ q: s(x?.q), a: s(x?.a) })),
    contact: { address: s(contact.address), hours: s(contact.hours), whatsapp: s(contact.whatsapp) },
    seo: { title: s(seo.title), description: s(seo.description) },
  };
}

const t = (v, max) => s(v).trim().slice(0, max);

/** What is sent to update_tenant_site(): trimmed, capped, empty rows dropped. */
export function sitePayload(form) {
  const L = SITE_LIMITS;
  return {
    hero: { headline: t(form.hero.headline, L.headline), subheadline: t(form.hero.subheadline, L.sub), cta_label: t(form.hero.cta_label, L.label), image_url: t(form.hero.image_url, 300) },
    about: { title: t(form.about.title, L.title), body: t(form.about.body, L.body), image_url: t(form.about.image_url, 300) },
    services: form.services.map((x) => ({ title: t(x.title, L.title), text: t(x.text, L.text), image_url: t(x.image_url, 300) })).filter((x) => x.title).slice(0, L.services),
    fleet: form.fleet.map((x) => {
      const seats = Math.round(Number(x.seats));
      return { name: t(x.name, L.name), text: t(x.text, L.text), seats: seats >= 1 && seats <= 60 ? seats : null, image_url: t(x.image_url, 300) };
    }).filter((x) => x.name).slice(0, L.fleet),
    areas: s(form.areas).split(/[\n,]/).map((x) => t(x, L.name)).filter(Boolean).slice(0, L.areas),
    reviews: form.reviews.map((x) => {
      const rating = Math.round(Number(x.rating));
      return { name: t(x.name, L.name), text: t(x.text, L.text), rating: rating >= 1 && rating <= 5 ? rating : 5 };
    }).filter((x) => x.name && x.text).slice(0, L.reviews),
    faqs: form.faqs.map((x) => ({ q: t(x.q, L.short), a: t(x.a, L.text) })).filter((x) => x.q && x.a).slice(0, L.faqs),
    contact: { address: t(form.contact.address, L.short), hours: t(form.contact.hours, 120), whatsapp: t(form.contact.whatsapp, 20).replace(/[^0-9+]/g, "") },
    design: { direction: form.direction },
    seo: { title: t(form.seo.title, L.seoTitle), description: t(form.seo.description, L.seoDescription) },
  };
}

const HOURS_RE = /^[0-9A-Za-z ,:.\-–()/&]{0,120}$/;

/** The first thing wrong with the form, in plain words, or '' when it can be saved. */
export function siteProblem(form, { publishing = false } = {}) {
  if (publishing && !s(form.hero.headline).trim()) return "Add a headline before publishing your website.";
  if (!HOURS_RE.test(s(form.contact.hours).trim())) return "Opening hours: use letters, numbers and simple punctuation only.";
  const half = form.reviews.find((r) => (s(r.name).trim() === "") !== (s(r.text).trim() === ""));
  if (half) return "Each review needs both a name and the review text.";
  const halfFaq = form.faqs.find((f) => (s(f.q).trim() === "") !== (s(f.a).trim() === ""));
  if (halfFaq) return "Each question needs an answer.";
  const badSeats = form.fleet.find((v) => s(v.seats).trim() !== "" && !(Number(v.seats) >= 1 && Number(v.seats) <= 60));
  if (badSeats) return "Seats must be a number between 1 and 60.";
  if (s(form.areas).split(/[\n,]/).filter((x) => x.trim()).length > SITE_LIMITS.areas) return `List up to ${SITE_LIMITS.areas} areas.`;
  return "";
}

/** Why a chosen photo can't be used, or '' when it can. */
export function photoProblem(file) {
  if (!file) return "Choose a photo.";
  if (!PHOTO_TYPES[file.type]) return "Photos must be PNG, JPG or WebP.";
  if (file.size > PHOTO_MAX_BYTES) return "Photos must be 5 MB or smaller.";
  return "";
}

/** File name for a new photo in the business's own folder (letters, digits, dot, dash only). */
export function photoFileName(file, now = Date.now(), rand = Math.random()) {
  return `site-${now}-${Math.floor(rand * 1e6).toString(36)}.${PHOTO_TYPES[file.type] || "jpg"}`;
}

/** Path inside the brand-assets bucket for a photo URL of this business, or '' if it isn't one. */
export function photoPath(url, tenantId) {
  const marker = `/brand-assets/${tenantId}/`;
  const i = s(url).indexOf(marker);
  if (!tenantId || i < 0) return "";
  const name = s(url).slice(i + marker.length);
  return /^[A-Za-z0-9._-]{1,120}$/.test(name) ? `${tenantId}/${name}` : "";
}

/** Every photo URL the form uses. */
export function sitePhotos(form) {
  return [form.hero.image_url, form.about.image_url, ...form.services.map((x) => x.image_url), ...form.fleet.map((x) => x.image_url)].filter(Boolean);
}
