import { describe, it, expect } from 'vitest'
import { BASE_PATH, withBase } from './base-path'

describe('withBase', () => {
  it('puts an app path under /driver', () => {
    expect(BASE_PATH).toBe('/driver')
    expect(withBase('/jobs/1')).toBe('/driver/jobs/1')
    expect(withBase('/icons/icon-192.png')).toBe('/driver/icons/icon-192.png')
    expect(withBase('/jobs/1?reminder=24hr')).toBe('/driver/jobs/1?reminder=24hr')
  })
  it('handles the root and a path without a leading slash', () => {
    expect(withBase('/')).toBe('/driver')
    expect(withBase('dashboard')).toBe('/driver/dashboard')
  })
  it('never adds it twice', () => {
    expect(withBase('/driver/jobs/1')).toBe('/driver/jobs/1')
    expect(withBase('/driver')).toBe('/driver')
    expect(withBase(withBase('/jobs'))).toBe('/driver/jobs')
  })
  it('does not mistake a path that merely starts with the word', () => {
    expect(withBase('/drivers')).toBe('/driver/drivers')
  })
})
