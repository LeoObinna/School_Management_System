/**
 * Phase 17A: Resend email client tests (mocked fetch).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { sendEmail } from '../resend-client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('sendEmail', () => {
  it('sends a POST to /emails with the correct payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'resend-123' }), { status: 200 }),
    )
    const result = await sendEmail('test-key', {
      from: 'noreply@school.com',
      to: ['parent@example.com'],
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    })
    expect(result).toEqual({ id: 'resend-123' })
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect((init as RequestInit).method).toBe('POST')
    expect(
      (init as RequestInit).headers as Record<string, string>,
    ).toMatchObject({
      Authorization: 'Bearer test-key',
    })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toMatchObject({
      from: 'noreply@school.com',
      to: ['parent@example.com'],
      subject: 'Test Subject',
    })
  })

  it('includes reply_to when provided', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'resend-456' }), { status: 200 }),
    )
    await sendEmail('test-key', {
      from: 'noreply@school.com',
      to: ['parent@example.com'],
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
      replyTo: 'office@school.com',
    })
    const body = JSON.parse(
      (mockFetch.mock.calls[0]![1] as RequestInit).body as string,
    )
    expect(body.reply_to).toBe('office@school.com')
  })

  it('throws a 502 gateway error on 4xx response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 422,
          message: 'Invalid email address',
          name: 'validation_error',
        }),
        { status: 422 },
      ),
    )
    await expect(
      sendEmail('test-key', {
        from: 'noreply@school.com',
        to: ['bad'],
        subject: 'Test',
        html: '<p>Hi</p>',
        text: 'Hi',
      }),
    ).rejects.toThrow('Invalid email address')
  })

  it('retries once on 5xx then succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response('Server Error', { status: 500 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'resend-789' }), { status: 200 }),
      )
    const result = await sendEmail('test-key', {
      from: 'noreply@school.com',
      to: ['parent@example.com'],
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    })
    expect(result).toEqual({ id: 'resend-789' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network unreachable'))
    await expect(
      sendEmail('test-key', {
        from: 'noreply@school.com',
        to: ['parent@example.com'],
        subject: 'Test',
        html: '<p>Hi</p>',
        text: 'Hi',
      }),
    ).rejects.toThrow('could not reach')
  })

  it('never includes the API key in error messages', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 401,
          message: 'Invalid API key',
          name: 'authentication_error',
        }),
        { status: 401 },
      ),
    )
    try {
      await sendEmail('sk_live_secret123', {
        from: 'noreply@school.com',
        to: ['parent@example.com'],
        subject: 'Test',
        html: '<p>Hi</p>',
        text: 'Hi',
      })
      expect.unreachable('should have thrown')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      expect(message).not.toContain('sk_live_secret123')
    }
  })
})
