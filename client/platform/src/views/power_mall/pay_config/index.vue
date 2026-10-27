<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-alert
                type="warning"
                title="此处配置租户购买算力时的平台收款方式。租户后台自身的终端用户收款配置不受影响。"
                :closable="false"
                show-icon
            />
            <el-tabs v-model="activeTab" class="mt-4" @tab-change="handleTabChange">
                <el-tab-pane label="支付方式" name="way" />
                <el-tab-pane label="支付参数" name="config" />
            </el-tabs>
        </el-card>

        <template v-if="activeTab === 'way'">
            <el-card class="!border-none mt-4" shadow="never">
                <el-button
                    v-perms="['power.pay_way/setPayWay']"
                    type="primary"
                    @click="handleSetupPayWay"
                >
                    设置支付方式
                </el-button>
            </el-card>

            <el-card
                v-for="(value, scene) in payWay"
                :key="scene"
                class="!border-none mt-4"
                shadow="never"
            >
                <div class="text-lg mb-[24px]">
                    {{ getSceneName(Number(scene)) }}
                    <span class="form-tips ml-[10px]">{{ getSceneTips(Number(scene)) }}</span>
                </div>
                <el-table v-if="value.length" :data="value" style="width: 100%">
                    <el-table-column label="图标" min-width="120">
                        <template #default="{ row }">
                            <pay-way-icon :row="row" />
                        </template>
                    </el-table-column>
                    <el-table-column prop="pay_way_name" label="支付方式" min-width="150" />
                    <el-table-column prop="name" label="显示名称" min-width="150" />
                    <el-table-column label="默认支付" min-width="150">
                        <template #default="{ row, $index }">
                            <el-radio
                                v-if="setupPayWay"
                                v-model="row.is_default"
                                :label="1"
                                @change="changePayDefault($index, Number(scene))"
                            >
                                设为默认
                            </el-radio>
                            <template v-else>
                                <el-tag v-if="row.is_default == 1" disable-transitions>默认</el-tag>
                                <span v-else>-</span>
                            </template>
                        </template>
                    </el-table-column>
                    <el-table-column label="开启状态" min-width="150">
                        <template #default="{ row }">
                            <el-switch
                                v-if="setupPayWay"
                                v-model="row.status"
                                :active-value="1"
                                :inactive-value="0"
                            />
                            <span v-else>{{ row.status == 1 ? '开启' : '关闭' }}</span>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>

            <footer-btns v-if="setupPayWay">
                <el-button @click="handleCancelPayWay">取消</el-button>
                <el-button type="primary" @click="handleSubmitPayWay">保存</el-button>
            </footer-btns>
        </template>

        <el-card v-else class="!border-none mt-4" shadow="never">
            <el-table :data="payConfigList">
                <el-table-column prop="pay_way_name" label="支付方式" min-width="150" />
                <el-table-column prop="name" label="显示名称" min-width="150" />
                <el-table-column label="图标" min-width="120">
                    <template #default="{ row }">
                        <pay-way-icon :row="row" />
                    </template>
                </el-table-column>
                <el-table-column prop="sort" label="排序" min-width="100" />
                <el-table-column label="操作" min-width="100" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            v-perms="['power.pay_config/setConfig']"
                            link
                            type="primary"
                            @click="handleEditConfig(row)"
                        >
                            配置
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <pay-config-edit ref="editRef" api-scope="power" @refresh="getPayConfigList" />
    </div>
</template>

<script lang="ts" setup>
import { h, ref as vueRef } from 'vue'
import { cloneDeep } from 'lodash'

import {
    powerPayConfigLists,
    powerPayWay,
    powerSetPayWay
} from '@/api/power_mall'
import { useComponentRef } from '@/utils/getExposeType'
import PayConfigEdit from '@/views/setting/pay/config/edit.vue'

enum PaySceneEnum {
    MP_WEIXIN = 1,
    OA = 2,
    H5 = 3,
    PC = 4,
    APP = 5
}

const activeTab = ref<'way' | 'config'>('way')
const payWay = ref<Record<number, any[]>>({})
const defaultPayWay = ref<Record<number, any[]>>({})
const setupPayWay = ref(false)
const payConfigList = ref<any[]>([])
const editRef = useComponentRef(PayConfigEdit)

const fallbackIconMap: Record<number, string> = {
    1: '/resource/image/common/balance_pay.png',
    2: '/resource/image/common/wechat_pay.png',
    3: '/resource/image/common/ali_pay.png'
}

const getPayIcon = (row: any) => {
    return row?.icon || fallbackIconMap[Number(row?.pay_way)] || fallbackIconMap[1]
}

const PayWayIcon = {
    props: {
        row: {
            type: Object,
            required: true
        }
    },
    setup(props: any) {
        const failed = vueRef(false)
        return () => {
            const row = props.row || {}
            const src = failed.value ? fallbackIconMap[Number(row.pay_way)] || fallbackIconMap[1] : getPayIcon(row)
            return h('img', {
                src,
                alt: row.pay_way_name || row.name || '支付图标',
                class: 'power-pay-icon',
                onError: () => {
                    failed.value = true
                }
            })
        }
    }
}

const getSceneName = (scene: number) => {
    const names: Record<number, string> = {
        [PaySceneEnum.MP_WEIXIN]: '微信小程序',
        [PaySceneEnum.OA]: '微信公众号',
        [PaySceneEnum.H5]: 'H5支付',
        [PaySceneEnum.PC]: 'PC支付',
        [PaySceneEnum.APP]: 'APP支付'
    }
    return names[scene] || '支付场景'
}

const getSceneTips = (scene: number) => {
    const tips: Record<number, string> = {
        [PaySceneEnum.MP_WEIXIN]: '租户在微信小程序中购买算力时使用',
        [PaySceneEnum.OA]: '租户在微信公众号 H5 中购买算力时使用',
        [PaySceneEnum.H5]: '租户在浏览器 H5 页面中购买算力时使用',
        [PaySceneEnum.PC]: '租户在后台 PC 页面中购买算力时使用',
        [PaySceneEnum.APP]: '租户在 APP 中购买算力时使用'
    }
    return tips[scene] || ''
}

const getPayWayList = async () => {
    payWay.value = await powerPayWay()
    defaultPayWay.value = cloneDeep(payWay.value)
}

const getPayConfigList = async () => {
    const { lists } = await powerPayConfigLists()
    payConfigList.value = lists
}

const handleSetupPayWay = () => {
    setupPayWay.value = true
}

const changePayDefault = (index: number, scene: number) => {
    payWay.value[scene].forEach((item: any) => {
        item.is_default = 0
    })
    payWay.value[scene][index].is_default = 1
}

const handleCancelPayWay = () => {
    payWay.value = cloneDeep(defaultPayWay.value)
    setupPayWay.value = false
}

const handleSubmitPayWay = async () => {
    await powerSetPayWay(payWay.value)
    setupPayWay.value = false
    getPayWayList()
}

const handleEditConfig = (row: any) => {
    editRef.value?.openHandle(row.id, false)
}

const handleTabChange = () => {
    if (activeTab.value === 'way') {
        getPayWayList()
    } else {
        getPayConfigList()
    }
}

getPayWayList()
</script>

<style lang="scss" scoped>
.power-pay-icon {
    display: block;
    width: 34px;
    height: 34px;
    object-fit: contain;
}
</style>
