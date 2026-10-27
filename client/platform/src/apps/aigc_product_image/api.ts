import request from '@/utils/request'

export function getAigcProductImageTenantStat(params?: any) {
    return request.get({ url: '/app.aigc_product_image.tenant/stat', params })
}

export function getAigcProductImageTenantLists(params?: any) {
    return request.get({ url: '/app.aigc_product_image.tenant/lists', params })
}

export function getAigcProductImageDependencies(params?: any) {
    return request.get({ url: '/app.aigc_product_image.config/dependencies', params })
}
