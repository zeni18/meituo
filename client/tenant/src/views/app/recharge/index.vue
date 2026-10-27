<template>
    <div>
        <el-card shadow="never" class="!border-none">
            <template #header>
                <span class="font-extrabold text-lg">{{ pointUnit }}充值设置</span>
            </template>
            <el-form :model="formData" label-width="120px">
                <el-form-item label="状态">
                    <div>
                        <el-radio-group v-model="formData.status" class="ml-4">
                            <el-radio :value="1">开启</el-radio>
                            <el-radio :value="0">关闭</el-radio>
                        </el-radio-group>
                        <div class="form-tips">关闭或开启充值功能，关闭后将不显示充值入口</div>
                    </div>
                </el-form-item>
                <el-form-item label="计费单位名称">
                    <div>
                        <el-input
                            v-model.trim="formData.point_unit"
                            placeholder="请输入计费单位名称"
                            maxlength="12"
                            show-word-limit
                            clearable
                        />
                        <div class="form-tips">用于前台、PC端和移动端展示充值、余额和消耗单位，默认算力</div>
                    </div>
                </el-form-item>
                <el-form-item :label="`最低充值${pointUnit}`">
                    <div>
                        <el-input
                            v-model="formData.min_amount"
                            :placeholder="`请输入最低充值${pointUnit}`"
                            clearable
                        />
                        <div class="form-tips">
                            最低充值{{ pointUnit }}要求，不填或填0表示不限制最低充值{{ pointUnit }}
                        </div>
                    </div>
                </el-form-item>
            </el-form>
        </el-card>
        <footer-btns v-perms="['recharge.recharge/setConfig']">
            <el-button type="primary" @click="handleSubmit">保存</el-button>
        </footer-btns>
    </div>
</template>
<script lang="ts" setup name="rechargeConfig">
import { getRechargeConfig, setRechargeConfig } from '@/api/app/recharge'
import useAppStore from '@/stores/modules/app'
import { normalizePointUnit } from '@/utils/point-unit'

const appStore = useAppStore()
const formData = reactive({
    status: 1, //功能状态 1-开启 0-关闭
    min_amount: '', //最低充值数
    point_unit: '算力' // 计费单位名称
})
const pointUnit = computed(() => normalizePointUnit(formData.point_unit))

const getConfig = async () => {
    const data = await getRechargeConfig()
    Object.assign(formData, data)
}
const handleSubmit = async () => {
    await setRechargeConfig(formData)
    await appStore.getConfig()
    getConfig()
}
getConfig()
</script>
