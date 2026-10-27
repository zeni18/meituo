import request from '@/utils/request'

export function getCustomerServiceConfig() {
    return request.get({ url: '/setting.customer_service/getConfig' })
}

export function setCustomerServiceConfig(params: any) {
    return request.post({ url: '/setting.customer_service/setConfig', params })
}

export function getPcFeedbackLists(params?: any) {
    return request.get({ url: '/setting.pc_feedback/lists', params })
}

export function replyPcFeedback(params: any) {
    return request.post({ url: '/setting.pc_feedback/reply', params })
}
