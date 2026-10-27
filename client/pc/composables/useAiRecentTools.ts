import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import type { ToolCardItem } from '~/composables/use-ai-tools'

const recentToolsStoragePrefix = 'ai-workspace-recent-tools'
const recentToolsLimit = 12

export interface AiRecentToolRecord {
    id: string
    appCode?: string
    usedAt: number
}

const normalizeRecordKey = (record: Pick<AiRecentToolRecord, 'id' | 'appCode'>) => record.appCode || record.id
const isBrowser = () => typeof window !== 'undefined'
const hashIdentity = (value: string) => {
    let hash = 0
    Array.from(value).forEach((char) => {
        hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
    })
    return Math.abs(hash).toString(36)
}

const normalizeSavedRecords = (saved: unknown) => (
    Array.isArray(saved)
        ? saved
            .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
            .map((item) => ({
                id: item.id,
                appCode: typeof item.appCode === 'string' ? item.appCode : undefined,
                usedAt: Number(item.usedAt || 0)
            }))
            .filter((item) => item.usedAt > 0)
            .sort((left, right) => right.usedAt - left.usedAt)
            .slice(0, recentToolsLimit)
        : []
)

export const useAiRecentTools = () => {
    const userStore = useUserStore()
    const records = useState<AiRecentToolRecord[]>('ai-workspace-recent-tools', () => [])
    const hydratedKey = useState<string>('ai-workspace-recent-tools-hydrated-key', () => '')

    const storageKey = computed(() => {
        const userInfo = userStore.userInfo || {}
        const userIdentity = String(userInfo.id || userInfo.user_id || userInfo.sn || userInfo.account || '').trim()
        const identity = userIdentity || (userStore.token ? `token-${hashIdentity(userStore.token)}` : 'guest')
        return `${recentToolsStoragePrefix}:${identity}`
    })

    const readStoredRecords = () => {
        try {
            return normalizeSavedRecords(JSON.parse(window.localStorage.getItem(storageKey.value) || '[]'))
        } catch (error) {
            window.localStorage.removeItem(storageKey.value)
            return []
        }
    }

    const hydrateRecentTools = (force = false) => {
        if (!isBrowser()) return
        if (!force && hydratedKey.value === storageKey.value) return

        hydratedKey.value = storageKey.value
        records.value = readStoredRecords()
    }

    const recordRecentTool = (tool?: Pick<ToolCardItem, 'id' | 'appCode'> | null, options: { updateState?: boolean } = {}) => {
        if (!isBrowser() || !tool?.id) return
        hydrateRecentTools()
        const key = normalizeRecordKey(tool)
        const sourceRecords = options.updateState === false ? readStoredRecords() : records.value
        const nextRecords = [
            {
                id: tool.id,
                appCode: tool.appCode,
                usedAt: Date.now()
            },
            ...sourceRecords.filter((item) => normalizeRecordKey(item) !== key)
        ].slice(0, recentToolsLimit)
        window.localStorage.setItem(storageKey.value, JSON.stringify(nextRecords))
        if (options.updateState !== false) {
            records.value = nextRecords
        }
    }

    const recordRecentToolByAppCode = (appCode?: string | null) => {
        const normalizedAppCode = String(appCode || '').trim()
        if (!normalizedAppCode) return
        recordRecentTool({
            id: normalizedAppCode,
            appCode: normalizedAppCode
        })
    }

    const getRecentToolCards = (toolCards: ToolCardItem[], limit = 8) => {
        return records.value
            .map((record) => toolCards.find((tool) => tool.id === record.id || (record.appCode && tool.appCode === record.appCode)))
            .filter((tool): tool is ToolCardItem => Boolean(tool))
            .slice(0, limit)
    }

    return {
        recentToolRecords: records,
        hydrateRecentTools,
        recordRecentTool,
        recordRecentToolByAppCode,
        getRecentToolCards
    }
}
