/** GET /api/v1/report-cards/:id/pdf */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getActor, getReportCard } from '~/server/services/exams'
import { streamObject } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'report_cards.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth, 'report_cards.view')
  // getReportCard enforces own / children + published-only access for
  // non-staff callers (404 when missing, 403 when forbidden).
  const card = await getReportCard(id, actor)
  if (!card.objectKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message:
        'Report card PDF has not been generated. PDF storage requires '
        + 'the R2_BUCKET binding — run via `npm run cf:dev`.',
    })
  }
  const downloadName = `report-card-${card.admissionNumber ?? card.id}.pdf`
  return streamObject(event, card.objectKey, downloadName, 'application/pdf')
})
