import request from '@/utils/request'

export function getAigcFittingConfig() {
    return request.get({ url: '/app.aigc_fitting.config/detail' })
}

export function setAigcFittingConfig(params: any) {
    return request.post({ url: '/app.aigc_fitting.config/setup', params })
}

export function getAigcFittingModels() {
    return request.get({ url: '/app.aigc_fitting.model/detail' })
}

export function setAigcFittingModels(params: any) {
    return request.post({ url: '/app.aigc_fitting.model/setup', params })
}

export function getAigcFittingTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_fitting.task/lists', params })
}

export function getAigcFittingTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_fitting.task/detail', params })
}

export function retryAigcFittingTask(params: any) {
    return request.post({ url: '/app.aigc_fitting.task/retry', params })
}

export function deleteAigcFittingTask(params: any) {
    return request.post({ url: '/app.aigc_fitting.task/delete', params })
}
