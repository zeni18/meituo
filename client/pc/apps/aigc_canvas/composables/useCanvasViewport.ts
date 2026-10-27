import { computed, ref, type Ref } from 'vue'
import type { CanvasPosition, ViewportTransform } from '../types'

export interface SelectionBoxState {
    startWorldX: number
    startWorldY: number
    currentWorldX: number
    currentWorldY: number
    additive: boolean
}

export function useCanvasViewport(containerRef: Ref<HTMLElement | null>, initial: ViewportTransform = { x: 0, y: 0, k: 1 }) {
    const viewport = ref<ViewportTransform>({ ...initial })
    const isPanning = ref(false)
    const selectionBox = ref<SelectionBoxState | null>(null)
    const panState = ref({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false })

    const transformStyle = computed(() => ({
        transform: `translate(${viewport.value.x}px, ${viewport.value.y}px) scale(${viewport.value.k})`
    }))

    function setViewport(next: Partial<ViewportTransform>) {
        viewport.value = {
            x: Number(next.x ?? viewport.value.x),
            y: Number(next.y ?? viewport.value.y),
            k: clamp(Number(next.k ?? viewport.value.k), 0.05, 5)
        }
    }

    function centerViewport() {
        const rect = containerRef.value?.getBoundingClientRect()
        if (!rect) return
        setViewport({ x: rect.width / 2, y: rect.height / 2, k: 1 })
    }

    function screenToCanvas(clientX: number, clientY: number): CanvasPosition {
        const rect = containerRef.value?.getBoundingClientRect()
        const localX = clientX - (rect?.left || 0)
        const localY = clientY - (rect?.top || 0)
        return {
            x: (localX - viewport.value.x) / viewport.value.k,
            y: (localY - viewport.value.y) / viewport.value.k
        }
    }

    function canvasToScreen(x: number, y: number): CanvasPosition {
        const rect = containerRef.value?.getBoundingClientRect()
        return {
            x: (rect?.left || 0) + x * viewport.value.k + viewport.value.x,
            y: (rect?.top || 0) + y * viewport.value.k + viewport.value.y
        }
    }

    function getCanvasCenter() {
        const rect = containerRef.value?.getBoundingClientRect()
        return screenToCanvas((rect?.left || 0) + (rect?.width || 0) / 2, (rect?.top || 0) + (rect?.height || 0) / 2)
    }

    function handleWheel(event: WheelEvent) {
        const target = event.target as HTMLElement | null
        if (target?.closest('input,textarea,select,video,[data-canvas-no-zoom]')) return
        event.preventDefault()

        if (event.ctrlKey || event.metaKey) {
            const rect = containerRef.value?.getBoundingClientRect()
            if (!rect) return
            const localX = event.clientX - rect.left
            const localY = event.clientY - rect.top
            const nextK = clamp(viewport.value.k * Math.exp(-event.deltaY * 0.0012), 0.05, 5)
            const worldX = (localX - viewport.value.x) / viewport.value.k
            const worldY = (localY - viewport.value.y) / viewport.value.k
            setViewport({
                x: localX - worldX * nextK,
                y: localY - worldY * nextK,
                k: nextK
            })
            return
        }

        setViewport({
            x: viewport.value.x - (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX),
            y: viewport.value.y - (event.shiftKey ? 0 : event.deltaY)
        })
    }

    function beginPan(event: PointerEvent) {
        isPanning.value = true
        panState.value = {
            startX: event.clientX,
            startY: event.clientY,
            initialX: viewport.value.x,
            initialY: viewport.value.y,
            moved: false
        }
    }

    function updatePan(event: PointerEvent) {
        if (!isPanning.value) return
        const dx = event.clientX - panState.value.startX
        const dy = event.clientY - panState.value.startY
        panState.value.moved = panState.value.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3
        setViewport({ x: panState.value.initialX + dx, y: panState.value.initialY + dy })
    }

    function endPan() {
        const moved = panState.value.moved
        isPanning.value = false
        return moved
    }

    function beginSelection(event: PointerEvent, additive = false) {
        const start = screenToCanvas(event.clientX, event.clientY)
        selectionBox.value = {
            startWorldX: start.x,
            startWorldY: start.y,
            currentWorldX: start.x,
            currentWorldY: start.y,
            additive
        }
    }

    function updateSelection(event: PointerEvent) {
        if (!selectionBox.value) return
        const current = screenToCanvas(event.clientX, event.clientY)
        selectionBox.value = {
            ...selectionBox.value,
            currentWorldX: current.x,
            currentWorldY: current.y
        }
    }

    function endSelection() {
        const box = selectionBox.value
        selectionBox.value = null
        return box
    }

    return {
        viewport,
        transformStyle,
        isPanning,
        selectionBox,
        setViewport,
        centerViewport,
        screenToCanvas,
        canvasToScreen,
        getCanvasCenter,
        handleWheel,
        beginPan,
        updatePan,
        endPan,
        beginSelection,
        updateSelection,
        endSelection
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
}
