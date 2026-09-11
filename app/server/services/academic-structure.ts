/**
 * Academic structure domain services (README §13 — Phase 3).
 *
 * Sessions, terms, classes, sections, subjects and class-subject links.
 * Routes stay thin: these functions own slug derivation, uniqueness,
 * referential checks, the "single current session/term" invariant
 * (enforced inside transactions) and history-preserving deactivation.
 */
import { and, asc, desc, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import {
  academicSessions,
  terms,
  classes,
  sections,
  subjects,
  classSubjects,
} from '../../database/schema'
import type {
  AcademicSessionCreate,
  AcademicSessionListQuery,
  AcademicSessionUpdate,
  ClassCreate,
  ClassListQuery,
  ClassSubjectBody,
  ClassSubjectUpdate,
  ClassUpdate,
  SectionCreate,
  SectionListQuery,
  SectionUpdate,
  SubjectCreate,
  SubjectListQuery,
  SubjectUpdate,
  TermCreate,
  TermListQuery,
  TermUpdate,
} from '../../shared/schemas'
import type {
  AcademicSession,
  ClassSubject as ClassSubjectRow,
  ClassSubjectDetail,
  Paginated,
  SchoolClass,
  Section,
  Subject,
  Term,
} from '../../shared/types'
import type { SmsDb } from '../utils/pagination'
import { smsPaginate } from '../utils/pagination'
import { smsConflict, smsFieldError, smsNotFound } from '../utils/http-errors'
import { smsSlugify } from '../utils/slug'
import { toJsonList, toJsonModel } from '../utils/serialize'

async function db(): Promise<SmsDb> {
  return (await import('../utils/db')).db
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Escapes a user search term for an ILIKE pattern. */
function nameFilter(column: PgColumn, search?: string): SQL | undefined {
  if (!search) {
    return undefined
  }
  const escaped = search.replace(/[\\%_]/g, '\\$&')
  return ilike(column, `%${escaped}%`)
}

/** Derives a collision-free slug for `base` against `column`. */
async function uniqueSlug(
  client: SmsDb,
  column: PgColumn,
  base: string,
  scope?: SQL,
  extra?: SQL,
): Promise<string> {
  const root = smsSlugify(base) || 'item'
  let candidate = root
  for (let suffix = 1; suffix < 1000; suffix++) {
    const filters = [eq(column, candidate)]
    if (scope) {
      filters.push(scope)
    }
    if (extra) {
      filters.push(extra)
    }
    const [existing] = await client
      .select({ marker: sql`1` })
      .from(column.table)
      .where(and(...filters))
      .limit(1)
    if (!existing) {
      return candidate
    }
    candidate = `${root}-${suffix + 1}`
  }
  throw smsConflict('Could not derive a unique slug.')
}

// ---------------------------------------------------------------------------
// Academic sessions
// ---------------------------------------------------------------------------

export async function listSessions(
  query: AcademicSessionListQuery,
): Promise<Paginated<AcademicSession>> {
  const client = await db()
  const filters: SQL[] = []
  if (query.isCurrent !== undefined) {
    filters.push(eq(academicSessions.isCurrent, query.isCurrent))
  }
  if (query.isActive !== undefined) {
    filters.push(eq(academicSessions.isActive, query.isActive))
  }
  const search = nameFilter(academicSessions.name, query.search)
  if (search) {
    filters.push(search)
  }
  return smsPaginate<AcademicSession>(client, {
    table: academicSessions,
    where: filters.length ? and(...filters) : undefined,
    orderBy: [
      desc(academicSessions.isCurrent),
      desc(academicSessions.startDate),
      asc(academicSessions.name),
    ],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getCurrentSession(): Promise<AcademicSession | null> {
  const client = await db()
  const [row] = await client
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.isCurrent, true))
    .limit(1)
  return row ? toJsonModel<AcademicSession>(row) : null
}

export async function getSessionOrThrow(
  client: SmsDb,
  id: string,
): Promise<AcademicSession> {
  const [row] = await client
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Academic session not found.')
  }
  return toJsonModel<AcademicSession>(row)
}

export async function createSession(
  input: AcademicSessionCreate,
): Promise<AcademicSession> {
  const client = await db()
  return client.transaction(async (tx) => {
    const slug = await uniqueSlug(tx, academicSessions.slug, input.name)
    if (input.isCurrent) {
      await tx.update(academicSessions).set({ isCurrent: false })
    }
    const [row] = await tx
      .insert(academicSessions)
      .values({
        name: input.name,
        slug,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        isCurrent: input.isCurrent ?? false,
        isActive: input.isActive ?? true,
      })
      .returning()
    return toJsonModel<AcademicSession>(row)
  })
}

export async function updateSession(
  id: string,
  input: AcademicSessionUpdate,
): Promise<AcademicSession> {
  const client = await db()
  return client.transaction(async (tx) => {
    const existing = await getSessionOrThrow(tx, id)

    if (input.isCurrent) {
      await tx.update(academicSessions).set({ isCurrent: false })
    }

    const [row] = await tx
      .update(academicSessions)
      .set({
        name: input.name,
        slug: input.name
          ? await uniqueSlug(
              tx,
              academicSessions.slug,
              input.name,
              undefined,
              ne(academicSessions.id, id),
            )
          : undefined,
        startDate:
          input.startDate === undefined ? undefined : input.startDate,
        endDate: input.endDate === undefined ? undefined : input.endDate,
        isCurrent: input.isCurrent,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(academicSessions.id, existing.id))
      .returning()
    return toJsonModel<AcademicSession>(row)
  })
}

export async function deactivateSession(id: string): Promise<AcademicSession> {
  const client = await db()
  await getSessionOrThrow(client, id)
  const [row] = await client
    .update(academicSessions)
    .set({ isActive: false, isCurrent: false, updatedAt: new Date() })
    .where(eq(academicSessions.id, id))
    .returning()
  return toJsonModel<AcademicSession>(row)
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export async function listTerms(
  query: TermListQuery,
): Promise<Paginated<Term>> {
  const client = await db()
  const filters: SQL[] = []
  if (query.sessionId) {
    filters.push(eq(terms.sessionId, query.sessionId))
  }
  if (query.isCurrent !== undefined) {
    filters.push(eq(terms.isCurrent, query.isCurrent))
  }
  if (query.isActive !== undefined) {
    filters.push(eq(terms.isActive, query.isActive))
  }
  const search = nameFilter(terms.name, query.search)
  if (search) {
    filters.push(search)
  }
  return smsPaginate<Term>(client, {
    table: terms,
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(terms.sessionId), asc(terms.sequence)],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getTermOrThrow(
  client: SmsDb,
  id: string,
): Promise<Term> {
  const [row] = await client
    .select()
    .from(terms)
    .where(eq(terms.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Term not found.')
  }
  return toJsonModel<Term>(row)
}

/** Term dates must sit inside the owning session's dates when set. */
function assertTermWithinSession(
  term: { startDate?: string; endDate?: string },
  session: AcademicSession,
): void {
  if (term.startDate && session.startDate && term.startDate < session.startDate) {
    throw smsFieldError(
      'startDate',
      'Term starts before the academic session start date.',
    )
  }
  if (term.endDate && session.endDate && term.endDate > session.endDate) {
    throw smsFieldError(
      'endDate',
      'Term ends after the academic session end date.',
    )
  }
}

export async function createTerm(input: TermCreate): Promise<Term> {
  const client = await db()
  const session = await getSessionOrThrow(client, input.sessionId)
  assertTermWithinSession(input, session)

  return client.transaction(async (tx) => {
    const slug = await uniqueSlug(
      tx,
      terms.slug,
      input.name,
      eq(terms.sessionId, input.sessionId),
    )
    if (input.isCurrent) {
      await tx
        .update(terms)
        .set({ isCurrent: false })
        .where(eq(terms.sessionId, input.sessionId))
    }
    const [row] = await tx
      .insert(terms)
      .values({
        sessionId: input.sessionId,
        name: input.name,
        slug,
        sequence: input.sequence,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        isCurrent: input.isCurrent ?? false,
        isActive: input.isActive ?? true,
      })
      .returning()
    return toJsonModel<Term>(row)
  })
}

export async function updateTerm(id: string, input: TermUpdate): Promise<Term> {
  const client = await db()
  return client.transaction(async (tx) => {
    const existing = await getTermOrThrow(tx, id)
    const sessionId = input.sessionId ?? existing.sessionId
    const session = await getSessionOrThrow(tx, sessionId)
    assertTermWithinSession(
      {
        startDate: input.startDate ?? existing.startDate ?? undefined,
        endDate: input.endDate ?? existing.endDate ?? undefined,
      },
      session,
    )

    if (input.isCurrent) {
      await tx
        .update(terms)
        .set({ isCurrent: false })
        .where(eq(terms.sessionId, sessionId))
    }

    const [row] = await tx
      .update(terms)
      .set({
        sessionId: input.sessionId,
        name: input.name,
        slug: input.name
          ? await uniqueSlug(
              tx,
              terms.slug,
              input.name,
              eq(terms.sessionId, sessionId),
              ne(terms.id, id),
            )
          : undefined,
        sequence: input.sequence,
        startDate:
          input.startDate === undefined ? undefined : input.startDate,
        endDate: input.endDate === undefined ? undefined : input.endDate,
        isCurrent: input.isCurrent,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(terms.id, id))
      .returning()
    return toJsonModel<Term>(row)
  })
}

export async function deactivateTerm(id: string): Promise<Term> {
  const client = await db()
  await getTermOrThrow(client, id)
  const [row] = await client
    .update(terms)
    .set({ isActive: false, isCurrent: false, updatedAt: new Date() })
    .where(eq(terms.id, id))
    .returning()
  return toJsonModel<Term>(row)
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export async function listClasses(
  query: ClassListQuery,
): Promise<Paginated<SchoolClass>> {
  const client = await db()
  const filters: SQL[] = []
  if (query.level) {
    filters.push(eq(classes.level, query.level))
  }
  if (query.isActive !== undefined) {
    filters.push(eq(classes.isActive, query.isActive))
  }
  const search = nameFilter(classes.name, query.search)
  if (search) {
    filters.push(search)
  }
  return smsPaginate<SchoolClass>(client, {
    table: classes,
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(classes.sequence), asc(classes.name)],
    page: query.page,
    perPage: query.perPage,
  })
}

export interface ClassDetail extends SchoolClass {
  sections: Section[]
  subjects: ClassSubjectDetail[]
}

export async function getClassOrThrow(
  client: SmsDb,
  id: string,
): Promise<SchoolClass> {
  const [row] = await client
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Class not found.')
  }
  return toJsonModel<SchoolClass>(row)
}

export async function getClassDetail(id: string): Promise<ClassDetail> {
  const client = await db()
  const klass = await getClassOrThrow(client, id)
  const sectionRows = await client
    .select()
    .from(sections)
    .where(eq(sections.classId, id))
    .orderBy(asc(sections.name))
  const subjectLinks = await client
    .select({
      classId: classSubjects.classId,
      subjectId: classSubjects.subjectId,
      isCompulsory: classSubjects.isCompulsory,
      maxScore: classSubjects.maxScore,
      createdAt: classSubjects.createdAt,
      subject: subjects,
    })
    .from(classSubjects)
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(eq(classSubjects.classId, id))
    .orderBy(asc(subjects.name))
  return {
    ...klass,
    sections: toJsonList<Section>(sectionRows),
    subjects: toJsonList<ClassSubjectDetail>(subjectLinks),
  }
}

export async function createClass(input: ClassCreate): Promise<SchoolClass> {
  const client = await db()
  const slug = await uniqueSlug(client, classes.slug, input.name)
  const [row] = await client
    .insert(classes)
    .values({
      name: input.name,
      slug,
      level: input.level || null,
      sequence: input.sequence ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning()
  return toJsonModel<SchoolClass>(row)
}

export async function updateClass(
  id: string,
  input: ClassUpdate,
): Promise<SchoolClass> {
  const client = await db()
  await getClassOrThrow(client, id)
  const [row] = await client
    .update(classes)
    .set({
      name: input.name,
      slug: input.name
        ? await uniqueSlug(
            client,
            classes.slug,
            input.name,
            undefined,
            ne(classes.id, id),
          )
        : undefined,
      level: input.level === undefined ? undefined : input.level || null,
      sequence: input.sequence,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(classes.id, id))
    .returning()
  return toJsonModel<SchoolClass>(row)
}

export async function deactivateClass(id: string): Promise<SchoolClass> {
  const client = await db()
  await getClassOrThrow(client, id)
  const [row] = await client
    .update(classes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(classes.id, id))
    .returning()
  return toJsonModel<SchoolClass>(row)
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function listSections(
  query: SectionListQuery,
): Promise<Paginated<Section>> {
  const client = await db()
  const filters: SQL[] = []
  if (query.classId) {
    filters.push(eq(sections.classId, query.classId))
  }
  if (query.isActive !== undefined) {
    filters.push(eq(sections.isActive, query.isActive))
  }
  const search = nameFilter(sections.name, query.search)
  if (search) {
    filters.push(search)
  }
  return smsPaginate<Section>(client, {
    table: sections,
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(sections.classId), asc(sections.name)],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getSectionOrThrow(
  client: SmsDb,
  id: string,
): Promise<Section> {
  const [row] = await client
    .select()
    .from(sections)
    .where(eq(sections.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Section not found.')
  }
  return toJsonModel<Section>(row)
}

export async function createSection(input: SectionCreate): Promise<Section> {
  const client = await db()
  await getClassOrThrow(client, input.classId)
  const slug = await uniqueSlug(
    client,
    sections.slug,
    input.name,
    eq(sections.classId, input.classId),
  )
  const [row] = await client
    .insert(sections)
    .values({
      classId: input.classId,
      name: input.name,
      slug,
      capacity: input.capacity ?? null,
      room: input.room || null,
      isActive: input.isActive ?? true,
    })
    .returning()
  return toJsonModel<Section>(row)
}

export async function updateSection(
  id: string,
  input: SectionUpdate,
): Promise<Section> {
  const client = await db()
  const existing = await getSectionOrThrow(client, id)
  const classId = input.classId ?? existing.classId
  if (input.classId) {
    await getClassOrThrow(client, input.classId)
  }
  const [row] = await client
    .update(sections)
    .set({
      classId: input.classId,
      name: input.name,
      slug: input.name
        ? await uniqueSlug(
            client,
            sections.slug,
            input.name,
            eq(sections.classId, classId),
            ne(sections.id, id),
          )
        : undefined,
      capacity: input.capacity === undefined ? undefined : input.capacity,
      room: input.room === undefined ? undefined : input.room || null,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(sections.id, id))
    .returning()
  return toJsonModel<Section>(row)
}

export async function deactivateSection(id: string): Promise<Section> {
  const client = await db()
  await getSectionOrThrow(client, id)
  const [row] = await client
    .update(sections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(sections.id, id))
    .returning()
  return toJsonModel<Section>(row)
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export async function listSubjects(
  query: SubjectListQuery,
): Promise<Paginated<Subject>> {
  const client = await db()
  const filters: SQL[] = []
  if (query.isActive !== undefined) {
    filters.push(eq(subjects.isActive, query.isActive))
  }
  if (query.search) {
    const escaped = query.search.replace(/[\\%_]/g, '\\$&')
    // ilike() on the nullable code column yields SQL | undefined.
    const searchExpr = or(
      ilike(subjects.name, `%${escaped}%`),
      ilike(subjects.code, `%${escaped}%`),
    )
    if (searchExpr) {
      filters.push(searchExpr)
    }
  }
  return smsPaginate<Subject>(client, {
    table: subjects,
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(subjects.name)],
    page: query.page,
    perPage: query.perPage,
  })
}

export async function getSubjectOrThrow(
  client: SmsDb,
  id: string,
): Promise<Subject> {
  const [row] = await client
    .select()
    .from(subjects)
    .where(eq(subjects.id, id))
    .limit(1)
  if (!row) {
    throw smsNotFound('Subject not found.')
  }
  return toJsonModel<Subject>(row)
}

export async function createSubject(
  input: SubjectCreate,
): Promise<Subject> {
  const client = await db()
  const slug = await uniqueSlug(client, subjects.slug, input.name)
  const [row] = await client
    .insert(subjects)
    .values({
      name: input.name,
      slug,
      code: input.code || null,
      description: input.description || null,
      isActive: input.isActive ?? true,
    })
    .returning()
  return toJsonModel<Subject>(row)
}

export async function updateSubject(
  id: string,
  input: SubjectUpdate,
): Promise<Subject> {
  const client = await db()
  await getSubjectOrThrow(client, id)
  const [row] = await client
    .update(subjects)
    .set({
      name: input.name,
      slug: input.name
        ? await uniqueSlug(
            client,
            subjects.slug,
            input.name,
            undefined,
            ne(subjects.id, id),
          )
        : undefined,
      code: input.code === undefined ? undefined : input.code || null,
      description:
        input.description === undefined
          ? undefined
          : input.description || null,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(subjects.id, id))
    .returning()
  return toJsonModel<Subject>(row)
}

export async function deactivateSubject(id: string): Promise<Subject> {
  const client = await db()
  await getSubjectOrThrow(client, id)
  const [row] = await client
    .update(subjects)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subjects.id, id))
    .returning()
  return toJsonModel<Subject>(row)
}

// ---------------------------------------------------------------------------
// Class <-> Subject links
// ---------------------------------------------------------------------------

export async function listClassSubjects(
  classId: string,
): Promise<ClassSubjectDetail[]> {
  const client = await db()
  await getClassOrThrow(client, classId)
  const rows = await client
    .select({
      classId: classSubjects.classId,
      subjectId: classSubjects.subjectId,
      isCompulsory: classSubjects.isCompulsory,
      maxScore: classSubjects.maxScore,
      createdAt: classSubjects.createdAt,
      subject: subjects,
    })
    .from(classSubjects)
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(eq(classSubjects.classId, classId))
    .orderBy(asc(subjects.name))
  return toJsonList<ClassSubjectDetail>(rows)
}

export async function addClassSubject(
  classId: string,
  input: ClassSubjectBody,
): Promise<ClassSubjectRow> {
  const client = await db()
  await getClassOrThrow(client, classId)
  await getSubjectOrThrow(client, input.subjectId)

  const [existing] = await client
    .select({ marker: sql`1` })
    .from(classSubjects)
    .where(
      and(
        eq(classSubjects.classId, classId),
        eq(classSubjects.subjectId, input.subjectId),
      ),
    )
    .limit(1)
  if (existing) {
    throw smsConflict('Subject is already linked to this class.')
  }

  const [row] = await client
    .insert(classSubjects)
    .values({
      classId,
      subjectId: input.subjectId,
      isCompulsory: input.isCompulsory,
      maxScore: input.maxScore ?? null,
    })
    .returning()
  return toJsonModel<ClassSubjectRow>(row)
}

export async function updateClassSubject(
  classId: string,
  subjectId: string,
  input: ClassSubjectUpdate,
): Promise<ClassSubjectRow> {
  const client = await db()
  const [row] = await client
    .update(classSubjects)
    .set({
      isCompulsory: input.isCompulsory,
      maxScore: input.maxScore === undefined ? undefined : input.maxScore,
    })
    .where(
      and(
        eq(classSubjects.classId, classId),
        eq(classSubjects.subjectId, subjectId),
      ),
    )
    .returning()
  if (!row) {
    throw smsNotFound('Class subject link not found.')
  }
  return toJsonModel<ClassSubjectRow>(row)
}

export async function removeClassSubject(
  classId: string,
  subjectId: string,
): Promise<void> {
  const client = await db()
  const [row] = await client
    .delete(classSubjects)
    .where(
      and(
        eq(classSubjects.classId, classId),
        eq(classSubjects.subjectId, subjectId),
      ),
    )
    .returning({ subjectId: classSubjects.subjectId })
  if (!row) {
    throw smsNotFound('Class subject link not found.')
  }
}
