/**
 * PUT /api/v1/sections/{id}
 */
import { defineEventHandler, getRouterParams, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, sectionUpdateSchema } from '~/shared/schemas'
import { updateSection } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'sections.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const data = parseBody(sectionUpdateSchema, await readBody(event))
  const section = await updateSection(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'section.update',
    resource: 'section',
    resourceId: section.id,
    description: `Updated section ${section.name}.`,
  })
  return section
})
