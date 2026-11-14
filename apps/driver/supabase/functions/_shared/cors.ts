// CORS helper for edge functions called from the driver app browser client.
//
// Only the Driver App's own origins are allowed, so the preflight and response headers are not
// granted to arbitrary origins. The Driver App is reached on the platform address (APP_URL,
// default the platform's own address) and on its own project address (DRIVER_PROJECT_URL).

const APP_URL = Deno.env.get('APP_URL') ?? 'https://winjo-dispatch.vercel.app'
const DRIVER_PROJECT_URL = Deno.env.get('DRIVER_PROJECT_URL') ?? 'https://winjo-driver.vercel.app'
const ALLOWED = [APP_URL, DRIVER_PROJECT_URL].map((u) => u.replace(/\/$/, ''))

/** The CORS headers for a request: its own origin when it is one of ours, else the platform address. */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin':  ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function corsPreflightResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(req) })
}
