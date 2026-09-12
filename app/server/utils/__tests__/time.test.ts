import { describe, it, expect } from 'vitest'
import { timeRangesOverlap, timeToMinutes } from '../time'

describe('timeToMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(timeToMinutes('09:00')).toBe(540)
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('00:00:30')).toBe(0.5)
  })

  it('rejects malformed input', () => {
    expect(() => timeToMinutes('9am')).toThrow()
  })
})

describe('timeRangesOverlap', () => {
  it('detects overlapping slots', () => {
    expect(timeRangesOverlap('09:00', '10:00', '09:30', '10:30')).toBe(true)
    expect(timeRangesOverlap('09:00', '10:00', '08:30', '09:30')).toBe(true)
    expect(timeRangesOverlap('09:00', '10:00', '09:15', '09:45')).toBe(true)
  })

  it('treats back-to-back slots as non-overlapping', () => {
    expect(timeRangesOverlap('09:00', '10:00', '10:00', '11:00')).toBe(false)
    expect(timeRangesOverlap('10:00', '11:00', '09:00', '10:00')).toBe(false)
  })

  it('treats disjoint slots as non-overlapping', () => {
    expect(timeRangesOverlap('09:00', '10:00', '11:00', '12:00')).toBe(false)
  })
})
