// The Driver App is one page of the platform's single website, served under /driver
// (the website is at /, the Operator app at /operator). Next prefixes links, redirects and
// router calls itself; this constant and withBase() are for the places it cannot: raw URLs in
// the manifest, the service worker, push-notification links, CSS and plain <img> tags.

export const BASE_PATH = '/driver'

/** A path inside the app as a browser address: '/jobs/1' -> '/driver/jobs/1'. Idempotent. */
export function withBase(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return p === BASE_PATH || p.startsWith(`${BASE_PATH}/`) || p.startsWith(`${BASE_PATH}?`) ? p : `${BASE_PATH}${p === '/' ? '' : p}`
}
