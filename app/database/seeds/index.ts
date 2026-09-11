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
}
