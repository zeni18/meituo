<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                <el-form-item label="用户搜索">
                    <el-input
                        v-model="queryParams.user_keyword"
                        class="w-[240px]"
                        placeholder="用户ID/昵称/账号/手机号"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="状态">
                    <el-select v-model="queryParams.status" class="task-select" @change="resetPage">
                        <el-option label="全部" value="all" />
                        <el-option label="生成中" value="running" />
                        <el-option label="已完成" value="success" />
                        <el-option label="已失败" value="failed" />
                        <el-option label="已取消" value="canceled" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">
                            查询
                        </el-button>
                        <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="结果图" width="190">
                    <template #default="{ row }">
                        <div v-if="row.results?.length" class="image-stack">
                            <el-image
                                v-for="item in row.results.slice(0, 4)"
                                :key="item.id || item.image_url"
                                class="task-image"
                                :src="item.image_url"
                                fit="cover"
                                :preview-src-list="resultPreviewUrls(row)"
                                preview-teleported
                            />
                        </div>
                        <span v-else-if="row.status === 'failed'" class="text-tx-secondary">生成失败</span>
                        <span v-else class="text-tx-secondary">生成中</span>
                    </template>
                </el-table-column>
                <el-table-column label="参考图" width="190">
                    <template #default="{ row }">
                        <div v-if="referencePreviewUrls(row).length" class="image-stack">
                            <el-image
                                v-for="image in referencePreviewUrls(row).slice(0, 4)"
                                :key="image"
                                class="task-image"
                                :src="image"
                                fit="cover"
                                :preview-src-list="referencePreviewUrls(row)"
                                preview-teleported
                            />
                        </div>
                        <span v-else class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>{{ row.user_nickname || row.user_account || `用户#${row.user_id}` }}</div>
                        <div class="text-xs text-tx-secondary">{{ row.user_mobile || `ID: ${row.user_id}` }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="操作类型" width="120">
                    <template #default="{ row }">{{ row.operation_label || '-' }}</template>
                </el-table-column>
                <el-table-column label="模型规格" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        {{ row.channel || '-' }} / {{ row.quality || '-' }} / {{ row.ratio || '-' }}
                    </template>
                </el-table-column>
                <el-table-column label="数量" prop="quantity" width="80" />
                <el-table-column label="租户成本" prop="tenant_cost_points" width="110" />
                <el-table-column label="用户消费" prop="user_charge_points" width="110" />
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="错误" prop="error" min-width="180" show-overflow-tooltip />
                <el-table-column label="创建时间" width="170">
                    <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="220" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            link
                            :loading="isTaskQuerying(row)"
                            @click="handleQuery(row)"
                        >
                            查询
                        </el-button>
                        <el-button type="primary" link @click="handleRetry(row.id)">重试</el-button>
                        <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-hairstyle-task">
import {
    deleteAigcHairstyleTask,
    getAigcHairstyleTaskLists,
    retryAigcHairstyleTask,
    getAigcHairstyleTaskDetail
} from '@/apps/aigc_hairstyle/api'
import { usePaging } from '@/hooks/usePaging'
import { useAppTaskManualQuery } from '@/composables/useAppTaskManualQuery'
import feedback from '@/utils/feedback'

const queryParams = reactive({
    user_keyword: '',
    status: 'all'
})

const { pager, getLists, resetPage } = usePaging({
    fetchFun: (params: any) =>
        getAigcHairstyleTaskLists({
            ...params,
            status: params.status === 'all' ? '' : params.status
        }),
    params: queryParams
})

const { handleTaskQuery, isTaskQuerying } = useAppTaskManualQuery(getLists)
const handleQuery = (row: any) => handleTaskQuery(row, getAigcHairstyleTaskDetail)

const resetQuery = () => {
    Object.assign(queryParams, {
        user_keyword: '',
        status: 'all'
    })
    resetPage()
}

const statusText = (status: string) => {
    const map: Record<string, string> = {
        pending: '排队中',
        running: '生成中',
        success: '已完成',
        failed: '已失败',
        canceled: '已取消'
    }
    return map[status] || status || '-'
}

const statusTagType = (status: string) => {
    const map: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
        pending: 'info',
        running: 'warning',
        success: 'success',
        failed: 'danger',
        canceled: 'info'
    }
    return map[status] || 'info'
}

const formatTime = (time: number | string) => {
    const value = Number(time || 0)
    return value > 0 ? new Date(value * 1000).toLocaleString() : '-'
}

const resultPreviewUrls = (row: any) =>
    (Array.isArray(row?.results) ? row.results : [])
        .map((item: any) => item.image_url)
        .filter(Boolean)

const referencePreviewUrls = (row: any) => {
    const values = Array.isArray(row?.reference_image_urls)
        ? row.reference_image_urls
        : Array.isArray(row?.reference_images)
          ? row.reference_images
          : []
    return values.filter(Boolean)
}

const handleRetry = async (id: number) => {
    await feedback.confirm('确定重试该任务？')
    await retryAigcHairstyleTask({ id })
    feedback.msgSuccess('已提交重试')
    getLists()
}

const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该任务？')
    await deleteAigcHairstyleTask({ id })
    feedback.msgSuccess('已删除')
    getLists()
}

getLists()
</script>

<style lang="scss" scoped>
.task-select {
    width: 150px;
}

.image-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.task-image {
    width: 72px;
    height: 72px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
}
</style>
