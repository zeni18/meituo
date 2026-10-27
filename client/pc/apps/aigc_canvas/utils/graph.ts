import type { CanvasNodeType, CanvasNodeVariant } from '../types'
import { createId, createNativeCanvasNode, createNativeConnection } from '../stores/projects'

export const CANVAS_NODE_TYPE = 'aigcCanvasNode'

export const CANVAS_NODE_VARIANTS: CanvasNodeVariant[] = [
    'text',
    'imagePrompt',
    'imageConfig',
    'image',
    'imageResult',
    'videoConfig',
    'video',
    'llmConfig',
    'audio',
    'script',
    'subject',
    'storyboardGroup',
    'videoCompose',
    'assetLibrary',
    'config'
]

export function createCanvasNode(variant: CanvasNodeVariant, position = { x: 100, y: 100 }, data: Record<string, any> = {}, id = createId(String(variant))) {
    const nativeType = mapVariantToNativeType(String(variant), data)
    const node = createNativeCanvasNode(nativeType, position, { ...normalizeNodeData(variant, data), legacyVariant: variant }, id)
    return {
        id: node.id,
        type: CANVAS_NODE_TYPE,
        position: node.position,
        data: {
            ...node.metadata,
            variant,
            title: node.title,
            nativeType,
            width: node.width,
            height: node.height
        }
    }
}

export function normalizeNodeData(variant: CanvasNodeVariant, data: Record<string, any> = {}) {
    const type = mapVariantToNativeType(String(variant), data)
    const defaults: Record<CanvasNodeType, Record<string, any>> = {
        audio: { title: '音乐', url: '', prompt: '', duration: 30, status: 'idle' },
        text: { title: '文本', content: '', prompt: '', status: 'idle' },
        image: { title: '图片', image: '', url: '', prompt: '', ratio: '16:9', quality: '标准画质', status: 'idle' },
        video: { title: '视频', url: '', poster: '', prompt: '', ratio: '16:9', duration: 5, status: 'idle' },
        config: { title: '生成配置', prompt: '', model: '', size: '1:1', count: 1, status: 'idle' }
    }
    const titleMap: Record<string, string> = {
        script: '故事脚本',
        subject: '角色',
        storyboardGroup: '分镜组',
        videoCompose: '视频合成',
        imageConfig: '图片生成',
        videoConfig: '视频生成',
        llmConfig: 'AI 文本生成'
    }
    return {
        ...defaults[type],
        ...data,
        variant,
        title: data.title || titleMap[String(variant)] || data.label || defaults[type].title,
        updatedAt: Date.now()
    }
}

export function createCanvasEdge(source: string, target: string, type = 'smoothstep', data: Record<string, any> = {}) {
    const connection = createNativeConnection(source, target)
    return {
        id: connection.id,
        source,
        target,
        sourceHandle: 'right',
        targetHandle: 'left',
        type,
        label: data.promptOrder ? String(data.promptOrder) : data.imageOrder ? String(data.imageOrder) : data.videoOrder ? String(data.videoOrder) : '',
        data,
        style: { stroke: 'rgba(255, 255, 255, 0.52)', strokeWidth: 2 }
    }
}

export function edgeFromConnection(params: any, nodes: any[], edges: any[]) {
    if (!params.source || !params.target || params.source === params.target) return null
    const source = nodes.find((node) => node.id === params.source)
    const target = nodes.find((node) => node.id === params.target)
    const sourceVariant = String(source?.data?.variant || source?.type || '')
    const targetVariant = String(target?.data?.variant || target?.type || '')
    const data: Record<string, any> = {}
    let type = 'smoothstep'

    if (['text', 'imagePrompt', 'llmConfig', 'script'].includes(sourceVariant)) {
        type = 'promptOrder'
        data.promptOrder = nextOrder(edges, params.target, 'promptOrder')
    }
    if (['image', 'imageResult', 'subject'].includes(sourceVariant)) {
        type = ['video', 'videoConfig'].includes(targetVariant) ? 'imageRole' : 'imageOrder'
        data.imageOrder = nextOrder(edges, params.target, 'imageOrder')
        if (type === 'imageRole') data.imageRole = nextImageRole(edges, params.target)
    }
    if (sourceVariant === 'video') {
        type = 'videoOrder'
        data.videoOrder = nextOrder(edges, params.target, 'videoOrder')
    }

    return createCanvasEdge(params.source, params.target, type, data)
}

export function collectConnectedPrompt(targetId: string, nodes: any[], edges: any[]) {
    return edges
        .filter((edge) => edge.target === targetId)
        .sort((a, b) => Number(a.data?.promptOrder || 0) - Number(b.data?.promptOrder || 0))
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .map((node) => node?.data?.outputContent || node?.data?.content || node?.data?.prompt || node?.metadata?.content || node?.metadata?.prompt || '')
        .filter(Boolean)
        .join('\n\n')
}

export function collectConnectedImages(targetId: string, nodes: any[], edges: any[]) {
    return edges
        .filter((edge) => edge.target === targetId)
        .sort((a, b) => Number(a.data?.imageOrder || 0) - Number(b.data?.imageOrder || 0))
        .map((edge) => ({ edge, node: nodes.find((node) => node.id === edge.source) }))
        .map(({ edge, node }) => ({
            role: edge.data?.imageRole || 'reference_image',
            url: String(node?.data?.image || node?.data?.url || node?.metadata?.image || node?.metadata?.url || '')
        }))
        .filter((item) => item.url)
}

export function collectConnectedVideos(targetId: string, nodes: any[], edges: any[]) {
    return edges
        .filter((edge) => edge.target === targetId)
        .sort((a, b) => Number(a.data?.videoOrder || 0) - Number(b.data?.videoOrder || 0))
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .map((node) => ({ url: String(node?.data?.url || node?.metadata?.url || ''), name: String(node?.data?.title || node?.title || '视频素材') }))
        .filter((item) => item.url)
}

export function publicImageNodes(nodes: any[]) {
    return nodes.filter((node) => ['image', 'imageResult'].includes(String(node.data?.variant || node.type)) && (node.data?.image || node.data?.url || node.metadata?.image || node.metadata?.url))
}

function mapVariantToNativeType(variant: string, data: Record<string, any>): CanvasNodeType {
    if (variant.includes('audio') || variant.includes('music') || data.audio_url || data.audio_uri || String(data.mimeType || data.mime_type || '').startsWith('audio/')) return 'audio'
    if (variant.includes('video') || data.url || data.video_url) return 'video'
    if (variant.includes('image') || variant === 'subject' || data.image || data.threeViewImage || data.image_url) return 'image'
    if (variant.includes('config')) return 'config'
    return 'text'
}

function nextOrder(edges: any[], target: string, key: string) {
    return edges.filter((edge) => edge.target === target && edge.data?.[key]).length + 1
}

function nextImageRole(edges: any[], target: string) {
    const hasFirst = edges.some((edge) => edge.target === target && edge.data?.imageRole === 'first_frame_image')
    return hasFirst ? 'last_frame_image' : 'first_frame_image'
}
