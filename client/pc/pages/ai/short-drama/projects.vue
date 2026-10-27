<template>
    <div class="short-drama-project-page">
        <button class="short-drama-back" type="button" @click="goBackHome">
            <span class="short-drama-back__icon">
                <img :src="iconAssets.arrowRight" alt="" />
            </span>
            <span>返回首页</span>
        </button>

        <ShortDramaCreditPill
            :points="userPoints"
            :action-text="userStore.isLogin ? '\u5f00\u901a\u4f1a\u5458' : '\u767b\u5f55'"
            :membership-enabled="membershipEnabled"
            @refresh="loadUserPoints"
        />

        <ShortDramaSideNav active="project" />

        <main class="project-library">
            <section class="project-library__section" aria-label="我的项目">
                <div class="project-library__heading">
                    <h1>我的项目</h1>
                    <button type="button" :disabled="loadingProjects" @click="loadProjects(true)">
                        {{ loadingProjects ? '刷新中...' : '刷新' }}
                    </button>
                </div>

                <div v-if="projectCards.length" class="project-grid project-grid--library">
                    <button class="project-card project-card--new" type="button" @click="startNewProject">
                        <span class="project-card__plus"><ElIcon><Plus /></ElIcon></span>
                        <span>新建项目</span>
                    </button>

                    <article
                        v-for="project in projectCards"
                        :key="project.id"
                        class="project-card project-card--item"
                        :class="{ 'is-opening': openingProjectId === project.id }"
                        role="button"
                        tabindex="0"
                        @click="openProject(project)"
                        @keydown.enter.prevent="openProject(project)"
                    >
                        <img v-if="project.image" :src="project.image" :alt="project.title" />
                        <div v-else class="project-card__empty-cover"></div>
                        <button
                            class="project-card__more"
                            type="button"
                            :aria-expanded="activeProjectMenuId === project.id"
                            aria-label="更多操作"
                            @click.stop="toggleProjectMenu(project.id)"
                        >
                            <ElIcon><MoreFilled /></ElIcon>
                        </button>
                        <div v-if="activeProjectMenuId === project.id" class="project-card__menu" @click.stop>
                            <button type="button" @click="openCoverPicker(project)">
                                <ElIcon><Picture /></ElIcon>
                                <span>修改封面</span>
                            </button>
                            <button type="button" @click="renameProjectCard(project)">
                                <ElIcon><Edit /></ElIcon>
                                <span>重命名</span>
                            </button>
                            <button type="button" class="is-danger" @click="deleteProjectCard(project)">
                                <ElIcon><Delete /></ElIcon>
                                <span>删除</span>
                            </button>
                        </div>
                        <footer>
                            <span>{{ project.title }}</span>
                        </footer>
                    </article>
                </div>

                <div v-else class="project-empty">
                    <span class="project-card__plus"><ElIcon><Plus /></ElIcon></span>
                    <strong>{{ loadingProjects ? '正在读取项目...' : '暂无项目' }}</strong>
                    <p>{{ loadingProjects ? '请稍候，正在同步项目列表' : '创建一个短剧项目后，会在这里继续创作和管理。' }}</p>
                    <button v-if="!loadingProjects" type="button" @click="startNewProject">新建项目</button>
                </div>
            </section>
        </main>

        <Teleport to="body">
            <transition name="project-cover-fade">
                <div v-if="coverDialogVisible" class="project-cover-picker" @click.self="closeCoverPicker">
                    <div class="project-cover-picker__panel" role="dialog" aria-modal="true" aria-label="选择封面">
                        <header class="project-cover-picker__header">
                            <h3>选择封面</h3>
                            <button type="button" aria-label="关闭" @click="closeCoverPicker">
                                <ElIcon><Close /></ElIcon>
                            </button>
                        </header>
                        <div v-if="loadingCoverOptions" class="project-cover-picker__state">加载中...</div>
                        <div v-else-if="coverOptions.length" class="project-cover-picker__grid">
                            <button
                                v-for="option in coverOptions"
                                :key="option.id"
                                class="project-cover-option"
                                :class="{ 'is-selected': selectedCoverAssetId === option.id }"
                                type="button"
                                @click="selectedCoverAssetId = option.id"
                            >
                                <img :src="option.url || option.cover_url" :alt="option.title || '分镜封面'" />
                                <span class="project-cover-option__radio">
                                    <ElIcon v-if="selectedCoverAssetId === option.id"><Check /></ElIcon>
                                </span>
                            </button>
                        </div>
                        <div v-else class="project-cover-picker__state">
                            暂无可选分镜图，请先生成分镜图后再修改封面。
                        </div>
                        <footer class="project-cover-picker__footer">
                            <button type="button" @click="closeCoverPicker">取消</button>
                            <button
                                type="button"
                                class="is-primary"
                                :disabled="!selectedCoverAssetId || savingCover"
                                @click="saveCoverPicker"
                            >
                                {{ savingCover ? '保存中...' : '保存' }}
                            </button>
                        </footer>
                    </div>
                </div>
            </transition>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
    Check,
    Close,
    Delete,
    Edit,
    MoreFilled,
    Picture,
    Plus
} from '@element-plus/icons-vue'
import {
    deleteShortDramaProject,
    getShortDramaHome,
    getShortDramaProjectCoverOptions,
    getShortDramaProjectDetail,
    getShortDramaProjects,
    renameShortDramaProject,
    updateShortDramaProjectCover
} from '@/api/short_drama'
import { isPcLoginRequiredError, usePcLoginGate } from '@/composables/usePcLoginGate'
import { useUserStore } from '@/stores/user'
import feedback from '@/utils/feedback'
import ShortDramaSideNav from '~/components/short-drama/ShortDramaSideNav.vue'
import ShortDramaCreditPill from '~/components/short-drama/ShortDramaCreditPill.vue'

definePageMeta({ layout: 'blank' })

type ProjectCard = {
    id: string | number
    title: string
    image: string
    status?: string
    taskId?: string
    coverAssetId?: string | number
}
type ProjectCoverOption = {
    id: string | number
    title: string
    url: string
    cover_url?: string
    selected?: boolean
    shot_title?: string
    shot_sort?: number
}

const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()

const projectCards = ref<ProjectCard[]>([])
const loadingProjects = ref(false)
const openingProjectId = ref<string | number | null>(null)
const activeProjectMenuId = ref<string | number | null>(null)
const coverDialogVisible = ref(false)
const coverDialogProject = ref<ProjectCard | null>(null)
const coverOptions = ref<ProjectCoverOption[]>([])
const selectedCoverAssetId = ref<string | number | null>(null)
const loadingCoverOptions = ref(false)
const savingCover = ref(false)
const userPoints = ref(0)
const membershipEnabled = ref(false)
let previousHtmlOverflow = ''
let previousBodyOverflow = ''

const enablePageScroll = () => {
    previousHtmlOverflow = document.documentElement.style.overflow
    previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
}

const restorePageScroll = () => {
    document.documentElement.style.overflow = previousHtmlOverflow
    document.body.style.overflow = previousBodyOverflow
}

const withPublicBase = (path: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/${path.replace(/^\/+/, '')}` || '/'
}
const asset = (name: string) => withPublicBase(`/short-drama/figma/${name}.png`)
const iconAsset = (name: string) => withPublicBase(`/short-drama/figma/icon/${name}.svg`)
const sharedDramaImage = asset('c043b523b8dbf7fb1bb877caef75c7ce0d4f1e06')
const iconAssets = {
    arrowRight: iconAsset('Arrow-right')
}

const getRequestErrorMessage = (error: any, fallback: string) => {
    if (typeof error === 'string') return error
    return error?.msg || error?.message || fallback
}
const mapProject = (item: any): ProjectCard => ({
    id: item?.id || item?.task_id || '',
    title: item?.title || '未命名项目',
    image: item?.cover_url || item?.image || '',
    status: item?.status || '',
    taskId: item?.task_id || item?.last_task_id || item?.current_version?.task_id || '',
    coverAssetId: item?.cover_asset_id || ''
})
const hasUserToken = () => Boolean(userStore.restoreToken())
const handleCreditAction = () => {
    if (!hasUserToken()) {
        ensurePcLogin({
            redirect: '/ai/short-drama/projects',
            returnTo: '/ai/short-drama/projects'
        })
    }
}
const goBackHome = () => router.push('/ai')
const startNewProject = () => router.push('/ai/short-drama')
const updateProjectCardInLists = (project: ProjectCard) => {
    projectCards.value = projectCards.value.map((item) => (item.id === project.id ? { ...item, ...project } : item))
}
const removeProjectCardFromLists = (projectId: string | number) => {
    projectCards.value = projectCards.value.filter((item) => item.id !== projectId)
}
const toggleProjectMenu = (projectId: string | number) => {
    activeProjectMenuId.value = activeProjectMenuId.value === projectId ? null : projectId
}
const closeProjectMenu = () => {
    activeProjectMenuId.value = null
}
const openCoverPicker = async (project: ProjectCard) => {
    closeProjectMenu()
    coverDialogProject.value = project
    coverDialogVisible.value = true
    coverOptions.value = []
    selectedCoverAssetId.value = null
    loadingCoverOptions.value = true
    try {
        const data = await getShortDramaProjectCoverOptions(project.id)
        coverOptions.value = (Array.isArray(data?.lists) ? data.lists : []).map((item: any) => ({
            id: item?.id || '',
            title: item?.shot_title || item?.title || '',
            url: item?.url || '',
            cover_url: item?.cover_url || '',
            selected: !!item?.selected,
            shot_title: item?.shot_title || '',
            shot_sort: Number(item?.shot_sort || 0)
        }))
        const selected = coverOptions.value.find((item) => item.selected)
        selectedCoverAssetId.value = data?.selected_asset_id || selected?.id || coverOptions.value[0]?.id || null
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '封面列表读取失败'))
    } finally {
        loadingCoverOptions.value = false
    }
}
const closeCoverPicker = () => {
    if (savingCover.value) return
    coverDialogVisible.value = false
    coverDialogProject.value = null
    coverOptions.value = []
    selectedCoverAssetId.value = null
}
const saveCoverPicker = async () => {
    if (!coverDialogProject.value || !selectedCoverAssetId.value) return
    savingCover.value = true
    try {
        const updated = await updateShortDramaProjectCover({
            id: coverDialogProject.value.id,
            asset_id: selectedCoverAssetId.value
        })
        updateProjectCardInLists(mapProject(updated))
        feedback.msgSuccess('封面已更新')
        savingCover.value = false
        closeCoverPicker()
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '封面保存失败'))
    } finally {
        savingCover.value = false
    }
}
const renameProjectCard = async (project: ProjectCard) => {
    closeProjectMenu()
    try {
        const { value } = await feedback.prompt('请输入新的项目名称', '重命名', {
            inputValue: project.title,
            inputPattern: /\S+/,
            inputErrorMessage: '项目名称不能为空',
            confirmButtonText: '确定'
        })
        const title = String(value || '').trim()
        if (!title || title === project.title) return
        const updated = await renameShortDramaProject({ id: project.id, title })
        updateProjectCardInLists(mapProject(updated))
        feedback.msgSuccess('项目名称已更新')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(getRequestErrorMessage(error, '重命名失败'))
    }
}
const deleteProjectCard = async (project: ProjectCard) => {
    closeProjectMenu()
    try {
        await feedback.confirm(`确定删除「${project.title}」吗？删除后不会影响已保存的历史资产。`)
        await deleteShortDramaProject(project.id)
        removeProjectCardFromLists(project.id)
        await loadProjects(true)
        feedback.msgSuccess('项目已删除')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(getRequestErrorMessage(error, '删除失败'))
    }
}
const getProjectPlanTaskId = async (project: ProjectCard) => {
    if (project.taskId) return project.taskId
    const detail = await getShortDramaProjectDetail(project.id)
    return detail?.task_id || detail?.current_version?.task_id || ''
}
const openProject = async (project: ProjectCard) => {
    if (!project.id) {
        feedback.msgWarning('项目不存在')
        return
    }
    if (openingProjectId.value) return
    openingProjectId.value = project.id
    try {
        const taskId = await getProjectPlanTaskId(project)
        if (!taskId) {
            feedback.msgWarning('项目缺少剧本任务，请重新创建')
            return
        }
        await router.push({
            path: '/ai/short-drama/plan',
            query: {
                project_id: project.id,
                task_id: taskId
            }
        })
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '打开项目失败'))
    } finally {
        openingProjectId.value = null
    }
}
const loadProjects = async (force = false) => {
    if (!hasUserToken()) {
        ensurePcLogin({
            redirect: '/ai/short-drama/projects',
            returnTo: '/ai/short-drama/projects'
        })
        return
    }
    if (loadingProjects.value) return
    if (!force && projectCards.value.length) return
    loadingProjects.value = true
    try {
        const data = await getShortDramaProjects({ page_no: 1, page_size: 50 })
        projectCards.value = (Array.isArray(data?.lists) ? data.lists : []).map(mapProject)
    } catch (error: any) {
        if (isPcLoginRequiredError(error)) {
            userStore.logout()
            ensurePcLogin({
                redirect: '/ai/short-drama/projects',
                returnTo: '/ai/short-drama/projects'
            })
            return
        }
        feedback.msgError(getRequestErrorMessage(error, '项目列表读取失败'))
    } finally {
        loadingProjects.value = false
    }
}
const loadUserPoints = async () => {
    try {
        const data = await getShortDramaHome()
        userPoints.value = Number(data?.user?.points ?? 0)
        membershipEnabled.value = Boolean(data?.user?.vip_enabled || data?.user?.membership_enabled)
    } catch (_error) {
        userPoints.value = 0
    }
}
const handleDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null
    if (!target?.closest('.project-card__menu, .project-card__more')) {
        closeProjectMenu()
    }
}

onMounted(() => {
    enablePageScroll()
    loadUserPoints()
    loadProjects()
    document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    restorePageScroll()
})
</script>

<style lang="scss" scoped>
.short-drama-project-page {
    position: relative;
    height: 100vh;
    min-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    background: #050505;
    color: #fff;
    font-family: Inter, sans-serif;
}

.short-drama-back,
.short-drama-credit,
.project-library {
    position: relative;
    z-index: 5;
}

.short-drama-back {
    position: fixed;
    top: 24px;
    left: 24px;
    z-index: 12;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    font-size: 16px;
    line-height: 16px;
    cursor: pointer;
}

.short-drama-back__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
}

.short-drama-back__icon img {
    width: 14px;
    height: 14px;
    filter: brightness(0) invert(1);
    object-fit: contain;
    transform: rotate(-180deg);
}

.short-drama-credit {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 12;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    border-radius: 20px;
    padding: 0 14px;
    background: rgba(30, 31, 32, 0.2);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    color: #fff;
    font-size: 16px;
    line-height: 16px;
}

.short-drama-credit__icon {
    display: block;
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(1);
    object-fit: contain;
}

.short-drama-credit button {
    border: 0;
    padding: 0;
    background: transparent;
    color: #ffbe32;
    font-size: 16px;
    line-height: 16px;
    cursor: pointer;
}

.project-library {
    width: 100%;
    min-height: 100vh;
    padding: 80px 48px 80px 120px;
    box-sizing: border-box;
}

.project-library__section {
    width: 100%;
}

.project-library__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.project-library__heading h1 {
    margin: 0;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
}

.project-library__heading button {
    border: 0;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
}

.project-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
    width: 100%;
}

.project-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    height: auto;
    border: 0;
    border-radius: 12px;
    padding: 0;
    background: rgba(30, 31, 32, 0.22);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    color: #fff;
    overflow: hidden;
    box-sizing: border-box;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.project-card--item:hover {
    background: rgba(42, 43, 44, 0.52);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42), 0 18px 42px rgba(0, 0, 0, 0.25);
    transform: translateY(-2px);
}

.project-card--new {
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 96px;
}

.project-card__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: #a1a1a1;
}

.project-card--new > span:last-child {
    position: relative;
    z-index: 5;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 15px;
}

.project-card img {
    display: block;
    position: relative;
    z-index: 5;
    margin: 4px 4px 0;
    width: calc(100% - 8px);
    aspect-ratio: 465 / 281;
    height: auto;
    border-radius: 8px;
    object-fit: cover;
}

.project-card__empty-cover {
    position: relative;
    z-index: 5;
    margin: 4px 4px 0;
    width: calc(100% - 8px);
    aspect-ratio: 465 / 281;
    height: auto;
    border-radius: 8px;
    background: #202123;
}

.project-card footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 68px;
    padding: 0 10px;
    box-sizing: border-box;
}

.project-card footer span {
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.project-card__more {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: rgba(255, 255, 255, 0.92);
    opacity: 0;
    cursor: pointer;
    transform: translateY(-2px);
    transition: opacity 0.16s ease, transform 0.16s ease, background 0.16s ease;
}

.project-card--item:hover .project-card__more,
.project-card__more[aria-expanded='true'] {
    opacity: 1;
    transform: translateY(0);
}

.project-card__more:hover {
    background: rgba(255, 255, 255, 0.14);
}

.project-card__menu {
    position: absolute;
    top: 44px;
    right: 10px;
    z-index: 12;
    display: grid;
    gap: 2px;
    min-width: 126px;
    border-radius: 12px;
    padding: 10px;
    background: rgba(18, 18, 20, 0.96);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}

.project-card__menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    border-radius: 8px;
    padding: 9px 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    line-height: 18px;
    text-align: left;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease;
}

.project-card__menu button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.project-card__menu button.is-danger {
    color: #ff8a8a;
}

.project-card__menu button.is-danger:hover {
    background: rgba(255, 82, 82, 0.12);
    color: #ffaaaa;
}

.project-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 320px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    text-align: center;
}

.project-empty strong {
    margin-top: 14px;
    color: #fff;
    font-size: 20px;
    line-height: 28px;
}

.project-empty p {
    margin: 8px 0 20px;
    color: rgba(255, 255, 255, 0.54);
    font-size: 14px;
}

.project-empty button {
    height: 40px;
    border: 0;
    border-radius: 20px;
    padding: 0 22px;
    background: #fff;
    color: #101010;
    font-weight: 600;
    cursor: pointer;
}

.project-cover-picker {
    position: fixed;
    inset: 0;
    z-index: 4000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
}

.project-cover-picker__panel {
    width: min(920px, calc(100vw - 80px));
    max-height: min(680px, calc(100vh - 80px));
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    padding: 18px;
    background: #151619;
    color: #fff;
    box-shadow: none;
    box-sizing: border-box;
}

.project-cover-picker__header,
.project-cover-picker__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.project-cover-picker__header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.project-cover-picker__header button,
.project-cover-picker__footer button {
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    cursor: pointer;
}

.project-cover-picker__header button {
    width: 32px;
    height: 32px;
}

.project-cover-picker__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    max-height: 500px;
    margin: 18px 0;
    overflow-y: auto;
}

.project-cover-option {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    padding: 0;
    background: transparent;
    overflow: hidden;
    cursor: pointer;
}

.project-cover-option.is-selected {
    border-color: #fff;
}

.project-cover-option img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
}

.project-cover-option__radio {
    position: absolute;
    right: 8px;
    top: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.62);
    color: #fff;
}

.project-cover-picker__state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 220px;
    color: rgba(255, 255, 255, 0.62);
}

.project-cover-picker__footer {
    justify-content: flex-end;
    gap: 10px;
}

.project-cover-picker__footer button {
    height: 36px;
    padding: 0 18px;
}

.project-cover-picker__footer button.is-primary {
    background: #fff;
    color: #101010;
    font-weight: 600;
}

.project-cover-picker__footer button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

.project-cover-fade-enter-active,
.project-cover-fade-leave-active {
    transition: opacity 0.16s ease;
}

.project-cover-fade-enter-from,
.project-cover-fade-leave-to {
    opacity: 0;
}

@media (max-width: 1780px) {
    .project-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}

@media (max-width: 1500px) {
    .project-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

@media (max-width: 1220px) {
    .project-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 980px) {
    .project-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 768px) {
    .project-library {
        padding: 96px 18px 64px 82px;
    }

    .project-grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .project-cover-picker__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
