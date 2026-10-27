<template>
    <div class="fashion-lookbook-page">
        <section class="product-workspace">
            <div class="product-panel product-panel--form">
                <header class="product-head">
                    <button class="product-head__back" type="button" @click="goBackToSource">
                        <span class="product-head__back-icon" aria-hidden="true"></span><span>返回</span>
                    </button>
                    <div class="product-head__title"><h1>{{ toolDisplayName }}</h1></div>
                    <span class="product-head__spacer" aria-hidden="true"></span>
                </header>

                <div class="product-panel__body">
                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">上传服饰图</label>
                            <button v-if="clothesImages.length" type="button" class="ghost-button" @click="clearClothes">清空</button>
                        </div>
                        <div class="upload-card fashion-upload-card" :class="{ 'is-uploading': clothesUploading }">
                            <div class="upload-card__placeholder" @click="triggerClothesUpload">
                                <img class="upload-card__icon" :src="addIcon" alt="" />
                                <strong>本地上传</strong>
                                <small>最多 {{ maxClothesImages }} 张，支持 png、jpg、jpeg、webp</small>
                                <button class="upload-card__library" type="button" @click.stop="openGallery('clothes')">图库上传</button>
                            </div>
                            <span v-if="clothesUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                        <div v-if="clothesImages.length" class="fashion-upload-list">
                            <div class="fashion-upload-list__head"><span>已上传({{ clothesImages.length }}/{{ maxClothesImages }})</span></div>
                            <div class="fashion-upload-grid">
                                <article v-for="(item, index) in clothesImages" :key="`${item.uri}-${index}`" class="fashion-upload-item">
                                    <img :src="item.preview || item.uri" :alt="item.name || `服饰图${index + 1}`" />
                                    <button type="button" aria-label="移除图片" @click.stop="removeClothes(index)">×</button>
                                </article>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">上传模特图</label>
                            <button v-if="modelImage" type="button" class="ghost-button" @click="clearModel">清空</button>
                        </div>
                        <div class="upload-card fashion-model-card" :class="{ 'is-filled': !!modelImage, 'is-uploading': modelUploading }">
                            <template v-if="modelImage">
                                <div class="upload-card__stage"><img :src="modelImageUrl || modelImage" alt="模特图" /></div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery('model')">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerModelUpload">本地上传</button>
                                </div>
                            </template>
                            <div v-else class="upload-card__placeholder" @click="triggerModelUpload">
                                <img class="upload-card__icon" :src="addIcon" alt="" />
                                <strong>本地上传</strong>
                                <button class="upload-card__library" type="button" @click.stop="openGallery('model')">图库上传</button>
                            </div>
                            <span v-if="modelUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                        <div v-if="enabledModels.length" class="preset-models">
                            <button
                                v-for="item in enabledModels"
                                :key="item.id || item.model_image"
                                class="preset-model"
                                :class="{ 'is-active': item.model_image === modelImage }"
                                type="button"
                                @click="selectPresetModel(item)"
                            >
                                <img :src="modelCover(item)" :alt="item.name || '模特预设'" />
                                <span>{{ item.name || '模特' }}</span>
                            </button>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">出图比例</label>
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
                    </section>

                    <section class="field-block">
                        <label class="field-label">补充描述</label>
                        <textarea v-model="prompt" maxlength="300" placeholder="可补充穿搭风格、拍摄氛围、背景要求或服饰展示重点"></textarea>
                    </section>
                </div>

                <div class="submit-bar">
                    <div><span>预计消耗</span><strong>{{ formatPoint(estimatePoints) }}</strong></div>
                    <button type="button" :disabled="!canSubmit || submitting" @click="submit">{{ submitting ? '生成中' : '立即生成' }}</button>
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

        <input ref="clothesInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="handleClothesUpload" />
        <input ref="modelInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleModelUpload" />
        <AiWorkspaceAssetGalleryModal :visible="showGalleryModal" :accept-types="['image']" title="图库上传" :description="galleryTarget === 'model' ? '选择资产图片作为模特图' : '选择资产图片作为服饰图'" @close="showGalleryModal = false" @select="selectGallery" />
        <Teleport to="body"><div v-if="previewImage" class="media-preview" @click.self="closePreview"><PcCloseButton class="media-preview__close" aria-label="关闭预览" @click="closePreview" /><img :src="previewImage" :alt="previewTitle || '生成作品'" /><span>{{ previewTitle || '生成作品' }}</span></div></Teleport>
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
import { deleteAigcFashionLookbookResult, deleteAigcFashionLookbookTask, estimateAigcFashionLookbook, generateAigcFashionLookbook, getAigcFashionLookbookConfig, getAigcFashionLookbookModels, getAigcFashionLookbookTasks } from './api'

type UploadSource = 'gallery' | 'local'
type GalleryTarget = 'clothes' | 'model'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'partial_failed' | 'failed'
type UploadItem = { uri: string; preview: string; name: string; source: UploadSource; file?: File | null }

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const emptyImage = PRODUCT_IMAGE_EMPTY_IMAGE
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '服饰套图'))
const models = ref<any[]>([])
const tasks = ref<any[]>([])
const estimateInfo = ref<any>({})
const clothesImages = ref<UploadItem[]>([])
const modelImage = ref('')
const modelImageUrl = ref('')
const modelImageName = ref('')
const modelImageSource = ref<UploadSource>('gallery')
const modelImageFile = ref<File | null>(null)
const ratio = ref('')
const prompt = ref('')
const clothesUploading = ref(false)
const modelUploading = ref(false)
const taskLoading = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const galleryTarget = ref<GalleryTarget>('clothes')
const previewImage = ref('')
const previewTitle = ref('')
const ratioMenuOpen = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const deletingResultIds = ref<number[]>([])
const clothesInputRef = ref<HTMLInputElement | null>(null)
const modelInputRef = ref<HTMLInputElement | null>(null)
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_fashion_lookbook')
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const uploadBlobUrls: string[] = []

const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) return fallback
    return resolved
}

const enabledModels = computed(() => models.value.filter((item) => Number(item.status ?? 1) === 1))
const maxClothesImages = computed(() => Math.max(1, Math.min(6, Number(config.value?.max_clothes_images || 6))))
const activeChannel = computed(() => (config.value?.spec_options || []).find((item: any) => item.code === (config.value?.default_channel || config.value?.config_json?.channel)) || (config.value?.spec_options || [])[0] || {})
const activeQuality = computed(() => (activeChannel.value?.qualities || []).find((item: any) => item.value === (config.value?.default_quality || config.value?.config_json?.quality)) || (activeChannel.value?.qualities || [])[0] || {})
const ratioOptions = computed(() => (activeQuality.value?.ratios || []).map((item: any) => ({ label: item.label || item.ratio || item.value, value: item.value || item.ratio })))
const selectedRatioLabel = computed(() => ratioOptions.value.find((item: any) => item.value === ratio.value)?.label || '请选择比例')
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? config.value?.unit_price ?? 0).toFixed(2))
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' }, { label: '排队中', value: 'pending' }, { label: '生成中', value: 'running' }, { label: '成功', value: 'success' }, { label: '部分失败', value: 'partial_failed' }, { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const canSubmit = computed(() => clothesImages.value.length > 0 && !!modelImage.value && !!ratio.value && !submitting.value && !clothesUploading.value && !modelUploading.value)
const panelTasks = computed(() => tasks.value.map((item: any) => {
    const status = normalizeTaskStatus(item.status)
    const id = taskId(item) || item.id || item.task_id || `fashion-lookbook-${item.create_time || Date.now()}`
    const slots = taskResultSlots(item)
    const downloadableCount = slots.filter((slot: any) => resultDownloadHref(slot.result)).length
    return {
        id,
        mode: 'multi' as const,
        badge: toolDisplayName.value,
        title: taskTitle(item),
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: taskSizeLabel(item),
        prompt: taskPrompt(item),
        references: taskReferenceImages(item),
        items: slots.map((slot: any, index: number) => {
            const result = slot.result || {}
            const href = resultDownloadHref(result)
            return {
                id: slot.key,
                url: resultImageUrl(result),
                downloadUrl: href,
                downloadName: resultDownloadName(result, index),
                status: slot.running ? status : (resultImageUrl(result) ? 'success' : status),
                statusText: slot.running ? statusText(status) : (resultImageUrl(result) ? '已完成' : slot.label || statusText(status)),
                error: slot.description || item.error || taskStateDescription(item),
                raw: result,
                deleteDisabled: slot.running || !resultId(result) || isDeletingResult(result),
                downloadDisabled: !href,
                deleteLabel: isDeletingResult(result) ? '删除中' : '删除'
            }
        }),
        raw: item,
        regenerateDisabled: submitting.value,
        downloadAllDisabled: downloadableCount <= 0 || downloadingTaskIds.value.includes(taskId(item)),
        deleteAllDisabled: !taskId(item) || isTaskRunning(item)
    }
}))

const goBackToSource = () => window.history.length > 1 ? router.back() : router.push('/ai/tools')
const loadConfig = async () => { config.value = await getAigcFashionLookbookConfig(); models.value = await getAigcFashionLookbookModels(); syncRatio() }
const syncRatio = () => {
    if (!ratioOptions.value.some((item: any) => item.value === ratio.value)) {
        const defaultRatio = config.value?.default_ratio || config.value?.config_json?.ratio || ''
        ratio.value = ratioOptions.value.some((item: any) => item.value === defaultRatio) ? defaultRatio : ratioOptions.value[0]?.value || ''
    }
}
const closeDropdowns = () => { ratioMenuOpen.value = false }
const selectRatio = (value: string) => { ratio.value = value; ratioMenuOpen.value = false }
const selectTaskStatus = async (status: TaskStatusFilter) => { activeTaskStatusFilter.value = status; await refreshTasks() }
const triggerClothesUpload = () => clothesInputRef.value?.click()
const triggerModelUpload = () => modelInputRef.value?.click()
const openGallery = (target: GalleryTarget) => { galleryTarget.value = target; showGalleryModal.value = true }

const appendClothes = (items: UploadItem[]) => { clothesImages.value = [...clothesImages.value, ...items].slice(0, maxClothesImages.value); estimateInfo.value = {} }
const handleClothesUpload = (event: Event) => {
    const files = Array.from((event.target as HTMLInputElement).files || [])
    const next = files.slice(0, Math.max(0, maxClothesImages.value - clothesImages.value.length)).map((file) => {
        const objectUrl = URL.createObjectURL(file); uploadBlobUrls.push(objectUrl)
        return { uri: objectUrl, preview: objectUrl, name: file.name, source: 'local' as UploadSource, file }
    })
    appendClothes(next); (event.target as HTMLInputElement).value = ''
}
const handleModelUpload = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file); uploadBlobUrls.push(objectUrl)
    applyModel(objectUrl, objectUrl, file.name, 'local', file); (event.target as HTMLInputElement).value = ''
}
const applyModel = (uri: string, url: string, name: string, source: UploadSource, file: File | null = null) => {
    modelImage.value = uri; modelImageUrl.value = url || uri; modelImageName.value = name; modelImageSource.value = source; modelImageFile.value = file; estimateInfo.value = {}
}
const selectGallery = (item: any) => {
    const uri = item.uri || item.url || item.cover
    const preview = resolveUploadPreviewUrl(item.url || item.cover || item.uri, uri)
    if (galleryTarget.value === 'model') applyModel(uri, preview, item.name || '', 'gallery')
    else appendClothes([{ uri, preview, name: item.name || '', source: 'gallery' }])
    showGalleryModal.value = false
}
const selectPresetModel = (item: any) => applyModel(item.model_image || item.model_url || '', modelCover(item), item.name || '模特预设', 'gallery')
const modelCover = (item: any) => resolveUploadPreviewUrl(item?.cover_url || item?.model_url || item?.cover_image || item?.model_image || '', item?.model_image || '')
const removeClothes = (index: number) => { clothesImages.value.splice(index, 1); estimateInfo.value = {} }
const clearClothes = () => { clothesImages.value = []; estimateInfo.value = {} }
const clearModel = () => applyModel('', '', '', 'gallery')

const uploadLocalImagesIfNeeded = async () => {
    clothesUploading.value = true
    const uploaded: UploadItem[] = []
    try {
        for (const item of clothesImages.value) {
            if (item.source !== 'local' || !item.file) { uploaded.push(item); continue }
            const res: any = await uploadImage({ file: item.file })
            const uri = res?.uri || res?.url || item.uri
            uploaded.push({ ...item, uri, preview: item.preview || resolveUploadPreviewUrl(res?.url || uri, uri), source: 'gallery', file: null })
        }
        clothesImages.value = uploaded
        if (modelImageSource.value === 'local' && modelImageFile.value) {
            modelUploading.value = true
            const res: any = await uploadImage({ file: modelImageFile.value })
            const uri = res?.uri || res?.url || modelImage.value
            applyModel(uri, modelImageUrl.value || resolveUploadPreviewUrl(res?.url || uri, uri), modelImageName.value, 'gallery')
        }
        return { clothes: uploaded.map((item) => item.uri), model: modelImage.value }
    } finally {
        clothesUploading.value = false
        modelUploading.value = false
    }
}
const buildPayload = (uris = clothesImages.value.map((item) => item.uri), model = modelImage.value) => ({ clothes_images: uris, model_image: model, ratio: ratio.value, prompt: prompt.value })
const updateEstimate = async () => {
    if (!clothesImages.value.length || !modelImage.value || !ratio.value || clothesImages.value.some((item) => item.source === 'local') || modelImageSource.value === 'local') { estimateInfo.value = {}; return }
    try { estimateInfo.value = await estimateAigcFashionLookbook(buildPayload(), { suppressErrorMessage: true }) } catch { estimateInfo.value = {} }
}
const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        const uploaded = await uploadLocalImagesIfNeeded()
        await generateAigcFashionLookbook(buildPayload(uploaded.clothes, uploaded.model))
        await refreshTasks()
        startPolling()
    } finally { submitting.value = false }
}
const refreshTasks = async () => {
    taskLoading.value = true
    try { const res: any = await getAigcFashionLookbookTasks({ page_no: 1, page_size: 20, status: activeTaskStatusFilter.value }); tasks.value = Array.isArray(res?.lists) ? res.lists : [] } finally { taskLoading.value = false }
}
const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', partial_failed: '部分失败', canceled: '已取消' }[status] || '生成中')
const normalizeTaskStatus = (status: any) => { const value = String(status || '').toLowerCase(); return ['pending', 'running', 'success', 'failed', 'partial_failed', 'canceled'].includes(value) ? value : 'running' }
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const taskStateDescription = (item: any) => normalizeTaskStatus(item?.status) === 'failed' ? '生成失败，请调整后重新生成' : 'AI 正在生成服饰套图，请稍候'
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskTitle = (item?: any) => `${toolDisplayName.value} ${Number(item?.quantity || item?.clothes_images?.length || 1)}张`
const taskPrompt = (item: any) => String(item.user_prompt || item.prompt || '参考服饰图和模特图生成服饰套图').trim()
const taskReferenceImages = (item: any) => {
    const refs = []
    if (item.model_image_url || item.model_image) refs.push({ label: '模特图', url: item.model_image_url || item.model_image })
    const clothesUrls = Array.isArray(item.clothes_image_urls) ? item.clothes_image_urls : []
    clothesUrls.forEach((url: string, index: number) => refs.push({ label: `服饰图${index + 1}`, url }))
    return refs
}
const taskSizeLabel = (item: any) => item.size_label || (Number(item.width || 0) > 0 && Number(item.height || 0) > 0 ? `${item.width}×${item.height}` : '')
const resultImageUrl = (entry: any) => String(entry?.image_url || entry?.url || entry?.image || '').trim()
const taskResults = (item: any) => Array.isArray(item.results)
    ? item.results.filter((entry: any) => resultImageUrl(entry) !== '').sort((left: any, right: any) => Number(left?.id || 0) - Number(right?.id || 0))
    : []
const taskExpectedResultCount = (item: any) => Math.max(1, Number(item?.quantity || item?.clothes_images?.length || item?.clothes_image_urls?.length || taskResults(item).length || 1))
const taskResultSlots = (item: any) => {
    const results = taskResults(item)
    const status = normalizeTaskStatus(item?.status)
    const expectedCount = Math.max(taskExpectedResultCount(item), results.length, 1)
    if (status === 'success' && results.length > 0 && !isTaskRunning(item)) {
        return results.map((result: any, index: number) => ({
            key: `result-${result.id || resultImageUrl(result) || index}`,
            result,
            running: false,
            label: '',
            description: ''
        }))
    }
    if (isTaskRunning(item)) {
        return Array.from({ length: expectedCount }, (_, index) => ({
            key: `running-${taskId(item) || 'task'}-${index}`,
            result: null,
            running: true,
            label: '',
            description: ''
        }))
    }
    if (results.length) {
        return results.map((result: any, index: number) => ({
            key: `result-${result.id || resultImageUrl(result) || index}`,
            result,
            running: false,
            label: '',
            description: ''
        }))
    }
    return Array.from({ length: expectedCount }, (_, index) => ({
        key: `failed-${taskId(item) || 'task'}-${index}`,
        result: null,
        running: false,
        label: status === 'canceled' ? '已取消' : '生成失败',
        description: item.error || '生成失败，请调整后重新生成'
    }))
}
const resultDownloadUrl = (result: any) => String(result?.download_url || resultImageUrl(result) || '').trim()
const resultDownloadHref = (result: any) => resolvePcDownloadUrl(resultDownloadUrl(result))
const resultDownloadName = (result: any, index = 0) => {
    const href = resultDownloadHref(result)
    return `fashion-lookbook-${result?.id || Date.now()}-${index + 1}.${getPcDownloadExtension(href, 'png')}`
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
    const clothes = Array.isArray(item.clothes_images) ? item.clothes_images : []
    const urls = Array.isArray(item.clothes_image_urls) ? item.clothes_image_urls : []
    clothesImages.value = clothes.map((uri: string, index: number) => ({ uri, preview: urls[index] || uri, name: `服饰图${index + 1}`, source: 'gallery' }))
    applyModel(item.model_image || item.model_image_url || '', item.model_image_url || item.model_image || '', '模特图', 'gallery')
    ratio.value = item.ratio || ratio.value
    prompt.value = String(item.user_prompt || '')
}
const rerunTask = async (item: any) => { editTask(item); await submit() }
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const deleteTask = async (item: any) => { const id = taskId(item); if (!id) return; await deleteAigcFashionLookbookTask({ id }); await refreshTasks() }
const resultId = (result: any) => Number(result?.id || result?.result_id || 0)
const isDeletingResult = (result: any) => deletingResultIds.value.includes(resultId(result))
const isMultiImageTask = (item: any) => taskExpectedResultCount(item) > 1 || taskResults(item).length > 1
const deleteSingleResult = async (result: any) => {
    const id = resultId(result)
    if (!id || deletingResultIds.value.includes(id)) return
    deletingResultIds.value = [...deletingResultIds.value, id]
    try {
        await deleteAigcFashionLookbookResult({ id })
        await refreshTasks()
    } finally {
        deletingResultIds.value = deletingResultIds.value.filter((item) => item !== id)
    }
}
const deleteResultOrTask = async (result: any, item: any) => {
    if (!isMultiImageTask(item)) {
        await deleteTask(item)
        return
    }
    await deleteSingleResult(result)
}
const rawPanelTask = (task: any) => task?.raw || task
const rawPanelItem = (item: any) => item?.raw || item
const triggerDownload = (href: string, filename: string) => { if (!href) return; const link = document.createElement('a'); link.href = href; link.download = filename; link.target = '_blank'; link.rel = 'noopener noreferrer'; document.body.appendChild(link); link.click(); link.remove() }
const handlePanelEdit = (task: any) => editTask(rawPanelTask(task))
const handlePanelRegenerate = (task: any) => rerunTask(rawPanelTask(task))
const handlePanelPreviewReference = (reference: any, task: any) => { if (!reference?.url) return; previewImage.value = reference.url; previewTitle.value = `${task?.title || toolDisplayName.value} ${reference.label || '参考图'}` }
const handlePanelPreview = (item: any, task: any) => { if (!item?.url) return; previewImage.value = item.url; previewTitle.value = task?.title || '生成作品' }
const handlePanelDownloadOne = (item: any) => triggerDownload(item?.downloadUrl || '', item?.downloadName || '生成作品.png')
const handlePanelDownloadAll = (task: any) => { const raw = rawPanelTask(task); const id = taskId(raw); void downloadTaskResults(id, task.items || [], `fashion-lookbook-${id}.zip`) }
const handlePanelDeleteOne = (item: any, task: any) => deleteResultOrTask(rawPanelItem(item), rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))
const startPolling = () => { if (pollTimer) return; pollTimer = window.setInterval(async () => { await refreshTasks(); if (!tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) stopPolling() }, 5000) }
const stopPolling = () => { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null } }

watch([clothesImages, modelImage, ratio], updateEstimate, { deep: true })
onMounted(async () => { window.addEventListener('click', closeDropdowns); await loadConfig(); await refreshTasks(); if (tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) startPolling() })
onUnmounted(() => { window.removeEventListener('click', closeDropdowns); stopPolling(); uploadBlobUrls.forEach((url) => URL.revokeObjectURL(url)) })
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;

.fashion-lookbook-page { height: 100%; min-width: calc(403px + 24px + 560px); }
.fashion-upload-card { height: 176px; min-height: 176px; }
.fashion-model-card { height: 176px; min-height: 176px; }
.fashion-upload-list { display: flex; flex-direction: column; gap: 12px; padding-top: 14px; }
.fashion-upload-list__head { color: rgba(255,255,255,.62); font-size: 13px; line-height: 20px; }
.fashion-upload-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
.fashion-upload-item { position: relative; aspect-ratio: 1 / 1; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #050505; overflow: hidden; }
.fashion-upload-item img { display: block; width: 100%; height: 100%; object-fit: cover; }
.fashion-upload-item button { position: absolute; right: 6px; top: 6px; display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 50%; background: rgba(0,0,0,.68); color: #fff; cursor: pointer; }
.upload-card__placeholder small { color: rgba(255,255,255,.42); font-size: 12px; line-height: 18px; text-align: center; }
.fashion-model-card .upload-card__stage { position: relative; width: 100%; height: 100%; background: #050505; }
.fashion-model-card .upload-card__stage img { width: 100%; height: 100%; object-fit: contain; }
.fashion-model-card .upload-card__actions { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px; background: rgba(5,5,5,.42); opacity: 0; pointer-events: none; backdrop-filter: blur(2px); transition: opacity .2s ease; }
.fashion-model-card.is-filled:hover .upload-card__actions { opacity: 1; pointer-events: auto; }
.preset-models { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; padding-top: 14px; }
.preset-model { min-width: 0; padding: 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #171717; color: rgba(255,255,255,.72); cursor: pointer; text-align: left; }
.preset-model:hover { border-color: rgba(255,255,255,.16); background: #1f1f1f; }
.preset-model.is-active { border-color: #fff; color: #fff; }
.preset-model img { display: block; width: 100%; aspect-ratio: 1 / 1; border-radius: 9px; background: #050505; object-fit: cover; }
.preset-model span { display: block; margin-top: 7px; overflow: hidden; font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 1200px) { .fashion-lookbook-page { min-width: 0; } }
</style>
