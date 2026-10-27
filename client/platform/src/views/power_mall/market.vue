<template>
    <div class="market-page">
        <el-card class="!border-none" shadow="never">
            <el-tabs v-model="activeTab" @tab-change="handleTabChange">
                <el-tab-pane label="模型 API" name="model" />
                <el-tab-pane label="应用 API" name="app_api" />
            </el-tabs>

            <el-form class="mb-[-16px]" :model="query" :inline="true">
                <el-form-item label="关键词">
                    <el-input
                        v-model="query.keyword"
                        class="w-[280px]"
                        :placeholder="
                            activeTab === 'model' ? '模型名称、编码或渠道' : '应用名称或编码'
                        "
                        clearable
                        @keyup.enter="handleSearch"
                    />
                </el-form-item>
                <el-form-item label="状态">
                    <el-select
                        v-model="query.status"
                        class="!w-[140px]"
                        clearable
                        placeholder="全部"
                    >
                        <el-option label="全部" value="" />
                        <el-option label="上架" :value="1" />
                        <el-option label="下架" :value="0" />
                    </el-select>
                </el-form-item>
                <el-form-item v-if="activeTab === 'model'" label="模型类型">
                    <el-radio-group v-model="query.model_type" @change="handleModelTypeChange">
                        <el-radio-button label="">全部</el-radio-button>
                        <el-radio-button label="text">文本生成</el-radio-button>
                        <el-radio-button label="image">图片生成</el-radio-button>
                        <el-radio-button label="video">视频生成</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="handleSearch">查询</el-button>
                    <el-button @click="handleReset">重置</el-button>
                    <el-button
                        v-perms="['power.market/sync']"
                        type="primary"
                        :loading="syncing"
                        @click="handleSync"
                    >
                        <template #icon><icon name="el-icon-Refresh" /></template>
                        同步上游价格
                    </el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-alert
                class="mb-5"
                type="info"
                :closable="false"
                title="价格由当前接口渠道的上游 SKU 同步生成；已提交任务继续使用提交时的价格快照。"
            />
            <div v-if="activeTab === 'model'" class="mb-4 flex items-center gap-2">
                <el-checkbox
                    :model-value="allCurrentSelected"
                    :indeterminate="selectedModelIds.length > 0 && !allCurrentSelected"
                    @change="toggleCurrentSelection"
                    >本页全选</el-checkbox
                >
                <span v-if="selectedModelIds.length" class="text-sm text-primary"
                    >已选 {{ selectedModelIds.length }} 项</span
                >
                <el-button size="small" :disabled="!selectedModelIds.length" @click="batchShelf(1)"
                    >批量上架</el-button
                >
                <el-button size="small" :disabled="!selectedModelIds.length" @click="batchShelf(0)"
                    >批量下架</el-button
                >
                <el-button size="small" @click="batchShelf(1, true)">全部上架</el-button>
                <el-button size="small" @click="batchShelf(0, true)">全部下架</el-button>
            </div>

            <div v-loading="currentPager.loading" class="market-grid">
                <template v-if="activeTab === 'model'">
                    <article
                        v-for="row in modelPager.pager.lists"
                        :key="row.id"
                        class="market-card"
                    >
                        <div class="market-card__head">
                            <el-checkbox
                                class="market-card__selection"
                                :model-value="selectedModelIds.includes(Number(row.id))"
                                @change="
                                    (checked) =>
                                        toggleModelSelection(Number(row.id), Boolean(checked))
                                "
                            />
                            <div class="market-card__icon market-card__icon--model">
                                <icon name="el-icon-Connection" :size="27" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="market-card__title-row">
                                    <div class="market-card__title" :title="row.name">
                                        {{ row.name }}
                                    </div>
                                    <el-tag
                                        :type="row.status === 1 ? 'success' : 'info'"
                                        size="small"
                                    >
                                        {{ row.status_text }}
                                    </el-tag>
                                </div>
                                <div class="market-card__code">
                                    {{ row.upstream_model_code || row.product_code }}
                                </div>
                            </div>
                        </div>

                        <div class="market-card__source">
                            上游：{{ row.upstream_channel_code || '默认渠道' }}
                        </div>
                        <div v-if="row.capability_tags?.length" class="market-card__capabilities">
                            <el-tag
                                v-for="tag in row.capability_tags"
                                :key="tag.key"
                                size="small"
                                effect="plain"
                                class="market-card__capability-tag"
                            >
                                {{ tag.label }}
                            </el-tag>
                        </div>
                        <div class="market-card__desc">
                            {{ row.description || '按上游计费规格同步结算成本' }}
                        </div>

                        <div class="market-card__meta">
                            <div>
                                <span class="market-card__meta-label">可售 SKU</span>
                                <span class="market-card__meta-value">{{ row.sku_count }}</span>
                            </div>
                            <div>
                                <span class="market-card__meta-label">最低结算价</span>
                                <span class="market-card__meta-value">{{
                                    row.sku_count ? `${formatPrice(row.min_price)} 算力` : '-'
                                }}</span>
                            </div>
                        </div>

                        <div class="market-card__actions">
                            <div class="market-card__action-buttons">
                                <el-switch
                                    v-perms="['power.market/savePrices']"
                                    :model-value="row.status === 1"
                                    :loading="shelfLoading[`model:${row.id}`]"
                                    @change="(value) => toggleModelShelf(row, Boolean(value))"
                                />
                                <el-button
                                    class="market-price-button"
                                    @click="openProductDetail(row.id)"
                                    >查看价格</el-button
                                >
                            </div>
                            <span class="market-card__time"
                                >同步于 {{ formatTime(row.update_time) }}</span
                            >
                        </div>
                    </article>
                </template>

                <template v-else>
                    <article
                        v-for="row in appPager.pager.lists"
                        :key="row.app_code"
                        class="market-card"
                    >
                        <div class="market-card__head">
                            <div class="market-card__icon market-card__icon--app">
                                <icon name="el-icon-Grid" :size="27" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="market-card__title-row">
                                    <div class="market-card__title" :title="row.name">
                                        {{ row.name }}
                                    </div>
                                    <el-tag
                                        :type="row.status === 1 ? 'success' : 'info'"
                                        size="small"
                                    >
                                        {{ row.status_text }}
                                    </el-tag>
                                </div>
                                <div class="market-card__code">{{ row.app_code }}</div>
                            </div>
                        </div>

                        <div class="market-card__source">API 数：{{ row.api_count }}</div>
                        <div class="market-card__desc">{{ row.description }}</div>

                        <div class="market-card__meta">
                            <div>
                                <span class="market-card__meta-label">计费 SKU</span>
                                <span class="market-card__meta-value">{{ row.sku_count }}</span>
                            </div>
                            <div>
                                <span class="market-card__meta-label">最低结算价</span>
                                <span class="market-card__meta-value">{{
                                    row.sku_count ? `${formatPrice(row.min_price)} 算力` : '-'
                                }}</span>
                            </div>
                        </div>

                        <div class="market-card__actions">
                            <div class="market-card__action-buttons">
                                <el-switch
                                    v-perms="['power.market/savePrices']"
                                    :model-value="row.status === 1"
                                    :loading="shelfLoading[`app:${row.app_code}`]"
                                    @change="(value) => toggleAppShelf(row, Boolean(value))"
                                />
                                <el-button
                                    class="market-price-button"
                                    @click="openAppDetail(row.app_code)"
                                    >查看价格</el-button
                                >
                            </div>
                            <span class="market-card__time"
                                >同步于 {{ formatTime(row.update_time) }}</span
                            >
                        </div>
                    </article>
                </template>
            </div>

            <el-empty
                v-if="!currentPager.loading && currentPager.lists.length === 0"
                :description="activeTab === 'model' ? '暂无模型 API 商品' : '暂无应用 API 商品'"
            />
            <div v-if="currentPager.lists.length" class="flex justify-end mt-5">
                <pagination v-model="currentPager" @change="getCurrentLists" />
            </div>
        </el-card>

        <el-dialog
            v-model="visible"
            :title="drawerTitle"
            width="980px"
            destroy-on-close
            append-to-body
            :close-on-click-modal="false"
            class="market-pricing-dialog"
        >
            <div v-loading="detailLoading">
                <div v-if="pricingRows.length" class="pricing-editor">
                    <div class="pricing-editor__head">
                        <div>
                            <div class="pricing-editor__title">{{ pricingResourceName }}</div>
                            <div class="pricing-editor__code">{{ pricingResourceCode }}</div>
                            <div class="pricing-editor__hint">
                                上游结算价是平台成本；租户成本价是平台给租户的价格。
                            </div>
                        </div>
                        <div class="pricing-editor__actions">
                            <el-button plain @click="reloadPricing">刷新</el-button>
                            <el-button
                                v-perms="['power.market/savePrices']"
                                type="primary"
                                :loading="pricingSaving"
                                @click="savePricing"
                                >保存租户价格</el-button
                            >
                        </div>
                    </div>

                    <el-table :data="pricingRows" border size="small" class="pricing-editor__table">
                        <el-table-column v-if="drawerType === 'app'" label="API" min-width="140">
                            <template #default="{ row }"
                                ><div>{{ row.api_name }}</div>
                                <div class="text-xs text-tx-secondary">
                                    {{ row.api_code }}
                                </div></template
                            >
                        </el-table-column>
                        <el-table-column label="规格" min-width="180">
                            <template #default="{ row }"
                                ><div>{{ row.title }}</div>
                                <div class="text-xs text-tx-secondary">
                                    {{ formatParams(row.locked_params) }}
                                </div></template
                            >
                        </el-table-column>
                        <el-table-column label="上游结算价" min-width="155">
                            <template #default="{ row }">{{
                                formatPriceWithUnit(row.upstream_price, row)
                            }}</template>
                        </el-table-column>
                        <el-table-column label="租户成本价" min-width="190">
                            <template #default="{ row }">
                                <el-input-number
                                    v-model="row.sale_points"
                                    :min="Number(row.upstream_price || 0)"
                                    :precision="6"
                                    controls-position="right"
                                    class="!w-full"
                                />
                                <div class="pricing-editor__unit">算力 / {{ unitLabel(row) }}</div>
                            </template>
                        </el-table-column>
                        <el-table-column label="毛利" min-width="150">
                            <template #default="{ row }"
                                ><span
                                    :class="
                                        grossMargin(row) >= 0
                                            ? 'pricing-editor__profit'
                                            : 'pricing-editor__loss'
                                    "
                                    >{{ formatPriceWithUnit(grossMargin(row), row) }}</span
                                ></template
                            >
                        </el-table-column>
                        <el-table-column label="状态" width="90" align="center">
                            <template #default="{ row }"
                                ><el-switch
                                    v-model="row.sale_status"
                                    :active-value="1"
                                    :inactive-value="0"
                            /></template>
                        </el-table-column>
                    </el-table>
                    <div class="pricing-editor__summary">{{ pricingSummary }}</div>
                </div>
                <el-empty v-else-if="!detailLoading" description="暂无可编辑的计费 SKU" />
            </div>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="powerMallMarket">
import {
    powerMarketAppDetail,
    powerMarketApps,
    powerMarketBatchShelf,
    powerMarketDetail,
    powerMarketLists,
    powerMarketSavePrices,
    powerMarketSync
} from '@/api/power_mall'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const activeTab = ref<'model' | 'app_api'>('model')
const query = reactive({ keyword: '', status: '' as string | number, model_type: '' })
const modelPager = usePaging({
    fetchFun: powerMarketLists,
    params: query,
    fixedParams: { resource_type: 'model' }
})
const appPager = usePaging({ fetchFun: powerMarketApps, params: query })
const currentPager = computed(() =>
    activeTab.value === 'model' ? modelPager.pager : appPager.pager
)
const syncing = ref(false)
const visible = ref(false)
const detailLoading = ref(false)
const drawerType = ref<'product' | 'app'>('product')
const detail = ref<any>({})
const appDetail = ref<any>({})
const pricingRows = ref<any[]>([])
const pricingSaving = ref(false)
const shelfLoading = reactive<Record<string, boolean>>({})
const selectedModelIds = ref<number[]>([])
const drawerTitle = computed(() =>
    drawerType.value === 'app' ? '应用 API 计费规格' : '模型 API 计费规格'
)

const formatPrice = (value: any) =>
    Number(value || 0)
        .toFixed(6)
        .replace(/\.?(0+)$/, '')
const formatParams = (value: any) => {
    const entries = Object.entries(value || {})
    return entries.length ? entries.map(([key, item]) => `${key}=${String(item)}`).join('，') : '-'
}
const unitLabel = (row: any) => {
    const size = Number(row.usage_unit_size || 1)
    const prefix =
        size === 100000000
            ? '亿 '
            : size === 1000000
              ? '百万 '
              : size === 10000
                ? '万 '
                : size === 1000
                  ? '千 '
                  : size > 1
                    ? `${formatPrice(size)} `
                    : ''
    const units: Record<string, string> = {
        token: 'Token',
        character: '字符',
        input_second: '输入秒',
        output_second: '输出秒',
        per_call: '次'
    }
    const unit = units[row.usage_unit] || '次'
    return `${prefix}${unit}`
}
const formatPriceWithUnit = (price: any, row: any) => `${formatPrice(price)} 算力/${unitLabel(row)}`
const grossMargin = (row: any) => Number(row.sale_points || 0) - Number(row.upstream_price || 0)
const formatTime = (value: any) => {
    if (value === null || value === undefined || value === '') return '-'
    const raw = String(value).trim()
    const date = /^\d+$/.test(raw)
        ? new Date(Number(raw) * 1000)
        : new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}
const getCurrentLists = () =>
    activeTab.value === 'model' ? modelPager.getLists() : appPager.getLists()
const handleSearch = () =>
    activeTab.value === 'model' ? modelPager.resetPage() : appPager.resetPage()
const handleModelTypeChange = () => modelPager.resetPage()
const handleReset = () => {
    query.keyword = ''
    query.status = ''
    query.model_type = ''
    handleSearch()
}
const handleTabChange = () => {
    selectedModelIds.value = []
    getCurrentLists()
}
const allCurrentSelected = computed(
    () =>
        modelPager.pager.lists.length > 0 &&
        modelPager.pager.lists.every((row: any) => selectedModelIds.value.includes(Number(row.id)))
)
const toggleModelSelection = (id: number, checked: boolean) => {
    selectedModelIds.value = checked
        ? Array.from(new Set([...selectedModelIds.value, id]))
        : selectedModelIds.value.filter((item) => item !== id)
}
const toggleCurrentSelection = (checked: boolean) => {
    const current = modelPager.pager.lists.map((row: any) => Number(row.id))
    selectedModelIds.value = checked
        ? Array.from(new Set([...selectedModelIds.value, ...current]))
        : selectedModelIds.value.filter((id) => !current.includes(id))
}
const batchShelf = async (saleStatus: number, all = false) => {
    const ids = all
        ? modelPager.pager.lists.map((row: any) => Number(row.id))
        : selectedModelIds.value
    if (!ids.length) return feedback.msgError('当前筛选条件下没有可操作的模型')
    await powerMarketBatchShelf({ product_ids: ids, sale_status: saleStatus })
    feedback.msgSuccess(saleStatus === 1 ? '模型已上架' : '模型已下架')
    selectedModelIds.value = []
    await getCurrentLists()
}

const handleSync = async () => {
    syncing.value = true
    try {
        const result: any = await powerMarketSync()
        const data = result?.data || result || {}
        const failedScopes = Object.keys(data.type_errors || {})
        if (data.partial_success || failedScopes.length) {
            feedback.msgWarning(
                `价格已部分同步，${failedScopes.length || 1} 个分类暂时失败，已保留原有价格，可稍后重新同步`
            )
        } else {
            feedback.msgSuccess('上游价格同步完成')
        }
        await getCurrentLists()
    } finally {
        syncing.value = false
    }
}

const pricingResourceName = computed(() =>
    drawerType.value === 'app' ? appDetail.value.name : detail.value.name
)
const pricingResourceCode = computed(() =>
    drawerType.value === 'app' ? appDetail.value.app_code : detail.value.product_code
)
const pricingSummary = computed(() => {
    const enabled = pricingRows.value.filter((row) => row.sale_status === 1).length
    return `共 ${pricingRows.value.length} 个计费 SKU，已启用 ${enabled} 个。`
})
const setPricingRows = (products: any[]) => {
    pricingRows.value = products.flatMap((product) =>
        (product.skus || []).map((sku: any) => ({
            ...sku,
            product_id: product.id,
            api_name: product.upstream_api_code ? product.name : '',
            api_code: product.upstream_api_code || '',
            sale_points: Number(sku.sale_points ?? sku.upstream_price ?? 0),
            sale_status: Number(sku.sale_status ?? 1) === 1 ? 1 : 0
        }))
    )
}

const openProductDetail = async (id: number) => {
    drawerType.value = 'product'
    detail.value = {}
    visible.value = true
    detailLoading.value = true
    try {
        detail.value = await powerMarketDetail({ id })
        setPricingRows([detail.value])
    } catch (error) {
        feedback.msgError('商品详情加载失败')
    } finally {
        detailLoading.value = false
    }
}

const openAppDetail = async (appCode: string) => {
    drawerType.value = 'app'
    appDetail.value = {}
    pricingRows.value = []
    visible.value = true
    detailLoading.value = true
    try {
        appDetail.value = await powerMarketAppDetail({ app_code: appCode })
        setPricingRows(appDetail.value.apis || [])
    } catch (error) {
        feedback.msgError('应用计费规格加载失败')
    } finally {
        detailLoading.value = false
    }
}

const reloadPricing = async () => {
    if (drawerType.value === 'app') return openAppDetail(appDetail.value.app_code)
    return openProductDetail(detail.value.id)
}

const saveProductShelf = async (product: any, saleStatus: boolean) => {
    const prices = (product.skus || [])
        .filter((sku: any) => Number(sku.status) === 1)
        .map((sku: any) => ({
            sku_id: sku.id,
            sale_points: Number(sku.sale_points ?? sku.upstream_price ?? 0),
            sale_status: saleStatus ? 1 : 0
        }))
    if (!prices.length) {
        feedback.msgError('暂无可操作的计费 SKU')
        return false
    }
    await powerMarketSavePrices({ product_id: product.id, prices })
    return true
}

const toggleModelShelf = async (row: any, saleStatus: boolean) => {
    const key = `model:${row.id}`
    shelfLoading[key] = true
    try {
        const product = await powerMarketDetail({ id: row.id })
        if (await saveProductShelf(product, saleStatus)) {
            feedback.msgSuccess(saleStatus ? '商品已上架' : '商品已下架')
            await getCurrentLists()
        }
    } finally {
        shelfLoading[key] = false
    }
}

const toggleAppShelf = async (row: any, saleStatus: boolean) => {
    const key = `app:${row.app_code}`
    shelfLoading[key] = true
    try {
        const data = await powerMarketAppDetail({ app_code: row.app_code })
        const results = await Promise.all(
            (data.apis || []).map((product: any) => saveProductShelf(product, saleStatus))
        )
        if (results.some(Boolean)) {
            feedback.msgSuccess(saleStatus ? '应用 API 已上架' : '应用 API 已下架')
            await getCurrentLists()
        }
    } finally {
        shelfLoading[key] = false
    }
}

const savePricing = async () => {
    pricingSaving.value = true
    try {
        const groups = new Map<number, any[]>()
        pricingRows.value.forEach((row) => {
            const productId = Number(row.product_id || 0)
            if (!groups.has(productId)) groups.set(productId, [])
            groups.get(productId)!.push({
                sku_id: row.id,
                sale_points: Number(row.sale_points || 0),
                sale_status: row.sale_status === 1 ? 1 : 0
            })
        })
        await Promise.all(
            Array.from(groups.entries()).map(([productId, prices]) =>
                powerMarketSavePrices({ product_id: productId, prices })
            )
        )
        feedback.msgSuccess('租户成本价已保存')
        await reloadPricing()
    } finally {
        pricingSaving.value = false
    }
}

modelPager.getLists()
</script>

<style lang="scss" scoped>
.market-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
}

.market-card {
    display: flex;
    flex-direction: column;
    min-height: 250px;
    padding: 20px;
    background: #fff;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
}

.market-card:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 8px 20px rgb(31 35 41 / 8%);
}

.market-card__head {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    min-width: 0;
}

.market-card__selection {
    flex: 0 0 auto;
    margin: 3px 0 0;
}

.market-card__icon {
    display: flex;
    flex: 0 0 52px;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 8px;
}

.market-card__icon--model {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
}

.market-card__icon--app {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
}

.market-card__title-row {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
}

.market-card__title {
    overflow: hidden;
    font-size: 17px;
    font-weight: 600;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.market-card__code,
.market-card__source,
.market-card__time {
    overflow: hidden;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.market-card__code {
    margin-top: 4px;
    font-size: 13px;
}

.market-card__source {
    margin-top: 18px;
    font-size: 14px;
}

.market-card__capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 24px;
    margin-top: 10px;
}

.market-card__capability-tag {
    max-width: 100%;
}

.market-card__desc {
    display: -webkit-box;
    height: 44px;
    margin-top: 12px;
    overflow: hidden;
    color: var(--el-text-color-regular);
    font-size: 14px;
    line-height: 22px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.market-card__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
    padding: 14px 0;
    border-top: 1px solid var(--el-border-color-lighter);
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.market-card__meta-label,
.market-card__meta-value {
    display: block;
}

.market-card__meta-label {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}

.market-card__meta-value {
    margin-top: 4px;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.market-card__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: auto;
    padding-top: 16px;
}

.market-card__action-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.market-card__time {
    font-size: 12px;
}

.market-price-button {
    --el-button-bg-color: var(--el-fill-color-blank);
    --el-button-border-color: var(--el-border-color);
    --el-button-text-color: var(--el-text-color-regular);
    --el-button-hover-bg-color: var(--el-color-primary-light-9);
    --el-button-hover-border-color: var(--el-color-primary-light-5);
    --el-button-hover-text-color: var(--el-color-primary);
}

.pricing-editor__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
}

.pricing-editor__title {
    font-size: 17px;
    font-weight: 600;
}

.pricing-editor__code,
.pricing-editor__hint,
.pricing-editor__unit,
.pricing-editor__summary {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}

.pricing-editor__code {
    margin-top: 4px;
}
.pricing-editor__hint {
    margin-top: 10px;
}
.pricing-editor__actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
}
.pricing-editor__table {
    --el-table-border-color: var(--el-border-color-lighter);
}
.pricing-editor__unit {
    margin-top: 4px;
}
.pricing-editor__summary {
    margin-top: 12px;
}
.pricing-editor__profit {
    color: var(--el-color-success);
}
.pricing-editor__loss {
    color: var(--el-color-danger);
}

@media (max-width: 720px) {
    .market-grid {
        grid-template-columns: 1fr;
    }
}
</style>
