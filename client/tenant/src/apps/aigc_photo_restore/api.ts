import request from '@/utils/request'

export function getAigcPhotoRestoreConfig() {
    return request.get({ url: '/app.aigc_photo_restore.config/detail' })
}

export function setAigcPhotoRestoreConfig(params: any) {
    return request.post({ url: '/app.aigc_photo_restore.config/setup', params })
}

export function getAigcPhotoRestoreTypes(params?: any) {
    return request.get({ url: '/app.aigc_photo_restore.restore_type/lists', params })
}

export function saveAigcPhotoRestoreType(params: any) {
    return request.post({ url: '/app.aigc_photo_restore.restore_type/save', params })
}

export function setAigcPhotoRestoreTypeStatus(params: any) {
    return request.post({ url: '/app.aigc_photo_restore.restore_type/status', params })
}

export function getAigcPhotoRestorePrice() {
    return request.get({ url: '/app.aigc_photo_restore.price/detail' })
}

export function setAigcPhotoRestorePrice(params: any) {
    return request.post({ url: '/app.aigc_photo_restore.price/setup', params })
}

export function getAigcPhotoRestoreTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_photo_restore.task/lists', params })
}

export function getAigcPhotoRestoreTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_photo_restore.task/detail', params })
}

export function retryAigcPhotoRestoreTask(params: any) {
    return request.post({ url: '/app.aigc_photo_restore.task/retry', params })
}

export function deleteAigcPhotoRestoreTask(params: any) {
    return request.post({ url: '/app.aigc_photo_restore.task/delete', params })
}

