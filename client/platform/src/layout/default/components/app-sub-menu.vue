<template>
    <el-card v-if="appMenu" class="app-sub-menu !border-none mb-4" shadow="never">
        <div class="app-sub-menu__bar">
            <button class="app-sub-menu__back" type="button" @click="backToMarket">
                <el-icon><ArrowLeft /></el-icon>
                <span>返回</span>
            </button>
            <span class="app-sub-menu__divider"></span>
            <div class="app-sub-menu__tabs">
                <template v-for="item in appMenu.items" :key="item.path">
                    <el-dropdown
                        v-if="item.children?.length"
                        trigger="hover"
                        popper-class="app-sub-menu-dropdown"
                        @command="goToPath"
                    >
                        <router-link
                            :to="tabPath(item.path)"
                            class="app-sub-menu__tab"
                            :class="{ 'is-active': item.active }"
                        >
                            <span>{{ item.title }}</span>
                            <el-icon class="app-sub-menu__arrow"><ArrowDown /></el-icon>
                        </router-link>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item
                                    v-for="child in flattenChildren(item.children)"
                                    :key="`${child.path}-${child.title}`"
                                    :command="child.path"
                                    :class="{ 'is-active': child.active }"
                                    :style="{ paddingLeft: `${14 + child.level * 16}px` }"
                                >
                                    {{ child.title }}
                                </el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    <router-link
                        v-else
                        :to="tabPath(item.path)"
                        class="app-sub-menu__tab"
                        :class="{ 'is-active': item.active }"
                    >
                        {{ item.title }}
                    </router-link>
                </template>
            </div>
        </div>
    </el-card>
</template>

<script lang="ts" setup>
import { ArrowDown, ArrowLeft } from '@element-plus/icons-vue'
import useUserStore from '@/stores/modules/user'

import type { AppMenuItem } from '../utils/app-menu'
import { getCurrentAppMenu } from '../utils/app-menu'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const appMenu = computed(() => getCurrentAppMenu(userStore.routes, route.path))
const tabPath = (path: string) => path
const goToPath = (path: string) => {
    router.push(tabPath(path))
}
const backToMarket = () => {
    router.push('/apps/center')
}
const flattenChildren = (items: AppMenuItem[] = [], level = 0): Array<AppMenuItem & { level: number }> =>
    items.flatMap((item) => [
        {
            ...item,
            level
        },
        ...flattenChildren(item.children || [], level + 1)
    ])
</script>

<style lang="scss" scoped>
.app-sub-menu {
    :deep(.el-card__body) {
        padding: 0 16px;
    }
    &__bar {
        min-height: 52px;
        display: flex;
        align-items: center;
    }
    &__back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 52px;
        padding: 0 14px 0 0;
        border: 0;
        background: transparent;
        color: var(--el-text-color-regular);
        cursor: pointer;
        white-space: nowrap;
        &:hover {
            color: var(--el-color-primary);
        }
    }
    &__divider {
        width: 1px;
        height: 18px;
        margin-right: 12px;
        background: var(--el-border-color);
    }
    &__tabs {
        min-height: 52px;
        display: flex;
        align-items: stretch;
        gap: 2px;
        overflow-x: auto;
    }
    &__tab {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 18px;
        color: var(--el-text-color-regular);
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        &:hover {
            color: var(--el-color-primary);
        }
        &.is-active {
            color: var(--el-color-primary);
            background: var(--el-color-primary-light-9);
            border-bottom-color: var(--el-color-primary);
            font-weight: 500;
        }
    }
    &__arrow {
        font-size: 12px;
    }
}
</style>

<style lang="scss">
.app-sub-menu-dropdown {
    .el-dropdown-menu__item.is-active {
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        font-weight: 500;
    }
}
</style>
