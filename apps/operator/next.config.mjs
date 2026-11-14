/** @type {import('next').NextConfig} */
const nextConfig = {
  // One site: the project holds one set of Supabase settings (no NEXT_PUBLIC_ copies).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
  },
  reactStrictMode: true,
  // Entry points and retired screens. Kept as redirects (not pages) so old
  // bookmarks and push-notification links ("/operator") keep working.
  async redirects() {
    return [
      { source: "/operator", destination: "/operator/today", permanent: false },
      { source: "/operator/dashboard", destination: "/operator/today", permanent: false },
      // Dispatch and Calendar became views of Bookings (?q= is passed through,
      // so website/push links to /operator/dispatch?q=REF still find the job).
      { source: "/operator/dispatch", destination: "/operator/bookings", permanent: false },
      { source: "/operator/calendar", destination: "/operator/bookings?view=calendar", permanent: false },
    ];
  },
};

export default nextConfig;
