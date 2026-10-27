import request from '@/utils/request'

export function getAigcActionTransferConfig() {
    return request.get({ url: '/app.aigc_action_transfer.config/detail' })
}

export function setAigcActionTransferConfig(params: any) {
    return request.post({ url: '/app.aigc_action_transfer.config/setup', params })
}

export function getAigcActionTransferTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_action_transfer.task/lists', params })
}

export function getAigcActionTransferTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_action_transfer.task/detail', params })
}

export function retryAigcActionTransferTask(params: any) {
    return request.post({ url: '/app.aigc_action_transfer.task/retry', params })
}

export function deleteAigcActionTransferTask(params: any) {
    return request.post({ url: '/app.aigc_action_transfer.task/delete', params })
}
