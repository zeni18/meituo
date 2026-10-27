<template>
    <el-card class="!border-none" shadow="never">
        <el-form :inline="true" :model="queryParams" class="mb-4">
            <el-form-item label="用户">
                <el-input
                    v-model="queryParams.user_keyword"
                    class="w-[220px]"
                    clearable
                    placeholder="用户ID/昵称/账号"
                    @keyup.enter="resetPage"
                />
            </el-form-item>
            <el-form-item label="关键词">
                <el-input
                    v-model="queryParams.keyword"
                    class="w-[220px]"
                    clearable
                    placeholder="声音名称/克隆ID"
                    @keyup.enter="resetPage"
                />
            </el-form-item>
            <el-form-item label="克隆状态">
                <el-select v-model="queryParams.status" class="w-[150px]" clearable>
                    <el-option label="待处理" value="pending" />
                    <el-option label="克隆中" value="running" />
                    <el-option label="可用" value="ready" />
                    <el-option label="失败" value="failed" />
                    <el-option label="停用" value="disabled" />
                </el-select>
            </el-form-item>
            <el-form-item label="授权审核">
                <el-select v-model="queryParams.audit_status" class="w-[150px]" clearable>
                    <el-option label="待审" value="pending" />
                    <el-option label="通过" value="passed" />
                    <el-option label="拒绝" value="rejected" />
                </el-select>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="resetPage">查询</el-button>
                <el-button @click="resetQuery">重置</el-button>
            </el-form-item>
        </el-form>

        <el-table v-loading="pager.loading" size="large" :data="pager.lists">
            <el-table-column label="ID" prop="id" width="80" />
            <el-table-column label="用户" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ row.user_nickname || row.user_account || `用户#${row.user_id}` }}</div>
                    <div class="text-xs text-tx-secondary">{{ row.user_mobile || '-' }}</div>
                </template>
            </el-table-column>
            <el-table-column label="声音" min-width="190" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ row.name || '-' }}</div>
                    <div class="text-xs text-tx-secondary">
                        {{ row.voice_id || row.provider_asset_id || row.audio_id || '-' }}
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="授权样本" width="280">
                <template #default="{ row }">
                    <audio
                        v-if="row.audio_url || row.file_url"
                        class="music-audio"
                        :src="row.audio_url || row.file_url"
                        controls
                        preload="metadata"
                    ></audio>
                    <span v-else class="text-tx-secondary">未配置</span>
                </template>
            </el-table-column>
            <el-table-column label="授权" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ row.consent_type || row.license_type || '-' }}</div>
                    <div class="text-xs text-tx-secondary">
                        {{ row.consent_file_url || row.license_file_url || '-' }}
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="克隆状态" width="110">
                <template #default="{ row }">
                    <el-tag :type="voiceStatusType(row.status)">
                        {{ voiceStatusText(row.status) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column label="审核" width="100">
                <template #default="{ row }">
                    <el-tag :type="auditTagType(row.audit_status || row.safety_status)">
                        {{ auditText(row.audit_status || row.safety_status) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column label="扣费" width="120">
                <template #default="{ row }">
                    <div>{{ formatPointAmount(row.cost_points || 0) }}</div>
                    <div class="text-xs text-tx-secondary">{{ row.billing_status || '-' }}</div>
                </template>
            </el-table-column>
            <el-table-column label="创建时间" width="170">
                <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="240" fixed="right">
                <template #default="{ row }">
                    <el-button type="success" link @click="handleAudit(row.id, 'passed')">
                        通过
                    </el-button>
                    <el-button type="warning" link @click="handleAudit(row.id, 'rejected')">
                        拒绝
                    </el-button>
                    <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
                </template>
            </el-table-column>
        </el-table>
        <div class="flex justify-end mt-4">
            <pagination v-model="pager" @change="getLists" />
        </div>
    </el-card>
</template>

<script lang="ts" setup name="tenant-aigc-music-voice">
import { formatPointAmount } from '@/utils/point-unit'

import {
    auditAigcMusicVoice,
    deleteAigcMusicVoice,
    getAigcMusicVoices
} from '@/apps/aigc_music/api'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'
import { timeFormat } from '@/utils/util'

const queryParams = reactive({
    user_keyword: '',
    keyword: '',
    status: '',
    audit_status: ''
})
const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcMusicVoices,
    params: queryParams
})
const resetQuery = () => {
    Object.assign(queryParams, {
        user_keyword: '',
        keyword: '',
        status: '',
        audit_status: ''
    })
    resetPage()
}
const handleAudit = async (id: number, audit_status: string) => {
    await feedback.confirm(`确定${audit_status === 'passed' ? '通过' : '拒绝'}该声音授权？`)
    await auditAigcMusicVoice({ id, audit_status })
    getLists()
}
const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该声音克隆记录？')
    await deleteAigcMusicVoice({ id })
    getLists()
}
const voiceStatusText = (status: string) => {
    const map: Record<string, string> = {
        pending: '待处理',
        running: '克隆中',
        ready: '可用',
        failed: '失败',
        disabled: '停用'
    }
    return map[status] || status || '-'
}
const voiceStatusType = (status: string) => {
    if (status === 'ready') return 'success'
    if (status === 'failed') return 'danger'
    if (status === 'disabled') return 'info'
    return 'warning'
}
const auditText = (status: string) => {
    const map: Record<string, string> = {
        pending: '待审',
        passed: '通过',
        rejected: '拒绝',
        blocked: '拦截'
    }
    return map[status] || status || '-'
}
const auditTagType = (status: string) => {
    if (status === 'passed') return 'success'
    if (['rejected', 'blocked'].includes(status)) return 'danger'
    return 'warning'
}
const formatTime = (time: number | string) => {
    if (!time) return '-'
    if (typeof time === 'string') {
        return /^\d+$/.test(time) ? timeFormat(Number(time), 'yyyy-mm-dd hh:MM:ss') : time
    }
    return timeFormat(time, 'yyyy-mm-dd hh:MM:ss')
}
getLists()
</script>

<style scoped>
.music-audio {
    width: 240px;
    height: 34px;
}
</style>
