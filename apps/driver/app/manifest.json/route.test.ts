import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('the app manifest under /driver', () => {
  it('starts and is scoped inside /driver, with every icon under /driver', async () => {
    const m = await (GET() as Response).json()
    expect(m.start_url).toBe('/driver/dashboard')
    expect(m.scope).toBe('/driver/')
    expect(m.id).toBe('/driver/')
    expect(m.icons.length).toBeGreaterThan(0)
    for (const i of m.icons) expect(i.src.startsWith('/driver/icons/')).toBe(true)
  })
})
