import request from '@/utils/request'

export function getAigcFittingTenantStat(params?: any) {
    return request.get({ url: '/app.aigc_fitting.tenant/stat', params })
}

export function getAigcFittingTenantLists(params?: any) {
    return request.get({ url: '/app.aigc_fitting.tenant/lists', params })
}

export function getAigcFittingDependencies(params?: any) {
    return request.get({ url: '/app.aigc_fitting.config/dependencies', params })
}
