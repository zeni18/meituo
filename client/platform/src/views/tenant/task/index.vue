<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                <el-form-item label="关键词">
                    <el-input
                        v-model="queryParams.keyword"
                        class="w-[260px]"
                        placeholder="任务ID/租户/用户/提示词"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="租户ID">
                    <el-input v-model="queryParams.tenant_id" class="w-[120px]" clearable />
                </el-form-item>
                <el-form-item label="状态">
                    <el-select
                        v-model="queryParams.status"
                        style="width: 150px; --el-select-width: 150px"
                        placeholder="全部状态"
                        clearable
                    >
                        <el-option label="运行中" value="running" />
                        <el-option label="成功" value="success" />
                        <el-option label="失败" value="failed" />
                        <el-option label="等待中" value="pending" />
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
                <el-table-column label="任务编号" prop="task_sn" min-width="140" />
                <el-table-column label="租户" min-width="150">
                    <template #default="{ row }">
                        <div>{{ row.tenant_name || '--' }}</div>
                        <div class="text-xs text-info">{{ row.tenant_sn || row.tenant_id }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="应用" min-width="130">
                    <template #default="{ row }">
                        <div>{{ row.source_app_name || row.app_name || '--' }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="150">
                    <template #default="{ row }">
                        <div>{{ row.initiator_name || '--' }}</div>
                        <div class="text-xs text-info">ID: {{ row.user_id }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="提示词" prop="prompt" min-width="240" show-overflow-tooltip />
                <el-table-column label="比例" prop="ratio" width="90" />
                <el-table-column label="数量" prop="quantity" width="80" />
                <el-table-column :label="getPointUnit()" prop="point_actual" width="90" />
                <el-table-column label="结果" width="120">
                    <template #default="{ row }">
                        <div v-if="mediaResults(row).length" class="result-preview-list">
                            <template
                                v-for="(item, index) in mediaResults(row).slice(0, 3)"
                                :key="`${item.type}-${item.id || index}`"
                            >
                                <el-image
                                    v-if="item.type === 'image'"
                                    class="result-preview-thumb"
                                    :src="item.thumb_url || item.url"
                                    fit="cover"
                                    :preview-src-list="imagePreviewUrls(row)"
                                    :initial-index="imagePreviewIndex(row, index)"
                                    preview-teleported
                                />
                                <div
                                    v-else
                                    class="result-preview-thumb result-preview-video"
                                    @click="openMediaPreview(row, index)"
                                >
                                    <video
                                        :src="item.url"
                                        :poster="item.thumb_url || undefined"
                                        muted
                                        preload="metadata"
                                    />
                                    <span class="result-preview-play">▶</span>
                                </div>
                            </template>
                            <el-button
                                v-if="mediaResults(row).length > 3"
                                link
                                type="primary"
                                class="result-preview-more"
                                @click="openMediaPreview(row, 0)"
                            >
                                +{{ mediaResults(row).length - 3 }}
                            </el-button>
                        </div>
                        <span v-else class="text-info">--</span>
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-tag :type="statusType(row.status)">
                            {{ statusText(row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="创建时间" prop="create_time_text" min-width="170" />
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
        <el-dialog v-model="detailVisible" title="任务详情" width="980px" top="6vh">
            <el-tabs v-model="activeDetailTab">
                <el-tab-pane label="基础信息" name="basic">
                    <el-descriptions class="task-detail-descriptions" :column="2" border>
                        <el-descriptions-item label="任务编号">{{ detail.task_sn }}</el-descriptions-item>
                        <el-descriptions-item label="来源应用">{{
                            detail.source_app_name || detail.app_name || '--'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="执行应用">{{
                            detail.base_app_name || 'AIGC生图'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="状态">{{
                            statusText(detail.status)
                        }}</el-descriptions-item>
                        <el-descriptions-item :label="`预计${getPointUnit()}`">{{
                            detail.point_estimated
                        }}</el-descriptions-item>
                        <el-descriptions-item label="实际扣点">{{
                            detail.point_actual
                        }}</el-descriptions-item>
                        <el-descriptions-item label="创建时间">{{
                            detail.create_time_text
                        }}</el-descriptions-item>
                        <el-descriptions-item label="完成时间">{{
                            detail.finish_time_text || '--'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="供应商任务ID" :span="2">{{
                            detail.provider_task_id || '--'
                        }}</el-descriptions-item>
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
                        <el-table-column label="上游任务 ID" min-width="180">
                            <template #default="{ row }">{{ row.upstream_task_id || row.upstream_request_id || '--' }}</template>
                        </el-table-column>
                        <el-table-column label="模型/API" min-width="160">
                            <template #default="{ row }">{{ row.model_code || row.api_code || '--' }}</template>
                        </el-table-column>
                        <el-table-column label="SKU/用量" min-width="140">
                            <template #default="{ row }">{{ row.sku_id || '--' }} / {{ row.quantity }} {{ row.usage_unit }}</template>
                        </el-table-column>
                        <el-table-column label="执行状态" prop="run_status" width="110" />
                        <el-table-column label="结算状态" prop="billing_status" width="110" />
                        <el-table-column label="用户售价" prop="actual_user_price" width="110" />
                    </el-table>
                </el-tab-pane>
                <el-tab-pane label="来源与用户" name="source">
                    <div class="detail-section-title">租户信息</div>
                    <el-descriptions class="task-detail-descriptions" :column="2" border>
                        <el-descriptions-item label="租户ID">{{
                            detail.tenant_id || '--'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="租户名称">{{
                            detail.tenant_name || '--'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="租户编号" :span="2">{{
                            detail.tenant_sn || '--'
                        }}</el-descriptions-item>
                    </el-descriptions>

                    <div class="detail-section-title mt-4">用户信息</div>
                    <el-descriptions class="task-detail-descriptions" :column="2" border>
                        <el-descriptions-item label="用户ID">{{
                            detail.user_info?.user_id || detail.user_id || '--'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="用户昵称">{{
                            detail.user_info?.nickname || detail.user_nickname || '--'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="账号">{{
                            detail.user_info?.account || detail.user_account || '--'
                        }}</el-descriptions-item>
                        <el-descriptions-item label="手机号">{{
                            detail.user_info?.mobile || detail.user_mobile || '--'
                        }}</el-descriptions-item>
                    </el-descriptions>

                    <div class="detail-section-title mt-4">上游任务信息</div>
                    <el-table :data="detail.upstream_tasks || []" border>
                        <el-table-column label="关系" prop="relation" width="130" />
                        <el-table-column label="应用" prop="app_name" min-width="150" />
                        <el-table-column label="任务ID" prop="task_id" width="100" />
                        <el-table-column label="任务编号" prop="task_sn" min-width="180" />
                    </el-table>
                    <div class="detail-section-title mt-4">操作轨迹</div>
                    <el-table :data="detail.operation_tracks || []" border><el-table-column label="操作单" prop="operation_no" min-width="180" /><el-table-column label="操作" prop="action" width="130" /><el-table-column label="状态" prop="status" width="100" /><el-table-column label="结果" prop="result_message" min-width="240" /></el-table>
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
        <el-dialog v-model="mediaPreviewVisible" title="结果预览" width="860px" top="6vh">
            <div v-if="activeMedia" class="media-preview-dialog">
                <el-image
                    v-if="activeMedia.type === 'image'"
                    class="media-preview-image"
                    :src="activeMedia.url"
                    fit="contain"
                    :preview-src-list="activePreviewImages"
                    :initial-index="activePreviewImageIndex"
                    preview-teleported
                />
                <video
                    v-else
                    class="media-preview-video"
                    :src="activeMedia.url"
                    :poster="activeMedia.thumb_url || undefined"
                    controls
                    autoplay
                />
            </div>
            <div v-if="activeMediaList.length > 1" class="media-preview-strip">
                <div
                    v-for="(item, index) in activeMediaList"
                    :key="`${item.type}-${item.id || index}`"
                    class="media-preview-strip-item"
                    :class="{ active: index === activeMediaIndex }"
                    @click="activeMediaIndex = index"
                >
                    <el-image
                        v-if="item.type === 'image'"
                        class="media-preview-strip-thumb"
                        :src="item.thumb_url || item.url"
                        fit="cover"
                    />
                    <div v-else class="media-preview-strip-thumb media-preview-video-thumb">
                        <video
                            :src="item.url"
                            :poster="item.thumb_url || undefined"
                            muted
                            preload="metadata"
                        />
                        <span>▶</span>
                    </div>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="platformTenantTaskRecord">
import { getPointUnit } from '@/utils/point-unit'

import { aiTaskBatchAction, getAiTaskDetail, getAiTaskLists } from '@/api/consumer'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const queryParams = reactive({
    keyword: '',
    tenant_id: '',
    status: '',
    create_time_start: '',
    create_time_end: ''
})
const detailVisible = ref(false)
const detail = ref<any>({})
const activeDetailTab = ref('basic')
const mediaPreviewVisible = ref(false)
const activeMediaList = ref<any[]>([])
const activeMediaIndex = ref(0)
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
    return 'warning'
}

const statusText = (status: string) => {
    const map: Record<string, string> = {
        pending: '等待中',
        running: '运行中',
        success: '成功',
        partial_success: '部分完成',
        failed: '失败',
        canceled: '已取消'
    }
    return map[status] || status || '--'
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

const mediaResults = (row: any) => {
    return Array.isArray(row?.media_results) ? row.media_results.filter((item: any) => item?.url) : []
}

const imagePreviewUrls = (row: any) => {
    return mediaResults(row)
        .filter((item: any) => item.type === 'image')
        .map((item: any) => item.url)
}

const imagePreviewIndex = (row: any, mediaIndex: number) => {
    const item = mediaResults(row)[mediaIndex]
    if (!item || item.type !== 'image') {
        return 0
    }
    return Math.max(0, imagePreviewUrls(row).findIndex((url: string) => url === item.url))
}

const openMediaPreview = (row: any, index = 0) => {
    const results = mediaResults(row)
    if (!results.length) {
        return
    }
    activeMediaList.value = results
    activeMediaIndex.value = Math.max(0, Math.min(index, results.length - 1))
    mediaPreviewVisible.value = true
}

const activeMedia = computed(() => activeMediaList.value[activeMediaIndex.value] || null)
const activePreviewImages = computed(() =>
    activeMediaList.value.filter((item: any) => item.type === 'image').map((item: any) => item.url)
)
const activePreviewImageIndex = computed(() => {
    if (!activeMedia.value || activeMedia.value.type !== 'image') {
        return 0
    }
    return Math.max(
        0,
        activePreviewImages.value.findIndex((url: string) => url === activeMedia.value.url)
    )
})

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

.result-preview-list {
    display: flex;
    align-items: center;
    gap: 6px;
}

.result-preview-thumb {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    overflow: hidden;
    background: #f5f5f5;
    cursor: pointer;
}

.result-preview-video {
    position: relative;

    video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.result-preview-play {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
    background: rgb(0 0 0 / 28%);
}

.result-preview-more {
    padding: 0;
    font-size: 12px;
}

.media-preview-dialog {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 420px;
    background: #0b0b0b;
    border-radius: 8px;
    overflow: hidden;
}

.media-preview-image,
.media-preview-video {
    max-width: 100%;
    max-height: 68vh;
}

.media-preview-strip {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    overflow-x: auto;
}

.media-preview-strip-item {
    flex: none;
    padding: 2px;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;

    &.active {
        border-color: var(--el-color-primary);
    }
}

.media-preview-strip-thumb {
    width: 56px;
    height: 56px;
    border-radius: 6px;
    overflow: hidden;
    background: #f5f5f5;
}

.media-preview-video-thumb {
    position: relative;

    video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    span {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        background: rgb(0 0 0 / 28%);
    }
}
</style>
