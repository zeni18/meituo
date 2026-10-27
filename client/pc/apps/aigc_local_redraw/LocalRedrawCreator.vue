<template>
    <div class="local-redraw-page">
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
                            <label class="field-label">上传原图</label>
                            <button v-if="sourceImage" type="button" class="ghost-button" @click="clearUpload">清空</button>
                        </div>
                        <div class="upload-card" :class="{ 'is-filled': !!sourceImage, 'is-uploading': sourceUploading }">
                            <template v-if="sourceImage">
                                <div class="upload-card__stage">
                                    <img :src="sourceImageUrl || sourceImage" alt="原图" />
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
                        <div class="field-head">
                            <label class="field-label">绘制蒙版</label>
                            <button v-if="maskImage" type="button" class="ghost-button" @click="clearMaskDrawing">清空</button>
                        </div>
                        <div class="mask-card" :class="{ 'is-disabled': !sourceImage }">
                            <div v-if="sourceImage" class="mask-card__stage">
                                <img :src="sourceImageUrl || sourceImage" alt="蒙版原图" />
                                <img v-if="maskImage" class="mask-card__overlay" :src="maskImage" alt="蒙版" />
                            </div>
                            <div v-else class="mask-card__empty">请先上传原图</div>
                            <div class="mask-card__actions">
                                <button type="button" :disabled="!sourceImage" @click="openMaskEditor">{{ maskImage ? '编辑蒙版' : '绘制蒙版' }}</button>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">局部重绘描述词</label>
                        <textarea v-model="prompt" class="prompt-input" rows="6" maxlength="500" placeholder="描述需要在蒙版区域生成或替换的内容，例如：将这里改成一束白色花朵，保持原图光影和质感"></textarea>
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
            description="选择资产图片作为局部重绘原图"
            @close="showGalleryModal = false"
            @select="selectGallery"
        />

        <div v-if="showMaskEditor" class="mask-editor-mask" @click.self="closeMaskEditor">
            <section class="mask-editor" aria-modal="true" role="dialog">
                <div class="mask-editor__toolbar">
                    <div class="mask-editor__tools">
                        <button :class="{ 'is-active': activeMaskTool === 'brush' }" type="button" @click="setMaskTool('brush')">画笔</button>
                        <button :class="{ 'is-active': activeMaskTool === 'erase' }" type="button" @click="setMaskTool('erase')">橡皮</button>
                        <button :class="{ 'is-active': activeMaskTool === 'pan' }" type="button" @click="setMaskTool('pan')">拖拽</button>
                        <button type="button" :disabled="!canUndoMask" @click="undoMask">撤销</button>
                        <button type="button" :disabled="!canRedoMask" @click="redoMask">重做</button>
                    </div>
                    <div v-if="activeMaskTool === 'brush' || activeMaskTool === 'erase'" class="mask-editor__size">
                        <span>{{ activeMaskTool === 'brush' ? '画笔大小' : '橡皮大小' }}</span>
                        <input v-model="activeMaskSizeModel" type="range" min="12" max="72" step="1" />
                    </div>
                    <div class="mask-editor__zoom">
                        <button type="button" @click="zoomOutMask">-</button>
                        <span>{{ maskZoomPercent }}</span>
                        <button type="button" @click="zoomInMask">+</button>
                    </div>
                </div>
                <div class="mask-editor__body">
                    <aside class="mask-editor__selections">
                        <button class="mask-editor__add-selection" type="button" @click="addMaskSelection">新增选区</button>
                        <div class="mask-editor__selection-list">
                            <button
                                v-for="item in maskSelections"
                                :key="item.id"
                                :class="['mask-editor__selection', { 'is-active': activeMaskSelectionId === item.id }]"
                                type="button"
                                @click="activeMaskSelectionId = item.id"
                            >
                                <span :style="{ background: item.color }"></span>
                            </button>
                        </div>
                    </aside>
                    <div class="mask-editor__stage">
                        <div class="mask-editor__viewport" :style="maskViewportStyle">
                            <img ref="maskImageRef" class="mask-editor__image" :src="sourceImageUrl || sourceImage" alt="蒙版编辑原图" @load="syncMaskCanvasSize" />
                            <canvas
                                ref="maskCanvasRef"
                                :class="['mask-editor__canvas', `is-${activeMaskTool}`]"
                                @pointerdown="startMaskDrawing"
                                @pointermove="drawMaskStroke"
                                @pointerup="stopMaskDrawing"
                                @pointerleave="stopMaskDrawing"
                                @pointercancel="stopMaskDrawing"
                            ></canvas>
                        </div>
                    </div>
                </div>
                <div class="mask-editor__footer">
                    <button class="mask-editor__ghost" type="button" @click="closeMaskEditor">取消</button>
                    <button class="mask-editor__confirm" type="button" @click="confirmMaskEditor">确定</button>
                </div>
            </section>
        </div>

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
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import {
    deleteAigcLocalRedrawTask,
    estimateAigcLocalRedraw,
    generateAigcLocalRedraw,
    getAigcLocalRedrawConfig,
    getAigcLocalRedrawTasks
} from './api'

type UploadSource = 'gallery' | 'local'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'
type MaskEditorTool = 'brush' | 'erase' | 'pan'
type MaskSelection = { id: string; color: string }

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '局部重绘'))
const tasks = ref<any[]>([])
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_local_redraw')
const estimateInfo = ref<any>({})
const sourceImage = ref('')
const sourceImageUrl = ref('')
const sourceImageName = ref('')
const sourceImageSource = ref<UploadSource>('gallery')
const sourceImageFile = ref<File | null>(null)
const sourceUploading = ref(false)
const maskImage = ref('')
const prompt = ref('')
const taskLoading = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const sourceInputRef = ref<HTMLInputElement | null>(null)
const showMaskEditor = ref(false)
const maskCanvasRef = ref<HTMLCanvasElement | null>(null)
const maskImageRef = ref<HTMLImageElement | null>(null)
const activeMaskTool = ref<MaskEditorTool>('brush')
const maskEditorScale = ref(1)
const maskEditorOffset = ref({ x: 0, y: 0 })
const maskBrushSize = ref(28)
const maskEraserSize = ref(36)
const isMaskPointerDown = ref(false)
const lastMaskPoint = ref<{ x: number; y: number } | null>(null)
const maskPanStart = ref<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
const maskHistory = ref<string[]>([''])
const maskHistoryIndex = ref(0)
const maskEditorInitialSnapshot = ref('')
const activeMaskSelectionId = ref('mask-selection-1')
const maskSelections = ref<MaskSelection[]>([{ id: 'mask-selection-1', color: '#19D7B2' }])
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const uploadBlobUrls: string[] = []
const maskColorPool = ['#19D7B2', '#FF7A59', '#5C8BFF', '#F5C451', '#C86BFF', '#FF5FA2', '#45C7FF', '#7DE05A']

const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' },
    { label: '排队中', value: 'pending' },
    { label: '生成中', value: 'running' },
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? config.value?.unit_price ?? 0).toFixed(2))
const canSubmit = computed(() => !!sourceImage.value && !!maskImage.value && !!prompt.value.trim() && !submitting.value && !sourceUploading.value)
const activeMaskSelection = computed(() => maskSelections.value.find((item) => item.id === activeMaskSelectionId.value) || maskSelections.value[0])
const activeMaskColor = computed(() => activeMaskSelection.value?.color || '#19D7B2')
const activeMaskSize = computed(() => activeMaskTool.value === 'erase' ? maskEraserSize.value : maskBrushSize.value)
const activeMaskSizeModel = computed({
    get: () => activeMaskSize.value,
    set: (value: number | string) => {
        const size = Number(value)
        if (activeMaskTool.value === 'erase') maskEraserSize.value = size
        else maskBrushSize.value = size
    }
})
const canUndoMask = computed(() => maskHistoryIndex.value > 0)
const canRedoMask = computed(() => maskHistoryIndex.value < maskHistory.value.length - 1)
const maskZoomPercent = computed(() => `${Math.round(maskEditorScale.value * 100)}%`)
const maskViewportStyle = computed(() => ({
    transform: `translate(calc(-50% + ${maskEditorOffset.value.x}px), calc(-50% + ${maskEditorOffset.value.y}px)) scale(${maskEditorScale.value})`
}))

const panelTasks = computed(() => tasks.value.map((item: any) => {
    const image = taskImage(item)
    const status = normalizeTaskStatus(item.status)
    const downloadUrl = taskDownloadHref(item)
    const id = taskId(item) || item.id || item.task_id || `local-redraw-${item.create_time || Date.now()}`
    const references = [
        taskReferenceImage(item) ? { label: '原图', url: taskReferenceImage(item) } : null,
        taskMaskImage(item) ? { label: '蒙版', url: taskMaskImage(item) } : null
    ].filter(Boolean)
    return {
        id,
        mode: 'single' as const,
        badge: toolDisplayName.value,
        title: toolDisplayName.value,
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: taskSizeLabel(item),
        prompt: item.user_prompt || item.prompt || '局部重绘任务',
        references,
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

const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) return fallback
    return resolved
}

const goBackToSource = () => {
    if (window.history.length > 1) router.back()
    else router.push('/ai/tools')
}

const loadConfig = async () => {
    config.value = await getAigcLocalRedrawConfig()
}

const triggerUpload = () => sourceInputRef.value?.click()
const openGallery = () => { showGalleryModal.value = true }

const handleUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    uploadBlobUrls.push(objectUrl)
    applyUpload(objectUrl, objectUrl, file.name, 'local', file)
    ;(event.target as HTMLInputElement).value = ''
}

const applyUpload = (uri: string, url: string, name: string, source: UploadSource, file: File | null = null, options: { resetMask?: boolean } = {}) => {
    sourceImage.value = uri
    sourceImageUrl.value = url || uri
    sourceImageName.value = name
    sourceImageSource.value = source
    sourceImageFile.value = file
    if (options.resetMask !== false) {
        clearMaskDrawing()
    }
}

const clearUpload = () => {
    applyUpload('', '', '', 'gallery')
    estimateInfo.value = {}
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
        applyUpload(uri, previewUrl || resolveUploadPreviewUrl(res?.url || uri, uri), sourceImageFile.value.name, 'gallery', null, { resetMask: false })
        return uri
    } finally {
        sourceUploading.value = false
    }
}

const buildPayload = (overrides: Partial<Record<'source_image' | 'mask_image', string>> = {}) => ({
    source_image: overrides.source_image ?? sourceImage.value,
    mask_image: overrides.mask_image ?? maskImage.value,
    prompt: prompt.value.trim()
})

const updateEstimate = async () => {
    if (!sourceImage.value || !maskImage.value || !prompt.value.trim() || sourceImageSource.value === 'local') {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcLocalRedraw(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}

const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        const sourceUri = await uploadLocalImageIfNeeded()
        await generateAigcLocalRedraw(buildPayload({ source_image: sourceUri, mask_image: maskImage.value }))
        await refreshTasks()
        startPolling()
    } finally {
        submitting.value = false
    }
}

const refreshTasks = async () => {
    taskLoading.value = true
    try {
        const res: any = await getAigcLocalRedrawTasks({ page_no: 1, page_size: 20, status: activeTaskStatusFilter.value })
        tasks.value = Array.isArray(res?.lists) ? res.lists : []
    } finally {
        taskLoading.value = false
    }
}

const selectTaskStatus = async (status: TaskStatusFilter) => {
    activeTaskStatusFilter.value = status
    await refreshTasks()
}

const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', canceled: '已取消' }[status] || '生成中')
const normalizeTaskStatus = (status: any) => {
    const value = String(status || '').toLowerCase()
    if (['pending', 'running', 'success', 'failed', 'canceled'].includes(value)) return value
    return 'running'
}
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const taskStateDescription = (item: any) => normalizeTaskStatus(item?.status) === 'failed' ? '局部重绘生成失败，请重试或调整蒙版' : 'AI 正在生成局部重绘结果，请稍候'
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskReferenceImage = (item: any) => item.source_image_url || item.source_image || ''
const taskMaskImage = (item: any) => item.mask_image_url || item.mask_image || ''
const taskSizeLabel = (item: any) => item.size_label || (Number(item.width || 0) > 0 && Number(item.height || 0) > 0 ? `${item.width}×${item.height}` : '')
const taskImage = (item: any) => {
    const firstResult = Array.isArray(item.results) ? item.results.find((entry: any) => entry?.image_url || entry?.url || entry?.image) : null
    return item.image_url || firstResult?.image_url || firstResult?.url || firstResult?.image || ''
}
const taskDownloadUrl = (item: any) => {
    const firstResult = Array.isArray(item.results) ? item.results.find((entry: any) => entry?.download_url || entry?.image_url || entry?.url || entry?.image) : null
    return item.download_url || firstResult?.download_url || taskImage(item)
}
const taskDownloadHref = (item: any) => resolvePcDownloadUrl(taskDownloadUrl(item))
const taskDownloadName = (item: any) => `local-redraw-${item.task_id || item.id || Date.now()}.${getPcDownloadExtension(taskDownloadHref(item), 'png')}`
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
    sourceImageName.value = '原图'
    sourceImageSource.value = 'gallery'
    sourceImageFile.value = null
    maskImage.value = item.mask_image || item.mask_image_url || ''
    prompt.value = item.user_prompt || ''
}
const rerunTask = async (item: any) => {
    editTask(item)
    await nextTick()
    await submit()
}
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const deleteTask = async (item: any) => {
    const id = taskId(item)
    if (!id) return
    await deleteAigcLocalRedrawTask({ id })
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
const handlePanelPreviewReference = (reference: any) => { if (reference?.url) { previewImage.value = reference.url; previewTitle.value = reference.label || '参考图' } }
const handlePanelPreview = (item: any, task: any) => { if (item?.url) { previewImage.value = item.url; previewTitle.value = item.title || task?.title || '生成作品' } }
const handlePanelDownloadOne = (item: any) => triggerDownload(item?.downloadUrl || '', item?.downloadName || '生成作品.png')
const handlePanelDownloadAll = (task: any) => {
    const rawTask = rawPanelTask(task)
    const id = taskId(rawTask)
    void downloadTaskResults(id, task.items || [], `local-redraw-${id}.zip`)
}
const handlePanelDeleteOne = (_item: any, task: any) => deleteTask(rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))

const ensureMaskSelection = () => {
    if (maskSelections.value.length) {
        if (!maskSelections.value.some((item) => item.id === activeMaskSelectionId.value)) activeMaskSelectionId.value = maskSelections.value[0].id
        return
    }
    maskSelections.value = [{ id: 'mask-selection-1', color: '#19D7B2' }]
    activeMaskSelectionId.value = 'mask-selection-1'
}
const getRandomMaskColor = () => {
    const used = new Set(maskSelections.value.map((item) => item.color.toLowerCase()))
    const candidate = maskColorPool.find((color) => !used.has(color.toLowerCase()))
    if (candidate) return candidate
    return `hsl(${(maskSelections.value.length * 47) % 360} 82% 62%)`
}
const addMaskSelection = () => {
    const id = `mask-selection-${Date.now()}`
    maskSelections.value = [...maskSelections.value, { id, color: getRandomMaskColor() }]
    activeMaskSelectionId.value = id
}
const getMaskCanvasContext = () => maskCanvasRef.value?.getContext('2d') || null
const restoreMaskCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number, snapshot = maskImage.value) => {
    ctx.clearRect(0, 0, width, height)
    if (!snapshot) return
    const image = new Image()
    image.onload = () => {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0, width, height)
    }
    image.src = snapshot
}
const resetMaskHistory = (snapshot = '') => { maskHistory.value = [snapshot]; maskHistoryIndex.value = 0 }
const pushMaskHistory = (snapshot: string) => {
    if (maskHistory.value[maskHistoryIndex.value] === snapshot) return
    maskHistory.value = [...maskHistory.value.slice(0, maskHistoryIndex.value + 1), snapshot]
    maskHistoryIndex.value = maskHistory.value.length - 1
}
const applyMaskSnapshot = (snapshot = '') => {
    maskImage.value = snapshot
    const canvas = maskCanvasRef.value
    const ctx = getMaskCanvasContext()
    if (!canvas || !ctx) return
    restoreMaskCanvas(ctx, canvas.clientWidth, canvas.clientHeight, snapshot)
}
const syncMaskCanvasSize = async () => {
    await nextTick()
    const canvas = maskCanvasRef.value
    const image = maskImageRef.value
    if (!canvas || !image) return
    const width = image.clientWidth
    const height = image.clientHeight
    if (!width || !height) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = getMaskCanvasContext()
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    restoreMaskCanvas(ctx, width, height)
}
const getMaskPoint = (event: PointerEvent) => {
    const canvas = maskCanvasRef.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}
const saveMaskDrawing = () => {
    const canvas = maskCanvasRef.value
    if (!canvas) return
    maskImage.value = canvas.toDataURL('image/png')
}
const openMaskEditor = async () => {
    if (!sourceImage.value) return
    ensureMaskSelection()
    showMaskEditor.value = true
    activeMaskTool.value = 'brush'
    maskEditorInitialSnapshot.value = maskImage.value || ''
    maskEditorScale.value = 1
    maskEditorOffset.value = { x: 0, y: 0 }
    maskPanStart.value = null
    resetMaskHistory(maskImage.value || '')
    await nextTick()
    await syncMaskCanvasSize()
}
const closeMaskEditor = () => {
    applyMaskSnapshot(maskEditorInitialSnapshot.value || '')
    showMaskEditor.value = false
    isMaskPointerDown.value = false
    maskPanStart.value = null
    lastMaskPoint.value = null
}
const confirmMaskEditor = () => {
    saveMaskDrawing()
    pushMaskHistory(maskImage.value)
    maskEditorInitialSnapshot.value = maskImage.value
    showMaskEditor.value = false
}
const setMaskTool = (tool: MaskEditorTool) => { activeMaskTool.value = tool }
const zoomInMask = () => { maskEditorScale.value = Math.min(3, Number((maskEditorScale.value + 0.1).toFixed(2))) }
const zoomOutMask = () => { maskEditorScale.value = Math.max(0.4, Number((maskEditorScale.value - 0.1).toFixed(2))) }
const undoMask = () => { if (canUndoMask.value) { maskHistoryIndex.value -= 1; applyMaskSnapshot(maskHistory.value[maskHistoryIndex.value] || '') } }
const redoMask = () => { if (canRedoMask.value) { maskHistoryIndex.value += 1; applyMaskSnapshot(maskHistory.value[maskHistoryIndex.value] || '') } }
const startMaskDrawing = (event: PointerEvent) => {
    if (!showMaskEditor.value || !sourceImage.value) return
    if (activeMaskTool.value === 'pan') {
        maskPanStart.value = { x: event.clientX, y: event.clientY, offsetX: maskEditorOffset.value.x, offsetY: maskEditorOffset.value.y }
        return
    }
    const canvas = maskCanvasRef.value
    const ctx = getMaskCanvasContext()
    const point = getMaskPoint(event)
    if (!canvas || !ctx || !point) return
    ctx.globalCompositeOperation = activeMaskTool.value === 'erase' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = activeMaskTool.value === 'erase' ? 'rgba(0,0,0,1)' : activeMaskColor.value
    ctx.lineWidth = activeMaskSize.value
    isMaskPointerDown.value = true
    lastMaskPoint.value = point
    canvas.setPointerCapture?.(event.pointerId)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    saveMaskDrawing()
}
const drawMaskStroke = (event: PointerEvent) => {
    if (!showMaskEditor.value) return
    if (activeMaskTool.value === 'pan' && maskPanStart.value) {
        maskEditorOffset.value = {
            x: maskPanStart.value.offsetX + (event.clientX - maskPanStart.value.x),
            y: maskPanStart.value.offsetY + (event.clientY - maskPanStart.value.y)
        }
        return
    }
    if (!isMaskPointerDown.value) return
    const ctx = getMaskCanvasContext()
    const point = getMaskPoint(event)
    if (!ctx || !point || !lastMaskPoint.value) return
    ctx.globalCompositeOperation = activeMaskTool.value === 'erase' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = activeMaskTool.value === 'erase' ? 'rgba(0,0,0,1)' : activeMaskColor.value
    ctx.lineWidth = activeMaskSize.value
    ctx.beginPath()
    ctx.moveTo(lastMaskPoint.value.x, lastMaskPoint.value.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastMaskPoint.value = point
    saveMaskDrawing()
}
const stopMaskDrawing = (event?: PointerEvent) => {
    if (activeMaskTool.value === 'pan') { maskPanStart.value = null; return }
    if (!isMaskPointerDown.value) return
    isMaskPointerDown.value = false
    lastMaskPoint.value = null
    if (event) {
        maskCanvasRef.value?.releasePointerCapture?.(event.pointerId)
    }
    saveMaskDrawing()
    pushMaskHistory(maskImage.value)
}
const clearMaskDrawing = () => {
    maskImage.value = ''
    isMaskPointerDown.value = false
    lastMaskPoint.value = null
    maskPanStart.value = null
    resetMaskHistory('')
    const canvas = maskCanvasRef.value
    const ctx = getMaskCanvasContext()
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
}

const startPolling = () => {
    if (pollTimer) return
    pollTimer = window.setInterval(async () => {
        await refreshTasks()
        if (!tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) stopPolling()
    }, 5000)
}
const stopPolling = () => { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null } }

watch([sourceImage, maskImage, prompt], updateEstimate)

onMounted(async () => {
    await loadConfig()
    await refreshTasks()
    if (tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) startPolling()
})

onUnmounted(() => {
    stopPolling()
    uploadBlobUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;

.local-redraw-page {
    height: 100%;
    min-width: calc(403px + 24px + 560px);
}

.prompt-input {
    width: 100%;
    min-height: 132px;
    padding: 14px;
    border: 1px solid #222;
    border-radius: 10px;
    outline: none;
    resize: vertical;
    background: #171717;
    color: #fff;
    font-size: 14px;
    line-height: 1.6;
    box-sizing: border-box;
}

.prompt-input::placeholder {
    color: rgba(255, 255, 255, 0.36);
}

.prompt-input:focus {
    border-color: rgba(255, 255, 255, 0.28);
}

.mask-card {
    position: relative;
    height: 176px;
    border-radius: 10px;
    background: #262626;
    overflow: hidden;
}

.mask-card__stage {
    position: relative;
    width: 100%;
    height: 100%;
    background: #050505;
}

.mask-card__stage img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.mask-card__overlay {
    position: absolute;
    inset: 0;
    opacity: 0.72;
    pointer-events: none;
}

.mask-card__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.42);
    font-size: 14px;
}

.mask-card__actions {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5, 5, 5, 0.42);
    opacity: 0;
    pointer-events: none;
    backdrop-filter: blur(2px);
    transition: opacity 0.2s ease;
}

.mask-card:hover .mask-card__actions,
.mask-card:not(.is-disabled) .mask-card__actions {
    opacity: 1;
    pointer-events: auto;
}

.mask-card__actions button {
    min-height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
}

.mask-card__actions button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.mask-editor-mask {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.62);
    backdrop-filter: blur(10px);
}

.mask-editor {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: min(1080px, calc(100vw - 48px));
    height: min(820px, calc(100vh - 48px));
    padding: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    background: rgba(17, 17, 17, 0.98);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.38);
    box-sizing: border-box;
}

.mask-editor__toolbar,
.mask-editor__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.mask-editor__tools,
.mask-editor__size,
.mask-editor__zoom {
    display: inline-flex;
    align-items: center;
    gap: 10px;
}

.mask-editor__tools button,
.mask-editor__size,
.mask-editor__zoom button,
.mask-editor__ghost,
.mask-editor__confirm {
    min-height: 38px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    font-size: 14px;
    cursor: pointer;
}

.mask-editor__tools button,
.mask-editor__size,
.mask-editor__zoom {
    background: #1a1a1a;
}

.mask-editor__tools button {
    color: rgba(255, 255, 255, 0.74);
}

.mask-editor__tools button.is-active {
    background: #fff;
    color: #111;
}

.mask-editor__tools button:disabled,
.mask-editor__zoom button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
}

.mask-editor__zoom {
    padding: 0 8px;
}

.mask-editor__zoom button {
    min-width: 34px;
    padding: 0;
    background: transparent;
    color: #fff;
}

.mask-editor__zoom span {
    min-width: 56px;
    color: #fff;
    font-size: 14px;
    text-align: center;
}

.mask-editor__size {
    flex: 1;
    justify-content: center;
    min-width: 180px;
    padding: 0 16px;
}

.mask-editor__size span {
    color: rgba(255, 255, 255, 0.74);
    font-size: 13px;
    white-space: nowrap;
}

.mask-editor__size input {
    flex: 1;
    accent-color: #fff;
}

.mask-editor__body {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 16px;
    flex: 1;
    min-height: 0;
}

.mask-editor__selections {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 12px;
    border-radius: 18px;
    background: #151515;
}

.mask-editor__add-selection {
    min-height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: 10px;
    background: #242424;
    color: #fff;
    font-size: 13px;
}

.mask-editor__selection-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
}

.mask-editor__selection {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
}

.mask-editor__selection span {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
}

.mask-editor__selection.is-active {
    border-color: rgba(255, 255, 255, 0.26);
    background: rgba(255, 255, 255, 0.06);
}

.mask-editor__stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
    border-radius: 18px;
    background: #101010;
}

.mask-editor__viewport {
    position: absolute;
    top: 50%;
    left: 50%;
    display: inline-block;
    transform-origin: center;
}

.mask-editor__image {
    display: block;
    width: auto;
    height: auto;
    max-width: min(100%, 920px);
    max-height: min(100%, 620px);
    object-fit: contain;
    user-select: none;
    pointer-events: none;
}

.mask-editor__canvas {
    position: absolute;
    inset: 0;
    touch-action: none;
}

.mask-editor__canvas.is-brush { cursor: crosshair; }
.mask-editor__canvas.is-erase { cursor: cell; }
.mask-editor__canvas.is-pan { cursor: grab; }

.mask-editor__ghost {
    background: #242424;
    color: rgba(255, 255, 255, 0.8);
}

.mask-editor__confirm {
    min-width: 180px;
    background: #fff;
    color: #111;
    font-weight: 600;
}

@media (max-width: 1200px) {
    .local-redraw-page {
        min-width: 0;
    }

    .mask-editor__toolbar,
    .mask-editor__footer {
        flex-wrap: wrap;
    }

    .mask-editor__body {
        grid-template-columns: 74px minmax(0, 1fr);
    }
}
</style>
