/**
 * POST /api/v1/payments/paystack/webhook
 *
 * Paystack webhook — unauthenticated, but signed with HMAC-SHA512 of
 * the raw request body using our secret key. The signature is verified
 * before any work; unknown references and replays return 200 so
 * Paystack stops retrying.
 */
import { defineEventHandler, getRequestHeader, readRawBody } from 'h3'
import { handlePaystackWebhook } from '~/server/services/paystack'

export default defineEventHandler(async (event) => {
  // Raw body is required for the HMAC-SHA512 signature check — never
  // parse it before verification.
  const raw = await readRawBody(event)
  const rawBody = typeof raw === 'string'
    ? raw
    : raw
      ? new TextDecoder().decode(raw)
      : ''
  const signature = getRequestHeader(event, 'x-paystack-signature')
  return handlePaystackWebhook(event, rawBody, signature ?? null)
})
