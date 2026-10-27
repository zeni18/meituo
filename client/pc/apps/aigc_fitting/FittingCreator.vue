<template>
    <div class="fitting-page">
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
                            <label class="field-label">上传服装</label>
                            <div class="tool-select-dropdown" @click.stop>
                                <button class="tool-select-card tool-select-card--button fitting-category-button" type="button" :aria-expanded="categoryMenuOpen" @click="categoryMenuOpen = !categoryMenuOpen">
                                    <span class="tool-select-card__value">{{ categoryLabel(uploadCategory) }}</span>
                                    <img :src="downIcon" alt="" :class="{ 'is-open': categoryMenuOpen }" />
                                </button>
                                <div v-if="categoryMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                    <button v-for="item in uploadCategoryOptions" :key="item.key" :class="{ 'is-active': uploadCategory === item.key }" type="button" @click="setUploadCategory(item.key)">
                                        <span>{{ item.label }}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div v-if="isSplitGarment" class="split-upload-grid">
                            <UploadCard title="上装图" :image="topImage" :image-url="topImageUrl" :uploading="topUploading" @local="triggerUpload('top')" @gallery="openGallery('top')" @clear="clearUpload('top')" />
                            <UploadCard title="下装图" :image="bottomImage" :image-url="bottomImageUrl" :uploading="bottomUploading" @local="triggerUpload('bottom')" @gallery="openGallery('bottom')" @clear="clearUpload('bottom')" />
                        </div>
                        <UploadCard v-else title="服装图" :image="garmentImage" :image-url="garmentImageUrl" :uploading="garmentUploading" @local="triggerUpload('garment')" @gallery="openGallery('garment')" @clear="clearUpload('garment')" />
                    </section>

                    <section class="field-block">
                        <label class="field-label">生成模式与模特</label>
                        <div class="mode-tabs">
                            <button v-for="item in modeOptions" :key="item.key" type="button" :class="{ 'is-active': mode === item.key }" @click="setMode(item.key)">
                                {{ item.label }}
                            </button>
                        </div>

                        <template v-if="mode !== 'custom'">
                            <div class="filter-grid">
                                <SelectField :label="modelFilterLabel(modelFilter)" :options="modelFilterOptions" :value="modelFilter" @select="modelFilter = $event" />
                                <SelectField :label="clothesFilterLabel(clothesFilter)" :options="clothesFilterOptions" :value="clothesFilter" @select="clothesFilter = $event" />
                                <SelectField :label="poseFilterLabel(poseFilter)" :options="poseFilterOptions" :value="poseFilter" @select="poseFilter = $event" />
                            </div>
                            <div v-if="displayPresets.length" class="preset-grid">
                                <button v-for="item in displayPresets" :key="item.id" type="button" :class="{ 'is-active': selectedPresetIds.includes(item.id) }" @click="selectPreset(item)">
                                    <img :src="item.image" :alt="item.name" />
                                    <span v-if="mode === 'group'">{{ item.images.length }} 姿势</span>
                                </button>
                            </div>
                            <div v-else class="empty-hint">暂无可用模特</div>
                        </template>

                        <template v-else>
                            <div class="upload-card custom-model-uploader" :class="{ 'is-uploading': modelUploading }">
                                <div class="upload-card__placeholder" @click="triggerUpload('model')">
                                    <img class="upload-card__icon" :src="addIcon" alt="" />
                                    <strong>本地上传</strong>
                                    <small>最多 {{ maxCustomModels }} 张模特图</small>
                                    <button class="upload-card__library" type="button" @click.stop="openGallery('model')">图库上传</button>
                                </div>
                                <span v-if="modelUploading" class="upload-mask"><i></i>上传中</span>
                            </div>
                        </template>

                    </section>
                </div>

                <div class="submit-bar">
                    <div class="selected-models">
                        <div class="selected-models__head">
                            <span>已选模特</span>
                            <strong>{{ selectedThumbs.length }}/{{ selectionLimit }}</strong>
                        </div>
                        <div class="selected-models__grid">
                            <div v-for="index in selectionLimit" :key="`selected-${index}`" class="selected-model">
                                <img v-if="selectedThumbs[index - 1]" :src="selectedThumbs[index - 1]" alt="已选模特" />
                                <button
                                    v-if="selectedThumbs[index - 1]"
                                    class="selected-model__remove"
                                    type="button"
                                    aria-label="移除模特"
                                    @click="removeSelectedModel(index - 1)"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="submit-bar__main">
                        <div><span>预计消耗</span><strong>{{ formatPoint(estimatePoints) }}</strong></div>
                        <button type="button" :disabled="!canSubmit" @click="submit">{{ submitting ? '生成中' : '立即生成' }}</button>
                    </div>
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

        <input ref="fileInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" :multiple="uploadTarget === 'model' && mode === 'custom'" @change="handleUpload" />
        <AiWorkspaceAssetGalleryModal :visible="showGalleryModal" :accept-types="['image']" title="图库上传" description="选择资产图片" @close="showGalleryModal = false" @select="selectGallery" />
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
import downIcon from '@/assets/images/icon/Down.svg'
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { uploadImage } from '@/api/app'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import feedback from '@/utils/feedback'
import {
    deleteAigcFittingResult,
    deleteAigcFittingTask,
    estimateAigcFitting,
    generateAigcFitting,
    getAigcFittingConfig,
    getAigcFittingTasks
} from './api'

type UploadSource = 'gallery' | 'local' | 'example'
type UploadTarget = 'garment' | 'top' | 'bottom' | 'model'
type UploadCategory = 'tops' | 'bottoms' | 'set' | 'dress'
type Mode = 'single' | 'group' | 'custom'
type FilterOption = { key: string; label: string }
type Preset = { id: string; name: string; image: string; images: string[]; mode: Mode; modelFilter: string; clothesFilter: string; poseFilter: string; vip: boolean }
type UploadItem = { preview: string; url: string; name: string; source: UploadSource; file?: File | null }
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const UploadCard = defineComponent({
    props: { title: String, image: String, imageUrl: String, uploading: Boolean },
    emits: ['local', 'gallery', 'clear'],
    setup(props, { emit }) {
        return () => h('div', { class: 'upload-field' }, [
            h('div', { class: 'field-head upload-field__head' }, [
                h('label', { class: 'field-label' }, props.title || '上传图片'),
                props.image ? h('button', { class: 'ghost-button', type: 'button', onClick: () => emit('clear') }, '清空') : null
            ]),
            h('div', { class: ['upload-card', { 'is-filled': !!props.image, 'is-uploading': props.uploading }] }, props.image
                ? [
                    h('div', { class: 'upload-card__stage' }, [h('img', { src: props.imageUrl || props.image, alt: props.title })]),
                    h('div', { class: 'upload-card__actions' }, [
                        h('button', { class: 'upload-card__action', type: 'button', onClick: () => emit('gallery') }, '图库上传'),
                        h('button', { class: 'upload-card__action', type: 'button', onClick: () => emit('local') }, '本地上传')
                    ]),
                    props.uploading ? h('span', { class: 'upload-mask' }, [h('i'), '上传中']) : null
                ]
                : [
                    h('div', { class: 'upload-card__placeholder', onClick: () => emit('local') }, [
                        h('img', { class: 'upload-card__icon', src: addIcon, alt: '' }),
                        h('strong', '本地上传'),
                        h('button', { class: 'upload-card__library', type: 'button', onClick: (event: Event) => { event.stopPropagation(); emit('gallery') } }, '图库上传')
                    ]),
                    props.uploading ? h('span', { class: 'upload-mask' }, [h('i'), '上传中']) : null
                ])
        ])
    }
})
const SelectField = defineComponent({
    props: { label: String, value: String, options: { type: Array, default: () => [] } },
    emits: ['select'],
    setup(props, { emit }) {
        const open = ref(false)
        return () => h('div', { class: 'tool-select-dropdown', onClick: (event: Event) => event.stopPropagation() }, [
            h('button', { class: 'tool-select-card tool-select-card--button', type: 'button', 'aria-expanded': open.value, onClick: () => { open.value = !open.value } }, [
                h('span', { class: 'tool-select-card__value' }, props.label || '全部'),
                h('img', { src: downIcon, alt: '', class: { 'is-open': open.value } })
            ]),
            open.value ? h('div', { class: 'tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown' }, (props.options as FilterOption[]).map((item) =>
                h('button', { class: { 'is-active': item.key === props.value }, type: 'button', onClick: () => { open.value = false; emit('select', item.key) } }, [h('span', item.label)])
            )) : null
        ])
    }
})

const router = useRouter()
const route = useRoute()
const { ensurePcLogin } = usePcLoginGate()
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_fitting')
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, 'AI试衣'))
const estimateInfo = ref<any>({})
const tasks = ref<any[]>([])
const garmentImage = ref('')
const garmentImageUrl = ref('')
const garmentName = ref('')
const garmentSource = ref<UploadSource>('gallery')
const garmentFile = ref<File | null>(null)
const topImage = ref('')
const topImageUrl = ref('')
const topName = ref('')
const topSource = ref<UploadSource>('gallery')
const topFile = ref<File | null>(null)
const bottomImage = ref('')
const bottomImageUrl = ref('')
const bottomName = ref('')
const bottomSource = ref<UploadSource>('gallery')
const bottomFile = ref<File | null>(null)
const customModels = ref<UploadItem[]>([])
const uploadCategory = ref<UploadCategory>('tops')
const mode = ref<Mode>('single')
const modelFilter = ref('all')
const clothesFilter = ref('all')
const poseFilter = ref('all')
const selectedPresetIds = ref<string[]>([])
const uploadTarget = ref<UploadTarget>('garment')
const categoryMenuOpen = ref(false)
const showGalleryModal = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const garmentUploading = ref(false)
const topUploading = ref(false)
const bottomUploading = ref(false)
const modelUploading = ref(false)
const submitting = ref(false)
const taskLoading = ref(false)
const taskLoadingMore = ref(false)
const taskHasMore = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const deletingResultKeys = ref<string[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const uploadBlobUrls: string[] = []
const TASK_PAGE_SIZE = 10
const taskPageNo = ref(1)
const maxCustomModels = 4

const uploadCategoryOptions = [
    { key: 'tops' as const, label: '上装' },
    { key: 'bottoms' as const, label: '下装' },
    { key: 'set' as const, label: '上下装' },
    { key: 'dress' as const, label: '连体衣' }
]
const modeOptions = [
    { key: 'single' as const, label: '单图' },
    { key: 'group' as const, label: '组图' },
    { key: 'custom' as const, label: '自定义' }
]
const defaultModelFilters = [{ key: 'all', label: '全部模特' }, { key: 'male', label: '男' }, { key: 'female', label: '女' }, { key: 'child', label: '儿童' }]
const defaultClothesFilters = [{ key: 'all', label: '全部服饰' }, { key: 'sleeveless', label: '无袖' }, { key: 'coat', label: '外套' }, { key: 'long-pants', label: '长裤' }, { key: 'long-skirt', label: '长裙' }, { key: 'short-sleeve', label: '短袖' }, { key: 'short-skirt', label: '短裙' }, { key: 'long-sleeve', label: '长袖' }, { key: 'short-pants', label: '短裤' }]
const defaultPoseFilters = [{ key: 'all', label: '全部姿势' }, { key: 'full', label: '全身' }, { key: 'half', label: '半身' }]
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' },
    { label: '排队中', value: 'pending' },
    { label: '生成中', value: 'running' },
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const configJson = computed(() => config.value?.config_json && typeof config.value.config_json === 'object' ? config.value.config_json : {})
const isSplitGarment = computed(() => uploadCategory.value === 'set')
const presets = computed(() => normalizePresets(configJson.value.model_examples))
const modelFilterOptions = computed(() => normalizeFilterOptions(config.value?.model_gender_options || config.value?.gender_options || [], defaultModelFilters))
const clothesFilterOptions = computed(() => normalizeFilterOptions(config.value?.model_clothes_options || config.value?.clothes_options || [], defaultClothesFilters))
const poseFilterOptions = computed(() => normalizeFilterOptions(config.value?.model_pose_options || config.value?.pose_options || [], defaultPoseFilters))
const displayPresets = computed(() => presets.value.filter((item) => {
    if (item.mode !== mode.value) return false
    if (modelFilter.value !== 'all' && item.modelFilter !== modelFilter.value) return false
    if (clothesFilter.value !== 'all' && item.clothesFilter !== clothesFilter.value) return false
    if (poseFilter.value !== 'all' && item.poseFilter !== poseFilter.value) return false
    return true
}))
const selectedPresets = computed(() => selectedPresetIds.value.map((id) => presets.value.find((item) => item.id === id)).filter(Boolean) as Preset[])
const selectedGroupPreset = computed(() => mode.value === 'group' ? selectedPresets.value.find((item) => item.mode === 'group') : undefined)
const selectedThumbs = computed(() => {
    if (mode.value === 'custom') return customModels.value.map((item) => item.preview)
    if (mode.value === 'group') return selectedGroupPreset.value?.images || []
    return selectedPresets.value.map((item) => item.image)
})
const configuredUnitPrice = computed(() => {
    const prices = configJson.value.mode_prices && typeof configJson.value.mode_prices === 'object'
        ? configJson.value.mode_prices
        : {}
    const price = Number(prices[mode.value] ?? 0)
    return Number.isFinite(price) ? Math.max(0, price) : 0
})
const configuredEstimatePoints = computed(() => {
    const quantity = selectedThumbs.value.length || (mode.value === 'group' ? 2 : 1)
    return Number((configuredUnitPrice.value * Math.max(1, Math.min(4, quantity))).toFixed(2))
})
const selectionLimit = computed(() => {
    if (mode.value === 'custom') return maxCustomModels
    if (mode.value === 'group') return selectedGroupPreset.value?.images.length || 4
    return 4
})
const garmentThumbs = computed(() => isSplitGarment.value ? [topImage.value, bottomImage.value].filter(Boolean) : [garmentImage.value].filter(Boolean))
const estimatePoints = computed(() => {
    const remotePoints = Number(estimateInfo.value?.user_charge_points ?? estimateInfo.value?.display_points)
    return Number.isFinite(remotePoints) ? remotePoints : configuredEstimatePoints.value
})
const canSubmit = computed(() => {
    const missingGarment = isSplitGarment.value ? (!topImage.value || !bottomImage.value) : !garmentImage.value
    const missingModel = mode.value === 'custom' ? !customModels.value.length : !selectedPresetIds.value.length
    return !missingGarment && !missingModel && !submitting.value && !garmentUploading.value && !topUploading.value && !bottomUploading.value && !modelUploading.value
})
const panelTasks = computed(() => tasks.value.map((item: any) => mapPanelTask(item)))

const goBackToSource = () => { if (window.history.length > 1) return router.back(); router.push('/ai/tools') }
const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) return fallback
    return resolved
}
const normalizeFilterValue = (value: unknown, fallback = 'all') => String(value || '').trim() || fallback
const normalizeFilterOptions = (items: any[], defaults: FilterOption[]) => {
    const map = new Map(defaults.map((item) => [item.key, item.label]))
    ;(Array.isArray(items) ? items : []).forEach((item: any) => {
        const key = normalizeFilterValue(item?.key ?? item?.value, '')
        if (key) map.set(key, String(item?.label || map.get(key) || key))
    })
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
}
const normalizeImages = (item: any) => {
    const rows = Array.isArray(item?.image_urls) && item.image_urls.length
        ? [...item.image_urls, item?.image_url]
        : [...(Array.isArray(item?.images) ? item.images : []), item?.image, item?.url, item?.uri]
    const seen = new Set<string>()
    return rows.map((value: any) => String(value || '').trim()).filter((value) => {
        if (!value) return false
        const key = value.split('?')[0].replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '')
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}
const normalizePresets = (items: any[]): Preset[] => (Array.isArray(items) ? items : [])
    .map((item: any, index) => {
        const itemMode = String(item?.mode || 'single') === 'group' ? 'group' : 'single'
        const images = normalizeImages(item).slice(0, itemMode === 'group' ? 4 : 1)
        const id = String(item?.id || images[0] || index)
        return {
            id,
            mode: itemMode as Mode,
            name: String(item?.name || `模特-${index + 1}`),
            image: images[0] || '',
            images,
            modelFilter: normalizeFilterValue(item?.gender, 'female'),
            clothesFilter: normalizeFilterValue(item?.category, 'all'),
            poseFilter: normalizeFilterValue(item?.pose, 'full'),
            vip: Number(item?.vip || 0) === 1
        }
    })
    .filter((item) => item.image)
const categoryLabel = (value: UploadCategory) => uploadCategoryOptions.find((item) => item.key === value)?.label || '上装'
const mapCategoryToUi = (category: string): UploadCategory => ({ full: 'tops', top: 'tops', bottom: 'bottoms', dress: 'dress', suit: 'set', set: 'set', coat: 'tops' }[category] as UploadCategory || 'tops')
const mapCategoryToApi = (category: UploadCategory) => ({ tops: 'top', bottoms: 'bottom', dress: 'dress', set: 'suit' }[category] || 'full')
const modelFilterLabel = (value: string) => modelFilterOptions.value.find((item) => item.key === value)?.label || '全部模特'
const clothesFilterLabel = (value: string) => clothesFilterOptions.value.find((item) => item.key === value)?.label || '全部服饰'
const poseFilterLabel = (value: string) => poseFilterOptions.value.find((item) => item.key === value)?.label || '全部姿势'
const loadConfig = async () => {
    config.value = await getAigcFittingConfig()
    const defaultMode = String(config.value?.default_mode || 'single') as Mode
    if (['single', 'group', 'custom'].includes(defaultMode)) mode.value = defaultMode
    uploadCategory.value = mapCategoryToUi(String(config.value?.default_upload_category || 'full'))
    await updateEstimate()
}
const refreshTasks = async (options: { page?: number; append?: boolean; sync?: boolean } = {}) => {
    const page = Math.max(1, options.page || 1)
    const append = !!options.append
    if (append) taskLoadingMore.value = true
    else taskLoading.value = true
    try {
        const res: any = await getAigcFittingTasks({
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
const selectTaskStatus = async (status: TaskStatusFilter) => { activeTaskStatusFilter.value = status; await refreshTasks({ sync: true }) }
const setUploadCategory = (value: UploadCategory) => { uploadCategory.value = value; categoryMenuOpen.value = false; void updateEstimate() }
const setMode = (value: Mode) => { mode.value = value; selectedPresetIds.value = []; void updateEstimate() }
const selectPreset = (item: Preset) => {
    if (mode.value === 'group') {
        selectedPresetIds.value = selectedPresetIds.value.includes(item.id) ? [] : [item.id]
        return
    }
    if (selectedPresetIds.value.includes(item.id)) selectedPresetIds.value = selectedPresetIds.value.filter((id) => id !== item.id)
    else selectedPresetIds.value = [...selectedPresetIds.value, item.id].slice(0, 4)
    void updateEstimate()
}
const triggerUpload = (target: UploadTarget) => { uploadTarget.value = target; fileInputRef.value?.click() }
const openGallery = (target: UploadTarget) => { uploadTarget.value = target; showGalleryModal.value = true }
const handleUpload = (event: Event) => {
    const files = Array.from((event.target as HTMLInputElement).files || [])
    if (!files.length) return
    if (uploadTarget.value === 'model' && mode.value === 'custom') {
        const next = files.slice(0, Math.max(0, maxCustomModels - customModels.value.length)).map((file) => {
            const objectUrl = URL.createObjectURL(file)
            uploadBlobUrls.push(objectUrl)
            return { preview: objectUrl, url: objectUrl, name: file.name, source: 'local' as UploadSource, file }
        })
        customModels.value = [...customModels.value, ...next].slice(0, maxCustomModels)
    } else {
        const file = files[0]
        const objectUrl = URL.createObjectURL(file)
        uploadBlobUrls.push(objectUrl)
        applySingleUpload(uploadTarget.value, objectUrl, objectUrl, file.name, 'local', file)
    }
    ;(event.target as HTMLInputElement).value = ''
    estimateInfo.value = {}
}
const applySingleUpload = (target: UploadTarget, uri: string, url: string, name: string, source: UploadSource, file: File | null = null) => {
    if (target === 'top') { topImage.value = uri; topImageUrl.value = url || uri; topName.value = name; topSource.value = source; topFile.value = file }
    else if (target === 'bottom') { bottomImage.value = uri; bottomImageUrl.value = url || uri; bottomName.value = name; bottomSource.value = source; bottomFile.value = file }
    else { garmentImage.value = uri; garmentImageUrl.value = url || uri; garmentName.value = name; garmentSource.value = source; garmentFile.value = file }
    estimateInfo.value = {}
}
const clearUpload = (target: UploadTarget) => applySingleUpload(target, '', '', '', 'gallery')
const selectGallery = (item: any) => {
    const uri = item.uri || item.url || item.cover
    const preview = resolveUploadPreviewUrl(item.url || item.cover || item.uri, uri)
    if (uploadTarget.value === 'model' && mode.value === 'custom') customModels.value = [...customModels.value, { preview, url: uri, name: item.name || '', source: 'gallery' }].slice(0, maxCustomModels)
    else applySingleUpload(uploadTarget.value, uri, preview, item.name || '', 'gallery')
    showGalleryModal.value = false
    estimateInfo.value = {}
}
const removeCustomModel = (index: number) => { customModels.value.splice(index, 1); estimateInfo.value = {} }
const removeSelectedModel = (index: number) => {
    if (mode.value === 'custom') {
        removeCustomModel(index)
    } else if (mode.value === 'group') {
        selectedPresetIds.value = []
    } else {
        selectedPresetIds.value = selectedPresetIds.value.filter((_, presetIndex) => presetIndex !== index)
    }
    void updateEstimate()
}
const uploadSingleIfNeeded = async (target: UploadTarget) => {
    const map = {
        garment: { image: garmentImage, source: garmentSource, file: garmentFile, uploading: garmentUploading, name: garmentName, url: garmentImageUrl },
        top: { image: topImage, source: topSource, file: topFile, uploading: topUploading, name: topName, url: topImageUrl },
        bottom: { image: bottomImage, source: bottomSource, file: bottomFile, uploading: bottomUploading, name: bottomName, url: bottomImageUrl }
    }[target]
    if (!map || map.source.value !== 'local' || !map.file.value) return map?.image.value || ''
    map.uploading.value = true
    try {
        const res: any = await uploadImage({ file: map.file.value })
        const uri = res?.uri || res?.url || map.image.value
        applySingleUpload(target, uri, map.url.value || resolveUploadPreviewUrl(res?.url || uri, uri), map.name.value, 'gallery')
        return uri
    } finally {
        map.uploading.value = false
    }
}
const uploadCustomModelsIfNeeded = async () => {
    modelUploading.value = true
    const uploaded: UploadItem[] = []
    try {
        for (const item of customModels.value) {
            if (item.source !== 'local' || !item.file) { uploaded.push(item); continue }
            const res: any = await uploadImage({ file: item.file })
            const uri = res?.uri || res?.url || item.url
            uploaded.push({ ...item, url: uri, preview: item.preview || resolveUploadPreviewUrl(res?.url || uri, uri), source: 'gallery', file: null })
        }
        customModels.value = uploaded
        return uploaded.map((item) => item.url)
    } finally {
        modelUploading.value = false
    }
}
const buildPrompt = () => {
    const modeLabel = mode.value === 'custom' ? '自定义' : mode.value === 'group' ? '组图' : '单图'
    const clothingLabel = isSplitGarment.value ? '上装与下装' : categoryLabel(uploadCategory.value)
    return `使用${clothingLabel}生成${modeLabel}AI试衣效果。`
}
const buildPayload = (images: { garments?: string[]; models?: string[] } = {}) => ({
    mode: mode.value,
    upload_category: mapCategoryToApi(uploadCategory.value),
    garment_images: images.garments || garmentThumbs.value,
    model_images: images.models || selectedThumbs.value,
    selected_preset_ids: mode.value === 'custom' ? [] : selectedPresetIds.value,
    model_filter: modelFilter.value,
    clothes_filter: clothesFilter.value,
    pose_filter: poseFilter.value,
    prompt: buildPrompt(),
    channel: String(configJson.value.channel || ''),
    quality: String(configJson.value.quality || ''),
    ratio: String(configJson.value.ratio || ''),
    quantity: selectedThumbs.value.length || undefined,
    negative_prompt: String(config.value?.negative_prompt || '')
})
const updateEstimate = async () => {
    if (!garmentThumbs.value.length || !selectedThumbs.value.length || [garmentSource.value, topSource.value, bottomSource.value].includes('local') || customModels.value.some((item) => item.source === 'local')) {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcFitting(buildPayload(), { suppressErrorMessage: true })
    } catch {
        estimateInfo.value = {}
    }
}
const submit = async () => {
    if (!canSubmit.value || !ensurePcLogin({ redirect: route.fullPath })) return
    submitting.value = true
    try {
        const garments = isSplitGarment.value ? [await uploadSingleIfNeeded('top'), await uploadSingleIfNeeded('bottom')].filter(Boolean) : [await uploadSingleIfNeeded('garment')].filter(Boolean)
        const models = mode.value === 'custom'
            ? await uploadCustomModelsIfNeeded()
            : selectedThumbs.value
        if (!garments.length) { feedback.msgError('请上传服装图片'); return }
        if (!models.length) { feedback.msgError(mode.value === 'custom' ? '请上传模特图片' : '请选择模特示例图'); return }
        const res: any = await generateAigcFitting(buildPayload({ garments, models }), { suppressErrorMessage: true })
        if (res?.status === 'failed') { feedback.msgError(res?.error || '生成任务提交失败'); return }
        feedback.msgSuccess('任务已提交，正在生成')
        await refreshTasks({ sync: true })
        startPolling()
        void updateEstimate()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || 'AI试衣生成失败')
    } finally {
        submitting.value = false
    }
}
const editTask = (item: any) => {
    uploadCategory.value = mapCategoryToUi(String(item.upload_category || 'full'))
    mode.value = String(item.mode || 'single') as Mode
    const garments = taskGarmentUris(item)
    const garmentUrls = taskGarmentUrls(item)
    if (mapCategoryToUi(String(item.upload_category || '')) === 'set') {
        applySingleUpload('top', garments[0] || garmentUrls[0] || '', garmentUrls[0] || garments[0] || '', '上装图.png', 'gallery')
        applySingleUpload('bottom', garments[1] || garmentUrls[1] || '', garmentUrls[1] || garments[1] || '', '下装图.png', 'gallery')
    } else {
        applySingleUpload('garment', garments[0] || garmentUrls[0] || '', garmentUrls[0] || garments[0] || '', '服装图.png', 'gallery')
    }
    selectedPresetIds.value = Array.isArray(item.selected_preset_ids) ? item.selected_preset_ids.map(String) : []
    if (mode.value === 'custom') {
        const models = taskModelUris(item)
        const modelUrls = taskModelUrls(item)
        customModels.value = (models.length ? models : modelUrls).map((url: string, index: number) => ({ preview: modelUrls[index] || url, url, name: `模特图${index + 1}.png`, source: 'gallery' as UploadSource }))
    }
    modelFilter.value = String(item.model_filter || 'all')
    clothesFilter.value = String(item.clothes_filter || 'all')
    poseFilter.value = String(item.pose_filter || 'all')
}
const rerunTask = async (item: any) => { editTask(item); await submit() }
const firstResultImageUrl = (payload: any) => {
    const rows = Array.isArray(payload?.results) ? payload.results : []
    const first = rows.find((row: any) => row?.image_url || row?.url || row?.image_uri || row?.uri) || {}
    return String(first?.image_url || first?.url || first?.image_uri || first?.uri || payload?.image_url || payload?.url || '')
}
const firstResultId = (payload: any) => {
    const rows = Array.isArray(payload?.results) ? payload.results : []
    const first = rows.find((row: any) => Number(row?.id || row?.result_id || 0) > 0) || {}
    return Number(first?.id || first?.result_id || payload?.result_id || 0)
}
const fittingSubResults = (task: any) => {
    const rows = Array.isArray(task?.result_tasks) ? task.result_tasks : []
    if (!rows.length) {
        return resultUrls(task).map((url, index) => ({ key: `result-${index}-${url}`, resultId: Number((task?.results || [])[index]?.id || 0), imageTaskId: 0, status: 'success', statusText: '已完成', error: '', imageUrl: url, label: `试衣效果${index + 1}` }))
    }
    return rows.map((row: any, index: number) => {
        const status = normalizeTaskStatus(row?.status || (firstResultImageUrl(row) ? 'success' : 'failed'))
        const imageUrl = status === 'failed' ? '' : firstResultImageUrl(row)
        return { key: String(row?.id || row?.task_id || `${status}-${index}`), resultId: firstResultId(row), imageTaskId: Number(row?.task_id || row?.id || 0), status, statusText: status === 'failed' ? '生成失败' : statusText(status), error: String(row?.error || row?.error_msg || '').trim(), imageUrl, label: `试衣效果${index + 1}` }
    }).filter((item: any) => item.imageUrl || item.status === 'failed')
}
const resultUrls = (payload: any): string[] => {
    const urls: string[] = []
    const push = (value: unknown) => { const url = typeof value === 'string' ? value : ''; if (url && !urls.includes(url)) urls.push(url) }
    const walk = (item: any) => { if (!item || typeof item !== 'object') return; push(item?.image_url || item?.url || item?.image_uri || item?.uri); if (Array.isArray(item?.results)) item.results.forEach(walk) }
    if (Array.isArray(payload?.results)) payload.results.forEach(walk)
    push(payload?.image_url || payload?.url || payload?.image_uri || payload?.uri)
    return urls
}
const mapPanelTask = (item: any) => {
    const id = taskId(item) || `fitting-${item.create_time || Date.now()}`
    const status = normalizeTaskStatus(item.status)
    const subResults = fittingSubResults(item)
    const expected = Math.max(1, Number(item.quantity || subResults.length || selectedThumbs.value.length || 1))
    const items = isTaskRunning(item)
        ? Array.from({ length: expected }, (_, index) => ({ id: `${id}-running-${index}`, status, statusText: statusText(status), error: '', raw: null, deleteDisabled: true, downloadDisabled: true }))
        : subResults.length
            ? subResults.map((result: any, index: number) => ({ id: result.key, url: result.imageUrl, downloadUrl: result.imageUrl ? resolvePcDownloadUrl(result.imageUrl) : '', downloadName: result.imageUrl ? `aigc-fitting-${id}-${index + 1}.${getPcDownloadExtension(result.imageUrl, 'png')}` : '', title: result.label, status: result.status, statusText: result.statusText, error: result.error || String(item.error || ''), raw: result, deleteDisabled: deletingResultKeys.value.includes(result.key) || !(result.resultId || result.imageTaskId), downloadDisabled: !result.imageUrl }))
            : [{ id: `${id}-placeholder`, status, statusText: statusText(status), error: item.error || stateDescription(status), raw: null, deleteDisabled: true, downloadDisabled: true }]
    return {
        id,
        mode: 'multi' as const,
        badge: toolDisplayName.value,
        title: toolDisplayName.value,
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: [modeLabel(item.mode), item.quantity ? `${item.quantity}张` : categoryLabel(mapCategoryToUi(String(item.upload_category || 'full')))].filter(Boolean).join(' / '),
        prompt: '',
        error: item.error || '',
        references: fittingReferences(item),
        items,
        raw: item,
        regenerateDisabled: submitting.value,
        downloadAllDisabled: !items.some((result: any) => result.downloadUrl || result.url) || downloadingTaskIds.value.includes(id),
        deleteAllDisabled: !taskId(item) || isTaskRunning(item)
    }
}
const modeLabel = (value: string) => ({ single: '单图', group: '组图', custom: '自定义' }[String(value)] || '单图')
const normalizeStringList = (value: any): string[] => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String)
    if (typeof value !== 'string' || !value.trim()) return []
    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []
    } catch {
        return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
}
const taskGarmentUris = (item: any) => normalizeStringList(item.garment_images)
const taskModelUris = (item: any) => normalizeStringList(item.model_images)
const taskGarmentUrls = (item: any) => Array.isArray(item.garment_image_urls) ? item.garment_image_urls.filter(Boolean).map(String) : taskGarmentUris(item)
const taskModelUrls = (item: any) => Array.isArray(item.model_image_urls) ? item.model_image_urls.filter(Boolean).map(String) : taskModelUris(item)
const fittingReferences = (item: any) => {
    const garments = taskGarmentUrls(item)
    const models = taskModelUrls(item)
    return [
        ...garments.map((url: string, index: number) => ({ label: index === 0 ? '服装图' : `服装图${index + 1}`, url })),
        ...models.map((url: string, index: number) => ({ label: index === 0 ? '模特图' : `模特图${index + 1}`, url }))
    ]
}
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const normalizeTaskStatus = (status: any) => { const value = String(status || '').toLowerCase(); return ['pending', 'running', 'success', 'failed', 'partial_failed', 'partial_success', 'canceled'].includes(value) ? value : 'running' }
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', partial_failed: '部分失败', partial_success: '部分完成', canceled: '已取消' }[status] || '生成中')
const stateDescription = (status: string) => status === 'failed' ? '生成失败，请稍后重试' : 'AI 正在生成试衣效果，请稍候'
const formatTaskTime = (value: any) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const date = new Date(Number(value) * 1000)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const deleteTask = async (item: any) => { const id = taskId(item); if (!id) return; await deleteAigcFittingTask({ id }); await refreshTasks({ sync: true }) }
const deleteResult = async (task: any, result: any) => {
    if (!result?.key || !(result.resultId || result.imageTaskId)) return
    deletingResultKeys.value = [...deletingResultKeys.value, result.key]
    try {
        await deleteAigcFittingResult({ id: result.imageTaskId ? 0 : result.resultId, image_task_id: result.imageTaskId || 0 })
        await refreshTasks({ sync: true })
    } finally {
        deletingResultKeys.value = deletingResultKeys.value.filter((key) => key !== result.key)
    }
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
const handlePanelPreviewReference = (reference: any) => { if (reference?.url) { previewImage.value = reference.url; previewTitle.value = reference.label || '参考图' } }
const handlePanelPreview = (item: any, task: any) => { if (item?.url) { previewImage.value = item.url; previewTitle.value = item.title || task?.title || '生成作品' } }
const handlePanelDownloadOne = (item: any) => triggerDownload(item?.downloadUrl || '', item?.downloadName || '生成作品.png')
const handlePanelDownloadAll = (task: any) => { const raw = rawPanelTask(task); void downloadTaskResults(taskId(raw), task.items || [], `aigc-fitting-${taskId(raw)}.zip`) }
const handlePanelDeleteOne = (item: any, task: any) => deleteResult(rawPanelTask(task), rawPanelItem(item))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const startPolling = () => {
    if (pollTimer) return
    pollTimer = window.setInterval(async () => {
        await refreshTasks({ sync: true })
        if (!tasks.value.some((item) => isTaskRunning(item))) stopPolling()
    }, 5000)
}
const stopPolling = () => { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null } }

watch([garmentImage, topImage, bottomImage, mode, uploadCategory, selectedPresetIds, customModels], updateEstimate, { deep: true })
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

.fitting-page {
    height: 100%;
    min-width: calc(403px + 24px + 560px);
}

.fitting-page .product-panel__body {
    padding-bottom: 244px;
    scroll-padding-bottom: 260px;
}

.fitting-category-button {
    min-width: 104px;
    height: 42px;
}

:deep(.upload-field) {
    display: grid;
    gap: 14px;
}

:deep(.upload-card) {
    position: relative;
    display: block;
    height: 176px;
    border: 0;
    border-radius: 10px;
    background: #262626;
    color: #fff;
    overflow: hidden;
}

:deep(.upload-card:hover) {
    background: #2c2c2c;
}

:deep(.upload-card__stage) {
    position: relative;
    width: 100%;
    height: 100%;
    background: #050505;
}

:deep(.upload-card__stage img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

:deep(.upload-card__placeholder) {
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

:deep(.upload-card__icon) {
    width: 40px;
    height: 40px;
    object-fit: contain;
}

:deep(.upload-card strong) {
    color: #b8b8b8;
    font-size: 14px;
    font-weight: 500;
}

:deep(.upload-card small) {
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
}

:deep(.upload-card__library),
:deep(.upload-card__action) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
}

:deep(.upload-card__actions) {
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

:deep(.upload-card.is-filled:hover .upload-card__actions) {
    opacity: 1;
    pointer-events: auto;
}

:deep(.tool-select-dropdown) {
    position: relative;
}

:deep(.tool-select-card--button) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 54px;
    padding: 0 16px;
    border: 1px solid #222;
    border-radius: 10px;
    background: #171717;
    color: #fff;
    cursor: pointer;
}

:deep(.tool-select-card__value) {
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-size: 13px;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:deep(.tool-select-card--button img) {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
}

:deep(.tool-select-card--button img.is-open) {
    transform: rotate(180deg);
}

:deep(.tool-filter-menu) {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-height: 332px;
    padding: 10px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    background: #171717;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

:deep(.tool-filter-menu button) {
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

:deep(.tool-filter-menu button:hover),
:deep(.tool-filter-menu button.is-active) {
    background: #252525;
}

.split-upload-grid,
.filter-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.split-upload-grid > *,
.filter-grid > * {
    min-width: 0;
}

.filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mode-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 8px;
    border: 1px solid #222;
    border-radius: 14px;
    background: #111;
}

.mode-tabs button {
    height: 48px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    font-weight: 600;
}

.mode-tabs button.is-active {
    background: #fff;
    color: #111;
}

.preset-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 132px;
    gap: 10px;
    max-height: 330px;
    align-items: start;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 2px;
}

.preset-grid button {
    position: relative;
    display: block;
    width: 100%;
    height: 132px;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 10px;
    background: #171717;
    box-sizing: border-box;
}

.preset-grid button.is-active {
    border-color: #fff;
}

.preset-grid img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.preset-grid span {
    position: absolute;
    right: 8px;
    bottom: 8px;
    padding: 3px 6px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.68);
    color: #fff;
    font-size: 11px;
}

.custom-model-uploader {
    min-height: 160px;
}

.selected-models {
    width: 100%;
    padding: 12px;
    border: 1px solid #222;
    border-radius: 12px;
    background: #111;
    box-sizing: border-box;
}

.selected-models__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
}

.selected-models__head strong {
    font-size: 14px;
}

.selected-models__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
}

.selected-model {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border: 1px dashed #333;
    border-radius: 10px;
    background: #222;
}

.selected-model img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.submit-bar .selected-model .selected-model__remove {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    line-height: 1;
}

.submit-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
}

.submit-bar__main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
}

.submit-bar__main > div {
    display: grid;
    gap: 6px;
}

.submit-bar__main button {
    flex: 0 0 auto;
}

.empty-hint {
    padding: 20px;
    border: 1px solid #222;
    border-radius: 12px;
    background: #111;
    color: rgba(255, 255, 255, 0.52);
    text-align: center;
}

@media (max-width: 1200px) {
    .fitting-page {
        min-width: 0;
    }
}
</style>
