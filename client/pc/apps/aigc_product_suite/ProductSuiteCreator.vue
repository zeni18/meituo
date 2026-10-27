<template>
    <div class="product-suite-page" @click="closeSelectMenu">
        <section class="product-workspace">
            <div class="product-panel product-panel--form">
                <header class="product-head">
                    <button class="product-head__back" type="button" @click="goBackToSource"><span class="product-head__back-icon" aria-hidden="true"></span><span>返回</span></button>
                    <div class="product-head__title"><h1>{{ toolDisplayName }}</h1></div>
                    <span class="product-head__spacer" aria-hidden="true"></span>
                </header>

                <div class="product-panel__body">
                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">上传商品图</label>
                            <button v-if="productImages.length" type="button" class="ghost-button" @click="clearUploads">清空</button>
                        </div>
                        <div class="upload-card product-suite-upload" :class="{ 'is-uploading': uploading }">
                            <div class="upload-card__placeholder" @click="triggerUpload">
                                <img class="upload-card__icon" :src="addIcon" alt="" />
                                <strong>本地上传</strong>
                                <small>最多 {{ maxProductImages }} 张，支持 png、jpg、jpeg、webp</small>
                                <button class="upload-card__library" type="button" @click.stop="openGallery">图库上传</button>
                            </div>
                            <span v-if="uploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                        <div v-if="productImages.length" class="product-suite-upload-list">
                            <div class="product-suite-upload-list__head">
                                <span>已上传({{ productImages.length }}/{{ maxProductImages }})</span>
                            </div>
                            <div class="product-suite-upload-grid">
                                <article v-for="(item, index) in productImages" :key="`${item.uri}-${index}`" class="product-suite-upload-item">
                                    <img :src="item.preview || item.uri" :alt="item.name || `商品图${index + 1}`" />
                                    <span>{{ index === 0 ? '主图' : `商品图${index + 1}` }}</span>
                                    <button type="button" aria-label="移除图片" @click.stop="removeUpload(index)">×</button>
                                </article>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-grid field-grid--two">
                            <div class="select-field" @click.stop>
                                <span>平台</span>
                                <button type="button" class="select-trigger" :class="{ 'is-open': openSelectKey === 'platform' }" @click="toggleSelect('platform')">
                                    <span>{{ optionLabel(platformOptions, platform) }}</span><i aria-hidden="true"></i>
                                </button>
                                <div v-if="openSelectKey === 'platform'" class="select-menu">
                                    <button v-for="item in platformOptions" :key="item.value" type="button" :class="{ 'is-active': platform === item.value }" @click="chooseSelect('platform', item.value)">
                                        <span>{{ item.label }}</span><i aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="select-field" @click.stop>
                                <span>国家/地区</span>
                                <button type="button" class="select-trigger" :class="{ 'is-open': openSelectKey === 'country' }" @click="toggleSelect('country')">
                                    <span>{{ optionLabel(countryOptions, country) }}</span><i aria-hidden="true"></i>
                                </button>
                                <div v-if="openSelectKey === 'country'" class="select-menu">
                                    <button v-for="item in countryOptions" :key="item.value" type="button" :class="{ 'is-active': country === item.value }" @click="chooseSelect('country', item.value)">
                                        <span>{{ item.label }}</span><i aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="select-field" @click.stop>
                                <span>语言</span>
                                <button type="button" class="select-trigger" :class="{ 'is-open': openSelectKey === 'language' }" @click="toggleSelect('language')">
                                    <span>{{ optionLabel(languageOptions, language) }}</span><i aria-hidden="true"></i>
                                </button>
                                <div v-if="openSelectKey === 'language'" class="select-menu">
                                    <button v-for="item in languageOptions" :key="item.value" type="button" :class="{ 'is-active': language === item.value }" @click="chooseSelect('language', item.value)">
                                        <span>{{ item.label }}</span><i aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="select-field" @click.stop>
                                <span>出图比例</span>
                                <button type="button" class="select-trigger" :class="{ 'is-open': openSelectKey === 'ratio' }" :disabled="!ratioOptions.length" @click="toggleSelect('ratio')">
                                    <span>{{ optionLabel(ratioOptions, ratio) }}</span><i aria-hidden="true"></i>
                                </button>
                                <div v-if="openSelectKey === 'ratio'" class="select-menu">
                                    <button v-for="item in ratioOptions" :key="item.value" type="button" :class="{ 'is-active': ratio === item.value }" @click="chooseSelect('ratio', item.value)">
                                        <span>{{ item.label }}</span><i aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">核心卖点</label>
                            <button type="button" class="ghost-button" :disabled="promptOptimizing || !prompt.trim()" @click="optimizePrompt">{{ promptOptimizing ? '优化中' : 'AI优化' }}</button>
                        </div>
                        <textarea v-model="prompt" class="prompt-input" rows="5" maxlength="1000" placeholder="请输入商品卖点、材质亮点、使用场景和你希望重点展示的转化信息"></textarea>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">套图模块</label>
                            <span class="field-count">{{ selectedModuleCodes.length }}/{{ enabledModules.length }}</span>
                        </div>
                        <div class="module-grid">
                            <button v-for="item in enabledModules" :key="item.code" class="module-card" :class="{ 'is-active': selectedModuleCodes.includes(item.code) }" type="button" @click="toggleModule(item.code)">
                                <span class="module-card__head"><strong>{{ item.name }}</strong><i aria-hidden="true"></i></span>
                                <span class="module-card__cover">
                                    <img v-if="moduleCover(item)" :src="moduleCover(item)" :alt="item.name" />
                                    <em v-else>未配置封面</em>
                                </span>
                                <span class="module-card__desc">{{ item.description || '套图生成模块' }}</span>
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

        <input ref="fileInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="handleUpload" />
        <AiWorkspaceAssetGalleryModal :visible="showGalleryModal" :accept-types="['image']" title="图库上传" description="选择资产图片作为商品图，最多 3 张" @close="showGalleryModal = false" @select="selectGallery" />
        <Teleport to="body"><div v-if="previewImage" class="media-preview" @click.self="closePreview"><PcCloseButton class="media-preview__close" aria-label="关闭预览" @click="closePreview" /><img :src="previewImage" :alt="previewTitle || '生成作品'" /><span>{{ previewTitle || '生成作品' }}</span></div></Teleport>
    </div>
</template>

<script setup lang="ts">
import addIcon from '@/assets/images/icon/Add.svg'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { uploadImage } from '@/api/app'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'
import feedback from '@/utils/feedback'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import { deleteAigcProductSuiteResult, deleteAigcProductSuiteTask, estimateAigcProductSuite, generateAigcProductSuite, getAigcProductSuiteConfig, getAigcProductSuiteModules, getAigcProductSuiteTasks, optimizeAigcProductSuitePrompt } from './api'

type UploadSource = 'gallery' | 'local'
type UploadItem = { uri: string; preview: string; name: string; source: UploadSource; file?: File | null }
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'partial_failed' | 'failed'
type SelectKey = 'platform' | 'country' | 'language' | 'ratio'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, 'AI商品套图'))
const modules = ref<any[]>([])
const tasks = ref<any[]>([])
const estimateInfo = ref<any>({})
const productImages = ref<UploadItem[]>([])
const platform = ref('amazon')
const country = ref('us')
const language = ref('en')
const ratio = ref('')
const prompt = ref('')
const selectedModuleCodes = ref<string[]>([])
const uploading = ref(false)
const submitting = ref(false)
const promptOptimizing = ref(false)
const taskLoading = ref(false)
const showGalleryModal = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const openSelectKey = ref<SelectKey | ''>('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const deletingResultIds = ref<number[]>([])
const replaceUploadOnNextPick = ref(false)
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_product_suite')
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const blobUrls: string[] = []
const maxProductImages = 3

const platformOptions = computed(() => config.value?.platforms?.length ? config.value.platforms : [{ value: 'amazon', label: 'Amazon' }])
const countryOptions = computed(() => config.value?.countries?.length ? config.value.countries : [{ value: 'us', label: '美国' }])
const languageOptions = computed(() => config.value?.languages?.length ? config.value.languages : [{ value: 'en', label: '英文' }])
const enabledModules = computed(() => modules.value.filter((item) => Number(item.status ?? 1) === 1))
const ratioDisplayLabel = (item: any) => {
    const value = String(item?.value || '')
    const label = String(item?.label || '')
    const text = label || (value === 'default' ? '默认比例' : value)
    return item?.width && item?.height ? `${text} (${item.width}×${item.height})` : text
}
const ratioOptions = computed(() => {
    const items: any[] = []
    for (const channel of config.value?.spec_options || []) {
        for (const quality of channel.qualities || []) {
            for (const item of quality.ratios || []) {
                if (!item.value || items.some((row) => row.value === item.value)) continue
                items.push({ value: item.value, label: ratioDisplayLabel(item) })
            }
        }
    }
    return items
})
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? Number(config.value?.unit_price || 0) * selectedModuleCodes.value.length).toFixed(2))
const canSubmit = computed(() => productImages.value.length > 0 && selectedModuleCodes.value.length > 0 && !!prompt.value.trim() && !!ratio.value && !uploading.value && !submitting.value)
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' }, { label: '排队中', value: 'pending' }, { label: '生成中', value: 'running' }, { label: '成功', value: 'success' }, { label: '部分失败', value: 'partial_failed' }, { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')

const optionLabel = (options: any[], value: string) => options.find((item) => String(item.value) === String(value))?.label || value || '请选择'
const closeSelectMenu = () => { openSelectKey.value = '' }
const toggleSelect = (key: SelectKey) => { openSelectKey.value = openSelectKey.value === key ? '' : key }
const chooseSelect = (key: SelectKey, value: string) => {
    if (key === 'platform') platform.value = value
    if (key === 'country') country.value = value
    if (key === 'language') language.value = value
    if (key === 'ratio') ratio.value = value
    closeSelectMenu()
}

const panelTasks = computed(() => tasks.value.map((item: any) => {
    const status = normalizeTaskStatus(item.status)
    const id = taskId(item) || item.id || `product-suite-${item.create_time || Date.now()}`
    const slots = taskResultSlots(item)
    return {
        id,
        mode: 'multi' as const,
        badge: toolDisplayName.value,
        title: taskTitle(item),
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: item.size_label || taskSizeLabel(item),
        prompt: taskPrompt(item),
        references: taskSourceImages(item).map((url: string, index: number) => ({ label: index === 0 ? '主图' : `商品图${index + 1}`, url })),
        items: slots.map((slot: any, index: number) => {
            const result = slot.result
            const image = result ? resultImageUrl(result) : ''
            const downloadUrl = result ? resultDownloadHref(result) : ''
            return {
                id: slot.key || `${id}-item-${index}`,
                url: image,
                downloadUrl,
                downloadName: result ? resultDownloadName(result, index) : '',
                status: slot.running ? 'running' : (result ? 'success' : status),
                statusText: slot.running ? statusText(status) : slot.label || statusText(result ? 'success' : status),
                error: slot.description || item.error || taskStateDescription(item),
                raw: result || slot,
                deleteDisabled: result ? isDeletingResult(result) : true,
                downloadDisabled: !downloadUrl,
                deleteLabel: result && isDeletingResult(result) ? '删除中' : '删除'
            }
        }),
        raw: item,
        regenerateDisabled: submitting.value,
        downloadAllDisabled: !taskResults(item).length || downloadingTaskIds.value.includes(taskId(item)),
        deleteAllDisabled: !taskId(item) || isTaskRunning(item)
    }
}))

const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) return fallback
    return resolved
}
const goBackToSource = () => window.history.length > 1 ? router.back() : router.push('/ai/tools')
const triggerUpload = (replace = false) => { replaceUploadOnNextPick.value = replace; fileInputRef.value?.click() }
const openGallery = () => { showGalleryModal.value = true }
const clearUploads = () => { productImages.value = []; estimateInfo.value = {} }
const removeUpload = (index: number) => { productImages.value = productImages.value.filter((_, i) => i !== index); estimateInfo.value = {} }
const appendUploads = (items: UploadItem[], replace = false) => { productImages.value = replace ? items.slice(0, maxProductImages) : [...productImages.value, ...items].slice(0, maxProductImages) }
const handleUpload = (event: Event) => {
    const files = Array.from((event.target as HTMLInputElement).files || [])
    if (!files.length) return
    const replace = replaceUploadOnNextPick.value
    const limit = replace ? maxProductImages : Math.max(0, maxProductImages - productImages.value.length)
    const next = files.slice(0, limit).map((file) => {
        const objectUrl = URL.createObjectURL(file); blobUrls.push(objectUrl)
        return { uri: objectUrl, preview: objectUrl, name: file.name, source: 'local' as UploadSource, file }
    })
    appendUploads(next, replace); replaceUploadOnNextPick.value = false; (event.target as HTMLInputElement).value = ''
}
const selectGallery = (items: any[] | any) => {
    const list = Array.isArray(items) ? items : [items]
    appendUploads(list.map((item: any) => {
        const uri = item?.uri || item?.url || item?.cover || item?.image || ''
        return { uri, preview: resolveUploadPreviewUrl(item?.url || item?.cover_url || item?.cover || uri, uri), name: item?.name || '', source: 'gallery' as UploadSource }
    }).filter((item) => item.uri))
    showGalleryModal.value = false
}
const uploadLocalImagesIfNeeded = async () => {
    uploading.value = true
    const uploaded: UploadItem[] = []
    try {
        for (const item of productImages.value) {
            if (item.source !== 'local' || !item.file) { uploaded.push(item); continue }
            const res: any = await uploadImage({ file: item.file })
            const uri = res?.uri || res?.url || item.uri
            uploaded.push({ ...item, uri, preview: item.preview || resolveUploadPreviewUrl(res?.url || uri, uri), source: 'gallery', file: null })
        }
        productImages.value = uploaded
        return uploaded.map((item) => item.uri)
    } finally { uploading.value = false }
}
const buildPayload = (uris = productImages.value.map((item) => item.uri)) => ({ product_images: uris, platform: platform.value, country: country.value, language: language.value, ratio: ratio.value, module_codes: selectedModuleCodes.value, prompt: prompt.value.trim() })
const updateEstimate = async () => {
    if (!productImages.value.length || productImages.value.some((item) => item.source === 'local') || !selectedModuleCodes.value.length || !ratio.value) { estimateInfo.value = {}; return }
    try { estimateInfo.value = await estimateAigcProductSuite(buildPayload(), { suppressErrorMessage: true, ignoreCancelToken: true }) } catch { estimateInfo.value = {} }
}
const optimizePrompt = async () => { if (!prompt.value.trim()) return; promptOptimizing.value = true; try { const res: any = await optimizeAigcProductSuitePrompt({ prompt: prompt.value, platform: platform.value, country: country.value, language: language.value }, { ignoreCancelToken: true }); if (res?.prompt) prompt.value = res.prompt } finally { promptOptimizing.value = false } }
const submit = async () => { if (!canSubmit.value) return; submitting.value = true; try { const uris = await uploadLocalImagesIfNeeded(); const res: any = await generateAigcProductSuite(buildPayload(uris), { ignoreCancelToken: true }); estimateInfo.value = res?.estimate || {}; await refreshTasks(); startPolling() } finally { submitting.value = false } }
const refreshTasks = async () => { taskLoading.value = true; try { const res: any = await getAigcProductSuiteTasks({ page_no: 1, page_size: 20, status: activeTaskStatusFilter.value }); tasks.value = Array.isArray(res?.lists) ? res.lists : [] } finally { taskLoading.value = false } }
const loadConfig = async () => {
    config.value = await getAigcProductSuiteConfig()
    modules.value = await getAigcProductSuiteModules()
    platform.value = config.value?.default_platform || config.value?.config_json?.platform || platform.value
    country.value = config.value?.default_country || config.value?.config_json?.country || country.value
    language.value = config.value?.default_language || config.value?.config_json?.language || language.value
    ratio.value = config.value?.default_ratio || config.value?.config_json?.ratio || ratioOptions.value[0]?.value || ''
    selectedModuleCodes.value = enabledModules.value.slice(0, 6).map((item) => item.code)
}
const selectTaskStatus = async (status: TaskStatusFilter) => { activeTaskStatusFilter.value = status; await refreshTasks() }
const toggleModule = (code: string) => selectedModuleCodes.value.includes(code) ? selectedModuleCodes.value = selectedModuleCodes.value.filter((item) => item !== code) : selectedModuleCodes.value.push(code)
const normalizeTaskStatus = (status: any) => { const value = String(status || '').toLowerCase(); return ['pending', 'running', 'success', 'failed', 'partial_failed', 'canceled'].includes(value) ? value : 'running' }
const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', partial_failed: '部分失败', canceled: '已取消' }[status] || '生成中')
const moduleCover = (item: any) => resolveUploadPreviewUrl(item?.cover_url || item?.cover_image || '')
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskTitle = (item: any) => `${toolDisplayName.value} ${Number(item?.quantity || item?.module_names?.length || 1)}张`
const taskPrompt = (item: any) => [item.platform_label, item.country_label, item.language_label, Array.isArray(item.module_names) ? `模块：${item.module_names.join('、')}` : '', item.user_prompt].filter(Boolean).join(' · ') || 'AI商品套图'
const taskStateDescription = (item: any) => normalizeTaskStatus(item?.status) === 'failed' ? '生成失败，请稍后重试' : 'AI 正在生成套图图片，请稍候'
const taskSourceImages = (item: any) => Array.isArray(item?.product_image_urls) ? item.product_image_urls : (Array.isArray(item?.source_image_urls) ? item.source_image_urls : [])
const taskSizeLabel = (item: any) => item.size_label || (Number(item.width || 0) > 0 && Number(item.height || 0) > 0 ? `${item.width}×${item.height}` : '')
const resultImageUrl = (entry: any) => String(entry?.image_url || entry?.url || entry?.image || '').trim()
const taskResults = (item: any) => Array.isArray(item.results) ? item.results.filter((entry: any) => resultImageUrl(entry)).sort((a: any, b: any) => Number(a?.id || 0) - Number(b?.id || 0)) : []
const taskExpectedResultCount = (item: any) => Math.max(1, Number(item?.quantity || item?.module_codes?.length || item?.module_names?.length || taskResults(item).length || 1))
const taskResultSlots = (item: any) => {
    const results = taskResults(item)
    const status = normalizeTaskStatus(item?.status)
    const expectedCount = Math.max(taskExpectedResultCount(item), results.length, 1)
    const moduleCodes = Array.isArray(item?.module_codes) ? item.module_codes : []
    const byIndex = new Map<number, any>()
    const rest: any[] = []
    results.forEach((result: any, index: number) => { const i = moduleCodes.findIndex((code: any) => String(code) === String(result?.module_code || '')); if (i >= 0 && i < expectedCount && !byIndex.has(i)) byIndex.set(i, result); else if (!byIndex.has(index) && index < expectedCount) byIndex.set(index, result); else rest.push(result) })
    if (isTaskRunning(item)) return Array.from({ length: expectedCount }, (_, index) => ({ key: `running-${taskId(item)}-${index}`, result: null, running: true }))
    if (!['success', 'partial_failed', 'failed', 'canceled'].includes(status)) return []
    return Array.from({ length: expectedCount }, (_, index) => {
        const result = byIndex.get(index) || rest.shift()
        return result ? { key: `result-${result.id || resultImageUrl(result) || index}`, result, running: false } : { key: `failed-${taskId(item)}-${index}`, result: null, running: false, label: status === 'canceled' ? '已取消' : '生成失败', description: item.error || '任务处理失败，请稍后重试' }
    })
}
const resultDownloadHref = (result: any) => resolvePcDownloadUrl(result?.download_url || resultImageUrl(result) || '')
const resultDownloadName = (result: any, index = 0) => `product-suite-${result?.module_code || result?.id || Date.now()}-${index + 1}.${getPcDownloadExtension(resultDownloadHref(result), 'png')}`
const isMultiImageTask = (item: any) => taskExpectedResultCount(item) > 1 || taskResults(item).length > 1
const resultId = (result: any) => Number(result?.id || result?.result_id || 0)
const isDeletingResult = (result: any) => deletingResultIds.value.includes(resultId(result))
const formatTaskTime = (value: any) => { if (!value) return ''; if (typeof value === 'string') return value; const d = new Date(Number(value) * 1000); if (Number.isNaN(d.getTime())) return String(value); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }
const editTask = (item: any) => { productImages.value = (Array.isArray(item.product_images) ? item.product_images : []).map((uri: string, index: number) => ({ uri, preview: taskSourceImages(item)[index] || uri, name: index === 0 ? '主图' : `商品图${index + 1}`, source: 'gallery' })); platform.value = item.platform || platform.value; country.value = item.country || country.value; language.value = item.language || language.value; ratio.value = item.ratio || ratio.value; selectedModuleCodes.value = Array.isArray(item.module_codes) ? item.module_codes : selectedModuleCodes.value; prompt.value = item.user_prompt || '' }
const deleteTask = async (item: any) => { const id = taskId(item); if (!id) return; await deleteAigcProductSuiteTask({ id }); await refreshTasks() }
const deleteSingleResult = async (result: any) => { const id = resultId(result); if (!id || deletingResultIds.value.includes(id)) return; deletingResultIds.value = [...deletingResultIds.value, id]; try { await deleteAigcProductSuiteResult({ id }); await refreshTasks() } finally { deletingResultIds.value = deletingResultIds.value.filter((item) => item !== id) } }
const deleteResultOrTask = async (result: any, item: any) => isMultiImageTask(item) ? deleteSingleResult(result) : deleteTask(item)
const downloadAllResults = async (item: any, panelItems: any[] = []) => { const id = taskId(item); if (!id) return; await downloadTaskResults(id, panelItems, `product-suite-${id}.zip`) }
const triggerDownload = (href: string, filename: string) => { if (!href) return; const link = document.createElement('a'); link.href = href; link.download = filename; link.target = '_blank'; link.rel = 'noopener noreferrer'; document.body.appendChild(link); link.click(); link.remove() }
const rawPanelTask = (task: any) => task?.raw || task
const rawPanelItem = (item: any) => item?.raw || item
const handlePanelEdit = (task: any) => editTask(rawPanelTask(task))
const handlePanelRegenerate = async (task: any) => { editTask(rawPanelTask(task)); await submit() }
const handlePanelPreviewReference = (reference: any, task: any) => { if (!reference?.url) return; previewImage.value = reference.url; previewTitle.value = `${task?.title || toolDisplayName.value} ${reference.label || '商品图'}` }
const handlePanelPreview = (item: any, task: any) => { if (!item?.url) return; previewImage.value = item.url; previewTitle.value = task?.title || '生成作品' }
const handlePanelDownloadOne = (item: any) => triggerDownload(item?.downloadUrl || '', item?.downloadName || '生成作品.png')
const handlePanelDownloadAll = (task: any) => downloadAllResults(rawPanelTask(task), task.items || [])
const handlePanelDeleteOne = (item: any, task: any) => deleteResultOrTask(rawPanelItem(item), rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const startPolling = () => { stopPolling(); if (!tasks.value.some(isTaskRunning)) return; pollTimer = window.setInterval(async () => { await refreshTasks(); if (!tasks.value.some(isTaskRunning)) stopPolling() }, 5000) }
const stopPolling = () => { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null } }

watch([productImages, selectedModuleCodes, ratio], updateEstimate, { deep: true })
onMounted(async () => { await loadConfig(); await refreshTasks(); startPolling() })
onUnmounted(() => { stopPolling(); blobUrls.forEach((url) => URL.revokeObjectURL(url)) })
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;
.product-suite-page { height: 100%; min-width: calc(403px + 24px + 560px); }
.field-count { color: rgba(255,255,255,.42); font-size: 13px; }
.product-suite-upload { height: 176px; min-height: 176px; border-radius: 12px; }
.product-suite-upload .upload-card__placeholder { gap: 10px; }
.upload-card__placeholder small { color: rgba(255,255,255,.42); font-size: 12px; line-height: 18px; }
.product-suite-upload-list { display: flex; flex-direction: column; gap: 12px; padding-top: 14px; }
.product-suite-upload-list__head { display: flex; align-items: center; justify-content: space-between; min-height: 20px; color: rgba(255,255,255,.62); font-size: 13px; line-height: 20px; }
.product-suite-upload-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; width: 100%; }
.product-suite-upload-item { position: relative; aspect-ratio: 1 / 1; min-width: 0; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #050505; overflow: hidden; }
.product-suite-upload-item img { display: block; width: 100%; height: 100%; object-fit: cover; }
.product-suite-upload-item span { position: absolute; left: 7px; bottom: 7px; max-width: calc(100% - 14px); height: 22px; padding: 0 8px; border-radius: 7px; background: rgba(0,0,0,.58); color: #fff; font-size: 12px; line-height: 22px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-suite-upload-item button { position: absolute; right: 6px; top: 6px; display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 50%; background: rgba(0,0,0,.68); color: #fff; cursor: pointer; line-height: 1; }
.product-suite-upload-item button:hover { background: rgba(255,255,255,.18); }
.field-grid { display: grid; gap: 12px; }
.field-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.select-field { position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; color: rgba(255,255,255,.62); font-size: 13px; }
.select-trigger { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; height: 42px; min-width: 0; padding: 0 12px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #171717; color: #fff; cursor: pointer; outline: none; transition: border-color .18s ease, background .18s ease; }
.select-trigger:hover,
.select-trigger.is-open { border-color: rgba(255,255,255,.18); background: #1f1f1f; }
.select-trigger:disabled { cursor: not-allowed; opacity: .55; }
.select-trigger span { min-width: 0; overflow: hidden; font-size: 13px; line-height: 20px; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.select-trigger i { position: relative; flex: 0 0 auto; width: 14px; height: 14px; transition: transform .18s ease; }
.select-trigger i::after { content: ''; position: absolute; left: 3px; top: 2px; width: 7px; height: 7px; border-right: 1.5px solid rgba(255,255,255,.58); border-bottom: 1.5px solid rgba(255,255,255,.58); transform: rotate(45deg); }
.select-trigger.is-open i { transform: rotate(180deg); }
.select-menu { position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 50; display: flex; flex-direction: column; gap: 6px; max-height: 236px; padding: 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #171717; box-shadow: 0 18px 42px rgba(0,0,0,.42); overflow-y: auto; scrollbar-width: thin; scrollbar-color: #343434 transparent; }
.select-menu::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
.select-menu::-webkit-scrollbar-track { background: transparent; }
.select-menu::-webkit-scrollbar-thumb { border-radius: 999px; background: #343434; }
.select-menu button { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 36px; width: 100%; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: rgba(255,255,255,.82); cursor: pointer; text-align: left; }
.select-menu button:hover,
.select-menu button.is-active { background: #252525; color: #fff; }
.select-menu button span { min-width: 0; overflow: hidden; font-size: 13px; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.select-menu button i { position: relative; flex: 0 0 auto; width: 16px; height: 16px; opacity: 0; }
.select-menu button.is-active i { opacity: 1; }
.select-menu button.is-active i::after { content: ''; position: absolute; left: 5px; top: 2px; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.module-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.module-card { display: flex; flex-direction: column; gap: 8px; min-height: 150px; min-width: 0; padding: 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #171717; color: #fff; text-align: left; cursor: pointer; transition: background .18s ease, border-color .18s ease, box-shadow .18s ease; }
.module-card:hover { border-color: rgba(255,255,255,.14); background: #1f1f1f; }
.module-card__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
.module-card__head strong { min-width: 0; overflow: hidden; font-size: 14px; font-weight: 600; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.module-card__head i { position: relative; flex: 0 0 auto; width: 22px; height: 22px; border: 1px solid rgba(255,255,255,.16); border-radius: 7px; background: #242424; }
.module-card__head i::after { content: ''; position: absolute; left: 7px; top: 4px; width: 6px; height: 10px; border: solid transparent; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.module-card__cover { display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 16 / 9; border-radius: 10px; background: #0f0f0f; color: rgba(255,255,255,.35); font-size: 12px; overflow: hidden; }
.module-card__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.module-card__cover em { font-style: normal; }
.module-card__desc { display: -webkit-box; min-height: 36px; overflow: hidden; color: rgba(255,255,255,.46); font-size: 12px; line-height: 18px; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.module-card.is-active { border-color: rgba(255,255,255,.9); background: #202020; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
.module-card.is-active .module-card__head i { border-color: #fff; background: #fff; }
.module-card.is-active .module-card__head i::after { border-color: #111; }
.prompt-input { width: 100%; min-height: 122px; resize: vertical; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #171717; color: #fff; font-size: 14px; line-height: 22px; outline: none; padding: 12px; }
.prompt-input::placeholder { color: rgba(255,255,255,.38); }
.prompt-input:focus { border-color: rgba(255,255,255,.2); background: #1b1b1b; }
.media-preview { position: fixed; inset: 0; z-index: 3000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(0,0,0,.82); backdrop-filter: blur(8px); }
.media-preview img { max-width: min(86vw, 980px); max-height: 78vh; border-radius: 16px; object-fit: contain; }
.media-preview span { color: rgba(255,255,255,.72); font-size: 14px; }
.media-preview__close { position: fixed; top: 28px; right: 32px; }
@media (max-width: 1200px) { .product-suite-page { min-width: 0; } .field-grid--two { grid-template-columns: 1fr; } }
</style>
