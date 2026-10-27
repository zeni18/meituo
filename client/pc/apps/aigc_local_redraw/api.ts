import { getCachedAppData } from '@/apps/cache'
export function getAigcLocalRedrawConfig() {
    return getCachedAppData('app:aigc_local_redraw:config', () => $request.get({ url: '/app.aigc_local_redraw.config/detail' }))
}

export function estimateAigcLocalRedraw(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_local_redraw.generate/estimate', params }, requestOptions)
}

export function generateAigcLocalRedraw(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_local_redraw.generate/index', params }, requestOptions)
}

export function getAigcLocalRedrawTasks(params?: any) {
    return $request.get({ url: '/app.aigc_local_redraw.task/lists', params })
}

export function getAigcLocalRedrawTask(params: any) {
    return $request.get({ url: '/app.aigc_local_redraw.task/detail', params })
}

export function deleteAigcLocalRedrawTask(params: any) {
    return $request.post({ url: '/app.aigc_local_redraw.task/delete', params })
}

export function getAigcLocalRedrawResults(params?: any) {
    return $request.get({ url: '/app.aigc_local_redraw.result/lists', params })
}

export function deleteAigcLocalRedrawResult(params: any) {
    return $request.post({ url: '/app.aigc_local_redraw.result/delete', params })
}
