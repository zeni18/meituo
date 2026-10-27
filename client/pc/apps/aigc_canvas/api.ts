import { getCachedAppData } from '@/apps/cache'
import { TOKEN_KEY } from '@/enums/cacheEnums'
import { useUserStore } from '@/stores/user'
import { getSseApiUrl, getVersion } from '@/utils/env'
import { parseTenantIdFromRoute } from '@/utils/tenant'

export function getAigcCanvasConfig() {
    return getCachedAppData('app:aigc_canvas:config', () =>
        $request.get({ url: '/app.aigc_canvas.config/detail' })
    )
}

export function getCanvasRunLists(params?: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.run/lists', params })
}

export function getCanvasProjectLists(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_canvas.project/lists', params })
}

export function createCanvasProjectRemote(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.project/create', params })
}

export function getCanvasProjectDetail(id: string | number) {
    return $request.get({ url: '/app.aigc_canvas.project/detail', params: { id } })
}

export function saveCanvasProjectRemote(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.project/save', params })
}

export function renameCanvasProjectRemote(params: { id: string | number; name: string }) {
    return $request.post({ url: '/app.aigc_canvas.project/rename', params })
}

export function duplicateCanvasProjectRemote(id: string | number) {
    return $request.post({ url: '/app.aigc_canvas.project/duplicate', params: { id } })
}

export function deleteCanvasProjectRemote(id: string | number) {
    return $request.post({ url: '/app.aigc_canvas.project/delete', params: { id } })
}

export async function proxyChat(params: Record<string, any>) {
    return $request.post({
        url: '/app.aigc_canvas.generate/text',
        params
    })
}

export type CanvasTextStreamEvent = {
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
    return (
        userStore.token ||
        useCookie<string | null>(TOKEN_KEY).value ||
        getCookieValue(TOKEN_KEY) ||
        ''
    )
}

export async function streamCanvasText(
    params: Record<string, any>,
    handlers: {
        onEvent?: (event: CanvasTextStreamEvent) => void
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

    const response = await fetch(getSseApiUrl('/app.aigc_canvas.generate/textStream'), {
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
            const event =
                lines
                    .find((line) => line.startsWith('event:'))
                    ?.replace(/^event:\s*/, '')
                    .trim() || 'message'
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
        if (buffer.trim()) {
            parseChunk('\n\n')
        }
    } catch (error) {
        handlers.onError?.(error as Error)
    } finally {
        handlers.onClose?.()
    }
}

async function streamCanvasEndpoint(
    endpoint: string,
    params: Record<string, any>,
    handlers: {
        onEvent?: (event: CanvasTextStreamEvent) => void
        onError?: (error: Error) => void
        onClose?: () => void
        signal?: AbortSignal
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

    const response = await fetch(getSseApiUrl(endpoint), {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal: handlers.signal
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
            const event =
                lines
                    .find((line) => line.startsWith('event:'))
                    ?.replace(/^event:\s*/, '')
                    .trim() || 'message'
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
        if (!handlers.signal?.aborted) handlers.onError?.(error as Error)
    } finally {
        handlers.onClose?.()
    }
}

export function createCanvasScriptAgent(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/scriptPlan', params })
}

export function getCanvasScriptAgentDetail(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent/scriptDetail', params, retry: 0 })
}

export function streamCanvasScriptAgent(
    params: Record<string, any>,
    handlers: {
        onEvent?: (event: CanvasTextStreamEvent) => void
        onError?: (error: Error) => void
        onClose?: () => void
    } = {}
) {
    return streamCanvasEndpoint('/app.aigc_canvas.agent/scriptStream', params, handlers)
}

export function getCanvasAgentSubjects(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_canvas.agent/subjects', params, retry: 0 })
}

export function saveCanvasAgentSubject(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/subjectSave', params })
}

export function describeCanvasAgentSubject(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/subjectDescribe', params })
}

export function generateCanvasAgentSubject(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/subjectGenerate', params })
}

export function getCanvasAgentSubjectImageHistory(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent/subjectImageHistory', params, retry: 0 })
}

export function registerCanvasAgentSubjectImage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/subjectRegisterImage', params })
}

export function selectCanvasAgentSubjectImage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/subjectSelectImage', params })
}

export function getCanvasAgentSubjectThreeViewHistory(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent/subjectThreeViewHistory', params, retry: 0 })
}

export function saveCanvasAgentStoryboard(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/storyboardSave', params })
}

export function saveCanvasAgentVisualPlan(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/visualPlanSave', params })
}

export function insertCanvasAgentStoryboardShot(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/storyboardInsert', params })
}

export function copyCanvasAgentStoryboardShot(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/storyboardCopy', params })
}

export function deleteCanvasAgentStoryboardShot(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/storyboardDelete', params })
}

export function estimateCanvasAgentGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/generationEstimate', params })
}

export function createCanvasAgentGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/generation', params })
}

export function getCanvasAgentGenerationDetail(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent/generationDetail', params, retry: 0 })
}

export function getCanvasAgentGenerationLists(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_canvas.agent/generationLists', params, retry: 0 })
}

export function retryCanvasAgentGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/generationRetry', params })
}

export function cancelCanvasAgentGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/generationCancel', params })
}

export function deleteCanvasAgentGeneration(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/generationDelete', params })
}

export function streamCanvasAgentGeneration(
    params: Record<string, any>,
    handlers: {
        onEvent?: (event: CanvasTextStreamEvent) => void
        onError?: (error: Error) => void
        onClose?: () => void
    } = {}
) {
    return streamCanvasEndpoint('/app.aigc_canvas.agent/generationStream', params, handlers)
}

export function registerCanvasAgentAsset(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/assetRegister', params })
}

export function selectCanvasAgentAsset(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/assetSelect', params })
}

export function sendCanvasScriptAgentMessage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/scriptMessage', params })
}

export function retryCanvasScriptAgent(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/scriptRetry', params })
}

export function cancelCanvasScriptAgent(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent/scriptCancel', params })
}

export function createCanvasAgentChatThread(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent_chat/threadCreate', params })
}

export function getCanvasAgentChatThreads(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent_chat/threadLists', params, retry: 0 })
}

export function getCanvasAgentChatThread(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent_chat/threadDetail', params, retry: 0 })
}

export function getCanvasAgentChatMessages(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent_chat/messageLists', params, retry: 0 })
}

export function sendCanvasAgentChatMessage(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent_chat/send', params })
}

export function deleteCanvasAgentChatThread(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent_chat/threadDelete', params })
}

export function getCanvasSkills(params: Record<string, any> = {}) {
    return $request.get({ url: '/app.aigc_canvas.skill/usable', params, retry: 0 })
}

export function getCanvasSkillDetail(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.skill/detail', params, retry: 0 })
}

export function cancelCanvasAgentChat(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent_chat/cancel', params })
}

export function retryCanvasAgentChat(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent_chat/retry', params })
}

export function applyCanvasAgentWorkspaceAction(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent_chat/workspaceAction', params })
}

export function executeCanvasAgentBatch(params: Record<string, any>) {
    return $request.post({ url: '/app.aigc_canvas.agent_chat/batchExecute', params })
}

export function getCanvasAgentBatchStatus(params: Record<string, any>) {
    return $request.get({ url: '/app.aigc_canvas.agent_chat/batchStatus', params, retry: 0 })
}

export function getCanvasAgentRunStatus(params: { request_id: string }) {
    return $request.get({ url: '/app.aigc_canvas.agent_chat/runStatus', params, retry: 0 })
}

export function streamCanvasAgentChat(
    params: Record<string, any>,
    handlers: {
        onEvent?: (event: CanvasTextStreamEvent) => void
        onError?: (error: Error) => void
        onClose?: () => void
        signal?: AbortSignal
    } = {}
) {
    return streamCanvasEndpoint('/app.aigc_canvas.agent_chat/stream', params, handlers)
}

export async function proxyImage(params: Record<string, any>) {
    return $request.post({
        url: '/app.aigc_canvas.generate/image',
        params
    })
}

export async function proxyImageQuery(taskId: string | number) {
    return $request.get({
        url: '/app.aigc_canvas.generate/imageQuery',
        params: { task_id: taskId }
    })
}

export async function proxyVideo(params: Record<string, any>) {
    return $request.post({
        url: '/app.aigc_canvas.generate/video',
        params
    })
}

export async function proxyVideoQuery(taskId: string | number) {
    return $request.get({
        url: '/app.aigc_canvas.generate/videoQuery',
        params: { task_id: taskId }
    })
}

export async function proxyMusic(params: Record<string, any>) {
    return $request.post({
        url: '/app.aigc_canvas.generate/music',
        params
    })
}

export async function proxyMusicQuery(taskId: string | number) {
    return $request.get({
        url: '/app.aigc_canvas.generate/musicQuery',
        params: { task_id: taskId }
    })
}
