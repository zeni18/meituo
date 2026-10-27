<template>
    <div class="background-removal-page">
        <section class="product-workspace">
            <div class="product-panel product-panel--form">
                <header class="product-head">
                    <button class="product-head__back" type="button" @click="goBackToSource">
                        <span class="product-head__back-icon" aria-hidden="true"></span>
                        <span>返回</span>
                    </button>
                    <div class="product-head__title">
                        <h1>{{ toolDisplayName }}</h1>
                    </div>
                    <span class="product-head__spacer" aria-hidden="true"></span>
                </header>

                <div class="product-panel__body">
                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">上传待抠图图片</label>
                            <button v-if="sourceImage" type="button" class="ghost-button" @click="clearUpload">清空</button>
                        </div>
                        <div class="upload-card" :class="{ 'is-filled': !!sourceImage, 'is-uploading': sourceUploading }">
                            <template v-if="sourceImage">
                                <div class="upload-card__stage">
                                    <img :src="sourceImageUrl || sourceImage" alt="待抠图图片" />
                                </div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerUpload">本地上传</button>
                                </div>
                            </template>
                            <template v-else>
                                <div class="upload-card__placeholder" @click="triggerUpload">
                                    <img class="upload-card__icon" :src="addIcon" alt="" />
                                    <strong>本地上传</strong>
                                    <button class="upload-card__library" type="button" @click.stop="openGallery">图库上传</button>
                                </div>
                            </template>
                            <span v-if="sourceUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">输出规格</label>
                        <div class="model-specs">
                            <div class="quality-package-grid">
                                <button
                                    v-for="(item, index) in enabledPricePackages"
                                    :key="item.code"
                                    class="quality-package-card"
                                    :class="{ 'is-active': pricePackage === item.code }"
                                    type="button"
                                    @click="selectPricePackage(item.code)"
                                >
                                    <strong>{{ packageTitle(item, index) }}</strong>
                                    <span>{{ packageResolutionLabel(item, index) }}</span>
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                <div class="submit-bar">
                    <div><span>预计消耗</span><strong>{{ formatPoint(estimatePoints) }}</strong></div>
                    <button type="button" :disabled="!canSubmit || submitting" @click="submit">
                        {{ submitting ? '生成中' : '立即生成' }}
                    </button>
                </div>
            </div>

            <AiToolTaskPanel
                :tasks="panelTasks"
                :loading="taskLoading"
                :filter-options="taskStatusOptions"
                :active-filter="activeTaskStatusFilter"
                :active-filter-label="activeTaskStatusLabel"
                @refresh="refreshTasks"
                @filter-change="selectTaskStatus"
                @edit="handlePanelEdit"
                @regenerate="handlePanelRegenerate"
                @preview-reference="handlePanelPreviewReference"
                @preview="handlePanelPreview"
                @download-one="handlePanelDownloadOne"
                @download-all="handlePanelDownloadAll"
                @delete-one="handlePanelDeleteOne"
                @delete-all="handlePanelDeleteAll"
            />
        </section>

        <input ref="sourceInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload" />

        <AiWorkspaceAssetGalleryModal
            :visible="showGalleryModal"
            :accept-types="['image']"
            title="图库上传"
            description="选择资产图片作为待抠图图片"
            @close="showGalleryModal = false"
            @select="selectGallery"
        />

        <Teleport to="body">
            <div v-if="previewImage" class="media-preview background-preview" @click.self="closePreview">
                <PcCloseButton class="media-preview__close" aria-label="关闭预览" @click="closePreview" />
                <img :src="previewImage" :alt="previewTitle || '生成作品'" />
                <span>{{ previewTitle || '生成作品' }}</span>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import addIcon from '@/assets/images/icon/Add.svg'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { uploadImage } from '@/api/app'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'
import { PRODUCT_IMAGE_EMPTY_IMAGE } from '@/constants/workspace-assets'
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import downIcon from '@/assets/images/icon/Down.svg'
import deleteIcon from '@/assets/images/icon/Delete-themes.svg'
import downloadIcon from '@/assets/images/icon/xiazai.svg'
import editIcon from '@/assets/images/icon/bianji.svg'
import regenerateIcon from '@/assets/images/icon/zaici.svg'
import {
    deleteAigcBackgroundRemovalTask,
    estimateAigcBackgroundRemoval,
    generateAigcBackgroundRemoval,
    getAigcBackgroundRemovalConfig,
    getAigcBackgroundRemovalTasks
} from './api'

type UploadSource = 'gallery' | 'local'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const emptyImage = PRODUCT_IMAGE_EMPTY_IMAGE
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '图片去背景'))
const tasks = ref<any[]>([])
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_background_removal')
const estimateInfo = ref<any>({})
const sourceImage = ref('')
const sourceImageUrl = ref('')
const sourceImageName = ref('')
const sourceImageSource = ref<UploadSource>('gallery')
const sourceImageFile = ref<File | null>(null)
const pricePackage = ref('')
const sourceUploading = ref(false)
const taskLoading = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const taskStatusMenuOpen = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const sourceInputRef = ref<HTMLInputElement | null>(null)
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const uploadBlobUrls: string[] = []

const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) {
        return fallback
    }
    return resolved
}

const pricePackages = computed(() => config.value?.price_packages || config.value?.price_options || [])
const enabledPricePackages = computed(() => pricePackages.value.filter((item: any) => Number(item.status ?? 1) === 1))
const selectedPackage = computed(() => enabledPricePackages.value.find((item: any) => item.code === pricePackage.value) || enabledPricePackages.value[0] || {})
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? selectedPackage.value?.unit_price ?? 0).toFixed(2))
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' },
    { label: '排队中', value: 'pending' },
    { label: '生成中', value: 'running' },
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const panelTasks = computed(() => tasks.value.map((item: any) => {
    const image = taskImage(item)
    const status = normalizeTaskStatus(item.status)
    const downloadUrl = taskDownloadHref(item)
    const id = taskId(item) || item.id || item.task_id || `background-removal-${item.create_time || Date.now()}`
    return {
        id,
        mode: 'single' as const,
        badge: toolDisplayName.value,
        title: taskTitle(item),
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: taskSizeLabel(item),
        prompt: taskPrompt(item),
        references: taskReferenceImage(item) ? [{ label: '参考图', url: taskReferenceImage(item) }] : [],
        items: [{
            id: `${id}-result`,
            url: image,
            downloadUrl,
            downloadName: taskDownloadName(item),
            status,
            statusText: statusText(status),
            error: item.error || taskStateDescription(item),
            raw: item,
            deleteDisabled: !taskId(item) || isTaskRunning(item),
            downloadDisabled: !downloadUrl
        }],
        raw: item,
        regenerateDisabled: submitting.value,
        downloadAllDisabled: !(downloadUrl || image) || downloadingTaskIds.value.includes(taskId(item)),
        deleteAllDisabled: !taskId(item) || isTaskRunning(item)
    }
}))

const canSubmit = computed(() => !!sourceImage.value && !!pricePackage.value && !submitting.value && !sourceUploading.value)

const goBackToSource = () => {
    if (window.history.length > 1) {
        router.back()
        return
    }
    router.push('/ai/tools')
}

const loadConfig = async () => {
    config.value = await getAigcBackgroundRemovalConfig()
    pricePackage.value = defaultPackageCode()
}

const closeDropdowns = () => {
    taskStatusMenuOpen.value = false
}

const selectPricePackage = (value: string) => {
    pricePackage.value = value
}

const selectTaskStatus = async (status: TaskStatusFilter) => {
    activeTaskStatusFilter.value = status
    taskStatusMenuOpen.value = false
    await refreshTasks()
}

const triggerUpload = () => {
    sourceInputRef.value?.click()
}

const handleUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    uploadBlobUrls.push(objectUrl)
    applyUpload(objectUrl, objectUrl, file.name, 'local', file)
    ;(event.target as HTMLInputElement).value = ''
}

const applyUpload = (uri: string, url: string, name: string, source: UploadSource, file: File | null = null) => {
    sourceImage.value = uri
    sourceImageUrl.value = url || uri
    sourceImageName.value = name
    sourceImageSource.value = source
    sourceImageFile.value = file
}

const clearUpload = () => {
    applyUpload('', '', '', 'gallery')
    estimateInfo.value = {}
}

const openGallery = () => {
    showGalleryModal.value = true
}

const selectGallery = (item: any) => {
    const uri = item.uri || item.url || item.cover
    applyUpload(uri, resolveUploadPreviewUrl(item.url || item.cover || item.uri, uri), item.name || '', 'gallery')
    showGalleryModal.value = false
}

const uploadLocalImageIfNeeded = async () => {
    if (sourceImageSource.value !== 'local' || !sourceImageFile.value) return sourceImage.value
    const previewUrl = sourceImageUrl.value
    sourceUploading.value = true
    try {
        const res: any = await uploadImage({ file: sourceImageFile.value })
        const uri = res?.uri || res?.url || ''
        if (!uri) return sourceImage.value
        applyUpload(uri, previewUrl || resolveUploadPreviewUrl(res?.url || uri, uri), sourceImageFile.value.name, 'gallery')
        return uri
    } finally {
        sourceUploading.value = false
    }
}

const buildPayload = (overrides: Partial<Record<'source_image', string>> = {}) => ({
    source_image: overrides.source_image ?? sourceImage.value,
    price_package_code: pricePackage.value
})

const updateEstimate = async () => {
    if (!sourceImage.value || sourceImageSource.value === 'local' || !pricePackage.value) {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcBackgroundRemoval(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}

const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        const sourceUri = await uploadLocalImageIfNeeded()
        await generateAigcBackgroundRemoval(buildPayload({ source_image: sourceUri }))
        await refreshTasks()
        startPolling()
    } finally {
        submitting.value = false
    }
}

const refreshTasks = async () => {
    taskLoading.value = true
    try {
        const res: any = await getAigcBackgroundRemovalTasks({
            page_no: 1,
            page_size: 20,
            status: activeTaskStatusFilter.value
        })
        tasks.value = Array.isArray(res?.lists) ? res.lists : []
    } finally {
        taskLoading.value = false
    }
}

const statusText = (status: string) => ({
    pending: '排队中',
    running: '生成中',
    success: '已完成',
    failed: '已失败',
    canceled: '已取消'
}[status] || '生成中')

const normalizeTaskStatus = (status: any) => {
    const value = String(status || '').toLowerCase()
    if (['pending', 'running', 'success', 'failed', 'canceled'].includes(value)) return value
    return 'running'
}

const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const taskStateDescription = (item: any) => normalizeTaskStatus(item?.status) === 'failed' ? '生成结果未返回透明背景，请重试或更换规格' : 'AI 正在生成透明背景 PNG，请稍候'
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskTitle = (item?: any) => item?.price_package_name || toolDisplayName.value
const taskPrompt = (item: any) => String(item.price_package_name || item.prompt || '去除图片背景，输出透明 PNG').trim()
const taskReferenceImage = (item: any) => item.source_image_url || item.source_image || ''
const taskSizeLabel = (item: any) => {
    if (item.size_label) return item.size_label
    const width = Number(item.width || 0)
    const height = Number(item.height || 0)
    return width > 0 && height > 0 ? `${width}×${height}` : ''
}
const taskImage = (item: any) => {
    const firstResult = Array.isArray(item.results) ? item.results.find((entry: any) => entry?.image_url || entry?.url || entry?.image) : null
    return item.image_url || firstResult?.image_url || firstResult?.url || firstResult?.image || ''
}
const taskDownloadUrl = (item: any) => {
    const firstResult = Array.isArray(item.results)
        ? item.results.find((entry: any) => entry?.download_url || entry?.image_url || entry?.url || entry?.image)
        : null
    return item.download_url || firstResult?.download_url || taskImage(item)
}
const taskDownloadHref = (item: any) => resolvePcDownloadUrl(taskDownloadUrl(item))
const taskDownloadName = (item: any) => {
    const href = taskDownloadHref(item)
    const id = item.task_id || item.id || Date.now()
    const ext = getPcDownloadExtension(href, 'png')
    return `background-removal-${id}.${ext}`
}
const taskDownloadItems = (item: any) => {
    const rows = Array.isArray(item?.results) ? item.results : []
    const id = item?.task_id || item?.id || Date.now()
    const items = rows.map((entry: any, index: number) => {
        const href = resolvePcDownloadUrl(entry?.download_url || entry?.image_url || entry?.url || entry?.image)
        if (!href) return null
        const ext = getPcDownloadExtension(href, 'png')
        return {
            downloadUrl: href,
            downloadName: `background-removal-${id}-${index + 1}.${ext}`
        }
    }).filter(Boolean)
    const fallback = taskDownloadHref(item)
    return items.length ? items : (fallback ? [{ downloadUrl: fallback, downloadName: taskDownloadName(item) }] : [])
}
const taskMediaRatio = (item: any) => {
    const frameWidth = Number(item?.width || 0)
    const frameHeight = Number(item?.height || 0)
    if (frameWidth > 0 && frameHeight > 0) return { width: frameWidth, height: frameHeight }
    const match = String(item?.ratio || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
    if (match) return { width: Number(match[1]), height: Number(match[2]) }
    return { width: 1, height: 1 }
}
const taskMediaFrameStyle = (item: any) => {
    taskMediaRatio(item)
    return {}
}

const formatTaskTime = (value: any) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const date = new Date(Number(value) * 1000)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const editTask = (item: any) => {
    applyUpload(item.source_image || item.source_image_url || '', item.source_image_url || item.source_image || '', '待抠图图片', 'gallery')
    pricePackage.value = matchPackageCode(item) || pricePackage.value
}

const rerunTask = async (item: any) => {
    editTask(item)
    await submit()
}

const previewTask = (item: any) => {
    const image = taskImage(item)
    if (!image) return
    previewImage.value = image
    previewTitle.value = taskTitle(item)
}

const closePreview = () => {
    previewImage.value = ''
    previewTitle.value = ''
}

const deleteTask = async (item: any) => {
    const id = taskId(item)
    if (!id) return
    await deleteAigcBackgroundRemovalTask({ id })
    await refreshTasks()
}

const rawPanelTask = (task: any) => task?.raw || task
const triggerDownload = (href: string, filename: string) => {
    if (!href) return
    const link = document.createElement('a')
    link.href = href
    link.download = filename
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
}
const handlePanelEdit = (task: any) => editTask(rawPanelTask(task))
const handlePanelRegenerate = (task: any) => rerunTask(rawPanelTask(task))
const handlePanelPreviewReference = (reference: any) => {
    if (!reference?.url) return
    previewImage.value = reference.url
    previewTitle.value = reference.label || '参考图'
}
const handlePanelPreview = (item: any, task: any) => {
    if (!item?.url) return
    previewImage.value = item.url
    previewTitle.value = item.title || task?.title || '生成作品'
}
const handlePanelDownloadOne = (item: any) => triggerDownload(item?.downloadUrl || '', item?.downloadName || '生成作品.png')
const handlePanelDownloadAll = (task: any) => {
    const rawTask = rawPanelTask(task)
    const id = taskId(rawTask)
    void downloadTaskResults(id, task.items || [], `background-removal-${id}.zip`)
}
const handlePanelDeleteOne = (_item: any, task: any) => deleteTask(rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))

const packageTitle = (item: any, index = 0) => {
    const text = String([item.name, item.quality_label, item.quality].filter(Boolean).join(' ')).toLowerCase()
    if (/4k|高清|高|hd|pro|max/.test(text)) return '高清'
    if (/2k|标准|标清|sd|basic|base/.test(text)) return '标清'
    return index === 1 ? '高清' : index === 0 ? '标清' : String(item.name || `规格${index + 1}`)
}

const packageResolutionLabel = (item: any, index = 0) => {
    const text = String([item.quality_label, item.name, item.quality].filter(Boolean).join(' '))
    const match = text.match(/(\d+(?:\.\d+)?)\s*k/i)
    if (match) return `${match[1].replace(/\.0$/, '')}K`.toUpperCase()
    return index === 1 ? '4K' : '2K'
}

const defaultPackageCode = () => {
    const defaultChannel = config.value?.default_channel || config.value?.config_json?.channel || ''
    const defaultQuality = config.value?.default_quality || config.value?.config_json?.quality || ''
    const matched = enabledPricePackages.value.find((item: any) =>
        (!defaultChannel || item.channel === defaultChannel) && (!defaultQuality || item.quality === defaultQuality)
    )
    return matched?.code || enabledPricePackages.value[0]?.code || ''
}

const matchPackageCode = (item: any) => {
    if (item.price_package_code && enabledPricePackages.value.some((pack: any) => pack.code === item.price_package_code)) {
        return item.price_package_code
    }
    const channel = item.channel || ''
    const quality = item.quality || ''
    return enabledPricePackages.value.find((pack: any) => pack.channel === channel && pack.quality === quality)?.code || ''
}

const startPolling = () => {
    if (pollTimer) return
    pollTimer = window.setInterval(async () => {
        await refreshTasks()
        if (!tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) stopPolling()
    }, 5000)
}

const stopPolling = () => {
    if (pollTimer) {
        window.clearInterval(pollTimer)
        pollTimer = null
    }
}

watch([sourceImage, pricePackage], updateEstimate)

onMounted(async () => {
    window.addEventListener('click', closeDropdowns)
    await loadConfig()
    await refreshTasks()
    if (tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) startPolling()
})

onUnmounted(() => {
    window.removeEventListener('click', closeDropdowns)
    stopPolling()
    uploadBlobUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;

.background-removal-page {
    height: 100%;
    min-width: calc(403px + 24px + 560px);
}

.background-preview {
    background-color: #101010;
    background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.08) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(255, 255, 255, 0.08) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.08) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.08) 75%);
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    background-size: 16px 16px;
}

:deep(.task-row__head) {
    display: grid;
    grid-template-columns: auto minmax(120px, 1fr) auto auto auto;
    align-items: center;
    gap: 10px;
}

:deep(.task-row__head strong) {
    min-width: 0;
}

:deep(.task-row__head .task-row__status) {
    justify-self: end;
}

@media (max-width: 1200px) {
    .background-removal-page {
        min-width: 0;
    }

    :deep(.task-row__head) {
        grid-template-columns: auto minmax(0, 1fr) auto;
    }

    :deep(.task-row__head span:not(.task-row__badge, .task-row__status):not(:first-child)) {
        display: none;
    }
}
</style>
