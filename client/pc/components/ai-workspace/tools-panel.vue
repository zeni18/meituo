<template>
    <section class="tools-shell">
        <section v-if="filteredRecentTools.length" class="tools-section">
            <div class="tools-section__heading">
                <h2>{{ texts.featuredTools }}</h2>
            </div>

            <div class="tools-featured-grid">
                <NuxtLink
                    v-for="item in filteredRecentTools"
                    :key="item.id"
                    :to="buildToolCardPath(item)"
                    :class="['tools-featured-card', { 'is-active': selectedFeaturedToolId === item.id }]"
                    @pointerdown="selectRecentTool(item)"
                    @mousedown="selectRecentTool(item)"
                    @touchstart.passive="selectRecentTool(item)"
                    @click="selectRecentTool(item)"
                >
                    <div class="tools-featured-card__copy">
                        <h3>{{ item.title }}</h3>
                        <p>{{ item.detailDescription }}</p>
                    </div>
                    <div class="tools-featured-card__visual">
                        <img v-if="item.image" :src="item.image" :alt="item.title" />
                    </div>
                </NuxtLink>
            </div>
        </section>

        <section class="tools-section tools-section--all">
            <div :class="['tools-section__heading', 'tools-section__heading--row', { 'is-stuck': categoryHeaderStuck }]">
                <div class="tools-section__heading-main">
                    <div class="tools-categories">
                        <button
                            v-for="item in toolCategoryOptions"
                            :key="item"
                            :class="{ 'is-active': activeToolCategory === item }"
                            type="button"
                            @click="activeToolCategory = item"
                        >
                            {{ item }}
                        </button>
                    </div>
                </div>

                <div class="tools-search tools-search--inline">
                    <span class="tools-search__icon" aria-hidden="true"></span>
                    <input v-model="toolKeyword" type="text" :placeholder="texts.toolSearchPlaceholder" />
                </div>
            </div>

            <div class="tools-grid">
                <NuxtLink
                    v-for="item in filteredToolCards"
                    :key="item.id"
                    :to="buildToolCardPath(item)"
                    :class="['tools-card', { 'is-active': selectedToolCardId === item.id }]"
                    @pointerdown="selectToolCard(item)"
                    @mousedown="selectToolCard(item)"
                    @touchstart.passive="selectToolCard(item)"
                    @click="selectToolCard(item)"
                >
                    <img v-if="item.image" class="tools-card__image" :src="item.image" :alt="item.title" />
                    <div class="tools-card__overlay"></div>
                    <div class="tools-card__content">
                        <h3>{{ item.title }}</h3>
                        <span class="tools-card__tag">{{ item.badge }}</span>
                    </div>
                </NuxtLink>
            </div>

            <div v-if="!filteredToolCards.length" class="tools-empty">
                <strong>{{ texts.noToolResult }}</strong>
                <span>{{ texts.noToolResultHint }}</span>
            </div>
        </section>
    </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
    aiToolTexts,
    buildToolCardPath,
    getToolCategoryFilter,
    toolCategoryOptions
} from '~/composables/use-ai-tools'
import type { ToolCardItem, ToolCategoryFilter } from '~/composables/use-ai-tools'
import { useAiPcHomeDecorate } from '~/composables/useAiPcHomeDecorate'
import { useAiRecentTools } from '~/composables/useAiRecentTools'
import { restoreAiToolsReturnPosition, saveAiToolsReturnPosition } from '~/composables/useAiToolsReturnPosition'

const texts = aiToolTexts
const { displayToolCards, loadAvailableApps, loadPcHomeDecorate } = useAiPcHomeDecorate()
const { getRecentToolCards, hydrateRecentTools, recordRecentTool } = useAiRecentTools()
const toolKeyword = ref('')
const activeToolCategory = ref<ToolCategoryFilter>('全部')
const selectedFeaturedToolId = ref('')
const selectedToolCardId = ref(displayToolCards.value[0]?.id ?? '')
const categoryHeaderStuck = ref(false)
let categoryHeaderFrame = 0

const normalizedToolKeyword = computed(() => toolKeyword.value.trim().toLowerCase())

const featuredToolDisplayLimit = 8
const filteredRecentTools = computed(() => getRecentToolCards(displayToolCards.value, featuredToolDisplayLimit).filter((item) => (
    !normalizedToolKeyword.value
    || [item.title, item.detailDescription, item.badge, item.category].some((field) => field.toLowerCase().includes(normalizedToolKeyword.value))
)))

const filteredToolCards = computed(() => displayToolCards.value.filter((item) => {
    const itemCategoryFilter = getToolCategoryFilter(item)
    const matchKeyword = !normalizedToolKeyword.value
        || [item.title, item.badge, item.category, itemCategoryFilter, item.detailName].some((field) => field.toLowerCase().includes(normalizedToolKeyword.value))
    const matchCategory = activeToolCategory.value === '全部' || itemCategoryFilter === activeToolCategory.value

    return matchKeyword && matchCategory
}))

watch(filteredRecentTools, (items) => {
    if (items.length && !items.some((item) => item.id === selectedFeaturedToolId.value)) {
        selectedFeaturedToolId.value = items[0].id
    }
})

watch(filteredToolCards, (items) => {
    if (items.length && !items.some((item) => item.id === selectedToolCardId.value)) {
        selectedToolCardId.value = items[0].id
    }
})

const selectRecentTool = (item: ToolCardItem) => {
    recordRecentTool(item, { updateState: false })
    saveAiToolsReturnPosition()
    selectedFeaturedToolId.value = item.id
    activeToolCategory.value = getToolCategoryFilter(item) || '全部'
}

const selectToolCard = (item: ToolCardItem) => {
    recordRecentTool(item, { updateState: false })
    saveAiToolsReturnPosition()
    selectedToolCardId.value = item.id
}

const syncCategoryHeaderStuck = () => {
    if (typeof window === 'undefined') return
    const main = document.querySelector<HTMLElement>('.workspace-main')
    const stuck = (main?.scrollTop || 0) > 8
    categoryHeaderStuck.value = stuck
    document.querySelector<HTMLElement>('.tools-section__heading--row')?.classList.toggle('is-stuck', stuck)
}

const startCategoryHeaderSync = () => {
    if (typeof window === 'undefined') return
    const tick = () => {
        syncCategoryHeaderStuck()
        categoryHeaderFrame = window.requestAnimationFrame(tick)
    }
    categoryHeaderFrame = window.requestAnimationFrame(tick)
}

const stopCategoryHeaderSync = () => {
    if (typeof window === 'undefined' || !categoryHeaderFrame) return
    window.cancelAnimationFrame(categoryHeaderFrame)
    categoryHeaderFrame = 0
}

onMounted(async () => {
    hydrateRecentTools()
    await loadAvailableApps()
    loadPcHomeDecorate()
    await nextTick()
    syncCategoryHeaderStuck()
    document.querySelector<HTMLElement>('.workspace-main')?.addEventListener('scroll', syncCategoryHeaderStuck, { passive: true })
    startCategoryHeaderSync()
    await restoreAiToolsReturnPosition()
})

onBeforeUnmount(() => {
    document.querySelector<HTMLElement>('.workspace-main')?.removeEventListener('scroll', syncCategoryHeaderStuck)
    stopCategoryHeaderSync()
})
</script>

<style lang="scss" scoped>
.tools-shell {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 100%;
    min-height: 100%;
    padding-top: 0;
    box-sizing: border-box;
}

.tools-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
}

.tools-section__heading {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.tools-section__heading--row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.tools-section--all .tools-section__heading--row {
    position: sticky;
    top: 0;
    z-index: 8;
    height: 72px;
    min-height: 72px;
    padding: 0;
    background: transparent;
    box-sizing: border-box;
    flex-shrink: 0;
}

.tools-section--all .tools-section__heading--row.is-stuck {
    background: #050505;
}

.tools-section__heading-main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    height: 100%;
    flex: 1;
}

.tools-section__heading h2 {
    margin: 0;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
}

.tools-section__title {
    margin: 0;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
}

.tools-search {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: min(312px, 100%);
    height: 36px;
    padding: 0 16px 0 40px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    box-sizing: border-box;
}

.tools-search__icon {
    position: absolute;
    left: 16px;
    width: 14px;
    height: 14px;
    border: 1.5px solid rgba(255, 255, 255, 0.58);
    border-radius: 50%;
}

.tools-search__icon::after {
    content: '';
    position: absolute;
    right: -4px;
    bottom: -2px;
    width: 6px;
    height: 1.5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.58);
    transform: rotate(45deg);
    transform-origin: center;
}

.tools-search input {
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-size: 14px;
}

.tools-search input::placeholder {
    color: rgba(255, 255, 255, 0.42);
}

.tools-search--inline {
    width: min(312px, 100%);
    flex-shrink: 0;
}

.tools-featured-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    width: 100%;
}

.tools-featured-card,
.tools-categories button,
.tools-card {
    border: 0;
    cursor: pointer;
    transition:
        transform 0.2s ease,
        border-color 0.2s ease,
        background 0.2s ease,
        box-shadow 0.2s ease,
        color 0.2s ease;
}

.tools-featured-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 148px;
    gap: 18px;
    min-height: 142px;
    padding: 14px 18px 14px 22px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 20px;
    background: #242424;
    overflow: hidden;
    box-sizing: border-box;
}

.tools-featured-card:hover,
.tools-featured-card.is-active {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
}

.tools-featured-card.is-active {
    background: #2b2b2b;
}

.tools-featured-card__copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    min-width: 0;
}

.tools-featured-card__copy h3 {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    color: #fff;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.15;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.tools-featured-card__copy p {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    color: rgba(255, 255, 255, 0.34);
    font-size: 12px;
    line-height: 1.45;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.tools-featured-card__visual {
    align-self: center;
    width: 148px;
    height: 114px;
    border-radius: 16px;
    overflow: hidden;
}

.tools-featured-card__visual img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.tools-categories {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--category-chip-gap, 20px);
    width: 100%;
}

.tools-categories button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--category-chip-min-height, 32px);
    padding: 0 var(--category-chip-padding-x, 16px);
    border-radius: var(--category-chip-radius, 4px);
    background: transparent;
    color: var(--category-chip-text-color, rgba(255, 255, 255, 0.62));
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
}

.tools-categories button:hover {
    color: var(--category-chip-active-color, #fff);
}

.tools-categories button.is-active {
    background: var(--category-chip-active-bg, #2c2c2c);
    color: var(--category-chip-active-color, #fff);
}

.tools-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 16px;
    width: 100%;
}

.tools-card {
    position: relative;
    min-height: 0;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 18px;
    background: #171717;
    overflow: hidden;
    aspect-ratio: 3 / 4;
    box-sizing: border-box;
}

.tools-card:hover,
.tools-card.is-active {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    box-shadow: 0 20px 36px rgba(0, 0, 0, 0.22);
}

.tools-card__image,
.tools-card__overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.tools-card__image {
    object-fit: cover;
    transition:
        transform 0.35s ease,
        filter 0.35s ease;
}

.tools-card:hover .tools-card__image,
.tools-card.is-active .tools-card__image {
    transform: scale(1.04);
    filter: saturate(1.06) brightness(1.04);
}

.tools-card__overlay {
    background:
        linear-gradient(180deg, rgba(0, 0, 0, 0) 44%, rgba(0, 0, 0, 0.26) 70%, rgba(0, 0, 0, 0.82) 100%),
        linear-gradient(180deg, rgba(255, 255, 255, 0) 58%, rgba(255, 255, 255, 0.03) 100%);
}

.tools-card__content {
    position: absolute;
    inset: auto 16px 16px;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
}

.tools-card__content h3 {
    margin: 0;
    color: #fff;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.4;
    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.tools-card__tag {
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 1.4;
}

.tools-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 220px;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.02);
    text-align: center;
}

.tools-empty strong {
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
}

.tools-empty span {
    color: rgba(255, 255, 255, 0.54);
    font-size: 14px;
    line-height: 1.6;
}

@media (max-width: 1480px) {
    .tools-featured-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .tools-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

@media (max-width: 1200px) {
    .tools-shell {
        padding-top: 0;
    }

    .tools-featured-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tools-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 900px) {
    .tools-section--all .tools-section__heading--row {
        flex-direction: row;
        align-items: center;
    }

    .tools-section--all .tools-search--inline {
        width: min(312px, 100%);
    }

    .tools-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 680px) {
    .tools-featured-grid,
    .tools-grid {
        grid-template-columns: 1fr;
    }

    .tools-featured-card {
        grid-template-columns: 1fr;
        min-height: unset;
    }

    .tools-featured-card__visual {
        width: 100%;
        height: 180px;
    }
}
</style>
