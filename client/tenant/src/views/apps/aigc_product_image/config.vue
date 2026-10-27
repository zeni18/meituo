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
                    <el-select v-model="formData.config_json.channel" class="config-select config-select--channel" clearable placeholder="跟随AIGC生图默认通道" @change="syncDefaultSpec">
                        <el-option v-for="channel in channels" :key="channel.code" :label="channel.name" :value="channel.code" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认清晰度">
                    <el-select v-model="formData.config_json.quality" class="config-select" clearable placeholder="跟随模型默认清晰度" @change="syncDefaultRatio">
                        <el-option v-for="quality in qualityOptions" :key="quality.value" :label="quality.label" :value="quality.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认比例">
                    <el-select v-model="formData.config_json.ratio" class="config-select" clearable placeholder="自动匹配尺寸比例">
                        <el-option v-for="ratio in ratioOptions" :key="ratio.value" :label="ratio.label" :value="ratio.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认尺寸">
                    <el-select v-model="formData.default_size_key" class="config-select config-select--channel">
                        <el-option v-for="item in sizeOptions" :key="item.key" :label="item.label" :value="item.key" />
                    </el-select>
                </el-form-item>
                <el-form-item label="单张售价">
                    <div class="price-row">
                        <el-input-number v-model="formData.config_json.unit_price" :min="0" :precision="2" :step="1" controls-position="right" />
                        <span>{{ formatPointRate('', '张').trim() }}</span>
                    </div>
                </el-form-item>
                <el-form-item label="提示词模板">
                    <el-input v-model="formData.prompt_template" type="textarea" :rows="7" maxlength="1500" show-word-limit placeholder="支持变量：{scene_label}、{width}、{height}、{user_prompt}、{template_prompt}" />
                </el-form-item>
                <el-form-item label="负向提示词">
                    <el-input v-model="formData.negative_prompt" type="textarea" :rows="4" maxlength="800" show-word-limit />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-product-image-config">
import { getAigcProductImageConfig, setAigcProductImageConfig } from '@/apps/aigc_product_image/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'
import { formatPointRate } from '@/utils/point-unit'

const loading = ref(false)
const saving = ref(false)
const optionConfig = ref<any>({})
const displayConfig = ref<Record<string, any>>({})
const formData = reactive({
    status: 1,
    default_size_key: '1:1',
    prompt_template: '',
    negative_prompt: '',
    config_json: {
        channel: undefined as string | undefined,
        quality: undefined as string | undefined,
        ratio: undefined as string | undefined,
        unit_price: 8
    }
})

const channels = computed(() => optionConfig.value?.channels || [])
const activeChannel = computed(() => channels.value.find((item: any) => item.code === formData.config_json.channel) || channels.value[0] || {})
const qualityOptions = computed(() => (activeChannel.value?.qualities || []).map((item: any) => ({ label: item.label || item.quality_label || item.value, value: item.value })))
const activeQuality = computed(() => (activeChannel.value?.qualities || []).find((item: any) => item.value === formData.config_json.quality) || (activeChannel.value?.qualities || [])[0] || {})
const ratioOptions = computed(() => (activeQuality.value?.ratios || []).map((item: any) => ({ label: item.label || item.ratio || item.value, value: item.value || item.ratio })))
const sizeOptions = computed(() => ratioOptions.value.map((item: any) => ({ key: item.value, label: item.label })))

const syncDefaultSpec = () => {
    if (!qualityOptions.value.some((item: any) => item.value === formData.config_json.quality)) {
        formData.config_json.quality = qualityOptions.value[0]?.value
    }
    syncDefaultRatio()
}

const syncDefaultRatio = () => {
    if (!ratioOptions.value.some((item: any) => item.value === formData.config_json.ratio)) {
        formData.config_json.ratio = ratioOptions.value[0]?.value
    }
    syncDefaultSize()
}

const syncDefaultSize = () => {
    if (!sizeOptions.value.some((item: any) => item.key === formData.default_size_key)) {
        formData.default_size_key = sizeOptions.value[0]?.key || '1:1'
    }
}

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcProductImageConfig()
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            default_size_key: data?.default_size_key || '1:1',
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            config_json: {
                channel: data?.config_json?.channel || undefined,
                quality: data?.config_json?.quality || undefined,
                ratio: data?.config_json?.ratio || undefined,
                unit_price: Number(data?.config_json?.unit_price ?? 8)
            }
        })
        optionConfig.value = data?.option_config || {}
        syncDefaultSpec()
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcProductImageConfig({
            status: formData.status,
            default_size_key: formData.default_size_key,
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
.config-select {
    width: 240px;
}

.config-select--channel {
    width: 360px;
}

.price-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
</style>
