import { getCachedAppData } from '@/apps/cache'

export function getAigcActionTransferConfig() {
    return getCachedAppData('app:aigc_action_transfer:config', () => $request.get({ url: '/app.aigc_action_transfer.config/detail' }))
}

export function estimateAigcActionTransfer(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_action_transfer.generate/estimate', params }, requestOptions)
}

export function generateAigcActionTransfer(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_action_transfer.generate/index', params }, requestOptions)
}

export function getAigcActionTransferTasks(params?: any) {
    return $request.get({ url: '/app.aigc_action_transfer.task/lists', params })
}

export function getAigcActionTransferTask(params: any) {
    return $request.get({ url: '/app.aigc_action_transfer.task/detail', params })
}

export function deleteAigcActionTransferTask(params: any) {
    return $request.post({ url: '/app.aigc_action_transfer.task/delete', params })
}

export function deleteAigcActionTransferResult(params: any) {
    return $request.post({ url: '/app.aigc_action_transfer.result/delete', params })
}
