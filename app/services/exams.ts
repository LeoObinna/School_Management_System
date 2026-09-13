/**
 * Exams, scores, results and report-card API access layer
 * (README §18, Phase 7). Mirrors the Nitro routes under /api/v1.
 */
import { api } from './api'
import type {
  AssessmentScoreBulk,
  AssessmentScoreListQuery,
  AssessmentScoreUpsert,
  AssessmentTypeCreate,
  AssessmentTypeUpdate,
  ExamCreate,
  ExamListQuery,
  ExamScoreBulk,
  ExamSubjectUpsert,
  ExamUpdate,
  GradingScaleCreate,
  GradingScaleUpdate,
  ReportCardGenerate,
  ResultPublicationCreate,
  ResultPublicationListQuery,
} from '~/shared/schemas'
import type {
  AssessmentScoreDetail,
  AssessmentType,
  ExamDetail,
  ExamListItem,
  GradingScaleDetail,
  MySchoolContext,
  ReportCardDetail,
  ResultPublicationDetail,
  StudentResultSummary,
} from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

export const examsApi = {
  // --- Assessment types -------------------------------------------------
  listAssessmentTypes: (params?: Params) =>
    api.get<{ data: AssessmentType[] }>('/assessment-types', { params }),
  createAssessmentType: (body: AssessmentTypeCreate) =>
    api.post<AssessmentType>('/assessment-types', body),
  updateAssessmentType: (id: string, body: AssessmentTypeUpdate) =>
    api.put<AssessmentType>(`/assessment-types/${id}`, body),

  // --- Grading scales ---------------------------------------------------
  listGradingScales: (params?: Params) =>
    api.get<{ data: GradingScaleDetail[] }>('/grading-scales', { params }),
  createGradingScale: (body: GradingScaleCreate) =>
    api.post<GradingScaleDetail>('/grading-scales', body),
  getGradingScale: (id: string) =>
    api.get<GradingScaleDetail>(`/grading-scales/${id}`),
  updateGradingScale: (id: string, body: GradingScaleUpdate) =>
    api.put<GradingScaleDetail>(`/grading-scales/${id}`, body),

  // --- Exams ------------------------------------------------------------
  listExams: (params?: Partial<ExamListQuery>) =>
    api.get<{ data: ExamListItem[] }>('/exams', { params }),
  getExam: (id: string) => api.get<ExamDetail>(`/exams/${id}`),
  createExam: (body: ExamCreate) => api.post<ExamDetail>('/exams', body),
  updateExam: (id: string, body: ExamUpdate) =>
    api.put<ExamDetail>(`/exams/${id}`, body),
  openExam: (id: string) =>
    api.post<ExamDetail>(`/exams/${id}/open`),
  closeExam: (id: string) =>
    api.post<ExamDetail>(`/exams/${id}/close`),

  // --- Exam subjects ----------------------------------------------------
  addExamSubject: (examId: string, body: ExamSubjectUpsert) =>
    api.post<ExamDetail>(`/exams/${examId}/subjects`, body),
  updateExamSubject: (
    examId: string,
    subjectId: string,
    body: ExamSubjectUpsert,
  ) => api.put<ExamDetail>(`/exams/${examId}/subjects/${subjectId}`, body),
  removeExamSubject: (examId: string, subjectId: string) =>
    api.del<{ ok: boolean }>(`/exams/${examId}/subjects/${subjectId}`),

  // --- Exam scores (bulk per exam_subject) -----------------------------
  bulkUpsertExamScores: (examId: string, body: ExamScoreBulk) =>
    api.put<{ count: number }>(`/exams/${examId}/scores`, body),

  // --- Assessment scores (continuous assessment) -----------------------
  listAssessmentScores: (params?: Partial<AssessmentScoreListQuery>) =>
    api.get<{ data: AssessmentScoreDetail[] }>('/assessment-scores', {
      params,
    }),
  upsertAssessmentScore: (body: AssessmentScoreUpsert) =>
    api.post<AssessmentScoreDetail>('/assessment-scores', body),
  bulkUpsertAssessmentScores: (body: AssessmentScoreBulk) =>
    api.put<{ count: number }>('/assessment-scores/bulk', body),

  // --- Result publications (workflow) ----------------------------------
  listPublications: (params?: Partial<ResultPublicationListQuery>) =>
    api.get<{ data: ResultPublicationDetail[] }>('/exam-results', {
      params,
    }),
  getOrCreatePublication: (body: ResultPublicationCreate) =>
    api.post<ResultPublicationDetail>('/exam-results', body),
  getPublication: (id: string) =>
    api.get<ResultPublicationDetail>(`/exam-results/${id}`),
  submitPublication: (id: string) =>
    api.post<ResultPublicationDetail>(`/exam-results/${id}/submit`),
  approvePublication: (id: string) =>
    api.post<ResultPublicationDetail>(`/exam-results/${id}/approve`),
  publishPublication: (id: string) =>
    api.post<ResultPublicationDetail>(`/exam-results/${id}/publish`),

  // --- Student results & report cards ---------------------------------
  getStudentResults: (studentId: string, sessionId: string, termId: string) =>
    api.get<StudentResultSummary>(
      `/students/${studentId}/results`,
      { params: { sessionId, termId } },
    ),
  listStudentReportCards: (studentId: string, params?: Params) =>
    api.get<{ data: ReportCardDetail[] }>(
      `/students/${studentId}/report-cards`,
      { params },
    ),
  generateReportCard: (studentId: string, body: ReportCardGenerate) =>
    api.post<ReportCardDetail>(`/students/${studentId}/report-cards`, body),
  publishReportCard: (id: string) =>
    api.post<ReportCardDetail>(`/report-cards/${id}/publish`),

  // --- Self / parent context -------------------------------------------
  getMySchoolContext: () =>
    api.get<MySchoolContext>('/my/school-context'),
}

export type ExamsApi = typeof examsApi
