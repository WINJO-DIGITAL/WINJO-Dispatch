// The one place that decides which Supabase project the website talks to.
//
// Set SUPABASE_URL in every environment. If it is missing, the platform's own
// project is used so production keeps working, but outside production (preview
// deploys, a laptop, a new host) that is almost certainly a mistake, so it is
// logged once, loudly, instead of silently pointing a copy at live data.
const LIVE_URL = 'https://lztbivgmhcgohhvgakyu.supabase.co';
let warned = false;

function supabaseUrl() {
  const set = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (set) return set;
  const inProduction = process.env.VERCEL_ENV === 'production';
  const inTests = !!process.env.NODE_TEST_CONTEXT;
  if (!inProduction && !inTests && !warned) {
    warned = true;
    console.warn('[config] SUPABASE_URL is not set: falling back to the default LIVE project. Set SUPABASE_URL for this environment.');
  }
  return LIVE_URL;
}

module.exports = supabaseUrl;
module.exports.LIVE_URL = LIVE_URL;
