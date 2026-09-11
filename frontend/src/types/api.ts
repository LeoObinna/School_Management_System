/** Shared API response types. Keep in sync with backend API Resources. */

export type ServiceStatus = 'up' | 'down'

export interface HealthServices {
  database: ServiceStatus
  redis: ServiceStatus
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  version: string
  services: HealthServices
  time: string
}

/** Normalized error produced by the central API client. */
export interface ApiErrorShape {
  message: string
  status: number | null
  errors?: Record<string, string[]>
}
