<template>
    <div class="aigc-table-page">
        <el-alert
            title="历史只读：这里保留旧规格和旧价格用于历史任务诊断；新任务请在算力市场管理 SKU。"
            type="info"
            :closable="false"
            class="mb-4"
        />
        <el-card class="!border-none table-card" shadow="never">
            <el-table v-loading="loading" :data="rows" height="100%" size="large">
                <el-table-column label="通道" prop="channel_name" min-width="150" />
                <el-table-column label="规格" min-width="180">
                    <template #default="{ row }">{{ row.quality_label || row.quality || '-' }}</template>
                </el-table-column>
                <el-table-column label="比例" prop="ratio" min-width="100" />
                <el-table-column label="历史上游成本" min-width="150">
                    <template #default="{ row }">{{ formatPoint(row.upstream_unit_cost) }}</template>
                </el-table-column>
                <el-table-column label="历史平台供给价" min-width="160">
                    <template #default="{ row }">{{ formatPoint(row.platform_unit_cost) }}</template>
                </el-table-column>
                <el-table-column label="原状态" min-width="100">
                    <template #default="{ row }">
                        <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'">{{ Number(row.status) === 1 ? '启用' : '停用' }}</el-tag>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="platform-aigc-video-spec">
import { getAigcVideoSpecs } from '@/apps/aigc_video/api'
import { formatPointAmount, getPointUnit } from '@/utils/point-unit'

const loading = ref(false)
const rows = ref<any[]>([])

const formatPoint = (value: unknown) => `${formatPointAmount(Number(value || 0))} ${getPointUnit()}`

const getLists = async () => {
    loading.value = true
    try {
        const channels = await getAigcVideoSpecs()
        rows.value = (channels || []).flatMap((channel: any) => (channel.specs || []).map((spec: any) => ({
            ...spec,
            channel_name: channel.name || channel.code || '-'
        })))
    } finally {
        loading.value = false
    }
}

getLists()
</script>

<style scoped>
.aigc-table-page { height: calc(100vh - 118px); }
.table-card { height: calc(100% - 52px); }
:deep(.el-card__body) { height: 100%; padding: 0; }
</style>
