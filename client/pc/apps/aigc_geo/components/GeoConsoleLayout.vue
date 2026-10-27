<template>
    <el-container class="geo-console">
        <el-aside class="geo-console__aside" width="256px">
            <NuxtLink class="geo-console__brand" to="/app/aigc_geo">
                <span>GEO</span>
                <div>
                    <strong>GEO营销优化系统</strong>
                    <small>推广产品 · q w</small>
                </div>
            </NuxtLink>

            <el-dropdown class="geo-console__create" trigger="click" @command="handleCreate">
                <el-button type="primary">
                    <el-icon><Plus /></el-icon>
                    新建
                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item v-for="item in geoCreateActions" :key="item.label" :command="item.target">
                            <div class="geo-create-item">
                                <strong>{{ item.label }}</strong>
                                <small>{{ item.desc }}</small>
                            </div>
                        </el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>

            <el-scrollbar ref="menuScrollbar" class="geo-console__menu-scroll" @scroll="handleMenuScroll">
                <el-menu
                    :default-active="activePath"
                    :default-openeds="defaultOpeneds"
                    router
                    class="geo-console__menu"
                    @select="saveMenuScroll"
                >
                    <el-menu-item v-for="item in geoConsoleRootItems" :key="item.key" :index="item.path">
                        <el-icon>
                            <House v-if="item.key === 'dashboard'" />
                            <DataAnalysis v-else />
                        </el-icon>
                        <span>{{ item.label }}</span>
                    </el-menu-item>
                    <el-sub-menu v-for="group in geoMenuGroups" :key="group.label" :index="group.label">
                        <template #title>
                            <el-icon>
                                <component :is="groupIcons[group.label] || Management" />
                            </el-icon>
                            <span>{{ groupDisplayNames[group.label] || group.label }}</span>
                        </template>
                        <el-menu-item v-for="item in group.items" :key="item.key" :index="item.path">
                            <span>{{ item.label }}</span>
                            <el-tag v-if="item.badge" size="small" effect="plain">{{ item.badge }}</el-tag>
                        </el-menu-item>
                    </el-sub-menu>
                </el-menu>
            </el-scrollbar>

            <button class="geo-console__user-card" type="button" @click="router.push('/app/aigc_geo/console/account-settings')">
                <span>演</span>
                <div>
                    <strong>演示用户</strong>
                    <small>演示品牌 · 个人中心</small>
                </div>
                <i></i>
            </button>
        </el-aside>

        <el-container class="geo-console__main">
            <div v-if="showDesktopBanner" class="geo-console__download">
                <span>新功能</span>
                <strong>桌面端发布器支持账号矩阵统一管理，多平台一键批量发布。</strong>
                <el-button round @click="router.push('/app/aigc_geo/console/site-articles')">立即下载</el-button>
                <button class="geo-download__close" type="button" @click="showDesktopBanner = false">×</button>
            </div>
            <el-header class="geo-console__topbar" height="64px">
                <div class="geo-topbar__left">
                    <el-button title="返回首页" @click="router.push('/app/aigc_geo')">
                        <el-icon><ArrowLeft /></el-icon>
                    </el-button>
                    <div>
                        <span>{{ pageMeta.group }}</span>
                        <strong>{{ pageMeta.title }}</strong>
                    </div>
                </div>

                <el-input
                    v-model="globalSearch"
                    class="geo-topbar__search"
                    :prefix-icon="Search"
                    placeholder="搜索菜单、文章、关键词..."
                    clearable
                    @keyup.enter="applyGlobalSearch"
                />

                <div class="geo-topbar__actions">
                    <el-button @click="refreshMockData">
                        <el-icon><Refresh /></el-icon>
                        刷新
                    </el-button>
                    <el-button type="primary" @click="mockAction(pageMeta.primaryTip)">
                        <el-icon><Plus /></el-icon>
                        {{ pageMeta.primaryAction }}
                    </el-button>
                    <el-button circle title="设置" @click="router.push('/app/aigc_geo/console/site-settings')">
                        <el-icon><Setting /></el-icon>
                    </el-button>
                    <el-badge is-dot>
                        <el-button circle title="消息" @click="mockAction('消息中心将在后续版本开放')">
                            <el-icon><Bell /></el-icon>
                        </el-button>
                    </el-badge>
                </div>
            </el-header>

            <el-main class="geo-console__content">
                <GeoConsolePage :page-key="pageKey" :last-updated="lastUpdated" @refresh="refreshMockData" />
            </el-main>
        </el-container>
    </el-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
    ArrowDown,
    ArrowLeft,
    Bell,
    DataAnalysis,
    Flag,
    House,
    Management,
    Medal,
    Plus,
    Refresh,
    Search,
    Setting,
    Tools,
    TrendCharts
} from '@element-plus/icons-vue'
import feedback from '@/utils/feedback'
import {
    geoAllMenuItems,
    geoConsoleRootItems,
    geoCreateActions,
    geoMenuGroups,
    getGeoPageMeta,
    getGeoRoute
} from '@/apps/aigc_geo/mock'
import GeoConsolePage from './GeoConsolePage.vue'

const props = defineProps<{
    pageKey: string
}>()

const route = useRoute()
const router = useRouter()
const globalSearch = ref('')
const lastUpdated = ref('刚刚')
const showDesktopBanner = ref(true)
const menuScrollbar = ref()
const menuScrollTop = ref(0)
const menuScrollKey = 'aigc_geo_console_menu_scroll_top'

const groupIcons: Record<string, unknown> = {
    '第一步：完善信息': Management,
    '第二步：问题生成': DataAnalysis,
    '第三步：内容生产': TrendCharts,
    '第四步：分发与发布': Flag,
    '第五步：品牌检测': Medal,
    '账户与套餐': Tools,
    管理: Management,
    数据: DataAnalysis,
    品牌: TrendCharts,
    分发: Flag,
    权益: Medal,
    设置: Setting,
    工具: Tools
}

const groupDisplayNames: Record<string, string> = {
    '第一步：完善信息': '01 完善信息',
    '第二步：问题生成': '02 问题生成',
    '第三步：内容生产': '03 内容生产',
    '第四步：分发与发布': '04 分发发布',
    '第五步：品牌检测': '05 品牌检测',
    '账户与套餐': '账户套餐',
    管理: '内容管理',
    数据: '数据分析',
    品牌: '品牌资产',
    分发: '分发投放',
    权益: '权益中心',
    设置: '系统设置',
    工具: '工具中心'
}

const pageMeta = computed(() => getGeoPageMeta(props.pageKey))
const activePath = computed(() => route.path.replace(/\/$/, '') || getGeoRoute(props.pageKey))
const activeGroup = computed(() => geoAllMenuItems.find((item) => item.key === props.pageKey)?.group || pageMeta.value.group)
const defaultOpeneds = computed(() => {
    const firstGroup = '第一步：完善信息'
    if (!activeGroup.value || activeGroup.value === '总览' || activeGroup.value === firstGroup) {
        return [firstGroup]
    }
    return [firstGroup, activeGroup.value]
})

function refreshMockData() {
    lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    feedback.msgSuccess('已刷新静态演示数据')
}

function mockAction(message: string) {
    feedback.msgSuccess(message)
}

function handleCreate(target: string) {
    saveMenuScroll()
    router.push(getGeoRoute(target))
    feedback.msgSuccess('已切换到静态创建入口，真实保存将在接口接入后启用')
}

function applyGlobalSearch() {
    const query = globalSearch.value.trim()
    if (!query) {
        return
    }
    const matched = geoAllMenuItems.find((item) => `${item.group}${groupDisplayNames[item.group] || ''}${item.label}`.includes(query))
        || geoAllMenuItems.find((item) => getGeoPageMeta(item.key).desc.includes(query))
    if (matched) {
        router.push(matched.path)
        return
    }
    feedback.msgWarning('没有找到匹配菜单')
}

function handleMenuScroll(payload: { scrollTop: number }) {
    menuScrollTop.value = payload.scrollTop
    if (process.client) {
        sessionStorage.setItem(menuScrollKey, String(payload.scrollTop))
    }
}

function saveMenuScroll() {
    if (!process.client) {
        return
    }
    const scrollTop = menuScrollbar.value?.wrapRef?.scrollTop ?? menuScrollTop.value
    sessionStorage.setItem(menuScrollKey, String(scrollTop))
}

onMounted(() => {
    if (!process.client) {
        return
    }
    const savedTop = Number(sessionStorage.getItem(menuScrollKey) || 0)
    if (!Number.isFinite(savedTop) || savedTop <= 0) {
        return
    }
    nextTick(() => {
        menuScrollbar.value?.setScrollTop(savedTop)
    })
})

onBeforeUnmount(() => {
    saveMenuScroll()
})
</script>

<style scoped lang="scss">
.geo-console {
    height: 100vh;
    overflow: hidden;
    color: #111827;
    background: #f5f7fb;
}

.geo-console__aside {
    display: flex;
    height: 100vh;
    flex-direction: column;
    border-right: 1px solid #e5e7ef;
    background: #fff;
}

.geo-console__brand {
    display: grid;
    min-height: 72px;
    align-items: center;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid #eef0f5;
    color: inherit;
    text-decoration: none;

    > span {
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border-radius: 8px;
        color: #fff;
        background: #6b28ff;
        font-size: 18px;
        font-weight: 800;
    }

    strong,
    small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    strong {
        font-size: 16px;
        font-weight: 800;
    }

    small {
        margin-top: 4px;
        color: #98a2b3;
        font-size: 12px;
    }
}

.geo-console__create {
    padding: 12px 14px 10px;

    :deep(.el-button) {
        width: 100%;
        height: 44px;
        justify-content: space-between;
        border-color: #6b28ff;
        border-radius: 8px;
        background: #6b28ff;
        font-weight: 700;
    }
}

.geo-create-item {
    display: grid;
    gap: 3px;
    padding: 2px 0;

    strong {
        font-size: 13px;
    }

    small {
        color: #667085;
        font-size: 12px;
    }
}

.geo-console__menu-scroll {
    flex: 1;
    min-height: 0;
}

.geo-console__menu {
    border-right: 0;
    padding: 2px 14px 18px;

    :deep(.el-menu-item),
    :deep(.el-sub-menu__title) {
        height: 46px;
        margin: 0 0 6px;
        border-radius: 9px;
        color: #344054;
        font-size: 14px;
        font-weight: 800;
        line-height: 46px;
        letter-spacing: 0;
        transition: color 0.14s ease, background 0.14s ease;
    }

    :deep(.el-sub-menu__title .el-icon),
    :deep(.el-menu-item .el-icon) {
        width: 22px;
        margin-right: 10px;
        font-size: 18px;
    }

    :deep(.el-menu-item:hover),
    :deep(.el-sub-menu__title:hover),
    :deep(.el-menu-item.is-active) {
        color: #6b28ff;
        background: #f4f0ff;
    }

    :deep(.el-sub-menu .el-menu-item) {
        height: 40px;
        margin-left: 24px;
        margin-bottom: 5px;
        padding-right: 12px;
        padding-left: 16px !important;
        border-radius: 8px;
        color: #667085;
        font-size: 14px;
        font-weight: 800;
        line-height: 40px;
    }

    :deep(.el-sub-menu .el-menu-item::before) {
        width: 4px;
        height: 4px;
        margin-right: 10px;
        border-radius: 50%;
        content: '';
        background: #c4cbda;
    }

    :deep(.el-sub-menu .el-menu-item.is-active::before),
    :deep(.el-sub-menu .el-menu-item:hover::before) {
        background: #6b28ff;
    }
}

.geo-console__main {
    min-width: 0;
    height: 100vh;
}

.geo-console__download {
    display: grid;
    min-height: 54px;
    align-items: center;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 14px;
    padding: 8px 24px;
    color: #fff;
    background: linear-gradient(90deg, #6b28ff 0%, #8247ff 56%, #9b6cff 100%);

    span {
        font-size: 14px;
        font-weight: 900;
    }

    strong {
        overflow: hidden;
        font-size: 15px;
        font-weight: 800;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    :deep(.el-button) {
        height: 34px;
        border: 0;
        color: #6b28ff;
        font-weight: 900;
        background: #fff;
    }

    .geo-download__close {
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        border: 0;
        border-radius: 8px;
        color: #fff;
        background: rgba(255, 255, 255, 0.16);
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
    }
}

.geo-console__topbar {
    display: grid;
    align-items: center;
    grid-template-columns: minmax(220px, auto) minmax(260px, 560px) minmax(360px, 1fr);
    gap: 18px;
    border-bottom: 1px solid #e5e7ef;
    background: #fff;
}

.geo-topbar__left,
.geo-topbar__actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
}

.geo-topbar__left {
    span {
        display: block;
        color: #98a2b3;
        font-size: 12px;
    }

    strong {
        display: block;
        color: #111827;
        font-size: 15px;
        font-weight: 800;
    }
}

.geo-topbar__search {
    :deep(.el-input__wrapper) {
        border-radius: 8px;
        background: #f9fafc;
        box-shadow: 0 0 0 1px #e5e7ef inset;
    }
}

.geo-topbar__actions {
    justify-content: flex-end;

    :deep(.el-button) {
        border-radius: 7px;
        font-weight: 700;
    }

    :deep(.el-button--primary) {
        border-color: #2b211e;
        background: #2b211e;
    }
}

.geo-console__user-card {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 18px;
    gap: 10px;
    align-items: center;
    margin: 0;
    padding: 13px 14px 14px;
    border: 0;
    border-top: 1px solid #eef0f5;
    border-radius: 0;
    color: #111827;
    background: linear-gradient(180deg, #fff 0%, #fbfcff 100%);
    text-align: left;
    cursor: pointer;
    transition: background 0.16s ease;

    &:hover {
        background: #f7f4ff;

        i {
            border-color: #6b28ff;
        }
    }

    > span {
        display: grid;
        width: 38px;
        height: 38px;
        place-items: center;
        border-radius: 12px;
        color: #fff;
        background: linear-gradient(135deg, #6b28ff, #8c5cff);
        box-shadow: 0 10px 22px rgba(107, 40, 255, 0.22);
        font-size: 15px;
        font-weight: 900;
    }

    strong,
    small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    strong {
        font-size: 14px;
        font-weight: 900;
    }

    small {
        margin-top: 4px;
        color: #667085;
        font-size: 11px;
        font-weight: 700;
    }

    i {
        width: 8px;
        height: 8px;
        justify-self: end;
        border-top: 1.5px solid #98a2b3;
        border-right: 1.5px solid #98a2b3;
        transform: rotate(45deg);
        transition: border-color 0.16s ease;
    }
}

.geo-console__content {
    min-height: 0;
    overflow-y: auto;
    padding: 18px 24px 22px;
    background: #f5f7fb;
}

@media (max-width: 1180px) {
    .geo-console__topbar {
        grid-template-columns: minmax(180px, auto) minmax(220px, 1fr);
        height: auto;
        min-height: 64px;
        padding-top: 10px;
    }

    .geo-topbar__actions {
        grid-column: 1 / -1;
        justify-content: flex-start;
        padding-bottom: 10px;
    }
}
</style>
