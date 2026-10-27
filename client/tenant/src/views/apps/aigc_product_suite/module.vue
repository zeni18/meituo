<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <div class="option-head">
                <div>
                    <div class="option-title">模块配置</div>
                    <div class="option-desc">PC 端展示启用状态的模块，用户可多选生成。</div>
                </div>
                <el-button type="primary" @click="openForm()">新增模块</el-button>
            </div>
            <el-table v-loading="loading" :data="lists" size="large">
                <el-table-column label="封面" width="96">
                    <template #default="{ row }">
                        <el-image v-if="optionCover(row)" class="option-cover" :src="optionCover(row)" fit="cover" :preview-src-list="[optionCover(row)]" preview-teleported />
                        <div v-else class="option-cover option-cover--empty">未配置</div>
                    </template>
                </el-table-column>
                <el-table-column label="模块名称" prop="name" min-width="150" />
                <el-table-column label="标识" prop="code" width="150" />
                <el-table-column label="说明" prop="description" min-width="220" show-overflow-tooltip />
                <el-table-column label="内置" width="80">
                    <template #default="{ row }"><el-tag :type="Number(row.is_builtin) ? 'info' : 'success'">{{ Number(row.is_builtin) ? '是' : '否' }}</el-tag></template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="状态" width="100">
                    <template #default="{ row }"><el-switch :model-value="Number(row.status) === 1" @change="handleStatus(row, $event)" /></template>
                </el-table-column>
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openForm(row)">编辑</el-button>
                        <el-button v-if="!Number(row.is_builtin)" type="danger" link @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" :title="formData.id ? '编辑模块配置' : '新增模块配置'" width="720px" destroy-on-close>
            <el-form label-width="100px" :model="formData">
                <el-form-item label="模块名称" required><el-input v-model="formData.name" maxlength="80" show-word-limit /></el-form-item>
                <el-form-item label="模块标识" required>
                    <el-input v-model="formData.code" :disabled="!!formData.id" maxlength="80" placeholder="仅支持英文、数字、下划线和中划线" />
                </el-form-item>
                <el-form-item label="模块说明"><el-input v-model="formData.description" maxlength="200" show-word-limit /></el-form-item>
                <el-form-item label="提示词"><el-input v-model="formData.prompt" type="textarea" :rows="6" maxlength="1000" show-word-limit /></el-form-item>
                <el-form-item label="封面图">
                    <material-picker v-model="formData.cover_image" :limit="1" />
                    <div class="form-tip">建议使用 16:9 示例图，PC 端会展示在模块配置卡片中。</div>
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

<script lang="ts" setup name="tenant-aigc-product-suite-module">
import MaterialPicker from '@/components/material/picker.vue'
import { deleteAigcProductSuiteModule, getAigcProductSuiteModules, saveAigcProductSuiteModule, setAigcProductSuiteModuleStatus } from '@/apps/aigc_product_suite/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const lists = ref<any[]>([])
const formData = reactive({ id: 0, code: '', name: '', description: '', prompt: '', cover_image: '', sort: 0, status: 1 })
const optionCover = (row: any) => row?.cover_url || row?.cover_image || ''

const getLists = async () => {
    loading.value = true
    try {
        lists.value = await getAigcProductSuiteModules()
    } finally {
        loading.value = false
    }
}

const openForm = (row?: any) => {
    Object.assign(formData, {
        id: Number(row?.id || 0),
        code: row?.code || '',
        name: row?.name || '',
        description: row?.description || '',
        prompt: row?.prompt || '',
        cover_image: row?.cover_image || '',
        sort: Number(row?.sort || 0),
        status: Number(row?.status ?? 1)
    })
    dialogVisible.value = true
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await saveAigcProductSuiteModule(formData)
        feedback.msgSuccess('保存成功')
        dialogVisible.value = false
        await getLists()
    } finally {
        saving.value = false
    }
}

const handleStatus = async (row: any, value: any) => {
    await setAigcProductSuiteModuleStatus({ id: row.id, status: value ? 1 : 0 })
    feedback.msgSuccess('设置成功')
    await getLists()
}

const handleDelete = async (row: any) => {
    await feedback.confirm('确定删除该模块配置？')
    await deleteAigcProductSuiteModule({ id: row.id })
    feedback.msgSuccess('删除成功')
    await getLists()
}

getLists()
</script>

<style lang="scss" scoped>
.option-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.option-title { color: var(--el-text-color-primary); font-size: 16px; font-weight: 600; line-height: 24px; }
.option-desc { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 13px; line-height: 20px; }
.option-cover { display: flex; align-items: center; justify-content: center; width: 64px; height: 40px; border-radius: 6px; background: #f5f7fa; color: var(--el-text-color-secondary); font-size: 12px; overflow: hidden; }
.form-tip { margin-top: 8px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
</style>
