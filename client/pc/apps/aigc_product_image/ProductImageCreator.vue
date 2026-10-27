<template>
    <div class="product-image-page">
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
                            <label class="field-label">上传商品图</label>
                            <button v-if="productImage" type="button" class="ghost-button" @click="clearProductImage">清空</button>
                        </div>
                        <div class="upload-card" :class="{ 'is-filled': !!productImage, 'is-uploading': productUploading }">
                            <template v-if="productImage">
                                <div class="upload-card__stage">
                                    <img :src="productImageUrl" alt="商品图" />
                                </div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery('product')">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerProductUpload">本地上传</button>
                                </div>
                            </template>
                            <template v-else>
                                <div class="upload-card__placeholder" @click="triggerProductUpload">
                                    <img class="upload-card__icon" :src="addIcon" alt="" />
                                    <strong>本地上传</strong>
                                    <button class="upload-card__library" type="button" @click.stop="openGallery('product')">图库上传</button>
                                </div>
                            </template>
                            <span v-if="productUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">生成图片尺寸</label>
                        <div class="tool-select-dropdown" @click.stop>
                            <button
                                class="tool-select-card tool-select-card--button"
                                type="button"
                                :aria-expanded="sizeMenuOpen"
                                @click="sizeMenuOpen = !sizeMenuOpen"
                            >
                                <span class="tool-select-card__value">{{ selectedSizeLabel }}</span>
                                <img :src="downIcon" alt="" :class="{ 'is-open': sizeMenuOpen }" />
                            </button>

                            <div v-if="sizeMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                <button
                                    v-for="item in sizeOptions"
                                    :key="item.key"
                                    :class="{ 'is-active': sizeKey === item.key }"
                                    type="button"
                                    @click="selectSize(item.key)"
                                >
                                    <span>{{ item.label }}</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">场景选择</label>
                            <div v-if="sceneMode === 'template'" class="tool-select-dropdown scene-filter" @click.stop>
                                <button
                                    class="tool-select-card tool-select-card--button"
                                    type="button"
                                    :aria-expanded="sceneCategoryMenuOpen"
                                    @click="sceneCategoryMenuOpen = !sceneCategoryMenuOpen"
                                >
                                    <span class="tool-select-card__value">{{ selectedCategoryLabel }}</span>
                                    <img :src="downIcon" alt="" :class="{ 'is-open': sceneCategoryMenuOpen }" />
                                </button>

                                <div v-if="sceneCategoryMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
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
                        <div class="segmented">
                            <button :class="{ 'is-active': sceneMode === 'template' }" type="button" @click="sceneMode = 'template'">场景模板</button>
                            <button :class="{ 'is-active': sceneMode === 'custom' }" type="button" @click="sceneMode = 'custom'">自定义场景</button>
                        </div>

                        <template v-if="sceneMode === 'template'">
                            <div class="template-grid">
                                <button
                                    v-for="item in templates"
                                    :key="item.id"
                                    class="template-card"
                                    :class="{ 'is-active': selectedTemplateId === Number(item.id) }"
                                    type="button"
                                    @click="selectTemplate(item)"
                                >
                                    <img :src="item.image_url || item.image" :alt="item.name" />
                                    <span v-if="isVipTemplate(item)" class="template-card__vip">
                                        <img :src="vipBadgeIcon" alt="" />
                                        VIP
                                    </span>
                                </button>
                                <div v-if="!templates.length && !templateLoading" class="inline-empty">暂无模板</div>
                            </div>
                        </template>

                        <template v-else>
                            <div class="upload-card" :class="{ 'is-filled': !!customSceneImage, 'is-uploading': sceneUploading }">
                                <template v-if="customSceneImage">
                                    <div class="upload-card__stage">
                                        <img :src="customSceneImageUrl" alt="自定义场景" />
                                    </div>
                                    <div class="upload-card__actions">
                                        <button class="upload-card__action" type="button" @click="openGallery('scene')">图库上传</button>
                                        <button class="upload-card__action" type="button" @click="triggerSceneUpload">本地上传</button>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class="upload-card__placeholder" @click="triggerSceneUpload">
                                        <img class="upload-card__icon" :src="addIcon" alt="" />
                                        <strong>本地上传</strong>
                                        <button class="upload-card__library" type="button" @click.stop="openGallery('scene')">图库上传</button>
                                    </div>
                                </template>
                                <span v-if="sceneUploading" class="upload-mask"><i></i>上传中</span>
                            </div>
                        </template>
                    </section>

                    <section class="field-block">
                        <label class="field-label">细节补充</label>
                        <textarea v-model="prompt" maxlength="300" placeholder="可补充商品材质、目标氛围、投放平台或需要突出的卖点"></textarea>
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
        <input ref="sceneInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleSceneUpload" />

        <AiWorkspaceAssetGalleryModal
            :visible="showGalleryModal"
            :accept-types="['image']"
            title="图库上传"
            :description="`选择资产图片作为${galleryTarget === 'product' ? '商品图' : '场景图'}`"
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
import vipBadgeIcon from '@/assets/images/icon/vip.svg'
import {
    deleteAigcProductImageTask,
    estimateAigcProductImage,
    generateAigcProductImage,
    getAigcProductImageCategories,
    getAigcProductImageConfig,
    getAigcProductImageTasks,
    getAigcProductImageTemplates
} from './api'

type GalleryTarget = 'product' | 'scene'
type UploadSource = 'gallery' | 'local'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const props = withDefaults(defineProps<{
    membershipEnabled?: boolean
}>(), {
    membershipEnabled: false
})

const router = useRouter()
const emptyImage = PRODUCT_IMAGE_EMPTY_IMAGE
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, 'AI商品图'))
const categories = ref<any[]>([])
const templates = ref<any[]>([])
const tasks = ref<any[]>([])
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_product_image')
const estimateInfo = ref<any>({})
const activeCategoryCode = ref('overview')
const selectedTemplateId = ref(0)
const sceneMode = ref<'template' | 'custom'>('template')
const productImage = ref('')
const productImageUrl = ref('')
const productImageName = ref('')
const productImageSource = ref<UploadSource>('gallery')
const productImageFile = ref<File | null>(null)
const customSceneImage = ref('')
const customSceneImageUrl = ref('')
const customSceneName = ref('')
const customSceneSource = ref<UploadSource>('gallery')
const customSceneFile = ref<File | null>(null)
const prompt = ref('')
const sizeKey = ref('1:1')
const width = ref('800')
const height = ref('800')
const productUploading = ref(false)
const sceneUploading = ref(false)
const templateLoading = ref(false)
const taskLoading = ref(false)
const taskLoadingMore = ref(false)
const taskHasMore = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const sceneCategoryMenuOpen = ref(false)
const sizeMenuOpen = ref(false)
const taskStatusMenuOpen = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const galleryTarget = ref<GalleryTarget>('product')
const previewImage = ref('')
const previewTitle = ref('')
const productInputRef = ref<HTMLInputElement | null>(null)
const sceneInputRef = ref<HTMLInputElement | null>(null)
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
const selectedCategoryLabel = computed(() => categories.value.find((item) => item.code === activeCategoryCode.value)?.name || '目录总览')
const selectedSizeLabel = computed(() => sizeOptions.value.find((item: any) => item.key === sizeKey.value)?.label || '请选择尺寸')
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? config.value?.config_json?.unit_price ?? 8).toFixed(2))
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' },
    { label: '排队中', value: 'pending' },
    { label: '生成中', value: 'running' },
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const selectedTemplate = computed(() => templates.value.find((item) => Number(item.id) === selectedTemplateId.value))
const canSubmit = computed(() => {
    if (!productImage.value || !sizeOptions.value.length || submitting.value || productUploading.value || sceneUploading.value) return false
    if (sceneMode.value === 'template') return selectedTemplateId.value > 0
    return !!customSceneImage.value
})
const isVipTemplate = (item: any) => Number(item?.vip || 0) === 1 || item?.vip === true
const assertTemplateAvailable = (item: any) => {
    if (isVipTemplate(item) && !props.membershipEnabled) {
        feedback.msgWarning('该场景模板为 VIP 专属，请开通会员后使用')
        return false
    }
    return true
}

const panelTasks = computed(() => tasks.value.map((item: any) => {
    const image = taskImage(item)
    const status = normalizeTaskStatus(item.status)
    const downloadUrl = taskDownloadHref(item)
    const id = taskId(item) || item.id || item.task_id || `${item.create_time || Date.now()}`
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

const goBackToSource = () => {
    if (window.history.length > 1) {
        router.back()
        return
    }
    router.push('/ai/tools')
}

const loadConfig = async () => {
    config.value = await getAigcProductImageConfig()
    sizeKey.value = resolveAvailableSizeKey(config.value?.default_size_key || '1:1')
    applySizePreset()
}

const loadCategories = async () => {
    categories.value = await getAigcProductImageCategories()
    if (!categories.value.some((item) => item.code === activeCategoryCode.value)) {
        activeCategoryCode.value = categories.value[0]?.code || 'overview'
    }
}

const loadTemplates = async () => {
    templateLoading.value = true
    try {
        templates.value = await getAigcProductImageTemplates({
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
        const res: any = await getAigcProductImageTasks({
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
    sceneCategoryMenuOpen.value = false
    sizeMenuOpen.value = false
    taskStatusMenuOpen.value = false
}

const selectTaskStatus = async (status: TaskStatusFilter) => {
    activeTaskStatusFilter.value = status
    taskStatusMenuOpen.value = false
    await refreshTasks({ sync: true })
}

const selectCategory = async (code: string) => {
    activeCategoryCode.value = code
    sceneCategoryMenuOpen.value = false
    await loadTemplates()
}

const selectTemplate = (item: any) => {
    if (!assertTemplateAvailable(item)) return
    selectedTemplateId.value = Number(item.id || 0)
}

const triggerProductUpload = () => productInputRef.value?.click()
const triggerSceneUpload = () => sceneInputRef.value?.click()

const handleProductUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    applyLocalUpload('product', file)
    ;(event.target as HTMLInputElement).value = ''
}

const handleSceneUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    applyLocalUpload('scene', file)
    ;(event.target as HTMLInputElement).value = ''
}

const applyLocalUpload = (target: GalleryTarget, file: File) => {
    const objectUrl = URL.createObjectURL(file)
    uploadBlobUrls.push(objectUrl)
    if (target === 'product') {
        productImage.value = objectUrl
        productImageUrl.value = objectUrl
        productImageName.value = file.name
        productImageSource.value = 'local'
        productImageFile.value = file
    } else {
        customSceneImage.value = objectUrl
        customSceneImageUrl.value = objectUrl
        customSceneName.value = file.name
        customSceneSource.value = 'local'
        customSceneFile.value = file
        sceneMode.value = 'custom'
    }
}

const applyUpload = (target: GalleryTarget, uri: string, url: string, name: string) => {
    if (!uri) return
    if (target === 'product') {
        productImage.value = uri
        productImageUrl.value = resolveUploadPreviewUrl(url || uri, productImageUrl.value || uri)
        productImageName.value = name
        productImageSource.value = 'gallery'
        productImageFile.value = null
    } else {
        customSceneImage.value = uri
        customSceneImageUrl.value = resolveUploadPreviewUrl(url || uri, customSceneImageUrl.value || uri)
        customSceneName.value = name
        customSceneSource.value = 'gallery'
        customSceneFile.value = null
        sceneMode.value = 'custom'
    }
}

const clearProductImage = () => {
    productImage.value = ''
    productImageUrl.value = ''
    productImageName.value = ''
    productImageSource.value = 'gallery'
    productImageFile.value = null
}

const clearCustomSceneImage = () => {
    customSceneImage.value = ''
    customSceneImageUrl.value = ''
    customSceneName.value = ''
    customSceneSource.value = 'gallery'
    customSceneFile.value = null
}

const openGallery = (target: GalleryTarget) => {
    galleryTarget.value = target
    showGalleryModal.value = true
}

const selectGallery = (item: any) => {
    applyUpload(galleryTarget.value, item.uri || item.url || item.cover, item.url || item.cover || item.uri, item.name)
    showGalleryModal.value = false
}

const applySizePreset = () => {
    const item = sizeOptions.value.find((option: any) => option.key === sizeKey.value)
    if (!item) return
    width.value = String(item.width)
    height.value = String(item.height)
}

const resolveAvailableSizeKey = (key: string) => {
    if (sizeOptions.value.some((item: any) => item.key === key)) return key
    return sizeOptions.value[0]?.key || ''
}

const selectSize = (key: string) => {
    sizeKey.value = resolveAvailableSizeKey(key)
    applySizePreset()
    sizeMenuOpen.value = false
}

const buildPayload = (overrides: Partial<Record<'product_image' | 'custom_scene_image', string>> = {}) => ({
    product_image: overrides.product_image ?? productImage.value,
    scene_mode: sceneMode.value,
    template_id: sceneMode.value === 'template' ? selectedTemplateId.value : 0,
    custom_scene_image: sceneMode.value === 'custom' ? (overrides.custom_scene_image ?? customSceneImage.value) : '',
    size_key: resolveAvailableSizeKey(sizeKey.value),
    width: Number(width.value || 800),
    height: Number(height.value || 800),
    prompt: prompt.value
})

const updateEstimate = async () => {
    if (!productImage.value) return
    if (productImageSource.value === 'local' || (sceneMode.value === 'custom' && customSceneSource.value === 'local')) {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcProductImage(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}

const uploadLocalImageIfNeeded = async (target: GalleryTarget) => {
    const source = target === 'product' ? productImageSource.value : customSceneSource.value
    const file = target === 'product' ? productImageFile.value : customSceneFile.value
    const current = target === 'product' ? productImage.value : customSceneImage.value
    if (source !== 'local' || !file) return current

    const previewUrl = target === 'product' ? productImageUrl.value : customSceneImageUrl.value
    if (target === 'product') {
        productUploading.value = true
    } else {
        sceneUploading.value = true
    }
    try {
        const res: any = await uploadImage({ file })
        const uri = res?.uri || res?.url || ''
        if (!uri) return current
        if (target === 'product') {
            productImage.value = uri
            productImageUrl.value = previewUrl || productImageUrl.value || resolveUploadPreviewUrl(res?.url || uri, uri)
            productImageName.value = file.name
            productImageSource.value = 'gallery'
            productImageFile.value = null
        } else {
            customSceneImage.value = uri
            customSceneImageUrl.value = previewUrl || customSceneImageUrl.value || resolveUploadPreviewUrl(res?.url || uri, uri)
            customSceneName.value = file.name
            customSceneSource.value = 'gallery'
            customSceneFile.value = null
            sceneMode.value = 'custom'
        }
        return uri
    } finally {
        if (target === 'product') {
            productUploading.value = false
        } else {
            sceneUploading.value = false
        }
    }
}

const submit = async () => {
    if (!canSubmit.value) return
    if (sceneMode.value === 'template' && selectedTemplate.value && !assertTemplateAvailable(selectedTemplate.value)) return
    submitting.value = true
    try {
        const productImageUri = await uploadLocalImageIfNeeded('product')
        const customSceneImageUri = sceneMode.value === 'custom' ? await uploadLocalImageIfNeeded('scene') : ''
        await generateAigcProductImage(buildPayload({
            product_image: productImageUri,
            custom_scene_image: customSceneImageUri
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
    return 'AI 正在生成商品图，请稍候'
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

const taskTitle = (item: any) => item.template_name || item.scene_mode_label || '商品图生成'

const taskPrompt = (item: any) => {
    const text = String(item.user_prompt || item.prompt || '').trim()
    if (text) return text
    return item.scene_mode === 'custom'
        ? '参考自定义场景图生成商品图'
        : `参考${item.template_name || '场景模板'}生成商品图`
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
    return `aigc-product-image-${id}.${ext}`
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
            downloadName: `aigc-product-image-${id}-${index + 1}.${ext}`
        }
    }).filter(Boolean)
    const fallback = taskDownloadHref(item)
    return items.length ? items : (fallback ? [{ downloadUrl: fallback, downloadName: taskDownloadName(item) }] : [])
}

const taskReferenceImage = (item: any) => item.product_image_url || item.custom_scene_image_url || item.product_image || item.custom_scene_image || ''

const formatTaskTime = (value: any) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const date = new Date(Number(value) * 1000)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const editTask = async (item: any) => {
    productImage.value = item.product_image || item.product_image_url || ''
    productImageUrl.value = item.product_image_url || item.product_image || ''
    productImageName.value = productImageUrl.value ? '商品图' : ''
    productImageSource.value = 'gallery'
    productImageFile.value = null

    const nextSceneMode = item.scene_mode === 'custom' ? 'custom' : 'template'
    sceneMode.value = nextSceneMode
    if (nextSceneMode === 'custom') {
        selectedTemplateId.value = 0
        customSceneImage.value = item.custom_scene_image || item.custom_scene_image_url || ''
        customSceneImageUrl.value = item.custom_scene_image_url || item.custom_scene_image || ''
        customSceneName.value = customSceneImageUrl.value ? '场景图' : ''
        customSceneSource.value = 'gallery'
        customSceneFile.value = null
    } else {
        clearCustomSceneImage()
        if (item.category_code && activeCategoryCode.value !== item.category_code) {
            activeCategoryCode.value = item.category_code
            await loadTemplates()
        }
        selectedTemplateId.value = Number(item.template_id || 0)
    }

    sizeKey.value = resolveAvailableSizeKey(String(item.size_key || config.value?.default_size_key || ''))
    applySizePreset()
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
    await deleteAigcProductImageTask({ id })
    await refreshTasks({ sync: true })
}

const rawPanelTask = (task: any) => task?.raw || task
const rawPanelItem = (item: any) => item?.raw || item
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
    void downloadTaskResults(id, task.items || [], `product-image-${id}.zip`)
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

watch([productImage, selectedTemplateId, customSceneImage, sceneMode, sizeKey], updateEstimate)

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
.product-image-page {
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
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #fff;
    font-size: 13px;
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

.template-card__vip {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 24px;
    padding: 0 7px;
    border-radius: 0 10px 0 10px;
    background: linear-gradient(270deg, #ffeec9 0%, #ffde97 100%);
    color: #5c4010;
    font-size: 12px;
    font-weight: 600;
    pointer-events: none;
}

.template-card .template-card__vip img {
    width: 12px;
    height: 12px;
    object-fit: contain;
}

.template-card img,
.modal-grid img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    gap: 16px;
    overflow-y: auto;
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
    .product-image-page {
        min-width: 0;
    }

    .product-workspace {
        grid-template-columns: 403px minmax(0, 1fr);
    }
}
</style>
