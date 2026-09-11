/**
 * DELETE /api/v1/sections/{id} — deactivates the section (history kept).
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deactivateSection } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'sections.manage')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const section = await deactivateSection(id)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'section.deactivate',
    resource: 'section',
    resourceId: section.id,
    description: `Deactivated section ${section.name}.`,
  })
  return section
})
