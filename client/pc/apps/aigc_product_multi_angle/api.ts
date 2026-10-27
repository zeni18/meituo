import { getCachedAppData } from '@/apps/cache'
export function getAigcProductMultiAngleConfig() {
    return getCachedAppData('app:aigc_product_multi_angle:config', () => $request.get({ url: '/app.aigc_product_multi_angle.config/detail' }))
}

export function getAigcProductMultiAngleViews() {
    return getCachedAppData('app:aigc_product_multi_angle:views', () => $request.get({ url: '/app.aigc_product_multi_angle.view/lists' }))
}

export function estimateAigcProductMultiAngle(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_multi_angle.generate/estimate', params }, requestOptions)
}

export function generateAigcProductMultiAngle(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_multi_angle.generate/index', params }, requestOptions)
}

export function getAigcProductMultiAngleTasks(params?: any) {
    return $request.get({ url: '/app.aigc_product_multi_angle.task/lists', params })
}

export function getAigcProductMultiAngleTask(params: any) {
    return $request.get({ url: '/app.aigc_product_multi_angle.task/detail', params })
}

export function deleteAigcProductMultiAngleTask(params: any) {
    return $request.post({ url: '/app.aigc_product_multi_angle.task/delete', params })
}

export function getAigcProductMultiAngleResults(params?: any) {
    return $request.get({ url: '/app.aigc_product_multi_angle.result/lists', params })
}

export function deleteAigcProductMultiAngleResult(params: any) {
    return $request.post({ url: '/app.aigc_product_multi_angle.result/delete', params })
}
