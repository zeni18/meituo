<template>
    <div v-loading="loading">
        <app-display-config v-model="displayConfig" />
        <el-card class="!border-none mt-4" shadow="never">
            <template #header>
                <div class="font-medium">Agent 模型配置</div>
            </template>
            <el-alert
                class="mb-4"
                :closable="false"
                show-icon
                type="info"
                title="该模型用于理解用户意图和分配任务，不直接生成图片或视频。图片、视频生成仍复用无限画布已有模型配置。"
            />
            <el-form label-width="140px">
                <el-form-item label="启用 LLM 路由">
                    <el-switch
                        v-model="agentConfig.router_enabled"
                        :disabled="!agentConfig.router_available"
                    />
                    <span class="ml-3 text-xs text-gray-500">
                        {{
                            agentConfig.router_available
                                ? '开启后 Agent 模式优先使用 LLM 判断任务类型'
                                : agentConfig.message || '暂无可用对话模型'
                        }}
                    </span>
                </el-form-item>
                <el-form-item label="Agent 模型">
                    <el-select
                        v-model="agentConfig.router_model_code"
                        class="w-[360px]"
                        filterable
                        placeholder="请选择 Agent LLM 模型"
                        :disabled="!agentConfig.router_available"
                    >
                        <el-option
                            v-for="model in agentConfig.router_models"
                            :key="model.code"
                            :label="model.name || model.code"
                            :value="model.code"
                        >
                            <span>{{ model.name || model.code }}</span>
                            <span class="float-right text-xs text-gray-500">
                                {{ model.channel_code || model.provider || '' }}
                            </span>
                        </el-option>
                    </el-select>
                </el-form-item>
            </el-form>
        </el-card>
        <el-card class="!border-none" shadow="never">
            <template #header>
                <div class="font-medium">依赖状态</div>
            </template>
            <el-table :data="dependencies.items || []" border>
                <el-table-column label="依赖应用" prop="name" min-width="160" />
                <el-table-column label="能力" prop="required_for" min-width="140" />
                <el-table-column label="状态" min-width="100">
                    <template #default="{ row }">
                        <el-tag :type="row.ready ? 'success' : 'danger'">
                            {{ row.ready ? '可用' : '不可用' }}
                        </el-tag>
                    </template>
                </el-table-column>
            </el-table>
            <div class="mt-4">
                <el-button type="primary" @click="handleSubmit">保存</el-button>
            </div>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-canvas-config">
import { getAigcCanvasConfig, setAigcCanvasConfig } from '@/apps/aigc_canvas/api'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'

const loading = ref(false)
const displayConfig = ref<Record<string, any>>({})
const agentConfig = reactive({
    router_enabled: true,
    router_model_code: '',
    router_models: [] as any[],
    router_available: false,
    message: ''
})
const dependencies = ref<Record<string, any>>({
    items: [],
    ready: false
})

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcCanvasConfig()
        displayConfig.value = data?.display_config || {}
        Object.assign(agentConfig, {
            router_enabled: data?.agent?.router_enabled ?? true,
            router_model_code: data?.agent?.router_model_code || '',
            router_models: Array.isArray(data?.agent?.router_models)
                ? data.agent.router_models
                : [],
            router_available: Boolean(data?.agent?.router_available),
            message: data?.agent?.message || ''
        })
        dependencies.value = data?.dependencies || { items: [], ready: false }
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
    await setAigcCanvasConfig({
        display_config: displayConfig.value,
        agent: {
            router_enabled: agentConfig.router_enabled,
            router_model_code: agentConfig.router_model_code
        }
    })
    getData()
}

getData()
</script>
