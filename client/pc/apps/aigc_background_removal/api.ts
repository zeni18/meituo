import { getCachedAppData } from '@/apps/cache'
export function getAigcBackgroundRemovalConfig() {
    return getCachedAppData('app:aigc_background_removal:config', () => $request.get({ url: '/app.aigc_background_removal.config/detail' }))
}

export function estimateAigcBackgroundRemoval(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_background_removal.generate/estimate', params }, requestOptions)
}

export function generateAigcBackgroundRemoval(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_background_removal.generate/index', params }, requestOptions)
}

export function getAigcBackgroundRemovalTasks(params?: any) {
    return $request.get({ url: '/app.aigc_background_removal.task/lists', params })
}

export function getAigcBackgroundRemovalTask(params: any) {
    return $request.get({ url: '/app.aigc_background_removal.task/detail', params })
}

export function deleteAigcBackgroundRemovalTask(params: any) {
    return $request.post({ url: '/app.aigc_background_removal.task/delete', params })
}

export function getAigcBackgroundRemovalResults(params?: any) {
    return $request.get({ url: '/app.aigc_background_removal.result/lists', params })
}

export function deleteAigcBackgroundRemovalResult(params: any) {
    return $request.post({ url: '/app.aigc_background_removal.result/delete', params })
}
