// The one place that decides which Supabase project the website talks to.
//
// Set SUPABASE_URL in every environment. There is no fallback to any project: guessing a
// database is how a preview or a new host ends up writing to live data.
//   - In production, a missing SUPABASE_URL stops the function at start-up with a clear error.
//   - Anywhere else it returns '' (every database call then fails visibly) and warns once.
// NEXT_PUBLIC_SUPABASE_URL is accepted as the same value under its public name.

let warned = false;

function supabaseUrl() {
  const set = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  if (set) return set;
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('SUPABASE_URL is not set. Add it to this Vercel project\'s environment variables (Production) and redeploy. The platform will not guess a database.');
  }
  if (!warned) {
    warned = true;
    console.warn('[config] SUPABASE_URL is not set, so database calls will fail. Set it for this environment (see .env.example).');
  }
  return '';
}

module.exports = supabaseUrl;
