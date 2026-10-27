<template>
    <el-card class="!border-none" shadow="never">
        <el-form :inline="true" :model="queryParams" class="mb-4">
            <el-form-item label="状态">
                <el-select v-model="queryParams.status" class="w-[140px]" clearable>
                    <el-option label="启用" value="1" />
                    <el-option label="停用" value="0" />
                </el-select>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="resetPage">查询</el-button>
                <el-button @click="resetQuery">重置</el-button>
                <el-button type="primary" @click="handleAdd">新增风格</el-button>
            </el-form-item>
        </el-form>

        <el-table v-loading="pager.loading" size="large" :data="pager.lists">
            <el-table-column label="ID" prop="id" width="80" />
            <el-table-column label="风格名称" prop="name" min-width="160" show-overflow-tooltip />
            <el-table-column label="描述" prop="description" min-width="220" show-overflow-tooltip />
            <el-table-column label="生成提示词" prop="prompt" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="100">
                <template #default="{ row }">
                    <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'">
                        {{ Number(row.status) === 1 ? '启用' : '停用' }}
                    </el-tag>
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
        <div class="mt-4 flex justify-end">
            <pagination v-model="pager" @change="getLists" />
        </div>

        <el-dialog v-model="dialogVisible" :title="form.id ? '编辑风格' : '新增风格'" width="640px">
            <el-form label-width="110px" :model="form">
                <el-form-item label="风格名称" required>
                    <el-input v-model="form.name" placeholder="例如：流行电子" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="form.description" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="生成提示词">
                    <el-input v-model="form.prompt" type="textarea" :rows="3" placeholder="例如：pop electronic upbeat" />
                </el-form-item>
                <el-form-item label="预设参数">
                    <el-input
                        v-model="form.presetJson"
                        type="textarea"
                        :rows="3"
                        placeholder='例如：{"genre":"pop","mood":"upbeat"}'
                    />
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

<script lang="ts" setup name="tenant-aigc-music-style">
import {
    deleteAigcMusicStyle,
    getAigcMusicStyles,
    saveAigcMusicStyle
} from '@/apps/aigc_music/api'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const saving = ref(false)
const dialogVisible = ref(false)
const queryParams = reactive({ status: '' })
const form = reactive({
    id: 0,
    name: '',
    description: '',
    prompt: '',
    presetJson: '',
    status: 1,
    sort: 0
})
const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcMusicStyles,
    params: queryParams
})

const resetForm = (row: any = {}) => {
    Object.assign(
        form,
        {
            id: 0,
            name: '',
            description: '',
            prompt: '',
            presetJson: '',
            status: 1,
            sort: 0
        },
        row,
        { presetJson: row.preset_json ? JSON.stringify(row.preset_json, null, 2) : '' }
    )
}

const resetQuery = () => {
    queryParams.status = ''
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
    let presetJson: Record<string, any> = {}
    if (form.presetJson.trim()) {
        try {
            presetJson = JSON.parse(form.presetJson)
        } catch {
            feedback.msgError('预设参数必须是有效的 JSON 对象')
            return
        }
    }
    saving.value = true
    try {
        await saveAigcMusicStyle({
            id: form.id,
            name: form.name,
            description: form.description,
            prompt: form.prompt,
            preset_json: presetJson,
            status: form.status,
            sort: form.sort
        })
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}

const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该音乐风格？')
    await deleteAigcMusicStyle({ id })
    getLists()
}

getLists()
</script>
