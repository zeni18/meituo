<template>
    <div v-loading="loading">
        <app-display-config v-model="displayConfig" />

        <el-card class="!border-none mt-4" shadow="never">
            <template #header>
                <div class="font-medium">资源状态</div>
            </template>
            <el-alert
                class="mb-4"
                type="info"
                show-icon
                :closable="false"
                title="AI短剧的剧本、生图与生视频均使用算力市场已上架的模型 API 或应用 API；背景音乐使用已上架的音乐生成应用 API。"
            />
            <el-table :data="dependencies.items || []" border>
                <el-table-column label="资源" prop="name" min-width="150" />
                <el-table-column label="用于" prop="required_for" min-width="190" />
                <el-table-column label="资源类型" width="110">
                    <template #default="{ row }">
                        <el-tag :type="dependencyAvailable(row) ? 'success' : 'danger'">
                            {{ row.resource_type_label || '算力市场资源' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="可用状态" width="130">
                    <template #default="{ row }">
                        <el-tag :type="dependencyAvailable(row) ? 'success' : 'danger'">
                            {{ dependencyAvailable(row) ? '可用' : '不可用' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="通道" width="110">
                    <template #default="{ row }">
                        <el-tag :type="row.channel_ready ? 'success' : 'warning'">
                            {{ dependencyChannelText(row) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="说明" prop="message" min-width="180" />
            </el-table>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-form label-width="130px" :model="formData">
                <el-form-item label="应用状态">
                    <el-radio-group v-model="formData.status">
                        <el-radio :value="1">启用</el-radio>
                        <el-radio :value="0">停用</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="强制转存生成结果">
                    <div class="result-transfer-field">
                        <el-switch v-model="formData.force_result_transfer" :active-value="1" :inactive-value="0" />
                        <span>关闭时遵循全局生成结果自动转存开关；开启后短剧生成的图片、视频和音频会保存到指定存储。</span>
                    </div>
                </el-form-item>
                <el-form-item v-if="formData.force_result_transfer" label="转存存储方式" required>
                    <el-select
                        v-model="formData.result_storage_engine"
                        class="!w-[360px]"
                        placeholder="请选择已配置的存储方式"
                    >
                        <el-option
                            v-for="item in resultStorageOptions"
                            :key="item.engine"
                            :label="item.name"
                            :value="item.engine"
                        />
                    </el-select>
                    <div v-if="!resultStorageOptions.length" class="result-transfer-empty">
                        暂无可用存储方式，请先在存储设置中完成配置。
                    </div>
                </el-form-item>
                <el-form-item label="剧本固定模型">
                    <div class="vision-model-field">
                        <el-select
                            v-model="formData.script_plan_model_id"
                            class="vision-model-select"
                            filterable
                            placeholder="请选择剧本生成模型"
                            no-match-text="没有匹配的文本模型"
                            no-data-text="暂无租户可用的文本模型"
                        >
                            <el-option
                                v-for="model in scriptModelOptions"
                                :key="String(model.id)"
                                :label="visionModelLabel(model)"
                                :value="String(model.id)"
                            >
                                <div class="vision-model-option">
                                    <span>{{ model.name || model.model_code || model.id }}</span>
                                    <el-tag size="small" type="success">固定</el-tag>
                                </div>
                                <div v-if="model.model_code" class="vision-model-option__code">
                                    {{ model.model_code }}
                                </div>
                            </el-option>
                        </el-select>
                        <span>用于短剧剧本生成，PC端不展示；默认固定 Qwen3.6-Plus</span>
                    </div>
                </el-form-item>
                <el-form-item label="视觉文本模型">
                    <div class="vision-model-field">
                        <el-select
                            v-model="formData.vision_model_id"
                            class="vision-model-select"
                            filterable
                            clearable
                            placeholder="搜索并选择支持视觉的文本模型"
                            no-match-text="没有匹配的视觉文本模型"
                            no-data-text="暂无租户可用的视觉文本模型"
                        >
                            <el-option
                                v-for="model in visionModelOptions"
                                :key="String(model.id)"
                                :label="visionModelLabel(model)"
                                :value="String(model.id)"
                            >
                                <div class="vision-model-option">
                                    <span>{{ model.name || model.model_code || model.id }}</span>
                                    <el-tag size="small" type="success">支持视觉</el-tag>
                                </div>
                                <div v-if="model.model_code" class="vision-model-option__code">
                                    {{ model.model_code }}
                                </div>
                            </el-option>
                        </el-select>
                        <span>用于参考图理解、主体和场景的智能描述</span>
                    </div>
                </el-form-item>
                <el-form-item label="创意输入字数">
                    <div class="prompt-limit-field">
                        <el-input-number
                            v-model="formData.prompt_max_length"
                            :min="0"
                            :max="200000"
                            :step="500"
                            controls-position="right"
                            class="!w-[220px]"
                        />
                        <span>0 表示不做业务层字数限制，最终以模型上下文能力为准</span>
                    </div>
                </el-form-item>
                <el-form-item label="分镜数量规则">
                    <div class="storyboard-rule-panel">
                        <el-alert
                            class="mb-3"
                            type="info"
                            show-icon
                            :closable="false"
                            title="未指定时长和时间轴时，系统会让剧本策划模型先判断剧情复杂度，再按这里配置的范围生成分镜。最大值为 0 表示 40 个以上或不设上限。"
                        />
                        <el-table :data="formData.storyboard_rules" border>
                            <el-table-column label="启用" width="80" align="center">
                                <template #default="{ row }">
                                    <el-switch v-model="row.enabled" />
                                </template>
                            </el-table-column>
                            <el-table-column label="档位名称" min-width="170">
                                <template #default="{ row }">
                                    <el-input v-model="row.label" maxlength="60" />
                                </template>
                            </el-table-column>
                            <el-table-column label="适用说明" min-width="300">
                                <template #default="{ row }">
                                    <el-input
                                        v-model="row.description"
                                        maxlength="500"
                                        type="textarea"
                                        :rows="2"
                                    />
                                </template>
                            </el-table-column>
                            <el-table-column label="最小分镜" width="130">
                                <template #default="{ row }">
                                    <el-input-number
                                        v-model="row.min_shots"
                                        :min="1"
                                        :max="300"
                                        controls-position="right"
                                        class="!w-full"
                                        @change="syncStoryboardRuleRange(row)"
                                    />
                                </template>
                            </el-table-column>
                            <el-table-column label="最大分镜" width="130">
                                <template #default="{ row }">
                                    <el-input-number
                                        v-model="row.max_shots"
                                        :min="0"
                                        :max="500"
                                        controls-position="right"
                                        class="!w-full"
                                        @change="syncStoryboardRuleRange(row)"
                                    />
                                </template>
                            </el-table-column>
                            <el-table-column label="排序" width="110">
                                <template #default="{ row }">
                                    <el-input-number
                                        v-model="row.sort"
                                        :min="0"
                                        :max="999"
                                        controls-position="right"
                                        class="!w-full"
                                    />
                                </template>
                            </el-table-column>
                            <el-table-column label="操作" width="90">
                                <template #default="{ $index }">
                                    <el-button link type="danger" @click="removeStoryboardRule($index)">
                                        删除
                                    </el-button>
                                </template>
                            </el-table-column>
                        </el-table>
                        <div class="storyboard-rule-actions">
                            <el-button type="primary" plain @click="addStoryboardRule">
                                添加档位
                            </el-button>
                            <el-button plain @click="resetStoryboardRules">
                                恢复默认
                            </el-button>
                        </div>
                    </div>
                </el-form-item>
                <el-form-item label="背景类型">
                    <el-radio-group v-model="formData.background.type">
                        <el-radio value="video">视频</el-radio>
                        <el-radio value="image">图片</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="背景素材">
                    <div class="background-list">
                        <div
                            v-for="(item, index) in formData.background.items"
                            :key="index"
                            class="background-row"
                        >
                            <material-picker
                                :key="`${formData.background.type}-${index}`"
                                v-model="item.url"
                                :type="formData.background.type"
                                :limit="1"
                                exclude-domain
                                size="88px"
                            >
                                <template #upload>
                                    <div class="material-upload-button">
                                        <icon :size="24" name="el-icon-Plus" />
                                        <span>选择{{ formData.background.type === 'video' ? '视频' : '图片' }}</span>
                                    </div>
                                </template>
                            </material-picker>
                            <material-picker
                                v-if="formData.background.type === 'video'"
                                v-model="item.poster_url"
                                type="image"
                                :limit="1"
                                exclude-domain
                                size="88px"
                            >
                                <template #upload>
                                    <div class="material-upload-button">
                                        <icon :size="24" name="el-icon-Plus" />
                                        <span>视频封面</span>
                                    </div>
                                </template>
                            </material-picker>
                            <div class="background-info">
                                <div class="background-info__title">
                                    素材 {{ index + 1 }}
                                </div>
                                <div class="background-info__url">
                                    {{ item.url ? resolveMediaUrl(item.url) : '从资源库选择或上传素材' }}
                                </div>
                            </div>
                            <el-button link type="danger" @click="removeBackground(index)">
                                删除
                            </el-button>
                        </div>
                        <el-button type="primary" plain @click="addBackground">添加素材</el-button>
                    </div>
                </el-form-item>
                <el-form-item label="导出水印">
                    <div class="watermark-panel">
                        <el-switch v-model="formData.export_watermark.enabled" active-text="开启" inactive-text="关闭" />
                        <div class="watermark-options">
                            <el-radio-group v-model="formData.export_watermark.type">
                                <el-radio value="text">文字水印</el-radio>
                                <el-radio value="image">Logo 水印</el-radio>
                            </el-radio-group>
                            <el-input
                                v-if="formData.export_watermark.type === 'text'"
                                v-model="formData.export_watermark.text"
                                class="!w-[360px]"
                                maxlength="80"
                                placeholder="请输入导出视频水印文字"
                            />
                            <material-picker
                                v-else
                                v-model="formData.export_watermark.image"
                                type="image"
                                :limit="1"
                                exclude-domain
                                size="88px"
                            >
                                <template #upload>
                                    <div class="material-upload-button">
                                        <icon :size="24" name="el-icon-Plus" />
                                        <span>选择 Logo</span>
                                    </div>
                                </template>
                            </material-picker>
                            <div class="watermark-inline">
                                <span>透明度</span>
                                <el-input-number
                                    v-model="formData.export_watermark.opacity"
                                    :min="0.05"
                                    :max="1"
                                    :step="0.05"
                                    :precision="2"
                                    controls-position="right"
                                    class="!w-[150px]"
                                />
                                <span>左边距</span>
                                <el-input-number
                                    v-model="formData.export_watermark.margin_x"
                                    :min="0"
                                    :max="300"
                                    controls-position="right"
                                    class="!w-[130px]"
                                />
                                <span>下边距</span>
                                <el-input-number
                                    v-model="formData.export_watermark.margin_y"
                                    :min="0"
                                    :max="300"
                                    controls-position="right"
                                    class="!w-[130px]"
                                />
                            </div>
                        </div>
                    </div>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="handleSubmit">
                        保存
                    </el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-short-drama-config">
import { getAigcShortDramaConfig, setAigcShortDramaConfig } from '@/apps/aigc_short_drama/api'
import MaterialPicker from '@/components/material/picker.vue'
import useAppStore from '@/stores/modules/app'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const { getImageUrl } = useAppStore()
const displayConfig = ref<Record<string, any>>({})
const dependencies = ref<any>({ items: [], ready: false })
const scriptModelOptions = ref<any[]>([])
const visionModelOptions = ref<any[]>([])
const resultStorageOptions = ref<{ engine: string; name: string }[]>([])
const formData = reactive({
    status: 1,
    force_result_transfer: 0,
    result_storage_engine: '',
    background: {
        type: 'video',
        items: [] as { url: string; poster_url: string }[]
    },
    ratios: [] as any[],
    models: [] as any[],
    script_plan_model_id: '',
    vision_model_id: '',
    prompt_max_length: 20000,
    storyboard_rules: [] as any[],
    export_watermark: {
        enabled: true,
        type: 'text',
        text: '',
        image: '',
        opacity: 0.35,
        margin_x: 24,
        margin_y: 24
    }
})

const defaultStoryboardRules = () => [
    {
        code: 'ordinary_short',
        label: '普通短片',
        description: '常规剧情短片，有完整起承转合但悬疑、反转或跨场景复杂度不高。',
        min_shots: 20,
        max_shots: 35,
        sort: 20,
        enabled: true
    },
    {
        code: 'suspense_twist_dream',
        label: '复杂梦境 / 悬疑 / 反转短片',
        description: '包含梦境、悬疑铺垫、误导、真相揭露、强反转或高密度情绪变化。',
        min_shots: 30,
        max_shots: 40,
        sort: 30,
        enabled: true
    },
    {
        code: 'simple_single_scene',
        label: '简单口播 / 广告 / 单场景内容',
        description: '以口播、产品广告、单一空间或单一动作链为主，剧情结构简单。',
        min_shots: 8,
        max_shots: 18,
        sort: 10,
        enabled: true
    },
    {
        code: 'complex_multi_scene',
        label: '复杂多场景剧情',
        description: '跨多个地点或时空，角色关系、动作链、情绪转折和关键线索较多。',
        min_shots: 40,
        max_shots: 0,
        sort: 40,
        enabled: true
    }
]

const ensureBackground = () => {
    if (!formData.background.items.length) {
        formData.background.items.push({ url: '', poster_url: '' })
    }
}

const normalizeBackgroundItems = (items: any[] = []) =>
    (Array.isArray(items) ? items : [])
        .map((item: any) => ({
            url: String(item?.url || item || ''),
            poster_url: String(item?.poster_url || '')
        }))
        .filter((item) => item.url || item.poster_url)

const normalizeExportWatermark = (value: any = {}) => ({
    enabled: value?.enabled !== false,
    type: ['text', 'image'].includes(String(value?.type || '')) ? String(value.type) : 'text',
    text: String(value?.text || '').slice(0, 80),
    image: String(value?.image || ''),
    opacity: Math.max(0.05, Math.min(1, Number(value?.opacity ?? 0.35))),
    margin_x: Math.max(0, Math.min(300, Number(value?.margin_x ?? 24))),
    margin_y: Math.max(0, Math.min(300, Number(value?.margin_y ?? 24)))
})

const resolveMediaUrl = (url: string) => {
    return url ? getImageUrl(url) : ''
}

const visionModelLabel = (model: any) => {
    const name = String(model?.name || model?.model_code || model?.id || '')
    const code = String(model?.model_code || '')
    return code && code !== name ? `${name} (${code})` : name
}

const dependencyChannelText = (row: any) => {
    if (!row?.channel_ready) {
        return '不可用'
    }
    const count = Number(row.channel_count || 0)
    return count > 0 ? `已配置 ${count} 个` : '已配置'
}

const dependencyAvailable = (row: any) => {
    return Boolean(row?.available ?? row?.tenant_enabled)
}

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcShortDramaConfig()
        formData.status = Number(data?.status ?? 1)
        formData.force_result_transfer = Number(data?.force_result_transfer ? 1 : 0)
        formData.result_storage_engine = String(data?.result_storage_engine || '')
        resultStorageOptions.value = Array.isArray(data?.result_storage_options) ? data.result_storage_options : []
        formData.background = {
            type: data?.background?.type || 'video',
            items: normalizeBackgroundItems(data?.background?.items || [])
        }
        formData.ratios = data?.ratios || []
        formData.models = data?.models || []
        const modelGroups = Array.isArray(data?.model_groups) ? data.model_groups : []
        const scriptGroup = modelGroups.find((item: any) => item?.key === 'script_plan')
        scriptModelOptions.value = Array.isArray(scriptGroup?.options) ? scriptGroup.options : []
        const visionGroup = modelGroups.find((item: any) => item?.key === 'vision_describe')
        visionModelOptions.value = Array.isArray(visionGroup?.options) ? visionGroup.options : []
        formData.script_plan_model_id = String(data?.script_plan_model_id || data?.script_plan_model_selection?.id || '')
        formData.vision_model_id = String(data?.vision_model_id || data?.vision_model_selection?.id || '')
        formData.prompt_max_length = Number(data?.prompt_max_length ?? 20000)
        formData.storyboard_rules = normalizeStoryboardRules(data?.storyboard_rules || [])
        formData.export_watermark = normalizeExportWatermark(data?.export_watermark || {})
        displayConfig.value = data?.display_config || {}
        dependencies.value = data?.dependencies || { items: [], ready: false }
        ensureBackground()
    } finally {
        loading.value = false
    }
}

const addBackground = () => {
    formData.background.items.push({ url: '', poster_url: '' })
}

const removeBackground = (index: number) => {
    formData.background.items.splice(index, 1)
    ensureBackground()
}

const handleSubmit = async () => {
    if (formData.force_result_transfer && !formData.result_storage_engine) {
        ElMessage.warning('开启强制转存后请选择存储方式')
        return
    }
    saving.value = true
    try {
        await setAigcShortDramaConfig({
            status: formData.status,
            force_result_transfer: formData.force_result_transfer,
            result_storage_engine: formData.result_storage_engine,
            background: {
                type: formData.background.type,
                items: formData.background.items.filter((item) => item.url)
            },
            ratios: formData.ratios,
            models: formData.models,
            script_plan_model_id: formData.script_plan_model_id,
            vision_model_id: formData.vision_model_id,
            prompt_max_length: formData.prompt_max_length,
            storyboard_rules: normalizeStoryboardRules(formData.storyboard_rules),
            export_watermark: normalizeExportWatermark(formData.export_watermark),
            display_config: displayConfig.value
        })
        await getData()
    } finally {
        saving.value = false
    }
}

const normalizeStoryboardRules = (rules: any[] = []) => {
    const source = Array.isArray(rules) && rules.length ? rules : defaultStoryboardRules()
    return source.map((item: any, index: number) => {
        const minShots = Math.max(1, Math.min(300, Number(item?.min_shots ?? 1)))
        const maxShots = Math.max(0, Math.min(500, Number(item?.max_shots ?? 0)))
        return {
            code: String(item?.code || `custom_${index + 1}`),
            label: String(item?.label || item?.code || '自定义档位').slice(0, 60),
            description: String(item?.description || '').slice(0, 500),
            min_shots: minShots,
            max_shots: maxShots > 0 && maxShots < minShots ? minShots : maxShots,
            sort: Number(item?.sort ?? (index + 1) * 10),
            enabled: item?.enabled !== false
        }
    })
}

const syncStoryboardRuleRange = (row: any) => {
    row.min_shots = Math.max(1, Math.min(300, Number(row.min_shots || 1)))
    row.max_shots = Math.max(0, Math.min(500, Number(row.max_shots || 0)))
    if (row.max_shots > 0 && row.max_shots < row.min_shots) {
        row.max_shots = row.min_shots
    }
}

const addStoryboardRule = () => {
    const next = formData.storyboard_rules.length + 1
    formData.storyboard_rules.push({
        code: `custom_${Date.now()}`,
        label: `自定义档位${next}`,
        description: '',
        min_shots: 20,
        max_shots: 35,
        sort: next * 10,
        enabled: true
    })
}

const removeStoryboardRule = (index: number) => {
    formData.storyboard_rules.splice(index, 1)
    if (!formData.storyboard_rules.length) {
        resetStoryboardRules()
    }
}

const resetStoryboardRules = () => {
    formData.storyboard_rules = normalizeStoryboardRules(defaultStoryboardRules())
}

getData()
</script>

<style lang="scss" scoped>
.background-list {
    width: min(100%, 820px);
}

.prompt-limit-field {
    display: flex;
    align-items: center;
    gap: 12px;
}

.result-transfer-field {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(100%, 760px);
}

.result-transfer-field > span,
.result-transfer-empty {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 20px;
}

.result-transfer-empty {
    margin-top: 8px;
}

.vision-model-field {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(100%, 740px);
}

.vision-model-select {
    width: min(100%, 420px);
    flex: 0 1 420px;
}

.vision-model-field > span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.vision-model-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.vision-model-option__code {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 18px;
}

.prompt-limit-field span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.storyboard-rule-panel {
    width: min(100%, 1100px);
}

.storyboard-rule-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
}

.background-row {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) 52px;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.background-info {
    min-width: 0;
}

.background-info__title {
    color: var(--el-text-color-primary);
    font-size: 14px;
    line-height: 22px;
}

.background-info__url {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.material-upload-button {
    width: 88px;
    height: 88px;
    border: 1px dashed var(--el-border-color);
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
}

.watermark-panel {
    display: flex;
    align-items: flex-start;
    gap: 20px;
}

.watermark-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.watermark-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
}
</style>
