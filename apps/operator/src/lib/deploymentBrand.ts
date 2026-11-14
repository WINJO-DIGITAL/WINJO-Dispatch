// Deployment settings: the one place this app's own business name and website
// are written down. They are used where no signed-in business is known yet
// (sign-in screen, app name and icon text, the pages customers land on after
// paying) and as a fallback while a business's own details load.
//
// Once staff are signed in, the app shows THEIR business's name, logo, colours
// and contact details from public.tenants (see lib/brand.js). To run a
// separate branded copy of this app, set these in the deployment's
// environment; nothing else needs editing:
//   NEXT_PUBLIC_BRAND_NAME     business name   (default "Winjo Dispatch")
//   NEXT_PUBLIC_WEBSITE_URL    its website     (default https://winjo-dispatch.vercel.app)

const pick = (value: string | undefined, fallback: string) => (value && value.trim() ? value.trim() : fallback);

const site = pick(process.env.NEXT_PUBLIC_WEBSITE_URL, "https://winjo-dispatch.vercel.app").replace(/\/$/, "");

export const DEPLOYMENT_BRAND = {
  name: pick(process.env.NEXT_PUBLIC_BRAND_NAME, "Winjo Dispatch"),
  site,
  /** Sign-in placeholder, e.g. "you@example.co.uk". */
  loginPlaceholder: `you@${site.replace(/^https?:\/\//i, "").replace(/^www\./i, "")}`,
};
