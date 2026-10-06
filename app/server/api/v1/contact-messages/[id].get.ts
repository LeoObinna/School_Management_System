/** GET /api/v1/contact-messages/{id} — single inbox message (Phase 18C). */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getContactMessage } from '~/server/services/contact-messages'

export default defineEventHandler((event) => {
  requirePermission(event, 'contact_messages.view')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  return getContactMessage(id)
})
