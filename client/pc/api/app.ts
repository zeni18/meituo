import type { RequestOptions } from 'ofetch'

//发送短信
export function smsSend(params: any) {
    return $request.post({ url: '/sms/sendCode', params }, { withToken: false })
}

// 获取配置
export function getConfig(params?: Record<string, any>) {
    return $request.get({ url: '/pc/config', params, retry: 0 })
}

// 获取协议
export function getPolicy(params: any) {
    return $request.get({ url: '/index/policy', params })
}

// 上传图片
export function uploadImage(params: any) {
    return $request.uploadFile({ url: '/upload/image', retry: 0, timeout: 120000 }, params)
}

export function uploadPcFeedbackImage(params: any) {
    return $request.uploadFile(
        { url: '/pc_feedback/uploadImage', retry: 0, timeout: 120000 },
        params,
        { withToken: false }
    )
}

// 上传文件
export function uploadFile(params: any) {
    return $request.uploadFile({ url: '/upload/file', retry: 0, timeout: 120000 }, params)
}

// 上传视频
export function uploadVideo(params: any) {
    return $request.uploadFile({ url: '/upload/video', retry: 0, timeout: 180000 }, params)
}

export function getAppFrontend(params?: any, requestOptions?: Partial<RequestOptions>) {
    return $request.get({ url: '/app/frontend', params }, requestOptions)
}

export function submitPcFeedback(params: Record<string, any>) {
    return $request.post({ url: '/pc_feedback/submit', params }, { withToken: false })
}

export function getPcFeedbackLists(params?: Record<string, any>) {
    return $request.get({ url: '/pc_feedback/lists', params })
}
