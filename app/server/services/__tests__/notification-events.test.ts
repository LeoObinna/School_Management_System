/**
 * Phase 17C: event-driven notification dispatcher tests.
 *
 * Covers the result.published / payment.verified queue kinds and the
 * daily fee-reminder fan-out. The DB layer is mocked with queued result
 * sets (select/get/all consumed in call order, inserts captured); the
 * Resend client is mocked so no network call happens.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'

const sendEmailMock = vi.fn(async (_apiKey: string, _msg: {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
}) => ({ id: 'provider-msg-1' }))
vi.mock('../../utils/email/resend-client', () => ({
  sendEmail: (apiKey: string, msg: {
    from: string
    to: string[]
    subject: string
    html: string
    text: string
  }) => sendEmailMock(apiKey, msg),
}))

const sendSmsMock = vi.fn(async (_apiKey: string, _msg: {
  to: string
  from: string
  text: string
}) => ({ id: 'sms-1' }))
vi.mock('../../utils/sms/termii-client', () => ({
  sendSms: (apiKey: string, msg: { to: string; from: string; text: string }) =>
    sendSmsMock(apiKey, msg),
}))

// ---------------------------------------------------------------------------
// Mock DB client
// ---------------------------------------------------------------------------

let selectQueue: unknown[][] = []
let allQueue: unknown[][] = []
let getQueue: unknown[] = []
const inserted: Record<string, unknown>[] = []

function makeClient() {
  const client = {
    select: vi.fn(() => {
      const rows = selectQueue.shift() ?? []
      const chain: Record<string, unknown> = {}
      chain.from = vi.fn(() => chain)
      chain.where = vi.fn(() => chain)
      chain.limit = vi.fn(() => Promise.resolve(rows))
      chain.then = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(rows).then(onFulfilled)
      return chain
    }),
    all: vi.fn(async () => allQueue.shift() ?? []),
    get: vi.fn(async () => getQueue.shift()),
    insert: vi.fn(() => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v)
        return Promise.resolve()
      },
    })),
  }
  return client
}

// Renders a drizzle sql`...` object to { text, params } for assertions.
function renderSql(sqlObj: {
  queryChunks: unknown[]
}): { text: string; params: unknown[] } {
  const params: unknown[] = []
  const walk = (chunks: unknown[]): string =>
    chunks
      .map((chunk) => {
        if (Array.isArray(chunk)) {
          return (chunk as unknown[]).map((c) => String(c)).join('')
        }
        if (chunk && typeof chunk === 'object') {
          const c = chunk as Record<string, unknown>
          if (Array.isArray(c.value)) {
            return (c.value as unknown[]).map((v) => String(v)).join('')
          }
          if ('queryChunks' in c) {
            return walk(c.queryChunks as unknown[])
          }
        }
        params.push(chunk)
        return '?'
      })
      .join('')
  return { text: walk(sqlObj.queryChunks), params }
}

import {
  dispatchFeeReminders,
  dispatchMessage,
  dispatchPaymentVerified,
  dispatchResultPublished,
  parseQueueMessage,
  type ProviderConfig,
} from '../notification-dispatch'

const config: ProviderConfig = {
  resend: { apiKey: 're_test', fromEmail: 'noreply@school.test' },
  branding: {
    schoolName: 'Victorious Children School',
    motto: null,
    primaryColor: '#1a237e',
    logoUrl: null,
  },
}

/** 17D: config with the Termii SMS gateway enabled. */
const smsConfig: ProviderConfig = {
  ...config,
  termii: { apiKey: 'tm_test', senderId: 'VCS' },
}

const publicationRow = {
  sessionId: 'ses-1',
  termId: 'term-1',
  classId: 'cls-1',
  sectionId: null,
  status: 'published',
}

const parentA = {
  userId: 'u-1',
  email: 'ada@example.com',
  parentFirstName: 'Ada',
  parentLastName: 'Okafor',
  studentId: 'stu-1',
  studentFirstName: 'Chidi',
  studentLastName: 'Okafor',
  prefAllows: 1,
}
const parentB = {
  userId: 'u-2',
  email: 'bola@example.com',
  parentFirstName: 'Bola',
  parentLastName: 'Ade',
  studentId: 'stu-1',
  studentFirstName: 'Chidi',
  studentLastName: 'Okafor',
  prefAllows: 0,
}

beforeEach(() => {
  selectQueue = []
  allQueue = []
  getQueue = []
  inserted.length = 0
  sendEmailMock.mockClear()
  sendSmsMock.mockClear()
})

// ---------------------------------------------------------------------------
// Message contract
// ---------------------------------------------------------------------------

describe('parseQueueMessage (17C kinds)', () => {
  it('accepts result.published and payment.verified', () => {
    const resultMsg = {
      kind: 'result.published',
      publicationId: '11111111-1111-4111-8111-111111111111',
    }
    const paymentMsg = {
      kind: 'payment.verified',
      paymentId: '22222222-2222-4222-8222-222222222222',
    }
    expect(parseQueueMessage(resultMsg)).toEqual(resultMsg)
    expect(parseQueueMessage(JSON.stringify(paymentMsg))).toEqual(paymentMsg)
  })

  it('rejects malformed ids on the new kinds', () => {
    expect(() =>
      parseQueueMessage({ kind: 'result.published', publicationId: 'nope' }),
    ).toThrow(z.ZodError)
    expect(() =>
      parseQueueMessage({ kind: 'payment.verified' }),
    ).toThrow(z.ZodError)
  })
})

// ---------------------------------------------------------------------------
// dispatchResultPublished
// ---------------------------------------------------------------------------

describe('dispatchResultPublished', () => {
  it('throws 404 when the publication does not exist', async () => {
    const client = makeClient()
    selectQueue.push([]) // publication lookup
    await expect(
      dispatchResultPublished(client as never, 'pub-1', config),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('is a no-op when the publication is not published', async () => {
    const client = makeClient()
    selectQueue.push([{ ...publicationRow, status: 'approved' }])
    await expect(
      dispatchResultPublished(client as never, 'pub-1', config),
    ).resolves.toBe(0)
    expect(inserted).toHaveLength(0)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('fans out in-app rows to all parents and emails only opted-in ones', async () => {
    const client = makeClient()
    selectQueue.push([publicationRow]) // publication
    selectQueue.push([{ name: 'Primary 4' }]) // class
    selectQueue.push([{ name: 'First Term' }]) // term
    allQueue.push([parentA, parentB]) // recipients
    selectQueue.push([]) // dedupe: parent A notification
    selectQueue.push([]) // delivery idempotency: parent A email
    selectQueue.push([]) // dedupe: parent B notification

    const count = await dispatchResultPublished(client as never, 'pub-1', config)
    expect(count).toBe(2)

    const notifInserts = inserted.filter((r) => r.type === 'result_published')
    expect(notifInserts).toHaveLength(2)
    expect(notifInserts[0]).toMatchObject({
      userId: 'u-1',
      status: 'unread',
    })
    expect(String(notifInserts[0]!.title)).toContain('Chidi Okafor')
    expect(String(notifInserts[0]!.link)).toContain('publication=pub-1')

    // Only parent A (prefAllows=1) gets the email.
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [, emailMsg] = sendEmailMock.mock.calls[0] as unknown as [
      string,
      { to: string[]; subject: string },
    ]
    expect(emailMsg.to).toEqual(['ada@example.com'])
    expect(emailMsg.subject).toContain('Chidi Okafor')

    const deliveryInserts = inserted.filter((r) => r.channel === 'email')
    expect(deliveryInserts).toHaveLength(1)
    expect(deliveryInserts[0]).toMatchObject({
      provider: 'resend',
      status: 'sent',
    })
  })

  it('targets enrollments by session/term/class and skips redelivered rows', async () => {
    const client = makeClient()
    selectQueue.push([{ ...publicationRow, sectionId: 'sec-9' }])
    selectQueue.push([{ name: 'Primary 4' }])
    selectQueue.push([{ name: 'First Term' }])
    allQueue.push([parentA])
    selectQueue.push([{ id: 'n-existing' }]) // dedupe hit → skip entirely

    const count = await dispatchResultPublished(client as never, 'pub-1', config)
    expect(count).toBe(0)
    expect(inserted).toHaveLength(0)
    expect(sendEmailMock).not.toHaveBeenCalled()

    const recipientSql = renderSql(
      (client.all.mock.calls[0] as unknown[])[0] as {
        queryChunks: unknown[]
      },
    )
    expect(recipientSql.text).toContain('student_enrollments')
    expect(recipientSql.text).toContain('e.section_id')
    expect(recipientSql.params).toEqual(
      expect.arrayContaining(['ses-1', 'term-1', 'cls-1', 'sec-9']),
    )
  })
})

// ---------------------------------------------------------------------------
// dispatchPaymentVerified
// ---------------------------------------------------------------------------

describe('dispatchPaymentVerified', () => {
  const paymentRow = {
    id: 'pay-1',
    status: 'verified',
    amount: 15_000_000,
    paymentReference: 'PAY-00001',
    invoiceNumber: 'INV-001',
    studentId: 'stu-1',
    studentFirstName: 'Chidi',
    studentLastName: 'Okafor',
    receiptNumber: 'RCT-0001',
  }

  it('throws 404 when the payment does not exist', async () => {
    const client = makeClient()
    getQueue.push(undefined)
    await expect(
      dispatchPaymentVerified(client as never, 'pay-x', config),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('is a no-op when the payment is not verified', async () => {
    const client = makeClient()
    getQueue.push({ ...paymentRow, status: 'pending' })
    await expect(
      dispatchPaymentVerified(client as never, 'pay-1', config),
    ).resolves.toBe(0)
    expect(inserted).toHaveLength(0)
  })

  it('notifies parents with the receipt number and formatted amount', async () => {
    const client = makeClient()
    getQueue.push(paymentRow)
    allQueue.push([
      {
        userId: 'u-1',
        email: 'ada@example.com',
        parentFirstName: 'Ada',
        parentLastName: 'Okafor',
        prefAllows: 1,
      },
    ])
    selectQueue.push([]) // notification dedupe
    selectQueue.push([]) // delivery idempotency

    const count = await dispatchPaymentVerified(client as never, 'pay-1', config)
    expect(count).toBe(1)

    const notif = inserted.find((r) => r.type === 'payment_receipt')
    expect(notif).toBeDefined()
    expect(String(notif!.title)).toContain('RCT-0001')
    expect(String(notif!.body)).toMatch(/150,000/)
    expect(String(notif!.body)).toContain('INV-001')
    expect(String(notif!.link)).toContain('payment=pay-1')

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [, emailMsg] = sendEmailMock.mock.calls[0] as unknown as [
      string,
      { subject: string },
    ]
    expect(emailMsg.subject).toContain('RCT-0001')
  })

  it('falls back to the payment reference when no receipt row exists', async () => {
    const client = makeClient()
    getQueue.push({ ...paymentRow, receiptNumber: null })
    allQueue.push([
      {
        userId: 'u-1',
        email: 'ada@example.com',
        parentFirstName: 'Ada',
        parentLastName: 'Okafor',
        prefAllows: 0, // in-app only; keeps the delivery flow out of scope
      },
    ])
    selectQueue.push([]) // notification dedupe

    const count = await dispatchPaymentVerified(client as never, 'pay-1', config)
    expect(count).toBe(1)
    const notif = inserted.find((r) => r.type === 'payment_receipt')
    expect(String(notif!.title)).toContain('PAY-00001')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// dispatchFeeReminders
// ---------------------------------------------------------------------------

describe('dispatchFeeReminders', () => {
  const overdueA1 = {
    invoiceNumber: 'INV-001',
    balance: 500_000,
    dueDate: '2026-09-01',
    studentFirstName: 'Chidi',
    studentLastName: 'Okafor',
    userId: 'u-1',
    email: 'ada@example.com',
    parentFirstName: 'Ada',
    parentLastName: 'Okafor',
    prefAllows: 1,
  }
  const overdueA2 = {
    ...overdueA1,
    invoiceNumber: 'INV-002',
    balance: 250_000,
    dueDate: '2026-09-10',
    studentFirstName: 'Ngozi',
  }
  const overdueB = {
    ...overdueA1,
    invoiceNumber: 'INV-003',
    userId: 'u-2',
    email: 'bola@example.com',
    prefAllows: 0,
  }

  it('consolidates per parent and emails only opted-in parents', async () => {
    const client = makeClient()
    allQueue.push([overdueA1, overdueA2, overdueB])
    selectQueue.push([]) // dedupe u-1
    selectQueue.push([]) // delivery idempotency u-1
    selectQueue.push([]) // dedupe u-2

    const result = await dispatchFeeReminders(
      client as never,
      config,
      '2026-09-28',
    )
    expect(result).toEqual({ parentsNotified: 2, emailsSent: 1 })

    const notifs = inserted.filter((r) => r.type === 'fee_reminder')
    expect(notifs).toHaveLength(2)
    const notifA = notifs.find((r) => r.userId === 'u-1')!
    expect(String(notifA.body)).toContain('2 invoice(s)')
    expect(String(notifA.body)).toMatch(/7,500/)
    expect(String(notifA.link)).toContain('reminder=2026-09-28')

    const [, emailMsg] = sendEmailMock.mock.calls[0] as unknown as [
      string,
      { to: string[]; html: string },
    ]
    expect(emailMsg.to).toEqual(['ada@example.com'])
    expect(emailMsg.html).toContain('INV-001')
    expect(emailMsg.html).toContain('INV-002')
    expect(emailMsg.html).not.toContain('INV-003')
  })

  it('skips parents already reminded today (idempotent re-run)', async () => {
    const client = makeClient()
    allQueue.push([overdueA1])
    selectQueue.push([{ id: 'n-existing' }]) // dedupe hit

    const result = await dispatchFeeReminders(
      client as never,
      config,
      '2026-09-28',
    )
    expect(result).toEqual({ parentsNotified: 0, emailsSent: 0 })
    expect(inserted).toHaveLength(0)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('queries only overdue, unpaid invoices', async () => {
    const client = makeClient()
    allQueue.push([])
    const result = await dispatchFeeReminders(
      client as never,
      config,
      '2026-09-28',
    )
    expect(result).toEqual({ parentsNotified: 0, emailsSent: 0 })

    const query = renderSql(
      (client.all.mock.calls[0] as unknown[])[0] as {
        queryChunks: unknown[]
      },
    )
    expect(query.text).toContain('student_invoices')
    expect(query.text).toContain('i.balance > 0')
    expect(query.text).toContain('i.due_date <')
    expect(query.text).toContain('partially_paid')
    expect(query.params).toEqual(['2026-09-28'])
  })
})

// ---------------------------------------------------------------------------
// dispatchMessage routing
// ---------------------------------------------------------------------------

describe('dispatchMessage (17C routing)', () => {
  it('routes result.published to its dispatcher (404 on unknown id)', async () => {
    const client = makeClient()
    selectQueue.push([]) // publication lookup misses
    await expect(
      dispatchMessage(client as never, {
        kind: 'result.published',
        publicationId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('routes payment.verified to its dispatcher (404 on unknown id)', async () => {
    const client = makeClient()
    getQueue.push(undefined)
    await expect(
      dispatchMessage(client as never, {
        kind: 'payment.verified',
        paymentId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ---------------------------------------------------------------------------
// SMS dispatch (17D)
// ---------------------------------------------------------------------------

describe('sms.send dispatch (17D)', () => {
  const smsMessage = {
    kind: 'sms.send' as const,
    to: '2348012345678',
    text: 'Test notice',
    notificationId: '33333333-3333-4333-8333-333333333333',
  }

  it('accepts a valid sms.send message and rejects bad ones', () => {
    expect(parseQueueMessage(smsMessage)).toEqual(smsMessage)
    expect(() =>
      parseQueueMessage({ kind: 'sms.send', to: 'x', text: '' }),
    ).toThrow(z.ZodError)
  })

  it('sends via Termii and records a sent delivery', async () => {
    const client = makeClient()
    selectQueue.push([]) // delivery idempotency check
    const count = await dispatchMessage(client as never, smsMessage, smsConfig)
    expect(count).toBe(1)
    expect(sendSmsMock).toHaveBeenCalledTimes(1)
    const [, smsInput] = sendSmsMock.mock.calls[0] as unknown as [
      string,
      { to: string; from: string; text: string },
    ]
    expect(smsInput).toEqual({
      to: '2348012345678',
      from: 'VCS',
      text: 'Test notice',
    })
    const delivery = inserted.find((r) => r.channel === 'sms')
    expect(delivery).toMatchObject({
      provider: 'termii',
      status: 'sent',
      recipientAddress: '2348012345678',
    })
  })

  it('records a failed delivery without throwing when Termii is unconfigured', async () => {
    const client = makeClient()
    const count = await dispatchMessage(client as never, {
      ...smsMessage,
      notificationId: undefined,
    }, {})
    expect(count).toBe(0)
    expect(sendSmsMock).not.toHaveBeenCalled()
    const delivery = inserted.find((r) => r.channel === 'sms')
    expect(delivery).toMatchObject({ provider: 'termii', status: 'failed' })
  })
})

describe('SMS fan-out on events (17D)', () => {
  it('result published sends SMS to urgent-opted-in parents with a phone', async () => {
    const client = makeClient()
    selectQueue.push([publicationRow])
    selectQueue.push([{ name: 'Primary 4' }])
    selectQueue.push([{ name: 'First Term' }])
    allQueue.push([
      {
        userId: 'u-3',
        email: null,
        phone: '2348012345678',
        parentFirstName: 'Ada',
        parentLastName: 'Okafor',
        studentId: 'stu-1',
        studentFirstName: 'Chidi',
        studentLastName: 'Okafor',
        prefAllows: 0, // no email — SMS only
        urgentSmsAllows: 1,
      },
    ])
    selectQueue.push([]) // notification dedupe
    selectQueue.push([]) // SMS delivery idempotency

    const count = await dispatchResultPublished(
      client as never,
      'pub-1',
      smsConfig,
    )
    expect(count).toBe(1)
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(sendSmsMock).toHaveBeenCalledTimes(1)
    const [, smsInput] = sendSmsMock.mock.calls[0] as unknown as [
      string,
      { to: string; text: string },
    ]
    expect(smsInput.to).toBe('2348012345678')
    expect(smsInput.text).toContain('Chidi Okafor')
    expect(smsInput.text.length).toBeLessThanOrEqual(160)
  })

  it('result published skips SMS when urgent_sms is opted out', async () => {
    const client = makeClient()
    selectQueue.push([publicationRow])
    selectQueue.push([{ name: 'Primary 4' }])
    selectQueue.push([{ name: 'First Term' }])
    allQueue.push([
      {
        ...parentA,
        phone: '2348012345678',
        urgentSmsAllows: 0,
      },
    ])
    selectQueue.push([]) // notification dedupe
    selectQueue.push([]) // email delivery idempotency

    await dispatchResultPublished(client as never, 'pub-1', smsConfig)
    expect(sendSmsMock).not.toHaveBeenCalled()
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('fee reminders send one consolidated SMS per parent', async () => {
    const client = makeClient()
    allQueue.push([
      {
        invoiceNumber: 'INV-001',
        balance: 500_000,
        dueDate: '2026-09-01',
        studentFirstName: 'Chidi',
        studentLastName: 'Okafor',
        userId: 'u-1',
        email: null,
        phone: '2348012345678',
        parentFirstName: 'Ada',
        parentLastName: 'Okafor',
        prefAllows: 0,
        urgentSmsAllows: 1,
      },
    ])
    selectQueue.push([]) // notification dedupe
    selectQueue.push([]) // SMS delivery idempotency

    const result = await dispatchFeeReminders(
      client as never,
      smsConfig,
      '2026-09-28',
    )
    expect(result).toEqual({ parentsNotified: 1, emailsSent: 0 })
    expect(sendSmsMock).toHaveBeenCalledTimes(1)
    const [, smsInput] = sendSmsMock.mock.calls[0] as unknown as [
      string,
      { text: string },
    ]
    expect(smsInput.text).toContain('1 invoice(s)')
    expect(smsInput.text).toMatch(/5,000/)
  })
})
