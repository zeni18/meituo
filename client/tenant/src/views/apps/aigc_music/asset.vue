<template>
    <el-card class="!border-none" shadow="never">
        <el-form :inline="true" :model="queryParams" class="mb-4">
            <el-form-item label="关键词">
                <el-input
                    v-model="queryParams.keyword"
                    class="w-[220px]"
                    clearable
                    placeholder="素材名称/音频ID"
                    @keyup.enter="resetPage"
                />
            </el-form-item>
            <el-form-item label="用户">
                <el-input
                    v-model="queryParams.user_keyword"
                    class="w-[220px]"
                    clearable
                    placeholder="用户ID/昵称/账号"
                    @keyup.enter="resetPage"
                />
            </el-form-item>
            <el-form-item label="状态">
                <el-select v-model="queryParams.status" class="w-[140px]" clearable>
                    <el-option label="启用" value="1" />
                    <el-option label="停用" value="0" />
                </el-select>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="resetPage">查询</el-button>
                <el-button @click="resetQuery">重置</el-button>
                <el-button type="primary" @click="handleAdd">新增素材</el-button>
            </el-form-item>
        </el-form>

        <el-table v-loading="pager.loading" size="large" :data="pager.lists">
            <el-table-column label="ID" prop="id" width="80" />
            <el-table-column label="参考音频" width="280">
                <template #default="{ row }">
                    <audio
                        v-if="audioUrl(row)"
                        class="music-audio"
                        :src="audioUrl(row)"
                        controls
                        preload="metadata"
                    ></audio>
                    <span v-else class="text-tx-secondary">未配置</span>
                </template>
            </el-table-column>
            <el-table-column label="素材名称" min-width="170" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ row.name || '-' }}</div>
                    <div class="text-xs text-tx-secondary">{{ row.audio_id || '-' }}</div>
                </template>
            </el-table-column>
            <el-table-column label="用户" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                    {{ row.user_nickname || row.user_account || row.user_id || '公共素材' }}
                </template>
            </el-table-column>
            <el-table-column label="风格" prop="style" min-width="150" show-overflow-tooltip />
            <el-table-column label="存储" min-width="170" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ row.storage_engine || '-' }}</div>
                    <div class="text-xs text-tx-secondary">
                        {{ row.storage_scope || row.storage_domain || '-' }}
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="安全" width="100">
                <template #default="{ row }">
                    <el-tag :type="safetyTagType(row.safety_status)">
                        {{ safetyText(row.safety_status) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
                <template #default="{ row }">
                    <el-switch
                        :model-value="Number(row.status)"
                        :active-value="1"
                        :inactive-value="0"
                        @change="(value) => handleStatusChange(row, value)"
                    />
                </template>
            </el-table-column>
            <el-table-column label="创建时间" width="170">
                <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                    <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
                    <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
                </template>
            </el-table-column>
        </el-table>
        <div class="flex justify-end mt-4">
            <pagination v-model="pager" @change="getLists" />
        </div>

        <el-dialog
            v-model="dialogVisible"
            :title="form.id ? '编辑参考音频' : '新增参考音频'"
            width="680px"
        >
            <el-form label-width="120px" :model="form">
                <el-form-item label="素材名称">
                    <el-input v-model="form.name" placeholder="请输入素材名称" />
                </el-form-item>
                <el-form-item label="音频ID">
                    <el-input v-model="form.audio_id" placeholder="后端/供应商音频ID，可选" />
                </el-form-item>
                <el-form-item label="音频URL">
                    <el-input v-model="form.audio_url" placeholder="可播放音频地址" />
                </el-form-item>
                <el-form-item label="文件URL">
                    <el-input v-model="form.file_url" placeholder="原始文件或备用下载地址" />
                </el-form-item>
                <el-form-item label="风格标签">
                    <el-input v-model="form.style" placeholder="流行/民谣/电子等" />
                </el-form-item>
                <el-form-item label="时长">
                    <el-input-number v-model="form.duration" :min="0" :precision="2" />
                    <span class="ml-2 text-tx-secondary">秒</span>
                </el-form-item>
                <el-form-item label="存储引擎">
                    <el-input v-model="form.storage_engine" placeholder="local / oss / cos / ftp" />
                </el-form-item>
                <el-form-item label="存储范围">
                    <el-input v-model="form.storage_scope" placeholder="tenant / user / public" />
                </el-form-item>
                <el-form-item label="存储域名">
                    <el-input v-model="form.storage_domain" placeholder="文件访问域名，可选" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-radio-group v-model="form.status">
                        <el-radio :value="1">启用</el-radio>
                        <el-radio :value="0">停用</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="form.sort" :min="0" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
            </template>
        </el-dialog>
    </el-card>
</template>

<script lang="ts" setup name="tenant-aigc-music-asset">
import {
    deleteAigcMusicAsset,
    getAigcMusicAssets,
    saveAigcMusicAsset,
    setAigcMusicAssetStatus
} from '@/apps/aigc_music/api'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'
import { timeFormat } from '@/utils/util'

const saving = ref(false)
const dialogVisible = ref(false)
const queryParams = reactive({
    keyword: '',
    user_keyword: '',
    status: ''
})
const form = reactive<any>({
    id: 0,
    name: '',
    audio_id: '',
    audio_url: '',
    file_url: '',
    style: '',
    duration: 0,
    storage_scope: '',
    storage_engine: '',
    storage_domain: '',
    status: 1,
    sort: 0
})
const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcMusicAssets,
    params: queryParams
})
const resetForm = (row: any = {}) => {
    Object.assign(
        form,
        {
            id: 0,
            name: '',
            audio_id: '',
            audio_url: '',
            file_url: '',
            style: '',
            duration: 0,
            storage_scope: '',
            storage_engine: '',
            storage_domain: '',
            status: 1,
            sort: 0
        },
        row
    )
}
const resetQuery = () => {
    Object.assign(queryParams, { keyword: '', user_keyword: '', status: '' })
    resetPage()
}
const handleAdd = () => {
    resetForm()
    dialogVisible.value = true
}
const handleEdit = (row: any) => {
    resetForm(row)
    dialogVisible.value = true
}
const handleSave = async () => {
    saving.value = true
    try {
        await saveAigcMusicAsset(form)
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}
const handleStatusChange = async (row: any, status: any) => {
    await setAigcMusicAssetStatus({ id: row.id, status })
    getLists()
}
const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该参考音频素材？')
    await deleteAigcMusicAsset({ id })
    getLists()
}
const audioUrl = (row: any) => row.audio_url || row.file_url || ''
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
