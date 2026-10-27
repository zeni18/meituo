import request from '@/utils/request'

export function getAigcMusicConfig() {
    return request.get({ url: '/app.aigc_music.config/detail' })
}

export function setAigcMusicConfig(params: any) {
    return request.post({ url: '/app.aigc_music.config/setup', params })
}

export function getAigcMusicTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_music.admin_task/lists', params })
}

export function getAigcMusicTaskDetail(params: any) {
    return request.get({ url: '/app.aigc_music.admin_task/detail', params })
}

export function retryAigcMusicTask(params: any) {
    return request.post({ url: '/app.aigc_music.admin_task/retry', params })
}

export function deleteAigcMusicTask(params: any) {
    return request.post({ url: '/app.aigc_music.admin_task/delete', params })
}

export function getAigcMusicAssets(params?: any) {
    return request.get({ url: '/app.aigc_music.asset/lists', params })
}

export function getAigcMusicAssetDetail(params: any) {
    return request.get({ url: '/app.aigc_music.asset/detail', params })
}

export function saveAigcMusicAsset(params: any) {
    return request.post({ url: '/app.aigc_music.asset/save', params })
}

export function setAigcMusicAssetStatus(params: any) {
    return request.post({ url: '/app.aigc_music.asset/status', params })
}

export function deleteAigcMusicAsset(params: any) {
    return request.post({ url: '/app.aigc_music.asset/delete', params })
}

export function getAigcMusicStyles(params?: any) {
    return request.get({ url: '/app.aigc_music.style/lists', params })
}

export function saveAigcMusicStyle(params: any) {
    return request.post({ url: '/app.aigc_music.style/save', params })
}

export function deleteAigcMusicStyle(params: any) {
    return request.post({ url: '/app.aigc_music.style/delete', params })
}

export function getAigcMusicPersonas(params?: any) {
    return request.get({ url: '/app.aigc_music.persona/lists', params })
}

export function getAigcMusicPersonaDetail(params: any) {
    return request.get({ url: '/app.aigc_music.persona/detail', params })
}

export function saveAigcMusicPersona(params: any) {
    return request.post({ url: '/app.aigc_music.persona/save', params })
}

export function setAigcMusicPersonaStatus(params: any) {
    return request.post({ url: '/app.aigc_music.persona/status', params })
}

export function deleteAigcMusicPersona(params: any) {
    return request.post({ url: '/app.aigc_music.persona/delete', params })
}

export function getAigcMusicVoices(params?: any) {
    return request.get({ url: '/app.aigc_music.voice/lists', params })
}

export function getAigcMusicVoiceDetail(params: any) {
    return request.get({ url: '/app.aigc_music.voice/detail', params })
}

export function saveAigcMusicVoice(params: any) {
    return request.post({ url: '/app.aigc_music.voice/save', params })
}

export function auditAigcMusicVoice(params: any) {
    return request.post({ url: '/app.aigc_music.voice/audit', params })
}

export function setAigcMusicVoiceStatus(params: any) {
    return request.post({ url: '/app.aigc_music.voice/status', params })
}

export function deleteAigcMusicVoice(params: any) {
    return request.post({ url: '/app.aigc_music.voice/delete', params })
}

export function getAigcMusicStat() {
    return request.get({ url: '/app.aigc_music.admin/stat' })
}

export function getAigcMusicChannels(params?: any) {
    return request.get({ url: '/app.aigc_music.channel/lists', params })
}

export function saveAigcMusicChannel(params: any) {
    return request.post({ url: '/app.aigc_music.channel/save', params })
}

export function batchSaveAigcMusicChannels(params: any) {
    return request.post({ url: '/app.aigc_music.channel/batchSave', params })
}

export function setAigcMusicChannelStatus(params: any) {
    return request.post({ url: '/app.aigc_music.channel/status', params })
}
