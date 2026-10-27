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
                <el-form-item label="提示词模板">
                    <el-input v-model="formData.prompt_template" type="textarea" :rows="7" maxlength="1500" show-word-limit placeholder="支持变量：{style_label}、{width}、{height}、{user_prompt}、{template_prompt}" />
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

<script lang="ts" setup name="tenant-aigc-style-transfer-config">
import { getAigcStyleTransferConfig, setAigcStyleTransferConfig } from '@/apps/aigc_style_transfer/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
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

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcStyleTransferConfig()
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            default_size_key: data?.default_size_key || '1:1',
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            config_json: {
                ...(data?.config_json || {})
            }
        })
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcStyleTransferConfig({
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
</style>
