/**
 * Object storage access (README §23).
 *
 * Bytes live in Cloudflare R2 through the `R2_BUCKET` Worker binding
 * declared in wrangler.toml. D1 stores only metadata + the object key.
 * This module defines the small structural surface the SMS
 * uses (put/get/delete) so the app does not depend on
 * @cloudflare/workers-types at build time.
 *
 * In plain Node dev (`nuxt dev`) the binding does not exist; callers
 * receive a clear 503. Local object I/O runs through
 * `wrangler pages dev`, staging or production (Phase 13 wires envs).
 */
import type { H3Event } from 'h3'
import { createError, setHeader } from 'h3'

/** Structural subset of the Cloudflare R2Bucket API the SMS relies on. */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  get(key: string): Promise<R2ObjectLike | null>
  delete(key: string): Promise<void>
}

export interface R2ObjectLike {
  body: ReadableStream | null
  httpMetadata?: { contentType?: string }
  size?: number
  writtenHttpMetadata?: { contentType?: string }
  etag?: string
  lastModified?: string
}

interface CloudflareEventContext {
  cloudflare?: {
    env?: Record<string, unknown>
  }
}

export function getR2Bucket(event: H3Event): R2BucketLike {
  const binding = (event.context as CloudflareEventContext).cloudflare?.env
    ?.R2_BUCKET
  if (!binding) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Storage Unavailable',
      message:
        'Object storage is not configured in this environment. Run the app via wrangler or configure the R2_BUCKET binding.',
    })
  }
  return binding as R2BucketLike
}

/**
 * Semantically explicit fail-fast: throws 503 when the R2 binding is
 * unavailable. Use this before mutating the database so a storage outage
 * does not leave metadata pointing at bytes that were never written (or
 * deletes that orphan objects). `getR2Bucket` is kept for callers that
 * need the bucket handle directly; this helper reads as intent.
 */
export function assertR2Available(event: H3Event): R2BucketLike {
  return getR2Bucket(event)
}

/** Builds a deterministic, collision-safe object key for a category. */
export function buildObjectKey(
  prefix: string,
  scopeParts: string[],
  fileName: string,
  randomId: string,
): string {
  const safeScope = scopeParts
    .map((part) => encodeURIComponent(part).replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/')
  const safeName =
    fileName
      .normalize('NFKD')
      .replace(/[^\w. -]/g, '')
      .replace(/\s+/g, '_')
      .slice(-120) || 'file'
  return [prefix, safeScope, `${randomId}-${safeName}`]
    .filter(Boolean)
    .join('/')
}

export async function putObject(
  event: H3Event,
  key: string,
  body: ArrayBuffer | ArrayBufferView,
  contentType: string,
): Promise<void> {
  const bucket = getR2Bucket(event)
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  })
}

export async function deleteObject(
  event: H3Event,
  key: string,
): Promise<void> {
  const bucket = getR2Bucket(event)
  await bucket.delete(key)
}

/**
 * Reads an object fully into memory. Returns null when the object or
 * its body is missing (callers distinguish this from a 503 no-binding
 * error themselves).
 */
export async function getObjectBytes(
  event: H3Event,
  key: string,
): Promise<Uint8Array | null> {
  const bucket = getR2Bucket(event)
  const object = await bucket.get(key)
  if (!object || !object.body) return null
  // `new Response(stream)` reads any web ReadableStream without relying
  // on the arrayBuffer() extension present on R2's concrete stream.
  return new Uint8Array(await new Response(object.body).arrayBuffer())
}

/**
 * Streams a private R2 object through the authorized API response.
 * Objects are never public; callers must complete authorization first.
 */
export async function streamObject(
  event: H3Event,
  key: string,
  downloadName: string,
  fallbackContentType?: string | null,
  options: {
    disposition?: 'attachment' | 'inline'
    cacheControl?: string
  } = {},
): Promise<ReadableStream> {
  const bucket = getR2Bucket(event)
  const object = await bucket.get(key)
  if (!object || !object.body) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Stored file is missing.',
    })
  }
  const contentType =
    fallbackContentType ||
    object.httpMetadata?.contentType ||
    'application/octet-stream'
  const asciiName = downloadName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  setHeader(event, 'Content-Type', contentType)
  const disposition = options.disposition ?? 'attachment'
  setHeader(
    event,
    'Content-Disposition',
    `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  )
  setHeader(
    event,
    'Cache-Control',
    options.cacheControl ?? 'private, max-age=0, no-store',
  )
  return object.body
}

/**
 * Returns object metadata without downloading the body. Returns null when
 * the object does not exist. Use this to check existence (e.g. whether a
 * derived thumbnail was persisted) instead of pulling the full bytes.
 */
export async function headObject(
  event: H3Event,
  key: string,
): Promise<Pick<R2ObjectLike, 'size' | 'httpMetadata' | 'etag' | 'lastModified'> | null> {
  const bucket = getR2Bucket(event)
  // R2Bucket.get with { onlyIf: ... } or head() returns metadata without
  // body. The structural interface only exposes get(); the concrete
  // binding supports `get(key, { onlyIf: { etagDoesNotMatch: '' } })`
  // but the portable approach is to call get() and discard the body.
  // Workers' R2 get() does not transfer body until consumed, so this is
  // effectively a head.
  const object = await bucket.get(key)
  if (!object) return null
  return {
    size: object.size,
    httpMetadata: object.httpMetadata,
    etag: object.etag,
    lastModified: object.lastModified,
  }
}

/** True when an object with the given key exists in the bucket. */
export async function objectExists(event: H3Event, key: string): Promise<boolean> {
  return (await headObject(event, key)) !== null
}

/**
 * Deletes multiple objects in a single pass. Fails fast on the first
 * error so callers can abort a transaction-style rollback; swallow
 * individual failures with `.catch(() => {})` when best-effort cleanup
 * is intended. An empty key list is a no-op.
 */
export async function deleteObjects(
  event: H3Event,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return
  const bucket = getR2Bucket(event)
  for (const key of keys) {
    await bucket.delete(key)
  }
}
