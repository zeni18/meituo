<template>
    <Teleport to="body">
        <Transition name="notice-fade">
            <div v-if="modelValue" class="notice-center-shell" @click.self="close">
                <aside class="notice-center-drawer" aria-modal="true" role="dialog">
                    <header class="notice-center-header">
                        <div>
                            <h2>消息中心</h2>
                            <p>{{ unreadCount > 0 ? `${unreadCount} 条未读消息` : '全部消息已读' }}</p>
                        </div>
                        <PcCloseButton aria-label="关闭消息中心" @click="close" />
                    </header>

                    <div class="notice-center-tabs">
                        <button
                            v-for="tab in noticeTabs"
                            :key="tab.value"
                            type="button"
                            :class="{ 'is-active': activeTab === tab.value }"
                            @click="activeTab = tab.value"
                        >
                            {{ tab.label }}
                        </button>
                    </div>

                    <div class="notice-center-list" :class="{ 'is-empty': !isListLoading && currentNotices.length === 0 }">
                        <div v-if="isListLoading" class="notice-center-loading">加载中...</div>
                        <template v-else-if="currentNotices.length">
                            <button
                                v-for="item in currentNotices"
                                :key="item.id"
                                type="button"
                                class="notice-item"
                                :class="{ 'is-unread': !item.is_read, 'has-cover': item.image }"
                                @click="openDetail(item)"
                            >
                                <span class="notice-item__mark" aria-hidden="true">
                                    <img v-if="logoUrl" :src="logoUrl" alt="" />
                                    <span v-if="!item.is_read"></span>
                                </span>
                                <span class="notice-item__body">
                                    <span class="notice-item__title">{{ item.title }}</span>
                                    <span v-if="getNoticeSummary(item)" class="notice-item__summary">
                                        {{ getNoticeSummary(item) }}
                                    </span>
                                    <span class="notice-item__time">{{ formatTime(item.publish_time || item.create_time) }}</span>
                                </span>
                                <img v-if="item.image" class="notice-item__cover" :src="item.image" alt="" />
                            </button>
                        </template>
                        <div v-else class="notice-empty">
                            <strong>{{ activeTab === 'official' ? '暂无消息' : '暂无互动消息' }}</strong>
                            <span>{{ activeTab === 'official' ? '新的公告会显示在这里。' : '互动消息功能暂未开放。' }}</span>
                        </div>
                    </div>
                </aside>
            </div>
        </Transition>

        <Transition name="notice-detail-fade">
            <div v-if="detailVisible && activeNotice" class="notice-detail-shell" @click.self="handleDetailClose">
                <section class="notice-detail-modal" aria-modal="true" role="dialog">
                    <PcCloseButton class="notice-detail-close" aria-label="关闭消息详情" @click="handleDetailClose" />
                    <div class="notice-detail-label">官方消息</div>
                    <h3>{{ activeNotice.title }}</h3>
                    <p class="notice-detail-time">{{ formatTime(activeNotice.publish_time || activeNotice.create_time) }}</p>
                    <div v-if="activeNotice.summary" class="notice-detail-summary">{{ activeNotice.summary }}</div>
                    <div class="notice-detail-content" v-html="activeNotice.content"></div>
                    <footer class="notice-detail-footer">
                        <button type="button" @click="confirmDetail">{{ activeNotice.auto_popup ? '我知道了' : '确认' }}</button>
                    </footer>
                </section>
            </div>
        </Transition>
    </Teleport>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { getPcNoticeDetail, getPcNoticeLists, readPcNotice } from '@/api/notice'

type NoticeTab = 'official' | 'interactive'

type NoticeItem = {
    id: number
    title: string
    summary?: string
    content?: string
    image?: string
    is_read?: number
    read_time?: number
    publish_time?: number | string
    create_time?: number | string
    auto_popup?: number
}

const props = defineProps<{
    modelValue: boolean
    popupNotice?: NoticeItem | null
    logoUrl?: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'update:popupNotice', value: NoticeItem | null): void
    (e: 'read-change'): void
}>()

const loading = ref(false)
const notices = ref<NoticeItem[]>([])
const activeNotice = ref<NoticeItem | null>(null)
const detailVisible = ref(false)
const activeTab = ref<NoticeTab>('official')

const noticeTabs = [
    { label: '官方消息', value: 'official' },
    { label: '互动消息', value: 'interactive' }
] as const

const unreadCount = computed(() => notices.value.filter((item) => !Number(item.is_read)).length)
const currentNotices = computed(() => activeTab.value === 'official' ? notices.value : [])
const isListLoading = computed(() => activeTab.value === 'official' && loading.value)

const close = () => {
    emit('update:modelValue', false)
}

const loadNotices = async () => {
    loading.value = true
    try {
        const data = await getPcNoticeLists({ page_no: 1, page_size: 100 })
        notices.value = Array.isArray(data) ? data : []
    } finally {
        loading.value = false
    }
}

const plainText = (value?: string) => {
    if (!value) return ''
    return String(value)
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
}

const getNoticeSummary = (item: NoticeItem) => item.summary || plainText(item.content)

const formatTime = (value: unknown) => {
    if (!value) return '--'
    const timestamp = Number(value)
    if (!Number.isFinite(timestamp) || timestamp <= 0) return String(value)
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(timestamp * 1000)
}

const refreshReadState = (id: number) => {
    notices.value = notices.value.map((item) => item.id === id ? { ...item, is_read: 1, read_time: Math.floor(Date.now() / 1000) } : item)
}

const openDetail = async (item: NoticeItem) => {
    const detail = await getPcNoticeDetail({ id: item.id })
    activeNotice.value = { ...item, ...detail, is_read: 1 }
    detailVisible.value = true
    refreshReadState(item.id)
    emit('read-change')
}

const confirmDetail = async () => {
    const isPopup = Boolean(activeNotice.value?.auto_popup)
    if (activeNotice.value?.id) {
        await readPcNotice({ id: activeNotice.value.id }).catch(() => undefined)
        refreshReadState(activeNotice.value.id)
        emit('read-change')
    }
    if (isPopup) {
        await loadNotices().catch(() => undefined)
    }
    handleDetailClose()
}

const handleDetailClose = () => {
    detailVisible.value = false
    if (activeNotice.value?.auto_popup) {
        emit('update:popupNotice', null)
    }
    activeNotice.value = null
}

watch(() => props.modelValue, (visible) => {
    if (visible) {
        loadNotices().catch(() => {
            notices.value = []
        })
    }
})

watch(() => props.popupNotice, (notice) => {
    if (!notice?.id) return
    activeNotice.value = { ...notice, auto_popup: 1 }
    detailVisible.value = true
}, { immediate: true })
</script>

<style lang="scss" scoped>
.notice-center-shell,
.notice-detail-shell {
    position: fixed;
    inset: 0;
}

.notice-center-shell {
    z-index: 14;
}

.notice-detail-shell {
    z-index: 2147483644;
}

.notice-center-shell {
    display: flex;
    align-items: stretch;
    left: 0;
    width: auto;
    background: transparent;
    box-sizing: border-box;
    pointer-events: auto;
}

.notice-center-shell::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(494px, 100vw);
    background: #06070a;
    content: '';
}

.notice-center-drawer {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: min(494px, 100vw);
    height: 100%;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    padding-left: 74px;
    background: transparent;
    box-shadow: 30px 0 80px rgba(0, 0, 0, 0.44);
    color: #fff;
    box-sizing: border-box;
}

.notice-center-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 26px 24px 18px;
    border-bottom: 0;
}

.notice-center-header h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.2;
}

.notice-center-header p {
    margin: 8px 0 0;
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
}

.notice-center-tabs {
    display: flex;
    gap: 8px;
    padding: 16px 24px 8px;
}

.notice-center-tabs button {
    height: 34px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: #2a2b2c;
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

.notice-center-tabs button.is-active {
    background: #fff;
    color: #111;
}

.notice-center-list {
    height: calc(100% - 126px);
    padding: 8px 16px 24px;
    overflow-y: auto;
}

.notice-center-list.is-empty,
.notice-center-loading,
.notice-empty {
    display: flex;
    align-items: center;
    justify-content: center;
}

.notice-center-loading {
    height: 180px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
}

.notice-item {
    position: relative;
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    align-items: center;
    gap: 0 12px;
    width: 100%;
    margin-bottom: 10px;
    padding: 16px;
    border: 0;
    border-radius: 14px;
    background: #0f0f0f;
    color: #fff;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
}

.notice-item.has-cover {
    grid-template-columns: 40px minmax(0, 1fr) 92px;
}

.notice-item:hover {
    background: #171717;
}

.notice-item.is-unread {
    background: #121212;
}

.notice-item__mark {
    position: relative;
    display: flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    align-self: start;
    margin-top: 2px;
    border-radius: 50%;
    background: transparent;
}

.notice-item__mark span {
    position: absolute;
    top: 4px;
    right: 2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff3b30;
}

.notice-item__mark img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.notice-item__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 6px;
}

.notice-item__title {
    overflow: hidden;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.notice-item__summary {
    display: -webkit-box;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.52);
    font-size: 13px;
    line-height: 1.5;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
}

.notice-item__time {
    color: rgba(255, 255, 255, 0.38);
    font-size: 12px;
}

.notice-item__cover {
    width: 92px;
    height: 76px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    background: #050505;
    object-fit: cover;
}

.notice-empty {
    flex-direction: column;
    height: 240px;
    gap: 8px;
    color: rgba(255, 255, 255, 0.44);
}

.notice-empty strong {
    color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
}

.notice-detail-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: rgba(0, 0, 0, 0.48);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
}

.notice-detail-modal {
    position: relative;
    width: min(780px, calc(100vw - 64px));
    max-height: min(760px, calc(100vh - 64px));
    padding: 30px 32px 24px;
    border: 0;
    border-radius: 22px;
    background: #0f0f0f;
    color: #fff;
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.58);
    overflow-y: auto;
}

.notice-detail-close {
    position: absolute;
    top: 20px;
    right: 20px;
}

.notice-detail-label {
    display: inline-flex;
    height: 26px;
    align-items: center;
    padding: 0 10px;
    border-radius: 8px;
    background: #171717;
    color: rgba(255, 255, 255, 0.62);
    font-size: 12px;
}

.notice-detail-modal h3 {
    margin: 18px 42px 8px 0;
    color: #fff;
    font-size: 24px;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
}

.notice-detail-time {
    margin: 0 0 18px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 13px;
}

.notice-detail-summary {
    margin-bottom: 18px;
    padding: 14px 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: #171717;
    color: rgba(255, 255, 255, 0.66);
    font-size: 14px;
    line-height: 1.7;
    overflow-wrap: anywhere;
}

.notice-detail-content {
    color: rgba(255, 255, 255, 0.76);
    font-size: 14px;
    line-height: 1.9;
    overflow-wrap: anywhere;
}

.notice-detail-content :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
}

.notice-detail-content :deep(p) {
    margin: 0 0 12px;
}

.notice-detail-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
}

.notice-detail-footer button {
    height: 38px;
    min-width: 100px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #fff;
    color: #111;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}

.notice-fade-enter-active,
.notice-fade-leave-active,
.notice-detail-fade-enter-active,
.notice-detail-fade-leave-active {
    transition: opacity 0.2s ease;
}

.notice-fade-enter-from,
.notice-fade-leave-to,
.notice-detail-fade-enter-from,
.notice-detail-fade-leave-to {
    opacity: 0;
}

.notice-fade-enter-active .notice-center-drawer,
.notice-fade-leave-active .notice-center-drawer {
    transition: transform 0.24s ease;
}

.notice-fade-enter-from .notice-center-drawer,
.notice-fade-leave-to .notice-center-drawer {
    transform: translateX(-24px);
}

@media (max-width: 900px) {
    .notice-center-shell {
        left: 0;
        width: auto;
    }

    .notice-center-shell::before {
        width: 100vw;
    }

    .notice-center-drawer {
        width: 100%;
    }

    .notice-detail-shell {
        padding: 16px;
    }

    .notice-detail-modal {
        width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        padding: 24px 20px 20px;
    }
}
</style>
