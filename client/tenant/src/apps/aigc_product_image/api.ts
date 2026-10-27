import request from '@/utils/request'

export function getAigcProductImageConfig() {
    return request.get({ url: '/app.aigc_product_image.config/detail' })
}

export function setAigcProductImageConfig(params: any) {
    return request.post({ url: '/app.aigc_product_image.config/setup', params })
}

export function getAigcProductImageCategories(params?: any) {
    return request.get({ url: '/app.aigc_product_image.scene_category/lists', params })
}

export function saveAigcProductImageCategory(params: any) {
    return request.post({ url: '/app.aigc_product_image.scene_category/save', params })
}

export function setAigcProductImageCategoryStatus(params: any) {
    return request.post({ url: '/app.aigc_product_image.scene_category/status', params })
}

export function deleteAigcProductImageCategory(params: any) {
    return request.post({ url: '/app.aigc_product_image.scene_category/delete', params })
}

export function getAigcProductImageTemplates(params?: any) {
    return request.get({ url: '/app.aigc_product_image.scene_template/lists', params })
}

export function getAigcProductImageTemplateDetail(params: any) {
    return request.get({ url: '/app.aigc_product_image.scene_template/detail', params })
}

export function saveAigcProductImageTemplate(params: any) {
    return request.post({ url: '/app.aigc_product_image.scene_template/save', params })
}

export function setAigcProductImageTemplateStatus(params: any) {
    return request.post({ url: '/app.aigc_product_image.scene_template/status', params })
}

export function deleteAigcProductImageTemplate(params: any) {
    return request.post({ url: '/app.aigc_product_image.scene_template/delete', params })
}

export function getAigcProductImageTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_product_image.task/lists', params })
}

export function getAigcProductImageTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_product_image.task/detail', params })
}

export function retryAigcProductImageTask(params: any) {
    return request.post({ url: '/app.aigc_product_image.task/retry', params })
}

export function deleteAigcProductImageTask(params: any) {
    return request.post({ url: '/app.aigc_product_image.task/delete', params })
}

