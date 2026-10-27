import { invalidatePcRequestCache, usePcRequestCache } from '@/composables/usePcRequestCache'
import { useUserStore } from '@/stores/user'
import { parseTenantIdFromRoute } from '@/utils/tenant'

const STABLE_APP_CACHE_TTL = 5 * 60 * 1000

const encodeCachePart = (value: unknown) => {
    if (value === undefined || value === null || value === '') return ''
    try {
        return encodeURIComponent(JSON.stringify(value))
    } catch (error) {
        return encodeURIComponent(String(value))
    }
}

export const getCachedAppData = <T = any>(
    key: string,
    loader: () => Promise<T>,
    params?: unknown,
    ttl = STABLE_APP_CACHE_TTL
) => {
    const tenantId = parseTenantIdFromRoute()
    const userStore = useUserStore()
    const scopedKey = `${key}:tenant:${tenantId || 'default'}:token:${userStore.token || 'guest'}:${encodeCachePart(params)}`
    return usePcRequestCache<T>(scopedKey, loader, {
        ttl,
        staleWhileRevalidate: true
    })
}

export const invalidateCachedAppData = (keyOrPrefix: string) => invalidatePcRequestCache(keyOrPrefix)
