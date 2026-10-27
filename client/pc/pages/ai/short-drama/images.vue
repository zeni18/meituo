<template>
    <div class="subject-scene-page">
        <header class="subject-scene-topbar">
            <button class="subject-scene-back" type="button" @click="goPlan">
                <ElIcon><Back /></ElIcon>
                <span>主体场景图</span>
            </button>

            <nav class="subject-scene-steps" aria-label="短剧创作流程">
                <button class="is-done" type="button" @click="goPlan"><i>01</i><strong>剧本创作</strong></button>
                <button class="is-active" type="button"><i>02</i><strong>主体场景图</strong></button>
                <button type="button" @click="goVideo"><i>03</i><strong>视频创作</strong></button>
            </nav>
        </header>

        <main class="subject-scene-workspace">
            <aside class="subject-scene-panel subject-scene-panel--status">
                <p class="subject-scene-kicker">Image Workflow</p>
                <h1>短剧视觉资产</h1>
                <p class="subject-scene-desc">管理主体、场景和分镜关键图，生成结果会保存到当前短剧项目。</p>

                <div class="subject-scene-task">
                    <span>项目ID</span>
                    <strong>{{ projectId || '-' }}</strong>
                </div>
                <div class="subject-scene-task">
                    <span>剧本任务</span>
                    <strong>{{ scriptTaskId || '-' }}</strong>
                </div>
                <div class="subject-scene-task">
                    <span>资产统计</span>
                    <strong>{{ totalAssets }} 张 · {{ activeTaskCount }} 个任务进行中</strong>
                </div>

                <div class="subject-scene-actions">
                    <button type="button" :disabled="loading" @click="refreshAll">
                        {{ loading ? '刷新中...' : syncingData ? '同步中...' : '刷新' }}
                    </button>
                    <button type="button" @click="goVideo">继续视频创作</button>
                </div>
            </aside>

            <section class="subject-scene-panel subject-scene-panel--gallery">
                <article v-for="group in imageGroups" :key="group.type" class="image-group">
                    <header class="image-group__head">
                        <div>
                            <p>{{ group.kicker }}</p>
                            <h2>{{ group.title }}</h2>
                            <span>{{ group.desc }}</span>
                            <textarea
                                v-model="groupPromptDrafts[group.type]"
                                :placeholder="groupPromptPlaceholder(group.type)"
                                @blur="normalizeGroupPrompt(group.type)"
                            ></textarea>
                        </div>
                        <button
                            type="button"
                            :disabled="generatingType === group.type"
                            @click="generateGroup(group.type)"
                        >
                            {{ generatingType === group.type ? '生成中...' : group.assets.length ? '重新生成' : '生成' }}
                        </button>
                    </header>

                    <div v-if="group.tasks.length" class="task-strip">
                        <article v-for="task in group.tasks" :key="task.task_id" class="task-chip">
                            <div>
                                <strong>{{ task.title || task.task_id }}</strong>
                                <span>{{ statusText(task.status) }}</span>
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

                    <div v-if="group.assets.length" class="subject-scene-grid">
                        <article v-for="asset in group.assets" :key="asset.id" class="subject-scene-card">
                            <ShortDramaImagePreview :src="asset.url" :alt="asset.title || group.title" />
                            <footer>
                                <strong>{{ asset.title || group.title }}</strong>
                                <span>{{ asset.created_at || asset.task_id || '' }}</span>
                            </footer>
                        </article>
                    </div>
                    <div v-else class="subject-scene-empty">
                        <ElIcon><Picture /></ElIcon>
                        <strong>{{ loading ? '正在读取结果' : '暂无生成结果' }}</strong>
                        <p>{{ group.emptyText }}</p>
                    </div>
                </article>
            </section>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Back, Picture } from '@element-plus/icons-vue'
import {
    createShortDramaGeneration,
    getShortDramaAssets,
    getShortDramaGenerationDetail,
    getShortDramaGenerationLists,
    getShortDramaScriptPlanDetail,
    retryShortDramaGeneration
} from '@/api/short_drama'
import feedback from '@/utils/feedback'
import {
    cleanUserVisiblePrompt,
    cleanVisibleImagePrompt,
    extractInternalPrompt
} from '@/utils/short-drama-prompt'
import {
    readShortDramaCreationCache,
    writeShortDramaCreationCache
} from '@/utils/short-drama-cache'
import ShortDramaImagePreview from '~/components/short-drama/ShortDramaImagePreview.vue'

definePageMeta({ layout: 'blank' })

type ImageTaskType = 'subject_image' | 'scene_image' | 'shot_image'
type GenerationStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled' | 'ready' | ''
type AssetItem = {
    id: string
    title: string
    url: string
    asset_type: string
    task_id?: string
    created_at?: string
}
type GenerationTask = {
    task_id: string
    task_type: ImageTaskType
    status: GenerationStatus
    title: string
    shot_id?: string
    item_id?: string
    error_msg?: string
}
type ImagePageCacheData = {
    tasks: GenerationTask[]
    assets: AssetItem[]
    subjects: any[]
    scenes: any[]
    shots: any[]
    groupPromptDrafts: Record<ImageTaskType, string>
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const syncingData = ref(false)
const restoredFromCache = ref(false)
const generatingType = ref<ImageTaskType | ''>('')
const retryingTaskId = ref('')
const tasks = ref<GenerationTask[]>([])
const assets = ref<AssetItem[]>([])
const subjects = ref<any[]>([])
const scenes = ref<any[]>([])
const shots = ref<any[]>([])
const groupPromptDrafts = ref<Record<ImageTaskType, string>>({
    subject_image: '',
    scene_image: '',
    shot_image: ''
})
let pollTimer: ReturnType<typeof setTimeout> | null = null

const imageTypes: ImageTaskType[] = ['subject_image', 'scene_image', 'shot_image']
const groupMeta: Record<ImageTaskType, { title: string; kicker: string; desc: string; emptyText: string }> = {
    subject_image: {
        title: '主体统一图',
        kicker: 'Subject Image',
        desc: '生成角色外貌、服装和识别特征。',
        emptyText: '生成主体图后会在这里展示。'
    },
    scene_image: {
        title: '场景统一图',
        kicker: 'Scene Image',
        desc: '生成统一场景的要点、光线和环境资产。',
        emptyText: '生成场景图后会在这里展示。'
    },
    shot_image: {
        title: '分镜关键图',
        kicker: 'Shot Image',
        desc: '每个分镜的关键画面，用于后续视频生成。',
        emptyText: '生成分镜图后会在这里展示。'
    }
}

const queryValue = (key: string) => {
    const value = route.query[key]
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}
const projectId = computed(() => queryValue('project_id'))
const scriptTaskId = computed(() => queryValue('task_id'))
const generationTaskId = computed(() => queryValue('generation_task_id'))
const imageGroups = computed(() => imageTypes.map((type) => ({
    type,
    ...groupMeta[type],
    tasks: tasks.value.filter((task) => task.task_type === type),
    assets: assets.value.filter((asset) => asset.asset_type === type)
})))
const totalAssets = computed(() => assets.value.length)
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
const normalizeAsset = (item: any, fallbackType: ImageTaskType): AssetItem | null => {
    const url = item?.url || item?.image_url || item?.file_url || item?.cover_url || ''
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
const normalizeTask = (item: any, fallbackType: ImageTaskType = 'shot_image'): GenerationTask | null => {
    const taskId = item?.task_id || item?.id
    if (!taskId) return null
    const taskType = imageTypes.includes(item?.task_type) ? item.task_type : fallbackType
    return {
        task_id: String(taskId),
        task_type: taskType,
        status: String(item?.status || '') as GenerationStatus,
        title: String(item?.title || item?.name || item?.shot_id || item?.item_id || taskId),
        shot_id: item?.shot_id,
        item_id: item?.item_id || item?.subject_id || item?.scene_id,
        error_msg: item?.error_msg || item?.error || ''
    }
}
const mergeTasks = (nextTasks: GenerationTask[]) => {
    const map = new Map(tasks.value.map((task) => [task.task_id, task]))
    nextTasks.forEach((task) => map.set(task.task_id, task))
    tasks.value = Array.from(map.values())
    persistImagePageCache()
}
const itemId = (item: any) => String(item?.id || item?.subject_id || item?.scene_id || item?.shot_id || '')
const sourceItemsFor = (type: ImageTaskType) => {
    if (type === 'subject_image') return subjects.value
    if (type === 'scene_image') return scenes.value
    return shots.value
}
const defaultPromptForImageItem = (type: ImageTaskType, item: any = {}) => {
    if (type === 'shot_image') {
        return cleanVisibleImagePrompt(item?.image_prompt || [
            item?.scene_name || item?.scene,
            item?.time_of_day,
            item?.visual_description || item?.description,
            item?.composition ? `构图：${item.composition}` : '',
            item?.shot_type ? `景别：${item.shot_type}` : '',
            item?.angle ? `角度：${item.angle}` : '',
            item?.action ? `动作：${item.action}` : '',
            item?.result ? `结果：${item.result}` : '',
            item?.atmosphere ? `氛围：${item.atmosphere}` : ''
        ].filter(Boolean).join('\n'), [item?.video_prompt, item?.bgm_prompt, item?.dialogue])
    }
    return cleanUserVisiblePrompt(item?.visual_prompt || item?.image_prompt || item?.prompt || item?.description || item?.scene_description || item?.appearance_lock || item?.space_lock || '')
}
const groupPromptPlaceholder = (type: ImageTaskType) => {
    if (type === 'subject_image') return '编辑主体图生成提示词'
    if (type === 'scene_image') return '编辑场景图生成提示词'
    return '编辑分镜图生成提示词'
}
const normalizeGroupPrompt = (type: ImageTaskType) => {
    groupPromptDrafts.value[type] = cleanUserVisiblePrompt(groupPromptDrafts.value[type])
}
const hydrateGroupPrompts = () => {
    imageTypes.forEach((type) => {
        if (groupPromptDrafts.value[type]) return
        groupPromptDrafts.value[type] = defaultPromptForImageItem(type, sourceItemsFor(type)[0] || {})
    })
}
const buildPayload = (type: ImageTaskType, item: any = {}) => {
    const visiblePrompt = cleanUserVisiblePrompt(groupPromptDrafts.value[type] || defaultPromptForImageItem(type, item))
    const internalPrompt = extractInternalPrompt([
        item?.image_prompt,
        item?.visual_prompt,
        item?.unified_prompt,
        item?.video_prompt
    ].filter(Boolean).join('\n'))
    return {
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        task_type: type,
        subject_id: type === 'subject_image' ? itemId(item) || undefined : undefined,
        scene_id: type === 'scene_image' ? itemId(item) || undefined : undefined,
        shot_id: type === 'shot_image' ? String(item?.shot_id || item?.id || '') || undefined : undefined,
        prompt: visiblePrompt,
        visual_prompt: visiblePrompt,
        image_prompt: visiblePrompt,
        visible_prompt: visiblePrompt,
        internal_prompt: internalPrompt,
        params: {
            source: 'pc_image_step',
            batch: true,
            item_name: item?.name || item?.title || item?.scene_name || item?.subject_name || '',
            prompt: visiblePrompt,
            visual_prompt: visiblePrompt,
            image_prompt: visiblePrompt,
            visible_prompt: visiblePrompt,
            internal_prompt: internalPrompt
        }
    }
}
const groupPayload = (type: ImageTaskType) => buildPayload(type, sourceItemsFor(type)[0] || {})

const goPlan = () => router.push({
    path: '/ai/short-drama/plan',
    query: { project_id: projectId.value, task_id: scriptTaskId.value }
})
const goVideo = () => router.push({
    path: '/ai/short-drama/video',
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
        subjects.value = Array.isArray(result?.subjects) ? result.subjects : []
        scenes.value = Array.isArray(result?.scenes) ? result.scenes : (Array.isArray(result?.locations) ? result.locations : [])
        shots.value = Array.isArray(result?.storyboard) ? result.storyboard : (Array.isArray(result?.shots) ? result.shots : [])
        hydrateGroupPrompts()
    } catch {
        subjects.value = []
        scenes.value = []
        shots.value = []
    }
}
const loadGenerationTasks = async () => {
    const nextTasks: GenerationTask[] = []
    try {
        const data = await getShortDramaGenerationLists({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            task_types: imageTypes.join(',')
        })
        nextTasks.push(...listFromResponse(data).map((item: any) => normalizeTask(item)).filter(Boolean))
    } catch {}
    if (generationTaskId.value) {
        try {
            const detail = await getShortDramaGenerationDetail(generationTaskId.value)
            const detailTask = normalizeTask(detail, 'shot_image')
            if (detailTask) nextTasks.push(detailTask)
        } catch {}
    }
    const map = new Map(nextTasks.map((task) => [task.task_id, task]))
    tasks.value = Array.from(map.values())
}
const loadAssets = async () => {
    const groupedAssets = await Promise.all(imageTypes.map(async (type) => {
        try {
            const data = await getShortDramaAssets({
                project_id: projectId.value,
                task_id: scriptTaskId.value,
                asset_type: type
            })
            return listFromResponse(data).map((item: any) => normalizeAsset(item, type)).filter(Boolean) as AssetItem[]
        } catch {
            return []
        }
    }))
    assets.value = groupedAssets.flat()
}
const imagePageCacheSnapshot = (): ImagePageCacheData => ({
    tasks: tasks.value,
    assets: assets.value,
    subjects: subjects.value,
    scenes: scenes.value,
    shots: shots.value,
    groupPromptDrafts: groupPromptDrafts.value
})
const persistImagePageCache = () => {
    writeShortDramaCreationCache(projectId.value, scriptTaskId.value, 'images', imagePageCacheSnapshot())
}
const applyImagePageCache = (cache: ImagePageCacheData | null) => {
    if (!cache) return false
    tasks.value = Array.isArray(cache.tasks) ? cache.tasks : []
    assets.value = Array.isArray(cache.assets) ? cache.assets : []
    subjects.value = Array.isArray(cache.subjects) ? cache.subjects : []
    scenes.value = Array.isArray(cache.scenes) ? cache.scenes : []
    shots.value = Array.isArray(cache.shots) ? cache.shots : []
    groupPromptDrafts.value = cache.groupPromptDrafts || groupPromptDrafts.value
    restoredFromCache.value = true
    return true
}
const restoreImagePageCache = () => applyImagePageCache(readShortDramaCreationCache<ImagePageCacheData>(projectId.value, scriptTaskId.value, 'images'))

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
        await Promise.all([loadPlanContext(), loadGenerationTasks(), loadAssets()])
        persistImagePageCache()
        schedulePolling()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || (restoredFromCache.value ? '数据同步失败，请稍后刷新' : '图片数据读取失败'))
    } finally {
        loading.value = false
        syncingData.value = false
    }
}
const generateGroup = async (type: ImageTaskType) => {
    if (generatingType.value) return
    generatingType.value = type
    try {
        const sourceItems = sourceItemsFor(type)
        if (!sourceItems.length) {
            feedback.msgWarning('暂无可生成的项目')
            return
        }
        const results = await Promise.all(sourceItems.map((item) => createShortDramaGeneration(buildPayload(type, item))))
        const nextTasks = results.map((result) => normalizeTask(result, type)).filter(Boolean) as GenerationTask[]
        if (nextTasks.length) mergeTasks(nextTasks)
        feedback.msgSuccess('生成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '生成任务提交失败')
    } finally {
        generatingType.value = ''
    }
}
const retryTask = async (task: GenerationTask) => {
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
            result = await createShortDramaGeneration({
                ...groupPayload(task.task_type),
                retry_task_id: task.task_id,
                shot_id: task.shot_id || groupPayload(task.task_type).shot_id,
                item_id: task.item_id
            })
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

watch(
    () => `${projectId.value}:${scriptTaskId.value}`,
    async (_next, prev) => {
        if (!prev) return
        stopPolling()
        tasks.value = []
        assets.value = []
        subjects.value = []
        scenes.value = []
        shots.value = []
        restoredFromCache.value = false
        const hasCache = restoreImagePageCache()
        await refreshAll(hasCache)
    }
)

onMounted(() => {
    const hasCache = restoreImagePageCache()
    refreshAll(hasCache)
})
onBeforeUnmount(stopPolling)
</script>

<style lang="scss" scoped>
.subject-scene-page {
    min-width: 1180px;
    min-height: 100vh;
    background: #0c0c0d;
    color: #fff;
    font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.subject-scene-topbar {
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

.subject-scene-back,
.subject-scene-steps button {
    border: 0;
    background: transparent;
    color: #fff;
    cursor: pointer;
}

.subject-scene-back {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    padding: 0;
    font-size: 14px;
}

.subject-scene-steps {
    position: absolute;
    left: 50%;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    transform: translateX(-50%);
}

.subject-scene-steps button {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 10px;
    border-radius: 18px;
    color: rgba(255, 255, 255, 0.46);
}

.subject-scene-steps button:not(:last-child)::after {
    content: '';
    position: absolute;
    right: -10px;
    width: 8px;
    height: 1px;
    background: rgba(255, 255, 255, 0.16);
}

.subject-scene-steps i {
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

.subject-scene-steps strong {
    font-size: 13px;
    font-weight: 500;
}

.subject-scene-steps .is-active,
.subject-scene-steps .is-done {
    color: #fff;
}

.subject-scene-steps .is-active i,
.subject-scene-steps .is-done i {
    background: #fff;
    color: #0c0c0d;
}

.subject-scene-workspace {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 20px;
    min-height: 100vh;
    padding: 96px 24px 24px;
    box-sizing: border-box;
}

.subject-scene-panel {
    min-width: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: #101012;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
}

.subject-scene-panel--status {
    position: sticky;
    top: 96px;
    align-self: start;
    padding: 24px;
}

.subject-scene-kicker,
.image-group__head p {
    margin: 0 0 10px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
    letter-spacing: 0;
}

.subject-scene-panel h1 {
    margin: 0;
    color: #fff;
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
}

.subject-scene-desc {
    margin: 12px 0 28px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    line-height: 24px;
}

.subject-scene-task {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.subject-scene-task span,
.task-chip span,
.subject-scene-card span,
.image-group__head span {
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

.subject-scene-task strong,
.task-chip strong {
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 500;
    word-break: break-all;
}

.subject-scene-actions {
    display: flex;
    gap: 10px;
    margin-top: 24px;
}

.subject-scene-actions button,
.image-group__head button,
.task-chip button {
    height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 19px;
    padding: 0 18px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
}

.subject-scene-actions button:last-child,
.image-group__head button {
    border-color: #fff;
    background: #fff;
    color: #0c0c0d;
}

.subject-scene-actions button:disabled,
.image-group__head button:disabled,
.task-chip button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.subject-scene-panel--gallery {
    display: grid;
    gap: 18px;
    padding: 20px;
}

.image-group {
    min-width: 0;
    border-radius: 12px;
    padding: 20px;
    background: #171719;
}

.image-group__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
}

.image-group__head h2 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
}

.image-group__head textarea {
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

.image-group__head textarea:focus {
    border-color: rgba(255, 255, 255, 0.24);
}

.task-strip {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
}

.task-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    border-radius: 10px;
    padding: 12px;
    background: #222222;
}

.task-chip div {
    display: grid;
    min-width: 0;
    gap: 6px;
}

.task-chip button {
    height: 30px;
    padding: 0 12px;
}

.subject-scene-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
}

.subject-scene-card {
    overflow: hidden;
    border-radius: 10px;
    background: #101012;
}

.subject-scene-card img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background: #222;
}

.subject-scene-card :deep(.short-drama-image-preview),
.subject-scene-card :deep(.short-drama-image-preview__image) {
    width: 100%;
    aspect-ratio: 16 / 9;
}

.subject-scene-card footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
}

.subject-scene-card strong,
.subject-scene-card span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.subject-scene-card strong {
    font-size: 14px;
    font-weight: 500;
}

.subject-scene-empty {
    display: flex;
    min-height: 220px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.56);
    text-align: center;
}

.subject-scene-empty .el-icon {
    margin-bottom: 14px;
    color: rgba(255, 255, 255, 0.36);
    font-size: 34px;
}

.subject-scene-empty strong {
    color: rgba(255, 255, 255, 0.82);
    font-size: 16px;
}

.subject-scene-empty p {
    margin: 8px 0 0;
    font-size: 13px;
}
</style>
