import request from '@/utils/request'

export function getCaseGalleryApps() {
    return request.get({ url: '/case_gallery.case/apps' })
}

export function getCaseGalleryCases(params?: any) {
    return request.get({ url: '/case_gallery.case/lists', params })
}

export function getCaseGalleryCaseDetail(params: any) {
    return request.get({ url: '/case_gallery.case/detail', params })
}

export function saveCaseGalleryCase(params: any) {
    return request.post({ url: '/case_gallery.case/save', params })
}

export function createCaseGalleryCaseFromTask(params: any) {
    return request.post({ url: '/case_gallery.case/fromTask', params })
}

export function setCaseGalleryCaseStatus(params: any) {
    return request.post({ url: '/case_gallery.case/status', params })
}

export function deleteCaseGalleryCase(params: any) {
    return request.post({ url: '/case_gallery.case/delete', params })
}
