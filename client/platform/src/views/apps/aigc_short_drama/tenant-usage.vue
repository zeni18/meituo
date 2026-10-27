<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" class="mb-[-16px]">
                <el-form-item :label="TEXT.tenantId">
                    <el-input v-model="tenantId" class="w-[180px]" :placeholder="TEXT.tenantPlaceholder" clearable />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="handleSearch">{{ TEXT.search }}</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never" v-loading="loading">
            <div class="grid grid-cols-3 gap-4 mb-4">
                <div v-for="item in cards" :key="item.label" class="p-4 bg-page rounded">
                    <div class="text-sm text-tx-secondary">{{ item.label }}</div>
                    <div class="text-2xl font-medium mt-2">{{ item.value }}</div>
                </div>
            </div>
            <el-table :data="tableLists" size="large">
                <el-table-column :label="TEXT.tenantId" prop="tenant_id" width="100" />
                <el-table-column :label="TEXT.tenantName" prop="tenant_name" min-width="150" show-overflow-tooltip />
                <el-table-column :label="TEXT.tenantSn" prop="tenant_sn" min-width="130" show-overflow-tooltip />
                <el-table-column :label="TEXT.projects" prop="project_total" width="105" />
                <el-table-column :label="TEXT.scripts" prop="script_task_total" width="105" />
                <el-table-column :label="TEXT.storyboards" prop="storyboard_total" width="100" />
                <el-table-column :label="TEXT.generations" prop="generation_task_total" width="105" />
                <el-table-column :label="TEXT.success" prop="generation_task_success" width="100" />
                <el-table-column :label="TEXT.failed" prop="generation_task_failed" width="100" />
                <el-table-column :label="TEXT.latestActivity" min-width="180">
                    <template #default="{ row }">{{ formatTime(row.last_activity_time) }}</template>
                </el-table-column>
            </el-table>
            <pagination v-model="pager" @change="getData" />
        </el-card>
    </div>
</template>

<script lang="ts" setup name="platform-aigc-short-drama-tenant-usage">
import { getAigcShortDramaTenantLists, getAigcShortDramaTenantStat } from '@/apps/aigc_short_drama/api'
import { useLocalPaging } from '@/hooks/useLocalPaging'

const TEXT = {
    tenantId: '\u79df\u6237 ID',
    tenantPlaceholder: '\u7559\u7a7a\u67e5\u770b\u5168\u90e8',
    search: '\u67e5\u8be2',
    tenantName: '\u79df\u6237\u540d\u79f0',
    tenantSn: '\u79df\u6237\u7f16\u53f7',
    projects: '\u9879\u76ee\u6570',
    scripts: '\u5267\u672c\u4efb\u52a1',
    storyboards: '\u5206\u955c\u6570',
    generations: '\u751f\u6210\u4efb\u52a1',
    success: '\u6210\u529f\u4efb\u52a1',
    failed: '\u5931\u8d25\u4efb\u52a1',
    latestActivity: '\u6700\u8fd1\u6d3b\u52a8'
}

const loading = ref(false)
const tenantId = ref('')
const stat = ref<any>({})
const { pager, tableLists, setLists, getPagingParams, resetPage } = useLocalPaging({ size: 15 })
const cards = computed(() => [
    { label: TEXT.projects, value: stat.value.project_total || 0 },
    { label: TEXT.scripts, value: stat.value.script_task_total || 0 },
    { label: TEXT.storyboards, value: stat.value.storyboard_total || 0 },
    { label: TEXT.generations, value: stat.value.generation_task_total || 0 },
    { label: TEXT.success, value: stat.value.generation_task_success || 0 },
    { label: TEXT.failed, value: stat.value.generation_task_failed || 0 }
])
const formatTime = (value: number) => (value ? new Date(value * 1000).toLocaleString() : '-')

const getData = async () => {
    loading.value = true
    pager.loading = true
    try {
        const params = { tenant_id: tenantId.value || 0, ...getPagingParams() }
        const [summary, data] = await Promise.all([
            getAigcShortDramaTenantStat(params),
            getAigcShortDramaTenantLists(params)
        ])
        stat.value = summary || {}
        setLists(data)
    } finally {
        loading.value = false
        pager.loading = false
    }
}

const handleSearch = () => {
    resetPage()
    getData()
}

getData()
</script>
