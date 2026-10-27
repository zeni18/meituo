import { getCachedAppData } from '@/apps/cache'
export function getAigcProductSuiteConfig() {
    return getCachedAppData('app:aigc_product_suite:config', () => $request.get({ url: '/app.aigc_product_suite.config/detail' }))
}

export function getAigcProductSuiteModules() {
    return getCachedAppData('app:aigc_product_suite:modules', () => $request.get({ url: '/app.aigc_product_suite.module/lists' }))
}

export function optimizeAigcProductSuitePrompt(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_suite.prompt/optimize', params }, requestOptions)
}

export function estimateAigcProductSuite(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_suite.generate/estimate', params }, requestOptions)
}

export function generateAigcProductSuite(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_suite.generate/index', params }, requestOptions)
}

export function getAigcProductSuiteTasks(params?: any) {
    return $request.get({ url: '/app.aigc_product_suite.task/lists', params })
}

export function getAigcProductSuiteTask(params: any) {
    return $request.get({ url: '/app.aigc_product_suite.task/detail', params })
}

export function deleteAigcProductSuiteTask(params: any) {
    return $request.post({ url: '/app.aigc_product_suite.task/delete', params })
}

export function getAigcProductSuiteResults(params?: any) {
    return $request.get({ url: '/app.aigc_product_suite.result/lists', params })
}

export function deleteAigcProductSuiteResult(params: any) {
    return $request.post({ url: '/app.aigc_product_suite.result/delete', params })
}
