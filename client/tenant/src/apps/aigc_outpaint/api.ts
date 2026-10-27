import request from '@/utils/request'

export function getAigcOutpaintConfig() {
    return request.get({ url: '/app.aigc_outpaint.config/detail' })
}

export function setAigcOutpaintConfig(params: any) {
    return request.post({ url: '/app.aigc_outpaint.config/setup', params })
}

export function getAigcOutpaintPrice() {
    return request.get({ url: '/app.aigc_outpaint.price/detail' })
}

export function setAigcOutpaintPrice(params: any) {
    return request.post({ url: '/app.aigc_outpaint.price/setup', params })
}

export function getAigcOutpaintTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_outpaint.task/lists', params })
}

export function getAigcOutpaintTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_outpaint.task/detail', params })
}

export function retryAigcOutpaintTask(params: any) {
    return request.post({ url: '/app.aigc_outpaint.task/retry', params })
}

export function deleteAigcOutpaintTask(params: any) {
    return request.post({ url: '/app.aigc_outpaint.task/delete', params })
}
