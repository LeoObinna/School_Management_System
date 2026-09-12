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
 *
 * Run via `npm run db:seed` (uses database/seed.ts). Safe to re-run:
 * every row upserts on its natural unique key and join rows use
 * ON CONFLICT DO NOTHING (assignments pre-check because their unique
 * index includes a nullable section).
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
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
} from '../schema'
import type { Schema } from '../schema'
import { hashPassword } from '../../server/utils/auth/password'
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from './catalog'

export type DB = PostgresJsDatabase<Schema>

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'password123'

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
  { key: 'school.email', value: 'info@victoriouschildren.school', type: 'string', group: 'general' },
  { key: 'school.phone', value: '', type: 'string', group: 'general' },
  { key: 'school.address', value: '', type: 'string', group: 'general' },
  { key: 'school.currency', value: 'NGN', type: 'string', group: 'finance' },
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
  const permissionRows = await db
    .insert(permissions)
    .values(PERMISSIONS.map((p) => ({ name: p.name, slug: p.slug, group: p.group })))
    .onConflictDoUpdate({
      target: permissions.slug,
      set: { name: sql`excluded.name`, group: sql`excluded."group"` },
    })
    .returning({ id: permissions.id, slug: permissions.slug })

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
      set: { updatedAt: new Date() },
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
      await db.insert(rolePermissions).values(links).onConflictDoNothing()
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
        emailVerifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        // Demo only: keep credentials working across re-seeds (also
        // upgrades older scrypt hashes to the current PBKDF2 format).
        set: {
          name: demo.name,
          password: demoPasswordHash,
          updatedAt: new Date(),
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
        set: { value: setting.value, type: setting.type, updatedAt: new Date() },
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
      set: { isCurrent: true, updatedAt: new Date() },
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
          set: { updatedAt: new Date() },
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
        set: { updatedAt: new Date() },
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
        set: { updatedAt: new Date() },
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
        set: { updatedAt: new Date() },
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
        set: { userId, email: teacher.email, updatedAt: new Date() },
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
          set: { userId, updatedAt: new Date() },
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
          set: { userId, updatedAt: new Date() },
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
  }
}
