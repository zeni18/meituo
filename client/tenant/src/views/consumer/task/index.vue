<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                <el-form-item label="关键词">
                    <el-input
                        v-model="queryParams.keyword"
                        class="w-[260px]"
                        placeholder="任务ID/用户/提示词"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="用户ID">
                    <el-input v-model="queryParams.user_id" class="w-[120px]" clearable @keyup.enter="resetPage" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-select v-model="queryParams.status" style="width: 150px; --el-select-width: 150px" placeholder="全部状态" clearable @change="resetPage">
                        <el-option label="等待中" value="pending" />
                        <el-option label="运行中" value="running" />
                        <el-option label="成功" value="success" />
                        <el-option label="失败" value="failed" />
                    </el-select>
                </el-form-item>
                <el-form-item label="创建时间">
                    <daterange-picker
                        v-model:startTime="queryParams.create_time_start"
                        v-model:endTime="queryParams.create_time_end"
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">查询</el-button>
                    <el-button @click="resetParams">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <div class="mb-3 flex items-center gap-2"><span class="text-sm text-info">已选 {{ selectedRows.length }} 条统一任务</span><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('query')">批量查询</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('retry_query')">重试查询</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('complete_by_query')">查询并结算</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('fail')">批量失败</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('recover')">补偿恢复</el-button><el-button size="small" :disabled="!selectedRows.length" @click="openBatch('retry_transfer')">重试转存</el-button><el-button size="small" type="danger" plain :disabled="!selectedRows.length" @click="openBatch('delete')">批量删除</el-button></div>
            <el-table size="large" v-loading="pager.loading" :data="pager.lists" @selection-change="selectedRows = $event">
                <el-table-column type="selection" width="48" :selectable="isUnifiedTask" />
                <el-table-column label="创建时间" prop="create_time_text" min-width="170" />
                <el-table-column label="执行类型" width="110">
                    <template #default="{ row }">
                        <el-tag :type="typeTagType(row)" effect="plain">{{ displayType(row) }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="应用" min-width="150" show-overflow-tooltip>
                    <template #default="{ row }">{{ sourceAppName(row) }}</template>
                </el-table-column>
                <el-table-column label="模型" min-width="170" show-overflow-tooltip>
                    <template #default="{ row }">{{ displayModel(row) }}</template>
                </el-table-column>
                <el-table-column label="参数" min-width="130">
                    <template #default="{ row }">
                        <div>{{ displayRatio(row) }}</div>
                        <div v-if="displayDuration(row) !== '-'" class="text-xs text-info">时长: {{ displayDuration(row) }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="180">
                    <template #default="{ row }">
                        <div>{{ row.initiator_name || '--' }}</div>
                        <div class="text-xs text-info">ID: {{ row.user_id }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="渠道" min-width="130" show-overflow-tooltip>
                    <template #default="{ row }">{{ displayChannel(row) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="用户消耗" width="110">
                    <template #default="{ row }">{{ formatPoint(row.user_charge_points) }}</template>
                </el-table-column>
                <el-table-column label="租户成本" width="110">
                    <template #default="{ row }">{{ formatPoint(row.tenant_cost_points) }}</template>
                </el-table-column>
                <el-table-column label="毛利" width="110">
                    <template #default="{ row }">{{ formatPoint(taskMargin(row)) }}</template>
                </el-table-column>
                <el-table-column label="执行耗时(ms)" width="130">
                    <template #default="{ row }">{{ responseTime(row) }}</template>
                </el-table-column>
                <el-table-column label="任务ID" min-width="210" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>本地: {{ localTaskId(row) }}</div>
                        <div class="text-xs text-info">供应商: {{ providerTaskId(row) }}</div>
                        <el-button v-if="localTaskId(row) !== '-'" v-copy="localTaskId(row)" type="primary" link size="small">复制</el-button>
                    </template>
                </el-table-column>
                <el-table-column label="结果" width="90">
                    <template #default="{ row }">
                        <el-button v-if="hasResult(row)" type="primary" link @click="openResult(row)">查看</el-button>
                        <span v-else>-</span>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="130" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            v-perms="['ai_task/query']"
                            type="primary"
                            link
                            :loading="queryingKey === row.record_key"
                            :disabled="!canQuery(row)"
                            @click="handleQuery(row)"
                        >
                            查询
                        </el-button>
                        <el-button v-perms="['ai_task/detail']" type="primary" link @click="openDetail(row)">详情</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-dialog v-model="resultVisible" title="任务结果" width="760px" top="6vh" destroy-on-close>
            <div v-if="currentResults.length" class="result-grid">
                <div v-for="item in currentResults" :key="resultKey(item)" class="result-item">
                    <el-image
                        v-if="item.type === 'image'"
                        class="result-image"
                        :src="item.url"
                        :preview-src-list="currentResults.filter((result) => result.type === 'image').map((result) => result.url)"
                        preview-teleported
                        fit="contain"
                    />
                    <video v-else class="result-video" :src="item.url" controls preload="metadata"></video>
                    <el-link class="mt-2" type="primary" :href="item.url" target="_blank">打开文件</el-link>
                </div>
            </div>
            <el-empty v-else description="暂无结果" />
        </el-dialog>

        <el-dialog v-model="detailVisible" title="任务详情" width="980px" top="6vh">
            <el-tabs v-model="activeDetailTab">
                <el-tab-pane label="基础信息" name="basic">
                    <el-descriptions class="task-detail-descriptions" :column="2" border>
                        <el-descriptions-item label="本地任务ID">{{ localTaskId(detail) }}</el-descriptions-item>
                        <el-descriptions-item label="供应商任务ID">{{ providerTaskId(detail) }}</el-descriptions-item>
                        <el-descriptions-item label="来源应用">{{ detail.source_app_name || detail.app_name || '--' }}</el-descriptions-item>
                        <el-descriptions-item label="执行应用">{{ detail.base_app_name || '--' }}</el-descriptions-item>
                        <el-descriptions-item label="执行类型">{{ displayType(detail) }}</el-descriptions-item>
                        <el-descriptions-item label="执行模型">{{ displayModel(detail) }}</el-descriptions-item>
                        <el-descriptions-item label="执行渠道">{{ displayChannel(detail) }}</el-descriptions-item>
                        <el-descriptions-item label="比例/时长">{{ displaySpec(detail) }}</el-descriptions-item>
                        <el-descriptions-item label="状态">{{ statusText(detail.status) }}</el-descriptions-item>
                        <el-descriptions-item label="用户消耗">{{ formatPoint(detail.user_charge_points) }}</el-descriptions-item>
                        <el-descriptions-item label="租户成本">{{ formatPoint(detail.tenant_cost_points) }}</el-descriptions-item>
                        <el-descriptions-item label="创建时间">{{ detail.create_time_text }}</el-descriptions-item>
                        <el-descriptions-item label="完成时间">{{ detail.finish_time_text || '--' }}</el-descriptions-item>
                        <el-descriptions-item label="来源任务编号" :span="2">{{ detail.source_task_sn || detail.task_sn || '--' }}</el-descriptions-item>
                        <el-descriptions-item label="提示词" :span="2">
                            <div class="detail-text">{{ detail.prompt || '--' }}</div>
                        </el-descriptions-item>
                        <el-descriptions-item label="错误信息" :span="2">
                            <div class="detail-text">{{ detail.error || '--' }}</div>
                        </el-descriptions-item>
                    </el-descriptions>
                </el-tab-pane>
                <el-tab-pane v-if="detail.consumptions?.length" label="消耗明细" name="consumption">
                    <el-table :data="detail.consumptions" border>
                        <el-table-column label="消耗单号" prop="consume_no" min-width="180" />
                        <el-table-column label="上游任务 ID" min-width="180"><template #default="{ row }">{{ row.upstream_task_id || row.upstream_request_id || '--' }}</template></el-table-column>
                        <el-table-column label="模型/API" min-width="160"><template #default="{ row }">{{ row.model_code || row.api_code || '--' }}</template></el-table-column>
                        <el-table-column label="SKU/用量" min-width="140"><template #default="{ row }">{{ row.sku_id || '--' }} / {{ row.quantity }} {{ row.usage_unit }}</template></el-table-column>
                        <el-table-column label="执行状态" prop="run_status" width="110" />
                        <el-table-column label="结算状态" prop="billing_status" width="110" />
                        <el-table-column label="用户售价" prop="actual_user_price" width="110" />
                    </el-table>
                </el-tab-pane>
                <el-tab-pane label="来源与用户" name="source">
                    <div class="detail-section-title">用户信息</div>
                    <el-descriptions class="task-detail-descriptions" :column="2" border>
                        <el-descriptions-item label="用户ID">{{ detail.user_info?.user_id || detail.user_id || '--' }}</el-descriptions-item>
                        <el-descriptions-item label="用户昵称">{{ detail.user_info?.nickname || detail.user_nickname || '--' }}</el-descriptions-item>
                        <el-descriptions-item label="账号">{{ detail.user_info?.account || detail.user_account || '--' }}</el-descriptions-item>
                        <el-descriptions-item label="手机号">{{ detail.user_info?.mobile || detail.user_mobile || '--' }}</el-descriptions-item>
                    </el-descriptions>

                    <div class="detail-section-title mt-4">上游任务信息</div>
                    <el-table :data="detail.upstream_tasks || []" border>
                        <el-table-column label="关系" prop="relation" width="130" />
                        <el-table-column label="应用" prop="app_name" min-width="150" />
                        <el-table-column label="任务ID" prop="task_id" width="100" />
                        <el-table-column label="任务编号" prop="task_sn" min-width="180" />
                    </el-table>
                    <div class="detail-section-title mt-4">操作轨迹</div><el-table :data="detail.operation_tracks || []" border><el-table-column label="操作单" prop="operation_no" min-width="180" /><el-table-column label="操作" prop="action" width="130" /><el-table-column label="状态" prop="status" width="100" /><el-table-column label="结果" prop="result_message" min-width="240" /></el-table>
                </el-tab-pane>
                <el-tab-pane label="请求参数" name="request">
                    <pre class="json-block">{{ formatJson(detail.request_params) }}</pre>
                </el-tab-pane>
                <el-tab-pane label="响应信息" name="response">
                    <pre class="json-block">{{ formatJson(detail.response_info) }}</pre>
                </el-tab-pane>
            </el-tabs>
        </el-dialog>
        <el-dialog v-model="batchVisible" title="批量任务操作" width="520px"><el-form label-width="80px"><el-form-item label="操作"><el-tag>{{ actionLabel }}</el-tag></el-form-item><el-form-item label="操作原因"><el-input v-model="batchReason" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item></el-form><template #footer><el-button @click="batchVisible = false">取消</el-button><el-button type="primary" :loading="batchLoading" @click="submitBatch">确认执行</el-button></template></el-dialog>
        <el-drawer v-model="batchResultVisible" title="批量执行结果" size="680px"><el-table :data="batchResult.items || []" border><el-table-column label="记录" prop="record_key" min-width="150" /><el-table-column label="状态" prop="status" width="100" /><el-table-column label="结果" prop="result_message" min-width="240" /></el-table></el-drawer>
    </div>
</template>

<script lang="ts" setup name="tenantUserTaskRecord">
import { aiTaskBatchAction, getAiTaskDetail, getAiTaskLists, queryAiTaskResult } from '@/api/consumer'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const queryParams = reactive({
    keyword: '',
    user_id: '',
    status: '',
    create_time_start: '',
    create_time_end: ''
})
const detailVisible = ref(false)
const resultVisible = ref(false)
const detail = ref<any>({})
const currentResults = ref<any[]>([])
const activeDetailTab = ref('basic')
const queryingKey = ref('')
const selectedRows = ref<any[]>([])
const batchVisible = ref(false)
const batchResultVisible = ref(false)
const batchLoading = ref(false)
const batchReason = ref('')
const batchAction = ref('')
const batchResult = ref<any>({})

const { pager, getLists, resetPage, resetParams } = usePaging({
    fetchFun: getAiTaskLists,
    params: queryParams
})

const statusType = (status: string) => {
    if (status === 'success') return 'success'
    if (status === 'partial_success') return 'warning'
    if (status === 'failed') return 'danger'
    if (status === 'pending') return 'info'
    return 'warning'
}

const statusText = (status: string) => {
    const map: Record<string, string> = {
        pending: '等待中',
        running: '运行中',
        success: '已完成',
        partial_success: '部分完成',
        failed: '已失败',
        canceled: '已取消',
        partial_failed: '部分失败'
    }
    return map[status] || status || '--'
}

const emptyTextSet = new Set(['', '[]', '{}', 'null', 'undefined', 'pending', 'none'])

const cleanText = (value: any, fallback = '-') => {
    if (value === undefined || value === null) return fallback
    if (typeof value === 'object') return fallback
    const text = String(value).trim()
    if (emptyTextSet.has(text.toLowerCase())) return fallback
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) return fallback
    return text
}

const typeText = (row: any) => {
    if (row?.media_type === 'image') return '生图'
    if (row?.media_type === 'video') return '视频'
    if (row?.media_type === 'text') return '文本'
    return '应用'
}

const displayType = (row: any) => cleanText(row?.display_type, typeText(row))

const sourceAppName = (row: any) => cleanText(row?.source_app_name || row?.app_name || row?.base_app_name)

const displayModel = (row: any) => cleanText(row?.display_model, cleanText(row?.model, row?.base_app_name || '-'))

const displayChannel = (row: any) => cleanText(row?.display_channel, cleanText(row?.channel, cleanText(row?.provider)))

const displayRatio = (row: any) => cleanText(row?.display_ratio, cleanText(row?.ratio))

const displayDuration = (row: any) => {
    const display = cleanText(row?.display_duration, '')
    if (display) return display
    const duration = Number(row?.duration || 0)
    return duration > 0 ? `${duration}秒` : '-'
}

const displaySpec = (row: any) => {
    const ratio = displayRatio(row)
    const duration = displayDuration(row)
    if (ratio === '-' && duration === '-') return '-'
    return [ratio !== '-' ? ratio : '', duration !== '-' ? duration : ''].filter(Boolean).join(' / ')
}

const typeTagType = (row: any) => {
    if (row?.media_type === 'image') return 'warning'
    if (row?.media_type === 'video') return 'success'
    return 'info'
}

const formatPoint = (value: any) => {
    const number = Number(value || 0)
    return Number.isFinite(number) ? number.toFixed(4).replace(/\.?0+$/, '') || '0' : '0'
}

const taskMargin = (row: any) => Number(row?.user_charge_points || 0) - Number(row?.tenant_cost_points || 0)

const responseTime = (row: any) => {
    if (Number.isFinite(Number(row?.elapsed_ms)) && Number(row?.elapsed_ms) > 0) return Number(row.elapsed_ms)
    const start = Number(row?.create_time || 0)
    const terminal = ['success', 'failed', 'canceled', 'partial_failed'].includes(String(row?.status || ''))
    const end = Number(row?.finish_time || 0) || (terminal ? Number(row?.update_time || 0) : 0)
    if (start <= 0 || end <= 0 || end < start) return 0
    return Math.round((end - start) * 1000)
}

const localTaskId = (row: any) => cleanText(row?.local_task_id, row?.id ? `${row.base_app_code || 'task'}_${row.id}` : '-')

const providerTaskId = (row: any) => cleanText(row?.provider_task_id_display, cleanText(row?.provider_task_id || row?.provider_request_id))

const hasResult = (row: any) => Array.isArray(row?.media_results) && row.media_results.some((item: any) => item?.url)

const canQuery = (row: any) => Number(row?.id || 0) > 0 && Boolean(row?.base_app_code)

const resultKey = (item: any) => `${item.type || 'file'}-${item.id || item.url}`

const openResult = (row: any) => {
    currentResults.value = Array.isArray(row?.media_results) ? row.media_results.filter((item: any) => item?.url) : []
    resultVisible.value = true
}

const openDetail = async (row: any) => {
    detail.value = await getAiTaskDetail({
        id: row.id,
        base_app_code: row.base_app_code || 'aigc_image'
    })
    activeDetailTab.value = 'basic'
    detailVisible.value = true
}
const isUnifiedTask = (row: any) => row.base_app_code === 'ai_app_task'
const actionNames: Record<string, string> = { query: '批量查询', retry_query: '重试查询', complete_by_query: '查询并结算', fail: '批量失败', recover: '补偿恢复', retry_transfer: '重试转存', delete: '批量删除' }
const actionLabel = computed(() => actionNames[batchAction.value] || '')
const openBatch = (action: string) => { batchAction.value = action; batchReason.value = ''; batchVisible.value = true }
const submitBatch = async () => { batchLoading.value = true; try { batchResult.value = await aiTaskBatchAction({ action: batchAction.value, reason: batchReason.value, record_keys: selectedRows.value.map((row) => row.record_key) }); batchVisible.value = false; batchResultVisible.value = true; feedback.msgSuccess('批量操作已进入队列'); getLists() } finally { batchLoading.value = false } }

const handleQuery = async (row: any) => {
    queryingKey.value = row.record_key
    try {
        const latest = await queryAiTaskResult({
            id: row.id,
            base_app_code: row.base_app_code || 'aigc_image'
        })
        detail.value = latest || {}
        await getLists()
        if (hasResult(latest)) {
            feedback.msgSuccess('已查询到结果')
            openResult(latest)
        } else {
            feedback.msgSuccess('查询完成')
        }
    } finally {
        queryingKey.value = ''
    }
}

const formatJson = (value: any) => {
    if (value === undefined || value === null || value === '') {
        return '--'
    }
    try {
        return JSON.stringify(value, null, 2)
    } catch (error) {
        return String(value)
    }
}

onActivated(() => {
    getLists()
})
getLists()
</script>

<style lang="scss" scoped>
.result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
}

.result-item {
    min-width: 0;
}

.result-image,
.result-video {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    object-fit: contain;
}

.detail-text {
    max-height: 180px;
    overflow-y: auto;
    white-space: pre-wrap;
    line-height: 1.6;
}

.task-detail-descriptions {
    :deep(.el-descriptions__label) {
        width: 120px;
        min-width: 120px;
        white-space: nowrap;
        word-break: keep-all;
        text-align: left;
    }

    :deep(.el-descriptions__content) {
        min-width: 220px;
        word-break: break-word;
    }
}

.detail-section-title {
    margin-bottom: 12px;
    font-weight: 500;
    color: var(--el-text-color-primary);
}

.json-block {
    max-height: 520px;
    margin: 0;
    padding: 14px 16px;
    overflow: auto;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-regular);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
