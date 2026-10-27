<template>
    <Teleport to="body">
        <div v-if="visible" class="asset-gallery-mask" @click.self="emitClose">
            <section class="asset-gallery-modal">
                <header class="asset-gallery-modal__header">
                    <div>
                        <strong>{{ title || '图库上传' }}</strong>
                        <span>{{ description || activeDescription }}</span>
                    </div>
                    <PcCloseButton aria-label="关闭图库弹窗" @click="emitClose" />
                </header>

                <div v-if="showTypeTabs" class="asset-gallery-tabs">
                    <button
                        v-for="item in typeTabs"
                        :key="item.value"
                        :class="{ 'is-active': activeType === item.value }"
                        type="button"
                        @click="activeType = item.value"
                    >
                        {{ item.label }}
                    </button>
                </div>

                <div class="asset-gallery-grid" :class="{ 'is-empty': !filteredItems.length && !loading }">
                    <button
                        v-for="item in filteredItems"
                        :key="item.id"
                        type="button"
                        class="asset-gallery-card"
                        @click="selectItem(item)"
                    >
                        <div v-if="item.type === 'audio'" class="asset-gallery-card__audio">音频</div>
                        <video v-else-if="item.type === 'video' && item.url" :src="item.url" :poster="item.cover || undefined" muted playsinline preload="metadata"></video>
                        <img v-else :src="item.cover || item.url" :alt="item.name" loading="lazy" decoding="async" />
                        <span v-if="item.type === 'video'" class="asset-gallery-card__type">视频</span>
                        <span v-else-if="item.type === 'audio'" class="asset-gallery-card__type">音频</span>
                        <span v-else class="asset-gallery-card__type">图片</span>
                        <strong>{{ item.name }}</strong>
                    </button>
                    <template v-if="loading && !filteredItems.length">
                        <div v-for="index in 8" :key="`skeleton-${index}`" class="asset-gallery-card asset-gallery-card--skeleton"></div>
                    </template>
                    <div v-if="loading && !filteredItems.length" class="asset-gallery-empty">加载中...</div>
                    <div v-else-if="!filteredItems.length" class="asset-gallery-empty">暂无{{ activeTypeLabel }}素材</div>
                </div>

                <div v-if="filteredItems.length && hasMore" class="asset-gallery-more">
                    <button type="button" :disabled="loadingMore" @click="loadMoreItems">
                        <i v-if="loadingMore"></i>
                        <span>{{ loadingMore ? '加载中' : '加载更多' }}</span>
                    </button>
                </div>
            </section>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getAigcDigitalHumanResults } from '@/apps/aigc_digital_human/api'
import { getAigcImageResults } from '@/apps/aigc_image/api'
import { getAigcVideoResults } from '@/apps/aigc_video/api'
import { getAigcMusicResults } from '@/apps/aigc_music/api'
import { getImageHumanResults } from '@/apps/image_human/api'
import { normalizeFileUrl } from '@/utils/file-url'
import { getApiUrl } from '@/utils/env'

type AssetType = 'image' | 'video' | 'audio'
type GalleryCacheEntry = {
    items: GalleryItem[]
    page: number
    hasMore: boolean
    updatedAt: number
}

type GalleryItem = {
    id: string
    type: AssetType
    name: string
    uri: string
    url: string
    cover?: string
    duration?: number
}

const props = withDefaults(defineProps<{
    visible: boolean
    acceptTypes?: AssetType[]
    title?: string
    description?: string
}>(), {
    acceptTypes: () => ['image']
})

const emit = defineEmits<{
    (event: 'close'): void
    (event: 'select', item: GalleryItem): void
}>()

const loading = ref(false)
const loadingMore = ref(false)
const items = ref<GalleryItem[]>([])
const activeType = ref<AssetType>('image')
const pageNo = ref(1)
const hasMore = ref(false)
const galleryCache = useState<Record<string, GalleryCacheEntry>>('ai-workspace-asset-gallery-cache', () => ({}))
const GALLERY_PAGE_SIZE = 16
const GALLERY_CACHE_TTL = 60 * 1000

const normalizedAcceptTypes = computed<AssetType[]>(() => {
    const types = props.acceptTypes.filter((item): item is AssetType => ['image', 'video', 'audio'].includes(item))
    return types.length ? Array.from(new Set(types)) : ['image']
})
const showTypeTabs = computed(() => normalizedAcceptTypes.value.length > 1)
const typeTabs = computed(() => normalizedAcceptTypes.value.map((value) => ({
    value,
    label: value === 'video' ? '视频' : value === 'audio' ? '音频' : '图片'
})))
const activeTypeLabel = computed(() => activeType.value === 'video' ? '视频' : activeType.value === 'audio' ? '音频' : '图片')
const activeDescription = computed(() => {
    if (showTypeTabs.value) return '选择资产中的图片或视频素材'
    return activeType.value === 'video'
        ? '选择资产中的视频素材'
        : activeType.value === 'audio'
          ? '选择资产中的音频素材'
          : '选择资产中的图片素材'
})
const filteredItems = computed(() => items.value.filter((item) => item.type === activeType.value))
const cacheKey = computed(() => normalizedAcceptTypes.value.slice().sort().join('|'))

const emitClose = () => emit('close')
const selectItem = (item: GalleryItem) => emit('select', item)

const asRecord = (value: any): Record<string, any> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : null

const extractListData = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload
    const queue = [payload]
    const visited = new Set<any>()
    const listKeys = ['lists', 'list', 'rows', 'records', 'items', 'data']
    while (queue.length) {
        const current = queue.shift()
        if (!current || visited.has(current)) continue
        visited.add(current)
        if (Array.isArray(current)) return current
        const record = asRecord(current)
        if (!record) continue
        for (const key of listKeys) {
            if (Array.isArray(record[key])) return record[key]
        }
        for (const key of ['data', 'result', 'page', 'pagination']) {
            if (asRecord(record[key])) queue.push(record[key])
        }
    }
    return []
}

const extractTotal = (payload: any) => {
    const queue = [payload]
    const visited = new Set<any>()
    while (queue.length) {
        const current = queue.shift()
        if (!current || visited.has(current)) continue
        visited.add(current)
        const record = asRecord(current)
        if (!record) continue
        const total = Number(record.count ?? record.total ?? record.total_count ?? record.totalCount ?? 0)
        if (Number.isFinite(total) && total > 0) return total
        for (const key of ['data', 'result', 'page', 'pagination']) {
            if (asRecord(record[key])) queue.push(record[key])
        }
    }
    return 0
}
const mergeItems = (current: GalleryItem[], next: GalleryItem[]) => {
    const map = new Map<string, GalleryItem>()
    current.forEach((item) => map.set(item.id, item))
    next.forEach((item) => map.set(item.id, item))
    return Array.from(map.values())
}

const normalizeAssetUrl = (url: unknown) => {
    let raw = String(url || '').trim()
    if (!raw) return ''
    raw = raw.replace(/\\/g, '/')
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
    const normalized = normalizeFileUrl(raw)
    const apiUrl = String(getApiUrl() || '').replace(/\/+$/, '')
    if (apiUrl && normalized.startsWith('/uploads/')) return `${apiUrl}${normalized}`
    return normalized
}

const normalizeResultCandidates = (value: any): any[] => {
    if (Array.isArray(value)) return value
    const record = asRecord(value)
    if (!record) return []
    const list = extractListData(record)
    return list.length ? list : [record]
}

const getFirstResult = (item: any, keys: string[]) => {
    const candidates = [
        ...normalizeResultCandidates(item?.results),
        ...normalizeResultCandidates(item?.result),
        ...normalizeResultCandidates(item?.outputs),
        ...normalizeResultCandidates(item?.output),
        ...normalizeResultCandidates(item?.data),
        ...normalizeResultCandidates(item?.result_json)
    ]
    return candidates.find((result: any) => keys.some((key) => result?.[key])) || null
}

const getImageUrl = (item: any) => {
    const firstResult = getFirstResult(item, ['image_url', 'image_uri', 'url', 'image', 'file_url'])
    return normalizeAssetUrl(
        item.image_url || item.image || item.file_url || item.cover_url || item.url || item.image_uri
        || firstResult?.image_url || firstResult?.image || firstResult?.file_url || firstResult?.cover_url || firstResult?.url || firstResult?.image_uri
    )
}

const getVideoUrl = (item: any) => {
    const firstResult = getFirstResult(item, ['video_url', 'video_uri', 'url', 'video', 'file_url', 'media_url', 'download_url', 'origin_url'])
    return normalizeAssetUrl(
        item.video_url || item.video || item.file_url || item.media_url || item.download_url || item.origin_url || item.url || item.video_uri
        || firstResult?.video_url || firstResult?.video || firstResult?.file_url || firstResult?.media_url || firstResult?.download_url || firstResult?.origin_url || firstResult?.url || firstResult?.video_uri
    )
}

const getAudioUrl = (item: any) => {
    const firstResult = getFirstResult(item, ['audio_url', 'audio_uri', 'wav_url', 'wav_uri', 'mp3_url', 'mp3_uri', 'mp4_url', 'mp4_uri', 'url', 'file_url', 'media_url'])
    return normalizeAssetUrl(
        item.audio_url || item.audio_uri || item.audio || item.wav_url || item.wav_uri || item.mp3_url || item.mp3_uri || item.mp4_url || item.mp4_uri || item.file_url || item.media_url || item.url
        || firstResult?.audio_url || firstResult?.audio_uri || firstResult?.audio || firstResult?.wav_url || firstResult?.wav_uri || firstResult?.mp3_url || firstResult?.mp3_uri || firstResult?.mp4_url || firstResult?.mp4_uri || firstResult?.file_url || firstResult?.media_url || firstResult?.url
    )
}

const getCoverUrl = (item: any) => {
    const firstResult = getFirstResult(item, ['cover_url', 'cover_uri', 'poster_url', 'poster_uri', 'thumb_url', 'thumb_uri', 'thumbnail_url', 'thumbnail_uri', 'image_url', 'image_uri', 'image'])
    return normalizeAssetUrl(
        item.cover_url || item.cover_uri || item.cover
        || item.poster_url || item.poster_uri || item.poster
        || item.thumb_url || item.thumb_uri || item.thumbnail_url || item.thumbnail_uri || item.thumbnail
        || item.image_url || item.image_uri || item.image
        || firstResult?.cover_url || firstResult?.cover_uri || firstResult?.cover
        || firstResult?.poster_url || firstResult?.poster_uri || firstResult?.poster
        || firstResult?.thumb_url || firstResult?.thumb_uri || firstResult?.thumbnail_url || firstResult?.thumbnail_uri || firstResult?.thumbnail
        || firstResult?.image_url || firstResult?.image_uri || firstResult?.image
    )
}

const normalizeDurationValue = (value: unknown) => {
    const duration = Number(value || 0)
    return Number.isFinite(duration) && duration > 0 ? Math.ceil(duration) : 0
}

const normalizeImageItem = (item: any, index: number): GalleryItem | null => {
    const url = getImageUrl(item)
    if (!url) return null
    return {
        id: `image-${item.result_id || item.id || item.task_id || index}`,
        type: 'image',
        name: item.title || item.name || item.prompt || `图片素材-${index + 1}`,
        uri: item.image_uri || item.image || item.file_url || item.url || item.image_url || url,
        url,
        cover: url,
        duration: 2
    }
}

const normalizeVideoItem = (source: string, item: any, index: number): GalleryItem | null => {
    const url = getVideoUrl(item)
    if (!url) return null
    const cover = getCoverUrl(item)
    return {
        id: `${source}-${item.result_id || item.id || item.task_id || index}`,
        type: 'video',
        name: item.title || item.name || item.prompt || item.script_text || `视频素材-${index + 1}`,
        uri: item.video_uri || item.video || item.file_url || item.media_url || item.download_url || item.origin_url || item.url || item.video_url || url,
        url,
        cover,
        duration: normalizeDurationValue(item.duration)
    }
}

const normalizeAudioItem = (item: any, index: number): GalleryItem | null => {
    const url = getAudioUrl(item)
    if (!url) return null
    return {
        id: `audio-${item.result_id || item.id || item.task_id || index}`,
        type: 'audio',
        name: item.title || item.name || item.prompt || `音频素材-${index + 1}`,
        uri: item.audio_uri || item.audio || item.wav_uri || item.wav_url || item.mp3_uri || item.mp3_url || item.mp4_uri || item.mp4_url || item.file_url || item.media_url || item.url || item.audio_url || url,
        url,
        duration: normalizeDurationValue(item.duration)
    }
}

const buildListParams = (page = 1) => ({
    page_no: page,
    page_size: GALLERY_PAGE_SIZE,
    status: 'success'
})

const loadGalleryItems = async (page = 1, append = false) => {
    if (append) {
        loadingMore.value = true
    } else {
        loading.value = true
    }
    try {
        const loaders: Promise<GalleryItem[]>[] = []
        const hasMoreFlags: Promise<boolean>[] = []
        if (normalizedAcceptTypes.value.includes('image')) {
            const params = buildListParams(page)
            const imageResponse = getAigcImageResults(params).catch(() => [])
            loaders.push(
                imageResponse
                    .then((res) => extractListData(res).map(normalizeImageItem).filter(Boolean) as GalleryItem[])
            )
            hasMoreFlags.push(
                imageResponse
                    .then((res) => {
                        const total = extractTotal(res)
                        const list = extractListData(res)
                        return total ? page * GALLERY_PAGE_SIZE < total : list.length >= GALLERY_PAGE_SIZE
                    })
            )
        }
        if (normalizedAcceptTypes.value.includes('video')) {
            const params = buildListParams(page)
            const videoResponses = Promise.all([
                getAigcVideoResults(params).catch(() => []),
                getAigcDigitalHumanResults(params).catch(() => []),
                getImageHumanResults(params).catch(() => [])
            ])
            loaders.push(
                videoResponses.then(([videos, digitalHumans, imageHumans]) => [
                    ...extractListData(videos).map((item, index) => normalizeVideoItem('video', item, index)),
                    ...extractListData(digitalHumans).map((item, index) => normalizeVideoItem('digital_human', item, index)),
                    ...extractListData(imageHumans).map((item, index) => normalizeVideoItem('image_human', item, index))
                ].filter(Boolean) as GalleryItem[])
            )
            hasMoreFlags.push(
                videoResponses.then((rows) => rows.some((res) => {
                    const total = extractTotal(res)
                    const list = extractListData(res)
                    return total ? page * GALLERY_PAGE_SIZE < total : list.length >= GALLERY_PAGE_SIZE
                })).catch(() => false)
            )
        }
        if (normalizedAcceptTypes.value.includes('audio')) {
            const params = buildListParams(page)
            const audioResponse = getAigcMusicResults(params).catch(() => [])
            loaders.push(
                audioResponse.then((res) =>
                    extractListData(res).map(normalizeAudioItem).filter(Boolean) as GalleryItem[]
                )
            )
            hasMoreFlags.push(
                audioResponse.then((res) => {
                    const total = extractTotal(res)
                    const list = extractListData(res)
                    return total ? page * GALLERY_PAGE_SIZE < total : list.length >= GALLERY_PAGE_SIZE
                })
            )
        }
        const [loadedItems, moreFlags] = await Promise.all([
            Promise.all(loaders).then((rows) => rows.flat()),
            Promise.all(hasMoreFlags)
        ])
        items.value = append ? mergeItems(items.value, loadedItems) : loadedItems
        pageNo.value = page
        hasMore.value = moreFlags.some(Boolean)
        galleryCache.value[cacheKey.value] = {
            items: items.value,
            page: pageNo.value,
            hasMore: hasMore.value,
            updatedAt: Date.now()
        }
    } finally {
        loading.value = false
        loadingMore.value = false
    }
}

const loadMoreItems = () => {
    if (loadingMore.value || loading.value || !hasMore.value) return
    void loadGalleryItems(pageNo.value + 1, true)
}

watch(() => props.visible, (visible) => {
    if (!visible) return
    activeType.value = normalizedAcceptTypes.value[0] || 'image'
    const cached = galleryCache.value[cacheKey.value]
    if (cached?.items?.length) {
        items.value = cached.items
        pageNo.value = cached.page || 1
        hasMore.value = cached.hasMore
        if (Date.now() - cached.updatedAt < GALLERY_CACHE_TTL) return
    } else {
        items.value = []
        pageNo.value = 1
        hasMore.value = false
    }
    void loadGalleryItems(1)
})

watch(normalizedAcceptTypes, (types) => {
    if (!types.includes(activeType.value)) activeType.value = types[0] || 'image'
    if (props.visible) void loadGalleryItems(1)
})
</script>

<style scoped>
.asset-gallery-mask {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.56);
    backdrop-filter: blur(8px);
}

.asset-gallery-modal {
    display: flex;
    flex-direction: column;
    width: min(920px, calc(100vw - 48px));
    height: min(760px, calc(100vh - 48px));
    padding: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 22px;
    background: #111;
    color: #fff;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
}

.asset-gallery-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
}

.asset-gallery-modal__header strong {
    display: block;
    font-size: 22px;
    font-weight: 600;
}

.asset-gallery-modal__header span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
}

.asset-gallery-modal__header button {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 10px;
    background: #242424;
    color: #fff;
    font-size: 22px;
}

.asset-gallery-tabs {
    display: inline-flex;
    align-self: flex-start;
    gap: 8px;
    margin-bottom: 16px;
    padding: 4px;
    border-radius: 12px;
    background: #171717;
}

.asset-gallery-tabs button {
    height: 32px;
    min-width: 72px;
    padding: 0 16px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    font-size: 13px;
}

.asset-gallery-tabs button.is-active {
    background: #fff;
    color: #111;
}

.asset-gallery-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-auto-rows: 238px;
    flex: 1;
    min-height: 0;
    gap: 16px;
    overflow-y: auto;
    scrollbar-color: #242424 transparent;
    scrollbar-width: thin;
}

.asset-gallery-grid.is-empty {
    display: grid;
    place-items: center;
}

.asset-gallery-card {
    position: relative;
    display: block;
    min-width: 0;
    padding: 0;
    border: 1px solid #222;
    border-radius: 12px;
    background: #171717;
    color: #fff;
    overflow: hidden;
}

.asset-gallery-card img,
.asset-gallery-card video {
    display: block;
    width: 100%;
    height: 100%;
    background: #050505;
    object-fit: cover;
}

.asset-gallery-card__audio {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    background: #0b0b0b;
    color: rgba(255, 255, 255, 0.42);
    font-size: 15px;
}

.asset-gallery-card--skeleton {
    pointer-events: none;
    background: linear-gradient(90deg, #171717 0%, #222 48%, #171717 100%);
    background-size: 220% 100%;
    animation: asset-gallery-shimmer 1.2s ease-in-out infinite;
}

.asset-gallery-card strong {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    overflow: hidden;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.asset-gallery-card__type {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 4px 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.52);
    color: #fff;
    font-size: 12px;
}

.asset-gallery-empty {
    color: rgba(255, 255, 255, 0.58);
    font-size: 14px;
}

.asset-gallery-more {
    display: flex;
    justify-content: center;
    padding-top: 14px;
}

.asset-gallery-more button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 34px;
    min-width: 112px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 13px;
}

.asset-gallery-more button:disabled {
    cursor: not-allowed;
    opacity: 0.72;
}

.asset-gallery-more i {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: asset-gallery-spin 0.9s linear infinite;
}

@keyframes asset-gallery-shimmer {
    to {
        background-position: -220% 0;
    }
}

@keyframes asset-gallery-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
