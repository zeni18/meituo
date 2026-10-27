import request from '@/utils/request'

export function getAigcProductMultiAngleConfig() {
    return request.get({ url: '/app.aigc_product_multi_angle.config/detail' })
}

export function setAigcProductMultiAngleConfig(params: any) {
    return request.post({ url: '/app.aigc_product_multi_angle.config/setup', params })
}

export function getAigcProductMultiAngleViews() {
    return request.get({ url: '/app.aigc_product_multi_angle.view/lists' })
}

export function saveAigcProductMultiAngleView(params: any) {
    return request.post({ url: '/app.aigc_product_multi_angle.view/save', params })
}

export function setAigcProductMultiAngleViewStatus(params: any) {
    return request.post({ url: '/app.aigc_product_multi_angle.view/status', params })
}

export function deleteAigcProductMultiAngleView(params: any) {
    return request.post({ url: '/app.aigc_product_multi_angle.view/delete', params })
}

export function getAigcProductMultiAnglePrice() {
    return request.get({ url: '/app.aigc_product_multi_angle.price/detail' })
}

export function setAigcProductMultiAnglePrice(params: any) {
    return request.post({ url: '/app.aigc_product_multi_angle.price/setup', params })
}

export function getAigcProductMultiAngleTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_product_multi_angle.task/lists', params })
}

export function getAigcProductMultiAngleTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_product_multi_angle.task/detail', params })
}

export function retryAigcProductMultiAngleTask(params: any) {
    return request.post({ url: '/app.aigc_product_multi_angle.task/retry', params })
}

export function deleteAigcProductMultiAngleTask(params: any) {
    return request.post({ url: '/app.aigc_product_multi_angle.task/delete', params })
}
