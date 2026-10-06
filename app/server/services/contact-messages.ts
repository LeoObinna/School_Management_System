/**
 * Contact inbox services (Phase 18C).
 *
 * The public contact form persists submissions here (unauthenticated —
 * the route applies honeypot + IP rate limits). Staff triage the inbox
 * under the `contact_messages.view` permission: list, read, mark
 * read/archived. Messages are never exposed publicly; there is no
 * delete — archived rows are retained for the record.
 */
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { contactMessages } from '../../database/schema'
import type {
  ContactMessageCreate,
  ContactMessageListQuery,
} from '../../shared/schemas'
import type { ContactMessage, Paginated } from '../../shared/types'
import { smsNotFound } from '../utils/http-errors'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// ---------------------------------------------------------------------------
// Public create
// ---------------------------------------------------------------------------

/**
 * Persists a public contact-form submission. The honeypot field is
 * stripped before insert; callers must have already applied rate limits.
 */
export async function createContactMessage(
  input: ContactMessageCreate,
): Promise<string> {
  const client = await db()
  const { _website: _honeypot, ...values } = input
  const id = crypto.randomUUID()
  await client.insert(contactMessages).values({
    id,
    name: values.name,
    email: values.email,
    phone: values.phone || null,
    department: values.department || null,
    subject: values.subject,
    body: values.body,
  })
  return id
}

// ---------------------------------------------------------------------------
// Staff inbox
// ---------------------------------------------------------------------------

export async function listContactMessages(
  query: ContactMessageListQuery,
): Promise<Paginated<ContactMessage>> {
  const client = await db()
  const filter: SQL | undefined = query.status
    ? eq(contactMessages.status, query.status)
    : undefined

  const totalRows = await client
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(contactMessages)
    .where(filter)
  const total = Number(totalRows[0]?.n) || 0

  const rows = await client
    .select()
    .from(contactMessages)
    .where(and(...(filter ? [filter] : [])))
    .orderBy(desc(contactMessages.createdAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage)

  return {
    data: rows.map((r) => toJsonModel<ContactMessage>(r)),
    meta: {
      currentPage: query.page,
      perPage: query.perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / query.perPage)),
    },
  }
}

export async function getContactMessage(id: string): Promise<ContactMessage> {
  const client = await db()
  const [row] = await client
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1)
  if (!row) throw smsNotFound('Message not found.')
  return toJsonModel<ContactMessage>(row)
}

/**
 * Sets `read` (stamping readAt on first read) or `archived`. Archived
 * messages may be reopened to `read`; `new` cannot be set back.
 */
export async function updateContactMessageStatus(
  id: string,
  status: 'read' | 'archived',
): Promise<ContactMessage> {
  const client = await db()
  const existing = await getContactMessage(id)
  const readAt =
    status === 'read' ? (existing.readAt ?? new Date().toISOString()) : existing.readAt
  const [updated] = await client
    .update(contactMessages)
    .set({ status, readAt })
    .where(eq(contactMessages.id, id))
    .returning()
  if (!updated) throw smsNotFound('Message not found.')
  return toJsonModel<ContactMessage>(updated)
}
