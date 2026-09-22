/**
 * Exams, assessments, grading, results and report cards (README §18).
 *
 * Grading scales and grade boundaries are configurable data rows with
 * INTEGER ranges (×100 fixed-point per the v2.0 spec) — never
 * hard-coded in logic or UI. Money is not used here; scores and grade
 * boundaries use INTEGER ×100 for exactness.
 *
 * Result workflow: draft -> submitted -> approved -> published.
 * Students/parents only see published results.
 *
 * Phase 2 of the D1 migration (2026-09-22) converted PG types to
 * SQLite/D1: `numeric` scores → `integer` ×100 fixed-point (e.g.
 * 85.5 → 8550, 100 → 10000), `uuid` → `text` IDs, `timestamp` →
 * text ISO-8601, `date` → text YYYY-MM-DD, `boolean` → integer 0/1.
 * Phase 3 adapts the service layer to read/write ×100 values.
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { students, teachers } from './people'
import {
  academicSessions,
  terms,
  classes,
  sections,
  subjects,
} from './academics'
import { resultStatusEnum } from './enums'
import { users } from './core'

// ---------------------------------------------------------------------------
// Assessment types (configurable: CA/test, assignment, midterm, ...)
// ---------------------------------------------------------------------------
export const assessmentTypes = sqliteTable(
  'assessment_types',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    // Weight ×100 (e.g. weight 0.4 → 40, weight 1.0 → 100).
    weight: integer('weight').default(100).notNull(),
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('assessment_types_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
export const exams = sqliteTable(
  'exams',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'cascade',
    }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: text('start_date'),
    endDate: text('end_date'),
    status: text('status').default('closed').notNull(), // open/closed
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    classIdx: index('exams_class_idx').on(t.classId, t.sessionId, t.termId),
  }),
)

// ---------------------------------------------------------------------------
// Exam subjects (subjects included in an exam)
// ---------------------------------------------------------------------------
export const examSubjects = sqliteTable(
  'exam_subjects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    examId: text('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    // Max score ×100 (default 100 → 10000).
    maxScore: integer('max_score').default(10000).notNull(),
    examDate: text('exam_date'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    uniqueExamSubject: uniqueIndex('exam_subjects_unique_idx').on(
      t.examId,
      t.subjectId,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Grading scales (configurable)
// ---------------------------------------------------------------------------
export const gradingScales = sqliteTable(
  'grading_scales',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => academicSessions.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    isActive: integer('is_active', { mode: 'boolean' })
      .default(true)
      .notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    nameIdx: index('grading_scales_name_idx').on(t.name),
  }),
)

// Grade boundary items (e.g. 70-100 = A). Configurable INTEGER ×100 ranges.
export const gradingScaleItems = sqliteTable(
  'grading_scale_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scaleId: text('scale_id')
      .notNull()
      .references(() => gradingScales.id, { onDelete: 'cascade' }),
    grade: text('grade').notNull(),
    // Min/max score ×100 (e.g. 70 → 7000, 100 → 10000).
    minScore: integer('min_score').notNull(),
    maxScore: integer('max_score').notNull(),
    remark: text('remark'),
    points: integer('points'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    scaleGradeIdx: uniqueIndex('grading_items_scale_grade_idx').on(
      t.scaleId,
      t.grade,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Assessment (continuous-assessment) scores
// ---------------------------------------------------------------------------
export const assessmentScores = sqliteTable(
  'assessment_scores',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: text('term_id').references(() => terms.id, {
      onDelete: 'cascade',
    }),
    assessmentTypeId: text('assessment_type_id')
      .notNull()
      .references(() => assessmentTypes.id, { onDelete: 'restrict' }),
    // Score ×100 (e.g. 85.5 → 8550).
    score: integer('score').notNull(),
    // Max score ×100 (default 100 → 10000).
    maxScore: integer('max_score').default(10000).notNull(),
    enteredById: text('entered_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    uniqueScore: uniqueIndex('assessment_scores_unique_idx').on(
      t.studentId,
      t.subjectId,
      t.sessionId,
      t.termId,
      t.assessmentTypeId,
    ),
    studentIdx: index('assessment_scores_student_idx').on(
      t.studentId,
      t.sessionId,
      t.termId,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Exam scores
// ---------------------------------------------------------------------------
export const examScores = sqliteTable(
  'exam_scores',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    examSubjectId: text('exam_subject_id')
      .notNull()
      .references(() => examSubjects.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    // Score ×100 (e.g. 85.5 → 8550).
    score: integer('score').notNull(),
    grade: text('grade'), // computed from active scale
    enteredById: text('entered_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    uniqueExamScore: uniqueIndex('exam_scores_unique_idx').on(
      t.examSubjectId,
      t.studentId,
    ),
    studentIdx: index('exam_scores_student_idx').on(t.studentId),
  }),
)

// ---------------------------------------------------------------------------
// Result publications (workflow state per session/term/class)
// ---------------------------------------------------------------------------
export const resultPublications = sqliteTable(
  'result_publications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: text('term_id')
      .notNull()
      .references(() => terms.id, { onDelete: 'cascade' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: text('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    status: resultStatusEnum('status').default('draft').notNull(),
    submittedById: text('submitted_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    submittedAt: text('submitted_at'),
    approvedById: text('approved_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: text('approved_at'),
    publishedById: text('published_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: text('published_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    uniquePublication: uniqueIndex('result_publications_unique_idx').on(
      t.sessionId,
      t.termId,
      t.classId,
      t.sectionId,
    ),
  }),
)

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------
export const reportCards = sqliteTable(
  'report_cards',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'restrict' }),
    termId: text('term_id')
      .notNull()
      .references(() => terms.id, { onDelete: 'restrict' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),
    sectionId: text('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    // Total/average ×100 (e.g. 850.5 → 85050).
    totalScore: integer('total_score'),
    averageScore: integer('average_score'),
    overallGrade: text('overall_grade'),
    attendanceSummary: text('attendance_summary'),
    teacherRemark: text('teacher_remark'),
    principalRemark: text('principal_remark'),
    objectKey: text('object_key'), // generated PDF in R2
    status: resultStatusEnum('status').default('draft').notNull(),
    generatedById: text('generated_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: text('published_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (t) => ({
    uniqueReportCard: uniqueIndex('report_cards_unique_idx').on(
      t.studentId,
      t.sessionId,
      t.termId,
    ),
    studentIdx: index('report_cards_student_idx').on(t.studentId),
  }),
)
