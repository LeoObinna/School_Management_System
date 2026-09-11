/**
 * Unit tests for the slug helper used when creating configurable
 * academic resources (sessions, terms, classes, sections, subjects).
 */
import { describe, it, expect } from 'vitest'
import { smsSlugify } from '../slug'

describe('smsSlugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(smsSlugify('JSS 1')).toBe('jss-1')
    expect(smsSlugify('First Term')).toBe('first-term')
  })

  it('turns slashes and other punctuation into single hyphens', () => {
    expect(smsSlugify('2026/2027')).toBe('2026-2027')
    expect(smsSlugify('Primary --- 1!!!')).toBe('primary-1')
  })

  it('trims leading and trailing hyphens', () => {
    expect(smsSlugify('  Nursery 1  ')).toBe('nursery-1')
    expect(smsSlugify('--- A ---')).toBe('a')
  })

  it('strips diacritics', () => {
    expect(smsSlugify('Café')).toBe('cafe')
  })

  it('caps the length at 90 characters', () => {
    expect(smsSlugify('x'.repeat(120)).length).toBe(90)
  })
})
