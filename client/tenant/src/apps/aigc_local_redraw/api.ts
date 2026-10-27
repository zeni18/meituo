import request from '@/utils/request'

export function getAigcLocalRedrawConfig() {
    return request.get({ url: '/app.aigc_local_redraw.config/detail' })
}

export function setAigcLocalRedrawConfig(params: any) {
    return request.post({ url: '/app.aigc_local_redraw.config/setup', params })
}

export function getAigcLocalRedrawTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_local_redraw.task/lists', params })
}

export function getAigcLocalRedrawTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_local_redraw.task/detail', params })
}

export function retryAigcLocalRedrawTask(params: any) {
    return request.post({ url: '/app.aigc_local_redraw.task/retry', params })
}

export function deleteAigcLocalRedrawTask(params: any) {
    return request.post({ url: '/app.aigc_local_redraw.task/delete', params })
}
