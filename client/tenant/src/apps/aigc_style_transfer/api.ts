import request from '@/utils/request'

export function getAigcStyleTransferConfig() {
    return request.get({ url: '/app.aigc_style_transfer.config/detail' })
}

export function setAigcStyleTransferConfig(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.config/setup', params })
}

export function getAigcStyleTransferPrice() {
    return request.get({ url: '/app.aigc_style_transfer.price/detail' })
}

export function setAigcStyleTransferPrice(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.price/setup', params })
}

export function getAigcStyleTransferCategories(params?: any) {
    return request.get({ url: '/app.aigc_style_transfer.style_category/lists', params })
}

export function saveAigcStyleTransferCategory(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.style_category/save', params })
}

export function setAigcStyleTransferCategoryStatus(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.style_category/status', params })
}

export function deleteAigcStyleTransferCategory(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.style_category/delete', params })
}

export function getAigcStyleTransferTemplates(params?: any) {
    return request.get({ url: '/app.aigc_style_transfer.style_template/lists', params })
}

export function getAigcStyleTransferTemplateDetail(params: any) {
    return request.get({ url: '/app.aigc_style_transfer.style_template/detail', params })
}

export function saveAigcStyleTransferTemplate(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.style_template/save', params })
}

export function setAigcStyleTransferTemplateStatus(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.style_template/status', params })
}

export function deleteAigcStyleTransferTemplate(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.style_template/delete', params })
}

export function getAigcStyleTransferTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_style_transfer.task/lists', params })
}

export function getAigcStyleTransferTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_style_transfer.task/detail', params })
}

export function retryAigcStyleTransferTask(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.task/retry', params })
}

export function deleteAigcStyleTransferTask(params: any) {
    return request.post({ url: '/app.aigc_style_transfer.task/delete', params })
}
