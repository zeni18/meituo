import { getCachedAppData } from '@/apps/cache'
export function getAigcHairstyleConfig() {
    return getCachedAppData('app:aigc_hairstyle:config', () => $request.get({ url: '/app.aigc_hairstyle.config/detail' }))
}

export function estimateAigcHairstyle(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_hairstyle.generate/estimate', params }, requestOptions)
}

export function generateAigcHairstyle(params: any, requestOptions?: any) {
    return $request.post({
        url: '/app.aigc_hairstyle.generate/index',
        params,
        timeout: 120 * 1000,
        retry: 0
    }, requestOptions)
}

export function getAigcHairstyleTask(params: any) {
    return $request.get({ url: '/app.aigc_hairstyle.task/detail', params })
}

export function getAigcHairstyleTasks(params?: any) {
    return $request.get({ url: '/app.aigc_hairstyle.task/lists', params })
}

export function deleteAigcHairstyleTask(params: any) {
    return $request.post({ url: '/app.aigc_hairstyle.task/delete', params })
}

export function getAigcHairstyleResults(params?: any) {
    return $request.get({ url: '/app.aigc_hairstyle.result/lists', params })
}
