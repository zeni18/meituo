<template>
    <div class="promo-video-page">
        <section class="product-workspace">
            <div class="product-panel product-panel--form">
                <header class="product-head">
                    <button class="product-head__back" type="button" @click="goBackToSource"><span class="product-head__back-icon" aria-hidden="true"></span><span>返回</span></button>
                    <div class="product-head__title"><h1>{{ toolDisplayName }}</h1></div>
                    <span class="product-head__spacer" aria-hidden="true"></span>
                </header>

                <div class="product-panel__body">
                    <section class="field-block">
                        <div class="field-head"><label class="field-label">上传产品图片</label><button v-if="sourceImage" type="button" class="ghost-button" @click="clearImage">清空</button></div>
                        <div class="upload-card" :class="{ 'is-filled': !!sourceImage, 'is-uploading': uploading }">
                            <template v-if="sourceImage">
                                <div class="upload-card__stage"><img :src="sourceImageUrl || sourceImage" alt="产品图片" /></div>
                                <div class="upload-card__actions">
                                    <button class="upload-card__action" type="button" @click="openGallery">图库上传</button>
                                    <button class="upload-card__action" type="button" @click="triggerUpload">本地上传</button>
                                </div>
                            </template>
                            <div v-else class="upload-card__placeholder" @click="triggerUpload">
                                <img class="upload-card__icon" :src="addIcon" alt="" />
                                <strong>本地上传</strong>
                                <small>支持 png、jpg、jpeg、webp</small>
                                <button class="upload-card__library" type="button" @click.stop="openGallery">图库上传</button>
                            </div>
                            <span v-if="uploading" class="upload-mask"><i></i>上传中</span>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">视频比例</label>
                        <div class="tool-select-dropdown" @click.stop>
                            <button class="tool-select-card tool-select-card--button" type="button" :aria-expanded="ratioMenuOpen" @click="ratioMenuOpen = !ratioMenuOpen">
                                <span class="tool-select-card__value">{{ selectedRatioLabel }}</span>
                                <img :src="downIcon" alt="" :class="{ 'is-open': ratioMenuOpen }" />
                            </button>
                            <div v-if="ratioMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                <button v-for="item in ratioOptions" :key="item.value" :class="{ 'is-active': ratio === item.value }" type="button" @click="selectRatio(item.value)"><span>{{ item.label }}</span></button>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">视频时长</label>
                        <div class="tool-select-dropdown" @click.stop>
                            <button class="tool-select-card tool-select-card--button" type="button" :aria-expanded="durationMenuOpen" @click="durationMenuOpen = !durationMenuOpen">
                                <span class="tool-select-card__value">{{ selectedDurationLabel }}</span>
                                <img :src="downIcon" alt="" :class="{ 'is-open': durationMenuOpen }" />
                            </button>
                            <div v-if="durationMenuOpen" class="tool-filter-menu tool-filter-menu--select tool-filter-menu--dropdown">
                                <button v-for="item in durationOptions" :key="item.value" :class="{ 'is-active': duration === item.value }" type="button" @click="selectDuration(item.value)"><span>{{ item.label }}</span></button>
                            </div>
                        </div>
                    </section>

                    <section class="field-block">
                        <label class="field-label">视频类型</label>
                        <div class="type-grid">
                            <button v-for="item in enabledTypes" :key="item.code" type="button" class="type-card" :class="{ 'is-active': videoTypeCode === item.code }" @click="videoTypeCode = item.code; estimateInfo = {}">
                                <div class="type-card__cover"><img v-if="typeCover(item)" :src="typeCover(item)" :alt="item.name" /><span v-else>未配置封面</span></div>
                                <div class="type-card__body"><strong>{{ item.name }}</strong><span>{{ item.description || '适合产品传播视频' }}</span></div>
                            </button>
                        </div>
                    </section>

                    <section class="field-block">
                        <div class="field-head"><label class="field-label">描述词</label><div class="field-actions"><button type="button" :disabled="promptWriting" @click="handleWritePrompt">AI帮写</button><button type="button" :disabled="promptWriting || !prompt.trim()" @click="handleOptimizePrompt">AI优化</button></div></div>
                        <textarea v-model="prompt" maxlength="2000" placeholder="描述产品特点、使用场景或想要的视频效果"></textarea>
                    </section>
                </div>

                <div class="submit-bar"><div><span>预计消耗</span><strong>{{ formatPoint(estimatePoints) }}</strong></div><button type="button" :disabled="!canSubmit || submitting" @click="submit">{{ submitting ? '生成中' : '立即生成' }}</button></div>
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

        <input ref="inputRef" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload" />
        <AiWorkspaceAssetGalleryModal :visible="showGalleryModal" :accept-types="['image']" title="图库上传" description="选择资产图片作为产品参考图" @close="showGalleryModal = false" @select="selectGallery" />
        <Teleport to="body"><div v-if="previewImage" class="media-preview" @click.self="closePreview"><PcCloseButton class="media-preview__close" aria-label="关闭预览" @click="closePreview" /><img :src="previewImage" alt="预览" /><span>{{ previewTitle || '参考图' }}</span></div></Teleport>
        <Teleport to="body"><div v-if="previewVideo" class="video-preview" @click.self="closeVideoPreview"><PcCloseButton class="media-preview__close" aria-label="关闭视频预览" @click="closeVideoPreview" /><video :src="previewVideo" controls autoplay></video></div></Teleport>
    </div>
</template>

<script setup lang="ts">
import addIcon from '@/assets/images/icon/Add.svg'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { uploadImage } from '@/api/app'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'
import { useAiToolDownload } from '../ai_tool_download/useAiToolDownload'
import { resolveToolDisplayName } from '../useToolDisplayName'
import AiToolTaskPanel from '@/components/ai-workspace/tool-task-panel.vue'
import downIcon from '@/assets/images/icon/Down.svg'
import { deleteAigcProductPromoVideoTask, estimateAigcProductPromoVideo, generateAigcProductPromoVideo, getAigcProductPromoVideoConfig, getAigcProductPromoVideoTasks, getAigcProductPromoVideoTypes, optimizeAigcProductPromoVideoPrompt, writeAigcProductPromoVideoPrompt } from './api'

type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed' | 'canceled'
const { formatPoint, formatPointWithSuffix } = usePointUnit()
const router = useRouter()
const config = ref<any>({})
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, '产品宣传视频'))
const types = ref<any[]>([])
const tasks = ref<any[]>([])
const estimateInfo = ref<any>({})
const sourceImage = ref('')
const sourceImageUrl = ref('')
const sourceImageFile = ref<File | null>(null)
const ratio = ref('')
const duration = ref(0)
const videoTypeCode = ref('')
const prompt = ref('')
const uploading = ref(false)
const submitting = ref(false)
const promptWriting = ref(false)
const taskLoading = ref(false)
const showGalleryModal = ref(false)
const ratioMenuOpen = ref(false)
const durationMenuOpen = ref(false)
const previewImage = ref('')
const previewVideo = ref('')
const previewTitle = ref('')
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const inputRef = ref<HTMLInputElement | null>(null)
const { downloadingTaskIds, downloadTaskResults } = useAiToolDownload('aigc_product_promo_video')
let pollTimer: ReturnType<typeof window.setInterval> | null = null
const blobUrls: string[] = []

const enabledTypes = computed(() => types.value.filter((item) => Number(item.status ?? 1) === 1))
const allSpecRows = computed(() => flattenSpecRows(config.value?.spec_options || []).filter((item: any) => Number(item.status ?? 1) === 1))
const activeChannelCode = computed(() => {
    const rows = allSpecRows.value
    return String(config.value?.default_channel || config.value?.config_json?.channel || config.value?.option_config?.defaults?.channel || rows[0]?.channel || '').trim()
})
const activeQualityValue = computed(() => {
    const rows = activeChannelCode.value ? allSpecRows.value.filter((item: any) => item.channel === activeChannelCode.value) : allSpecRows.value
    return String(config.value?.default_quality || config.value?.config_json?.quality || config.value?.option_config?.defaults?.quality || rows[0]?.quality || '').trim()
})
const specRows = computed(() => {
    const rows = allSpecRows.value
    const channelRows = activeChannelCode.value ? rows.filter((item: any) => item.channel === activeChannelCode.value) : rows
    const qualityRows = activeQualityValue.value ? channelRows.filter((item: any) => item.quality === activeQualityValue.value) : channelRows
    return qualityRows.length ? qualityRows : (channelRows.length ? channelRows : rows)
})
const ratioOptions = computed(() => {
    const map = new Map<string, any>()
    specRows.value.forEach((item: any) => { if (item.ratio && !map.has(item.ratio)) map.set(item.ratio, { label: ratioDisplayLabel(item.ratio, item.ratio_label), value: item.ratio }) })
    return Array.from(map.values())
})
const durationOptions = computed(() => specRows.value.filter((item: any) => !ratio.value || item.ratio === ratio.value).map((item: any) => Number(item.duration)).filter(Boolean).filter((item: number, index: number, arr: number[]) => arr.indexOf(item) === index).sort((a: number, b: number) => a - b).map((value: number) => ({ label: `${value}秒`, value })))
const selectedRatioLabel = computed(() => ratioOptions.value.find((item: any) => item.value === ratio.value)?.label || '请选择比例')
const selectedDurationLabel = computed(() => durationOptions.value.find((item: any) => item.value === duration.value)?.label || '请选择时长')
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? fallbackChargePoints.value).toFixed(2))
const fallbackChargePoints = computed(() => {
    const secondPrice = Number(config.value?.unit_price ?? selectedSpec.value?.unit_price ?? 0)
    return secondPrice * Math.max(1, Number(duration.value || selectedSpec.value?.duration || 1))
})
const selectedSpec = computed(() => specRows.value.find((item: any) => item.ratio === ratio.value && Number(item.duration) === Number(duration.value)) || specRows.value[0] || {})
const canSubmit = computed(() => !!sourceImage.value && !!ratio.value && !!duration.value && !!videoTypeCode.value && !uploading.value && !submitting.value)
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
        title: item.type_name || toolDisplayName.value,
        createTime: formatTaskTime(item.create_time),
        status,
        statusText: statusText(status),
        sizeLabel: item.size_label || '',
        prompt: item.user_prompt || item.prompt || '',
        references: item.source_image_url ? [{ label: '产品图', url: item.source_image_url }] : [],
        items: [{ id: resultId(result) || `${id}-video`, url: videoUrl, downloadUrl: videoUrl, downloadName: `product-promo-video-${id}.${getPcDownloadExtension(videoUrl, 'mp4')}`, mediaType: 'video' as const, status: videoUrl ? 'success' : status, statusText: videoUrl ? '已完成' : statusText(status), error: item.error || taskStateDescription(item), raw: result, downloadDisabled: !videoUrl, deleteDisabled: isTaskRunning(item) }],
        raw: item,
        regenerateDisabled: submitting.value,
        downloadAllDisabled: !videoUrl || downloadingTaskIds.value.includes(taskId(item)),
        deleteAllDisabled: !taskId(item) || isTaskRunning(item)
    }
}))

const flattenSpecRows = (list: any[]) => list.flatMap((channel: any) => (channel.qualities || []).flatMap((quality: any) => (quality.ratios || []).map((item: any) => ({ ...item, channel: item.channel || channel.code, quality: item.quality || quality.value }))))
const goBackToSource = () => window.history.length > 1 ? router.back() : router.push('/ai/tools')
const typeCover = (item: any) => resolvePreviewUrl(item?.cover_url || item?.cover_image || '')
const resolvePreviewUrl = (url: any) => resolvePcDownloadUrl(url) || ''
const resolveUploadPreviewUrl = (url: unknown, fallback = '') => {
    const resolved = resolvePcDownloadUrl(url)
    if (!resolved) return fallback
    if (/^[a-z][a-z\d+.-]*:/i.test(resolved) && !/^(https?:|data:|blob:)/i.test(resolved)) return fallback
    return resolved
}
const ratioDisplayLabel = (value: any, label?: any) => {
    const ratioValue = String(value || '').trim()
    const ratioLabel = String(label || '').trim()
    if (ratioValue === 'adaptive') return '自适应'
    if (ratioLabel === 'adaptive') return '自适应'
    if (ratioLabel && !/[\uFFFD\u9477\u59AF\u699B\u7EC9\u951B]/u.test(ratioLabel)) return ratioLabel
    return ratioValue
}
const syncSelections = () => {
    if (!ratioOptions.value.some((item: any) => item.value === ratio.value)) {
        const defaultRatio = String(config.value?.default_ratio || config.value?.config_json?.ratio || '').trim()
        ratio.value = ratioOptions.value.some((item: any) => item.value === defaultRatio) ? defaultRatio : (ratioOptions.value[0]?.value || '')
    }
    if (!durationOptions.value.some((item: any) => item.value === duration.value)) {
        const defaultDuration = Number(config.value?.default_duration || config.value?.config_json?.duration || 0)
        duration.value = durationOptions.value.some((item: any) => item.value === defaultDuration) ? defaultDuration : Number(durationOptions.value[0]?.value || 0)
    }
    if (!enabledTypes.value.some((item) => item.code === videoTypeCode.value)) videoTypeCode.value = enabledTypes.value[0]?.code || ''
}
const loadConfig = async () => { config.value = await getAigcProductPromoVideoConfig(); types.value = await getAigcProductPromoVideoTypes(); syncSelections() }
const selectRatio = (value: string) => { ratio.value = value; ratioMenuOpen.value = false; syncSelections(); estimateInfo.value = {} }
const selectDuration = (value: number) => { duration.value = Number(value); durationMenuOpen.value = false; estimateInfo.value = {} }
const triggerUpload = () => inputRef.value?.click()
const openGallery = () => { showGalleryModal.value = true }
const clearImage = () => { sourceImage.value = ''; sourceImageUrl.value = ''; sourceImageFile.value = null; estimateInfo.value = {} }
const handleUpload = (event: Event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; const url = URL.createObjectURL(file); blobUrls.push(url); sourceImage.value = url; sourceImageUrl.value = url; sourceImageFile.value = file; estimateInfo.value = {}; (event.target as HTMLInputElement).value = '' }
const selectGallery = (items: any[] | any) => { const item = Array.isArray(items) ? items?.[0] : items; const uri = item?.uri || item?.url || item?.image || item?.path || ''; const url = resolveUploadPreviewUrl(item?.url || item?.cover_url || item?.cover || uri, uri); if (uri) { sourceImage.value = uri; sourceImageUrl.value = url || uri; sourceImageFile.value = null; estimateInfo.value = {} } showGalleryModal.value = false }
const ensureUploadedImage = async () => { if (!sourceImageFile.value) return sourceImage.value; const previewUrl = sourceImageUrl.value; uploading.value = true; try { const res: any = await uploadImage({ file: sourceImageFile.value }); const uri = res?.uri || res?.url || res; sourceImage.value = uri; sourceImageUrl.value = previewUrl || resolveUploadPreviewUrl(res?.url || uri, uri); sourceImageFile.value = null; return uri } finally { uploading.value = false } }
const buildParams = async (uploadLocalImage = true) => ({ source_image: uploadLocalImage ? await ensureUploadedImage() : (sourceImageFile.value ? '' : sourceImage.value), ratio: ratio.value, duration: duration.value, video_type_code: videoTypeCode.value, prompt: prompt.value.trim() })
const estimate = async () => { if (!ratio.value || !duration.value || !videoTypeCode.value) return; estimateInfo.value = await estimateAigcProductPromoVideo(await buildParams(false), { ignoreCancelToken: true }) }
const submit = async () => { if (!canSubmit.value) return; submitting.value = true; try { const params = await buildParams(); const res: any = await generateAigcProductPromoVideo(params, { ignoreCancelToken: true }); estimateInfo.value = res?.estimate || {}; await refreshTasks(); startPolling() } finally { submitting.value = false } }
const handleWritePrompt = async () => { promptWriting.value = true; try { const res: any = await writeAigcProductPromoVideoPrompt({ ratio: ratio.value, duration: duration.value, video_type_code: videoTypeCode.value, hint: prompt.value }, { ignoreCancelToken: true }); if (res?.prompt) prompt.value = res.prompt } finally { promptWriting.value = false } }
const handleOptimizePrompt = async () => { promptWriting.value = true; try { const res: any = await optimizeAigcProductPromoVideoPrompt({ ratio: ratio.value, duration: duration.value, video_type_code: videoTypeCode.value, prompt: prompt.value }, { ignoreCancelToken: true }); if (res?.prompt) prompt.value = res.prompt } finally { promptWriting.value = false } }
const refreshTasks = async () => { taskLoading.value = true; try { const res: any = await getAigcProductPromoVideoTasks({ page_no: 1, page_size: 30, status: activeTaskStatusFilter.value }); tasks.value = res?.lists || [] } finally { taskLoading.value = false } }
const selectTaskStatus = async (status: TaskStatusFilter) => { activeTaskStatusFilter.value = status; await refreshTasks() }
const startPolling = () => { stopPolling(); if (!tasks.value.some(isTaskRunning)) return; pollTimer = window.setInterval(async () => { await refreshTasks(); if (!tasks.value.some(isTaskRunning)) stopPolling() }, 5000) }
const stopPolling = () => { if (pollTimer) window.clearInterval(pollTimer); pollTimer = null }
const handlePanelEdit = (task: any) => { const raw = task.raw || {}; sourceImage.value = raw.source_image || ''; sourceImageUrl.value = raw.source_image_url || sourceImage.value; ratio.value = raw.ratio || ratio.value; duration.value = Number(raw.duration || duration.value); videoTypeCode.value = raw.type_code || videoTypeCode.value; prompt.value = raw.user_prompt || '' }
const handlePanelRegenerate = async (task: any) => { handlePanelEdit(task); await submit() }
const handlePanelPreviewReference = (reference: any) => { previewImage.value = reference.url; previewTitle.value = reference.label || '产品图' }
const handlePanelPreview = (item: any) => { previewVideo.value = item.url || item.downloadUrl || '' }
const handlePanelDownloadOne = (item: any) => { const url = item.downloadUrl || item.url; if (url) window.open(url, '_blank') }
const handlePanelDownloadAll = async (task: any) => { const id = taskId(task.raw || task); await downloadTaskResults(id, task.items || [], `product-promo-video-${id}.zip`) }
const handlePanelDeleteOne = async (_item: any, task: any) => { await handlePanelDeleteAll(task) }
const handlePanelDeleteAll = async (task: any) => { const id = taskId(task.raw || task); if (!id) return; await deleteAigcProductPromoVideoTask({ id }); await refreshTasks() }
const closePreview = () => { previewImage.value = ''; previewTitle.value = '' }
const closeVideoPreview = () => { previewVideo.value = '' }
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const resultId = (item: any) => Number(item?.id || item?.result_id || 0)
const resultVideoUrl = (item: any) => resolvePcDownloadUrl(item?.video_url || item?.download_url || item?.url || '')
const normalizeTaskStatus = (status: any) => ['pending', 'running', 'success', 'failed', 'canceled'].includes(String(status)) ? String(status) : 'running'
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const statusText = (status: string) => ({ pending: '排队中', running: '生成中', success: '已完成', failed: '已失败', canceled: '已取消' }[status] || '生成中')
const taskStateDescription = (item: any) => item?.error || (normalizeTaskStatus(item?.status) === 'failed' ? '生成失败，请稍后重试' : 'AI 正在生成，请稍候')
const formatTaskTime = (value: any) => { const num = Number(value || 0); if (!num) return ''; const d = new Date(num * 1000); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
watch([sourceImage, ratio, duration, videoTypeCode], () => { estimateInfo.value = {}; estimate() })
onMounted(async () => { await loadConfig(); await refreshTasks(); startPolling(); document.addEventListener('click', closeDropdowns) })
onUnmounted(() => { stopPolling(); document.removeEventListener('click', closeDropdowns); blobUrls.forEach((url) => URL.revokeObjectURL(url)) })
const closeDropdowns = () => { ratioMenuOpen.value = false; durationMenuOpen.value = false }
</script>

<style scoped lang="scss">
@use '../aigc_product_image/photo_restore_workbench' as *;

.promo-video-page { height: 100%; min-width: calc(403px + 24px + 560px); }
.upload-card { height: 176px; min-height: 176px; }
.upload-card__placeholder small { color: rgba(255,255,255,.42); font-size: 12px; line-height: 18px; text-align: center; }
.upload-card__stage { position: relative; width: 100%; height: 100%; background: #050505; }
.upload-card__stage img { width: 100%; height: 100%; object-fit: contain; }
.upload-card__actions { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px; background: rgba(5,5,5,.42); opacity: 0; pointer-events: none; backdrop-filter: blur(2px); transition: opacity .2s ease; }
.upload-card.is-filled:hover .upload-card__actions { opacity: 1; pointer-events: auto; }
.field-actions { display: inline-flex; align-items: center; gap: 8px; }
.field-actions button { height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: #262626; color: rgba(255,255,255,.82); font-size: 12px; cursor: pointer; }
.field-actions button:disabled { opacity: .5; cursor: not-allowed; }
.type-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
.type-card { min-width: 0; padding: 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #171717; color: rgba(255,255,255,.72); cursor: pointer; text-align: left; transition: border-color .2s ease, background .2s ease; }
.type-card:hover { border-color: rgba(255,255,255,.18); background: #1f1f1f; }
.type-card.is-active { border-color: #fff; color: #fff; }
.type-card__cover { display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 16 / 9; border-radius: 9px; background: #0f0f0f; color: rgba(255,255,255,.42); font-size: 12px; overflow: hidden; }
.type-card__cover img { width: 100%; height: 100%; object-fit: cover; }
.type-card__body { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.type-card__body strong { overflow: hidden; color: currentColor; font-size: 13px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.type-card__body span { display: -webkit-box; overflow: hidden; color: rgba(255,255,255,.48); font-size: 12px; line-height: 17px; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.video-preview { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 52px; background: rgba(0,0,0,.82); box-sizing: border-box; }
.video-preview video { max-width: min(100%, 1100px); max-height: calc(100vh - 104px); border-radius: 14px; background: #050505; }
@media (max-width: 1200px) { .promo-video-page { min-width: 0; } }
</style>
