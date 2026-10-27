<template>
    <div class="canvas-lib-node" :class="[`is-${variant}`, statusClass, { 'is-selected': selected }]" :data-node-id="id">
        <Handle v-if="hasTarget" type="target" :position="Position.Left" id="left" class="node-handle node-handle--target" />

        <div class="node-label">
            <span class="node-label-icon">{{ nodeIcon }}</span>
            <input class="node-title nodrag nopan" :value="data.title || fallbackTitle" @change="emitUpdate({ title: ($event.target as HTMLInputElement).value })" @mousedown.stop />
        </div>

        <div v-if="selected && !isBlankCreator" class="node-action-bar nodrag nopan" @mousedown.stop>
            <button v-if="canRun" type="button" @click="runNode">
                <Refresh />
                <span>重新生成</span>
            </button>
            <button v-if="variant === 'script' || variant === 'storyboardGroup'" type="button" @click="variant === 'storyboardGroup' ? splitStoryboard() : addConnected('storyboardGroup')">
                <Operation />
                <span>批量生成分镜</span>
            </button>
            <button v-if="['storyboardGroup', 'image', 'imageResult', 'videoConfig'].includes(variant)" type="button" @click="addConnected('videoConfig')">
                <Film />
                <span>批量生视频</span>
            </button>
            <button type="button" @click="duplicateNode">
                <CopyDocument />
                <span>下载</span>
            </button>
        </div>

        <main class="node-shell" @mousedown.stop>
            <section v-if="variant === 'text'" class="blank-preview blank-preview--text">
                <div class="blank-preview-icon blank-preview-icon--text">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div class="blank-try-list">
                    <small>尝试：</small>
                    <button type="button" @click="applyPreset('write')">自己编写内容</button>
                    <button type="button" @click="applyPreset('text_to_video')">文生视频</button>
                    <button type="button" @click="applyPreset('reverse_prompt')">图片反推提示词</button>
                    <button type="button" @click="applyPreset('text_to_music')">文字生音乐</button>
                </div>
                <input ref="fileInput" type="file" accept="image/*" @change="handleReferenceImageFile" />
            </section>

            <section v-else-if="variant === 'image'" class="blank-preview blank-preview--media">
                <img v-if="previewImage" :src="previewImage" alt="" />
                <div v-else class="blank-preview-icon">
                    <Picture />
                </div>
                <div v-if="!previewImage" class="blank-try-list">
                    <small>尝试：</small>
                    <button type="button" @click="applyPreset('image_to_image')">图生图</button>
                    <button type="button" @click="applyPreset('upscale')">图片高清</button>
                </div>
                <input ref="fileInput" type="file" accept="image/*" @change="handleImageFile" />
            </section>

            <section v-else-if="variant === 'video'" class="blank-preview blank-preview--media">
                <video v-if="data.url" :src="data.url" controls :poster="data.poster" />
                <img v-else-if="data.poster || data.image" :src="data.poster || data.image" alt="" />
                <div v-else class="blank-preview-icon">
                    <Film />
                </div>
                <div v-if="!data.url" class="blank-try-list">
                    <small>尝试：</small>
                    <button type="button" @click="applyPreset('first_last_frame')">首尾帧生成视频</button>
                    <button type="button" @click="applyPreset('first_frame')">首帧生成视频</button>
                </div>
                <input ref="fileInput" type="file" accept="image/*" @change="handleReferenceImageFile" />
                <input ref="videoInput" type="file" accept="video/*" @change="handleVideoFile" />
            </section>

            <section v-else-if="variant === 'imagePrompt' || variant === 'script'" class="node-text-view">
                <textarea class="node-text nodrag nopan" :value="textValue" :placeholder="textPlaceholder" @change="emitUpdate({ content: ($event.target as HTMLTextAreaElement).value })" />
            </section>

            <section v-else-if="variant === 'llmConfig' || variant === 'imageConfig' || variant === 'videoConfig'" class="node-generator">
                <div class="generator-status">
                    <span :class="{ active: !!promptText }">1</span>
                    <i />
                    <span :class="{ active: status === 'running' || status === 'success' }">2</span>
                    <i />
                    <span :class="{ active: status === 'success' }">3</span>
                </div>
                <strong>{{ fallbackTitle }}</strong>
                <p>{{ promptText || '连接脚本、图片或直接在下方输入提示词。' }}</p>
                <button type="button" class="open-source" @click="focusSourceNode">打开脚本节点 -></button>
                <small v-if="data.outputContent">{{ data.outputContent }}</small>
            </section>

            <section v-else-if="variant === 'imageResult' || variant === 'subject'" class="node-media">
                <img v-if="previewImage" :src="previewImage" alt="" />
                <button v-else type="button" class="node-upload nodrag nopan" @click="fileInput?.click()">
                    <Picture />
                    <span>{{ variant === 'subject' ? '上传角色图' : '上传图片' }}</span>
                </button>
                <p v-if="variant === 'subject'">{{ data.description || '角色节点可连接到分镜组、图片生成或视频生成节点。' }}</p>
                <input ref="fileInput" type="file" accept="image/*" @change="handleImageFile" />
            </section>

            <section v-else-if="variant === 'video'" class="node-media">
                <video v-if="data.url" :src="data.url" controls :poster="data.poster" />
                <button v-else type="button" class="node-upload nodrag nopan" @click="videoInput?.click()">
                    <Film />
                    <span>上传视频</span>
                </button>
                <input ref="videoInput" type="file" accept="video/*" @change="handleVideoFile" />
            </section>

            <section v-else-if="variant === 'audio'" class="node-audio">
                <audio v-if="data.url" :src="data.url" controls />
                <button v-else type="button" class="node-upload nodrag nopan" @click="audioInput?.click()">
                    <Headset />
                    <span>上传音频</span>
                </button>
                <input ref="audioInput" type="file" accept="audio/*" @change="handleAudioFile" />
            </section>

            <section v-else-if="variant === 'storyboardGroup'" class="node-storyboard">
                <article v-for="(shot, index) in shots.slice(0, 6)" :key="shot.shot_id || shot.id || index">
                    <span>{{ index + 1 }}</span>
                    <p>{{ shot.title || shot.visual_description || shot.prompt || '分镜' }}</p>
                </article>
                <p v-if="!shots.length">暂无分镜，可由脚本生成。</p>
            </section>

            <section v-else-if="variant === 'videoCompose'" class="node-compose">
                <div>
                    <span v-for="index in Math.max(clipCount, 3)" :key="index" :class="{ active: index <= clipCount }" />
                </div>
                <p>{{ clipCount ? `已连接 ${clipCount} 个片段` : '没有可合成的视频片段' }}</p>
            </section>

            <section v-else class="node-assets">
                <Files />
                <p>{{ assetCount ? `已收纳 ${assetCount} 个素材` : '从素材库选择资源后加入画布' }}</p>
            </section>

            <div v-if="!isBlankCreator && metaItems.length" class="node-meta">
                <span v-for="item in metaItems" :key="item">{{ item }}</span>
            </div>
            <p v-if="data.error" class="node-message is-error">{{ data.error }}</p>
            <p v-else-if="activityMessage" class="node-message">{{ activityMessage }}</p>

            <div v-if="!isBlankCreator" class="node-inline-actions nodrag nopan">
                <button v-if="canRun" type="button" @click="runNode">{{ status === 'running' ? '运行中' : '生成' }}</button>
                <button v-if="canSplitStoryboard" type="button" @click="splitStoryboard">拆分</button>
                <button type="button" @click="duplicateNode">复制</button>
                <button type="button" @click="removeNode">删除</button>
            </div>
        </main>

        <section v-if="isBlankCreator" class="blank-composer nodrag nopan" :class="[`blank-composer--${variant}`, { 'is-expanded': composerExpanded }]" @mousedown.stop>
            <div class="blank-composer-tags">
                <button v-for="tag in composerTags" :key="tag" type="button" :class="{ active: isComposerTagActive(tag) }" @click="handleComposerTag(tag)">{{ tag }}</button>
                <button class="blank-composer-expand" type="button" title="展开" @click="toggleComposerExpanded">↗</button>
            </div>
            <textarea
                ref="composerInput"
                :value="composerValue"
                :placeholder="composerPlaceholder"
                @input="updateComposer(($event.target as HTMLTextAreaElement).value)"
                @change="updateComposer(($event.target as HTMLTextAreaElement).value)"
            />
            <div class="blank-composer-foot">
                <button type="button" class="model-pill" @click="cycleModel">{{ data.model || defaultModelLabel }}</button>
                <button v-for="item in blankMetaItems" :key="item" class="meta-pill" type="button" @click="cycleMeta(item)">{{ item }}</button>
                <button class="composer-run" type="button" @click="runNode">
                    <Promotion />
                </button>
            </div>
        </section>

        <section v-if="selected && isGenerator" class="node-composer nodrag nopan" @mousedown.stop>
            <textarea :value="composerValue" placeholder="描述你想生成的内容" @change="updateComposer(($event.target as HTMLTextAreaElement).value)" />
            <div class="node-composer-foot">
                <button type="button" @click="emitUpdate({ model: data.model || defaultModelLabel })">{{ data.model || defaultModelLabel }}</button>
                <span>{{ promptCountLabel }}</span>
                <button class="composer-run" type="button" @click="runNode">
                    <Promotion />
                </button>
            </div>
        </section>

        <button v-if="hasSource" class="quick-add nodrag nopan" type="button" title="添加后续节点" @click.stop="showQuick = !showQuick">
            <Plus />
        </button>
        <div v-if="showQuick" class="quick-menu nodrag nopan" @mousedown.stop>
            <button v-for="item in quickActions" :key="item.type" type="button" @click="addConnected(item.type)">{{ item.label }}</button>
        </div>
        <Handle v-if="hasSource" type="source" :position="Position.Right" id="right" class="node-handle node-handle--source" />
    </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, unref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { CopyDocument, Delete, Files, Film, Headset, Operation, Picture, Plus, Promotion, Refresh } from '@element-plus/icons-vue'

const props = defineProps<{
    id: string
    data: Record<string, any>
    selected?: boolean
}>()

const emit = defineEmits<{
    (event: 'update', id: string, data: Record<string, any>): void
    (event: 'duplicate', id: string): void
    (event: 'remove', id: string): void
    (event: 'add-connected', id: string, type: string): void
    (event: 'run', id: string): void
}>()

const nodeActions = inject<{
    update?: (id: string, data: Record<string, any>) => void
    duplicate?: (id: string) => void
    remove?: (id: string) => void
    addConnected?: (id: string, type: string) => void
    run?: (id: string) => void
    splitStoryboard?: (id: string) => void
    openDrawer?: (name: string) => void
    chatModels?: any
    imageModels?: any
    videoModels?: any
}>('aigcCanvasNodeActions', {})

const fileInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const audioInput = ref<HTMLInputElement | null>(null)
const composerInput = ref<HTMLTextAreaElement | null>(null)
const showQuick = ref(false)
const composerExpanded = ref(false)

const variant = computed(() => String(props.data.variant || 'text'))
const selected = computed(() => !!props.selected)
const status = computed(() => String(props.data.status || props.data.agentStatus || 'idle'))
const statusClass = computed(() => (status.value === 'running' ? 'is-running' : status.value === 'failed' ? 'is-failed' : status.value === 'success' ? 'is-success' : ''))
const hasTarget = computed(() => !['audio', 'assetLibrary'].includes(variant.value))
const hasSource = computed(() => quickActions.value.length > 0)
const canRun = computed(() => ['llmConfig', 'imageConfig', 'videoConfig', 'script', 'subject', 'storyboardGroup', 'videoCompose'].includes(variant.value))
const isGenerator = computed(() => ['llmConfig', 'imageConfig', 'videoConfig', 'script', 'storyboardGroup', 'videoCompose'].includes(variant.value))
const isBlankCreator = computed(() => ['text', 'image', 'video'].includes(variant.value))
const canSplitStoryboard = computed(() => variant.value === 'storyboardGroup' && !!shots.value.length && typeof nodeActions.splitStoryboard === 'function')
const previewImage = computed(() => props.data.image || props.data.url || props.data.threeViewImage || '')
const textValue = computed(() => props.data.content || props.data.prompt || props.data.outputContent || '')
const promptText = computed(() => props.data.prompt || props.data.systemPrompt || '')
const composerValue = computed(() => props.data.prompt || props.data.content || props.data.systemPrompt || '')
const textPlaceholder = computed(() => (variant.value === 'script' ? '生成或粘贴故事脚本' : '输入参考说明或提示词'))
const shots = computed<any[]>(() => (Array.isArray(props.data.shots) ? props.data.shots : []))
const clipCount = computed(() => (Array.isArray(props.data.clips) ? props.data.clips.length : 0))
const assetCount = computed(() => (Array.isArray(props.data.assets) ? props.data.assets.length : 0))
const modelOptions = computed(() => {
    if (variant.value === 'llmConfig') return unref(nodeActions.chatModels) || []
    if (variant.value === 'videoConfig') return unref(nodeActions.videoModels) || []
    return unref(nodeActions.imageModels) || []
})
const fallbackTitle = computed(() => nodeTitleMap[variant.value] || '节点')
const nodeIcon = computed(() => nodeIconMap[variant.value] || 'N')
const defaultModelLabel = computed(() => {
    if (variant.value === 'text' || variant.value === 'llmConfig' || variant.value === 'script') return 'GVLM 3.1'
    if (variant.value === 'video' || variant.value === 'videoConfig') return '文生视频'
    if (variant.value === 'image') return 'Lib Image'
    return '图片生成'
})
const promptCountLabel = computed(() => String(props.data.promptCount || props.data.referenceCount || shots.value.length || 1))
const composerPlaceholder = computed(() => {
    if (variant.value === 'text') return '写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。'
    if (variant.value === 'image') return '可直接文字生图，或上传图片输入文字指令对图片进行编辑。如：将背景改为雪夜'
    return '描述你想要生成的画面内容，也可以引用素材'
})
const composerTags = computed(() => {
    if (variant.value === 'text') return []
    if (variant.value === 'image') return ['+ 参考', '标记', '风格']
    return ['+ 参考', '标记', '特效', '角色库', '运镜']
})
const blankMetaItems = computed(() => {
    if (variant.value === 'text') return [String(props.data.cost || 6)]
    if (variant.value === 'image') return [String(props.data.ratio || '16:9'), String(props.data.quality || '标准画质'), String(props.data.resolution || '2K'), `${props.data.count || 1}张`]
    return [String(props.data.ratio || '16:9'), String(props.data.resolution || '720P'), `${props.data.duration || 5}s`, `${props.data.count || 1}个`, String(props.data.cost || 135)]
})
const metaItems = computed(() => {
    const items: string[] = []
    if (props.data.model) items.push(String(props.data.model))
    if (props.data.size || props.data.ratio) items.push(String(props.data.size || props.data.ratio))
    if (props.data.duration) items.push(`${props.data.duration}s`)
    if (props.data.quality) items.push(String(props.data.quality))
    if (props.data.referenceCount) items.push(`参考 ${props.data.referenceCount}`)
    if (shots.value.length) items.push(`分镜 ${shots.value.length}`)
    if (clipCount.value) items.push(`片段 ${clipCount.value}`)
    if (assetCount.value) items.push(`素材 ${assetCount.value}`)
    return items.slice(0, 4)
})
const activityMessage = computed(() => {
    if (props.data.currentStep) return String(props.data.currentStep)
    if (props.data.progress) return `进度 ${props.data.progress}%`
    if (props.data.billingTip) return String(props.data.billingTip)
    if (props.data.splitMessage) return String(props.data.splitMessage)
    return ''
})
const quickActions = computed(() => {
    if (variant.value === 'script') return [{ type: 'storyboardGroup', label: '生成分镜组' }, { type: 'subject', label: '提取角色' }]
    if (variant.value === 'subject') return [{ type: 'imageConfig', label: '角色生图' }, { type: 'storyboardGroup', label: '连接分镜' }]
    if (variant.value === 'storyboardGroup') return [{ type: 'imageConfig', label: '批量生图' }, { type: 'videoConfig', label: '批量视频' }]
    if (['image', 'imageResult'].includes(variant.value)) return [{ type: 'videoConfig', label: '图生视频' }, { type: 'imageConfig', label: '图生图' }]
    if (variant.value === 'video') return [{ type: 'videoCompose', label: '视频合成' }]
    if (variant.value === 'text') return [{ type: 'llmConfig', label: 'AI 文本' }, { type: 'imageConfig', label: '生图' }, { type: 'script', label: '故事脚本' }]
    return []
})

const nodeTitleMap: Record<string, string> = {
    text: '文本',
    imagePrompt: '图片提示词',
    llmConfig: 'AI 文本生成',
    imageConfig: '图片生成',
    image: '图片',
    imageResult: '图片结果',
    videoConfig: '视频生成',
    video: '视频',
    audio: '音频',
    script: '脚本生成器',
    subject: '角色三视图',
    storyboardGroup: '分镜组',
    videoCompose: '视频合成',
    assetLibrary: '素材库'
}
const nodeIconMap: Record<string, string> = { text: 'T', imagePrompt: 'P', llmConfig: 'AI', imageConfig: 'I', image: '图', imageResult: '图', videoConfig: 'V', video: '影', audio: '音', script: '剧', subject: '角', storyboardGroup: '镜', videoCompose: '合', assetLibrary: '库' }

function emitUpdate(data: Record<string, any>) {
    if (nodeActions.update) nodeActions.update(props.id, data)
    else dispatchNodeAction('update', { data })
    emit('update', props.id, data)
}

function updateComposer(value: string) {
    const payload = variant.value === 'script' || variant.value === 'text' ? { content: value, prompt: value } : { prompt: value }
    emitUpdate(payload)
}

function applyPreset(mode: string) {
    const presets: Record<string, Record<string, any>> = {
        write: { mode: 'write', currentStep: '已切换为自由文案输入' },
        text_to_video: { mode: 'text_to_video', currentStep: '文案将作为生视频提示词' },
        reverse_prompt: { mode: 'reverse_prompt', currentStep: '请连接或上传图片，用于反推提示词' },
        text_to_music: { mode: 'text_to_music', content: composerValue.value || '为画面生成一段音乐文案', prompt: composerValue.value || '为画面生成一段音乐文案', currentStep: '已切换为音乐文案' },
        image_to_image: { mode: 'image_to_image', currentStep: '请上传参考图或连接图片节点' },
        upscale: { mode: 'upscale', quality: '高清修复', resolution: '4K', prompt: composerValue.value || '提升图片清晰度，保留主体与构图', currentStep: '已切换为图片高清' },
        first_last_frame: { mode: 'first_last_frame', currentStep: '请上传首帧和尾帧，生成自然过渡视频' },
        first_frame: { mode: 'first_frame', currentStep: '请上传首帧图，生成视频' }
    }
    emitUpdate(presets[mode] || { mode })
    if (mode === 'image_to_image' || mode === 'first_frame' || mode === 'first_last_frame' || mode === 'reverse_prompt') {
        fileInput.value?.click()
    } else {
        focusComposer()
    }
}

function handleComposerTag(tag: string) {
    if (tag.includes('参考')) {
        emitUpdate({ referenceMode: true, currentStep: variant.value === 'video' ? '请上传首帧/尾帧参考图，或连接图片节点' : '请上传参考图或连接图片节点' })
        fileInput.value?.click()
        return
    }
    if (tag === '标记') {
        emitUpdate({ marked: !props.data.marked, currentStep: props.data.marked ? '' : '已标记为重点节点' })
        return
    }
    if (tag === '风格') {
        const value = cycleValue(String(props.data.style || ''), ['默认', '写实', '电影感', '动漫', '国风'])
        emitUpdate({ style: value, currentStep: `风格：${value}` })
        return
    }
    if (tag === '特效') {
        const value = cycleValue(String(props.data.effect || ''), ['无', '光晕', '雨雪', '粒子', '故障'])
        emitUpdate({ effect: value, currentStep: `特效：${value}` })
        return
    }
    if (tag === '角色库') {
        emitUpdate({ useCharacter: true, currentStep: '已开启角色参考，可从角色库选择或连接角色节点' })
        nodeActions.openDrawer?.('characters')
        return
    }
    if (tag === '运镜') {
        const value = cycleValue(String(props.data.camera_motion || ''), ['静止', '推进', '拉远', '环绕', '跟随'])
        emitUpdate({ camera_motion: value, currentStep: `运镜：${value}` })
    }
}

function isComposerTagActive(tag: string) {
    if (tag.includes('参考')) return !!props.data.referenceMode || !!props.data.referenceCount || !!props.data.image || !!props.data.poster
    if (tag === '标记') return !!props.data.marked
    if (tag === '风格') return !!props.data.style && props.data.style !== '默认'
    if (tag === '特效') return !!props.data.effect && props.data.effect !== '无'
    if (tag === '角色库') return !!props.data.useCharacter
    if (tag === '运镜') return !!props.data.camera_motion && props.data.camera_motion !== '静止'
    return false
}

function toggleComposerExpanded() {
    composerExpanded.value = !composerExpanded.value
    if (composerExpanded.value) focusComposer()
}

function cycleModel() {
    const options = (modelOptions.value || []).map((item: any) => item?.label || item?.name || item?.title || item?.value || item?.model || item).filter(Boolean)
    const fallback = variant.value === 'video' ? ['文生视频', '图生视频'] : variant.value === 'image' ? ['Lib Image', '图片编辑'] : ['GVLM 3.1']
    const next = cycleValue(String(props.data.model || defaultModelLabel.value), options.length ? options.map(String) : fallback)
    emitUpdate({ model: next, currentStep: `模型：${next}` })
}

function cycleMeta(item: string) {
    if (/^\d+$/.test(item)) return
    if (item.includes('张') || item.includes('个')) {
        const value = cycleNumber(Number(props.data.count || 1), [1, 2, 4])
        emitUpdate({ count: value, currentStep: `${variant.value === 'image' ? '出图' : '出视频'}数量：${value}` })
        return
    }
    if (item.endsWith('s')) {
        const value = cycleNumber(Number(props.data.duration || 5), [3, 5, 8, 10])
        emitUpdate({ duration: value, currentStep: `时长：${value}s` })
        return
    }
    if (item.includes('P') || item.includes('K')) {
        const value = cycleValue(String(props.data.resolution || item), variant.value === 'image' ? ['1K', '2K', '4K'] : ['720P', '1080P'])
        emitUpdate({ resolution: value, currentStep: `清晰度：${value}` })
        return
    }
    if (item.includes('画质') || item.includes('修复')) {
        const value = cycleValue(String(props.data.quality || '标准画质'), ['标准画质', '高清画质', '高清修复'])
        emitUpdate({ quality: value, currentStep: `画质：${value}` })
        return
    }
    const value = cycleValue(String(props.data.ratio || '16:9'), ['16:9', '9:16', '1:1', '4:3', '3:4'])
    emitUpdate({ ratio: value, currentStep: `比例：${value}` })
}

function cycleValue(current: string, values: string[]) {
    const index = values.findIndex((item) => item === current)
    return values[(index + 1) % values.length] || values[0]
}

function cycleNumber(current: number, values: number[]) {
    const index = values.findIndex((item) => item === current)
    return values[(index + 1) % values.length] || values[0]
}

function focusComposer() {
    composerInput.value?.focus()
}

function duplicateNode() {
    if (nodeActions.duplicate) nodeActions.duplicate(props.id)
    else dispatchNodeAction('duplicate')
    emit('duplicate', props.id)
}

function removeNode() {
    if (nodeActions.remove) nodeActions.remove(props.id)
    else dispatchNodeAction('remove')
    emit('remove', props.id)
}

function runNode() {
    if (nodeActions.run) nodeActions.run(props.id)
    else dispatchNodeAction('run')
    emit('run', props.id)
}

function splitStoryboard() {
    if (nodeActions.splitStoryboard) nodeActions.splitStoryboard(props.id)
    else dispatchNodeAction('splitStoryboard')
}

function addConnected(type: string) {
    showQuick.value = false
    if (nodeActions.addConnected) nodeActions.addConnected(props.id, type)
    else dispatchNodeAction('addConnected', { type })
    emit('add-connected', props.id, type)
}

function focusSourceNode() {
    dispatchNodeAction('focusSource')
}

function dispatchNodeAction(action: string, payload: Record<string, any> = {}) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('aigc-canvas-node-action', { detail: { action, id: props.id, ...payload } }))
}

function readAsDataUrl(file: File, callback: (url: string) => void) {
    const reader = new FileReader()
    reader.onload = () => callback(String(reader.result || ''))
    reader.readAsDataURL(file)
}

function handleImageFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    readAsDataUrl(file, (url) => {
        const references = [...(Array.isArray(props.data.referenceImages) ? props.data.referenceImages : []), { role: 'reference_image', url, name: file.name }]
        emitUpdate({ image: url, url, subtitle: file.name, referenceImages: references, referenceCount: references.length, status: 'success' })
    })
    ;(event.target as HTMLInputElement).value = ''
}

function handleReferenceImageFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    readAsDataUrl(file, (url) => {
        const existing = Array.isArray(props.data.referenceImages) ? props.data.referenceImages : []
        const role = variant.value === 'video' && (props.data.mode === 'first_frame' || !existing.length) ? 'first_frame_image' : variant.value === 'video' && props.data.mode === 'first_last_frame' ? 'last_frame_image' : 'reference_image'
        const references = [...existing, { role, url, name: file.name }]
        emitUpdate({ image: props.data.image || url, poster: props.data.poster || url, referenceImages: references, referenceCount: references.length, referenceMode: true, currentStep: `已添加${role === 'last_frame_image' ? '尾帧' : role === 'first_frame_image' ? '首帧' : '参考图'}` })
    })
    ;(event.target as HTMLInputElement).value = ''
}

function handleVideoFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const references = [...(Array.isArray(props.data.referenceVideos) ? props.data.referenceVideos : []), { url, name: file.name }]
    emitUpdate({ url, subtitle: file.name, referenceVideos: references, referenceCount: references.length, status: 'success' })
    ;(event.target as HTMLInputElement).value = ''
}

function handleAudioFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    emitUpdate({ url: URL.createObjectURL(file), name: file.name, status: 'success' })
    ;(event.target as HTMLInputElement).value = ''
}
</script>

<style scoped lang="scss">
.canvas-lib-node {
    position: relative;
    width: 350px;
    color: #f7f7f7;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', Inter, 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
    overflow: visible;
}

.canvas-lib-node.is-text,
.canvas-lib-node.is-script,
.canvas-lib-node.is-imagePrompt {
    width: 350px;
}

.canvas-lib-node.is-text {
    width: 278px;
}

.canvas-lib-node.is-image,
.canvas-lib-node.is-video {
    width: 496px;
}

.canvas-lib-node.is-llmConfig,
.canvas-lib-node.is-imageConfig,
.canvas-lib-node.is-videoConfig,
.canvas-lib-node.is-storyboardGroup,
.canvas-lib-node.is-videoCompose {
    width: 350px;
}

.node-label {
    position: absolute;
    left: 0;
    top: -34px;
    z-index: 14;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    color: rgba(255, 255, 255, 0.86);
    pointer-events: all;
}

.node-label-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.12);
    font-size: 11px;
    font-weight: 700;
}

.node-title {
    width: 190px;
    height: 24px;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-size: 13px;
}

.node-shell {
    position: relative;
    min-height: 200px;
    border: 1px solid #363636;
    border-radius: 12px;
    background: #171717;
    box-shadow: none;
    overflow: visible;
}

.is-text .node-shell {
    min-height: 278px;
}

.is-image .node-shell,
.is-video .node-shell {
    min-height: 280px;
}

.blank-preview {
    position: relative;
    display: grid;
    align-content: center;
    justify-items: center;
    min-height: inherit;
    padding: 28px;
}

.blank-preview--media {
    min-height: 280px;
}

.blank-preview--text {
    min-height: 278px;
}

.blank-preview img,
.blank-preview video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 12px;
    object-fit: cover;
}

.blank-preview input {
    display: none;
}

.blank-preview-icon {
    display: grid;
    place-items: center;
    width: 80px;
    height: 80px;
    color: rgba(255, 255, 255, 0.22);
}

.blank-preview-icon svg {
    width: 54px;
    height: 54px;
}

.blank-preview-icon--text {
    gap: 7px;
}

.blank-preview-icon--text span {
    display: block;
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
}

.blank-preview-icon--text span:nth-child(1),
.blank-preview-icon--text span:nth-child(2) {
    width: 54px;
}

.blank-preview-icon--text span:nth-child(3) {
    width: 38px;
}

.blank-preview-icon--text span:nth-child(4) {
    width: 26px;
}

.blank-try-list {
    position: absolute;
    left: 28px;
    bottom: 28px;
    z-index: 2;
    display: grid;
    justify-items: start;
    gap: 12px;
}

.blank-try-list small {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
}

.blank-try-list button {
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.92);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

.blank-try-list button:hover {
    color: #fff;
}

.is-selected .node-shell {
    box-shadow: inset 0 0 0 2px #a8a8a8;
}

.is-llmConfig .node-shell,
.is-imageConfig .node-shell,
.is-videoConfig .node-shell,
.is-storyboardGroup .node-shell,
.is-videoCompose .node-shell {
    min-height: 350px;
}

.node-text-view {
    height: 200px;
    padding: 14px 8px 14px 16px;
}

.node-text {
    width: 100%;
    height: 100%;
    border: 0;
    resize: none;
    outline: none;
    background: transparent;
    color: #f7f7f7;
    font-size: 14px;
    line-height: 20px;
}

.node-text::placeholder {
    color: rgba(255, 255, 255, 0.38);
}

.node-generator {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 14px;
    min-height: 350px;
    padding: 28px;
    text-align: center;
}

.generator-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #919191;
}

.generator-status span {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 12px;
}

.generator-status span.active {
    background: rgba(255, 255, 255, 0.9);
    color: #111;
}

.generator-status i {
    width: 30px;
    height: 1px;
    background: rgba(255, 255, 255, 0.16);
}

.node-generator strong {
    font-size: 15px;
    font-weight: 500;
}

.node-generator p,
.node-generator small,
.node-media p,
.node-storyboard p,
.node-compose p,
.node-assets p,
.node-message {
    margin: 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 12px;
    line-height: 1.6;
}

.open-source {
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    cursor: pointer;
}

.node-media,
.node-audio,
.node-storyboard,
.node-compose,
.node-assets {
    display: grid;
    gap: 10px;
    padding: 12px;
}

.node-media img,
.node-media video {
    width: 100%;
    border-radius: 8px;
    background: #0b0b0b;
    object-fit: cover;
}

.node-media img {
    aspect-ratio: 4 / 3;
}

.node-media video {
    aspect-ratio: 16 / 9;
}

.node-media input,
.node-audio input {
    display: none;
}

.node-upload {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 176px;
    border: 1px dashed rgba(255, 255, 255, 0.18);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
}

.node-storyboard {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.node-storyboard article {
    min-height: 92px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
}

.node-storyboard span {
    color: #fff;
    font-size: 12px;
}

.node-storyboard article p {
    display: -webkit-box;
    margin-top: 6px;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}

.node-compose div {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
    gap: 6px;
}

.node-compose span {
    height: 48px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
}

.node-compose span.active {
    background: rgba(255, 255, 255, 0.18);
}

.node-assets {
    place-items: center;
    min-height: 200px;
}

.node-assets svg {
    width: 28px;
    height: 28px;
}

.node-meta {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}

.node-meta span {
    max-width: 100%;
    height: 20px;
    padding: 0 7px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.62);
    font-size: 11px;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.node-message {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 36px;
    padding: 6px 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
}

.node-message.is-error {
    background: rgba(255, 93, 93, 0.16);
    color: #ff9999;
}

.node-inline-actions {
    position: absolute;
    right: 10px;
    bottom: 10px;
    display: flex;
    gap: 6px;
    opacity: 0;
    pointer-events: none;
}

.canvas-lib-node:hover .node-inline-actions {
    opacity: 1;
    pointer-events: all;
}

.node-inline-actions button,
.quick-menu button,
.node-action-bar button,
.node-composer-foot button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 28px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    font-size: 12px;
    cursor: pointer;
}

.node-action-bar {
    position: absolute;
    left: 50%;
    top: -76px;
    z-index: 30;
    display: flex;
    gap: 4px;
    padding: 6px;
    border: 1px solid #363636;
    border-radius: 12px;
    background: rgba(20, 20, 20, 0.82);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    transform: translateX(-50%);
    white-space: nowrap;
    backdrop-filter: blur(32px);
}

.node-action-bar svg,
.node-inline-actions svg,
.node-composer-foot svg {
    width: 14px;
    height: 14px;
}

.blank-composer {
    position: absolute;
    left: 50%;
    top: calc(100% + 14px);
    z-index: 24;
    display: grid;
    width: 520px;
    min-height: 118px;
    padding: 12px 14px 10px;
    border: 1px solid rgba(54, 54, 54, 0.82);
    border-radius: 16px;
    background: #262626;
    box-shadow: 0 14px 44px rgba(0, 0, 0, 0.28);
    transform: translateX(-50%);
}

.blank-composer--text {
    min-height: 120px;
}

.blank-composer--image,
.blank-composer--video {
    min-height: 154px;
}

.blank-composer.is-expanded {
    min-height: 236px;
}

.blank-composer.is-expanded textarea {
    min-height: 148px;
}

.blank-composer-tags,
.blank-composer-foot {
    display: flex;
    align-items: center;
    gap: 6px;
}

.blank-composer-tags button,
.blank-composer-foot button,
.blank-composer-foot span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    padding: 0 8px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.64);
    font-size: 12px;
}

.blank-composer-tags button.active,
.blank-composer-foot .meta-pill:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
}

.blank-composer-tags .blank-composer-expand {
    margin-left: auto;
    width: 24px;
    padding: 0;
    border-radius: 7px;
}

.blank-composer textarea {
    min-height: 54px;
    margin: 8px 0;
    border: 0;
    resize: none;
    outline: none;
    background: transparent;
    color: #f7f7f7;
    font-size: 14px;
    line-height: 22px;
}

.blank-composer--image textarea,
.blank-composer--video textarea {
    min-height: 66px;
}

.blank-composer textarea::placeholder {
    color: rgba(255, 255, 255, 0.28);
}

.blank-composer-foot {
    min-height: 28px;
}

.blank-composer-foot .model-pill {
    padding: 0 0;
    background: transparent;
    color: #fff;
    font-weight: 600;
}

.blank-composer-foot .composer-run {
    width: 32px;
    height: 32px;
    margin-left: auto;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.7);
    color: #111;
}

.node-composer {
    position: absolute;
    left: -150px;
    right: -150px;
    top: calc(100% + 18px);
    z-index: 24;
    display: grid;
    gap: 10px;
    min-height: 204px;
    padding: 14px;
    border: 1px solid #363636;
    border-radius: 16px;
    background: #171717;
    box-shadow: 0 14px 44px rgba(0, 0, 0, 0.28);
}

.node-composer textarea {
    min-height: 98px;
    border: 0;
    resize: none;
    outline: none;
    background: transparent;
    color: #f7f7f7;
    font-size: 14px;
    line-height: 25px;
}

.node-composer-foot {
    display: flex;
    align-items: center;
    gap: 8px;
}

.node-composer-foot span {
    margin-left: auto;
    color: #919191;
    font-size: 12px;
}

.node-composer-foot .composer-run {
    width: 32px;
    height: 32px;
    border-radius: 12px;
    background: #fff;
    color: #111;
}

.quick-add {
    position: absolute;
    right: -15px;
    top: 50%;
    z-index: 18;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid #363636;
    border-radius: 999px;
    background: #262626;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
    cursor: pointer;
}

.quick-menu {
    position: absolute;
    right: -138px;
    top: calc(50% + 18px);
    z-index: 24;
    display: grid;
    gap: 4px;
    width: 128px;
    padding: 7px;
    border: 1px solid #363636;
    border-radius: 12px;
    background: #262626;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.node-handle {
    width: 10px;
    height: 10px;
    border: 2px solid #141414;
    background: #fff !important;
    opacity: 0;
}

.canvas-lib-node:hover .node-handle,
.is-selected .node-handle {
    opacity: 1;
}

.node-handle--target {
    left: -6px;
}

.node-handle--source {
    right: -6px;
}
</style>
