<template>
    <div v-loading="loading">
        <app-display-config v-model="displayConfig" />
        <el-card class="!border-none" shadow="never">
            <el-form label-width="130px" :model="formData">
                <el-form-item label="状态">
                    <el-radio-group v-model="formData.status">
                        <el-radio :value="1">启用</el-radio>
                        <el-radio :value="0">停用</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="默认模型">
                    <el-select v-model="formData.config_json.channel" class="config-select config-select--channel" clearable placeholder="跟随AIGC生视频默认通道" @change="syncDefaultSpec">
                        <el-option v-for="channel in channels" :key="channel.code" :label="channel.name" :value="channel.code" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认规格">
                    <el-select v-model="formData.config_json.quality" class="config-select" clearable placeholder="跟随模型默认规格" @change="syncDefaultRatio">
                        <el-option v-for="quality in qualityOptions" :key="quality.value" :label="quality.label" :value="quality.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认比例">
                    <el-select v-model="formData.config_json.ratio" class="config-select" clearable placeholder="跟随模型默认比例" @change="syncDefaultDuration">
                        <el-option v-for="ratio in ratioOptions" :key="ratio.value" :label="ratio.label" :value="ratio.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认时长">
                    <el-input class="config-select" :model-value="defaultDurationLabel" disabled />
                    <span class="form-tips ml-3">时长由视频模型决定，PC 用户按模型支持范围选择</span>
                </el-form-item>
                <el-form-item label="生成售价">
                    <el-input-number v-model="formData.unit_price" :min="0" :precision="2" :step="0.01" controls-position="right" @change="priceTouched = true" />
                    <span class="price-unit">{{ getPointUnit() }}/秒</span>
                    <span class="form-tips ml-3">默认按当前模型基础定价折算，租户可单独调整</span>
                </el-form-item>
                <el-form-item label="视频类型">
                    <el-button type="primary" plain @click="goTypeConfig">去配置视频类型</el-button>
                </el-form-item>
                <el-form-item label="提示词模板">
                    <el-input v-model="formData.prompt_template" type="textarea" :rows="7" maxlength="1800" show-word-limit placeholder="可使用 {type_name}、{type_prompt}、{user_prompt} 占位符" />
                </el-form-item>
                <el-form-item label="负向提示词">
                    <el-input v-model="formData.negative_prompt" type="textarea" :rows="4" maxlength="1000" show-word-limit />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-product-promo-video-config">
import { getPointUnit } from '@/utils/point-unit'

import { getAigcProductPromoVideoConfig, setAigcProductPromoVideoConfig } from '@/apps/aigc_product_promo_video/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'
import { withTenantQuery } from '@/utils/tenant'

const loading = ref(false)
const saving = ref(false)
const router = useRouter()
const optionConfig = ref<any>({})
const displayConfig = ref<Record<string, any>>({})
const priceTouched = ref(false)
const formData = reactive({
    status: 1,
    unit_price: 0,
    prompt_template: '',
    negative_prompt: '',
    config_json: {
        channel: undefined as string | undefined,
        quality: undefined as string | undefined,
        ratio: undefined as string | undefined,
        duration: undefined as number | undefined
    }
})

const channels = computed(() => optionConfig.value?.channels || [])
const activeChannel = computed(() => channels.value.find((item: any) => item.code === formData.config_json.channel) || channels.value[0] || {})
const qualityOptions = computed(() => (activeChannel.value?.qualities || []).map((item: any) => ({ label: item.label || item.quality_label || item.value, value: item.value })))
const activeQuality = computed(() => (activeChannel.value?.qualities || []).find((item: any) => item.value === formData.config_json.quality) || (activeChannel.value?.qualities || [])[0] || {})
const ratioOptions = computed(() => {
    const map = new Map<string, any>()
    ;(activeQuality.value?.ratios || []).forEach((item: any) => {
        const value = item.ratio || item.value
        if (value && !map.has(value)) map.set(value, { label: ratioDisplayLabel(value, item.ratio_label || item.label), value })
    })
    return Array.from(map.values())
})
const durationOptions = computed(() => (activeQuality.value?.ratios || [])
    .filter((item: any) => !formData.config_json.ratio || item.ratio === formData.config_json.ratio || item.value === formData.config_json.ratio)
    .flatMap((item: any) => (activeChannel.value?.duration_options?.length ? activeChannel.value.duration_options : [item.duration || activeQuality.value?.duration || 0]))
    .map((item: any) => Number(item || 0))
    .filter(Boolean)
    .filter((item: number, index: number, arr: number[]) => arr.indexOf(item) === index)
    .sort((a: number, b: number) => a - b)
    .map((value: number) => ({ label: `${value}秒`, value })))
const defaultDurationLabel = computed(() => durationOptions.value.length ? `跟随模型默认时长（${durationOptions.value.map((item: any) => item.label).join(' / ')}）` : '跟随模型默认时长')
const selectedBaseUnitPrice = computed(() => {
    const ratios = activeQuality.value?.ratios || []
    const selected = ratios.find((item: any) => {
        const value = item.ratio || item.value
        return !formData.config_json.ratio || value === formData.config_json.ratio
    }) || ratios[0] || {}
    const duration = Number(durationOptions.value[0]?.value || selected.duration || activeQuality.value?.duration || 1) || 1
    const price = Number(selected.base_unit_price ?? selected.tenant_unit_price ?? selected.user_price ?? 0)
    if (Number(selected.base_unit_price ?? 0) > 0) {
        return Number(selected.base_unit_price)
    }
    if (isSecondBillingChannel(activeChannel.value?.code)) {
        return Number(price.toFixed(2))
    }
    return Number((price / Math.max(1, duration)).toFixed(2))
})

const isSecondBillingChannel = (channelCode: string) => ['happy_horse', 'wan', 'seedance2_pro'].includes(String(channelCode || ''))

const syncUnitPriceFromBase = (force = false) => {
    if (!force && priceTouched.value) return
    if (selectedBaseUnitPrice.value > 0) {
        formData.unit_price = selectedBaseUnitPrice.value
    }
}

const syncDefaultSpec = () => {
    if (!qualityOptions.value.some((item: any) => item.value === formData.config_json.quality)) {
        formData.config_json.quality = qualityOptions.value[0]?.value
    }
    priceTouched.value = false
    syncDefaultRatio()
}
const syncDefaultRatio = () => {
    if (!ratioOptions.value.some((item: any) => item.value === formData.config_json.ratio)) {
        formData.config_json.ratio = ratioOptions.value[0]?.value
    }
    priceTouched.value = false
    syncDefaultDuration()
}
const syncDefaultDuration = () => {
    formData.config_json.duration = undefined
    syncUnitPriceFromBase()
}

const ratioDisplayLabel = (value: any, label?: any) => {
    const ratioValue = String(value || '').trim()
    const ratioLabel = String(label || '').trim()
    if (ratioValue === 'adaptive') return '自适应'
    if (ratioLabel === 'adaptive') return '自适应'
    if (ratioLabel && !/[�鑷妯榛绉锛]/.test(ratioLabel)) return ratioLabel
    return ratioValue
}

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcProductPromoVideoConfig()
        optionConfig.value = data?.option_config || {}
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            unit_price: Number(data?.unit_price ?? 0),
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            config_json: {
                channel: data?.default_channel || data?.config_json?.channel || undefined,
                quality: data?.default_quality || data?.config_json?.quality || undefined,
                ratio: data?.default_ratio || data?.config_json?.ratio || undefined,
                duration: undefined
            }
        })
        priceTouched.value = Number(data?.unit_price ?? 0) > 0
        syncDefaultSpec()
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const goTypeConfig = () => router.push(withTenantQuery('/aigc-product-promo-video/type'))

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcProductPromoVideoConfig({
            status: formData.status,
            default_channel: formData.config_json.channel,
            default_quality: formData.config_json.quality,
            default_ratio: formData.config_json.ratio,
            default_duration: 0,
            unit_price: formData.unit_price,
            prompt_template: formData.prompt_template,
            negative_prompt: formData.negative_prompt,
            config_json: formData.config_json,
            display_config: displayConfig.value
        })
        feedback.msgSuccess('保存成功')
        await getData()
    } finally {
        saving.value = false
    }
}

getData()
</script>

<style lang="scss" scoped>
.config-select { width: 240px; }
.config-select--channel { width: 360px; }
.form-tips { color: var(--el-text-color-secondary); font-size: 13px; }
.price-unit { margin-left: 8px; color: var(--el-text-color-regular); }
</style>
