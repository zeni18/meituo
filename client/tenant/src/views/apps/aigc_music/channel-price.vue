<template>
    <el-card class="!border-none" shadow="never">
        <div class="price-header">
            <div class="price-filter">
                <el-select
                    v-model="activeChannelCode"
                    class="w-[220px]"
                    clearable
                    placeholder="全部通道"
                >
                    <el-option
                        v-for="channel in channels"
                        :key="channel.code"
                        :label="`${channel.name || channel.code}（${channel.specs?.length || 0}）`"
                        :value="channel.code"
                    />
                </el-select>
                <el-switch v-model="showDisabled" active-text="显示停用项" />
            </div>
            <div class="price-actions">
                <el-button @click="fillByRate">按成本倍率填充</el-button>
                <el-input-number
                    v-model="batchRate"
                    :min="0"
                    :precision="2"
                    :step="0.1"
                    controls-position="right"
                />
                <el-button @click="setVisibleStatus(1)">启用当前规格</el-button>
                <el-button @click="setVisibleStatus(0)">停用当前规格</el-button>
                <el-button type="primary" :loading="saving" @click="saveAll">保存改动</el-button>
            </div>
        </div>

        <el-table v-loading="loading" size="large" :data="visibleRows" row-key="key">
            <el-table-column label="通道" min-width="170" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ row.channel.name || row.channel.code }}</div>
                    <div class="text-xs text-tx-secondary">{{ row.channel.code }}</div>
                </template>
            </el-table-column>
            <el-table-column label="规格" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                    <div>{{ specTitle(row.spec) }}</div>
                    <div class="text-xs text-tx-secondary">
                        {{ row.spec.spec_code || row.spec.quality || row.spec.type || '-' }}
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="计费单位" width="120">
                <template #default="{ row }">{{
                    row.spec.billing_unit || row.spec.unit || '次'
                }}</template>
            </el-table-column>
            <el-table-column label="平台成本" width="130">
                <template #default="{ row }">
                    {{ formatPointAmount(formatPoint(row.spec.platform_unit_cost)) }}
                </template>
            </el-table-column>
            <el-table-column label="我的销售价" width="190">
                <template #default="{ row }">
                    <el-input-number
                        v-model="row.spec.tenant_unit_price"
                        :min="0"
                        :precision="2"
                        :step="0.01"
                        controls-position="right"
                        class="!w-full"
                        @change="markDirty(row)"
                    />
                </template>
            </el-table-column>
            <el-table-column label="毛利" width="120">
                <template #default="{ row }">
                    <span :class="marginClass(margin(row.spec))">
                        {{ formatPointAmount(formatPoint(margin(row.spec))) }}
                    </span>
                </template>
            </el-table-column>
            <el-table-column label="规格状态" width="110">
                <template #default="{ row }">
                    <el-switch
                        v-model="row.spec.tenant_status"
                        :active-value="1"
                        :inactive-value="0"
                        @change="markDirty(row)"
                    />
                </template>
            </el-table-column>
            <el-table-column label="通道开关" width="110">
                <template #default="{ row }">
                    <el-switch
                        :model-value="Number(row.channel.tenant_status ?? row.channel.status)"
                        :active-value="1"
                        :inactive-value="0"
                        @change="(status) => handleChannelStatus(row.channel, status)"
                    />
                </template>
            </el-table-column>
            <el-table-column label="排序" width="120">
                <template #default="{ row }">
                    <el-input-number
                        v-model="row.spec.sort"
                        :min="0"
                        controls-position="right"
                        class="!w-full"
                        @change="markDirty(row)"
                    />
                </template>
            </el-table-column>
        </el-table>
        <el-empty v-if="!loading && !visibleRows.length" description="暂无音乐规格" />
    </el-card>
</template>

<script lang="ts" setup name="tenant-aigc-music-channel-price">
import { formatPointAmount } from '@/utils/point-unit'

import {
    batchSaveAigcMusicChannels,
    getAigcMusicChannels,
    setAigcMusicChannelStatus
} from '@/apps/aigc_music/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const showDisabled = ref(false)
const activeChannelCode = ref('')
const batchRate = ref(1)
const channels = ref<any[]>([])
const dirtyKeys = ref<string[]>([])

const visibleRows = computed(() =>
    channels.value
        .filter((channel) => !activeChannelCode.value || channel.code === activeChannelCode.value)
        .filter(
            (channel) => showDisabled.value || Number(channel.tenant_status ?? channel.status) === 1
        )
        .flatMap((channel) =>
            (channel.specs || [])
                .filter(
                    (spec: any) =>
                        showDisabled.value || Number(spec.tenant_status ?? spec.status) === 1
                )
                .map((spec: any) => ({
                    key: specKey(channel, spec),
                    channel,
                    spec
                }))
        )
)

const getLists = async () => {
    loading.value = true
    try {
        channels.value = await getAigcMusicChannels()
    } finally {
        loading.value = false
    }
}
const specKey = (channel: any, spec: any) =>
    [
        channel.code,
        spec.id,
        spec.spec_code,
        spec.quality,
        spec.type,
        spec.duration,
        spec.billing_unit || spec.unit
    ]
        .filter((item) => item !== undefined && item !== null && item !== '')
        .join('|')
const markDirty = (row: any) => {
    if (!dirtyKeys.value.includes(row.key)) {
        dirtyKeys.value = [...dirtyKeys.value, row.key]
    }
}
const dirtyRows = () => {
    const keySet = new Set(dirtyKeys.value)
    return visibleRows.value.filter((row) => keySet.has(row.key))
}
const fillByRate = () => {
    visibleRows.value.forEach((row) => {
        row.spec.tenant_unit_price = toPrice(
            Number(row.spec.platform_unit_cost || 0) * Number(batchRate.value || 0)
        )
        markDirty(row)
    })
}
const setVisibleStatus = (status: number) => {
    visibleRows.value.forEach((row) => {
        row.spec.tenant_status = status
        markDirty(row)
    })
}
const saveAll = async () => {
    const rows = dirtyRows()
    if (!rows.length) {
        feedback.msgWarning('暂无改动需要保存')
        return
    }
    saving.value = true
    try {
        await batchSaveAigcMusicChannels({
            specs: rows.map(({ channel, spec }) => ({
                id: spec.id,
                channel_code: channel.code || spec.channel_code,
                spec_code: spec.spec_code,
                type: spec.type,
                quality: spec.quality,
                duration: spec.duration,
                billing_unit: spec.billing_unit || spec.unit,
                tenant_unit_price: spec.tenant_unit_price,
                status: spec.tenant_status,
                sort: spec.sort
            }))
        })
        feedback.msgSuccess('保存成功')
        dirtyKeys.value = []
        await getLists()
    } finally {
        saving.value = false
    }
}
const handleChannelStatus = async (channel: any, status: any) => {
    await setAigcMusicChannelStatus({ channel_code: channel.code, status })
    getLists()
}
const specTitle = (spec: any) => {
    return (
        spec.name ||
        spec.spec_name ||
        [spec.type, spec.quality, spec.duration ? `${spec.duration}秒` : '']
            .filter(Boolean)
            .join(' / ') ||
        '默认规格'
    )
}
const margin = (spec: any) =>
    Number(spec.tenant_unit_price || 0) - Number(spec.platform_unit_cost || 0)
const toPrice = (value: number) => Math.max(0, Number(value.toFixed(2)))
const formatPoint = (value: any) => {
    const number = Number(value || 0)
    return number.toFixed(2).replace(/\.?0+$/, '') || '0'
}
const marginClass = (value: number) => (value >= 0 ? 'margin-plus' : 'margin-minus')
getLists()
</script>

<style scoped>
.price-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
}

.price-filter,
.price-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

.margin-plus {
    color: var(--el-color-success);
}

.margin-minus {
    color: var(--el-color-danger);
}
</style>
