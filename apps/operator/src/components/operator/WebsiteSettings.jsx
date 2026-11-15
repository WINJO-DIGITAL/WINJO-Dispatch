"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, ImagePlus, X } from "lucide-react";
import { useTenantProfile } from "@/hooks/operator/useTenantProfile";
import {
  SITE_DIRECTIONS, SITE_LIMITS, blankFaq, blankReview, blankService, blankVehicle,
  photoProblem, siteFormFromTenant, sitePayload, sitePhotos, siteProblem,
} from "@/lib/operator/site";

// Settings → Website. The words and photos on the business's own website
// (tenants.brand.site), saved through update_tenant_site. Only short plain
// text and photos from the business's own folder; the website cleans it again
// when it draws a page. Only an operator admin can save.

const LABEL = "mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500";
const INPUT = "mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm normal-case tracking-normal text-[#0F1B33] outline-none placeholder:text-slate-400 transition focus:border-amber-400/40 disabled:opacity-60";
const GROUP = "rounded-2xl border border-slate-100 bg-white p-4 sm:p-5";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className={LABEL}>
        {label}
        {children}
      </label>
      {hint && <p className="-mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Text({ label, hint, value, onChange, max, disabled, placeholder, rows }) {
  const props = { value, maxLength: max, disabled, placeholder, onChange: (e) => onChange(e.target.value), className: INPUT };
  return (
    <Field label={label} hint={hint}>
      {rows ? <textarea rows={rows} {...props} /> : <input type="text" {...props} />}
    </Field>
  );
}

function Photo({ label, url, onPick, onClear, disabled, busy }) {
  const ref = useRef(null);
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-16 w-24 rounded-xl border border-slate-200 object-cover" />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => ref.current?.click()}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#0F1B33] transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Uploading…" : url ? "Replace photo" : "Add photo"}
        </button>
        {url && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={onClear}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0F1B33] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ListHeader({ title, hint, count, max, onAdd, disabled, addLabel }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-[#0F1B33]">{title}</h3>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled || count >= max}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#0F1B33] transition hover:bg-slate-50 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

function RemoveRow({ onClick, disabled, label }) {
  return (
    <div className="mt-3 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-red-700 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {label}
      </button>
    </div>
  );
}

export default function WebsiteSettings({ toast }) {
  const { tenant, canEdit, loading, error, uploadSitePhoto, removeSitePhotos, saveSite } = useTenantProfile();
  const [form, setForm] = useState(() => siteFormFromTenant(tenant));
  const [formFor, setFormFor] = useState(tenant);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");

  // Start the form again whenever the saved business changes (while rendering).
  if (formFor !== tenant) {
    setFormFor(tenant);
    setForm(siteFormFromTenant(tenant));
  }

  if (loading) return <p className="text-sm text-slate-500">Loading your website…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!tenant) return <p className="text-sm text-slate-500">No business found for this login.</p>;

  const off = !canEdit || busy;
  const L = SITE_LIMITS;
  const siteUrl = typeof tenant.brand?.site_url === "string" ? tenant.brand.site_url : "";
  const live = tenant.brand?.site_published === true;

  const setIn = (section, field) => (value) => setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  const setRow = (key, i, field) => (value) => setForm((f) => ({ ...f, [key]: f[key].map((r, j) => (j === i ? { ...r, [field]: value } : r)) }));
  const addRow = (key, blank) => () => setForm((f) => ({ ...f, [key]: [...f[key], blank()] }));
  const dropRow = (key, i) => () => setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }));

  async function pick(slot, file, apply) {
    const wrong = photoProblem(file);
    if (wrong) { toast({ message: wrong, type: "error" }); return; }
    setUploading(slot);
    try {
      apply(await uploadSitePhoto(file));
    } catch (e) {
      toast({ message: e?.message || "Could not upload the photo", type: "error" });
    } finally {
      setUploading("");
    }
  }

  async function handleSave(publish) {
    const wrong = siteProblem(form, { publishing: publish });
    if (wrong) { toast({ message: wrong, type: "error" }); return; }
    setBusy(true);
    try {
      const before = sitePhotos(siteFormFromTenant(tenant));
      const saved = await saveSite(sitePayload(form), publish);
      // Tidy up photos the saved website no longer uses (best effort).
      const after = new Set(sitePhotos(siteFormFromTenant(saved)));
      await removeSitePhotos(before.filter((u) => !after.has(u)));
      toast({ message: publish ? "Website saved and published" : live ? "Saved. Your website is now hidden." : "Draft saved", type: "success" });
    } catch (e) {
      toast({ message: e?.message || "Could not save the website", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className={`rounded-2xl border p-4 text-sm ${live ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <p className="font-semibold">{live ? "Your website is published." : "Your website is not published yet."}</p>
        <p className="mt-1">
          {siteUrl
            ? <>Address: <a href={siteUrl} target="_blank" rel="noreferrer" className="underline">{siteUrl.replace(/^https?:\/\//, "")}</a></>
            : "No website address has been set for your business yet. The platform owner sets it once your domain is connected."}
        </p>
        {!canEdit && <p className="mt-1">Only an admin of the business can change the website.</p>}
      </div>

      <section>
        <h3 className="mb-4 text-base font-semibold text-[#0F1B33]">Design</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {SITE_DIRECTIONS.map((d) => (
            <label
              key={d.key}
              className={`cursor-pointer rounded-2xl border p-4 transition ${form.direction === d.key ? "border-amber-400 bg-amber-400/10" : "border-slate-200 hover:bg-slate-50"} ${off ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="site-direction"
                className="sr-only"
                checked={form.direction === d.key}
                disabled={off}
                onChange={() => setForm((f) => ({ ...f, direction: d.key }))}
              />
              <span className="block text-sm font-semibold text-[#0F1B33]">{d.label}</span>
              <span className="mt-1 block text-xs text-slate-500">{d.hint}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Your logo and colours come from Settings, Branding. Your prices come from Settings, Prices.</p>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold text-[#0F1B33]">Top of the home page</h3>
        <Text label="Headline" hint="Needed before you can publish." value={form.hero.headline} onChange={setIn("hero", "headline")} max={L.headline} disabled={off} placeholder="Airport transfers across West Yorkshire" />
        <Text label="Line under the headline" value={form.hero.subheadline} onChange={setIn("hero", "subheadline")} max={L.sub} disabled={off} rows={2} />
        <Text label="Button wording" hint="Leave empty for “Book now”." value={form.hero.cta_label} onChange={setIn("hero", "cta_label")} max={L.label} disabled={off} placeholder="Book now" />
        <Photo label="Main photo" url={form.hero.image_url} disabled={off} busy={uploading === "hero"} onPick={(f) => pick("hero", f, setIn("hero", "image_url"))} onClear={() => setIn("hero", "image_url")("")} />
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold text-[#0F1B33]">About your business</h3>
        <Text label="Heading" value={form.about.title} onChange={setIn("about", "title")} max={L.title} disabled={off} placeholder="About us" />
        <Text label="Your story" value={form.about.body} onChange={setIn("about", "body")} max={L.body} disabled={off} rows={6} />
        <Photo label="Photo" url={form.about.image_url} disabled={off} busy={uploading === "about"} onPick={(f) => pick("about", f, setIn("about", "image_url"))} onClear={() => setIn("about", "image_url")("")} />
      </section>

      <section>
        <ListHeader title="Services" hint={`Up to ${L.services}. A service with no title is left out.`} count={form.services.length} max={L.services} onAdd={addRow("services", blankService)} disabled={off} addLabel="Add service" />
        <div className="space-y-4">
          {form.services.map((row, i) => (
            <div key={i} className={`${GROUP} space-y-4`}>
              <Text label="Title" value={row.title} onChange={setRow("services", i, "title")} max={L.title} disabled={off} />
              <Text label="Description" value={row.text} onChange={setRow("services", i, "text")} max={L.text} disabled={off} rows={3} />
              <Photo label="Photo" url={row.image_url} disabled={off} busy={uploading === `services-${i}`} onPick={(f) => pick(`services-${i}`, f, setRow("services", i, "image_url"))} onClear={() => setRow("services", i, "image_url")("")} />
              <RemoveRow onClick={dropRow("services", i)} disabled={off} label="Remove service" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <ListHeader title="Vehicles" hint={`Up to ${L.fleet}.`} count={form.fleet.length} max={L.fleet} onAdd={addRow("fleet", blankVehicle)} disabled={off} addLabel="Add vehicle" />
        <div className="space-y-4">
          {form.fleet.map((row, i) => (
            <div key={i} className={`${GROUP} space-y-4`}>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Text label="Name" value={row.name} onChange={setRow("fleet", i, "name")} max={L.name} disabled={off} placeholder="Executive saloon" />
                <Field label="Seats">
                  <input type="number" inputMode="numeric" min={1} max={60} value={row.seats} disabled={off} onChange={(e) => setRow("fleet", i, "seats")(e.target.value)} className={INPUT} />
                </Field>
              </div>
              <Text label="Description" value={row.text} onChange={setRow("fleet", i, "text")} max={L.text} disabled={off} rows={3} />
              <Photo label="Photo" url={row.image_url} disabled={off} busy={uploading === `fleet-${i}`} onPick={(f) => pick(`fleet-${i}`, f, setRow("fleet", i, "image_url"))} onClear={() => setRow("fleet", i, "image_url")("")} />
              <RemoveRow onClick={dropRow("fleet", i)} disabled={off} label="Remove vehicle" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-base font-semibold text-[#0F1B33]">Areas you cover</h3>
        <Text label="Areas" hint={`One per line, up to ${L.areas}.`} value={form.areas} onChange={(v) => setForm((f) => ({ ...f, areas: v }))} disabled={off} rows={5} placeholder={"Leeds\nBradford\nHarrogate"} />
      </section>

      <section>
        <ListHeader title="Customer reviews" hint={`Up to ${L.reviews}. Only use reviews real customers gave you, in their own words.`} count={form.reviews.length} max={L.reviews} onAdd={addRow("reviews", blankReview)} disabled={off} addLabel="Add review" />
        <div className="space-y-4">
          {form.reviews.map((row, i) => (
            <div key={i} className={`${GROUP} space-y-4`}>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Text label="Customer name" value={row.name} onChange={setRow("reviews", i, "name")} max={L.name} disabled={off} />
                <Field label="Stars">
                  <select value={row.rating} disabled={off} onChange={(e) => setRow("reviews", i, "rating")(e.target.value)} className={INPUT}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={String(n)}>{n}</option>)}
                  </select>
                </Field>
              </div>
              <Text label="Review" value={row.text} onChange={setRow("reviews", i, "text")} max={L.text} disabled={off} rows={3} />
              <RemoveRow onClick={dropRow("reviews", i)} disabled={off} label="Remove review" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <ListHeader title="Questions and answers" hint={`Up to ${L.faqs}.`} count={form.faqs.length} max={L.faqs} onAdd={addRow("faqs", blankFaq)} disabled={off} addLabel="Add question" />
        <div className="space-y-4">
          {form.faqs.map((row, i) => (
            <div key={i} className={`${GROUP} space-y-4`}>
              <Text label="Question" value={row.q} onChange={setRow("faqs", i, "q")} max={L.short} disabled={off} />
              <Text label="Answer" value={row.a} onChange={setRow("faqs", i, "a")} max={L.text} disabled={off} rows={3} />
              <RemoveRow onClick={dropRow("faqs", i)} disabled={off} label="Remove question" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold text-[#0F1B33]">Contact details on the website</h3>
        <p className="-mt-3 text-xs text-slate-500">Your phone number and email come from Settings, Business.</p>
        <Text label="Address" value={form.contact.address} onChange={setIn("contact", "address")} max={L.short} disabled={off} />
        <Text label="Opening hours" value={form.contact.hours} onChange={setIn("contact", "hours")} max={120} disabled={off} placeholder="Mon-Sun 06:00-22:00" />
        <Text label="WhatsApp number" value={form.contact.whatsapp} onChange={setIn("contact", "whatsapp")} max={20} disabled={off} placeholder="+447123456789" />
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold text-[#0F1B33]">Search engines</h3>
        <Text label="Page title" hint="Shown in search results and the browser tab. Up to 70 characters." value={form.seo.title} onChange={setIn("seo", "title")} max={L.seoTitle} disabled={off} />
        <Text label="Short description" hint="Up to 160 characters." value={form.seo.description} onChange={setIn("seo", "description")} max={L.seoDescription} disabled={off} rows={2} />
      </section>

      {canEdit && (
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={busy || !!uploading}
            className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-[#0F1B33] transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "Saving…" : live ? "Save and hide website" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={busy || !!uploading}
            className="rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "Saving…" : live ? "Save changes" : "Save and publish"}
          </button>
        </div>
      )}
    </div>
  );
}
