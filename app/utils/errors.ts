/**
 * Extracts a human-readable message from an ofetch/Nitro error shape.
 * Prefers the first field-level validation error, then the top-level
 * message.
 */
export function formatApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const e = error as {
    data?: {
      message?: string
      errors?: Record<string, string[]>
    }
    message?: string
  }
  const errors = e?.data?.errors
  if (errors) {
    const first = Object.values(errors)[0]
    if (first && first.length > 0) {
      return first[0]!
    }
  }
  return e?.data?.message || e?.message || fallback
}
