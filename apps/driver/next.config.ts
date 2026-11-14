import type { NextConfig } from 'next'
import { BASE_PATH } from './lib/base-path'

const nextConfig: NextConfig = {
  // One site: the project holds one set of Supabase settings (no NEXT_PUBLIC_ copies).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  },
  // One site, three apps: this one lives under /driver.
  basePath: BASE_PATH,
  // The Chat tab was removed (14/10/2026); send old links and bookmarks home.
  async redirects() {
    return [{ source: '/chat', destination: '/dashboard', permanent: false }]
  },
}

export default nextConfig
