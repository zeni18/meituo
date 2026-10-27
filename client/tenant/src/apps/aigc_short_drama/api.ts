import request from '@/utils/request'

export function getAigcShortDramaConfig() {
    return request.get({ url: '/app.aigc_short_drama.config/detail' })
}

export function setAigcShortDramaConfig(params: any) {
    return request.post({ url: '/app.aigc_short_drama.config/setup', params })
}

export function getAigcShortDramaProjectLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.project/lists', params })
}

export function getAigcShortDramaScriptTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.script_task/lists', params })
}

export function getAigcShortDramaSubjectTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.subject_task/lists', params })
}

export function getAigcShortDramaSceneTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.scene_task/lists', params })
}

export function getAigcShortDramaStoryboardLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.storyboard/lists', params })
}

export function getAigcShortDramaGenerationTaskLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.generation_task/lists', params })
}

export function getAigcShortDramaGenerationTaskDetail(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.generation_task/detail', params })
}

export function getAigcShortDramaInspirationLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.inspiration/lists', params })
}

export function saveAigcShortDramaInspiration(params: any) {
    return request.post({ url: '/app.aigc_short_drama.inspiration/save', params })
}

export function setAigcShortDramaInspirationStatus(params: any) {
    return request.post({ url: '/app.aigc_short_drama.inspiration/status', params })
}

export function deleteAigcShortDramaInspiration(params: any) {
    return request.post({ url: '/app.aigc_short_drama.inspiration/delete', params })
}

export function getAigcShortDramaSubjectLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.subject/lists', params })
}

export function saveAigcShortDramaSubject(params: any) {
    return request.post({ url: '/app.aigc_short_drama.subject/save', params })
}

export function setAigcShortDramaSubjectStatus(params: any) {
    return request.post({ url: '/app.aigc_short_drama.subject/status', params })
}

export function deleteAigcShortDramaSubject(params: any) {
    return request.post({ url: '/app.aigc_short_drama.subject/delete', params })
}

export function getAigcShortDramaStyleLists(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.style/lists', params })
}

export function saveAigcShortDramaStyle(params: any) {
    return request.post({ url: '/app.aigc_short_drama.style/save', params })
}

export function setAigcShortDramaStyleStatus(params: any) {
    return request.post({ url: '/app.aigc_short_drama.style/status', params })
}

export function deleteAigcShortDramaStyle(params: any) {
    return request.post({ url: '/app.aigc_short_drama.style/delete', params })
}

export function getAigcShortDramaPublicVoices(params?: any) {
    return request.get({ url: '/app.aigc_short_drama.public_voice/lists', params })
}

export function saveAigcShortDramaPublicVoice(params: any) {
    return request.post({ url: '/app.aigc_short_drama.public_voice/save', params })
}

export function deleteAigcShortDramaPublicVoice(params: any) {
    return request.post({ url: '/app.aigc_short_drama.public_voice/delete', params })
}
