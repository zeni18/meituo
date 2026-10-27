import request from '@/utils/request'

export function getAigcMusicTenantStat(params?: any) {
    return request.get({ url: '/app.aigc_music.tenant/stat', params })
}

export function getAigcMusicChannels() {
    return request.get({ url: '/app.aigc_music.channel/lists' })
}

export function saveAigcMusicChannel(params: any) {
    return request.post({ url: '/app.aigc_music.channel/save', params })
}

export function setAigcMusicChannelStatus(params: any) {
    return request.post({ url: '/app.aigc_music.channel/status', params })
}

export function getAigcMusicSpecs() {
    return request.get({ url: '/app.aigc_music.spec/lists' })
}

export function batchSaveAigcMusicSpecs(params: any) {
    return request.post({ url: '/app.aigc_music.spec/batchSave', params })
}

export function setAigcMusicSpecStatus(params: any) {
    return request.post({ url: '/app.aigc_music.spec/status', params })
}

export function getAigcMusicTaskLogs(params?: any) {
    return request.get({ url: '/app.aigc_music.task/lists', params })
}

export function getAigcMusicTaskLogDetail(params: any) {
    return request.get({ url: '/app.aigc_music.task/detail', params })
}
