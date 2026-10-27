<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" :model="queryParams">
                <el-form-item label="状态">
                    <el-select v-model="queryParams.status" class="w-[150px]" clearable placeholder="全部">
                        <el-option label="排队中" value="pending" />
                        <el-option label="生成中" value="running" />
                        <el-option label="成功" value="success" />
                        <el-option label="部分失败" value="partial_failed" />
                        <el-option label="失败" value="failed" />
                        <el-option label="已取消" value="canceled" />
                    </el-select>
                </el-form-item>
                <el-form-item label="消除选项">
                    <el-input v-model="queryParams.option_code" class="w-[160px]" clearable placeholder="选项标识" @keyup.enter="getLists" />
                </el-form-item>
                <el-form-item label="用户">
                    <el-input v-model="queryParams.user_keyword" class="w-[220px]" clearable placeholder="昵称/账号/手机号/ID" @keyup.enter="getLists" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="getLists">
                            查询
                        </el-button>
                        <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="loading" :data="lists" size="large">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="源图" width="130">
                    <template #default="{ row }">
                        <div class="thumb-group">
                            <el-image v-for="url in previewSources(row).slice(0, 3)" :key="url" class="task-image" :src="url" fit="cover" :preview-src-list="previewSources(row)" preview-teleported />
                            <span v-if="previewSources(row).length > 3" class="more-count">+{{ previewSources(row).length - 3 }}</span>
                            <span v-if="!previewSources(row).length">-</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="结果" width="130">
                    <template #default="{ row }">
                        <div class="thumb-group">
                            <el-image v-for="url in previewResults(row).slice(0, 3)" :key="url" class="task-image" :src="url" fit="contain" :preview-src-list="previewResults(row)" preview-teleported />
                            <span v-if="previewResults(row).length > 3" class="more-count">+{{ previewResults(row).length - 3 }}</span>
                            <span v-if="!previewResults(row).length">-</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="160">
                    <template #default="{ row }">
                        {{ row.user_nickname || row.user_account || row.user_mobile || row.user_id || '-' }}
                    </template>
                </el-table-column>
                <el-table-column label="消除选项" min-width="180">
                    <template #default="{ row }">{{ (row.option_names || []).join('、') || '-' }}</template>
                </el-table-column>
                <el-table-column label="模型" prop="channel" min-width="120" />
                <el-table-column label="规格" prop="size_label" min-width="160" />
                <el-table-column label="消耗" width="150">
                    <template #default="{ row }">{{ formatPointAmount(row.user_charge_points || 0) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                        <el-tag :type="statusTag(row.status)">{{ row.status_label || row.status }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="创建时间" width="170">
                    <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="230" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            link
                            :loading="isTaskQuerying(row)"
                            @click="handleQuery(row)"
                        >
                            查询
                        </el-button>
                        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
                        <el-button type="primary" link @click="handleRetry(row)">重试</el-button>
                        <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="mt-4 flex justify-end">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-dialog v-model="detailVisible" title="任务详情" width="760px">
            <el-descriptions :column="2" border>
                <el-descriptions-item label="任务ID">{{ detail.id || '-' }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ detail.status_label || detail.status || '-' }}</el-descriptions-item>
                <el-descriptions-item label="规格">{{ detail.size_label || '-' }}</el-descriptions-item>
                <el-descriptions-item label="用户消耗">{{ formatPointAmount(detail.user_charge_points || 0) }}</el-descriptions-item>
                <el-descriptions-item label="租户成本">{{ formatPointAmount(detail.tenant_cost_points || 0) }}</el-descriptions-item>
            </el-descriptions>
            <el-alert v-if="detail.error" class="mt-4" type="error" :title="detail.error" :closable="false" />
            <div class="detail-images mt-4">
                <div>
                    <div class="detail-title">源图</div>
                    <div class="detail-grid"><el-image v-for="url in previewSources(detail)" :key="url" :src="url" fit="contain" :preview-src-list="previewSources(detail)" preview-teleported /></div>
                </div>
                <div>
                    <div class="detail-title">结果</div>
                    <div class="detail-grid"><el-image v-for="url in previewResults(detail)" :key="url" :src="url" fit="contain" :preview-src-list="previewResults(detail)" preview-teleported /></div>
                </div>
            </div>
            <el-input class="mt-4" :model-value="detail.prompt || ''" type="textarea" :rows="5" readonly />
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-one-click-cleanup-task">
import { formatPointAmount } from '@/utils/point-unit'

import {
    deleteAigcOneClickCleanupTask,
    getAigcOneClickCleanupTaskDetail,
    getAigcOneClickCleanupTaskLists,
    retryAigcOneClickCleanupTask
} from '@/apps/aigc_one_click_cleanup/api'
import { useAppTaskManualQuery } from '@/composables/useAppTaskManualQuery'
import feedback from '@/utils/feedback'

const loading = ref(false)
const detailVisible = ref(false)
const lists = ref<any[]>([])
const detail = ref<any>({})
const pager = reactive({ page: 1, size: 15, count: 0 })
const queryParams = reactive({ status: '', option_code: '', user_keyword: '' })

const getLists = async () => {
    loading.value = true
    try {
        const res: any = await getAigcOneClickCleanupTaskLists({
            page_no: pager.page,
            page_size: pager.size,
            ...queryParams
        })
        lists.value = res?.lists || []
        pager.count = Number(res?.count || 0)
    } finally {
        loading.value = false
    }
}

const { handleTaskQuery, isTaskQuerying } = useAppTaskManualQuery(getLists)
const handleQuery = (row: any) => handleTaskQuery(row, getAigcOneClickCleanupTaskDetail)

const resetQuery = () => {
    Object.assign(queryParams, { status: '', option_code: '', user_keyword: '' })
    pager.page = 1
    getLists()
}

const openDetail = async (row: any) => {
    detail.value = await getAigcOneClickCleanupTaskDetail({ id: row.id })
    detailVisible.value = true
}

const handleRetry = async (row: any) => {
    await feedback.confirm('确定重试该任务？')
    await retryAigcOneClickCleanupTask({ id: row.id })
    feedback.msgSuccess('已提交重试')
    getLists()
}

const handleDelete = async (row: any) => {
    await feedback.confirm('确定删除该任务？')
    await deleteAigcOneClickCleanupTask({ id: row.id })
    feedback.msgSuccess('删除成功')
    getLists()
}

const statusTag = (status: string) => {
    if (status === 'success') return 'success'
    if (status === 'failed') return 'danger'
    if (status === 'partial_failed') return 'warning'
    if (status === 'canceled') return 'info'
    return 'warning'
}

const previewSources = (row: any) => Array.isArray(row.source_image_urls) ? row.source_image_urls.filter(Boolean) : (row.source_image_url ? [row.source_image_url] : [])
const previewResults = (row: any) => {
    if (['pending', 'running'].includes(String(row?.status || ''))) {
        return []
    }
    const urls = Array.isArray(row.results)
        ? row.results.map((item: any) => String(item?.image_url || item?.url || '').trim()).filter(Boolean)
        : []
    const fallback = String(row?.image_url || '').trim()
    return urls.length ? urls : (fallback ? [fallback] : [])
}

const formatTime = (value: any) => {
    const num = Number(value || 0)
    if (!num) return '-'
    return new Date(num * 1000).toLocaleString()
}

getLists()
</script>

<style lang="scss" scoped>
.thumb-group { display: flex; align-items: center; gap: 4px; }
.task-image { width: 44px; height: 44px; border-radius: 6px; background: #f5f7fa; }
.more-count { color: var(--el-text-color-secondary); font-size: 12px; }
.detail-images { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.detail-title { margin-bottom: 8px; color: var(--el-text-color-primary); font-weight: 500; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.detail-grid :deep(.el-image) { height: 180px; border-radius: 8px; background: #f5f7fa; }
</style>
