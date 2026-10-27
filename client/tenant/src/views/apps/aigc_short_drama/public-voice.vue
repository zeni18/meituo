<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <div class="library-toolbar">
                <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                    <el-form-item label="关键词">
                        <el-input
                            v-model="queryParams.keyword"
                            class="w-[240px]"
                            placeholder="声音名称 / 音色 ID"
                            clearable
                            @keyup.enter="resetPage"
                        />
                    </el-form-item>
                    <el-form-item label="状态">
                        <el-select v-model="queryParams.status" class="library-select" @change="resetPage">
                            <el-option label="全部" value="" />
                            <el-option label="启用" value="ready" />
                            <el-option label="停用" value="disabled" />
                        </el-select>
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" @click="resetPage">查询</el-button>
                        <el-button @click="resetQuery">重置</el-button>
                    </el-form-item>
                </el-form>
                <el-button type="primary" @click="openEdit()">新增声音</el-button>
            </div>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-alert
                class="mb-4"
                type="info"
                show-icon
                :closable="false"
                title="这里维护租户短剧可用的官方声音。配置后的声音会出现在用户端主体创作的声音选择里。"
            />
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="封面" width="110">
                    <template #default="{ row }">
                        <el-image
                            v-if="row.cover_url"
                            class="voice-cover"
                            :src="row.cover_url"
                            :preview-src-list="[row.cover_url]"
                            preview-teleported
                            fit="cover"
                        />
                        <div v-else class="voice-cover-empty">未配置</div>
                    </template>
                </el-table-column>
                <el-table-column label="声音" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>{{ row.name || '-' }}</div>
                        <div class="text-xs text-tx-secondary">{{ voiceMeta(row) }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="音色 ID" prop="provider_asset_id" min-width="220" show-overflow-tooltip />
                <el-table-column label="样本音频" min-width="220" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.audio_url || row.audio_uri || '-' }}</template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                        <el-switch
                            :model-value="row.status !== 'disabled'"
                            @change="handleStatus(row, Boolean($event))"
                        />
                    </template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
                        <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-dialog
            v-model="dialogVisible"
            :title="formData.id ? '编辑声音' : '新增声音'"
            width="680px"
        >
            <el-form label-width="112px" :model="formData">
                <el-form-item label="声音名称" required>
                    <el-input v-model="formData.name" placeholder="请输入声音名称" maxlength="80" show-word-limit />
                </el-form-item>
                <el-form-item label="音色 ID">
                    <el-input
                        v-model="formData.provider_asset_id"
                        placeholder="已有供应商音色 ID 可直接填写"
                    />
                </el-form-item>
                <el-form-item label="样本音频 URI">
                    <el-input
                        v-model="formData.audio_uri"
                        placeholder="未填写音色 ID 时，可填写样本音频 URI 用于克隆"
                    />
                </el-form-item>
                <el-form-item label="封面图">
                    <div class="voice-field">
                        <div class="voice-field__row">
                            <material-picker
                                v-model="formData.cover_uri"
                                type="image"
                                :limit="1"
                                exclude-domain
                                size="84px"
                                @change="handleCoverMaterialChange"
                            >
                                <template #upload>
                                    <el-button>素材库上传</el-button>
                                </template>
                            </material-picker>
                            <el-input
                                v-model="formData.cover_uri"
                                class="voice-field__input"
                                placeholder="可选，用于用户端声音卡片展示"
                                @change="coverPreviewUrl = formData.cover_uri ? getImageUrl(formData.cover_uri) : ''"
                            />
                        </div>
                        <el-image
                            v-if="coverPreviewUrl"
                            class="voice-preview"
                            :src="coverPreviewUrl"
                            fit="cover"
                        />
                    </div>
                </el-form-item>
                <el-form-item label="性别">
                    <el-select v-model="formData.gender" class="w-[180px]" clearable>
                        <el-option label="男声" value="male" />
                        <el-option label="女声" value="female" />
                        <el-option label="不限" value="unknown" />
                    </el-select>
                </el-form-item>
                <el-form-item label="年龄段">
                    <el-input v-model="formData.age_group" placeholder="如 young / middle / elder" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-switch
                        :model-value="formData.status !== 'disabled'"
                        @change="formData.status = $event ? 'ready' : 'disabled'"
                    />
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="formData.sort" :min="0" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-short-drama-public-voice">
import {
    deleteAigcShortDramaPublicVoice,
    getAigcShortDramaPublicVoices,
    saveAigcShortDramaPublicVoice
} from '@/apps/aigc_short_drama/api'
import MaterialPicker from '@/components/material/picker.vue'
import { usePaging } from '@/hooks/usePaging'
import useAppStore from '@/stores/modules/app'
import feedback from '@/utils/feedback'

const { getImageUrl } = useAppStore()
const saving = ref(false)
const dialogVisible = ref(false)
const coverPreviewUrl = ref('')
const queryParams = reactive({
    keyword: '',
    status: ''
})
const defaultForm = () => ({
    id: 0,
    name: '',
    provider_asset_id: '',
    audio_uri: '',
    cover_uri: '',
    gender: '',
    age_group: '',
    status: 'ready',
    sort: 0
})
const formData = reactive<any>(defaultForm())

const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcShortDramaPublicVoices,
    params: queryParams
})

const resetQuery = () => {
    Object.assign(queryParams, { keyword: '', status: '' })
    resetPage()
}

const resetForm = (row: any = {}) => {
    Object.assign(formData, defaultForm(), row)
    formData.status = row.status || 'ready'
    coverPreviewUrl.value = row.cover_url || (formData.cover_uri ? getImageUrl(formData.cover_uri) : '')
}

const openEdit = (row?: any) => {
    resetForm(row || {})
    dialogVisible.value = true
}

const handleCoverMaterialChange = (value: string | string[]) => {
    const cover = Array.isArray(value) ? value[0] || '' : value || ''
    formData.cover_uri = cover
    coverPreviewUrl.value = cover ? getImageUrl(cover) : ''
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await saveAigcShortDramaPublicVoice(formData)
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}

const handleStatus = async (row: any, enabled: boolean) => {
    await saveAigcShortDramaPublicVoice({
        ...row,
        status: enabled ? 'ready' : 'disabled'
    })
    getLists()
}

const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该声音吗？')
    await deleteAigcShortDramaPublicVoice({ id })
    getLists()
}

const voiceMeta = (row: any) => {
    const parts = [row.gender, row.age_group].filter(Boolean)
    return parts.length ? parts.join(' / ') : '官方声音'
}

getLists()
</script>

<style lang="scss" scoped>
.library-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.library-select {
    width: 120px;
}

.voice-cover,
.voice-cover-empty {
    width: 64px;
    height: 64px;
    border-radius: 6px;
}

.voice-cover-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    font-size: 12px;
}

.voice-field {
    min-width: 0;
    width: 100%;
}

.voice-field__row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    width: 100%;
}

.voice-field__input {
    min-width: 0;
    flex: 1;
}

.voice-preview {
    width: 96px;
    height: 96px;
    margin-top: 12px;
    border-radius: 6px;
}
</style>
