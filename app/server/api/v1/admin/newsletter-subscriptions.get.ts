/** GET /api/v1/admin/newsletter-subscriptions — admin list (Phase 17B). */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { newsletterListQuerySchema } from '~/shared/schemas/notifications'
import { listNewsletterSubscriptions } from '~/server/services/notifications'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'newsletter.view')
  const query = parseQueryData(newsletterListQuerySchema, getQuery(event))
  return listNewsletterSubscriptions(query)
})
