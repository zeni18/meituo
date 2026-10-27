import { TOKEN_KEY } from '@/enums/cacheEnums'
import { getStoredUserToken, useUserStore } from '@/stores/user'
import { getSseApiUrl, getVersion } from '@/utils/env'
import { parseTenantIdFromRoute } from '@/utils/tenant'

export function getShortDramaHome() {
    return $request.get({ url: '/app.aigc_short_drama.home/index' })
}

export function getShortDramaProjects(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_short_drama.project/lists', params })
}

export function getShortDramaProjectDetail(id: string | number) {
    return $request.get({ url: '/app.aigc_short_drama.project/detail', params: { id } })
}

export function renameShortDramaProject(params: { id: string | number; title: string }) {
    return $request.post({ url: '/app.aigc_short_drama.project/rename', params })
}

export function saveShortDramaProjectGenerationSettings(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.project/saveGenerationSettings', params })
}

export function getShortDramaProjectCoverOptions(id: string | number) {
    return $request.get({ url: '/app.aigc_short_drama.project/coverOptions', params: { id } })
}

export function updateShortDramaProjectCover(params: { id: string | number; asset_id: string | number }) {
    return $request.post({ url: '/app.aigc_short_drama.project/cover', params })
}

export function deleteShortDramaProject(id: string | number) {
    return $request.post({ url: '/app.aigc_short_drama.project/delete', params: { id } })
}

export function getShortDramaInspirations(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_short_drama.inspiration/lists', params })
}

export function getShortDramaSubjects(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_short_drama.subject/lists', params, retry: 0 })
}

export function getShortDramaVoices(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_short_drama.voice/lists', params, retry: 0 })
}

export function saveShortDramaSubject(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.subject/save', params })
}

export function deleteShortDramaSubject(id: string | number) {
    return $request.post({ url: '/app.aigc_short_drama.subject/delete', params: { id } })
}

export function describeShortDramaSubjectImage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.subject/describe', params })
}

export function generateShortDramaSubject(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.subject/generate', params })
}

export function getShortDramaSubjectImageHistory(subject_id: string | number) {
    return $request.get({
        url: '/app.aigc_short_drama.subject/imageHistory',
        params: { subject_id },
        retry: 0
    })
}

export function registerShortDramaSubjectImage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.subject/registerImage', params })
}

export function selectShortDramaSubjectImage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.subject/selectImage', params })
}

export function getShortDramaSubjectThreeViewHistory(subject_id: string | number) {
    return $request.get({
        url: '/app.aigc_short_drama.subject/threeViewHistory',
        params: { subject_id },
        retry: 0
    })
}

export function getShortDramaInspirationDetail(id: string | number) {
    return $request.get({ url: '/app.aigc_short_drama.inspiration/detail', params: { id } })
}

export function createShortDramaScriptPlan(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/create', params })
}

export function getShortDramaScriptPlanDetail(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_short_drama.script_plan/detail', params, retry: 0 })
}

export function saveShortDramaVisualPlan(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/saveVisualPlan', params })
}

export type ShortDramaSseEvent = {
    event: string
    data: any
}

const getCookieValue = (name: string) => {
    if (!process.client) return ''
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return match?.[1] ? decodeURIComponent(match[1]) : ''
}

const getAuthToken = () => {
    const userStore = useUserStore()
    return userStore.token || getStoredUserToken() || useCookie<string | null>(TOKEN_KEY).value || getCookieValue(TOKEN_KEY) || ''
}

export async function streamShortDramaScriptPlan(
    params: Record<string, any>,
    handlers: {
        onEvent?: (event: ShortDramaSseEvent) => void
        onError?: (error: Error) => void
        onClose?: () => void
    } = {}
) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        version: String(getVersion() || '')
    }
    const token = getAuthToken()
    if (token) {
        headers.token = token
        headers.Authorization = `Bearer ${token}`
    }
    const tenantId = parseTenantIdFromRoute()
    if (tenantId) {
        headers['tenant-id'] = tenantId
    }

    const response = await fetch(getSseApiUrl('/app.aigc_short_drama.script_plan/stream'), {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
    })
    if (!response.ok || !response.body) {
        throw new Error(`SSE连接失败：${response.status}`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/event-stream')) {
        const text = await response.text()
        try {
            const json = JSON.parse(text)
            throw new Error(json.msg || json.message || '流式接口返回异常')
        } catch (error) {
            if (error instanceof Error && error.message !== '流式接口返回异常') throw error
            throw new Error(text || '流式接口返回异常')
        }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    const parseChunk = (chunk: string) => {
        buffer += chunk
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const blocks = buffer.split(/\n\n+/)
        buffer = blocks.pop() || ''
        for (const block of blocks) {
            const lines = block.split(/\n/)
            const event = lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '').trim() || 'message'
            const dataText = lines
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.replace(/^data:\s*/, '').trimEnd())
                .join('\n')
            if (!dataText) continue
            try {
                handlers.onEvent?.({ event, data: JSON.parse(dataText) })
            } catch (error) {
                handlers.onError?.(error as Error)
            }
        }
    }

    try {
        let reading = true
        while (reading) {
            const { value, done } = await reader.read()
            if (done) {
                reading = false
            } else {
                parseChunk(decoder.decode(value, { stream: true }))
            }
        }
        parseChunk(decoder.decode())
        if (buffer.trim()) parseChunk('\n\n')
    } catch (error) {
        handlers.onError?.(error as Error)
    } finally {
        handlers.onClose?.()
    }
}

export async function streamShortDramaGeneration(
    params: Record<string, any>,
    handlers: {
        onEvent?: (event: ShortDramaSseEvent) => void
        onError?: (error: Error) => void
        onClose?: () => void
    } = {}
) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        version: String(getVersion() || '')
    }
    const token = getAuthToken()
    if (token) {
        headers.token = token
        headers.Authorization = `Bearer ${token}`
    }
    const tenantId = parseTenantIdFromRoute()
    if (tenantId) {
        headers['tenant-id'] = tenantId
    }

    const response = await fetch(getSseApiUrl('/app.aigc_short_drama.generation/stream'), {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
    })
    if (!response.ok || !response.body) {
        throw new Error(`SSE连接失败：${response.status}`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/event-stream')) {
        const text = await response.text()
        try {
            const json = JSON.parse(text)
            throw new Error(json.msg || json.message || '流式接口返回异常')
        } catch (error) {
            if (error instanceof Error && error.message !== '流式接口返回异常') throw error
            throw new Error(text || '流式接口返回异常')
        }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    const parseChunk = (chunk: string) => {
        buffer += chunk
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const blocks = buffer.split(/\n\n+/)
        buffer = blocks.pop() || ''
        for (const block of blocks) {
            const lines = block.split(/\n/)
            const event = lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '').trim() || 'message'
            const dataText = lines
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.replace(/^data:\s*/, '').trimEnd())
                .join('\n')
            if (!dataText) continue
            try {
                handlers.onEvent?.({ event, data: JSON.parse(dataText) })
            } catch (error) {
                handlers.onError?.(error as Error)
            }
        }
    }

    try {
        let reading = true
        while (reading) {
            const { value, done } = await reader.read()
            if (done) {
                reading = false
            } else {
                parseChunk(decoder.decode(value, { stream: true }))
            }
        }
        parseChunk(decoder.decode())
        if (buffer.trim()) parseChunk('\n\n')
    } catch (error) {
        handlers.onError?.(error as Error)
    } finally {
        handlers.onClose?.()
    }
}

export function saveShortDramaStoryboard(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/saveStoryboard', params })
}

export function insertShortDramaStoryboardShot(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/insertStoryboardShot', params })
}

export function copyShortDramaStoryboardShot(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/copyStoryboardShot', params })
}

export function deleteShortDramaStoryboardShot(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/deleteStoryboardShot', params })
}

export function createShortDramaGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.generation/create', params })
}

export function estimateShortDramaGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.generation/estimate', params })
}

export function getShortDramaGenerationDetail(task_id: string) {
    return $request.get({ url: '/app.aigc_short_drama.generation/detail', params: { task_id }, retry: 0 })
}

export function getShortDramaGenerationLists(params: Record<string, any> = {}) {
    return $request.get(
        { url: '/app.aigc_short_drama.generation/lists', params, retry: 0 },
        { suppressErrorMessage: true }
    )
}

export function retryShortDramaGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.generation/retry', params })
}

export function deleteShortDramaGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.generation/delete', params })
}

export function createShortDramaExportVideo(params: Record<string, any>) {
    return createShortDramaGeneration({
        ...params,
        task_type: 'export_video'
    })
}

export function createShortDramaExportPackage(params: Record<string, any>) {
    return createShortDramaGeneration({
        ...params,
        task_type: 'export_package'
    })
}

export function getShortDramaAssets(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_short_drama.asset/lists', params, retry: 0 })
}

export function registerShortDramaAsset(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.asset/register', params })
}

export function deleteShortDramaAsset(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.asset/delete', params })
}

export function extractShortDramaVideoLastFrame(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.asset/extractVideoLastFrame', params })
}

export function selectShortDramaStoryboardAsset(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.asset/select', params })
}

export function publishShortDramaProject(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.project/publish', params })
}

export function sendShortDramaScriptMessage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/message', params })
}

export function retryShortDramaScriptPlan(task_id: string) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/retry', params: { task_id } })
}

export function cancelShortDramaScriptPlan(task_id: string) {
    return $request.post({ url: '/app.aigc_short_drama.script_plan/cancel', params: { task_id } })
}
