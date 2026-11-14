import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The sign-in guard: signed-out visitors go to /login except on the public
// pages; a signed-in driver on /login goes to the dashboard.
const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

import { middleware, config } from './middleware'

// The app is served under /driver (its pages sit in app/driver); paths below are in-app paths.
const run = (path: string) => middleware(new NextRequest(`https://driver.test/driver${path === '/' ? '' : path}`))
const loc = (r: Response) => r.headers.get('location')

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
})

describe('signed out', () => {
  beforeEach(() => getUser.mockResolvedValue({ data: { user: null } }))

  it.each(['/dashboard', '/jobs', '/jobs/abc', '/', '/profile'])('sends %s to /login', async (p) => {
    const r = await run(p)
    expect(r.status).toBe(307)
    expect(loc(r)).toBe('https://driver.test/driver/login')
  })
  it.each(['/login', '/forgot-password', '/reset-password', '/reset-password?token_hash=x&type=recovery', '/auth/callback'])('lets %s through', async (p) => {
    const r = await run(p)
    expect(r.status).toBe(200)
    expect(loc(r)).toBeNull()
  })
})

describe('signed in', () => {
  beforeEach(() => getUser.mockResolvedValue({ data: { user: { id: 'u1' } } }))

  it('sends /login to the dashboard', async () => {
    const r = await run('/login')
    expect(loc(r)).toBe('https://driver.test/driver/dashboard')
  })
  it('lets every other page through', async () => {
    for (const p of ['/dashboard', '/jobs/abc', '/reset-password']) {
      const r = await run(p)
      expect(loc(r)).toBeNull()
    }
  })
})

describe('matcher', () => {
  const re = new RegExp(`^(?:${config.matcher.join('|')})$`)
  it('skips static files, icons, the manifest, the service worker and fonts, and anything outside /driver', () => {
    for (const p of ['/api/x', '/operator/today', '/driver/_next/static/a.js', '/driver/_next/image', '/driver/favicon.ico', '/driver/icons/icon-192.png', '/driver/manifest.json', '/driver/sw.js', '/driver/fonts/a.woff2', '/driver/logo.png']) {
      expect(re.test(p), p).toBe(false)
    }
  })
  it('guards the app pages', () => {
    for (const p of ['/driver', '/driver/dashboard', '/driver/jobs/abc', '/driver/login']) expect(re.test(p), p).toBe(true)
  })
})
