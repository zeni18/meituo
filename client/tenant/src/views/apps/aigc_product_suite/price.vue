<template>
    <div class="one-click-price-page">
        <el-card class="!border-none" shadow="never">
            <el-form v-loading="loading" label-width="130px" :model="formData">
                <el-alert title="AI商品套图按选择模块数量计费，用户消耗 = 每张模块图售价 × 选择模块数。" type="info" :closable="false" class="mb-4" />
                <el-form-item label="默认模型">
                    <el-select v-model="formData.default_channel" class="config-select config-select--channel" placeholder="请选择模型" @change="syncDefaultSpec">
                        <el-option v-for="channel in channels" :key="channel.code" :label="channel.name" :value="channel.code" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认清晰度">
                    <el-select v-model="formData.default_quality" class="config-select" placeholder="请选择清晰度" @change="syncDefaultRatio">
                        <el-option v-for="quality in qualityOptions" :key="quality.value" :label="quality.label" :value="quality.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认比例">
                    <el-select v-model="formData.default_ratio" class="config-select" placeholder="请选择比例">
                        <el-option v-for="ratio in ratioOptions" :key="ratio.value" :label="ratio.label" :value="ratio.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="参考成本">
                    <span>{{ formatPointRate(formatPoint(selectedCost), '模块') }}</span>
                </el-form-item>
                <el-form-item label="用户售价">
                    <el-input-number v-model="formData.unit_price" :min="0" :precision="2" :step="0.01" controls-position="right" />
                    <span class="form-tip">{{ formatPointRate('', '模块').trim() }}</span>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="saveAll">保存价格</el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-product-suite-price">
import { formatPointRate } from '@/utils/point-unit'

import { getAigcProductSuitePrice, setAigcProductSuitePrice } from '@/apps/aigc_product_suite/api'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const channels = ref<any[]>([])
const formData = reactive({ default_channel: '', default_quality: '', default_ratio: '', unit_price: 0 })

const activeChannel = computed(() => channels.value.find((item) => item.code === formData.default_channel) || channels.value[0] || {})
const qualityOptions = computed(() => activeChannel.value?.qualities || [])
const activeQuality = computed(() => qualityOptions.value.find((item: any) => item.value === formData.default_quality) || qualityOptions.value[0] || {})
const ratioOptions = computed(() => activeQuality.value?.ratios || [])
const selectedRatio = computed(() => ratioOptions.value.find((item: any) => (item.value || item.ratio) === formData.default_ratio) || ratioOptions.value[0] || {})
const selectedCost = computed(() => Number(selectedRatio.value?.platform_unit_cost || 0))

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcProductSuitePrice()
        channels.value = data?.channels || []
        formData.default_channel = data?.default_channel || channels.value[0]?.code || ''
        syncDefaultSpec(false)
        formData.default_quality = data?.default_quality || formData.default_quality
        syncDefaultRatio(false)
        formData.default_ratio = data?.default_ratio || formData.default_ratio
        formData.unit_price = Number(data?.unit_price || 0)
    } finally {
        loading.value = false
    }
}

const syncDefaultSpec = (reset = true) => {
    if (reset || !qualityOptions.value.some((item: any) => item.value === formData.default_quality)) {
        formData.default_quality = qualityOptions.value[0]?.value || ''
    }
    syncDefaultRatio(reset)
}

const syncDefaultRatio = (reset = true) => {
    if (reset || !ratioOptions.value.some((item: any) => (item.value || item.ratio) === formData.default_ratio)) {
        formData.default_ratio = ratioOptions.value[0]?.value || ratioOptions.value[0]?.ratio || ''
    }
}

const saveAll = async () => {
    if (!formData.default_channel || !formData.default_quality || !formData.default_ratio) {
        feedback.msgError('请选择模型、清晰度和比例')
        return
    }
    saving.value = true
    try {
        await setAigcProductSuitePrice(formData)
        feedback.msgSuccess('保存成功')
        await getData()
    } finally {
        saving.value = false
    }
}

const formatPoint = (value: any) => Number(value || 0).toFixed(2)

getData()
</script>

<style lang="scss" scoped>
.config-select { width: 240px; }
.config-select--channel { width: 360px; }
.form-tip { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
</style>
