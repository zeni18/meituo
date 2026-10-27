<template>
    <div class="aigc-table-page">
        <el-alert
            title="历史只读：新视频任务的售价和上下架请在租户算力市场的 SKU 中配置。"
            type="info"
            :closable="false"
            class="mb-4"
        />
        <el-card class="!border-none table-card" shadow="never">
            <el-table v-loading="loading" :data="rows" height="100%" size="large">
                <el-table-column label="通道" prop="channel_name" min-width="150" />
                <el-table-column label="规格" min-width="170">
                    <template #default="{ row }">{{ row.quality_label || row.quality || '-' }}</template>
                </el-table-column>
                <el-table-column label="比例" prop="ratio" min-width="100" />
                <el-table-column label="历史平台成本" min-width="150">
                    <template #default="{ row }">{{ formatPoint(row.platform_unit_cost) }}</template>
                </el-table-column>
                <el-table-column label="历史销售价" min-width="150">
                    <template #default="{ row }">{{ formatPoint(row.tenant_unit_price) }}</template>
                </el-table-column>
                <el-table-column label="原状态" min-width="100">
                    <template #default="{ row }">
                        <el-tag :type="Number(row.tenant_status) === 1 ? 'success' : 'info'">{{ Number(row.tenant_status) === 1 ? '启用' : '停用' }}</el-tag>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-video-channel-price">
import { getAigcVideoChannels } from '@/apps/aigc_video/api'
import { formatPointAmount, getPointUnit } from '@/utils/point-unit'

const loading = ref(false)
const rows = ref<any[]>([])

const formatPoint = (value: unknown) => `${formatPointAmount(Number(value || 0))} ${getPointUnit()}`

const getLists = async () => {
    loading.value = true
    try {
        const channels = await getAigcVideoChannels()
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
