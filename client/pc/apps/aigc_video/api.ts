import { getCachedAppData } from '@/apps/cache'
export function getAigcVideoConfig() {
    return $request.get({ url: '/app.aigc_video.config/detail' })
}

export function getAigcVideoCases(params?: any, requestOptions?: any) {
    return getCachedAppData('app:aigc_video:cases', () => $request.get({ url: '/app.aigc_video.case/lists', params }, requestOptions), params)
}

export function generateAigcVideo(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_video.generate/index', params }, requestOptions)
}

export function estimateAigcVideo(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_video.generate/estimate', params }, requestOptions)
}

export function getAigcVideoTasks(params?: any) {
    return $request.get({ url: '/app.aigc_video.task/lists', params })
}

export function getAigcVideoTask(params: any) {
    return $request.get({ url: '/app.aigc_video.task/detail', params })
}

export function getAigcVideoResults(params?: any) {
    return $request.get({ url: '/app.aigc_video.result/lists', params })
}

export function deleteAigcVideoResult(params: any) {
    return $request.post({ url: '/app.aigc_video.result/delete', params })
}
