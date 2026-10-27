<template>
    <popup
        ref="popupRef"
        :title="`${pointUnit}调整`"
        width="500px"
        @confirm="handleConfirm"
        :async="true"
        @close="popupClose"
    >
        <div class="pr-8">
            <el-form ref="formRef" :model="formData" label-width="120px" :rules="formRules">
                <el-form-item :label="`当前${pointUnit}`">{{ value }} </el-form-item>
                <el-form-item :label="`${pointUnit}增减`" required prop="action">
                    <el-radio-group v-model="formData.action">
                        <el-radio :value="1">增加{{ pointUnit }}</el-radio>
                        <el-radio :value="2">扣减{{ pointUnit }}</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item :label="`调整${pointUnit}`" prop="num">
                    <el-input
                        :model-value="formData.num"
                        :placeholder="`请输入调整的${pointUnit}`"
                        type="number"
                        @input="numberValidate"
                    />
                </el-form-item>
                <el-form-item :label="`调整后${pointUnit}`">{{ adjustmentMoney }} </el-form-item>
                <el-form-item label="备注" prop="remark">
                    <el-input v-model="formData.remark" type="textarea" :rows="4" />
                </el-form-item>
            </el-form>
        </div>
    </popup>
</template>
<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus'

import Popup from '@/components/popup/index.vue'
import useAppStore from '@/stores/modules/app'
import feedback from '@/utils/feedback'
import { normalizePointUnit } from '@/utils/point-unit'

const formRef = shallowRef<FormInstance>()
const appStore = useAppStore()
const pointUnit = computed(() => normalizePointUnit(appStore.config?.point_unit || appStore.config?.recharge?.point_unit))
const props = defineProps({
    show: {
        type: Boolean,
        required: true
    },
    value: {
        type: [Number, String],
        required: true
    }
})
const emit = defineEmits<{
    (event: 'update:show', value: boolean): void
    (event: 'confirm', value: any): void
}>()
const formData = reactive({
    action: 1, //变动类型 1-增加 2-减少
    num: '',
    remark: ''
})
const popupRef = shallowRef<InstanceType<typeof Popup>>()

const adjustmentMoney = computed(() => {
    return Number(props.value) + Number(formData.num) * (formData.action == 1 ? 1 : -1)
})

const formRules: FormRules = {
    num: [
        {
            required: true,
            message: `请输入调整的${pointUnit.value}`
        }
    ]
}
const numberValidate = (value: string) => {
    if (value.includes('-')) {
        return feedback.msgError('请输入正整数')
    }
    formData.num = value
}
const handleConfirm = async () => {
    await formRef.value?.validate()
    emit('confirm', formData)
}

const popupClose = () => {
    emit('update:show', false)
    formRef.value?.resetFields()
}
watch(
    () => props.show,
    (val) => {
        if (val) {
            popupRef.value?.open()
        } else {
            popupRef.value?.close()
        }
    }
)
watch(adjustmentMoney, (val) => {
    if (val < 0) {
        feedback.msgError(`调整后${pointUnit.value}需大于0`)
        formData.num = ''
    }
})
</script>
