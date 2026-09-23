/**
 * PUT /api/v1/assignments/:id/submission
 *
 * Accepts either application/json (text content / file removal) or
 * multipart/form-data (file upload, optionally with a textContent field).
 */
import {
  defineEventHandler,
  getRequestHeader,
  getRouterParam,
  readBody,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  idParamSchema,
  submissionUpsertSchema,
  type SubmissionUpsert,
} from '~/shared/schemas'
import {
  upsertMySubmission,
} from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { formString, readUpload } from '~/server/utils/multipart'
import {
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import { smsForbidden } from '~/server/utils/http-errors'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'submissions.create')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'assignments.create')
  const contentType = getRequestHeader(event, 'content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    if (!actor.studentId) {
      throw smsForbidden('Only student accounts can submit work.')
    }
    const { file, meta, form } = await readUpload(event, 'submission')
    const objectKey = buildObjectKey(
      'assignments/submissions',
      [id, actor.studentId],
      meta.fileName,
      crypto.randomUUID(),
    )
    await putObject(
      event,
      objectKey,
      await file.arrayBuffer(),
      meta.mimeType,
    )

    const text = formString(form, 'textContent')
    const input: SubmissionUpsert = {}
    if (text !== undefined) {
      input.textContent = text
    }
    try {
      const result = await upsertMySubmission(id, input, actor, {
        objectKey,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      })
      if (result.previousObjectKey) {
        await deleteObject(event, result.previousObjectKey)
      }
      await writeAudit(event, {
        userId: auth.user.id,
        action: 'submission.save',
        resource: 'assignment_submission',
        resourceId: result.row.id as string,
        description: `Saved file "${meta.fileName}" for assignment ${id}.`,
      })
      return result.row
    } catch (e) {
      // Avoid orphan bytes if the metadata update failed.
      await deleteObject(event, objectKey)
      throw e
    }
  }

  // JSON: text content update and/or explicit file removal.
  const input = parseBody(submissionUpsertSchema, await readBody(event))
  const result = await upsertMySubmission(id, input, actor)
  if (input.removeFile && result.previousObjectKey) {
    await deleteObject(event, result.previousObjectKey)
  }
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'submission.save',
    resource: 'assignment_submission',
    resourceId: result.row.id as string,
    description: `Saved text work for assignment ${id}.`,
  })
  return result.row
})
