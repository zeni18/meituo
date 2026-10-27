import { getCachedAppData } from '@/apps/cache'
export function getAigcModelWearConfig() {
    return getCachedAppData('app:aigc_model_wear:config', () => $request.get({ url: '/app.aigc_model_wear.config/detail' }))
}

export function estimateAigcModelWear(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_model_wear.generate/estimate', params }, requestOptions)
}

export function generateAigcModelWear(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_model_wear.generate/index', params }, requestOptions)
}

export function getAigcModelWearTasks(params?: any) {
    return $request.get({ url: '/app.aigc_model_wear.task/lists', params })
}

export function getAigcModelWearTask(params: any) {
    return $request.get({ url: '/app.aigc_model_wear.task/detail', params })
}

export function deleteAigcModelWearTask(params: any) {
    return $request.post({ url: '/app.aigc_model_wear.task/delete', params })
}

export function getAigcModelWearResults(params?: any) {
    return $request.get({ url: '/app.aigc_model_wear.result/lists', params })
}

export function deleteAigcModelWearResult(params: any) {
    return $request.post({ url: '/app.aigc_model_wear.result/delete', params })
}
