/**
 * Unit tests for Phase 6 shared validation schemas.
 */
import { describe, it, expect } from 'vitest'
import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
  resourceCreateSchema,
  resourceUpdateSchema,
  submissionGradeSchema,
  submissionUpsertSchema,
} from '../schemas/assignments'

const uuid = '11111111-1111-4111-8111-111111111111'

const validAssignment = {
  classId: uuid,
  subjectId: uuid,
  sessionId: uuid,
  title: 'Homework 1',
}

describe('assignmentCreateSchema', () => {
  it('accepts a minimal valid assignment', () => {
    const result = assignmentCreateSchema.safeParse(validAssignment)
    expect(result.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const result = assignmentCreateSchema.safeParse({
      ...validAssignment,
      title: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('requires class/session/subject UUIDs', () => {
    const result = assignmentCreateSchema.safeParse({ title: 'X' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-ISO due date', () => {
    const result = assignmentCreateSchema.safeParse({
      ...validAssignment,
      dueDate: '25/09/2026',
    })
    expect(result.success).toBe(false)
  })

  it('accepts an ISO due date and null due date', () => {
    expect(
      assignmentCreateSchema.safeParse({
        ...validAssignment,
        dueDate: '2026-09-25T12:00:00Z',
      }).success,
    ).toBe(true)
    expect(
      assignmentCreateSchema.safeParse({
        ...validAssignment,
        dueDate: null,
      }).success,
    ).toBe(true)
  })

  it('coerces numeric maxScore within bounds', () => {
    const result = assignmentCreateSchema.safeParse({
      ...validAssignment,
      maxScore: '50',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxScore).toBe(50)
    }
  })

  it('rejects zero or negative maxScore', () => {
    expect(
      assignmentCreateSchema.safeParse({ ...validAssignment, maxScore: 0 })
        .success,
    ).toBe(false)
  })

  it('only allows known publication statuses', () => {
    expect(
      assignmentCreateSchema.safeParse({
        ...validAssignment,
        status: 'withdrawn',
      }).success,
    ).toBe(false)
  })
})

describe('assignmentUpdateSchema', () => {
  it('rejects an empty patch', () => {
    expect(assignmentUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a partial patch', () => {
    const result = assignmentUpdateSchema.safeParse({
      title: 'New title',
      status: 'archived',
    })
    expect(result.success).toBe(true)
  })
})

describe('submissionUpsertSchema', () => {
  it('requires at least one field', () => {
    expect(submissionUpsertSchema.safeParse({}).success).toBe(false)
  })
  it('accepts text-only and remove-only updates', () => {
    expect(
      submissionUpsertSchema.safeParse({ textContent: 'hello' }).success,
    ).toBe(true)
    expect(
      submissionUpsertSchema.safeParse({ removeFile: true }).success,
    ).toBe(true)
  })
})

describe('submissionGradeSchema', () => {
  it('requires a non-negative integer score', () => {
    expect(submissionGradeSchema.safeParse({ score: 12 }).success).toBe(true)
    expect(submissionGradeSchema.safeParse({ score: -1 }).success).toBe(false)
    expect(
      submissionGradeSchema.safeParse({ score: 'abc' }).success,
    ).toBe(false)
  })
  it('accepts optional feedback and returned status', () => {
    expect(
      submissionGradeSchema.safeParse({
        score: 5,
        feedback: 'Good',
        status: 'returned',
      }).success,
    ).toBe(true)
  })
})

describe('resource schemas', () => {
  it('requires stored-file metadata on create', () => {
    expect(
      resourceCreateSchema.safeParse({ title: 'Notes' }).success,
    ).toBe(false)
    expect(
      resourceCreateSchema.safeParse({
        title: 'Notes',
        objectKey: 'resources/x.pdf',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
      }).success,
    ).toBe(true)
  })

  it('rejects an empty resource update', () => {
    expect(resourceUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('allows toggling publication state', () => {
    expect(
      resourceUpdateSchema.safeParse({ isPublished: false }).success,
    ).toBe(true)
  })
})
