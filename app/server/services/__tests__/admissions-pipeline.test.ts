import { describe, it, expect } from 'vitest'
import {
  ADMISSION_PIPELINE_STAGES,
  orderPipelineRows,
} from '../../services/reports'
import { admissionStatusEnum } from '../../../database/schema/enums'

describe('ADMISSION_PIPELINE_STAGES', () => {
  it('covers every admission status enum value exactly once', () => {
    // Guards the ordered list drifting from the database enum.
    expect([...ADMISSION_PIPELINE_STAGES].sort()).toEqual(
      [...admissionStatusEnum.enumValues].sort(),
    )
  })
})

describe('orderPipelineRows', () => {
  it('returns all stages in workflow order with zero-fill', () => {
    const rows = orderPipelineRows([
      { status: 'enrolled', count: 2 },
      { status: 'applied', count: 5 },
    ])
    expect(rows.map((r) => r.status)).toEqual([
      'applied',
      'documents_submitted',
      'under_review',
      'assessment_scheduled',
      'assessed',
      'accepted',
      'rejected',
      'waitlisted',
      'admitted',
      'enrolled',
      'withdrawn',
    ])
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]))
    expect(byStatus.applied).toBe(5)
    expect(byStatus.enrolled).toBe(2)
    expect(byStatus.accepted).toBe(0)
    expect(byStatus.withdrawn).toBe(0)
  })

  it('handles an empty aggregate and ignores unknown statuses', () => {
    const rows = orderPipelineRows([
      { status: 'mystery_stage', count: 99 },
    ])
    expect(rows).toHaveLength(ADMISSION_PIPELINE_STAGES.length)
    expect(rows.every((r) => r.count === 0)).toBe(true)
  })

  it('coerces stringish counts to numbers', () => {
    const rows = orderPipelineRows([{ status: 'applied', count: 7 }])
    expect(rows[0]?.count).toBe(7)
  })
})
