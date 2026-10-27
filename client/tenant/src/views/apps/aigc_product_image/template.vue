<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" :model="queryParams">
                <el-form-item label="关键词">
                    <el-input v-model="queryParams.keyword" class="w-[220px]" clearable placeholder="模板名称" @keyup.enter="getLists" />
                </el-form-item>
                <el-form-item label="分类">
                    <el-select v-model="queryParams.category_id" class="w-[180px]" clearable placeholder="全部分类">
                        <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="getLists">查询</el-button>
                    <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <div class="mb-4">
                <el-button type="primary" @click="openForm()">新增模板</el-button>
            </div>
            <el-table v-loading="loading" :data="lists" size="large">
                <el-table-column label="图片" width="100">
                    <template #default="{ row }">
                        <el-image class="template-image" :src="row.image_url || row.image" fit="cover" :preview-src-list="[row.image_url || row.image]" preview-teleported />
                    </template>
                </el-table-column>
                <el-table-column label="名称" prop="name" min-width="160" />
                <el-table-column label="分类" prop="category_name" width="130" />
                <el-table-column label="VIP" width="80">
                    <template #default="{ row }"><el-tag v-if="Number(row.vip) === 1" type="warning">VIP</el-tag><span v-else>-</span></template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="状态" width="100">
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

        <el-dialog v-model="dialogVisible" :title="formData.id ? '编辑模板' : '新增模板'" width="640px" destroy-on-close>
            <el-form label-width="100px" :model="formData">
                <el-form-item label="模板图" required>
                    <material-picker v-model="formData.image" :limit="1" exclude-domain />
                </el-form-item>
                <el-form-item label="模板名称" required>
                    <el-input v-model="formData.name" />
                </el-form-item>
                <el-form-item label="分类" required>
                    <el-select v-model="formData.category_id" class="w-[260px]">
                        <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
                    </el-select>
                </el-form-item>
                <el-form-item label="模板提示词">
                    <el-input v-model="formData.prompt" type="textarea" :rows="4" maxlength="500" show-word-limit />
                </el-form-item>
                <el-form-item label="VIP">
                    <el-switch v-model="formData.vip" :active-value="1" :inactive-value="0" />
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

<script lang="ts" setup name="tenant-aigc-product-image-template">
import {
    deleteAigcProductImageTemplate,
    getAigcProductImageCategories,
    getAigcProductImageTemplates,
    saveAigcProductImageTemplate,
    setAigcProductImageTemplateStatus
} from '@/apps/aigc_product_image/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const lists = ref<any[]>([])
const categories = ref<any[]>([])
const queryParams = reactive({ keyword: '', category_id: undefined as number | undefined })
const formData = reactive({ id: 0, name: '', image: '', category_id: undefined as number | undefined, prompt: '', vip: 0, sort: 0, status: 1 })

const loadCategories = async () => {
    categories.value = await getAigcProductImageCategories()
}

const getLists = async () => {
    loading.value = true
    try {
        lists.value = await getAigcProductImageTemplates(queryParams)
    } finally {
        loading.value = false
    }
}

const resetQuery = () => {
    Object.assign(queryParams, { keyword: '', category_id: undefined })
    getLists()
}

const openForm = (row?: any) => {
    Object.assign(formData, {
        id: Number(row?.id || 0),
        name: row?.name || '',
        image: row?.image || '',
        category_id: row?.category_id || categories.value[0]?.id,
        prompt: row?.prompt || '',
        vip: Number(row?.vip || 0),
        sort: Number(row?.sort || 0),
        status: Number(row?.status ?? 1)
    })
    dialogVisible.value = true
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await saveAigcProductImageTemplate(formData)
        feedback.msgSuccess('保存成功')
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}

const handleStatus = async (row: any, value: any) => {
    await setAigcProductImageTemplateStatus({ id: row.id, status: value ? 1 : 0 })
    feedback.msgSuccess('设置成功')
    getLists()
}

const handleDelete = async (row: any) => {
    await feedback.confirm('确定删除该模板？')
    await deleteAigcProductImageTemplate({ id: row.id })
    feedback.msgSuccess('删除成功')
    getLists()
}

loadCategories()
getLists()
</script>

<style lang="scss" scoped>
.template-image {
    width: 64px;
    height: 64px;
    border-radius: 6px;
}
</style>

