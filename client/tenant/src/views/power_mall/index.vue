<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-tabs v-if="activeTab === 'buy'" v-model="packageTab" class="mall-type-tabs">
                <el-tab-pane name="member">
                    <template #label>
                        会员套餐
                        <span class="package-tab-count">{{ memberPackages.length }}</span>
                    </template>
                </el-tab-pane>
                <el-tab-pane name="points">
                    <template #label>
                        {{ getPointUnit() }}套餐
                        <span class="package-tab-count">{{ pointPackages.length }}</span>
                    </template>
                </el-tab-pane>
            </el-tabs>
            <div v-else class="record-title">购买记录</div>

            <el-form v-if="activeTab === 'records'" class="mb-[-16px]" :model="orderQuery" :inline="true">
                <el-form-item label="订单编号">
                    <el-input
                        v-model="orderQuery.order_sn"
                        class="w-[220px]"
                        placeholder="请输入订单编号"
                        clearable
                        @keyup.enter="resetOrderPage"
                    />
                </el-form-item>
                <el-form-item label="套餐类型">
                    <el-select
                        v-model="orderQuery.package_type"
                        clearable
                        placeholder="全部"
                        style="width: 150px"
                    >
                        <el-option label="会员套餐" value="member" />
                        <el-option :label="`${getPointUnit()}套餐`" value="points" />
                    </el-select>
                </el-form-item>
                <el-form-item label="支付状态">
                    <el-select
                        v-model="orderQuery.pay_status"
                        clearable
                        placeholder="全部"
                        style="width: 140px"
                    >
                        <el-option label="待支付" :value="0" />
                        <el-option label="已支付" :value="1" />
                    </el-select>
                </el-form-item>
                <el-form-item label="创建时间">
                    <daterange-picker
                        v-model:startTime="orderQuery.start_time"
                        v-model:endTime="orderQuery.end_time"
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetOrderPage">查询</el-button>
                    <el-button @click="resetOrderParams">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <div v-if="activeTab === 'buy'" class="mt-4">
            <el-card class="!border-none mb-4" shadow="never">
                <template #header>
                    <div class="flex items-center justify-between">
                        <span class="card-title">{{ getPointUnit() }}概览</span>
                        <span class="text-tx-secondary text-xs">更新时间：{{ powerStatsData.time || '-' }}</span>
                    </div>
                </template>
                <div v-loading="statsLoading" class="power-overview">
                    <div class="power-balance-card">
                        <div class="text-tx-secondary text-xs">总共剩余{{ getPointUnit() }}</div>
                        <div class="power-balance-value">{{ powerStatsData.total_remaining_points }}</div>
                        <div class="power-balance-meta">
                            <span>今日消耗：{{ formatPointAmount(powerStatsData.today_consume_points) }}</span>
                        </div>
                    </div>
                    <div v-for="item in statsCards" :key="item.label" class="power-stat-card">
                        <div class="text-tx-secondary text-xs">{{ item.label }}</div>
                        <div class="power-stat-value">
                            {{ item.value }}<span v-if="item.unit">{{ item.unit }}</span>
                        </div>
                        <div class="text-tx-secondary text-xs">{{ item.desc }}</div>
                    </div>
                </div>
            </el-card>

            <el-card class="!border-none" shadow="never">
                <div v-loading="packageLoading" class="space-y-6">
                    <el-empty v-if="!packages.length" description="暂无可购买套餐" />
                    <template v-else>
                        <div class="package-tabs">
                            <template v-if="packageTab === 'member'">
                                <div class="package-section__header">
                                    <div>
                                        <div class="package-section__title">会员套餐</div>
                                        <div class="package-section__desc">按月数配置有效期，赠送{{ getPointUnit() }}会随套餐周期到期</div>
                                    </div>
                                </div>
                                <el-empty v-if="!memberPackages.length" description="暂无会员套餐" :image-size="80" />
                                <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <div v-for="item in memberPackages" :key="item.id" class="power-package power-package--member">
                                        <div class="flex items-start justify-between gap-4">
                                            <div class="min-w-0">
                                                <div class="text-lg font-medium truncate">{{ item.name }}</div>
                                                <div class="mt-2">
                                                    <el-tag type="warning">{{ item.type_text }}</el-tag>
                                                    <span class="ml-2 text-tx-secondary">{{ item.validity_text }}有效</span>
                                                </div>
                                            </div>
                                            <div class="text-right shrink-0">
                                                <div class="text-tx-secondary text-xs">售价</div>
                                                <div class="text-2xl font-semibold text-primary">¥{{ item.amount }}</div>
                                            </div>
                                        </div>
                                        <div class="mt-6 flex items-end justify-between gap-4">
                                            <div>
                                                <div class="text-tx-secondary text-xs">赠送{{ getPointUnit() }}</div>
                                                <div class="mt-1 text-3xl font-semibold">{{ item.points }}</div>
                                            </div>
                                            <el-button
                                                v-perms="['power.mall/createOrder']"
                                                type="primary"
                                                :loading="creatingId === item.id"
                                                @click="confirmBuy(item)"
                                            >
                                                购买
                                            </el-button>
                                        </div>
                                        <div v-if="item.description" class="mt-4 text-tx-secondary text-sm leading-6">
                                            {{ item.description }}
                                        </div>
                                    </div>
                                </div>
                            </template>

                            <template v-else>
                                <div class="package-section__header">
                                    <div>
                                        <div class="package-section__title">{{ getPointUnit() }}套餐</div>
                                        <div class="package-section__desc">购买后{{ getPointUnit() }}永久有效，适合按需补充{{ getPointUnit() }}</div>
                                    </div>
                                </div>
                                <el-empty v-if="!pointPackages.length" :description="`暂无${getPointUnit()}套餐`" :image-size="80" />
                                <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <div v-for="item in pointPackages" :key="item.id" class="power-package power-package--points">
                                        <div class="flex items-start justify-between gap-4">
                                            <div class="min-w-0">
                                                <div class="text-lg font-medium truncate">{{ item.name }}</div>
                                                <div class="mt-2">
                                                    <el-tag type="success">{{ item.type_text }}</el-tag>
                                                    <span class="ml-2 text-tx-secondary">{{ item.validity_text }}</span>
                                                </div>
                                            </div>
                                            <div class="text-right shrink-0">
                                                <div class="text-tx-secondary text-xs">售价</div>
                                                <div class="text-2xl font-semibold text-primary">¥{{ item.amount }}</div>
                                            </div>
                                        </div>
                                        <div class="mt-6 flex items-end justify-between gap-4">
                                            <div>
                                                <div class="text-tx-secondary text-xs">到账{{ getPointUnit() }}</div>
                                                <div class="mt-1 text-3xl font-semibold">{{ item.points }}</div>
                                            </div>
                                            <el-button
                                                v-perms="['power.mall/createOrder']"
                                                type="primary"
                                                :loading="creatingId === item.id"
                                                @click="confirmBuy(item)"
                                            >
                                                购买
                                            </el-button>
                                        </div>
                                        <div v-if="item.description" class="mt-4 text-tx-secondary text-sm leading-6">
                                            {{ item.description }}
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </template>
                </div>
            </el-card>
        </div>

        <el-card v-else class="!border-none mt-4" shadow="never">
            <el-table size="large" v-loading="orderPager.loading" :data="orderPager.lists">
                <el-table-column label="订单编号" prop="order_sn" min-width="180" />
                <el-table-column label="套餐" min-width="170">
                    <template #default="{ row }">
                        <div>{{ row.package_name }}</div>
                        <div class="text-xs text-tx-secondary">{{ row.package_type_text }}</div>
                    </template>
                </el-table-column>
                <el-table-column :label="getPointUnit()" prop="points" min-width="100" />
                <el-table-column label="金额" min-width="100">
                    <template #default="{ row }">¥{{ row.order_amount }}</template>
                </el-table-column>
                <el-table-column label="有效期" prop="expire_time_text" min-width="170" />
                <el-table-column label="支付方式" prop="pay_way_text" min-width="100" />
                <el-table-column label="状态" min-width="90">
                    <template #default="{ row }">
                        <el-tag :type="row.pay_status == 1 ? 'success' : 'info'">
                            {{ row.pay_status_text }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="支付时间" prop="pay_time" min-width="170">
                    <template #default="{ row }">
                        <span v-if="row.pay_time">{{ row.pay_time }}</span>
                        <span v-else class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            v-if="row.pay_status == 0"
                            type="primary"
                            link
                            @click="openPay(row)"
                        >
                            去支付
                        </el-button>
                        <span v-else class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="orderPager" @change="getOrderLists" />
            </div>
        </el-card>

        <el-dialog v-model="payVisible" title="订单支付" width="520px" @closed="stopPayPolling">
            <div v-if="currentOrder" class="space-y-4">
                <div class="pay-summary">
                    <div>
                        <div class="text-tx-secondary text-xs">套餐</div>
                        <div class="mt-1 font-medium">{{ currentOrder.package_name || currentPackage?.name }}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-tx-secondary text-xs">需支付</div>
                        <div class="mt-1 text-2xl font-semibold text-primary">¥{{ currentOrder.order_amount }}</div>
                    </div>
                </div>

                <div>
                    <div class="mb-2 text-sm text-tx-secondary">支付方式</div>
                    <el-radio-group v-model="selectedPayWay">
                        <el-radio-button
                            v-for="item in payWays"
                            :key="item.pay_way"
                            :label="item.pay_way"
                        >
                            <span class="pay-way-option">
                                <pay-way-icon :row="item" />
                                <span>{{ item.name }}</span>
                            </span>
                        </el-radio-button>
                    </el-radio-group>
                    <el-empty v-if="!payWays.length" description="暂无可用支付方式" :image-size="80" />
                </div>

                <div v-if="qrCodeUrl" class="text-center">
                    <img class="pay-qrcode" :src="qrCodeUrl" alt="微信支付二维码" />
                    <div class="mt-2 text-tx-secondary text-sm">{{ payStatusText }}</div>
                </div>
                <div v-else-if="payStatusText" class="text-tx-secondary text-sm">
                    {{ payStatusText }}
                </div>
            </div>
            <template #footer>
                <el-button @click="payVisible = false">关闭</el-button>
                <el-button type="primary" :loading="paying" :disabled="!selectedPayWay" @click="handlePrepay">
                    {{ payButtonText }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="powerMall">
import { formatPointAmount, getPointUnit } from '@/utils/point-unit'

import QRCode from 'qrcode'

import {
    powerCreateOrder,
    powerOrders,
    powerPackages,
    powerPayStatus,
    powerPayWay,
    powerPrepay,
    powerStats
} from '@/api/power_mall'
import PayWayIcon from '@/components/pay-way-icon/index.vue'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const PAY_WAY_WECHAT = 2
const PAY_WAY_ALIPAY = 3

const props = withDefaults(
    defineProps<{
        defaultTab?: 'buy' | 'records'
    }>(),
    {
        defaultTab: 'buy'
    }
)
const activeTab = ref(props.defaultTab)
const packageTab = ref<'member' | 'points'>('member')
const packages = ref<any[]>([])
const packageLoading = ref(false)
const statsLoading = ref(false)
const powerStatsData = reactive({
    time: '',
    point_balance: '0.00',
    total_remaining_points: '0.00',
    bucket_balance: '0.00',
    legacy_balance: '0.00',
    member_points: '0.00',
    member_expire_time_text: '暂无有效会员套餐',
    permanent_points: '0.00',
    today_consume_points: '0.00',
    total_consume_points: '0.00',
    today_recharge_points: '0.00',
    total_recharge_points: '0.00'
})
const creatingId = ref(0)
const payVisible = ref(false)
const payWays = ref<any[]>([])
const selectedPayWay = ref<number | ''>('')
const currentOrder = ref<any>(null)
const currentPackage = ref<any>(null)
const paying = ref(false)
const qrCodeUrl = ref('')
const payStatusText = ref('')
let payTimer: ReturnType<typeof window.setInterval> | null = null

const orderQuery = reactive({
    order_sn: '',
    package_type: '',
    pay_status: '',
    start_time: '',
    end_time: ''
})
const {
    pager: orderPager,
    getLists: getOrderLists,
    resetPage: resetOrderPage,
    resetParams: resetOrderParams
} = usePaging({
    fetchFun: powerOrders,
    params: orderQuery,
    firstLoading: false
})

const payButtonText = computed(() => {
    if (Number(selectedPayWay.value) === PAY_WAY_WECHAT) return '生成支付码'
    if (Number(selectedPayWay.value) === PAY_WAY_ALIPAY) return '打开支付宝'
    return '确认支付'
})

const memberPackages = computed(() => packages.value.filter((item) => item.type === 'member'))
const pointPackages = computed(() => packages.value.filter((item) => item.type === 'points'))
const statsCards = computed(() => [
    {
        label: '会员到期时间',
        value: powerStatsData.member_expire_time_text,
        unit: '',
        desc: `会员有效期内${getPointUnit()} ${formatPointAmount(powerStatsData.member_points)}`
    },
    {
        label: `永久${getPointUnit()}`,
        value: powerStatsData.permanent_points,
        unit: getPointUnit(),
        desc: `含历史余额 ${formatPointAmount(powerStatsData.legacy_balance)}`
    },
    {
        label: '累计消耗',
        value: powerStatsData.total_consume_points,
        unit: getPointUnit(),
        desc: '平台侧真实算力成本'
    }
])

const loadStats = async () => {
    statsLoading.value = true
    try {
        const data = await powerStats()
        Object.assign(powerStatsData, {
            time: data?.time || '',
            point_balance: data?.point_balance || '0.00',
            total_remaining_points: data?.total_remaining_points || data?.point_balance || '0.00',
            bucket_balance: data?.bucket_balance || '0.00',
            legacy_balance: data?.legacy_balance || '0.00',
            member_points: data?.member_points || '0.00',
            member_expire_time_text: data?.member_expire_time_text || '暂无有效会员套餐',
            permanent_points: data?.permanent_points || '0.00',
            today_consume_points: data?.today_consume_points || '0.00',
            total_consume_points: data?.total_consume_points || '0.00',
            today_recharge_points: data?.today_recharge_points || '0.00',
            total_recharge_points: data?.total_recharge_points || '0.00'
        })
    } finally {
        statsLoading.value = false
    }
}

const loadPackages = async () => {
    packageLoading.value = true
    try {
        packages.value = await powerPackages()
    } finally {
        packageLoading.value = false
    }
}

const handleTabChange = () => {
    if (activeTab.value === 'records' && !orderPager.lists.length) {
        getOrderLists()
    }
    if (activeTab.value === 'buy' && !packages.value.length) {
        loadPackages()
    }
    if (activeTab.value === 'buy') {
        loadStats()
    }
}

const confirmBuy = async (item: any) => {
    await feedback.confirm(`确认购买「${item.name}」？`)
    creatingId.value = item.id
    try {
        const order = await powerCreateOrder({ package_id: item.id })
        currentPackage.value = item
        await openPay({
            id: order.order_id,
            order_sn: order.order_sn,
            package_name: item.name,
            order_amount: item.amount
        })
    } finally {
        creatingId.value = 0
    }
}

const openPay = async (row: any) => {
    stopPayPolling()
    qrCodeUrl.value = ''
    payStatusText.value = ''
    currentOrder.value = {
        id: row.id || row.order_id,
        order_sn: row.order_sn,
        package_name: row.package_name,
        order_amount: row.order_amount
    }
    const data = await powerPayWay({ order_id: currentOrder.value.id })
    payWays.value = Array.isArray(data?.lists) ? data.lists : []
    selectedPayWay.value = payWays.value.find((item) => item.is_default)?.pay_way || payWays.value[0]?.pay_way || ''
    if (data?.order_amount !== undefined) {
        currentOrder.value.order_amount = data.order_amount
    }
    if (!payWays.value.length) {
        payStatusText.value = '平台暂未开启可用支付方式，请联系平台管理员配置。'
    }
    payVisible.value = true
}

const handlePrepay = async () => {
    if (!currentOrder.value?.id || !selectedPayWay.value) return
    paying.value = true
    try {
        const data = await powerPrepay({
            order_id: currentOrder.value.id,
            pay_way: selectedPayWay.value,
            redirect: '/power-mall/records'
        })
        if (Number(data?.pay_way) === PAY_WAY_WECHAT && typeof data?.config === 'string') {
            qrCodeUrl.value = await QRCode.toDataURL(data.config, { width: 220, margin: 1 })
            payStatusText.value = '请使用微信扫码支付，支付成功后会自动确认。'
            startPayPolling()
            return
        }
        if (Number(data?.pay_way) === PAY_WAY_ALIPAY && typeof data?.config === 'string') {
            openAlipayForm(data.config)
            payStatusText.value = '支付宝支付页面已打开，请在新窗口完成支付。'
            startPayPolling()
            return
        }
        startPayPolling()
    } finally {
        paying.value = false
    }
}

const openAlipayForm = (html: string) => {
    const win = window.open('', '_blank')
    if (!win) {
        feedback.msgError('浏览器拦截了支付窗口，请允许弹窗后重试')
        return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
}

const startPayPolling = () => {
    stopPayPolling()
    checkPayStatus()
    payTimer = window.setInterval(checkPayStatus, 3000)
}

const stopPayPolling = () => {
    if (payTimer) {
        window.clearInterval(payTimer)
        payTimer = null
    }
}

const checkPayStatus = async () => {
    if (!currentOrder.value?.id) return
    try {
        const data = await powerPayStatus({ order_id: currentOrder.value.id })
        if (Number(data?.pay_status) === 1) {
            payStatusText.value = `支付成功，${getPointUnit()}已到账。`
            stopPayPolling()
            getOrderLists()
            loadStats()
            setTimeout(() => {
                payVisible.value = false
            }, 800)
        }
    } catch (error) {
        stopPayPolling()
    }
}

onBeforeUnmount(stopPayPolling)
if (activeTab.value === 'records') {
    getOrderLists()
} else {
    loadStats()
    loadPackages()
}
</script>

<style scoped>
.card-title {
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.power-overview {
    display: grid;
    grid-template-columns: minmax(240px, 1.35fr) repeat(3, minmax(160px, 1fr));
    gap: 14px;
}

.power-balance-card,
.power-stat-card {
    min-height: 108px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 18px;
    background: var(--el-bg-color);
}

.power-balance-value {
    margin: 10px 0 8px;
    font-size: 34px;
    line-height: 1;
    font-weight: 700;
    color: var(--el-color-primary);
}

.power-balance-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.power-balance-meta span {
    padding: 0;
}

.power-stat-value {
    margin: 12px 0 10px;
    font-size: 26px;
    line-height: 1;
    font-weight: 650;
    color: var(--el-text-color-primary);
}

.power-stat-value span {
    margin-left: 4px;
    font-size: 13px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
}

.package-tabs {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 0 18px 18px;
}

.package-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
}

.package-tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    margin-left: 6px;
    border-radius: 999px;
    padding: 0 6px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 18px;
}

.package-section__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.package-section__desc {
    margin-top: 6px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
}

.power-package {
    min-height: 210px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 20px;
    background: var(--el-bg-color);
}

.power-package--member {
    border-top: 3px solid var(--el-color-warning);
}

.power-package--points {
    border-top: 3px solid var(--el-color-success);
}

.pay-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 16px;
}

.pay-way-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    line-height: 1;
}

.pay-way-option :deep(.pay-way-icon) {
    width: 20px;
    height: 20px;
}

.pay-qrcode {
    width: 220px;
    height: 220px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 8px;
}

@media (max-width: 1280px) {
    .power-overview {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 768px) {
    .power-overview {
        grid-template-columns: 1fr;
    }

    .package-section__header {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
