/**
 * Exams, assessments, grading, results and report cards (README §18).
 *
 * Grading scales and grade boundaries are configurable data rows with
 * NUMERIC ranges — never hard-coded in logic or UI. Money is not used
 * here, but scores and grade boundaries use NUMERIC for exactness.
 *
 * Result workflow: draft -> submitted -> approved -> published.
 * Students/parents only see published results.
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  date,
  numeric,
  boolean,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'
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

// Precision helpers for NUMERIC
const SCORE_PRECISION = { precision: 7, scale: 2 }

// ---------------------------------------------------------------------------
// Assessment types (configurable: CA/test, assignment, midterm, ...)
// ---------------------------------------------------------------------------
export const assessmentTypes = pgTable(
  'assessment_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    weight: numeric('weight', SCORE_PRECISION).default('1').notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('assessment_types_slug_idx').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
export const exams = pgTable(
  'exams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: uuid('term_id').references(() => terms.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    status: varchar('status', { length: 20 }).default('closed').notNull(), // open/closed
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    classIdx: index('exams_class_idx').on(t.classId, t.sessionId, t.termId),
  }),
)

// ---------------------------------------------------------------------------
// Exam subjects (subjects included in an exam)
// ---------------------------------------------------------------------------
export const examSubjects = pgTable(
  'exam_subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    maxScore: numeric('max_score', SCORE_PRECISION).default('100').notNull(),
    examDate: date('exam_date'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
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
export const gradingScales = pgTable(
  'grading_scales',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').references(() => academicSessions.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 150 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    nameIdx: index('grading_scales_name_idx').on(t.name),
  }),
)

// Grade boundary items (e.g. 70-100 = A). Configurable NUMERIC ranges.
export const gradingScaleItems = pgTable(
  'grading_scale_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scaleId: uuid('scale_id')
      .notNull()
      .references(() => gradingScales.id, { onDelete: 'cascade' }),
    grade: varchar('grade', { length: 10 }).notNull(),
    minScore: numeric('min_score', SCORE_PRECISION).notNull(),
    maxScore: numeric('max_score', SCORE_PRECISION).notNull(),
    remark: varchar('remark', { length: 150 }),
    points: numeric('points', SCORE_PRECISION),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
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
export const assessmentScores = pgTable(
  'assessment_scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: uuid('term_id').references(() => terms.id, { onDelete: 'cascade' }),
    assessmentTypeId: uuid('assessment_type_id')
      .notNull()
      .references(() => assessmentTypes.id, { onDelete: 'restrict' }),
    score: numeric('score', SCORE_PRECISION).notNull(),
    maxScore: numeric('max_score', SCORE_PRECISION).default('100').notNull(),
    enteredById: uuid('entered_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const examScores = pgTable(
  'exam_scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    examSubjectId: uuid('exam_subject_id')
      .notNull()
      .references(() => examSubjects.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    score: numeric('score', SCORE_PRECISION).notNull(),
    grade: varchar('grade', { length: 10 }), // computed from active scale
    enteredById: uuid('entered_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const resultPublications = pgTable(
  'result_publications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'cascade' }),
    termId: uuid('term_id')
      .notNull()
      .references(() => terms.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    status: resultStatusEnum('status').default('draft').notNull(),
    submittedById: uuid('submitted_by_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedById: uuid('approved_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    publishedById: uuid('published_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const reportCards = pgTable(
  'report_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => academicSessions.id, { onDelete: 'restrict' }),
    termId: uuid('term_id')
      .notNull()
      .references(() => terms.id, { onDelete: 'restrict' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),
    sectionId: uuid('section_id').references(() => sections.id, {
      onDelete: 'set null',
    }),
    totalScore: numeric('total_score', SCORE_PRECISION),
    averageScore: numeric('average_score', SCORE_PRECISION),
    overallGrade: varchar('overall_grade', { length: 10 }),
    attendanceSummary: text('attendance_summary'),
    teacherRemark: text('teacher_remark'),
    principalRemark: text('principal_remark'),
    objectKey: text('object_key'), // generated PDF in R2
    status: resultStatusEnum('status').default('draft').notNull(),
    generatedById: uuid('generated_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
