import { getCachedAppData } from '@/apps/cache'
export function getAigcOneClickCleanupConfig() {
    return getCachedAppData('app:aigc_one_click_cleanup:config', () => $request.get({ url: '/app.aigc_one_click_cleanup.config/detail' }))
}

export function getAigcOneClickCleanupOptions() {
    return getCachedAppData('app:aigc_one_click_cleanup:options', () => $request.get({ url: '/app.aigc_one_click_cleanup.option/lists' }))
}

export function estimateAigcOneClickCleanup(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_one_click_cleanup.generate/estimate', params }, requestOptions)
}

export function generateAigcOneClickCleanup(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_one_click_cleanup.generate/index', params }, requestOptions)
}

export function getAigcOneClickCleanupTasks(params?: any) {
    return $request.get({ url: '/app.aigc_one_click_cleanup.task/lists', params })
}

export function getAigcOneClickCleanupTask(params: any) {
    return $request.get({ url: '/app.aigc_one_click_cleanup.task/detail', params })
}

export function deleteAigcOneClickCleanupTask(params: any) {
    return $request.post({ url: '/app.aigc_one_click_cleanup.task/delete', params })
}

export function getAigcOneClickCleanupResults(params?: any) {
    return $request.get({ url: '/app.aigc_one_click_cleanup.result/lists', params })
}

export function deleteAigcOneClickCleanupResult(params: any) {
    return $request.post({ url: '/app.aigc_one_click_cleanup.result/delete', params })
}
