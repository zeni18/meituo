<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" class="mb-[-16px]">
                <el-form-item label="租户ID">
                    <el-input v-model="tenantId" class="w-[180px]" placeholder="留空查看全部" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="handleSearch">查询</el-button>
                </el-form-item>
            </el-form>
        </el-card>
        <el-card class="!border-none mt-4" shadow="never" v-loading="loading">
            <div class="grid grid-cols-4 gap-4 mb-4">
                <div v-for="item in cards" :key="item.label" class="p-4 bg-page rounded">
                    <div class="text-sm text-tx-secondary">{{ item.label }}</div>
                    <div class="text-2xl font-medium mt-2">{{ item.value }}</div>
                </div>
            </div>
            <el-table :data="tableLists" size="large">
                <el-table-column label="租户ID" prop="tenant_id" width="120" />
                <el-table-column label="任务数" prop="task_total" width="120" />
                <el-table-column label="使用用户" prop="user_total" width="120" />
                <el-table-column label="成功任务" prop="task_success" width="120" />
                <el-table-column label="失败任务" prop="task_failed" width="120" />
                <el-table-column label="最近任务" min-width="180">
                    <template #default="{ row }">{{ formatTime(row.last_task_time) }}</template>
                </el-table-column>
            </el-table>
            <pagination v-model="pager" @change="getData" />
        </el-card>
    </div>
</template>

<script lang="ts" setup name="platform-aigc-fitting-tenant-usage">
import { getAigcFittingTenantLists, getAigcFittingTenantStat } from '@/apps/aigc_fitting/api'
import { useLocalPaging } from '@/hooks/useLocalPaging'

const loading = ref(false)
const tenantId = ref('')
const stat = ref<any>({})
const { pager, tableLists, setLists, getPagingParams, resetPage } = useLocalPaging({ size: 15 })
const cards = computed(() => [
    { label: '任务数', value: stat.value.task_total || 0 },
    { label: '成功任务', value: stat.value.task_success || 0 },
    { label: '失败任务', value: stat.value.task_failed || 0 },
    { label: '作品数', value: stat.value.result_total || 0 },
    { label: '租户成本扣点', value: stat.value.tenant_cost_points || 0 },
    { label: '用户消费扣点', value: stat.value.user_charge_points || 0 }
])
const formatTime = (value: number) => (value ? new Date(value * 1000).toLocaleString() : '-')
const getData = async () => {
    loading.value = true
    pager.loading = true
    try {
        const params = { tenant_id: tenantId.value || 0, ...getPagingParams() }
        stat.value = await getAigcFittingTenantStat(params)
        const data = await getAigcFittingTenantLists(params)
        setLists(data)
    } finally {
        loading.value = false
        pager.loading = false
    }
}
const handleSearch = () => {
    resetPage()
    getData()
}
getData()
</script>
