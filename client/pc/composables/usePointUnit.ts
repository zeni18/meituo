import { useAppStore } from '~/stores/app'

const DEFAULT_POINT_UNIT = '算力'

export const normalizePointUnit = (value?: string) => {
    const unit = String(value || '').trim()
    return unit || DEFAULT_POINT_UNIT
}

export const formatPointAmount = (amount: string | number, unit = DEFAULT_POINT_UNIT) => `${amount} ${normalizePointUnit(unit)}`

export const formatPointRate = (amount: string | number, suffix = '', unit = DEFAULT_POINT_UNIT) => {
    const rateSuffix = suffix ? `/${suffix}` : ''
    return `${amount} ${normalizePointUnit(unit)}${rateSuffix}`
}

export const usePointUnit = () => {
    const appStore = useAppStore()
    const pointUnit = computed(() => normalizePointUnit(appStore.config?.point_unit || appStore.config?.recharge?.point_unit))
    const formatPoint = (amount: string | number) => formatPointAmount(amount, pointUnit.value)
    const formatPointWithSuffix = (amount: string | number, suffix = '') => formatPointRate(amount, suffix, pointUnit.value)

    return {
        pointUnit,
        formatPoint,
        formatPointWithSuffix
    }
}
