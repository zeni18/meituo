import request from '@/utils/request'

export function getAigcProductPromoVideoConfig() {
    return request.get({ url: '/app.aigc_product_promo_video.config/detail' })
}

export function setAigcProductPromoVideoConfig(params: any) {
    return request.post({ url: '/app.aigc_product_promo_video.config/setup', params })
}

export function getAigcProductPromoVideoTypes() {
    return request.get({ url: '/app.aigc_product_promo_video.type/lists' })
}

export function saveAigcProductPromoVideoType(params: any) {
    return request.post({ url: '/app.aigc_product_promo_video.type/save', params })
}

export function setAigcProductPromoVideoTypeStatus(params: any) {
    return request.post({ url: '/app.aigc_product_promo_video.type/status', params })
}

export function deleteAigcProductPromoVideoType(params: any) {
    return request.post({ url: '/app.aigc_product_promo_video.type/delete', params })
}

export function getAigcProductPromoVideoTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_product_promo_video.task/lists', params })
}

export function getAigcProductPromoVideoTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_product_promo_video.task/detail', params })
}

export function retryAigcProductPromoVideoTask(params: any) {
    return request.post({ url: '/app.aigc_product_promo_video.task/retry', params })
}

export function deleteAigcProductPromoVideoTask(params: any) {
    return request.post({ url: '/app.aigc_product_promo_video.task/delete', params })
}
