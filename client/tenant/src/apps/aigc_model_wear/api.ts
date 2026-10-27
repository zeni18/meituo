import request from '@/utils/request'

export function getAigcModelWearConfig() {
    return request.get({ url: '/app.aigc_model_wear.config/detail' })
}

export function setAigcModelWearConfig(params: any) {
    return request.post({ url: '/app.aigc_model_wear.config/setup', params })
}

export function getAigcModelWearPrice() {
    return request.get({ url: '/app.aigc_model_wear.price/detail' })
}

export function setAigcModelWearPrice(params: any) {
    return request.post({ url: '/app.aigc_model_wear.price/setup', params })
}

export function getAigcModelWearTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_model_wear.task/lists', params })
}

export function getAigcModelWearTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_model_wear.task/detail', params })
}

export function retryAigcModelWearTask(params: any) {
    return request.post({ url: '/app.aigc_model_wear.task/retry', params })
}

export function deleteAigcModelWearTask(params: any) {
    return request.post({ url: '/app.aigc_model_wear.task/delete', params })
}
