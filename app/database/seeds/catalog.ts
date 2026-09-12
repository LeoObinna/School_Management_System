/**
 * Seed catalog — pure data describing the initial RBAC setup.
 *
 * Permission slugs are the canonical list from README §8. Keeping this
 * as plain data (no DB imports) lets us unit-test role/permission
 * consistency and reuse it from the seed runner.
 */

// Canonical permission slugs (README §8). Groups are derived from the
// segment before the first dot purely for display/filtering.
export const PERMISSION_SLUGS = [
  'dashboard.view',
  'school.settings.view',
  'school.settings.update',
  'users.view',
  'users.create',
  'users.update',
  'users.delete',
  'roles.view',
  'roles.manage',
  'students.view',
  'students.create',
  'students.update',
  'students.delete',
  'students.archive',
  'students.export',
  'parents.view',
  'parents.create',
  'parents.update',
  'parents.link_children',
  'teachers.view',
  'teachers.create',
  'teachers.update',
  'teachers.delete',
  'staff.view',
  'staff.create',
  'staff.update',
  'staff.delete',
  'academic_sessions.view',
  'academic_sessions.manage',
  'terms.view',
  'terms.manage',
  'classes.view',
  'classes.manage',
  'sections.view',
  'sections.manage',
  'subjects.view',
  'subjects.manage',
  'class_subjects.manage',
  'teacher_assignments.manage',
  'enrollments.view',
  'enrollments.create',
  'enrollments.update',
  'attendance.view',
  'attendance.mark',
  'attendance.update',
  'attendance.approve',
  'attendance.export',
  'assignments.view',
  'assignments.create',
  'assignments.update',
  'assignments.delete',
  'submissions.view',
  'submissions.create',
  'submissions.grade',
  'resources.view',
  'resources.manage',
  'exams.view',
  'exams.create',
  'exams.update',
  'exam_results.view',
  'exam_results.enter',
  'exam_results.update',
  'exam_results.submit',
  'exam_results.approve',
  'exam_results.publish',
  'report_cards.view',
  'report_cards.generate',
  'report_cards.publish',
  'fees.view',
  'fees.manage_structure',
  'invoices.view',
  'invoices.create',
  'invoices.update',
  'payments.view',
  'payments.record',
  'payments.verify',
  'payments.refund',
  'receipts.view',
  'receipts.generate',
  'finance.export',
  'admissions.view',
  'admissions.create',
  'admissions.update',
  'admissions.review',
  'admissions.approve',
  'admissions.reject',
  'admissions.documents.view',
  'admissions.documents.manage',
  'timetable.view',
  'timetable.manage',
  'announcements.view',
  'announcements.create',
  'announcements.update',
  'announcements.publish',
  'notifications.view',
  'messages.view',
  'messages.send',
  'reports.view',
  'reports.export',
  'audit_logs.view',
] as const

export type PermissionSlug = (typeof PERMISSION_SLUGS)[number]

export interface PermissionSeed {
  slug: PermissionSlug
  name: string
  group: string
}

function humanize(slug: string): string {
  return slug
    .split('.')
    .map((part) =>
      part
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    )
    .join(' › ')
}

export const PERMISSIONS: PermissionSeed[] = PERMISSION_SLUGS.map((slug) => ({
  slug,
  name: humanize(slug),
  group: slug.split('.')[0] ?? '',
}))

// ---------------------------------------------------------------------------
// Roles (README §7)
// ---------------------------------------------------------------------------
export interface RoleSeed {
  slug: 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent'
  name: string
  description: string
  isSystem: boolean
}

export const ROLES: RoleSeed[] = [
  {
    slug: 'super_admin',
    name: 'Super Admin',
    description:
      'System-level operator: roles, permissions, settings, integrations, storage and audit logs.',
    isSystem: true,
  },
  {
    slug: 'admin',
    name: 'Admin',
    description:
      'Broad school operations across people, academics, admissions, attendance, results, finance and communications.',
    isSystem: true,
  },
  {
    slug: 'teacher',
    name: 'Teacher',
    description:
      'Assigned classes and subjects, attendance, assignments, resources and result entry/submission.',
    isSystem: false,
  },
  {
    slug: 'student',
    name: 'Student',
    description:
      'Own profile, timetable, attendance, assignments, submissions and published results.',
    isSystem: false,
  },
  {
    slug: 'parent',
    name: 'Parent',
    description:
      'Own account and linked children: academics, attendance, results, fees and communications.',
    isSystem: false,
  },
]

// Super Admin implicitly holds every permission (handled in code); it is
// also granted all rows explicitly for transparent reporting.
const ALL: PermissionSlug[] = PERMISSION_SLUGS.slice()

// Admin: broad operations, but not role/permission administration or
// system-level audit access.
const ADMIN_EXCLUDE: PermissionSlug[] = ['roles.manage', 'audit_logs.view']

// Teacher: classroom delivery and grading. No finance access.
const TEACHER_PERMISSIONS: PermissionSlug[] = [
  'dashboard.view',
  'students.view',
  'parents.view',
  'teachers.view',
  'academic_sessions.view',
  'terms.view',
  'classes.view',
  'sections.view',
  'subjects.view',
  'enrollments.view',
  'attendance.view',
  'attendance.mark',
  'attendance.update',
  'assignments.view',
  'assignments.create',
  'assignments.update',
  'assignments.delete',
  'submissions.view',
  'submissions.grade',
  'resources.view',
  'resources.manage',
  'exams.view',
  'exam_results.view',
  'exam_results.enter',
  'exam_results.update',
  'exam_results.submit',
  'report_cards.view',
  'timetable.view',
  'announcements.view',
  'notifications.view',
  'messages.view',
  'messages.send',
  'reports.view',
]

// Student: own learning view only.
const STUDENT_PERMISSIONS: PermissionSlug[] = [
  'dashboard.view',
  'assignments.view',
  'submissions.view',
  'submissions.create',
  'resources.view',
  'attendance.view',
  'timetable.view',
  'exam_results.view',
  'report_cards.view',
  'announcements.view',
  'notifications.view',
  'messages.view',
  'messages.send',
]

// Parent: linked-children view plus fee visibility.
const PARENT_PERMISSIONS: PermissionSlug[] = [
  'dashboard.view',
  'students.view',
  'attendance.view',
  'timetable.view',
  'exam_results.view',
  'report_cards.view',
  'fees.view',
  'invoices.view',
  'payments.view',
  'receipts.view',
  'announcements.view',
  'notifications.view',
  'messages.view',
  'messages.send',
]

export const ROLE_PERMISSIONS: Record<RoleSeed['slug'], PermissionSlug[]> = {
  super_admin: ALL,
  admin: ALL.filter((slug) => !ADMIN_EXCLUDE.includes(slug)),
  teacher: TEACHER_PERMISSIONS,
  student: STUDENT_PERMISSIONS,
  parent: PARENT_PERMISSIONS,
}
