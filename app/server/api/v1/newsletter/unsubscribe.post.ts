/** POST /api/v1/newsletter/unsubscribe — public newsletter unsubscribe (Phase 17B). */
import { defineEventHandler, readBody } from 'h3'
import { parseBody } from '~/server/utils/validation'
import { newsletterUnsubscribeSchema } from '~/shared/schemas/notifications'
import { unsubscribeNewsletter } from '~/server/services/notifications'

export default defineEventHandler(async (event) => {
  const data = parseBody(newsletterUnsubscribeSchema, await readBody(event))
  return unsubscribeNewsletter(data.email)
})
