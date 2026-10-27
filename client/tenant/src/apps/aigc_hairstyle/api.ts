import request from '@/utils/request'

export function getAigcHairstyleConfig() {
    return request.get({ url: '/app.aigc_hairstyle.config/detail' })
}

export function setAigcHairstyleConfig(params: any) {
    return request.post({ url: '/app.aigc_hairstyle.config/setup', params })
}

export function getAigcHairstyleTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_hairstyle.task/lists', params })
}

export function getAigcHairstyleTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_hairstyle.task/detail', params })
}

export function retryAigcHairstyleTask(params: any) {
    return request.post({ url: '/app.aigc_hairstyle.task/retry', params })
}

export function deleteAigcHairstyleTask(params: any) {
    return request.post({ url: '/app.aigc_hairstyle.task/delete', params })
}
