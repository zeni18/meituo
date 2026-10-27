<template>
    <div class="clip-panel clip-panel--result">
        <div ref="previewBoxRef" class="preview-box">
            <div v-if="previewVideo || templateCover" class="preview-stage" :style="previewStageStyle">
                <video
                    v-if="previewVideo"
                    :key="previewVideo"
                    class="preview-media"
                    :src="previewVideo"
                    controls
                    autoplay
                    muted
                    loop
                    playsinline
                    preload="metadata"
                    :poster="templateCover || undefined"
                    @loadedmetadata="updateVideoRatio"
                />
                <img v-else class="preview-media" :src="templateCover" alt="" @load="updateImageRatio" />
            </div>
            <div v-else class="preview-empty">
                <strong>{{ templateName || '未选择模板' }}</strong>
                <span>{{ typeLabel }}</span>
            </div>
        </div>
        <div class="panel-head">
            <strong>任务与作品</strong>
            <button type="button" @click="$emit('refresh')">刷新</button>
        </div>
        <div class="result-list">
            <article v-for="item in results" :key="item.id || item.task_id" class="result-card">
                <video v-if="item.video_url" :src="item.video_url" controls playsinline preload="metadata" @click="openPreview(item)" />
                <div v-else class="result-placeholder">{{ statusText(item.status) }}</div>
                <div class="result-card__body">
                    <div>
                        <strong>{{ item.title || typeText(item.clip_type) }}</strong>
                        <span>{{ statusText(item.status) }} · {{ formatPoint(item.user_charge_points || 0) }}</span>
                    </div>
                    <div class="result-card__actions">
                        <button type="button" @click="$emit('reuse', item)">再次剪辑</button>
                        <a
                            v-if="resultDownloadHref(item)"
                            :href="resultDownloadHref(item)"
                            :download="resultDownloadName(item)"
                            target="_blank"
                            rel="noopener noreferrer"
                            @pointerdown.stop
                            @click.stop
                        >
                            下载
                        </a>
                        <button v-else type="button" disabled>下载</button>
                        <button type="button" @click="$emit('delete', item)">删除</button>
                    </div>
                </div>
            </article>
            <div v-if="!results.length" class="empty-state">
                <img class="empty-state__placeholder" :src="PRODUCT_IMAGE_EMPTY_IMAGE" alt="" />
                <span>暂无创作，开启你的创作</span>
            </div>
        </div>

        <Teleport to="body">
            <div v-if="modalPreviewVideo" class="media-preview" @click.self="closePreview">
                <PcCloseButton class="media-preview__close" aria-label="关闭预览" @click="closePreview" />
                <video :src="modalPreviewVideo" controls autoplay playsinline></video>
                <span>{{ previewTitle || '生成作品' }}</span>
            </div>
        </Teleport>
    </div>
</template>

<script lang="ts" setup>
import { PRODUCT_IMAGE_EMPTY_IMAGE } from '@/constants/workspace-assets'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const props = defineProps<{
    results: any[]
    latestVideo: string
    templatePreviewVideo?: string
    templateCover?: string
    templateCanvas?: { width: number; height: number } | null
    templateName: string
    typeLabel: string
    statusText: (status: string) => string
    typeText: (type: string) => string
}>()

const previewVideo = computed(() => props.templatePreviewVideo || props.latestVideo || '')
const previewBoxRef = ref<HTMLElement>()
const previewMediaRatio = ref(0)
const modalPreviewVideo = ref('')
const previewTitle = ref('')
const previewBoxSize = reactive({ width: 0, height: 0 })
let previewResizeObserver: ResizeObserver | null = null
const canvasRatio = computed(() => {
    const canvas = props.templateCanvas
    const width = Number(canvas?.width || 0)
    const height = Number(canvas?.height || 0)
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return width / height
    }
    return previewMediaRatio.value || 9 / 16
})
const previewStageStyle = computed(() => {
    const ratio = canvasRatio.value
    const boxWidth = previewBoxSize.width
    const boxHeight = previewBoxSize.height
    if (!Number.isFinite(ratio) || ratio <= 0 || boxWidth <= 0 || boxHeight <= 0) {
        return { aspectRatio: String(ratio || 9 / 16) }
    }
    const boxRatio = boxWidth / boxHeight
    if (boxRatio > ratio) {
        return {
            width: `${Math.floor(boxHeight * ratio)}px`,
            height: `${boxHeight}px`,
            aspectRatio: String(ratio)
        }
    }
    return {
        width: `${boxWidth}px`,
        height: `${Math.floor(boxWidth / ratio)}px`,
        aspectRatio: String(ratio)
    }
})

watch(previewVideo, () => {
    previewMediaRatio.value = 0
})

onMounted(() => {
    if (!previewBoxRef.value) return
    const updateSize = () => {
        const rect = previewBoxRef.value?.getBoundingClientRect()
        previewBoxSize.width = rect?.width || 0
        previewBoxSize.height = rect?.height || 0
    }
    updateSize()
    previewResizeObserver = new ResizeObserver(updateSize)
    previewResizeObserver.observe(previewBoxRef.value)
})

onBeforeUnmount(() => {
    previewResizeObserver?.disconnect()
    previewResizeObserver = null
})

function updateVideoRatio(event: Event) {
    const video = event.target as HTMLVideoElement
    if (!props.templateCanvas && video.videoWidth > 0 && video.videoHeight > 0) {
        previewMediaRatio.value = video.videoWidth / video.videoHeight
    }
}

function updateImageRatio(event: Event) {
    const image = event.target as HTMLImageElement
    if (!props.templateCanvas && image.naturalWidth > 0 && image.naturalHeight > 0) {
        previewMediaRatio.value = image.naturalWidth / image.naturalHeight
    }
}

function openPreview(item: any) {
    const video = String(item?.video_url || '').trim()
    if (!video) return
    modalPreviewVideo.value = video
    previewTitle.value = item?.title || props.typeText(item?.clip_type) || '生成作品'
}

function closePreview() {
    modalPreviewVideo.value = ''
    previewTitle.value = ''
}

function resultDownloadHref(item: any) {
    return resolvePcDownloadUrl(item?.download_url || item?.video_url || '')
}

function resultDownloadName(item: any) {
    const href = resultDownloadHref(item)
    const id = item?.task_id || item?.id || Date.now()
    const ext = getPcDownloadExtension(href, 'mp4')
    return `smart-clip-${id}.${ext}`
}

defineEmits<{
    (event: 'refresh'): void
    (event: 'reuse', item: any): void
    (event: 'delete', item: any): void
}>()
</script>

<style scoped>
.clip-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    min-height: 0;
    padding: 20px;
    border: 0;
    border-radius: 20px;
    background: #0f0f0f;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    box-sizing: border-box;
}

.clip-panel--result {
    height: 100%;
}

.panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 12px;
}

.panel-head strong {
    color: #fff;
    font-size: 16px;
    font-weight: 600;
}

.panel-head button,
.result-card button,
.result-card a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    transition:
        background 0.2s ease,
        color 0.2s ease;
}

.panel-head button:hover,
.result-card button:hover,
.result-card a:hover {
    background: #3c3c3c;
    color: #fff;
}

.preview-box {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 100%;
    height: 340px;
    border: 0;
    border-radius: 10px;
    background: #262626;
    overflow: hidden;
}

.preview-stage {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    border-radius: 0;
    background: #050505;
    overflow: hidden;
}

.preview-media {
    display: block;
    width: 100%;
    height: 100%;
    background: #050505;
    border-radius: 0;
    object-fit: contain;
}

.preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
}

.preview-empty strong {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
}

.preview-empty span,
.result-card span {
    display: block;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 320px;
    color: rgba(255, 255, 255, 0.62);
    text-align: center;
}

.empty-state__placeholder {
    display: block;
    width: 240px;
    height: 240px;
    object-fit: cover;
    opacity: 0.58;
    filter: blur(0.2px);
    -webkit-mask-image: radial-gradient(circle, #000 48%, rgba(0, 0, 0, 0.86) 62%, rgba(0, 0, 0, 0.18) 78%, transparent 94%);
    mask-image: radial-gradient(circle, #000 48%, rgba(0, 0, 0, 0.86) 62%, rgba(0, 0, 0, 0.18) 78%, transparent 94%);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
}

.empty-state span {
    font-size: 14px;
    line-height: 22px;
}

.result-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    align-content: start;
    justify-content: stretch;
    flex: 1 1 auto;
    gap: 12px;
    width: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-color: #242424 transparent;
    scrollbar-width: thin;
}

.result-list::-webkit-scrollbar {
    width: 6px;
}

.result-list::-webkit-scrollbar-track {
    background: transparent;
}

.result-list::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #242424;
}

.result-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    width: 100%;
    padding: 10px;
    border: 1px solid #222;
    border-radius: 10px;
    background: #0f0f0f;
    box-sizing: border-box;
}

.result-card video,
.result-placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    max-width: none;
    height: 240px;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    background: #050505;
    object-fit: cover;
    overflow: hidden;
}

.result-card video {
    border-radius: 8px;
    cursor: zoom-in;
}

.result-card__body {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
}

.result-card__body > div:first-child {
    width: 100%;
    min-width: 0;
}

.result-card strong {
    display: block;
    min-width: 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.result-card__actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
    min-width: 0;
}

.result-card__actions button,
.result-card__actions a {
    width: 100%;
    min-width: 0;
    padding: 0 10px;
    white-space: nowrap;
}

.result-card__actions button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

.media-preview {
    position: fixed;
    inset: 0;
    z-index: 21000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 14px;
    padding: 56px;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(10px);
}

.media-preview video {
    display: block;
    max-width: min(1120px, calc(100vw - 112px));
    max-height: calc(100vh - 152px);
    border-radius: 12px;
    background: #050505;
    object-fit: contain;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.52);
}

.media-preview span {
    max-width: min(720px, calc(100vw - 112px));
    overflow: hidden;
    color: rgba(255, 255, 255, 0.72);
    font-size: 14px;
    line-height: 1.5;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.media-preview__close {
    position: fixed;
    top: 24px;
    right: 28px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    min-height: 180px;
    grid-column: 1 / -1;
    border: 0;
    border-radius: 0;
    background: transparent;
}

@media (max-width: 1200px) {
    .clip-panel--result {
        height: 100%;
    }

    .result-list {
        overflow-x: hidden;
        overflow-y: auto;
    }
}
</style>
