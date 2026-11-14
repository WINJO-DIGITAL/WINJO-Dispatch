import { describe, it, expect, vi, beforeEach } from 'vitest'

const exchange = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }) }))
import { GET } from './route'

const run = (qs: string) => GET(new Request(`https://site.test/driver/auth/callback${qs}`))
beforeEach(() => exchange.mockResolvedValue({ error: null }))

describe('the sign-in callback under /driver', () => {
  it('sends a signed-in driver to their page inside /driver', async () => {
    expect((await run('?code=abc')).headers.get('location')).toBe('https://site.test/driver/dashboard')
    expect((await run('?code=abc&next=/jobs/7')).headers.get('location')).toBe('https://site.test/driver/jobs/7')
  })
  it('does not double the base path if next already has it', async () => {
    expect((await run('?code=abc&next=/driver/jobs/7')).headers.get('location')).toBe('https://site.test/driver/jobs/7')
  })
  it('refuses to be sent to another site', async () => {
    expect((await run('?code=abc&next=//evil.test/x')).headers.get('location')).toBe('https://site.test/driver/dashboard')
    expect((await run('?code=abc&next=https://evil.test')).headers.get('location')).toBe('https://site.test/driver/dashboard')
  })
  it('a failed or missing code goes to the driver sign-in with the error', async () => {
    exchange.mockResolvedValue({ error: { message: 'bad' } })
    expect((await run('?code=abc')).headers.get('location')).toBe('https://site.test/driver/login?error=auth')
    expect((await run('')).headers.get('location')).toBe('https://site.test/driver/login?error=auth')
  })
})
