import { getCachedAppData } from '@/apps/cache'
export function getAigcPhotoRestoreConfig() {
    return getCachedAppData('app:aigc_photo_restore:config', () => $request.get({ url: '/app.aigc_photo_restore.config/detail' }))
}

export function getAigcPhotoRestoreTypes(params?: any) {
    return getCachedAppData('app:aigc_photo_restore:types', () => $request.get({ url: '/app.aigc_photo_restore.restore_type/lists', params }), params)
}

export function estimateAigcPhotoRestore(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_photo_restore.generate/estimate', params }, requestOptions)
}

export function generateAigcPhotoRestore(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_photo_restore.generate/index', params }, requestOptions)
}

export function getAigcPhotoRestoreTasks(params?: any) {
    return $request.get({ url: '/app.aigc_photo_restore.task/lists', params })
}

export function getAigcPhotoRestoreTask(params: any) {
    return $request.get({ url: '/app.aigc_photo_restore.task/detail', params })
}

export function deleteAigcPhotoRestoreTask(params: any) {
    return $request.post({ url: '/app.aigc_photo_restore.task/delete', params })
}

export function getAigcPhotoRestoreResults(params?: any) {
    return $request.get({ url: '/app.aigc_photo_restore.result/lists', params })
}

export function deleteAigcPhotoRestoreResult(params: any) {
    return $request.post({ url: '/app.aigc_photo_restore.result/delete', params })
}

