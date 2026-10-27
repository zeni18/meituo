import { getCachedAppData } from '@/apps/cache'
export function getAigcImageTranslateConfig() {
    return getCachedAppData('app:aigc_image_translate:config', () => $request.get({ url: '/app.aigc_image_translate.config/detail' }))
}

export function estimateAigcImageTranslate(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_image_translate.generate/estimate', params }, requestOptions)
}

export function generateAigcImageTranslate(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_image_translate.generate/index', params }, requestOptions)
}

export function getAigcImageTranslateTasks(params?: any) {
    return $request.get({ url: '/app.aigc_image_translate.task/lists', params })
}

export function getAigcImageTranslateTask(params: any) {
    return $request.get({ url: '/app.aigc_image_translate.task/detail', params })
}

export function deleteAigcImageTranslateTask(params: any) {
    return $request.post({ url: '/app.aigc_image_translate.task/delete', params })
}

export function getAigcImageTranslateResults(params?: any) {
    return $request.get({ url: '/app.aigc_image_translate.result/lists', params })
}

export function deleteAigcImageTranslateResult(params: any) {
    return $request.post({ url: '/app.aigc_image_translate.result/delete', params })
}
