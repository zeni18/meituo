<template>
    <div class="style-transfer-page">
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
                            <label class="field-label">上传图片</label>
                            <button v-if="styleTransfer" type="button" class="ghost-button" @click="clearStyleTransfer">清空</button>
                        </div>
                        <div class="upload-card" :class="{ 'is-filled': !!styleTransfer, 'is-uploading': productUploading }">
                            <template v-if="styleTransfer">
                                <div class="upload-card__stage">
                                    <img :src="styleTransferUrl" alt="原图" />
                                </div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery()">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerProductUpload">本地上传</button>
                                </div>
                            </template>
                            <template v-else>
                                <div class="upload-card__placeholder" @click="triggerProductUpload">
                                    <img class="upload-card__icon" :src="addIcon" alt="" />
                                    <strong>本地上传</strong>
                                    <button class="upload-card__library" type="button" @click.stop="openGallery()">图库上传</button>
                                </div>
                            </template>
                            <span v-if="productUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">风格选择</label>
                            <div class="tool-select-dropdown scene-filter" @click.stop>
                                <button
                                    class="tool-select-card tool-select-card--button"
                                    type="button"
                                    :aria-expanded="styleCategoryMenuOpen"
                                    @click="styleCategoryMenuOpen = !styleCategoryMenuOpen"
                                >
                                    <span class="tool-select-card__value">{{ selectedCategoryLabel }}</span>
                                    <img :src="downIcon" alt="" :class="{ 'is-open': styleCategoryMenuOpen }" />
                                </button>

                                <div v-if="styleCategoryMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                    <button
                                        v-for="item in categories"
                                        :key="item.id || item.code"
                                        :class="{ 'is-active': activeCategoryCode === item.code }"
                                        type="button"
                                        @click="selectCategory(item.code)"
                                    >
                                        <span>{{ item.name }}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="template-grid template-grid--style">
                            <button
                                v-for="item in templates"
                                :key="item.id"
                                class="template-card template-card--style"
                                :class="{ 'is-active': selectedTemplateId === Number(item.id) }"
                                type="button"
                                @click="selectTemplate(item)"
                            >
                                <img :src="item.image_url || item.image" :alt="item.name" />
                                <span class="template-card__body">
                                    <strong>{{ item.name }}</strong>
                                    <em>{{ item.prompt || item.category_name || '参考该风格完成图片风格化' }}</em>
                                </span>
                            </button>
                            <div v-if="!templates.length && !templateLoading" class="inline-empty">暂无模板</div>
                        </div>
                    </section>

                    <section v-if="enabledPricePackages.length" class="field-block">
                        <label class="field-label">生成质量</label>
                        <div class="model-specs">
                            <div class="quality-package-grid">
                                <button
                                    v-for="(item, index) in enabledPricePackages"
                                    :key="item.code"
                                    class="quality-package-card"
                                    :class="{ 'is-active': selectedPackageCode === item.code }"
                                    type="button"
                                    @click="selectPricePackage(item.code)"
                                >
                                    <strong>{{ packageTitle(item, index) }}</strong>
                                    <span>{{ packageResolutionLabel(item, index) }}</span>
                                </button>
                            </div>
                            <div class="model-specs__row model-specs__row--single">
                                <div class="tool-select-dropdown model-select" @click.stop>
                                    <button
                                        class="tool-select-card tool-select-card--button"
                                        type="button"
                                        :aria-expanded="ratioMenuOpen"
                                        @click="ratioMenuOpen = !ratioMenuOpen"
                                    >
                                        <span class="tool-select-card__value">{{ selectedRatioLabel }}</span>
                                        <img :src="downIcon" alt="" :class="{ 'is-open': ratioMenuOpen }" />
                                    </button>
                                    <div v-if="ratioMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                        <button
                                            v-for="item in ratioOptions"
                                            :key="item.value"
                                            :class="{ 'is-active': selectedRatioValue === item.value }"
                                            type="button"
                                            @click="selectRatio(item.value)"
                                        >
                                            <span>{{ item.label }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">细节补充</label>
                        <textarea v-model="prompt" maxlength="300" placeholder="可补充希望保留的主体特征、目标氛围、色调或风格细节"></textarea>
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
                :has-more="taskHasMore"
                :loading-more="taskLoadingMore"
                @refresh="handleTaskRefresh"
                @filter-change="selectTaskStatus"
                @load-more="loadMoreTasks"
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

        <input ref="productInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleProductUpload" />

        <AiWorkspaceAssetGalleryModal
            :visible="showGalleryModal"
            :accept-types="['image']"
            title="图库上传"
            description="选择资产图片作为原图"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
    deleteAigcStyleTransferTask,
    estimateAigcStyleTransfer,
    generateAigcStyleTransfer,
    getAigcStyleTransferCategories,
    getAigcStyleTransferConfig,
    getAigcStyleTransferTasks,
    getAigcStyleTransferTemplates
} from './api'

type UploadSource = 'gallery' | 'local'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'
type RatioOption = { label: string; value: string; width?: number; height?: number; tenant_unit_price?: number | string }

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const emptyImage = PRODUCT_IMAGE_EMPTY_IMAGE
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '图片风格化'))
const categories = ref<any[]>([])
const templates = ref<any[]>([])
const tasks = ref<any[]>([])
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_style_transfer')
const estimateInfo = ref<any>({})
const activeCategoryCode = ref('overview')
const selectedTemplateId = ref(0)
const styleTransfer = ref('')
const styleTransferUrl = ref('')
const styleTransferName = ref('')
const styleTransferSource = ref<UploadSource>('gallery')
const styleTransferFile = ref<File | null>(null)
const prompt = ref('')
const sizeKey = ref('1:1')
const width = ref('800')
const height = ref('800')
const productUploading = ref(false)
const templateLoading = ref(false)
const taskLoading = ref(false)
const taskLoadingMore = ref(false)
const taskHasMore = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const styleCategoryMenuOpen = ref(false)
const taskStatusMenuOpen = ref(false)
const ratioMenuOpen = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const previewImage = ref('')
const previewTitle = ref('')
const productInputRef = ref<HTMLInputElement | null>(null)
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const uploadBlobUrls: string[] = []
const TASK_PAGE_SIZE = 10
const taskPageNo = ref(1)

const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) {
        return fallback
    }
    return resolved
}

const sizeOptions = computed(() => config.value?.size_options || [])
const pricePackages = computed(() => config.value?.price_packages || config.value?.price_options || [])
const enabledPricePackages = computed(() => pricePackages.value.filter((item: any) => Number(item.status ?? 1) === 1))
const selectedPackageCode = ref('')
const selectedRatioValue = ref('')
const selectedPackage = computed(() => enabledPricePackages.value.find((item: any) => item.code === selectedPackageCode.value) || enabledPricePackages.value[0] || {})
const ratioOptions = computed<RatioOption[]>(() =>
    (selectedPackage.value?.ratios || []).map((ratio: any) => ({
        ...ratio,
        label: ratio.label || ratio.ratio || ratio.value,
        value: ratio.value || ratio.ratio
    })).filter((ratio: RatioOption) => ratio.value)
)
const activeRatio = computed(() => ratioOptions.value.find((item) => item.value === selectedRatioValue.value) || ratioOptions.value[0])
const selectedRatioLabel = computed(() => activeRatio.value?.label || '选择比例')
const selectedCategoryLabel = computed(() => categories.value.find((item) => item.code === activeCategoryCode.value)?.name || '目录总览')
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
    const id = taskId(item) || item.id || item.task_id || `style-transfer-${item.create_time || Date.now()}`
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

const canSubmit = computed(() => {
    if (!styleTransfer.value || submitting.value || productUploading.value) return false
    if (!enabledPricePackages.value.length || !selectedPackageCode.value || !selectedRatioValue.value) return false
    return selectedTemplateId.value > 0
})

const goBackToSource = () => {
    if (window.history.length > 1) {
        router.back()
        return
    }
    router.push('/ai/tools')
}

const loadConfig = async () => {
    config.value = await getAigcStyleTransferConfig()
    sizeKey.value = config.value?.default_size_key || '1:1'
    selectedPackageCode.value = defaultPackageCode()
    selectedRatioValue.value = config.value?.config_json?.ratio || config.value?.option_config?.defaults?.ratio || ''
    applySizePreset()
    syncPackageSpec()
}

const loadCategories = async () => {
    categories.value = await getAigcStyleTransferCategories()
    if (!categories.value.some((item) => item.code === activeCategoryCode.value)) {
        activeCategoryCode.value = categories.value[0]?.code || 'overview'
    }
}

const loadTemplates = async () => {
    templateLoading.value = true
    try {
        templates.value = await getAigcStyleTransferTemplates({
            category_code: activeCategoryCode.value === 'overview' ? '' : activeCategoryCode.value
        })
        if (!templates.value.some((item) => Number(item.id) === selectedTemplateId.value)) {
            selectedTemplateId.value = Number(templates.value[0]?.id || 0)
        }
    } finally {
        templateLoading.value = false
    }
}

const refreshTasks = async (options: { page?: number; append?: boolean; sync?: boolean } = {}) => {
    const page = Math.max(1, options.page || 1)
    const append = !!options.append
    if (append) {
        taskLoadingMore.value = true
    } else {
        taskLoading.value = true
    }
    try {
        const res: any = await getAigcStyleTransferTasks({
            page_no: page,
            page_size: TASK_PAGE_SIZE,
            status: activeTaskStatusFilter.value,
            light: 1,
            sync_running: options.sync ? 1 : 0
        })
        const lists = Array.isArray(res?.lists) ? res.lists : []
        tasks.value = append ? [...tasks.value, ...lists] : lists
        taskPageNo.value = page
        const count = Number(res?.count || 0)
        taskHasMore.value = count ? page * TASK_PAGE_SIZE < count : lists.length >= TASK_PAGE_SIZE
    } finally {
        taskLoading.value = false
        taskLoadingMore.value = false
    }
}

const handleTaskRefresh = () => refreshTasks({ sync: true })

const loadMoreTasks = () => {
    if (taskLoading.value || taskLoadingMore.value || !taskHasMore.value) return
    void refreshTasks({ page: taskPageNo.value + 1, append: true })
}

const loadTasksDeferred = async () => {
    await nextTick()
    const run = () => refreshTasks({ sync: false })
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(run, { timeout: 1200 })
        return
    }
    window.setTimeout(run, 0)
}

const closeDropdowns = () => {
    styleCategoryMenuOpen.value = false
    taskStatusMenuOpen.value = false
    ratioMenuOpen.value = false
}

const selectTaskStatus = async (status: TaskStatusFilter) => {
    activeTaskStatusFilter.value = status
    taskStatusMenuOpen.value = false
    await refreshTasks({ sync: true })
}

const selectCategory = async (code: string) => {
    activeCategoryCode.value = code
    styleCategoryMenuOpen.value = false
    await loadTemplates()
}

const selectTemplate = (item: any) => {
    selectedTemplateId.value = Number(item.id || 0)
}

const syncPackageSpec = () => {
    if (!enabledPricePackages.value.length) return
    if (!enabledPricePackages.value.some((item: any) => item.code === selectedPackageCode.value)) {
        selectedPackageCode.value = defaultPackageCode()
    }
    if (!ratioOptions.value.some((item) => item.value === selectedRatioValue.value)) {
        const defaultRatio = config.value?.config_json?.ratio || config.value?.option_config?.defaults?.ratio || ''
        selectedRatioValue.value = ratioOptions.value.some((item) => item.value === defaultRatio) ? defaultRatio : ratioOptions.value[0]?.value || ''
    }
    if (!ratioOptions.value.some((item) => item.value === selectedRatioValue.value)) {
        selectedRatioValue.value = ratioOptions.value[0]?.value || ''
    }
}

const selectPricePackage = (value: string) => {
    selectedPackageCode.value = value
    selectedRatioValue.value = ''
    syncPackageSpec()
}

const selectRatio = (value: string) => {
    selectedRatioValue.value = value
    syncPackageSpec()
    ratioMenuOpen.value = false
}

const triggerProductUpload = () => productInputRef.value?.click()

const handleProductUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    applyLocalUpload(file)
    ;(event.target as HTMLInputElement).value = ''
}

const applyLocalUpload = (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    uploadBlobUrls.push(objectUrl)
    styleTransfer.value = objectUrl
    styleTransferUrl.value = objectUrl
    styleTransferName.value = file.name
    styleTransferSource.value = 'local'
    styleTransferFile.value = file
}

const applyUpload = (uri: string, url: string, name: string) => {
    if (!uri) return
    styleTransfer.value = uri
    styleTransferUrl.value = resolveUploadPreviewUrl(url || uri, styleTransferUrl.value || uri)
    styleTransferName.value = name
    styleTransferSource.value = 'gallery'
    styleTransferFile.value = null
}

const clearStyleTransfer = () => {
    styleTransfer.value = ''
    styleTransferUrl.value = ''
    styleTransferName.value = ''
    styleTransferSource.value = 'gallery'
    styleTransferFile.value = null
}

const openGallery = () => {
    showGalleryModal.value = true
}

const selectGallery = (item: any) => {
    applyUpload(item.uri || item.url || item.cover, item.url || item.cover || item.uri, item.name)
    showGalleryModal.value = false
}

const applySizePreset = () => {
    const item = sizeOptions.value.find((option: any) => option.key === sizeKey.value)
    if (!item || item.key === 'custom') return
    width.value = String(item.width)
    height.value = String(item.height)
}

const selectedOutputSize = computed(() => {
    const ratio = activeRatio.value
    return {
        width: Number(ratio?.width || width.value || 800),
        height: Number(ratio?.height || height.value || 800)
    }
})

const buildPayload = (overrides: Partial<Record<'source_image', string>> = {}) => ({
    source_image: overrides.source_image ?? styleTransfer.value,
    style_mode: 'template',
    template_id: selectedTemplateId.value,
    size_key: activeRatio.value ? 'custom' : sizeKey.value,
    width: selectedOutputSize.value.width,
    height: selectedOutputSize.value.height,
    price_package: selectedPackageCode.value,
    ratio: selectedRatioValue.value,
    prompt: prompt.value
})

const updateEstimate = async () => {
    if (!styleTransfer.value) return
    if (styleTransferSource.value === 'local') {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcStyleTransfer(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}

const uploadLocalImageIfNeeded = async () => {
    const source = styleTransferSource.value
    const file = styleTransferFile.value
    const current = styleTransfer.value
    if (source !== 'local' || !file) return current

    const previewUrl = styleTransferUrl.value
    productUploading.value = true
    try {
        const res: any = await uploadImage({ file })
        const uri = res?.uri || res?.url || ''
        if (!uri) return current
        styleTransfer.value = uri
        styleTransferUrl.value = previewUrl || styleTransferUrl.value || resolveUploadPreviewUrl(res?.url || uri, uri)
        styleTransferName.value = file.name
        styleTransferSource.value = 'gallery'
        styleTransferFile.value = null
        return uri
    } finally {
        productUploading.value = false
    }
}

const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        const styleTransferUri = await uploadLocalImageIfNeeded()
        await generateAigcStyleTransfer(buildPayload({
            source_image: styleTransferUri
        }), { suppressErrorMessage: true })
        await refreshTasks({ sync: true })
        startPolling()
    } finally {
        submitting.value = false
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

const taskStateDescription = (item: any) => {
    const status = normalizeTaskStatus(item?.status)
    if (status === 'success') return '作品已生成完成'
    if (status === 'failed') return '生成失败，请调整后重新生成'
    if (status === 'canceled') return '任务已取消'
    if (status === 'pending') return '任务已进入队列，请稍候'
    return 'AI 正在生成风格化，请稍候'
}

const taskId = (item: any) => Number(item?.task_id || item?.id || 0)

const taskMediaRatio = (item: any) => {
    const frameWidth = Number(item?.width || 0)
    const frameHeight = Number(item?.height || 0)
    if (frameWidth > 0 && frameHeight > 0) {
        return { width: frameWidth, height: frameHeight }
    }

    const match = String(item?.size_key || item?.ratio || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
    if (match) {
        return { width: Number(match[1]), height: Number(match[2]) }
    }
    return { width: 1, height: 1 }
}

const taskMediaFrameStyle = (item: any) => {
    taskMediaRatio(item)
    return {}
}

const taskSizeLabel = (item: any) => {
    if (item?.size_label) return item.size_label
    const widthValue = Number(item?.width || 0)
    const heightValue = Number(item?.height || 0)
    if (widthValue > 0 && heightValue > 0) return `${widthValue}×${heightValue}`
    return item?.ratio || item?.size_key || ''
}

const taskTitle = (item: any) => item.template_name || item.style_mode_label || '风格化生成'

const taskPrompt = (item: any) => {
    const text = String(item.user_prompt || item.prompt || '').trim()
    if (text) return text
    return `参考${item.template_name || '风格模板'}生成风格化`
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
    return `aigc-style-transfer-${id}.${ext}`
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
            downloadName: `aigc-style-transfer-${id}-${index + 1}.${ext}`
        }
    }).filter(Boolean)
    const fallback = taskDownloadHref(item)
    return items.length ? items : (fallback ? [{ downloadUrl: fallback, downloadName: taskDownloadName(item) }] : [])
}

const taskReferenceImage = (item: any) => item.source_image_url || item.style_image_url || item.source_image || item.style_image || ''

const formatTaskTime = (value: any) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const date = new Date(Number(value) * 1000)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const editTask = async (item: any) => {
    styleTransfer.value = item.source_image || item.source_image_url || ''
    styleTransferUrl.value = item.source_image_url || item.source_image || ''
    styleTransferName.value = styleTransferUrl.value ? '风格化' : ''
    styleTransferSource.value = 'gallery'
    styleTransferFile.value = null

    if (item.category_code && activeCategoryCode.value !== item.category_code) {
        activeCategoryCode.value = item.category_code
        await loadTemplates()
    }
    selectedTemplateId.value = Number(item.template_id || 0)

    sizeKey.value = String(item.size_key || 'custom')
    width.value = String(item.width || 800)
    height.value = String(item.height || 800)
    selectedPackageCode.value = matchPackageCode(item) || selectedPackageCode.value
    syncPackageSpec()
    selectedRatioValue.value = item.ratio || selectedRatioValue.value
    syncPackageSpec()
    prompt.value = String(item.user_prompt || item.prompt || '')
}

const rerunTask = async (item: any) => {
    await editTask(item)
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
    await deleteAigcStyleTransferTask({ id })
    await refreshTasks({ sync: true })
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
    void downloadTaskResults(id, task.items || [], `style-transfer-${id}.zip`)
}
const handlePanelDeleteOne = (_item: any, task: any) => deleteTask(rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))

const startPolling = () => {
    if (pollTimer) return
    pollTimer = window.setInterval(async () => {
        await refreshTasks({ sync: true })
        if (!tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) {
            stopPolling()
        }
    }, 5000)
}

const stopPolling = () => {
    if (pollTimer) {
        window.clearInterval(pollTimer)
        pollTimer = null
    }
}

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
    const defaultChannel = config.value?.config_json?.channel || config.value?.option_config?.defaults?.channel || ''
    const defaultQuality = config.value?.config_json?.quality || config.value?.option_config?.defaults?.quality || ''
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

watch([styleTransfer, selectedTemplateId, sizeKey, width, height, selectedPackageCode, selectedRatioValue], updateEstimate)
watch(selectedPackageCode, syncPackageSpec)

onMounted(async () => {
    window.addEventListener('click', closeDropdowns)
    await loadConfig()
    await loadCategories()
    await loadTemplates()
    void loadTasksDeferred()
})

onUnmounted(() => {
    window.removeEventListener('click', closeDropdowns)
    stopPolling()
    uploadBlobUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<style scoped lang="scss">
.style-transfer-page {
    height: 100%;
    min-width: calc(403px + 24px + 560px);
}

.product-workspace {
    display: grid;
    grid-template-columns: 403px minmax(0, 1fr);
    gap: 24px;
    height: 100%;
}

.product-panel {
    min-height: 0;
    border-radius: 20px;
    background: #0f0f0f;
    color: #fff;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
}

.product-panel--form {
    display: flex;
    flex-direction: column;
}

.product-head {
    display: grid;
    grid-template-columns: 86px minmax(0, 1fr) 86px;
    align-items: center;
    min-height: 56px;
    padding: 0 20px;
    border-bottom: 1px solid #222;
}

.product-head__back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: #171717;
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
}

.product-head__back-icon {
    width: 8px;
    height: 8px;
    border-left: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg);
}

.product-head__title {
    text-align: center;
}

.product-head__title h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.product-panel__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 32px;
    min-height: 0;
    padding: 20px 20px 112px;
    overflow-y: auto;
    scroll-padding-bottom: 124px;
}

.field-block {
    display: grid;
    gap: 14px;
}

.field-head,
.result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.result-head__actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
}

.result-filter {
    position: relative;
}

.field-label {
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    font-weight: 600;
}

.ghost-button,
.result-head button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
}

.result-head button:disabled {
    cursor: not-allowed;
    opacity: 0.72;
}

.result-filter__button {
    min-width: 116px;
}

.result-filter__button img {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
}

.result-filter__button img.is-open {
    transform: rotate(180deg);
}

.result-filter__menu {
    right: 0;
    left: auto;
    width: 116px;
    box-sizing: border-box;
}

.result-refresh i {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}

.upload-card {
    position: relative;
    display: block;
    height: 176px;
    border: 0;
    border-radius: 10px;
    background: #262626;
    color: #fff;
    overflow: hidden;
}

.upload-card:hover {
    background: #2c2c2c;
}

.upload-card__stage {
    position: relative;
    width: 100%;
    height: 100%;
    background: #050505;
}

.upload-card__stage img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.upload-card__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    height: 100%;
    min-height: 176px;
    padding: 20px;
    cursor: pointer;
    box-sizing: border-box;
}

.upload-card__icon {
    width: 40px;
    height: 40px;
    object-fit: contain;
}

.upload-card strong {
    color: #b8b8b8;
    font-size: 14px;
    font-weight: 500;
}

.upload-card__name {
    position: absolute;
    right: 10px;
    bottom: 10px;
    left: 10px;
    overflow: hidden;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.58);
    color: #fff;
    font-size: 12px;
    line-height: 28px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.upload-card__library,
.upload-card__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    min-width: auto;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
}

.upload-card__library:hover,
.upload-card__action:hover {
    background: #3c3c3c;
}

.upload-card__actions {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    background: rgba(5, 5, 5, 0.42);
    opacity: 0;
    pointer-events: none;
    backdrop-filter: blur(2px);
    transition: opacity 0.2s ease;
}

.upload-card.is-filled:hover .upload-card__actions {
    opacity: 1;
    pointer-events: auto;
}

.upload-mask {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(2px);
}

.upload-mask i {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 4px;
    border: 1px solid #222;
    border-radius: 10px;
    background: #171719;
}

.segmented button {
    height: 40px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 600;
}

.segmented button.is-active {
    background: #fff;
    color: #050505;
}

.scene-filter {
    position: relative;
    width: 128px;
}

.model-specs {
    display: grid;
    gap: 10px;
}

.quality-package-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.quality-package-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    min-height: 64px;
    padding: 12px 14px;
    border: 1px solid #222;
    border-radius: 10px;
    background: #171717;
    color: #fff;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
}

.quality-package-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: #1f1f1f;
}

.quality-package-card.is-active {
    border-color: #fff;
    background: #fff;
    color: #111;
}

.quality-package-card strong,
.quality-package-card span {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.quality-package-card strong {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
}

.quality-package-card span {
    color: rgba(255, 255, 255, 0.56);
    font-size: 12px;
    line-height: 1.2;
    text-transform: uppercase;
}

.quality-package-card.is-active span {
    color: rgba(0, 0, 0, 0.48);
}

.model-specs__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.model-specs__row--single {
    grid-template-columns: minmax(0, 1fr);
}

.model-select {
    position: relative;
    min-width: 0;
}

.tool-select-dropdown {
    position: relative;
}

.tool-select-card {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid #222;
    border-radius: 8px;
    background: #0f0f0f;
    box-sizing: border-box;
}

.tool-select-card:hover {
    border-color: rgba(255, 255, 255, 0.18);
}

.tool-select-card--button {
    width: 100%;
    justify-content: space-between;
    cursor: pointer;
}

.tool-select-card__value {
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-size: 13px;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tool-select-card--button img {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
}

.tool-select-card--button img.is-open {
    transform: rotate(180deg);
}

.tool-filter-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    background: #171717;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.tool-filter-menu--select {
    width: 100%;
}

.tool-filter-menu--dropdown {
    max-height: 332px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #242424 transparent;
}

.tool-filter-menu--dropdown::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    background: transparent;
}

.tool-filter-menu--dropdown::-webkit-scrollbar-track {
    background: transparent;
}

.tool-filter-menu--dropdown::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #242424;
}

.tool-filter-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #fff;
    font-size: 13px;
}

.tool-filter-menu button small {
    min-width: 0;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tool-filter-menu button:hover,
.tool-filter-menu button.is-active {
    background: #252525;
}

.template-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
}

.template-card,
.modal-grid button {
    position: relative;
    min-width: 0;
    border: 1px solid #222;
    border-radius: 10px;
    background: #0f0f0f;
    color: #fff;
    overflow: hidden;
}

.template-card {
    display: block;
    width: 100%;
    margin: 0;
    aspect-ratio: 1 / 1;
}

.template-card.is-active,
.modal-grid button.is-active {
    border-color: #fff;
}

.template-card img,
.modal-grid img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.template-grid--style {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.template-card--style {
    display: flex;
    min-height: 184px;
    aspect-ratio: auto;
    flex-direction: column;
    text-align: left;
}

.template-card--style img {
    flex: 0 0 108px;
    height: 108px;
    background: #262626;
}

.template-card__body {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
}

.template-card__body strong {
    overflow: hidden;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.template-card__body em {
    display: -webkit-box;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.48);
    font-size: 12px;
    font-style: normal;
    line-height: 1.45;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.modal-grid span {
    position: absolute;
    right: 6px;
    bottom: 6px;
    left: 6px;
    overflow: hidden;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.62);
    font-size: 12px;
    font-weight: 600;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.field-block textarea {
    border: 1px solid #222;
    border-radius: 8px;
    background: #0f0f0f;
    color: #fff;
}

.field-block textarea {
    min-height: 86px;
    padding: 10px 12px;
    resize: vertical;
}

.submit-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
    background: #0f0f0f;
}

.submit-bar span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 12px;
}

.submit-bar strong {
    display: block;
    margin-top: 4px;
    font-size: 18px;
}

.submit-bar button {
    min-width: 132px;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: #fff;
    color: #111;
    font-size: 14px;
    font-weight: 600;
}

.submit-bar button:disabled {
    background: rgba(255, 255, 255, 0.24);
    color: rgba(255, 255, 255, 0.5);
}

.product-panel--result {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    overflow: hidden;
}

.result-head h2 {
    margin: 0;
    font-size: 16px;
}

.inline-empty {
    display: grid;
    place-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
}

.result-empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 0;
    color: rgba(255, 255, 255, 0.62);
}

.result-empty__placeholder {
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

.result-empty p {
    margin: 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    line-height: 22px;
    text-align: center;
}

.task-stream {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 18px;
    min-height: 0;
    padding-right: 4px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #242424 transparent;
}

.task-stream::-webkit-scrollbar {
    width: 6px;
    background: transparent;
}

.task-stream::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #242424;
}

.task-row {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px;
    border: 1px solid #222;
    border-radius: 14px;
    background: #171717;
}

.task-row__head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-width: 0;
}

.task-row__head strong,
.task-row__head span:not(.task-row__badge) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.task-row__head strong {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
}

.task-row__head span:not(.task-row__badge) {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    line-height: 1;
}

.task-row__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 8px;
    background: rgba(244, 164, 36, 0.14);
    color: #f4b247;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
}

.task-row__status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: #141414;
    color: rgba(255, 255, 255, 0.76) !important;
    font-size: 12px;
    line-height: 1;
}

.task-row__status.is-failed {
    border-color: rgba(255, 95, 95, 0.18);
    background: rgba(255, 95, 95, 0.07);
    color: #ff8b8b !important;
}

.task-row__status.is-success {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82) !important;
}

.task-row__status.is-pending,
.task-row__status.is-running {
    border-color: rgba(255, 255, 255, 0.08);
    background: #0f0f0f;
    color: rgba(255, 255, 255, 0.9) !important;
}

.task-row__status i {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}

.task-row__prompt {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
    min-height: 64px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #0f0f0f;
    box-sizing: border-box;
}

.task-row__prompt img {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    margin-right: 10px;
    border-radius: 8px;
    background: #262626;
    object-fit: cover;
}

.task-row__prompt p {
    display: -webkit-box;
    width: 100%;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    line-height: 1.6;
    text-overflow: ellipsis;
    overflow-wrap: anywhere;
    word-break: break-all;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.task-row__media {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    width: 240px;
    max-width: 100%;
    height: 240px;
    border-radius: 14px;
    background: #0f0f0f;
    overflow: hidden;
}

.task-row__media.is-clickable {
    cursor: zoom-in;
}

.task-row__media.is-clickable:hover img {
    opacity: 0.9;
}

.task-row__media.is-empty {
    width: 240px;
    height: 240px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: #0f0f0f;
}

.task-row__media img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
}

.task-row__media-actions {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    height: 42px;
    border-radius: 0 0 14px 14px;
    background: rgba(16, 16, 16, 0.64);
    box-shadow: 0 -12px 24px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    opacity: 0;
    transform: translateY(100%);
    transition: opacity 0.2s ease, transform 0.2s ease;
    overflow: hidden;
    backdrop-filter: blur(18px) saturate(1.15);
    -webkit-backdrop-filter: blur(18px) saturate(1.15);
}

.task-row__media-action,
.task-row__media-download {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    height: 42px;
    padding: 0 8px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
}

.task-row__media-action + .task-row__media-action {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.task-row__media-action:hover:not(:disabled),
.task-row__media-download:hover {
    background: rgba(255, 255, 255, 0.08);
}

.task-row__media-action:first-child,
.task-row__media-download:first-child {
    border-bottom-left-radius: 14px;
}

.task-row__media-action:last-child,
.task-row__media-download:last-child {
    border-bottom-right-radius: 14px;
}

.task-row__media-action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.task-row__media-action img,
.task-row__media-download img {
    width: 16px;
    height: 16px;
    object-fit: contain;
}

.task-row__media.is-clickable:hover .task-row__media-actions,
.task-row__media-actions:focus-within,
.task-row__media.is-clickable:hover .task-row__media-download,
.task-row__media-download:focus-visible {
    opacity: 1;
    transform: translateY(0);
}

.task-row__state {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    height: 100%;
    min-height: 82px;
    padding: 18px 20px;
    background: transparent;
    box-sizing: border-box;
}

.task-row__state.is-failed {
    border-color: rgba(255, 95, 95, 0.18);
    background: linear-gradient(0deg, rgba(255, 95, 95, 0.07), rgba(255, 95, 95, 0.07)), #0f0f0f;
}

.task-row__state.is-pending,
.task-row__state.is-running {
    justify-content: center;
    border-color: rgba(255, 255, 255, 0.08);
    background: #0f0f0f;
}

.task-row__state i {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}

.task-row__state div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 8px;
}

.task-row__state.is-pending div,
.task-row__state.is-running div {
    width: auto;
    align-items: center;
}

.task-row__state strong {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
}

.task-row__state span {
    display: -webkit-box;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.58);
    font-size: 13px;
    line-height: 1.5;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.task-row__state.is-failed span {
    color: rgba(255, 186, 186, 0.82);
}

.task-row__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
}

.task-row__actions button,
.task-row__actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #a1a1a1;
    font-size: 14px;
}

.task-row__actions img {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
}

.task-row__action--download img {
    opacity: 0.63;
}

.task-row__actions button:last-child img {
    width: 16px;
    height: 16px;
    opacity: 0.72;
}

.task-row__actions button:hover:not(:disabled),
.task-row__actions a:hover {
    color: #fff;
}

.task-row__actions button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
}

.modal-mask {
    position: fixed;
    inset: 0;
    z-index: 20000;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.56);
    backdrop-filter: blur(8px);
}

.gallery-modal {
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

.gallery-modal header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
}

.gallery-modal header strong {
    display: block;
    font-size: 22px;
}

.gallery-modal header span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
}

.gallery-modal header button {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 10px;
    background: #242424;
    color: #fff;
    font-size: 22px;
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

.media-preview img {
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

.modal-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-auto-rows: 238px;
    flex: 1;
    min-height: 0;
    gap: 16px;
    overflow-y: auto;
}

.modal-grid.is-empty {
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-grid.is-empty .inline-empty {
    width: 100%;
    min-height: 320px;
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.02);
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 1200px) {
    .style-transfer-page {
        min-width: 0;
    }

    .product-workspace {
        grid-template-columns: 403px minmax(0, 1fr);
    }
}
</style>
