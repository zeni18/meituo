import { getCachedAppData } from '@/apps/cache'

export function getAigcMusicConfig() {
    return getCachedAppData('app:aigc_music:config', () => $request.get({ url: '/app.aigc_music.config/detail' }))
}

export function getAigcMusicPersonas(params?: any, requestOptions?: any) {
    return getCachedAppData('app:aigc_music:personas', () => $request.get({ url: '/app.aigc_music.persona/lists', params }, requestOptions), params)
}

export function getAigcMusicVoices(params?: any, requestOptions?: any) {
    return getCachedAppData('app:aigc_music:voices', () => $request.get({ url: '/app.aigc_music.voice/lists', params }, requestOptions), params)
}

export function estimateAigcMusic(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_music.generate/estimate', params }, requestOptions)
}

export function generateAigcMusic(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_music.generate/index', params }, requestOptions)
}

export function createAigcMusicLyrics(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_music.lyrics/index', params }, requestOptions)
}

export function uploadAigcMusicAudio(params: any, requestOptions?: any) {
    return $request.uploadFile({ url: '/app.aigc_music.asset/upload_audio', retry: 0, timeout: 180000 }, params, requestOptions)
}

export function getAigcMusicTasks(params?: any, requestOptions?: any) {
    return $request.get({ url: '/app.aigc_music.task/lists', params }, requestOptions)
}

export function getAigcMusicTask(params: any, requestOptions?: any) {
    return $request.get({ url: '/app.aigc_music.task/detail', params }, requestOptions)
}

export function deleteAigcMusicTask(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_music.task/delete', params }, requestOptions)
}

export function getAigcMusicResults(params?: any, requestOptions?: any) {
    return $request.get({ url: '/app.aigc_music.result/lists', params }, requestOptions)
}

export function deleteAigcMusicResult(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_music.result/delete', params }, requestOptions)
}
