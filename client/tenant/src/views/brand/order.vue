<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :model="query" inline class="mb-[-16px]">
                <el-form-item label="订单编号"><el-input v-model="query.order_sn" class="w-[220px]" clearable /></el-form-item>
                <el-form-item label="状态"><el-select v-model="query.pay_status" clearable class="!w-[130px]"><el-option label="待支付" :value="0" /><el-option label="已支付" :value="1" /></el-select></el-form-item>
                <el-form-item><el-button type="primary" @click="getLists">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
            </el-form>
        </el-card>
        <el-card class="!border-none mt-4" shadow="never">
            <el-table :data="pager.lists" v-loading="pager.loading" size="large">
                <el-table-column label="订单编号" prop="order_sn" min-width="180" />
                <el-table-column label="套餐" prop="package_name" min-width="160" />
                <el-table-column label="开通租户" min-width="180"><template #default="{ row }"><div>{{ row.child_tenant_name || '-' }}</div><div class="text-xs text-tx-secondary">{{ row.child_domain_alias }}</div></template></el-table-column>
                <el-table-column label="金额" min-width="90"><template #default="{ row }">¥{{ row.order_amount }}</template></el-table-column>
                <el-table-column label="状态" min-width="90"><template #default="{ row }"><el-tag :type="row.pay_status == 1 ? 'success' : 'info'">{{ row.pay_status_desc }}</el-tag></template></el-table-column>
                <el-table-column label="开通状态" min-width="140">
                    <template #default="{ row }">
                        <div>{{ row.open_status_desc }}</div>
                        <div v-if="row.open_error" class="text-xs text-danger break-all">{{ row.open_error }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="创建时间" prop="create_time" min-width="170" />
            </el-table>
            <div class="flex justify-end mt-4"><pagination v-model="pager" @change="getLists" /></div>
        </el-card>
    </div>
</template>

<script lang="ts" setup>
import { brandOrders } from '@/api/brand'
import { usePaging } from '@/hooks/usePaging'

const query = reactive({ order_sn: '', pay_status: '' as any })
const { pager, getLists, resetPage, resetParams } = usePaging({ fetchFun: brandOrders, params: query })
const reset = () => { resetParams(); resetPage() }
getLists()
</script>
