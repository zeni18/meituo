import request from '@/utils/request'

export function brandPackages(params?: any) {
    return request.get({ url: '/brand.package/lists', params }, { ignoreCancelToken: true })
}

export function brandSavePrice(params?: any) {
    return request.post({ url: '/brand.package/savePrice', params })
}

export function brandQuotaPackages(params?: any) {
    return request.get({ url: '/brand.quota/packages', params }, { ignoreCancelToken: true })
}

export function brandQuotaCreateOrder(params?: any) {
    return request.post({ url: '/brand.quota/createOrder', params })
}

export function brandQuotaOrders(params?: any) {
    return request.get({ url: '/brand.quota/orders', params }, { ignoreCancelToken: true })
}

export function brandOrders(params?: any) {
    return request.get({ url: '/brand.order/lists', params }, { ignoreCancelToken: true })
}

export function brandPayWay(params?: any) {
    return request.get({ url: '/brand.pay/payWay', params })
}

export function brandPrepay(params?: any) {
    return request.post({ url: '/brand.pay/prepay', params })
}

export function brandPayStatus(params?: any) {
    return request.get({ url: '/brand.pay/payStatus', params }, { ignoreCancelToken: true })
}

