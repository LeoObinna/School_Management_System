/**
 * Uniform HTTP error helpers and database error inspection
 * (PostgreSQL + SQLite/D1). Unique `sms*` names avoid collisions with
 * Nitro auto-imports.
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

export function smsForbidden(message = 'You cannot perform this action.') {
  return createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
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

/**
 * Unique-constraint violation detection across both supported engines.
 *
 * - PostgreSQL (legacy Hyperdrive path): SQLSTATE 23505.
 * - SQLite/D1: SQLITE_CONSTRAINT_UNIQUE (extended code 2067; generic
 *   constraint code 19) with a "UNIQUE constraint failed" message. D1
 *   sometimes nests the driver error under `cause`, so unwrap a few
 *   levels.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (isPgCode(error, '23505')) return true
  let current: unknown = error
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current !== 'object') break
    const e = current as {
      code?: unknown
      message?: unknown
      cause?: unknown
    }
    if (e.code === 2067 || e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return true
    }
    if (
      typeof e.message === 'string' &&
      /UNIQUE constraint failed/i.test(e.message)
    ) {
      return true
    }
    current = e.cause
  }
  return false
}

/**
 * Foreign-key violation detection across both engines (PG SQLSTATE
 * 23503; SQLite SQLITE_CONSTRAINT_FOREIGNKEY 787 / generic 19 with
 * "FOREIGN KEY constraint failed" message).
 */
export function isForeignKeyViolation(error: unknown): boolean {
  if (isPgCode(error, '23503')) return true
  let current: unknown = error
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current !== 'object') break
    const e = current as {
      code?: unknown
      message?: unknown
      cause?: unknown
    }
    if (e.code === 787 || e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return true
    }
    if (
      typeof e.message === 'string' &&
      /FOREIGN KEY constraint failed/i.test(e.message)
    ) {
      return true
    }
    current = e.cause
  }
  return false
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  )
}
