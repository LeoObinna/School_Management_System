/**
 * Drizzle schema barrel.
 *
 * Domain files follow the dependency-aware migration order in
 * README §40:
 *   core -> academics -> people -> enrollment -> attendance ->
 *   assignments -> exams -> finance -> admissions -> communication
 *   -> events (audit_logs lives in core).
 *
 * Import `schema` for Drizzle's relational client, or named tables.
 */
export * from './enums'
export * from './core'
export * from './academics'
export * from './people'
export * from './enrollment'
export * from './attendance'
export * from './assignments'
export * from './exams'
export * from './finance'
export * from './admissions'
export * from './communication'
export * from './events'
export * from './documents'

import * as core from './core'
import * as academics from './academics'
import * as people from './people'
import * as enrollment from './enrollment'
import * as attendance from './attendance'
import * as assignments from './assignments'
import * as exams from './exams'
import * as finance from './finance'
import * as admissions from './admissions'
import * as communication from './communication'
import * as events from './events'
import * as documents from './documents'

export const schema = {
  ...core,
  ...academics,
  ...people,
  ...enrollment,
  ...attendance,
  ...assignments,
  ...exams,
  ...finance,
  ...admissions,
  ...communication,
  ...events,
  ...documents,
}

export type Schema = typeof schema
