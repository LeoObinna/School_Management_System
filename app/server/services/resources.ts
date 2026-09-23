/**
 * Learning resource library services (README §17, Phase 6).
 *
 * Resources are R2 objects with PostgreSQL metadata. Staff
 * (resources.manage) upload/see everything; students see only published
 * resources that are school-wide or target a class they are enrolled
 * in. Routes own the R2 byte transfer and purge returned object keys.
 */
import { and, asc, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm'
import {
  classes,
  learningResources,
  studentEnrollments,
  subjects,
  teachers,
} from '../../database/schema'
import type {
  ResourceCreate,
  ResourceListQuery,
  ResourceUpdate,
} from '../../shared/schemas'
import type {
  LearningResource,
  LearningResourceListItem,
} from '../../shared/types'
import {
  isForeignKeyViolation,
  smsFieldError,
  smsForbidden,
  smsNotFound,
} from '../utils/http-errors'
import type { ActorProfile } from '../utils/auth/actor'
import type { SmsDb } from '../utils/pagination'
import { toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

function listSelect(client: SmsDb) {
  return client
    .select({
      resource: learningResources,
      className: classes.name,
      subjectName: subjects.name,
      uploadedByName: sql<string>`trim(${teachers.firstName} || ' ' || ${teachers.lastName})`,
    })
    .from(learningResources)
    .leftJoin(classes, eq(learningResources.classId, classes.id))
    .leftJoin(subjects, eq(learningResources.subjectId, subjects.id))
    .leftJoin(teachers, eq(learningResources.uploadedById, teachers.id))
}

export async function listResources(
  query: ResourceListQuery,
  actor: ActorProfile,
): Promise<{ data: LearningResourceListItem[] }> {
  const client = await db()
  const where: SQL[] = []
  if (query.classId) {
    where.push(eq(learningResources.classId, query.classId))
  }
  if (query.subjectId) {
    where.push(eq(learningResources.subjectId, query.subjectId))
  }

  if (!actor.isStaff) {
    where.push(eq(learningResources.isPublished, true))
    if (actor.studentId) {
      where.push(
        or(
          isNull(learningResources.classId),
          sql`exists (
            select 1 from ${studentEnrollments}
            where ${studentEnrollments.studentId} = ${actor.studentId}
              and ${studentEnrollments.status} = 'active'
              and ${studentEnrollments.classId} = ${learningResources.classId}
          )`,
        )!,
      )
    } else {
      where.push(isNull(learningResources.classId))
    }
  }

  const rows = await listSelect(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(learningResources.createdAt), asc(learningResources.title))

  return {
    data: rows.map((row) =>
      toJsonModel<LearningResourceListItem>({
        ...row.resource,
        className: row.className,
        subjectName: row.subjectName,
        uploadedByName: row.uploadedByName,
      }),
    ),
  }
}

export interface ResourceAccess {
  resource: LearningResource
  objectKey: string
}

export async function getResourceForActor(
  id: string,
  actor: ActorProfile,
): Promise<ResourceAccess> {
  const client = await db()
  const [row] = await listSelect(client)
    .where(eq(learningResources.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Resource not found.')
  }
  if (!actor.isStaff) {
    if (!row.resource.isPublished) {
      throw smsNotFound('Resource not found.')
    }
    if (row.resource.classId && actor.studentId) {
      const [enrolled] = await client
        .select({ marker: sql`1` })
        .from(studentEnrollments)
        .where(
          and(
            eq(studentEnrollments.studentId, actor.studentId),
            eq(studentEnrollments.classId, row.resource.classId),
            eq(studentEnrollments.status, 'active'),
          ),
        )
        .limit(1)
      if (!enrolled) {
        throw smsNotFound('Resource not found.')
      }
    } else if (row.resource.classId) {
      throw smsNotFound('Resource not found.')
    }
  }
  return {
    resource: toJsonModel<LearningResource>(row.resource),
    objectKey: row.resource.objectKey,
  }
}

export async function createResource(
  input: ResourceCreate,
  actor: ActorProfile,
): Promise<LearningResourceListItem> {
  const client = await db()
  if (!actor.isStaff) {
    throw smsForbidden()
  }
  await validateOptionalRefs(client, input)
  try {
    const [created] = await client
      .insert(learningResources)
      .values({
        title: input.title,
        description: input.description ?? null,
        classId: input.classId ?? null,
        subjectId: input.subjectId ?? null,
        uploadedById: actor.teacherId,
        objectKey: input.objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        isPublished: input.isPublished ?? true,
      })
      .returning({ id: learningResources.id })
    if (!created) {
      throw smsFieldError('form', 'Resource could not be saved.')
    }
    const [row] = await listSelect(client)
      .where(eq(learningResources.id, created.id))
      .limit(1)
    return toJsonModel<LearningResourceListItem>({
      ...row!.resource,
      className: row!.className,
      subjectName: row!.subjectName,
      uploadedByName: row!.uploadedByName,
    })
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      throw smsFieldError('form', 'Referenced class or subject does not exist.')
    }
    throw e
  }
}

export async function updateResource(
  id: string,
  input: ResourceUpdate,
  actor: ActorProfile,
): Promise<LearningResourceListItem> {
  const client = await db()
  if (!actor.isStaff) {
    throw smsForbidden()
  }
  await validateOptionalRefs(client, input)
  const values: Record<string, unknown> = {}
  if (input.title !== undefined) values.title = input.title
  if (input.description !== undefined) {
    values.description = input.description
  }
  if (input.classId !== undefined) values.classId = input.classId
  if (input.subjectId !== undefined) values.subjectId = input.subjectId
  if (input.isPublished !== undefined) {
    values.isPublished = input.isPublished
  }
  const [row] = await listSelect(client)
    .where(eq(learningResources.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Resource not found.')
  }
  await client
    .update(learningResources)
    .set(values)
    .where(eq(learningResources.id, id))
  const [updated] = await listSelect(client)
    .where(eq(learningResources.id, id))
    .limit(1)
  return toJsonModel<LearningResourceListItem>({
    ...updated!.resource,
    className: updated!.className,
    subjectName: updated!.subjectName,
    uploadedByName: updated!.uploadedByName,
  })
}

/** Deletes metadata; caller purges the returned R2 object key. */
export async function deleteResource(
  id: string,
  actor: ActorProfile,
): Promise<string> {
  const client = await db()
  if (!actor.isStaff) {
    throw smsForbidden()
  }
  const [row] = await client
    .delete(learningResources)
    .where(eq(learningResources.id, id))
    .returning({ objectKey: learningResources.objectKey })
  if (!row) {
    throw smsNotFound('Resource not found.')
  }
  return row.objectKey
}

async function validateOptionalRefs(
  client: SmsDb,
  refs: { classId?: string | null; subjectId?: string | null },
): Promise<void> {
  if (refs.classId) {
    const [klass] = await client
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.id, refs.classId))
      .limit(1)
    if (!klass) {
      throw smsFieldError('classId', 'Class not found.')
    }
  }
  if (refs.subjectId) {
    const [subject] = await client
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, refs.subjectId))
      .limit(1)
    if (!subject) {
      throw smsFieldError('subjectId', 'Subject not found.')
    }
  }
}
