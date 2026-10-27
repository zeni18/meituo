<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-table :data="packages" v-loading="loading" size="large">
                <el-table-column label="套餐名称" prop="name" min-width="160" />
                <el-table-column label="剩余额度" prop="remaining_quota" min-width="100" />
                <el-table-column label="售价" min-width="100"><template #default="{ row }">¥{{ row.tenant_sale_price }}</template></el-table-column>
                <el-table-column label="操作" width="160">
                    <template #default="{ row }">
                        <el-input-number v-model="quantities[row.id]" :min="1" :precision="0" class="mr-2 w-[110px]" />
                        <el-button type="primary" link @click="createOrder(row)">购买</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>
        <el-dialog v-model="payVisible" title="额度订单支付" width="520px" @closed="stopPoll">
            <div v-if="currentOrder">
                <div class="flex justify-between mb-4">
                    <div><div class="text-xs text-tx-secondary">套餐</div><div class="font-medium">{{ currentOrder.package_name }}</div></div>
                    <div class="text-right"><div class="text-xs text-tx-secondary">金额</div><div class="text-2xl font-semibold text-primary">¥{{ currentOrder.order_amount }}</div></div>
                </div>
                <el-radio-group v-model="payWay">
                    <el-radio-button v-for="item in payWays" :key="item.pay_way" :label="item.pay_way">{{ item.name }}</el-radio-button>
                </el-radio-group>
            </div>
            <template #footer>
                <el-button @click="payVisible = false">关闭</el-button>
                <el-button type="primary" :loading="paying" @click="submitPay">去支付</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { brandPayStatus, brandPayWay, brandPrepay, brandQuotaCreateOrder, brandQuotaPackages } from '@/api/brand'

const loading = ref(false)
const paying = ref(false)
const packages = ref<any[]>([])
const quantities = reactive<Record<number, number>>({})
const payWays = ref<any[]>([])
const payVisible = ref(false)
const currentOrder = ref<any>(null)
const payWay = ref<number | string>('')
let timer: number | undefined

const getLists = async () => {
    loading.value = true
    try {
        packages.value = await brandQuotaPackages()
        packages.value.forEach((item) => { if (!quantities[item.id]) quantities[item.id] = 1 })
    } finally { loading.value = false }
}
const createOrder = async (row: any) => {
    const order = await brandQuotaCreateOrder({ package_id: row.id, quantity: quantities[row.id] || 1 })
    currentOrder.value = { ...order, package_name: row.name, order_amount: Number(row.quota_price || 0) * (quantities[row.id] || 1) }
    payWays.value = await brandPayWay({ order_id: order.order_id }).then((res: any) => res.lists || res || [])
    payWay.value = payWays.value[0]?.pay_way || ''
    payVisible.value = true
}
const submitPay = async () => {
    if (!currentOrder.value) return
    paying.value = true
    try {
        await brandPrepay({ order_id: currentOrder.value.order_id, pay_way: payWay.value, redirect: '/brand/quota' })
        startPoll()
    } finally { paying.value = false }
}
const startPoll = () => {
    stopPoll()
    timer = window.setInterval(async () => {
        if (!currentOrder.value) return
        const res = await brandPayStatus({ order_id: currentOrder.value.order_id })
        if (res?.order?.pay_status === 1 || res?.pay_status === 1) {
            stopPoll()
            payVisible.value = false
            getLists()
        }
    }, 3000)
}
const stopPoll = () => { if (timer) window.clearInterval(timer) }
getLists()
</script>
