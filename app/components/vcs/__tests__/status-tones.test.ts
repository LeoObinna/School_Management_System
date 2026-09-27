import { describe, expect, it } from 'vitest'
import {
  formatStatusLabel,
  normalizeStatus,
  statusTone,
} from '../status-tones'

describe('normalizeStatus', () => {
  it('lowercases and collapses whitespace, dashes and underscores', () => {
    expect(normalizeStatus('  Partially-Paid ')).toBe('partially_paid')
    expect(normalizeStatus('IN PROGRESS')).toBe('in_progress')
    expect(normalizeStatus('over_due')).toBe('over_due')
  })
})

describe('statusTone', () => {
  it('maps positive statuses to success', () => {
    for (const status of ['Active', 'approved', 'PAID', 'published', 'Present']) {
      expect(statusTone(status)).toBe('success')
    }
  })

  it('maps attention statuses to warning', () => {
    for (const status of ['Pending', 'draft', 'LATE', 'Partially Paid']) {
      expect(statusTone(status)).toBe('warning')
    }
  })

  it('maps negative statuses to danger', () => {
    for (const status of ['Overdue', 'ABSENT', 'rejected', 'failed']) {
      expect(statusTone(status)).toBe('danger')
    }
  })

  it('maps informational and inert statuses', () => {
    expect(statusTone('scheduled')).toBe('info')
    expect(statusTone('excused')).toBe('info')
    expect(statusTone('archived')).toBe('neutral')
    expect(statusTone('read')).toBe('neutral')
  })

  it('falls back to neutral for unknown statuses', () => {
    expect(statusTone('something-new')).toBe('neutral')
    expect(statusTone('')).toBe('neutral')
  })
})

describe('formatStatusLabel', () => {
  it('humanizes underscores and dashes without asserting casing', () => {
    expect(formatStatusLabel('partially_paid')).toBe('Partially Paid')
    expect(formatStatusLabel('in-progress')).toBe('In Progress')
    expect(formatStatusLabel('  paid ')).toBe('Paid')
  })
})
