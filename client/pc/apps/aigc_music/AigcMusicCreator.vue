<template>
    <div class="music-page" :class="{ 'has-player': playerVisible }">
        <section class="music-shell">
            <div class="music-create">
                <header class="music-top">
                    <div class="brand">
                        <span class="brand__play"></span>
                        <div>
                            <h1>{{ toolDisplayName }}</h1>
                            <p>输入一句话，自动写词、编曲并生成歌曲</p>
                        </div>
                    </div>
                    <button class="ghost-btn" type="button" @click="goBackToSource">返回</button>
                </header>

                <div class="form-area">
                    <div class="mode-toolbar">
                        <div class="mode-line">
                            <button
                                :class="{ 'is-active': activeMode === 'text' }"
                                type="button"
                                @click="setMode('text')"
                            >
                                文生音乐
                            </button>
                            <button
                                :class="{ 'is-active': activeMode === 'custom' }"
                                type="button"
                                @click="setMode('custom')"
                            >
                                自定义模式
                            </button>
                        </div>
                    </div>

                    <template v-if="activeMode === 'text'">
                        <div class="field primary-field">
                            <div class="field__head">
                                <label>歌曲描述</label>
                                <span>{{ prompt.length }}/300</span>
                            </div>
                            <div class="prompt-box">
                                <textarea
                                    v-model="prompt"
                                    maxlength="300"
                                    placeholder="例如：一首关于夏天傍晚的华语流行歌，女声，旋律轻快，适合短视频"
                                ></textarea>
                                <button
                                    class="prompt-refresh"
                                    :class="{ 'is-spinning': inspirationSpinning }"
                                    type="button"
                                    title="换一个灵感"
                                    aria-label="换一个灵感"
                                    @click="randomInspiration"
                                >
                                    ↻
                                </button>
                            </div>
                        </div>
                    </template>

                    <template v-else>
                        <div class="field title-field">
                            <div class="field__head">
                                <label>歌曲名称</label>
                                <span>可不填</span>
                            </div>
                            <input v-model="title" class="text-input" maxlength="80" placeholder="可不填" />
                        </div>

                        <div class="field compact-field">
                            <div class="field__head">
                                <label>音乐风格</label>
                                <div class="inline-actions">
                                    <div class="hover-picker">
                                        <button type="button">风格标签</button>
                                        <div class="floating-picker">
                                            <button
                                                v-for="item in stylePanelOptions"
                                                :key="`custom-style-${item}`"
                                                :class="{ 'is-active': isTagSelected('style', item) }"
                                                type="button"
                                                @click="handlePickerTagClick('style', item)"
                                            >
                                                {{ item }}
                                            </button>
                                        </div>
                                    </div>
                                    <div class="hover-picker">
                                        <button type="button">排除标签</button>
                                        <div class="floating-picker">
                                            <button
                                                v-for="item in excludePanelOptions"
                                                :key="`custom-exclude-${item}`"
                                                :class="{ 'is-active': isTagSelected('exclude', item) }"
                                                type="button"
                                                @click="handlePickerTagClick('exclude', item)"
                                            >
                                                -{{ item }}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <textarea
                                v-model="style"
                                maxlength="500"
                                placeholder="例如：华语流行，温暖女声，R&B 鼓点，副歌抓耳"
                            ></textarea>
                        </div>

                        <div class="control-row">
                            <label class="switch-line">
                                <input v-model="instrumental" type="checkbox" />
                                <span class="switch-ui" aria-hidden="true"></span>
                                <span>纯音乐</span>
                            </label>
                            <div class="voice-inline">
                                <span>演唱人声</span>
                                <div class="segmented">
                                    <button
                                        v-for="item in vocalOptions"
                                        :key="item.value"
                                        :class="{ 'is-active': vocalGender === item.value }"
                                        type="button"
                                        @click="vocalGender = item.value"
                                    >
                                        {{ item.label }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div v-if="showAdvanced" class="advanced-panel">
                            <div class="optional-grid">
                                <div class="upload-box" :class="{ 'is-filled': !!referenceAudioName }">
                                    <button type="button" @click="triggerAudioUpload">
                                        <strong>{{ referenceAudioName || '上传参考音频' }}</strong>
                                        <span>{{ referenceAudioName ? '点击更换' : '可不填，用于参考风格或已有歌曲处理' }}</span>
                                    </button>
                                </div>
                                <div class="field language-field">
                                    <label>语言</label>
                                    <div class="segmented">
                                        <button
                                            v-for="item in languageOptions"
                                            :key="item.value"
                                            :class="{ 'is-active': language === item.value }"
                                            type="button"
                                            @click="language = item.value"
                                        >
                                            {{ item.label }}
                                        </button>
                                    </div>
                                </div>
                                <div class="field duration-field">
                                    <label>时长</label>
                                    <div class="duration-row">
                                        <button type="button" @click="duration = Math.max(30, duration - 30)">-</button>
                                        <input v-model.number="duration" type="number" min="30" max="300" />
                                        <button type="button" @click="duration = Math.min(300, duration + 30)">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="settings-entry">
                            <button class="plain-btn" type="button" @click="showAdvanced = !showAdvanced">
                                {{ showAdvanced ? '收起参考音频与时长' : '参考音频与时长' }}
                            </button>
                        </div>

                        <div class="field primary-field custom-lyrics-field">
                            <div class="field__head">
                                <label>歌词</label>
                                <div class="inline-actions">
                                    <button type="button" @click="useLyricsExample">换个示例</button>
                                    <div class="hover-picker lyric-hover-picker">
                                        <button type="button">段落标签</button>
                                        <div class="floating-picker lyric-floating-picker">
                                            <button
                                                v-for="item in lyricSectionOptions"
                                                :key="item.value"
                                                type="button"
                                                @click="insertLyricTag(item.value)"
                                            >
                                                {{ item.label }}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <textarea
                                v-model="lyrics"
                                maxlength="1200"
                                placeholder="把歌词粘贴到这里，也可以用段落标签整理结构。"
                            ></textarea>
                            <div class="field__meta">{{ lyrics.length }}/1200</div>
                        </div>
                    </template>

                    <div v-if="activeMode === 'text'" class="control-row">
                        <label class="switch-line">
                            <input v-model="instrumental" type="checkbox" />
                            <span class="switch-ui" aria-hidden="true"></span>
                            <span>纯音乐</span>
                        </label>
                        <div class="voice-inline">
                            <span>演唱人声</span>
                            <div class="segmented">
                                <button
                                    v-for="item in vocalOptions"
                                    :key="item.value"
                                    :class="{ 'is-active': vocalGender === item.value }"
                                    type="button"
                                    @click="vocalGender = item.value"
                                >
                                    {{ item.label }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div v-if="activeMode === 'text'" class="style-picker-entry">
                        <div class="hover-picker text-style-picker">
                            <button class="plain-btn" type="button">风格标签</button>
                            <div class="floating-picker">
                                <button
                                    v-for="item in stylePanelOptions"
                                    :key="`text-style-${item}`"
                                    :class="{ 'is-active': styleTags.includes(item) }"
                                    type="button"
                                    @click="handlePickerTagClick('style', item)"
                                >
                                    {{ item }}
                                </button>
                            </div>
                        </div>
                        <div class="hover-picker text-exclude-picker">
                            <button class="plain-btn" type="button">排除标签</button>
                            <div class="floating-picker">
                                <button
                                    v-for="item in excludePanelOptions"
                                    :key="`text-exclude-${item}`"
                                    :class="{ 'is-active': excludeTags.includes(item) }"
                                    type="button"
                                    @click="handlePickerTagClick('exclude', item)"
                                >
                                    -{{ item }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div v-if="activeMode === 'text' && (styleTags.length || excludeTags.length)" class="selected-tags text-selected-tags">
                        <button v-for="item in styleTags" :key="`text-style-selected-${item}`" type="button" @click="toggleTag('style', item)">
                            {{ item }} ×
                        </button>
                        <button v-for="item in excludeTags" :key="`text-exclude-${item}`" type="button" @click="toggleTag('exclude', item)">
                            -{{ item }} ×
                        </button>
                    </div>

                    <div v-if="activeMode === 'text' && showAdvanced" class="advanced-panel">
                        <div class="optional-grid">
                            <div class="upload-box" :class="{ 'is-filled': !!referenceAudioName }">
                                <button type="button" @click="triggerAudioUpload">
                                    <strong>{{ referenceAudioName || '上传参考音频' }}</strong>
                                    <span>{{ referenceAudioName ? '点击更换' : '可不填，用于参考风格或已有歌曲处理' }}</span>
                                </button>
                            </div>
                            <div class="field language-field">
                                <label>语言</label>
                                <div class="segmented">
                                    <button
                                        v-for="item in languageOptions"
                                        :key="item.value"
                                        :class="{ 'is-active': language === item.value }"
                                        type="button"
                                        @click="language = item.value"
                                    >
                                        {{ item.label }}
                                    </button>
                                </div>
                            </div>
                            <div class="field duration-field">
                                <label>时长</label>
                                <div class="duration-row">
                                    <button type="button" @click="duration = Math.max(30, duration - 30)">-</button>
                                    <input v-model.number="duration" type="number" min="30" max="300" />
                                    <button type="button" @click="duration = Math.min(300, duration + 30)">+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="activeMode === 'text'" class="settings-entry">
                        <button class="plain-btn" type="button" @click="showAdvanced = !showAdvanced">
                            {{ showAdvanced ? '收起参考音频与时长' : '参考音频与时长' }}
                        </button>
                    </div>
                </div>

                <div class="create-footer">
                    <div>
                        <span>预计消耗</span>
                        <strong>{{ formatPoint(estimatePoints) }}</strong>
                    </div>
                    <button class="primary-btn" type="button" :disabled="!canSubmit || submitting || audioUploading" @click="submitMusic">
                        <i v-if="submitting || audioUploading"></i>
                        <span>{{ primaryButtonText }}</span>
                    </button>
                </div>
            </div>

            <aside class="music-results">
                <header class="results-head">
                    <h2>我的创作({{ tasks.length }})</h2>
                    <div class="filters">
                        <button
                            v-for="item in statusFilters"
                            :key="item.value || 'all'"
                            :class="{ 'is-active': activeTaskStatusFilter === item.value }"
                            type="button"
                            @click="setStatusFilter(item.value)"
                        >
                            {{ item.label }}
                        </button>
                        <button type="button" @click="refreshTasks({ sync: true })">刷新</button>
                    </div>
                </header>

                <div v-if="tasks.length" class="work-list">
                    <article
                        v-for="item in tasks"
                        :key="taskId(item) || item.id"
                        :class="{ 'is-active': taskId(item) === taskId(currentTask) }"
                        @click="currentTaskId = taskId(item)"
                    >
                        <div class="disc" :class="{ 'is-playing': taskId(item) === taskId(currentTask) && isPlaying }"></div>
                        <div class="work-main">
                            <strong>{{ taskTitle(item) }}</strong>
                            <span>{{ taskPrompt(item) || 'AI 音乐作品' }}</span>
                            <small>{{ formatTaskTime(item.create_time) }}</small>
                        </div>
                        <div class="work-actions">
                            <span :class="`is-${normalizeTaskStatus(item.status)}`">{{ statusText(normalizeTaskStatus(item.status)) }}</span>
                            <button type="button" :disabled="!taskAudioUrl(item)" @click.stop="previewTask(item)">播放</button>
                            <button type="button" @click.stop="editTask(item)">重编</button>
                            <button type="button" :disabled="!taskDownloadUrl(item)" @click.stop="downloadTask(item)">下载</button>
                        </div>
                    </article>
                </div>

                <div v-else class="empty-state">
                    <div class="empty-disc"></div>
                    <strong>{{ taskLoading ? '正在读取作品' : '暂无作品~' }}</strong>
                    <span>{{ taskLoading ? '请稍候' : '输入歌曲描述后点击创作，作品会显示在这里' }}</span>
                </div>
            </aside>
        </section>

        <footer v-if="playerVisible" class="mini-player">
            <div class="player-row">
                <div class="timeline">
                    <span>{{ currentAudioTimeText }}</span>
                    <div class="timeline-track"><i :style="{ width: `${audioProgress}%` }"></i></div>
                    <span>{{ audioDurationText }}</span>
                </div>
                <div class="player-controls">
                    <button type="button" :title="playbackMode === 'list' ? '列表循环' : '单曲循环'" @click="togglePlaybackMode">
                        {{ playbackMode === 'list' ? '↻' : '①' }}
                    </button>
                    <button type="button" :disabled="!playableTasks.length" title="上一首" @click="playPreviousTask">‹</button>
                    <button class="play-btn" type="button" :disabled="!currentAudioUrl" @click="toggleAudio">
                        {{ isPlaying ? '❚❚' : '▶' }}
                    </button>
                    <button type="button" :disabled="!playableTasks.length" title="下一首" @click="playNextTask">›</button>
                </div>
                <div class="lyric-display" :class="{ 'is-empty': !hasLyricDisplay }">
                    <div class="lyric-marquee">
                        <div class="lyric-marquee__inner">
                            <span>{{ lyricScrollText }}</span>
                            <span aria-hidden="true">{{ lyricScrollText }}</span>
                        </div>
                    </div>
                </div>
                <div class="player-actions">
                    <button type="button" title="关闭播放器" @click="closePlayer">×</button>
                </div>
            </div>
            <audio
                ref="audioRef"
                :src="playbackAudioUrl"
                preload="auto"
                playsinline
                @play="isPlaying = true"
                @pause="isPlaying = false"
                @ended="handleAudioEnded"
                @timeupdate="updateAudioState"
                @loadedmetadata="updateAudioState"
                @durationchange="updateAudioState"
                @error="handleAudioError"
            ></audio>
        </footer>

        <input ref="audioInputRef" class="sr-only" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/flac,audio/ogg" @change="handleAudioUpload" />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { useUserStore } from '@/stores/user'
import feedback from '@/utils/feedback'
import { getPcDownloadExtension, resolvePcDownloadUrl } from '@/utils/download'
import { resolveToolDisplayName } from '../useToolDisplayName'
import {
    estimateAigcMusic,
    generateAigcMusic,
    getAigcMusicConfig,
    getAigcMusicTasks,
    uploadAigcMusicAudio
} from './api'

type SimpleMode = 'text' | 'custom'
type TaskStatusFilter = '' | 'pending' | 'running' | 'success' | 'failed'
type LyricCue = { text: string; start: number; end: number }
type PlaybackMode = 'list' | 'single'

const { formatPoint, formatPointWithSuffix } = usePointUnit()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()
const config = ref<any>({})
const tasks = ref<any[]>([])
const estimateInfo = ref<any>({})
const activeMode = ref<SimpleMode>('text')
const prompt = ref('')
const title = ref('')
const style = ref('')
const lyrics = ref('')
const styleTags = ref<string[]>([])
const excludeTags = ref<string[]>([])
const instrumental = ref(false)
const vocalGender = ref('random')
const language = ref('zh')
const duration = ref(120)
const referenceAudio = ref('')
const referenceAssetId = ref(0)
const referenceAudioName = ref('')
const referenceAudioFile = ref<File | null>(null)
const showAdvanced = ref(false)
const inspirationSpinning = ref(false)
const submitting = ref(false)
const audioUploading = ref(false)
const taskLoading = ref(false)
const currentTaskId = ref(0)
const activeTaskStatusFilter = ref<TaskStatusFilter>('')
const audioInputRef = ref<HTMLInputElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const playerVisible = ref(true)
const playbackMode = ref<PlaybackMode>('list')
const currentAudioTime = ref(0)
const audioDuration = ref(0)
const audioPlayError = ref('')
let pollTimer: ReturnType<typeof window.setInterval> | null = null
let estimateTimer: ReturnType<typeof window.setTimeout> | null = null

const languageOptions = [
    { label: '中文', value: 'zh' },
    { label: '英文', value: 'en' },
    { label: '自动', value: 'auto' }
]
const vocalOptions = [
    { label: '随机', value: 'random' },
    { label: '男声', value: 'm' },
    { label: '女声', value: 'f' }
]
const statusFilters: Array<{ label: string; value: TaskStatusFilter }> = [
    { label: '全部', value: '' },
    { label: '排队', value: 'pending' },
    { label: '生成中', value: 'running' },
    { label: '完成', value: 'success' },
    { label: '失败', value: 'failed' }
]
const inspirationTexts = [
    '一首关于城市夜晚的华语流行歌，女声，副歌抓耳，带一点 R&B 氛围',
    '适合旅行 vlog 的轻快电子民谣，节奏明亮，旋律温暖，有夏天的感觉',
    '关于重逢和释怀的抒情歌，钢琴开头，后半段加入鼓组和弦乐',
    '适合产品发布会开场的纯音乐，科技感、渐进、明亮、有记忆点'
]
const defaultStyleOptions = ['流行', '电子', '民谣', '摇滚', '嘻哈', 'R&B', '电影感', '国风']
const extraStyleOptions = ['韩流音乐', '日流音乐', '中国风', '迪斯科', '爵士', '拉丁爵士', '乡村音乐', '说唱', '重金属', '古典', '童话', '梦幻']
const defaultExcludeOptions = ['重金属', '说唱', '强鼓点', '失真', '低保真', '合唱', '电音', '过长前奏', '嘶哑', '噪声']
const lyricSectionOptions = [
    { label: '前奏', value: '[Intro]', description: '歌曲开头、氛围铺垫' },
    { label: '主歌', value: '[Verse 1]', description: '叙事段落，推进歌词内容' },
    { label: '预副歌', value: '[Pre-Chorus]', description: '进入副歌前的过渡' },
    { label: '副歌', value: '[Chorus]', description: '最抓耳、最重复的段落' },
    { label: '桥段', value: '[Bridge]', description: '中后段变化和情绪转折' },
    { label: '尾奏', value: '[Outro]', description: '歌曲收尾段落' }
]
const lyricsExamples = [
    `[Verse 1]\n风吹过街角的霓虹\n把没说完的话藏进夜空\n\n[Chorus]\n让时间慢慢靠近\n听见心跳变成旋律`,
    `[Verse 1]\n海边的晚风轻轻落下\n我们把夏天写成回答\n\n[Chorus]\n就让这一刻发光\n像远处城市温柔的浪`,
    `[Intro]\n钢琴声慢慢亮起\n\n[Verse 1]\n我在人群里寻找你的消息\n旧照片还停在雨后的街区\n\n[Chorus]\n再勇敢一次奔向黎明`
]
const appConfig = computed(() => ({
    ...(config.value?.config_json || {}),
    ...(config.value || {})
}))
const styleOptions = computed(() => {
    const source = appConfig.value?.style_options || appConfig.value?.styles || []
    const remote = Array.isArray(source)
        ? source.map((item: any) => String(item.label || item.name || item.value || item)).filter(Boolean)
        : []
    return remote.length ? remote.slice(0, 8) : defaultStyleOptions
})
const stylePanelOptions = computed(() => Array.from(new Set([...styleOptions.value, ...extraStyleOptions])).slice(0, 18))
const excludePanelOptions = computed(() => defaultExcludeOptions)
const toolDisplayName = computed(() => resolveToolDisplayName(config.value, 'AI音乐生成'))
const currentTask = computed(() => tasks.value.find((item) => taskId(item) === currentTaskId.value) || tasks.value[0] || null)
const playableTasks = computed(() => tasks.value.filter((item) => !!taskAudioUrl(item)))
const currentPlayableIndex = computed(() => playableTasks.value.findIndex((item) => taskId(item) === taskId(currentTask.value)))
const currentResult = computed(() => firstPlayableResult(currentTask.value))
const currentAudioUrl = computed(() => currentTask.value ? taskAudioUrl(currentTask.value) : '')
const playbackAudioUrl = computed(() => normalizePlayableAudioUrl(currentAudioUrl.value))
const audioProgress = computed(() => {
    const duration = audioDuration.value
    if (!duration || !Number.isFinite(duration)) return 0
    return Math.max(0, Math.min(100, (currentAudioTime.value / duration) * 100))
})
const currentAudioTimeText = computed(() => formatAudioTime(currentAudioTime.value))
const audioDurationText = computed(() => {
    if (!currentAudioUrl.value) return '00:00'
    return audioDuration.value > 0 ? formatAudioTime(audioDuration.value) : '--:--'
})
const lyricCues = computed(() => buildLyricCues(currentResult.value || currentTask.value))
const currentLyricIndex = computed(() => {
    const cues = lyricCues.value
    if (!cues.length) return -1
    const current = Math.max(0, currentAudioTime.value)
    const hasTimedCues = cues.some((cue, index) => cue.start > 0 || cue.end > cue.start || (index > 0 && cue.start !== cues[index - 1].start))
    if (hasTimedCues) {
        const timedIndex = cues.findIndex((cue, index) => {
            const nextStart = cues[index + 1]?.start ?? Number.POSITIVE_INFINITY
            const end = cue.end > cue.start ? cue.end : nextStart
            return current >= cue.start && current < end
        })
        if (timedIndex >= 0) return timedIndex
        return current < cues[0].start ? 0 : cues.length - 1
    }
    const duration = audioDuration.value || Number(currentResult.value?.duration || currentTask.value?.duration || 0)
    if (!duration || !Number.isFinite(duration)) return 0
    return Math.max(0, Math.min(cues.length - 1, Math.floor((current / duration) * cues.length)))
})
const currentLyricLine = computed(() => currentLyricIndex.value >= 0 ? lyricCues.value[currentLyricIndex.value]?.text || '' : '')
const hasLyricDisplay = computed(() => lyricCues.value.length > 0)
const displayLyricLine = computed(() => currentLyricLine.value || lyricCues.value[0]?.text || (currentAudioUrl.value ? '暂无歌词' : '选择作品后播放'))
const nextLyricLine = computed(() => currentLyricIndex.value >= 0 ? lyricCues.value[currentLyricIndex.value + 1]?.text || '' : '')
const displayNextLyricLine = computed(() => {
    if (!hasLyricDisplay.value) return ''
    return nextLyricLine.value || lyricCues.value[1]?.text || ''
})
const lyricScrollText = computed(() => [displayLyricLine.value, displayNextLyricLine.value].filter(Boolean).join('    /    '))
const estimatePoints = computed(() => Number(estimateInfo.value?.user_charge_points ?? estimateInfo.value?.display_points ?? appConfig.value?.unit_price ?? 10).toFixed(2))
const canSubmit = computed(() => {
    if (activeMode.value === 'custom') return !!lyrics.value.trim() || !!style.value.trim()
    return !!prompt.value.trim()
})
const primaryButtonText = computed(() => {
    if (audioUploading.value) return '上传中'
    if (submitting.value) return '提交中'
    return '立即创作'
})

const setMode = (value: SimpleMode) => {
    activeMode.value = value
    estimateInfo.value = {}
}
const setStatusFilter = async (value: TaskStatusFilter) => {
    activeTaskStatusFilter.value = value
    await refreshTasks({ sync: true })
}
const goBackToSource = () => window.history.length > 1 ? router.back() : router.push('/ai/tools')
const isTagSelected = (kind: 'style' | 'exclude' | '', item: string) => {
    if (activeMode.value === 'custom') return isStyleTextTagSelected(kind, item)
    if (kind === 'exclude') return excludeTags.value.includes(item)
    return styleTags.value.includes(item)
}
const toggleTag = (kind: 'style' | 'exclude' | '', item: string) => {
    if (!kind) return
    const target = kind === 'exclude' ? excludeTags : styleTags
    const selected = activeMode.value === 'custom' ? isStyleTextTagSelected(kind, item) : target.value.includes(item)
    target.value = selected ? target.value.filter((row) => row !== item) : Array.from(new Set([...target.value, item]))
    if (activeMode.value === 'custom') {
        syncStyleTextTag(kind, item, !selected)
    }
    estimateInfo.value = {}
}
const handlePickerTagClick = (kind: 'style' | 'exclude' | '', item: string) => {
    toggleTag(kind, item)
}
const normalizeTagToken = (kind: 'style' | 'exclude', item: string) => kind === 'exclude' ? `-${item}` : item
const splitStyleTokens = (value: string) => value
    .split(/[,，]/)
    .map((row) => row.trim())
    .filter(Boolean)
const joinStyleTokens = (tokens: string[]) => tokens.join('，')
const isStyleTextTagSelected = (kind: 'style' | 'exclude' | '', item: string) => {
    if (!kind) return false
    return splitStyleTokens(style.value).includes(normalizeTagToken(kind, item))
}
const syncStyleTextTag = (kind: 'style' | 'exclude', item: string, selected: boolean) => {
    const token = normalizeTagToken(kind, item)
    const tokens = splitStyleTokens(style.value).filter((row) => row !== token && row !== item && row !== `-${item}`)
    if (selected) tokens.push(token)
    style.value = joinStyleTokens(tokens)
}
const randomInspiration = () => {
    inspirationSpinning.value = true
    prompt.value = inspirationTexts[Math.floor(Math.random() * inspirationTexts.length)]
    window.setTimeout(() => {
        inspirationSpinning.value = false
    }, 520)
}
const triggerAudioUpload = () => audioInputRef.value?.click()
const handleAudioUpload = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name)) {
        feedback.msgError('请上传音频文件')
        ;(event.target as HTMLInputElement).value = ''
        return
    }
    referenceAudioFile.value = file
    referenceAudioName.value = file.name
    ;(event.target as HTMLInputElement).value = ''
}
const ensureUploadedAudio = async () => {
    if (!referenceAudioFile.value) return { url: referenceAudio.value, assetId: referenceAssetId.value }
    audioUploading.value = true
    try {
        const res: any = await uploadAigcMusicAudio({
            file: referenceAudioFile.value,
            data: {
                asset_type: 'reference_audio',
                authorization_confirmed: 1,
                title: referenceAudioName.value
            }
        })
        const uri = res?.url || res?.uri || ''
        referenceAudio.value = uri
        referenceAssetId.value = Number(res?.id || res?.asset_id || 0)
        referenceAudioFile.value = null
        return { url: uri, assetId: referenceAssetId.value }
    } finally {
        audioUploading.value = false
    }
}
const composeStyleText = () => {
    if (activeMode.value === 'custom') {
        return style.value.trim()
    }
    const parts = activeMode.value === 'custom' && style.value.trim() ? [style.value.trim()] : []
    styleTags.value.forEach((item) => {
        if (!parts.some((part) => part.includes(item))) parts.push(item)
    })
    excludeTags.value.forEach((item) => {
        const token = `-${item}`
        if (!parts.some((part) => part.includes(token))) parts.push(token)
    })
    return parts.join(',')
}
const buildPayload = async () => {
    const audio = await ensureUploadedAudio()
    const custom = activeMode.value === 'custom'
    const styleText = composeStyleText()
    const customPrompt = custom && !lyrics.value.trim() ? [title.value.trim(), styleText].filter(Boolean).join(' ') : ''
    return {
        mode: 'generate',
        type: 'generate',
        prompt: custom ? customPrompt : prompt.value.trim(),
        lyric: custom ? lyrics.value.trim() : '',
        lyrics: custom ? lyrics.value.trim() : '',
        style: styleText,
        genre: styleText,
        title: custom ? title.value.trim() : '',
        custom,
        instrumental: instrumental.value,
        vocal_gender: vocalGender.value === 'random' ? '' : vocalGender.value,
        language: language.value,
        duration: Number(duration.value || 120),
        audio_url: audio.url,
        reference_audio: audio.url,
        reference_asset_id: audio.assetId || 0
    }
}
const estimatePayload = () => {
    const styleText = composeStyleText()
    const customPrompt = activeMode.value === 'custom' && !lyrics.value.trim() ? [title.value.trim(), styleText].filter(Boolean).join(' ') : ''
    return {
        mode: 'generate',
        type: 'generate',
        prompt: activeMode.value === 'custom' ? customPrompt : prompt.value.trim(),
        lyric: activeMode.value === 'custom' ? lyrics.value.trim() : '',
        lyrics: activeMode.value === 'custom' ? lyrics.value.trim() : '',
        style: styleText,
        genre: styleText,
        title: activeMode.value === 'custom' ? title.value.trim() : '',
        custom: activeMode.value === 'custom',
        instrumental: instrumental.value,
        vocal_gender: vocalGender.value === 'random' ? '' : vocalGender.value,
        language: language.value,
        duration: Number(duration.value || 120),
        reference_asset_id: referenceAssetId.value || 0
    }
}
const useLyricsExample = () => {
    lyrics.value = lyricsExamples[Math.floor(Math.random() * lyricsExamples.length)]
}
const insertLyricTag = (tag: string) => {
    const prefix = lyrics.value.trim() ? '\n\n' : ''
    lyrics.value = `${lyrics.value}${prefix}${tag}\n`
}
const submitMusic = async () => {
    if (!canSubmit.value) return
    if (!ensurePcLogin({ redirect: route.fullPath })) return
    submitting.value = true
    try {
        const payload = await buildPayload()
        const res: any = await generateAigcMusic(payload, { suppressErrorMessage: true, ignoreCancelToken: true })
        estimateInfo.value = res?.estimate || estimateInfo.value
        await refreshTasks({ sync: true })
        if (res?.task_id || res?.id) currentTaskId.value = Number(res.task_id || res.id)
        startPolling()
    } catch (error: any) {
        const message = getErrorMessage(error)
        if (isInsufficientError(error, message)) {
            estimateInfo.value = { ...estimateInfo.value, billing_status: 'insufficient_points' }
            feedback.msgError(`${formatPoint(estimatePoints.value)}不足，请充值后再提交`)
        } else {
            feedback.msgError(message || '音乐任务提交失败')
        }
    } finally {
        submitting.value = false
    }
}
const updateEstimate = async () => {
    if (!userStore.isLogin || !canSubmit.value || referenceAudioFile.value) {
        estimateInfo.value = {}
        return
    }
    try {
        estimateInfo.value = await estimateAigcMusic(estimatePayload(), { suppressErrorMessage: true, ignoreCancelToken: true })
    } catch {
        estimateInfo.value = {}
    }
}
const queueEstimate = () => {
    if (estimateTimer) window.clearTimeout(estimateTimer)
    estimateTimer = window.setTimeout(updateEstimate, 350)
}
const refreshTasks = async (options: { sync?: boolean } = {}) => {
    if (!userStore.isLogin) {
        tasks.value = []
        taskLoading.value = false
        return
    }
    taskLoading.value = true
    try {
        const res: any = await getAigcMusicTasks({
            page_no: 1,
            page_size: 20,
            status: activeTaskStatusFilter.value,
            light: 1,
            sync_running: options.sync ? 1 : 0
        }, { suppressErrorMessage: true })
        tasks.value = Array.isArray(res?.lists) ? res.lists : (Array.isArray(res) ? res : [])
        if (!currentTaskId.value && tasks.value.length) currentTaskId.value = taskId(tasks.value[0])
    } finally {
        taskLoading.value = false
    }
}
const startPolling = () => {
    stopPolling()
    if (!tasks.value.some(isTaskRunning)) return
    pollTimer = window.setInterval(async () => {
        await refreshTasks({ sync: true })
        if (!tasks.value.some(isTaskRunning)) stopPolling()
    }, 5000)
}
const stopPolling = () => {
    if (pollTimer) window.clearInterval(pollTimer)
    pollTimer = null
}
const normalizeTaskStatus = (status: any) => {
    const value = String(status || '').toLowerCase()
    if (['pending', 'running', 'success', 'failed', 'canceled'].includes(value)) return value
    return value ? 'running' : 'pending'
}
const statusText = (status: string) => ({
    pending: '排队中',
    running: '生成中',
    success: '已完成',
    failed: '已失败',
    canceled: '已取消'
}[status] || '排队中')
const isTaskRunning = (item: any) => ['pending', 'running'].includes(normalizeTaskStatus(item?.status))
const taskId = (item: any) => Number(item?.task_id || item?.id || 0)
const taskTitle = (item: any) => item?.title || item?.name || firstPlayableResult(item)?.title || 'AI 音乐作品'
const taskPrompt = (item: any) => String(item?.user_prompt || item?.prompt || item?.lyrics || item?.lyric || '').trim()
const parseJsonValue = (value: any) => {
    if (!value || typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}
const parseJsonObject = (value: any) => {
    if (!value) return {}
    if (typeof value === 'object') return value
    if (typeof value !== 'string') return {}
    try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}
const taskResults = (item: any) => {
    const results = parseJsonValue(item?.results)
    return Array.isArray(results) ? results : []
}
const firstPlayableResult = (item: any) => {
    const results = taskResults(item)
    return results.find((row: any) => row?.audio_uri || row?.audio_url || row?.url || row?.download_url) || item || null
}
const parseTimeValue = (value: any) => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
    const raw = String(value ?? '').trim()
    if (!raw) return 0
    const numeric = Number(raw)
    if (Number.isFinite(numeric)) return Math.max(0, numeric)
    const parts = raw.split(':').map((part) => Number(part))
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0
    return Math.max(0, parts.reduce((total, part) => total * 60 + part, 0))
}
const lyricTextFrom = (item: any) => {
    const resultJson = parseJsonObject(item?.result_json)
    const direct = String(item?.lyrics || item?.lyric || resultJson?.lyrics || resultJson?.lyric || '').trim()
    if (direct) return direct
    const results = taskResults(item)
    for (const result of results) {
        const text = lyricTextFrom(result)
        if (text) return text
    }
    return ''
}
const timingItemsFrom = (item: any) => {
    const resultJson = parseJsonObject(item?.result_json)
    const source = item?.timing_json || resultJson?.timing_json || resultJson?.timing || resultJson?.segments || []
    return Array.isArray(source) ? source : []
}
const plainLyricCues = (text: string): LyricCue[] => text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[[^\]]+\]$/.test(line))
    .map((line) => ({ text: line, start: 0, end: 0 }))
const buildLyricCues = (item: any): LyricCue[] => {
    if (!item) return []
    const timed = timingItemsFrom(item)
        .map((row: any) => ({
            text: String(row?.text || row?.lyric || row?.line || row?.words || '').trim(),
            start: parseTimeValue(row?.start ?? row?.start_time ?? row?.time ?? row?.offset),
            end: parseTimeValue(row?.end ?? row?.end_time)
        }))
        .filter((row) => row.text)
        .sort((a, b) => a.start - b.start)
    if (timed.length) return timed
    return plainLyricCues(lyricTextFrom(item))
}
const resolveMusicAssetUrl = (...values: any[]) => {
    for (const value of values) {
        const raw = String(value || '').trim()
        if (!raw) continue
        const source = /^(resource|uploads|storage|static|public)\//i.test(raw) ? `/${raw}` : raw
        const resolved = resolvePcDownloadUrl(source)
        if (resolved) return resolved
    }
    return ''
}
const taskAudioUrl = (item: any) => {
    const results = taskResults(item)
    const result = results.find((row: any) => row?.audio_uri || row?.audio_url || row?.url || row?.download_url) || {}
    const absoluteUrls = [item?.audio_url, item?.result_url, item?.download_url, result.audio_url, result.url, result.download_url]
    const relativeUrls = [result.audio_uri, item?.audio_uri, item?.result_uri]
    return resolveMusicAssetUrl(...absoluteUrls, ...relativeUrls)
}
const taskDownloadUrl = (item: any) => {
    const results = taskResults(item)
    const result = results.find((row: any) => row?.audio_uri || row?.download_url || row?.audio_url || row?.url) || {}
    const absoluteUrls = [item?.download_url, item?.audio_url, result.download_url, result.audio_url, result.url]
    const relativeUrls = [result.audio_uri, item?.audio_uri, item?.download_uri]
    return resolveMusicAssetUrl(...absoluteUrls, ...relativeUrls)
}
const normalizePlayableAudioUrl = (url: string) => {
    const raw = String(url || '').trim()
    if (!raw || typeof window === 'undefined') return raw
    try {
        const parsed = new URL(raw, window.location.origin)
        if (window.location.protocol === 'https:' && parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
            parsed.protocol = 'https:'
        }
        return parsed.toString()
    } catch {
        return raw
    }
}
const formatAudioTime = (value: number) => {
    if (!value || !Number.isFinite(value) || value < 0) return '00:00'
    const total = Math.floor(value)
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
const updateAudioState = () => {
    const audio = audioRef.value
    if (!audio) return
    currentAudioTime.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    audioDuration.value = Number.isFinite(audio.duration) ? audio.duration : 0
}
const resetAudioState = () => {
    currentAudioTime.value = 0
    audioDuration.value = 0
    audioPlayError.value = ''
}
const handleAudioError = () => {
    const audio = audioRef.value
    isPlaying.value = false
    updateAudioState()
    audioPlayError.value = audio?.error?.message || 'audio_error'
}
const formatTaskTime = (value: any) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const date = new Date(Number(value) * 1000)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const playAudioUrl = async (url: string) => {
    const audio = audioRef.value
    const playableUrl = normalizePlayableAudioUrl(url)
    if (!audio || !playableUrl) return
    audioPlayError.value = ''
    try {
        if (audio.src !== playableUrl || audio.error) {
            audio.pause()
            resetAudioState()
            audio.src = playableUrl
            audio.load()
        }
        await audio.play()
        updateAudioState()
    } catch (error: any) {
        isPlaying.value = false
        updateAudioState()
        audioPlayError.value = error?.message || error?.name || 'play_failed'
        console.warn('[aigc_music] audio play failed', {
            url: playableUrl,
            error: audioPlayError.value,
            mediaError: audio.error ? { code: audio.error.code, message: audio.error.message } : null
        })
        feedback.msgError('音频播放失败，请稍后重试')
    }
}
const playTask = async (item: any) => {
    const url = taskAudioUrl(item)
    if (!url) return
    currentTaskId.value = taskId(item)
    playerVisible.value = true
    await nextTick()
    await playAudioUrl(url)
}
const previewTask = async (item: any) => {
    await playTask(item)
}
const playTaskByOffset = async (offset: number) => {
    const list = playableTasks.value
    if (!list.length) return
    const currentIndex = currentPlayableIndex.value >= 0 ? currentPlayableIndex.value : 0
    const nextIndex = (currentIndex + offset + list.length) % list.length
    await playTask(list[nextIndex])
}
const playPreviousTask = () => playTaskByOffset(-1)
const playNextTask = () => playTaskByOffset(1)
const togglePlaybackMode = () => {
    playbackMode.value = playbackMode.value === 'list' ? 'single' : 'list'
}
const downloadTask = (item: any) => {
    const href = taskDownloadUrl(item)
    if (!href) return
    const link = document.createElement('a')
    const id = taskId(item) || Date.now()
    link.href = href
    link.download = `aigc-music-${id}.${getPcDownloadExtension(href, 'mp3')}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
}
const editTask = (item: any) => {
    activeMode.value = item?.lyrics || item?.lyric ? 'custom' : 'text'
    title.value = item?.title || ''
    lyrics.value = item?.lyrics || item?.lyric || ''
    prompt.value = item?.user_prompt || item?.prompt || ''
    style.value = item?.style || item?.genre || ''
    const tags = String(item?.style || item?.genre || '').split(',').map((row) => row.trim()).filter(Boolean)
    if (tags.length) styleTags.value = tags
    referenceAssetId.value = Number(item?.reference_asset_id || 0)
}
const toggleAudio = async () => {
    playerVisible.value = true
    await nextTick()
    if (!audioRef.value || !currentAudioUrl.value) return
    try {
        if (audioRef.value.paused) await playAudioUrl(currentAudioUrl.value)
        else audioRef.value.pause()
    } catch {
        feedback.msgError('音频播放失败，请稍后重试')
    }
}
const closePlayer = () => {
    audioRef.value?.pause()
    playerVisible.value = false
}
const handleAudioEnded = async () => {
    isPlaying.value = false
    if (playbackMode.value === 'single') {
        const audio = audioRef.value
        if (!audio || !currentAudioUrl.value) return
        audio.currentTime = 0
        await playAudioUrl(currentAudioUrl.value)
        return
    }
    if (playableTasks.value.length > 1) {
        await playTaskByOffset(1)
    }
}
const getErrorMessage = (error: any) => String(error?.msg || error?.message || error?.data?.msg || '')
const isInsufficientError = (error: any, message: string) => {
    const code = String(error?.code || error?.data?.code || '').toLowerCase()
    return code.includes('insufficient') || /积分不足|余额不足|points|credit/i.test(message)
}
const loadConfig = async () => {
    config.value = await getAigcMusicConfig().catch(() => ({}))
}

watch([activeMode, prompt, title, style, lyrics, styleTags, excludeTags, instrumental, vocalGender, language, duration, referenceAssetId], queueEstimate, { deep: true })
watch(currentAudioUrl, () => {
    isPlaying.value = false
    resetAudioState()
})
watch(() => userStore.isLogin, async (isLogin) => {
    if (!isLogin) {
        tasks.value = []
        currentTaskId.value = 0
        return
    }
    await refreshTasks({ sync: true })
    startPolling()
})
onMounted(async () => {
    await loadConfig()
    await refreshTasks({ sync: false })
    startPolling()
})
onUnmounted(() => {
    stopPolling()
    if (estimateTimer) window.clearTimeout(estimateTimer)
})
</script>

<style scoped lang="scss">
.music-page {
    height: 100%;
    min-width: 1120px;
    padding-bottom: 24px;
    color: #f8f8f8;
    box-sizing: border-box;
}

.music-page.has-player {
    padding-bottom: 78px;
}

.music-page.has-player .music-shell {
    height: calc(100% - 50px);
    transform: translateY(18px);
}

.music-shell {
    display: grid;
    grid-template-columns: minmax(420px, 520px) minmax(520px, 1fr);
    gap: 18px;
    height: 100%;
}

.music-create,
.music-results {
    min-height: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background: #101012;
    box-shadow: 0 26px 70px rgba(0, 0, 0, 0.36);
    overflow: hidden;
}

.music-create {
    display: flex;
    flex-direction: column;
}

.music-top,
.results-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-height: 70px;
    padding: 0 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.brand__play {
    position: relative;
    width: 34px;
    height: 34px;
    flex: none;
    border: 1px solid rgba(212, 162, 76, 0.7);
    border-radius: 50%;
}

.brand__play::after {
    content: '';
    position: absolute;
    left: 13px;
    top: 9px;
    border-left: 10px solid #d4a24c;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
}

h1,
h2,
p {
    margin: 0;
}

.brand h1,
.results-head h2 {
    font-size: 19px;
    font-weight: 800;
}

.brand p {
    margin-top: 4px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
}

button,
input,
textarea {
    font: inherit;
}

button {
    cursor: pointer;
}

button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

.ghost-btn,
.mode-line button,
.plain-btn,
.filters button {
    min-height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: #171719;
    color: rgba(255, 255, 255, 0.82);
}

.ghost-btn,
.mode-line button,
.plain-btn,
.filters button {
    padding: 0 14px;
}

.form-area {
    flex: 1;
    min-height: 0;
    padding: 22px 20px 18px;
    overflow: auto;
}

.mode-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
}

.mode-line {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.mode-line button.is-active,
.filters button.is-active {
    border-color: rgba(212, 162, 76, 0.85);
    background: rgba(212, 162, 76, 0.18);
    color: #fff;
}

.field {
    margin-bottom: 18px;
}

.field label,
.field__head label {
    display: block;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 700;
}

.field__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}

.field__head label {
    margin-bottom: 0;
}

.field__head span {
    color: rgba(255, 255, 255, 0.42);
    font-size: 13px;
}

.field__meta {
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 13px;
    text-align: right;
}

.inline-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.inline-actions button,
.selected-tags button,
.floating-picker button {
    min-height: 34px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: #171719;
    color: rgba(255, 255, 255, 0.72);
}

.inline-actions button,
.selected-tags button {
    padding: 0 12px;
}

.hover-picker {
    position: relative;
    display: inline-flex;
    isolation: isolate;
}

.hover-picker > button {
    position: relative;
    z-index: 2;
}

.floating-picker {
    position: absolute;
    z-index: 12;
    top: calc(100% + 12px);
    right: 0;
    display: none;
    grid-template-columns: repeat(3, minmax(92px, 1fr));
    gap: 8px;
    width: min(360px, calc(100vw - 40px));
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    background: #101012;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
}

.floating-picker::before {
    content: '';
    position: absolute;
    top: -5px;
    right: 26px;
    width: 10px;
    height: 10px;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    background: #101012;
    transform: rotate(45deg);
}

.floating-picker::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -20px;
    height: 20px;
}

.hover-picker:hover .floating-picker,
.hover-picker:focus-within .floating-picker {
    display: grid;
}

.floating-picker button {
    min-width: 0;
    padding: 0 10px;
    white-space: nowrap;
}

.floating-picker button.is-active {
    border-color: rgba(212, 162, 76, 0.85);
    background: rgba(212, 162, 76, 0.18);
    color: #fff;
}

.lyric-hover-picker .floating-picker {
    grid-template-columns: repeat(3, minmax(92px, 1fr));
}

.lyric-floating-picker {
    right: -14px;
}

.style-picker-entry {
    position: relative;
    z-index: 4;
}

.style-picker-entry .hover-picker {
    width: 100%;
}

.style-picker-entry .hover-picker > button {
    width: 100%;
}

.style-picker-entry .floating-picker {
    top: auto;
    bottom: calc(100% + 12px);
}

.style-picker-entry .floating-picker::before {
    top: auto;
    bottom: -5px;
    border: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.style-picker-entry .floating-picker::after {
    top: auto;
    bottom: -20px;
}

.text-style-picker .floating-picker {
    left: 0;
    right: auto;
}

.text-style-picker .floating-picker::before {
    left: 28px;
    right: auto;
}

.text-exclude-picker .floating-picker {
    right: 0;
}

.text-input,
textarea {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: #171719;
    color: #fff;
    outline: none;
    box-sizing: border-box;
}

.text-input {
    height: 48px;
    padding: 0 14px;
}

textarea {
    min-height: 174px;
    padding: 15px 16px;
    resize: vertical;
    line-height: 1.65;
}

.primary-field textarea {
    min-height: 210px;
}

.custom-lyrics-field textarea {
    min-height: 168px;
}

.prompt-box {
    position: relative;
}

.prompt-box textarea {
    padding-right: 58px;
    padding-bottom: 54px;
}

.prompt-refresh {
    position: absolute;
    right: 14px;
    bottom: 14px;
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    background: rgba(23, 23, 25, 0.94);
    color: rgba(255, 255, 255, 0.78);
    font-size: 21px;
    line-height: 1;
    transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.prompt-refresh:hover {
    border-color: rgba(212, 162, 76, 0.78);
    color: #fff;
}

.prompt-refresh.is-spinning {
    animation: spin 0.52s ease;
}

.compact-field textarea {
    min-height: 112px;
}

.control-row,
.style-tags,
.filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}

.control-row,
.style-tags {
    margin-bottom: 18px;
}

.control-row {
    justify-content: flex-start;
}

.style-picker-entry {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
}

.settings-entry {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin: 2px 0 16px;
}

.settings-entry .plain-btn {
    flex: 1;
}

.voice-inline {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    margin-left: auto;
}

.voice-inline > span {
    flex: none;
    color: rgba(255, 255, 255, 0.88);
    font-weight: 700;
}

.voice-inline .segmented {
    width: 190px;
}

.switch-line {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 38px;
    padding: 0;
    color: rgba(255, 255, 255, 0.84);
    font-weight: 700;
}

.switch-line input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}

.switch-ui {
    position: relative;
    width: 42px;
    height: 24px;
    flex: none;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    transition: background 0.2s ease, border-color 0.2s ease;
}

.switch-ui::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    transition: transform 0.2s ease, background 0.2s ease;
}

.switch-line input:checked + .switch-ui {
    border-color: rgba(212, 162, 76, 0.82);
    background: rgba(212, 162, 76, 0.28);
}

.switch-line input:checked + .switch-ui::after {
    background: #d4a24c;
    transform: translateX(18px);
}

.style-tags button,
.segmented button {
    min-height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: #171719;
    color: rgba(255, 255, 255, 0.68);
}

.style-tags button {
    padding: 0 14px;
}

.style-tags button.is-active,
.segmented button.is-active {
    border-color: rgba(212, 162, 76, 0.85);
    background: rgba(212, 162, 76, 0.18);
    color: #fff;
}

.segmented {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
}

.segmented.small {
    width: 150px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.advanced-panel {
    margin: 0 0 16px;
    padding: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: #141416;
}

.optional-grid {
    display: grid;
    grid-template-areas:
        'upload language'
        'duration duration';
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 14px;
}

.upload-box {
    grid-area: upload;
}

.language-field {
    grid-area: language;
}

.duration-field {
    grid-area: duration;
    margin-top: 2px;
}

.advanced-panel .field {
    margin-bottom: 0;
}

.selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.text-selected-tags {
    margin-bottom: 14px;
}

.compact-selected {
    margin: -8px 0 16px;
}

.upload-box button {
    width: 100%;
    min-height: 104px;
    padding: 14px 16px;
    border: 1px dashed rgba(255, 255, 255, 0.16);
    border-radius: 14px;
    background: #171719;
    color: #fff;
    text-align: left;
}

.upload-box strong {
    display: block;
    font-size: 16px;
}

.upload-box span {
    display: block;
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.44);
    font-size: 12px;
    line-height: 1.55;
}

.language-field label,
.duration-field label {
    margin-bottom: 10px;
    font-size: 14px;
}

.language-field .segmented {
    gap: 8px;
}

.language-field .segmented button {
    min-height: 44px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
}

.duration-row {
    display: grid;
    grid-template-columns: 44px minmax(0, 160px) 44px;
    gap: 8px;
}

.duration-row button,
.duration-row input {
    height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: #171719;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    text-align: center;
}

.create-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.create-footer span {
    display: block;
    color: rgba(255, 255, 255, 0.44);
    font-size: 13px;
}

.create-footer strong {
    display: block;
    margin-top: 4px;
    font-size: 24px;
}

.primary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 210px;
    height: 56px;
    border: 0;
    border-radius: 999px;
    background: linear-gradient(90deg, #d0a052, #8b5f16);
    color: #fff;
    font-size: 16px;
    font-weight: 800;
}

.primary-btn span {
    color: #fff;
    font-size: 16px;
}

.primary-btn i {
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.music-results {
    display: flex;
    flex-direction: column;
}

.work-list {
    flex: 1;
    min-height: 0;
    padding: 18px;
    overflow: auto;
}

.work-list article {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    min-height: 86px;
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: #151516;
}

.work-list article.is-active {
    border-color: rgba(212, 162, 76, 0.55);
}

.disc,
.empty-disc {
    border-radius: 50%;
    background:
        radial-gradient(circle at center, #f4e7d6 0 9px, #bfbfbf 10px 19px, transparent 20px),
        conic-gradient(from 20deg, #a8a8a8, #d7d7d7, #8f8f8f, #cfcfcf, #a8a8a8);
}

.disc {
    width: 52px;
    height: 52px;
}

.disc.is-playing {
    animation: rotateDisc 4s linear infinite;
}

.work-main {
    min-width: 0;
}

.work-main strong,
.work-main span,
.work-main small {
    display: block;
}

.work-main strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.work-main span {
    margin-top: 5px;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.52);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.work-main small {
    margin-top: 5px;
    color: rgba(255, 255, 255, 0.34);
}

.work-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.work-actions span {
    padding: 5px 9px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
}

.work-actions span.is-success {
    background: rgba(34, 197, 94, 0.16);
    color: #8ef2ac;
}

.work-actions span.is-failed {
    background: rgba(239, 68, 68, 0.16);
    color: #ff9a9a;
}

.work-actions span.is-running,
.work-actions span.is-pending {
    background: rgba(212, 162, 76, 0.18);
    color: #e6c17c;
}

.work-actions button {
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: #1c1c1e;
    color: rgba(255, 255, 255, 0.78);
}

.empty-state {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
}

.empty-disc {
    width: 150px;
    height: 150px;
    opacity: 0.5;
}

.empty-state strong {
    color: #fff;
    font-size: 20px;
}

.mini-player {
    position: fixed;
    z-index: 30;
    left: 116px;
    right: 40px;
    bottom: 16px;
    display: flex;
    align-items: center;
    min-height: 70px;
    padding: 10px 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(16, 19, 20, 0.96);
    box-shadow: 0 18px 46px rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(16px);
    box-sizing: border-box;
}

.lyric-display {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 40px;
    width: 100%;
    overflow: hidden;
}

.lyric-marquee {
    width: 100%;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
}

.lyric-marquee__inner {
    display: inline-flex;
    align-items: center;
    gap: 72px;
    min-width: max-content;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    font-weight: 700;
    line-height: 40px;
    white-space: nowrap;
    animation: lyric-scroll 18s linear infinite;
}

.lyric-marquee__inner span {
    min-width: max-content;
}

.lyric-display.is-empty .lyric-marquee__inner {
    animation: none;
    color: rgba(255, 255, 255, 0.52);
    font-weight: 600;
}

.timeline {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 8px;
    width: 100%;
    color: rgba(255, 255, 255, 0.58);
    font-size: 13px;
    font-weight: 700;
}

.timeline span:last-child {
    text-align: right;
}

.timeline-track {
    height: 4px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.13);
    overflow: hidden;
}

.timeline-track i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #d4a24c;
    transition: width 0.15s linear;
}

.player-row {
    display: grid;
    grid-template-columns: minmax(300px, 1fr) auto minmax(320px, 1fr) 40px;
    align-items: center;
    gap: 22px;
    width: 100%;
}

.player-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    justify-self: center;
}

.player-controls button,
.player-actions button {
    min-width: 36px;
    height: 34px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 11px;
    background: transparent;
    color: rgba(213, 221, 229, 0.78);
    white-space: nowrap;
    font-size: 19px;
    line-height: 1;
}

.player-controls button:hover:not(:disabled),
.player-actions button:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.92);
}

.player-controls button.is-active {
    border-color: rgba(212, 162, 76, 0.52);
    background: rgba(212, 162, 76, 0.14);
    color: #fff;
}

.play-btn {
    min-width: 48px !important;
    padding: 0 !important;
    height: 48px !important;
    border-radius: 50% !important;
    border-color: rgba(255, 255, 255, 0.17) !important;
    background: rgba(255, 255, 255, 0.04) !important;
    color: #fff !important;
    font-size: 23px !important;
    font-weight: 800;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
}

@keyframes lyric-scroll {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(calc(-50% - 36px));
    }
}

@media (max-width: 1200px) {
    .mini-player {
        left: 96px;
        right: 16px;
    }

    .player-row {
        grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr) 40px;
        gap: 14px;
    }
}

.player-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    justify-self: end;
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes rotateDisc {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 1280px) {
    .music-shell {
        grid-template-columns: 470px minmax(460px, 1fr);
    }

    .work-list article {
        grid-template-columns: 52px minmax(0, 1fr);
    }

    .work-actions {
        grid-column: 2;
    }
}
</style>
