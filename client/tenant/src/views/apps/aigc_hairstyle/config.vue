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
                <el-form-item label="默认操作">
                    <el-radio-group v-model="formData.default_operation">
                        <el-radio
                            v-for="item in operationOptions"
                            :key="item.value"
                            :value="item.value"
                        >
                            {{ item.label }}
                        </el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="默认模型">
                    <el-select
                        v-model="formData.config_json.channel"
                        class="!w-[360px]"
                        placeholder="跟随AIGC生图默认通道"
                        clearable
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
                        class="!w-[240px]"
                        placeholder="跟随模型默认清晰度"
                        clearable
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
                        class="!w-[240px]"
                        placeholder="跟随模型默认比例"
                        clearable
                    >
                        <el-option
                            v-for="ratio in ratioOptions"
                            :key="ratio.value"
                            :label="ratio.label"
                            :value="ratio.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="生成数量">
                    <el-input-number
                        v-model="formData.config_json.quantity"
                        :min="1"
                        :max="4"
                        :step="1"
                    />
                </el-form-item>
                <el-form-item label="操作售价">
                    <div class="price-grid">
                        <div v-for="item in operationOptions" :key="item.value" class="price-item">
                            <span>{{ item.label }}每张</span>
                            <el-input-number
                                v-model="formData.config_json.operation_prices[item.value]"
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
                        maxlength="1000"
                        show-word-limit
                        placeholder="支持变量：{person_image}、{reference_image}、{operation}、{user_prompt}"
                    />
                </el-form-item>
                <el-form-item label="负向提示词">
                    <el-input
                        v-model="formData.negative_prompt"
                        type="textarea"
                        :rows="4"
                        maxlength="500"
                        show-word-limit
                    />
                </el-form-item>
                <el-form-item label="人物图示例">
                    <div class="example-manager">
                        <div class="example-manager__toolbar">
                            <el-button
                                type="primary"
                                @click="openExampleMaterialPicker('person_examples')"
                            >
                                素材库上传人物图
                            </el-button>
                            <span>PC 端人物原图下方展示，最多 12 张</span>
                        </div>
                        <div class="example-manager__grid">
                            <div
                                v-for="(item, index) in formData.config_json.person_examples"
                                :key="`${item.image}-${index}`"
                                class="example-manager__item"
                            >
                                <el-image
                                    class="example-manager__image"
                                    :src="item.image"
                                    fit="cover"
                                />
                                <el-input v-model="item.name" size="small" placeholder="示例名称" />
                                <div class="example-manager__actions">
                                    <el-button
                                        link
                                        :disabled="index === 0"
                                        @click="moveExample('person_examples', index, -1)"
                                        >上移</el-button
                                    >
                                    <el-button
                                        link
                                        :disabled="
                                            index ===
                                            formData.config_json.person_examples.length - 1
                                        "
                                        @click="moveExample('person_examples', index, 1)"
                                        >下移</el-button
                                    >
                                    <el-button
                                        type="danger"
                                        link
                                        @click="removeExample('person_examples', index)"
                                        >删除</el-button
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </el-form-item>
                <el-form-item label="发型图示例">
                    <div class="example-manager">
                        <div class="example-manager__toolbar">
                            <el-button
                                type="primary"
                                @click="openExampleMaterialPicker('hairstyle_examples')"
                            >
                                素材库上传发型图
                            </el-button>
                            <span>PC 端发型参考图下方展示，最多 12 张</span>
                        </div>
                        <div class="example-manager__grid">
                            <div
                                v-for="(item, index) in formData.config_json.hairstyle_examples"
                                :key="`${item.image}-${index}`"
                                class="example-manager__item"
                            >
                                <el-image
                                    class="example-manager__image"
                                    :src="item.image"
                                    fit="cover"
                                />
                                <el-input v-model="item.name" size="small" placeholder="示例名称" />
                                <div class="example-manager__actions">
                                    <el-button
                                        link
                                        :disabled="index === 0"
                                        @click="moveExample('hairstyle_examples', index, -1)"
                                        >上移</el-button
                                    >
                                    <el-button
                                        link
                                        :disabled="
                                            index ===
                                            formData.config_json.hairstyle_examples.length - 1
                                        "
                                        @click="moveExample('hairstyle_examples', index, 1)"
                                        >下移</el-button
                                    >
                                    <el-button
                                        type="danger"
                                        link
                                        @click="removeExample('hairstyle_examples', index)"
                                        >删除</el-button
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="handleSubmit"
                        >保存</el-button
                    >
                </el-form-item>
            </el-form>
        </el-card>
        <material-picker
            ref="exampleMaterialPickerRef"
            v-model="exampleMaterialPickerValue"
            type="image"
            :limit="exampleMaterialPickerLimit"
            hidden-upload
            @change="handleExampleMaterialChange"
        />
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-hairstyle-config">
import { getAigcHairstyleConfig, setAigcHairstyleConfig } from '@/apps/aigc_hairstyle/api'
import MaterialPicker from '@/components/material/picker.vue'
import feedback from '@/utils/feedback'
import AppDisplayConfig from '@/views/apps/components/app-display-config.vue'

type ExampleKey = 'person_examples' | 'hairstyle_examples'
type ExampleImage = {
    id?: string
    name: string
    image: string
}

const loading = ref(false)
const saving = ref(false)
const operationOptions = ref<any[]>([])
const optionConfig = ref<any>({})
const displayConfig = ref<Record<string, any>>({})
const activeExampleKey = ref<ExampleKey>('person_examples')
const exampleMaterialPickerRef = shallowRef<InstanceType<typeof MaterialPicker>>()
const exampleMaterialPickerValue = ref<string[]>([])
const defaultOperationPrices = {
    hair_style: 10,
    hair_color: 10,
    hair_style_color: 12
}
const formData = reactive({
    status: 1,
    default_operation: 'hair_style_color',
    prompt_template: '',
    negative_prompt: '',
    config_json: {
        channel: '',
        quality: '',
        ratio: '',
        quantity: 1,
        operation_prices: { ...defaultOperationPrices } as Record<string, number>,
        person_examples: [] as ExampleImage[],
        hairstyle_examples: [] as ExampleImage[]
    }
})

const channels = computed(() => optionConfig.value?.channels || [])
const activeChannel = computed(
    () =>
        channels.value.find((item: any) => item.code === formData.config_json.channel) ||
        channels.value[0] ||
        {}
)
const qualityOptions = computed(() =>
    (activeChannel.value?.qualities || []).map((item: any) => ({
        label: item.label || item.quality_label || item.value,
        value: item.value
    }))
)
const activeQuality = computed(
    () =>
        (activeChannel.value?.qualities || []).find(
            (item: any) => item.value === formData.config_json.quality
        ) ||
        (activeChannel.value?.qualities || [])[0] ||
        {}
)
const ratioOptions = computed(() =>
    (activeQuality.value?.ratios || []).map((item: any) => ({
        label: item.label || item.ratio || item.value,
        value: item.value || item.ratio
    }))
)
const exampleMaterialPickerLimit = computed(() => {
    const count = formData.config_json[activeExampleKey.value].length
    return Math.max(1, 12 - count)
})

const syncDefaultSpec = () => {
    if (!qualityOptions.value.some((item: any) => item.value === formData.config_json.quality)) {
        formData.config_json.quality = qualityOptions.value[0]?.value || ''
    }
    syncDefaultRatio()
}

const syncDefaultRatio = () => {
    if (!ratioOptions.value.some((item: any) => item.value === formData.config_json.ratio)) {
        formData.config_json.ratio = ratioOptions.value[0]?.value || ''
    }
}

const normalizeExamples = (items: any[] = []) =>
    (Array.isArray(items) ? items : [])
        .map((item: any, index: number) => ({
            id: String(item?.id || item?.image || item?.url || index),
            name: String(item?.name || `示例图${index + 1}`),
            image: String(item?.image || item?.url || item?.uri || '')
        }))
        .filter((item) => item.image)
        .slice(0, 12)

const normalizeOperationPrices = (prices: Record<string, any> = {}) => ({
    hair_style: Number(prices?.hair_style ?? defaultOperationPrices.hair_style),
    hair_color: Number(prices?.hair_color ?? defaultOperationPrices.hair_color),
    hair_style_color: Number(prices?.hair_style_color ?? defaultOperationPrices.hair_style_color)
})

const openExampleMaterialPicker = (key: ExampleKey) => {
    const list = formData.config_json[key]
    if (list.length >= 12) {
        feedback.msgWarning('最多添加 12 张示例图')
        return
    }
    activeExampleKey.value = key
    exampleMaterialPickerValue.value = []
    exampleMaterialPickerRef.value?.showPopup(-1)
}

const normalizeMaterialUrls = (value: unknown) => {
    const values = Array.isArray(value) ? value : value ? [value] : []
    return values
        .map((item: any) => String(item?.url || item?.uri || item || '').trim())
        .filter(Boolean)
}

const handleExampleMaterialChange = (value: unknown) => {
    const key = activeExampleKey.value
    const list = formData.config_json[key]
    const exists = new Set(list.map((item) => item.image))
    const urls = normalizeMaterialUrls(value).filter((url) => !exists.has(url))
    const remaining = 12 - list.length
    if (remaining <= 0) {
        feedback.msgWarning('最多添加 12 张示例图')
        return
    }
    urls.slice(0, remaining).forEach((image) => {
        list.push({
            id: image,
            name: `示例图${list.length + 1}`,
            image
        })
    })
    if (urls.length > remaining) {
        feedback.msgWarning('最多添加 12 张示例图，已自动截取')
    }
    if (!urls.length && normalizeMaterialUrls(value).length) {
        feedback.msgWarning('选择的示例图已存在')
    }
    exampleMaterialPickerValue.value = []
}

const removeExample = (key: ExampleKey, index: number) => {
    formData.config_json[key].splice(index, 1)
}

const moveExample = (key: ExampleKey, index: number, offset: number) => {
    const target = index + offset
    const list = formData.config_json[key]
    if (target < 0 || target >= list.length) return
    const [item] = list.splice(index, 1)
    list.splice(target, 0, item)
}

const getData = async () => {
    loading.value = true
    try {
        const data: any = await getAigcHairstyleConfig()
        Object.assign(formData, {
            status: Number(data?.status ?? 1),
            default_operation: data?.default_operation || 'hair_style_color',
            prompt_template: data?.prompt_template || '',
            negative_prompt: data?.negative_prompt || '',
            config_json: {
                channel: data?.config_json?.channel || '',
                quality: data?.config_json?.quality || '',
                ratio: data?.config_json?.ratio || '',
                quantity: Number(data?.config_json?.quantity || 1),
                operation_prices: normalizeOperationPrices(data?.config_json?.operation_prices),
                person_examples: normalizeExamples(data?.config_json?.person_examples),
                hairstyle_examples: normalizeExamples(data?.config_json?.hairstyle_examples)
            }
        })
        operationOptions.value = data?.operation_options || []
        optionConfig.value = data?.option_config || {}
        displayConfig.value = data?.display_config || {}
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
    saving.value = true
    try {
        await setAigcHairstyleConfig({
            status: formData.status,
            default_operation: formData.default_operation,
            prompt_template: formData.prompt_template,
            negative_prompt: formData.negative_prompt,
            config_json: formData.config_json,
            display_config: displayConfig.value
        })
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

.example-manager {
    width: 100%;
}

.example-manager__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.example-manager__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
}

.example-manager__item {
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    padding: 10px;
    background: var(--el-bg-color);
}

.example-manager__image {
    width: 100%;
    height: 104px;
    border-radius: 4px;
    margin-bottom: 8px;
    background: var(--el-fill-color-light);
}

.example-manager__actions {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
}
</style>
