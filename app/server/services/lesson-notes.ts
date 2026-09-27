/**
 * Lesson notes service (Phase 16D).
 *
 * Teachers author notes for their own classes/subjects; admins
 * (isAdmin) view and manage all notes. Every read and write resolves
 * the scope server-side — a note outside the caller's scope 404s
 * exactly like a missing one, so the collection cannot be probed for
 * existence. Attachments live in R2 under `lesson-notes/` and are
 * served only through the authorized download route.
 */
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  academicSessions,
  classes,
  lessonNoteFiles,
  lessonNotes,
  subjects,
  teachers,
  terms,
} from '../../database/schema'
import type { LessonNoteListQuery, LessonNoteCreate, LessonNoteUpdate } from '../../shared/schemas'
import type {
  LessonNoteDetail,
  LessonNoteFile,
} from '../../shared/types'
import type { ActorProfile } from '../utils/auth/actor'
import { smsForbidden, smsNotFound } from '../utils/http-errors'
import { toJsonModel } from '../utils/serialize'
import type { SmsDb } from '../utils/pagination'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// ---------------------------------------------------------------------------
// Authorization helpers (pure — unit-tested)
// ---------------------------------------------------------------------------

export type LessonNoteScope =
  | { kind: 'all' }
  | { kind: 'own'; teacherId: string }
  | { kind: 'none' }

/**
 * Admins see every note; teachers see their own; any other staff
 * holding lesson_notes.view resolves no scope (empty list, never
 * other people's notes).
 */
export function resolveLessonNoteScope(actor: ActorProfile): LessonNoteScope {
  if (actor.isAdmin) return { kind: 'all' }
  if (actor.teacherId) return { kind: 'own', teacherId: actor.teacherId }
  return { kind: 'none' }
}

/** Only the owning teacher or an admin may mutate a note. */
export function canManageLessonNote(
  note: { teacherId: string },
  actor: ActorProfile,
): boolean {
  if (actor.isAdmin) return true
  return Boolean(actor.teacherId && actor.teacherId === note.teacherId)
}

function assertVisible(
  note: { teacherId: string } | undefined,
  actor: ActorProfile,
): note is { teacherId: string } {
  if (!note) {
    throw smsNotFound('Lesson note not found.')
  }
  const scope = resolveLessonNoteScope(actor)
  if (
    scope.kind === 'all' ||
    (scope.kind === 'own' && scope.teacherId === note.teacherId)
  ) {
    return true
  }
  // Existing but out of scope — same response as missing.
  throw smsNotFound('Lesson note not found.')
}

function assertManageable(
  note: { teacherId: string } | undefined,
  actor: ActorProfile,
): asserts note is { teacherId: string } {
  if (!note) {
    throw smsNotFound('Lesson note not found.')
  }
  if (!canManageLessonNote(note, actor)) {
    throw smsForbidden('You can only manage your own lesson notes.')
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function noteDto(row: {
  note: typeof lessonNotes.$inferSelect
  teacherName: string | null
  className: string | null
  subjectName: string | null
  sessionName: string | null
  termName: string | null
}): LessonNoteDetail {
  return {
    ...toJsonModel<LessonNoteDetail>(row.note),
    teacherName: row.teacherName ?? '',
    className: row.className ?? '',
    subjectName: row.subjectName ?? '',
    sessionName: row.sessionName ?? '',
    termName: row.termName ?? null,
    files: [],
  }
}

async function attachFiles(client: SmsDb, notes: LessonNoteDetail[]) {
  if (notes.length === 0) return
  const fileRows = await client
    .select()
    .from(lessonNoteFiles)
    .where(
      inArray(
        lessonNoteFiles.noteId,
        notes.map((n) => n.id),
      ),
    )
    .orderBy(asc(lessonNoteFiles.createdAt))
  const byNote = new Map<string, LessonNoteFile[]>()
  for (const file of fileRows) {
    const list = byNote.get(file.noteId) ?? []
    list.push(toJsonModel<LessonNoteFile>(file))
    byNote.set(file.noteId, list)
  }
  for (const note of notes) {
    note.files = byNote.get(note.id) ?? []
  }
}

function noteBaseQuery(client: SmsDb) {
  return client
    .select({
      note: lessonNotes,
      teacherName: sqlFullName(),
      className: classes.name,
      subjectName: subjects.name,
      sessionName: academicSessions.name,
      termName: terms.name,
    })
    .from(lessonNotes)
    .innerJoin(teachers, eq(lessonNotes.teacherId, teachers.id))
    .innerJoin(classes, eq(lessonNotes.classId, classes.id))
    .innerJoin(subjects, eq(lessonNotes.subjectId, subjects.id))
    .innerJoin(
      academicSessions,
      eq(lessonNotes.sessionId, academicSessions.id),
    )
    .leftJoin(terms, eq(lessonNotes.termId, terms.id))
}

function sqlFullName(): SQL<string> {
  return sql<string>`trim(${teachers.firstName} || ' ' || ${teachers.lastName})`
}

/** GET /lesson-notes — scoped list with filters, newest first. */
export async function listLessonNotes(
  query: LessonNoteListQuery,
  actor: ActorProfile,
): Promise<{ data: LessonNoteDetail[] }> {
  const client = await db()
  const scope = resolveLessonNoteScope(actor)
  if (scope.kind === 'none') {
    return { data: [] }
  }

  const where: SQL[] = []
  if (scope.kind === 'own') {
    where.push(eq(lessonNotes.teacherId, scope.teacherId))
  }
  if (query.classId) where.push(eq(lessonNotes.classId, query.classId))
  if (query.subjectId) where.push(eq(lessonNotes.subjectId, query.subjectId))
  if (query.sessionId) where.push(eq(lessonNotes.sessionId, query.sessionId))
  if (query.termId) where.push(eq(lessonNotes.termId, query.termId))

  const rows = await noteBaseQuery(client)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(lessonNotes.createdAt))
  const notes = rows.map(noteDto)
  await attachFiles(client, notes)
  return { data: notes }
}

/** GET /lesson-notes/:id — scoped detail. */
export async function getLessonNote(
  id: string,
  actor: ActorProfile,
): Promise<LessonNoteDetail> {
  const client = await db()
  const [row] = await noteBaseQuery(client)
    .where(eq(lessonNotes.id, id))
    .limit(1)
  assertVisible(row?.note, actor)
  const note = noteDto(row!)
  await attachFiles(client, [note])
  return note
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function assertTeacherActor(actor: ActorProfile): Promise<string> {
  const scope = resolveLessonNoteScope(actor)
  if (scope.kind !== 'own') {
    // Admins without a teacher profile cannot author notes (teacher_id
    // is NOT NULL); other staff cannot either.
    throw smsForbidden('Only teachers can author lesson notes.')
  }
  return scope.teacherId
}

/** POST /lesson-notes — create as the calling teacher. */
export async function createLessonNote(
  input: LessonNoteCreate,
  actor: ActorProfile,
): Promise<LessonNoteDetail> {
  const teacherId = await assertTeacherActor(actor)
  const client = await db()
  const now = new Date().toISOString()
  const [row] = await client
    .insert(lessonNotes)
    .values({
      teacherId,
      classId: input.classId,
      subjectId: input.subjectId,
      sessionId: input.sessionId,
      termId: input.termId ?? null,
      week: input.week ?? null,
      title: input.title,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  const [detail] = await noteBaseQuery(client)
    .where(eq(lessonNotes.id, row!.id))
    .limit(1)
  assertVisible(detail?.note, actor)
  return noteDto(detail!)
}

/** PATCH /lesson-notes/:id — owning teacher or admin. */
export async function updateLessonNote(
  id: string,
  input: LessonNoteUpdate,
  actor: ActorProfile,
): Promise<LessonNoteDetail> {
  const client = await db()
  const [existing] = await client
    .select({ teacherId: lessonNotes.teacherId })
    .from(lessonNotes)
    .where(eq(lessonNotes.id, id))
    .limit(1)
  assertManageable(existing, actor)

  const values: Partial<typeof lessonNotes.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }
  if (input.classId !== undefined) values.classId = input.classId
  if (input.subjectId !== undefined) values.subjectId = input.subjectId
  if (input.sessionId !== undefined) values.sessionId = input.sessionId
  if (input.termId !== undefined) values.termId = input.termId ?? null
  if (input.week !== undefined) values.week = input.week ?? null
  if (input.title !== undefined) values.title = input.title
  if (input.content !== undefined) values.content = input.content
  await client.update(lessonNotes).set(values).where(eq(lessonNotes.id, id))

  return getLessonNote(id, actor)
}

/** DELETE /lesson-notes/:id — owning teacher or admin; returns R2 keys. */
export async function deleteLessonNote(
  id: string,
  actor: ActorProfile,
): Promise<{ objectKeys: string[] }> {
  const client = await db()
  const [existing] = await client
    .select({ teacherId: lessonNotes.teacherId })
    .from(lessonNotes)
    .where(eq(lessonNotes.id, id))
    .limit(1)
  assertManageable(existing, actor)

  const files = await client
    .select({ objectKey: lessonNoteFiles.objectKey })
    .from(lessonNoteFiles)
    .where(eq(lessonNoteFiles.noteId, id))
  await client.delete(lessonNotes).where(eq(lessonNotes.id, id))
  return { objectKeys: files.map((f) => f.objectKey) }
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** POST /lesson-notes/:id/files — returns the key to upload to. */
export async function addLessonNoteFile(
  noteId: string,
  file: { objectKey: string; fileName: string; mimeType: string | null; sizeBytes: number | null },
  actor: ActorProfile,
): Promise<LessonNoteFile> {
  const client = await db()
  const [existing] = await client
    .select({ teacherId: lessonNotes.teacherId })
    .from(lessonNotes)
    .where(eq(lessonNotes.id, noteId))
    .limit(1)
  assertManageable(existing, actor)
  const [row] = await client
    .insert(lessonNoteFiles)
    .values({
      noteId,
      objectKey: file.objectKey,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById: actor.userId,
    })
    .returning()
  return toJsonModel<LessonNoteFile>(row!)
}

/** GET /lesson-notes/:id/files/:fileId — metadata for the download route. */
export async function getLessonNoteFile(
  noteId: string,
  fileId: string,
  actor: ActorProfile,
): Promise<LessonNoteFile> {
  const client = await db()
  const [note] = await client
    .select({ teacherId: lessonNotes.teacherId })
    .from(lessonNotes)
    .where(eq(lessonNotes.id, noteId))
    .limit(1)
  assertVisible(note, actor)
  const [file] = await client
    .select()
    .from(lessonNoteFiles)
    .where(
      and(eq(lessonNoteFiles.id, fileId), eq(lessonNoteFiles.noteId, noteId)),
    )
    .limit(1)
  if (!file) {
    throw smsNotFound('Attachment not found.')
  }
  return toJsonModel<LessonNoteFile>(file)
}

/** DELETE /lesson-notes/:id/files/:fileId — owning teacher or admin. */
export async function deleteLessonNoteFile(
  noteId: string,
  fileId: string,
  actor: ActorProfile,
): Promise<{ objectKey: string }> {
  const client = await db()
  const [existing] = await client
    .select({ teacherId: lessonNotes.teacherId })
    .from(lessonNotes)
    .where(eq(lessonNotes.id, noteId))
    .limit(1)
  assertManageable(existing, actor)
  const [file] = await client
    .select({ id: lessonNoteFiles.id, objectKey: lessonNoteFiles.objectKey })
    .from(lessonNoteFiles)
    .where(
      and(eq(lessonNoteFiles.id, fileId), eq(lessonNoteFiles.noteId, noteId)),
    )
    .limit(1)
  if (!file) {
    throw smsNotFound('Attachment not found.')
  }
  await client.delete(lessonNoteFiles).where(eq(lessonNoteFiles.id, fileId))
  return { objectKey: file.objectKey }
}
