<template>
    <div v-loading="loading">
        <app-display-config v-model="displayConfig" />
        <el-card class="!border-none" shadow="never">
            <el-form label-width="150px" :model="formData">
                <el-form-item label="应用状态">
                    <el-radio-group v-model="formData.status">
                        <el-radio :value="1">启用</el-radio>
                        <el-radio :value="0">停用</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="默认生成类型">
                    <el-select v-model="configJson.default_type" class="w-[220px]">
                        <el-option label="文生音乐" value="text_to_music" />
                        <el-option label="歌词成歌" value="lyric_to_music" />
                        <el-option label="参考音频" value="audio_to_music" />
                        <el-option label="纯伴奏" value="instrumental" />
                    </el-select>
                </el-form-item>
                <el-form-item label="开放能力">
                    <el-checkbox-group v-model="configJson.enabled_features">
                        <el-checkbox label="text_to_music">文生音乐</el-checkbox>
                        <el-checkbox label="lyric_to_music">歌词成歌</el-checkbox>
                        <el-checkbox label="audio_to_music">参考音频</el-checkbox>
                        <el-checkbox label="voice_clone">声音克隆</el-checkbox>
                        <el-checkbox label="video_export">视频导出</el-checkbox>
                    </el-checkbox-group>
                </el-form-item>
                <el-form-item label="最大生成时长">
                    <el-input-number v-model="configJson.max_duration" :min="0" :step="10" />
                    <span class="ml-2 text-tx-secondary">秒，0 表示不限制</span>
                </el-form-item>
                <el-form-item label="参考音频">
                    <el-switch v-model="configJson.allow_reference_audio" />
                </el-form-item>
                <el-form-item label="声音克隆">
                    <el-switch v-model="configJson.allow_voice_clone" />
                </el-form-item>
                <el-form-item label="安全审核">
                    <el-switch v-model="configJson.safety_review" />
                </el-form-item>
                <el-form-item label="默认扣费状态">
                    <el-select v-model="configJson.default_billing_status" class="w-[220px]">
                        <el-option label="提交前扣费" value="paid" />
                        <el-option label="结果后扣费" value="pending" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="handleSubmit"
                        >保存</el-button
                    >
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-music-config">
import { getAigcMusicConfig, setAigcMusicConfig } from '@/apps/aigc_music/api'
import feedback from '@/utils/feedback'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'

const loading = ref(false)
const saving = ref(false)
const formData = reactive<any>({
    status: 1,
    config_json: {}
})
const configJson = reactive<any>({
    default_type: 'text_to_music',
    enabled_features: ['text_to_music', 'lyric_to_music', 'audio_to_music'],
    max_duration: 0,
    allow_reference_audio: true,
    allow_voice_clone: false,
    safety_review: true,
    default_billing_status: 'paid'
})
const displayConfig = ref<Record<string, any>>({})
const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcMusicConfig()
        Object.assign(formData, data)
        Object.assign(configJson, data?.config_json || {})
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}
const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcMusicConfig({
            status: formData.status,
            config_json: { ...configJson },
            display_config: displayConfig.value
        })
        feedback.msgSuccess('保存成功')
        getData()
    } finally {
        saving.value = false
    }
}
getData()
</script>
