type CreationPageKey = 'visual' | 'storyboard' | 'images' | 'video'

type CacheRecord<T> = {
    version: 1
    updatedAt: number
    data: T
}

const PREFIX = 'short_drama'
const HOME_CONFIG_KEY = `${PREFIX}:home_config`
const HOME_CONFIG_TTL = 5 * 60 * 1000

export type ShortDramaImageModelSelection = {
    id?: string
    value?: string
    channel_code?: string
    name?: string
    default_quality?: string
    default_ratio?: string
    resolution?: string
}

const storage = () => {
    if (!process.client) return null
    try {
        return window.localStorage
    } catch {
        return null
    }
}

const safeParse = <T>(raw: string | null): CacheRecord<T> | null => {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null
        return parsed as CacheRecord<T>
    } catch {
        return null
    }
}

export const shortDramaCreationCacheKey = (projectId: string | number, taskId: string | number, page: CreationPageKey) => (
    `${PREFIX}:${projectId || 'no_project'}:${taskId || 'no_task'}:${page}`
)

export const readShortDramaCreationCache = <T>(projectId: string | number, taskId: string | number, page: CreationPageKey): T | null => {
    const store = storage()
    if (!store || !projectId || !taskId) return null
    const cached = safeParse<T>(store.getItem(shortDramaCreationCacheKey(projectId, taskId, page)))
    return cached?.data || null
}

export const writeShortDramaCreationCache = <T>(projectId: string | number, taskId: string | number, page: CreationPageKey, data: T) => {
    const store = storage()
    if (!store || !projectId || !taskId) return
    try {
        store.setItem(shortDramaCreationCacheKey(projectId, taskId, page), JSON.stringify({
            version: 1,
            updatedAt: Date.now(),
            data
        }))
    } catch {}
}

export const readShortDramaHomeConfigCache = <T>(): T | null => {
    const store = storage()
    if (!store) return null
    const cached = safeParse<T>(store.getItem(HOME_CONFIG_KEY))
    if (!cached || Date.now() - cached.updatedAt > HOME_CONFIG_TTL) return null
    return cached.data || null
}

export const writeShortDramaHomeConfigCache = <T>(data: T) => {
    const store = storage()
    if (!store) return
    try {
        store.setItem(HOME_CONFIG_KEY, JSON.stringify({
            version: 1,
            updatedAt: Date.now(),
            data
        }))
    } catch {}
}

export const shortDramaImageModelSelectionKey = (projectId: string | number, taskId: string | number) => (
    `${PREFIX}:image_model:${projectId || 'no_project'}:${taskId || 'no_task'}`
)

export const readShortDramaImageModelSelection = (
    projectId: string | number,
    taskId: string | number
): ShortDramaImageModelSelection | null => {
    const store = storage()
    if (!store || !projectId || !taskId) return null
    const cached = safeParse<ShortDramaImageModelSelection>(store.getItem(shortDramaImageModelSelectionKey(projectId, taskId)))
    return cached?.data || null
}

export const writeShortDramaImageModelSelection = (
    projectId: string | number,
    taskId: string | number,
    model: ShortDramaImageModelSelection | null | undefined
) => {
    const store = storage()
    if (!store || !projectId || !taskId || !model) return
    try {
        store.setItem(shortDramaImageModelSelectionKey(projectId, taskId), JSON.stringify({
            version: 1,
            updatedAt: Date.now(),
            data: model
        }))
    } catch {}
}
