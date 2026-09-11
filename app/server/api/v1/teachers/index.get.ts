/**
 * GET /api/v1/teachers
 *
 * Minimal active-teacher lookup for academic assignment screens.
 * Full teacher CRUD arrives with Phase 4 (People).
 */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { listActiveTeachers } from '~/server/services/teacher-academics'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'teachers.view')
  return { data: await listActiveTeachers() }
})
