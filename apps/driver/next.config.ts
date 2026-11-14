import type { NextConfig } from 'next'
import { BASE_PATH } from './lib/base-path'

const nextConfig: NextConfig = {
  // One site, three apps: this one lives under /driver.
  basePath: BASE_PATH,
  // The Chat tab was removed (14/10/2026); send old links and bookmarks home.
  async redirects() {
    return [{ source: '/chat', destination: '/dashboard', permanent: false }]
  },
}

export default nextConfig
