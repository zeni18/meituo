import request from '@/utils/request'

export function getAigcShortDramaDashboard(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.dashboard/stat', params })
}

export function getAigcShortDramaDependencies(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.config/dependencies', params })
}

export function getAigcShortDramaTenantStat(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.tenant/stat', params })
}

export function getAigcShortDramaTenantLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.tenant/lists', params })
}
