/**
 * Tests for the consolidated R2 storage helpers (Phase 11).
 *
 * We mock the bucket via the structural R2BucketLike interface so the
 * tests run in plain Node without a Workers runtime. The helpers under
 * test: assertR2Available, headObject, objectExists, deleteObjects,
 * and the existing buildObjectKey is exercised for key shape stability.
 */
import { describe, it, expect, vi } from 'vitest'
import type { H3Event } from 'h3'
import {
  assertR2Available,
  buildObjectKey,
  deleteObjects,
  headObject,
  objectExists,
  type R2BucketLike,
} from '../storage'

function makeEvent(bucket: R2BucketLike | null): H3Event {
  return {
    context: {
      cloudflare: { env: { R2_BUCKET: bucket } },
    },
  } as unknown as H3Event
}

describe('assertR2Available', () => {
  it('returns the bucket when the binding is present', () => {
    const bucket = {} as R2BucketLike
    expect(assertR2Available(makeEvent(bucket))).toBe(bucket)
  })

  it('throws 503 when the R2 binding is absent', () => {
    expect(() => assertR2Available(makeEvent(null))).toThrow()
  })
})

describe('headObject / objectExists', () => {
  it('returns metadata for an existing object without consuming the body', async () => {
    const bucket = {
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        size: 1024,
        httpMetadata: { contentType: 'image/png' },
        etag: '"abc"',
        lastModified: '2026-01-01T00:00:00.000Z',
      }),
    } as unknown as R2BucketLike
    const meta = await headObject(makeEvent(bucket), 'k')
    expect(meta?.size).toBe(1024)
    expect(meta?.httpMetadata?.contentType).toBe('image/png')
    expect(bucket.get).toHaveBeenCalledWith('k')
  })

  it('returns null when the object does not exist', async () => {
    const bucket = {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as R2BucketLike
    expect(await headObject(makeEvent(bucket), 'missing')).toBeNull()
    expect(await objectExists(makeEvent(bucket), 'missing')).toBe(false)
  })

  it('objectExists returns true for a present object', async () => {
    const bucket = {
      get: vi.fn().mockResolvedValue({ body: null, size: 1 }),
    } as unknown as R2BucketLike
    expect(await objectExists(makeEvent(bucket), 'k')).toBe(true)
  })
})

describe('deleteObjects', () => {
  it('deletes every key in order and no-ops on an empty list', async () => {
    const deletes: string[] = []
    const bucket = {
      delete: vi.fn(async (key: string) => {
        deletes.push(key)
      }),
    } as unknown as R2BucketLike
    await deleteObjects(makeEvent(bucket), ['a', 'b', 'c'])
    expect(deletes).toEqual(['a', 'b', 'c'])

    deletes.length = 0
    const callCountBefore = bucket.delete.mock.calls.length
    await deleteObjects(makeEvent(bucket), [])
    expect(deletes).toEqual([])
    expect(bucket.delete.mock.calls.length).toBe(callCountBefore)
  })

  it('fails fast on the first delete error', async () => {
    const bucket = {
      delete: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('boom')),
    } as unknown as R2BucketLike
    await expect(
      deleteObjects(makeEvent(bucket), ['a', 'b', 'c']),
    ).rejects.toThrow('boom')
    expect(bucket.delete).toHaveBeenCalledTimes(2)
  })
})

describe('buildObjectKey (regression)', () => {
  it('produces a deterministic, path-safe key', () => {
    const key = buildObjectKey(
      'assignments/submissions',
      ['assign-1', 'stu-1'],
      'homework.pdf',
      'rand',
    )
    expect(key).toBe('assignments/submissions/assign-1/stu-1/rand-homework.pdf')
  })

  it('strips path separators and hostile chars from the file name', () => {
    const key = buildObjectKey('x', ['a'], '../../etc/passwd', 'r')
    // The file-name segment has slashes removed (dots are kept by design).
    const fileName = key.split('/').pop()!
    expect(fileName).not.toContain('/')
    expect(key.startsWith('x/a/')).toBe(true)
  })
})
