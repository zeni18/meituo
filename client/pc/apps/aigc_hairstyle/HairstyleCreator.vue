<template>
    <div class="hairstyle-page">
        <section class="product-workspace">
            <div class="product-panel product-panel--form">
                <header class="product-head">
                    <button class="product-head__back" type="button" @click="goBackToSource">
                        <span class="product-head__back-icon" aria-hidden="true"></span>
                        <span>返回</span>
                    </button>
                    <div class="product-head__title"><h1>{{ toolDisplayName }}</h1></div>
                    <span class="product-head__spacer" aria-hidden="true"></span>
                </header>

                <div class="product-panel__body">
                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">上传人物原图</label>
                            <button v-if="personImage" type="button" class="ghost-button" @click="clearUpload('person')">清空</button>
                        </div>
                        <div class="upload-card" :class="{ 'is-filled': !!personImage, 'is-uploading': personUploading }">
                            <template v-if="personImage">
                                <div class="upload-card__stage"><img :src="personImageUrl || personImage" alt="人物原图" /></div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery('person')">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerUpload('person')">本地上传</button>
                                </div>
                            </template>
                            <template v-else>
                                <div class="upload-card__placeholder" @click="triggerUpload('person')">
                                    <img class="upload-card__icon" :src="addIcon" alt="" />
                                    <strong>本地上传</strong>
                                    <button class="upload-card__library" type="button" @click.stop="openGallery('person')">图库上传</button>
                                </div>
                            </template>
                            <span v-if="personUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                        <div v-if="personExamples.length" class="example-strip">
                            <button v-for="item in personExamples" :key="`person-${item.id}`" type="button" :class="{ 'is-active': personImage === item.image }" @click="selectExample('person', item)">
                                <img :src="item.image" :alt="item.name" />
                            </button>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">上传发型参考图</label>
                            <button v-if="referenceImage" type="button" class="ghost-button" @click="clearUpload('reference')">清空</button>
                        </div>
                        <div class="upload-card" :class="{ 'is-filled': !!referenceImage, 'is-uploading': referenceUploading }">
                            <template v-if="referenceImage">
                                <div class="upload-card__stage"><img :src="referenceImageUrl || referenceImage" alt="发型参考图" /></div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery('reference')">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerUpload('reference')">本地上传</button>
                                </div>
                            </template>
                            <template v-else>
                                <div class="upload-card__placeholder" @click="triggerUpload('reference')">
                                    <img class="upload-card__icon" :src="addIcon" alt="" />
                                    <strong>本地上传</strong>
                                    <button class="upload-card__library" type="button" @click.stop="openGallery('reference')">图库上传</button>
                                </div>
                            </template>
                            <span v-if="referenceUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                        <div v-if="referenceExamples.length" class="example-strip">
                            <button v-for="item in referenceExamples" :key="`reference-${item.id}`" type="button" :class="{ 'is-active': referenceImage === item.image }" @click="selectExample('reference', item)">
                                <img :src="item.image" :alt="item.name" />
                            </button>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">选择操作</label>
                        <div class="option-grid">
                            <button v-for="item in operationOptions" :key="item.value" type="button" class="option-card" :class="{ 'is-active': operation === item.value }" @click="selectOperation(item.value)">
                                <strong>{{ item.label }}</strong>
                                <span>{{ operationDescription(item.value) }}</span>
                            </button>
                        </div>
                    </section>
                </div>

                <div class="submit-bar">
                    <div><span>预计消耗</span><strong>{{ formatPoint(estimatePoints) }}</strong></div>
                    <button type="button" :disabled="!canSubmit" @click="submit">{{ submitting ? '生成中' : '立即生成' }}</button>
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

        <input ref="fileInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload" />
        <AiWorkspaceAssetGalleryModal :visible="showGalleryModal" :accept-types="['image']" title="图库上传" :description="galleryTarget === 'person' ? '选择资产图片作为人物原图' : '选择资产图片作为发型参考图'" @close="showGalleryModal = false" @select="selectGallery" />
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
import { useRoute, useRouter } from 'vue-router'
import { uploadImage } from '@/api/app'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import feedback from '@/utils/feedback'
import {
    deleteAigcHairstyleTask,
    estimateAigcHairstyle,
    generateAigcHairstyle,
    getAigcHairstyleConfig,
    getAigcHairstyleTasks
} from './api'

type UploadSource = 'gallery' | 'local' | 'example'
type GalleryTarget = 'person' | 'reference'
type Operation = 'hair_style' | 'hair_color' | 'hair_style_color'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'
type ExampleItem = { id: string; name: string; image: string }

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const route = useRoute()
const { ensurePcLogin } = usePcLoginGate()
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_hairstyle')
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, 'AI换发型'))
const estimateInfo = ref<any>({})
const tasks = ref<any[]>([])
const personImage = ref('')
const personImageUrl = ref('')
const personImageName = ref('')
const personImageSource = ref<UploadSource>('gallery')
const personImageFile = ref<File | null>(null)
const referenceImage = ref('')
const referenceImageUrl = ref('')
const referenceImageName = ref('')
const referenceImageSource = ref<UploadSource>('gallery')
const referenceImageFile = ref<File | null>(null)
const operation = ref<Operation>('hair_style_color')
const galleryTarget = ref<GalleryTarget>('person')
const showGalleryModal = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const personUploading = ref(false)
const referenceUploading = ref(false)
const submitting = ref(false)
const taskLoading = ref(false)
const taskLoadingMore = ref(false)
const taskHasMore = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const fileInputRef = ref<HTMLInputElement | null>(null)
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const uploadBlobUrls: string[] = []
const TASK_PAGE_SIZE = 10
const taskPageNo = ref(1)

const defaultOperationOptions = [
    { value: 'hair_style' as const, label: '仅换发型' },
    { value: 'hair_color' as const, label: '仅换发色' },
    { value: 'hair_style_color' as const, label: '发型+发色' }
]
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' },
    { label: '排队中', value: 'pending' },
    { label: '生成中', value: 'running' },
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const configJson = computed(() => config.value?.config_json && typeof config.value.config_json === 'object' ? config.value.config_json : {})
const configuredEstimatePoints = computed(() => {
    const prices = configJson.value.operation_prices && typeof configJson.value.operation_prices === 'object'
        ? configJson.value.operation_prices
        : {}
    const unitPrice = Number(prices[operation.value] ?? 0)
    const quantity = Math.max(1, Number(configJson.value.quantity || 1))
    return Number.isFinite(unitPrice) ? Number((Math.max(0, unitPrice) * quantity).toFixed(2)) : 0
})
const operationOptions = computed(() => {
    const options = Array.isArray(config.value?.operation_options) ? config.value.operation_options : []
    if (!options.length) return defaultOperationOptions
    return options
        .map((item: any) => ({ value: String(item.value || 'hair_style_color') as Operation, label: String(item.label || '') }))
        .filter((item: any) => defaultOperationOptions.some((option) => option.value === item.value))
})
const estimatePoints = computed(() => {
    const remotePoints = Number(estimateInfo.value?.user_charge_points ?? estimateInfo.value?.display_points)
    return Number.isFinite(remotePoints) ? remotePoints : configuredEstimatePoints.value
})
const canSubmit = computed(() => !!personImage.value && !!referenceImage.value && !submitting.value && !personUploading.value && !referenceUploading.value)
const personExamples = computed(() => normalizeExamples(configJson.value.person_examples))
const referenceExamples = computed(() => normalizeExamples(configJson.value.hairstyle_examples))

const panelTasks = computed(() => tasks.value.map((item: any) => {
    const id = taskId(item) || `hairstyle-${item.create_time || Date.now()}`
    const status = normalizeTaskStatus(item.status)
    const urls = status === 'success' || status === 'partial_failed' ? resultUrls(item) : []
    const operationLabel = operationName(item.operation || item.params?.operation || '')
    const items = urls.length
        ? urls.map((url, index) => ({
            id: `${id}-result-${index}`,
            url,
            downloadUrl: resolvePcDownloadUrl(url),
            downloadName: taskDownloadName(item, url, index),
            status,
            statusText: statusText(status),
            error: item.error || '',
            raw: { url, index },
            deleteDisabled: isTaskRunning(item),
            downloadDisabled: !url
        }))
        : [{
            id: `${id}-placeholder`,
            status,
            statusText: statusText(status),
            error: item.error || stateDescription(status),
            raw: null,
            deleteDisabled: true,
            downloadDisabled: true
        }]
    return {
        id,
        mode: 'single' as const,
        badge: toolDisplayName.value,
        title: toolDisplayName.value,
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: operationLabel,
        prompt: '',
        error: item.error || '',
        references: hairstyleReferences(item),
        items,
        raw: item,
        regenerateDisabled: submitting.value,
        downloadAllDisabled: !items.some((result: any) => result.downloadUrl || result.url) || downloadingTaskIds.value.includes(id),
        deleteAllDisabled: !taskId(item) || isTaskRunning(item)
    }
}))

const goBackToSource = () => {
    if (window.history.length > 1) return router.back()
    router.push('/ai/tools')
}
const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) return fallback
    return resolved
}
const normalizeExamples = (items: any[]): ExampleItem[] => (Array.isArray(items) ? items : [])
    .map((item: any, index: number) => ({
        id: String(item?.id || item?.image || item?.url || index),
        name: String(item?.name || `示例图-${index + 1}.png`),
        image: String(item?.image || item?.url || item?.uri || '')
    }))
    .filter((item) => item.image)
const operationName = (value: Operation | string) => operationOptions.value.find((item) => item.value === value)?.label || defaultOperationOptions.find((item) => item.value === value)?.label || '发型+发色'
const operationDescription = (value: Operation | string) => {
    if (value === 'hair_style') return '参考目标轮廓、长度和卷度，尽量保留原发色'
    if (value === 'hair_color') return '参考目标发色与染发质感，尽量保留原发型'
    return '同时参考目标发型结构与发色表现'
}
const loadConfig = async () => {
    config.value = await getAigcHairstyleConfig()
    const nextOperation = String(config.value?.default_operation || 'hair_style_color') as Operation
    if (defaultOperationOptions.some((item) => item.value === nextOperation)) operation.value = nextOperation
    await updateEstimate()
}
const refreshTasks = async (options: { page?: number; append?: boolean; sync?: boolean } = {}) => {
    const page = Math.max(1, options.page || 1)
    const append = !!options.append
    if (append) taskLoadingMore.value = true
    else taskLoading.value = true
    try {
        const res: any = await getAigcHairstyleTasks({
            page_no: page,
            page_size: TASK_PAGE_SIZE,
            status: activeTaskStatusFilter.value,
            light: 1,
            sync_running: options.sync ? 1 : 0
        })
        const lists = Array.isArray(res?.lists) ? res.lists : Array.isArray(res) ? res : []
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
const loadMoreTasks = () => { if (!taskLoading.value && !taskLoadingMore.value && taskHasMore.value) void refreshTasks({ page: taskPageNo.value + 1, append: true }) }
const loadTasksDeferred = async () => {
    await nextTick()
    const run = () => refreshTasks({ sync: false })
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(run, { timeout: 1200 })
        return
    }
    window.setTimeout(run, 0)
}
const selectTaskStatus = async (status: TaskStatusFilter) => {
    activeTaskStatusFilter.value = status
    await refreshTasks({ sync: true })
}
const selectOperation = (value: Operation) => {
    operation.value = value
    void updateEstimate()
}
const triggerUpload = (target: GalleryTarget) => {
    galleryTarget.value = target
    fileInputRef.value?.click()
}
const openGallery = (target: GalleryTarget) => {
    galleryTarget.value = target
    showGalleryModal.value = true
}
const handleUpload = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    uploadBlobUrls.push(objectUrl)
    applyUpload(galleryTarget.value, objectUrl, objectUrl, file.name, 'local', file)
    ;(event.target as HTMLInputElement).value = ''
}
const applyUpload = (target: GalleryTarget, uri: string, url: string, name: string, source: UploadSource, file: File | null = null) => {
    if (target === 'person') {
        personImage.value = uri
        personImageUrl.value = url || uri
        personImageName.value = name
        personImageSource.value = source
        personImageFile.value = file
    } else {
        referenceImage.value = uri
        referenceImageUrl.value = url || uri
        referenceImageName.value = name
        referenceImageSource.value = source
        referenceImageFile.value = file
    }
    estimateInfo.value = {}
}
const clearUpload = (target: GalleryTarget) => applyUpload(target, '', '', '', 'gallery')
const selectGallery = (item: any) => {
    const uri = item.uri || item.url || item.cover
    applyUpload(galleryTarget.value, uri, resolveUploadPreviewUrl(item.url || item.cover || item.uri, uri), item.name || '', 'gallery')
    showGalleryModal.value = false
}
const selectExample = (target: GalleryTarget, item: ExampleItem) => applyUpload(target, item.image, item.image, item.name, 'example')
const uploadTargetIfNeeded = async (target: GalleryTarget) => {
    const source = target === 'person' ? personImageSource.value : referenceImageSource.value
    const file = target === 'person' ? personImageFile.value : referenceImageFile.value
    const current = target === 'person' ? personImage.value : referenceImage.value
    if (source !== 'local' || !file) return current
    if (target === 'person') personUploading.value = true
    else referenceUploading.value = true
    try {
        const res: any = await uploadImage({ file })
        const uri = res?.uri || res?.url || current
        applyUpload(target, uri, target === 'person' ? personImageUrl.value : referenceImageUrl.value, file.name, 'gallery')
        return uri
    } finally {
        if (target === 'person') personUploading.value = false
        else referenceUploading.value = false
    }
}
const buildPayload = (images: { person?: string; reference?: string } = {}) => ({
    person_image: images.person || personImage.value,
    reference_image: images.reference || referenceImage.value,
    operation: operation.value,
    prompt: '',
    channel: String(configJson.value.channel || ''),
    quality: String(configJson.value.quality || ''),
    ratio: String(configJson.value.ratio || ''),
    quantity: Number(configJson.value.quantity || 1),
    negative_prompt: String(config.value?.negative_prompt || '')
})
const updateEstimate = async () => {
    if (!personImage.value || !referenceImage.value || personImageSource.value === 'local' || referenceImageSource.value === 'local') {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcHairstyle(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}
const submit = async () => {
    if (!canSubmit.value || !ensurePcLogin({ redirect: route.fullPath })) return
    submitting.value = true
    try {
        const person = await uploadTargetIfNeeded('person')
        const reference = await uploadTargetIfNeeded('reference')
        const res: any = await generateAigcHairstyle(buildPayload({ person, reference }), { suppressErrorMessage: true })
        if (res?.status === 'failed') {
            feedback.msgError(res?.error || '生成任务提交失败')
            return
        }
        feedback.msgSuccess('任务已提交，正在生成')
        await refreshTasks({ sync: true })
        startPolling()
        void updateEstimate()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || 'AI换发型生成失败')
    } finally {
        submitting.value = false
    }
}
const editTask = (item: any) => {
    const refs = taskReferenceUris(item)
    const displayRefs = taskReferenceUrls(item)
    applyUpload('person', refs[0] || displayRefs[0] || '', displayRefs[0] || refs[0] || '', '人物原图.png', 'gallery')
    applyUpload('reference', refs[1] || displayRefs[1] || '', displayRefs[1] || refs[1] || '', '发型参考图.png', 'gallery')
    const nextOperation = String(item.operation || item.params?.operation || operation.value) as Operation
    if (defaultOperationOptions.some((option) => option.value === nextOperation)) operation.value = nextOperation
}
const rerunTask = async (item: any) => {
    editTask(item)
    await submit()
}
const parseReferenceImages = (value: any): string[] => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String)
    if (typeof value !== 'string' || !value.trim()) return []
    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []
    } catch {
        return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
}
const taskReferenceUris = (item: any) => parseReferenceImages(item.reference_images)
const taskReferenceUrls = (item: any) => Array.isArray(item.reference_image_urls) && item.reference_image_urls.length
    ? item.reference_image_urls.filter(Boolean).map(String)
    : taskReferenceUris(item)
const hairstyleReferences = (item: any) => {
    const refs = taskReferenceUrls(item)
    return [
        refs[0] ? { label: '人物原图', url: refs[0] } : null,
        refs[1] ? { label: '发型参考图', url: refs[1] } : null
    ].filter(Boolean) as { label: string; url: string }[]
}
const resultUrls = (payload: any): string[] => {
    const urls: string[] = []
    const push = (value: unknown) => {
        const url = typeof value === 'string' ? value : ''
        if (url && !urls.includes(url)) urls.push(url)
    }
    const walk = (item: any) => {
        if (!item || typeof item !== 'object') return
        push(item?.image_url || item?.url || item?.image_uri || item?.uri)
        if (Array.isArray(item?.results)) item.results.forEach(walk)
    }
    if (Array.isArray(payload?.results)) payload.results.forEach(walk)
    push(payload?.image_url || payload?.url || payload?.image_uri || payload?.uri)
    return urls
}
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const normalizeTaskStatus = (status: any) => {
    const value = String(status || '').toLowerCase()
    if (['pending', 'running', 'success', 'failed', 'partial_failed', 'canceled'].includes(value)) return value
    return 'running'
}
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', partial_failed: '部分失败', canceled: '已取消' }[status] || '生成中')
const stateDescription = (status: string) => status === 'failed' ? '任务处理失败，请稍后重试' : 'AI 正在生成发型效果，请稍候'
const formatTaskTime = (value: any) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const date = new Date(Number(value) * 1000)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const taskDownloadName = (item: any, url: string, index = 0) => {
    const ext = getPcDownloadExtension(resolvePcDownloadUrl(url), 'png')
    return `hairstyle-${taskId(item) || Date.now()}-${index + 1}.${ext}`
}
const deleteTask = async (item: any) => {
    const id = taskId(item)
    if (!id) return
    await deleteAigcHairstyleTask({ id })
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
const handlePanelPreviewReference = (reference: any) => { if (reference?.url) { previewImage.value = reference.url; previewTitle.value = reference.label || '参考图' } }
const handlePanelPreview = (item: any, task: any) => { if (item?.url) { previewImage.value = item.url; previewTitle.value = item.title || task?.title || '生成作品' } }
const handlePanelDownloadOne = (item: any) => triggerDownload(item?.downloadUrl || '', item?.downloadName || '生成作品.png')
const handlePanelDownloadAll = (task: any) => {
    const raw = rawPanelTask(task)
    void downloadTaskResults(taskId(raw), task.items || [], `hairstyle-${taskId(raw)}.zip`)
}
const handlePanelDeleteOne = (_item: any, task: any) => deleteTask(rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const startPolling = () => {
    if (pollTimer) return
    pollTimer = window.setInterval(async () => {
        await refreshTasks({ sync: true })
        if (!tasks.value.some((item) => isTaskRunning(item))) stopPolling()
    }, 5000)
}
const stopPolling = () => {
    if (!pollTimer) return
    window.clearInterval(pollTimer)
    pollTimer = null
}

watch([personImage, referenceImage, operation], updateEstimate)
onMounted(async () => {
    await loadConfig()
    void loadTasksDeferred()
})
onUnmounted(() => {
    stopPolling()
    uploadBlobUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;

.hairstyle-page {
    height: 100%;
    min-width: calc(403px + 24px + 560px);
}

.option-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.option-card {
    min-height: 88px;
    padding: 14px;
    border: 1px solid #222;
    border-radius: 10px;
    background: #171717;
    color: #fff;
    text-align: left;
}

.option-card strong,
.option-card span {
    display: block;
}

.option-card span {
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    line-height: 1.5;
}

.option-card.is-active {
    border-color: #fff;
    background: #fff;
    color: #111;
}

.option-card.is-active span {
    color: rgba(0, 0, 0, 0.68);
}

.example-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.example-strip button {
    aspect-ratio: 1 / 1;
    padding: 0;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 10px;
    background: #171717;
}

.example-strip button.is-active {
    border-color: #fff;
}

.example-strip img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

@media (max-width: 1200px) {
    .hairstyle-page {
        min-width: 0;
    }
}
</style>
