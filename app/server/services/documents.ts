/**
 * Staff document library services (README §23, Phase 14B).
 *
 * Documents are R2 objects with D1 metadata. Admins see everything;
 * other staff (teachers) only see documents with visibility 'staff'.
 * Routes own the R2 byte transfer and purge returned object keys on
 * delete. Visibility is enforced in both list and single-read paths so
 * a teacher cannot guess an admin-only document id.
 */
import { and, asc, desc, eq, like, or, type SQL } from 'drizzle-orm'
import { documents, users } from '../../database/schema'
import type {
  DocumentCreate,
  DocumentListQuery,
  DocumentUpdate,
} from '../../shared/schemas'
import type { DocumentAccess, DocumentListItem } from '../../shared/types'
import { smsForbidden, smsNotFound } from '../utils/http-errors'
import type { ActorProfile } from '../utils/auth/actor'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

function listSelect(client: SmsDb) {
  return client
    .select({
      document: documents,
      createdByName: users.name,
    })
    .from(documents)
    .leftJoin(users, eq(documents.createdById, users.id))
}

function visibilityWhere(actor: ActorProfile): SQL | undefined {
  // Admins (super_admin or admin) bypass the visibility filter.
  if (actor.isAdmin) return undefined
  return eq(documents.visibility, 'staff')
}

export async function listDocuments(
  query: DocumentListQuery,
  actor: ActorProfile,
): Promise<{ data: DocumentListItem[] }> {
  const client = await db()
  const where: SQL[] = []

  const vis = visibilityWhere(actor)
  if (vis) where.push(vis)

  if (query.ownerType) where.push(eq(documents.ownerType, query.ownerType))
  if (query.ownerId) where.push(eq(documents.ownerId, query.ownerId))
  if (query.category) where.push(eq(documents.category, query.category))
  if (query.visibility) {
    // A non-admin requesting 'admin' visibility would get nothing; still
    // apply it (the caller gets an empty list, not a leak).
    if (!actor.isAdmin && query.visibility === 'admin') {
      return { data: [] }
    }
    where.push(eq(documents.visibility, query.visibility))
  }
  if (query.search) {
    const term = `%${query.search}%`
    where.push(
      or(like(documents.title, term), like(documents.description, term))!,
    )
  }

  const rows = await listSelect(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(documents.createdAt), asc(documents.title))

  return {
    data: rows.map((row) =>
      toJsonModel<DocumentListItem>({
        ...row.document,
        createdByName: row.createdByName,
      }),
    ),
  }
}

export async function getDocumentForActor(
  id: string,
  actor: ActorProfile,
): Promise<DocumentAccess> {
  const client = await db()
  const [row] = await listSelect(client)
    .where(eq(documents.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Document not found.')
  }
  if (!actor.isAdmin && row.document.visibility === 'admin') {
    // Surface as 404 (not 403) to avoid leaking existence.
    throw smsNotFound('Document not found.')
  }
  return {
    document: toJsonModel(row.document),
    objectKey: row.document.objectKey,
  }
}

export async function createDocument(
  input: DocumentCreate,
  actor: ActorProfile,
): Promise<DocumentListItem> {
  const client = await db()
  if (!actor.isAdmin) {
    throw smsForbidden()
  }
  const [created] = await client
    .insert(documents)
    .values({
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      visibility: input.visibility,
      ownerType: input.ownerType,
      ownerId: input.ownerId ?? null,
      objectKey: input.objectKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdById: actor.userId,
    })
    .returning({ id: documents.id })
  if (!created) {
    throw smsNotFound('Document could not be saved.')
  }
  const [row] = await listSelect(client)
    .where(eq(documents.id, created.id))
    .limit(1)
  return toJsonModel<DocumentListItem>({
    ...row!.document,
    createdByName: row!.createdByName,
  })
}

export async function updateDocument(
  id: string,
  input: DocumentUpdate,
  actor: ActorProfile,
): Promise<DocumentListItem> {
  const client = await db()
  if (!actor.isAdmin) {
    throw smsForbidden()
  }
  const [existing] = await listSelect(client)
    .where(eq(documents.id, id))
    .limit(1)
  if (!existing) {
    throw smsNotFound('Document not found.')
  }
  const values: Record<string, unknown> = {}
  if (input.title !== undefined) values.title = input.title
  if (input.description !== undefined) values.description = input.description
  if (input.category !== undefined) values.category = input.category
  if (input.visibility !== undefined) values.visibility = input.visibility
  values.updatedAt = new Date().toISOString()

  await client
    .update(documents)
    .set(values)
    .where(eq(documents.id, id))

  const [row] = await listSelect(client)
    .where(eq(documents.id, id))
    .limit(1)
  return toJsonModel<DocumentListItem>({
    ...row!.document,
    createdByName: row!.createdByName,
  })
}

/** Deletes metadata; caller purges the returned R2 object key. */
export async function deleteDocument(
  id: string,
  actor: ActorProfile,
): Promise<string> {
  const client = await db()
  if (!actor.isAdmin) {
    throw smsForbidden()
  }
  const [row] = await client
    .delete(documents)
    .where(eq(documents.id, id))
    .returning({ objectKey: documents.objectKey })
  if (!row) {
    throw smsNotFound('Document not found.')
  }
  return row.objectKey
}
