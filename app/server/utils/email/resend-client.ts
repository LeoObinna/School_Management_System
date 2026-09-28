/**
 * Minimal typed Resend API client (Phase 17).
 *
 * Plain `fetch` against https://api.resend.com — available in both the
 * Workers runtime and Node dev. The API key travels only in the
 * Authorization header and is never logged or included in errors.
 *
 * Only the endpoint we need is wrapped:
 *   POST /emails → send a single email
 */
import { createError } from 'h3'

const RESEND_API_BASE = 'https://api.resend.com'

export interface ResendSendInput {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

export interface ResendSendData {
  id: string
}

interface ResendError {
  statusCode: number
  message: string
  name: string
}

function gatewayError(
  message: string,
  cause?: unknown,
  httpStatus?: number,
): never {
  if (cause) {
    console.error('[resend] gateway request failed:', message)
  }
  throw createError({
    statusCode: 502,
    statusMessage: 'Bad Gateway',
    message: `Email gateway error: ${message}`,
    // The upstream HTTP status travels in `data` so the caller can retry
    // only genuine 5xx responses — the outward h3 status is always 502.
    ...(httpStatus !== undefined ? { data: { httpStatus } } : {}),
  })
}

async function call<T>(
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${RESEND_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
  } catch {
    gatewayError('could not reach the email gateway.')
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as ResendError
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
    gatewayError('invalid response from the email gateway.')
  }
  return body!
}

/**
 * Sends one email via Resend. Retries once on 5xx (transient gateway
 * errors); 4xx errors are permanent (bad key, invalid address, etc.) and
 * are not retried.
 */
export async function sendEmail(
  apiKey: string,
  input: ResendSendInput,
): Promise<ResendSendData> {
  const payload = JSON.stringify({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
  })
  try {
    return await call<ResendSendData>(apiKey, '/emails', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    // Retry once when the gateway answered with a 5xx (transient). 4xx
    // errors are permanent (bad key, invalid address) and network-level
    // failures carry no upstream status — neither is retried here (the
    // queue consumer applies its own retry policy).
    const httpStatus =
      error && typeof error === 'object' && 'data' in error
        ? ((error as { data?: { httpStatus?: number } }).data?.httpStatus ??
          0)
        : 0
    if (httpStatus >= 500) {
      return call<ResendSendData>(apiKey, '/emails', {
        method: 'POST',
        body: payload,
      })
    }
    throw error
  }
}
