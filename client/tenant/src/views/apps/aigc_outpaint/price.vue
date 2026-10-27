<template>
    <div class="outpaint-price-page">
        <el-card class="!border-none price-card" shadow="never">
            <div class="price-header">
                <div class="price-title">
                    <div>无缝扩图规格价格</div>
                    <span>每个规格绑定生图模型、分辨率和比例；PC 用户只看到启用的比例卡片。</span>
                </div>
                <div class="header-actions">
                    <el-button :disabled="!sourceChannels.length" @click="addPackage">新增规格</el-button>
                    <el-button :loading="saving" type="primary" @click="saveAll">保存规格</el-button>
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
                empty-text="暂无扩图比例"
            >
                <el-table-column label="规格名称" min-width="150">
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
                <el-table-column label="比例" min-width="150">
                    <template #default="{ row }">
                        <el-select v-model="row.ratio" class="!w-full" placeholder="请选择比例" @change="handleRatioChange(row)">
                            <el-option
                                v-for="ratio in ratioOptions(row)"
                                :key="ratio.value"
                                :label="ratio.label || ratio.ratio || ratio.value"
                                :value="ratio.value"
                            />
                        </el-select>
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
                <span>同一比例建议只启用一个规格，避免 PC 端比例选择歧义。</span>
            </div>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-outpaint-price">
import { formatPointAmount } from '@/utils/point-unit'

import { getAigcOutpaintPrice, setAigcOutpaintPrice } from '@/apps/aigc_outpaint/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const sourceChannels = ref<any[]>([])
const packages = ref<any[]>([])

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcOutpaintPrice()
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
    const ratio = quality?.ratios?.[0]
    packages.value.push(normalizePackage({
        code: `spec_${Date.now()}`,
        name: ratio?.label || ratio?.ratio || `扩图比例${packages.value.length + 1}`,
        channel: channel?.code || '',
        quality: quality?.value || '',
        quality_label: quality?.label || '',
        ratio: ratio?.value || ratio?.ratio || '',
        ratio_label: ratio?.label || ratio?.ratio || ratio?.value || '',
        unit_price: Number(ratio?.platform_unit_cost || 0),
        status: 1,
        sort: Math.max(0, ...packages.value.map((item) => Number(item.sort || 0))) + 1
    }, packages.value.length))
}

const removePackage = async (index: number) => {
    await feedback.confirm('确定删除该扩图比例？')
    packages.value.splice(index, 1)
}

const handleChannelChange = (row: any) => {
    const quality = qualityOptions(row.channel)[0]
    row.quality = quality?.value || ''
    row.quality_label = quality?.label || ''
    handleQualityChange(row)
}

const handleQualityChange = (row: any) => {
    row.quality_label = qualityOptions(row.channel).find((item: any) => item.value === row.quality)?.label || ''
    const ratio = ratioOptions(row)[0]
    row.ratio = ratio?.value || ''
    row.ratio_label = ratio?.label || ''
    row.unit_price = Number(ratio?.platform_unit_cost || row.unit_price || 0)
}

const handleRatioChange = (row: any) => {
    const ratio = ratioOptions(row).find((item: any) => item.value === row.ratio)
    row.ratio_label = ratio?.label || ratio?.ratio || ratio?.value || ''
    if (Number(row.unit_price || 0) <= 0 && ratio) {
        row.unit_price = Number(ratio.platform_unit_cost || 0)
    }
}

const saveAll = async () => {
    const payload = packages.value.map((item, index) => normalizePackage(item, index))
    if (!payload.length) {
        feedback.msgError('请至少配置一个扩图比例')
        return
    }
    const invalid = payload.find((item) => !item.name || !item.channel || !item.quality || !item.ratio)
    if (invalid) {
        feedback.msgError('请完善规格名称、模型、分辨率和比例')
        return
    }
    saving.value = true
    try {
        await setAigcOutpaintPrice({ packages: payload })
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

const ratioOptions = (row: any) => selectedRatios(row).map((item: any) => ({
    ...item,
    value: String(item.value || item.ratio || ''),
    label: String(item.label || item.ratio || item.value || '')
})).filter((item: any) => item.value)

const selectedCost = (row: any) => {
    const ratio = ratioOptions(row).find((item: any) => item.value === row.ratio) || ratioOptions(row)[0]
    return Number(ratio?.platform_unit_cost || 0)
}

const normalizePackage = (item: any, index: number) => ({
    code: String(item.code || item.package_code || `spec_${index + 1}`),
    name: String(item.name || `扩图比例${index + 1}`),
    channel: String(item.channel || item.channel_code || ''),
    quality: String(item.quality || ''),
    quality_label: String(item.quality_label || ''),
    ratio: String(item.ratio || item.ratio_code || ''),
    ratio_label: String(item.ratio_label || item.ratio || ''),
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
