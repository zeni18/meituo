import { getCachedAppData } from '@/apps/cache'

export function getAigcPersonReplacementConfig() {
    return getCachedAppData('app:aigc_person_replacement:config', () => $request.get({ url: '/app.aigc_person_replacement.config/detail' }))
}

export function estimateAigcPersonReplacement(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_person_replacement.generate/estimate', params }, requestOptions)
}

export function generateAigcPersonReplacement(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_person_replacement.generate/index', params }, requestOptions)
}

export function getAigcPersonReplacementTasks(params?: any) {
    return $request.get({ url: '/app.aigc_person_replacement.task/lists', params })
}

export function getAigcPersonReplacementTask(params: any) {
    return $request.get({ url: '/app.aigc_person_replacement.task/detail', params })
}

export function deleteAigcPersonReplacementTask(params: any) {
    return $request.post({ url: '/app.aigc_person_replacement.task/delete', params })
}

export function deleteAigcPersonReplacementResult(params: any) {
    return $request.post({ url: '/app.aigc_person_replacement.result/delete', params })
}
