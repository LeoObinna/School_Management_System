/**
 * Phase 18C public submissions + contact inbox tests.
 *
 * Covers:
 *  - schema boundaries (guardian-contact refine, honeypot bounded string,
 *    APP-number regex, contact-message create shape)
 *  - createPublicApplication (session pinning to current session, inactive
 *    class rejection, number-only response)
 *  - getPublicApplicationStatus (exact match + one contact factor, generic
 *    404 on any mismatch, case-insensitive email, no applicant data echoed)
 *  - contact message lifecycle (create strips honeypot, list status filter,
 *    get 404, mark-read stamps readAt once, archive keeps readAt)
 *
 * The DB mock is the same chainable-thenable FIFO pattern as the 18B
 * public-content tests, extended with insert/update chains. Drizzle query
 * order in the services is asserted by the queue order.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// FIFO queue of query results, one per awaited query the service issues.
let resultQueue: unknown[][] = []

vi.mock('../../utils/db', () => {
  const chainable = () => {
    // Lazily resolve so the queue is consumed at await/returning time, not
    // when db.update()/db.insert() is first invoked.
    const resolve = () => Promise.resolve(resultQueue.shift() ?? [])
    const chain: Record<string, unknown> = {}
    for (const method of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'innerJoin',
      'leftJoin',
      'groupBy',
      'values',
      'set',
      'onConflictDoNothing',
    ]) {
      chain[method] = () => chain
    }
    // returning() awaits to the next queued entry (an array of rows).
    chain.returning = resolve
    chain.then = (onFulfilled: unknown, onRejected: unknown) =>
      resolve().then(
        onFulfilled as never,
        onRejected as never,
      )
    chain.catch = (onRejected: unknown) => resolve().catch(onRejected as never)
    chain.finally = (onFinally: unknown) => resolve().finally(onFinally as never)
    return chain
  }
  return {
    db: {
      select: vi.fn().mockImplementation(() => chainable()),
      insert: vi.fn().mockImplementation(() => chainable()),
      update: vi.fn().mockImplementation(() => chainable()),
      delete: vi.fn().mockImplementation(() => chainable()),
    },
  }
})

import {
  createPublicApplication,
  getPublicApplicationStatus,
} from '../admissions'
import {
  createContactMessage,
  getContactMessage,
  listContactMessages,
  updateContactMessageStatus,
} from '../contact-messages'
import {
  admissionStatusQuerySchema,
  contactMessageCreateSchema,
  publicApplicationSchema,
  ADMISSION_STATUS_LABELS,
} from '../../../shared/schemas/public'
import { contactMessageStatusUpdateSchema } from '../../../shared/schemas/communication'
import {
  evaluateWindow,
  RATE_LIMIT_RULES,
} from '../../utils/auth/throttle'

const UUID_SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const UUID_CLASS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const UUID_APP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const UUID_MSG = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const VALID_APPLICATION = {
  firstName: 'Adaeze',
  lastName: 'Okafor',
  guardianName: 'Chinedu Okafor',
  guardianEmail: 'parent@example.com',
}

beforeEach(() => {
  resultQueue = []
})

// ---------------------------------------------------------------------------
// Schema boundaries
// ---------------------------------------------------------------------------

describe('public application schema (18C)', () => {
  it('requires at least one guardian contact channel', () => {
    const neither = publicApplicationSchema.safeParse({
      firstName: 'Adaeze',
      lastName: 'Okafor',
      guardianName: 'Chinedu Okafor',
    })
    expect(neither.success).toBe(false)

    const withPhone = publicApplicationSchema.safeParse({
      ...VALID_APPLICATION,
      guardianEmail: undefined,
      guardianPhone: '08031234567',
    })
    expect(withPhone.success).toBe(true)

    const withEmail = publicApplicationSchema.safeParse(VALID_APPLICATION)
    expect(withEmail.success).toBe(true)
  })

  it('treats the honeypot as an optional bounded string (never rejects)', () => {
    const filled = publicApplicationSchema.safeParse({
      ...VALID_APPLICATION,
      _website: 'https://spam.example',
    })
    // Schema accepts — the ROUTE silently discards. Bots must not see a 400.
    expect(filled.success).toBe(true)

    const overlong = publicApplicationSchema.safeParse({
      ...VALID_APPLICATION,
      _website: 'x'.repeat(201),
    })
    expect(overlong.success).toBe(false)
  })

  it('rejects non-uuid intendedClassId', () => {
    const bad = publicApplicationSchema.safeParse({
      ...VALID_APPLICATION,
      intendedClassId: 'Primary 1',
    })
    expect(bad.success).toBe(false)
  })
})

describe('admission status query schema (18C)', () => {
  it('accepts only the APP-YYYY-NNNN shape (case-insensitive)', () => {
    for (const applicationNumber of [
      'APP-2026-0001',
      'app-2026-9999',
      'APP-1999-1234',
    ]) {
      const parsed = admissionStatusQuerySchema.safeParse({
        applicationNumber,
        guardianEmail: 'parent@example.com',
      })
      expect(parsed.success).toBe(true)
    }
    for (const applicationNumber of [
      'APP-2026-1',
      'APP-26-0001',
      'APP-2026-00001',
      '2026-0001',
      'APP-ABCD-0001',
      "APP-2026-0001' OR '1'='1",
      '',
    ]) {
      const parsed = admissionStatusQuerySchema.safeParse({
        applicationNumber,
        guardianEmail: 'parent@example.com',
      })
      expect(parsed.success).toBe(false)
    }
  })

  it('requires one guardian contact factor', () => {
    const neither = admissionStatusQuerySchema.safeParse({
      applicationNumber: 'APP-2026-0001',
    })
    expect(neither.success).toBe(false)

    const phoneOnly = admissionStatusQuerySchema.safeParse({
      applicationNumber: 'APP-2026-0001',
      guardianPhone: '08031234567',
    })
    expect(phoneOnly.success).toBe(true)
  })
})

describe('contact message schemas (18C)', () => {
  it('accepts a complete submission and nullishes optional fields', () => {
    const parsed = contactMessageCreateSchema.safeParse({
      name: 'Mrs Bello',
      email: 'bello@example.com',
      phone: '08031234567',
      department: 'Admissions',
      subject: 'School tour',
      body: 'I would like to visit the school next week.',
      _website: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('bounds subject and body and requires a valid email', () => {
    const longSubject = contactMessageCreateSchema.safeParse({
      name: 'A',
      email: 'a@example.com',
      subject: 'x'.repeat(201),
      body: 'hello',
    })
    expect(longSubject.success).toBe(false)

    const badEmail = contactMessageCreateSchema.safeParse({
      name: 'A',
      email: 'not-an-email',
      subject: 'Hi',
      body: 'hello',
    })
    expect(badEmail.success).toBe(false)
  })

  it('staff status update excludes the initial new state', () => {
    expect(
      contactMessageStatusUpdateSchema.safeParse({ status: 'read' }).success,
    ).toBe(true)
    expect(
      contactMessageStatusUpdateSchema.safeParse({ status: 'archived' })
        .success,
    ).toBe(true)
    expect(
      contactMessageStatusUpdateSchema.safeParse({ status: 'new' }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Public application submission
// ---------------------------------------------------------------------------

/**
 * Queue order for createPublicApplication:
 *   1. current session select
 *   2. active-class check (only when intendedClassId is set)
 *   3. createApplication -> assertSession (only when sessionId set)
 *   4. createApplication -> assertClass (only when intendedClassId set)
 *   5. allocateNumber count
 *   6. insert (await) → []
 *   7-10. loadDetail: Promise.all([application, names, documents, assessments])
 */
function applicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_APP,
    applicationNumber: 'APP-2026-0001',
    firstName: 'Adaeze',
    lastName: 'Okafor',
    otherNames: null,
    gender: null,
    dateOfBirth: null,
    nationality: null,
    guardianName: 'Chinedu Okafor',
    guardianPhone: null,
    guardianEmail: 'parent@example.com',
    address: null,
    previousSchool: null,
    intendedClassId: null,
    sessionId: UUID_SESSION,
    status: 'applied',
    decisionNotes: null,
    reviewedById: null,
    reviewedAt: null,
    decidedAt: null,
    admittedStudentId: null,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
    ...overrides,
  }
}

describe('createPublicApplication (18C)', () => {
  it('pins the session to the current academic session and returns only the number', async () => {
    resultQueue = [
      [{ id: UUID_SESSION }], // 1. current session
      [{ id: UUID_SESSION }], // 3. assertSession
      [{ n: 0 }], // 5. allocateNumber
      [], // 6. insert
      [applicationRow()], // 7. loadDetail: application
      [{ sessionName: '2025/2026', className: null }], // 8. names
      [], // 9. documents
      [], // 10. assessments
    ]
    const number = await createPublicApplication(VALID_APPLICATION)
    expect(number).toBe('APP-2026-0001')
    // Number-only contract: the return value is a bare string.
    expect(typeof number).toBe('string')
  })

  it('continues with a null session when none is current', async () => {
    resultQueue = [
      [], // 1. no current session
      // 3. assertSession skipped (sessionId null)
      [{ n: 3 }], // 5. allocateNumber → APP-…-0004
      [], // 6. insert
      [applicationRow({ applicationNumber: 'APP-2026-0004', sessionId: null })],
      [{ sessionName: null, className: null }],
      [],
      [],
    ]
    const number = await createPublicApplication(VALID_APPLICATION)
    expect(number).toBe('APP-2026-0004')
  })

  it('rejects an inactive or unknown intended class', async () => {
    resultQueue = [
      [{ id: UUID_SESSION }], // 1. current session
      [], // 2. class check: not found / not active
    ]
    await expect(
      createPublicApplication({
        ...VALID_APPLICATION,
        intendedClassId: UUID_CLASS,
      }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('accepts an active intended class', async () => {
    resultQueue = [
      [{ id: UUID_SESSION }], // 1. current session
      [{ id: UUID_CLASS }], // 2. class active
      [{ id: UUID_SESSION }], // 3. assertSession
      [{ id: UUID_CLASS }], // 4. assertClass
      [{ n: 0 }], // 5. allocateNumber
      [], // 6. insert
      [applicationRow({ intendedClassId: UUID_CLASS })],
      [{ sessionName: '2025/2026', className: 'Primary 1' }],
      [],
      [],
    ]
    const number = await createPublicApplication({
      ...VALID_APPLICATION,
      intendedClassId: UUID_CLASS,
    })
    expect(number).toBe('APP-2026-0001')
  })
})

// ---------------------------------------------------------------------------
// Public status checker
// ---------------------------------------------------------------------------

describe('getPublicApplicationStatus (18C)', () => {
  it('matches on number + guardian email (case-insensitive both ways)', async () => {
    resultQueue = [[applicationRow({ status: 'under_review' })]]
    const status = await getPublicApplicationStatus({
      applicationNumber: 'app-2026-0001', // lowercase input, stored uppercase
      guardianEmail: 'PARENT@example.com',
    })
    expect(status).toEqual({
      applicationNumber: 'APP-2026-0001',
      status: 'under_review',
      statusLabel: 'Under review',
    })
    // Label-only contract: no applicant data leaks.
    expect(status).not.toHaveProperty('firstName')
    expect(status).not.toHaveProperty('guardianEmail')
    expect(status).not.toHaveProperty('decisionNotes')
  })

  it('matches on number + guardian phone', async () => {
    resultQueue = [[applicationRow({ guardianPhone: '08031234567' })]]
    const status = await getPublicApplicationStatus({
      applicationNumber: 'APP-2026-0001',
      guardianPhone: '08031234567',
    })
    expect(status.status).toBe('applied')
    expect(status.statusLabel).toBe(ADMISSION_STATUS_LABELS.applied)
  })

  it('answers the same generic 404 for unknown number, wrong factor and empty phone', async () => {
    // Unknown number
    resultQueue = [[]]
    await expect(
      getPublicApplicationStatus({
        applicationNumber: 'APP-2026-9999',
        guardianEmail: 'parent@example.com',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })

    // Wrong email
    resultQueue = [[applicationRow()]]
    await expect(
      getPublicApplicationStatus({
        applicationNumber: 'APP-2026-0001',
        guardianEmail: 'other@example.com',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })

    // Right number, empty-string phone must not match a null stored phone
    resultQueue = [[applicationRow()]]
    await expect(
      getPublicApplicationStatus({
        applicationNumber: 'APP-2026-0001',
        guardianPhone: '',
        guardianEmail: undefined,
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('accepts a match when EITHER factor matches even if the other does not', async () => {
    // Email matches, phone wrong → success (email OR phone).
    resultQueue = [[applicationRow({ guardianPhone: '08099999999' })]]
    const status = await getPublicApplicationStatus({
      applicationNumber: 'APP-2026-0001',
      guardianEmail: 'parent@example.com',
      guardianPhone: '08011111111',
    })
    expect(status.applicationNumber).toBe('APP-2026-0001')
  })
})

// ---------------------------------------------------------------------------
// Contact message lifecycle
// ---------------------------------------------------------------------------

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_MSG,
    name: 'Mrs Bello',
    email: 'bello@example.com',
    phone: null,
    department: 'Admissions',
    subject: 'School tour',
    body: 'I would like to visit the school next week.',
    status: 'new',
    createdAt: '2026-02-01T09:00:00.000Z',
    readAt: null,
    ...overrides,
  }
}

describe('contact message service (18C)', () => {
  it('create strips the honeypot and persists, returning the id', async () => {
    resultQueue = [[]] // insert await
    const id = await createContactMessage({
      name: 'Mrs Bello',
      email: 'bello@example.com',
      phone: null,
      department: 'Admissions',
      subject: 'School tour',
      body: 'I would like to visit the school next week.',
      _website: null,
    })
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('lists with pagination meta and an optional status filter', async () => {
    resultQueue = [
      [{ n: 2 }], // total
      [messageRow(), messageRow({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })],
    ]
    const page = await listContactMessages({
      page: 1,
      perPage: 20,
      order: 'desc',
    })
    expect(page.meta).toEqual({
      currentPage: 1,
      perPage: 20,
      total: 2,
      lastPage: 1,
    })
    expect(page.data).toHaveLength(2)
    expect(page.data[0]!.status).toBe('new')
  })

  it('get returns the message and 404s unknown ids', async () => {
    resultQueue = [[messageRow()]]
    const message = await getContactMessage(UUID_MSG)
    expect(message.subject).toBe('School tour')

    resultQueue = [[]]
    await expect(getContactMessage(UUID_MSG)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('marking read stamps readAt once and never clears it', async () => {
    // First read: readAt null → stamped.
    resultQueue = [
      [messageRow()], // getContactMessage
      [messageRow({ status: 'read', readAt: '2026-02-01T10:00:00.000Z' })], // update returning
    ]
    const first = await updateContactMessageStatus(UUID_MSG, 'read')
    expect(first.status).toBe('read')
    expect(first.readAt).toBe('2026-02-01T10:00:00.000Z')

    // Archive afterwards keeps the original readAt.
    resultQueue = [
      [messageRow({ status: 'read', readAt: '2026-02-01T10:00:00.000Z' })],
      [
        messageRow({
          status: 'archived',
          readAt: '2026-02-01T10:00:00.000Z',
        }),
      ],
    ]
    const archived = await updateContactMessageStatus(UUID_MSG, 'archived')
    expect(archived.status).toBe('archived')
    expect(archived.readAt).toBe('2026-02-01T10:00:00.000Z')
  })

  it('404s the status update for unknown messages', async () => {
    resultQueue = [[]] // getContactMessage → not found
    await expect(
      updateContactMessageStatus(UUID_MSG, 'read'),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ---------------------------------------------------------------------------
// Rate-limit window behaviour
// ---------------------------------------------------------------------------

describe('rate-limit windows (18C)', () => {
  const rule = RATE_LIMIT_RULES['public-contact']

  it('allows attempts until the window is full, then rejects until the oldest expires', () => {
    const now = 1_000_000
    // 3 attempts fit, 4th is blocked.
    let result = evaluateWindow([], rule, now)
    expect(result.allowed).toBe(true)
    result = evaluateWindow(result.recent, rule, now + 1000)
    expect(result.allowed).toBe(true)
    result = evaluateWindow(result.recent, rule, now + 2000)
    expect(result.allowed).toBe(true)
    result = evaluateWindow(result.recent, rule, now + 3000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)

    // After the window passes the oldest entry, one more attempt fits.
    result = evaluateWindow(result.recent, rule, now + rule.windowSeconds * 1000 + 1000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(rule.maxAttempts - result.recent.length)
  })

  it('filters out timestamps older than the window', () => {
    const now = 1_000_000
    const stamps = [now - rule.windowSeconds * 1000 - 1, now - 1000, now - 500]
    const result = evaluateWindow(stamps, rule, now)
    // Only the two recent stamps count; 3rd attempt is allowed.
    expect(result.allowed).toBe(true)
    expect(result.recent).toEqual([now - 1000, now - 500, now])
  })
})
