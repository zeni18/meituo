import { getCachedAppData } from '@/apps/cache'
export function getAigcFittingConfig() {
    return getCachedAppData('app:aigc_fitting:config', () => $request.get({ url: '/app.aigc_fitting.config/detail' }))
}

export function estimateAigcFitting(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_fitting.generate/estimate', params }, requestOptions)
}

export function generateAigcFitting(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_fitting.generate/index', params }, requestOptions)
}

export function getAigcFittingTask(params: any) {
    return $request.get({ url: '/app.aigc_fitting.task/detail', params })
}

export function getAigcFittingTasks(params?: any) {
    return $request.get({ url: '/app.aigc_fitting.task/lists', params })
}

export function deleteAigcFittingTask(params: any) {
    return $request.post({ url: '/app.aigc_fitting.task/delete', params })
}

export function getAigcFittingResults(params?: any) {
    return $request.get({ url: '/app.aigc_fitting.result/lists', params })
}

export function deleteAigcFittingResult(params: any) {
    return $request.post({ url: '/app.aigc_fitting.result/delete', params })
}
