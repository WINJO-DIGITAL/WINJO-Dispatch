import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

// Runs the real public/sw.js against a fake service-worker environment.
type Ev = Record<string, unknown>
type Handler = (e: Ev) => void
type Opts = { icon?: string; badge?: string; data?: { url?: string } }
function load() {
  const handlers: Record<string, Handler> = {}
  const shown: Array<{ title: string; opts: Opts }> = []
  const opened: string[] = []
  const navigated: string[] = []
  const focused: string[] = []
  let tabs: Array<{ url: string }> = []
  const sandbox: Record<string, unknown> = {
    self: {
      addEventListener: (t: string, h: Handler) => { handlers[t] = h },
      location: { origin: 'https://site.test' },
      registration: { showNotification: (title: string, opts: Opts) => { shown.push({ title, opts }); return Promise.resolve() } },
      skipWaiting: () => {}, clients: { claim: () => Promise.resolve() },
    },
    caches: { keys: async () => [], delete: async () => true, open: async () => ({ put: () => {} }), match: async () => undefined },
    clients: {
      matchAll: async () => tabs.map((t) => ({ url: t.url, navigate: (u: string) => { navigated.push(`${t.url} -> ${u}`) }, focus: () => { focused.push(t.url); return Promise.resolve() } })),
      openWindow: (u: string) => { opened.push(u); return Promise.resolve() },
    },
    fetch: async () => ({ ok: true, clone: () => ({}) }),
    console,
  }
  vm.runInNewContext(readFileSync(join(__dirname, '../public/sw.js'), 'utf8'), sandbox)
  return { handlers, shown, opened, navigated, focused, setTabs: (t: Array<{ url: string }>) => { tabs = t } }
}
const push = async (sw: ReturnType<typeof load>, payload: object) => {
  let p: Promise<unknown> = Promise.resolve()
  sw.handlers.push({ data: { json: () => payload }, waitUntil: (x: Promise<unknown>) => { p = x } })
  await p
}
const tap = async (sw: ReturnType<typeof load>, url?: string) => {
  let p: Promise<unknown> = Promise.resolve()
  sw.handlers.notificationclick({ notification: { close: vi.fn(), data: { url } }, waitUntil: (x: Promise<unknown>) => { p = x } })
  await p
}

describe('the Driver App service worker under /driver', () => {
  it('shows a notification whose icons and link are under /driver', async () => {
    const sw = load()
    await push(sw, { title: 'New job', body: 'Pickup 09:00', url: '/jobs/42' })
    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].opts.icon).toBe('/driver/icons/icon-192.png')
    expect(sw.shown[0].opts.badge).toBe('/driver/icons/badge-96.png')
    expect(sw.shown[0].opts.data?.url).toBe('/driver/jobs/42')
  })
  it('falls back to the jobs list, and keeps a link that already has /driver', async () => {
    const sw = load()
    await push(sw, { title: 'a' })
    await push(sw, { title: 'b', url: '/driver/jobs/9?reminder=24hr' })
    expect(sw.shown[0].opts.data?.url).toBe('/driver/jobs')
    expect(sw.shown[1].opts.data?.url).toBe('/driver/jobs/9?reminder=24hr')
  })
  it('a tap reuses an open Driver App tab', async () => {
    const sw = load()
    sw.setTabs([{ url: 'https://site.test/driver/dashboard' }])
    await tap(sw, '/driver/jobs/5')
    expect(sw.navigated).toEqual(['https://site.test/driver/dashboard -> /driver/jobs/5'])
    expect(sw.opened).toEqual([])
  })
  it('a tap never hijacks another page of the site: it opens a new window instead', async () => {
    const sw = load()
    sw.setTabs([{ url: 'https://site.test/operator/bookings' }, { url: 'https://site.test/signup' }, { url: 'https://site.test/' }])
    await tap(sw, '/driver/jobs/5')
    expect(sw.navigated).toEqual([])
    expect(sw.opened).toEqual(['/driver/jobs/5'])
  })
  it('a tap on an old-style link (no /driver) still lands in the Driver App', async () => {
    const sw = load()
    sw.setTabs([])
    await tap(sw, '/jobs/5')
    expect(sw.opened).toEqual(['/driver/jobs/5'])
    await tap(sw, undefined)
    expect(sw.opened[1]).toBe('/driver/jobs')
  })
})
