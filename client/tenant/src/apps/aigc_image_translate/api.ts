import request from '@/utils/request'

export function getAigcImageTranslateConfig() {
    return request.get({ url: '/app.aigc_image_translate.config/detail' })
}

export function setAigcImageTranslateConfig(params: any) {
    return request.post({ url: '/app.aigc_image_translate.config/setup', params })
}

export function getAigcImageTranslatePrice() {
    return request.get({ url: '/app.aigc_image_translate.price/detail' })
}

export function setAigcImageTranslatePrice(params: any) {
    return request.post({ url: '/app.aigc_image_translate.price/setup', params })
}

export function getAigcImageTranslateTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_image_translate.task/lists', params })
}

export function getAigcImageTranslateTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_image_translate.task/detail', params })
}

export function retryAigcImageTranslateTask(params: any) {
    return request.post({ url: '/app.aigc_image_translate.task/retry', params })
}

export function deleteAigcImageTranslateTask(params: any) {
    return request.post({ url: '/app.aigc_image_translate.task/delete', params })
}
