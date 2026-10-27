<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" :model="queryParams">
                <el-form-item label="状态">
                    <el-select v-model="queryParams.status" class="w-[150px]" clearable placeholder="全部">
                        <el-option label="排队中" value="pending" />
                        <el-option label="生成中" value="running" />
                        <el-option label="成功" value="success" />
                        <el-option label="失败" value="failed" />
                        <el-option label="已取消" value="canceled" />
                    </el-select>
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
                <el-table-column label="源图" width="90">
                    <template #default="{ row }">
                        <el-image v-if="row.source_image_url" class="task-image" :src="row.source_image_url" fit="cover" :preview-src-list="[row.source_image_url]" preview-teleported />
                        <span v-else>-</span>
                    </template>
                </el-table-column>
                <el-table-column label="结果" width="90">
                    <template #default="{ row }">
                        <el-image v-if="row.image_url" class="task-image" :src="row.image_url" fit="cover" :preview-src-list="[row.image_url]" preview-teleported />
                        <span v-else>-</span>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="160">
                    <template #default="{ row }">
                        {{ row.user_nickname || row.user_account || row.user_mobile || row.user_id || '-' }}
                    </template>
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
                <el-descriptions-item label="扩图比例">{{ detail.price_package_name || detail.size_label || '-' }}</el-descriptions-item>
                <el-descriptions-item label="用户消耗">{{ formatPointAmount(detail.user_charge_points || 0) }}</el-descriptions-item>
                <el-descriptions-item label="租户成本">{{ formatPointAmount(detail.tenant_cost_points || 0) }}</el-descriptions-item>
            </el-descriptions>
            <el-alert v-if="detail.error" class="mt-4" type="error" :title="detail.error" :closable="false" />
            <div class="detail-images mt-4">
                <el-image v-if="detail.source_image_url" :src="detail.source_image_url" fit="contain" />
                <el-image v-if="detail.image_url" :src="detail.image_url" fit="contain" />
            </div>
            <el-input class="mt-4" :model-value="detail.prompt || ''" type="textarea" :rows="5" readonly />
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-outpaint-task">
import { formatPointAmount } from '@/utils/point-unit'

import {
    deleteAigcOutpaintTask,
    getAigcOutpaintTaskDetail,
    getAigcOutpaintTaskLists,
    retryAigcOutpaintTask
} from '@/apps/aigc_outpaint/api'
import { useAppTaskManualQuery } from '@/composables/useAppTaskManualQuery'
import feedback from '@/utils/feedback'

const loading = ref(false)
const detailVisible = ref(false)
const lists = ref<any[]>([])
const detail = ref<any>({})
const pager = reactive({ page: 1, size: 15, count: 0 })
const queryParams = reactive({ status: '', user_keyword: '' })

const getLists = async () => {
    loading.value = true
    try {
        const res: any = await getAigcOutpaintTaskLists({
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
const handleQuery = (row: any) => handleTaskQuery(row, getAigcOutpaintTaskDetail)

const resetQuery = () => {
    Object.assign(queryParams, { status: '', user_keyword: '' })
    pager.page = 1
    getLists()
}

const openDetail = async (row: any) => {
    detail.value = await getAigcOutpaintTaskDetail({ id: row.id })
    detailVisible.value = true
}

const handleRetry = async (row: any) => {
    await feedback.confirm('确定重试该任务？')
    await retryAigcOutpaintTask({ id: row.id })
    feedback.msgSuccess('已提交重试')
    getLists()
}

const handleDelete = async (row: any) => {
    await feedback.confirm('确定删除该任务？')
    await deleteAigcOutpaintTask({ id: row.id })
    feedback.msgSuccess('删除成功')
    getLists()
}

const statusTag = (status: string) => {
    if (status === 'success') return 'success'
    if (status === 'failed') return 'danger'
    if (status === 'canceled') return 'info'
    return 'warning'
}

const formatTime = (value: any) => {
    const num = Number(value || 0)
    if (!num) return '-'
    return new Date(num * 1000).toLocaleString()
}

getLists()
</script>

<style lang="scss" scoped>
.task-image {
    width: 58px;
    height: 58px;
    border-radius: 6px;
}

.detail-images {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;

    :deep(.el-image) {
        height: 260px;
        border-radius: 8px;
        background: #f5f7fa;
    }
}
</style>
