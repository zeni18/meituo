<template>
    <div class="one-click-cleanup-page">
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
                            <label class="field-label">上传主体图</label>
                            <button v-if="sourceImages.length" type="button" class="ghost-button" @click="clearUpload">清空</button>
                        </div>
                        <div class="upload-card cleanup-upload-card" :class="{ 'is-uploading': sourceUploading }">
                            <div class="upload-card__placeholder" @click="triggerUpload">
                                <img class="upload-card__icon" :src="addIcon" alt="" />
                                <strong>本地上传</strong>
                                <small>最多 {{ maxImages }} 张，支持 png、jpg、jpeg、webp</small>
                                <button class="upload-card__library" type="button" @click.stop="openGallery">图库上传</button>
                            </div>
                            <span v-if="sourceUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                        <div v-if="sourceImages.length" class="cleanup-upload-list">
                            <div class="cleanup-upload-list__head">
                                <span>已上传({{ sourceImages.length }}/{{ maxImages }})</span>
                            </div>
                            <div class="cleanup-upload-grid">
                                <article v-for="(item, index) in sourceImages" :key="`${item.uri}-${index}`" class="cleanup-upload-item">
                                    <img :src="item.preview || item.uri" :alt="item.name || `主体图${index + 1}`" />
                                    <button type="button" aria-label="移除图片" @click.stop="removeUpload(index)">×</button>
                                </article>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">消除选项</label>
                            <span class="field-count">{{ selectedOptionCodes.length }}/{{ enabledOptions.length }}</span>
                        </div>
                        <div class="cleanup-option-grid">
                            <button v-for="item in enabledOptions" :key="item.code" class="cleanup-option-card" :class="{ 'is-active': selectedOptionCodes.includes(item.code) }" type="button" @click="toggleOption(item.code)">
                                <span class="cleanup-option-card__head">
                                    <strong>{{ item.name }}</strong>
                                    <i aria-hidden="true"></i>
                                </span>
                                <span class="cleanup-option-card__media">
                                    <img v-if="optionCover(item)" :src="optionCover(item)" :alt="item.name" />
                                    <em v-else>未配置封面</em>
                                </span>
                            </button>
                        </div>
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

        <input ref="sourceInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="handleUpload" />
        <AiWorkspaceAssetGalleryModal :visible="showGalleryModal" :accept-types="['image']" title="图库上传" description="选择资产图片作为主体图" @close="showGalleryModal = false" @select="selectGallery" />
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
import { PRODUCT_IMAGE_EMPTY_IMAGE } from '@/constants/workspace-assets'
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import downIcon from '@/assets/images/icon/Down.svg'
import deleteIcon from '@/assets/images/icon/Delete-themes.svg'
import downloadIcon from '@/assets/images/icon/xiazai.svg'
import editIcon from '@/assets/images/icon/bianji.svg'
import regenerateIcon from '@/assets/images/icon/zaici.svg'
import { deleteAigcOneClickCleanupResult, deleteAigcOneClickCleanupTask, estimateAigcOneClickCleanup, generateAigcOneClickCleanup, getAigcOneClickCleanupConfig, getAigcOneClickCleanupOptions, getAigcOneClickCleanupTasks } from './api'

type UploadSource = 'gallery' | 'local'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed' | 'partial_failed'
type UploadItem = { uri: string; preview: string; name: string; source: UploadSource; file?: File | null }

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const emptyImage = PRODUCT_IMAGE_EMPTY_IMAGE
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '一键消除'))
const options = ref<any[]>([])
const tasks = ref<any[]>([])
const estimateInfo = ref<any>({})
const sourceImages = ref<UploadItem[]>([])
const sourceUploading = ref(false)
const taskLoading = ref(false)
const submitting = ref(false)
const showGalleryModal = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const taskStatusMenuOpen = ref(false)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const selectedOptionCodes = ref<string[]>([])
const sourceInputRef = ref<HTMLInputElement | null>(null)
const deletingResultIds = ref<number[]>([])
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_one_click_cleanup')
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const uploadBlobUrls: string[] = []

const maxImages = computed(() => Number(config.value?.max_images || 10))
const enabledOptions = computed(() => options.value.filter((item) => Number(item.status ?? 1) === 1))
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? (Number(config.value?.unit_price || 0) * sourceImages.value.length)).toFixed(2))
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [
    { label: '全部', value: '' }, { label: '排队中', value: 'pending' }, { label: '生成中', value: 'running' }, { label: '成功', value: 'success' }, { label: '部分失败', value: 'partial_failed' }, { label: '失败', value: 'failed' }
]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const canSubmit = computed(() => sourceImages.value.length > 0 && selectedOptionCodes.value.length > 0 && !submitting.value && !sourceUploading.value)
const panelTasks = computed(() => tasks.value.map((item: any) => {
    const status = normalizeTaskStatus(item.status)
    const id = taskId(item) || item.id || item.task_id || `cleanup-${item.create_time || Date.now()}`
    const slots = taskResultSlots(item)
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
        references: taskSourceImages(item).map((url: string, index: number) => ({ label: `原图${index + 1}`, url })),
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
const loadConfig = async () => { config.value = await getAigcOneClickCleanupConfig(); options.value = await getAigcOneClickCleanupOptions(); selectedOptionCodes.value = enabledOptions.value.slice(0, 1).map((item) => item.code) }
const closeDropdowns = () => { taskStatusMenuOpen.value = false }
const selectTaskStatus = async (status: TaskStatusFilter) => { activeTaskStatusFilter.value = status; taskStatusMenuOpen.value = false; await refreshTasks() }
const triggerUpload = () => sourceInputRef.value?.click()
const openGallery = () => { showGalleryModal.value = true }

const appendUploads = (items: UploadItem[]) => {
    const merged = [...sourceImages.value, ...items]
    sourceImages.value = merged.slice(0, maxImages.value)
}
const handleUpload = async (event: Event) => {
    const files = Array.from((event.target as HTMLInputElement).files || [])
    if (!files.length) return
    const next = files.slice(0, Math.max(0, maxImages.value - sourceImages.value.length)).map((file) => {
        const objectUrl = URL.createObjectURL(file); uploadBlobUrls.push(objectUrl)
        return { uri: objectUrl, preview: objectUrl, name: file.name, source: 'local' as UploadSource, file }
    })
    appendUploads(next); (event.target as HTMLInputElement).value = ''
}
const selectGallery = (item: any) => {
    const uri = item.uri || item.url || item.cover
    appendUploads([{ uri, preview: resolveUploadPreviewUrl(item.url || item.cover || item.uri, uri), name: item.name || '', source: 'gallery' }])
    showGalleryModal.value = false
}
const removeUpload = (index: number) => { sourceImages.value.splice(index, 1); estimateInfo.value = {} }
const clearUpload = () => { sourceImages.value = []; estimateInfo.value = {} }
const toggleOption = (code: string) => selectedOptionCodes.value.includes(code) ? selectedOptionCodes.value = selectedOptionCodes.value.filter((item) => item !== code) : selectedOptionCodes.value.push(code)
const optionCover = (item: any) => resolveUploadPreviewUrl(item?.cover_url || item?.cover_image || '')

const uploadLocalImagesIfNeeded = async () => {
    const uploaded: UploadItem[] = []
    sourceUploading.value = true
    try {
        for (const item of sourceImages.value) {
            if (item.source !== 'local' || !item.file) { uploaded.push(item); continue }
            const res: any = await uploadImage({ file: item.file })
            const uri = res?.uri || res?.url || item.uri
            uploaded.push({ ...item, uri, preview: item.preview || resolveUploadPreviewUrl(res?.url || uri, uri), source: 'gallery', file: null })
        }
        sourceImages.value = uploaded
        return uploaded.map((item) => item.uri)
    } finally { sourceUploading.value = false }
}
const buildPayload = (uris = sourceImages.value.map((item) => item.uri)) => ({ source_images: uris, option_codes: selectedOptionCodes.value })
const updateEstimate = async () => {
    if (!sourceImages.value.length || sourceImages.value.some((item) => item.source === 'local') || !selectedOptionCodes.value.length) { estimateInfo.value = {}; return }
    try { estimateInfo.value = await estimateAigcOneClickCleanup(buildPayload(), { suppressErrorMessage: true }) } catch { estimateInfo.value = {} }
}
const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try { const uris = await uploadLocalImagesIfNeeded(); await generateAigcOneClickCleanup(buildPayload(uris)); await refreshTasks(); startPolling() } finally { submitting.value = false }
}
const refreshTasks = async () => {
    taskLoading.value = true
    try { const res: any = await getAigcOneClickCleanupTasks({ page_no: 1, page_size: 20, status: activeTaskStatusFilter.value }); tasks.value = Array.isArray(res?.lists) ? res.lists : [] } finally { taskLoading.value = false }
}
const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', partial_failed: '部分失败', canceled: '已取消' }[status] || '生成中')
const normalizeTaskStatus = (status: any) => { const value = String(status || '').toLowerCase(); return ['pending', 'running', 'success', 'failed', 'partial_failed', 'canceled'].includes(value) ? value : 'running' }
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const taskStateDescription = (item: any) => normalizeTaskStatus(item?.status) === 'failed' ? '生成失败，请稍后重试' : 'AI 正在清理图片，请稍候'
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskTitle = (item?: any) => `${toolDisplayName.value} ${Number(item?.quantity || item?.source_images?.length || 1)}张`
const taskPrompt = (item: any) => Array.isArray(item.option_names) && item.option_names.length ? `清理：${item.option_names.join('、')}` : String(item.prompt || '一键消除图片干扰内容').trim()
const taskSourceImages = (item: any) => Array.isArray(item?.source_image_urls)
    ? item.source_image_urls.map((url: any) => String(url || '').trim()).filter(Boolean)
    : (item?.source_image_url ? [String(item.source_image_url)] : [])
const taskSizeLabel = (item: any) => item.size_label || (Number(item.width || 0) > 0 && Number(item.height || 0) > 0 ? `${item.width}×${item.height}` : '')
const resultImageUrl = (entry: any) => String(entry?.image_url || entry?.url || entry?.image || '').trim()
const taskResults = (item: any) => Array.isArray(item.results)
    ? item.results.filter((entry: any) => resultImageUrl(entry) !== '').sort((left: any, right: any) => Number(left?.id || 0) - Number(right?.id || 0))
    : []
const taskExpectedResultCount = (item: any) => Math.max(1, Number(item?.quantity || item?.source_images?.length || taskSourceImages(item).length || taskResults(item).length || 1))
const taskResultSlots = (item: any) => {
    const results = taskResults(item)
    const status = normalizeTaskStatus(item?.status)
    const expectedCount = Math.max(taskExpectedResultCount(item), results.length, 1)
    if (['success', 'partial_failed'].includes(status) && results.length > 0 && !isTaskRunning(item)) {
        return results.map((result: any, index: number) => ({
            key: `result-${result.id || resultImageUrl(result) || index}`,
            result,
            running: false,
            label: '',
            description: ''
        }))
    }
    const resultByIndex = new Map<number, any>()
    const fallbackResults: any[] = []
    results.forEach((result: any) => {
        const sourceIndex = Number(result?.source_index)
        if (Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < expectedCount && !resultByIndex.has(sourceIndex)) {
            resultByIndex.set(sourceIndex, result)
        } else {
            fallbackResults.push(result)
        }
    })
    if (isTaskRunning(item)) {
        return Array.from({ length: expectedCount }, (_, index) => ({
            key: `running-${taskId(item) || 'task'}-${index}`,
            result: null,
            running: true,
            label: '',
            description: ''
        }))
    }
    if (!['success', 'partial_failed', 'failed', 'canceled'].includes(status)) return []
    return Array.from({ length: expectedCount }, (_, index) => {
        const result = resultByIndex.get(index) || fallbackResults.shift()
        if (result) {
            return {
                key: `result-${result.id || resultImageUrl(result) || index}`,
                result,
                running: false,
                label: '',
                description: ''
            }
        }
        return {
            key: `failed-${taskId(item) || 'task'}-${index}`,
            result: null,
            running: false,
            label: status === 'canceled' ? '已取消' : '生成失败',
            description: item.error || '任务处理失败，请稍后重试'
        }
    })
}
const resultDownloadUrl = (result: any) => String(result?.download_url || resultImageUrl(result) || '').trim()
const resultDownloadHref = (result: any) => resolvePcDownloadUrl(resultDownloadUrl(result))
const resultDownloadName = (result: any, index = 0) => {
    const href = resultDownloadHref(result)
    return `one-click-cleanup-${result?.id || Date.now()}-${index + 1}.${getPcDownloadExtension(href, 'png')}`
}
const isMultiImageTask = (item: any) => taskSourceImages(item).length > 1
const taskMediaFrameStyle = (item: any) => {
    Number(item?.width || 1)
    Number(item?.height || 1)
    return {}
}
const formatTaskTime = (value: any) => { if (!value) return ''; if (typeof value === 'string') return value; const d = new Date(Number(value) * 1000); if (Number.isNaN(d.getTime())) return String(value); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }
const editTask = (item: any) => { const uris = Array.isArray(item.source_images) ? item.source_images : []; const urls = Array.isArray(item.source_image_urls) ? item.source_image_urls : []; sourceImages.value = uris.map((uri: string, index: number) => ({ uri, preview: urls[index] || uri, name: `主体图${index + 1}`, source: 'gallery' })); selectedOptionCodes.value = Array.isArray(item.option_codes) ? item.option_codes : selectedOptionCodes.value }
const rerunTask = async (item: any) => { editTask(item); await submit() }
const previewResult = (result: any, item: any) => { const image = resultImageUrl(result); if (!image) return; previewImage.value = image; previewTitle.value = taskTitle(item) }
const previewSource = (image: string, item: any, index: number) => { if (!image) return; previewImage.value = image; previewTitle.value = `${taskTitle(item)} 原图${index + 1}` }
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const deleteTask = async (item: any) => { const id = taskId(item); if (!id) return; await deleteAigcOneClickCleanupTask({ id }); await refreshTasks() }
const resultId = (result: any) => Number(result?.id || result?.result_id || 0)
const isDeletingResult = (result: any) => deletingResultIds.value.includes(resultId(result))
const deleteResultOrTask = async (result: any, item: any) => {
    if (!isMultiImageTask(item)) {
        await deleteTask(item)
        return
    }
    await deleteSingleResult(result)
}
const downloadAllResults = async (item: any, panelItems: any[] = []) => {
    const id = taskId(item)
    if (!id) return
    await downloadTaskResults(id, panelItems, `one-click-cleanup-${id}.zip`)
}
const deleteSingleResult = async (result: any) => {
    const id = resultId(result)
    if (!id || deletingResultIds.value.includes(id)) return
    deletingResultIds.value = [...deletingResultIds.value, id]
    try {
        await deleteAigcOneClickCleanupResult({ id })
        await refreshTasks()
    } finally {
        deletingResultIds.value = deletingResultIds.value.filter((item) => item !== id)
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
const handlePanelPreviewReference = (reference: any, task: any) => {
    if (!reference?.url) return
    previewImage.value = reference.url
    previewTitle.value = `${task?.title || toolDisplayName.value} ${reference.label || '原图'}`
}
const handlePanelPreview = (item: any, task: any) => {
    if (!item?.url) return
    previewImage.value = item.url
    previewTitle.value = task?.title || '生成作品'
}
const handlePanelDownloadOne = (item: any) => triggerDownload(item?.downloadUrl || '', item?.downloadName || '生成作品.png')
const handlePanelDownloadAll = (task: any) => downloadAllResults(rawPanelTask(task), task.items || [])
const handlePanelDeleteOne = (item: any, task: any) => deleteResultOrTask(rawPanelItem(item), rawPanelTask(task))
const handlePanelDeleteAll = (task: any) => deleteTask(rawPanelTask(task))
const startPolling = () => { if (pollTimer) return; pollTimer = window.setInterval(async () => { await refreshTasks(); if (!tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) stopPolling() }, 5000) }
const stopPolling = () => { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null } }

watch([sourceImages, selectedOptionCodes], updateEstimate, { deep: true })
onMounted(async () => { window.addEventListener('click', closeDropdowns); await loadConfig(); await refreshTasks(); if (tasks.value.some((item) => ['pending', 'running'].includes(String(item.status)))) startPolling() })
onUnmounted(() => { window.removeEventListener('click', closeDropdowns); stopPolling(); uploadBlobUrls.forEach((url) => URL.revokeObjectURL(url)) })
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;

.one-click-cleanup-page {
    height: 100%;
    min-width: calc(403px + 24px + 560px);
}

.field-count {
    color: rgba(255, 255, 255, 0.42);
    font-size: 13px;
}

.cleanup-upload-card {
    height: 176px;
    min-height: 176px;
}

.cleanup-upload-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 14px;
}

.cleanup-upload-list__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 20px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 20px;
}

.cleanup-upload-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
}

.cleanup-upload-item,
.cleanup-upload-add {
    position: relative;
    aspect-ratio: 1 / 1;
    min-width: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: #050505;
    overflow: hidden;
}

.cleanup-upload-item img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cleanup-upload-item button {
    position: absolute;
    right: 6px;
    top: 6px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.68);
    color: #fff;
    cursor: pointer;
}

.cleanup-upload-item button:hover {
    background: rgba(0, 0, 0, 0.86);
}

.upload-card__placeholder small {
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
    line-height: 18px;
    text-align: center;
}

.cleanup-option-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.cleanup-option-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 156px;
    min-width: 0;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: #171717;
    color: #fff;
    text-align: left;
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.cleanup-option-card:hover {
    border-color: rgba(255, 255, 255, 0.14);
    background: #1f1f1f;
}

.cleanup-option-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
}

.cleanup-option-card__head strong {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: inherit;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cleanup-option-card__head i {
    position: relative;
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 7px;
    background: #242424;
}

.cleanup-option-card__head i::after {
    content: '';
    position: absolute;
    left: 7px;
    top: 4px;
    width: 6px;
    height: 10px;
    border: solid transparent;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

.cleanup-option-card__media {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 9;
    width: 100%;
    min-height: 74px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: #050505;
    overflow: hidden;
}

.cleanup-option-card__media img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cleanup-option-card__media em {
    color: rgba(255, 255, 255, 0.38);
    font-size: 12px;
    font-style: normal;
    line-height: 1;
}

.cleanup-option-card.is-active {
    border-color: #fff;
    background: #202020;
    color: #fff;
}

.cleanup-option-card.is-active:hover {
    background: #242424;
}

.cleanup-option-card.is-active .cleanup-option-card__head i {
    border-color: #fff;
    background: #fff;
}

.cleanup-option-card.is-active .cleanup-option-card__head i::after {
    border-color: #111;
}

.cleanup-option-card.is-active .cleanup-option-card__media {
    border-color: rgba(255, 255, 255, 0.16);
}

.cleanup-source-strip {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
}

.cleanup-source-strip::-webkit-scrollbar {
    height: 4px;
}

.cleanup-source-strip::-webkit-scrollbar-track {
    background: transparent;
}

.cleanup-source-strip::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
}

.cleanup-source-strip button {
    flex: 0 0 auto;
    display: block;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: #050505;
    overflow: hidden;
    cursor: zoom-in;
}

.cleanup-source-strip img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cleanup-result-grid {
    display: flex;
    align-items: stretch;
    gap: 12px;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
    scroll-snap-type: x proximity;
    overscroll-behavior-x: contain;
}

.cleanup-result-grid::-webkit-scrollbar {
    height: 6px;
}

.cleanup-result-grid::-webkit-scrollbar-track {
    background: transparent;
}

.cleanup-result-grid::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
}

.cleanup-result-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 240px;
    flex: 0 0 240px;
    width: 240px;
    border: 1px solid #222;
    border-radius: 14px;
    background: #0f0f0f;
    overflow: hidden;
    cursor: zoom-in;
    scroll-snap-align: start;
    transition: border-color 0.18s ease, background 0.18s ease;
}

.cleanup-result-item--success:hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: #111;
}

.cleanup-result-item__preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: zoom-in;
}

.cleanup-result-item__preview img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
}

.cleanup-result-item__actions {
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

.cleanup-result-item__actions a,
.cleanup-result-item__actions button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
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

.cleanup-result-item__actions a + button {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.cleanup-result-item--success:hover .cleanup-result-item__actions,
.cleanup-result-item__actions:focus-within {
    opacity: 1;
    transform: translateY(0);
}

.cleanup-result-item__actions a:hover,
.cleanup-result-item__actions button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
}

.cleanup-result-item__actions a:first-child,
.cleanup-result-item__actions button:first-child {
    border-bottom-left-radius: 14px;
}

.cleanup-result-item__actions a:last-child,
.cleanup-result-item__actions button:last-child {
    border-bottom-right-radius: 14px;
}

.cleanup-result-item__actions button:disabled {
    opacity: 0.55;
    cursor: wait;
}

.cleanup-result-item__actions img {
    width: 16px;
    height: 16px;
}

.cleanup-result-item--running {
    cursor: default;
}

.cleanup-result-item--failed {
    flex-direction: column;
    gap: 14px;
    padding: 24px;
    border-color: rgba(255, 92, 92, 0.28);
    background: rgba(92, 24, 24, 0.28);
    color: #ff8b8b;
    cursor: default;
    text-align: center;
}

.cleanup-result-item--failed:hover {
    border-color: rgba(255, 92, 92, 0.32);
    background: rgba(92, 24, 24, 0.28);
}

.cleanup-result-item--failed strong {
    color: #ff8b8b;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
}

.cleanup-result-item--failed span {
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
    overflow-wrap: anywhere;
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

:deep(.task-row__head span:not(.task-row__badge, .task-row__status)) {
    min-width: 0;
}

:deep(.task-row__head .task-row__status) {
    justify-self: end;
    white-space: nowrap;
}

:deep(.task-row__prompt p) {
    flex: 1 1 auto;
    min-width: 180px;
    overflow-wrap: anywhere;
    word-break: break-all;
}

:deep(.task-row__media.is-empty) {
    align-self: flex-start;
    width: 240px;
    height: 240px;
    max-height: 240px;
    background: #0f0f0f;
}

:deep(.task-row__state.is-pending),
:deep(.task-row__state.is-running) {
    min-height: 96px;
}

@media (max-width: 1200px) {
    .one-click-cleanup-page {
        min-width: 0;
    }

    .cleanup-result-grid {
        gap: 10px;
    }

    :deep(.task-row__head) {
        grid-template-columns: auto minmax(0, 1fr) auto;
    }

    :deep(.task-row__head span:not(.task-row__badge, .task-row__status):not(:first-child)) {
        display: none;
    }
}
</style>
