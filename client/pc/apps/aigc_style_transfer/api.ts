import { getCachedAppData } from '@/apps/cache'
export function getAigcStyleTransferConfig() {
    return getCachedAppData('app:aigc_style_transfer:config', () => $request.get({ url: '/app.aigc_style_transfer.config/detail' }))
}

export function getAigcStyleTransferCategories(params?: any) {
    return getCachedAppData('app:aigc_style_transfer:categories', () => $request.get({ url: '/app.aigc_style_transfer.style_category/lists', params }), params)
}

export function getAigcStyleTransferTemplates(params?: any) {
    return getCachedAppData('app:aigc_style_transfer:templates', () => $request.get({ url: '/app.aigc_style_transfer.style_template/lists', params }), params)
}

export function estimateAigcStyleTransfer(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_style_transfer.generate/estimate', params }, requestOptions)
}

export function generateAigcStyleTransfer(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_style_transfer.generate/index', params }, requestOptions)
}

export function getAigcStyleTransferTasks(params?: any) {
    return $request.get({ url: '/app.aigc_style_transfer.task/lists', params })
}

export function getAigcStyleTransferTask(params: any) {
    return $request.get({ url: '/app.aigc_style_transfer.task/detail', params })
}

export function deleteAigcStyleTransferTask(params: any) {
    return $request.post({ url: '/app.aigc_style_transfer.task/delete', params })
}

export function getAigcStyleTransferResults(params?: any) {
    return $request.get({ url: '/app.aigc_style_transfer.result/lists', params })
}

export function deleteAigcStyleTransferResult(params: any) {
    return $request.post({ url: '/app.aigc_style_transfer.result/delete', params })
}
