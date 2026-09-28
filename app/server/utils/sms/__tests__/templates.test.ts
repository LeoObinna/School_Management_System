/**
 * Phase 17D: SMS template tests — every template must stay within one
 * 160-character SMS segment, even with long inputs.
 */
import { describe, expect, it } from 'vitest'
import {
  SMS_MAX_LENGTH,
  feeReminderSms,
  resultPublishedSms,
  truncateSms,
  urgentNoticeSms,
} from '../templates'

const SCHOOL = 'Victorious Children School'

describe('truncateSms', () => {
  it('passes short text through unchanged', () => {
    expect(truncateSms('hello')).toBe('hello')
  })

  it('truncates with an ellipsis at the limit', () => {
    const long = 'x'.repeat(200)
    const out = truncateSms(long)
    expect(out).toHaveLength(SMS_MAX_LENGTH)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('SMS templates', () => {
  it('urgentNoticeSms includes the title and stays within one segment', () => {
    const sms = urgentNoticeSms(SCHOOL, 'School closes early tomorrow')
    expect(sms).toContain('NOTICE')
    expect(sms).toContain('School closes early tomorrow')
    expect(sms.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })

  it('urgentNoticeSms truncates a very long title', () => {
    const sms = urgentNoticeSms(SCHOOL, 'A'.repeat(300))
    expect(sms.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })

  it('feeReminderSms includes count and total', () => {
    const sms = feeReminderSms(SCHOOL, 2, '₦7,500.00')
    expect(sms).toContain('2 invoice(s)')
    expect(sms).toContain('₦7,500.00')
    expect(sms.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })

  it('resultPublishedSms includes student and term', () => {
    const sms = resultPublishedSms(SCHOOL, 'Chidi Okafor', 'First Term')
    expect(sms).toContain('Chidi Okafor')
    expect(sms).toContain('First Term')
    expect(sms.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })
})
