export function getPcNoticeLists(params: Record<string, any> = {}) {
    return $request.get({ url: '/notice/lists', params })
}

export function getPcNoticeDetail(params: Record<string, any>) {
    return $request.get({ url: '/notice/detail', params })
}

export function readPcNotice(params: Record<string, any>) {
    return $request.post({ url: '/notice/read', params })
}

export function getPcNoticeUnread() {
    return $request.get({ url: '/notice/unread' })
}

export function getPcNoticePopup() {
    return $request.get({ url: '/notice/popup' })
}
