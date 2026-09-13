/** POST /api/v1/exam-results */
import {
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { resultPublicationCreateSchema } from '~/shared/schemas'
import {
  getActor,
  getOrCreatePublication,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.submit')
  const data = parseBody(
    resultPublicationCreateSchema,
    await readBody(event),
  )
  const actor = await getActor(auth, 'exam_results.submit')
  const publication = await getOrCreatePublication(data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'result_publication.create',
    resource: 'result_publication',
    resourceId: publication.id,
    description: `Created result publication for ${publication.className}.`,
  })
  setResponseStatus(event, 201)
  return publication
})
