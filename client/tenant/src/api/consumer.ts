import request from '@/utils/request'

// 用户列表
export function getUserList(params: any) {
    return request.get({ url: '/user.user/lists', params }, { ignoreCancelToken: true })
}

// 用户详情
export function getUserDetail(params: any) {
    return request.get({ url: '/user.user/detail', params })
}

// 用户编辑
export function userEdit(params: any) {
    return request.post({ url: '/user.user/edit', params })
}

// 用户编辑
export function adjustMoney(params: any) {
    return request.post({ url: '/user.user/adjustMoney', params })
}

// AI任务记录
export function getAiTaskLists(params?: any) {
    return request.get({ url: '/ai_task/lists', params }, { ignoreCancelToken: true })
}

// AI任务详情
export function getAiTaskDetail(params: any) {
    return request.get({ url: '/ai_task/detail', params })
}

// 主动查询AI任务结果
export function queryAiTaskResult(params: any) {
    return request.post({ url: '/ai_task/query', params })
}

export function aiTaskBatchAction(params: any) {
    return request.post({ url: '/ai_task/batchAction', params })
}

export function aiTaskBatchDetail(params: any) {
    return request.get({ url: '/ai_task/batchDetail', params })
}

export function aiTaskOperationLists(params?: any) {
    return request.get({ url: '/ai_task/operationLists', params })
}
