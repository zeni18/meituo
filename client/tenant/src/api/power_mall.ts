import request from '@/utils/request'

export function powerPackages(params?: any) {
    return request.get({ url: '/power.mall/packages', params }, { ignoreCancelToken: true })
}

export function powerStats(params?: any) {
    return request.get({ url: '/power.mall/stats', params }, { ignoreCancelToken: true })
}

export function powerCreateOrder(params?: any) {
    return request.post({ url: '/power.mall/createOrder', params })
}

export function powerOrders(params?: any) {
    return request.get({ url: '/power.mall/orders', params }, { ignoreCancelToken: true })
}

export function powerOrderDetail(params?: any) {
    return request.get({ url: '/power.mall/orderDetail', params })
}

export function powerConsumeLogs(params?: any) {
    return request.get({ url: '/power.mall/consumeLogs', params }, { ignoreCancelToken: true })
}

export function powerConsumeLogDetail(params?: any) {
    return request.get({ url: '/power.mall/consumeLogDetail', params })
}

export function powerPayWay(params?: any) {
    return request.get({ url: '/power.pay/payWay', params })
}

export function powerPrepay(params?: any) {
    return request.post({ url: '/power.pay/prepay', params })
}

export function powerPayStatus(params?: any) {
    return request.get({ url: '/power.pay/payStatus', params }, { ignoreCancelToken: true })
}

export function powerMarketModels(params?: any) {
    return request.get({ url: '/power.market/models', params }, { ignoreCancelToken: true })
}

export function powerMarketApps(params?: any) {
    return request.get({ url: '/power.market/apps', params }, { ignoreCancelToken: true })
}

export function powerMarketDetail(params?: any) {
    return request.get({ url: '/power.market/detail', params })
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

export function powerMarketSaveDisplay(params?: any) {
    return request.post({ url: '/power.market/saveDisplay', params })
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
