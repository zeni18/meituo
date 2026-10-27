<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" :model="queryParams" class="mb-[-16px]">
                <el-form-item label="应用名称">
                    <el-input
                        v-model="queryParams.name"
                        class="w-[240px]"
                        clearable
                        placeholder="名称/编码"
                        @keyup.enter="searchLists"
                    />
                </el-form-item>
                <el-form-item label="是否开通">
                    <el-select
                        v-model="queryParams.is_buy"
                        style="width: 160px"
                        clearable
                        placeholder="全部状态"
                    >
                        <el-option label="已开通" :value="1" />
                        <el-option label="未开通" :value="0" />
                    </el-select>
                </el-form-item>
                <el-form-item label="排序">
                    <el-select
                        v-model="queryParams.order"
                        style="width: 160px"
                        placeholder="推荐排序"
                        @change="handleSortChange"
                    >
                        <el-option label="推荐排序" value="recommend" />
                        <el-option label="最新更新" value="update_desc" />
                        <el-option label="名称排序" value="name_asc" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="searchLists">查询</el-button>
                    <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>
        <div v-loading="loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            <el-card v-for="row in lists" :key="row.code" class="app-card" shadow="never">
                <div class="flex justify-between gap-4">
                    <div class="app-card__main min-w-0">
                        <div class="app-card__icon">
                            <img
                                v-if="cardCoverSrc(row)"
                                :src="cardCoverSrc(row)"
                                :alt="row.name"
                                @error="handleIconError"
                            />
                        </div>
                        <div class="min-w-0">
                            <div class="text-lg font-medium truncate">{{ row.name }}</div>
                            <div class="text-xs text-tx-secondary mt-1">{{ row.code }}</div>
                        </div>
                    </div>
                    <el-tag :type="row.is_buy ? 'success' : 'info'">
                        {{ row.is_buy ? '已开通' : '未开通' }}
                    </el-tag>
                </div>
                <div class="text-sm text-tx-secondary mt-4 h-[42px] line-clamp-2">
                    {{ row.description || '暂无说明' }}
                </div>
                <div class="flex items-center gap-2 mt-4 text-xs text-tx-secondary">
                    <span>版本 {{ row.current_version || '-' }}</span>
                    <el-tag v-if="row.is_builtin" size="small">系统应用</el-tag>
                    <el-tag
                        v-if="row.is_buy && !row.is_builtin"
                        :type="row.shelf_status === 'on' ? 'success' : 'info'"
                        size="small"
                    >
                        {{ row.shelf_status === 'on' ? '已上架' : '已下架' }}
                    </el-tag>
                    <el-tag
                        v-if="row.is_expired"
                        :type="row.expire_policy === 'allow' ? 'warning' : 'danger'"
                        size="small"
                    >
                        {{ row.expire_policy === 'allow' ? '已过期仍可用' : '已过期' }}
                    </el-tag>
                </div>
                <div v-if="row.is_buy && !row.is_builtin" class="mt-3 text-xs text-tx-secondary">
                    到期时间：{{ formatExpire(row.expire_time) }}
                </div>
                <div class="mt-5 flex justify-end gap-2">
                    <el-button
                        v-if="row.is_buy && getManagePath(row.code)"
                        type="primary"
                        @click="handleManage(row.code)"
                    >
                        管理
                    </el-button>
                    <el-button
                        v-if="!row.is_buy"
                        type="primary"
                        @click="openPlanDialog(row, 'open')"
                        >开通</el-button
                    >
                    <template v-else-if="!row.is_builtin">
                        <el-button type="primary" @click="openPlanDialog(row, 'renew')"
                            >续签</el-button
                        >
                        <el-button
                            v-if="row.shelf_status !== 'on'"
                            type="primary"
                            @click="handleShelf(row.code, 'on')"
                        >
                            上架
                        </el-button>
                        <el-button v-else type="warning" @click="handleShelf(row.code, 'off')">
                            下架
                        </el-button>
                    </template>
                    <el-button v-else-if="!getManagePath(row.code)" type="primary" disabled>
                        系统应用
                    </el-button>
                </div>
            </el-card>
        </div>
        <el-empty v-if="!loading && allLists.length === 0" description="暂无应用" />
        <pagination v-model="pager" class="mt-4" @change="handlePageChange" />

        <el-dialog
            v-model="planVisible"
            :title="planAction === 'renew' ? '续签应用' : '开通应用'"
            width="560px"
        >
            <div>
                <div class="font-medium">{{ currentApp.name }}</div>
                <div class="text-xs text-tx-secondary mt-1">{{ currentApp.code }}</div>
                <el-radio-group v-model="selectedPlanId" class="plan-list mt-4">
                    <el-radio-button
                        v-for="plan in currentApp.plans || []"
                        :key="plan.id"
                        :label="plan.id"
                    >
                        <div class="plan-item">
                            <div class="font-medium">{{ plan.name }}</div>
                            <div class="text-xs mt-1">{{ plan.duration_months }} 个月</div>
                            <div class="text-sm mt-2 text-primary">
                                {{ formatPointAmount(planAction === 'renew' ? plan.renew_points : plan.open_points) }}
                            </div>
                        </div>
                    </el-radio-button>
                </el-radio-group>
                <el-empty v-if="(currentApp.plans || []).length === 0" description="暂无可用套餐" />
                <div v-if="currentApp.is_buy" class="text-xs text-tx-secondary mt-4">
                    当前到期时间：{{ formatExpire(currentApp.expire_time) }}
                </div>
                <div v-if="selectedPlan" class="plan-cost">
                    <div>
                        本次{{ planAction === 'renew' ? '续签' : '开通' }}需消耗
                    </div>
                    <div class="plan-cost__value">
                        {{ selectedPlanCostLabel }}
                    </div>
                </div>
            </div>
            <template #footer>
                <el-button @click="planVisible = false">取消</el-button>
                <el-button
                    type="primary"
                    :disabled="!selectedPlanId"
                    :loading="buying"
                    @click="submitPlan"
                >
                    确认{{ planAction === 'renew' ? '续签' : '开通' }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-app-market">
import { formatPointAmount, getPointUnit } from '@/utils/point-unit'

import { appMarket, buyApp, shelfApp } from '@/api/app_center'
import useUserStore from '@/stores/modules/user'
import feedback from '@/utils/feedback'
import { withTenantQuery } from '@/utils/tenant'
import { timeFormat } from '@/utils/util'

import { getAppManagePath } from '@/layout/default/utils/app-menu'

const defaultAppCodes: string[] = []
const loading = ref(false)
const buying = ref(false)
const allLists = ref<any[]>([])
const planVisible = ref(false)
const currentApp = ref<any>({})
const selectedPlanId = ref<number | string>('')
const planAction = ref<'open' | 'renew'>('open')
const router = useRouter()
const userStore = useUserStore()
const queryParams = reactive<{ name: string; is_buy?: number; order: string }>({
    name: '',
    is_buy: undefined,
    order: 'recommend'
})
const pager = reactive({
    page: 1,
    size: 15,
    count: 0
})
const sortedLists = computed(() => sortApps(allLists.value))
const lists = computed(() => {
    const start = (pager.page - 1) * pager.size
    return sortedLists.value.slice(start, start + pager.size)
})
const requestParams = computed(() => ({
    name: queryParams.name,
    ...(queryParams.is_buy === undefined ? {} : { is_buy: queryParams.is_buy })
}))
const normalizeLists = (data: any) => {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.lists)) return data.lists
    if (Array.isArray(data?.data?.lists)) return data.data.lists
    return []
}
function getAppTime(row: any) {
    const value = row?.update_time || row?.cloud_update_time || row?.create_time || row?.install_time || 0
    const numberValue = Number(value)
    if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue > 100000000000 ? numberValue : numberValue * 1000
    }
    const parsed = Date.parse(String(value || '').replace(/-/g, '/'))
    return Number.isNaN(parsed) ? 0 : parsed
}
function compareName(a: any, b: any) {
    return String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || ''), 'zh-Hans-CN')
}
function sortApps(rows: any[]) {
    const list = [...rows]
    if (queryParams.order === 'name_asc') {
        return list.sort((a, b) => compareName(a, b))
    }
    if (queryParams.order === 'update_desc') {
        return list.sort((a, b) => getAppTime(b) - getAppTime(a) || Number(b?.sort || 0) - Number(a?.sort || 0) || compareName(a, b))
    }
    return list.sort((a, b) => {
        const boughtDiff = Number(b?.is_buy || 0) - Number(a?.is_buy || 0)
        if (boughtDiff) return boughtDiff
        const builtinDiff = Number(b?.is_builtin || 0) - Number(a?.is_builtin || 0)
        if (builtinDiff) return builtinDiff
        return getAppTime(b) - getAppTime(a) || Number(b?.sort || 0) - Number(a?.sort || 0) || compareName(a, b)
    })
}
const getLists = async () => {
    loading.value = true
    try {
        const data = await appMarket(requestParams.value)
        allLists.value = normalizeLists(data)
        pager.count = allLists.value.length
        const maxPage = Math.max(1, Math.ceil(pager.count / pager.size))
        if (pager.page > maxPage) {
            pager.page = maxPage
        }
    } finally {
        loading.value = false
    }
}
const handleSortChange = () => {
    pager.page = 1
}
const searchLists = () => {
    pager.page = 1
    getLists()
}
const resetQuery = () => {
    Object.assign(queryParams, {
        name: '',
        is_buy: undefined,
        order: 'recommend'
    })
    searchLists()
}
const handlePageChange = () => {
    if (pager.page < 1) {
        pager.page = 1
    }
}
const openPlanDialog = (row: any, action: 'open' | 'renew') => {
    if (row.is_builtin || defaultAppCodes.includes(row.code)) return
    currentApp.value = row
    planAction.value = action
    selectedPlanId.value = (row.plans || [])[0]?.id || ''
    planVisible.value = true
}
const selectedPlan = computed(() =>
    (currentApp.value.plans || []).find(
        (item: any) => String(item.id) === String(selectedPlanId.value)
    )
)
const selectedPlanCost = computed(() => {
    const plan = selectedPlan.value
    if (!plan) return 0
    return Number(planAction.value === 'renew' ? plan.renew_points : plan.open_points) || 0
})
const selectedPlanCostLabel = computed(() => {
    const points = selectedPlanCost.value
    return points > 0 ? formatPointAmount(formatPoints(points)) : '免费'
})
const formatPoints = (value: number | string) => {
    const points = Number(value) || 0
    return Number.isInteger(points) ? String(points) : points.toFixed(2)
}
const submitPlan = async () => {
    const plan = selectedPlan.value
    if (!plan) return
    const points = selectedPlanCost.value
    const actionText = planAction.value === 'renew' ? '续签' : '开通'
    await feedback.confirm(
        points > 0
            ? `本次${actionText}将扣除租户${getPointUnit()} ${formatPoints(points)}，确定继续？`
            : `本次${actionText}无需扣除租户${getPointUnit()}，确定继续？`
    )
    buying.value = true
    try {
        await buyApp({ app_code: currentApp.value.code, plan_id: selectedPlanId.value })
        planVisible.value = false
        await getLists()
    } finally {
        buying.value = false
    }
}
const handleShelf = async (appCode: string, status: string) => {
    if (defaultAppCodes.includes(appCode)) return
    if (status === 'off') {
        await feedback.confirm('下架后用户端入口和 API 将不可用，后台仍可管理历史数据。')
    }
    await shelfApp({ app_code: appCode, shelf_status: status })
    getLists()
}
const getManagePath = (appCode: string) => getAppManagePath(userStore.routes, appCode)
const handleManage = (appCode: string) => {
    const path = getManagePath(appCode)
    if (!path) {
        feedback.msgError('暂无可管理菜单')
        return
    }
    router.push(withTenantQuery(path))
}
function isIconName(value: string) {
    return /^el-icon-|^local-icon-/.test(String(value || ''))
}
function isImageValue(value: string) {
    const text = String(value || '').trim()
    return !!text && !isIconName(text)
}
function firstImageValue(...values: any[]) {
    for (const value of values) {
        const text = String(value || '').trim()
        if (isImageValue(text)) {
            return text
        }
    }
    return ''
}
const cardCoverSrc = (row: any) => {
    const displayConfig = row.display_config || {}
    const value = firstImageValue(
        row.cover_url,
        row.cover,
        displayConfig.cover_url,
        displayConfig.cover_uri,
        row.icon_url,
        row.icon
    )
    if (!value) {
        return ''
    }
    if (/^(https?:)?\/\//.test(value) || value.startsWith('/')) {
        return value
    }
    return `/${value.replace(/^\/+/, '')}`
}
const handleIconError = (event: Event) => {
    const target = event.target as HTMLImageElement
    target.style.display = 'none'
}
const formatExpire = (value: number) => {
    if (!value) return '永久'
    return timeFormat(Number(value), 'yyyy-mm-dd hh:MM')
}
getLists()
</script>

<style lang="scss" scoped>
.app-card {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgb(31 35 41 / 6%);
    &__main {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    &__icon {
        width: 44px;
        height: 44px;
        flex: 0 0 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 8px;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }
}

.plan-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    gap: 12px;
}

.plan-list :deep(.el-radio-button__inner) {
    width: 100%;
    padding: 14px;
    border-left: var(--el-border);
    border-radius: 8px;
    text-align: left;
}

.plan-item {
    min-height: 72px;
}

.plan-cost {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);

    &__value {
        color: var(--el-color-primary);
        font-size: 18px;
        font-weight: 600;
    }
}

@media (max-width: 768px) {
    .plan-list {
        grid-template-columns: 1fr;
    }
}
</style>
