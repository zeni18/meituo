import request from '@/utils/request'

export function getAigcPersonReplacementConfig() {
    return request.get({ url: '/app.aigc_person_replacement.config/detail' })
}

export function setAigcPersonReplacementConfig(params: any) {
    return request.post({ url: '/app.aigc_person_replacement.config/setup', params })
}

export function getAigcPersonReplacementTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_person_replacement.task/lists', params })
}

export function getAigcPersonReplacementTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_person_replacement.task/detail', params })
}

export function retryAigcPersonReplacementTask(params: any) {
    return request.post({ url: '/app.aigc_person_replacement.task/retry', params })
}

export function deleteAigcPersonReplacementTask(params: any) {
    return request.post({ url: '/app.aigc_person_replacement.task/delete', params })
}
