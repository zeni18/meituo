<template>
    <div class="ai-tool-task-panel">
        <header class="ai-tool-task-panel__head">
            <div><h2>任务与作品</h2></div>
            <div class="ai-tool-task-panel__head-actions" @click.stop>
                <div v-if="filterOptions.length" class="ai-tool-task-panel__filter">
                    <button class="ai-tool-task-panel__filter-button" type="button" :aria-expanded="filterOpen" @click="filterOpen = !filterOpen">
                        <span>{{ activeFilterLabel || '全部' }}</span>
                        <img :src="downIcon" alt="" :class="{ 'is-open': filterOpen }" />
                    </button>
                    <div v-if="filterOpen" class="ai-tool-task-panel__filter-menu">
                        <button
                            v-for="item in filterOptions"
                            :key="String(item.value)"
                            :class="{ 'is-active': String(item.value) === String(activeFilter) }"
                            type="button"
                            @click="selectFilter(item.value)"
                        >
                            <span>{{ item.label }}</span>
                        </button>
                    </div>
                </div>
                <button class="ai-tool-task-panel__refresh" type="button" :disabled="loading" @click="$emit('refresh')">
                    <i v-if="loading"></i>
                    <span>{{ loading ? '刷新中' : '刷新' }}</span>
                </button>
            </div>
        </header>

        <div v-if="tasks.length" class="ai-tool-task-panel__stream">
            <article v-for="task in tasks" :key="task.id" class="ai-tool-task-card">
                <div class="ai-tool-task-card__head">
                    <span class="ai-tool-task-card__badge">{{ task.badge }}</span>
                    <strong>{{ task.title }}</strong>
                    <span v-if="task.createTime">{{ task.createTime }}</span>
                    <span v-if="task.sizeLabel">{{ task.sizeLabel }}</span>
                    <span :class="['ai-tool-task-card__status', `is-${normalizeStatus(task.status)}`]">
                        <i v-if="isRunningStatus(task.status)"></i>
                        {{ task.statusText || statusLabel(task.status) }}
                    </span>
                </div>

                <div v-if="task.references?.length || task.prompt" class="ai-tool-task-card__prompt">
                    <div v-if="task.references?.length" class="ai-tool-task-card__refs">
                        <button
                            v-for="(reference, index) in task.references"
                            :key="`${task.id}-ref-${index}-${reference.url}`"
                            type="button"
                            @click="$emit('preview-reference', reference, task)"
                        >
                            <video v-if="reference.mediaType === 'video'" :src="reference.url" muted playsinline preload="metadata"></video>
                            <img v-else :src="reference.url" :alt="reference.label || '参考图'" loading="lazy" decoding="async" />
                            <i v-if="reference.mediaType === 'video'" aria-hidden="true"></i>
                            <span>{{ reference.label || `参考图${index + 1}` }}</span>
                        </button>
                    </div>
                    <p>{{ task.prompt || ' ' }}</p>
                </div>

                <div :class="['ai-tool-task-card__media-list', task.mode === 'multi' ? 'is-multi' : 'is-single']">
                    <div
                        v-for="(item, index) in normalizedItems(task)"
                        :key="item.id || `${task.id}-item-${index}`"
                        :class="[
                            'ai-tool-task-card__media',
                            item.url ? 'is-success' : '',
                            isRunningItem(item, task) ? 'is-running' : '',
                            isFailedItem(item, task) ? 'is-failed' : ''
                        ]"
                    >
                        <button v-if="item.url" class="ai-tool-task-card__preview" type="button" @click="$emit('preview', item, task)">
                            <video v-if="item.mediaType === 'video'" :src="item.url" muted playsinline preload="metadata"></video>
                            <img v-else :src="item.url" :alt="item.title || task.title" loading="lazy" decoding="async" />
                        </button>
                        <div v-else class="ai-tool-task-card__state">
                            <i v-if="isRunningItem(item, task)"></i>
                            <div>
                                <strong>{{ item.statusText || statusLabel(item.status || task.status) }}</strong>
                                <span v-if="!isRunningItem(item, task)">{{ item.error || task.error || stateDescription(item.status || task.status) }}</span>
                            </div>
                        </div>
                        <div v-if="item.url" class="ai-tool-task-card__media-actions">
                            <button type="button" :disabled="item.downloadDisabled || !item.downloadUrl" @click.stop="$emit('download-one', item, task)">
                                <img :src="downloadIcon" alt="" />
                                <span>下载</span>
                            </button>
                            <button type="button" :disabled="item.deleteDisabled" @click.stop="$emit('delete-one', item, task)">
                                <img :src="deleteIcon" alt="" />
                                <span>{{ item.deleteLabel || '删除' }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="ai-tool-task-card__actions">
                    <button type="button" :disabled="task.editDisabled" @click="$emit('edit', task)">
                        <img :src="editIcon" alt="" />
                        <span>重新编辑</span>
                    </button>
                    <button type="button" :disabled="task.regenerateDisabled" @click="$emit('regenerate', task)">
                        <img :src="regenerateIcon" alt="" />
                        <span>再次生成</span>
                    </button>
                    <button type="button" :disabled="task.downloadAllDisabled || !task.items?.some((item) => item.downloadUrl || item.url)" @click="$emit('download-all', task)">
                        <img :src="downloadIcon" alt="" />
                        <span>全部下载</span>
                    </button>
                    <button type="button" :disabled="task.deleteAllDisabled" @click="$emit('delete-all', task)">
                        <img :src="deleteIcon" alt="" />
                        <span>{{ task.deleteAllLabel || '全部删除' }}</span>
                    </button>
                </div>
            </article>
        </div>

        <div v-else-if="!loading" class="ai-tool-task-panel__empty">
            <img :src="emptyImage" alt="" />
            <p>暂无创作，开启你的创作</p>
        </div>

        <div v-if="tasks.length && hasMore" class="ai-tool-task-panel__more">
            <button type="button" :disabled="loadingMore" @click="$emit('load-more')">
                <i v-if="loadingMore"></i>
                <span>{{ loadingMore ? '加载中' : '加载更多' }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { PRODUCT_IMAGE_EMPTY_IMAGE } from '@/constants/workspace-assets'
import downIcon from '@/assets/images/icon/Down.svg'
import deleteIcon from '@/assets/images/icon/Delete-themes.svg'
import downloadIcon from '@/assets/images/icon/xiazai.svg'
import editIcon from '@/assets/images/icon/bianji.svg'
import regenerateIcon from '@/assets/images/icon/zaici.svg'

export type AiToolTaskPanelFilter = {
    label: string
    value: string
}

export type AiToolTaskPanelReference = {
    label?: string
    url: string
    mediaType?: 'image' | 'video'
}

export type AiToolTaskPanelItem = {
    id: string | number
    url?: string
    downloadUrl?: string
    downloadName?: string
    mediaType?: 'image' | 'video'
    title?: string
    status?: string
    statusText?: string
    error?: string
    raw?: any
    deleteDisabled?: boolean
    downloadDisabled?: boolean
    deleteLabel?: string
}

export type AiToolTaskPanelTask = {
    id: string | number
    mode: 'single' | 'multi'
    badge: string
    title: string
    createTime?: string
    status?: string
    statusText?: string
    sizeLabel?: string
    prompt?: string
    error?: string
    references?: AiToolTaskPanelReference[]
    items: AiToolTaskPanelItem[]
    raw?: any
    editDisabled?: boolean
    regenerateDisabled?: boolean
    downloadAllDisabled?: boolean
    deleteAllDisabled?: boolean
    deleteAllLabel?: string
}

const props = withDefaults(defineProps<{
    tasks: AiToolTaskPanelTask[]
    loading?: boolean
    filterOptions?: AiToolTaskPanelFilter[]
    activeFilter?: string
    activeFilterLabel?: string
    emptyImage?: string
    hasMore?: boolean
    loadingMore?: boolean
}>(), {
    tasks: () => [],
    loading: false,
    filterOptions: () => [],
    activeFilter: '',
    activeFilterLabel: '',
    emptyImage: PRODUCT_IMAGE_EMPTY_IMAGE,
    hasMore: false,
    loadingMore: false
})

const emit = defineEmits<{
    (event: 'refresh'): void
    (event: 'filter-change', value: string): void
    (event: 'edit', task: AiToolTaskPanelTask): void
    (event: 'regenerate', task: AiToolTaskPanelTask): void
    (event: 'preview-reference', reference: AiToolTaskPanelReference, task: AiToolTaskPanelTask): void
    (event: 'preview', item: AiToolTaskPanelItem, task: AiToolTaskPanelTask): void
    (event: 'download-one', item: AiToolTaskPanelItem, task: AiToolTaskPanelTask): void
    (event: 'download-all', task: AiToolTaskPanelTask): void
    (event: 'delete-one', item: AiToolTaskPanelItem, task: AiToolTaskPanelTask): void
    (event: 'delete-all', task: AiToolTaskPanelTask): void
    (event: 'load-more'): void
}>()

const filterOpen = ref(false)

const normalizeStatus = (status: any) => {
    const value = String(status || '').toLowerCase()
    return ['pending', 'running', 'success', 'failed', 'partial_failed', 'canceled'].includes(value) ? value : 'running'
}

const isRunningStatus = (status: any) => ['pending', 'running'].includes(normalizeStatus(status))

const statusLabel = (status: any) => ({
    pending: '排队中',
    running: '生成中',
    success: '已完成',
    failed: '已失败',
    partial_failed: '部分失败',
    canceled: '已取消'
}[normalizeStatus(status)] || '生成中')

const stateDescription = (status: any) => {
    const normalized = normalizeStatus(status)
    if (normalized === 'failed') return '生成失败，请稍后重试'
    if (normalized === 'canceled') return '任务已取消'
    return 'AI 正在生成，请稍候'
}

const isRunningItem = (item: AiToolTaskPanelItem, task: AiToolTaskPanelTask) => !item.url && isRunningStatus(item.status || task.status)
const isFailedItem = (item: AiToolTaskPanelItem, task: AiToolTaskPanelTask) => !item.url && !isRunningItem(item, task)

const normalizedItems = (task: AiToolTaskPanelTask) => {
    if (task.items?.length) return task.items
    return [{
        id: `${task.id}-placeholder`,
        status: task.status,
        statusText: task.statusText,
        error: task.error
    }]
}

const selectFilter = (value: string) => {
    filterOpen.value = false
    emit('filter-change', value)
}
</script>

<style scoped lang="scss">
.ai-tool-task-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
    padding: 20px;
    overflow: hidden;
    border-radius: 20px;
    background: #0f0f0f;
    color: #fff;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
}

.ai-tool-task-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.ai-tool-task-panel__head h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.ai-tool-task-panel__head-actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
}

.ai-tool-task-panel__filter {
    position: relative;
}

.ai-tool-task-panel__filter-button,
.ai-tool-task-panel__refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
}

.ai-tool-task-panel__filter-button {
    min-width: 116px;
}

.ai-tool-task-panel__filter-button img {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
}

.ai-tool-task-panel__filter-button img.is-open {
    transform: rotate(180deg);
}

.ai-tool-task-panel__refresh:disabled {
    cursor: not-allowed;
    opacity: 0.72;
}

.ai-tool-task-panel__refresh i {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ai-tool-spin 0.9s linear infinite;
}

.ai-tool-task-panel__filter-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 116px;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    background: #171717;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    box-sizing: border-box;
}

.ai-tool-task-panel__filter-menu button {
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
    text-align: left;
}

.ai-tool-task-panel__filter-menu button:hover,
.ai-tool-task-panel__filter-menu button.is-active {
    background: #252525;
    color: #fff;
}

.ai-tool-task-panel__stream {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 18px;
    min-height: 0;
    padding-right: 4px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #242424 transparent;
}

.ai-tool-task-panel__stream::-webkit-scrollbar {
    width: 6px;
    background: transparent;
}

.ai-tool-task-panel__stream::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #242424;
}

.ai-tool-task-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px;
    border: 1px solid #222;
    border-radius: 14px;
    background: #171717;
}

.ai-tool-task-card__head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-width: 0;
}

.ai-tool-task-card__head strong,
.ai-tool-task-card__head span:not(.ai-tool-task-card__badge) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ai-tool-task-card__head strong {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
}

.ai-tool-task-card__head span:not(.ai-tool-task-card__badge) {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    line-height: 1;
}

.ai-tool-task-card__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 8px;
    background: rgba(244, 164, 36, 0.14);
    color: #f4b247;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
}

.ai-tool-task-card__status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: #141414;
    color: rgba(255, 255, 255, 0.76) !important;
    font-size: 12px;
    line-height: 1;
}

.ai-tool-task-card__status.is-success {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
}

.ai-tool-task-card__status.is-failed,
.ai-tool-task-card__status.is-partial_failed {
    border-color: rgba(255, 95, 95, 0.18);
    background: rgba(255, 95, 95, 0.07);
    color: #ff8b8b !important;
}

.ai-tool-task-card__status.is-pending,
.ai-tool-task-card__status.is-running {
    background: #0f0f0f;
    color: rgba(255, 255, 255, 0.9) !important;
}

.ai-tool-task-card__status i {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ai-tool-spin 0.9s linear infinite;
}

.ai-tool-task-card__prompt {
    display: flex;
    align-items: center;
    min-width: 0;
    min-height: 64px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #0f0f0f;
    box-sizing: border-box;
}

.ai-tool-task-card__refs {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 8px;
    margin-right: 10px;
}

.ai-tool-task-card__refs button {
    position: relative;
    width: 44px;
    height: 44px;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 8px;
    background: #262626;
}

.ai-tool-task-card__refs img,
.ai-tool-task-card__refs video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.ai-tool-task-card__refs i {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.5);
    transform: translate(-50%, -50%);
    pointer-events: none;
}

.ai-tool-task-card__refs i::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    margin-left: 1px;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 7px solid #fff;
    content: "";
    transform: translate(-35%, -50%);
}

.ai-tool-task-card__refs span {
    position: absolute;
    inset: auto 0 0;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.58);
    color: rgba(255, 255, 255, 0.86);
    font-size: 10px;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ai-tool-task-card__prompt p {
    display: -webkit-box;
    width: 100%;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    line-height: 1.6;
    text-overflow: ellipsis;
    overflow-wrap: anywhere;
    word-break: break-all;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.ai-tool-task-card__media-list {
    display: flex;
    max-width: 100%;
    gap: 12px;
}

.ai-tool-task-card__media-list.is-multi {
    overflow-x: auto;
    padding-bottom: 4px;
    scroll-snap-type: x proximity;
}

.ai-tool-task-card__media-list.is-multi::-webkit-scrollbar {
    height: 6px;
}

.ai-tool-task-card__media-list.is-multi::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
}

.ai-tool-task-card__media {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 240px;
    width: 240px;
    height: 240px;
    overflow: hidden;
    border: 1px solid #222;
    border-radius: 14px;
    background: #0f0f0f;
    scroll-snap-align: start;
}

.ai-tool-task-card__preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
    cursor: zoom-in;
    overflow: hidden;
}

.ai-tool-task-card__preview img,
.ai-tool-task-card__preview video {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
}

.ai-tool-task-card__media-actions {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    height: 42px;
    overflow: hidden;
    border-radius: 0 0 14px 14px;
    background: rgba(16, 16, 16, 0.64);
    box-shadow: 0 -12px 24px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    opacity: 0;
    transform: translateY(100%);
    transition: opacity 0.2s ease, transform 0.2s ease;
    backdrop-filter: blur(18px) saturate(1.15);
    -webkit-backdrop-filter: blur(18px) saturate(1.15);
}

.ai-tool-task-card__media:hover .ai-tool-task-card__media-actions,
.ai-tool-task-card__media-actions:focus-within {
    opacity: 1;
    transform: translateY(0);
}

.ai-tool-task-card__media-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    height: 42px;
    padding: 0 8px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
}

.ai-tool-task-card__media-actions button + button {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.ai-tool-task-card__media-actions button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
}

.ai-tool-task-card__media-actions button:first-child {
    border-bottom-left-radius: 14px;
}

.ai-tool-task-card__media-actions button:last-child {
    border-bottom-right-radius: 14px;
}

.ai-tool-task-card__media-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

.ai-tool-task-card__media-actions img {
    width: 16px;
    height: 16px;
    object-fit: contain;
}

.ai-tool-task-card__state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    width: 100%;
    height: 100%;
    padding: 18px 20px;
    background: #0f0f0f;
    box-sizing: border-box;
}

.ai-tool-task-card__media.is-failed .ai-tool-task-card__state {
    background: linear-gradient(0deg, rgba(255, 95, 95, 0.07), rgba(255, 95, 95, 0.07)), #0f0f0f;
}

.ai-tool-task-card__state i {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ai-tool-spin 0.9s linear infinite;
}

.ai-tool-task-card__state div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
}

.ai-tool-task-card__state strong {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
}

.ai-tool-task-card__media.is-failed .ai-tool-task-card__state strong {
    color: #ff8b8b;
}

.ai-tool-task-card__state span {
    display: -webkit-box;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.58);
    font-size: 13px;
    line-height: 1.5;
    text-overflow: ellipsis;
    overflow-wrap: anywhere;
    word-break: break-all;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}

.ai-tool-task-card__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
}

.ai-tool-task-card__actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #a1a1a1;
    font-size: 14px;
    text-decoration: none;
    cursor: pointer;
}

.ai-tool-task-card__actions button:hover:not(:disabled) {
    color: #fff;
}

.ai-tool-task-card__actions button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
}

.ai-tool-task-card__actions img {
    width: 20px;
    height: 20px;
    filter: brightness(0) saturate(100%) invert(66%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(96%) contrast(88%);
}

.ai-tool-task-card__actions button:hover:not(:disabled) img {
    filter: brightness(0) invert(1);
}

.ai-tool-task-panel__empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 0;
    color: rgba(255, 255, 255, 0.62);
}

.ai-tool-task-panel__empty img {
    display: block;
    width: 240px;
    height: 240px;
    object-fit: cover;
    opacity: 0.58;
    filter: blur(0.2px);
    -webkit-mask-image: radial-gradient(circle, #000 48%, rgba(0, 0, 0, 0.86) 62%, rgba(0, 0, 0, 0.18) 78%, transparent 94%);
    mask-image: radial-gradient(circle, #000 48%, rgba(0, 0, 0, 0.86) 62%, rgba(0, 0, 0, 0.18) 78%, transparent 94%);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
}

.ai-tool-task-panel__empty p {
    margin: 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    line-height: 22px;
    text-align: center;
}

.ai-tool-task-panel__more {
    display: flex;
    justify-content: center;
    padding-top: 2px;
}

.ai-tool-task-panel__more button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 34px;
    min-width: 112px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 13px;
}

.ai-tool-task-panel__more button:disabled {
    cursor: not-allowed;
    opacity: 0.72;
}

.ai-tool-task-panel__more i {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ai-tool-spin 0.9s linear infinite;
}

@keyframes ai-tool-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
