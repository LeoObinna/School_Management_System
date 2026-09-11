import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { getHealth } from '@/services/health'
import type { HealthResponse } from '@/types/api'
import { useHealthStore } from '../health'

vi.mock('@/services/health', () => ({
  getHealth: vi.fn(),
}))

const healthyPayload: HealthResponse = {
  status: 'ok',
  version: 'v1',
  services: { database: 'up', redis: 'up' },
  time: '2026-09-10T12:00:00Z',
}

describe('useHealthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads health data and clears loading/error on success', async () => {
    vi.mocked(getHealth).mockResolvedValue(healthyPayload)
    const store = useHealthStore()

    const promise = store.refresh()
    expect(store.loading).toBe(true)
    await promise

    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.data).toEqual(healthyPayload)
  })

  it('captures the normalized error and keeps data null on failure', async () => {
    vi.mocked(getHealth).mockRejectedValue({ message: 'Network error', status: null })
    const store = useHealthStore()

    await store.refresh()

    expect(store.loading).toBe(false)
    expect(store.data).toBeNull()
    expect(store.error).toEqual({ message: 'Network error', status: null })
  })
})
