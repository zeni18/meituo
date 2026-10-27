import { getCachedAppData } from '@/apps/cache'
export function getAigcImageConfig() {
    return getCachedAppData('app:aigc_image:config', () => $request.get({ url: '/app.aigc_image.config/detail' }))
}

export function getAigcImageCases(params?: any, requestOptions?: any) {
    return getCachedAppData('app:aigc_image:cases', () => $request.get({ url: '/app.aigc_image.case/lists', params }, requestOptions), params)
}

export function generateAigcImage(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_image.generate/index', params }, requestOptions)
}

export function estimateAigcImage(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_image.generate/estimate', params }, requestOptions)
}

export function getAigcImageTasks(params?: any) {
    return $request.get({ url: '/app.aigc_image.task/lists', params })
}

export function getAigcImageTask(params: any) {
    return $request.get({ url: '/app.aigc_image.task/detail', params })
}

export function getAigcImageResults(params?: any) {
    return $request.get({ url: '/app.aigc_image.result/lists', params })
}

export function deleteAigcImageResult(params: any) {
    return $request.post({ url: '/app.aigc_image.result/delete', params })
}
