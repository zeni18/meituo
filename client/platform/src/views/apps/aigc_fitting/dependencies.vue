<template>
    <el-card class="!border-none" shadow="never" v-loading="loading">
        <div class="mb-4">
            <el-alert type="info" show-icon :closable="false" title="AI试衣复用 AIGC生图通道完成生成，不配置独立模型或密钥。" />
        </div>
        <el-table :data="dependencies.items || []" size="large">
            <el-table-column label="依赖应用" prop="name" min-width="160" />
            <el-table-column label="用于" prop="required_for" min-width="160" />
            <el-table-column label="安装启用" width="120">
                <template #default="{ row }">
                    <el-tag :type="row.installed ? 'success' : 'danger'">{{ row.installed ? '已安装' : '未安装' }}</el-tag>
                </template>
            </el-table-column>
            <el-table-column label="通道" width="120">
                <template #default="{ row }">
                    <el-tag :type="row.channel_ready ? 'success' : 'warning'">{{ row.channel_ready ? '可用' : '未配置' }}</el-tag>
                </template>
            </el-table-column>
            <el-table-column label="说明" prop="message" min-width="180" />
        </el-table>
    </el-card>
</template>

<script lang="ts" setup name="platform-aigc-fitting-dependencies">
import { getAigcFittingDependencies } from '@/apps/aigc_fitting/api'

const loading = ref(false)
const dependencies = ref<any>({ items: [] })
const getData = async () => {
    loading.value = true
    try {
        dependencies.value = await getAigcFittingDependencies()
    } finally {
        loading.value = false
    }
}
getData()
</script>
