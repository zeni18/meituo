import { getCachedAppData } from '@/apps/cache'
export function getAigcOutpaintConfig() {
    return getCachedAppData('app:aigc_outpaint:config', () => $request.get({ url: '/app.aigc_outpaint.config/detail' }))
}

export function estimateAigcOutpaint(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_outpaint.generate/estimate', params }, requestOptions)
}

export function generateAigcOutpaint(params: any, requestOptions?: any) {
    return $request.post({
        url: '/app.aigc_outpaint.generate/index',
        params,
        timeout: 120 * 1000,
        retry: 0
    }, requestOptions)
}

export function getAigcOutpaintTasks(params?: any) {
    return $request.get({ url: '/app.aigc_outpaint.task/lists', params })
}

export function getAigcOutpaintTask(params: any) {
    return $request.get({ url: '/app.aigc_outpaint.task/detail', params })
}

export function deleteAigcOutpaintTask(params: any) {
    return $request.post({ url: '/app.aigc_outpaint.task/delete', params })
}

export function getAigcOutpaintResults(params?: any) {
    return $request.get({ url: '/app.aigc_outpaint.result/lists', params })
}

export function deleteAigcOutpaintResult(params: any) {
    return $request.post({ url: '/app.aigc_outpaint.result/delete', params })
}
