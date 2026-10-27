<template>
    <div class="aigc-image-page">
        <section class="image-workspace">
            <div class="creator-panel">
                <div class="creator-head">
                    <div>
                        <p>AIGC IMAGE</p>
                        <h1>{{ toolDisplayName }}</h1>
                    </div>
                    <button class="icon-button" type="button" title="刷新" @click="refreshAll">
                        <span>↻</span>
                    </button>
                </div>

                <label class="field-label" for="image-prompt">创作内容描述</label>
                <ElInput
                    id="image-prompt"
                    v-model="form.prompt"
                    type="textarea"
                    :rows="8"
                    maxlength="5000"
                    show-word-limit
                    resize="none"
                    placeholder="描述主体、场景、风格、构图、光线和画面细节..."
                />

                <div class="reference-block">
                    <div class="field-row">
                        <span>参考图</span>
                        <span>{{ referenceImages.length }}/{{ maxReferenceCount }}</span>
                    </div>
                    <div class="reference-list">
                        <button
                            v-for="(asset, index) in referenceImages"
                            :key="asset.uri"
                            class="reference-item"
                            type="button"
                            @click="previewReference(index)"
                        >
                            <img :src="asset.url" :alt="asset.name || '参考图'" />
                            <span @click.stop="removeReferenceImage(index)">×</span>
                        </button>
                        <button
                            v-if="referenceImages.length < maxReferenceCount"
                            class="reference-add"
                            type="button"
                            :disabled="uploading || !maxReferenceCount"
                            @click="triggerUpload"
                        >
                            <span>＋</span>
                            <strong>{{ uploading ? '上传中' : '上传参考图' }}</strong>
                        </button>
                    </div>
                    <input ref="fileInputRef" class="sr-only" type="file" accept="image/*" multiple @change="handleUpload" />
                </div>

                <div v-if="modelChoices.length > 1" class="option-group">
                    <div class="field-label">模型</div>
                    <div class="chip-grid">
                        <button
                            v-for="item in modelChoices"
                            :key="item.value"
                            :class="['chip', { 'is-active': isModelChoiceSelected(item.value) }]"
                            type="button"
                            @click="selectModelChoice(item.value)"
                        >
                            {{ item.label }}
                        </button>
                    </div>
                </div>

                <template v-if="isNanoBananaChannel">
                    <div v-if="nanoSeriesOptions.length > 1" class="option-group">
                        <div class="field-label">系列</div>
                        <div class="chip-grid chip-grid--tight">
                            <button
                                v-for="item in nanoSeriesOptions"
                                :key="item.value"
                                :class="['chip', { 'is-active': activeNanoSeries === item.value }]"
                                type="button"
                                @click="selectNanoSeries(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>

                    <div v-if="nanoVariants.length > 1" class="option-group">
                        <div class="field-label">版本</div>
                        <div class="chip-grid chip-grid--tight">
                            <button
                                v-for="item in nanoVariants"
                                :key="item.value"
                                :class="['chip', { 'is-active': form.channel === item.value }]"
                                type="button"
                                @click="selectChannel(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>
                </template>

                <div class="option-grid">
                    <div class="option-group">
                        <div class="field-label">清晰度</div>
                        <div class="chip-grid chip-grid--tight">
                            <button
                                v-for="item in qualities"
                                :key="item.value"
                                :class="['chip', { 'is-active': form.quality === item.value }]"
                                type="button"
                                @click="selectQuality(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>

                    <div class="option-group">
                        <div class="field-label">图片比例</div>
                        <div class="chip-grid chip-grid--tight">
                            <button
                                v-for="item in ratios"
                                :key="item.value"
                                :class="['chip', { 'is-active': form.ratio === item.value }]"
                                type="button"
                                @click="selectRatio(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>

                    <div class="option-group">
                        <div class="field-label">生成数量</div>
                        <div class="chip-grid chip-grid--tight">
                            <button
                                v-for="item in quantityOptions"
                                :key="item"
                                :class="['chip', { 'is-active': form.quantity === item }]"
                                type="button"
                                @click="selectQuantity(item)"
                            >
                                {{ item }}张
                            </button>
                        </div>
                    </div>

                    <div class="option-group">
                        <div class="field-label">风格</div>
                        <div class="chip-grid chip-grid--tight">
                            <button
                                v-for="item in styleOptions"
                                :key="item.value"
                                :class="['chip', { 'is-active': form.style === item.value }]"
                                type="button"
                                @click="form.style = item.value"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="negative-field">
                    <label class="field-label" for="negative-prompt">反向描述</label>
                    <ElInput
                        id="negative-prompt"
                        v-model="form.negative_prompt"
                        placeholder="可选，输入不希望出现的画面元素"
                    />
                </div>

                <div class="submit-bar">
                    <div>
                        <span>预计消耗</span>
                        <strong>{{ formatPoint(estimatedCost) }}</strong>
                    </div>
                    <ElButton
                        type="primary"
                        size="large"
                        :loading="submitting || isGenerateLocked"
                        :disabled="!canSubmit || isGenerateLocked"
                        @click="handleGenerateLock"
                    >
                        生成图片
                    </ElButton>
                </div>
            </div>

            <div class="result-panel">
                <div class="panel-head">
                    <div>
                        <p>RESULTS</p>
                        <h2>作品与任务</h2>
                    </div>
                    <div class="status-tabs">
                        <button
                            v-for="item in statusTabs"
                            :key="item.value"
                            :class="{ 'is-active': resultStatus === item.value }"
                            type="button"
                            @click="switchStatus(item.value)"
                        >
                            {{ item.label }}
                        </button>
                    </div>
                </div>

                <div v-if="results.length" class="result-grid">
                    <article v-for="item in results" :key="item.result_id || item.id" class="result-card">
                        <ElImage
                            v-if="normalizeImageUrl(item.image_url || item.image_uri)"
                            :src="normalizeImageUrl(item.image_url || item.image_uri)"
                            fit="cover"
                            :preview-src-list="[normalizeImageUrl(item.image_url || item.image_uri)]"
                            preview-teleported
                        />
                        <div v-else class="image-placeholder" :class="`is-${item.status}`">
                            <span>{{ statusText(item.status) }}</span>
                        </div>
                        <div class="result-body">
                            <div class="result-meta">
                                <span>{{ formatSpec(item) }}</span>
                                <span>{{ formatTime(item.create_time) }}</span>
                            </div>
                            <p>{{ item.prompt || '图片作品' }}</p>
                            <div class="result-actions">
                                <button type="button" @click="reuseResult(item)">复用</button>
                                <button type="button" @click="handleDelete(item.result_id || item.id)">删除</button>
                            </div>
                        </div>
                    </article>
                </div>
                <div v-else class="empty-state">
                    <span>▧</span>
                    <strong>暂无图片作品</strong>
                    <p>提交任务后，生成进度和结果会在这里刷新。</p>
                </div>

                <div class="task-panel">
                    <div class="task-head">
                        <strong>最近任务</strong>
                        <span v-if="polling">生成中，自动刷新</span>
                    </div>
                    <div class="task-table-wrap">
                        <ElTable :data="tasks" size="large" class="dark-table">
                            <ElTableColumn label="ID" prop="id" width="80" />
                            <ElTableColumn label="提示词" prop="prompt" min-width="240" show-overflow-tooltip />
                            <ElTableColumn label="模型" prop="channel" width="160" />
                            <ElTableColumn label="清晰度" width="100">
                                <template #default="{ row }">{{ qualityLabel(row.quality) }}</template>
                            </ElTableColumn>
                            <ElTableColumn label="比例" prop="ratio" width="90" />
                            <ElTableColumn label="数量" prop="quantity" width="80" />
                            <ElTableColumn label="状态" width="100">
                                <template #default="{ row }">{{ statusText(row.status) }}</template>
                            </ElTableColumn>
                        </ElTable>
                    </div>
                </div>
            </div>
        </section>
        <ElImageViewer
            v-if="previewVisible"
            :url-list="referenceImages.map((item) => item.url)"
            :initial-index="previewIndex"
            @close="previewVisible = false"
        />
    </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElButton, ElImage, ElImageViewer, ElInput, ElTable, ElTableColumn } from 'element-plus'
import { uploadImage as uploadAppImage } from '@/api/app'
import {
    deleteAigcImageResult,
    estimateAigcImage,
    generateAigcImage,
    getAigcImageConfig,
    getAigcImageResults,
    getAigcImageTasks
} from '@/apps/aigc_image/api'
import { isPcLoginRequiredError, usePcLoginGate } from '@/composables/usePcLoginGate'
import { useUserStore } from '@/stores/user'
import feedback from '@/utils/feedback'
import { normalizeFileUrl } from '@/utils/file-url'
import { getApiUrl } from '@/utils/env'
import { resolveToolDisplayName } from '@/apps/useToolDisplayName'

interface RatioOption {
    label: string
    value: string
    width?: number
    height?: number
    tenant_unit_price?: string | number
}

interface QualityOption {
    label: string
    value: string
    ratios: RatioOption[]
}

interface ChannelOption {
    label: string
    value: string
    model?: string
    display_group?: string
    display_group_label?: string
    display_series?: string
    display_series_label?: string
    display_variant_label?: string
    max_reference_images?: number
    quantity_options?: number[]
    qualities: QualityOption[]
}

interface ReferenceImage {
    uri: string
    url: string
    name: string
    objectUrl?: string
}

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const submitting = ref(false)
const uploading = ref(false)
const tasks = ref<any[]>([])
const results = ref<any[]>([])
const resultStatus = ref('')
const polling = ref(false)
const estimateInfo = ref<any>({})
const appConfig = ref<any>({})
const fileInputRef = ref<HTMLInputElement | null>(null)
const previewVisible = ref(false)
const previewIndex = ref(0)
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()
let pollTimer: ReturnType<typeof setInterval> | null = null
let estimateSeq = 0

const optionConfig = ref<any>({
    channels: [],
    defaults: {
        channel: 'gpt_image_2',
        quality: '1k',
        ratio: '1:1',
        quantity: 1
    },
    quantity_options: [1],
    max_reference_images: 4
})

const form = reactive({
    prompt: '',
    channel: 'gpt_image_2',
    quality: '1k',
    ratio: '1:1',
    quantity: 1,
    style: 'general',
    negative_prompt: ''
})
const referenceImages = ref<ReferenceImage[]>([])
const toolDisplayName = computed(() => resolveToolDisplayName(appConfig.value, '图片生成'))

const styleOptions = [
    { label: '通用', value: 'general' },
    { label: '写实', value: 'realistic' },
    { label: '插画', value: 'illustration' }
]

const statusTabs = [
    { label: '全部', value: '' },
    { label: '生成中', value: 'running' },
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failed' }
]

const channels = computed<ChannelOption[]>(() =>
    (optionConfig.value.channels || []).map((channel: any) => ({
        label: channel.label || channel.name || channel.code,
        value: channel.value || channel.code,
        model: String(channel.model || ''),
        display_group: String(channel.display_group || ''),
        display_group_label: String(channel.display_group_label || ''),
        display_series: String(channel.display_series || ''),
        display_series_label: String(channel.display_series_label || ''),
        display_variant_label: String(channel.display_variant_label || channel.label || channel.name || channel.code),
        max_reference_images: Number(channel.max_reference_images || optionConfig.value.max_reference_images || 0),
        quantity_options: (channel.quantity_options || optionConfig.value.quantity_options || [1])
            .map((item: any) => Number(item))
            .filter(Boolean),
        qualities: (channel.qualities || []).map((quality: any) => ({
            label: quality.label || quality.quality_label || String(quality.value || quality.quality || '').toUpperCase(),
            value: String(quality.value || quality.quality),
            ratios: (quality.ratios || []).map((ratio: any) => ({
                ...ratio,
                label: ratio.label || ratio.ratio || ratio.value,
                value: String(ratio.value || ratio.ratio)
            }))
        }))
    }))
)
const currentChannel = computed(() => channels.value.find((item) => item.value === form.channel) || channels.value[0])
const isNanoBananaChannel = computed(() => currentChannel.value?.display_group === 'nano_banana' || currentChannel.value?.value.startsWith('market_nano_banana:'))
const nanoChannels = computed(() => channels.value.filter((item) => item.display_group === 'nano_banana' || item.value.startsWith('market_nano_banana:')))
const nanoGroupLabel = computed(() => nanoChannels.value[0]?.display_group_label || 'Nano Banana')
const modelChoices = computed(() => {
    const normal = channels.value.filter((item) => !nanoChannels.value.some((nano) => nano.value === item.value))
    return nanoChannels.value.length ? [...normal, { value: 'nano_banana', label: nanoGroupLabel.value }] : normal
})
const activeNanoSeries = computed(() => currentChannel.value?.display_series || (String(currentChannel.value?.model || '').includes(':official') ? 'official' : 'common'))
const nanoSeriesOptions = computed(() => {
    const seen = new Set<string>()
    return nanoChannels.value.reduce<Array<{ value: string, label: string }>>((items, item) => {
        const value = item.display_series || (String(item.model || '').includes(':official') ? 'official' : 'common')
        if (seen.has(value)) return items
        seen.add(value)
        items.push({ value, label: item.display_series_label || (value === 'official' ? '官方' : '常规') })
        return items
    }, [])
})
const nanoVariants = computed(() => nanoChannels.value
    .filter((item) => (item.display_series || (String(item.model || '').includes(':official') ? 'official' : 'common')) === activeNanoSeries.value)
    .map((item) => ({ value: item.value, label: item.display_variant_label || item.label })))
const qualities = computed<QualityOption[]>(() => currentChannel.value?.qualities || [])
const currentQuality = computed(() => qualities.value.find((item) => item.value === form.quality) || qualities.value[0])
const ratios = computed<RatioOption[]>(() => currentQuality.value?.ratios || [])
const currentSpec = computed(() => ratios.value.find((item) => item.value === form.ratio) || ratios.value[0])
const quantityOptions = computed(() => {
    return [1, 2, 3, 4]
})
const maxReferenceCount = computed(() => Number(currentChannel.value?.max_reference_images || optionConfig.value.max_reference_images || 0))
const fallbackEstimatedCost = computed(() => {
    const unitPrice = Number(currentSpec.value?.tenant_unit_price || 0)
    return Number((unitPrice * Number(form.quantity || 1)).toFixed(4))
})
const estimatedCost = computed(() => {
    const backendCost = Number(estimateInfo.value?.user_charge_points)
    if (Number.isFinite(backendCost) && backendCost >= 0) {
        return Number(backendCost.toFixed(4))
    }
    return fallbackEstimatedCost.value
})
const canSubmit = computed(() => !!form.prompt.trim() && !!form.channel && !!form.quality && !!form.ratio && !submitting.value)

const pickUploadUri = (res: any) => res?.uri || res?.url || res?.path || res?.file_url || ''
const getRequestErrorMessage = (error: any, fallback: string) => {
    if (typeof error === 'string' && error.trim()) return error
    return error?.msg || error?.message || fallback
}

const normalizeImageUrl = (url: unknown) => {
    let raw = String(url || '').trim()
    if (!raw) return ''
    raw = raw.replace(/\\/g, '/')
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw
    }
    const normalized = normalizeFileUrl(raw)
    const apiUrl = String(getApiUrl() || '').replace(/\/+$/, '')
    if (apiUrl && normalized.startsWith('/uploads/')) {
        return `${apiUrl}${normalized}`
    }
    return normalized
}

const normalizeTimestamp = (value: unknown) => {
    if (typeof value === 'number' && value > 0) return value > 9999999999 ? Math.floor(value / 1000) : value
    if (typeof value === 'string' && value.trim()) {
        const numeric = Number(value)
        if (Number.isFinite(numeric) && numeric > 0) return numeric > 9999999999 ? Math.floor(numeric / 1000) : numeric
        const parsed = Date.parse(value.replace(/-/g, '/'))
        if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
    }
    return 0
}

const formatTime = (value: unknown) => {
    const timestamp = normalizeTimestamp(value)
    if (!timestamp) return '刚刚'
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(timestamp * 1000)
}

const qualityLabel = (value: string) => qualities.value.find((item) => item.value === String(value))?.label || (value ? String(value).toUpperCase() : '-')
const statusText = (value: string) => {
    const status = String(value || '')
    if (status === 'success') return '已完成'
    if (status === 'failed') return '生成失败'
    if (status === 'canceled') return '已取消'
    return '生成中'
}
const formatSpec = (item: any) => `${qualityLabel(item.quality)} · ${item.ratio || '-'}`

const buildEstimatePayload = () => ({
    prompt: form.prompt.trim() || 'estimate',
    reference_images: referenceImages.value.map((item) => item.uri),
    ratio: form.ratio,
    quality: form.quality,
    quantity: form.quantity,
    channel: form.channel,
    negative_prompt: form.negative_prompt
})

const updateEstimate = async () => {
    const seq = ++estimateSeq
    if (!form.channel || !form.quality || !form.ratio) {
        if (seq === estimateSeq) estimateInfo.value = {}
        return
    }
    try {
        const result = await estimateAigcImage(buildEstimatePayload(), { suppressErrorMessage: true })
        if (seq === estimateSeq) {
            estimateInfo.value = result
        }
    } catch {
        if (seq === estimateSeq) estimateInfo.value = {}
    }
}

const syncSelection = () => {
    if (!channels.value.length) return
    if (!channels.value.some((item) => item.value === form.channel)) {
        form.channel = optionConfig.value.defaults?.channel || channels.value[0].value
    }
    if (!channels.value.some((item) => item.value === form.channel)) {
        form.channel = channels.value[0].value
    }
    if (!qualities.value.some((item) => item.value === form.quality)) {
        form.quality = optionConfig.value.defaults?.quality || qualities.value[0]?.value || ''
    }
    if (!qualities.value.some((item) => item.value === form.quality)) {
        form.quality = qualities.value[0]?.value || ''
    }
    if (!ratios.value.some((item) => item.value === form.ratio)) {
        form.ratio = optionConfig.value.defaults?.ratio || ratios.value[0]?.value || ''
    }
    if (!ratios.value.some((item) => item.value === form.ratio)) {
        form.ratio = ratios.value[0]?.value || ''
    }
    if (!quantityOptions.value.includes(Number(form.quantity))) {
        form.quantity = quantityOptions.value[0] || 1
    }
    referenceImages.value = referenceImages.value.slice(0, maxReferenceCount.value)
}

const validateSelection = () => {
    if (!currentChannel.value?.value) return '暂无可用生图模型'
    if (!currentQuality.value?.value) return '请选择图片清晰度'
    if (!ratios.value.some((item) => item.value === form.ratio)) return '当前清晰度不支持所选比例'
    return ''
}

const loadConfig = async () => {
    appConfig.value = await getAigcImageConfig()
    optionConfig.value = appConfig.value?.option_config || optionConfig.value
    const defaults = optionConfig.value.defaults || {}
    form.channel = defaults.channel || form.channel
    form.quality = defaults.quality || form.quality
    form.ratio = defaults.ratio || form.ratio
    form.quantity = Number(defaults.quantity || form.quantity || 1)
    syncSelection()
}

const loadData = async () => {
    if (!userStore.isLogin) {
        tasks.value = []
        results.value = []
        stopPolling()
        return
    }
    try {
        const [taskList, resultList] = await Promise.all([
            getAigcImageTasks(),
            getAigcImageResults(resultStatus.value ? { status: resultStatus.value } : undefined)
        ])
        tasks.value = Array.isArray(taskList) ? taskList : []
        results.value = Array.isArray(resultList) ? resultList : []
        const hasRunning = [...tasks.value, ...results.value].some((item) => item.status === 'running')
        if (hasRunning) {
            startPolling()
        } else {
            stopPolling()
        }
    } catch (error) {
        if (isPcLoginRequiredError(error)) return
        throw error
    }
}

const refreshAll = async () => {
    await loadConfig()
    await updateEstimate()
    await loadData()
}

const startPolling = () => {
    polling.value = true
    if (pollTimer) return
    pollTimer = setInterval(() => {
        loadData()
    }, 5000)
}

const stopPolling = () => {
    polling.value = false
    if (!pollTimer) return
    clearInterval(pollTimer)
    pollTimer = null
}

const selectChannel = (value: string) => {
    form.channel = value
    form.quality = currentChannel.value?.qualities?.[0]?.value || form.quality
    form.ratio = currentQuality.value?.ratios?.[0]?.value || form.ratio
    syncSelection()
    updateEstimate()
}

const isModelChoiceSelected = (value: string) => value === 'nano_banana'
    ? isNanoBananaChannel.value
    : form.channel === value

const selectModelChoice = (value: string) => {
    if (value !== 'nano_banana') {
        selectChannel(value)
        return
    }
    const currentNano = nanoChannels.value.find((item) => item.value === form.channel)
    selectChannel(currentNano?.value || nanoChannels.value[0]?.value || form.channel)
}

const selectNanoSeries = (series: string) => {
    const next = nanoChannels.value.find((item) => (item.display_series || (String(item.model || '').includes(':official') ? 'official' : 'common')) === series)
    if (next) selectChannel(next.value)
}

const selectQuality = (value: string) => {
    const nextQuality = qualities.value.find((item) => item.value === value)
    form.quality = value
    form.ratio = nextQuality?.ratios?.[0]?.value || form.ratio
    syncSelection()
    updateEstimate()
}

const selectRatio = (value: string) => {
    form.ratio = value
    syncSelection()
    updateEstimate()
}

const selectQuantity = (value: number) => {
    form.quantity = value
    syncSelection()
    updateEstimate()
}

const triggerUpload = () => {
    if (!ensurePcLogin()) return
    fileInputRef.value?.click()
}

const handleUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || [])
    if (!files.length) return
    const remain = maxReferenceCount.value - referenceImages.value.length
    if (remain <= 0) {
        feedback.msgError(`最多上传${maxReferenceCount.value}张参考图`)
        input.value = ''
        return
    }
    uploading.value = true
    try {
        for (const file of files.slice(0, remain)) {
            if (!file.type.startsWith('image/')) {
                feedback.msgError('仅支持上传图片参考素材')
                continue
            }
            const objectUrl = URL.createObjectURL(file)
            try {
                const res: any = await uploadAppImage({ file })
                const uri = pickUploadUri(res)
                if (!uri) throw new Error('上传接口未返回图片地址')
                referenceImages.value.push({ uri, url: objectUrl, name: file.name, objectUrl })
            } catch (error) {
                URL.revokeObjectURL(objectUrl)
                throw error
            }
        }
        updateEstimate()
    } catch (error: any) {
        if (isPcLoginRequiredError(error)) return
        feedback.msgError(error?.msg || error?.message || '参考图上传失败')
    } finally {
        uploading.value = false
        input.value = ''
    }
}

const previewReference = (index: number) => {
    previewIndex.value = Math.max(0, index)
    previewVisible.value = true
}

const removeReferenceImage = (index: number) => {
    const [removed] = referenceImages.value.splice(index, 1)
    if (removed?.objectUrl) URL.revokeObjectURL(removed.objectUrl)
    updateEstimate()
}

const handleGenerate = async () => {
    if (submitting.value) return
    if (!form.prompt.trim()) return feedback.msgError('请输入创作内容描述')
    if (!ensurePcLogin()) return
    syncSelection()
    const selectionError = validateSelection()
    if (selectionError) return feedback.msgError(selectionError)
    submitting.value = true
    try {
        const submitCount = Number(form.quantity || 1)
        const batchKey = `pc-image-page-${Date.now()}`
        const responses: any[] = []
        for (let index = 0; index < submitCount; index += 1) {
            responses.push(await generateAigcImage({
                prompt: form.prompt.trim(),
                reference_images: referenceImages.value.map((item) => item.uri),
                ratio: form.ratio,
                quality: form.quality,
                quantity: 1,
                channel: form.channel,
                style: form.style,
                negative_prompt: form.negative_prompt,
                batch_key: `${batchKey}-${index + 1}`
            }, { suppressErrorMessage: true }))
        }
        const failed = responses.find((res) => res?.status === 'failed')
        if (failed) {
            feedback.msgError(failed?.error || '部分图片生成任务提交失败')
        } else {
            feedback.msgSuccess(`已提交${submitCount}条图片生成任务`)
            form.prompt = ''
            form.negative_prompt = ''
            startPolling()
        }
        await loadData()
    } catch (error: any) {
        if (isPcLoginRequiredError(error)) return
        feedback.msgError(getRequestErrorMessage(error, '提交生成任务失败'))
    } finally {
        submitting.value = false
    }
}
const { lockFn: handleGenerateLock, isLock: isGenerateLocked } = useLockFn(handleGenerate)

const reuseResult = (item: any) => {
    form.prompt = item.prompt || form.prompt
    form.channel = item.channel || form.channel
    form.quality = item.quality || form.quality
    form.ratio = item.ratio || form.ratio
    form.quantity = Number(item.quantity || form.quantity || 1)
    syncSelection()
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleDelete = async (id: number) => {
    if (!ensurePcLogin()) return
    try {
        await deleteAigcImageResult({ id })
        feedback.msgSuccess('删除成功')
        await loadData()
    } catch (error: any) {
        if (isPcLoginRequiredError(error)) return
        feedback.msgError(error?.msg || error?.message || '删除失败')
    }
}

const switchStatus = async (value: string) => {
    resultStatus.value = value
    await loadData()
}

onMounted(async () => {
    await loadConfig()
    await updateEstimate()
    await loadData()
})

watch(
    () => [
        form.channel,
        form.quality,
        form.ratio,
        form.quantity,
        referenceImages.value.map((item) => item.uri).join('|')
    ],
    () => updateEstimate()
)

watch(() => userStore.isLogin, async (loggedIn) => {
    if (!loggedIn) stopPolling()
    await loadData()
})

onBeforeUnmount(() => {
    stopPolling()
    referenceImages.value.forEach((item) => {
        if (item.objectUrl) URL.revokeObjectURL(item.objectUrl)
    })
})
</script>

<style lang="scss" scoped>
.aigc-image-page {
    min-height: 100vh;
    padding: 28px;
    background: #050505;
    color: #fff;
}

.image-workspace {
    display: grid;
    grid-template-columns: minmax(380px, 480px) minmax(0, 1fr);
    gap: 24px;
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
}

.creator-panel,
.result-panel,
.task-panel {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    background: #101012;
}

.creator-panel {
    position: sticky;
    top: 24px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    height: fit-content;
    padding: 22px;
}

.creator-head,
.panel-head,
.submit-bar,
.field-row,
.task-head,
.result-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.creator-head p,
.panel-head p {
    margin: 0 0 6px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
    letter-spacing: 0;
}

.creator-head h1,
.panel-head h2 {
    margin: 0;
    color: #fff;
    font-size: 24px;
    line-height: 1.2;
}

.icon-button,
.chip,
.reference-item,
.reference-add,
.status-tabs button,
.result-actions button {
    border: 0;
    cursor: pointer;
}

.icon-button {
    width: 42px;
    height: 42px;
    border-radius: 8px;
    background: #222;
    color: #fff;
    font-size: 20px;
}

.field-label,
.field-row {
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    font-weight: 600;
}

.reference-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.reference-list {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
}

.reference-item,
.reference-add {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    background: #171719;
    color: #fff;
}

.reference-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.reference-item span {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.62);
    color: #fff;
    line-height: 1;
}

.reference-add {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px dashed rgba(255, 255, 255, 0.26);
}

.reference-add span {
    font-size: 28px;
}

.reference-add strong {
    font-size: 13px;
}

.option-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
}

.option-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.chip-grid--tight .chip {
    min-width: 72px;
}

.chip {
    min-height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    background: #222;
    color: rgba(255, 255, 255, 0.68);
    font-size: 14px;
}

.chip.is-active {
    background: #fff;
    color: #08080a;
}

.negative-field {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.submit-bar {
    padding: 16px;
    border-radius: 8px;
    background: #171719;
}

.submit-bar span {
    display: block;
    margin-bottom: 4px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
}

.submit-bar strong {
    color: #fff;
    font-size: 20px;
}

.result-panel {
    min-width: 0;
    padding: 22px;
}

.status-tabs {
    display: flex;
    gap: 8px;
}

.status-tabs button {
    height: 34px;
    padding: 0 14px;
    border-radius: 8px;
    background: #222;
    color: rgba(255, 255, 255, 0.66);
}

.status-tabs button.is-active {
    background: #fff;
    color: #08080a;
}

.result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 22px;
}

.result-card {
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    background: #171719;
}

.result-card :deep(.el-image),
.image-placeholder {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    background: #222;
}

.image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.72);
}

.result-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
}

.result-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

.result-body p {
    display: -webkit-box;
    min-height: 42px;
    margin: 0;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.86);
    font-size: 14px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.result-actions button {
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    background: #222;
    color: rgba(255, 255, 255, 0.76);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    margin-top: 22px;
    border: 1px dashed rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.52);
    text-align: center;
}

.empty-state span {
    margin-bottom: 12px;
    font-size: 36px;
}

.empty-state strong {
    color: rgba(255, 255, 255, 0.82);
    font-size: 18px;
}

.empty-state p {
    margin: 8px 0 0;
}

.task-panel {
    margin-top: 22px;
    padding: 18px;
}

.task-head {
    margin-bottom: 12px;
}

.task-head span {
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

.task-table-wrap {
    width: 100%;
    overflow-x: auto;
}

.task-table-wrap :deep(.el-table) {
    min-width: 760px;
}

.dark-table {
    --el-table-bg-color: transparent;
    --el-table-tr-bg-color: transparent;
    --el-table-header-bg-color: #171719;
    --el-table-row-hover-bg-color: #222;
    --el-table-text-color: rgba(255, 255, 255, 0.78);
    --el-table-header-text-color: rgba(255, 255, 255, 0.58);
    --el-table-border-color: rgba(255, 255, 255, 0.08);
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}

:deep(.el-textarea__inner),
:deep(.el-input__wrapper) {
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: none;
    background: #171719;
    color: #fff;
}

:deep(.el-textarea__inner::placeholder),
:deep(.el-input__inner::placeholder) {
    color: rgba(255, 255, 255, 0.34);
}

@media (max-width: 1100px) {
    .image-workspace {
        grid-template-columns: 1fr;
    }

    .creator-panel {
        position: static;
    }
}
</style>
