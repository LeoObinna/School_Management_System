/**
 * Uniform HTTP error helpers and PostgreSQL error inspection.
 * Unique `sms*` names avoid collisions with Nitro auto-imports.
 */
import { createError } from 'h3'

export function smsNotFound(message = 'Resource not found.') {
  return createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    message,
  })
}

export function smsConflict(message = 'Resource already exists.') {
  return createError({
    statusCode: 409,
    statusMessage: 'Conflict',
    message,
  })
}

/** 422 with a field-level errors map, matching parseBody's shape. */
export function smsFieldError(field: string, message: string) {
  return createError({
    statusCode: 422,
    statusMessage: 'Unprocessable Content',
    message: 'Validation failed.',
    data: { errors: { [field]: [message] } },
  })
}

/** PostgreSQL unique_violation detection (SQLSTATE 23505). */
export function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  )
}

/** PostgreSQL foreign_key_violation detection (SQLSTATE 23503). */
export function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23503'
  )
}
