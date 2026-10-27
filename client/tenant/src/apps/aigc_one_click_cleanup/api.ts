import request from '@/utils/request'

export function getAigcOneClickCleanupConfig() {
    return request.get({ url: '/app.aigc_one_click_cleanup.config/detail' })
}

export function setAigcOneClickCleanupConfig(params: any) {
    return request.post({ url: '/app.aigc_one_click_cleanup.config/setup', params })
}

export function getAigcOneClickCleanupOptions() {
    return request.get({ url: '/app.aigc_one_click_cleanup.option/lists' })
}

export function saveAigcOneClickCleanupOption(params: any) {
    return request.post({ url: '/app.aigc_one_click_cleanup.option/save', params })
}

export function setAigcOneClickCleanupOptionStatus(params: any) {
    return request.post({ url: '/app.aigc_one_click_cleanup.option/status', params })
}

export function deleteAigcOneClickCleanupOption(params: any) {
    return request.post({ url: '/app.aigc_one_click_cleanup.option/delete', params })
}

export function getAigcOneClickCleanupPrice() {
    return request.get({ url: '/app.aigc_one_click_cleanup.price/detail' })
}

export function setAigcOneClickCleanupPrice(params: any) {
    return request.post({ url: '/app.aigc_one_click_cleanup.price/setup', params })
}

export function getAigcOneClickCleanupTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_one_click_cleanup.task/lists', params })
}

export function getAigcOneClickCleanupTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_one_click_cleanup.task/detail', params })
}

export function retryAigcOneClickCleanupTask(params: any) {
    return request.post({ url: '/app.aigc_one_click_cleanup.task/retry', params })
}

export function deleteAigcOneClickCleanupTask(params: any) {
    return request.post({ url: '/app.aigc_one_click_cleanup.task/delete', params })
}
