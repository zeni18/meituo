import request from '@/utils/request'

export function getAigcHairstyleTenantStat(params?: any) {
    return request.get({ url: '/app.aigc_hairstyle.tenant/stat', params })
}

export function getAigcHairstyleTenantLists(params?: any) {
    return request.get({ url: '/app.aigc_hairstyle.tenant/lists', params })
}

export function getAigcHairstyleDependencies(params?: any) {
    return request.get({ url: '/app.aigc_hairstyle.config/dependencies', params })
}
