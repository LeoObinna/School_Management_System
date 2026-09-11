import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getHealth } from '@/services/health'
import type { ApiErrorShape, HealthResponse } from '@/types/api'

/**
 * Backend health state. Demonstrates the standard store pattern:
 * data / loading / error with an idempotent refresh action.
 */
export const useHealthStore = defineStore('health', () => {
  const data = ref<HealthResponse | null>(null)
  const loading = ref(false)
  const error = ref<ApiErrorShape | null>(null)

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      data.value = await getHealth()
    } catch (err) {
      data.value = null
      error.value = err as ApiErrorShape
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, refresh }
})
