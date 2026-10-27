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
                <el-form-item label="单张售价">
                    <el-input-number v-model="formData.unit_price" :min="0" :precision="2" :step="0.01" controls-position="right" />
                    <span class="form-tip">{{ formatPointRate('', '张').trim() }}，PC 端按上传图片数量汇总预估消耗。</span>
                </el-form-item>
                <el-form-item label="批量上限">
                    <el-tag>{{ formData.max_images }} 张</el-tag>
                    <span class="form-tip">固定上限，已去掉 VIP 扩容升级。</span>
                </el-form-item>
                <el-form-item label="消除选项">
                    <el-button type="primary" plain @click="goOptionConfig">去配置消除选项</el-button>
                </el-form-item>
                <el-form-item label="提示词模板">
                    <el-input v-model="formData.prompt_template" type="textarea" :rows="7" maxlength="1500" show-word-limit placeholder="请输入一键消除全局提示词模板" />
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

<script lang="ts" setup name="tenant-aigc-one-click-cleanup-config">
import { getAigcOneClickCleanupConfig, setAigcOneClickCleanupConfig } from '@/apps/aigc_one_click_cleanup/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'
import { formatPointRate } from '@/utils/point-unit'
import { withTenantQuery } from '@/utils/tenant'

const loading = ref(false)
const saving = ref(false)
const router = useRouter()
const optionConfig = ref<any>({})
const displayConfig = ref<Record<string, any>>({})
const formData = reactive({
    status: 1,
    unit_price: 0,
    max_images: 10,
    prompt_template: '',
    negative_prompt: '',
    config_json: {
        channel: undefined as string | undefined,
        quality: undefined as string | undefined,
        ratio: undefined as string | undefined
    }
})

const channels = computed(() => optionConfig.value?.channels || [])
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
        const data: any = await getAigcOneClickCleanupConfig()
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            unit_price: Number(data?.unit_price || 0),
            max_images: Number(data?.max_images || 10),
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            config_json: {
                channel: data?.default_channel || data?.config_json?.channel || undefined,
                quality: data?.default_quality || data?.config_json?.quality || undefined,
                ratio: data?.default_ratio || data?.config_json?.ratio || undefined
            }
        })
        optionConfig.value = data?.option_config || {}
        syncDefaultSpec()
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const goOptionConfig = () => router.push(withTenantQuery('/aigc-one-click-cleanup/option'))

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcOneClickCleanupConfig({
            status: formData.status,
            default_channel: formData.config_json.channel,
            default_quality: formData.config_json.quality,
            default_ratio: formData.config_json.ratio,
            unit_price: formData.unit_price,
            max_images: formData.max_images,
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
.form-tip { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
</style>
