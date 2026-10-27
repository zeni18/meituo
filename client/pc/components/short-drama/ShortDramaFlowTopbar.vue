<template>
    <header class="short-drama-flow-topbar">
        <div class="flow-project">
            <button class="flow-project__back" type="button" @click="$emit('back')">
                <img class="flow-project__arrow" :src="iconUrl('Arrow-right.svg')" alt="" />
            </button>
            <span>{{ title || '短剧创作' }}</span>
            <button
                v-if="editable"
                class="flow-project__edit"
                type="button"
                aria-label="修改标题"
                title="修改标题"
                @click.stop="$emit('rename')"
            >
                修改
            </button>
        </div>

        <nav v-if="showSteps !== false" class="flow-step-tabs" aria-label="短剧创作步骤">
            <button
                v-for="step in steps"
                :key="step.key"
                :class="['flow-step-tab', { 'is-active': active === step.key }]"
                type="button"
                @click="$emit('step', step.key)"
            >
                <img :src="iconUrl(step.icon)" alt="" />
                <span>{{ step.label }}</span>
            </button>
        </nav>

        <div class="flow-right">
            <ShortDramaCreditPill
                class="flow-credit-pill"
                :points="creditText"
                :action-text="membershipText"
                :membership-enabled="membershipEnabled"
                :fixed="false"
                @refresh="refreshCredits(false)"
            />
            <slot name="actions"></slot>
        </div>
    </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePcCredits } from '~/composables/usePcCredits'
import ShortDramaCreditPill from '~/components/short-drama/ShortDramaCreditPill.vue'

type FlowStepKey = 'script' | 'subject' | 'scene' | 'storyboard'

defineProps<{
    active: FlowStepKey
    title?: string
    editable?: boolean
    showSteps?: boolean
}>()

defineEmits<{
    back: []
    step: [key: FlowStepKey]
    rename: []
}>()

const runtimeConfig = useRuntimeConfig()
const { remainingCredits, membershipEnabled, refreshCredits } = usePcCredits()
const steps: Array<{ key: FlowStepKey; label: string; icon: string }> = [
    { key: 'script', label: '剧本', icon: 'juben.svg' },
    { key: 'subject', label: '主体', icon: 'renwu.svg' },
    { key: 'scene', label: '场景', icon: 'changjing.svg' },
    { key: 'storyboard', label: '分镜', icon: 'fenjing.svg' }
]

const iconUrl = (name: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/short-drama/figma/icon/${name}` || `/short-drama/figma/icon/${name}`
}
const creditText = computed(() => {
    const value = Number(remainingCredits.value || 0)
    if (!Number.isFinite(value)) return '0'
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
})
const membershipText = computed(() => membershipEnabled.value ? '会员中心' : '开通会员')

onMounted(() => {
    refreshCredits(false).catch(() => undefined)
})
</script>

<style scoped lang="scss">
.short-drama-flow-topbar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 72px;
    border-bottom: 1px solid #242426;
    background: #0c0c0d;
    color: #fff;
    font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.flow-project {
    position: absolute;
    top: 0;
    left: 28px;
    display: inline-flex;
    align-items: center;
    gap: 13px;
    max-width: min(420px, 26vw);
    height: 72px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    font-size: 14px;
    line-height: 14px;

    > span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.flow-project__back,
.flow-project__edit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.flow-project__back {
    width: 18px;
    height: 18px;
}

.flow-project__edit {
    flex: 0 0 auto;
    height: 28px;
    padding: 0 10px;
    border-radius: 14px;
    background: #1e1f20;
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    line-height: 12px;
}

.flow-project__edit:hover {
    color: #fff;
    background: #343537;
}

.flow-project__arrow {
    width: 14px;
    height: 14px;
    object-fit: contain;
    filter: brightness(0) invert(1);
    transform: rotate(180deg);
}

.flow-step-tabs {
    display: grid;
    grid-template-columns: repeat(4, 91px);
    align-items: center;
    justify-content: center;
    width: 372px;
    height: 48px;
    padding: 4px;
    border-radius: 8px;
    background: #1e1f20;
    box-sizing: border-box;
}

.flow-step-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 40px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    font-size: 14px;
    line-height: 14px;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease;

    img {
        width: 20px;
        height: 20px;
        object-fit: contain;
        opacity: 0.74;
        filter: brightness(0) invert(1);
    }

    &.is-active {
        background: #343537;
        color: #fff;

        img {
            opacity: 1;
        }
    }
}

.flow-right {
    position: absolute;
    top: 14px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
}

@media (max-width: 1280px) {
    .flow-project {
        max-width: 260px;
    }

    .flow-right {
        gap: 10px;
    }
}

@media (max-width: 1440px) {
    .flow-credit-pill :deep(.short-drama-credit-pill__divider),
    .flow-credit-pill :deep(.short-drama-credit-pill__member) {
        display: none;
    }
}
</style>
