type CacheLoader<T> = () => Promise<T>

interface CacheEntry<T = any> {
    value?: T
    expiresAt: number
    promise?: Promise<T>
}

export interface PcRequestCacheOptions {
    ttl?: number
    force?: boolean
    staleWhileRevalidate?: boolean
    onUpdate?: (value: any) => void
}

const cacheStore = new Map<string, CacheEntry>()

const now = () => Date.now()

export const getPcRequestCache = <T = any>(key: string): T | undefined => {
    const entry = cacheStore.get(key)
    return entry?.value as T | undefined
}

export const invalidatePcRequestCache = (keyOrPrefix?: string) => {
    if (!keyOrPrefix) {
        cacheStore.clear()
        return
    }
    cacheStore.forEach((_entry, key) => {
        if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
            cacheStore.delete(key)
        }
    })
}

export const usePcRequestCache = async <T = any>(
    key: string,
    loader: CacheLoader<T>,
    options: PcRequestCacheOptions = {}
): Promise<T> => {
    const ttl = options.ttl ?? 0
    const force = options.force === true
    const entry = cacheStore.get(key) as CacheEntry<T> | undefined
    const fresh = entry && entry.value !== undefined && entry.expiresAt > now()

    if (!force && fresh) return entry.value as T

    if (!force && options.staleWhileRevalidate && entry?.value !== undefined) {
        if (!entry.promise) {
            entry.promise = loader()
                .then((value) => {
                    cacheStore.set(key, {
                        value,
                        expiresAt: ttl > 0 ? now() + ttl : 0
                    })
                    options.onUpdate?.(value)
                    return value
                })
                .finally(() => {
                    const latest = cacheStore.get(key)
                    if (latest?.promise === entry.promise) {
                        delete latest.promise
                    }
                })
        }
        return entry.value as T
    }

    if (!force && entry?.promise) return entry.promise

    const request = loader()
        .then((value) => {
            cacheStore.set(key, {
                value,
                expiresAt: ttl > 0 ? now() + ttl : 0
            })
            return value
        })
        .catch((error) => {
            if (!entry?.value) cacheStore.delete(key)
            throw error
        })

    cacheStore.set(key, {
        value: force ? entry?.value : entry?.value,
        expiresAt: entry?.expiresAt || 0,
        promise: request
    })

    return request
}
