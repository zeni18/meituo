<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" :model="queryParams">
                <el-form-item label="关键词">
                    <el-input v-model="queryParams.keyword" class="w-[240px]" clearable placeholder="分类名称" @keyup.enter="getLists" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="getLists">查询</el-button>
                    <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <div class="mb-4">
                <el-button type="primary" @click="openForm()">新增分类</el-button>
            </div>
            <el-table v-loading="loading" :data="lists" size="large">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="分类名称" prop="name" min-width="160" />
                <el-table-column label="标识" prop="code" min-width="160" />
                <el-table-column label="排序" prop="sort" width="100" />
                <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                        <el-switch :model-value="Number(row.status) === 1" @change="handleStatus(row, $event)" />
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openForm(row)">编辑</el-button>
                        <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" :title="formData.id ? '编辑分类' : '新增分类'" width="520px">
            <el-form label-width="90px" :model="formData">
                <el-form-item label="分类名称" required>
                    <el-input v-model="formData.name" />
                </el-form-item>
                <el-form-item label="分类标识">
                    <el-input v-model="formData.code" placeholder="如 beauty，可留空自动生成" />
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

<script lang="ts" setup name="tenant-aigc-style-transfer-category">
import {
    deleteAigcStyleTransferCategory,
    getAigcStyleTransferCategories,
    saveAigcStyleTransferCategory,
    setAigcStyleTransferCategoryStatus
} from '@/apps/aigc_style_transfer/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const lists = ref<any[]>([])
const queryParams = reactive({ keyword: '' })
const formData = reactive({ id: 0, name: '', code: '', sort: 0, status: 1 })

const getLists = async () => {
    loading.value = true
    try {
        lists.value = await getAigcStyleTransferCategories(queryParams)
    } finally {
        loading.value = false
    }
}

const resetQuery = () => {
    queryParams.keyword = ''
    getLists()
}

const openForm = (row?: any) => {
    Object.assign(formData, {
        id: Number(row?.id || 0),
        name: row?.name || '',
        code: row?.code || '',
        sort: Number(row?.sort || 0),
        status: Number(row?.status ?? 1)
    })
    dialogVisible.value = true
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await saveAigcStyleTransferCategory(formData)
        feedback.msgSuccess('保存成功')
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}

const handleStatus = async (row: any, value: any) => {
    await setAigcStyleTransferCategoryStatus({ id: row.id, status: value ? 1 : 0 })
    feedback.msgSuccess('设置成功')
    getLists()
}

const handleDelete = async (row: any) => {
    await feedback.confirm('确定删除该分类？')
    await deleteAigcStyleTransferCategory({ id: row.id })
    feedback.msgSuccess('删除成功')
    getLists()
}

getLists()
</script>

