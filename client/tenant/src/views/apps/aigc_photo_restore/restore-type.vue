<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-table v-loading="loading" :data="lists" size="large">
                <el-table-column label="类型名称" prop="name" min-width="160" />
                <el-table-column label="标识" prop="code" width="150" />
                <el-table-column label="说明" prop="description" min-width="220" show-overflow-tooltip />
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-switch :model-value="Number(row.status) === 1" @change="handleStatus(row, $event)" />
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="110" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openForm(row)">编辑</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" title="编辑修复类型" width="680px" destroy-on-close>
            <el-form label-width="100px" :model="formData">
                <el-form-item label="类型名称" required>
                    <el-input v-model="formData.name" />
                </el-form-item>
                <el-form-item label="类型说明">
                    <el-input v-model="formData.description" maxlength="120" show-word-limit />
                </el-form-item>
                <el-form-item label="提示词">
                    <el-input v-model="formData.prompt" type="textarea" :rows="6" maxlength="800" show-word-limit />
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="formData.sort" :min="0" :max="9999" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-radio-group v-model="formData.status">
                        <el-radio :value="1">启用</el-radio>
                        <el-radio :value="0">停用</el-radio>
                    </el-radio-group>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-photo-restore-type">
import { getAigcPhotoRestoreTypes, saveAigcPhotoRestoreType, setAigcPhotoRestoreTypeStatus } from '@/apps/aigc_photo_restore/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const lists = ref<any[]>([])
const formData = reactive({ id: 0, code: '', name: '', description: '', prompt: '', sort: 0, status: 1 })

const getLists = async () => {
    loading.value = true
    try {
        lists.value = await getAigcPhotoRestoreTypes()
    } finally {
        loading.value = false
    }
}

const openForm = (row: any) => {
    Object.assign(formData, {
        id: Number(row?.id || 0),
        code: row?.code || '',
        name: row?.name || '',
        description: row?.description || '',
        prompt: row?.prompt || '',
        sort: Number(row?.sort || 0),
        status: Number(row?.status ?? 1)
    })
    dialogVisible.value = true
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await saveAigcPhotoRestoreType(formData)
        feedback.msgSuccess('保存成功')
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}

const handleStatus = async (row: any, value: any) => {
    await setAigcPhotoRestoreTypeStatus({ code: row.code, status: value ? 1 : 0 })
    feedback.msgSuccess('设置成功')
    getLists()
}

getLists()
</script>

