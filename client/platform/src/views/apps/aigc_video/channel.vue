<template>
    <div class="aigc-table-page">
        <el-alert
            title="历史只读：新视频任务已使用算力市场商品和 SKU，请在算力市场管理上架与价格。"
            type="info"
            :closable="false"
            class="mb-4"
        />
        <el-card class="!border-none table-card" shadow="never">
            <el-table v-loading="loading" size="large" :data="channels" height="100%">
                <el-table-column label="编码" prop="code" min-width="150" />
                <el-table-column label="名称" prop="name" min-width="160" />
                <el-table-column label="供应商" prop="provider" min-width="130" />
                <el-table-column label="历史模型" prop="model" min-width="180" />
                <el-table-column label="历史规格数" min-width="120">
                    <template #default="{ row }">{{ row.specs?.length || 0 }}</template>
                </el-table-column>
                <el-table-column label="原状态" min-width="100">
                    <template #default="{ row }">
                        <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'">
                            {{ Number(row.status) === 1 ? '启用' : '停用' }}
                        </el-tag>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="platform-aigc-video-channel">
import { getAigcVideoChannels } from '@/apps/aigc_video/api'

const loading = ref(false)
const channels = ref<any[]>([])

const getLists = async () => {
    loading.value = true
    try {
        channels.value = await getAigcVideoChannels()
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
