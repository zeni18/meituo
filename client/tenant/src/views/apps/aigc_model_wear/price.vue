<template>
    <div class="model-wear-price-page">
        <el-card class="!border-none price-card" shadow="never">
            <div class="price-header">
                <div class="price-title">
                    <div>模特穿戴价格包</div>
                    <span>租户选择生图模型和分辨率设置单张售价，用户端只选择价格包与比例。</span>
                </div>
                <div class="header-actions">
                    <el-button :disabled="!sourceChannels.length" @click="addPackage">新增价格包</el-button>
                    <el-button :loading="saving" type="primary" @click="saveAll">保存价格包</el-button>
                </div>
            </div>

            <el-alert
                v-if="!loading && !sourceChannels.length"
                title="暂无可用生图模型，请先在 AIGC 生图应用中配置可用通道。"
                type="warning"
                :closable="false"
                class="mb-4"
            />

            <el-table
                v-loading="loading"
                :data="packages"
                border
                size="small"
                row-key="code"
                empty-text="暂无价格包"
            >
                <el-table-column label="价格包名称" min-width="170">
                    <template #default="{ row }">
                        <el-input v-model="row.name" maxlength="80" placeholder="请输入名称" />
                    </template>
                </el-table-column>
                <el-table-column label="生图模型" min-width="190">
                    <template #default="{ row }">
                        <el-select v-model="row.channel" class="!w-full" placeholder="请选择模型" @change="handleChannelChange(row)">
                            <el-option
                                v-for="channel in sourceChannels"
                                :key="channel.code"
                                :label="channel.name"
                                :value="channel.code"
                            />
                        </el-select>
                    </template>
                </el-table-column>
                <el-table-column label="分辨率" min-width="170">
                    <template #default="{ row }">
                        <el-select v-model="row.quality" class="!w-full" placeholder="请选择分辨率" @change="handleQualityChange(row)">
                            <el-option
                                v-for="quality in qualityOptions(row.channel)"
                                :key="quality.value"
                                :label="quality.label"
                                :value="quality.value"
                            />
                        </el-select>
                    </template>
                </el-table-column>
                <el-table-column label="可选比例" min-width="220">
                    <template #default="{ row }">
                        <div class="ratio-tags">
                            <el-tag v-for="ratio in selectedRatios(row)" :key="ratio.value" size="small" effect="plain">
                                {{ ratio.label || ratio.ratio || ratio.value }}
                            </el-tag>
                            <span v-if="!selectedRatios(row).length" class="muted">无可用比例</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="参考成本" width="120">
                    <template #default="{ row }">{{ formatPointAmount(formatPoint(selectedCost(row))) }}</template>
                </el-table-column>
                <el-table-column label="单张售价" width="170">
                    <template #default="{ row }">
                        <el-input-number
                            v-model="row.unit_price"
                            :min="0"
                            :precision="2"
                            :step="0.01"
                            controls-position="right"
                            class="!w-full"
                        />
                    </template>
                </el-table-column>
                <el-table-column label="排序" width="110">
                    <template #default="{ row }">
                        <el-input-number v-model="row.sort" :precision="0" :step="1" controls-position="right" class="!w-full" />
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="90">
                    <template #default="{ row }">
                        <el-switch v-model="row.status" :active-value="1" :inactive-value="0" />
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="90" fixed="right">
                    <template #default="{ $index }">
                        <el-button link type="danger" @click="removePackage($index)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>

            <div class="price-footer">
                <span>默认提供两个价格包；新增方案保存后会同步到 PC 端供用户选择。</span>
            </div>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-model-wear-price">
import { formatPointAmount } from '@/utils/point-unit'

import { getAigcModelWearPrice, setAigcModelWearPrice } from '@/apps/aigc_model_wear/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const sourceChannels = ref<any[]>([])
const packages = ref<any[]>([])

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcModelWearPrice()
        sourceChannels.value = (data?.channels || []).map((channel: any) => ({
            ...channel,
            qualities: channel.qualities || []
        }))
        packages.value = (data?.packages || data?.price_config || []).map((item: any, index: number) => normalizePackage(item, index))
    } finally {
        loading.value = false
    }
}

const addPackage = () => {
    const channel = sourceChannels.value[0]
    const quality = channel?.qualities?.[0]
    packages.value.push(normalizePackage({
        code: `package_${Date.now()}`,
        name: `价格包${packages.value.length + 1}`,
        channel: channel?.code || '',
        quality: quality?.value || '',
        quality_label: quality?.label || '',
        unit_price: selectedCost({ channel: channel?.code || '', quality: quality?.value || '' }),
        status: 1,
        sort: Math.max(0, ...packages.value.map((item) => Number(item.sort || 0))) + 1
    }, packages.value.length))
}

const removePackage = async (index: number) => {
    await feedback.confirm('确定删除该价格包？')
    packages.value.splice(index, 1)
}

const handleChannelChange = (row: any) => {
    const quality = qualityOptions(row.channel)[0]
    row.quality = quality?.value || ''
    row.quality_label = quality?.label || ''
}

const handleQualityChange = (row: any) => {
    row.quality_label = qualityOptions(row.channel).find((item: any) => item.value === row.quality)?.label || ''
}

const saveAll = async () => {
    const payload = packages.value.map((item, index) => normalizePackage(item, index))
    if (!payload.length) {
        feedback.msgError('请至少配置一个价格包')
        return
    }
    const invalid = payload.find((item) => !item.name || !item.channel || !item.quality)
    if (invalid) {
        feedback.msgError('请完善价格包名称、模型和分辨率')
        return
    }
    saving.value = true
    try {
        await setAigcModelWearPrice({ packages: payload })
        feedback.msgSuccess('保存成功')
        await getData()
    } finally {
        saving.value = false
    }
}

const qualityOptions = (channelCode: string) => {
    return sourceChannels.value.find((item) => item.code === channelCode)?.qualities || []
}

const selectedRatios = (row: any) => {
    return qualityOptions(row.channel).find((item: any) => item.value === row.quality)?.ratios || []
}

const selectedCost = (row: any) => {
    const ratios = selectedRatios(row)
    if (!ratios.length) return 0
    return Math.max(...ratios.map((ratio: any) => Number(ratio.platform_unit_cost || 0)))
}

const normalizePackage = (item: any, index: number) => ({
    code: String(item.code || item.package_code || `package_${index + 1}`),
    name: String(item.name || `价格包${index + 1}`),
    channel: String(item.channel || item.channel_code || ''),
    quality: String(item.quality || ''),
    quality_label: String(item.quality_label || ''),
    unit_price: Number(item.unit_price ?? item.tenant_unit_price ?? 0),
    status: Number(item.status ?? item.tenant_status ?? 1),
    sort: Number(item.sort ?? (100 - index))
})

const formatPoint = (value: any) => Number(value || 0).toFixed(2)

getData()
</script>

<style lang="scss" scoped>
.price-card {
    min-height: 520px;
}

.price-header,
.header-actions,
.price-title,
.ratio-tags,
.price-footer {
    display: flex;
    gap: 12px;
}

.price-header {
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
}

.header-actions {
    align-items: center;
    flex-shrink: 0;
}

.price-title {
    min-width: 0;
    flex-direction: column;
    gap: 4px;

    div {
        color: var(--el-text-color-primary);
        font-size: 16px;
        font-weight: 600;
        line-height: 24px;
    }

    span {
        color: var(--el-text-color-secondary);
        font-size: 13px;
        line-height: 20px;
    }
}

.ratio-tags {
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
}

.muted,
.price-footer {
    color: var(--el-text-color-secondary);
}

.price-footer {
    margin-top: 14px;
    font-size: 13px;
    line-height: 20px;
}
</style>
