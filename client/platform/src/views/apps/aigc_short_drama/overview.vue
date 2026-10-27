<template>
    <div>
        <el-card class="!border-none" shadow="never" v-loading="loading">
            <div class="grid grid-cols-3 gap-4">
                <div v-for="item in cards" :key="item.label" class="p-4 bg-page rounded">
                    <div class="text-sm text-tx-secondary">{{ item.label }}</div>
                    <div class="text-2xl font-medium mt-2">{{ item.value }}</div>
                </div>
            </div>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never" v-loading="loading">
            <template #header>{{ TEXT.resources }}</template>
            <el-table :data="dependencies.items || []" size="large">
                <el-table-column :label="TEXT.resource" prop="name" min-width="160" />
                <el-table-column :label="TEXT.purpose" prop="required_for" min-width="220" />
                <el-table-column :label="TEXT.resourceType" width="120">
                    <template #default="{ row }">
                        <el-tag :type="row.resource_type === 'app_api' ? 'success' : (row.installed ? 'success' : 'danger')">{{ row.resource_type_label || (row.installed ? TEXT.application : TEXT.notInstalled) }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column :label="TEXT.channelStatus" width="120">
                    <template #default="{ row }">
                        <el-tag :type="row.channel_ready ? 'success' : 'warning'">{{ row.channel_ready ? TEXT.available : TEXT.notConfigured }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column :label="TEXT.description" prop="message" min-width="220" show-overflow-tooltip />
            </el-table>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="platform-aigc-short-drama-overview">
import { getAigcShortDramaDashboard, getAigcShortDramaDependencies } from '@/apps/aigc_short_drama/api'

const TEXT = {
    resources: '\u8d44\u6e90\u72b6\u6001',
    resource: '\u8d44\u6e90',
    resourceType: '\u8d44\u6e90\u7c7b\u578b',
    application: '\u5e94\u7528',
    purpose: '\u7528\u9014',
    installStatus: '\u5b89\u88c5\u72b6\u6001',
    channelStatus: '\u901a\u9053\u72b6\u6001',
    description: '\u8bf4\u660e',
    installed: '\u5df2\u5b89\u88c5',
    notInstalled: '\u672a\u5b89\u88c5',
    available: '\u53ef\u7528',
    notConfigured: '\u672a\u914d\u7f6e'
}

const loading = ref(false)
const stat = ref<any>({})
const dependencies = ref<any>({ items: [] })
const cards = computed(() => [
    { label: '\u9879\u76ee\u6570', value: stat.value.project_total || 0 },
    { label: '\u5267\u672c\u4efb\u52a1', value: stat.value.script_task_total || 0 },
    { label: '\u5206\u955c\u6570', value: stat.value.storyboard_total || 0 },
    { label: '\u751f\u6210\u4efb\u52a1', value: stat.value.generation_task_total || 0 },
    { label: '\u6210\u529f\u4efb\u52a1', value: stat.value.generation_task_success || 0 },
    { label: '\u5931\u8d25\u4efb\u52a1', value: stat.value.generation_task_failed || 0 }
])

const getData = async () => {
    loading.value = true
    try {
        const [dashboard, dependencyData] = await Promise.all([
            getAigcShortDramaDashboard(),
            getAigcShortDramaDependencies()
        ])
        stat.value = dashboard || {}
        dependencies.value = dependencyData || { items: [] }
    } finally {
        loading.value = false
    }
}

getData()
</script>
