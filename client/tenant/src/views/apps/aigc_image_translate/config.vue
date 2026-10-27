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
                    <el-select v-model="formData.config_json.ratio" class="config-select" clearable placeholder="跟随模型默认比例">
                        <el-option v-for="ratio in ratioOptions" :key="ratio.value" :label="ratio.label" :value="ratio.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认目标语言">
                    <el-select v-model="formData.config_json.target_language" class="config-select" placeholder="请选择默认目标语言">
                        <el-option v-for="language in targetLanguageOptions" :key="language.value" :label="language.label" :value="language.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="独立定价">
                    <div class="price-config-tip">
                        <div>
                            <div class="price-config-tip__title">图片翻译使用独立翻译质量</div>
                            <div class="price-config-tip__desc">
                                租户按模型和分辨率维护翻译质量售价，不会修改 AIGC 生图价格。
                            </div>
                        </div>
                        <el-button type="primary" plain @click="goPriceConfig">去配置价格</el-button>
                    </div>
                </el-form-item>
                <el-form-item label="提示词模板">
                    <el-input v-model="formData.prompt_template" type="textarea" :rows="7" maxlength="1500" show-word-limit placeholder="请输入固定图片翻译提示词模板" />
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

<script lang="ts" setup name="tenant-aigc-image-translate-config">
import { getAigcImageTranslateConfig, setAigcImageTranslateConfig } from '@/apps/aigc_image_translate/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'
import { withTenantQuery } from '@/utils/tenant'

const loading = ref(false)
const saving = ref(false)
const router = useRouter()
const optionConfig = ref<any>({})
const displayConfig = ref<Record<string, any>>({})
const formData = reactive({
    status: 1,
    prompt_template: '',
    negative_prompt: '',
    price_config: [] as any[],
    config_json: {
        channel: undefined as string | undefined,
        quality: undefined as string | undefined,
        ratio: undefined as string | undefined,
        target_language: 'en'
    }
})

const channels = computed(() => optionConfig.value?.channels || [])
const targetLanguageOptions = computed(() => (optionConfig.value?.target_language_options || [
    { value: 'zh-hans', label: '简体中文' },
    { value: 'zh-hant', label: '繁体中文' },
    { value: 'en', label: '英文' },
    { value: 'ja', label: '日文' },
    { value: 'ko', label: '韩文' },
    { value: 'fr', label: '法文' },
    { value: 'de', label: '德文' },
    { value: 'es', label: '西班牙文' },
    { value: 'pt', label: '葡萄牙文' },
    { value: 'ru', label: '俄文' }
]))
const activeChannel = computed(() => channels.value.find((item: any) => item.code === formData.config_json.channel) || channels.value[0] || {})
const qualityOptions = computed(() => (activeChannel.value?.qualities || []).map((item: any) => ({ label: item.label || item.quality_label || item.value, value: item.value })))
const activeQuality = computed(() => (activeChannel.value?.qualities || []).find((item: any) => item.value === formData.config_json.quality) || (activeChannel.value?.qualities || [])[0] || {})
const ratioOptions = computed(() => (activeQuality.value?.ratios || []).map((item: any) => ({ label: item.label || item.ratio || item.value, value: item.value || item.ratio })))

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
        const data: any = await getAigcImageTranslateConfig()
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            price_config: data?.price_config || [],
            config_json: {
                channel: data?.default_channel || data?.config_json?.channel || undefined,
                quality: data?.default_quality || data?.config_json?.quality || undefined,
                ratio: data?.default_ratio || data?.config_json?.ratio || undefined,
                target_language: data?.default_target_language || data?.config_json?.target_language || 'en'
            }
        })
        optionConfig.value = {
            ...(data?.option_config || {}),
            target_language_options: data?.target_language_options || []
        }
        syncDefaultSpec()
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const goPriceConfig = () => {
    router.push(withTenantQuery('/aigc-image-translate/price'))
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcImageTranslateConfig({
            status: formData.status,
            default_channel: formData.config_json.channel,
            default_quality: formData.config_json.quality,
            default_ratio: formData.config_json.ratio,
            default_target_language: formData.config_json.target_language,
            prompt_template: formData.prompt_template,
            negative_prompt: formData.negative_prompt,
            price_config: formData.price_config,
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

.price-config-tip {
    width: min(720px, 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-fill-color-light);
}

.price-config-tip__title {
    color: var(--el-text-color-primary);
    font-weight: 500;
    line-height: 22px;
}

.price-config-tip__desc {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 20px;
}
</style>
