// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import type { Booking } from '@/lib/types'

// ── A fake Supabase client: one instance, with the bookings row and every update recorded ─────────────

type Reply = { data: unknown; error: { message: string; code?: string } | null }
const db: {
  booking: Record<string, unknown> | null
  bookingError: { message: string; code?: string } | null
  getUserThrows: boolean
  updateReply: (patch: Record<string, unknown>) => Reply
  updates: Array<{ table: string; patch: Record<string, unknown>; id: unknown }>
  loads: number
} = { booking: null, bookingError: null, getUserThrows: false, updateReply: () => ({ data: [{ id: 'b1' }], error: null }), updates: [], loads: 0 }

function from(table: string) {
  const eqs: Array<[string, unknown]> = []
  let patch: Record<string, unknown> | null = null
  const q: Record<string, unknown> = {
    select: () => q,
    order: () => q,
    in: () => q,
    eq: (k: string, v: unknown) => { eqs.push([k, v]); return q },
    update: (p: Record<string, unknown>) => { patch = p; return q },
    upsert: async () => ({ error: null }),
    single: async () => {
      if (table === 'bookings') { db.loads++; return { data: db.bookingError ? null : db.booking, error: db.bookingError } }
      return { data: null, error: null }
    },
    then: (resolve: (v: unknown) => unknown) => {
      if (patch) {
        db.updates.push({ table, patch, id: eqs.find(([k]) => k === 'id')?.[1] })
        return resolve(db.updateReply(patch))
      }
      return resolve({ data: table === 'bookings' ? null : [], error: null })
    },
  }
  return q
}
const channel = { on: () => channel, subscribe: () => channel }
const supabase = {
  auth: {
    getUser: async () => { if (db.getUserThrows) throw new TypeError('Failed to fetch'); return { data: { user: { id: 'driver-1' } } } },
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
  },
  from,
  channel: () => channel,
  removeChannel: () => {},
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
}
vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabase }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
const addToast = vi.fn()
vi.mock('@/components/toast', () => ({ useToast: () => ({ addToast }) }))
vi.mock('@/components/job-map', () => ({ JobMap: () => null }))
vi.mock('@/components/verified-flight-card', () => ({ VerifiedFlightCard: () => null }))

import JobDetailPage from './page'

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────

const job = (over: Partial<Booking> = {}): Record<string, unknown> => ({
  id: 'b1', ref: 'SAMP-000123', created_at: '2026-11-10T09:00:00Z', updated_at: null, journey_type: 'Destination to Airport',
  pickup_location: '14 Mill Lane, Leeds LS1 4AB', airport: 'Leeds Bradford Airport', flight_number: null, dropoff_address: 'Leeds Bradford Airport',
  travel_date: null, travel_time: '09:30:00', pickup_time: null, passengers: 2, luggage: null, return_journey: false,
  customer_name: 'Priya Shah', customer_phone: '07700900123', customer_email: null, contact_method: 'WhatsApp', status: 'Dispatched',
  operator_note: null, quoted_price: 70, payment_method: null, payment_status: 'Unpaid', assigned_driver_id: 'driver-1', driver_notes: null, notes: null,
  tracking_started_at: null, arrived_at: null, passenger_onboard_at: null, completed_at: null, actual_distance_miles: null, actual_duration_minutes: null,
  passenger_preferences: null, wait_time_minutes: null, flight_status: null, flight_checked_at: null, corporate_email: null, receipt_sent_at: null,
  attestation_status: null, driver_confirmed_at: null, ...over,
})

// `use(params)` needs an already-settled promise so the page renders without suspending.
const params = () => Object.assign(Promise.resolve({ id: 'b1' }), { status: 'fulfilled', value: { id: 'b1' } }) as unknown as Promise<{ id: string }>

async function open(over: Partial<Booking> = {}) {
  db.booking = job(over)
  render(<JobDetailPage params={params()} />)
  await screen.findByText('SAMP-000123')
}

// Drag the thumb of the swipe control across the track, as a finger would.
function swipe() {
  const thumb = document.querySelector('.touch-none') as HTMLElement
  expect(thumb, 'the swipe control is on screen').toBeTruthy()
  fireEvent.pointerDown(thumb, { pointerId: 1, clientX: 0 })
  fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 400 })
  fireEvent.pointerUp(thumb, { pointerId: 1, clientX: 400 })
}

const originalLocation = window.location
let hrefs: string[]
let onLine = true

beforeEach(() => {
  db.booking = null; db.bookingError = null; db.getUserThrows = false; db.updates = []; db.loads = 0
  db.updateReply = () => ({ data: [{ id: 'b1' }], error: null })
  addToast.mockReset()
  hrefs = []
  onLine = true
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => onLine })
  // jsdom cannot navigate: capture the sms: link the screen opens, and give the page a plain location.
  const fake = { search: '', get href() { return hrefs[hrefs.length - 1] ?? '' }, set href(v: string) { hrefs.push(v) } }
  Object.defineProperty(window, 'location', { configurable: true, value: fake })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 320 })
  Element.prototype.setPointerCapture = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  vi.unstubAllGlobals()
})

// ── Loading ───────────────────────────────────────────────────────────────────────────────────────

describe('the job screen: loading', () => {
  it('shows the job and the first action for a dispatched job', async () => {
    await open()
    expect(screen.getByText('Priya Shah')).toBeTruthy()
    expect(screen.getAllByText(/14 Mill Lane/).length).toBeGreaterThan(0)
    expect(screen.getByText('Head to Pickup')).toBeTruthy()
  })

  it('says "Booking not found" only when there really is no such booking', async () => {
    db.bookingError = { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }
    render(<JobDetailPage params={params()} />)
    expect(await screen.findByText('Booking not found')).toBeTruthy()
  })

  it('offline: says it cannot load the job and offers Try again, then loads it once back online', async () => {
    onLine = false
    db.bookingError = { message: 'TypeError: Failed to fetch' }
    render(<JobDetailPage params={params()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/offline, so this job can't be loaded/)
    expect(screen.queryByText('Booking not found')).toBeNull()

    onLine = true
    db.bookingError = null
    db.booking = job()
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByText('SAMP-000123')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not hang on the spinner when the network call itself throws', async () => {
    db.getUserThrows = true
    render(<JobDetailPage params={params()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn't be loaded/)
  })
})

// ── The trip, one swipe at a time ─────────────────────────────────────────────────────────────────

describe('the job screen: starting, arriving, picking up, completing', () => {
  it('start: swiping "Head to Pickup" saves En Route with its timestamp, opens the customer text and offers the next step', async () => {
    await open()
    swipe()
    await screen.findByText('Arrived at Pickup')
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]).toMatchObject({ table: 'bookings', id: 'b1' })
    expect(db.updates[0].patch).toMatchObject({ status: 'En Route' })
    expect(typeof db.updates[0].patch.tracking_started_at).toBe('string')
    // The two-tap text: Messages opens pre-filled on the driver's own phone, nothing is sent for them.
    expect(hrefs.some((h) => h.startsWith('sms:'))).toBe(true)
    expect(screen.getByText('En Route to Pickup')).toBeTruthy()
  })

  it('arrive: swiping "Arrived at Pickup" saves Arrived with its timestamp', async () => {
    await open({ status: 'En Route' })
    swipe()
    await screen.findByText('Passenger On Board', { selector: 'span' })
    expect(db.updates[0].patch).toMatchObject({ status: 'Arrived' })
    expect(typeof db.updates[0].patch.arrived_at).toBe('string')
  })

  it('on board: saves Passenger On Board and shows a five-second undo', async () => {
    await open({ status: 'Arrived' })
    swipe()
    await screen.findByText('Passenger On Board set')
    expect(db.updates[0].patch).toMatchObject({ status: 'Passenger On Board' })
    expect(typeof db.updates[0].patch.passenger_onboard_at).toBe('string')
    expect(screen.getByText('Undo')).toBeTruthy()
  })

  it('complete: asks how the customer paid, saves Completed with that method and leaves payment status to the office', async () => {
    await open({ status: 'Passenger On Board' })
    swipe()
    await screen.findByText('How was payment made?')
    // Nothing is chosen for the driver: the confirm button stays off until a method is picked.
    const confirm = screen.getByText('Confirm & Complete').closest('button') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByText('Cash'))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '70' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await screen.findAllByText('Journey Complete')
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0].patch).toMatchObject({ status: 'Completed', payment_method: 'Cash' })
    expect(db.updates[0].patch).not.toHaveProperty('payment_status')
    expect(typeof db.updates[0].patch.completed_at).toBe('string')
    // The receipt email is asked for in the background.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('send-journey-receipt'))).toBe(true))
  })

  it('complete: an already-paid booking completes without asking about payment', async () => {
    await open({ status: 'Passenger On Board', payment_status: 'Paid', payment_method: 'Card' })
    swipe()
    await screen.findAllByText('Journey Complete')
    expect(screen.queryByText('How was payment made?')).toBeNull()
    expect(db.updates[0].patch).toMatchObject({ status: 'Completed' })
    expect(db.updates[0].patch).not.toHaveProperty('payment_method')
  })

  it('complete: a return leg is paid with its outbound, so no payment question and no payment fields', async () => {
    await open({ status: 'Passenger On Board', notes: 'Return leg created automatically from return booking.' })
    swipe()
    await screen.findAllByText('Journey Complete')
    expect(screen.queryByText('How was payment made?')).toBeNull()
    expect(db.updates[0].patch).not.toHaveProperty('payment_method')
  })

  it('does nothing if the swipe is not carried all the way across', async () => {
    await open()
    const thumb = document.querySelector('.touch-none') as HTMLElement
    fireEvent.pointerDown(thumb, { pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 60 })
    fireEvent.pointerUp(thumb, { pointerId: 1, clientX: 60 })
    await act(async () => { await Promise.resolve() })
    expect(db.updates).toHaveLength(0)
    expect(screen.getByText('Head to Pickup')).toBeTruthy()
  })

  it('a job more than 24 hours away cannot be started yet', async () => {
    const far = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
    await open({ travel_date: far })
    expect(screen.getByText('Available 24 h before pickup')).toBeTruthy()
    expect(document.querySelector('.touch-none')).toBeNull()
  })
})

// ── Errors and offline, when saving ───────────────────────────────────────────────────────────────

describe('the job screen: when an update does not save', () => {
  it('shows the server\'s message, keeps the old status and opens no text', async () => {
    await open()
    db.updateReply = () => ({ data: null, error: { message: 'new row violates row-level security policy' } })
    swipe()
    expect(await screen.findByText(/violates row-level security/)).toBeTruthy()
    expect(screen.getByText('Head to Pickup')).toBeTruthy()
    expect(hrefs).toHaveLength(0)
  })

  it('explains it when the office has already taken the job off this driver (no row comes back)', async () => {
    await open()
    db.updateReply = () => ({ data: [], error: null })
    swipe()
    expect(await screen.findByText(/may have been changed by the office/)).toBeTruthy()
    expect(screen.getByText('Head to Pickup')).toBeTruthy()
  })

  it('offline: says there is no signal in plain words, not a raw fetch error, and the job does not move on', async () => {
    await open()
    onLine = false
    fireEvent(window, new Event('offline'))
    expect((await screen.findByRole('status')).textContent).toMatch(/You're offline/)
    db.updateReply = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    swipe()
    expect(await screen.findByText(/No signal, so this was not saved/)).toBeTruthy()
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()
    expect(screen.getByText('Head to Pickup')).toBeTruthy()
    // Back online: the banner goes, and the same swipe now works.
    onLine = true
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    db.updateReply = () => ({ data: [{ id: 'b1' }], error: null })
    swipe()
    await screen.findByText('Arrived at Pickup')
  })

  it('a failed completion keeps the job open and shows the problem, without the completion screen', async () => {
    await open({ status: 'Passenger On Board' })
    swipe()
    await screen.findByText('How was payment made?')
    fireEvent.click(screen.getByText('Card'))
    db.updateReply = () => ({ data: null, error: { message: 'Load failed' } })
    fireEvent.click(screen.getByText('Confirm & Complete').closest('button') as HTMLButtonElement)
    expect(await screen.findByText(/No signal, so this was not saved/)).toBeTruthy()
    expect(screen.queryByText('Journey Complete')).toBeNull()
  })
})
