<template>
    <header class="header">
        <div class="navbar">
            <div class="flex-1 flex">
                <div class="navbar-item">
                    <el-tooltip
                        class="box-item"
                        effect="dark"
                        :content="isCollapsed ? '展开菜单' : '收起菜单'"
                        placement="bottom"
                    >
                        <fold />
                    </el-tooltip>
                </div>
                <div class="navbar-item">
                    <el-tooltip class="box-item" effect="dark" content="刷新" placement="bottom">
                        <refresh />
                    </el-tooltip>
                </div>
                <div class="navbar-item px-2 app-location" v-if="!isMobile && appLocationItems.length">
                    <template v-for="(item, index) in appLocationItems" :key="item">
                        <icon
                            v-if="index > 0"
                            class="app-location__arrow"
                            :size="14"
                            name="el-icon-arrow-right"
                        />
                        <span class="app-location__text">{{ item }}</span>
                    </template>
                </div>
                <div
                    class="flex items-center px-2"
                    v-if="!isMobile && settingStore.showCrumb && !isAppContextPage"
                >
                    <breadcrumb />
                </div>
            </div>
            <div class="flex">
                <div class="navbar-item" v-if="!isMobile">
                    <el-tooltip
                        class="box-item"
                        effect="dark"
                        :content="isFullscreen ? '退出全屏' : '全屏模式'"
                        placement="bottom"
                    >
                        <full-screen />
                    </el-tooltip>
                </div>
                <div class="navbar-item">
                    <user-drop-down />
                </div>
                <div class="navbar-item">
                    <el-tooltip
                        class="box-item"
                        effect="dark"
                        content="主题设置"
                        placement="bottom"
                    >
                        <setting />
                    </el-tooltip>
                </div>
            </div>
        </div>
        <multiple-tabs v-if="settingStore.openMultipleTabs && !hideMultipleTabs" />
    </header>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'

import useAppStore from '@/stores/modules/app'
import useSettingStore from '@/stores/modules/setting'
import useUserStore from '@/stores/modules/user'

import { getCurrentAppMenu } from '../../utils/app-menu'
import Setting from '../setting/index.vue'
import Breadcrumb from './breadcrumb.vue'
import Fold from './fold.vue'
import FullScreen from './full-screen.vue'
import MultipleTabs from './multiple-tabs.vue'
import Refresh from './refresh.vue'
import UserDropDown from './user-drop-down.vue'

const appStore = useAppStore()
const isMobile = computed(() => appStore.isMobile)
const isCollapsed = computed(() => appStore.isCollapsed)
const settingStore = useSettingStore()
const userStore = useUserStore()
const route = useRoute()
const { isFullscreen } = useFullscreen()
const currentAppMenu = computed(() => getCurrentAppMenu(userStore.routes, route.path))
const isAppPage = computed(() => !!currentAppMenu.value)
const isAppCenterPage = computed(() => {
    const path = route.path
    return (
        path.startsWith('/apps') ||
        path.startsWith('/app/market') ||
        path.startsWith('/app/my') ||
        route.matched.some((item) => {
            const sourceMenuKey = String(item.meta?.sourceMenuKey || '')
            const title = String(item.meta?.title || '')
            return (
                sourceMenuKey === 'core_tenant_app_center' ||
                sourceMenuKey === 'core_tenant_app_market' ||
                sourceMenuKey === 'core_tenant_my_app' ||
                ['应用管理', '应用市场', '我的应用'].includes(title)
            )
        })
    )
})
const isAppContextPage = computed(() => isAppPage.value || isAppCenterPage.value)
const hideMultipleTabs = computed(() => isAppContextPage.value)
const appLocationItems = computed(() => {
    if (currentAppMenu.value) {
        return [currentAppMenu.value.title, ...currentAppMenu.value.activeTitles].filter(
            (item, index, list): item is string => !!item && list.indexOf(item) === index
        )
    }
    if (!isAppCenterPage.value) {
        return []
    }
    const routeTitle =
        String(route.meta?.title || '') ||
        [...route.matched].reverse().find((item) => item.meta?.title)?.meta?.title ||
        ''
    return routeTitle && routeTitle !== '应用中心' && routeTitle !== '应用管理'
        ? [String(routeTitle)]
        : []
})
</script>

<style lang="scss">
.navbar {
    height: var(--navbar-height);
    @apply flex px-2 bg-body;
    .navbar-item {
        @apply h-full  flex justify-center items-center  hover:bg-page;
    }
    .app-location {
        gap: 10px;
        &:hover {
            background: transparent;
        }
        &__arrow {
            color: var(--el-text-color-placeholder);
        }
        &__text {
            color: var(--el-text-color-regular);
            font-size: 15px;
            font-weight: 500;
            white-space: nowrap;
        }
    }
}
</style>
