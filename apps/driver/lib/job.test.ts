import { describe, it, expect } from 'vitest'
import { STATUS_FLOW, TIMESTAMP_FIELD, PROGRESS_STEPS, STEP_LABELS, getGraceMinutes, formatPref, isNoShowJob } from './job'

// The statuses the database lets a driver-only login set (database hardening, 10/11/2026).
const DRIVER_ALLOWED = ['En Route', 'Arrived', 'Passenger On Board', 'Completed', 'No Show']

describe('status flow', () => {
  const next = (from: string) => STATUS_FLOW.find(s => s.from === from)

  it('walks Dispatched to En Route to Arrived to On Board to Completed', () => {
    expect(next('Dispatched')?.to).toBe('En Route')
    expect(next('En Route')?.to).toBe('Arrived')
    expect(next('Arrived')?.to).toBe('Passenger On Board')
    expect(next('Passenger On Board')?.to).toBe('Completed')
  })
  it('older status spellings still move forward', () => {
    expect(next('accepted')?.to).toBe('En Route')
    expect(next('confirmed')?.to).toBe('En Route')
    expect(next('en_route')?.to).toBe('Arrived')
    expect(next('arrived')?.to).toBe('Passenger On Board')
    expect(next('active')?.to).toBe('Completed')
  })
  it('has no step out of a finished or unassigned job', () => {
    for (const s of ['Completed', 'Cancelled', 'No Show', 'Unassigned']) expect(next(s)).toBeUndefined()
  })
  it('the app only ever sets statuses the database allows a driver to set', () => {
    for (const step of STATUS_FLOW) expect(DRIVER_ALLOWED).toContain(step.to)
    expect(STATUS_FLOW.some(s => (s.to as string) === 'Cancelled')).toBe(false)
  })
  it('each step has a button label', () => {
    for (const step of STATUS_FLOW) expect(step.label.length).toBeGreaterThan(0)
  })
  it('stamps a timestamp column for each progress status', () => {
    expect(TIMESTAMP_FIELD['En Route']).toBe('tracking_started_at')
    expect(TIMESTAMP_FIELD['Arrived']).toBe('arrived_at')
    expect(TIMESTAMP_FIELD['Passenger On Board']).toBe('passenger_onboard_at')
    expect(TIMESTAMP_FIELD['Completed']).toBe('completed_at')
  })
  it('progress bar covers every stamped status and labels each one', () => {
    expect(PROGRESS_STEPS).toEqual(['En Route', 'Arrived', 'Passenger On Board', 'Completed'])
    for (const s of PROGRESS_STEPS) {
      expect(TIMESTAMP_FIELD[s]).toBeDefined()
      expect(STEP_LABELS[s]).toBeTruthy()
    }
  })
})

describe('wait grace period', () => {
  it('an explicit setting always wins, even zero', () => {
    expect(getGraceMinutes('To Airport', 'BA1', 25)).toBe(25)
    expect(getGraceMinutes(null, null, 0)).toBe(0)
  })
  it('airport or flight jobs get 60, hotels 30, stations and trains 20, others 15', () => {
    expect(getGraceMinutes('From Airport', null, null)).toBe(60)
    expect(getGraceMinutes('Point to Point', 'EZY1', null)).toBe(60)
    expect(getGraceMinutes('Hotel pickup', null, null)).toBe(30)
    expect(getGraceMinutes('Train station', null, null)).toBe(20)
    expect(getGraceMinutes('Railway Station', null, null)).toBe(20)
    expect(getGraceMinutes('Point to Point', null, null)).toBe(15)
    expect(getGraceMinutes(null, null, null)).toBe(15)
  })
})

describe('passenger preferences', () => {
  it('uses friendly labels for known preferences', () => {
    expect(formatPref('quiet_ride')).toBe('Quiet ride')
    expect(formatPref('meet_and_greet')).toBe('Meet & greet')
  })
  it('title-cases anything unknown', () => {
    expect(formatPref('extra_legroom')).toBe('Extra Legroom')
  })
})

describe('no-show detection', () => {
  it('a job marked No Show is a no-show', () => {
    expect(isNoShowJob({ status: 'No Show', driver_notes: null })).toBe(true)
  })
  it('an older no-show saved as Cancelled with the note is still a no-show', () => {
    expect(isNoShowJob({ status: 'Cancelled', driver_notes: '[No Show] Passenger was not at the pickup location.' })).toBe(true)
  })
  it('an office cancellation is not a no-show', () => {
    expect(isNoShowJob({ status: 'Cancelled', driver_notes: 'Customer rang to cancel' })).toBe(false)
  })
  it('a job in progress is not a no-show', () => {
    expect(isNoShowJob({ status: 'Arrived', driver_notes: null })).toBe(false)
  })
})

import { isOffline, updateFailureMessage, loadFailureMessage } from './job'

describe('offline and failed-update messages', () => {
  it('knows when the phone says it is offline, and treats unknown as online', () => {
    expect(isOffline({ onLine: false })).toBe(true)
    expect(isOffline({ onLine: true })).toBe(false)
    expect(isOffline({})).toBe(false)
    expect(isOffline(undefined)).toBe(false)
  })

  it('turns a lost connection into plain words, never a raw fetch error', () => {
    const noSignal = 'No signal, so this was not saved. Move somewhere with better signal and try again.'
    expect(updateFailureMessage('TypeError: Failed to fetch', 'x', false)).toBe(noSignal)
    expect(updateFailureMessage('Load failed', 'x', false)).toBe(noSignal)
    expect(updateFailureMessage('NetworkError when attempting to fetch resource.', 'x', false)).toBe(noSignal)
    expect(updateFailureMessage(undefined, 'x', true)).toBe(noSignal)
    expect(updateFailureMessage('permission denied', 'x', true)).toBe(noSignal)
  })

  it('keeps the server\'s own message when the connection is fine, and falls back when there is none', () => {
    expect(updateFailureMessage('Driver may only set No Show from En Route or Arrived', 'x', false)).toBe('Driver may only set No Show from En Route or Arrived')
    expect(updateFailureMessage(undefined, 'It may have been changed by the office.', false)).toBe('It may have been changed by the office.')
    expect(updateFailureMessage('', 'fallback', false)).toBe('fallback')
  })

  it('says why a job could not be loaded', () => {
    expect(loadFailureMessage(true)).toMatch(/offline/i)
    expect(loadFailureMessage(false)).toMatch(/couldn't be loaded/)
  })
})
