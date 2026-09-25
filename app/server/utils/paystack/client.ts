/**
 * Minimal typed Paystack API client (Phase 15).
 *
 * Plain `fetch` against https://api.paystack.co — available in both the
 * Workers runtime and Node dev. The secret key travels only in the
 * Authorization header and is never logged or included in errors.
 *
 * Only the two endpoints the hosted-redirect flow needs are wrapped:
 *   POST /transaction/initialize  → hosted checkout URL
 *   GET  /transaction/verify/:ref → authoritative transaction state
 */
import { createError } from 'h3'

const PAYSTACK_API_BASE = 'https://api.paystack.co'

export interface PaystackInitializeInput {
  email: string
  /** Amount in kobo. */
  amount: number
  reference: string
  callbackUrl: string
  currency?: string
  metadata?: Record<string, unknown>
}

export interface PaystackInitializeData {
  authorization_url: string
  access_code: string
  reference: string
}

export interface PaystackVerifyData {
  id: number
  status: string // 'success' | 'failed' | 'abandoned' | ...
  reference: string
  /** Amount in kobo. */
  amount: number
  currency: string
  paid_at?: string | null
  channel?: string
}

interface PaystackEnvelope<T> {
  status: boolean
  message?: string
  data?: T
}

function gatewayError(message: string, cause?: unknown): never {
  if (cause) {
    console.error('[paystack] gateway request failed:', message)
  }
  throw createError({
    statusCode: 502,
    statusMessage: 'Bad Gateway',
    message: `Payment gateway error: ${message}`,
  })
}

async function call<T>(
  secretKey: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    })
  } catch {
    gatewayError('could not reach the payment gateway.')
  }
  let body: PaystackEnvelope<T>
  try {
    body = (await res!.json()) as PaystackEnvelope<T>
  } catch {
    gatewayError('invalid response from the payment gateway.')
  }
  if (!res!.ok || !body!.status || body!.data === undefined) {
    gatewayError(body!.message || `gateway rejected the request (HTTP ${res!.status}).`)
  }
  return body!.data as T
}

export function initializeTransaction(
  secretKey: string,
  input: PaystackInitializeInput,
): Promise<PaystackInitializeData> {
  return call<PaystackInitializeData>(secretKey, '/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: input.currency ?? 'NGN',
      metadata: input.metadata ?? {},
    }),
  })
}

export function verifyTransaction(
  secretKey: string,
  reference: string,
): Promise<PaystackVerifyData> {
  return call<PaystackVerifyData>(
    secretKey,
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' },
  )
}
