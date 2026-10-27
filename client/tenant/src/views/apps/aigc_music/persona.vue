<template>
    <el-card class="!border-none" shadow="never">
        <el-form :inline="true" :model="queryParams" class="mb-4">
            <el-form-item label="关键词">
                <el-input
                    v-model="queryParams.keyword"
                    class="w-[220px]"
                    clearable
                    placeholder="歌手名称/风格ID"
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
                <el-button type="primary" @click="handleAdd">新增歌手风格</el-button>
            </el-form-item>
        </el-form>

        <el-table v-loading="pager.loading" size="large" :data="pager.lists">
            <el-table-column label="ID" prop="id" width="80" />
            <el-table-column label="歌手风格" min-width="190" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ row.name || '-' }}</div>
                    <div class="text-xs text-tx-secondary">{{ row.persona_id || '-' }}</div>
                </template>
            </el-table-column>
            <el-table-column label="风格" prop="style" min-width="160" show-overflow-tooltip />
            <el-table-column
                label="声线"
                prop="vocal_range"
                min-width="130"
                show-overflow-tooltip
            />
            <el-table-column label="试听" width="280">
                <template #default="{ row }">
                    <audio
                        v-if="row.audio_url || row.demo_url"
                        class="music-audio"
                        :src="row.audio_url || row.demo_url"
                        controls
                        preload="metadata"
                    ></audio>
                    <span v-else class="text-tx-secondary">未配置</span>
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
            <el-table-column label="排序" prop="sort" width="90" />
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
            :title="form.id ? '编辑歌手风格' : '新增歌手风格'"
            width="640px"
        >
            <el-form label-width="120px" :model="form">
                <el-form-item label="名称">
                    <el-input v-model="form.name" placeholder="请输入歌手风格名称" />
                </el-form-item>
                <el-form-item label="风格ID">
                    <el-input v-model="form.persona_id" placeholder="供应商 persona_id，可选" />
                </el-form-item>
                <el-form-item label="风格标签">
                    <el-input v-model="form.style" placeholder="流行/摇滚/爵士等" />
                </el-form-item>
                <el-form-item label="声线">
                    <el-input v-model="form.vocal_range" placeholder="女声/男声/童声/合唱等" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="form.description" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="试听音频">
                    <el-input v-model="form.audio_url" placeholder="试听音频URL" />
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

<script lang="ts" setup name="tenant-aigc-music-persona">
import {
    deleteAigcMusicPersona,
    getAigcMusicPersonas,
    saveAigcMusicPersona,
    setAigcMusicPersonaStatus
} from '@/apps/aigc_music/api'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const saving = ref(false)
const dialogVisible = ref(false)
const queryParams = reactive({ keyword: '', status: '' })
const form = reactive<any>({
    id: 0,
    name: '',
    persona_id: '',
    style: '',
    vocal_range: '',
    description: '',
    audio_url: '',
    status: 1,
    sort: 0
})
const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcMusicPersonas,
    params: queryParams
})
const resetForm = (row: any = {}) => {
    Object.assign(
        form,
        {
            id: 0,
            name: '',
            persona_id: '',
            style: '',
            vocal_range: '',
            description: '',
            audio_url: '',
            status: 1,
            sort: 0
        },
        row
    )
}
const resetQuery = () => {
    Object.assign(queryParams, { keyword: '', status: '' })
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
        await saveAigcMusicPersona(form)
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}
const handleStatusChange = async (row: any, status: any) => {
    await setAigcMusicPersonaStatus({ id: row.id, status })
    getLists()
}
const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该歌手风格？')
    await deleteAigcMusicPersona({ id })
    getLists()
}
getLists()
</script>

<style scoped>
.music-audio {
    width: 240px;
    height: 34px;
}
</style>
