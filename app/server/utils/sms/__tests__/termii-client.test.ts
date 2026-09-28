/**
 * Phase 17D: Termii SMS client tests (mocked fetch).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { sendSms } from '../termii-client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('sendSms', () => {
  it('sends a POST to /api/sms/send with the api_key in the body', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message_id: 'tm-123' }), { status: 200 }),
    )
    const result = await sendSms('test-key', {
      to: '2348012345678',
      from: 'VCS',
      text: 'Hello parent',
    })
    expect(result).toEqual({ id: 'tm-123' })
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toBe('https://api.ng.termii.com/api/sms/send')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toMatchObject({
      to: '2348012345678',
      from: 'VCS',
      sms: 'Hello parent',
      api_key: 'test-key',
      type: 'plain',
      channel: 'generic',
    })
    // The key must NOT travel in a header.
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(JSON.stringify(headers)).not.toContain('test-key')
  })

  it('throws a 502 gateway error on 4xx and does not retry', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Invalid API key' }), {
        status: 401,
      }),
    )
    await expect(
      sendSms('bad-key', { to: '2348012345678', from: 'VCS', text: 'Hi' }),
    ).rejects.toMatchObject({
      statusCode: 502,
      data: { httpStatus: 401 },
    })
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('retries once on 5xx and succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'upstream' }), { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message_id: 'tm-9' }), { status: 200 }),
      )
    const result = await sendSms('test-key', {
      to: '2348012345678',
      from: 'VCS',
      text: 'Hi',
    })
    expect(result).toEqual({ id: 'tm-9' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('never includes the API key in the thrown error message', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'unauthorized' }), {
        status: 401,
      }),
    )
    const error = await sendSms('super-secret-key', {
      to: '2348012345678',
      from: 'VCS',
      text: 'Hi',
    }).catch((e: unknown) => e)
    expect(JSON.stringify(error)).not.toContain('super-secret-key')
  })
})
