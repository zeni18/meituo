<template>
    <div
        class="workspace-page"
        :class="{ 'workspace-page--smart-workbench': isSmartWorkbenchTool }"
    >
        <div class="workspace-page__background" :style="backgroundStyle"></div>
        <div class="workspace-page__noise"></div>
        <div class="workspace-page__stars workspace-page__stars--near"></div>
        <div class="workspace-page__stars workspace-page__stars--far"></div>

        <AiWorkspaceChrome
            :active-sidebar="activeSidebar"
            :remaining-credits="remainingCredits"
            :membership-enabled="membershipEnabled"
            :active-popover="activePopover"
            :popover-content="chromePopoverContent"
            @toggle-popover="togglePopover"
            @increment-credits="refreshCredits"
            @toggle-membership="refreshCredits"
            @go-home="goHome"
            @navigate="handleSidebar"
        />

        <main v-if="toolAccessReady" class="workspace-main">
            <AigcProductImageCreator v-if="toolId === 'aigc_product_image'" :membership-enabled="membershipEnabled" />
            <AigcStyleTransferCreator v-else-if="toolId === 'aigc_style_transfer'" />
            <PhotoRestoreCreator v-else-if="toolId === 'aigc_photo_restore'" />
            <ModelWearCreator v-else-if="toolId === 'aigc_model_wear'" />
            <BackgroundRemovalCreator v-else-if="toolId === 'aigc_background_removal'" />
            <ImageTranslateCreator v-else-if="toolId === 'aigc_image_translate'" />
            <OneClickCleanupCreator v-else-if="toolId === 'aigc_one_click_cleanup'" />
            <ProductSuiteCreator v-else-if="toolId === 'aigc_product_suite'" />
            <ProductMultiAngleCreator v-else-if="toolId === 'aigc_product_multi_angle'" />
            <FashionLookbookCreator v-else-if="toolId === 'aigc_fashion_lookbook'" />
            <AigcMusicCreator v-else-if="toolId === 'aigc_music'" />
            <ProductPromoVideoCreator v-else-if="toolId === 'aigc_product_promo_video'" />
            <ActionTransferCreator v-else-if="toolId === 'aigc_action_transfer'" />
            <PersonReplacementCreator v-else-if="toolId === 'aigc_person_replacement'" />
            <OutpaintCreator v-else-if="toolId === 'aigc_outpaint'" />
            <LocalRedrawCreator v-else-if="toolId === 'aigc_local_redraw'" />
            <HairstyleCreator v-else-if="toolId === 'aigc_hairstyle'" />
            <FittingCreator v-else-if="toolId === 'aigc_fitting'" />
            <AiWorkspaceToolDetailTemplate v-else-if="isLegacyTemplateTool" :tool-id="toolId" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { usePcCredits } from '~/composables/usePcCredits'
import { buildSidebarRouteLocation } from '~/utils/ai-sidebar'
import AigcProductImageCreator from '~/apps/aigc_product_image/ProductImageCreator.vue'
import AigcStyleTransferCreator from '~/apps/aigc_style_transfer/StyleTransferCreator.vue'
import PhotoRestoreCreator from '~/apps/aigc_photo_restore/PhotoRestoreCreator.vue'
import ModelWearCreator from '~/apps/aigc_model_wear/ModelWearCreator.vue'
import BackgroundRemovalCreator from '~/apps/aigc_background_removal/BackgroundRemovalCreator.vue'
import ImageTranslateCreator from '~/apps/aigc_image_translate/ImageTranslateCreator.vue'
import OneClickCleanupCreator from '~/apps/aigc_one_click_cleanup/OneClickCleanupCreator.vue'
import ProductSuiteCreator from '~/apps/aigc_product_suite/ProductSuiteCreator.vue'
import ProductMultiAngleCreator from '~/apps/aigc_product_multi_angle/ProductMultiAngleCreator.vue'
import FashionLookbookCreator from '~/apps/aigc_fashion_lookbook/FashionLookbookCreator.vue'
import AigcMusicCreator from '~/apps/aigc_music/AigcMusicCreator.vue'
import ProductPromoVideoCreator from '~/apps/aigc_product_promo_video/ProductPromoVideoCreator.vue'
import ActionTransferCreator from '~/apps/aigc_action_transfer/ActionTransferCreator.vue'
import PersonReplacementCreator from '~/apps/aigc_person_replacement/PersonReplacementCreator.vue'
import OutpaintCreator from '~/apps/aigc_outpaint/OutpaintCreator.vue'
import LocalRedrawCreator from '~/apps/aigc_local_redraw/LocalRedrawCreator.vue'
import HairstyleCreator from '~/apps/aigc_hairstyle/HairstyleCreator.vue'
import FittingCreator from '~/apps/aigc_fitting/FittingCreator.vue'
import { useAiPcHomeDecorate } from '~/composables/useAiPcHomeDecorate'
import { normalizeToolRouteId } from '~/composables/use-ai-tools'
import { useAiRecentTools } from '~/composables/useAiRecentTools'
import type { SidebarKey } from '~/utils/ai-sidebar'

definePageMeta({ layout: 'blank' })

type PopoverKey = '' | 'share' | 'api' | 'notice'

const route = useRoute()
const router = useRouter()
const { ensurePcLogin } = usePcLoginGate()
const { remainingCredits, membershipEnabled, refreshCredits } = usePcCredits()
const { displayToolCards, loadAvailableApps } = useAiPcHomeDecorate()
const { recordRecentTool } = useAiRecentTools()
const routeToolId = computed(() => String(route.params.id || 'tool-card-1'))
if (process.client && routeToolId.value === 'tool-card-1') {
    router.replace('/ai/tools')
}
const toolId = computed(() => normalizeToolRouteId(routeToolId.value))
const registeredCreatorToolIds = [
    'aigc_product_image',
    'aigc_style_transfer',
    'aigc_photo_restore',
    'aigc_model_wear',
    'aigc_background_removal',
    'aigc_image_translate',
    'aigc_one_click_cleanup',
    'aigc_product_suite',
    'aigc_product_multi_angle',
    'aigc_fashion_lookbook',
    'aigc_music',
    'aigc_product_promo_video',
    'aigc_action_transfer',
    'aigc_person_replacement',
    'aigc_outpaint',
    'aigc_local_redraw',
    'aigc_hairstyle',
    'aigc_fitting'
]
const legacyTemplateToolIds = [
    'tool-card-1',
    'tool-card-2',
    'tool-card-3',
    'tool-card-4',
    'tool-card-5',
    'tool-card-6',
    'tool-card-7',
    'tool-card-8',
    'tool-card-9',
    'tool-card-10',
    'tool-card-11',
    'tool-card-12',
    'tool-card-13',
    'tool-card-14',
    'tool-card-15',
    'tool-card-16',
    'tool-card-17',
    'tool-card-18',
    'tool-card-19',
    'tool-card-20',
    'tool-card-21',
    'tool-card-22',
    'tool-card-23',
    'tool-card-24',
    'tool-card-25',
    'tool-card-26',
    'tool-card-28',
    'tool-card-29',
    'tool-card-30',
    'tool-card-31',
    'tool-card-32',
    'tool-card-33',
    'tool-card-34',
    'tool-card-35',
    'tool-card-36'
]
const isSmartWorkbenchTool = computed(() => registeredCreatorToolIds.includes(toolId.value))
const isLegacyTemplateTool = computed(() => legacyTemplateToolIds.includes(toolId.value))
const activeSidebar = ref<SidebarKey>('tools')
const activePopover = ref<PopoverKey>('')
const toolAccessReady = ref(false)
const backgroundStyle = computed(() => ({
    backgroundImage: 'linear-gradient(180deg, #050505 0%, #06070a 42%, #050505 100%)'
}))

const chromePopoverContent = computed(() => ({
    share: {
        title: '分享有礼',
        text: '分享工具页给团队成员，双方各获得 10 次创作额度。'
    },
    api: {
        title: 'API 调用',
        text: '当前体验额度可用于工具调用、图像处理和批量创作。'
    },
    notice: {
        title: '工具创作页',
        text: '当前页面为工具详情模板，后续可继续接入真实工具参数和接口。',
        compact: true
    }
}))

const togglePopover = (key: Exclude<PopoverKey, ''>) => {
    activePopover.value = activePopover.value === key ? '' : key
}

const goHome = () => router.push('/')

const handleSidebar = (key: SidebarKey) => {
    if (key === 'tools') {
        router.push('/ai/tools')
        return
    }

    if ((key === 'create' || key === 'assets') && !ensurePcLogin({ redirect: buildSidebarRouteLocation(key).path || route.fullPath })) return
    router.push(buildSidebarRouteLocation(key))
}

onMounted(async () => {
    await loadAvailableApps()
    const currentTool = displayToolCards.value.find((item) => item.id === toolId.value || item.appCode === toolId.value)
    if (!currentTool) {
        router.replace('/ai/tools')
        return
    }
    recordRecentTool(currentTool)
    toolAccessReady.value = true
})

onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
:global(html) {
    overflow: hidden;
}

:global(body) {
    overflow: hidden;
}

.workspace-page {
    position: relative;
    height: 100vh;
    padding: 24px 0 40px;
    background: #050505;
    color: #fff;
    overflow: hidden;
    box-sizing: border-box;
}

.workspace-page__background,
.workspace-page__noise,
.workspace-page__stars {
    position: fixed;
    inset: 0;
    pointer-events: none;
    will-change: opacity;
}

.workspace-page__background {
    background-position: center top;
    background-repeat: no-repeat;
    background-size: cover;
}

.workspace-page__noise {
    background-image:
        radial-gradient(circle at 6% 16%, rgba(255, 255, 255, 0.65) 0 1px, transparent 1.8px),
        radial-gradient(circle at 12% 54%, rgba(255, 255, 255, 0.4) 0 1px, transparent 1.8px),
        radial-gradient(circle at 18% 32%, rgba(255, 255, 255, 0.35) 0 1px, transparent 1.6px),
        radial-gradient(circle at 26% 12%, rgba(255, 255, 255, 0.55) 0 1px, transparent 1.6px),
        radial-gradient(circle at 34% 58%, rgba(255, 255, 255, 0.45) 0 1px, transparent 1.8px),
        radial-gradient(circle at 42% 18%, rgba(255, 255, 255, 0.45) 0 1px, transparent 1.5px),
        radial-gradient(circle at 52% 10%, rgba(255, 255, 255, 0.55) 0 1px, transparent 1.5px),
        radial-gradient(circle at 61% 44%, rgba(255, 255, 255, 0.35) 0 1px, transparent 1.5px),
        radial-gradient(circle at 72% 20%, rgba(255, 255, 255, 0.48) 0 1px, transparent 1.7px),
        radial-gradient(circle at 84% 38%, rgba(255, 255, 255, 0.42) 0 1px, transparent 1.7px),
        radial-gradient(circle at 90% 14%, rgba(255, 255, 255, 0.52) 0 1px, transparent 1.7px),
        radial-gradient(circle at 96% 52%, rgba(255, 255, 255, 0.35) 0 1px, transparent 1.8px);
    opacity: 0.24;
}

.workspace-page__stars {
    opacity: 0.95;
    mix-blend-mode: screen;
}

.workspace-page__stars--near {
    background-image:
        radial-gradient(circle at 10% 22%, rgba(255, 255, 255, 0.95) 0 1.4px, transparent 2.2px),
        radial-gradient(circle at 21% 68%, rgba(255, 255, 255, 0.92) 0 1.2px, transparent 2px),
        radial-gradient(circle at 36% 36%, rgba(255, 255, 255, 0.98) 0 1.5px, transparent 2.2px),
        radial-gradient(circle at 48% 14%, rgba(255, 255, 255, 0.9) 0 1.3px, transparent 2px),
        radial-gradient(circle at 57% 60%, rgba(255, 255, 255, 0.9) 0 1.1px, transparent 1.8px),
        radial-gradient(circle at 69% 28%, rgba(255, 255, 255, 0.96) 0 1.5px, transparent 2.2px),
        radial-gradient(circle at 82% 58%, rgba(255, 255, 255, 0.94) 0 1.25px, transparent 2px),
        radial-gradient(circle at 92% 20%, rgba(255, 255, 255, 0.9) 0 1.35px, transparent 2px);
    animation: starTwinkle 4.8s ease-in-out infinite alternate;
}

.workspace-page__stars--far {
    background-image:
        radial-gradient(circle at 14% 10%, rgba(160, 203, 255, 0.8) 0 1px, transparent 1.8px),
        radial-gradient(circle at 30% 48%, rgba(255, 255, 255, 0.72) 0 0.9px, transparent 1.5px),
        radial-gradient(circle at 44% 72%, rgba(178, 193, 255, 0.72) 0 0.9px, transparent 1.5px),
        radial-gradient(circle at 60% 8%, rgba(255, 255, 255, 0.68) 0 1px, transparent 1.6px),
        radial-gradient(circle at 78% 42%, rgba(181, 220, 255, 0.75) 0 0.95px, transparent 1.6px),
        radial-gradient(circle at 88% 74%, rgba(255, 255, 255, 0.7) 0 1px, transparent 1.6px);
    animation: starTwinkle 6.2s ease-in-out infinite alternate-reverse;
}

.workspace-main {
    position: relative;
    z-index: 1;
    width: var(--ai-content-width);
    margin-left: var(--ai-content-left);
    margin-right: var(--ai-content-gutter);
    height: 100%;
    padding: 22px 0 0;
    overflow: hidden;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: #242424 transparent;
}

.workspace-main::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    background: transparent;
}

.workspace-main::-webkit-scrollbar-track {
    background: transparent;
}

.workspace-main::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #242424;
}

.workspace-main::-webkit-scrollbar-thumb:hover {
    background: #242424;
}

.workspace-page--smart-workbench {
    padding: 0;
}

.workspace-page--smart-workbench .workspace-main {
    width: auto;
    margin: 0;
    padding: 24px 40px 0 116px;
}

@keyframes starTwinkle {
    0% {
        opacity: 0.52;
    }

    100% {
        opacity: 1;
    }
}

@media (max-width: 1200px) {
    :global(html),
    :global(body) {
        overflow: auto;
    }

    .workspace-page {
        height: auto;
        padding-bottom: 32px;
    }

    .workspace-main {
        height: auto;
        width: auto;
        margin-inline: 16px;
        padding: 210px 16px 32px;
        overflow: visible;
    }

    .workspace-page--smart-workbench {
        height: auto;
        padding-bottom: 32px;
    }

    .workspace-page--smart-workbench .workspace-main {
        margin: 0;
        padding: 24px 16px 32px 96px;
    }
}

@media (max-width: 820px) {
    .workspace-page {
        padding-inline: 16px;
    }

    .workspace-main {
        padding-top: 232px;
    }

    .workspace-page--smart-workbench .workspace-main {
        padding-top: 24px;
    }
}
</style>
