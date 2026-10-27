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
                    <el-select v-model="formData.default_mode" class="config-select">
                        <el-option v-for="item in modeOptions" :key="item.value" :label="item.label" :value="item.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="默认处理人数">
                    <el-input-number v-model="formData.default_face_count" :min="1" :max="7" controls-position="right" />
                    <span class="form-tips ml-3">PC 用户可选择 1-7 人</span>
                </el-form-item>
                <el-form-item label="快速模式售价">
                    <el-input-number v-model="formData.price_matrix.fast" :min="0" :precision="2" :step="0.01" controls-position="right" />
                    <span class="price-unit">{{ getPointUnit() }}/秒</span>
                </el-form-item>
                <el-form-item label="标准模式售价">
                    <el-input-number v-model="formData.price_matrix.standard" :min="0" :precision="2" :step="0.01" controls-position="right" />
                    <span class="price-unit">{{ getPointUnit() }}/秒</span>
                </el-form-item>
                <el-form-item label="高清模式售价">
                    <el-input-number v-model="formData.price_matrix.max" :min="0" :precision="2" :step="0.01" controls-position="right" />
                    <span class="price-unit">{{ getPointUnit() }}/秒</span>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-person-replacement-config">
import { getPointUnit } from '@/utils/point-unit'

import { getAigcPersonReplacementConfig, setAigcPersonReplacementConfig } from '@/apps/aigc_person_replacement/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import feedback from '@/utils/feedback'

const loading = ref(false)
const saving = ref(false)
const displayConfig = ref<Record<string, any>>({})
const modeOptions = ref<any[]>([])
const formData = reactive({
    status: 1,
    default_mode: 'standard',
    default_face_count: 1,
    price_matrix: {
        fast: 1,
        standard: 2,
        max: 3
    }
})

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcPersonReplacementConfig()
        modeOptions.value = data?.mode_options || [
            { value: 'fast', label: '快速模式' },
            { value: 'standard', label: '标准模式' },
            { value: 'max', label: '高清模式' }
        ]
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            default_mode: data?.default_mode || 'standard',
            default_face_count: Number(data?.default_face_count || 1),
            price_matrix: {
                fast: Number(data?.price_matrix?.fast ?? 1),
                standard: Number(data?.price_matrix?.standard ?? 2),
                max: Number(data?.price_matrix?.max ?? 3)
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
        await setAigcPersonReplacementConfig({
            status: formData.status,
            default_mode: formData.default_mode,
            default_face_count: formData.default_face_count,
            price_matrix: formData.price_matrix,
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
.form-tips { color: var(--el-text-color-secondary); font-size: 13px; }
.price-unit { margin-left: 8px; color: var(--el-text-color-regular); }
</style>
