import type { CanvasConnection, CanvasNodeData, CanvasNodeType, CanvasProject, CanvasSubCanvas, ViewportTransform } from '../types'
import {
    createCanvasProjectRemote,
    deleteCanvasProjectRemote,
    duplicateCanvasProjectRemote,
    getCanvasProjectDetail,
    getCanvasProjectLists,
    renameCanvasProjectRemote,
    saveCanvasProjectRemote
} from '../api'

export const PROJECT_STORAGE_KEY = 'likeadmin-aigc-canvas-projects'

const defaultViewport: ViewportTransform = { x: 0, y: 0, k: 1 }

const nodeDefaults: Record<CanvasNodeType, { width: number; height: number; title: string }> = {
    audio: { width: 340, height: 170, title: '音乐' },
    text: { width: 340, height: 217, title: '文本' },
    image: { width: 340, height: 217, title: '图片' },
    video: { width: 340, height: 217, title: '视频' },
    config: { width: 340, height: 146, title: '生成配置' }
}

function hasLocalStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function createId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function cloneDeep<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
}

export function createNativeCanvasNode(type: CanvasNodeType, position = { x: 0, y: 0 }, metadata: Record<string, any> = {}, id = createId(type)): CanvasNodeData {
    const spec = nodeDefaults[type]
    return {
        id,
        type,
        title: String(metadata.title || spec.title),
        position: {
            x: Number(position.x || 0),
            y: Number(position.y || 0)
        },
        width: Number(metadata.width || spec.width),
        height: Number(metadata.height || spec.height),
        metadata: {
            status: 'idle',
            prompt: '',
            content: '',
            ...metadata,
            title: undefined
        }
    }
}

export function createNativeConnection(fromNodeId: string, toNodeId: string, id = createId('conn')): CanvasConnection {
    return { id, fromNodeId, toNodeId }
}

export function loadCanvasProjects(): CanvasProject[] {
    if (!hasLocalStorage()) return []
    try {
        const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map(normalizeProject).sort((a, b) => b.updatedAt - a.updatedAt) : []
    } catch {
        return []
    }
}

export function saveCanvasProjects(projects: CanvasProject[]) {
    if (!hasLocalStorage()) return
    const previous = loadCanvasProjects()
    const payload = projects.map((project) => preserveProjectMedia(cleanProjectForStorage(project), previous.find((item) => item.id === project.id)))
    try {
        localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
        const trimmed = payload.slice(0, 12).map((project) => ({
            ...project,
            thumbnail: '',
            nodes: project.nodes.slice(0, 80).map((node) => ({
                ...node,
                metadata: {
                    ...node.metadata,
                    image: compactUrl(node.metadata.image),
                    url: compactUrl(node.metadata.url),
                    poster: compactUrl(node.metadata.poster)
                }
            })),
            connections: project.connections.slice(0, 120)
        }))
        try {
            localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(trimmed))
        } catch {
            // Ignore local quota failures; remote save remains authoritative when available.
        }
    }
}

export async function loadCanvasProjectsRemote(): Promise<CanvasProject[]> {
    const payload: any = await getCanvasProjectLists({ limit: 100 })
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.lists) ? payload.lists : Array.isArray(payload?.data) ? payload.data : []
    return rows.map(normalizeProject).sort((a: CanvasProject, b: CanvasProject) => b.updatedAt - a.updatedAt)
}

export async function createRemoteCanvasProject(name = '未命名工作区', data: Partial<CanvasProject> = {}): Promise<CanvasProject> {
    const project = createCanvasProject(name, data)
    const payload: any = await createCanvasProjectRemote(cleanProjectForRemote(project))
    return normalizeProject(payload || project)
}

export async function loadRemoteCanvasProjectDetail(id: string | number): Promise<CanvasProject> {
    const payload: any = await getCanvasProjectDetail(id)
    const project = normalizeProject(payload)
    rememberProjectMedia(project)
    return project
}

export async function saveRemoteCanvasProject(project: CanvasProject): Promise<CanvasProject> {
    const payload: any = await saveCanvasProjectRemote(cleanProjectForRemote(project))
    const saved = normalizeProject(payload || project)
    rememberProjectMedia(saved)
    return saved
}

export async function renameRemoteCanvasProject(id: string | number, name: string): Promise<CanvasProject> {
    const payload: any = await renameCanvasProjectRemote({ id, name })
    return normalizeProject(payload)
}

export async function duplicateRemoteCanvasProject(id: string | number): Promise<CanvasProject> {
    const payload: any = await duplicateCanvasProjectRemote(id)
    return normalizeProject(payload)
}

export async function deleteRemoteCanvasProject(id: string | number): Promise<void> {
    await deleteCanvasProjectRemote(id)
}

export async function importLocalCanvasProjectsToRemote(projects: CanvasProject[]): Promise<CanvasProject[]> {
    const imported: CanvasProject[] = []
    for (const project of projects) {
        try {
            imported.push(await createRemoteCanvasProject(project.name, project))
        } catch {
            // Keep local projects available if one import fails.
        }
    }
    return imported
}

export function createCanvasProject(name = '未命名工作区', data: Partial<CanvasProject> = {}): CanvasProject {
    const now = Date.now()
    return normalizeProject({
        id: data.id || createId('project'),
        name,
        thumbnail: '',
        nodes: data.nodes || [],
        connections: data.connections || [],
        edges: data.edges || [],
        viewport: data.viewport || defaultViewport,
        createdAt: now,
        updatedAt: now,
        ...data
    })
}

export function ensureProjectCanvas(project: CanvasProject): CanvasProject {
    return normalizeProject(project)
}

export function duplicateCanvasProject(project: CanvasProject): CanvasProject {
    const copy = cloneDeep(project)
    const now = Date.now()
    return normalizeProject({
        ...copy,
        id: createId('project'),
        name: `${project.name} (副本)`,
        createdAt: now,
        updatedAt: now
    })
}

export function updateProjectThumbnail(project: CanvasProject, nodes: CanvasNodeData[]) {
    const imageUrl = (node: CanvasNodeData) =>
        String(
            node.metadata.image ||
                node.metadata.url ||
                node.metadata.preview_url ||
                node.metadata.thumbnail ||
                node.metadata.cover ||
                ''
        ).trim()
    const isGeneratedImage = (node: CanvasNodeData) => {
        const source = String(node.metadata.source || node.metadata.mediaSource || '').toLowerCase()
        return node.type === 'image' && imageUrl(node) && (!!node.metadata.generatedAt || ['generated', 'agent'].includes(source))
    }
    const sortTime = (node: CanvasNodeData, index: number) => {
        const time = Number(node.metadata.generatedAt || node.metadata.createdAt || node.metadata.updatedAt || 0)
        return Number.isFinite(time) && time > 0 ? time : index
    }
    const generatedImage = [...nodes]
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => isGeneratedImage(node))
        .sort((a, b) => sortTime(a.node, a.index) - sortTime(b.node, b.index) || a.index - b.index)[0]
    if (generatedImage) {
        project.thumbnail = imageUrl(generatedImage.node)
        return
    }
    const media = [...nodes]
        .filter((node) => ['image', 'video'].includes(node.type) && (node.metadata.image || node.metadata.url || node.metadata.poster))
        .sort((a, b) => Number(b.metadata.updatedAt || 0) - Number(a.metadata.updatedAt || 0))[0]
    project.thumbnail = media ? String(media.metadata.image || media.metadata.poster || media.metadata.url || '') : project.thumbnail
}

function normalizeTimestamp(value: any, fallback = 0) {
    if (value == null || value === '') return fallback
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
        const time = numeric < 100000000000 ? numeric * 1000 : numeric
        return time >= 946684800000 ? time : fallback
    }
    const parsed = Date.parse(String(value))
    return Number.isFinite(parsed) && parsed >= 946684800000 ? parsed : fallback
}

function timestampFromId(value: any) {
    const match = String(value || '').match(/(?:^|_)(1[6-9]\d{11})(?:_|$)/)
    return match ? normalizeTimestamp(match[1]) : 0
}

function latestProjectContentTime(nodes: CanvasNodeData[], canvases: CanvasSubCanvas[], projectId: any) {
    const times = [
        timestampFromId(projectId),
        ...nodes.flatMap((node) => [
            node.metadata?.updatedAt,
            node.metadata?.generatedAt,
            node.metadata?.createdAt
        ]),
        ...canvases.flatMap((canvas) => [canvas.updatedAt, canvas.createdAt])
    ]
        .map((value) => normalizeTimestamp(value))
        .filter((value) => value > 0)
    return times.length ? Math.max(...times) : 0
}

export function normalizeProject(project: any): CanvasProject {
    const canvasData = project?.canvasData || project?.canvas_data || {}
    const rawNodes = Array.isArray(project?.nodes) ? project.nodes : Array.isArray(canvasData.nodes) ? canvasData.nodes : []
    const rawConnections = Array.isArray(project?.connections)
        ? project.connections
        : Array.isArray(canvasData.connections)
          ? canvasData.connections
          : Array.isArray(project?.edges)
            ? project.edges
            : Array.isArray(canvasData.edges)
              ? canvasData.edges
              : []
    const viewport = normalizeViewport(project?.viewport || canvasData.viewport || defaultViewport)
    const nodes = rawNodes.map(normalizeNode).filter(Boolean) as CanvasNodeData[]
    const connections = rawConnections.map(normalizeConnection).filter((item: CanvasConnection | null): item is CanvasConnection => !!item && !!item.fromNodeId && !!item.toNodeId)
    const registeredAssets: any[] = Array.isArray(project?.registeredAssets)
        ? project.registeredAssets
        : Array.isArray(project?.registered_assets)
          ? project.registered_assets
          : Array.isArray(canvasData.registeredAssets)
            ? canvasData.registeredAssets
            : Array.isArray(canvasData.registered_assets)
              ? canvasData.registered_assets
              : []
    const currentCanvasId = String(project?.currentCanvasId || canvasData.currentCanvasId || 'canvas_1')
    const canvases: CanvasSubCanvas[] = Array.isArray(project?.canvases || canvasData.canvases)
        ? (project.canvases || canvasData.canvases).map((canvas: any, index: number) => ({
              id: String(canvas?.id || createId('canvas')),
              name: String(canvas?.name || `画布 ${index + 1}`),
              nodes: (Array.isArray(canvas?.nodes) ? canvas.nodes : []).map(normalizeNode).filter(Boolean),
              connections: (Array.isArray(canvas?.connections) ? canvas.connections : Array.isArray(canvas?.edges) ? canvas.edges : []).map(normalizeConnection).filter(Boolean),
              viewport: normalizeViewport(canvas?.viewport || viewport),
              createdAt: normalizeTimestamp(canvas?.createdAt ?? canvas?.created_at ?? canvas?.create_time),
              updatedAt: normalizeTimestamp(canvas?.updatedAt ?? canvas?.updated_at ?? canvas?.update_time)
          }))
        : []
    const inferredTime = latestProjectContentTime(nodes, canvases, project?.id)
    const createdAt = normalizeTimestamp(
        project?.createdAt ?? project?.created_at ?? project?.create_time ?? project?.createTime,
        inferredTime
    )
    const updatedAt = normalizeTimestamp(
        project?.updatedAt ?? project?.updated_at ?? project?.update_time ?? project?.updateTime,
        inferredTime || createdAt
    )

    return {
        id: String(project?.id || createId('project')),
        name: String(project?.name || project?.title || '未命名工作区'),
        thumbnail: String(project?.thumbnail || ''),
        nodes,
        connections,
        viewport,
        edges: connections.map((connection: CanvasConnection) => ({ id: connection.id, source: connection.fromNodeId, target: connection.toNodeId })),
        canvases,
        currentCanvasId,
        registeredAssets: cloneDeep(registeredAssets),
        createdAt,
        updatedAt
    }
}

function normalizeNode(node: any): CanvasNodeData | null {
    if (!node) return null
    if (node.position && node.metadata && node.type && ['text', 'image', 'video', 'audio', 'config'].includes(String(node.type))) {
        const type = String(node.type) as CanvasNodeType
        const metadata = { status: 'idle', ...(node.metadata || {}) }
        if (type === 'image') {
            const image = firstNonEmpty(
                metadata.image,
                metadata.url,
                metadata.image_url,
                metadata.preview_url,
                metadata.thumbnail,
                metadata.cover,
                node.image,
                node.url,
                node.image_url,
                node.preview_url,
                node.thumbnail,
                node.cover
            )
            if (image) {
                metadata.image = metadata.image || image
                metadata.url = metadata.url || image
            }
        } else if (type === 'video') {
            const url = firstNonEmpty(metadata.url, metadata.video_url, node.url, node.video_url)
            const poster = firstNonEmpty(
                metadata.poster,
                metadata.cover,
                metadata.thumbnail,
                node.poster,
                node.cover,
                node.thumbnail
            )
            if (url) metadata.url = metadata.url || url
            if (poster) metadata.poster = metadata.poster || poster
        } else if (type === 'audio') {
            const url = firstNonEmpty(metadata.url, metadata.audio_url, node.url, node.audio_url)
            if (url) metadata.url = metadata.url || url
        }
        return {
            id: String(node.id || createId(type)),
            type,
            title: String(node.title || node.metadata?.title || nodeDefaults[type].title),
            position: { x: Number(node.position.x || 0), y: Number(node.position.y || 0) },
            width: Number(node.width || nodeDefaults[type].width),
            height: Number(node.height || nodeDefaults[type].height),
            metadata
        }
    }

    const data = node.data || node.metadata || {}
    const variant = String(data.variant || node.type || 'text')
    const type = mapLegacyType(variant, data)
    const position = node.position || data.position || { x: 0, y: 0 }
    return createNativeCanvasNode(
        type,
        { x: Number(position.x || 0), y: Number(position.y || 0) },
        {
            ...data,
            title: data.title || data.label,
            content: data.content || data.outputContent || '',
            prompt: data.prompt || data.content || '',
            image: data.image || data.threeViewImage || '',
            url: data.url || data.video_url || data.image_url || '',
            poster: data.poster || '',
            status: data.status || data.agentStatus || 'idle',
            width: node.width || data.width,
            height: node.height || data.height,
            legacyVariant: variant
        },
        String(node.id || createId(type))
    )
}

function normalizeConnection(edge: any): CanvasConnection | null {
    if (!edge) return null
    return {
        id: String(edge.id || createId('conn')),
        fromNodeId: String(edge.fromNodeId || edge.source || ''),
        toNodeId: String(edge.toNodeId || edge.target || '')
    }
}

function normalizeViewport(value: any): ViewportTransform {
    return {
        x: Number(value?.x ?? defaultViewport.x),
        y: Number(value?.y ?? defaultViewport.y),
        k: Number(value?.k ?? value?.zoom ?? defaultViewport.k)
    }
}

function firstNonEmpty(...values: any[]) {
    for (const value of values) {
        const text = String(value || '').trim()
        if (text) return text
    }
    return ''
}

function mapLegacyType(variant: string, data: Record<string, any>): CanvasNodeType {
    if (variant.includes('audio') || variant.includes('music') || data.audio_url || data.audio_uri || String(data.mimeType || data.mime_type || '').startsWith('audio/')) return 'audio'
    if (variant.includes('video') || data.url || data.video_url) return 'video'
    if (variant.includes('image') || variant === 'subject' || data.image || data.threeViewImage || data.image_url) return 'image'
    if (variant.includes('config')) return 'config'
    return 'text'
}

const projectMediaSnapshots = new Map<string, CanvasProject>()

function rememberProjectMedia(project: CanvasProject) {
    projectMediaSnapshots.set(project.id, cloneDeep(project))
}

function cleanProjectForStorage(project: CanvasProject): CanvasProject {
    const cleanedNodes = project.nodes.map((node) => ({
        ...node,
        metadata: {
            ...node.metadata,
            image: sanitizeStoredUrl(node.metadata.image),
            url: sanitizeStoredUrl(node.metadata.url),
            poster: sanitizeStoredUrl(node.metadata.poster)
        }
    }))
    return {
        ...project,
        thumbnail: sanitizeStoredUrl(project.thumbnail),
        nodes: cleanedNodes,
        connections: project.connections.map((connection) => ({ ...connection })),
        viewport: normalizeViewport(project.viewport)
    }
}

function cleanProjectForRemote(project: CanvasProject): Record<string, any> {
    const cleaned = preserveProjectMedia(dropTransientProjectMedia(cleanProjectForStorage(project)), projectMediaSnapshots.get(project.id))
    return {
        id: cleaned.id,
        name: cleaned.name,
        thumbnail: cleaned.thumbnail,
        nodes: cleaned.nodes,
        edges: cleaned.connections.map((connection) => ({ id: connection.id, source: connection.fromNodeId, target: connection.toNodeId })),
        connections: cleaned.connections,
        viewport: cleaned.viewport,
        canvasData: {
            nodes: cleaned.nodes,
            connections: cleaned.connections,
            viewport: cleaned.viewport
        },
        sort: (project as any).sort || 0
    }
}

function dropTransientProjectMedia(project: CanvasProject): CanvasProject {
    return {
        ...project,
        thumbnail: isBlankOrTransientUrl(project.thumbnail) ? '' : project.thumbnail,
        nodes: project.nodes.map((node) => ({
            ...node,
            metadata: {
                ...node.metadata,
                image: isBlankOrTransientUrl(node.metadata.image) ? '' : node.metadata.image,
                url: isBlankOrTransientUrl(node.metadata.url) ? '' : node.metadata.url,
                poster: isBlankOrTransientUrl(node.metadata.poster) ? '' : node.metadata.poster
            }
        }))
    }
}

function preserveProjectMedia(project: CanvasProject, fallback?: CanvasProject): CanvasProject {
    if (!fallback) return project
    const fallbackNodes = new Map(fallback.nodes.map((node) => [node.id, node]))
    const nodes = project.nodes.map((node) => {
        const fallbackNode = fallbackNodes.get(node.id)
        if (!fallbackNode) return node
        const metadata = { ...node.metadata }
        for (const key of ['image', 'url', 'poster'] as const) {
            const current = metadata[key]
            const previous = fallbackNode.metadata?.[key]
            if (isBlankOrTransientUrl(current) && isDurableUrl(previous)) {
                metadata[key] = previous
            }
        }
        return { ...node, metadata }
    })
    return {
        ...project,
        thumbnail: isBlankOrTransientUrl(project.thumbnail) && isDurableUrl(fallback.thumbnail) ? fallback.thumbnail : project.thumbnail,
        nodes
    }
}

function isBlankOrTransientUrl(value: any) {
    const url = String(value || '').trim()
    return !url || url.startsWith('blob:')
}

function isDurableUrl(value: any) {
    const url = String(value || '').trim()
    return !!url && !url.startsWith('blob:')
}

function sanitizeStoredUrl(value: any) {
    const url = String(value || '').trim()
    return url
}

function compactUrl(value: any) {
    const url = String(value || '')
    if (url.startsWith('blob:')) return ''
    if (url.startsWith('data:') && !url.startsWith('data:image/svg+xml') && url.length > 12000) return ''
    return url
}

export function formatProjectTime(value: number) {
    return new Date(value).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
}
