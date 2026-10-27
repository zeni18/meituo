<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <div class="option-head">
                <div>
                    <div class="option-title">模特预设</div>
                    <div class="option-desc">PC 端展示启用状态的预设模特，用户可快速选择作为模特图。</div>
                </div>
                <el-button type="primary" @click="openForm()">新增模特</el-button>
            </div>
            <el-table v-loading="loading" :data="lists" size="large">
                <el-table-column label="预览" width="100">
                    <template #default="{ row }">
                        <el-image v-if="modelCover(row)" class="model-cover" :src="modelCover(row)" fit="cover" :preview-src-list="[modelCover(row)]" preview-teleported />
                        <div v-else class="model-cover model-cover--empty">未配置</div>
                    </template>
                </el-table-column>
                <el-table-column label="模特名称" prop="name" min-width="180" />
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="状态" width="100">
                    <template #default="{ row }"><el-switch :model-value="Number(row.status) === 1" @change="handleStatus(row, $event)" /></template>
                </el-table-column>
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openForm(row)">编辑</el-button>
                        <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" :title="formData.id ? '编辑模特预设' : '新增模特预设'" width="680px" destroy-on-close>
            <el-form label-width="100px" :model="formData">
                <el-form-item label="模特名称" required>
                    <el-input v-model="formData.name" maxlength="80" show-word-limit />
                </el-form-item>
                <el-form-item label="模特图" required>
                    <material-picker v-model="formData.model_image" :limit="1" />
                    <div class="form-tip">用于生成时传给 AIGC 生图的模特参考图。</div>
                </el-form-item>
                <el-form-item label="封面图">
                    <material-picker v-model="formData.cover_image" :limit="1" />
                    <div class="form-tip">不配置时默认使用模特图作为 PC 端预设封面。</div>
                </el-form-item>
                <el-form-item label="排序"><el-input-number v-model="formData.sort" :min="0" :max="9999" /></el-form-item>
                <el-form-item label="状态">
                    <el-radio-group v-model="formData.status"><el-radio :value="1">启用</el-radio><el-radio :value="0">停用</el-radio></el-radio-group>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-fashion-lookbook-model">
import MaterialPicker from '@/components/material/picker.vue'
import { deleteAigcFashionLookbookModel, getAigcFashionLookbookModels, saveAigcFashionLookbookModel, setAigcFashionLookbookModelStatus } from '@/apps/aigc_fashion_lookbook/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const lists = ref<any[]>([])
const formData = reactive({ id: 0, name: '', model_image: '', cover_image: '', sort: 0, status: 1 })
const modelCover = (row: any) => row?.cover_url || row?.model_url || row?.cover_image || row?.model_image || ''

const getLists = async () => {
    loading.value = true
    try {
        lists.value = await getAigcFashionLookbookModels()
    } finally {
        loading.value = false
    }
}

const openForm = (row?: any) => {
    Object.assign(formData, {
        id: Number(row?.id || 0),
        name: row?.name || '',
        model_image: row?.model_image || '',
        cover_image: row?.cover_image || '',
        sort: Number(row?.sort || 0),
        status: Number(row?.status ?? 1)
    })
    dialogVisible.value = true
}

const handleSubmit = async () => {
    if (!formData.name.trim()) {
        feedback.msgError('请输入模特名称')
        return
    }
    if (!formData.model_image) {
        feedback.msgError('请选择模特图')
        return
    }
    saving.value = true
    try {
        await saveAigcFashionLookbookModel(formData)
        feedback.msgSuccess('保存成功')
        dialogVisible.value = false
        await getLists()
    } finally {
        saving.value = false
    }
}

const handleStatus = async (row: any, value: any) => {
    await setAigcFashionLookbookModelStatus({ id: row.id, status: value ? 1 : 0 })
    feedback.msgSuccess('设置成功')
    await getLists()
}

const handleDelete = async (row: any) => {
    await feedback.confirm('确定删除该模特预设？')
    await deleteAigcFashionLookbookModel({ id: row.id })
    feedback.msgSuccess('删除成功')
    await getLists()
}

getLists()
</script>

<style lang="scss" scoped>
.option-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.option-title { color: var(--el-text-color-primary); font-size: 16px; font-weight: 600; line-height: 24px; }
.option-desc { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 13px; line-height: 20px; }
.model-cover { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 8px; background: #f5f7fa; color: var(--el-text-color-secondary); font-size: 12px; overflow: hidden; }
.form-tip { margin-top: 8px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
</style>
