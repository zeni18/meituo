import request from '@/utils/request'

// 通知设置列表
export function noticeLists(params: any) {
    return request.get({ url: '/notice.notice/settingLists', params })
}

// 通知设置详情
export function noticeDetail(params: any) {
    return request.get({ url: '/notice.notice/detail', params })
}

// 通知设置保存
export function setNoticeConfig(params: any) {
    return request.post({ url: '/notice.notice/set', params })
}

// 短信设置列表
export function smsLists() {
    return request.get({ url: '/notice.sms_config/getConfig' })
}

// 短信设置详情
export function smsDetail(params: any) {
    return request.get({ url: '/notice.sms_config/detail', params })
}

// 短信设置保存
export function setSmsConfig(params: any) {
    return request.post({ url: '/notice.sms_config/setConfig', params })
}

// PC消息公告列表
export function pcNoticeLists(params: any) {
    return request.get({ url: '/notice.pc_notice/lists', params })
}

// PC消息公告详情
export function pcNoticeDetail(params: any) {
    return request.get({ url: '/notice.pc_notice/detail', params })
}

// 新增PC消息公告
export function pcNoticeAdd(params: any) {
    return request.post({ url: '/notice.pc_notice/add', params })
}

// 编辑PC消息公告
export function pcNoticeEdit(params: any) {
    return request.post({ url: '/notice.pc_notice/edit', params })
}

// 删除PC消息公告
export function pcNoticeDelete(params: any) {
    return request.post({ url: '/notice.pc_notice/delete', params })
}

// PC消息公告状态
export function pcNoticeStatus(params: any) {
    return request.post({ url: '/notice.pc_notice/status', params })
}
