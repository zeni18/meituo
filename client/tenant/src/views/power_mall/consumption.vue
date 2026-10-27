<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form class="mb-[-16px]" :model="queryParams" inline>
                <el-form-item label="关键词"><el-input v-model="queryParams.keyword" class="w-[260px]" placeholder="消耗单号/任务号/上游任务号/用户" clearable @keyup.enter="resetPage" /></el-form-item>
                <el-form-item label="应用"><el-input v-model="queryParams.app_code" class="w-[150px]" placeholder="应用标识" clearable @keyup.enter="resetPage" /></el-form-item>
                <el-form-item label="执行状态"><el-select v-model="queryParams.run_status" style="width: 130px; --el-select-width: 130px" clearable placeholder="全部" @change="resetPage"><el-option label="提交中" value="submitting" /><el-option label="运行中" value="running" /><el-option label="成功" value="success" /><el-option label="失败" value="failed" /></el-select></el-form-item>
                <el-form-item label="结算状态"><el-select v-model="queryParams.billing_status" style="width: 130px; --el-select-width: 130px" clearable placeholder="全部" @change="resetPage"><el-option label="预占" value="reserved" /><el-option label="已结算" value="settled" /><el-option label="已退款" value="refunded" /></el-select></el-form-item>
                <el-form-item><el-button type="primary" @click="resetPage">查询</el-button><el-button @click="resetParams">重置</el-button></el-form-item>
            </el-form>
        </el-card>
        <el-card class="!border-none mt-4" shadow="never">
            <div class="mb-3 flex items-center gap-2"><span class="text-sm text-info">已选 {{ selectedRows.length }} 条</span><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('query')">批量查询</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('retry_query')">重试查询</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('complete_by_query')">查询并结算</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('fail')">批量失败</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('recover')">补偿恢复</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('retry_transfer')">重试转存</el-button><el-button size="small" type="danger" plain :disabled="!selectedRows.length" @click="openBatch('delete')">批量删除</el-button></div>
            <el-table v-loading="pager.loading" :data="pager.lists" size="large" @selection-change="selectedRows = $event">
                <el-table-column type="selection" width="48" />
                <el-table-column label="消耗单号" prop="consume_no" min-width="190" />
                <el-table-column label="应用任务" prop="task_no" min-width="190" />
                <el-table-column label="用户" min-width="130"><template #default="{ row }">{{ row.user_nickname || row.user_account || `用户#${row.user_id}` }}</template></el-table-column>
                <el-table-column label="上游任务 ID" min-width="200" show-overflow-tooltip><template #default="{ row }">{{ row.upstream_task_id || row.upstream_request_id || '--' }}</template></el-table-column>
                <el-table-column label="应用" prop="app_name" min-width="130" />
                <el-table-column label="模型/API" min-width="180"><template #default="{ row }">{{ row.model_code || row.api_code || '--' }}</template></el-table-column>
                <el-table-column label="SKU/用量" min-width="150"><template #default="{ row }">{{ row.sku_id || '--' }} / {{ row.quantity }} {{ row.usage_unit }}</template></el-table-column>
                <el-table-column label="状态" width="105"><template #default="{ row }"><el-tag :type="statusType(row.run_status)">{{ row.run_status }}</el-tag></template></el-table-column>
                <el-table-column label="结算" width="105"><template #default="{ row }"><el-tag effect="plain" :type="billingType(row.billing_status)">{{ row.billing_status }}</el-tag></template></el-table-column>
                <el-table-column label="租户成本" prop="actual_tenant_cost" width="110" />
                <el-table-column label="用户售价" prop="actual_user_price" width="110" />
                <el-table-column label="创建时间" prop="create_time_text" width="170" />
                <el-table-column label="操作" width="80" fixed="right"><template #default="{ row }"><el-button type="primary" link @click="openDetail(row)">详情</el-button></template></el-table-column>
            </el-table>
            <div class="flex justify-end mt-4"><pagination v-model="pager" @change="getLists" /></div>
        </el-card>
        <el-dialog v-model="detailVisible" title="消耗日志详情" width="920px" top="6vh">
            <el-descriptions :column="2" border>
                <el-descriptions-item label="消耗单号">{{ detail.consume_no }}</el-descriptions-item><el-descriptions-item label="应用任务">{{ detail.task_no || '--' }}</el-descriptions-item>
                <el-descriptions-item label="模型/API">{{ detail.model_code || detail.api_code || '--' }}</el-descriptions-item><el-descriptions-item label="上游任务">{{ detail.upstream_task_id || detail.upstream_request_id || '--' }}</el-descriptions-item>
                <el-descriptions-item label="SKU">{{ detail.sku_id || '--' }}</el-descriptions-item><el-descriptions-item label="用量">{{ detail.quantity }} {{ detail.usage_unit }}</el-descriptions-item>
                <el-descriptions-item label="租户成本">{{ detail.actual_tenant_cost || detail.reserved_tenant_cost }}</el-descriptions-item><el-descriptions-item label="用户售价">{{ detail.actual_user_price || detail.reserved_user_price }}</el-descriptions-item>
                <el-descriptions-item label="错误信息" :span="2">{{ detail.error_message || '--' }}</el-descriptions-item>
            </el-descriptions>
            <div class="mt-4 mb-2 font-medium">调用明细</div>
            <el-table :data="detail.events || []" border><el-table-column label="时间" width="170"><template #default="{ row }">{{ row.create_time_text || formatTime(row.create_time) }}</template></el-table-column><el-table-column label="事件" prop="event_type" width="120" /><el-table-column label="状态" prop="event_status" width="120" /><el-table-column label="摘要" min-width="320"><template #default="{ row }"><pre class="m-0 whitespace-pre-wrap">{{ formatJson(row.payload_summary) }}</pre></template></el-table-column></el-table>
            <div class="mt-4 mb-2 font-medium">操作轨迹</div><el-table :data="detail.operation_tracks || []" border><el-table-column label="操作单" prop="operation_no" width="180" /><el-table-column label="操作" prop="action" width="130" /><el-table-column label="状态" prop="status" width="100" /><el-table-column label="结果" prop="result_message" min-width="260" /></el-table>
        </el-dialog>
        <el-dialog v-model="batchVisible" title="批量任务操作" width="520px"><el-form label-width="80px"><el-form-item label="操作"><el-tag>{{ actionLabel }}</el-tag></el-form-item><el-form-item label="操作原因"><el-input v-model="batchReason" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item></el-form><template #footer><el-button @click="batchVisible = false">取消</el-button><el-button type="primary" :loading="batchLoading" @click="submitBatch">确认执行</el-button></template></el-dialog>
        <el-drawer v-model="resultVisible" title="批量执行结果" size="680px"><el-table :data="batchResult.items || []" border><el-table-column label="记录" prop="record_key" min-width="150" /><el-table-column label="状态" prop="status" width="100" /><el-table-column label="结果" prop="result_message" min-width="240" /></el-table></el-drawer>
    </div>
</template>

<script lang="ts" setup name="tenantAiConsumption">
import { onActivated, onMounted } from 'vue'
import { aiConsumptionBatchAction, aiConsumptionDetail, aiConsumptionLists } from '@/api/power_mall'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const queryParams = reactive({ keyword: '', app_code: '', run_status: '', billing_status: '' })
const detailVisible = ref(false)
const detail = ref<any>({})
const selectedRows = ref<any[]>([])
const batchVisible = ref(false)
const resultVisible = ref(false)
const batchLoading = ref(false)
const batchReason = ref('')
const batchAction = ref('')
const batchResult = ref<any>({})
const { pager, getLists, resetPage, resetParams } = usePaging({ fetchFun: aiConsumptionLists, params: queryParams })
const statusType = (value: string) => value === 'success' ? 'success' : value === 'failed' ? 'danger' : 'warning'
const billingType = (value: string) => value === 'settled' ? 'success' : value === 'refunded' ? 'info' : 'warning'
const formatTime = (value: number | string) => {
    if (!value) return '--'
    if (typeof value === 'string' && !/^\d+$/.test(value)) return value
    const timestamp = Number(value)
    return timestamp > 100000000 ? new Date(timestamp * 1000).toLocaleString() : '--'
}
const formatJson = (value: any) => JSON.stringify(value || {}, null, 2)
const openDetail = async (row: any) => { detail.value = await aiConsumptionDetail({ id: row.id }); detailVisible.value = true }
const actionNames: Record<string, string> = { query: '批量查询', retry_query: '重试查询', complete_by_query: '查询并结算', fail: '批量失败', recover: '补偿恢复', retry_transfer: '重试转存', delete: '批量删除' }
const actionLabel = computed(() => actionNames[batchAction.value] || '')
const openBatch = (action: string) => { batchAction.value = action; batchReason.value = ''; batchVisible.value = true }
const submitBatch = async () => { batchLoading.value = true; try { batchResult.value = await aiConsumptionBatchAction({ action: batchAction.value, reason: batchReason.value, record_keys: selectedRows.value.map((row) => row.record_key) }); batchVisible.value = false; resultVisible.value = true; feedback.msgSuccess('批量操作已进入队列'); getLists() } finally { batchLoading.value = false } }

let lastAutoLoadTime = 0
const loadOnEnter = () => {
    if (Date.now() - lastAutoLoadTime < 300) return
    lastAutoLoadTime = Date.now()
    getLists()
}
onMounted(loadOnEnter)
onActivated(loadOnEnter)
</script>
