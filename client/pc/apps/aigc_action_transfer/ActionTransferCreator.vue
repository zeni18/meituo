<template>
    <div class="action-transfer-page">
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
                            <label class="field-label">上传参考人物图片</label>
                            <button v-if="personImages.length" type="button" class="ghost-button" @click="clearPersonImages">清空</button>
                        </div>
                        <div class="upload-card action-upload-card" :class="{ 'is-uploading': personUploading }">
                            <div class="upload-card__placeholder" @click="triggerPersonUpload">
                                <img class="upload-card__icon" :src="addIcon" alt="" />
                                <strong>本地上传</strong>
                                <small>最多 3 张，支持 png、jpg、jpeg、webp</small>
                                <button class="upload-card__library" type="button" @click.stop="openGallery('person')">图库上传</button>
                            </div>
                            <span v-if="personUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                        <div v-if="personImages.length" class="action-upload-list">
                            <div class="action-upload-list__head"><span>已上传({{ personImages.length }}/3)</span></div>
                            <div class="action-upload-grid">
                                <article v-for="(item, index) in personImages" :key="`${item.uri}-${index}`" class="action-upload-item">
                                    <img :src="item.preview || item.uri" :alt="item.name || `人物图${index + 1}`" />
                                    <button type="button" aria-label="移除图片" @click.stop="removePersonImage(index)">×</button>
                                </article>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head">
                            <label class="field-label">上传参考视频</label>
                            <button v-if="videoItem.uri" type="button" class="ghost-button" @click="clearVideo">清空</button>
                        </div>
                        <div class="upload-card action-video-card" :class="{ 'is-filled': !!videoItem.uri, 'is-uploading': videoUploading }">
                            <template v-if="videoItem.uri">
                                <div class="upload-card__stage">
                                    <video :src="videoPreviewSrc" muted playsinline preload="metadata" @loadedmetadata="showVideoFirstFrame"></video>
                                    <span class="video-duration">{{ durationLabel }}</span>
                                </div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery('video')">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerVideoUpload">本地上传</button>
                                </div>
                            </template>
                            <div v-else class="upload-card__placeholder" @click="triggerVideoUpload">
                                <img class="upload-card__icon" :src="addIcon" alt="" />
                                <strong>本地上传</strong>
                                <small>支持 mp4、mov、webm，需能识别时长</small>
                                <button class="upload-card__library" type="button" @click.stop="openGallery('video')">图库上传</button>
                            </div>
                            <span v-if="videoUploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">提示词</label>
                        <textarea v-model="prompt" maxlength="2000" placeholder="可选，补充动作迁移效果、人物保持或画面风格要求"></textarea>
                    </section>

                    <section class="field-block">
                        <label class="field-label">生成模式</label>
                        <div class="mode-grid">
                            <button v-for="item in modeOptions" :key="item.value" type="button" class="mode-card" :class="{ 'is-active': mode === item.value }" @click="selectMode(item.value)">
                                <strong>{{ item.label }}</strong>
                                <span>{{ formatPointWithSuffix(Number(item.unit_price || 0).toFixed(2), '秒') }}</span>
                            </button>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">处理人数</label>
                        <div class="tool-select-dropdown" @click.stop>
                            <button class="tool-select-card tool-select-card--button" type="button" :aria-expanded="faceMenuOpen" @click="faceMenuOpen = !faceMenuOpen">
                                <span class="tool-select-card__value">{{ faceCount }} 人</span>
                                <img :src="downIcon" alt="" :class="{ 'is-open': faceMenuOpen }" />
                            </button>
                            <div v-if="faceMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                <button v-for="item in faceCountOptions" :key="item" type="button" :class="{ 'is-active': faceCount === item }" @click="selectFaceCount(item)"><span>{{ item }} 人</span></button>
                            </div>
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

        <input ref="personInputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="handlePersonUpload" />
        <input ref="videoInputRef" class="sr-only" type="file" accept="video/mp4,video/quicktime,video/webm" @change="handleVideoUpload" />
        <AiWorkspaceAssetGalleryModal :visible="showGalleryModal" :accept-types="[galleryTarget === 'video' ? 'video' : 'image']" title="图库上传" :description="galleryTarget === 'video' ? '选择资产视频作为动作参考' : '选择资产图片作为参考人物'" @close="showGalleryModal = false" @select="selectGallery" />
        <Teleport to="body"><div v-if="previewImage" class="media-preview" @click.self="closePreview"><PcCloseButton class="media-preview__close" aria-label="关闭预览" @click="closePreview" /><img :src="previewImage" :alt="previewTitle || '参考图'" /><span>{{ previewTitle || '参考图' }}</span></div></Teleport>
        <Teleport to="body"><div v-if="previewVideo" class="video-preview" @click.self="closeVideoPreview"><PcCloseButton class="media-preview__close" aria-label="关闭视频预览" @click="closeVideoPreview" /><video :src="previewVideo" controls autoplay></video></div></Teleport>
    </div>
</template>

<script setup lang="ts">
import addIcon from '@/assets/images/icon/Add.svg'
import downIcon from '@/assets/images/icon/Down.svg'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { uploadImage, uploadVideo } from '@/api/app'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import { deleteAigcActionTransferResult, deleteAigcActionTransferTask, estimateAigcActionTransfer, generateAigcActionTransfer, getAigcActionTransferConfig, getAigcActionTransferTasks } from './api'

type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed' | 'canceled'
type GalleryTarget = 'person' | 'video'
type UploadSource = 'gallery' | 'local'
type UploadItem = { uri: string; preview: string; name: string; source: UploadSource; file?: File | null }

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const config = ref<any>({})
const tasks = ref<any[]>([])
const estimateInfo = ref<any>({})
const personImages = ref<UploadItem[]>([])
const videoItem = reactive<UploadItem & { duration: number }>({ uri: '', preview: '', name: '', source: 'gallery', file: null, duration: 0 })
const prompt = ref('')
const mode = ref('standard')
const faceCount = ref(1)
const personUploading = ref(false)
const videoUploading = ref(false)
const submitting = ref(false)
const taskLoading = ref(false)
const faceMenuOpen = ref(false)
const showGalleryModal = ref(false)
const galleryTarget = ref<GalleryTarget>('person')
const previewImage = ref('')
const previewTitle = ref('')
const previewVideo = ref('')
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const personInputRef = ref<HTMLInputElement | null>(null)
const videoInputRef = ref<HTMLInputElement | null>(null)
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_action_transfer')
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const blobUrls: string[] = []

const modeOptions = computed(() => config.value?.mode_options || [])
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '动作迁移'))
const faceCountOptions = computed(() => config.value?.face_count_options || [1, 2, 3, 4, 5, 6, 7])
const durationLabel = computed(() => videoItem.duration > 0 ? `${formatDuration(videoItem.duration)} 秒` : '时长识别中')
const selectedMode = computed(() => modeOptions.value.find((item: any) => item.value === mode.value) || modeOptions.value[0] || { unit_price: 0 })
const fallbackChargePoints = computed(() => Number(selectedMode.value?.unit_price || 0) * Math.max(0, Number(videoItem.duration || 0)))
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? fallbackChargePoints.value).toFixed(2))
const videoPreviewSrc = computed(() => videoItem.preview || videoItem.uri)
const canSubmit = computed(() => personImages.value.length > 0 && !!videoItem.uri && videoItem.duration > 0 && !!mode.value && !personUploading.value && !videoUploading.value && !submitting.value)
const taskStatusOptions: { label: string; value: TaskStatusFilter }[] = [{ label: '全部', value: '' }, { label: '排队中', value: 'pending' }, { label: '生成中', value: 'running' }, { label: '成功', value: 'success' }, { label: '失败', value: 'failed' }]
const activeTaskStatusLabel = computed(() => taskStatusOptions.find((item) => item.value === activeTaskStatusFilter.value)?.label || '全部')
const panelTasks = computed(() => tasks.value.map((item: any) => {
    const status = normalizeTaskStatus(item.status)
    const result = (item.results || [])[0] || {}
    const videoUrl = resultVideoUrl(result) || item.video_url || ''
    const id = taskId(item) || item.id || item.task_id
    return {
        id,
        mode: 'single' as const,
        badge: toolDisplayName.value,
        title: `${item.mode_label || toolDisplayName.value} · ${item.face_count || 1}人`,
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: item.duration_label || '',
        prompt: item.prompt || '',
        references: taskReferences(item),
        items: [{ id: resultId(result) || `${id}-video`, url: videoUrl, downloadUrl: videoUrl, downloadName: `action-transfer-${id}.${getPcDownloadExtension(videoUrl, 'mp4')}`, mediaType: 'video' as const, status: videoUrl ? 'success' : status, statusText: videoUrl ? '已完成' : statusText(status), error: item.error || taskStateDescription(item), raw: result, downloadDisabled: !videoUrl, deleteDisabled: isTaskRunning(item) }],
        raw: item,
        regenerateDisabled: submitting.value,
        downloadAllDisabled: !videoUrl || downloadingTaskIds.value.includes(taskId(item)),
        deleteAllDisabled: !taskId(item) || isTaskRunning(item)
    }
}))

const goBackToSource = () => window.history.length > 1 ? router.back() : router.push('/ai/tools')
const triggerPersonUpload = () => personInputRef.value?.click()
const triggerVideoUpload = () => videoInputRef.value?.click()
const openGallery = (target: GalleryTarget) => { galleryTarget.value = target; showGalleryModal.value = true }
const selectMode = (value: string) => { mode.value = value; estimateInfo.value = {} }
const selectFaceCount = (value: number) => { faceCount.value = Number(value); faceMenuOpen.value = false }
const clearPersonImages = () => { personImages.value = []; estimateInfo.value = {} }
const removePersonImage = (index: number) => { personImages.value.splice(index, 1); estimateInfo.value = {} }
const clearVideo = () => { Object.assign(videoItem, { uri: '', preview: '', name: '', source: 'gallery', file: null, duration: 0 }); estimateInfo.value = {} }
const resolveUploadPreviewUrl = (url: unknown, fallback = '') => { const resolved = resolvePcDownloadUrl(url); if (!resolved) return fallback; if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) return fallback; return resolved }
const keepPlayableVideoPreview = (candidate: unknown, fallback = '') => {
    const current = String(fallback || '').trim()
    if (current.startsWith('blob:')) return current
    return resolveUploadPreviewUrl(candidate, current)
}
const showVideoFirstFrame = (event: Event) => {
    const video = event.target as HTMLVideoElement
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime > 0) return
    try {
        video.currentTime = Math.min(video.duration, 0.01)
    } catch {}
}
const handlePersonUpload = (event: Event) => {
    const files = Array.from((event.target as HTMLInputElement).files || []).slice(0, Math.max(0, 3 - personImages.value.length))
    files.forEach((file) => {
        const preview = URL.createObjectURL(file)
        blobUrls.push(preview)
        personImages.value.push({ uri: preview, preview, name: file.name, source: 'local', file })
    })
    estimateInfo.value = {}
    ;(event.target as HTMLInputElement).value = ''
}
const handleVideoUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    blobUrls.push(preview)
    Object.assign(videoItem, { uri: preview, preview, name: file.name, source: 'local', file, duration: 0 })
    videoItem.duration = await readVideoDuration(preview)
    estimateInfo.value = {}
    ;(event.target as HTMLInputElement).value = ''
}
const selectGallery = async (items: any[] | any) => {
    const selected = Array.isArray(items) ? items : [items]
    if (galleryTarget.value === 'person') {
        selected.slice(0, Math.max(0, 3 - personImages.value.length)).forEach((item) => {
            const uri = item?.uri || item?.url || item?.image || item?.path || ''
            const preview = resolveUploadPreviewUrl(item?.url || item?.cover_url || item?.cover || uri, uri)
            if (uri) personImages.value.push({ uri, preview: preview || uri, name: item?.name || '素材图片', source: 'gallery' })
        })
    } else {
        const item = selected[0] || {}
        const uri = item?.uri || item?.url || item?.video_url || item?.path || ''
        const preview = resolveUploadPreviewUrl(item?.url || item?.video_url || uri, uri)
        if (uri) {
            Object.assign(videoItem, { uri, preview: preview || uri, name: item?.name || '素材视频', source: 'gallery', file: null, duration: Number(item?.duration || 0) })
            if (!videoItem.duration && /^https?:/i.test(videoItem.preview)) videoItem.duration = await readVideoDuration(videoItem.preview)
        }
    }
    estimateInfo.value = {}
    showGalleryModal.value = false
}
const readVideoDuration = (url: string) => new Promise<number>((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? Number(video.duration.toFixed(2)) : 0)
    video.onerror = () => resolve(0)
    video.src = url
})
const ensureUploadedImages = async () => {
    const rows: string[] = []
    personUploading.value = true
    try {
        for (const item of personImages.value) {
            if (item.source === 'local' && item.file) {
                const res: any = await uploadImage({ file: item.file })
                const uri = res?.uri || res?.url || res
                const preview = resolveUploadPreviewUrl(res?.url || uri, item.preview || uri)
                Object.assign(item, { uri, preview, file: null, source: 'gallery' })
            }
            rows.push(item.uri)
        }
    } finally {
        personUploading.value = false
    }
    return rows
}
const ensureUploadedVideo = async () => {
    if (videoItem.source !== 'local' || !videoItem.file) return videoItem.uri
    videoUploading.value = true
    try {
        const res: any = await uploadVideo({ file: videoItem.file })
        const uri = res?.uri || res?.url || res
        const preview = keepPlayableVideoPreview(res?.url || uri, videoItem.preview || uri)
        Object.assign(videoItem, { uri, preview, file: null, source: 'gallery' })
        return uri
    } finally {
        videoUploading.value = false
    }
}
const buildParams = async (uploadLocal = true) => ({
    reference_images: uploadLocal ? await ensureUploadedImages() : personImages.value.filter((item) => item.source !== 'local').map((item) => item.uri),
    video_uri: uploadLocal ? await ensureUploadedVideo() : (videoItem.source === 'local' ? '' : videoItem.uri),
    prompt: prompt.value.trim(),
    mode: mode.value,
    face_count: faceCount.value,
    duration: videoItem.duration
})
const estimate = async () => { if (!videoItem.duration || !mode.value) return; estimateInfo.value = await estimateAigcActionTransfer(await buildParams(false), { ignoreCancelToken: true }) }
const submit = async () => {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        const params = await buildParams()
        const res: any = await generateAigcActionTransfer(params, { ignoreCancelToken: true })
        estimateInfo.value = res?.estimate || {}
        await refreshTasks()
        startPolling()
    } finally {
        submitting.value = false
    }
}
const loadConfig = async () => { config.value = await getAigcActionTransferConfig(); mode.value = config.value?.default_mode || modeOptions.value[0]?.value || 'standard'; faceCount.value = Number(config.value?.default_face_count || 1) }
const refreshTasks = async () => { taskLoading.value = true; try { const res: any = await getAigcActionTransferTasks({ page_no: 1, page_size: 30, status: activeTaskStatusFilter.value }); tasks.value = res?.lists || [] } finally { taskLoading.value = false } }
const selectTaskStatus = async (status: TaskStatusFilter) => { activeTaskStatusFilter.value = status; await refreshTasks() }
const startPolling = () => { stopPolling(); if (!tasks.value.some(isTaskRunning)) return; pollTimer = window.setInterval(async () => { await refreshTasks(); if (!tasks.value.some(isTaskRunning)) stopPolling() }, 5000) }
const stopPolling = () => { if (pollTimer) window.clearInterval(pollTimer); pollTimer = null }
const handlePanelEdit = (task: any) => { const raw = task.raw || {}; personImages.value = (raw.reference_images || []).map((uri: string, index: number) => ({ uri, preview: raw.reference_image_urls?.[index] || uri, name: `参考人物${index + 1}`, source: 'gallery' })); Object.assign(videoItem, { uri: raw.video_uri || '', preview: raw.source_video_url || raw.video_uri || '', name: '参考视频', source: 'gallery', file: null, duration: Number(raw.duration || 0) }); prompt.value = raw.prompt || ''; mode.value = raw.mode || mode.value; faceCount.value = Number(raw.face_count || faceCount.value) }
const handlePanelRegenerate = async (task: any) => { handlePanelEdit(task); await submit() }
const handlePanelPreviewReference = (reference: any) => { if (reference.mediaType === 'video') previewVideo.value = reference.url; else { previewImage.value = reference.url; previewTitle.value = reference.label || '参考图' } }
const handlePanelPreview = (item: any) => { previewVideo.value = item.url || item.downloadUrl || '' }
const handlePanelDownloadOne = (item: any) => { const url = item.downloadUrl || item.url; if (url) window.open(url, '_blank') }
const handlePanelDownloadAll = async (task: any) => { const id = taskId(task.raw || task); await downloadTaskResults(id, task.items || [], `action-transfer-${id}.zip`) }
const handlePanelDeleteOne = async (item: any, task: any) => {
    const id = resultId(item.raw || item)
    if (id) {
        await deleteAigcActionTransferResult({ id })
        await refreshTasks()
        return
    }
    await handlePanelDeleteAll(task)
}
const handlePanelDeleteAll = async (task: any) => { const id = taskId(task.raw || task); if (!id) return; await deleteAigcActionTransferTask({ id }); await refreshTasks() }
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const closeVideoPreview = () => { previewVideo.value = '' }
const taskReferences = (item: any) => [...(item.reference_image_urls || []).map((url: string, index: number) => ({ label: `人物图${index + 1}`, url })), ...(item.source_video_url ? [{ label: '参考视频', url: item.source_video_url, mediaType: 'video' }] : [])]
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const resultId = (item: any) => Number(item?.id || item?.result_id || 0)
const resultVideoUrl = (item: any) => resolvePcDownloadUrl(item?.video_url || item?.download_url || item?.url || '')
const normalizeTaskStatus = (status: any) => ['pending', 'running', 'success', 'failed', 'canceled'].includes(String(status)) ? String(status) : 'running'
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', canceled: '已取消' }[status] || '生成中')
const taskStateDescription = (item: any) => item?.error || (normalizeTaskStatus(item?.status) === 'failed' ? '生成失败，请稍后重试' : 'AI 正在生成，请稍候')
const formatTaskTime = (value: any) => { const num = Number(value || 0); if (!num) return ''; const d = new Date(num * 1000); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const formatDuration = (value: number) => Number(value || 0).toFixed(2).replace(/\.?0+$/, '')
watch([() => videoItem.duration, mode], () => { estimateInfo.value = {}; estimate() })
onMounted(async () => { await loadConfig(); await refreshTasks(); startPolling(); document.addEventListener('click', closeDropdowns) })
onUnmounted(() => { stopPolling(); document.removeEventListener('click', closeDropdowns); blobUrls.forEach((url) => URL.revokeObjectURL(url)) })
const closeDropdowns = () => { faceMenuOpen.value = false }
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;

.action-transfer-page { height: 100%; min-width: calc(403px + 24px + 560px); }
.upload-card__stage { position: relative; width: 100%; height: 100%; background: #050505; }
.upload-card__stage video { width: 100%; height: 100%; object-fit: contain; }
.upload-card__actions { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px; background: rgba(5,5,5,.42); opacity: 0; pointer-events: none; backdrop-filter: blur(2px); transition: opacity .2s ease; }
.upload-card.is-filled:hover .upload-card__actions { opacity: 1; pointer-events: auto; }
.action-upload-card,
.action-video-card { height: 176px; min-height: 176px; }
.action-upload-card .upload-card__placeholder,
.action-video-card .upload-card__placeholder { gap: 8px; min-height: 176px; padding: 16px 18px; }
.action-upload-card small,
.action-video-card small { color: rgba(255,255,255,.42); font-size: 12px; line-height: 16px; text-align: center; white-space: nowrap; }
.action-upload-list { margin-top: 0; }
.action-upload-list__head { margin-bottom: 8px; color: rgba(255,255,255,.52); font-size: 12px; }
.action-upload-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
.action-upload-item { position: relative; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 10px; background: #0f0f0f; }
.action-upload-item img { width: 100%; height: 100%; object-fit: cover; }
.action-upload-item button { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border: 0; border-radius: 7px; background: rgba(0,0,0,.58); color: #fff; cursor: pointer; line-height: 22px; }
.video-duration { position: absolute; right: 10px; bottom: 10px; height: 24px; padding: 0 8px; border-radius: 8px; background: rgba(0,0,0,.62); color: #fff; font-size: 12px; line-height: 24px; }
.mode-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
.mode-card { min-width: 0; padding: 12px 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #171717; color: rgba(255,255,255,.72); text-align: left; cursor: pointer; transition: border-color .2s ease, background .2s ease; }
.mode-card:hover { border-color: rgba(255,255,255,.18); background: #1f1f1f; }
.mode-card.is-active { border-color: #fff; color: #fff; }
.mode-card strong { display: block; margin-bottom: 4px; font-size: 13px; line-height: 18px; }
.mode-card span { color: rgba(255,255,255,.48); font-size: 12px; line-height: 17px; }
.video-preview { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 52px; background: rgba(0,0,0,.82); box-sizing: border-box; }
.video-preview video { max-width: min(100%, 1100px); max-height: calc(100vh - 104px); border-radius: 14px; background: #050505; }
@media (max-width: 1200px) { .action-transfer-page { min-width: 0; } }
</style>
