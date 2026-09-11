/**
 * POST /api/v1/sections
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { sectionCreateSchema } from '~/shared/schemas'
import { createSection } from '~/server/services/academic-structure'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'sections.manage')
  const data = parseBody(sectionCreateSchema, await readBody(event))
  const section = await createSection(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'section.create',
    resource: 'section',
    resourceId: section.id,
    description: `Created section ${section.name}.`,
  })
  setResponseStatus(event, 201)
  return section
})
