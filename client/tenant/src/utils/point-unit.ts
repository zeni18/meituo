import useAppStore from '@/stores/modules/app'

const DEFAULT_POINT_UNIT = '算力'

export const normalizePointUnit = (value?: string) => {
    const unit = String(value || '').trim()
    return unit || DEFAULT_POINT_UNIT
}

export const getPointUnit = () => {
    const appStore = useAppStore()
    return normalizePointUnit(appStore.config?.point_unit || appStore.config?.recharge?.point_unit)
}

export const formatPointAmount = (amount: string | number, unit?: string) => {
    return `${amount} ${normalizePointUnit(unit || getPointUnit())}`
}

export const formatPointRate = (amount: string | number, suffix = '', unit?: string) => {
    return `${amount} ${normalizePointUnit(unit || getPointUnit())}${suffix ? `/${suffix}` : ''}`
}
