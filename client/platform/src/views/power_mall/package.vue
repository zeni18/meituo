<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-tabs v-model="activeTab" @tab-change="handleTabChange">
                <el-tab-pane label="套餐配置" name="packages" />
                <el-tab-pane label="购买订单" name="orders" />
            </el-tabs>

            <el-form
                v-if="activeTab === 'packages'"
                class="mb-[-16px]"
                :model="packageQuery"
                :inline="true"
            >
                <el-form-item label="套餐名称">
                    <el-input
                        v-model="packageQuery.name"
                        class="w-[220px]"
                        placeholder="请输入套餐名称"
                        clearable
                        @keyup.enter="resetPackagePage"
                    />
                </el-form-item>
                <el-form-item label="套餐类型">
                    <el-select
                        v-model="packageQuery.type"
                        clearable
                        placeholder="全部"
                        style="width: 160px"
                    >
                        <el-option
                            v-for="(label, value) in packageTypes"
                            :key="value"
                            :label="label"
                            :value="value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="状态">
                    <el-select
                        v-model="packageQuery.status"
                        clearable
                        placeholder="全部"
                        style="width: 140px"
                    >
                        <el-option label="启用" :value="1" />
                        <el-option label="停用" :value="0" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPackagePage">查询</el-button>
                    <el-button @click="resetPackageParams">重置</el-button>
                    <el-button
                        v-perms="['power.package/add']"
                        type="primary"
                        @click="openEdit()"
                    >
                        <template #icon>
                            <icon name="el-icon-Plus" />
                        </template>
                        新增套餐
                    </el-button>
                </el-form-item>
            </el-form>

            <el-form v-else class="mb-[-16px]" :model="orderQuery" :inline="true">
                <el-form-item label="租户信息">
                    <el-input
                        v-model="orderQuery.tenant_info"
                        class="w-[240px]"
                        placeholder="租户名称/编号/手机号"
                        clearable
                        @keyup.enter="resetOrderPage"
                    />
                </el-form-item>
                <el-form-item label="订单编号">
                    <el-input
                        v-model="orderQuery.order_sn"
                        class="w-[220px]"
                        placeholder="请输入订单编号"
                        clearable
                        @keyup.enter="resetOrderPage"
                    />
                </el-form-item>
                <el-form-item label="套餐类型">
                    <el-select
                        v-model="orderQuery.package_type"
                        clearable
                        placeholder="全部"
                        style="width: 150px"
                    >
                        <el-option
                            v-for="(label, value) in packageTypes"
                            :key="value"
                            :label="label"
                            :value="value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="支付状态">
                    <el-select
                        v-model="orderQuery.pay_status"
                        clearable
                        placeholder="全部"
                        style="width: 140px"
                    >
                        <el-option label="待支付" :value="0" />
                        <el-option label="已支付" :value="1" />
                    </el-select>
                </el-form-item>
                <el-form-item label="创建时间">
                    <daterange-picker
                        v-model:startTime="orderQuery.start_time"
                        v-model:endTime="orderQuery.end_time"
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetOrderPage">查询</el-button>
                    <el-button @click="resetOrderParams">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card v-if="activeTab === 'packages'" class="!border-none mt-4" shadow="never">
            <el-table size="large" v-loading="packagePager.loading" :data="packagePager.lists">
                <el-table-column label="套餐名称" prop="name" min-width="160" />
                <el-table-column label="类型" prop="type_text" min-width="100" />
                <el-table-column label="有效期" prop="validity_text" min-width="110" />
                <el-table-column :label="`赠送${getPointUnit()}`" prop="points" min-width="110" />
                <el-table-column label="购买金额" min-width="110">
                    <template #default="{ row }">¥{{ row.amount }}</template>
                </el-table-column>
                <el-table-column label="说明" prop="description" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        <span v-if="row.description">{{ row.description }}</span>
                        <span v-else class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
                <el-table-column label="状态" min-width="90">
                    <template #default="{ row }">
                        <el-tag :type="row.status == 1 ? 'success' : 'info'">
                            {{ row.status == 1 ? '启用' : '停用' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" min-width="80" />
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            v-perms="['power.package/edit']"
                            type="primary"
                            link
                            @click="openEdit(row)"
                        >
                            编辑
                        </el-button>
                        <el-button
                            v-perms="['power.package/delete']"
                            type="danger"
                            link
                            @click="handleDelete(row.id)"
                        >
                            删除
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="packagePager" @change="getPackageLists" />
            </div>
        </el-card>

        <el-card v-else class="!border-none mt-4" shadow="never">
            <el-table size="large" v-loading="orderPager.loading" :data="orderPager.lists">
                <el-table-column label="订单编号" prop="order_sn" min-width="180" />
                <el-table-column label="租户" min-width="180">
                    <template #default="{ row }">
                        <div>{{ row.tenant_name || '-' }}</div>
                        <div class="text-xs text-tx-secondary">{{ row.tenant_sn || '' }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="套餐" min-width="170">
                    <template #default="{ row }">
                        <div>{{ row.package_name }}</div>
                        <div class="text-xs text-tx-secondary">{{ row.package_type_text }}</div>
                    </template>
                </el-table-column>
                <el-table-column :label="getPointUnit()" prop="points" min-width="100" />
                <el-table-column label="金额" min-width="100">
                    <template #default="{ row }">¥{{ row.order_amount }}</template>
                </el-table-column>
                <el-table-column label="有效期" prop="expire_time_text" min-width="170" />
                <el-table-column label="支付方式" prop="pay_way_text" min-width="100" />
                <el-table-column label="状态" min-width="90">
                    <template #default="{ row }">
                        <el-tag :type="row.pay_status == 1 ? 'success' : 'info'">
                            {{ row.pay_status_text }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="支付时间" prop="pay_time" min-width="170">
                    <template #default="{ row }">
                        <span v-if="row.pay_time">{{ row.pay_time }}</span>
                        <span v-else class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="orderPager" @change="getOrderLists" />
            </div>
        </el-card>

        <el-dialog
            v-model="showEdit"
            :title="formData.id ? '编辑算力套餐' : '新增算力套餐'"
            width="620px"
        >
            <el-form :model="formData" label-width="110px">
                <el-form-item label="套餐类型" required>
                    <el-radio-group v-model="formData.type" @change="handleTypeChange">
                        <el-radio-button label="member">会员套餐</el-radio-button>
                        <el-radio-button label="points">{{ getPointUnit() }}套餐</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="套餐名称" required>
                    <el-input v-model="formData.name" placeholder="请输入套餐名称" />
                </el-form-item>
                <el-form-item v-if="formData.type === 'member'" label="有效月数" required>
                    <el-input-number
                        v-model="formData.duration_months"
                        :min="1"
                        :precision="0"
                        class="w-[180px]"
                    />
                    <span class="ml-2 text-tx-secondary">个月</span>
                </el-form-item>
                <el-form-item :label="`赠送${getPointUnit()}`" required>
                    <el-input-number
                        v-model="formData.points"
                        :min="0.01"
                        :precision="2"
                        class="w-[180px]"
                    />
                </el-form-item>
                <el-form-item label="购买金额" required>
                    <el-input-number
                        v-model="formData.amount"
                        :min="0"
                        :precision="2"
                        class="w-[180px]"
                    />
                    <span class="ml-2 text-tx-secondary">元</span>
                </el-form-item>
                <el-form-item label="说明">
                    <el-input
                        v-model="formData.description"
                        type="textarea"
                        :rows="3"
                        maxlength="255"
                        show-word-limit
                    />
                </el-form-item>
                <el-form-item label="状态">
                    <el-switch v-model="formData.status" :active-value="1" :inactive-value="0" />
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="formData.sort" :min="0" :precision="0" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showEdit = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="powerMallPackage">
import { getPointUnit } from '@/utils/point-unit'

import {
    powerPackageAdd,
    powerPackageDelete,
    powerPackageEdit,
    powerPackageLists,
    powerPackageOrders,
    powerPackageTypes
} from '@/api/power_mall'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const activeTab = ref('packages')
const packageTypes = ref<Record<string, string>>({
    member: '会员套餐',
    points: `${getPointUnit()}套餐`
})

const packageQuery = reactive({
    name: '',
    type: '',
    status: ''
})
const {
    pager: packagePager,
    getLists: getPackageLists,
    resetPage: resetPackagePage,
    resetParams: resetPackageParams
} = usePaging({
    fetchFun: powerPackageLists,
    params: packageQuery
})

const orderQuery = reactive({
    tenant_info: '',
    order_sn: '',
    package_type: '',
    pay_status: '',
    start_time: '',
    end_time: ''
})
const {
    pager: orderPager,
    getLists: getOrderLists,
    resetPage: resetOrderPage,
    resetParams: resetOrderParams
} = usePaging({
    fetchFun: powerPackageOrders,
    params: orderQuery,
    firstLoading: false
})

const showEdit = ref(false)
const saving = ref(false)
const defaultForm = () => ({
    id: 0,
    type: 'points',
    name: '',
    description: '',
    duration_months: 1,
    amount: 0,
    points: 0,
    status: 1,
    sort: 0
})
const formData = reactive(defaultForm())

const loadTypes = async () => {
    const data = await powerPackageTypes()
    if (data && typeof data === 'object') {
        packageTypes.value = data
    }
}

const handleTabChange = () => {
    if (activeTab.value === 'orders' && !orderPager.lists.length) {
        getOrderLists()
    }
}

const handleTypeChange = () => {
    if (formData.type === 'points') {
        formData.duration_months = 0
    } else if (Number(formData.duration_months || 0) <= 0) {
        formData.duration_months = 1
    }
}

const openEdit = (row?: any) => {
    Object.assign(formData, defaultForm(), row || {})
    if (formData.type === 'points') {
        formData.duration_months = 0
    }
    showEdit.value = true
}

const handleSave = async () => {
    if (!formData.name) return feedback.msgError('请输入套餐名称')
    if (formData.type === 'member' && Number(formData.duration_months || 0) <= 0) {
        return feedback.msgError('会员套餐月数必须大于0')
    }
    if (Number(formData.points || 0) <= 0) return feedback.msgError(`赠送${getPointUnit()}必须大于0`)
    if (Number(formData.amount || 0) < 0) return feedback.msgError('购买金额不能小于0')
    saving.value = true
    try {
        if (formData.id) {
            await powerPackageEdit(formData)
        } else {
            await powerPackageAdd(formData)
        }
        showEdit.value = false
        getPackageLists()
    } finally {
        saving.value = false
    }
}

const handleDelete = async (id: number) => {
    await feedback.confirm('确认删除或下架该算力套餐？')
    await powerPackageDelete({ id })
    getPackageLists()
}

loadTypes()
getPackageLists()
</script>
