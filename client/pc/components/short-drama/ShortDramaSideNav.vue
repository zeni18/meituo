<template>
    <nav class="short-drama-side-nav" aria-label="短剧导航">
        <button
            v-for="item in navItems"
            :key="item.key"
            :class="['short-drama-side-nav__item', { 'is-active': item.key === active }]"
            type="button"
            :aria-label="item.label"
            :title="item.label"
            @click="go(item)"
        >
            <img
                class="short-drama-side-nav__icon"
                :src="item.key === active ? item.activeIcon : item.icon"
                alt=""
            />
        </button>
    </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { useUserStore } from '@/stores/user'

type ShortDramaNavKey = 'home' | 'subject' | 'project'
type ShortDramaNavItem = {
    key: ShortDramaNavKey
    label: string
    path: string
    icon: string
    activeIcon: string
    auth?: boolean
}

const props = defineProps<{
    active: ShortDramaNavKey
}>()

const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()

const withPublicBase = (path: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/${path.replace(/^\/+/, '')}` || '/'
}

const iconAsset = (name: string) => withPublicBase(`/short-drama/figma/icon/${name}.svg`)

const navItems = computed<ShortDramaNavItem[]>(() => [
    {
        key: 'home',
        label: '首页',
        path: '/ai/short-drama',
        icon: iconAsset('Home-two1'),
        activeIcon: iconAsset('Home-two1-1')
    },
    {
        key: 'subject',
        label: '主体',
        path: '/ai/short-drama/subject',
        icon: iconAsset('User-positioning1'),
        activeIcon: iconAsset('User-positioning2')
    },
    {
        key: 'project',
        label: '项目',
        path: '/ai/short-drama/projects',
        icon: iconAsset('Folder-minus1'),
        activeIcon: iconAsset('Folder-minus2'),
        auth: true
    }
])

const go = (item: ShortDramaNavItem) => {
    if (item.auth && !userStore.restoreToken()) {
        ensurePcLogin({
            redirect: item.path,
            returnTo: item.path
        })
        return
    }
    router.push(item.path)
}
</script>

<style lang="scss" scoped>
.short-drama-side-nav {
    position: fixed;
    top: 50%;
    left: 24px;
    z-index: 11;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 60px;
    height: auto;
    padding: 4px;
    border: 0;
    border-radius: 30px;
    background: rgba(30, 31, 32, 0.2);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transform: translateY(-50%);
    box-sizing: border-box;
}

.short-drama-side-nav__item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #a1a1a1;
    cursor: pointer;
    transition: color 0.18s ease, background 0.18s ease;
}

.short-drama-side-nav__item.is-active,
.short-drama-side-nav__item:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}

.short-drama-side-nav__icon {
    position: relative;
    z-index: 5;
    display: block;
    width: 24px;
    height: 24px;
    object-fit: contain;
    pointer-events: none;
}

@media (max-width: 768px) {
    .short-drama-side-nav {
        left: 14px;
        width: 52px;
    }

    .short-drama-side-nav__item {
        width: 44px;
        height: 44px;
    }
}
</style>
