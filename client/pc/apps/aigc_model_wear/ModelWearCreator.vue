<template>
    <div class="model-wear-page">
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
                        <label class="field-label">上传图片</label>
                        <div class="model-wear-upload-grid">
                            <div class="model-wear-upload-item">
                                <button v-if="modelImage" type="button" class="ghost-button model-wear-upload-clear" @click="clearUpload('model')">清空</button>
                                <UploadCard
                                    title="上传模特图"
                                    alt="模特图"
                                    :image="modelImage"
                                    :image-url="modelImageUrl"
                                    :uploading="modelUploading"
                                    @gallery="openGallery('model')"
                                    @local="triggerUpload('model')"
                                />
                            </div>

                            <div class="model-wear-upload-item">
                                <button v-if="wearImage" type="button" class="ghost-button model-wear-upload-clear" @click="clearUpload('wear')">清空</button>
                                <UploadCard
                                    title="上传穿戴图"
                                    alt="穿戴图"
                                    :image="wearImage"
                                    :image-url="wearImageUrl"
                                    :uploading="wearUploading"
                                    @gallery="openGallery('wear')"
                                    @local="triggerUpload('wear')"
                                />
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">生成质量</label>
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

                    <section class="field-block">
                        <label class="field-label">生成比例</label>
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
                        <textarea v-model="prompt" maxlength="300" placeholder="可补充穿搭风格、服饰类型、镜头氛围或你希望强化的穿戴效果"></textarea>
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

        <input ref="modelInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload($event, 'model')" />
        <input ref="wearInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload($event, 'wear')" />

        <AiWorkspaceAssetGalleryModal
            :visible="showGalleryModal"
            :accept-types="['image']"
            title="图库上传"
            :description="`选择资产图片作为${galleryTarget === 'model' ? '模特图' : '穿戴图'}`"
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
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
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
    deleteAigcModelWearTask,
    estimateAigcModelWear,
    generateAigcModelWear,
    getAigcModelWearConfig,
    getAigcModelWearTasks
} from './api'

type UploadSource = 'gallery' | 'local'
type UploadTarget = 'model' | 'wear'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const UploadCard = defineComponent({
    props: {
        title: { type: String, required: true },
        alt: { type: String, required: true },
        image: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        uploading: { type: Boolean, default: false }
    },
    emits: ['gallery', 'local'],
    setup(props, { emit }) {
        return () => h('div', { class: ['upload-card', { 'is-filled': !!props.image, 'is-uploading': props.uploading }] }, [
            props.image
                ? [
                    h('div', { class: 'upload-card__stage' }, [h('img', { src: props.imageUrl || props.image, alt: props.alt })]),
                    h('div', { class: 'upload-card__actions' }, [
                        h('button', { class: 'upload-card__action', type: 'button', onClick: () => emit('gallery') }, '图库上传'),
                        h('button', { class: 'upload-card__action', type: 'button', onClick: () => emit('local') }, '本地上传')
                    ])
                ]
                : h('div', { class: 'upload-card__placeholder', onClick: () => emit('local') }, [
                    h('img', { class: 'upload-card__icon', src: addIcon, alt: '' }),
                    h('strong', props.title),
                    h('button', { class: 'upload-card__library', type: 'button', onClick: (event: Event) => { event.stopPropagation(); emit('gallery') } }, '图库上传')
                ]),
            props.uploading ? h('span', { class: 'upload-mask' }, [h('i'), '上传中']) : null
        ])
    }
})

const router = useRouter()
const emptyImage = PRODUCT_IMAGE_EMPTY_IMAGE
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '模特穿戴'))
const tasks = ref<any[]>([])
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_model_wear')
const estimateInfo = ref<any>({})
const modelImage = ref('')
const modelImageUrl = ref('')
const modelImageName = ref('')
const modelImageSource = ref<UploadSource>('gallery')
const modelImageFile = ref<File | null>(null)
const wearImage = ref('')
const wearImageUrl = ref('')
const wearImageName = ref('')
const wearImageSource = ref<UploadSource>('gallery')
const wearImageFile = ref<File | null>(null)
const pricePackage = ref('')
const ratio = ref('')
const prompt = ref('')
const modelUploading = ref(false)
const wearUploading = ref(false)
const taskLoading = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const galleryTarget = ref<UploadTarget>('model')
const previewImage = ref('')
const previewTitle = ref('')
const ratioMenuOpen = ref(false)
const taskStatusMenuOpen = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const modelInputRef = ref<HTMLInputElement | null>(null)
const wearInputRef = ref<HTMLInputElement | null>(null)
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
    const id = taskId(item) || item.id || item.task_id || `model-wear-${item.create_time || Date.now()}`
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

const canSubmit = computed(() => !!modelImage.value && !!wearImage.value && !!pricePackage.value && !!ratio.value && !submitting.value && !modelUploading.value && !wearUploading.value)

const goBackToSource = () => {
    if (window.history.length > 1) {
        router.back()
        return
    }
    router.push('/ai/tools')
}

const loadConfig = async () => {
    config.value = await getAigcModelWearConfig()
    pricePackage.value = defaultPackageCode()
    syncRatio()
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

const triggerUpload = (target: UploadTarget) => {
    if (target === 'model') modelInputRef.value?.click()
    else wearInputRef.value?.click()
}

const handleUpload = async (event: Event, target: UploadTarget) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    uploadBlobUrls.push(objectUrl)
    applyUpload(target, objectUrl, objectUrl, file.name, 'local', file)
    ;(event.target as HTMLInputElement).value = ''
}

const applyUpload = (target: UploadTarget, uri: string, url: string, name: string, source: UploadSource, file: File | null = null) => {
    if (target === 'model') {
        modelImage.value = uri
        modelImageUrl.value = url || uri
        modelImageName.value = name
        modelImageSource.value = source
        modelImageFile.value = file
    } else {
        wearImage.value = uri
        wearImageUrl.value = url || uri
        wearImageName.value = name
        wearImageSource.value = source
        wearImageFile.value = file
    }
}

const clearUpload = (target: UploadTarget) => {
    applyUpload(target, '', '', '', 'gallery')
    estimateInfo.value = {}
}

const openGallery = (target: UploadTarget) => {
    galleryTarget.value = target
    showGalleryModal.value = true
}

const selectGallery = (item: any) => {
    const uri = item.uri || item.url || item.cover
    applyUpload(galleryTarget.value, uri, resolveUploadPreviewUrl(item.url || item.cover || item.uri, uri), item.name || '', 'gallery')
    showGalleryModal.value = false
}

const uploadLocalImageIfNeeded = async (target: UploadTarget) => {
    const source = target === 'model' ? modelImageSource.value : wearImageSource.value
    const file = target === 'model' ? modelImageFile.value : wearImageFile.value
    const current = target === 'model' ? modelImage.value : wearImage.value
    if (source !== 'local' || !file) return current
    const previewUrl = target === 'model' ? modelImageUrl.value : wearImageUrl.value
    if (target === 'model') modelUploading.value = true
    else wearUploading.value = true
    try {
        const res: any = await uploadImage({ file })
        const uri = res?.uri || res?.url || ''
        if (!uri) return current
        applyUpload(target, uri, previewUrl || resolveUploadPreviewUrl(res?.url || uri, uri), file.name, 'gallery')
        return uri
    } finally {
        if (target === 'model') modelUploading.value = false
        else wearUploading.value = false
    }
}

const buildPayload = (overrides: Partial<Record<'model_image' | 'wear_image', string>> = {}) => ({
    model_image: overrides.model_image ?? modelImage.value,
    wear_image: overrides.wear_image ?? wearImage.value,
    price_package: pricePackage.value,
    ratio: ratio.value,
    prompt: prompt.value
})

const updateEstimate = async () => {
    if (!modelImage.value || !wearImage.value || modelImageSource.value === 'local' || wearImageSource.value === 'local') {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcModelWear(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}

const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        const [modelUri, wearUri] = await Promise.all([
            uploadLocalImageIfNeeded('model'),
            uploadLocalImageIfNeeded('wear')
        ])
        await generateAigcModelWear(buildPayload({ model_image: modelUri, wear_image: wearUri }))
        await refreshTasks()
        startPolling()
    } finally {
        submitting.value = false
    }
}

const refreshTasks = async () => {
    taskLoading.value = true
    try {
        const res: any = await getAigcModelWearTasks({
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
const taskStateDescription = (item: any) => normalizeTaskStatus(item?.status) === 'failed' ? '生成失败，请调整后重新生成' : 'AI 正在生成穿戴效果，请稍候'
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskTitle = (_item?: any) => toolDisplayName.value
const taskPrompt = (item: any) => String(item.user_prompt || item.prompt || '参考模特图和穿戴图生成穿戴效果').trim()
const taskReferenceImage = (item: any) => item.model_image_url || item.model_image || item.wear_image_url || item.wear_image || ''
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
    return `aigc-model-wear-${id}.${ext}`
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
            downloadName: `aigc-model-wear-${id}-${index + 1}.${ext}`
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
    applyUpload('model', item.model_image || item.model_image_url || '', item.model_image_url || item.model_image || '', '模特图', 'gallery')
    applyUpload('wear', item.wear_image || item.wear_image_url || '', item.wear_image_url || item.wear_image || '', '穿戴图', 'gallery')
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
    await deleteAigcModelWearTask({ id })
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
    void downloadTaskResults(id, task.items || [], `model-wear-${id}.zip`)
}
const handlePanelDeleteOne = (_item: any, task: any) => deleteTask(rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))

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

watch([modelImage, wearImage, pricePackage, ratio], updateEstimate)
watch(pricePackage, syncRatio)

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

.model-wear-page {
    height: 100%;
    min-width: calc(403px + 24px + 560px);
}

.model-wear-upload-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}

.model-wear-upload-item {
    position: relative;
    display: grid;
    min-width: 0;
}

.model-wear-upload-clear {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 4;
    height: 30px;
    padding: 0 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.48);
    backdrop-filter: blur(4px);
}

.model-wear-upload-grid :deep(.upload-card__stage) {
    position: relative;
    width: 100%;
    height: 100%;
    background: #050505;
}

.model-wear-upload-grid :deep(.upload-card__stage img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.model-wear-upload-grid :deep(.upload-card__placeholder) {
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

.model-wear-upload-grid :deep(.upload-card__icon) {
    width: 40px;
    height: 40px;
    object-fit: contain;
}

.model-wear-upload-grid :deep(.upload-card strong) {
    color: #b8b8b8;
    font-size: 14px;
    font-weight: 500;
}

.model-wear-upload-grid :deep(.upload-card__library),
.model-wear-upload-grid :deep(.upload-card__action) {
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

.model-wear-upload-grid :deep(.upload-card__library:hover),
.model-wear-upload-grid :deep(.upload-card__action:hover) {
    background: #3c3c3c;
}

.model-wear-upload-grid :deep(.upload-card__actions) {
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

.model-wear-upload-grid :deep(.upload-card.is-filled:hover .upload-card__actions) {
    opacity: 1;
    pointer-events: auto;
}

.model-wear-upload-grid :deep(.upload-mask) {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(2px);
}

.model-wear-upload-grid :deep(.upload-mask i) {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@media (max-width: 1200px) {
    .model-wear-page {
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
