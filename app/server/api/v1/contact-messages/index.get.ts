/** GET /api/v1/contact-messages — staff contact inbox list (Phase 18C). */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { contactMessageListQuerySchema } from '~/shared/schemas'
import { listContactMessages } from '~/server/services/contact-messages'

export default defineEventHandler((event) => {
  requirePermission(event, 'contact_messages.view')
  const query = parseQueryData(contactMessageListQuerySchema, getQuery(event))
  return listContactMessages(query)
})
