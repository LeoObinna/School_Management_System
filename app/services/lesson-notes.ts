/**
 * Lesson notes API access layer (Phase 16D).
 * Teacher portal authoring + attachment management.
 */
import { api } from './api'
import type {
  LessonNoteCreate,
  LessonNoteListQuery,
  LessonNoteUpdate,
} from '~/shared/schemas'
import type { LessonNoteDetail, LessonNoteFile } from '~/shared/types'

export const lessonNotesApi = {
  list: (params?: Partial<LessonNoteListQuery>) =>
    api.get<{ data: LessonNoteDetail[] }>('/lesson-notes', { params }),
  get: (id: string) => api.get<LessonNoteDetail>(`/lesson-notes/${id}`),
  create: (body: LessonNoteCreate) =>
    api.post<LessonNoteDetail>('/lesson-notes', body),
  update: (id: string, body: LessonNoteUpdate) =>
    api.patch<LessonNoteDetail>(`/lesson-notes/${id}`, body),
  remove: (id: string) => api.del<{ message: string }>(`/lesson-notes/${id}`),

  uploadFile: (id: string, form: FormData) =>
    api.post<LessonNoteFile>(`/lesson-notes/${id}/files`, form),
  removeFile: (id: string, fileId: string) =>
    api.del<{ message: string }>(`/lesson-notes/${id}/files/${fileId}`),
  // Downloads must go through the authorized route, never an r2.dev URL.
  fileDownloadUrl: (id: string, fileId: string) =>
    `/api/v1/lesson-notes/${id}/files/${fileId}`,
}
