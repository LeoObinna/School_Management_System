/**
 * Minimal typed Termii SMS client (Phase 17D).
 *
 * Plain `fetch` against https://api.ng.termii.com — available in both
 * the Workers runtime and Node dev. Termii authenticates via an
 * `api_key` field in the JSON body (their API has no auth header); the
 * key is therefore never logged and error messages never echo the body.
 *
 * Only the endpoint we need is wrapped:
 *   POST /api/sms/send → send a single SMS
 *
 * Phone numbers are sent exactly as stored — no format normalisation is
 * invented here; delivery failures surface in notification_deliveries.
 */
import { createError } from 'h3'

const TERMII_API_BASE = 'https://api.ng.termii.com'

export interface TermiiSendInput {
  /** Recipient phone number (as stored; Termii expects international format). */
  to: string
  /** Registered sender id (e.g. the school short name). */
  from: string
  text: string
}

export interface TermiiSendData {
  /** Termii's message_id, used as the provider message id. */
  id: string
}

interface TermiiSendResponse {
  message_id?: string
  message?: string
}

interface TermiiError {
  message?: string
}

function gatewayError(
  message: string,
  cause?: unknown,
  httpStatus?: number,
): never {
  if (cause) {
    console.error('[termii] gateway request failed:', message)
  }
  throw createError({
    statusCode: 502,
    statusMessage: 'Bad Gateway',
    message: `SMS gateway error: ${message}`,
    // The upstream HTTP status travels in `data` so the caller can retry
    // only genuine 5xx responses — the outward h3 status is always 502.
    ...(httpStatus !== undefined ? { data: { httpStatus } } : {}),
  })
}

async function call<T>(
  apiKey: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${TERMII_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, api_key: apiKey }),
    })
  } catch {
    gatewayError('could not reach the SMS gateway.')
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as TermiiError
      detail = body.message || `HTTP ${res.status}`
    } catch {
      detail = `HTTP ${res.status}`
    }
    gatewayError(detail, undefined, res.status)
  }
  let body: T
  try {
    body = (await res.json()) as T
  } catch {
    gatewayError('invalid response from the SMS gateway.')
  }
  return body!
}

/**
 * Sends one SMS via Termii. Retries once on 5xx (transient gateway
 * errors); 4xx errors are permanent (bad key, invalid number, etc.) and
 * are not retried.
 */
export async function sendSms(
  apiKey: string,
  input: TermiiSendInput,
): Promise<TermiiSendData> {
  const payload = {
    to: input.to,
    from: input.from,
    sms: input.text,
    type: 'plain',
    channel: 'generic',
  }
  try {
    const res = await call<TermiiSendResponse>(apiKey, '/api/sms/send', payload)
    return { id: res.message_id ?? '' }
  } catch (error) {
    // Retry once when the gateway answered with a 5xx (transient). 4xx
    // errors are permanent (bad key, invalid number) and network-level
    // failures carry no upstream status — neither is retried here (the
    // queue consumer applies its own retry policy).
    const httpStatus =
      error && typeof error === 'object' && 'data' in error
        ? ((error as { data?: { httpStatus?: number } }).data?.httpStatus ??
          0)
        : 0
    if (httpStatus >= 500) {
      const res = await call<TermiiSendResponse>(
        apiKey,
        '/api/sms/send',
        payload,
      )
      return { id: res.message_id ?? '' }
    }
    throw error
  }
}
