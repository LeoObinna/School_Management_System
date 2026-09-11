/**
 * Small state helper for paginated collection screens: holds items,
 * total, loading and a single error string and reloads via the supplied
 * fetcher. Keeps loading/empty/error handling consistent across the
 * academic pages.
 */
import type { Paginated } from '~/shared/types'
import { formatApiError } from '~/utils/errors'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fetcher<T> = (params: Record<string, any>) => Promise<Paginated<T>>

export function usePaginated<T>(fetcher: Fetcher<T>) {
  const items = ref<T[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function load(params: Record<string, any> = {}): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const page = await fetcher(params)
      items.value = page.data
      total.value = page.meta.total
    } catch (e) {
      error.value = formatApiError(e)
    } finally {
      loading.value = false
    }
  }

  return { items, total, loading, error, load }
}
