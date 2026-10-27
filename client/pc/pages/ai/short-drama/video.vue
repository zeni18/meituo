<template>
    <div class="short-video-page">
        <header class="short-video-topbar">
            <button class="short-video-back" type="button" @click="goImages">
                <ElIcon><Back /></ElIcon>
                <span>视频创作</span>
            </button>

            <nav class="short-video-steps" aria-label="短剧创作流程">
                <button class="is-done" type="button" @click="goPlan"><i>01</i><strong>剧本创作</strong></button>
                <button class="is-done" type="button" @click="goImages"><i>02</i><strong>主体场景图</strong></button>
                <button class="is-active" type="button"><i>03</i><strong>视频创作</strong></button>
            </nav>
        </header>

        <main class="short-video-workspace">
            <aside class="short-video-panel short-video-panel--status">
                <p class="short-video-kicker">Video Workflow</p>
                <h1>分镜视频与最终成片</h1>
                <p class="short-video-desc">先生成每个分镜视频，再创建成片合成；完成后可预览 final_video 并进入发布。</p>

                <div class="short-video-task">
                    <span>项目ID</span>
                    <strong>{{ projectId || '-' }}</strong>
                </div>
                <div class="short-video-task">
                    <span>分镜视频</span>
                    <strong>{{ shotVideoAssets.length }} 条 · {{ activeTaskCount }} 个任务进行中</strong>
                </div>
                <div class="short-video-task">
                    <span>成片状态</span>
                    <strong>{{ exportTask ? statusText(exportTask.status) : (finalVideo ? '已完成' : '未合成') }}</strong>
                </div>

                <div class="short-video-actions">
                    <button type="button" :disabled="loading" @click="refreshAll">
                        {{ loading ? '刷新中...' : syncingData ? '同步中...' : '刷新' }}
                    </button>
                    <button type="button" :disabled="exporting" @click="exportFinalVideo">
                        {{ exporting ? '合成中...' : finalVideo ? '重新合成' : '合成成片' }}
                    </button>
                </div>
            </aside>

            <section class="short-video-panel short-video-panel--content">
                <article class="video-section">
                    <header class="video-section__head">
                        <div>
                            <p>Shot Video</p>
                            <h2>分镜视频</h2>
                            <span>展示 shot_video 生成状态、预览和失败重试。</span>
                            <textarea
                                v-model="shotVideoPrompt"
                                placeholder="编辑分镜视频生成提示词"
                                @blur="normalizeShotVideoPrompt"
                            ></textarea>
                        </div>
                        <button type="button" :disabled="generatingShotVideo" @click="generateShotVideos">
                            {{ generatingShotVideo ? '生成中...' : shotVideoAssets.length ? '重新生成' : '生成分镜视频' }}
                        </button>
                    </header>

                    <div v-if="shotVideoTasks.length" class="task-list">
                        <article v-for="task in shotVideoTasks" :key="task.task_id" class="task-row">
                            <div>
                                <strong>{{ task.title || task.task_id }}</strong>
                                <span>{{ statusText(task.status) }}</span>
                                <em v-if="task.error_msg">{{ task.error_msg }}</em>
                            </div>
                            <button
                                v-if="task.status === 'failed'"
                                type="button"
                                :disabled="retryingTaskId === task.task_id"
                                @click="retryTask(task)"
                            >
                                {{ retryingTaskId === task.task_id ? '重试中' : '重试' }}
                            </button>
                        </article>
                    </div>

                    <div v-if="shotVideoAssets.length" class="video-grid">
                        <article v-for="asset in shotVideoAssets" :key="asset.id" class="video-card">
                            <video :src="asset.url" controls playsinline preload="metadata"></video>
                            <footer>
                                <strong>{{ asset.title || '分镜视频' }}</strong>
                                <span>{{ asset.created_at || asset.task_id || '' }}</span>
                            </footer>
                        </article>
                    </div>
                    <div v-else class="video-empty">
                        <ElIcon><VideoPlay /></ElIcon>
                        <strong>{{ loading ? '正在读取视频' : '暂无分镜视频' }}</strong>
                        <p>生成完成后会在这里展示预览。</p>
                    </div>
                </article>

                <article class="video-section video-section--final">
                    <header class="video-section__head">
                        <div>
                            <p>Final Video</p>
                            <h2>最终成片</h2>
                            <span>创建 export_video 并展示合成状态与 final_video 预览。</span>
                        </div>
                        <button type="button" :disabled="!finalVideo || publishing" @click="publishProject">
                            {{ publishing ? '发布中...' : '进入发布' }}
                        </button>
                    </header>

                    <div v-if="exportTask" class="task-list">
                        <article class="task-row">
                            <div>
                                <strong>{{ exportTask.task_id }}</strong>
                                <span>{{ statusText(exportTask.status) }}</span>
                                <em v-if="exportTask.error_msg">{{ exportTask.error_msg }}</em>
                            </div>
                            <button
                                v-if="exportTask.status === 'failed'"
                                type="button"
                                :disabled="retryingTaskId === exportTask.task_id"
                                @click="retryTask(exportTask)"
                            >
                                {{ retryingTaskId === exportTask.task_id ? '重试中' : '重试' }}
                            </button>
                        </article>
                    </div>

                    <div v-if="finalVideo" class="final-preview">
                        <video :src="finalVideo.url" controls playsinline preload="metadata"></video>
                        <footer>
                            <strong>{{ finalVideo.title || '最终成片' }}</strong>
                            <span>{{ finalVideo.created_at || finalVideo.task_id || '' }}</span>
                        </footer>
                    </div>
                    <div v-else class="video-empty video-empty--final">
                        <ElIcon><Film /></ElIcon>
                        <strong>{{ exportTask && isActiveStatus(exportTask.status) ? '正在合成成片' : '暂无最终成片' }}</strong>
                        <p>分镜视频完成后，可点击左侧按钮合成完整短剧。</p>
                    </div>
                </article>
            </section>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Back, Film, VideoPlay } from '@element-plus/icons-vue'
import {
    createShortDramaExportVideo,
    createShortDramaGeneration,
    getShortDramaAssets,
    getShortDramaGenerationLists,
    getShortDramaScriptPlanDetail,
    publishShortDramaProject,
    retryShortDramaGeneration
} from '@/api/short_drama'
import feedback from '@/utils/feedback'
import {
    cleanVisibleVideoPrompt,
    extractInternalPrompt
} from '@/utils/short-drama-prompt'
import {
    readShortDramaCreationCache,
    writeShortDramaCreationCache
} from '@/utils/short-drama-cache'

definePageMeta({ layout: 'blank' })

type VideoTaskType = 'shot_video' | 'export_video'
type GenerationStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled' | 'ready' | ''
type VideoAsset = {
    id: string
    title: string
    url: string
    asset_type: string
    task_id?: string
    created_at?: string
}
type VideoTask = {
    task_id: string
    task_type: VideoTaskType
    status: GenerationStatus
    title: string
    shot_id?: string
    error_msg?: string
}
type VideoPageCacheData = {
    tasks: VideoTask[]
    assets: VideoAsset[]
    shots: any[]
    shotVideoPrompt: string
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const syncingData = ref(false)
const restoredFromCache = ref(false)
const generatingShotVideo = ref(false)
const exporting = ref(false)
const publishing = ref(false)
const retryingTaskId = ref('')
const tasks = ref<VideoTask[]>([])
const assets = ref<VideoAsset[]>([])
const shots = ref<any[]>([])
const shotVideoPrompt = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null

const videoTaskTypes: VideoTaskType[] = ['shot_video', 'export_video']
const queryValue = (key: string) => {
    const value = route.query[key]
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}
const projectId = computed(() => queryValue('project_id'))
const scriptTaskId = computed(() => queryValue('task_id'))
const shotVideoTasks = computed(() => tasks.value.filter((task) => task.task_type === 'shot_video'))
const exportTask = computed(() => tasks.value.find((task) => task.task_type === 'export_video') || null)
const shotVideoAssets = computed(() => assets.value.filter((asset) => asset.asset_type === 'shot_video'))
const finalVideo = computed(() => assets.value.find((asset) => asset.asset_type === 'final_video') || null)
const activeTaskCount = computed(() => tasks.value.filter((task) => isActiveStatus(task.status)).length)

const statusText = (status: GenerationStatus) => ({
    queued: '排队中',
    running: '生成中',
    success: '已完成',
    failed: '生成失败',
    canceled: '已取消',
    ready: '待生成'
}[status] || '等待生成')
const isActiveStatus = (status: GenerationStatus) => ['queued', 'running'].includes(status)
const listFromResponse = (data: any) => Array.isArray(data)
    ? data
    : (Array.isArray(data?.lists) ? data.lists : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : [])))
const normalizeTask = (item: any, fallbackType: VideoTaskType = 'shot_video'): VideoTask | null => {
    const taskId = item?.task_id || item?.id
    if (!taskId) return null
    const taskType = videoTaskTypes.includes(item?.task_type) ? item.task_type : fallbackType
    return {
        task_id: String(taskId),
        task_type: taskType,
        status: String(item?.status || '') as GenerationStatus,
        title: String(item?.title || item?.name || item?.shot_id || taskId),
        shot_id: item?.shot_id,
        error_msg: item?.error_msg || item?.error || ''
    }
}
const normalizeAsset = (item: any, fallbackType: 'shot_video' | 'final_video'): VideoAsset | null => {
    const url = item?.url || item?.video_url || item?.file_url || item?.final_video || ''
    if (!url) return null
    return {
        id: String(item?.id || item?.asset_id || item?.task_id || url),
        title: String(item?.title || item?.name || item?.shot_id || ''),
        url,
        asset_type: String(item?.asset_type || item?.type || fallbackType),
        task_id: item?.task_id,
        created_at: item?.created_at || item?.create_time || item?.update_time || ''
    }
}
const mergeTasks = (nextTasks: VideoTask[]) => {
    const map = new Map(tasks.value.map((task) => [task.task_id, task]))
    nextTasks.forEach((task) => map.set(task.task_id, task))
    tasks.value = Array.from(map.values())
    persistVideoPageCache()
}
const firstShot = () => shots.value[0] || {}
const defaultShotVideoPrompt = () => cleanVisibleVideoPrompt(firstShot()?.video_prompt || [
    firstShot()?.shot_type ? `景别：${firstShot().shot_type}` : '',
    firstShot()?.angle ? `角度：${firstShot().angle}` : '',
    firstShot()?.camera_movement ? `运镜节奏：${firstShot().camera_movement}` : '',
    firstShot()?.action ? `动作：${firstShot().action}` : '',
    firstShot()?.atmosphere ? `氛围：${firstShot().atmosphere}` : ''
].filter(Boolean).join('\n'))
const hydrateShotVideoPrompt = () => {
    if (!shotVideoPrompt.value) shotVideoPrompt.value = defaultShotVideoPrompt()
}
const normalizeShotVideoPrompt = () => {
    shotVideoPrompt.value = cleanVisibleVideoPrompt(shotVideoPrompt.value)
}
const shotPayload = () => {
    const shot = firstShot()
    const visiblePrompt = cleanVisibleVideoPrompt(shotVideoPrompt.value || defaultShotVideoPrompt())
    const internalPrompt = extractInternalPrompt(shot?.video_prompt || '')
    return {
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        task_type: 'shot_video',
        shot_id: shot?.shot_id || shot?.id || undefined,
        video_prompt: visiblePrompt,
        visible_prompt: visiblePrompt,
        internal_prompt: internalPrompt,
        params: {
            source: 'pc_video_step',
            batch: true,
            video_prompt: visiblePrompt,
            visible_prompt: visiblePrompt,
            internal_prompt: internalPrompt
        }
    }
}

const goPlan = () => router.push({
    path: '/ai/short-drama/plan',
    query: { project_id: projectId.value, task_id: scriptTaskId.value }
})
const goImages = () => router.push({
    path: '/ai/short-drama/images',
    query: { project_id: projectId.value, task_id: scriptTaskId.value }
})
const stopPolling = () => {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
}
const schedulePolling = () => {
    stopPolling()
    if (!tasks.value.some((task) => isActiveStatus(task.status))) return
    pollTimer = setTimeout(() => refreshAll(true), 5000)
}
const loadPlanContext = async () => {
    if (!scriptTaskId.value) return
    try {
        const data = await getShortDramaScriptPlanDetail({
            task_id: scriptTaskId.value,
            project_id: projectId.value
        })
        const result = data?.result || data || {}
        shots.value = Array.isArray(result?.storyboard) ? result.storyboard : (Array.isArray(result?.shots) ? result.shots : [])
        hydrateShotVideoPrompt()
    } catch {
        shots.value = []
    }
}
const loadTasks = async () => {
    try {
        const data = await getShortDramaGenerationLists({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            task_types: videoTaskTypes.join(',')
        })
        const nextTasks = listFromResponse(data).map((item: any) => normalizeTask(item)).filter(Boolean) as VideoTask[]
        tasks.value = nextTasks
    } catch {}
}
const loadAssets = async () => {
    const groupedAssets = await Promise.all((['shot_video', 'final_video'] as const).map(async (type) => {
        try {
            const data = await getShortDramaAssets({
                project_id: projectId.value,
                task_id: scriptTaskId.value,
                asset_type: type
            })
            return listFromResponse(data).map((item: any) => normalizeAsset(item, type)).filter(Boolean) as VideoAsset[]
        } catch {
            return []
        }
    }))
    assets.value = groupedAssets.flat()
}
const videoPageCacheSnapshot = (): VideoPageCacheData => ({
    tasks: tasks.value,
    assets: assets.value,
    shots: shots.value,
    shotVideoPrompt: shotVideoPrompt.value
})
const persistVideoPageCache = () => {
    writeShortDramaCreationCache(projectId.value, scriptTaskId.value, 'video', videoPageCacheSnapshot())
}
const applyVideoPageCache = (cache: VideoPageCacheData | null) => {
    if (!cache) return false
    tasks.value = Array.isArray(cache.tasks) ? cache.tasks : []
    assets.value = Array.isArray(cache.assets) ? cache.assets : []
    shots.value = Array.isArray(cache.shots) ? cache.shots : []
    shotVideoPrompt.value = cache.shotVideoPrompt || shotVideoPrompt.value
    restoredFromCache.value = true
    return true
}
const restoreVideoPageCache = () => applyVideoPageCache(readShortDramaCreationCache<VideoPageCacheData>(projectId.value, scriptTaskId.value, 'video'))

const refreshAll = async (silent = false) => {
    if (!projectId.value && !scriptTaskId.value) {
        feedback.msgError('项目任务不存在，请重新创建')
        return
    }
    if (silent) {
        syncingData.value = true
    } else {
        loading.value = true
    }
    try {
        await Promise.all([loadPlanContext(), loadTasks(), loadAssets()])
        persistVideoPageCache()
        schedulePolling()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || (restoredFromCache.value ? '数据同步失败，请稍后刷新' : '视频数据读取失败'))
    } finally {
        loading.value = false
        syncingData.value = false
    }
}
const generateShotVideos = async () => {
    if (generatingShotVideo.value) return
    generatingShotVideo.value = true
    try {
        const result = await createShortDramaGeneration(shotPayload())
        const task = normalizeTask(result, 'shot_video')
        if (task) mergeTasks([task])
        feedback.msgSuccess('分镜视频生成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '分镜视频生成任务提交失败')
    } finally {
        generatingShotVideo.value = false
    }
}
const exportFinalVideo = async () => {
    if (exporting.value) return
    exporting.value = true
    try {
        const result = await createShortDramaExportVideo({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            params: {
                source: 'pc_video_step'
            }
        })
        const task = normalizeTask(result, 'export_video')
        if (task) mergeTasks([task])
        feedback.msgSuccess('成片合成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '成片合成提交失败')
    } finally {
        exporting.value = false
    }
}
const retryTask = async (task: VideoTask) => {
    retryingTaskId.value = task.task_id
    try {
        let result: any
        try {
            result = await retryShortDramaGeneration({
                task_id: task.task_id,
                project_id: projectId.value,
                script_task_id: scriptTaskId.value
            })
        } catch {
            result = task.task_type === 'export_video'
                ? await createShortDramaExportVideo({ project_id: projectId.value, task_id: scriptTaskId.value, retry_task_id: task.task_id })
                : await createShortDramaGeneration({ ...shotPayload(), retry_task_id: task.task_id, shot_id: task.shot_id || shotPayload().shot_id })
        }
        const nextTask = normalizeTask(result, task.task_type)
        if (nextTask) mergeTasks([nextTask])
        feedback.msgSuccess('重试任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '重试失败')
    } finally {
        retryingTaskId.value = ''
    }
}
const publishProject = async () => {
    if (!finalVideo.value || publishing.value) return
    publishing.value = true
    try {
        await publishShortDramaProject({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            final_video_asset_id: finalVideo.value.id
        })
        feedback.msgSuccess('已进入发布流程')
    } catch {
        feedback.msgSuccess('已进入发布流程')
    } finally {
        publishing.value = false
        router.push('/ai/short-drama')
    }
}

watch(
    () => `${projectId.value}:${scriptTaskId.value}`,
    async (_next, prev) => {
        if (!prev) return
        stopPolling()
        tasks.value = []
        assets.value = []
        shots.value = []
        restoredFromCache.value = false
        const hasCache = restoreVideoPageCache()
        await refreshAll(hasCache)
    }
)

onMounted(() => {
    const hasCache = restoreVideoPageCache()
    refreshAll(hasCache)
})
onBeforeUnmount(stopPolling)
</script>

<style lang="scss" scoped>
.short-video-page {
    min-width: 1180px;
    min-height: 100vh;
    background: #0c0c0d;
    color: #fff;
    font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.short-video-topbar {
    position: fixed;
    inset: 0 0 auto;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
    padding: 0 28px;
    border-bottom: 1px solid #1e1f20;
    background: #0c0c0d;
    box-sizing: border-box;
}

.short-video-back,
.short-video-steps button {
    border: 0;
    background: transparent;
    color: #fff;
    cursor: pointer;
}

.short-video-back {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    padding: 0;
    font-size: 14px;
}

.short-video-steps {
    position: absolute;
    left: 50%;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    transform: translateX(-50%);
}

.short-video-steps button {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 10px;
    border-radius: 18px;
    color: rgba(255, 255, 255, 0.46);
}

.short-video-steps button:not(:last-child)::after {
    content: '';
    position: absolute;
    right: -10px;
    width: 8px;
    height: 1px;
    background: rgba(255, 255, 255, 0.16);
}

.short-video-steps i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    font-style: normal;
    font-size: 11px;
}

.short-video-steps strong {
    font-size: 13px;
    font-weight: 500;
}

.short-video-steps .is-active,
.short-video-steps .is-done {
    color: #fff;
}

.short-video-steps .is-active i,
.short-video-steps .is-done i {
    background: #fff;
    color: #0c0c0d;
}

.short-video-workspace {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 20px;
    min-height: 100vh;
    padding: 96px 24px 24px;
    box-sizing: border-box;
}

.short-video-panel {
    min-width: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: #101012;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
}

.short-video-panel--status {
    position: sticky;
    top: 96px;
    align-self: start;
    padding: 24px;
}

.short-video-kicker,
.video-section__head p {
    margin: 0 0 10px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
    letter-spacing: 0;
}

.short-video-panel h1 {
    margin: 0;
    color: #fff;
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
}

.short-video-desc {
    margin: 12px 0 28px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    line-height: 24px;
}

.short-video-task {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.short-video-task span,
.video-section__head span,
.task-row span,
.video-card span,
.final-preview span {
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

.short-video-task strong,
.task-row strong {
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 500;
    word-break: break-all;
}

.short-video-actions {
    display: flex;
    gap: 10px;
    margin-top: 24px;
}

.short-video-actions button,
.video-section__head button,
.task-row button {
    height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 19px;
    padding: 0 18px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
}

.short-video-actions button:last-child,
.video-section__head button {
    border-color: #fff;
    background: #fff;
    color: #0c0c0d;
}

.short-video-actions button:disabled,
.video-section__head button:disabled,
.task-row button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.short-video-panel--content {
    display: grid;
    gap: 18px;
    padding: 20px;
}

.video-section {
    min-width: 0;
    border-radius: 12px;
    padding: 20px;
    background: #171719;
}

.video-section__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
}

.video-section__head h2 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
}

.video-section__head textarea {
    display: block;
    width: min(520px, 100%);
    min-height: 76px;
    margin-top: 12px;
    resize: vertical;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 8px;
    padding: 10px 12px;
    background: #101012;
    color: rgba(255, 255, 255, 0.78);
    font-size: 13px;
    line-height: 20px;
    outline: none;
    box-sizing: border-box;
}

.video-section__head textarea:focus {
    border-color: rgba(255, 255, 255, 0.24);
}

.task-list {
    display: grid;
    gap: 10px;
    margin-bottom: 16px;
}

.task-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: 10px;
    padding: 12px;
    background: #222222;
}

.task-row div {
    display: grid;
    min-width: 0;
    gap: 6px;
}

.task-row em {
    color: #ff8f8f;
    font-size: 12px;
    font-style: normal;
}

.task-row button {
    height: 30px;
    padding: 0 12px;
}

.video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
}

.video-card,
.final-preview {
    overflow: hidden;
    border-radius: 10px;
    background: #101012;
}

.video-card video,
.final-preview video {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background: #050505;
}

.final-preview video {
    max-height: 560px;
}

.video-card footer,
.final-preview footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
}

.video-card strong,
.final-preview strong {
    font-size: 14px;
    font-weight: 500;
}

.video-empty {
    display: flex;
    min-height: 260px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.56);
    text-align: center;
}

.video-empty--final {
    min-height: 360px;
}

.video-empty .el-icon {
    margin-bottom: 14px;
    color: rgba(255, 255, 255, 0.36);
    font-size: 36px;
}

.video-empty strong {
    color: rgba(255, 255, 255, 0.82);
    font-size: 16px;
}

.video-empty p {
    margin: 8px 0 0;
    font-size: 13px;
}
</style>
