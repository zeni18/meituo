<template>
    <div class="subject-library-page">
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

        <ShortDramaSideNav active="subject" />

        <main class="subject-library-main">
            <header class="subject-library-header">
                <nav class="subject-tabs" aria-label="主体库">
                    <button
                        v-for="tab in sourceTabs"
                        :key="tab.value"
                        :class="['subject-tab', { 'is-active': scope === tab.value }]"
                        type="button"
                        @click="switchScope(tab.value)"
                    >
                        {{ tab.label }}
                    </button>
                </nav>
                <div class="subject-tools">
                    <div class="subject-select">
                        <select v-model="category" @change="reload">
                            <option value="">全部</option>
                            <option value="character">人物</option>
                            <option value="scene">场景</option>
                        </select>
                    </div>
                    <label class="subject-search">
                        <input
                            v-model.trim="keyword"
                            placeholder="搜索主体、人物或场景"
                            type="search"
                            @keyup.enter="reload"
                        />
                        <button type="button" aria-label="搜索" @click="reload">
                            <span>搜索</span>
                        </button>
                    </label>
                </div>
            </header>

            <section class="subject-grid-wrap">
                <div v-if="loading" class="subject-empty">加载中...</div>
                <div v-else-if="!subjects.length && scope !== 'user'" class="subject-empty">
                    {{ scope === 'public' ? '暂无官方主体' : '暂无个人主体' }}
                </div>
                <div v-else class="subject-grid">
                    <button
                        v-if="scope === 'user'"
                        class="subject-card subject-card--new"
                        type="button"
                        @click="openCreate"
                    >
                        <span class="subject-card__plus"><ElIcon><Plus /></ElIcon></span>
                        <span>新建主体</span>
                    </button>
                    <article
                        v-for="item in subjects"
                        :key="`${scope}-${item.id}`"
                        class="subject-card"
                    >
                        <div class="subject-card__media">
                            <img v-if="item.image" :src="item.image" :alt="item.name" />
                            <div v-else class="subject-card__placeholder">暂无图片</div>
                            <img
                                v-if="item.three_view_url"
                                class="subject-card__three"
                                :src="item.three_view_url"
                                :alt="`${item.name}三视图`"
                            />
                            <button
                                v-if="scope === 'user'"
                                class="subject-card__more"
                                type="button"
                                :aria-expanded="activeSubjectMenuId === item.id"
                                aria-label="更多操作"
                                @click.stop="toggleSubjectMenu(item.id)"
                            >
                                <ElIcon><MoreFilled /></ElIcon>
                            </button>
                            <div
                                v-if="scope === 'user' && activeSubjectMenuId === item.id"
                                class="subject-card__actions"
                                @click.stop
                            >
                                <button type="button" @click="openEdit(item)">
                                    <ElIcon><Edit /></ElIcon>
                                    <span>编辑</span>
                                </button>
                                <button type="button" @click="openThreeView(item)">
                                    <ElIcon><Picture /></ElIcon>
                                    <span>转三视图</span>
                                </button>
                                <button type="button" class="is-danger" @click="removeSubject(item)">
                                    <ElIcon><Delete /></ElIcon>
                                    <span>删除</span>
                                </button>
                            </div>
                        </div>
                        <footer class="subject-card__footer">
                            <strong>{{ item.name }}</strong>
                            <span>{{ categoryText(item.category) }}</span>
                        </footer>
                    </article>
                </div>
            </section>
        </main>

        <Teleport to="body">
            <div v-if="subjectModalVisible" class="subject-modal-backdrop" @click.self="closeSubjectModal">
                <section class="subject-modal">
                    <header class="modal-head">
                        <h2>{{ form.id ? '编辑主体' : '新增主体' }}</h2>
                        <button type="button" aria-label="关闭" @click="closeSubjectModal">×</button>
                    </header>
                    <div class="subject-modal__body">
                        <div class="subject-form">
                            <label class="field">
                                <span>名称</span>
                                <input v-model.trim="form.name" placeholder="请输入主体名称" />
                            </label>
                            <label class="field subject-type-field">
                                <span>分类</span>
                                <div class="segmented subject-type-segmented">
                                    <button
                                        :class="{ 'is-active': form.category !== 'scene' }"
                                        type="button"
                                        @click="form.category = 'character'"
                                    >
                                        人物
                                    </button>
                                    <button
                                        :class="{ 'is-active': form.category === 'scene' }"
                                        type="button"
                                        @click="form.category = 'scene'"
                                    >
                                        场景
                                    </button>
                                </div>
                            </label>
                            <label class="field">
                                <span>方式</span>
                                <div class="segmented">
                                    <button
                                        :class="{ 'is-active': form.mode === 'upload' }"
                                        type="button"
                                        @click="form.mode = 'upload'"
                                    >
                                        本地上传
                                    </button>
                                    <button
                                        :class="{ 'is-active': form.mode === 'ai' }"
                                        type="button"
                                        @click="form.mode = 'ai'"
                                    >
                                        AI生成
                                    </button>
                                </div>
                            </label>
                            <div :class="['prompt-panel', `is-${form.mode}`]">
                                <button
                                    v-if="form.mode === 'upload'"
                                    class="upload-btn"
                                    type="button"
                                    :disabled="uploading"
                                    @click="triggerUpload"
                                >
                                    <span class="upload-plus">+</span>
                                    {{ uploading ? '上传中...' : '上传图片' }}
                                </button>
                                <textarea
                                    v-model.trim="form.prompt"
                                    class="prompt-editor"
                                    :placeholder="form.mode === 'upload' ? '可补充描述，方便后续 AI 生成保持一致' : '描述主体外貌、服装、动作和画风'"
                                />
                                <div class="prompt-panel__foot">
                                    <div v-if="form.mode === 'ai'" class="model-picker" @click.stop>
                                        <button
                                            class="model-trigger"
                                            type="button"
                                            :disabled="generatingSubject"
                                            aria-label="选择模型"
                                            @click="toggleSubjectModelMenu"
                                        >
                                            <img :src="iconAssets.model" alt="" />
                                        </button>
                                        <div v-if="subjectModelMenuOpen" class="model-menu">
                                            <button
                                                v-for="model in subjectModelOptions"
                                                :key="model.id"
                                                :class="{ 'is-active': selectedSubjectModel?.id === model.id }"
                                                type="button"
                                                @click="selectSubjectModel(model)"
                                            >
                                                <span>{{ model.name }}</span>
                                                <i v-if="selectedSubjectModel?.id === model.id">✓</i>
                                            </button>
                                            <div v-if="!subjectModelOptions.length" class="model-menu-empty">暂无可用模型</div>
                                        </div>
                                    </div>
                                    <div v-if="form.mode === 'ai' && subjectResolutionOptions.length" class="resolution-picker" @click.stop>
                                        <button class="resolution-trigger" type="button" :disabled="generatingSubject" aria-label="图片分辨率" @click="toggleSubjectResolutionMenu">
                                            {{ selectedSubjectResolution }}
                                        </button>
                                        <div v-if="subjectResolutionMenuOpen" class="model-menu model-menu--resolution">
                                            <button
                                                v-for="item in subjectResolutionOptions"
                                                :key="item.value"
                                                :class="{ 'is-active': selectedSubjectResolution === item.value }"
                                                type="button"
                                                @click="selectSubjectResolution(item.value)"
                                            >
                                                <span>{{ item.label }}</span>
                                                <i v-if="selectedSubjectResolution === item.value">✓</i>
                                            </button>
                                        </div>
                                    </div>
                                    <div v-if="form.mode === 'ai'" class="prompt-cost">
                                        <span>{{ subjectBillingText }}</span>
                                        <button
                                            type="button"
                                            :disabled="generatingSubject"
                                            aria-label="生成主体图"
                                            @click="generateSubjectImage"
                                        >
                                            <img :src="iconAssets.send" alt="" />
                                        </button>
                                    </div>
                                    <span v-else class="prompt-status">{{ describing ? 'AI 正在识别...' : ' ' }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="subject-preview">
                            <div class="main-preview">
                                <button
                                    class="main-preview-hit"
                                    type="button"
                                    :disabled="!activeSubjectPreviewImage || (activeSubjectPreview === 'subject' && subjectImageGenerating)"
                                    @click="openPreviewViewer(activeSubjectPreviewImage)"
                                >
                                    <img v-if="activeSubjectPreviewImage" :src="activeSubjectPreviewImage" :alt="activeSubjectPreview === 'three' ? '三视图' : '主体图'" />
                                    <span v-else>{{ activeSubjectPreview === 'three' ? '三视图' : '主体图' }}</span>
                                </button>
                                <div v-if="activeSubjectPreview === 'subject' && subjectImageGenerating" class="main-preview-loading">
                                    <ShortDramaGrainientPlaceholder />
                                </div>
                                <button
                                    v-if="form.imagePreview || form.threeViewPreview"
                                    class="three-view-entry"
                                    type="button"
                                    aria-label="打开三视图"
                                    title="打开三视图"
                                    @click.stop="openThreeViewFromForm"
                                >
                                    <img :src="iconAssets.generate" alt="" />
                                </button>
                            </div>
                            <aside class="preview-side">
                                <button
                                    :class="['mini-preview', { 'is-active': activeSubjectPreview === 'subject' }]"
                                    type="button"
                                    @click="activeSubjectPreview = 'subject'"
                                >
                                    <img v-if="form.imagePreview" :src="form.imagePreview" alt="" />
                                    <span v-else>主体图</span>
                                </button>
                                <div v-if="subjectImageGenerating || subjectAssets.length" class="subject-history">
                                    <button
                                        v-if="generatingSubject && !activeSubjectTasks.length"
                                        key="subject-task-submitting"
                                        class="is-generating"
                                        type="button"
                                        disabled
                                    >
                                        <ShortDramaGrainientPlaceholder compact />
                                    </button>
                                    <button
                                        v-for="task in activeSubjectTasks"
                                        :key="`subject-task-${task.task_id}`"
                                        class="is-generating"
                                        type="button"
                                        disabled
                                    >
                                        <ShortDramaGrainientPlaceholder compact />
                                    </button>
                                    <button
                                        v-for="asset in subjectAssets"
                                        :key="asset.id"
                                        :class="{ 'is-active': isSubjectAssetSelected(asset) }"
                                        type="button"
                                        @click="previewSubjectAsset(asset)"
                                    >
                                        <img :src="asset.url" alt="" />
                                    </button>
                                </div>
                                <div :class="['three-preview-box', { 'is-active': activeSubjectPreview === 'three' }]">
                                    <button
                                        :class="['three-trigger', { 'has-image': form.threeViewPreview }]"
                                        type="button"
                                        :disabled="!hasMainSubjectImage && !form.threeViewPreview"
                                        @click="handleThreeViewClick"
                                    >
                                        <img v-if="form.threeViewPreview" :src="form.threeViewPreview" alt="" />
                                        <template v-else>
                                            <i>+</i>
                                            三视图
                                        </template>
                                    </button>
                                </div>
                            </aside>
                        </div>
                    </div>
                    <footer class="modal-actions">
                        <button class="ghost" type="button" @click="closeSubjectModal">取消</button>
                        <button type="button" :disabled="saving" @click="saveSubject">
                            {{ saving ? '保存中...' : '保存' }}
                        </button>
                    </footer>
                </section>
            </div>

            <div v-if="threeModalVisible" class="subject-modal-backdrop" @click.self="closeThreeModal">
                <section class="three-modal">
                    <header class="modal-head">
                        <h2>三视图</h2>
                        <button type="button" aria-label="关闭" @click="closeThreeModal">×</button>
                    </header>
                    <div class="three-modal__body">
                        <div class="three-preview">
                            <img v-if="activeThreeAsset?.url" :src="activeThreeAsset.url" alt="三视图" />
                            <ShortDramaGrainientPlaceholder v-else-if="generatingThree || activeThreeTasks.length" />
                            <span v-else>暂无三视图</span>
                        </div>
                        <aside class="three-history">
                            <button
                                v-for="task in activeThreeTasks"
                                :key="`task-${task.task_id}`"
                                class="is-generating"
                                type="button"
                                disabled
                            >
                                <ShortDramaGrainientPlaceholder compact />
                            </button>
                            <button
                                v-for="asset in threeAssets"
                                :key="asset.id"
                                :class="{ 'is-active': isThreeAssetSelected(asset) }"
                                type="button"
                                @click="activeThreeAsset = asset"
                            >
                                <img :src="asset.url" alt="" />
                            </button>
                        </aside>
                    </div>
                    <div class="three-prompt-panel">
                        <textarea v-model.trim="threePrompt" class="three-prompt" />
                        <div class="three-prompt-panel__foot">
                            <div class="model-picker" @click.stop>
                                <button
                                    class="model-trigger"
                                    type="button"
                                    :disabled="generatingThree"
                                    aria-label="选择模型"
                                    @click="toggleThreeViewModelMenu"
                                >
                                    <img :src="iconAssets.model" alt="" />
                                </button>
                                <div v-if="subjectModelMenuOpen" class="model-menu">
                                    <button
                                        v-for="model in subjectModelOptions"
                                        :key="model.id"
                                        :class="{ 'is-active': selectedSubjectModel?.id === model.id }"
                                        type="button"
                                        @click="selectSubjectModel(model)"
                                    >
                                        <span>{{ model.name }}</span>
                                        <i v-if="selectedSubjectModel?.id === model.id">✓</i>
                                    </button>
                                    <div v-if="!subjectModelOptions.length" class="model-menu-empty">暂无可用模型</div>
                                </div>
                            </div>
                            <div v-if="subjectResolutionOptions.length" class="resolution-picker" @click.stop>
                                <button class="resolution-trigger" type="button" :disabled="generatingThree" aria-label="图片分辨率" @click="toggleSubjectResolutionMenu">
                                    {{ selectedSubjectResolution }}
                                </button>
                                <div v-if="subjectResolutionMenuOpen" class="model-menu model-menu--resolution">
                                    <button
                                        v-for="item in subjectResolutionOptions"
                                        :key="item.value"
                                        :class="{ 'is-active': selectedSubjectResolution === item.value }"
                                        type="button"
                                        @click="selectSubjectResolution(item.value)"
                                    >
                                        <span>{{ item.label }}</span>
                                        <i v-if="selectedSubjectResolution === item.value">✓</i>
                                    </button>
                                </div>
                            </div>
                            <div class="prompt-cost">
                                <span>{{ subjectBillingText }}</span>
                                <button
                                    type="button"
                                    :disabled="generatingThree"
                                    aria-label="生成三视图"
                                    @click="generateThreeView"
                                >
                                    <img :src="iconAssets.send" alt="" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <footer class="modal-actions">
                        <button class="ghost" type="button" @click="closeThreeModal">取消</button>
                        <button type="button" @click="confirmThreeModal">确定</button>
                    </footer>
                </section>
            </div>

            <div v-if="previewViewerVisible" class="preview-viewer-backdrop" @click.self="closePreviewViewer">
                <button class="preview-viewer-close" type="button" aria-label="关闭预览" @click="closePreviewViewer">×</button>
                <img v-if="previewViewerUrl" :src="previewViewerUrl" alt="预览" />
            </div>
        </Teleport>

        <input ref="fileInputRef" accept="image/*" class="hidden-file" type="file" @change="onUploadChange" />
    </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import {
    Delete,
    Edit,
    MoreFilled,
    Picture,
    Plus
} from '@element-plus/icons-vue'
import ShortDramaSideNav from '~/components/short-drama/ShortDramaSideNav.vue'
import ShortDramaCreditPill from '~/components/short-drama/ShortDramaCreditPill.vue'
import ShortDramaGrainientPlaceholder from '~/components/short-drama/ShortDramaGrainientPlaceholder.vue'
import { uploadImage } from '@/api/app'
import {
    deleteShortDramaSubject,
    describeShortDramaSubjectImage,
    generateShortDramaSubject,
    getShortDramaGenerationDetail,
    getShortDramaHome,
    getShortDramaSubjectImageHistory,
    getShortDramaSubjectThreeViewHistory,
    getShortDramaSubjects,
    registerShortDramaSubjectImage,
    selectShortDramaSubjectImage,
    saveShortDramaSubject
} from '@/api/short_drama'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { useUserStore } from '@/stores/user'
import feedback from '@/utils/feedback'
import {
    readShortDramaImageModelSelection,
    writeShortDramaImageModelSelection
} from '@/utils/short-drama-cache'
import { resolveShortDramaResolution, shortDramaResolutionOptions } from '@/utils/short-drama-model-resolution'

definePageMeta({ layout: 'blank' })
useHead({ title: '主体库' })

type SubjectScope = 'public' | 'user'
type SubjectCategory = 'character' | 'scene'
type SubjectItem = {
    id: number
    name: string
    image: string
    raw_image: string
    description: string
    prompt?: string
    category: string
    source: string
    three_view_url?: string
    three_view_asset?: SubjectAsset
}
type SubjectAsset = {
    id: number | string
    uri: string
    url: string
    asset_type: string
    task_id?: string
}
type ThreeGenerationTask = {
    task_id: string
    status: string
    subject_id: number
    error_msg: string
}
type SubjectGenerationTask = ThreeGenerationTask
type ModelOption = {
    id: string
    value: string
    channel_code: string
    name: string
    billing_unit?: string
    billing_unit_size?: number
    platform_unit_cost?: string | number
    tenant_unit_price?: string | number
    default_quality?: string
    quality_options?: unknown[]
    resolution_options?: unknown[]
    skus?: Array<{
        market_sku_id?: number
        title?: string
        quality?: string
        resolution?: string
        usage_unit?: string
        usage_unit_size?: number | string
        platform_unit_cost?: string | number
        tenant_unit_price?: string | number
    }>
}

const sourceTabs: Array<{ label: string; value: SubjectScope }> = [
    { label: '官方主体库', value: 'public' },
    { label: '我的主体库', value: 'user' }
]
const defaultCharacterThreePrompt = '基于主体主图生成角色三视图，保持身份、五官、发型、服装和比例一致，输出正面、侧面、背面，干净背景。'
const defaultObjectThreePrompt = '基于主体主图生成物体三视图，保持材质、结构、颜色和比例一致，输出正面、侧面、背面，干净背景。'
const defaultThreePrompt = defaultCharacterThreePrompt

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()
const scope = ref<SubjectScope>('public')
const category = ref('')
const keyword = ref('')
const loading = ref(false)
const subjects = ref<SubjectItem[]>([])
const userPoints = ref(0)
const membershipEnabled = ref(false)
const legacyPublicSubjectNames = new Set(['清冷师妹', '赛艇少年'])
let previousHtmlOverflow = ''
let previousBodyOverflow = ''

const queryValue = (key: string) => {
    const value = route.query[key]
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}
const projectId = computed(() => queryValue('project_id'))
const scriptTaskId = computed(() => queryValue('task_id'))

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
const subjectModalVisible = ref(false)
const threeModalVisible = ref(false)
const uploading = ref(false)
const describing = ref(false)
const visionTextAvailable = ref(false)
const saving = ref(false)
const generatingSubject = ref(false)
const generatingThree = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const activeSubjectAsset = ref<SubjectAsset | null>(null)
const activeThreeAsset = ref<SubjectAsset | null>(null)
const activeSubjectMenuId = ref<number | null>(null)
const subjectAssets = ref<SubjectAsset[]>([])
const activeSubjectTasks = ref<SubjectGenerationTask[]>([])
const threeAssets = ref<SubjectAsset[]>([])
const activeThreeTasks = ref<ThreeGenerationTask[]>([])
const threePrompt = ref(defaultThreePrompt)
const activeSubjectPreview = ref<'subject' | 'three'>('subject')
const subjectModelMenuOpen = ref(false)
const subjectResolutionMenuOpen = ref(false)
const subjectModelOptions = ref<ModelOption[]>([])
const selectedSubjectModel = ref<ModelOption | null>(null)
const selectedSubjectResolution = ref('')
const subjectResolutionOptions = computed(() => shortDramaResolutionOptions(selectedSubjectModel.value))
const previewViewerVisible = ref(false)
const previewViewerUrl = ref('')
let subjectPollTimer: ReturnType<typeof setTimeout> | null = null
let threePollTimer: ReturnType<typeof setTimeout> | null = null

const form = reactive({
    id: 0,
    name: '',
    category: 'character' as SubjectCategory,
    mode: 'upload' as 'upload' | 'ai',
    prompt: '',
    imageRaw: '',
    imagePreview: '',
    threeViewPreview: '',
    threeViewRaw: '',
    model_id: '',
    model_name: ''
})
const isObjectLikeSubject = (subject: { name?: string; category?: string; description?: string; prompt?: string }) => {
    const category = String(subject.category || '').toLowerCase()
    if (['character', 'characters', 'human', 'person', 'role', 'actor', 'actress', 'people', '角色', '人物', '人类', '真人', '男生', '女生', '主角'].includes(category)) return false
    if (['prop', 'props', 'object', 'item', 'tool', 'symbol', 'artifact', '物品', '道具', '工具', '器物', '场景'].includes(category)) return true
    const name = String(subject.name || '').toLowerCase()
    const text = [subject.name, subject.description, subject.prompt].map((item) => String(item || '').toLowerCase()).join(' ')
    const includesAny = (value: string, keywords: string[]) => keywords.some((keyword) => keyword && value.includes(keyword))
    const scoreBy = (value: string, keywords: string[]) => keywords.reduce((score, keyword) => score + (keyword && value.includes(keyword) ? 1 : 0), 0)
    const characterNameKeywords = ['男主', '女主', '男孩', '女孩', '少年', '少女', '老人', '孩子', '母亲', '父亲', '老师', '学生', '医生', '警察', '角色', '人物', '主角']
    const objectNameKeywords = ['桌子', '椅子', '手机', '电脑', '汽车', '剑', '刀', '枪', '书', '花', '杯', '道具', '物品', '工具', '器物']
    if (includesAny(name, characterNameKeywords)) return false
    if (includesAny(name, objectNameKeywords)) return true
    const characterKeywords = ['五官', '发型', '表情', '服装', '身材', '脸', '眼睛', '头发', '皮肤', '人物', '角色', '男人', '女人', '男孩', '女孩', '肖像', '站姿', '动作', '穿着']
    const objectKeywords = ['材质', '结构', '金属', '木质', '布料', '道具', '物体', '物品', '器物', '工具', '家具', '设备', '车辆', '建筑']
    const characterScore = scoreBy(text, characterKeywords)
    const objectScore = scoreBy(text, objectKeywords)
    if (characterScore >= 2 && characterScore >= objectScore) return false
    if (characterScore >= 3) return false
    if (objectScore >= 2 && objectScore > characterScore) return true
    return objectScore >= 1 && characterScore === 0
}
const threePromptForSubject = (subject: { name?: string; category?: string; description?: string; prompt?: string }) => {
    return isObjectLikeSubject(subject) ? defaultObjectThreePrompt : defaultCharacterThreePrompt
}
const effectiveThreePrompt = () => {
    const current = threePrompt.value.trim()
    if (!current || [defaultThreePrompt, defaultCharacterThreePrompt, defaultObjectThreePrompt].includes(current)) {
        return threePromptForSubject({
            name: form.name,
            category: form.category,
            prompt: form.prompt
        })
    }
    return current
}
const activeSubjectPreviewImage = computed(() => activeSubjectPreview.value === 'three'
    ? form.threeViewPreview
    : form.imagePreview)
const subjectImageGenerating = computed(() => generatingSubject.value || activeSubjectTasks.value.length > 0)

const openPreviewViewer = (url?: string) => {
    const previewUrl = String(url || '').trim()
    if (!previewUrl) return
    previewViewerUrl.value = previewUrl
    previewViewerVisible.value = true
}

const closePreviewViewer = () => {
    previewViewerVisible.value = false
    previewViewerUrl.value = ''
}

const categoryText = (value: string) => (value === 'scene' ? '场景' : '人物')

const withPublicBase = (path: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/${path.replace(/^\/+/, '')}` || '/'
}
const iconAsset = (name: string) => withPublicBase(`/short-drama/figma/icon/${name}.svg`)
const iconAssets = {
    arrowRight: iconAsset('Arrow-right'),
    model: iconAsset('moxing'),
    generate: iconAsset('shengcheng'),
    send: iconAsset('Arrow-up')
}
const hasUserToken = () => Boolean(userStore.restoreToken())
const handleCreditAction = () => {
    if (!hasUserToken()) {
        ensurePcLogin({
            redirect: '/ai/short-drama/subject',
            returnTo: '/ai/short-drama/subject'
        })
    }
}
const goBackHome = () => router.push('/ai')

const pickList = (res: any) => (Array.isArray(res) ? res : Array.isArray(res?.lists) ? res.lists : [])
const pickUploadRaw = (res: any) => res?.url || res?.path || res?.uri || ''
const pickUploadPreview = (res: any) => res?.uri || res?.url || res?.path || ''
const firstAsset = (task: any): SubjectAsset | null => {
    const assets = Array.isArray(task?.assets)
        ? task.assets
        : Array.isArray(task?.output_assets)
          ? task.output_assets
          : []
    const asset = assets.find((item: any) => item?.url) || null
    return asset
        ? {
              id: Number(asset.id || 0),
              uri: String(asset.uri || ''),
              url: String(asset.url || ''),
              asset_type: String(asset.asset_type || ''),
              task_id: String(asset.task_id || '')
          }
        : null
}
const isActiveStatus = (status?: string) => ['pending', 'queued', 'running'].includes(String(status || ''))
const normalizeThreeTask = (task: any, fallbackSubjectId = 0): ThreeGenerationTask | null => {
    const taskId = String(task?.task_id || task?.id || '')
    if (!taskId) return null
    const params = task?.request?.params || task?.params || {}
    const subjectId = Number(task?.subject_id || task?.item_id || params?.subject_id || params?.item_id || fallbackSubjectId || 0)
    return {
        task_id: taskId,
        status: String(task?.status || ''),
        subject_id: subjectId,
        error_msg: String(task?.error_msg || task?.error || '')
    }
}
const normalizeSubjectTask = (task: any, fallbackSubjectId = 0): SubjectGenerationTask | null => normalizeThreeTask(task, fallbackSubjectId)
const mergeActiveSubjectTask = (task: SubjectGenerationTask | null) => {
    if (!task || !isActiveStatus(task.status)) return
    activeSubjectTasks.value = [
        task,
        ...activeSubjectTasks.value.filter((item) => item.task_id !== task.task_id)
    ]
}
const mergeActiveThreeTask = (task: ThreeGenerationTask | null) => {
    if (!task || !isActiveStatus(task.status)) return
    activeThreeTasks.value = [
        task,
        ...activeThreeTasks.value.filter((item) => item.task_id !== task.task_id)
    ]
}
const clearSubjectPolling = () => {
    if (!subjectPollTimer) return
    clearTimeout(subjectPollTimer)
    subjectPollTimer = null
}
const clearThreePolling = () => {
    if (!threePollTimer) return
    clearTimeout(threePollTimer)
    threePollTimer = null
}
const scheduleSubjectPolling = () => {
    clearSubjectPolling()
    if (!subjectModalVisible.value || !form.id || !activeSubjectTasks.value.length) return
    subjectPollTimer = setTimeout(async () => {
        try {
            await loadSubjectImageHistory(form.id)
            if (activeSubjectTasks.value.length) scheduleSubjectPolling()
        } catch (_error) {
            if (activeSubjectTasks.value.length) scheduleSubjectPolling()
        }
    }, 2500)
}
const scheduleThreePolling = () => {
    clearThreePolling()
    if (!threeModalVisible.value || !form.id || !activeThreeTasks.value.length) return
    threePollTimer = setTimeout(async () => {
        try {
            await loadThreeHistory(form.id)
            if (activeThreeTasks.value.length) scheduleThreePolling()
        } catch (_error) {
            if (activeThreeTasks.value.length) scheduleThreePolling()
        }
    }, 2500)
}
const makeCurrentSubjectAsset = (): SubjectAsset | null => form.imagePreview
    ? {
          id: `current-${form.imageRaw || form.imagePreview}`,
          uri: form.imageRaw || form.imagePreview,
          url: form.imagePreview,
          asset_type: 'subject_image',
          task_id: ''
      }
    : null
const hasMainSubjectImage = computed(() => Boolean(form.imageRaw || form.imagePreview))
const makeCurrentThreeAsset = (): SubjectAsset | null => form.threeViewPreview
    ? {
          id: `current-${form.threeViewRaw || form.threeViewPreview}`,
          uri: form.threeViewRaw || form.threeViewPreview,
          url: form.threeViewPreview,
          asset_type: 'three_view',
          task_id: ''
      }
    : null
const previewSubjectAsset = (asset: SubjectAsset | null) => {
    if (!asset?.url) return
    activeSubjectAsset.value = asset
    form.imagePreview = asset.url
    form.imageRaw = asset.uri || asset.url
    activeSubjectPreview.value = 'subject'
}
const applySubjectAsset = (asset: SubjectAsset | null) => {
    if (!asset?.url) return
    previewSubjectAsset(asset)
    if (form.id) {
        subjects.value = subjects.value.map((item) => item.id === form.id
            ? {
                  ...item,
                  image: asset.url,
                  raw_image: asset.uri || asset.url
              }
            : item)
    }
}
const applyThreeAsset = (asset: SubjectAsset | null) => {
    if (!asset?.url) return
    activeThreeAsset.value = asset
    form.threeViewPreview = asset.url
    form.threeViewRaw = asset.uri || asset.url
    activeSubjectPreview.value = 'three'
    if (form.id) {
        subjects.value = subjects.value.map((item) => item.id === form.id
            ? {
                  ...item,
                  three_view_url: asset.url,
                  three_view_asset: asset
              }
            : item)
    }
}
const isSubjectAssetSelected = (asset: SubjectAsset) => {
    const selectedUrl = activeSubjectAsset.value?.url || ''
    const selectedUri = activeSubjectAsset.value?.uri || ''
    return Boolean((selectedUrl && asset.url === selectedUrl) || (selectedUri && asset.uri === selectedUri))
}
const isThreeAssetSelected = (asset: SubjectAsset) => {
    const selectedUrl = activeThreeAsset.value?.url || ''
    const selectedUri = activeThreeAsset.value?.uri || ''
    return Boolean((selectedUrl && asset.url === selectedUrl) || (selectedUri && asset.uri === selectedUri))
}

const normalizeSubjectModel = (model: any): ModelOption => ({
    id: String(model?.id || model?.value || model?.channel_code || model?.channel || model?.model_code || ''),
    value: String(model?.value || model?.channel_code || model?.channel || model?.model_code || model?.id || ''),
    channel_code: String(model?.channel_code || model?.channel || model?.model_code || model?.id || ''),
    name: String(model?.name || model?.title || model?.id || '默认模型'),
    billing_unit: String(model?.billing_unit || ''),
    billing_unit_size: Number(model?.billing_unit_size || 1),
    platform_unit_cost: model?.platform_unit_cost ?? 0,
    tenant_unit_price: model?.tenant_unit_price ?? 0,
    default_quality: String(model?.default_quality || model?.quality || ''),
    quality_options: Array.isArray(model?.quality_options) ? model.quality_options : [],
    resolution_options: Array.isArray(model?.resolution_options) ? model.resolution_options : [],
    skus: Array.isArray(model?.skus) ? model.skus : []
})

const formatSubjectBillingPoints = (value: unknown) => {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number <= 0) return '0'
    return number.toFixed(2).replace(/\.?0+$/, '') || '0'
}
const subjectSkuForResolution = (model: ModelOption | null | undefined, resolution = '') => {
    const selected = String(resolution || '').trim()
    const sources = [
        ...(Array.isArray(model?.skus) ? model.skus : []),
        ...(Array.isArray(model?.quality_options) ? model.quality_options : []),
        ...(Array.isArray(model?.resolution_options) ? model.resolution_options : [])
    ] as Array<Record<string, any>>
    if (!selected) return sources.find((item) => item?.tenant_unit_price !== undefined) || null
    return sources.find((item) => String(item?.quality || item?.resolution || item?.value || '') === selected && item?.tenant_unit_price !== undefined) || null
}
const subjectBillingText = computed(() => {
    const sku = subjectSkuForResolution(selectedSubjectModel.value, selectedSubjectResolution.value)
    const price = Number(sku?.tenant_unit_price ?? selectedSubjectModel.value?.tenant_unit_price ?? 0)
    const safePrice = Number.isFinite(price) && price > 0 ? price : 0
    if (String(selectedSubjectModel.value?.billing_unit || '').toLowerCase().includes('token')) {
        return `${formatSubjectBillingPoints(safePrice)}/百万 Token`
    }
    return `${formatSubjectBillingPoints(safePrice)} 点`
})

const subjectModelCode = (model?: ModelOption | null) => String(model?.value || model?.channel_code || model?.id || '')
const subjectModelMatches = (model: ModelOption, code = '') => {
    const target = String(code || '').trim()
    if (!target) return false
    return [model.id, model.value, model.channel_code].some((item) => item === target)
}
const persistedSubjectModelSelection = () => readShortDramaImageModelSelection(projectId.value, scriptTaskId.value)
const persistSubjectModelSelection = (model?: ModelOption | null, resolution = selectedSubjectResolution.value) => {
    if (!model) return
    writeShortDramaImageModelSelection(projectId.value, scriptTaskId.value, {
        id: model.id,
        value: model.value,
        channel_code: model.channel_code,
        name: model.name,
        default_quality: model.default_quality,
        resolution
    })
}
const applySubjectModel = (model: ModelOption | null) => {
    selectedSubjectModel.value = model
    form.model_id = subjectModelCode(model)
    form.model_name = model?.name || ''
    selectedSubjectResolution.value = resolveShortDramaResolution(model, selectedSubjectResolution.value)
}

const loadSubjectModels = async () => {
    try {
        const data = await getShortDramaHome()
        const groups = Array.isArray(data?.model_groups) ? data.model_groups : []
        visionTextAvailable.value = Boolean(data?.vision_model_configured)
        const groupKey = (group: any) => String(group?.key || group?.type || group?.app_code || '').toLowerCase()
        const imageGroups = groups.filter((group: any) => {
            const key = groupKey(group)
            return ['image', 'subject_image', 'image_generation', 'aigc_image'].some((needle) => key.includes(needle))
                && !['video', 'shot_video', 'video_generation', 'aigc_video'].some((needle) => key.includes(needle))
        })
        const sourceGroups = imageGroups.length ? imageGroups : groups
        const models = sourceGroups
            .flatMap((group: any) => Array.isArray(group?.options) ? group.options : [])
            .concat(!imageGroups.length && Array.isArray(data?.models) ? data.models : [])
            .map(normalizeSubjectModel)
            .filter((model: ModelOption) => model.id)
        subjectModelOptions.value = models
        const persisted = persistedSubjectModelSelection()
        const persistedCode = String(persisted?.value || persisted?.id || persisted?.channel_code || '').trim()
        const persistedModel = models.find((model) => subjectModelMatches(model, persistedCode))
        const preferredCode = form.model_id || subjectModelCode(selectedSubjectModel.value)
        applySubjectModel(
            persistedModel
            || models.find((model) => subjectModelMatches(model, preferredCode))
            || models[0]
            || null
        )
        if (persisted?.resolution) {
            selectedSubjectResolution.value = resolveShortDramaResolution(selectedSubjectModel.value, persisted.resolution)
        }
    } catch {
        visionTextAvailable.value = false
        subjectModelOptions.value = []
        applySubjectModel(null)
    }
}

const toggleSubjectModelMenu = async () => {
    if (form.mode !== 'ai' || generatingSubject.value) return
    if (!subjectModelOptions.value.length) await loadSubjectModels()
    subjectModelMenuOpen.value = !subjectModelMenuOpen.value
}

const selectSubjectModel = (model: ModelOption) => {
    applySubjectModel(model)
    persistSubjectModelSelection(model, selectedSubjectResolution.value)
    subjectModelMenuOpen.value = false
}

const toggleSubjectResolutionMenu = () => {
    if (!subjectResolutionOptions.value.length || generatingSubject.value || generatingThree.value) return
    subjectModelMenuOpen.value = false
    subjectResolutionMenuOpen.value = !subjectResolutionMenuOpen.value
}

const selectSubjectResolution = (value: string) => {
    selectedSubjectResolution.value = value
    persistSubjectModelSelection(selectedSubjectModel.value, value)
    subjectResolutionMenuOpen.value = false
}

const ensureSubjectModel = async () => {
    if (!subjectModelOptions.value.length) {
        await loadSubjectModels()
    }
    const selected = selectedSubjectModel.value
    if (selected && subjectModelOptions.value.some((model) => subjectModelMatches(model, subjectModelCode(selected)))) {
        applySubjectModel(selected)
        persistSubjectModelSelection(selected, selectedSubjectResolution.value)
        return selected
    }
    const fallback = subjectModelOptions.value[0] || null
    applySubjectModel(fallback)
    persistSubjectModelSelection(fallback, selectedSubjectResolution.value)
    return fallback
}

const toggleThreeViewModelMenu = async () => {
    if (generatingThree.value) return
    if (!subjectModelOptions.value.length) await loadSubjectModels()
    subjectModelMenuOpen.value = !subjectModelMenuOpen.value
}

const reload = async () => {
    closeSubjectMenu()
    loading.value = true
    try {
        const res: any = await getShortDramaSubjects({
            scope: scope.value,
            category: category.value,
            keyword: keyword.value,
            page_no: 1,
            page_size: 80
        })
        subjects.value = pickList(res)
            .map((item: any) => ({
                id: Number(item.id || 0),
                name: String(item.name || ''),
                image: String(item.image || ''),
                raw_image: String(item.raw_image || ''),
                description: String(item.description || item.prompt || ''),
                prompt: String(item.prompt || item.description || ''),
                category: String(item.category || 'character'),
                source: String(item.source || scope.value),
                three_view_url: String(item.three_view_url || item.three_view_asset?.url || ''),
                three_view_asset: item.three_view_asset || null
            }))
            .filter((item: SubjectItem) => {
                if (scope.value !== 'public') return true
                return !legacyPublicSubjectNames.has(item.name)
                    && Boolean(item.image || item.raw_image || item.three_view_url)
            })
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '读取失败')
        subjects.value = []
    } finally {
        loading.value = false
    }
}

const switchScope = (value: SubjectScope) => {
    scope.value = value
    closeSubjectMenu()
    reload()
}

const toggleSubjectMenu = (id: number) => {
    activeSubjectMenuId.value = activeSubjectMenuId.value === id ? null : id
}

const closeSubjectMenu = () => {
    activeSubjectMenuId.value = null
}

const resetForm = () => {
    form.id = 0
    form.name = ''
    form.category = 'character'
    form.mode = 'upload'
    form.prompt = ''
    form.imageRaw = ''
    form.imagePreview = ''
    form.threeViewPreview = ''
    form.threeViewRaw = ''
    form.model_id = ''
    form.model_name = ''
    subjectAssets.value = []
    activeSubjectAsset.value = null
    activeSubjectTasks.value = []
    threeAssets.value = []
    activeThreeAsset.value = null
    activeThreeTasks.value = []
}

const openCreate = () => {
    closeSubjectMenu()
    resetForm()
    activeSubjectPreview.value = 'subject'
    subjectModalVisible.value = true
    if (!subjectModelOptions.value.length) loadSubjectModels()
}

const openEdit = (item: SubjectItem) => {
    closeSubjectMenu()
    form.id = item.id
    form.name = item.name
    form.category = item.category === 'scene' ? 'scene' : 'character'
    form.mode = 'upload'
    form.prompt = item.prompt || item.description || ''
    form.imageRaw = item.raw_image || item.image
    form.imagePreview = item.image
    form.threeViewPreview = item.three_view_url || item.three_view_asset?.url || ''
    form.threeViewRaw = item.three_view_asset?.uri || item.three_view_url || ''
    activeSubjectPreview.value = 'subject'
    activeSubjectAsset.value = makeCurrentSubjectAsset()
    subjectModalVisible.value = true
    if (!subjectModelOptions.value.length) loadSubjectModels()
    loadSubjectImageHistory(item.id).then(() => {
        if (activeSubjectTasks.value.length) scheduleSubjectPolling()
    }).catch(() => {
        subjectAssets.value = [makeCurrentSubjectAsset()].filter((asset): asset is SubjectAsset => Boolean(asset?.url))
        activeSubjectTasks.value = []
        activeSubjectAsset.value = makeCurrentSubjectAsset()
    })
}

const closeSubjectModal = () => {
    if (saving.value || generatingSubject.value || uploading.value) return
    clearSubjectPolling()
    subjectModelMenuOpen.value = false
    subjectResolutionMenuOpen.value = false
    activeSubjectPreview.value = 'subject'
    subjectModalVisible.value = false
}

const triggerUpload = () => fileInputRef.value?.click()

const onUploadChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    uploading.value = true
    try {
        const res: any = await uploadImage({ file })
        form.imageRaw = pickUploadRaw(res)
        form.imagePreview = pickUploadPreview(res)
        activeSubjectPreview.value = 'subject'
        await describeUploadedImage()
        await registerCurrentSubjectImage('pc_subject_library_upload')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '上传失败')
    } finally {
        uploading.value = false
    }
}

const describeUploadedImage = async () => {
    if (!form.imagePreview && !form.imageRaw) return
    if (!visionTextAvailable.value) return
    describing.value = true
    try {
        const res: any = await describeShortDramaSubjectImage({
            image: form.imagePreview || form.imageRaw,
            category: form.category
        })
        if (res?.prompt) form.prompt = String(res.prompt)
    } catch (error: any) {
        feedback.msgWarning(error?.msg || error?.message || 'AI 识别失败，请手动补充描述')
    } finally {
        describing.value = false
    }
}

const loadSubjectImageHistory = async (subjectId: number) => {
    if (!subjectId) {
        const currentAsset = makeCurrentSubjectAsset()
        subjectAssets.value = [currentAsset].filter((asset): asset is SubjectAsset => Boolean(asset?.url))
        activeSubjectAsset.value = currentAsset
        activeSubjectTasks.value = []
        return
    }
    const res: any = await getShortDramaSubjectImageHistory(subjectId)
    const rows = pickList(res)
    activeSubjectTasks.value = rows
        .map((task: any) => normalizeSubjectTask(task, subjectId))
        .filter((task: SubjectGenerationTask | null): task is SubjectGenerationTask => Boolean(task && task.subject_id === subjectId && isActiveStatus(task.status)))
    const assets = rows.flatMap((task: any) => {
        const list = Array.isArray(task?.assets) ? task.assets : []
        return list.map((asset: any) => ({
            id: asset.id || asset.task_id || asset.url,
            uri: String(asset.uri || ''),
            url: String(asset.url || ''),
            asset_type: String(asset.asset_type || 'subject_image'),
            task_id: String(task.task_id || asset.task_id || '')
        }))
    })
    const currentAsset = makeCurrentSubjectAsset()
    const seen = new Set<string>()
    subjectAssets.value = [currentAsset, ...assets]
        .filter((asset): asset is SubjectAsset => Boolean(asset?.url))
        .filter((asset) => {
            const key = String(asset.url || asset.uri || asset.id)
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
        })
    const activeKey = String(activeSubjectAsset.value?.url || activeSubjectAsset.value?.uri || '')
    activeSubjectAsset.value = subjectAssets.value.find((asset) => asset.url === activeKey || asset.uri === activeKey)
        || currentAsset
        || null
}

const registerCurrentSubjectImage = async (source = 'pc_subject_library_upload') => {
    if (!form.imageRaw && !form.imagePreview) return
    try {
        const res: any = await registerShortDramaSubjectImage({
            subject_id: form.id || undefined,
            item_id: form.id || undefined,
            subject_name: form.name.trim() || 'Draft subject',
            item_name: form.name.trim() || 'Draft subject',
            category: form.category,
            uri: form.imageRaw || form.imagePreview,
            url: form.imagePreview || form.imageRaw,
            prompt: form.prompt,
            source
        })
        const subjectId = Number(res?.subject_id || res?.item_id || form.id || 0)
        if (subjectId) form.id = subjectId
        const rawAsset = res?.asset || null
        const asset = rawAsset
            ? {
                  id: rawAsset.id || rawAsset.task_id || rawAsset.url,
                  uri: String(rawAsset.uri || ''),
                  url: String(rawAsset.url || ''),
                  asset_type: String(rawAsset.asset_type || 'subject_image'),
                  task_id: String(rawAsset.task_id || '')
              }
            : makeCurrentSubjectAsset()
        if (asset?.url) {
            previewSubjectAsset(asset)
            subjectAssets.value = [
                asset,
                ...subjectAssets.value.filter((item) => String(item.id) !== String(asset.id) && item.url !== asset.url)
            ]
        }
    } catch (error: any) {
        activeSubjectAsset.value = makeCurrentSubjectAsset()
        feedback.msgWarning(error?.msg || error?.message || '主体图片登记失败')
    }
}

const waitGeneration = async (taskId: string) => {
    let current: any = null
    for (let index = 0; index < 18; index += 1) {
        current = await getShortDramaGenerationDetail(taskId)
        if (['success', 'failed', 'canceled'].includes(String(current?.status || ''))) break
        await new Promise((resolve) => setTimeout(resolve, 2500))
    }
    return current
}

const generateSubjectImage = async () => {
    if (!form.name.trim()) {
        feedback.msgWarning('请输入主体名称')
        return
    }
    if (!form.prompt.trim()) {
        feedback.msgWarning('请输入生成提示词')
        return
    }
    const selectedModel = await ensureSubjectModel()
    if (!selectedModel) {
        feedback.msgWarning('暂无可用生图模型')
        return
    }
    generatingSubject.value = true
    activeSubjectPreview.value = 'subject'
    subjectModelMenuOpen.value = false
    try {
        applySubjectModel(selectedModel)
        const task: any = await generateShortDramaSubject({
            task_type: 'subject_image',
            subject_id: form.id || undefined,
            item_id: form.id || undefined,
            subject_name: form.name,
            item_name: form.name,
            category: form.category,
            subject_prompt: form.prompt,
            visual_prompt: form.prompt,
            image_prompt: form.prompt,
            prompt: form.prompt,
            model_id: form.model_id,
            image_model_id: form.model_id,
            channel: form.model_id,
            channel_code: form.model_id,
            model_name: form.model_name,
            resolution: selectedSubjectResolution.value || undefined,
            quality: selectedSubjectResolution.value || undefined,
            params: {
                source: 'pc_subject_library',
                subject_id: form.id || undefined,
                item_id: form.id || undefined,
                subject_name: form.name,
                category: form.category,
                subject_prompt: form.prompt,
                model_id: form.model_id,
                image_model_id: form.model_id,
                channel: form.model_id,
                channel_code: form.model_id,
                model_name: form.model_name,
                resolution: selectedSubjectResolution.value || undefined,
                quality: selectedSubjectResolution.value || undefined
            }
        })
        const requestSubjectId = Number(task?.request?.params?.subject_id || task?.request?.params?.item_id || 0)
        if (!form.id && requestSubjectId) form.id = requestSubjectId
        const taskItem = normalizeSubjectTask(task, form.id)
        mergeActiveSubjectTask(taskItem)
        if (isActiveStatus(taskItem?.status)) {
            feedback.msgSuccess('主体图生成任务已提交')
            scheduleSubjectPolling()
            return
        }
        const detail = ['success', 'failed', 'canceled'].includes(String(task?.status || ''))
            ? task
            : await waitGeneration(String(task?.task_id || ''))
        if (String(detail?.status || '') !== 'success') {
            throw new Error(detail?.error_msg || '主体图生成失败')
        }
        const asset = firstAsset(detail)
        if (!asset) throw new Error('未获取到生成图片')
        subjectAssets.value = [asset, ...subjectAssets.value.filter((item) => item.id !== asset.id)]
        if (form.id) await loadSubjectImageHistory(form.id)
        feedback.msgSuccess('主体图已生成')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '主体图生成失败')
    } finally {
        generatingSubject.value = false
    }
}

const saveSubject = async () => {
    if (!form.name.trim()) {
        feedback.msgWarning('请输入主体名称')
        return
    }
    if (!form.imageRaw && !form.imagePreview) {
        feedback.msgWarning('请先上传或生成主体图')
        return
    }
    saving.value = true
    try {
        const saved: any = await saveShortDramaSubject({
            id: form.id || undefined,
            name: form.name,
            category: form.category,
            image: form.imageRaw || form.imagePreview,
            description: form.prompt,
            status: 1
        })
        const savedId = Number(saved?.id || saved?.subject?.id || form.id || 0)
        if (savedId) form.id = savedId
        const selectedSubjectAsset = activeSubjectAsset.value
        if (form.id && selectedSubjectAsset?.id && Number(selectedSubjectAsset.id) > 0) {
            const selected: any = await selectShortDramaSubjectImage({
                subject_id: form.id,
                asset_id: selectedSubjectAsset.id
            })
            const selectedAsset = selected?.asset || selectedSubjectAsset
            applySubjectAsset({
                id: selectedAsset.id || selectedSubjectAsset.id,
                uri: String(selectedAsset.uri || selectedSubjectAsset.uri || ''),
                url: String(selectedAsset.url || selectedSubjectAsset.url || ''),
                asset_type: String(selectedAsset.asset_type || 'subject_image'),
                task_id: String(selectedAsset.task_id || selectedSubjectAsset.task_id || '')
            })
        }
        feedback.msgSuccess('保存成功')
        subjectModalVisible.value = false
        scope.value = 'user'
        await reload()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '保存失败')
    } finally {
        saving.value = false
    }
}

const removeSubject = async (item: SubjectItem) => {
    closeSubjectMenu()
    try {
        await ElMessageBox.confirm(`确定删除「${item.name}」吗？`, '删除主体', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })
        await deleteShortDramaSubject(item.id)
        feedback.msgSuccess('已删除')
        await reload()
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(error?.msg || error?.message || '删除失败')
    }
}

const handleThreeViewClick = () => {
    if (form.threeViewPreview) {
        activeSubjectPreview.value = 'three'
        return
    }
    openThreeViewFromForm()
}

const loadThreeHistory = async (subjectId: number) => {
    if (!subjectId) {
        threeAssets.value = []
        activeThreeAsset.value = null
        activeThreeTasks.value = []
        return
    }
    const res: any = await getShortDramaSubjectThreeViewHistory(subjectId)
    const rows = pickList(res)
    activeThreeTasks.value = rows
        .map((task: any) => normalizeThreeTask(task, subjectId))
        .filter((task: ThreeGenerationTask | null): task is ThreeGenerationTask => Boolean(task && task.subject_id === subjectId && isActiveStatus(task.status)))
    const assets = rows.flatMap((task: any) => {
        const list = Array.isArray(task?.assets) ? task.assets : []
        return list.map((asset: any) => ({
            id: asset.id || asset.task_id || asset.url,
            uri: String(asset.uri || ''),
            url: String(asset.url || ''),
            asset_type: String(asset.asset_type || 'three_view'),
            task_id: String(task.task_id || asset.task_id || '')
        }))
    })
    const currentAsset = makeCurrentThreeAsset()
    const seen = new Set<string>()
    threeAssets.value = [currentAsset, ...assets]
        .filter((asset): asset is SubjectAsset => Boolean(asset?.url))
        .filter((asset) => {
            const key = String(asset.url || asset.uri || asset.id)
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
        })
    const activeKey = String(activeThreeAsset.value?.url || activeThreeAsset.value?.uri || '')
    activeThreeAsset.value = threeAssets.value.find((asset) => asset.url === activeKey || asset.uri === activeKey)
        || currentAsset
        || threeAssets.value[0]
        || null
}

const openThreeView = async (item: SubjectItem) => {
    closeSubjectMenu()
    form.id = item.id
    form.name = item.name
    form.category = item.category === 'scene' ? 'scene' : 'character'
    form.prompt = item.prompt || item.description || ''
    form.imageRaw = item.raw_image || item.image
    form.imagePreview = item.image
    form.threeViewPreview = item.three_view_url || item.three_view_asset?.url || ''
    form.threeViewRaw = item.three_view_asset?.uri || item.three_view_url || ''
    threePrompt.value = threePromptForSubject(item)
    threeModalVisible.value = true
    try {
        await loadThreeHistory(item.id)
        if (activeThreeTasks.value.length) scheduleThreePolling()
    } catch {
        threeAssets.value = []
        activeThreeTasks.value = []
        activeThreeAsset.value = item.three_view_asset || null
    }
}

const openThreeViewFromForm = async () => {
    if (!hasMainSubjectImage.value && !form.threeViewPreview) {
        feedback.msgWarning('请先生成或上传主体图')
        return
    }
    threePrompt.value = threePromptForSubject({
        name: form.name,
        category: form.category,
        prompt: form.prompt
    })
    threeModalVisible.value = true
    if (form.id) {
        try {
            await loadThreeHistory(form.id)
            if (activeThreeTasks.value.length) scheduleThreePolling()
            if (!activeThreeAsset.value && form.threeViewPreview) {
                activeThreeAsset.value = {
                    id: 0,
                    uri: form.threeViewRaw || form.threeViewPreview,
                    url: form.threeViewPreview,
                    asset_type: 'three_view'
                }
            }
        } catch {
            threeAssets.value = []
            activeThreeTasks.value = []
            activeThreeAsset.value = form.threeViewPreview
                ? {
                      id: 0,
                      uri: form.threeViewRaw || form.threeViewPreview,
                      url: form.threeViewPreview,
                      asset_type: 'three_view'
                  }
                : null
        }
    } else {
        threeAssets.value = []
        activeThreeTasks.value = []
        activeThreeAsset.value = form.threeViewPreview
            ? {
                  id: 0,
                  uri: form.threeViewRaw || form.threeViewPreview,
                  url: form.threeViewPreview,
                  asset_type: 'three_view'
              }
            : null
    }
}

const closeThreeModal = () => {
    if (generatingThree.value) return
    clearThreePolling()
    subjectResolutionMenuOpen.value = false
    threeModalVisible.value = false
}

const confirmThreeModal = () => {
    if (generatingThree.value) return
    if (activeThreeAsset.value?.url) {
        applyThreeAsset(activeThreeAsset.value)
    } else if (activeThreeTasks.value.length) {
        feedback.msgWarning('三视图还在生成中，请稍后选择')
        return
    }
    closeThreeModal()
}

const generateThreeView = async () => {
    if (!form.imageRaw && !form.imagePreview) {
        feedback.msgWarning('请先生成或上传主体图')
        return
    }
    if (!form.name.trim()) {
        feedback.msgWarning('请输入主体名称')
        return
    }
    const selectedModel = await ensureSubjectModel()
    if (!selectedModel) {
        feedback.msgWarning('暂无可用生图模型')
        return
    }
    generatingThree.value = true
    subjectModelMenuOpen.value = false
    try {
        const prompt = effectiveThreePrompt()
        applySubjectModel(selectedModel)
        const task: any = await generateShortDramaSubject({
            task_type: 'three_view',
            subject_id: form.id || undefined,
            item_id: form.id || undefined,
            subject_name: form.name,
            item_name: form.name,
            category: form.category,
            subject_prompt: form.prompt,
            prompt,
            view_mode: 'three_view',
            model_id: form.model_id,
            image_model_id: form.model_id,
            channel: form.model_id,
            channel_code: form.model_id,
            model_name: form.model_name,
            resolution: selectedSubjectResolution.value || undefined,
            quality: selectedSubjectResolution.value || undefined,
            reference_image: form.imageRaw || form.imagePreview,
            reference_images: [form.imageRaw || form.imagePreview],
            params: {
                source: 'pc_subject_library',
                subject_id: form.id || undefined,
                subject_name: form.name,
                category: form.category,
                subject_prompt: form.prompt,
                prompt,
                view_mode: 'three_view',
                model_id: form.model_id,
                image_model_id: form.model_id,
                channel: form.model_id,
                channel_code: form.model_id,
                model_name: form.model_name,
                resolution: selectedSubjectResolution.value || undefined,
                quality: selectedSubjectResolution.value || undefined,
                reference_images: [form.imageRaw || form.imagePreview]
            }
        })
        const requestSubjectId = Number(task?.request?.params?.subject_id || task?.request?.params?.item_id || 0)
        if (!form.id && requestSubjectId) form.id = requestSubjectId
        const taskItem = normalizeThreeTask(task, form.id)
        mergeActiveThreeTask(taskItem)
        if (isActiveStatus(taskItem?.status)) {
            feedback.msgSuccess('三视图生成任务已提交')
            scheduleThreePolling()
            return
        }
        if (String(task?.status || '') !== 'success') {
            throw new Error(task?.error_msg || '三视图生成失败')
        }
        const asset = firstAsset(task)
        if (!asset) {
            feedback.msgSuccess('三视图生成任务已提交')
            if (form.id) {
                activeThreeTasks.value = activeThreeTasks.value.length ? activeThreeTasks.value : [{
                    task_id: String(task?.task_id || `three-${Date.now()}`),
                    status: 'running',
                    subject_id: form.id,
                    error_msg: ''
                }]
                scheduleThreePolling()
            }
            return
        }
        activeThreeAsset.value = asset
        threeAssets.value = [asset, ...threeAssets.value.filter((item) => item.id !== asset.id)]
        feedback.msgSuccess('三视图已生成')
        if (form.id) await loadThreeHistory(form.id)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '三视图生成失败')
    } finally {
        generatingThree.value = false
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

watch(selectedSubjectModel, (model) => {
    selectedSubjectResolution.value = resolveShortDramaResolution(model, selectedSubjectResolution.value)
}, { immediate: true })

const handleDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null
    if (!target?.closest('.subject-card__actions, .subject-card__more')) {
        closeSubjectMenu()
    }
}

onMounted(() => {
    enablePageScroll()
    loadUserPoints()
    loadSubjectModels()
    reload()
    document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
    clearSubjectPolling()
    clearThreePolling()
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    restorePageScroll()
})
</script>

<style scoped lang="scss">
.subject-library-page {
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
.subject-library-main {
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
    color: #fff;
    font-size: 16px;
    line-height: 16px;
}

:deep(.short-drama-credit > .glass-surface__content) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    min-width: 0;
    white-space: nowrap;
    box-sizing: border-box;
}

.short-drama-credit__icon {
    position: relative;
    z-index: 5;
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

.subject-library-main {
    width: 100%;
    min-height: 100vh;
    padding: 80px 48px 80px 120px;
    box-sizing: border-box;
}

.subject-library-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 38px;
    margin-bottom: 20px;
}

.subject-tabs {
    display: flex;
    align-items: center;
    gap: 14px;
}

.subject-tab {
    border: 0;
    margin: 0;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.42);
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
    cursor: pointer;
}

.subject-tab.is-active {
    color: #fff;
}

.subject-tools {
    display: flex;
    align-items: center;
    gap: 12px;
}

.subject-select,
.subject-search {
    height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    background: #101012;
}

.subject-select {
    position: relative;
    width: 92px;
}

.subject-select::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 16px;
    width: 6px;
    height: 6px;
    border-right: 1px solid rgba(255, 255, 255, 0.68);
    border-bottom: 1px solid rgba(255, 255, 255, 0.68);
    pointer-events: none;
    transform: translateY(-65%) rotate(45deg);
}

.subject-select select {
    width: 100%;
    height: 100%;
    border: 0;
    padding: 0 34px 0 18px;
    background: transparent;
    color: #c8c8c8;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
}

.subject-search {
    display: flex;
    align-items: center;
    width: 300px;
    padding: 0 10px 0 18px;
    box-sizing: border-box;
}

.subject-search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: #fff;
    outline: none;
}

.subject-search button {
    min-width: 44px;
    height: 100%;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.48);
    cursor: pointer;
}

.modal-actions button:not(.ghost) {
    height: 36px;
    border: 0;
    border-radius: 8px;
    padding: 0 18px;
    background: #fff;
    color: #111;
    font-weight: 700;
    cursor: pointer;
}

.subject-grid-wrap {
    overflow: visible;
}

.subject-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
    justify-content: start;
    width: 100%;
}

.subject-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    aspect-ratio: 2 / 3;
    height: auto;
    min-width: 0;
    overflow: hidden;
    border: 0;
    border-radius: 12px;
    padding: 0;
    background: rgba(30, 31, 32, 0.22);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-sizing: border-box;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.subject-card:hover {
    background: rgba(42, 43, 44, 0.52);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42), 0 18px 42px rgba(0, 0, 0, 0.25);
    transform: translateY(-2px);
}

.subject-card--new {
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 0;
    text-align: center;
}

.subject-card__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: #a1a1a1;
}

.subject-card--new > span:last-child {
    position: relative;
    z-index: 5;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 15px;
}

.subject-card__media {
    position: relative;
    z-index: 5;
    flex: 1 1 auto;
    min-height: 0;
    margin: 4px 4px 0;
    width: calc(100% - 8px);
    height: auto;
    overflow: hidden;
    border-radius: 8px;
    background: #242424;
}

.subject-card__media > img:not(.subject-card__three) {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
}

.subject-card__placeholder,
.subject-empty,
.three-preview span {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.42);
}

.subject-card__placeholder {
    width: 100%;
    height: 100%;
}

.subject-card__three {
    position: absolute;
    left: 8px;
    bottom: 8px;
    width: 72px;
    height: 42px;
    border: 2px solid rgba(255, 255, 255, 0.9);
    border-radius: 5px;
    object-fit: cover;
    background: #fff;
}

.subject-card__more {
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

.subject-card:hover .subject-card__more,
.subject-card__more[aria-expanded='true'] {
    opacity: 1;
    transform: translateY(0);
}

.subject-card__more:hover {
    background: rgba(255, 255, 255, 0.14);
}

.subject-card__actions {
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

.subject-card__actions button {
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

.subject-card__actions button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.subject-card__actions button.is-danger {
    color: #ff8a8a;
}

.subject-card__actions button.is-danger:hover {
    background: rgba(255, 82, 82, 0.12);
    color: #ffaaaa;
}

.subject-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 52px;
    min-height: 52px;
    padding: 0 10px;
    box-sizing: border-box;
    text-align: left;
}

.subject-card__footer strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 15px;
}

.subject-card__footer span {
    flex: 0 0 auto;
    text-align: right;
    color: rgba(255, 255, 255, 0.48);
    font-size: 12px;
}

.subject-empty {
    height: 60vh;
}

.subject-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
}

.subject-modal,
.three-modal {
    width: min(820px, calc(100vw - 48px));
    overflow: hidden;
    border-radius: 10px;
    background: #1f2022;
    color: #fff;
    box-sizing: border-box;
}

.three-modal {
    width: min(1104px, calc(100vw - 64px));
    min-height: 676px;
}

.modal-head,
.modal-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 0;
}

.modal-head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
}

.modal-head button {
    border: 0;
    background: transparent;
    color: #fff;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
}

.subject-modal__body {
    display: grid;
    grid-template-columns: 360px 400px;
    gap: 22px;
    padding: 17px 20px 0;
}

.subject-form {
    display: flex;
    flex-direction: column;
    min-height: 434px;
    gap: 16px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: rgba(255, 255, 255, 0.86);
    font-size: 14px;
}

.field input,
.three-prompt {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 7px;
    background: #171719;
    color: #fff;
    outline: none;
}

.field input {
    height: 40px;
    padding: 0 14px;
    box-sizing: border-box;
}

.segmented {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    overflow: hidden;
    border-radius: 7px;
    background: #303133;
    padding: 3px;
}

.segmented button {
    height: 32px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: rgba(255, 255, 255, 0.48);
    cursor: pointer;
}

.segmented button.is-active {
    background: #fff;
    color: #111;
    font-weight: 700;
}

.subject-type-field {
    margin-top: -4px;
}

.subject-type-segmented button {
    font-size: 14px;
}

.upload-btn {
    flex: 0 0 auto;
    height: 42px;
    border: 0;
    border-radius: 7px;
    background: #303133;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
}

.upload-plus {
    margin-right: 8px;
    font-size: 28px;
    font-weight: 300;
    line-height: 0;
    vertical-align: -2px;
}

.prompt-panel {
    display: flex;
    flex-direction: column;
    height: 174px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    background: #171719;
    box-sizing: border-box;
}

.prompt-panel.is-upload {
    padding: 5px;
}

.prompt-panel.is-ai {
    padding: 0;
}

.prompt-editor {
    flex: 1 1 auto;
    min-height: 0;
    border: 0;
    background: transparent;
    color: #fff;
    outline: none;
    resize: none;
    padding: 14px;
    line-height: 1.55;
    font-size: 14px;
    box-sizing: border-box;
}

.prompt-panel.is-upload .prompt-editor {
    padding: 12px 10px 4px;
}

.prompt-panel__foot,
.three-prompt-panel__foot {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 38px;
    padding: 0 10px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

.model-picker {
    position: relative;
    flex: 0 0 auto;
}

.resolution-picker {
    position: relative;
    flex: 0 0 auto;
}

.resolution-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 32px;
    border: 0;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    font-size: 14px;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
}

.model-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
}

.model-trigger img {
    display: block;
    width: 32px;
    height: 32px;
    object-fit: contain;
}

.model-trigger:disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

.model-menu {
    position: absolute;
    left: 0;
    bottom: 34px;
    z-index: 4;
    width: 188px;
    max-height: 220px;
    overflow-y: auto;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: #292a2c;
}

.model-menu--resolution {
    width: 132px;
}

.model-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.78);
    cursor: pointer;
    text-align: left;
}

.model-menu button span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.model-menu button i {
    flex: 0 0 auto;
    font-style: normal;
}

.model-menu button:hover,
.model-menu button.is-active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.model-menu-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 68px;
    color: rgba(255, 255, 255, 0.45);
}

.cube-icon {
    position: relative;
    width: 18px;
    height: 18px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0;
    line-height: 0;
}

.cube-icon::before,
.cube-icon::after {
    content: '';
    position: absolute;
    border: 1.4px solid currentColor;
    box-sizing: border-box;
}

.cube-icon::before {
    left: 4px;
    top: 5px;
    width: 10px;
    height: 10px;
    transform: rotate(30deg) skewY(-12deg);
}

.cube-icon::after {
    left: 7px;
    top: 4px;
    width: 7px;
    height: 7px;
    border-left: 0;
    border-bottom: 0;
    transform: skewY(28deg);
}

.prompt-cost {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.75);
}

.prompt-cost button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: #111;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;

    img {
        width: 15px;
        height: 15px;
        object-fit: contain;
        filter: brightness(0);
    }
}

.subject-preview {
    display: grid;
    grid-template-columns: 320px 56px;
    gap: 14px;
    align-items: start;
}

.main-preview {
    position: relative;
    width: 320px;
    height: 434px;
    overflow: hidden;
    border-radius: 8px;
    background: #303133;
}

.main-preview-hit {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: zoom-in;
}

.main-preview-hit:disabled {
    cursor: default;
}

.main-preview-hit span {
    display: none;
}

.main-preview-loading {
    position: absolute;
    inset: 0;
    z-index: 3;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
}

.main-preview-loading :deep(.short-drama-grainient-placeholder),
.subject-history button.is-generating :deep(.short-drama-grainient-placeholder),
.three-history button.is-generating :deep(.short-drama-grainient-placeholder),
.three-preview :deep(.short-drama-grainient-placeholder) {
    width: 100%;
    height: 100%;
}

.main-preview-hit img,
.three-preview img,
.mini-preview img,
.subject-history img,
.three-history img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.mini-preview,
.three-trigger,
.three-preview-box {
    width: 56px;
    height: 56px;
    border: 0;
    border-radius: 8px;
    background: #303133;
    color: rgba(255, 255, 255, 0.62);
}

.mini-preview.is-active,
.subject-history button.is-active,
.three-preview-box.is-active {
    box-shadow: 0 0 0 2px #fff;
}

.three-preview-box {
    position: relative;
    overflow: hidden;
}

.mini-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-size: 13px;
}

.preview-side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 434px;
    overflow-y: auto;
    scrollbar-width: none;
}

.preview-side::-webkit-scrollbar {
    display: none;
}

.subject-history {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.subject-history button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    overflow: hidden;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: #303133;
    color: rgba(255, 255, 255, 0.62);
    font-size: 12px;
    line-height: 16px;
    cursor: pointer;
}

.subject-history button.is-generating {
    cursor: default;
    background: transparent;
}

.subject-history button:disabled {
    opacity: 0.72;
}

.three-trigger {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 13px;
    line-height: 18px;
    cursor: pointer;
}

.three-trigger.has-image {
    background: #171719;
}

.three-trigger img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.three-view-entry {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(31, 32, 34, 0.82);
    cursor: pointer;
    backdrop-filter: blur(8px);
}

.three-view-entry img {
    width: 16px;
    height: 16px;
    object-fit: contain;
}

.three-trigger i {
    font-style: normal;
    font-size: 24px;
    line-height: 20px;
}

.three-trigger:disabled,
.main-preview-hit:disabled,
.prompt-cost button:disabled,
.modal-actions button:disabled,
.upload-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

.preview-viewer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3020;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
    background: rgba(0, 0, 0, 0.82);
    box-sizing: border-box;
}

.preview-viewer-backdrop img {
    display: block;
    max-width: min(1120px, 100%);
    max-height: 100%;
    border-radius: 8px;
    object-fit: contain;
}

.preview-viewer-close {
    position: fixed;
    top: 28px;
    right: 32px;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
}

.modal-actions {
    justify-content: flex-end;
    gap: 20px;
    padding: 20px 20px 20px;
}

.modal-actions button {
    width: 120px;
    height: 44px;
    border: 0;
    border-radius: 8px;
    padding: 0;
    font-size: 16px;
    font-weight: 600;
}

.modal-actions button:not(.ghost) {
    height: 44px;
    padding: 0;
}

.modal-actions .ghost {
    background: #303133;
    color: #fff;
    cursor: pointer;
}

.three-modal__body {
    position: relative;
    min-height: 382px;
    padding: 22px 20px 0;
}

.three-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 680px;
    max-width: calc(100% - 220px);
    height: 382px;
    margin: 0 auto;
    overflow: hidden;
    border-radius: 8px;
    background: #28292b;
}

.three-history {
    position: absolute;
    top: 22px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 124px;
    max-height: 382px;
    overflow-y: auto;
}

.three-history button {
    width: 124px;
    height: 68px;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 7px;
    padding: 0;
    background: #333;
    cursor: pointer;
}

.three-history button.is-active {
    border-color: #fff;
}

.three-history button.is-generating {
    display: flex;
    align-items: center;
    justify-content: center;
    border-color: rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.62);
    cursor: default;
}

.three-prompt-panel {
    display: flex;
    flex-direction: column;
    width: calc(100% - 80px);
    height: 114px;
    margin: 30px 40px 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: #171719;
    box-sizing: border-box;
}

.three-prompt {
    flex: 1 1 auto;
    min-height: 0;
    border: 0;
    background: transparent;
    resize: none;
    padding: 14px;
    line-height: 1.7;
    box-sizing: border-box;
}

.hidden-file {
    display: none;
}

@media (max-width: 1780px) {
    .subject-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}

@media (max-width: 1500px) {
    .subject-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

@media (max-width: 1220px) {
    .subject-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 980px) {
    .subject-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 768px) {
    .subject-library-main {
        padding: 96px 18px 64px 82px;
    }

    .subject-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
