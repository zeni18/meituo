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
                <el-form-item label="独立定价">
                    <div class="price-config-tip">
                        <div>
                            <div class="price-config-tip__title">无缝扩图使用独立扩图比例</div>
                            <div class="price-config-tip__desc">
                                租户按模型和分辨率维护扩图比例售价，不会修改 AIGC 生图价格。
                            </div>
                        </div>
                        <el-button type="primary" plain @click="goPriceConfig">去配置价格</el-button>
                    </div>
                </el-form-item>
                <el-form-item label="提示词模板">
                    <el-input v-model="formData.prompt_template" type="textarea" :rows="7" maxlength="1500" show-word-limit placeholder="请输入固定扩图提示词模板" />
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

<script lang="ts" setup name="tenant-aigc-outpaint-config">
import { getAigcOutpaintConfig, setAigcOutpaintConfig } from '@/apps/aigc_outpaint/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'
import { withTenantQuery } from '@/utils/tenant'

const loading = ref(false)
const saving = ref(false)
const router = useRouter()
const displayConfig = ref<Record<string, any>>({})
const formData = reactive({
    status: 1,
    prompt_template: '',
    negative_prompt: '',
    price_config: [] as any[]
})

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcOutpaintConfig()
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            price_config: data?.price_config || []
        })
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const goPriceConfig = () => {
    router.push(withTenantQuery('/aigc-outpaint/price'))
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcOutpaintConfig({
            status: formData.status,
            default_channel: '',
            default_quality: '',
            default_ratio: '',
            prompt_template: formData.prompt_template,
            negative_prompt: formData.negative_prompt,
            price_config: formData.price_config,
            config_json: {},
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
