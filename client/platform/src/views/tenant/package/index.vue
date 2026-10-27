<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-tabs v-model="activeTab" @tab-change="refreshTab">
                <el-tab-pane label="套餐配置" name="packages" />
                <el-tab-pane label="额度订单" name="quotaOrders" />
                <el-tab-pane label="贴牌订单" name="brandOrders" />
            </el-tabs>
            <el-form v-if="activeTab === 'packages'" :model="packageQuery" :inline="true" class="mb-[-16px]">
                <el-form-item label="套餐名称">
                    <el-input v-model="packageQuery.name" class="w-[220px]" clearable placeholder="请输入套餐名称" @keyup.enter="resetPackagePage" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-select v-model="packageQuery.status" clearable placeholder="全部" class="!w-[130px]">
                        <el-option label="启用" :value="1" />
                        <el-option label="停用" :value="0" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPackagePage">查询</el-button>
                    <el-button @click="resetPackageParams">重置</el-button>
                    <el-button v-perms="['tenant.package/add']" type="primary" @click="openEdit()">
                        <template #icon><icon name="el-icon-Plus" /></template>
                        新增套餐
                    </el-button>
                </el-form-item>
            </el-form>
            <el-form v-else :model="orderQuery" :inline="true" class="mb-[-16px]">
                <el-form-item label="租户信息">
                    <el-input v-model="orderQuery.tenant_info" class="w-[220px]" clearable placeholder="租户名称/编号" @keyup.enter="resetCurrentOrderPage" />
                </el-form-item>
                <el-form-item label="订单编号">
                    <el-input v-model="orderQuery.order_sn" class="w-[220px]" clearable placeholder="请输入订单编号" @keyup.enter="resetCurrentOrderPage" />
                </el-form-item>
                <el-form-item label="支付状态">
                    <el-select v-model="orderQuery.pay_status" clearable placeholder="全部" class="!w-[130px]">
                        <el-option label="待支付" :value="0" />
                        <el-option label="已支付" :value="1" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetCurrentOrderPage">查询</el-button>
                    <el-button @click="resetOrderParams">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card v-if="activeTab === 'packages'" class="!border-none mt-4" shadow="never">
            <el-table size="large" v-loading="packagePager.loading" :data="packagePager.lists">
                <el-table-column label="套餐名称" prop="name" min-width="150" />
                <el-table-column label="有效期" prop="duration_desc" min-width="100" />
                <el-table-column label="建议售价" min-width="100"><template #default="{ row }">¥{{ row.sale_price }}</template></el-table-column>
                <el-table-column label="进货价/额度" min-width="120"><template #default="{ row }">¥{{ row.quota_price }} / {{ row.quota_unit }}</template></el-table-column>
                <el-table-column label="绑定应用套餐" min-width="220">
                    <template #default="{ row }">
                        <el-tag v-for="plan in row.app_plans" :key="plan.id" class="mr-1 mb-1">{{ plan.app_name }} / {{ plan.app_plan_name }}</el-tag>
                        <span v-if="!row.app_plans?.length" class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
                <el-table-column label="状态" min-width="80">
                    <template #default="{ row }"><el-tag :type="row.status == 1 ? 'success' : 'info'">{{ row.status_desc }}</el-tag></template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" min-width="70" />
                <el-table-column label="操作" width="140" fixed="right">
                    <template #default="{ row }">
                        <el-button v-perms="['tenant.package/edit']" type="primary" link @click="openEdit(row)">编辑</el-button>
                        <el-button v-perms="['tenant.package/delete']" type="danger" link @click="handleDelete(row.id)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4"><pagination v-model="packagePager" @change="getPackageLists" /></div>
        </el-card>

        <el-card v-else class="!border-none mt-4" shadow="never">
            <el-table size="large" v-loading="currentOrderPager.loading" :data="currentOrderPager.lists">
                <el-table-column label="订单编号" prop="order_sn" min-width="180" />
                <el-table-column label="租户" min-width="160">
                    <template #default="{ row }"><div>{{ row.tenant_name || '-' }}</div><div class="text-xs text-tx-secondary">{{ row.tenant_sn }}</div></template>
                </el-table-column>
                <el-table-column label="套餐" prop="package_name" min-width="150" />
                <el-table-column v-if="activeTab === 'quotaOrders'" label="数量" prop="quantity" min-width="80" />
                <el-table-column v-else label="开通租户" min-width="170">
                    <template #default="{ row }"><div>{{ row.child_tenant_name || '-' }}</div><div class="text-xs text-tx-secondary">{{ row.child_domain_alias }}</div></template>
                </el-table-column>
                <el-table-column label="金额" min-width="100"><template #default="{ row }">¥{{ row.order_amount }}</template></el-table-column>
                <el-table-column label="支付状态" min-width="90"><template #default="{ row }"><el-tag :type="row.pay_status == 1 ? 'success' : 'info'">{{ row.pay_status_desc }}</el-tag></template></el-table-column>
                <el-table-column v-if="activeTab === 'brandOrders'" label="开通状态" min-width="140">
                    <template #default="{ row }">
                        <div>{{ row.open_status_desc }}</div>
                        <div v-if="row.open_error" class="text-xs text-danger break-all">{{ row.open_error }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="创建时间" prop="create_time" min-width="170" />
            </el-table>
            <div class="flex justify-end mt-4"><pagination v-model="currentOrderPager" @change="getCurrentOrderLists" /></div>
        </el-card>

        <el-dialog v-model="showEdit" :title="formData.id ? '编辑租户套餐' : '新增租户套餐'" width="720px" destroy-on-close>
            <el-form :model="formData" label-width="120px">
                <el-form-item label="套餐名称" required><el-input v-model="formData.name" /></el-form-item>
                <el-form-item label="有效期" required><el-input-number v-model="formData.duration_days" :min="1" :precision="0" /><span class="ml-2">天</span></el-form-item>
                <el-form-item label="建议售价"><el-input-number v-model="formData.sale_price" :min="0" :precision="2" /><span class="ml-2">元</span></el-form-item>
                <el-form-item label="额度进货价"><el-input-number v-model="formData.quota_price" :min="0" :precision="2" /><span class="ml-2">元 / 个</span></el-form-item>
                <el-form-item label="绑定应用套餐">
                    <el-select v-model="selectedAppPlanKeys" multiple filterable collapse-tags collapse-tags-tooltip class="w-full" placeholder="请选择应用套餐">
                        <el-option v-for="item in appPlanOptions" :key="appPlanKey(item)" :label="`${item.app_name} / ${item.plan_name}`" :value="appPlanKey(item)" />
                    </el-select>
                </el-form-item>
                <el-form-item label="状态"><el-radio-group v-model="formData.status"><el-radio :value="1">启用</el-radio><el-radio :value="0">停用</el-radio></el-radio-group></el-form-item>
                <el-form-item label="排序"><el-input-number v-model="formData.sort" :precision="0" /></el-form-item>
                <el-form-item label="说明"><el-input v-model="formData.description" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
            </el-form>
            <template #footer><el-button @click="showEdit = false">取消</el-button><el-button type="primary" :loading="saving" @click="handleSave">保存</el-button></template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenantPackageManage">
import { tenantPackageAdd, tenantPackageAppPlans, tenantPackageBrandOrders, tenantPackageDelete, tenantPackageEdit, tenantPackageLists, tenantPackageQuotaOrders } from '@/api/tenant_package'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const activeTab = ref<'packages' | 'quotaOrders' | 'brandOrders'>('packages')
const packageQuery = reactive({ name: '', status: '' as any })
const orderQuery = reactive({ tenant_info: '', order_sn: '', pay_status: '' as any })
const packagePaging = usePaging({ fetchFun: tenantPackageLists, params: packageQuery })
const quotaPaging = usePaging({ fetchFun: tenantPackageQuotaOrders, params: orderQuery })
const brandPaging = usePaging({ fetchFun: tenantPackageBrandOrders, params: orderQuery })
const packagePager = packagePaging.pager
const currentOrderPager = computed(() => activeTab.value === 'quotaOrders' ? quotaPaging.pager : brandPaging.pager)
const showEdit = ref(false)
const saving = ref(false)
const appPlanOptions = ref<any[]>([])
const selectedAppPlanKeys = ref<string[]>([])
const formData = reactive<any>({ id: 0, name: '', duration_days: 30, sale_price: 0, quota_price: 0, quota_unit: '个', status: 1, sort: 0, description: '' })

const appPlanKey = (item: any) => `${item.app_code}:${item.plan_id}`
const getPackageLists = packagePaging.getLists
const resetPackagePage = packagePaging.resetPage
const resetPackageParams = packagePaging.resetParams
const getCurrentOrderLists = () => activeTab.value === 'quotaOrders' ? quotaPaging.getLists() : brandPaging.getLists()
const resetCurrentOrderPage = () => activeTab.value === 'quotaOrders' ? quotaPaging.resetPage() : brandPaging.resetPage()
const resetOrderParams = () => { quotaPaging.resetParams(); brandPaging.resetParams() }
const refreshTab = () => activeTab.value === 'packages' ? getPackageLists() : getCurrentOrderLists()

const loadAppPlans = async () => { appPlanOptions.value = await tenantPackageAppPlans() }
const openEdit = async (row?: any) => {
    await loadAppPlans()
    Object.assign(formData, row ? { ...row } : { id: 0, name: '', duration_days: 30, sale_price: 0, quota_price: 0, quota_unit: '个', status: 1, sort: 0, description: '' })
    selectedAppPlanKeys.value = (row?.app_plans || []).map((item: any) => `${item.app_code}:${item.app_plan_id}`)
    showEdit.value = true
}
const handleSave = async () => {
    saving.value = true
    try {
        const appPlans = selectedAppPlanKeys.value.map((key) => {
            const [app_code, planId] = key.split(':')
            return { app_code, app_plan_id: Number(planId) }
        })
        const params = { ...formData, app_plans: appPlans }
        formData.id ? await tenantPackageEdit(params) : await tenantPackageAdd(params)
        showEdit.value = false
        getPackageLists()
    } finally {
        saving.value = false
    }
}
const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该套餐？已产生订单的套餐会自动停用。')
    await tenantPackageDelete({ id })
    getPackageLists()
}
getPackageLists()
</script>
