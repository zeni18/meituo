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
                <el-form-item label="默认模式">
                    <el-radio-group v-model="formData.default_mode">
                        <el-radio v-for="item in modeOptions" :key="item.value" :value="item.value">
                            {{ item.label }}
                        </el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="默认服装分类">
                    <el-select v-model="formData.default_upload_category" class="fitting-config__select fitting-config__select--category">
                        <el-option
                            v-for="item in categoryOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认模型">
                    <el-select
                        v-model="formData.config_json.channel"
                        class="fitting-config__select fitting-config__select--channel"
                        placeholder="跟随AIGC生图默认通道"
                        clearable
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                        @change="syncDefaultSpec"
                    >
                        <el-option
                            v-for="channel in channels"
                            :key="channel.code"
                            :label="channel.name"
                            :value="channel.code"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认清晰度">
                    <el-select
                        v-model="formData.config_json.quality"
                        class="fitting-config__select fitting-config__select--spec"
                        placeholder="跟随模型默认清晰度"
                        clearable
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                        @change="syncDefaultRatio"
                    >
                        <el-option
                            v-for="quality in qualityOptions"
                            :key="quality.value"
                            :label="quality.label"
                            :value="quality.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认比例">
                    <el-select
                        v-model="formData.config_json.ratio"
                        class="fitting-config__select fitting-config__select--spec"
                        placeholder="跟随模型默认比例"
                        clearable
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                    >
                        <el-option
                            v-for="ratio in ratioOptions"
                            :key="ratio.value"
                            :label="ratio.label"
                            :value="ratio.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="模式售价">
                    <div class="price-grid">
                        <div v-for="item in modeOptions" :key="item.value" class="price-item">
                            <span>{{ item.label }}每张</span>
                            <el-input-number
                                v-model="formData.config_json.mode_prices[item.value]"
                                :min="0"
                                :precision="2"
                                :step="1"
                                controls-position="right"
                            />
                            <span>点</span>
                        </div>
                    </div>
                </el-form-item>
                <el-form-item label="提示词模板">
                    <el-input
                        v-model="formData.prompt_template"
                        type="textarea"
                        :rows="7"
                        maxlength="1500"
                        show-word-limit
                        placeholder="支持变量：{garment_images}、{model_images}、{mode}、{garment_category}、{model_filter}、{clothes_filter}、{pose_filter}、{user_prompt}"
                    />
                </el-form-item>
                <el-form-item label="负向提示词">
                    <el-input
                        v-model="formData.negative_prompt"
                        type="textarea"
                        :rows="4"
                        maxlength="800"
                        show-word-limit
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-fitting-config">
import { getAigcFittingConfig, setAigcFittingConfig } from '@/apps/aigc_fitting/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const modeOptions = ref<any[]>([])
const categoryOptions = ref<any[]>([])
const optionConfig = ref<any>({})
const displayConfig = ref<Record<string, any>>({})
const selectEmptyValues = [undefined, null, '']
const formData = reactive({
    status: 1,
    default_mode: 'single',
    default_upload_category: 'full',
    prompt_template: '',
    negative_prompt: '',
    config_json: {
        channel: undefined as string | undefined,
        quality: undefined as string | undefined,
        ratio: undefined as string | undefined,
        quantity: 1,
        mode_prices: {
            single: 10,
            group: 10,
            custom: 12
        } as Record<string, number>
    }
})

const channels = computed(() => optionConfig.value?.channels || [])
const activeChannel = computed(() => channels.value.find((item: any) => item.code === formData.config_json.channel) || channels.value[0] || {})
const qualityOptions = computed(() => (activeChannel.value?.qualities || []).map((item: any) => ({
    label: item.label || item.quality_label || item.value,
    value: item.value
})))
const activeQuality = computed(() => (activeChannel.value?.qualities || []).find((item: any) => item.value === formData.config_json.quality) || (activeChannel.value?.qualities || [])[0] || {})
const ratioOptions = computed(() => (activeQuality.value?.ratios || []).map((item: any) => ({
    label: item.label || item.ratio || item.value,
    value: item.value || item.ratio
})))

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
}

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcFittingConfig()
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            default_mode: data?.default_mode || 'single',
            default_upload_category: data?.default_upload_category || 'full',
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            config_json: {
                channel: data?.config_json?.channel || undefined,
                quality: data?.config_json?.quality || undefined,
                ratio: data?.config_json?.ratio || undefined,
                quantity: Number(data?.config_json?.quantity || 1),
                mode_prices: {
                    single: Number(data?.config_json?.mode_prices?.single ?? 10),
                    group: Number(data?.config_json?.mode_prices?.group ?? 10),
                    custom: Number(data?.config_json?.mode_prices?.custom ?? 12)
                }
            }
        })
        modeOptions.value = data?.mode_options || []
        categoryOptions.value = data?.category_options || []
        optionConfig.value = data?.option_config || {}
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcFittingConfig({
            status: formData.status,
            default_mode: formData.default_mode,
            default_upload_category: formData.default_upload_category,
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
.price-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.price-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
}

.fitting-config__select {
    width: 100%;
}

.fitting-config__select--category {
    width: 260px;
}

.fitting-config__select--channel {
    width: 360px;
}

.fitting-config__select--spec {
    width: 240px;
}

</style>
