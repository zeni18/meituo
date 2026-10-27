import request from '@/utils/request'

export function getAigcBackgroundRemovalConfig() {
    return request.get({ url: '/app.aigc_background_removal.config/detail' })
}

export function setAigcBackgroundRemovalConfig(params: any) {
    return request.post({ url: '/app.aigc_background_removal.config/setup', params })
}

export function getAigcBackgroundRemovalPrice() {
    return request.get({ url: '/app.aigc_background_removal.price/detail' })
}

export function setAigcBackgroundRemovalPrice(params: any) {
    return request.post({ url: '/app.aigc_background_removal.price/setup', params })
}

export function getAigcBackgroundRemovalTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_background_removal.task/lists', params })
}

export function getAigcBackgroundRemovalTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_background_removal.task/detail', params })
}

export function retryAigcBackgroundRemovalTask(params: any) {
    return request.post({ url: '/app.aigc_background_removal.task/retry', params })
}

export function deleteAigcBackgroundRemovalTask(params: any) {
    return request.post({ url: '/app.aigc_background_removal.task/delete', params })
}
