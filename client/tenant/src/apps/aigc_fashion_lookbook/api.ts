import request from '@/utils/request'

export function getAigcFashionLookbookConfig() {
    return request.get({ url: '/app.aigc_fashion_lookbook.config/detail' })
}

export function setAigcFashionLookbookConfig(params: any) {
    return request.post({ url: '/app.aigc_fashion_lookbook.config/setup', params })
}

export function getAigcFashionLookbookModels() {
    return request.get({ url: '/app.aigc_fashion_lookbook.model/lists' })
}

export function saveAigcFashionLookbookModel(params: any) {
    return request.post({ url: '/app.aigc_fashion_lookbook.model/save', params })
}

export function setAigcFashionLookbookModelStatus(params: any) {
    return request.post({ url: '/app.aigc_fashion_lookbook.model/status', params })
}

export function deleteAigcFashionLookbookModel(params: any) {
    return request.post({ url: '/app.aigc_fashion_lookbook.model/delete', params })
}

export function getAigcFashionLookbookPrice() {
    return request.get({ url: '/app.aigc_fashion_lookbook.price/detail' })
}

export function setAigcFashionLookbookPrice(params: any) {
    return request.post({ url: '/app.aigc_fashion_lookbook.price/setup', params })
}

export function getAigcFashionLookbookTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_fashion_lookbook.task/lists', params })
}

export function getAigcFashionLookbookTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_fashion_lookbook.task/detail', params })
}

export function retryAigcFashionLookbookTask(params: any) {
    return request.post({ url: '/app.aigc_fashion_lookbook.task/retry', params })
}

export function deleteAigcFashionLookbookTask(params: any) {
    return request.post({ url: '/app.aigc_fashion_lookbook.task/delete', params })
}
