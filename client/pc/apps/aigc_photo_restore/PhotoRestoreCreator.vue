<template>
    <div class="photo-restore-page">
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
                            <label class="field-label">上传老照片</label>
                            <button v-if="sourceImage" type="button" class="ghost-button" @click="clearSourceImage">清空</button>
                        </div>
                        <div class="upload-card" :class="{ 'is-filled': !!sourceImage, 'is-uploading': uploading }">
                            <template v-if="sourceImage">
                                <div class="upload-card__stage">
                                    <img :src="sourceImageUrl" alt="老照片" />
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
                            <span v-if="uploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">修复类型</label>
                        <div class="restore-type-grid">
                            <button
                                v-for="item in restoreTypes"
                                :key="item.code"
                                type="button"
                                :class="{ 'is-active': restoreType === item.code }"
                                @click="restoreType = item.code"
                            >
                                <strong>{{ item.name }}</strong>
                                <span>{{ item.description || restoreTypeHint(item.code) }}</span>
                            </button>
                            <div v-if="!restoreTypes.length" class="inline-empty">暂无可用修复类型</div>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">修复质量</label>
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
                            <div class="model-specs__row model-specs__row--single">
                                <div class="tool-select-dropdown" @click.stop>
                                    <button class="tool-select-card tool-select-card--button" type="button" :aria-expanded="ratioMenuOpen" @click="ratioMenuOpen = !ratioMenuOpen">
                                        <span class="tool-select-card__value">{{ selectedRatioLabel }}</span>
                                        <img :src="downIcon" alt="" :class="{ 'is-open': ratioMenuOpen }" />
                                    </button>
                                    <div v-if="ratioMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                        <button v-for="item in ratioOptions" :key="item.value" :class="{ 'is-active': ratio === item.value }" type="button" @click="selectRatio(item.value)">
                                            <span>{{ item.label }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">细节补充</label>
                        <textarea v-model="prompt" maxlength="300" placeholder="可补充希望保留的人物特征、年代质感、上色偏好或需要避免的变化"></textarea>
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

        <input ref="uploadInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload" />

        <AiWorkspaceAssetGalleryModal
            :visible="showGalleryModal"
            :accept-types="['image']"
            title="图库上传"
            description="选择资产图片作为修复原图"
            @close="showGalleryModal = false"
            @select="selectGallery"
        />

        <Teleport to="body">
            <div v-if="previewImage" class="media-preview" @click.self="closePreview">
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
import feedback from '@/utils/feedback'
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
    deleteAigcPhotoRestoreTask,
    estimateAigcPhotoRestore,
    generateAigcPhotoRestore,
    getAigcPhotoRestoreConfig,
    getAigcPhotoRestoreTasks,
    getAigcPhotoRestoreTypes
} from './api'

type UploadSource = 'gallery' | 'local'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const emptyImage = PRODUCT_IMAGE_EMPTY_IMAGE
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '老照片修复'))
const restoreTypes = ref<any[]>([])
const tasks = ref<any[]>([])
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_photo_restore')
const estimateInfo = ref<any>({})
const sourceImage = ref('')
const sourceImageUrl = ref('')
const sourceImageName = ref('')
const sourceImageSource = ref<UploadSource>('gallery')
const sourceImageFile = ref<File | null>(null)
const restoreType = ref('repair')
const pricePackage = ref('')
const ratio = ref('')
const prompt = ref('')
const uploading = ref(false)
const taskLoading = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const ratioMenuOpen = ref(false)
const taskStatusMenuOpen = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const uploadInputRef = ref<HTMLInputElement | null>(null)
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
const ratioOptions = computed(() => (selectedPackage.value?.ratios || []).map((item: any) => ({ label: item.label || item.ratio || item.value, value: item.value || item.ratio, width: item.width, height: item.height })))
const selectedRatioLabel = computed(() => ratioOptions.value.find((item: any) => item.value === ratio.value)?.label || '请选择比例')
const selectedRestoreType = computed(() => restoreTypes.value.find((item) => item.code === restoreType.value))
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
    const id = taskId(item) || item.id || item.task_id || `photo-restore-${item.create_time || Date.now()}`
    return {
        id,
        mode: 'single' as const,
        badge: toolDisplayName.value,
        title: taskTitle(item),
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: item.size_label || `${item.width || 0}×${item.height || 0}`,
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

const canSubmit = computed(() => !!sourceImage.value && !!restoreType.value && !!pricePackage.value && !!ratio.value && !submitting.value && !uploading.value)

const goBackToSource = () => {
    if (window.history.length > 1) {
        router.back()
        return
    }
    router.push('/ai/tools')
}

const loadConfig = async () => {
    config.value = await getAigcPhotoRestoreConfig()
    pricePackage.value = defaultPackageCode()
    syncRatio()
}

const loadTypes = async () => {
    restoreTypes.value = await getAigcPhotoRestoreTypes()
    if (!restoreTypes.value.some((item) => item.code === restoreType.value)) {
        restoreType.value = restoreTypes.value[0]?.code || ''
    }
}

const syncRatio = () => {
    if (!ratioOptions.value.some((item: any) => item.value === ratio.value)) {
        const defaultRatio = config.value?.default_ratio || config.value?.config_json?.ratio || ''
        ratio.value = ratioOptions.value.some((item: any) => item.value === defaultRatio) ? defaultRatio : ratioOptions.value[0]?.value || ''
    }
}

const closeDropdowns = () => {
    ratioMenuOpen.value = false
    taskStatusMenuOpen.value = false
}

const selectPricePackage = (value: string) => {
    pricePackage.value = value
    syncRatio()
}

const selectRatio = (value: string) => {
    ratio.value = value
    ratioMenuOpen.value = false
}

const selectTaskStatus = async (status: TaskStatusFilter) => {
    activeTaskStatusFilter.value = status
    taskStatusMenuOpen.value = false
    await refreshTasks()
}

const triggerUpload = () => uploadInputRef.value?.click()

const handleUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    uploadBlobUrls.push(objectUrl)
    sourceImage.value = objectUrl
    sourceImageUrl.value = objectUrl
    sourceImageName.value = file.name
    sourceImageSource.value = 'local'
    sourceImageFile.value = file
    ;(event.target as HTMLInputElement).value = ''
}

const clearSourceImage = () => {
    sourceImage.value = ''
    sourceImageUrl.value = ''
    sourceImageName.value = ''
    sourceImageSource.value = 'gallery'
    sourceImageFile.value = null
    estimateInfo.value = {}
}

const openGallery = () => {
    showGalleryModal.value = true
}

const selectGallery = (item: any) => {
    sourceImage.value = item.uri || item.url || item.cover
    sourceImageUrl.value = resolveUploadPreviewUrl(item.url || item.cover || item.uri, sourceImageUrl.value)
    sourceImageName.value = item.name
    sourceImageSource.value = 'gallery'
    sourceImageFile.value = null
    showGalleryModal.value = false
}

const uploadLocalImageIfNeeded = async () => {
    if (sourceImageSource.value !== 'local' || !sourceImageFile.value) return sourceImage.value
    const previewUrl = sourceImageUrl.value
    uploading.value = true
    try {
        const res: any = await uploadImage({ file: sourceImageFile.value })
        const uri = res?.uri || res?.url || ''
        if (!uri) return sourceImage.value
        sourceImage.value = uri
        sourceImageUrl.value = previewUrl || sourceImageUrl.value || resolveUploadPreviewUrl(res?.url || uri, uri)
        sourceImageSource.value = 'gallery'
        sourceImageFile.value = null
        return uri
    } finally {
        uploading.value = false
    }
}

const buildPayload = (overrides: Partial<Record<'source_image', string>> = {}) => ({
    source_image: overrides.source_image ?? sourceImage.value,
    restore_type: restoreType.value,
    price_package: pricePackage.value,
    ratio: ratio.value,
    prompt: prompt.value
})

const updateEstimate = async () => {
    if (!sourceImage.value || sourceImageSource.value === 'local') {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcPhotoRestore(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}

const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        const imageUri = await uploadLocalImageIfNeeded()
        await generateAigcPhotoRestore(buildPayload({ source_image: imageUri }))
        await refreshTasks()
        startPolling()
    } finally {
        submitting.value = false
    }
}

const refreshTasks = async () => {
    taskLoading.value = true
    try {
        const res: any = await getAigcPhotoRestoreTasks({
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
const taskStateDescription = (item: any) => normalizeTaskStatus(item?.status) === 'failed' ? '生成失败，请调整后重新生成' : 'AI 正在修复照片，请稍候'
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskTitle = (item: any) => item.restore_type_name || selectedRestoreType.value?.name || toolDisplayName.value
const taskPrompt = (item: any) => String(item.user_prompt || item.restore_type_name || item.prompt || '参考原图完成老照片修复').trim()
const taskReferenceImage = (item: any) => item.source_image_url || item.source_image || ''
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
    return `aigc-photo-restore-${id}.${ext}`
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
            downloadName: `aigc-photo-restore-${id}-${index + 1}.${ext}`
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
    sourceImage.value = item.source_image || item.source_image_url || ''
    sourceImageUrl.value = item.source_image_url || item.source_image || ''
    sourceImageName.value = sourceImageUrl.value ? '老照片' : ''
    sourceImageSource.value = 'gallery'
    sourceImageFile.value = null
    restoreType.value = item.restore_type || restoreType.value
    pricePackage.value = matchPackageCode(item) || pricePackage.value
    syncRatio()
    ratio.value = item.ratio || ratio.value
    prompt.value = String(item.user_prompt || '')
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
    await deleteAigcPhotoRestoreTask({ id })
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
    void downloadTaskResults(id, task.items || [], `photo-restore-${id}.zip`)
}
const handlePanelDeleteOne = (_item: any, task: any) => deleteTask(rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))

const restoreTypeHint = (code: string) => ({
    repair: '修复破损、模糊、噪点和划痕',
    colorize: '为黑白或褪色照片补充自然色彩',
    repair_colorize: '同时完成清晰修复和自然上色'
}[code] || '按该类型完成照片修复')

const packageMeta = (item: any) => {
    const model = item.channel_name || item.channel || ''
    const qualityLabel = item.quality_label || item.quality || ''
    const price = Number(item.unit_price || 0).toFixed(2)
    return [model, qualityLabel, formatPoint(price)].filter(Boolean).join(' / ')
}

const packageTitle = (item: any, index = 0) => {
    const text = String([item.name, item.quality_label, item.quality].filter(Boolean).join(' ')).toLowerCase()
    if (/高清|高|2k|4k|hd|pro|max/.test(text)) return '高清'
    if (/标清|标准|1k|sd|basic|base/.test(text)) return '标清'
    return index === 1 ? '高清' : index === 0 ? '标清' : String(item.name || `方案${index + 1}`)
}

const packageResolutionLabel = (item: any, index = 0) => {
    const text = String([item.quality_label, item.name, item.quality].filter(Boolean).join(' '))
    const match = text.match(/(\d+(?:\.\d+)?)\s*k/i)
    if (match) return `${match[1].replace(/\\.0$/, '')}K`.toUpperCase()
    return index === 1 ? '2K' : '1K'
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

watch([sourceImage, restoreType, pricePackage, ratio], updateEstimate)

watch(pricePackage, syncRatio)

onMounted(async () => {
    window.addEventListener('click', closeDropdowns)
    await loadConfig()
    await loadTypes()
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
</style>
