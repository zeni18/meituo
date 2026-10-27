import request from '@/utils/request'

export function powerPackageLists(params?: any) {
    return request.get({ url: '/power.package/lists', params }, { ignoreCancelToken: true })
}

export function powerPackageDetail(params?: any) {
    return request.get({ url: '/power.package/detail', params })
}

export function powerPackageAdd(params?: any) {
    return request.post({ url: '/power.package/add', params })
}

export function powerPackageEdit(params?: any) {
    return request.post({ url: '/power.package/edit', params })
}

export function powerPackageDelete(params?: any) {
    return request.post({ url: '/power.package/delete', params })
}

export function powerPackageOrders(params?: any) {
    return request.get({ url: '/power.package/orders', params }, { ignoreCancelToken: true })
}

export function powerPackageTypes(params?: any) {
    return request.get({ url: '/power.package/types', params })
}

export function powerPayWay() {
    return request.get({ url: '/power.pay_way/getPayWay' })
}

export function powerSetPayWay(params: any) {
    return request.post({ url: '/power.pay_way/setPayWay', params })
}

export function powerPayConfigLists() {
    return request.get({ url: '/power.pay_config/lists' })
}

export function powerSetPayConfig(params: any) {
    return request.post({ url: '/power.pay_config/setConfig', params })
}

export function powerPayConfig(params: any) {
    return request.get({ url: '/power.pay_config/getConfig', params })
}

export function powerMarketLists(params?: any) {
    return request.get({ url: '/power.market/lists', params }, { ignoreCancelToken: true })
}

export function powerMarketDetail(params?: any) {
    return request.get({ url: '/power.market/detail', params })
}

export function powerMarketApps(params?: any) {
    return request.get({ url: '/power.market/apps', params }, { ignoreCancelToken: true })
}

export function powerMarketAppDetail(params?: any) {
    return request.get({ url: '/power.market/appDetail', params })
}

export function powerMarketSavePrices(params?: any) {
    return request.post({ url: '/power.market/savePrices', params })
}

export function powerMarketBatchShelf(params?: any) {
    return request.post({ url: '/power.market/batchShelf', params })
}

export function powerMarketTypes() {
    return request.get({ url: '/power.market/types' })
}

export function powerMarketSync() {
    return request.post({ url: '/power.market/sync' })
}

export function aiConsumptionLists(params?: any) {
    return request.get({ url: '/ai_consumption/lists', params }, { ignoreCancelToken: true })
}

export function aiConsumptionDetail(params: any) {
    return request.get({ url: '/ai_consumption/detail', params })
}

export function aiConsumptionBatchAction(params: any) {
    return request.post({ url: '/ai_consumption/batchAction', params })
}

export function aiConsumptionBatchDetail(params: any) {
    return request.get({ url: '/ai_consumption/batchDetail', params })
}

export function aiConsumptionOperationLists(params?: any) {
    return request.get({ url: '/ai_consumption/operationLists', params })
}
