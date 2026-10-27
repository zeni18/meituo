<template>
    <BaseEdge :id="id" :path="edgePath" :style="edgeStyle" />
    <EdgeLabelRenderer>
        <div class="canvas-edge-label nodrag nopan" :style="{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }">
            <button class="canvas-edge-plus" type="button" title="添加节点" @click.stop="openAddMenu">+</button>
            <select v-if="kind === 'promptOrder'" :value="data?.promptOrder || 1" title="调整提示词顺序" @change="updateEdge({ promptOrder: Number(($event.target as HTMLSelectElement).value) })">
                <option v-for="item in 8" :key="item" :value="item">提示词 {{ item }}</option>
            </select>
            <select v-else-if="kind === 'imageOrder'" :value="data?.imageOrder || 1" title="调整参考图顺序" @change="updateEdge({ imageOrder: Number(($event.target as HTMLSelectElement).value) })">
                <option v-for="item in 8" :key="item" :value="item">参考图 {{ item }}</option>
            </select>
            <select v-else-if="kind === 'videoOrder'" :value="data?.videoOrder || 1" title="调整视频顺序" @change="updateEdge({ videoOrder: Number(($event.target as HTMLSelectElement).value) })">
                <option v-for="item in 6" :key="item" :value="item">视频 {{ item }}</option>
            </select>
            <select v-else-if="kind === 'imageRole'" :value="data?.imageRole || 'first_frame_image'" title="调整图片角色" @change="updateEdge({ imageRole: ($event.target as HTMLSelectElement).value })">
                <option value="first_frame_image">首帧</option>
                <option value="last_frame_image">尾帧</option>
                <option value="reference_image">参考图</option>
            </select>
            <span v-else class="canvas-edge-label__text">连接</span>
            <button class="canvas-edge-label__remove" type="button" title="删除连接" @click="removeEdge">x</button>
        </div>
    </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath } from '@vue-flow/core'

const props = defineProps<{
    id: string
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
    source?: string
    target?: string
    sourcePosition: any
    targetPosition: any
    data?: Record<string, any>
    style?: Record<string, any>
    type?: string
}>()

const edgeActions = inject<{ update?: (id: string, data: Record<string, any>) => void; remove?: (id: string) => void }>('aigcCanvasEdgeActions', {})

const kind = computed(() => {
    if (props.type) return props.type
    if (props.data?.imageRole) return 'imageRole'
    if (props.data?.imageOrder) return 'imageOrder'
    if (props.data?.videoOrder) return 'videoOrder'
    if (props.data?.promptOrder) return 'promptOrder'
    return 'smoothstep'
})

const pathResult = computed(() => {
    const params = {
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: props.sourcePosition,
        targetPosition: props.targetPosition
    }
    return kind.value === 'imageRole' ? getBezierPath(params) : getSmoothStepPath(params)
})

const edgePath = computed(() => pathResult.value[0])
const labelX = computed(() => pathResult.value[1])
const labelY = computed(() => pathResult.value[2])
const edgeStyle = computed(() => ({ stroke: '#5f6368', strokeWidth: 2, fill: 'none', ...(props.style || {}) }))

function updateEdge(data: Record<string, any>) {
    edgeActions.update?.(props.id, data)
}

function removeEdge() {
    edgeActions.remove?.(props.id)
}

function openAddMenu(event: MouseEvent) {
    window.dispatchEvent(new CustomEvent('aigc-canvas-edge-add-node', {
        detail: {
            edgeId: props.id,
            sourceId: props.source || props.data?.sourceId || '',
            clientX: event.clientX,
            clientY: event.clientY
        }
    }))
}
</script>

<style scoped lang="scss">
.canvas-edge-label {
    position: absolute;
    z-index: 8;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    pointer-events: all;
    opacity: 0.88;
}

.canvas-edge-plus,
.canvas-edge-label select,
.canvas-edge-label__text,
.canvas-edge-label__remove {
    height: 24px;
    border: 1px solid #363636;
    border-radius: 999px;
    outline: none;
    background: #262626;
    color: #fff;
    font-size: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
}

.canvas-edge-plus,
.canvas-edge-label__remove {
    width: 24px;
    padding: 0;
    cursor: pointer;
}

.canvas-edge-plus {
    background: #f4f4f4;
    color: #111;
    font-size: 16px;
    line-height: 20px;
}

.canvas-edge-label select {
    width: 28px;
    padding: 0;
    color: transparent;
    appearance: none;
    cursor: pointer;
}

.canvas-edge-label:hover select {
    width: auto;
    min-width: 86px;
    padding: 0 8px;
    color: #fff;
}

.canvas-edge-label__text {
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    color: rgba(255, 255, 255, 0.72);
}

.canvas-edge-label__remove:hover {
    border-color: rgba(239, 68, 68, 0.72);
    color: #f87171;
}
</style>
