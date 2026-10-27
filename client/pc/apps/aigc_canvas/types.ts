export type CanvasNodeType = 'text' | 'image' | 'video' | 'audio' | 'config'

export type CanvasNodeVariant =
    | CanvasNodeType
    | 'imagePrompt'
    | 'imageConfig'
    | 'imageResult'
    | 'videoConfig'
    | 'llmConfig'
    | 'audio'
    | 'script'
    | 'subject'
    | 'storyboardGroup'
    | 'videoCompose'
    | 'assetLibrary'

export type CanvasNodeStatus = 'idle' | 'editing' | 'queued' | 'running' | 'success' | 'failed' | 'canceled' | 'loading' | 'error'

export type CanvasProviderKey = 'chatfire' | 'openai' | string

export type CanvasMentionType = 'text' | 'image' | 'video' | 'audio' | 'asset'

export interface CanvasMention {
    id: string
    type: CanvasMentionType
    source: string
    name: string
    prompt?: string
    url?: string
    preview_url?: string
    asset_id?: string | number
    node_id?: string
    role?: string
    mime_type?: string
    asset_type?: string
}

export interface CanvasPosition {
    x: number
    y: number
}

export interface ViewportTransform {
    x: number
    y: number
    k: number
}

export interface CanvasViewport {
    x: number
    y: number
    zoom?: number
    k?: number
}

export interface CanvasNodeMetadata {
    content?: string
    prompt?: string
    status?: CanvasNodeStatus | string
    errorDetails?: string
    model?: string
    size?: string
    ratio?: string
    quality?: string
    count?: number
    duration?: number
    resolution?: string
    image?: string
    url?: string
    poster?: string
    taskId?: string | number
    referenceImages?: Array<{ url: string; name?: string; role?: string }>
    referenceVideos?: Array<{ url: string; name?: string }>
    referenceAudios?: Array<{ url: string; name?: string; asset_id?: string | number }>
    mentions?: CanvasMention[]
    [key: string]: any
}

export interface CanvasNodeData {
    id: string
    type: CanvasNodeType
    title: string
    position: CanvasPosition
    width: number
    height: number
    metadata: CanvasNodeMetadata
}

export interface CanvasConnection {
    id: string
    fromNodeId: string
    toNodeId: string
}

export interface CanvasNodeExternalReference {
    type: 'image' | 'video' | 'audio' | 'text'
    url?: string
    text?: string
    name?: string
    sourceId?: string
}

export interface CanvasProject {
    id: string
    name: string
    thumbnail: string
    createdAt: number
    updatedAt: number
    nodes: CanvasNodeData[]
    connections: CanvasConnection[]
    viewport: ViewportTransform
    edges?: any[]
    canvases?: CanvasSubCanvas[]
    currentCanvasId?: string
    registeredAssets?: any[]
}

export interface CanvasSubCanvas {
    id: string
    name: string
    nodes: CanvasNodeData[]
    connections: CanvasConnection[]
    viewport: ViewportTransform
    createdAt: number
    updatedAt: number
}

export interface CanvasAsset {
    id: string
    title: string
    url: string
    type: 'image' | 'video' | 'audio' | 'text'
    poster?: string
    source?: string
    raw?: any
}

export interface DownloadAsset {
    id: string
    title: string
    url: string
    type: 'image' | 'video' | 'audio'
}

export interface CanvasApiSettings {
    provider: CanvasProviderKey
    baseUrl: string
    apiKey: string
    chatModel: string
    imageModel: string
    videoModel: string
    customChatModels: CanvasModel[]
    customImageModels: CanvasModel[]
    customVideoModels: CanvasModel[]
}

export interface CanvasModel {
    label: string
    key: string
    provider?: string[]
    sizes?: string[]
    ratios?: string[]
    durations?: number[]
    defaultParams?: Record<string, any>
    isCustom?: boolean
}

export interface WorkflowTemplate {
    id: string
    name: string
    description: string
    category: string
    cover?: string
    create: (start: { x: number; y: number }) => {
        nodes: Array<any>
        edges: Array<any>
    }
}
