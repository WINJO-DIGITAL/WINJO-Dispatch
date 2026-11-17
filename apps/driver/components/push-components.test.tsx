// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// The driver's notification state: stubbed, so each state can be shown.
const push = {
  state: 'off' as 'on' | 'off' | 'denied' | 'needs-install' | 'unsupported',
  enable: vi.fn(async () => 'on' as const),
  test: vi.fn(async () => ({ sent: 1 })),
  sync: vi.fn(async () => {}),
}
vi.mock('@/lib/push', () => ({
  pushState: () => push.state,
  enablePush: (...a: unknown[]) => push.enable(...(a as [])),
  sendTestPush: () => push.test(),
  syncPush: () => push.sync(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'driver-1' } } }) } }) }))
let pathname = '/driver/dashboard'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

import { PushPrompt } from './push-prompt'
import { PushSettings } from './push-settings'
import { usePushState } from '@/lib/use-push-state'

beforeEach(() => {
  push.state = 'off'; pathname = '/driver/dashboard'
  push.enable.mockClear(); push.test.mockClear(); push.sync.mockClear()
  sessionStorage.clear()
})
afterEach(() => cleanup())

describe('the notification prompt', () => {
  it('asks the driver to turn notifications on, and turning them on makes it go away', async () => {
    render(<PushPrompt />)
    expect(await screen.findByText(/Turn on notifications so you get new jobs/)).toBeTruthy()
    fireEvent.click(screen.getByText('Turn on'))
    await waitFor(() => expect(screen.queryByText(/Turn on notifications so you get new jobs/)).toBeNull())
    expect(push.enable).toHaveBeenCalledWith('driver-1')
  })

  it('tells an iPhone driver to add the app to the Home Screen first, and a blocked one where to switch it back on', async () => {
    push.state = 'needs-install'
    const { unmount } = render(<PushPrompt />)
    expect(await screen.findByText(/Add to Home Screen/)).toBeTruthy()
    unmount()
    push.state = 'denied'
    render(<PushPrompt />)
    expect(await screen.findByText(/Notifications are blocked/)).toBeTruthy()
  })

  it('is not shown when notifications are already on or the phone cannot do them', () => {
    for (const s of ['on', 'unsupported'] as const) {
      push.state = s
      const { container, unmount } = render(<PushPrompt />)
      expect(container.textContent).toBe('')
      unmount()
    }
  })

  it('stays out of the way on a job screen', () => {
    pathname = '/driver/jobs/abc-123'
    const { container } = render(<PushPrompt />)
    expect(container.textContent).toBe('')
  })

  it('can be hidden for the session, and stays hidden', async () => {
    const { unmount } = render(<PushPrompt />)
    fireEvent.click(await screen.findByLabelText('Hide'))
    expect(screen.queryByText(/Turn on notifications so you get new jobs/)).toBeNull()
    expect(sessionStorage.getItem('push_prompt_hidden')).toBe('1')
    unmount()
    const { container } = render(<PushPrompt />)
    expect(container.textContent).toBe('')
  })
})

describe('the notification card on the profile', () => {
  it('shows the state in words', async () => {
    const labels: Array<[typeof push.state, string]> = [['on', 'On'], ['off', 'Off'], ['denied', 'Blocked'], ['needs-install', 'Add to Home Screen first'], ['unsupported', 'Not supported on this browser']]
    for (const [state, label] of labels) {
      push.state = state
      const { unmount } = render(<PushSettings />)
      expect(await screen.findByText(label)).toBeTruthy()
      unmount()
    }
  })

  it('turns notifications on, then offers a test and says what happened', async () => {
    render(<PushSettings />)
    fireEvent.click(await screen.findByText('Turn on notifications'))
    expect(await screen.findByText('On')).toBeTruthy()
    fireEvent.click(screen.getByText('Send test notification'))
    expect(await screen.findByText(/Test sent/)).toBeTruthy()
    push.test.mockResolvedValueOnce({ sent: 0 })
    fireEvent.click(screen.getByText('Send test notification'))
    expect(await screen.findByText(/No phone could be reached/)).toBeTruthy()
  })
})

describe('usePushState', () => {
  it('reads the browser state, and lets a screen change it afterwards', async () => {
    function Probe() {
      const [state, set] = usePushState()
      return <button onClick={() => set('on')}>{String(state)}</button>
    }
    push.state = 'denied'
    render(<Probe />)
    const b = await screen.findByText('denied')
    fireEvent.click(b)
    expect(await screen.findByText('on')).toBeTruthy()
  })
})
