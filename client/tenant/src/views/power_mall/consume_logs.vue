<template>
    <div class="consume-log-page">
        <el-card class="!border-none" shadow="never">
            <template #header>
                <div class="page-head">
                    <div>
                        <div class="page-title">消耗日志</div>
                        <div class="page-desc">查看租户每一笔{{ pointUnit }}消耗的来源、用户、应用、任务和扣减后余额</div>
                    </div>
                    <el-button type="primary" @click="resetPage">刷新</el-button>
                </div>
            </template>

            <div class="summary-grid">
                <div class="summary-item summary-item--primary">
                    <span>当前剩余</span>
                    <strong>{{ formatPointAmount(summary.point_balance || '0.00') }}</strong>
                </div>
                <div class="summary-item">
                    <span>累计消耗</span>
                    <strong>{{ formatPointAmount(summary.total_amount || '0.00') }}</strong>
                    <em>{{ summary.total_count || 0 }} 笔</em>
                </div>
                <div class="summary-item">
                    <span>今日消耗</span>
                    <strong>{{ formatPointAmount(summary.today_amount || '0.00') }}</strong>
                    <em>{{ summary.today_count || 0 }} 笔</em>
                </div>
            </div>

            <el-form class="filter-form" :model="queryParams" :inline="true">
                <el-form-item label="关键字">
                    <el-input
                        v-model.trim="queryParams.keyword"
                        class="w-[240px]"
                        placeholder="流水/来源/备注/用户"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="用户">
                    <el-input
                        v-model.trim="queryParams.user_info"
                        class="w-[190px]"
                        placeholder="昵称/账号/手机号"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="应用编码">
                    <el-input
                        v-model.trim="queryParams.app_code"
                        class="w-[180px]"
                        placeholder="如 aigc_image"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="任务ID">
                    <el-input
                        v-model.trim="queryParams.task_id"
                        class="w-[140px]"
                        placeholder="任务ID"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="来源类型">
                    <el-select v-model="queryParams.source_type" class="w-[150px]" clearable placeholder="全部">
                        <el-option
                            v-for="item in sourceTypeOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="来源单号">
                    <el-input
                        v-model.trim="queryParams.source_sn"
                        class="w-[210px]"
                        placeholder="来源单号"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="流水编号">
                    <el-input
                        v-model.trim="queryParams.log_sn"
                        class="w-[190px]"
                        placeholder="流水编号"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="消耗范围">
                    <div class="amount-range">
                        <el-input v-model.trim="queryParams.min_amount" placeholder="最小" clearable @keyup.enter="resetPage" />
                        <span>-</span>
                        <el-input v-model.trim="queryParams.max_amount" placeholder="最大" clearable @keyup.enter="resetPage" />
                    </div>
                </el-form-item>
                <el-form-item label="创建时间">
                    <daterange-picker
                        v-model:startTime="queryParams.start_time"
                        v-model:endTime="queryParams.end_time"
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">查询</el-button>
                    <el-button @click="resetParams">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column type="expand" width="48">
                    <template #default="{ row }">
                        <div class="expand-detail">
                            <div class="detail-grid">
                                <div v-for="item in row.source_detail_items" :key="item.label" class="detail-item">
                                    <span>{{ item.label }}</span>
                                    <strong>{{ item.value || '-' }}</strong>
                                </div>
                            </div>
                            <div class="raw-extra">
                                <span>原始扩展信息</span>
                                <pre>{{ formatExtra(row.extra) }}</pre>
                            </div>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="消耗时间" prop="create_time_text" min-width="170" />
                <el-table-column label="来源" min-width="240">
                    <template #default="{ row }">
                        <div class="source-main">
                            <span>{{ row.source_type_text }}</span>
                            <strong>{{ row.remark || '-' }}</strong>
                        </div>
                        <div class="source-sub">{{ row.source_sn || '-' }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="应用/任务" min-width="210">
                    <template #default="{ row }">
                        <div>{{ row.app_name || '-' }}</div>
                        <div class="source-sub">
                            <span v-if="row.app_code">{{ row.app_code }}</span>
                            <span v-if="row.extra?.task_id">任务ID：{{ row.extra.task_id }}</span>
                            <span v-if="row.extra?.result_id">结果ID：{{ row.extra.result_id }}</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="180">
                    <template #default="{ row }">
                        <template v-if="row.user?.id">
                            <div>{{ row.user.nickname || row.user.account || row.user.mobile || row.user.sn }}</div>
                            <div class="source-sub">{{ row.user.mobile || row.user.account || row.user.sn }}</div>
                        </template>
                        <span v-else class="text-tx-secondary">租户侧操作</span>
                    </template>
                </el-table-column>
                <el-table-column :label="`消耗${pointUnit}`" min-width="130">
                    <template #default="{ row }">
                        <span class="amount-dec">{{ row.change_amount_text }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="扣减后余额" prop="left_amount_text" min-width="140" />
                <el-table-column label="计费侧" prop="billing_side_text" min-width="110" />
                <el-table-column label="流水编号" prop="sn" min-width="180" />
                <el-table-column label="操作" width="90" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-dialog v-model="detailVisible" title="消耗日志详情" width="760px">
            <div v-if="currentDetail" class="detail-dialog">
                <div class="detail-summary">
                    <div>
                        <span>消耗</span>
                        <strong class="amount-dec">{{ currentDetail.change_amount_text }}</strong>
                    </div>
                    <div>
                        <span>扣减后余额</span>
                        <strong>{{ currentDetail.left_amount_text }}</strong>
                    </div>
                    <div>
                        <span>消耗时间</span>
                        <strong>{{ currentDetail.create_time_text }}</strong>
                    </div>
                </div>
                <el-descriptions :column="2" border>
                    <el-descriptions-item
                        v-for="item in currentDetail.source_detail_items"
                        :key="item.label"
                        :label="item.label"
                    >
                        {{ item.value || '-' }}
                    </el-descriptions-item>
                </el-descriptions>
                <div class="raw-extra raw-extra--dialog">
                    <span>原始扩展信息</span>
                    <pre>{{ formatExtra(currentDetail.extra) }}</pre>
                </div>
            </div>
            <template #footer>
                <el-button type="primary" @click="detailVisible = false">知道了</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="powerMallConsumeLogs">
import { powerConsumeLogDetail, powerConsumeLogs } from '@/api/power_mall'
import { usePaging } from '@/hooks/usePaging'
import { formatPointAmount, getPointUnit } from '@/utils/point-unit'

const pointUnit = computed(() => getPointUnit())
const queryParams = reactive({
    keyword: '',
    user_info: '',
    app_code: '',
    task_id: '',
    source_type: '',
    source_sn: '',
    log_sn: '',
    min_amount: '',
    max_amount: '',
    start_time: '',
    end_time: ''
})

const {
    pager,
    getLists,
    resetPage,
    resetParams
} = usePaging({
    fetchFun: powerConsumeLogs,
    params: queryParams,
    firstLoading: true
})

const summary = computed(() => pager.extend?.summary || {})
const sourceTypeOptions = computed(() => pager.extend?.source_type_options || [
    { label: 'AI应用消耗', value: 'app' },
    { label: '应用开通/续费', value: 'app_plan' },
    { label: '其他业务消耗', value: 'other' }
])

const detailVisible = ref(false)
const currentDetail = ref<any>(null)

const openDetail = async (row: any) => {
    currentDetail.value = await powerConsumeLogDetail({ id: row.id })
    detailVisible.value = true
}

const formatExtra = (extra: any) => {
    if (!extra || (typeof extra === 'object' && !Object.keys(extra).length)) return '-'
    return JSON.stringify(extra, null, 2)
}

getLists()
</script>

<style scoped>
.page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.page-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.page-desc,
.source-sub,
.summary-item span,
.summary-item em,
.detail-item span,
.raw-extra span,
.detail-summary span {
    color: var(--el-text-color-secondary);
}

.page-desc {
    margin-top: 6px;
    font-size: 13px;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
}

.summary-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
}

.summary-item--primary {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
}

.summary-item strong {
    font-size: 22px;
    line-height: 1.2;
    color: var(--el-text-color-primary);
}

.summary-item em {
    font-style: normal;
    font-size: 12px;
}

.filter-form {
    margin-bottom: -16px;
}

.amount-range {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: 210px;
}

.source-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.source-main span {
    color: var(--el-color-primary);
    font-size: 12px;
}

.source-main strong {
    font-weight: 500;
}

.source-sub {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    font-size: 12px;
}

.amount-dec {
    color: var(--el-color-danger);
    font-weight: 600;
}

.expand-detail {
    padding: 8px 24px 18px 24px;
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.detail-item {
    min-width: 0;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
}

.detail-item span,
.raw-extra span,
.detail-summary span {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
}

.detail-item strong {
    word-break: break-all;
    font-weight: 500;
}

.raw-extra {
    margin-top: 12px;
}

.raw-extra pre {
    max-height: 220px;
    overflow: auto;
    margin: 0;
    padding: 12px;
    border-radius: 6px;
    background: #111827;
    color: #e5e7eb;
    font-size: 12px;
    line-height: 1.6;
}

.detail-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
}

.detail-summary > div {
    padding: 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
}

.detail-summary strong {
    font-size: 16px;
}

.raw-extra--dialog {
    margin-top: 16px;
}
</style>
