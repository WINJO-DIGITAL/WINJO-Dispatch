// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// A fake Supabase client for the jobs list: the driver's bookings, or a failure.
type Row = Record<string, unknown>
const db: { rows: Row[]; error: { message: string } | null; calls: number } = { rows: [], error: null, calls: 0 }
function bookingsQuery() {
  const q: Record<string, unknown> = {
    select: () => q, eq: () => q, in: () => q, order: () => q,
    then: (resolve: (v: unknown) => unknown) => { db.calls++; return resolve({ data: db.error ? null : db.rows, error: db.error }) },
  }
  return q
}
const channel = { on: () => channel, subscribe: () => channel }
const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'driver-1' } } }) },
  from: () => bookingsQuery(),
  channel: () => channel,
  removeChannel: () => {},
}
vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabase }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

import JobsPage from './page'

const job = (id: string, name: string, status: string, time = '09:30:00'): Row => ({
  id, ref: `SAMP-${id}`, customer_name: name, status, travel_date: '2099-01-05', travel_time: time, passengers: 2,
  pickup_location: '14 Mill Lane, Leeds', airport: 'Leeds Bradford Airport', dropoff_address: 'Leeds Bradford Airport',
  journey_type: 'Destination to Airport', quoted_price: 70, payment_method: null, payment_status: 'Unpaid', notes: null, return_journey: false,
})

beforeEach(() => {
  db.rows = []; db.error = null; db.calls = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => cleanup())

describe('the jobs list', () => {
  it('shows the driver\'s jobs on the Active tab when one is under way, with counts on the tabs', async () => {
    db.rows = [job('1', 'Priya Shah', 'En Route'), job('2', 'Tom Reilly', 'Dispatched'), job('3', 'Aisha Khan', 'accepted')]
    render(<JobsPage />)
    expect(await screen.findByText('Priya Shah')).toBeTruthy()
    expect(screen.queryByText('Tom Reilly')).toBeNull()
    expect(screen.getByText('Active (1)')).toBeTruthy()
    expect(screen.getByText('Upcoming (2)')).toBeTruthy()
  })

  it('opens on Upcoming when nothing is under way but jobs are coming up', async () => {
    db.rows = [job('2', 'Tom Reilly', 'Dispatched'), job('3', 'Aisha Khan', 'accepted')]
    render(<JobsPage />)
    expect(await screen.findByText('Tom Reilly')).toBeTruthy()
    expect(screen.getByText('Aisha Khan')).toBeTruthy()
  })

  it('never overrides the tab the driver has chosen themselves', async () => {
    db.rows = [job('2', 'Tom Reilly', 'Dispatched'), job('4', 'Mark Dunn', 'Completed')]
    render(<JobsPage />)
    await screen.findByText('Tom Reilly')
    fireEvent.click(screen.getByText('Active (0)'))
    expect(screen.getByText('No active jobs')).toBeTruthy()
    expect(screen.queryByText('Tom Reilly')).toBeNull()
    fireEvent.click(screen.getByText('Done'))
    expect(screen.getByText('Mark Dunn')).toBeTruthy()
  })

  it('says there are no jobs when there are none, and that is not an error', async () => {
    render(<JobsPage />)
    expect(await screen.findByText('No active jobs')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('searches by customer name or reference', async () => {
    db.rows = [job('1', 'Priya Shah', 'En Route'), job('5', 'Joe Bright', 'Arrived')]
    render(<JobsPage />)
    await screen.findByText('Priya Shah')
    fireEvent.change(screen.getByPlaceholderText('Search by name or reference'), { target: { value: 'bright' } })
    expect(screen.queryByText('Priya Shah')).toBeNull()
    expect(screen.getByText('Joe Bright')).toBeTruthy()
  })

  it('offline or failing: says the jobs could not be loaded (not "No jobs") and retries on request', async () => {
    db.error = { message: 'TypeError: Failed to fetch' }
    render(<JobsPage />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn't be loaded/)
    expect(screen.queryByText(/No active jobs/)).toBeNull()

    db.error = null
    db.rows = [job('1', 'Priya Shah', 'En Route')]
    fireEvent.click(screen.getByText('Try again'))
    expect(await screen.findByText('Priya Shah')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(db.calls).toBe(2)
  })
})
