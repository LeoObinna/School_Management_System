/**
 * Shared TypeScript types used by both client (app/) and server (server/).
 *
 * These types describe the core domain entities. More types are added
 * per module in Phase 1+.
 */

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  service: string
  version: string
  timestamp: string
  database: boolean
}

export interface ApiErrorShape {
  message: string
  status: number | null
  errors?: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// Auth & Users
// ---------------------------------------------------------------------------

export interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  isActive: boolean
  emailVerifiedAt?: string | null
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  name: string
  slug: string
  description?: string | null
  createdAt: string
  updatedAt: string
}

// Authenticated user as returned by the API — never includes password.
export interface AuthUser {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  isActive: boolean
}

// GET /api/v1/auth/me
export interface AuthSessionResponse {
  user: AuthUser
  roles: RoleSlug[]
  permissions: string[]
  csrfToken: string
}

// POST /api/v1/auth/login
export type LoginResponse = AuthSessionResponse

export interface MessageResponse {
  message: string
}

export interface Permission {
  id: string
  name: string
  slug: string
  group?: string | null
  description?: string | null
}

// Initial roles per README §7
export type RoleSlug =
  | 'super_admin'
  | 'admin'
  | 'teacher'
  | 'student'
  | 'parent'

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  data: T[]
  meta: {
    currentPage: number
    perPage: number
    total: number
    lastPage: number
  }
}

// ---------------------------------------------------------------------------
// Academic foundation (README §13, Phase 3)
// ---------------------------------------------------------------------------

export interface AcademicSession {
  id: string
  name: string
  slug: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Term {
  id: string
  sessionId: string
  name: string
  slug: string
  sequence: number
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SchoolClass {
  id: string
  name: string
  slug: string
  level: string | null
  sequence: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: string
  classId: string
  name: string
  slug: string
  capacity: number | null
  room: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Subject {
  id: string
  name: string
  slug: string
  code: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ClassSubject {
  classId: string
  subjectId: string
  isCompulsory: boolean
  maxScore: number | null
  createdAt: string
}

// Class-subject row joined with the subject catalog.
export interface ClassSubjectDetail extends ClassSubject {
  subject: Subject
}

export interface TeacherSubject {
  teacherId: string
  subjectId: string
  createdAt: string
}

export interface TeacherSubjectDetail extends TeacherSubject {
  subject: Subject
}

export interface TeacherClassAssignment {
  id: string
  teacherId: string
  classId: string
  sectionId: string | null
  subjectId: string
  sessionId: string
  isPrimaryTeacher: boolean
  createdAt: string
}

// Assignment row joined with the related display names.
export interface TeacherClassAssignmentDetail
  extends TeacherClassAssignment {
  teacherName: string
  className: string
  sectionName: string | null
  subjectName: string
  sessionName: string
}

// ---------------------------------------------------------------------------
// Result workflow (README §18)
// ---------------------------------------------------------------------------

export type ResultStatus = 'draft' | 'submitted' | 'approved' | 'published'

// ---------------------------------------------------------------------------
// Attendance statuses (README §15)
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

// ---------------------------------------------------------------------------
// Student lifecycle (README §14)
// ---------------------------------------------------------------------------

export type StudentStatus =
  | 'applicant'
  | 'admitted'
  | 'enrolled'
  | 'active'
  | 'graduated'
  | 'transferred'
  | 'withdrawn'
  | 'archived'

// ---------------------------------------------------------------------------
// People (README §14, Phase 4)
// ---------------------------------------------------------------------------

export interface Student {
  id: string
  userId: string | null
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  dateOfBirth: string | null
  bloodGroup: string | null
  nationality: string | null
  religion: string | null
  address: string | null
  photoUrl: string | null
  status: StudentStatus
  currentClassId: string | null
  currentSectionId: string | null
  enrolledAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type Gender = 'male' | 'female' | 'other'

export interface Parent {
  id: string
  userId: string | null
  firstName: string
  lastName: string
  otherNames: string | null
  email: string | null
  phone: string | null
  gender: string | null
  occupation: string | null
  address: string | null
  photoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Teacher {
  id: string
  userId: string | null
  staffNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  email: string | null
  phone: string | null
  gender: string | null
  qualification: string | null
  specialization: string | null
  address: string | null
  photoUrl: string | null
  hiredAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface StaffProfile {
  id: string
  userId: string | null
  staffNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  jobTitle: string | null
  department: string | null
  email: string | null
  phone: string | null
  gender: string | null
  hiredAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface StudentParent {
  studentId: string
  parentId: string
  relationship: string
  isPrimary: boolean
  isEmergencyContact: boolean
  createdAt: string
}

// Student-parent link joined with the parent profile.
export interface StudentParentDetail extends StudentParent {
  parent: Parent
}

// Parent's children listing (parent id + link joined with student).
export interface ParentChildDetail extends StudentParent {
  student: Student
}

// ---------------------------------------------------------------------------
// Student enrollments (README §14)
// ---------------------------------------------------------------------------

export type EnrollmentStatus =
  | 'active'
  | 'completed'
  | 'promoted'
  | 'repeated'
  | 'withdrawn'

export interface StudentEnrollment {
  id: string
  studentId: string
  sessionId: string
  termId: string | null
  classId: string
  sectionId: string | null
  rollNumber: string | null
  enrollmentDate: string
  status: EnrollmentStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface StudentEnrollmentDetail extends StudentEnrollment {
  studentName: string
  className: string
  sectionName: string | null
  sessionName: string
  termName: string | null
}

// ---------------------------------------------------------------------------
// Timetable (README §16)
// ---------------------------------------------------------------------------

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface TimetableEntry {
  id: string
  sessionId: string
  termId: string | null
  classId: string
  sectionId: string | null
  subjectId: string
  teacherId: string
  room: string | null
  weekday: Weekday
  startTime: string
  endTime: string
  createdAt: string
  updatedAt: string
}

export interface TimetableEntryDetail extends TimetableEntry {
  className: string
  sectionName: string | null
  subjectName: string
  teacherName: string
  sessionName: string
  termName: string | null
}

// ---------------------------------------------------------------------------
// Attendance (README §15)
// ---------------------------------------------------------------------------

export type AttendanceSessionStatus = 'open' | 'submitted' | 'approved'

export interface AttendanceSession {
  id: string
  sessionId: string
  termId: string | null
  classId: string
  sectionId: string | null
  date: string
  status: AttendanceSessionStatus
  markedById: string | null
  approvedById: string | null
  approvedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AttendanceRecord {
  id: string
  attendanceSessionId: string
  studentId: string
  status: AttendanceStatus
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface AttendanceRecordDetail extends AttendanceRecord {
  studentName: string
  admissionNumber: string
}

export interface AttendanceSessionDetail extends AttendanceSession {
  className: string
  sectionName: string | null
  sessionName: string
  termName: string | null
  records: AttendanceRecordDetail[]
}

// List rows summarize the register header plus record count and names.
export interface AttendanceSessionListItem extends AttendanceSession {
  className: string
  sectionName: string | null
  termName: string | null
  recordCount: number
}

// One row of a class attendance percentage report.
export interface AttendanceReportRow {
  studentId: string
  admissionNumber: string
  studentName: string
  total: number
  present: number
  absent: number
  late: number
  excused: number
  // (present + late) / total, rounded to 1 dp; null when no records.
  attendanceRate: number | null
}

// A single day in a student's attendance history.
export interface StudentAttendanceDay {
  attendanceSessionId: string
  date: string
  status: AttendanceStatus
  remark: string | null
  className: string
  sectionName: string | null
  sessionStatus: AttendanceSessionStatus
}

export interface StudentAttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  excused: number
  attendanceRate: number | null
}

// ---------------------------------------------------------------------------
// Assignments, attachments and submissions (README §17)
// ---------------------------------------------------------------------------

export type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'late'
  | 'graded'
  | 'returned'

export interface Assignment {
  id: string
  teacherId: string
  classId: string
  sectionId: string | null
  subjectId: string
  sessionId: string
  termId: string | null
  title: string
  instructions: string | null
  maxScore: number
  dueDate: string | null
  publishedAt: string | null
  status: PublicationStatus
  createdAt: string
  updatedAt: string
}

export interface AssignmentAttachment {
  id: string
  assignmentId: string
  objectKey: string
  fileName: string
  mimeType: string | null
  sizeBytes: number
  uploadedById: string | null
  createdAt: string
}

export interface AssignmentSubmission {
  id: string
  assignmentId: string
  studentId: string
  textContent: string | null
  objectKey: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  submittedAt: string | null
  status: SubmissionStatus
  score: number | null
  feedback: string | null
  gradedById: string | null
  gradedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AssignmentDetail extends Assignment {
  className: string
  sectionName: string | null
  subjectName: string
  teacherName: string
  sessionName: string
  termName: string | null
  attachments: AssignmentAttachment[]
}

export interface AssignmentListItem extends Assignment {
  className: string
  sectionName: string | null
  subjectName: string
  teacherName: string
  // Populated on student-facing lists.
  mySubmission: AssignmentSubmission | null
}

export interface SubmissionDetail extends AssignmentSubmission {
  studentName: string
  admissionNumber: string
  assignmentTitle: string
  maxScore: number
}

// ---------------------------------------------------------------------------
// Learning resources
// ---------------------------------------------------------------------------

export interface LearningResource {
  id: string
  title: string
  description: string | null
  classId: string | null
  subjectId: string | null
  uploadedById: string | null
  objectKey: string
  fileName: string
  mimeType: string | null
  isPublished: boolean
  createdAt: string
}

export interface LearningResourceListItem extends LearningResource {
  className: string | null
  subjectName: string | null
  uploadedByName: string | null
}

// ---------------------------------------------------------------------------
// Exams, assessments, grading, results & report cards (README §18, Phase 7)
// ---------------------------------------------------------------------------

export type ExamStatus = 'open' | 'closed'

export interface AssessmentType {
  id: string
  name: string
  slug: string
  weight: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface GradingScaleItem {
  id: string
  scaleId: string
  grade: string
  minScore: string
  maxScore: string
  remark: string | null
  points: string | null
  createdAt: string
}

export interface GradingScale {
  id: string
  sessionId: string | null
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GradingScaleDetail extends GradingScale {
  items: GradingScaleItem[]
}

export interface Exam {
  id: string
  sessionId: string
  termId: string | null
  classId: string
  name: string
  startDate: string | null
  endDate: string | null
  status: ExamStatus
  createdAt: string
  updatedAt: string
}

export interface ExamSubject {
  id: string
  examId: string
  subjectId: string
  maxScore: string
  examDate: string | null
  createdAt: string
}

export interface ExamSubjectDetail extends ExamSubject {
  subjectName: string
  subjectCode: string | null
}

export interface ExamDetail extends Exam {
  className: string
  sessionName: string
  termName: string | null
  subjects: ExamSubjectDetail[]
}

export interface ExamListItem extends Exam {
  className: string
  sessionName: string
  termName: string | null
  subjectCount: number
}

export interface AssessmentScore {
  id: string
  studentId: string
  subjectId: string
  sessionId: string
  termId: string | null
  assessmentTypeId: string
  score: string
  maxScore: string
  enteredById: string | null
  createdAt: string
  updatedAt: string
}

export interface AssessmentScoreDetail extends AssessmentScore {
  studentName: string
  admissionNumber: string
  subjectName: string
  assessmentTypeName: string
}

export interface ExamScore {
  id: string
  examSubjectId: string
  studentId: string
  score: string
  grade: string | null
  enteredById: string | null
  createdAt: string
  updatedAt: string
}

export interface ExamScoreDetail extends ExamScore {
  studentName: string
  admissionNumber: string
  subjectName: string
  subjectCode: string | null
  maxScore: string
  examDate: string | null
}

export interface ResultPublication {
  id: string
  sessionId: string
  termId: string
  classId: string
  sectionId: string | null
  status: ResultStatus
  submittedById: string | null
  submittedAt: string | null
  approvedById: string | null
  approvedAt: string | null
  publishedById: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ResultPublicationDetail extends ResultPublication {
  className: string
  sectionName: string | null
  sessionName: string
  termName: string | null
}

export interface ReportCard {
  id: string
  studentId: string
  sessionId: string
  termId: string
  classId: string
  sectionId: string | null
  totalScore: string | null
  averageScore: string | null
  overallGrade: string | null
  attendanceSummary: string | null
  teacherRemark: string | null
  principalRemark: string | null
  objectKey: string | null
  status: ResultStatus
  generatedById: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReportCardDetail extends ReportCard {
  studentName: string
  admissionNumber: string
  className: string
  sectionName: string | null
  sessionName: string
  termName: string | null
  subjectResults: SubjectResult[]
}

// One subject's aggregated result for a student.
export interface SubjectResult {
  subjectId: string
  subjectName: string
  subjectCode: string | null
  assessmentScores: {
    assessmentTypeId: string
    assessmentTypeName: string
    score: string
    maxScore: string
  }[]
  examScores: {
    examId: string
    examName: string
    score: string
    maxScore: string
    grade: string | null
  }[]
  totalScore: string
  maxScore: string
  percentage: string
  grade: string | null
}

// Student-wide summary returned by GET /students/{id}/results.
export interface StudentResultSummary {
  studentId: string
  studentName: string
  admissionNumber: string
  sessionId: string
  sessionName: string
  termId: string | null
  termName: string | null
  classId: string | null
  className: string | null
  publicationStatus: ResultStatus | null
  subjects: SubjectResult[]
  totalScore: string | null
  averageScore: string | null
  overallGrade: string | null
}

// GET /api/v1/my/school-context — resolves the current user's student id
// (for student logins) or list of children (for parent logins). Staff get
// null fields; the /results page is not for them.
export interface MySchoolContext {
  studentId: string | null
  children: {
    id: string
    admissionNumber: string | null
    name: string
  }[]
}

// ---------------------------------------------------------------------------
// Phase 8 — Finance (README §19)
// ---------------------------------------------------------------------------
export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'

export type PaymentStatus = 'pending' | 'verified' | 'failed' | 'refunded'

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'card'
  | 'online_gateway'
  | 'cheque'
  | 'other'

export interface FeeItem {
  id: string
  feeStructureId: string
  name: string
  description: string | null
  amount: string
  isOptional: boolean
  dueDate: string | null
  createdAt: string
}

export interface FeeStructure {
  id: string
  sessionId: string
  classId: string | null
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface FeeStructureDetail extends FeeStructure {
  sessionName: string
  className: string | null
  items: FeeItem[]
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  feeItemId: string | null
  description: string
  quantity: number
  unitAmount: string
  lineTotal: string
  createdAt: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  studentId: string
  sessionId: string
  termId: string | null
  issueDate: string
  dueDate: string | null
  subtotal: string
  discount: string
  tax: string
  total: string
  amountPaid: string
  balance: string
  status: InvoiceStatus
  notes: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceListItem extends Invoice {
  studentName: string
  admissionNumber: string
  className: string | null
  sessionName: string
  termName: string | null
  overdue: boolean
}

export interface PaymentReceipt {
  id: string
  receiptNumber: string
  paymentId: string
  objectKey: string | null
  issuedById: string | null
  issuedAt: string
  createdAt: string
}

export interface InvoicePaymentSummary {
  id: string
  paymentReference: string
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  paidAt: string | null
  createdAt: string
  receiptNumber: string | null
}

export interface InvoiceDetail extends InvoiceListItem {
  items: InvoiceItem[]
  payments: InvoicePaymentSummary[]
}

export interface Payment {
  id: string
  paymentReference: string
  invoiceId: string
  studentId: string
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  providerReference: string | null
  idempotencyKey: string | null
  webhookPayload: string | null
  paidAt: string | null
  verifiedAt: string | null
  verifiedById: string | null
  refundedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentListItem extends Payment {
  invoiceNumber: string
  studentName: string
  admissionNumber: string
  receiptNumber: string | null
}

export interface PaymentDetail extends PaymentListItem {
  receipt: PaymentReceipt | null
}

// GET /finance/outstanding row — invoice + derived overdue flag.
export interface OutstandingRow {
  id: string
  invoiceNumber: string
  studentId: string
  studentName: string
  admissionNumber: string
  className: string | null
  sessionName: string
  termName: string | null
  issueDate: string
  dueDate: string | null
  total: string
  amountPaid: string
  balance: string
  status: InvoiceStatus
  overdue: boolean
}

// GET /finance/summary
export interface FinanceSummary {
  sessionId: string | null
  termId: string | null
  totalInvoiced: string
  totalCollected: string
  totalRefunded: string
  totalOutstanding: string
  invoicesByStatus: Record<InvoiceStatus, number>
  paymentsByMethod: {
    method: PaymentMethod
    count: number
    total: string
  }[]
}

// ---------------------------------------------------------------------------
// Admissions (README §20, Phase 9)
// ---------------------------------------------------------------------------
export type AdmissionStatus =
  | 'applied'
  | 'documents_submitted'
  | 'under_review'
  | 'assessment_scheduled'
  | 'assessed'
  | 'accepted'
  | 'rejected'
  | 'waitlisted'
  | 'admitted'
  | 'enrolled'
  | 'withdrawn'

export type AdmissionAssessmentType =
  | 'exam'
  | 'interview'
  | 'test'
  | 'other'
export type AdmissionAssessmentResult = 'pass' | 'fail' | 'consider'

export interface AdmissionApplication {
  id: string
  applicationNumber: string
  sessionId: string | null
  intendedClassId: string | null
  firstName: string
  lastName: string
  otherNames: string | null
  gender: Gender | null
  dateOfBirth: string | null
  nationality: string | null
  guardianName: string | null
  guardianPhone: string | null
  guardianEmail: string | null
  address: string | null
  status: AdmissionStatus
  previousSchool: string | null
  decisionNotes: string | null
  reviewedById: string | null
  reviewedAt: string | null
  decidedAt: string | null
  admittedStudentId: string | null
  createdAt: string
  updatedAt: string
}

export interface AdmissionApplicationListItem extends AdmissionApplication {
  applicantName: string
  sessionName: string | null
  className: string | null
  documentCount: number
  assessmentCount: number
}

export interface AdmissionDocument {
  id: string
  applicationId: string
  documentType: string
  objectKey: string
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedAt: string
}

export interface AdmissionAssessment {
  id: string
  applicationId: string
  title: string
  assessmentType: AdmissionAssessmentType | null
  scheduledAt: string | null
  score: string | null
  result: AdmissionAssessmentResult | null
  assessorId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AdmissionApplicationDetail extends AdmissionApplication {
  sessionName: string | null
  className: string | null
  documents: AdmissionDocument[]
  assessments: AdmissionAssessment[]
}

export interface AdmissionEnrollResult {
  application: AdmissionApplicationDetail
  student: Student
  enrollment: StudentEnrollmentDetail
  parent: Parent | null
}
