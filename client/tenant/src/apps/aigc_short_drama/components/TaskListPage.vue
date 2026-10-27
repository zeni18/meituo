<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                <el-form-item label="任务类型">
                    <el-select
                        v-model="queryParams.task_type"
                        class="w-[180px]"
                        placeholder="全部类型"
                        @change="resetPage"
                    >
                        <el-option
                            v-for="item in pageConfig.typeOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="状态">
                    <el-select
                        v-model="queryParams.status"
                        class="w-[150px]"
                        clearable
                        placeholder="全部状态"
                        @change="resetPage"
                    >
                        <el-option label="排队中" value="queued" />
                        <el-option label="待处理" value="pending" />
                        <el-option label="生成中" value="running" />
                        <el-option label="已完成" value="success" />
                        <el-option label="已失败" value="failed" />
                        <el-option label="已取消" value="canceled" />
                    </el-select>
                </el-form-item>
                <el-form-item label="项目">
                    <el-input
                        v-model="queryParams.project_keyword"
                        class="w-[220px]"
                        placeholder="项目ID/项目名称"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item :label="pageConfig.keywordLabel">
                    <el-input
                        v-model="queryParams.keyword"
                        class="w-[240px]"
                        :placeholder="pageConfig.keywordPlaceholder"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="用户">
                    <el-input
                        v-model="queryParams.user_keyword"
                        class="w-[220px]"
                        placeholder="用户ID/昵称/账号/手机号"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="时间">
                    <el-date-picker
                        v-model="queryParams.time"
                        type="daterange"
                        value-format="YYYY-MM-DD"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        range-separator="-"
                        class="!w-[260px]"
                        @change="resetPage"
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">查询</el-button>
                    <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-alert
            v-if="listError"
            class="mt-4"
            type="warning"
            :title="listError"
            show-icon
            :closable="false"
        />

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="tableLists">
                <el-table-column label="ID" width="90">
                    <template #default="{ row }">{{ valueText(row.id) }}</template>
                </el-table-column>
                <el-table-column label="项目/内容" min-width="260" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div class="font-medium">{{ mainTitle(row) }}</div>
                        <div class="text-xs text-tx-secondary">{{ subTitle(row) }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="输出资产" width="150">
                    <template #default="{ row }">
                        <div v-if="assetList(row).length" class="asset-preview">
                            <template v-for="asset in assetList(row).slice(0, 3)" :key="asset.url">
                                <el-image
                                    v-if="asset.kind === 'image'"
                                    class="asset-thumb"
                                    :src="asset.url"
                                    fit="cover"
                                    :preview-src-list="imagePreviewList(row)"
                                    preview-teleported
                                />
                                <el-link
                                    v-else-if="asset.kind !== 'audio'"
                                    class="asset-link"
                                    type="primary"
                                    :href="asset.url"
                                    target="_blank"
                                >
                                    {{ asset.kind === 'video' ? '视频' : '文件' }}
                                </el-link>
                                <audio
                                    v-else
                                    class="asset-audio-mini"
                                    :src="asset.url"
                                    controls
                                    preload="metadata"
                                ></audio>
                            </template>
                        </div>
                        <span v-else class="text-tx-secondary">暂无</span>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="170" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>{{ userName(row) }}</div>
                        <div class="text-xs text-tx-secondary">{{ userSubText(row) }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="任务ID" min-width="190" show-overflow-tooltip>
                    <template #default="{ row }">{{ taskId(row) }}</template>
                </el-table-column>
                <el-table-column label="进度" width="130">
                    <template #default="{ row }">
                        <el-progress :percentage="progressValue(row)" :stroke-width="8" />
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                        <el-tag :type="statusTag(row)">{{ statusText(row) }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="错误" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        <span :class="{ 'text-error': friendlyError(row) }">
                            {{ friendlyError(row) || '-' }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="生成时间" width="170">
                    <template #default="{ row }">{{ timeText(generationTimeValue(row)) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-drawer v-model="detailVisible" title="任务详情" size="720px" v-loading="detailLoading">
            <el-descriptions :column="2" border>
                <el-descriptions-item label="任务类型">{{
                    taskTypeText(detail)
                }}</el-descriptions-item>
                <el-descriptions-item label="任务状态">{{
                    statusText(detail)
                }}</el-descriptions-item>
                <el-descriptions-item label="任务ID">{{ taskId(detail) }}</el-descriptions-item>
                <el-descriptions-item label="项目">{{ projectText(detail) }}</el-descriptions-item>
                <el-descriptions-item label="用户">{{ userName(detail) }}</el-descriptions-item>
                <el-descriptions-item label="进度"
                    >{{ progressValue(detail) }}%</el-descriptions-item
                >
                <el-descriptions-item label="租户成本">
                    {{ pointText(detail.tenant_cost_points) }}
                </el-descriptions-item>
                <el-descriptions-item label="用户消费">
                    {{ pointText(detail.user_charge_points) }}
                </el-descriptions-item>
                <el-descriptions-item label="创建时间">
                    {{ timeText(detail.create_time || detail.created_at) }}
                </el-descriptions-item>
                <el-descriptions-item label="更新时间">
                    {{ timeText(updateTimeValue(detail)) }}
                </el-descriptions-item>
                <el-descriptions-item label="当前步骤" :span="2">
                    {{ valueText(detail.current_step || detail.step || statusText(detail)) }}
                </el-descriptions-item>
            </el-descriptions>

            <el-alert
                v-if="friendlyError(detail)"
                class="mt-4"
                type="error"
                :title="friendlyError(detail)"
                :closable="false"
                show-icon
            />

            <div v-if="taskType(detail) === 'bgm_audio'" class="detail-section">
                <div class="detail-title">AIGC音乐任务</div>
                <el-descriptions :column="2" border>
                    <el-descriptions-item label="音乐任务ID">
                        {{ valueText(musicTask(detail).task_id || musicTask(detail).id) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="服务商任务ID">
                        {{ valueText(musicTask(detail).provider_task_id || detail.music_provider_task_id) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="音乐状态">
                        {{ musicStatusText(detail) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="完成时间">
                        {{ valueText(musicTask(detail).finish_time) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="音乐错误" :span="2">
                        <span :class="{ 'text-error': musicError(detail) }">
                            {{ musicError(detail) || '-' }}
                        </span>
                    </el-descriptions-item>
                </el-descriptions>
            </div>

            <div class="detail-section">
                <div class="detail-title">任务内容</div>
                <el-input :model-value="detailPrompt(detail)" type="textarea" :rows="5" readonly />
            </div>

            <div class="detail-section">
                <div class="detail-title">输出资产</div>
                <div v-if="assetList(detail).length" class="asset-grid">
                    <div v-for="asset in assetList(detail)" :key="asset.url" class="asset-card">
                        <el-image
                            v-if="asset.kind === 'image'"
                            class="asset-image"
                            :src="asset.url"
                            fit="contain"
                            :preview-src-list="imagePreviewList(detail)"
                            preview-teleported
                        />
                        <video
                            v-else-if="asset.kind === 'video'"
                            class="asset-video"
                            :src="asset.url"
                            controls
                            preload="metadata"
                        ></video>
                        <audio
                            v-else-if="asset.kind === 'audio'"
                            class="asset-audio"
                            :src="asset.url"
                            controls
                            preload="metadata"
                        ></audio>
                        <el-link v-else type="primary" :href="asset.url" target="_blank">
                            打开文件
                        </el-link>
                        <div class="asset-name">{{ asset.name || asset.type || '输出资产' }}</div>
                    </div>
                </div>
                <el-empty v-else description="暂无输出资产" :image-size="80" />
            </div>
        </el-drawer>
    </div>
</template>

<script lang="ts" setup>
import {
    getAigcShortDramaGenerationTaskDetail,
    getAigcShortDramaGenerationTaskLists,
    getAigcShortDramaSceneTaskLists,
    getAigcShortDramaScriptTaskLists,
    getAigcShortDramaStoryboardLists,
    getAigcShortDramaSubjectTaskLists
} from '@/apps/aigc_short_drama/api'
import { usePaging } from '@/hooks/usePaging'

type TaskScope = 'script' | 'subject' | 'scene' | 'storyboard' | 'bgmAudio' | 'shotVideo' | 'finalVideo'
type TagType = '' | 'success' | 'warning' | 'info' | 'danger'
type AssetItem = {
    name: string
    type: string
    url: string
    kind: 'image' | 'video' | 'audio' | 'file'
}

const props = defineProps<{
    scope: TaskScope
}>()

const typeLabels: Record<string, string> = {
    script_plan: '剧本任务',
    subject: '主体任务',
    subject_image: '主体生图',
    three_view: '主体三视图',
    scene: '场景任务',
    scene_image: '场景生图',
    storyboard: '分镜任务',
    shot_image: '分镜生图',
    bgm_audio: '背景音乐',
    shot_video: '生视频',
    export_video: '成片合成',
    final_video: '成片视频'
}

const generationTaskTypes = [
    'subject_image',
    'three_view',
    'scene_image',
    'shot_image',
    'bgm_audio',
    'shot_video',
    'export_video',
    'final_video'
]

const scopeConfig = {
    script: {
        keywordLabel: '剧本搜索',
        keywordPlaceholder: '项目标题/故事灵感/任务ID',
        defaultType: 'script_plan',
        typeOptions: [{ label: typeLabels.script_plan, value: 'script_plan' }],
        fetchFun: getAigcShortDramaScriptTaskLists
    },
    subject: {
        keywordLabel: '主体搜索',
        keywordPlaceholder: '主体名称/描述/项目/任务ID',
        defaultType: 'subject',
        typeOptions: [
            { label: typeLabels.subject, value: 'subject' },
            { label: typeLabels.subject_image, value: 'subject_image' },
            { label: typeLabels.three_view, value: 'three_view' }
        ],
        fetchFun: getAigcShortDramaSubjectTaskLists
    },
    scene: {
        keywordLabel: '场景搜索',
        keywordPlaceholder: '场景名称/描述/项目/任务ID',
        defaultType: 'scene',
        typeOptions: [
            { label: typeLabels.scene, value: 'scene' },
            { label: typeLabels.scene_image, value: 'scene_image' }
        ],
        fetchFun: getAigcShortDramaSceneTaskLists
    },
    storyboard: {
        keywordLabel: '分镜搜索',
        keywordPlaceholder: '分镜/场景/画面/项目/任务ID',
        defaultType: 'storyboard',
        typeOptions: [
            { label: typeLabels.storyboard, value: 'storyboard' },
            { label: typeLabels.shot_image, value: 'shot_image' },
            { label: typeLabels.bgm_audio, value: 'bgm_audio' }
        ],
        fetchFun: getAigcShortDramaStoryboardLists
    },
    bgmAudio: {
        keywordLabel: '背景音乐搜索',
        keywordPlaceholder: '音乐提示词/项目/任务ID',
        defaultType: 'bgm_audio',
        typeOptions: [{ label: typeLabels.bgm_audio, value: 'bgm_audio' }],
        fetchFun: getAigcShortDramaGenerationTaskLists
    },
    shotVideo: {
        keywordLabel: '视频搜索',
        keywordPlaceholder: '分镜/项目/任务ID',
        defaultType: 'shot_video',
        typeOptions: [{ label: typeLabels.shot_video, value: 'shot_video' }],
        fetchFun: getAigcShortDramaGenerationTaskLists
    },
    finalVideo: {
        keywordLabel: '成片搜索',
        keywordPlaceholder: '项目/成片/任务ID',
        defaultType: 'export_video',
        typeOptions: [
            { label: typeLabels.export_video, value: 'export_video' },
            { label: typeLabels.final_video, value: 'final_video' }
        ],
        fetchFun: getAigcShortDramaGenerationTaskLists
    }
}

const pageConfig = computed(() => scopeConfig[props.scope])
const listError = ref('')
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<Record<string, any>>({})
const queryParams = reactive({
    task_type: pageConfig.value.defaultType,
    status: '',
    project_keyword: '',
    keyword: '',
    user_keyword: '',
    time: [] as string[]
})

const fetchTaskLists = async (params: Record<string, any>) => {
    const requestParams = buildRequestParams(params)
    const fetchFun = generationTaskTypes.includes(queryParams.task_type)
        ? getAigcShortDramaGenerationTaskLists
        : pageConfig.value.fetchFun
    try {
        listError.value = ''
        const res = await fetchFun(requestParams)
        return {
            lists: Array.isArray(res?.lists) ? res.lists : [],
            count: Number(res?.count || 0),
            page_no: Number(res?.page_no || requestParams.page_no || 1),
            page_size: Number(res?.page_size || requestParams.page_size || 15),
            extend: res?.extend || {}
        }
    } catch (error: any) {
        listError.value = errorMessage(error)
        return {
            lists: [],
            count: 0,
            page_no: Number(requestParams.page_no || 1),
            page_size: Number(requestParams.page_size || 15)
        }
    }
}

const { pager, getLists, resetPage } = usePaging({
    fetchFun: fetchTaskLists,
    params: queryParams
})

const tableLists = computed(() => (Array.isArray(pager.lists) ? pager.lists : []))

watch(
    () => props.scope,
    () => {
        resetQuery()
    }
)

const resetQuery = () => {
    Object.assign(queryParams, {
        task_type: pageConfig.value.defaultType,
        status: '',
        project_keyword: '',
        keyword: '',
        user_keyword: '',
        time: []
    })
    resetPage()
}

const buildRequestParams = (params: Record<string, any>) => {
    const [startTime = '', endTime = ''] = Array.isArray(params.time) ? params.time : []
    const requestParams: Record<string, any> = {
        ...params,
        task_type: params.task_type,
        project_keyword: params.project_keyword,
        start_time: startTime,
        end_time: endTime,
        create_start_time: startTime,
        create_end_time: endTime
    }
    delete requestParams.time
    if (
        params.project_keyword &&
        !params.keyword &&
        !generationTaskTypes.includes(params.task_type)
    ) {
        requestParams.keyword = params.project_keyword
    }
    return requestParams
}

const openDetail = async (row: Record<string, any>) => {
    detail.value = row || {}
    detailVisible.value = true
    if (!generationTaskTypes.includes(taskType(row))) {
        return
    }
    detailLoading.value = true
    try {
        const res = await getAigcShortDramaGenerationTaskDetail({
            id: row?.id,
            task_id: row?.task_id
        })
        detail.value = { ...row, ...(res || {}) }
    } catch (error: any) {
        listError.value = errorMessage(error)
    } finally {
        detailLoading.value = false
    }
}

const statusMap: Record<string, { text: string; tag: TagType }> = {
    pending: { text: '待处理', tag: 'info' },
    queued: { text: '排队中', tag: 'info' },
    running: { text: '生成中', tag: 'warning' },
    processing: { text: '处理中', tag: 'warning' },
    generating: { text: '生成中', tag: 'warning' },
    success: { text: '已完成', tag: 'success' },
    completed: { text: '已完成', tag: 'success' },
    ready: { text: '已生成', tag: 'success' },
    failed: { text: '已失败', tag: 'danger' },
    canceled: { text: '已取消', tag: 'info' },
    cancel: { text: '已取消', tag: 'info' }
}

const valueText = (value: any) => {
    if (value === 0) {
        return '0'
    }
    return value ? String(value) : '-'
}

const plainText = (value: any) => {
    if (value === 0) {
        return '0'
    }
    if (value === null || value === undefined) {
        return ''
    }
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

const firstText = (...values: any[]) => {
    for (const value of values) {
        const text = plainText(value)
        if (text) {
            return text
        }
    }
    return ''
}

const promptRequest = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    const request = task?.request || row?.request || {}
    return request && typeof request === 'object' ? request : {}
}

const promptParams = (row: Record<string, any>) => {
    const request = promptRequest(row)
    const params = request?.params || row?.params || {}
    return params && typeof params === 'object' ? params : {}
}

const nestedPromptParams = (params: Record<string, any>) => {
    const nested = params?.params || {}
    return nested && typeof nested === 'object' ? nested : {}
}

const internalPromptLinePatterns = [
    /生成一张短剧(?:主体|关键物品|场景)统一参考图/u,
    /本次生成必须严格以用户当前输入的主体提示词为唯一外貌依据/u,
    /如果当前提示词与旧主体描述、历史图片或历史资产冲突/u,
    /正面单主体标准参考图/u,
    /单个物品主图/u,
    /角色三视图设定图/u,
    /物品三视图或多角度设定图/u,
    /只生成一个角色/u,
    /只生成一张统一参考图/u,
    /可用于后续分镜保持一致/u,
    /不要(?:局部特写|半张脸|裁切脸部|拼贴|多宫格|海报|档案卡|说明文字|色卡|参数栏|额外人物)/u,
    /不要出现人物、手、脸、身体、模特或穿戴效果/u,
    /只呈现物品本身，不出现人物/u,
    /高分辨率电影质感/u,
    /主体和场景连续，细节清晰/u,
    /不要字幕、文字、水印/u,
    /参考已提供的角色主图和三视图/u,
    /参考已提供的场景图/u,
    /画面中不要出现人物/u,
    /低质量、模糊/u
]

const sanitizeTaskPrompt = (value: any) => {
    const raw = plainText(value)
    if (!raw) {
        return ''
    }
    const normalized = raw
        .replace(/^```[a-z]*\s*/i, '')
        .replace(/```$/i, '')
        .replace(/\r\n/g, '\n')
        .trim()
    const lines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !internalPromptLinePatterns.some((pattern) => pattern.test(line)))
    const cleaned = lines.join('\n').trim()
    if (!cleaned || internalPromptLinePatterns.some((pattern) => pattern.test(cleaned))) {
        return ''
    }
    return cleaned
}

const taskReadablePrompt = (row: Record<string, any>) => {
    const request = promptRequest(row)
    const params = promptParams(row)
    const nested = nestedPromptParams(params)
    const type = taskType(row)
    const candidatesByType: Record<string, any[]> = {
        script_plan: [
            request?.user_prompt,
            request?.prompt,
            params?.user_prompt,
            params?.prompt,
            row?.user_prompt,
            row?.prompt,
            row?.description
        ],
        subject_image: [
            params?.user_prompt,
            nested?.user_prompt,
            params?.subject_prompt,
            nested?.subject_prompt,
            params?.visual_prompt,
            nested?.visual_prompt,
            params?.image_prompt,
            nested?.image_prompt,
            params?.subject_description,
            nested?.subject_description,
            params?.item_description,
            nested?.item_description,
            params?.prompt,
            nested?.prompt,
            row?.user_prompt,
            row?.description,
            row?.visual_prompt,
            row?.prompt
        ],
        three_view: [
            params?.user_prompt,
            nested?.user_prompt,
            params?.prompt,
            nested?.prompt,
            params?.subject_prompt,
            nested?.subject_prompt,
            params?.visual_prompt,
            nested?.visual_prompt,
            row?.user_prompt,
            row?.description,
            row?.visual_prompt,
            row?.prompt
        ],
        scene_image: [
            params?.user_prompt,
            nested?.user_prompt,
            params?.scene_prompt,
            nested?.scene_prompt,
            params?.visual_prompt,
            nested?.visual_prompt,
            params?.image_prompt,
            nested?.image_prompt,
            params?.scene_description,
            nested?.scene_description,
            params?.item_description,
            nested?.item_description,
            params?.prompt,
            nested?.prompt,
            row?.user_prompt,
            row?.description,
            row?.visual_prompt,
            row?.prompt
        ],
        shot_image: [
            params?.message,
            nested?.message,
            params?.user_prompt,
            nested?.user_prompt,
            params?.image_prompt,
            nested?.image_prompt,
            params?.visual_prompt,
            nested?.visual_prompt,
            row?.visual_description,
            params?.prompt,
            nested?.prompt,
            row?.user_prompt,
            row?.description,
            row?.prompt
        ],
        shot_video: [
            params?.message,
            nested?.message,
            params?.user_prompt,
            nested?.user_prompt,
            params?.video_prompt,
            nested?.video_prompt,
            row?.visual_description,
            params?.prompt,
            nested?.prompt,
            row?.user_prompt,
            row?.description,
            row?.prompt
        ],
        bgm_audio: [
            params?.music_prompt,
            nested?.music_prompt,
            params?.bgm_prompt,
            nested?.bgm_prompt,
            params?.prompt,
            nested?.prompt,
            row?.user_prompt,
            row?.description,
            row?.prompt
        ]
    }
    const genericCandidates = [
        row?.display_prompt,
        row?.user_prompt,
        request?.user_prompt,
        params?.user_prompt,
        nested?.user_prompt,
        params?.message,
        nested?.message,
        params?.prompt_summary,
        nested?.prompt_summary,
        row?.description,
        row?.visual_prompt,
        row?.visual_description,
        row?.dialogue,
        params?.prompt,
        nested?.prompt,
        request?.prompt,
        row?.prompt
    ]
    const candidates = [...(candidatesByType[type] || []), ...genericCandidates]
    for (const candidate of candidates) {
        const cleaned = sanitizeTaskPrompt(candidate)
        if (cleaned) {
            return cleaned
        }
    }
    return firstText(row?.current_step, row?.step)
}

const taskType = (row: Record<string, any>) => {
    return String(
        row?.task_type ||
            row?.business_type ||
            row?.item_type ||
            row?.asset_type ||
            row?.type ||
            queryParams.task_type ||
            ''
    )
}

const taskTypeText = (row: Record<string, any>) => {
    const type = taskType(row)
    return typeLabels[type] || row?.task_type_label || type || '-'
}

const taskId = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    return valueText(
        task?.task_id ||
            row?.task_id ||
            task?.provider_task_id ||
            row?.provider_task_id ||
            row?.provider_request_id ||
            row?.id
    )
}

const projectText = (row: Record<string, any>) => {
    return valueText(row?.project_title || row?.project_name || row?.title || row?.project_id)
}

const mainTitle = (row: Record<string, any>) => {
    return valueText(
        row?.project_title ||
            row?.name ||
            row?.title ||
            row?.scene_name ||
            row?.shot_id ||
            row?.task_id
    )
}

const subTitle = (row: Record<string, any>) => {
    return valueText(taskReadablePrompt(row))
}

const userName = (row: Record<string, any>) => {
    return valueText(
        row?.user_nickname || row?.user_account || row?.user_mobile || row?.nickname || row?.user_id
    )
}

const userSubText = (row: Record<string, any>) => {
    if (row?.user_mobile) {
        return row.user_mobile
    }
    return row?.user_id ? `ID: ${row.user_id}` : '-'
}

const progressValue = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    const progress = Number(task?.progress ?? row?.progress ?? row?.task_progress ?? 0)
    if (!Number.isFinite(progress)) {
        return 0
    }
    return Math.max(0, Math.min(100, progress))
}

const effectiveGenerationTask = (row: Record<string, any>) => {
    const task = row?.generation_task
    return task && Object.keys(task).length ? task : null
}

const statusValue = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    return String(task?.status || row?.status || row?.task_status || '')
}

const statusText = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    const status = statusValue(row)
    return (
        task?.status_label ||
        row?.status_label ||
        row?.task_status_label ||
        statusMap[status]?.text ||
        status ||
        '-'
    )
}

const statusTag = (row: Record<string, any>): TagType => {
    const task = effectiveGenerationTask(row)
    const status = statusValue(row)
    return task?.status_tag || row?.status_tag || statusMap[status]?.tag || 'info'
}

const updateTimeValue = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    return task?.update_time || task?.updated_at || row?.update_time || row?.updated_at
}

const generationTimeValue = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    return (
        row?.generation_time ||
        task?.generation_time ||
        task?.create_time ||
        row?.create_time ||
        updateTimeValue(row)
    )
}

const timeText = (value: any) => {
    if (!value) {
        return '-'
    }
    if (typeof value === 'number' || /^\d+$/.test(String(value))) {
        const timestamp = Number(value)
        if (!timestamp) {
            return '-'
        }
        const date = new Date(timestamp * 1000)
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
    }
    return String(value)
}

const pointText = (value: any) => {
    const point = Number(value || 0)
    return `${Number.isFinite(point) ? point : 0} 点`
}

const friendlyError = (row: Record<string, any>) => {
    const task = effectiveGenerationTask(row)
    return String(
        task?.friendly_error ||
            task?.error_message ||
            task?.error_msg ||
            task?.fail_reason ||
            row?.friendly_error ||
            row?.error_message ||
            row?.fail_reason ||
            row?.failed_reason ||
            row?.error ||
            row?.provider_error ||
            musicError(row) ||
            ''
    )
}

const musicTask = (row: Record<string, any>) => {
    const task = row?.music_task
    return task && typeof task === 'object' ? task : {}
}

const musicStatusText = (row: Record<string, any>) => {
    const task = musicTask(row)
    const status = String(task?.status || row?.music_task_status || '')
    return task?.status_label || statusMap[status]?.text || status || '-'
}

const musicError = (row: Record<string, any>) => {
    const task = musicTask(row)
    return String(task?.error || row?.music_task_error || '')
}

const detailPrompt = (row: Record<string, any>) => {
    return valueText(taskReadablePrompt(row))
}

const errorMessage = (error: any) => {
    const message =
        error?.message ||
        error?.msg ||
        error?.data?.message ||
        error?.response?.data?.msg ||
        error?.response?.data?.message ||
        ''
    return message ? `任务列表暂不可用：${message}` : '任务列表暂不可用，请稍后重试'
}

const assetList = (row: Record<string, any>): AssetItem[] => {
    const assets: AssetItem[] = []
    const pushAsset = (asset: any, fallbackType = '') => {
        const url = String(asset?.url || asset?.uri || asset?.path || asset?.src || asset || '')
        if (!url) {
            return
        }
        if (assets.some((item) => item.url === url)) {
            return
        }
        const type = String(asset?.asset_type || asset?.type || fallbackType || '')
        assets.push({
            name: String(asset?.name || asset?.title || asset?.filename || ''),
            type,
            url,
            kind: assetKind(url, type)
        })
    }

    const arrayFields = ['assets', 'output_assets', 'input_assets', 'result_assets', 'files', 'videos', 'images']
    arrayFields.forEach((key) => {
        if (Array.isArray(row?.[key])) {
            row[key].forEach((asset: any) => pushAsset(asset))
        }
    })
    const linkedMusicTask = musicTask(row)
    if (Array.isArray(linkedMusicTask?.results)) {
        linkedMusicTask.results.forEach((asset: any) => pushAsset(asset, 'audio'))
    }

    pushAsset(row?.cover_url, 'image')
    pushAsset(row?.image_url, 'image')
    pushAsset(row?.result_image_url, 'image')
    pushAsset(row?.video_url, 'video')
    pushAsset(row?.result_video_url, 'video')
    pushAsset(row?.final_video_url, 'video')
    pushAsset(row?.audio_url, 'audio')
    pushAsset(row?.result_audio_url, 'audio')
    pushAsset(row?.bgm_audio_url, 'audio')
    pushAsset(linkedMusicTask?.audio_url, 'audio')
    pushAsset(row?.output_url)
    pushAsset(row?.result_url)
    return assets
}

const assetKind = (url: string, type: string): AssetItem['kind'] => {
    const lowerUrl = url.toLowerCase().split('?')[0]
    const lowerType = type.toLowerCase()
    if (lowerType.includes('video') || /\.(mp4|mov|m4v|webm|avi)$/.test(lowerUrl)) {
        return 'video'
    }
    if (
        lowerType.includes('audio') ||
        lowerType.includes('bgm') ||
        /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(lowerUrl)
    ) {
        return 'audio'
    }
    if (lowerType.includes('image') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerUrl)) {
        return 'image'
    }
    return 'file'
}

const imagePreviewList = (row: Record<string, any>) => {
    return assetList(row)
        .filter((asset) => asset.kind === 'image')
        .map((asset) => asset.url)
}

getLists()
</script>

<style lang="scss" scoped>
.asset-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 46px;
}

.asset-thumb {
    width: 42px;
    height: 42px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
}

.asset-link {
    min-width: 42px;
}

.detail-section {
    margin-top: 18px;
}

.detail-title {
    margin-bottom: 10px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.asset-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.asset-card {
    min-height: 160px;
    padding: 10px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-fill-color-blank);
}

.asset-image,
.asset-video {
    width: 100%;
    height: 180px;
    border-radius: 6px;
    background: #111;
}

.asset-audio {
    width: 100%;
}

.asset-audio-mini {
    width: 140px;
    height: 32px;
}

.asset-name {
    margin-top: 8px;
    overflow: hidden;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
