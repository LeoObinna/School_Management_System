/**
 * Request validation helper (README §25: zod on every server route).
 *
 * Parses input with a zod schema and throws a uniform 422 error with
 * field-level messages when invalid. Returns typed data on success.
 */
import { createError } from 'h3'
import type { z } from 'zod'

export function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const errors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.map((p) => String(p)).join('.') || '_'
      ;(errors[key] ??= []).push(issue.message)
    }
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Content',
      message: 'Validation failed.',
      data: { errors },
    })
  }
  return result.data
}

/** Validates and types a request body against a zod schema. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  return parseInput(schema, input)
}

/** Validates and types coerced query-string params against a zod schema. */
export function parseQueryData<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  return parseInput(schema, input)
}
