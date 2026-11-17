// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// The map library is never needed here: these cases show nothing, or never get as far as drawing.
vi.mock('leaflet', () => { throw new Error('leaflet must not be loaded for an unusable address') })

import { JobMap } from './job-map'

afterEach(() => cleanup())

describe('the job map', () => {
  it('draws nothing, and does not load the map library, when either address is missing', () => {
    for (const [pickup, dropoff] of [['', 'Leeds Bradford Airport'], ['14 Mill Lane', ''], ['—', 'Airport'], ['14 Mill Lane', '—']]) {
      const { container, unmount } = render(<JobMap pickup={pickup} dropoff={dropoff} />)
      expect(container.innerHTML).toBe('')
      unmount()
    }
  })
})
