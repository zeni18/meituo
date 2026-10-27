const AI_TOOLS_RETURN_POSITION_KEY = 'ai_tools_return_position'

type AiToolsReturnPosition = {
    scrollTop: number
    savedAt: number
}

const getAiToolsScrollContainer = () => {
    if (typeof document === 'undefined') return null
    return document.querySelector<HTMLElement>('.workspace-main')
}

export const saveAiToolsReturnPosition = () => {
    if (typeof window === 'undefined') return
    const container = getAiToolsScrollContainer()
    const payload: AiToolsReturnPosition = {
        scrollTop: container?.scrollTop || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
        savedAt: Date.now()
    }
    window.sessionStorage.setItem(AI_TOOLS_RETURN_POSITION_KEY, JSON.stringify(payload))
}

export const restoreAiToolsReturnPosition = async () => {
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(AI_TOOLS_RETURN_POSITION_KEY)
    if (!raw) return

    let payload: AiToolsReturnPosition | null = null
    try {
        payload = JSON.parse(raw)
    } catch {
        window.sessionStorage.removeItem(AI_TOOLS_RETURN_POSITION_KEY)
        return
    }

    const top = Math.max(0, Number(payload?.scrollTop || 0))

    const applyScroll = () => {
        const container = getAiToolsScrollContainer()
        if (container) {
            container.scrollTop = top
            return
        }
        window.scrollTo({ top, behavior: 'auto' })
    }

    applyScroll()
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    applyScroll()
    window.setTimeout(applyScroll, 120)
    window.sessionStorage.removeItem(AI_TOOLS_RETURN_POSITION_KEY)
}
