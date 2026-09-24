/**
 * Idempotent database seeder (README §41 Phases 1 + 3).
 *
 * Seeds, all as clearly fake demo data:
 *   - permissions + roles + role_permissions (catalog)
 *   - five demo users (one per role) with hashed passwords
 *   - school settings defaults
 *   - one current academic session, three terms
 *   - starter classes, sections, subjects and class-subject links
 *   - fake teacher profiles, teacher-subject links and teacher class
 *     assignments for the current session (Phase 3)
 *   - fake students, parents, student-parent links and enrollments
 *     (Phase 4)
 *   - fake admissions applications, documents metadata and assessments
 *     (Phase 9); placeholder document object keys have no R2 bytes
 *   - fake announcements, notifications, messages, events and gallery
 *     albums/images (Phase 10); gallery image object keys have no R2 bytes
 *   - fake audit log rows (Phase 11) so the audit viewer isn't empty;
 *     ids are UUID defaults so idempotency uses userId+action+resource+createdAt
 *
 * Run via `npm run db:seed` (uses database/seed.ts). Safe to re-run:
 * every row upserts on its natural unique key and join rows use
 * ON CONFLICT DO NOTHING (assignments pre-check because their unique
 * index includes a nullable section).
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import {
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  schoolSettings,
  academicSessions,
  terms,
  classes,
  sections,
  subjects,
  classSubjects,
  teachers,
  teacherSubjects,
  teacherClassAssignments,
  students,
  parents,
  studentParents,
  studentEnrollments,
  timetableEntries,
  attendanceSessions,
  attendanceRecords,
  assignments,
  assignmentSubmissions,
  assessmentTypes,
  gradingScales,
  gradingScaleItems,
  exams,
  examSubjects,
  examScores,
  assessmentScores,
  resultPublications,
  reportCards,
  feeStructures,
  feeItems,
  studentInvoices,
  invoiceItems,
  payments,
  paymentReceipts,
  admissionApplications,
  admissionDocuments,
  admissionAssessments,
  announcements,
  notifications,
  messages,
  events,
  galleryAlbums,
  galleryImages,
  auditLogs,
} from '../schema'
import type { Schema } from '../schema'
import { audienceEnum } from '../schema'
import { hashPassword } from '../../server/utils/auth/password'
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from './catalog'

export type DB = DrizzleD1Database<Schema>

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'password123'

/** D1 stores timestamps as TEXT ISO-8601; use this instead of `new Date()`. */
const isoNow = () => new Date().toISOString()

/**
 * D1/SQLite caps bound variables at 100 per statement, so bulk
 * inserts must be chunked. Splits `rows` into batches sized by the
 * per-row column count, keeping each statement at most `maxVars`
 * binds (90 leaves headroom).
 */
function chunkForBindVars<T>(
  rows: T[],
  columnsPerRow: number,
  maxVars = 90,
): T[][] {
  const size = Math.max(1, Math.floor(maxVars / columnsPerRow))
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

interface DemoUser {
  name: string
  email: string
  roleSlug: string
}

const DEMO_USERS: DemoUser[] = [
  { name: 'Super Administrator', email: 'superadmin@victoriouschildren.school', roleSlug: 'super_admin' },
  { name: 'School Administrator', email: 'admin@victoriouschildren.school', roleSlug: 'admin' },
  { name: 'Demo Teacher', email: 'teacher@victoriouschildren.school', roleSlug: 'teacher' },
  { name: 'Demo Student', email: 'student@victoriouschildren.school', roleSlug: 'student' },
  { name: 'Demo Parent', email: 'parent@victoriouschildren.school', roleSlug: 'parent' },
]

const SETTINGS: { key: string; value: string; type: string; group: string }[] = [
  { key: 'school.name', value: 'Victorious Children School', type: 'string', group: 'general' },
  { key: 'school.motto', value: 'Knowledge, Discipline, Excellence', type: 'string', group: 'general' },
  { key: 'school.email', value: 'info@victoriouschildren.school', type: 'string', group: 'general' },
  { key: 'school.phone', value: '', type: 'string', group: 'general' },
  { key: 'school.address', value: 'Ojodu, Lagos', type: 'string', group: 'general' },
  // school.logo_key is intentionally absent here: it is seeded with real
  // R2 bytes by seedSchoolLogo() in database/seed-d1.ts (Phase 14A) and
  // must survive re-seeds once an admin uploads a replacement logo.
  { key: 'school.primary_color', value: '#1a237e', type: 'string', group: 'branding' },
  { key: 'school.secondary_color', value: '#1a1a2e', type: 'string', group: 'branding' },
  { key: 'school.currency', value: 'NGN', type: 'string', group: 'finance' },
  { key: 'school.bank_name', value: '', type: 'string', group: 'finance' },
  { key: 'school.account_name', value: '', type: 'string', group: 'finance' },
  { key: 'school.account_number', value: '', type: 'string', group: 'finance' },
  { key: 'school.academic_year_start_month', value: '9', type: 'number', group: 'academics' },
]

const DEMO_CLASSES = [
  { name: 'Nursery 1', slug: 'nursery-1', level: 'nursery', sequence: 1 },
  { name: 'Primary 1', slug: 'primary-1', level: 'primary', sequence: 10 },
  { name: 'JSS 1', slug: 'jss-1', level: 'jss', sequence: 20 },
  { name: 'SSS 1', slug: 'sss-1', level: 'sss', sequence: 30 },
]

const DEMO_SUBJECTS = [
  { name: 'English Studies', slug: 'english-studies', code: 'ENG' },
  { name: 'Mathematics', slug: 'mathematics', code: 'MTH' },
  { name: 'Basic Science', slug: 'basic-science', code: 'BSC' },
  { name: 'Social Studies', slug: 'social-studies', code: 'SST' },
  { name: 'Information Technology', slug: 'information-technology', code: 'ICT' },
]

// Fake teacher profiles (Phase 3 assignment support; People CRUD is
// Phase 4). The first row links to the demo teacher login.
const DEMO_TEACHERS = [
  {
    staffNumber: 'T001',
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada.obi@victoriouschildren.school',
    gender: 'female' as const,
    qualification: 'B.Ed. Primary Education',
    specialization: 'English Studies',
    demoUserEmail: 'teacher@victoriouschildren.school',
  },
  {
    staffNumber: 'T002',
    firstName: 'Bello',
    lastName: 'Musa',
    email: 'bello.musa@victoriouschildren.school',
    gender: 'male' as const,
    qualification: 'B.Sc. Mathematics',
    specialization: 'Mathematics',
  },
  {
    staffNumber: 'T003',
    firstName: 'Grace',
    lastName: 'Eze',
    email: 'grace.eze@victoriouschildren.school',
    gender: 'female' as const,
    qualification: 'B.Sc. Computer Science',
    specialization: 'Information Technology',
  },
  {
    staffNumber: 'T004',
    firstName: 'John',
    lastName: 'Adewale',
    email: 'john.adewale@victoriouschildren.school',
    gender: 'male' as const,
    qualification: 'B.Sc. Integrated Science',
    specialization: 'Basic Science',
  },
]

// Fake students (Phase 4). The first row links to the demo student login.
const DEMO_STUDENTS = [
  {
    admissionNumber: 'STU-001',
    firstName: 'Amara',
    lastName: 'Okafor',
    gender: 'female' as const,
    dateOfBirth: '2016-03-14',
    status: 'active' as const,
    classSlug: 'primary-1',
    demoUserEmail: 'student@victoriouschildren.school',
  },
  {
    admissionNumber: 'STU-002',
    firstName: 'David',
    lastName: 'Mensah',
    gender: 'male' as const,
    dateOfBirth: '2015-11-02',
    status: 'active' as const,
    classSlug: 'primary-1',
  },
  {
    admissionNumber: 'STU-003',
    firstName: 'Zainab',
    lastName: 'Bello',
    gender: 'female' as const,
    dateOfBirth: '2014-07-22',
    status: 'active' as const,
    classSlug: 'jss-1',
  },
  {
    admissionNumber: 'STU-004',
    firstName: 'Chinedu',
    lastName: 'Eze',
    gender: 'male' as const,
    dateOfBirth: '2013-01-30',
    status: 'active' as const,
    classSlug: 'sss-1',
  },
]

// Fake parents (Phase 4). First row links to the demo parent login.
const DEMO_PARENTS = [
  {
    firstName: 'Ngozi',
    lastName: 'Okafor',
    email: 'ngozi.okafor@victoriouschildren.school',
    phone: '+2348010000001',
    gender: 'female' as const,
    occupation: 'Nurse',
    demoUserEmail: 'parent@victoriouschildren.school',
  },
  {
    firstName: 'Emeka',
    lastName: 'Mensah',
    email: 'emeka.mensah@victoriouschildren.school',
    phone: '+2348010000002',
    gender: 'male' as const,
    occupation: 'Engineer',
  },
  {
    firstName: 'Fatima',
    lastName: 'Bello',
    email: 'fatima.bello@victoriouschildren.school',
    phone: '+2348010000003',
    gender: 'female' as const,
    occupation: 'Accountant',
  },
]

export async function seedDatabase(db: DB): Promise<void> {
  // --- Permissions ------------------------------------------------------
  // Chunked for D1's 100-bind limit. Each row binds 5 params: the 3
  // supplied fields plus Drizzle-applied $defaultFn id and created_at.
  const permissionRows: { id: string; slug: string }[] = []
  for (const rows of chunkForBindVars(
    PERMISSIONS.map((p) => ({ name: p.name, slug: p.slug, group: p.group })),
    5,
  )) {
    permissionRows.push(
      ...(await db
        .insert(permissions)
        .values(rows)
        .onConflictDoUpdate({
          target: permissions.slug,
          set: { name: sql`excluded.name`, group: sql`excluded."group"` },
        })
        .returning({ id: permissions.id, slug: permissions.slug })),
    )
  }

  const permissionIdBySlug = new Map(
    permissionRows.map((r) => [r.slug, r.id]),
  )

  // --- Roles ------------------------------------------------------------
  const roleRows = await db
    .insert(roles)
    .values(
      ROLES.map((r) => ({
        name: r.name,
        slug: r.slug,
        description: r.description,
        isSystem: r.isSystem,
      })),
    )
    .onConflictDoUpdate({
      target: roles.slug,
      set: { updatedAt: isoNow() },
    })
    .returning({ id: roles.id, slug: roles.slug })

  const roleIdBySlug = new Map(roleRows.map((r) => [r.slug, r.id]))

  // --- Role <-> Permissions (rebuild from catalog) ----------------------
  await db.delete(rolePermissions)
  for (const role of ROLES) {
    const roleId = roleIdBySlug.get(role.slug)
    if (!roleId) continue
    const links = ROLE_PERMISSIONS[role.slug]
      .map((slug) => permissionIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId, permissionId }))
    if (links.length > 0) {
      // Super-admin links all 104 permissions. Each row binds 3 params
      // (role_id, permission_id + $defaultFn created_at) — chunk to
      // stay within D1's 100-bind-per-statement limit.
      for (const rows of chunkForBindVars(links, 3)) {
        await db.insert(rolePermissions).values(rows).onConflictDoNothing()
      }
    }
  }

  // --- Demo users + role assignment -------------------------------------
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD)
  for (const demo of DEMO_USERS) {
    const [user] = await db
      .insert(users)
      .values({
        name: demo.name,
        email: demo.email,
        password: demoPasswordHash,
        isActive: true,
        emailVerifiedAt: isoNow(),
      })
      .onConflictDoUpdate({
        target: users.email,
        // Demo only: keep credentials working across re-seeds (also
        // upgrades older scrypt hashes to the current PBKDF2 format).
        set: {
          name: demo.name,
          password: demoPasswordHash,
          updatedAt: isoNow(),
        },
      })
      .returning({ id: users.id })

    const roleId = roleIdBySlug.get(demo.roleSlug)
    if (user && roleId) {
      await db
        .insert(userRoles)
        .values({ userId: user.id, roleId })
        .onConflictDoNothing()
    }
  }

  // --- School settings --------------------------------------------------
  for (const setting of SETTINGS) {
    await db
      .insert(schoolSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: schoolSettings.key,
        set: { value: setting.value, type: setting.type, updatedAt: isoNow() },
      })
  }

  // --- Academic session + terms -----------------------------------------
  const [session] = await db
    .insert(academicSessions)
    .values({
      name: '2026/2027',
      slug: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-07-31',
      isCurrent: true,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: academicSessions.slug,
      set: { isCurrent: true, updatedAt: isoNow() },
    })
    .returning({ id: academicSessions.id })

  if (session) {
    const termDefs = [
      { name: 'First Term', slug: 'first-term', sequence: 1, start: '2026-09-08', end: '2026-12-11' },
      { name: 'Second Term', slug: 'second-term', sequence: 2, start: '2027-01-05', end: '2027-04-02' },
      { name: 'Third Term', slug: 'third-term', sequence: 3, start: '2027-04-19', end: '2027-07-23' },
    ]
    for (const [i, term] of termDefs.entries()) {
      await db
        .insert(terms)
        .values({
          sessionId: session.id,
          name: term.name,
          slug: term.slug,
          sequence: term.sequence,
          startDate: term.start,
          endDate: term.end,
          isCurrent: i === 0,
        })
        .onConflictDoUpdate({
          target: [terms.sessionId, terms.slug],
          set: { updatedAt: isoNow() },
        })
    }
  }

  // --- Classes + sections -----------------------------------------------
  const classRows: { id: string; slug: string }[] = []
  for (const klass of DEMO_CLASSES) {
    const [row] = await db
      .insert(classes)
      .values(klass)
      .onConflictDoUpdate({
        target: classes.slug,
        set: { updatedAt: isoNow() },
      })
      .returning({ id: classes.id, slug: classes.slug })
    if (row) classRows.push(row)
  }
  for (const klass of classRows) {
    await db
      .insert(sections)
      .values({ classId: klass.id, name: 'A', slug: 'a' })
      .onConflictDoUpdate({
        target: [sections.classId, sections.slug],
        set: { updatedAt: isoNow() },
      })
  }

  // --- Subjects + class-subject links -----------------------------------
  const subjectRows: { id: string }[] = []
  for (const subject of DEMO_SUBJECTS) {
    const [row] = await db
      .insert(subjects)
      .values(subject)
      .onConflictDoUpdate({
        target: subjects.slug,
        set: { updatedAt: isoNow() },
      })
      .returning({ id: subjects.id })
    if (row) subjectRows.push(row)
  }
  for (const klass of classRows) {
    for (const subject of subjectRows) {
      await db
        .insert(classSubjects)
        .values({ classId: klass.id, subjectId: subject.id, isCompulsory: true })
        .onConflictDoNothing()
    }
  }

  // --- Teachers, subject links and class assignments (Phase 3) ----------
  const teacherRows: { id: string; staffNumber: string }[] = []
  for (const teacher of DEMO_TEACHERS) {
    let userId: string | null = null
    if (teacher.demoUserEmail) {
      const [demoUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, teacher.demoUserEmail))
        .limit(1)
      userId = demoUser?.id ?? null
    }
    const [row] = await db
      .insert(teachers)
      .values({
        userId,
        staffNumber: teacher.staffNumber,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        gender: teacher.gender,
        qualification: teacher.qualification,
        specialization: teacher.specialization,
        hiredAt: '2026-08-01',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: teachers.staffNumber,
        set: { userId, email: teacher.email, updatedAt: isoNow() },
      })
      .returning({ id: teachers.id, staffNumber: teachers.staffNumber })
    if (row) {
      teacherRows.push(row)
    }
  }

  if (teacherRows.length > 0 && subjectRows.length > 0) {
    // Subject index plan against DEMO_SUBJECTS order above.
    const capabilityPlan: Record<string, number[]> = {
      T001: [0, 1, 2, 3, 4],
      T002: [1],
      T003: [4],
      T004: [2, 3],
    }
    for (const teacher of teacherRows) {
      for (const idx of capabilityPlan[teacher.staffNumber] ?? []) {
        const subject = subjectRows[idx]
        if (!subject) {
          continue
        }
        await db
          .insert(teacherSubjects)
          .values({ teacherId: teacher.id, subjectId: subject.id })
          .onConflictDoNothing()
      }
    }
  }

  if (
    teacherRows.length > 0 &&
    classRows.length > 0 &&
    subjectRows.length > 0 &&
    session
  ) {
    const byStaff = (staffNumber: string) =>
      teacherRows.find((t) => t.staffNumber === staffNumber)
    const byClassSlug = (slug: string) =>
      classRows.find((c) => c.slug === slug)
    const assignmentPlan = [
      { staff: 'T001', klass: 'primary-1', subject: 0 },
      { staff: 'T002', klass: 'jss-1', subject: 1 },
      { staff: 'T003', klass: 'jss-1', subject: 4 },
      { staff: 'T004', klass: 'sss-1', subject: 2 },
    ]
    for (const item of assignmentPlan) {
      const teacher = byStaff(item.staff)
      const klass = byClassSlug(item.klass)
      const subject = subjectRows[item.subject]
      if (!teacher || !klass || !subject) {
        continue
      }
      // Pre-check: the assignment unique index includes a nullable
      // section, so ON CONFLICT cannot target it directly.
      const [existing] = await db
        .select({ marker: sql`1` })
        .from(teacherClassAssignments)
        .where(
          and(
            eq(teacherClassAssignments.teacherId, teacher.id),
            eq(teacherClassAssignments.classId, klass.id),
            eq(teacherClassAssignments.subjectId, subject.id),
            eq(teacherClassAssignments.sessionId, session.id),
            isNull(teacherClassAssignments.sectionId),
          ),
        )
        .limit(1)
      if (existing) {
        continue
      }
      await db.insert(teacherClassAssignments).values({
        teacherId: teacher.id,
        classId: klass.id,
        subjectId: subject.id,
        sessionId: session.id,
        isPrimaryTeacher: item.staff === 'T001',
      })
    }
  }

  // --- Students, parents, links and enrollments (Phase 4) ---------------
  if (session) {
    const studentRows: { id: string; admissionNumber: string; classId: string | null }[] =
      []
    for (const student of DEMO_STUDENTS) {
      let userId: string | null = null
      if (student.demoUserEmail) {
        const [demoUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, student.demoUserEmail))
          .limit(1)
        userId = demoUser?.id ?? null
      }
      const klass = classRows.find((c) => c.slug === student.classSlug)
      const [row] = await db
        .insert(students)
        .values({
          userId,
          admissionNumber: student.admissionNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          status: student.status,
          currentClassId: klass?.id ?? null,
          enrolledAt: '2026-09-07',
        })
        .onConflictDoUpdate({
          target: students.admissionNumber,
          set: { userId, updatedAt: isoNow() },
        })
        .returning({
          id: students.id,
          admissionNumber: students.admissionNumber,
          classId: students.currentClassId,
        })
      if (row) {
        studentRows.push({ ...row, classId: row.classId ?? klass?.id ?? null })
      }
    }

    const parentRows: { id: string; email: string | null }[] = []
    for (const parent of DEMO_PARENTS) {
      let userId: string | null = null
      if (parent.demoUserEmail) {
        const [demoUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, parent.demoUserEmail))
          .limit(1)
        userId = demoUser?.id ?? null
      }
      const [row] = await db
        .insert(parents)
        .values({
          userId,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          phone: parent.phone,
          gender: parent.gender,
          occupation: parent.occupation,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: parents.email,
          set: { userId, updatedAt: isoNow() },
        })
        .returning({ id: parents.id, email: parents.email })
      if (row) {
        parentRows.push(row)
      }
    }

    // Student -> parent links (composite PK -> onConflictDoNothing).
    const linkPlan: Record<string, string[]> = {
      'STU-001': ['ngozi.okafor@victoriouschildren.school'],
      'STU-002': ['emeka.mensah@victoriouschildren.school'],
      'STU-003': ['fatima.bello@victoriouschildren.school'],
      'STU-004': [],
    }
    const byEmail = (email: string) => parentRows.find((p) => p.email === email)
    for (const student of studentRows) {
      for (const email of linkPlan[student.admissionNumber] ?? []) {
        const parent = byEmail(email)
        if (!parent) {
          continue
        }
        await db
          .insert(studentParents)
          .values({
            studentId: student.id,
            parentId: parent.id,
            relationship: 'mother',
            isPrimary: true,
            isEmergencyContact: true,
          })
          .onConflictDoNothing()
      }
    }

    // Enrollments for the current session/term.
    const firstTerm = await db
      .select({ id: terms.id })
      .from(terms)
      .where(
        and(
          eq(terms.sessionId, session.id),
          eq(terms.sequence, 1),
        ),
      )
      .limit(1)
    const termId = firstTerm[0]?.id ?? null

    for (const student of studentRows) {
      if (!student.classId) {
        continue
      }
      const [existing] = await db
        .select({ marker: sql`1` })
        .from(studentEnrollments)
        .where(
          and(
            eq(studentEnrollments.studentId, student.id),
            eq(studentEnrollments.sessionId, session.id),
            eq(studentEnrollments.classId, student.classId),
          ),
        )
        .limit(1)
      if (existing) {
        continue
      }
      await db.insert(studentEnrollments).values({
        studentId: student.id,
        sessionId: session.id,
        termId,
        classId: student.classId,
        enrollmentDate: '2026-09-07',
        status: 'active',
      })
    }
  }

  // --- Timetable + demo attendance register (Phase 5) -------------------
  // All entries are whole-session / whole-class on disjoint slots, so
  // conflict detection never trips. Pre-checked for idempotency because
  // timetable_entries has no unique constraint.
  if (
    session &&
    classRows.length >= 4 &&
    subjectRows.length >= 5 &&
    teacherRows.length >= 4
  ) {
    const classIdBySlug = (slug: string) =>
      classRows.find((c) => c.slug === slug)?.id
    const teacherIdByNo = (no: string) =>
      teacherRows.find((t) => t.staffNumber === no)?.id

    const plan: {
      classSlug: string
      subjectIdx: number
      teacher: string
      weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'
      start: string
      end: string
      room: string
    }[] = [
      { classSlug: 'jss-1', subjectIdx: 1, teacher: 'T002', weekday: 'monday', start: '08:00', end: '08:45', room: 'J1' },
      { classSlug: 'sss-1', subjectIdx: 2, teacher: 'T004', weekday: 'monday', start: '09:00', end: '09:45', room: 'S1' },
      { classSlug: 'primary-1', subjectIdx: 0, teacher: 'T001', weekday: 'tuesday', start: '08:00', end: '08:45', room: 'P1' },
      { classSlug: 'jss-1', subjectIdx: 4, teacher: 'T003', weekday: 'tuesday', start: '10:00', end: '10:45', room: 'Lab' },
      { classSlug: 'jss-1', subjectIdx: 3, teacher: 'T004', weekday: 'wednesday', start: '09:00', end: '09:45', room: 'J1' },
      { classSlug: 'sss-1', subjectIdx: 2, teacher: 'T004', weekday: 'thursday', start: '08:00', end: '08:45', room: 'S1' },
      { classSlug: 'primary-1', subjectIdx: 0, teacher: 'T001', weekday: 'friday', start: '08:00', end: '08:45', room: 'P1' },
    ]

    for (const item of plan) {
      const cid = classIdBySlug(item.classSlug)
      const tid = teacherIdByNo(item.teacher)
      const sid = subjectRows[item.subjectIdx]?.id
      if (!cid || !tid || !sid) {
        continue
      }
      const [existing] = await db
        .select({ marker: sql`1` })
        .from(timetableEntries)
        .where(
          and(
            eq(timetableEntries.sessionId, session.id),
            eq(timetableEntries.classId, cid),
            isNull(timetableEntries.termId),
            isNull(timetableEntries.sectionId),
            eq(timetableEntries.weekday, item.weekday),
            eq(timetableEntries.startTime, item.start),
          ),
        )
        .limit(1)
      if (existing) {
        continue
      }
      await db.insert(timetableEntries).values({
        sessionId: session.id,
        classId: cid,
        subjectId: sid,
        teacherId: tid,
        room: item.room,
        weekday: item.weekday,
        startTime: item.start,
        endTime: item.end,
      })
    }

    // One submitted register for Primary 1 so the approval workflow and
    // reports have data on first run.
    const primaryId = classIdBySlug('primary-1')
    const markerId = teacherIdByNo('T001') ?? null
    const firstTermRow = await db
      .select({ id: terms.id })
      .from(terms)
      .where(and(eq(terms.sessionId, session.id), eq(terms.sequence, 1)))
      .limit(1)
    if (primaryId && firstTermRow[0]) {
      let registerId: string | undefined
      const [existingRegister] = await db
        .select({ id: attendanceSessions.id })
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.sessionId, session.id),
            eq(attendanceSessions.classId, primaryId),
            isNull(attendanceSessions.sectionId),
            eq(attendanceSessions.date, '2026-09-10'),
          ),
        )
        .limit(1)
      if (existingRegister) {
        registerId = existingRegister.id
      } else {
        const [created] = await db
          .insert(attendanceSessions)
          .values({
            sessionId: session.id,
            termId: firstTermRow[0].id,
            classId: primaryId,
            date: '2026-09-10',
            status: 'submitted',
            markedById: markerId,
          })
          .returning({ id: attendanceSessions.id })
        registerId = created?.id
      }

      if (registerId) {
        const enrolled = await db
          .select({
            studentId: studentEnrollments.studentId,
            admissionNumber: students.admissionNumber,
          })
          .from(studentEnrollments)
          .innerJoin(
            students,
            eq(studentEnrollments.studentId, students.id),
          )
          .where(
            and(
              eq(studentEnrollments.sessionId, session.id),
              eq(studentEnrollments.classId, primaryId),
            ),
          )
        for (const [i, row] of enrolled.entries()) {
          await db
            .insert(attendanceRecords)
            .values({
              attendanceSessionId: registerId,
              studentId: row.studentId,
              status: i === 1 ? 'late' : 'present',
            })
            .onConflictDoNothing()
        }
      }
    }

    // --- Assignments + one graded text submission (Phase 6) -------------
    // No files are seeded: R2 objects cannot exist before the binding is
    // configured, so demo work is text-only. Titles are pre-checked for
    // idempotency (no natural unique index on assignments).
    const phaseSessionId = session.id
    const jssOneId = classIdBySlug('jss-1')
    const teacherTwoId = teacherIdByNo('T002')
    async function ensureAssignment(input: {
      title: string
      classId: string
      subjectId: string
      teacherId: string
      termId: string | null
      status: 'draft' | 'published'
      dueDate: string | null
      publishedAt: string | null
      instructions: string | null
    }): Promise<string | null> {
      const [found] = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(
          and(
            eq(assignments.sessionId, phaseSessionId),
            eq(assignments.classId, input.classId),
            eq(assignments.title, input.title),
          ),
        )
        .limit(1)
      if (found) {
        return found.id
      }
      const [created] = await db
        .insert(assignments)
        .values({
          sessionId: phaseSessionId,
          termId: input.termId,
          classId: input.classId,
          subjectId: input.subjectId,
          teacherId: input.teacherId,
          title: input.title,
          instructions: input.instructions,
          status: input.status,
          dueDate: input.dueDate ?? null,
          publishedAt: input.publishedAt ?? null,
        })
        .returning({ id: assignments.id })
      return created?.id ?? null
    }

    if (primaryId && markerId && firstTermRow[0]) {
      const publishedId = await ensureAssignment({
        title: 'Counting 1–10 practice',
        classId: primaryId,
        subjectId: subjectRows[0]!.id,
        teacherId: markerId,
        termId: firstTermRow[0].id,
        status: 'published',
        dueDate: '2026-09-25T12:00:00Z',
        publishedAt: '2026-09-08T09:00:00Z',
        instructions:
          'Practice counting objects at home and write your answers in full sentences.',
      })
      if (jssOneId && teacherTwoId && subjectRows[1]) {
        await ensureAssignment({
          title: 'Basic algebra worksheet (draft)',
          classId: jssOneId,
          subjectId: subjectRows[1].id,
          teacherId: teacherTwoId,
          termId: firstTermRow[0].id,
          status: 'draft',
          dueDate: null,
          publishedAt: null,
          instructions: null,
        })
      }

      if (publishedId) {
        const [demoStudent] = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.admissionNumber, 'STU-001'))
          .limit(1)
        if (demoStudent) {
          await db
            .insert(assignmentSubmissions)
            .values({
              assignmentId: publishedId,
              studentId: demoStudent.id,
              textContent:
                'I counted ten pencils, nine books and eight crayons.',
              status: 'graded',
              score: 90,
              feedback: 'Well done — remember to write out all ten items next time.',
              submittedAt: '2026-09-11T16:30:00Z',
              gradedById: markerId,
              gradedAt: '2026-09-12T08:30:00Z',
            })
            .onConflictDoNothing()
        }
      }
    }

    // --- Phase 7: exams, grading scales, scores, publication, report card --
    // Idempotent via pre-checks on natural unique keys.
    const [adminUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'admin@victoriouschildren.school'))
      .limit(1)

    // Assessment type: midterm (idempotent on slug).
    const [existingType] = await db
      .select({ id: assessmentTypes.id })
      .from(assessmentTypes)
      .where(eq(assessmentTypes.slug, 'midterm'))
      .limit(1)
    let assessmentTypeId = existingType?.id
    if (!assessmentTypeId) {
      const [created] = await db
        .insert(assessmentTypes)
        .values({
          name: 'Midterm',
          slug: 'midterm',
          weight: 3000,
          description: 'Continuous assessment midpoint',
        })
        .returning({ id: assessmentTypes.id })
      assessmentTypeId = created?.id
    }

    // Grading scale with 6 grade items (idempotent on scale name + grade).
    const [existingScale] = await db
      .select({ id: gradingScales.id })
      .from(gradingScales)
      .where(eq(gradingScales.name, 'Default Scale'))
      .limit(1)
    let scaleId = existingScale?.id
    if (!scaleId) {
      const [createdScale] = await db
        .insert(gradingScales)
        .values({
          sessionId: session.id,
          name: 'Default Scale',
          isActive: true,
        })
        .returning({ id: gradingScales.id })
      scaleId = createdScale?.id
    }
    if (scaleId) {
      const gradeRows = [
        { grade: 'A', minScore: 7000, maxScore: 10000, remark: 'Excellent' },
        { grade: 'B', minScore: 6000, maxScore: 6999, remark: 'Very good' },
        { grade: 'C', minScore: 5000, maxScore: 5999, remark: 'Good' },
        { grade: 'D', minScore: 4500, maxScore: 4999, remark: 'Pass' },
        { grade: 'E', minScore: 4000, maxScore: 4499, remark: 'Weak pass' },
        { grade: 'F', minScore: 0, maxScore: 3999, remark: 'Fail' },
      ]
      for (const item of gradeRows) {
        const [existing] = await db
          .select({ id: gradingScaleItems.id })
          .from(gradingScaleItems)
          .where(
            and(
              eq(gradingScaleItems.scaleId, scaleId),
              eq(gradingScaleItems.grade, item.grade),
            ),
          )
          .limit(1)
        if (existing) {
          continue
        }
        await db.insert(gradingScaleItems).values({
          scaleId,
          grade: item.grade,
          minScore: item.minScore,
          maxScore: item.maxScore,
          remark: item.remark,
        })
      }
    }

    // One exam for Primary 1, First Term, with two subjects (Mathematics,
    // English). Idempotent on (sessionId, classId, name).
    if (primaryId && firstTermRow[0] && subjectRows[0] && subjectRows[1]) {
      const [existingExam] = await db
        .select({ id: exams.id })
        .from(exams)
        .where(
          and(
            eq(exams.sessionId, session.id),
            eq(exams.classId, primaryId),
            eq(exams.name, 'Primary 1 First Term Exam'),
          ),
        )
        .limit(1)
      let examId = existingExam?.id
      if (!examId) {
        const [createdExam] = await db
          .insert(exams)
          .values({
            sessionId: session.id,
            termId: firstTermRow[0].id,
            classId: primaryId,
            name: 'Primary 1 First Term Exam',
            startDate: '2026-12-01',
            endDate: '2026-12-10',
            status: 'closed',
          })
          .returning({ id: exams.id })
        examId = createdExam?.id
      }

      if (examId) {
        // Exam subjects (idempotent on (examId, subjectId)).
        const examSubjectPlan = [
          { subjectId: subjectRows[0]!.id, maxScore: 10000 },
          { subjectId: subjectRows[1]!.id, maxScore: 10000 },
        ]
        const examSubjectIds: string[] = []
        for (const plan of examSubjectPlan) {
          const [existing] = await db
            .select({ id: examSubjects.id })
            .from(examSubjects)
            .where(
              and(
                eq(examSubjects.examId, examId),
                eq(examSubjects.subjectId, plan.subjectId),
              ),
            )
            .limit(1)
          if (existing) {
            examSubjectIds.push(existing.id)
            continue
          }
          const [created] = await db
            .insert(examSubjects)
            .values({
              examId,
              subjectId: plan.subjectId,
              maxScore: plan.maxScore,
              examDate: '2026-12-02',
            })
            .returning({ id: examSubjects.id })
          if (created) {
            examSubjectIds.push(created.id)
          }
        }

        // Exam scores for STU-001 in both subjects (idempotent on
        // (examSubjectId, studentId)).
        const [demoStudent] = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.admissionNumber, 'STU-001'))
          .limit(1)
        if (demoStudent && examSubjectIds.length === 2 && markerId) {
          const scorePlan = [
            { examSubjectId: examSubjectIds[0]!, score: 8500, grade: 'A' },
            { examSubjectId: examSubjectIds[1]!, score: 7200, grade: 'A' },
          ]
          for (const item of scorePlan) {
            const [existing] = await db
              .select({ id: examScores.id })
              .from(examScores)
              .where(
                and(
                  eq(examScores.examSubjectId, item.examSubjectId),
                  eq(examScores.studentId, demoStudent.id),
                ),
              )
              .limit(1)
            if (existing) {
              continue
            }
            await db.insert(examScores).values({
              examSubjectId: item.examSubjectId,
              studentId: demoStudent.id,
              score: item.score,
              grade: item.grade,
              enteredById: markerId,
            })
          }
        }

        // Result publication taken through draft → submitted → approved →
        // published. Idempotent on (sessionId, termId, classId, sectionId NULL).
        const [existingPub] = await db
          .select({
            id: resultPublications.id,
            status: resultPublications.status,
          })
          .from(resultPublications)
          .where(
            and(
              eq(resultPublications.sessionId, session.id),
              eq(resultPublications.termId, firstTermRow[0].id),
              eq(resultPublications.classId, primaryId),
              isNull(resultPublications.sectionId),
            ),
          )
          .limit(1)
        let publicationId = existingPub?.id
        if (!publicationId) {
          const [created] = await db
            .insert(resultPublications)
            .values({
              sessionId: session.id,
              termId: firstTermRow[0].id,
              classId: primaryId,
              sectionId: null,
              status: 'published',
              submittedById: markerId,
              submittedAt: '2026-12-15T10:00:00Z',
              approvedById: adminUser?.id ?? null,
              approvedAt: '2026-12-16T09:00:00Z',
              publishedById: adminUser?.id ?? null,
              publishedAt: '2026-12-17T12:00:00Z',
            })
            .returning({ id: resultPublications.id })
          publicationId = created?.id
        } else if (existingPub && existingPub.status !== 'published') {
          await db
            .update(resultPublications)
            .set({
              status: 'published',
              submittedById: markerId,
              submittedAt: '2026-12-15T10:00:00Z',
              approvedById: adminUser?.id ?? null,
              approvedAt: '2026-12-16T09:00:00Z',
              publishedById: adminUser?.id ?? null,
              publishedAt: '2026-12-17T12:00:00Z',
              updatedAt: isoNow(),
            })
            .where(eq(resultPublications.id, existingPub.id))
        }

        // Generated published report card for STU-001 (idempotent on
        // (studentId, sessionId, termId)).
        if (demoStudent && adminUser) {
          const [existingCard] = await db
            .select({ id: reportCards.id })
            .from(reportCards)
            .where(
              and(
                eq(reportCards.studentId, demoStudent.id),
                eq(reportCards.sessionId, session.id),
                eq(reportCards.termId, firstTermRow[0].id),
              ),
            )
            .limit(1)
          if (!existingCard) {
            await db.insert(reportCards).values({
              studentId: demoStudent.id,
              sessionId: session.id,
              termId: firstTermRow[0].id,
              classId: primaryId,
              sectionId: null,
              totalScore: 15700,
              averageScore: 7850,
              overallGrade: 'A',
              attendanceSummary: 'Present 18/20 days',
              teacherRemark: 'Good progress this term — keep it up.',
              principalRemark: 'A strong start to the year.',
              objectKey: null,
              status: 'published',
              generatedById: adminUser.id,
              publishedAt: '2026-12-17T15:00:00Z',
            })
          }
        }
      }
    }

    // --- Phase 8: finance — fee structure, invoice, payment, receipt -------
    // Idempotent via pre-checks on natural unique keys (structure name,
    // invoice/payment/receipt numbers). Fake demo data only.
    if (primaryId && firstTermRow[0] && adminUser) {
      const [financeStudent] = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.admissionNumber, 'STU-001'))
        .limit(1)

      if (financeStudent) {
        // Fee structure for Primary 1, First Term.
        const structureName = 'Primary 1 First Term Fees'
        const [existingStructure] = await db
          .select({ id: feeStructures.id })
          .from(feeStructures)
          .where(
            and(
              eq(feeStructures.sessionId, session.id),
              eq(feeStructures.classId, primaryId),
              eq(feeStructures.name, structureName),
            ),
          )
          .limit(1)
        let structureId = existingStructure?.id
        if (!structureId) {
          const [created] = await db
            .insert(feeStructures)
            .values({
              sessionId: session.id,
              classId: primaryId,
              name: structureName,
              description: 'Standard first-term charges for Primary 1.',
              isActive: true,
            })
            .returning({ id: feeStructures.id })
          structureId = created?.id
        }

        // Fee items (idempotent on (feeStructureId, name)).
        const itemPlan = [
          { name: 'Tuition', amount: 5000000, isOptional: false, dueDate: '2026-01-31' },
          { name: 'Books', amount: 500000, isOptional: false, dueDate: '2026-01-20' },
          { name: 'Activity Fee', amount: 250000, isOptional: true, dueDate: '2026-02-15' },
        ]
        const feeItemIds: Record<string, string> = {}
        for (const plan of itemPlan) {
          const [existingItem] = await db
            .select({ id: feeItems.id })
            .from(feeItems)
            .where(
              and(
                eq(feeItems.feeStructureId, structureId!),
                eq(feeItems.name, plan.name),
              ),
            )
            .limit(1)
          let itemId = existingItem?.id
          if (!itemId) {
            const [created] = await db
              .insert(feeItems)
              .values({
                feeStructureId: structureId!,
                name: plan.name,
                amount: plan.amount,
                isOptional: plan.isOptional,
                dueDate: plan.dueDate,
              })
              .returning({ id: feeItems.id })
            itemId = created?.id
          }
          if (itemId) {
            feeItemIds[plan.name] = itemId
          }
        }

        // Invoice INV-2026-0001 — total 57,500, later partially paid.
        const invoiceNumber = 'INV-2026-0001'
        const [existingInvoice] = await db
          .select({ id: studentInvoices.id })
          .from(studentInvoices)
          .where(eq(studentInvoices.invoiceNumber, invoiceNumber))
          .limit(1)
        let invoiceId = existingInvoice?.id
        if (!invoiceId) {
          const [created] = await db
            .insert(studentInvoices)
            .values({
              invoiceNumber,
              studentId: financeStudent.id,
              sessionId: session.id,
              termId: firstTermRow[0].id,
              issueDate: '2026-01-10',
              dueDate: '2026-01-31',
              subtotal: 5750000,
              discount: 0,
              tax: 0,
              total: 5750000,
              amountPaid: 0,
              balance: 5750000,
              status: 'issued',
              notes: 'First term fees — payment partially recorded.',
              createdById: adminUser.id,
            })
            .returning({ id: studentInvoices.id })
          invoiceId = created?.id
        }

        // Invoice lines (idempotent per fee item / description).
        if (invoiceId) {
          const linePlan = [
            { key: 'Tuition', description: 'Tuition', quantity: 1, unitAmount: 5000000, lineTotal: 5000000 },
            { key: 'Books', description: 'Books and stationery', quantity: 1, unitAmount: 500000, lineTotal: 500000 },
            { key: 'Activity Fee', description: 'Activity Fee', quantity: 1, unitAmount: 250000, lineTotal: 250000 },
          ]
          for (const line of linePlan) {
            const linkedFeeItemId = feeItemIds[line.key] ?? null
            const [existingLine] = await db
              .select({ id: invoiceItems.id })
              .from(invoiceItems)
              .where(
                and(
                  eq(invoiceItems.invoiceId, invoiceId),
                  linkedFeeItemId
                    ? eq(invoiceItems.feeItemId, linkedFeeItemId)
                    : eq(invoiceItems.description, line.description),
                ),
              )
              .limit(1)
            if (existingLine) {
              continue
            }
            await db.insert(invoiceItems).values({
              invoiceId,
              feeItemId: linkedFeeItemId,
              description: line.description,
              quantity: line.quantity,
              unitAmount: line.unitAmount,
              lineTotal: line.lineTotal,
            })
          }
        }

        // Payment PAY-2026-0001 — verified cash payment of 30,000.
        const paymentReference = 'PAY-2026-0001'
        const [existingPayment] = await db
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.paymentReference, paymentReference))
          .limit(1)
        let paymentId = existingPayment?.id
        if (!paymentId && invoiceId) {
          const [created] = await db
            .insert(payments)
            .values({
              paymentReference,
              invoiceId,
              studentId: financeStudent.id,
              amount: 3000000,
              method: 'cash',
              status: 'verified',
              paidAt: '2026-01-15T10:00:00Z',
              verifiedAt: '2026-01-15T10:05:00Z',
              verifiedById: adminUser.id,
              notes: 'Cash paid at the school office.',
            })
            .returning({ id: payments.id })
          paymentId = created?.id
        }

        if (paymentId) {
          // Receipt RCT-2026-0001 (idempotent on receipt number).
          const [existingReceipt] = await db
            .select({ id: paymentReceipts.id })
            .from(paymentReceipts)
            .where(eq(paymentReceipts.receiptNumber, 'RCT-2026-0001'))
            .limit(1)
          if (!existingReceipt) {
            await db.insert(paymentReceipts).values({
              receiptNumber: 'RCT-2026-0001',
              paymentId,
              objectKey: null,
              issuedById: adminUser.id,
              issuedAt: '2026-01-15T10:05:00Z',
            })
          }

          // Reflect the verified payment on a freshly created invoice.
          if (!existingInvoice && invoiceId) {
            await db
              .update(studentInvoices)
              .set({
                amountPaid: 3000000,
                balance: 2750000,
                status: 'partially_paid',
                updatedAt: isoNow(),
              })
              .where(eq(studentInvoices.id, invoiceId))
          }
        }
      }
    }

    // --- Phase 9: admissions pipeline (fake demo data) --------------------
    // Five applications across the workflow; idempotent on the
    // application number. Document rows use placeholder object keys
    // (no R2 bytes are uploaded by the seeder — downloads return 404).
    if (primaryId && adminUser) {
      const [enrolledStudent] = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.admissionNumber, 'STU-001'))
        .limit(1)

      type SeedDocument = {
        documentType: string
        objectKey: string
        fileName: string
        mimeType: string
        sizeBytes: number
      }
      type SeedAssessment = {
        title: string
        assessmentType: string
        scheduledAt: string
        score?: string | null
        result?: string | null
        notes?: string | null
      }
      type SeedApplication =
        typeof admissionApplications.$inferInsert & {
          documents: SeedDocument[]
          assessments: SeedAssessment[]
        }

      const applicationPlan: SeedApplication[] = [
        {
          applicationNumber: 'APP-2026-0001',
          sessionId: session.id,
          intendedClassId: primaryId,
          firstName: 'Amara',
          lastName: 'Okafor',
          gender: 'female',
          dateOfBirth: '2016-03-14',
          guardianName: 'Ngozi Okafor',
          guardianPhone: '+234 801 111 0001',
          guardianEmail: 'ngozi.okafor@example.test',
          address: '12 Demo Estate, Lagos',
          previousSchool: 'Sunrise Nursery',
          status: 'enrolled',
          decisionNotes:
            'Historical demo conversion; enrolled as student STU-001.',
          reviewedById: adminUser.id,
          reviewedAt: '2026-08-20T09:00:00Z',
          decidedAt: '2026-08-25T10:00:00Z',
          admittedStudentId: enrolledStudent?.id ?? null,
          documents: [],
          assessments: [],
        },
        {
          applicationNumber: 'APP-2026-0002',
          sessionId: session.id,
          intendedClassId: primaryId,
          firstName: 'Favour',
          lastName: 'Adeyemi',
          gender: 'female',
          dateOfBirth: '2016-04-02',
          guardianName: 'Samuel Adeyemi',
          guardianPhone: '+234 802 222 0002',
          guardianEmail: 'samuel.adeyemi@example.test',
          address: '5 Palm Avenue, Ibadan',
          previousSchool: 'Bright Start Academy',
          status: 'under_review',
          reviewedById: adminUser.id,
          reviewedAt: '2026-09-08T11:30:00Z',
          documents: [
            {
              documentType: 'Birth certificate',
              objectKey: 'seeds/admissions/app-0002-birth-certificate.pdf',
              fileName: 'birth-certificate.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 184320,
            },
            {
              documentType: 'Passport photograph',
              objectKey: 'seeds/admissions/app-0002-photo.jpg',
              fileName: 'photo.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 245760,
            },
          ],
          assessments: [
            {
              title: 'Parent interview',
              assessmentType: 'interview',
              scheduledAt: '2026-09-18T10:00:00Z',
            },
          ],
        },
        {
          applicationNumber: 'APP-2026-0003',
          sessionId: session.id,
          intendedClassId: primaryId,
          firstName: 'Musa',
          lastName: 'Ibrahim',
          gender: 'male',
          dateOfBirth: '2015-09-21',
          guardianName: 'Hauwa Ibrahim',
          guardianPhone: '+234 803 333 0003',
          guardianEmail: 'hauwa.ibrahim@example.test',
          address: '22 River Road, Kaduna',
          previousSchool: 'Al-Amin Nursery',
          status: 'accepted',
          decisionNotes:
            'Accepted for Primary 1 pending placement test confirmation.',
          reviewedById: adminUser.id,
          reviewedAt: '2026-09-01T08:15:00Z',
          decidedAt: '2026-09-09T14:00:00Z',
          documents: [
            {
              documentType: 'Previous report card / transcript',
              objectKey: 'seeds/admissions/app-0003-report-card.pdf',
              fileName: 'report-card.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 412672,
            },
          ],
          assessments: [
            {
              title: 'Placement test',
              assessmentType: 'test',
              scheduledAt: '2026-09-05T09:00:00Z',
              score: '82/100',
              result: 'pass',
              notes: 'Strong numeracy; average reading.',
            },
          ],
        },
        {
          applicationNumber: 'APP-2026-0004',
          sessionId: session.id,
          intendedClassId: primaryId,
          firstName: 'Esi',
          lastName: 'Mensah',
          gender: 'female',
          dateOfBirth: '2016-01-30',
          guardianName: 'Yaw Mensah',
          guardianPhone: '+233 24 444 0004',
          guardianEmail: 'yaw.mensah@example.test',
          address: '8 Hilltop Lane, Accra',
          previousSchool: null,
          status: 'applied',
          documents: [],
          assessments: [],
        },
        {
          applicationNumber: 'APP-2026-0005',
          sessionId: session.id,
          intendedClassId: primaryId,
          firstName: 'Tunde',
          lastName: 'Bakare',
          gender: 'male',
          dateOfBirth: '2015-12-11',
          guardianName: 'Funke Bakare',
          guardianPhone: '+234 805 555 0005',
          guardianEmail: 'funke.bakare@example.test',
          address: '3 Unity Close, Abuja',
          previousSchool: 'Gracefield School',
          status: 'rejected',
          decisionNotes:
            'No Primary 1 seat available for this session; encouraged to reapply next year.',
          reviewedById: adminUser.id,
          reviewedAt: '2026-08-28T10:00:00Z',
          decidedAt: '2026-09-02T16:30:00Z',
          documents: [],
          assessments: [],
        },
      ]

      for (const plan of applicationPlan) {
        const { documents, assessments, ...values } = plan
        const [existing] = await db
          .select({ id: admissionApplications.id })
          .from(admissionApplications)
          .where(
            eq(admissionApplications.applicationNumber, plan.applicationNumber!),
          )
          .limit(1)
        if (existing) {
          continue
        }
        const [created] = await db
          .insert(admissionApplications)
          .values(values)
          .returning({ id: admissionApplications.id })
        if (!created) {
          continue
        }

        for (const doc of documents) {
          await db.insert(admissionDocuments).values({
            applicationId: created.id,
            ...doc,
          })
        }
        for (const assessment of assessments) {
          await db.insert(admissionAssessments).values({
            applicationId: created.id,
            ...assessment,
            assessorId: adminUser.id,
          })
        }
      }
    }

    // --- Phase 10: communication, events & gallery (fake demo data) --------
    // Idempotent: announcements on title, notifications/messages on a
    // check for existing rows, events on title+startsAt, albums on
    // title. Gallery image rows use placeholder object keys (no R2
    // bytes — downloads will 404 until real uploads happen).
    if (adminUser) {
      const [superadminUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, 'superadmin@victoriouschildren.school'))
        .limit(1)
      const [teacherUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, 'teacher@victoriouschildren.school'))
        .limit(1)
      const [studentUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, 'student@victoriouschildren.school'))
        .limit(1)
      const [parentUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, 'parent@victoriouschildren.school'))
        .limit(1)

      // Announcements (idempotent on title).
      const seedAnnouncements = [
        {
          title: 'Welcome to the 2026-2027 academic year',
          body: 'Classes resume on Monday, 7 September 2026. All students should arrive by 7:45 AM.',
          audience: 'all' as const,
          status: 'published' as const,
          authorId: adminUser.id,
          publishedAt: '2026-09-01T08:00:00Z',
        },
        {
          title: 'Staff meeting — Friday 3 PM',
          body: 'All teaching staff are required to attend the curriculum planning meeting in the staff room.',
          audience: 'staff' as const,
          status: 'published' as const,
          authorId: adminUser.id,
          publishedAt: '2026-09-08T10:00:00Z',
        },
        {
          title: 'Parent-teacher conference draft',
          body: 'Draft agenda for the upcoming parent-teacher conference.',
          audience: 'parents' as const,
          status: 'draft' as const,
          authorId: adminUser.id,
        },
        {
          title: 'Old open day notice',
          body: 'The school open day has been rescheduled.',
          audience: 'all' as const,
          status: 'archived' as const,
          authorId: adminUser.id,
          publishedAt: '2026-08-15T09:00:00Z',
        },
      ]
      for (const a of seedAnnouncements) {
        const [existing] = await db
          .select({ id: announcements.id })
          .from(announcements)
          .where(eq(announcements.title, a.title))
          .limit(1)
        if (existing) continue
        await db.insert(announcements).values(a)
      }

      // Notifications (idempotent — check by title+userId).
      const seedNotifications = [
        { userId: adminUser.id, type: 'announcement', title: 'Welcome to the 2026-2027 academic year', body: 'Classes resume on Monday.', link: '/announcements', status: 'read' as const, readAt: '2026-09-02T08:00:00Z' },
        { userId: teacherUser?.id ?? adminUser.id, type: 'announcement', title: 'Staff meeting — Friday 3 PM', body: 'All teaching staff required.', link: '/announcements', status: 'unread' as const },
        { userId: studentUser?.id ?? adminUser.id, type: 'announcement', title: 'Welcome to the 2026-2027 academic year', body: 'Classes resume Monday.', link: '/announcements', status: 'read' as const, readAt: '2026-09-03T10:00:00Z' },
        { userId: parentUser?.id ?? adminUser.id, type: 'announcement', title: 'Welcome to the 2026-2027 academic year', body: 'Classes resume Monday.', link: '/announcements', status: 'unread' as const },
        { userId: superadminUser?.id ?? adminUser.id, type: 'announcement', title: 'Welcome to the 2026-2027 academic year', body: 'Classes resume Monday.', link: '/announcements', status: 'read' as const, readAt: '2026-09-01T12:00:00Z' },
      ]
      for (const n of seedNotifications) {
        const [existing] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, n.userId),
              eq(notifications.title, n.title),
            ),
          )
          .limit(1)
        if (existing) continue
        await db.insert(notifications).values(n)
      }

      // Messages (idempotent — check by body text).
      const seedMessages = [
        { senderId: adminUser.id, recipientId: teacherUser?.id ?? adminUser.id, direction: 'outbound' as const, subject: 'Lesson plan review', body: 'Please submit your updated lesson plans by Friday.', isRead: false },
        { senderId: teacherUser?.id ?? adminUser.id, recipientId: parentUser?.id ?? adminUser.id, direction: 'outbound' as const, subject: 'Student progress', body: 'Your child is doing well in mathematics.', isRead: true, readAt: '2026-09-10T14:00:00Z' },
        { senderId: parentUser?.id ?? adminUser.id, recipientId: adminUser.id, direction: 'outbound' as const, subject: 'Fee enquiry', body: 'When is the next fee payment due?', isRead: true, readAt: '2026-09-09T11:00:00Z' },
      ]
      for (const m of seedMessages) {
        const [existing] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.body, m.body))
          .limit(1)
        if (existing) continue
        await db.insert(messages).values(m)
      }

      // Events (idempotent on title + startsAt).
      const seedEvents: {
        title: string
        description: string
        startsAt: string
        endsAt: string | null
        location: string
        audience: (typeof audienceEnum.enumValues)[number]
        status: string
        createdById: string
      }[] = [
        {
          title: 'Annual Sports Day 2026',
          description: 'Inter-house athletics competition on the school field.',
          startsAt: '2026-10-18T09:00:00Z',
          endsAt: '2026-10-18T16:00:00Z',
          location: 'School Sports Field',
          audience: 'all',
          status: 'published',
          createdById: adminUser.id,
        },
        {
          title: 'Staff curriculum review',
          description: 'Termly curriculum planning meeting for all staff.',
          startsAt: '2026-09-12T15:00:00Z',
          endsAt: '2026-09-12T17:00:00Z',
          location: 'Staff Room',
          audience: 'staff',
          status: 'published',
          createdById: adminUser.id,
        },
        {
          title: 'Cultural Festival (draft)',
          description: 'Planning for the end-of-year cultural festival.',
          startsAt: '2026-12-05T10:00:00Z',
          endsAt: null,
          location: 'School Hall',
          audience: 'all',
          status: 'draft',
          createdById: adminUser.id,
        },
      ]
      const eventIds: { id: string; title: string }[] = []
      for (const e of seedEvents) {
        const [existing] = await db
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.title, e.title),
              eq(events.startsAt, e.startsAt),
            ),
          )
          .limit(1)
        if (existing) {
          eventIds.push({ id: existing.id, title: e.title })
          continue
        }
        const [created] = await db
          .insert(events)
          .values(e)
          .returning({ id: events.id, title: events.title })
        if (created) eventIds.push(created)
      }

      // Gallery albums (idempotent on title).
      const sportsDayEvent = eventIds.find(
        (e) => e.title === 'Annual Sports Day 2026',
      )
      const seedAlbums = [
        {
          title: 'Sports Day 2026',
          description: 'Photos from the annual sports day.',
          eventId: sportsDayEvent?.id ?? null,
          isPublished: true,
          createdById: adminUser.id,
        },
        {
          title: 'Cultural Festival',
          description: 'Behind the scenes preparation (unpublished).',
          eventId: null,
          isPublished: false,
          createdById: adminUser.id,
        },
      ]
      for (const album of seedAlbums) {
        const [existing] = await db
          .select({ id: galleryAlbums.id })
          .from(galleryAlbums)
          .where(eq(galleryAlbums.title, album.title))
          .limit(1)
        if (existing) continue
        const [created] = await db
          .insert(galleryAlbums)
          .values(album)
          .returning({ id: galleryAlbums.id })

        if (created) {
          const seedImages = [
            { objectKey: `gallery/albums/${created.id}/img1-placeholder.jpg`, fileName: 'opening-ceremony.jpg', mimeType: 'image/jpeg', sizeBytes: 1048576, caption: 'Opening ceremony' },
            { objectKey: `gallery/albums/${created.id}/img2-placeholder.jpg`, fileName: '100m-race.jpg', mimeType: 'image/jpeg', sizeBytes: 2097152, caption: '100m dash' },
            { objectKey: `gallery/albums/${created.id}/img3-placeholder.jpg`, fileName: 'award-ceremony.jpg', mimeType: 'image/jpeg', sizeBytes: 1572864, caption: 'Award ceremony' },
          ]
          for (const img of seedImages) {
            await db.insert(galleryImages).values({
              albumId: created.id,
              ...img,
            })
          }
        }
      }

      // --- Phase 11: audit log demo rows -----------------------------
      // Idempotent on the natural key (userId, action, resource,
      // createdAt). Fixed timestamps so re-running the seeder does not
      // double-insert. Metadata is a JSON string per the audit_logs
      // schema; nothing here is sensitive (passwords/tokens never
      // logged).
      const seedAuditLogs: {
        userId?: string
        action: string
        resource: string
        resourceId?: string | null
        description: string
        ipAddress?: string | null
        metadata?: Record<string, unknown> | null
        createdAt: string
      }[] = [
        {
          userId: superadminUser?.id,
          action: 'auth.login.success',
          resource: 'auth',
          resourceId: superadminUser?.id ?? null,
          description: 'Super admin signed in.',
          ipAddress: '127.0.0.1',
          createdAt: '2026-09-13T08:00:00Z',
        },
        {
          userId: superadminUser?.id,
          action: 'role.update',
          resource: 'role',
          description: 'Adjusted teacher role permissions.',
          ipAddress: '127.0.0.1',
          createdAt: '2026-09-13T16:00:00Z',
        },
        {
          userId: adminUser.id,
          action: 'student.create',
          resource: 'student',
          resourceId: '00000000-0000-0000-0000-000000000001',
          description: 'Created Amara Okafor (STU-001).',
          ipAddress: '10.0.0.5',
          metadata: { admissionNumber: 'STU-001', class: 'Primary 1' },
          createdAt: '2026-09-14T14:00:00Z',
        },
        {
          userId: adminUser.id,
          action: 'student.archive',
          resource: 'student',
          resourceId: '00000000-0000-0000-0000-000000000002',
          description: 'Archived STU-002 (graduated).',
          ipAddress: '10.0.0.5',
          createdAt: '2026-09-14T15:00:00Z',
        },
        {
          userId: adminUser.id,
          action: 'invoice.create',
          resource: 'invoice',
          resourceId: '00000000-0000-0000-0000-000000000003',
          description: 'Issued termly tuition invoice.',
          ipAddress: '10.0.0.5',
          metadata: { total: '50000.00', term: 'First' },
          createdAt: '2026-09-15T11:00:00Z',
        },
        {
          userId: teacherUser?.id,
          action: 'attendance.mark',
          resource: 'attendance_session',
          resourceId: '00000000-0000-0000-0000-000000000004',
          description: 'Marked Primary 1 attendance.',
          ipAddress: '10.0.0.12',
          createdAt: '2026-09-15T13:00:00Z',
        },
        {
          userId: adminUser.id,
          action: 'payment.verify',
          resource: 'payment',
          resourceId: '00000000-0000-0000-0000-000000000005',
          description: 'Verified bank transfer NGN 50,000.',
          ipAddress: '10.0.0.5',
          metadata: { method: 'bank_transfer', amount: '50000.00' },
          createdAt: '2026-09-15T15:30:00Z',
        },
        {
          userId: superadminUser?.id,
          action: 'announcement.publish',
          resource: 'announcement',
          resourceId: '00000000-0000-0000-0000-000000000006',
          description: 'Published welcome announcement.',
          ipAddress: '127.0.0.1',
          createdAt: '2026-09-16T09:00:00Z',
        },
        {
          userId: adminUser.id,
          action: 'admission.advance',
          resource: 'admission',
          resourceId: '00000000-0000-0000-0000-000000000007',
          description: 'Advanced STU-004 to under_review.',
          ipAddress: '10.0.0.5',
          metadata: { from: 'submitted', to: 'under_review' },
          createdAt: '2026-09-16T10:00:00Z',
        },
        {
          userId: superadminUser?.id,
          action: 'user.update',
          resource: 'user',
          resourceId: '00000000-0000-0000-0000-000000000008',
          description: 'Deactivated former staff account.',
          ipAddress: '127.0.0.1',
          createdAt: '2026-09-16T11:00:00Z',
        },
      ]
      for (const a of seedAuditLogs) {
        const [existing] = await db
          .select({ id: auditLogs.id })
          .from(auditLogs)
          .where(
            and(
              a.userId ? eq(auditLogs.userId, a.userId) : isNull(auditLogs.userId),
              eq(auditLogs.action, a.action),
              eq(auditLogs.resource, a.resource),
              eq(auditLogs.createdAt, a.createdAt),
            ),
          )
          .limit(1)
        if (existing) continue
        await db.insert(auditLogs).values({
          userId: a.userId ?? null,
          action: a.action,
          resource: a.resource,
          resourceId: a.resourceId ?? null,
          description: a.description,
          ipAddress: a.ipAddress ?? null,
          metadata: a.metadata ? JSON.stringify(a.metadata) : null,
          createdAt: a.createdAt,
        })
      }
    }
  }
}

