import type { HealthResponse } from '@/types/api'
import { api } from './api'

/** Domain service for the backend health probe. */
export function getHealth(): Promise<HealthResponse> {
  return api.get<HealthResponse>('/health').then((response) => response.data)
}
