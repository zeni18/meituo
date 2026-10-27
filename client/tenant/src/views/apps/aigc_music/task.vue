<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                <el-form-item label="任务ID">
                    <el-input
                        v-model="queryParams.task_id"
                        class="w-[180px]"
                        placeholder="请输入任务ID"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="用户搜索">
                    <el-input
                        v-model="queryParams.user_keyword"
                        class="w-[240px]"
                        placeholder="用户ID/昵称/账号/手机号"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="生成类型">
                    <el-select
                        v-model="queryParams.type"
                        class="!w-[150px]"
                        placeholder="全部"
                        clearable
                        @change="resetPage"
                    >
                        <el-option label="文生音乐" value="text_to_music" />
                        <el-option label="歌词成歌" value="lyric_to_music" />
                        <el-option label="参考音频" value="audio_to_music" />
                        <el-option label="纯伴奏" value="instrumental" />
                    </el-select>
                </el-form-item>
                <el-form-item label="完成状态">
                    <el-select
                        v-model="queryParams.status"
                        class="!w-[150px]"
                        placeholder="全部"
                        clearable
                        @change="resetPage"
                    >
                        <el-option label="全部" value="all" />
                        <el-option label="排队中" value="pending" />
                        <el-option label="运行中" value="running" />
                        <el-option label="已完成" value="success" />
                        <el-option label="已失败" value="failed" />
                        <el-option label="已取消" value="canceled" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">查询</el-button>
                    <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="音频结果" width="280">
                    <template #default="{ row }">
                        <div v-if="resultAudioUrl(row)" class="music-result">
                            <audio
                                class="music-audio"
                                :src="resultAudioUrl(row)"
                                controls
                                preload="metadata"
                                @error="markAudioError(row)"
                            ></audio>
                            <div class="music-links">
                                <el-link type="primary" :href="resultAudioUrl(row)" target="_blank">
                                    下载音频
                                </el-link>
                                <el-link
                                    v-if="row.video_url"
                                    type="primary"
                                    :href="row.video_url"
                                    target="_blank"
                                >
                                    下载视频
                                </el-link>
                                <el-link
                                    v-if="audioErrors[row.id]"
                                    type="danger"
                                    :href="resultAudioUrl(row)"
                                    target="_blank"
                                >
                                    打开源文件
                                </el-link>
                            </div>
                        </div>
                        <span v-else class="text-tx-secondary">暂无音频</span>
                    </template>
                </el-table-column>
                <el-table-column
                    label="任务ID"
                    prop="provider_task_id"
                    min-width="180"
                    show-overflow-tooltip
                />
                <el-table-column label="用户" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>
                            {{ row.user_nickname || row.user_account || `用户#${row.user_id}` }}
                        </div>
                        <div class="text-xs text-tx-secondary">
                            {{ row.user_mobile || `ID: ${row.user_id || '-'}` }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="类型" width="120">
                    <template #default="{ row }">{{ typeText(row.type) }}</template>
                </el-table-column>
                <el-table-column label="提示词/歌词" min-width="280" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>{{ row.prompt || row.lyric || '-' }}</div>
                        <div v-if="row.style" class="text-xs text-tx-secondary">
                            风格：{{ row.style }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="参考素材" min-width="170" show-overflow-tooltip>
                    <template #default="{ row }">
                        {{ row.audio_id || row.persona_id || row.voice_id || '-' }}
                    </template>
                </el-table-column>
                <el-table-column label="存储" min-width="160" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>{{ row.storage_engine || '-' }}</div>
                        <div class="text-xs text-tx-secondary">
                            {{ row.storage_scope || row.storage_domain || '-' }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="扣费" width="130">
                    <template #default="{ row }">
                        <div>{{ formatPointAmount(row.cost_points ?? row.user_charge_points ?? 0) }}</div>
                        <el-tag size="small" :type="billingTagType(row.billing_status)">
                            {{ billingText(row.billing_status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="安全" width="110">
                    <template #default="{ row }">
                        <el-tag :type="safetyTagType(row.safety_status)">
                            {{ safetyText(row.safety_status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                        <el-tag :type="statusTagType(row.status)">
                            {{ statusText(row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="220" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            link
                            :loading="isTaskQuerying(row)"
                            @click="handleQuery(row)"
                        >
                            查询
                        </el-button>
                        <el-button type="primary" link @click="handleRetry(row.id)">重试</el-button>
                        <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-music-task">
import { formatPointAmount } from '@/utils/point-unit'

import {
    deleteAigcMusicTask,
    getAigcMusicTaskDetail,
    getAigcMusicTaskLists,
    retryAigcMusicTask
} from '@/apps/aigc_music/api'
import { useAppTaskManualQuery } from '@/composables/useAppTaskManualQuery'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const queryParams = reactive({
    task_id: '',
    user_keyword: '',
    type: '',
    status: 'all'
})
const audioErrors = reactive<Record<number, boolean>>({})
const { pager, getLists, resetPage } = usePaging({
    fetchFun: (params: any) =>
        getAigcMusicTaskLists({
            ...params,
            status: params.status === 'all' ? '' : params.status
        }),
    params: queryParams
})
const { handleTaskQuery, isTaskQuerying } = useAppTaskManualQuery(getLists)
const handleQuery = (row: any) => handleTaskQuery(row, getAigcMusicTaskDetail)

const resetQuery = () => {
    Object.assign(queryParams, {
        task_id: '',
        user_keyword: '',
        type: '',
        status: 'all'
    })
    resetPage()
}
const resultAudioUrl = (row: any) => row.audio_url || row.file_url || row.result_url || ''
const markAudioError = (row: any) => {
    audioErrors[Number(row.id)] = true
}
const typeText = (type: string) => {
    const map: Record<string, string> = {
        text_to_music: '文生音乐',
        lyric_to_music: '歌词成歌',
        audio_to_music: '参考音频',
        instrumental: '纯伴奏'
    }
    return map[type] || type || '-'
}
const statusText = (status: string) => {
    const map: Record<string, string> = {
        pending: '排队中',
        running: '运行中',
        success: '已完成',
        failed: '已失败',
        canceled: '已取消'
    }
    return map[status] || status || '-'
}
const statusTagType = (status: string) => {
    const map: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
        pending: 'info',
        running: 'warning',
        success: 'success',
        failed: 'danger',
        canceled: 'info'
    }
    return map[status] || 'info'
}
const billingText = (status: string) => {
    const map: Record<string, string> = {
        pending: '待扣费',
        paid: '已扣费',
        refunded: '已退回',
        failed: '扣费失败'
    }
    return map[status] || status || '-'
}
const billingTagType = (status: string) => {
    if (status === 'paid') return 'success'
    if (status === 'failed') return 'danger'
    if (status === 'refunded') return 'info'
    return 'warning'
}
const safetyText = (status: string) => {
    const map: Record<string, string> = {
        pending: '待审',
        passed: '通过',
        rejected: '拒绝',
        blocked: '拦截'
    }
    return map[status] || status || '-'
}
const safetyTagType = (status: string) => {
    if (status === 'passed') return 'success'
    if (['rejected', 'blocked'].includes(status)) return 'danger'
    return 'warning'
}
const handleRetry = async (id: number) => {
    await retryAigcMusicTask({ id })
    getLists()
}
const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该音乐任务？')
    await deleteAigcMusicTask({ id })
    getLists()
}
getLists()
</script>

<style scoped>
.music-result {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.music-audio {
    width: 240px;
    height: 34px;
}

.music-links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 12px;
}
</style>
