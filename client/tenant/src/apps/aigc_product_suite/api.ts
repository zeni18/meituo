import request from '@/utils/request'

export function getAigcProductSuiteConfig() {
    return request.get({ url: '/app.aigc_product_suite.config/detail' })
}

export function setAigcProductSuiteConfig(params: any) {
    return request.post({ url: '/app.aigc_product_suite.config/setup', params })
}

export function getAigcProductSuiteModules() {
    return request.get({ url: '/app.aigc_product_suite.module/lists' })
}

export function saveAigcProductSuiteModule(params: any) {
    return request.post({ url: '/app.aigc_product_suite.module/save', params })
}

export function setAigcProductSuiteModuleStatus(params: any) {
    return request.post({ url: '/app.aigc_product_suite.module/status', params })
}

export function deleteAigcProductSuiteModule(params: any) {
    return request.post({ url: '/app.aigc_product_suite.module/delete', params })
}

export function getAigcProductSuitePrice() {
    return request.get({ url: '/app.aigc_product_suite.price/detail' })
}

export function setAigcProductSuitePrice(params: any) {
    return request.post({ url: '/app.aigc_product_suite.price/setup', params })
}

export function getAigcProductSuiteTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_product_suite.task/lists', params })
}

export function getAigcProductSuiteTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_product_suite.task/detail', params })
}

export function retryAigcProductSuiteTask(params: any) {
    return request.post({ url: '/app.aigc_product_suite.task/retry', params })
}

export function deleteAigcProductSuiteTask(params: any) {
    return request.post({ url: '/app.aigc_product_suite.task/delete', params })
}
