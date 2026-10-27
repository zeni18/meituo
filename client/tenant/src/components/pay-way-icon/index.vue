<template>
    <img
        class="pay-way-icon"
        :src="iconSrc"
        :alt="alt"
        @error="handleError"
    />
</template>

<script lang="ts" setup>
const fallbackIconMap: Record<number, string> = {
    1: '/resource/image/common/balance_pay.png',
    2: '/resource/image/common/wechat_pay.png',
    3: '/resource/image/common/ali_pay.png'
}

const props = defineProps<{
    row: Record<string, any>
}>()

const failed = ref(false)

const fallbackIcon = computed(() => {
    return fallbackIconMap[Number(props.row?.pay_way)] || fallbackIconMap[1]
})

const iconSrc = computed(() => {
    if (failed.value) {
        return fallbackIcon.value
    }
    return props.row?.icon || fallbackIcon.value
})

const alt = computed(() => props.row?.pay_way_name || props.row?.name || '支付图标')

const handleError = () => {
    if (iconSrc.value !== fallbackIcon.value) {
        failed.value = true
    }
}
</script>

<style lang="scss" scoped>
.pay-way-icon {
    display: block;
    width: 34px;
    height: 34px;
    object-fit: contain;
}
</style>
