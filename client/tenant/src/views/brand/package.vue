<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-table :data="packages" v-loading="loading" size="large">
                <el-table-column label="套餐名称" prop="name" min-width="150" />
                <el-table-column label="有效期" prop="duration_desc" min-width="90" />
                <el-table-column label="平台进货价" min-width="110"><template #default="{ row }">¥{{ row.quota_price }}</template></el-table-column>
                <el-table-column label="建议售价" min-width="110"><template #default="{ row }">¥{{ row.sale_price }}</template></el-table-column>
                <el-table-column label="当前额度" prop="remaining_quota" min-width="90" />
                <el-table-column label="状态" min-width="100"><template #default="{ row }"><el-tag :type="row.shelf_status === 1 ? 'success' : 'info'">{{ row.shelf_status_desc }}</el-tag></template></el-table-column>
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openEdit(row)">定价</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>
        <el-dialog v-model="showEdit" title="设置贴牌售价" width="460px">
            <el-form :model="formData" label-width="110px">
                <el-form-item label="套餐名称">{{ formData.name }}</el-form-item>
                <el-form-item label="当前额度">{{ formData.remaining_quota || 0 }}</el-form-item>
                <el-form-item label="售价"><el-input-number v-model="formData.sale_price" :min="0" :precision="2" /></el-form-item>
                <el-form-item label="状态"><el-radio-group v-model="formData.status"><el-radio :value="1">上架</el-radio><el-radio :value="0">下架</el-radio></el-radio-group></el-form-item>
            </el-form>
            <template #footer><el-button @click="showEdit = false">取消</el-button><el-button type="primary" :loading="saving" @click="savePrice">保存</el-button></template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { brandPackages, brandSavePrice } from '@/api/brand'

const loading = ref(false)
const saving = ref(false)
const packages = ref<any[]>([])
const showEdit = ref(false)
const formData = reactive<any>({ package_id: 0, name: '', sale_price: 0, status: 0, remaining_quota: 0 })

const getLists = async () => {
    loading.value = true
    try { packages.value = await brandPackages() } finally { loading.value = false }
}
const openEdit = (row: any) => {
    Object.assign(formData, { package_id: row.id, name: row.name, sale_price: row.tenant_sale_price, status: row.shelf_status, remaining_quota: row.remaining_quota })
    showEdit.value = true
}
const savePrice = async () => {
    saving.value = true
    try {
        await brandSavePrice(formData)
        showEdit.value = false
        getLists()
    } finally {
        saving.value = false
    }
}
getLists()
</script>

