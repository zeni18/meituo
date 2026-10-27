<template>
    <div class="native-canvas-page" :style="canvasFocusStyle" @contextmenu.prevent>
        <header class="canvas-topbar" @pointerdown.stop>
            <div class="topbar-left">
                <NuxtLink class="brand-pill" to="/app/aigc_canvas" title="返回项目">
                    <span class="back-mark" aria-hidden="true" />
                </NuxtLink>
                <span class="topbar-separator" />
                <input
                    class="project-name-input"
                    :value="projectNameDraft"
                    @input="handleProjectNameInput(($event.target as HTMLInputElement).value)"
                    @blur="commitProjectName"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
            </div>
            <div class="topbar-right" :style="topbarRightStyle">
                <CanvasAccountActions />
            </div>
        </header>

        <AiWorkspaceAssetGalleryModal
            :visible="showAssetGallery"
            :accept-types="assetGalleryAcceptTypes"
            :title="assetGalleryTarget === 'agent' ? '资产库上传' : '资产库上传'"
            :description="
                assetGalleryTarget === 'agent'
                    ? '选择资产作为 Agent 输入参考素材'
                    : '选择资产作为当前节点参考素材'
            "
            @close="showAssetGallery = false"
            @select="selectAssetGalleryItem"
        />

        <main
            ref="stageRef"
            class="canvas-stage"
            :class="{ panning: isPanning, selecting: !!selectionBox }"
            @wheel="handleStageWheel"
            @pointerdown="handleStagePointerDown"
            @auxclick.prevent
            @dblclick="handleStageDblClick"
            @contextmenu.prevent="handleStageContextMenu"
            @dragover.prevent
            @drop.prevent="handleDrop"
        >
            <div class="canvas-grid" :style="gridStyle" />

            <div class="canvas-transform" :style="transformStyle">
                <svg class="connection-layer">
                    <g v-for="connection in visibleConnections" :key="connection.id">
                        <path
                            class="connection-path"
                            :class="{ selected: selectedConnectionId === connection.id }"
                            :d="connectionPath(connection)"
                        />
                        <path
                            class="connection-hit-path"
                            :d="connectionPath(connection)"
                            @pointerdown.stop="selectConnection(connection.id)"
                            @contextmenu.prevent.stop="
                                handleConnectionContextMenu($event, connection.id)
                            "
                        />
                    </g>
                    <path
                        v-for="path in tempConnectionPaths"
                        :key="path"
                        class="connection-path temp"
                        :d="path"
                    />
                </svg>

                <CanvasNode
                    v-for="node in nodes"
                    :key="node.id"
                    :node="node"
                    :selected="selectedIds.size === 1 && selectedIds.has(node.id)"
                    :running="runningNodeId === node.id"
                    :connecting="!!connecting"
                    :dragging="dragState.active && dragState.initial.some((item) => item.id === node.id)"
                    :node-options="getNodeOptions(node)"
                    :external-references="getNodeInputReferences(node)"
                    :mention-options="getCanvasMentionOptions(node)"
                    :scale="viewport.k"
                    :style="{ left: `${node.position.x}px`, top: `${node.position.y}px` }"
                    :ref="(instance) => setNodeRef(node.id, instance)"
                    @pointer-down="startNodeDrag"
                    @update="updateNode"
                    @remove="removeNode"
                    @duplicate="duplicateNode"
                    @run="runNode"
                    @connect-start="startConnection"
                    @connect-end="finishConnectionOnNode"
                    @asset-library="openNodeAssetGallery"
                    @add-to-asset="addNodeMediaToAsset"
                    @download-media="downloadNodeMedia"
                    @fullscreen-media="openNodeMediaPreview"
                    @capture-video-frame="captureVideoFrame"
                    @remove-reference-connection="removeReferenceConnection"
                    @contextmenu="handleNodeContextMenu"
                />

                <div v-if="selectionBox" class="selection-box" :style="selectionBoxStyle" />
                <div
                    v-else-if="multiSelectionBounds"
                    class="multi-selection-box"
                    :style="multiSelectionBoundsStyle"
                >
                    <button
                        class="multi-selection-add"
                        type="button"
                        title="添加节点"
                        @pointerdown.stop="startMultiSelectionConnection"
                    />
                </div>
            </div>

            <section v-if="!nodes.length" class="empty-canvas">
                <strong>双击或使用底部工具创建节点</strong>
                <span>文本、图片、视频、音乐链路已接入</span>
                <div>
                    <button type="button" @click.stop="addNodeAtCenter('text')">文案</button>
                    <button type="button" @click.stop="addNodeAtCenter('image')">生图</button>
                    <button type="button" @click.stop="addNodeAtCenter('video')">生成视频</button>
                    <button type="button" @click.stop="addNodeAtCenter('audio')">文生音乐</button>
                </div>
            </section>

            <aside v-if="showAssetSidebar" class="asset-sidebar" @pointerdown.stop>
                <header class="asset-sidebar-header">
                    <strong>资产库</strong>
                    <PcCloseButton
                        class="asset-sidebar-close"
                        aria-label="关闭资产库"
                        @click="showAssetSidebar = false"
                    />
                </header>
                <div class="asset-sidebar-tabs">
                    <button
                        type="button"
                        :class="{ active: assetSidebarTab === 'elements' }"
                        @click="assetSidebarTab = 'elements'"
                    >
                        <span>画布元素</span>
                        <em>{{ canvasElementItems.length }}</em>
                    </button>
                    <button
                        type="button"
                        :class="{ active: assetSidebarTab === 'assets' }"
                        @click="assetSidebarTab = 'assets'"
                    >
                        <span>资产</span>
                        <em>{{ projectAssetItems.length }}</em>
                    </button>
                </div>
                <div class="asset-sidebar-controls">
                    <div class="asset-sidebar-search">
                        <span aria-hidden="true" />
                        <input v-model="assetSidebarKeyword" type="text" placeholder="搜索" />
                    </div>
                    <div class="asset-sidebar-filter-wrap">
                        <button
                            class="asset-sidebar-filter"
                            type="button"
                            @click="assetSidebarFilterOpen = !assetSidebarFilterOpen"
                        >
                            <span>{{ assetSidebarFilterLabel }}</span>
                            <i aria-hidden="true" />
                        </button>
                        <div v-if="assetSidebarFilterOpen" class="asset-sidebar-filter-menu">
                            <button
                                v-for="option in assetSidebarFilterOptions"
                                :key="option.value"
                                type="button"
                                :class="{ active: assetSidebarFilter === option.value }"
                                @click="selectAssetSidebarFilter(option.value)"
                            >
                                {{ option.label }}
                            </button>
                        </div>
                    </div>
                </div>
                <div class="asset-sidebar-list">
                    <button
                        v-for="item in visibleAssetSidebarItems"
                        :key="item.id"
                        class="asset-sidebar-item"
                        type="button"
                        :class="{ active: selectedIds.has(item.id) }"
                        @click="selectAssetSidebarItem(item.id)"
                    >
                        <span
                            class="asset-sidebar-thumb"
                            :class="[`is-${item.type}`, { 'has-thumb': item.thumb }]"
                        >
                            <img
                                v-if="item.thumb"
                                :src="item.thumb"
                                alt=""
                                @error="handleAssetThumbError(item)"
                            />
                            <img v-else :src="item.icon" alt="" />
                        </span>
                        <span class="asset-sidebar-text">
                            <strong>{{ item.title }}</strong>
                            <small>{{ item.subtitle }}</small>
                        </span>
                    </button>
                    <div v-if="!visibleAssetSidebarItems.length" class="asset-sidebar-empty">
                        暂无内容
                    </div>
                </div>
                <div class="asset-sidebar-footer">
                    共 {{ visibleAssetSidebarItems.length }} 个节点
                </div>
            </aside>

            <aside class="canvas-rail" @pointerdown.stop>
                <button
                    class="rail-button rail-button-primary"
                    type="button"
                    aria-label="添加节点"
                    title="添加节点"
                    @click="showAddMenu = !showAddMenu"
                >
                    <img src="/aigc_canva/icon/add-node.svg" alt="" />
                </button>
                <button
                    class="rail-button"
                    type="button"
                    aria-label="素材库"
                    title="素材库"
                    @click="staticTool('素材库')"
                >
                    <img src="/aigc_canva/icon/asset-library.svg" alt="" />
                </button>
                <button
                    class="rail-button"
                    type="button"
                    aria-label="角色库"
                    title="角色库"
                    @click="staticTool('角色库')"
                >
                    <img src="/aigc_canva/icon/character-library.svg" alt="" />
                </button>
                <button
                    class="rail-button"
                    type="button"
                    :class="{ active: showAssetSidebar }"
                    aria-label="资产库"
                    title="资产库"
                    @click="showAssetSidebar = !showAssetSidebar"
                >
                    <img src="/aigc_canva/icon/asset-management.svg" alt="" />
                </button>
                <button
                    class="rail-button"
                    type="button"
                    aria-label="教程帮助"
                    title="教程帮助"
                    @click="shortcutsOpen = !shortcutsOpen"
                >
                    <img src="/aigc_canva/icon/tutorial.svg" alt="" />
                </button>
                <input
                    ref="uploadInput"
                    class="hidden-input"
                    type="file"
                    accept="image/*,video/*,audio/*"
                    @change="handleToolbarUpload"
                />
            </aside>

            <section v-if="showAddMenu" class="floating-palette" @pointerdown.stop>
                <button type="button" @click="addNodeFromRail('text')">
                    <img src="/aigc_canva/icon/text.svg" alt="" />
                    <span>文本</span>
                </button>
                <button type="button" @click="addNodeFromRail('image')">
                    <img src="/aigc_canva/icon/pic.svg" alt="" />
                    <span>图片</span>
                </button>
                <button type="button" @click="addNodeFromRail('video')">
                    <img src="/aigc_canva/icon/shipin.svg" alt="" />
                    <span>视频</span>
                </button>
                <button type="button" @click="addNodeFromRail('audio')">
                    <img src="/short-drama/figma/icon/shengyin.svg" alt="" />
                    <span>音乐</span>
                </button>
            </section>

            <aside class="bottom-toolbar" @pointerdown.stop @click="zoomMenu = null">
                <button class="toolbar-button" type="button" title="重置" @click="resetViewport">
                    <img src="/aigc_canva/icon/bottom_refresh.png" alt="" />
                </button>
                <button
                    class="toolbar-button"
                    type="button"
                    :class="{ active: !showConnections }"
                    title="隐藏连线"
                    @click="showConnections = !showConnections"
                >
                    <img
                        :src="
                            showConnections
                                ? '/aigc_canva/icon/node-edges-route.svg'
                                : '/aigc_canva/icon/node-edges-route-off.svg'
                        "
                        alt=""
                    />
                </button>
                <button class="toolbar-button" type="button" title="整理画布" @click="fitCanvas">
                    <img src="/aigc_canva/icon/tidy-canvas.svg" alt="" />
                </button>
                <button
                    class="toolbar-button"
                    type="button"
                    :class="{ active: showMiniMap }"
                    title="画布小地图"
                    @click="showMiniMap = !showMiniMap"
                >
                    <img src="/aigc_canva/icon/bottom_grid.png" alt="" />
                </button>
                <button
                    class="toolbar-button"
                    type="button"
                    title="网格吸附"
                    @click="staticTool('网格吸附')"
                >
                    <img src="/aigc_canva/icon/snap-to-grid.svg" alt="" />
                </button>
                <span class="toolbar-divider" />
                <button class="toolbar-button" type="button" title="缩小" @click="zoomBy(0.86)">
                    <span class="zoom-symbol zoom-symbol-minus" aria-hidden="true" />
                </button>
                <button class="zoom-value" type="button" @click.stop="toggleZoomMenu">
                    {{ Math.round(viewport.k * 100) }}%
                </button>
                <button class="toolbar-button" type="button" title="放大" @click="zoomBy(1.16)">
                    <span class="zoom-symbol zoom-symbol-plus" aria-hidden="true" />
                </button>
            </aside>

            <section
                v-if="zoomMenu"
                class="zoom-menu"
                :style="zoomMenuStyle"
                @pointerdown.stop
                @click.stop
            >
                <button class="zoom-menu-current" type="button">
                    <span>{{ Math.round(viewport.k * 100) }}</span>
                    <em>%</em>
                </button>
                <button class="zoom-menu-row" type="button" @click="runZoomMenuAction('in')">
                    <span>放大</span>
                    <kbd>{{ shortcutPrefix }}+</kbd>
                </button>
                <button class="zoom-menu-row" type="button" @click="runZoomMenuAction('out')">
                    <span>缩小</span>
                    <kbd>{{ shortcutPrefix }}-</kbd>
                </button>
                <button class="zoom-menu-row" type="button" @click="runZoomMenuAction('fit')">
                    <span>适合屏幕</span>
                    <kbd>{{ shortcutPrefix }}0</kbd>
                </button>
                <span class="zoom-menu-divider" />
                <button class="zoom-menu-row" type="button" @click="runZoomMenuAction(0.5)">
                    缩放至 50%
                </button>
                <button class="zoom-menu-row" type="button" @click="runZoomMenuAction(1)">
                    缩放至 100%
                </button>
                <button class="zoom-menu-row" type="button" @click="runZoomMenuAction(3)">
                    缩放至 300%
                </button>
            </section>

            <div class="edge-scrollbar" aria-hidden="true" />

            <aside v-if="showMiniMap" class="mini-map" @pointerdown.stop="handleMiniMapPointer">
                <div
                    v-for="node in nodes"
                    :key="node.id"
                    class="mini-node"
                    :style="miniNodeStyle(node)"
                />
                <div class="mini-viewport" :style="miniViewportStyle" />
            </aside>

            <section v-if="shortcutsOpen" class="shortcut-popover" @pointerdown.stop>
                <header>
                    <strong>快捷键</strong>
                    <button type="button" @click="shortcutsOpen = false">×</button>
                </header>
                <p><span>滚动画布</span><b>鼠标滚轮</b></p>
                <p><span>缩放画布</span><b>Ctrl/Cmd + 鼠标滚轮</b></p>
                <p><span>拖动画布</span><b>鼠标中键拖拽</b></p>
                <p><span>框选节点</span><b>左键空白拖拽</b></p>
                <p><span>复制/粘贴</span><b>Ctrl/Cmd + C/V</b></p>
                <p><span>撤销/重做</span><b>Ctrl/Cmd + Z/Y</b></p>
                <p><span>删除</span><b>Delete / Backspace</b></p>
            </section>

            <section
                v-if="contextMenu"
                class="context-menu"
                :class="contextMenu.mode === 'add' ? 'context-menu-add' : 'context-menu-root'"
                :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
                @pointerdown.stop
            >
                <template v-if="contextMenu.nodeId">
                    <button
                        class="context-menu-row"
                        type="button"
                        @click="duplicateNode(contextMenu.nodeId)"
                    >
                        <span>复制</span>
                    </button>
                    <button
                        class="context-menu-row"
                        type="button"
                        @click="removeNode(contextMenu.nodeId)"
                    >
                        <span>删除</span>
                    </button>
                </template>
                <template v-else-if="contextMenu.connectionId">
                    <button
                        class="context-menu-row"
                        type="button"
                        @click="removeConnection(contextMenu.connectionId)"
                    >
                        <span>删除连线</span>
                    </button>
                </template>
                <template v-else-if="contextMenu.mode === 'add'">
                    <div class="context-menu-title">添加节点</div>
                    <button
                        class="context-menu-row context-node-row"
                        type="button"
                        @click="addNodeFromContext('text')"
                    >
                        <img class="context-node-icon" src="/aigc_canva/icon/text.svg" alt="" />
                        <span>文本</span>
                    </button>
                    <button
                        class="context-menu-row context-node-row"
                        type="button"
                        @click="addNodeFromContext('image')"
                    >
                        <img class="context-node-icon" src="/aigc_canva/icon/pic.svg" alt="" />
                        <span>图片</span>
                    </button>
                    <button
                        class="context-menu-row context-node-row"
                        type="button"
                        @click="addNodeFromContext('video')"
                    >
                        <img class="context-node-icon" src="/aigc_canva/icon/shipin.svg" alt="" />
                        <span>视频</span>
                    </button>
                    <button
                        class="context-menu-row context-node-row"
                        type="button"
                        @click="addNodeFromContext('audio')"
                    >
                        <img
                            class="context-node-icon"
                            src="/short-drama/figma/icon/shengyin.svg"
                            alt=""
                        />
                        <span>音乐</span>
                    </button>
                </template>
                <template v-else>
                    <button class="context-menu-row" type="button" @click="uploadFromContext">
                        <span>上传</span>
                    </button>
                    <button class="context-menu-row is-disabled" type="button" disabled>
                        <span>保存到我的资产</span>
                    </button>
                    <button class="context-menu-row" type="button" @click="openContextAddMenu">
                        <span>添加节点</span>
                    </button>
                    <span class="context-menu-divider" />
                    <button
                        class="context-menu-row"
                        type="button"
                        :disabled="!canUndo"
                        :class="{ 'is-disabled': !canUndo }"
                        @click="undoFromContext"
                    >
                        <span>撤销</span>
                        <kbd>{{ shortcutPrefix }}Z</kbd>
                    </button>
                    <button
                        class="context-menu-row"
                        type="button"
                        :disabled="!canRedo"
                        :class="{ 'is-disabled': !canRedo }"
                        @click="redoFromContext"
                    >
                        <span>重做</span>
                        <kbd>{{ shortcutPrefix }}Shift+Z</kbd>
                    </button>
                    <span class="context-menu-divider" />
                    <button class="context-menu-row" type="button" @click="pasteFromContext">
                        <span>粘贴</span>
                        <kbd>{{ shortcutPrefix }}V</kbd>
                    </button>
                </template>
            </section>

            <section
                v-if="connectionCreateMenu"
                class="context-menu connection-create-menu"
                :style="{ left: `${connectionCreateMenu.x}px`, top: `${connectionCreateMenu.y}px` }"
                @pointerdown.stop
            >
                <div class="context-menu-title">添加节点</div>
                <button
                    class="context-menu-row context-node-row"
                    type="button"
                    @click="createConnectedNode('text')"
                >
                    <img class="context-node-icon" src="/aigc_canva/icon/text.svg" alt="" />
                    <span>文本</span>
                </button>
                <button
                    class="context-menu-row context-node-row"
                    type="button"
                    @click="createConnectedNode('image')"
                >
                    <img class="context-node-icon" src="/aigc_canva/icon/pic.svg" alt="" />
                    <span>图片</span>
                </button>
                <button
                    class="context-menu-row context-node-row"
                    type="button"
                    @click="createConnectedNode('video')"
                >
                    <img class="context-node-icon" src="/aigc_canva/icon/shipin.svg" alt="" />
                    <span>视频</span>
                </button>
                <button
                    class="context-menu-row context-node-row"
                    type="button"
                    @click="createConnectedNode('audio')"
                >
                    <img
                        class="context-node-icon"
                        src="/short-drama/figma/icon/shengyin.svg"
                        alt=""
                    />
                    <span>音乐</span>
                </button>
            </section>
        </main>

        <CanvasAgentPanel
            v-if="userStore.isLogin"
            ref="agentPanelRef"
            :project-id="currentProject?.id"
            :canvas-snapshot="canvasAgentSnapshot"
            :image-options="agentImageOptions"
            :video-options="agentVideoOptions"
            :image-config="agentImageConfig"
            :video-config="agentVideoConfig"
            :generating-media="agentMediaGenerating"
            :media-generation-status="agentMediaGenerationStatus"
            :initial-composer="initialAgentComposer"
            @apply-action="applyAgentWorkspaceAction"
            @open-asset-library="openAgentAssetLibrary"
            @update-media-config="updateAgentMediaConfig"
            @generate-media="generateAgentMedia"
            @preview-media="openAgentMediaPreview"
            @layout-change="handleAgentPanelLayoutChange"
        />

        <div
            v-if="mediaPreview"
            class="media-preview-overlay"
            @pointerdown.self="closeMediaPreview"
        >
            <button
                class="media-preview-close"
                type="button"
                title="关闭"
                @click="closeMediaPreview"
            >
                ×
            </button>
            <figure class="media-preview-dialog" @pointerdown.stop>
                <img v-if="mediaPreview.type === 'image'" :src="mediaPreview.url" alt="" />
                <audio
                    v-else-if="mediaPreview.type === 'audio'"
                    :src="mediaPreview.url"
                    controls
                    autoplay
                />
                <video
                    v-else
                    :src="mediaPreview.url"
                    :poster="mediaPreview.poster"
                    controls
                    autoplay
                    muted
                    playsinline
                />
            </figure>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CanvasAccountActions from '@/apps/aigc_canvas/components/CanvasAccountActions.vue'
import CanvasAgentPanel from '@/apps/aigc_canvas/components/agent/CanvasAgentPanel.vue'
import CanvasNode from '@/apps/aigc_canvas/components/native/CanvasNode.vue'
import type {
    CanvasConnection,
    CanvasMention,
    CanvasNodeData,
    CanvasNodeExternalReference,
    CanvasNodeType,
    CanvasProject
} from '@/apps/aigc_canvas/types'
import type { SelectionBoxState } from '@/apps/aigc_canvas/composables/useCanvasViewport'
import { useCanvasViewport } from '@/apps/aigc_canvas/composables/useCanvasViewport'
import {
    createCanvasProject,
    createId,
    createNativeCanvasNode,
    createNativeConnection,
    loadCanvasProjects,
    loadRemoteCanvasProjectDetail,
    saveCanvasProjects,
    saveRemoteCanvasProject,
    updateProjectThumbnail
} from '@/apps/aigc_canvas/stores/projects'
import {
    applyCanvasAgentWorkspaceAction,
    getCanvasRunLists,
    proxyChat,
    proxyImage,
    proxyImageQuery,
    proxyMusic,
    proxyMusicQuery,
    proxyVideo,
    proxyVideoQuery,
    registerCanvasAgentAsset,
    streamCanvasText
} from '@/apps/aigc_canvas/api'
import { getAigcImageConfig } from '@/apps/aigc_image/api'
import { generateAigcLocalRedraw, getAigcLocalRedrawTask } from '@/apps/aigc_local_redraw/api'
import { getAigcVideoConfig } from '@/apps/aigc_video/api'
import { getAigcMusicConfig, uploadAigcMusicAudio } from '@/apps/aigc_music/api'
import { getAigcLlmConfig } from '@/apps/aigc_llm/api'
import { uploadImage as uploadAppImage, uploadVideo as uploadAppVideo } from '@/api/app'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { useUserStore } from '@/stores/user'
import { getApiUrl } from '@/utils/env'
import { normalizeFileUrl } from '@/utils/file-url'
import AiWorkspaceAssetGalleryModal from '~/components/ai-workspace/asset-gallery-modal.vue'

definePageMeta({ layout: 'blank', auth: false })

type HistoryEntry = { nodes: CanvasNodeData[]; connections: CanvasConnection[] }
type CanvasClipboardPayload = { nodes: CanvasNodeData[]; connections: CanvasConnection[] }
type ContextMenuState = {
    x: number
    y: number
    nodeId?: string
    connectionId?: string
    mode?: 'root' | 'add'
}
type CanvasNodeOptionValue = {
    label: string
    value: string | number
    [key: string]: any
}
type CanvasNodeOption = {
    key: string
    values: CanvasNodeOptionValue[]
    defaultValue?: string | number
    icon?: string
}
type AgentMediaMode = 'image' | 'video'
type AgentMediaConfigPayload = { mode: AgentMediaMode; key: string; value: string | number }
type AgentMediaGeneratePayload = {
    jobId?: string
    mode: AgentMediaMode
    prompt: string
    config: Record<string, any>
    attachments?: Array<Record<string, any>>
}
type AgentMediaGenerationStatus = {
    jobId?: string
    mode?: AgentMediaMode
    status?: 'running' | 'success' | 'failed'
    nodeId?: string
    actionId?: string | number
    taskId?: string | number
    url?: string
    poster?: string
    ratio?: string | number
    type?: 'image' | 'video' | 'audio'
    error?: string
}
type AssetSidebarTab = 'elements' | 'assets'
type AssetSidebarFilter = 'all' | 'text' | 'image' | 'video' | 'audio' | 'success' | 'idle'
type AssetSidebarItem = {
    id: string
    type: CanvasNodeType | 'asset'
    status: string
    title: string
    subtitle: string
    icon: string
    thumb: string
}
type MediaPreviewState = {
    type: 'image' | 'video' | 'audio'
    url: string
    poster?: string
    title: string
}

class GenerationPendingError extends Error {
    taskId?: string | number

    constructor(message: string, taskId?: string | number) {
        super(message)
        this.name = 'GenerationPendingError'
        this.taskId = taskId
    }
}

function isGenerationPendingError(error: unknown): error is GenerationPendingError {
    return error instanceof GenerationPendingError
}

const route = useRoute()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()

const stageRef = ref<HTMLElement | null>(null)
const uploadInput = ref<HTMLInputElement | null>(null)
type CanvasNodeExpose = {
    playPreviewVideo?: () => void
    getConnectionAnchor?: (side: 'left' | 'right') => { x: number; y: number } | null
}
type InitialAgentComposerPayload = {
    draft?: string
    mode?: 'agent' | 'image' | 'video'
    selectedSkill?: string
    selectedSkillPrompt?: string
    attachments?: any[]
    imageConfig?: Record<string, any>
    videoConfig?: Record<string, any>
    autoSubmit?: boolean
} | null
const nodeRefs = ref<Record<string, CanvasNodeExpose>>({})
const nodes = ref<CanvasNodeData[]>([])
const connections = ref<CanvasConnection[]>([])
const currentProject = ref<CanvasProject | null>(null)
const projectNameDraft = ref('')
const selectedIds = ref(new Set<string>())
const selectedConnectionId = ref('')
const runningNodeId = ref('')
const saveState = ref('已自动保存')
const showMiniMap = ref(false)
const shortcutsOpen = ref(false)
const showAddMenu = ref(false)
const showAssetSidebar = ref(false)
const assetSidebarTab = ref<AssetSidebarTab>('elements')
const assetSidebarKeyword = ref('')
const assetSidebarFilter = ref<AssetSidebarFilter>('all')
const assetSidebarFilterOpen = ref(false)
const showConnections = ref(true)
const zoomMenu = ref<{ x: number; bottomY: number } | null>(null)
const contextMenu = ref<ContextMenuState | null>(null)
const connectionCreateMenu = ref<{
    x: number
    y: number
    worldX: number
    worldY: number
    fromNodeId?: string
    fromNodeIds?: string[]
    targetNodeId?: string
} | null>(null)
const connecting = ref<{
    fromNodeId?: string
    fromNodeIds?: string[]
    targetNodeId?: string
    current: { x: number; y: number }
} | null>(null)
const selectionBaseIds = ref(new Set<string>())
const history = ref<HistoryEntry[]>([])
const historyIndex = ref(-1)
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const imageRefreshTimer = ref<ReturnType<typeof setInterval> | null>(null)
const imageRefreshInFlight = ref(false)
const localRedrawRefreshTimer = ref<ReturnType<typeof setInterval> | null>(null)
const localRedrawRefreshInFlight = ref(false)
const musicRefreshTimer = ref<ReturnType<typeof setInterval> | null>(null)
const musicRefreshInFlight = ref(false)
const miniMapDragging = ref(false)
const showAssetGallery = ref(false)
const assetGalleryNodeId = ref('')
const assetGalleryTarget = ref<'node' | 'agent'>('node')
const agentAssetGalleryAcceptTypes = ref<Array<'image' | 'video' | 'audio'>>([
    'image',
    'video'
])
const agentPanelRef = ref<any>(null)
const registeredAssets = ref<any[]>([])
const brokenAssetThumbs = ref(new Set<string>())
const mediaPreview = ref<MediaPreviewState | null>(null)
const agentPanelLayout = ref({ collapsed: false, width: 400, resizing: false })
const initialAgentComposer = ref<InitialAgentComposerPayload>(null)
const topbarRightStyle = computed(() => ({
    transform: agentPanelLayout.value.collapsed
        ? 'translateX(0)'
        : `translateX(-${agentPanelLayout.value.width}px)`,
    transition: agentPanelLayout.value.resizing ? 'none' : 'transform 180ms ease'
}))
const canvasFocusStyle = computed(() => {
    const panelWidth =
        userStore.isLogin && !agentPanelLayout.value.collapsed ? agentPanelLayout.value.width : 0
    return {
        '--canvas-agent-panel-width': `${panelWidth}px`,
        '--canvas-agent-center-transition': agentPanelLayout.value.resizing
            ? 'none'
            : 'left 180ms ease, transform 180ms ease'
    }
})

function handleAgentPanelLayoutChange(payload: {
    collapsed: boolean
    width: number
    resizing: boolean
}) {
    agentPanelLayout.value = {
        collapsed: Boolean(payload.collapsed),
        width: Math.min(600, Math.max(400, Number(payload.width) || 400)),
        resizing: Boolean(payload.resizing)
    }
}
const dragState = ref<{
    active: boolean
    pending: boolean
    startX: number
    startY: number
    moved: boolean
    initial: Array<{ id: string; x: number; y: number }>
}>({ active: false, pending: false, startX: 0, startY: 0, moved: false, initial: [] })

const {
    viewport,
    transformStyle,
    isPanning,
    selectionBox,
    setViewport,
    centerViewport,
    screenToCanvas,
    getCanvasCenter,
    handleWheel,
    beginPan,
    updatePan,
    endPan,
    beginSelection,
    updateSelection,
    endSelection
} = useCanvasViewport(stageRef)
const llmOptionConfig = ref<any>({ models: [], defaults: { model: '' } })
const imageOptionConfig = ref<any>({
    channels: [],
    defaults: { channel: 'gpt_image_2', quality: '1k', ratio: '1:1', quantity: 1 },
    quantity_options: [1]
})
const videoOptionConfig = ref<any>({
    channels: [],
    defaults: {
        channel: 'seedance2_pro',
        quality: 'seedance2_pro',
        ratio: 'adaptive',
        duration: 5,
        mode: 'pro',
        quantity: 1
    },
    quantity_options: [1]
})
const agentImageConfig = ref<Record<string, any>>({})
const agentVideoConfig = ref<Record<string, any>>({})
const agentMediaGenerating = ref(false)
const agentMediaGeneratingCount = ref(0)
const agentMediaGenerationStatus = ref<AgentMediaGenerationStatus>({})
const musicOptionConfig = ref<any>({
    channels: [],
    defaults: { channel: '', quality: '', duration: 30, instrumental: false },
    duration_options: [30, 60, 120]
})

const shortcutPrefix = computed(() => 'Ctrl+')
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)
const assetGalleryAcceptTypes = computed<Array<'image' | 'video' | 'audio'>>(() => {
    if (assetGalleryTarget.value === 'agent') return agentAssetGalleryAcceptTypes.value
    const node = findNode(assetGalleryNodeId.value)
    if (node?.type === 'audio') return ['audio']
    return node?.type === 'video' ? ['image', 'video'] : ['image']
})
const assetSidebarFilterOptions: Array<{ label: string; value: AssetSidebarFilter }> = [
    { label: '全部', value: 'all' },
    { label: '文本', value: 'text' },
    { label: '图片', value: 'image' },
    { label: '视频', value: 'video' },
    { label: '音乐', value: 'audio' },
    { label: '已生成', value: 'success' },
    { label: '未生成', value: 'idle' }
]
const assetSidebarFilterLabel = computed(
    () =>
        assetSidebarFilterOptions.find((item) => item.value === assetSidebarFilter.value)?.label ||
        '全部'
)
const canvasElementItems = computed<AssetSidebarItem[]>(() => nodes.value.map(toAssetSidebarItem))
const projectAssetItems = computed<AssetSidebarItem[]>(() =>
    registeredAssets.value.map(toRegisteredAssetSidebarItem)
)
const canvasAgentSnapshot = computed(() => {
    const selected = nodes.value
        .filter((node) => selectedIds.value.has(node.id))
        .slice(0, 8)
        .map((node) => ({
            id: node.id,
            type: node.type,
            title: node.title,
            prompt: String(node.metadata.prompt || ''),
            content: String(node.metadata.content || ''),
            url: String(node.metadata.image || node.metadata.url || ''),
            image: String(node.metadata.image || ''),
            position: { ...node.position },
            size: { width: node.width, height: node.height },
            status: String(node.metadata.status || 'idle')
        }))
    const typeCounts = nodes.value.reduce<Record<string, number>>((result, node) => {
        result[node.type] = (result[node.type] || 0) + 1
        return result
    }, {})
    return {
        project: {
            id: currentProject.value?.id || '',
            name: currentProject.value?.name || ''
        },
        canvas_summary: `当前画布有 ${nodes.value.length} 个节点，文本 ${typeCounts.text || 0} 个，图片 ${typeCounts.image || 0} 个，视频 ${typeCounts.video || 0} 个，音频 ${typeCounts.audio || 0} 个。`,
        selected_elements: selected,
        agent_generation_results: nodes.value
            .filter(
                (node) =>
                    node.metadata.agentActionId ||
                    node.metadata.taskId ||
                    node.metadata.providerTaskId
            )
            .map((node) => ({
                actionId: node.metadata.agentActionId || '',
                taskId: node.metadata.taskId || node.metadata.providerTaskId || '',
                nodeId: node.id,
                type: node.type,
                status: node.metadata.status || 'idle',
                url: node.metadata.image || node.metadata.url || '',
                poster: node.metadata.poster || '',
                ratio: node.metadata.ratio || ''
            })),
        recent_assets: registeredAssets.value.slice(0, 12).map((asset: any) => ({
            id: asset.id,
            type: asset.type || asset.asset_type,
            title: asset.title || asset.name || '',
            url: asset.url || asset.uri || '',
            cover_url: asset.cover_url || ''
        }))
    }
})
const visibleAssetSidebarItems = computed(() => {
    const keyword = assetSidebarKeyword.value.trim().toLowerCase()
    const source =
        assetSidebarTab.value === 'elements' ? canvasElementItems.value : projectAssetItems.value
    return source.filter((item) => {
        const matchesKeyword =
            !keyword || `${item.title} ${item.subtitle}`.toLowerCase().includes(keyword)
        const filter = assetSidebarFilter.value
        const matchesFilter =
            filter === 'all' ||
            item.type === filter ||
            (filter === 'success' && item.status === 'success') ||
            (filter === 'idle' && item.status !== 'success')
        return matchesKeyword && matchesFilter
    })
})
const visibleConnections = computed(() =>
    showConnections.value
        ? connections.value.filter(
              (connection) => findNode(connection.fromNodeId) && findNode(connection.toNodeId)
          )
        : []
)
const gridStyle = computed(() => {
    const gap = 32
    return {
        backgroundSize: `${gap}px ${gap}px`,
        backgroundPosition: `${viewport.value.x % gap}px ${viewport.value.y % gap}px`
    }
})
const zoomMenuStyle = computed(() => {
    const menu = zoomMenu.value
    if (!menu) return {}
    return {
        left: `${menu.x}px`,
        top: `${menu.bottomY - 4}px`
    }
})
const selectionBoxStyle = computed(() => {
    const box = selectionBox.value
    if (!box) return {}
    return {
        left: `${Math.min(box.startWorldX, box.currentWorldX)}px`,
        top: `${Math.min(box.startWorldY, box.currentWorldY)}px`,
        width: `${Math.abs(box.currentWorldX - box.startWorldX)}px`,
        height: `${Math.abs(box.currentWorldY - box.startWorldY)}px`
    }
})
const selectedNodeBounds = computed(() => {
    if (selectedIds.value.size <= 1) return null
    const selected = nodes.value.filter((node) => selectedIds.value.has(node.id))
    if (selected.length <= 1) return null
    const padding = 16 / Math.max(viewport.value.k, 0.05)
    const bounds = selected.map(getCanvasNodeVisualBounds)
    const minX = Math.min(...bounds.map((item) => item.minX)) - padding
    const minY = Math.min(...bounds.map((item) => item.minY)) - padding
    const maxX = Math.max(...bounds.map((item) => item.maxX)) + padding
    const maxY = Math.max(...bounds.map((item) => item.maxY)) + padding
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
})
const multiSelectionBounds = computed(() => (!selectionBox.value ? selectedNodeBounds.value : null))
const multiSelectionBoundsStyle = computed(() => {
    const bounds = multiSelectionBounds.value
    if (!bounds) return {}
    return {
        left: `${bounds.minX}px`,
        top: `${bounds.minY}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`
    }
})

function getCanvasNodeVisualBounds(node: CanvasNodeData) {
    const scale = viewport.value.k > 0 ? 1 / viewport.value.k : 1
    const headTop = 28 * scale
    const headSpace = 46 * scale
    const bodyHeight =
        node.type === 'image' || node.type === 'video' ? 191 : node.type === 'audio' ? 170 : 112
    return {
        minX: node.position.x,
        minY: node.position.y + headTop,
        maxX: node.position.x + node.width,
        maxY: node.position.y + Math.max(node.height, headSpace + bodyHeight)
    }
}
const tempConnectionPaths = computed(() => {
    if (!connecting.value) return []
    if (connecting.value.targetNodeId) {
        const target = findNode(connecting.value.targetNodeId)
        return target ? [pathBetween(connecting.value.current, nodeInputPoint(target))] : []
    }
    return resolveConnectionSourceIds(connecting.value)
        .map((id) => findNode(id))
        .filter((node): node is CanvasNodeData => !!node)
        .map((source) => pathBetween(nodeOutputPoint(source), connecting.value!.current))
})
const miniBounds = computed(() => {
    if (!nodes.value.length) return { minX: -600, minY: -400, maxX: 600, maxY: 400, scale: 0.14 }
    const minX = Math.min(...nodes.value.map((node) => node.position.x)) - 400
    const minY = Math.min(...nodes.value.map((node) => node.position.y)) - 300
    const maxX = Math.max(...nodes.value.map((node) => node.position.x + node.width)) + 400
    const maxY = Math.max(...nodes.value.map((node) => node.position.y + node.height)) + 300
    return {
        minX,
        minY,
        maxX,
        maxY,
        scale: Math.min(220 / Math.max(1, maxX - minX), 140 / Math.max(1, maxY - minY))
    }
})
const miniViewportStyle = computed(() => {
    const rect = stageRef.value?.getBoundingClientRect()
    const bounds = miniBounds.value
    const worldX = -viewport.value.x / viewport.value.k
    const worldY = -viewport.value.y / viewport.value.k
    return {
        left: `${(worldX - bounds.minX) * bounds.scale}px`,
        top: `${(worldY - bounds.minY) * bounds.scale}px`,
        width: `${((rect?.width || 0) / viewport.value.k) * bounds.scale}px`,
        height: `${((rect?.height || 0) / viewport.value.k) * bounds.scale}px`
    }
})
function buildTextNodeOptions(): CanvasNodeOption[] {
    const models = Array.isArray(llmOptionConfig.value.models) ? llmOptionConfig.value.models : []
    const values = uniqueOptions(
        models
            .map((model: any) => ({
                label: String(model.name || model.label || model.code || '默认模型'),
                value: String(model.code || model.value || '')
            }))
            .filter((item: CanvasNodeOptionValue) => item.value !== '')
    )
    const defaultValue = String(llmOptionConfig.value.defaults?.model || values[0]?.value || '')
    return [
        {
            key: 'model_code',
            values: values.length ? values : [{ label: '默认模型', value: defaultValue }],
            defaultValue
        }
    ]
}

function getNodeOptions(node: CanvasNodeData): CanvasNodeOption[] {
    if (node.type === 'text' || node.type === 'config') return buildTextNodeOptions()
    if (node.type === 'image') return buildImageNodeOptionsForNode(node)
    if (node.type === 'audio') return buildMusicNodeOptionsForNode(node)
    return buildVideoNodeOptionsForNode(node)
}

const agentImageOptions = computed(() =>
    buildImageNodeOptionsForNode({ metadata: agentImageConfig.value } as CanvasNodeData)
)
const agentVideoOptions = computed(() =>
    buildVideoNodeOptionsForNode({ metadata: agentVideoConfig.value } as CanvasNodeData)
)

function buildMusicNodeOptionsForNode(node?: CanvasNodeData): CanvasNodeOption[] {
    const config = musicOptionConfig.value || {}
    const defaults = config.defaults || {}
    const metadata = node?.metadata || {}
    const channels = uniqueOptions(
        (Array.isArray(config.channels) ? config.channels : [])
            .map((channel: any) => ({
                label: String(channel.label || channel.name || channel.code || '音乐模型'),
                value: String(channel.value || channel.code || '')
            }))
            .filter((item: CanvasNodeOptionValue) => item.value)
    )
    const durations = uniqueOptions(
        (config.duration_options || [30, 60, 120]).map((item: any) => ({
            label: `${Number(item) || item}秒`,
            value: Number(item) || 30
        }))
    )
    const options: CanvasNodeOption[] = []
    if (channels.length) {
        options.push({
            key: 'channel',
            values: channels,
            defaultValue: metadata.channel || defaults.channel || channels[0]?.value || ''
        })
    }
    options.push(
        {
            key: 'duration',
            values: durations.length ? durations : [{ label: '30秒', value: 30 }],
            defaultValue: Number(
                metadata.duration || defaults.duration || durations[0]?.value || 30
            )
        },
        {
            key: 'instrumental',
            values: [
                { label: '人声', value: 0 },
                { label: '纯音乐', value: 1 }
            ],
            defaultValue: metadata.instrumental ? 1 : 0
        }
    )
    return options
}

function normalizeImageChannels(config: any) {
    return (Array.isArray(config?.channels) ? config.channels : [])
        .map((channel: any) => ({
            label: String(channel.label || channel.name || channel.code || '生图模型'),
            value: String(channel.value || channel.code || ''),
            quantity_options: (channel.quantity_options || config.quantity_options || [1])
                .map((item: any) => Number(item))
                .filter(Boolean),
            qualities: (channel.qualities || [])
                .map((quality: any) => ({
                    label: String(
                        quality.label ||
                            quality.quality_label ||
                            quality.value ||
                            quality.quality ||
                            ''
                    ).toUpperCase(),
                    value: String(quality.value || quality.quality || ''),
                    ratios: (quality.ratios || [])
                        .map((ratio: any) => ({
                            ...ratio,
                            label: String(ratio.label || ratio.ratio || ratio.value || ''),
                            value: String(ratio.value || ratio.ratio || '')
                        }))
                        .filter((ratio: CanvasNodeOptionValue) => ratio.value)
                }))
                .filter((quality: any) => quality.value)
        }))
        .filter((channel: any) => channel.value)
}

function optionValues(
    items: Array<{ label: string; value: string | number }>,
    fallbackLabel: string,
    fallbackValue: string | number
) {
    return items.length ? uniqueOptions(items) : [{ label: fallbackLabel, value: fallbackValue }]
}

function uniqueOptions(items: CanvasNodeOptionValue[]) {
    const seen = new Set<string>()
    return items.filter((item) => {
        const key = String(item.value)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function normalizeNumberOptions(values: unknown[]) {
    return Array.from(new Set(values.map((item) => Number(item)).filter(Boolean))).sort(
        (a, b) => a - b
    )
}

const seedance2ProRatioOptions = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9']
const isInternalModeRatio = (value: unknown) =>
    ['adaptive', 'mode_pro', 'mode_fast'].includes(String(value || '').trim())
const ratioLabel = (value: string) => (value === 'adaptive' ? '自适应' : value)

function getChannelRatioOptions(channel: any) {
    const options = Array.isArray(channel?.ratio_options) ? channel.ratio_options : []
    const normalized = Array.from(
        new Set(
            options
                .map((item: unknown) => String(item || '').trim())
                .filter((item) => item && !isInternalModeRatio(item))
        )
    )
    return normalized.length
        ? normalized
        : String(channel?.value || channel?.code || '') === 'seedance2_pro'
          ? seedance2ProRatioOptions
          : []
}

function normalizeVideoRatioOptions(channel: any, quality: any) {
    const configuredRatios = getChannelRatioOptions(channel)
    if (
        String(channel?.value || channel?.code || '') === 'seedance2_pro' &&
        configuredRatios.length
    ) {
        return configuredRatios.map((ratio) => ({ label: ratioLabel(ratio), value: ratio }))
    }
    return (quality.ratios || [])
        .map((ratio: any) => ({
            ...ratio,
            label: String(ratio.label || ratio.ratio || ratio.value || ''),
            value: String(ratio.value || ratio.ratio || '')
        }))
        .filter((ratio: CanvasNodeOptionValue) => ratio.value && !isInternalModeRatio(ratio.value))
}

const isPlaceholderRatio = (value: unknown) => String(value || '').trim() === 'default'
const secondBillingVideoChannels = ['happy_horse', 'wan', 'seedance2_pro']
const modeLabel = (value: unknown) =>
    String(value || '').toLowerCase() === 'fast' ? 'Fast' : 'Pro'
const formatCostLabel = (value: unknown) => {
    const numeric = Number(value || 0)
    return Number.isFinite(numeric) && numeric > 0 ? Number(numeric.toFixed(4)).toString() : '1'
}
const videoDurationValue = (value: unknown) =>
    Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10) || 0
const videoDurationLabel = (value: unknown) => {
    const duration = videoDurationValue(value)
    return duration > 0 ? String(duration) + '秒' : ''
}
const normalizeVideoResolution = (value: unknown) => {
    const raw = String(value || '')
        .trim()
        .toUpperCase()
    const matched = raw.match(/\d+P|4K|2K|1K|\d+K/)
    return matched?.[0] || '默认'
}
const normalizeVideoDuration = (value: unknown) => {
    const explicit = videoDurationLabel(value)
    if (explicit) return explicit
    const raw = String(value || '').trim()
    const underscored = raw.match(/_(\d+)(?:\D*)$/)
    return underscored ? String(Number(underscored[1])) + '秒' : raw || '默认'
}
const getVideoQualityResolution = (quality: any) =>
    normalizeVideoResolution(
        quality?.resolution ||
            quality?.provider_params_json?.resolution ||
            quality?.label ||
            quality?.quality_label ||
            quality?.value ||
            quality?.quality
    )
const getVideoQualityDuration = (quality: any) =>
    normalizeVideoDuration(
        quality?.duration ||
            quality?.provider_params_json?.duration ||
            quality?.label ||
            quality?.quality_label ||
            quality?.value ||
            quality?.quality
    )
const getVideoSpecResolution = (spec: any) =>
    normalizeVideoResolution(
        spec?.resolution ||
            spec?.provider_params_json?.resolution ||
            spec?.provider_params_json?.quality ||
            spec?.label ||
            spec?.quality_label ||
            spec?.value ||
            spec?.quality
    )
const getVideoSpecRatio = (spec: any) =>
    String(
        spec?.ratio ||
            spec?.value ||
            spec?.provider_params_json?.ratio ||
            spec?.provider_params_json?.aspect_ratio ||
            spec?.provider_params_json?.size ||
            ''
    ).trim()
const getVideoSpecDuration = (spec: any) =>
    videoDurationLabel(
        spec?.duration ??
            spec?.provider_params_json?.duration ??
            spec?.quality ??
            spec?.quality_label
    )
const getVideoSpecDurationValue = (spec: any) => videoDurationValue(getVideoSpecDuration(spec))

function buildImageNodeOptionsForNode(node?: CanvasNodeData): CanvasNodeOption[] {
    const channels = normalizeImageChannels(imageOptionConfig.value)
    const metadata = node?.metadata || {}
    const defaults = imageOptionConfig.value.defaults || {}
    const channel =
        channels.find(
            (item) =>
                String(item.value) ===
                String(metadata.channel || metadata.model || defaults.channel)
        ) || channels[0]
    const qualities = channel?.qualities || []
    const quality =
        qualities.find(
            (item: any) =>
                String(item.value) ===
                String(metadata.quality || metadata.resolution || defaults.quality)
        ) || qualities[0]
    const ratios = (quality?.ratios || []).filter(
        (ratio: any) => ratio.value && !isPlaceholderRatio(ratio.value)
    )
    const defaultRatio = ratios.find(
        (item: any) => String(item.value) === String(defaults.ratio)
    )?.value
    const ratioValue =
        ratios.find((item: any) => String(item.value) === String(metadata.ratio || metadata.size))
            ?.value ||
        defaultRatio ||
        ratios[0]?.value ||
        '16:9'
    const quantities = uniqueOptions(
        (channel?.quantity_options?.length
            ? channel.quantity_options
            : imageOptionConfig.value.quantity_options || [1]
        ).map((item: any) => ({
            label: String(Number(item) || item) + '张',
            value: Number(item) || 1
        }))
    )
    return [
        {
            key: 'channel',
            values: optionValues(channels, '通道选择', 'gpt_image_2'),
            defaultValue: channel?.value || defaults.channel || 'gpt_image_2'
        },
        {
            key: 'quantity',
            values: quantities.length ? quantities : [{ label: '1张', value: 1 }],
            defaultValue: Number(
                metadata.quantity ||
                    metadata.count ||
                    defaults.quantity ||
                    quantities[0]?.value ||
                    1
            )
        },
        {
            key: 'ratio',
            values: ratios.length ? ratios : [{ label: '16:9', value: '16:9' }],
            defaultValue: ratioValue
        },
        {
            key: 'quality',
            values: qualities.length ? qualities : [{ label: '1K', value: '1k' }],
            defaultValue: quality?.value || defaults.quality || '1k'
        }
    ]
}

function normalizeVideoChannelsForCreateConfig(config: any) {
    return (Array.isArray(config?.channels) ? config.channels : [])
        .map((channel: any) => {
            const durationOptions = normalizeNumberOptions(channel.duration_options || [])
            const dynamicDuration = durationOptions.length > 0
            return {
                label: String(channel.label || channel.name || channel.code || '视频模型'),
                value: String(channel.value || channel.code || ''),
                mode_options: Array.isArray(channel.mode_options)
                    ? channel.mode_options.filter((item: string) => ['pro', 'fast'].includes(item))
                    : [],
                generation_modes: Array.isArray(channel.generation_modes)
                    ? channel.generation_modes
                    : [],
                supported_asset_types: Array.isArray(channel.supported_asset_types)
                    ? channel.supported_asset_types
                    : ['image'],
                max_reference_images: Number(channel.max_reference_images || 0),
                max_reference_videos: Number(channel.max_reference_videos || 0),
                max_reference_audios: Number(channel.max_reference_audios || 0),
                max_reference_assets: Number(channel.max_reference_assets || 0),
                ratio_options: getChannelRatioOptions(channel),
                quantity_options: (channel.quantity_options || config.quantity_options || [1])
                    .map((item: any) => Number(item))
                    .filter(Boolean),
                duration_options: durationOptions,
                specs: channel.specs || [],
                qualities: (channel.qualities || [])
                    .map((quality: any) => ({
                        label: dynamicDuration
                            ? getVideoQualityResolution(quality)
                            : getVideoQualityDuration(quality),
                        value: String(quality.value || quality.quality || ''),
                        resolution: getVideoQualityResolution(quality),
                        duration: dynamicDuration ? '' : getVideoQualityDuration(quality),
                        ratios: normalizeVideoRatioOptions(channel, quality)
                    }))
                    .filter((quality: any) => quality.value)
            }
        })
        .filter((channel: any) => channel.value)
}

function getVideoResolutionOptions(channel: any): CanvasNodeOptionValue[] {
    const values = uniqueOptions(
        (channel?.qualities || []).map((quality: any) => ({
            label: quality.resolution || '默认',
            value: quality.resolution || 'default'
        }))
    )
    return values.some((item) => item.value !== 'default') ? values : []
}

function getVideoModeOptions(channel: any): CanvasNodeOptionValue[] {
    return uniqueOptions(
        (channel?.mode_options || []).map((mode: string) => ({
            label: modeLabel(mode),
            value: mode
        }))
    )
}

function findVideoQuality(channel: any, resolution: string, duration: number) {
    const qualities = channel?.qualities || []
    const byResolution = qualities.filter(
        (item: any) => String(item.resolution || 'default') === String(resolution || 'default')
    )
    if (channel?.duration_options?.length) return byResolution[0] || qualities[0]
    return (
        byResolution.find(
            (item: any) =>
                videoDurationValue(item.duration || item.label || item.value) === duration
        ) ||
        byResolution[0] ||
        qualities[0]
    )
}

function getVideoDurationOptions(
    channel: any,
    resolution: string,
    ratio?: unknown,
    mode?: string
): CanvasNodeOptionValue[] {
    if (!channel) return [{ label: '5秒', value: 5 }]
    if (channel.duration_options?.length) {
        const specs = getVideoSpecs(channel, resolution, ratio, mode)
        const specDurations = uniqueOptions(
            specs
                .map((spec: any) => {
                    const duration = getVideoSpecDurationValue(spec)
                    return duration > 0 ? { label: String(duration) + '秒', value: duration } : null
                })
                .filter(Boolean) as CanvasNodeOptionValue[]
        )
        if (specDurations.length)
            return specDurations.sort((a, b) => Number(a.value) - Number(b.value))
        return uniqueOptions(
            channel.duration_options.map((item: any) => ({
                label: String(Number(item) || item) + '秒',
                value: Number(item) || 5
            }))
        )
    }
    return uniqueOptions(
        (channel.qualities || [])
            .filter(
                (quality: any) =>
                    String(quality.resolution || 'default') === String(resolution || 'default')
            )
            .map((quality: any) => {
                const duration = videoDurationValue(
                    quality.duration || quality.label || quality.value
                )
                return {
                    label:
                        duration > 0
                            ? String(duration) + '秒'
                            : String(quality.duration || quality.label || quality.value),
                    value: duration || quality.value
                }
            })
    )
}

function getVideoRatioOptions(
    channel: any,
    resolution: string,
    duration: number,
    mode?: string
): CanvasNodeOptionValue[] {
    if (!channel) return [{ label: '16:9', value: '16:9' }]
    const quality = findVideoQuality(channel, resolution, duration)
    const qualityRatios = quality?.ratios || []
    if (!channel.duration_options?.length || !channel.specs?.length) {
        return qualityRatios.length
            ? qualityRatios
            : channel.ratio_options.map((ratio: string) => ({
                  label: ratioLabel(ratio),
                  value: ratio
              }))
    }
    const specs = getVideoSpecs(channel, resolution, undefined, mode).filter((spec: any) => {
        const specDuration = getVideoSpecDurationValue(spec)
        return !duration || specDuration === duration || specDuration <= 0
    })
    const ratioValues = new Set(specs.map(getVideoSpecRatio).filter(Boolean))
    const filteredRatios = qualityRatios.filter((item: any) => ratioValues.has(item.value))
    if (filteredRatios.length) return filteredRatios
    if (String(channel.value) === 'seedance2_pro') {
        return (
            channel.ratio_options?.length ? channel.ratio_options : seedance2ProRatioOptions
        ).map((ratio: string) => ({ label: ratioLabel(ratio), value: ratio }))
    }
    return uniqueOptions(
        specs
            .map((spec: any) => ({
                label: getVideoSpecRatio(spec),
                value: getVideoSpecRatio(spec)
            }))
            .filter((item: CanvasNodeOptionValue) => item.value && !isInternalModeRatio(item.value))
    )
}

function getVideoSpecs(channel: any, resolution: string, ratio?: unknown, mode?: string) {
    const specs = Array.isArray(channel?.specs) ? channel.specs : []
    const normalizedMode = String(mode || '').toLowerCase()
    return specs.filter((spec: any) => {
        const specMode = String(
            spec?.provider_params_json?.mode || spec?.quality || ''
        ).toLowerCase()
        const matchesMode =
            String(channel?.value) !== 'seedance2_pro' ||
            !normalizedMode ||
            !specMode ||
            specMode === normalizedMode
        const matchesResolution =
            String(getVideoSpecResolution(spec) || 'default') === String(resolution || 'default')
        const specRatio = getVideoSpecRatio(spec)
        const matchesRatio =
            !ratio ||
            String(channel?.value) === 'seedance2_pro' ||
            !specRatio ||
            specRatio === String(ratio)
        return matchesMode && matchesResolution && matchesRatio
    })
}

function buildVideoNodeOptionsForNode(node?: CanvasNodeData): CanvasNodeOption[] {
    const channels = normalizeVideoChannelsForCreateConfig(videoOptionConfig.value)
    const metadata = node?.metadata || {}
    const defaults = videoOptionConfig.value.defaults || {}
    const channel =
        channels.find(
            (item) =>
                String(item.value) ===
                String(metadata.channel || metadata.model || defaults.channel)
        ) || channels[0]
    const modes = getVideoModeOptions(channel)
    const mode = String(
        metadata.mode || metadata.videoMode || defaults.mode || modes[0]?.value || 'pro'
    ).toLowerCase()
    const resolutions = getVideoResolutionOptions(channel)
    const defaultResolution = resolutions.find(
        (item) =>
            String(item.value) ===
            String(
                getVideoQualityResolution(
                    channel?.qualities?.find(
                        (quality: any) => String(quality.value) === String(defaults.quality)
                    )
                )
            )
    )?.value
    const resolution = String(
        resolutions.find((item) => String(item.value) === String(metadata.resolution))?.value ||
            defaultResolution ||
            resolutions[0]?.value ||
            getVideoQualityResolution(channel?.qualities?.[0]) ||
            'default'
    )
    const durations = getVideoDurationOptions(channel, resolution, metadata.ratio, mode)
    const defaultDuration = durations.find(
        (item) => Number(item.value) === Number(defaults.duration)
    )?.value
    const duration = Number(
        durations.find((item) => Number(item.value) === Number(metadata.duration))?.value ||
            defaultDuration ||
            durations[0]?.value ||
            5
    )
    const ratios = getVideoRatioOptions(channel, resolution, duration, mode)
    const defaultRatio = ratios.find((item) => String(item.value) === String(defaults.ratio))?.value
    const ratio =
        ratios.find((item) => String(item.value) === String(metadata.ratio))?.value ||
        defaultRatio ||
        ratios[0]?.value ||
        '16:9'
    const quantities = uniqueOptions(
        (channel?.quantity_options?.length
            ? channel.quantity_options
            : videoOptionConfig.value.quantity_options || [1]
        ).map((item: any) => ({ label: String(Number(item) || item), value: Number(item) || 1 }))
    )
    const options: CanvasNodeOption[] = [
        {
            key: 'channel',
            values: optionValues(channels, '视频模型', 'seedance2_pro'),
            defaultValue: channel?.value || defaults.channel || 'seedance2_pro'
        }
    ]
    if (modes.length > 1) options.push({ key: 'mode', values: modes, defaultValue: mode })
    if (resolutions.length)
        options.push({ key: 'resolution', values: resolutions, defaultValue: resolution })
    options.push(
        {
            key: 'ratio',
            values: ratios.length ? ratios : [{ label: '16:9', value: '16:9' }],
            defaultValue: ratio
        },
        {
            key: 'duration',
            values: durations.length ? durations : [{ label: '5秒', value: 5 }],
            defaultValue: duration
        },
        {
            key: 'quantity',
            values: quantities.length ? quantities : [{ label: '1', value: 1 }],
            defaultValue: Number(
                metadata.quantity ||
                    metadata.count ||
                    defaults.quantity ||
                    quantities[0]?.value ||
                    1
            )
        }
    )
    return options
}

function optionValue(options: CanvasNodeOption[], key: string, rawValue?: unknown) {
    const option = options.find((item) => item.key === key)
    if (!option) return rawValue
    const matched = option.values.find((item) => String(item.value) === String(rawValue))
    return matched?.value ?? option.defaultValue ?? option.values[0]?.value ?? rawValue
}

function findImageRatioForMetadata(metadata: Record<string, any>) {
    const channel = normalizeImageChannels(imageOptionConfig.value).find(
        (item) => String(item.value) === String(metadata.channel)
    )
    const quality =
        channel?.qualities?.find((item: any) => String(item.value) === String(metadata.quality)) ||
        channel?.qualities?.[0]
    return (quality?.ratios || []).find(
        (ratio: any) => String(ratio.value) === String(metadata.ratio)
    )
}

function findVideoSpecForMetadata(channel: any, metadata: Record<string, any>) {
    const duration = Number(metadata.duration || 0)
    const specs = getVideoSpecs(
        channel,
        String(metadata.resolution || 'default'),
        metadata.ratio,
        metadata.mode
    )
    return (
        specs.find((spec: any) => getVideoSpecDurationValue(spec) === duration) ||
        specs.find((spec: any) => getVideoSpecDurationValue(spec) <= 0) ||
        specs[0]
    )
}

function syncNodeMetadataWithOptions(type: CanvasNodeType, metadata: Record<string, any>) {
    if (type === 'text' || type === 'config') {
        const options = buildTextNodeOptions()
        return {
            ...metadata,
            model_code: optionValue(options, 'model_code', metadata.model_code || metadata.model)
        }
    }
    if (type === 'image') {
        const options = buildImageNodeOptionsForNode({ metadata } as CanvasNodeData)
        const next = {
            ...metadata,
            channel: optionValue(options, 'channel', metadata.channel || metadata.model),
            quality: optionValue(options, 'quality', metadata.quality || metadata.resolution),
            ratio: optionValue(options, 'ratio', metadata.ratio || metadata.size),
            quantity: Number(
                optionValue(options, 'quantity', metadata.quantity || metadata.count) || 1
            )
        }
        const ratio = findImageRatioForMetadata(next)
        return {
            ...next,
            resolution: next.quality,
            count: next.quantity,
            estimatedCost: formatCostLabel(ratio?.tenant_unit_price),
            costLabel: formatCostLabel(ratio?.tenant_unit_price)
        }
    }
    if (type === 'audio') {
        const options = buildMusicNodeOptionsForNode({ metadata } as CanvasNodeData)
        return {
            ...metadata,
            channel: optionValue(options, 'channel', metadata.channel || metadata.model),
            duration: Number(optionValue(options, 'duration', metadata.duration) || 30),
            instrumental:
                Number(optionValue(options, 'instrumental', metadata.instrumental ? 1 : 0)) === 1,
            costLabel: formatCostLabel(metadata.estimatedCost || metadata.cost || 1),
            estimatedCost: formatCostLabel(metadata.estimatedCost || metadata.cost || 1)
        }
    }
    const options = buildVideoNodeOptionsForNode({ metadata } as CanvasNodeData)
    const next = {
        ...metadata,
        channel: optionValue(options, 'channel', metadata.channel || metadata.model),
        mode: String(
            optionValue(options, 'mode', metadata.mode || metadata.videoMode) || 'pro'
        ).toLowerCase(),
        resolution: optionValue(options, 'resolution', metadata.resolution),
        ratio: optionValue(options, 'ratio', metadata.ratio),
        duration: Number(optionValue(options, 'duration', metadata.duration) || 5),
        quantity: Number(optionValue(options, 'quantity', metadata.quantity || metadata.count) || 1)
    }
    const channel = normalizeVideoChannelsForCreateConfig(videoOptionConfig.value).find(
        (item) => String(item.value) === String(next.channel)
    )
    const quality = findVideoQuality(
        channel,
        String(next.resolution || 'default'),
        Number(next.duration || 0)
    )
    const ratios = getVideoRatioOptions(
        channel,
        String(next.resolution || 'default'),
        Number(next.duration || 0),
        next.mode
    )
    const ratio = ratios.find((item: any) => String(item.value) === String(next.ratio))
    const spec = findVideoSpecForMetadata(channel, next)
    const unitPrice = Number(spec?.tenant_unit_price || (ratio as any)?.tenant_unit_price || 0)
    const multiplier = secondBillingVideoChannels.includes(String(next.channel))
        ? Math.max(1, Number(next.duration || 1))
        : 1
    return {
        ...next,
        videoMode: modeLabel(next.mode),
        quality: quality?.value || next.quality || videoOptionConfig.value.defaults?.quality || '',
        count: next.quantity,
        estimatedCost: formatCostLabel(unitPrice * multiplier),
        costLabel: formatCostLabel(unitPrice * multiplier)
    }
}

function isRemoteProjectId(id: string | number) {
    return /^\d+$/.test(String(id))
}

function consumeHomeAgentComposer(project: CanvasProject | null) {
    if (typeof window === 'undefined' || !project) return false
    const raw = sessionStorage.getItem('aigc-canvas-home-composer')
    if (!raw) return false
    try {
        const payload = JSON.parse(raw)
        const targetProjectId = String(payload?.projectId || '')
        const currentProjectId = String(project.id || route.params.id || '')
        if (targetProjectId && currentProjectId && targetProjectId !== currentProjectId) return false
        const mode = ['agent', 'image', 'video'].includes(String(payload?.mode))
            ? String(payload.mode)
            : 'agent'
        initialAgentComposer.value = {
            draft: String(payload?.draft || ''),
            mode: mode as 'agent' | 'image' | 'video',
            selectedSkill: String(payload?.selectedSkill || ''),
            selectedSkillPrompt: String(payload?.selectedSkillPrompt || ''),
            attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
            imageConfig: payload?.imageConfig || {},
            videoConfig: payload?.videoConfig || {},
            autoSubmit: true
        }
        if (payload?.imageConfig && typeof payload.imageConfig === 'object') {
            agentImageConfig.value = { ...agentImageConfig.value, ...payload.imageConfig }
        }
        if (payload?.videoConfig && typeof payload.videoConfig === 'object') {
            agentVideoConfig.value = { ...agentVideoConfig.value, ...payload.videoConfig }
        }
        sessionStorage.removeItem('aigc-canvas-home-composer')
        sessionStorage.removeItem('ai-canvas-initial-prompt')
        return true
    } catch {
        sessionStorage.removeItem('aigc-canvas-home-composer')
        return false
    }
}

async function loadProject() {
    const id = String(route.params.id || '')
    let project: CanvasProject | null = null
    const cachedProject = loadCanvasProjects().find((item) => item.id === id) || null
    if (userStore.isLogin && isRemoteProjectId(id)) {
        try {
            project = await loadRemoteCanvasProjectDetail(id)
        } catch {
            ElMessage.error('项目加载失败，已尝试读取本地缓存')
        }
    }
    if (!project) {
        project = cachedProject
    } else if (cachedProject) {
        project = {
            ...project,
            registeredAssets: mergeRegisteredAssets(
                project.registeredAssets || [],
                cachedProject.registeredAssets || []
            )
        }
    }
    if (!project) {
        project = createCanvasProject('未命名工作区', { id })
    }
    if (!isRemoteProjectId(id) && String(project.name || '').trim() === '2') {
        project = createCanvasProject('未命名', { id })
    }
    currentProject.value = project
    const consumedHomeComposer = consumeHomeAgentComposer(project)
    projectNameDraft.value = project.name || '未命名'
    const normalizedProjectNodes = normalizeEcommerceAgentLayout(
        clone(project.nodes || []).map((node) => ({
            ...node,
            ...nodeDimensions(node.type, node.metadata || {})
        }))
    )
    nodes.value = normalizedProjectNodes.nodes
    const retainedNodeIds = new Set(nodes.value.map((node) => node.id))
    connections.value = clone(project.connections || []).filter(
        (connection) =>
            retainedNodeIds.has(connection.fromNodeId) && retainedNodeIds.has(connection.toNodeId)
    )
    registeredAssets.value = clone(project.registeredAssets || [])
    selectedIds.value = new Set()
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    setViewport(project.viewport || { x: 0, y: 0, k: 1 })
    resetHistory()
    await nextTick()
    if (!nodes.value.length && !consumedHomeComposer) {
        seedDefaultCanvas()
    }
    applyDefaultNodeConfig()
    await refreshNodesFromSuccessfulRuns()
    refreshPendingImageNodes()
    refreshPendingVideoNodes()
    refreshPendingMusicNodes()
    refreshPendingLocalRedrawNodes()
    if (normalizedProjectNodes.changed) persistProject()
}

async function refreshNodesFromSuccessfulRuns() {
    if (!userStore.isLogin || !currentProject.value || !isRemoteProjectId(currentProject.value.id))
        return
    const missingMediaNodes = nodes.value.filter(
        (node) => ['image', 'video', 'audio'].includes(node.type) && !nodeMediaRawUrl(node)
    )
    if (!missingMediaNodes.length) return
    try {
        const payload: any = await getCanvasRunLists({
            project_id: currentProject.value.id,
            limit: 100
        })
        const runs = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.lists)
              ? payload.lists
              : []
        const runByNode = new Map<string, any>()
        for (const run of runs) {
            const nodeId = String(run?.node_id || '').trim()
            if (!nodeId || runByNode.has(nodeId)) continue
            const status = String(run?.status || '').toLowerCase()
            const url = String(
                run?.file_url ||
                    run?.image_url ||
                    run?.video_url ||
                    run?.audio_url ||
                    run?.image_urls?.[0] ||
                    ''
            ).trim()
            if (status === 'success' && url) {
                runByNode.set(nodeId, run)
            }
        }
        if (!runByNode.size) return
        let changed = false
        nodes.value = nodes.value.map((node) => {
            if (nodeMediaRawUrl(node)) return node
            const run = runByNode.get(node.id)
            if (!run || !runTypeMatchesNode(run.run_type, node.type)) return node
            const url = String(
                run.file_url ||
                    run.image_url ||
                    run.video_url ||
                    run.audio_url ||
                    run.image_urls?.[0] ||
                    ''
            ).trim()
            if (!url) return node
            changed = true
            return {
                ...node,
                metadata: {
                    ...node.metadata,
                    image: node.type === 'image' ? url : node.metadata.image,
                    url,
                    status: 'success',
                    errorDetails: '',
                    error: '',
                    pending: false,
                    taskId: node.metadata.taskId || String(run.source_task_id || ''),
                    mediaSource: node.metadata.mediaSource || 'generated',
                    generatedAt: node.metadata.generatedAt || Date.now()
                }
            }
        })
        if (changed) {
            await persistProject()
        }
    } catch {
        // Missing run history should not block canvas loading.
    }
}

function runTypeMatchesNode(runType: unknown, nodeType: CanvasNodeType) {
    const type = String(runType || '')
    return (
        (type === 'image' && nodeType === 'image') ||
        (type === 'video' && nodeType === 'video') ||
        (type === 'music' && nodeType === 'audio')
    )
}

async function loadCanvasDependencyConfigs() {
    const [llmConfig, imageConfig, videoConfig, musicConfig] = await Promise.allSettled([
        getAigcLlmConfig(),
        getAigcImageConfig(),
        getAigcVideoConfig(),
        getAigcMusicConfig()
    ])
    if (llmConfig.status === 'fulfilled') {
        llmOptionConfig.value = llmConfig.value?.option_config || llmOptionConfig.value
    }
    if (imageConfig.status === 'fulfilled') {
        imageOptionConfig.value = imageConfig.value?.option_config || imageOptionConfig.value
    }
    if (videoConfig.status === 'fulfilled') {
        videoOptionConfig.value = videoConfig.value?.option_config || videoOptionConfig.value
    }
    if (musicConfig.status === 'fulfilled') {
        musicOptionConfig.value =
            musicConfig.value?.option_config || musicConfig.value || musicOptionConfig.value
    }
    refreshAgentMediaConfigs()
    applyDefaultNodeConfig()
}

function applyDefaultNodeConfig() {
    let changed = false
    nodes.value = nodes.value.map((node) => {
        const defaults = defaultMetadataForNode(node.type)
        const metadata = syncNodeMetadataWithOptions(node.type, { ...defaults, ...node.metadata })
        if (JSON.stringify(metadata) === JSON.stringify(node.metadata)) return node
        changed = true
        return { ...node, metadata }
    })
    if (changed) persistProject()
}

function defaultMetadataForNode(type: CanvasNodeType) {
    if (type === 'text' || type === 'config') {
        const models = buildTextNodeOptions()[0]?.values || []
        return { model_code: llmOptionConfig.value.defaults?.model || models[0]?.value || '' }
    }
    if (type === 'image') {
        const defaults = imageOptionConfig.value.defaults || {}
        return syncNodeMetadataWithOptions(type, {
            channel: defaults.channel || 'gpt_image_2',
            quality: defaults.quality || '1k',
            ratio: defaults.ratio || '16:9',
            quantity: Number(defaults.quantity || 1),
            style: defaults.style || 'general',
            negative_prompt: ''
        })
    }
    if (type === 'audio') {
        const defaults = musicOptionConfig.value.defaults || {}
        return syncNodeMetadataWithOptions(type, {
            channel: defaults.channel || '',
            quality: defaults.quality || '',
            duration: Number(defaults.duration || 30),
            instrumental: Boolean(defaults.instrumental),
            style: defaults.style || '',
            lyrics: ''
        })
    }
    const defaults = videoOptionConfig.value.defaults || {}
    return syncNodeMetadataWithOptions(type, {
        channel: defaults.channel || 'seedance2_pro',
        quality: defaults.quality || 'seedance2_pro',
        ratio: defaults.ratio || '16:9',
        duration: Number(defaults.duration || 5),
        mode: defaults.mode || 'pro',
        quantity: Number(defaults.quantity || 1),
        negative_prompt: ''
    })
}

function persistProject() {
    if (!currentProject.value) return
    const project: CanvasProject = {
        ...currentProject.value,
        nodes: clone(nodes.value),
        connections: clone(connections.value),
        viewport: clone(viewport.value),
        registeredAssets: clone(registeredAssets.value),
        updatedAt: Date.now()
    }
    updateProjectThumbnail(project, project.nodes)
    currentProject.value = project
    const projects = [project, ...loadCanvasProjects().filter((item) => item.id !== project.id)]
    saveCanvasProjects(projects)
    saveState.value = '保存中...'
    if (saveTimer.value) clearTimeout(saveTimer.value)
    saveTimer.value = setTimeout(async () => {
        try {
            if (userStore.isLogin && isRemoteProjectId(project.id)) {
                const saved = await saveRemoteCanvasProject(project)
                currentProject.value = {
                    ...saved,
                    registeredAssets: mergeRegisteredAssets(
                        saved.registeredAssets || [],
                        registeredAssets.value
                    )
                }
            }
            saveState.value = '已自动保存'
        } catch {
            saveState.value = '已保存到本地'
        }
    }, 450)
}

function renameProject(name: string) {
    if (!currentProject.value) return
    const normalizedName = name.trim()
    if (!normalizedName || normalizedName === currentProject.value.name) return
    currentProject.value = {
        ...currentProject.value,
        name: normalizedName
    }
    persistProject()
}

function handleProjectNameInput(name: string) {
    projectNameDraft.value = name
    renameProject(name)
}

function commitProjectName() {
    const fallbackName = currentProject.value?.name || '未命名'
    projectNameDraft.value = projectNameDraft.value.trim() || fallbackName
    renameProject(projectNameDraft.value)
}

function resetHistory() {
    history.value = [{ nodes: clone(nodes.value), connections: clone(connections.value) }]
    historyIndex.value = 0
}

function pushHistory() {
    const entry = { nodes: clone(nodes.value), connections: clone(connections.value) }
    history.value = history.value
        .slice(0, historyIndex.value + 1)
        .concat(entry)
        .slice(-80)
    historyIndex.value = history.value.length - 1
}

function restoreHistory(index: number) {
    const entry = history.value[index]
    if (!entry) return
    nodes.value = clone(entry.nodes)
    connections.value = clone(entry.connections)
    historyIndex.value = index
    selectedIds.value = new Set()
    selectedConnectionId.value = ''
    connectionCreateMenu.value = null
    persistProject()
}

function undo() {
    if (canUndo.value) restoreHistory(historyIndex.value - 1)
}

function redo() {
    if (canRedo.value) restoreHistory(historyIndex.value + 1)
}

function commit() {
    pushHistory()
    persistProject()
}

function addNodeAtCenter(type: CanvasNodeType) {
    const center = getCanvasCenter()
    addNode(type, {
        x: center.x - nodeSize(type).width / 2,
        y: center.y - nodeSize(type).height / 2
    })
}

function addNodeAtScreen(type: CanvasNodeType, clientX: number, clientY: number) {
    const world = screenToCanvas(clientX, clientY)
    addNode(type, { x: world.x - nodeSize(type).width / 2, y: world.y - nodeSize(type).height / 2 })
}

function menuPoint(clientX: number, clientY: number, width = 196, height = 238) {
    return {
        x: Math.max(8, Math.min(clientX, window.innerWidth - width - 8)),
        y: Math.max(8, Math.min(clientY, window.innerHeight - height - 8))
    }
}

function openContextAddMenu() {
    if (!contextMenu.value) return
    contextMenu.value = {
        ...menuPoint(contextMenu.value.x, contextMenu.value.y, 220, 184),
        mode: 'add'
    }
}

function addNodeFromContext(type: CanvasNodeType) {
    const menu = contextMenu.value
    if (!menu) return
    addNodeAtScreen(type, menu.x, menu.y)
}

function uploadFromContext() {
    contextMenu.value = null
    uploadInput.value?.click()
}

function undoFromContext() {
    undo()
    contextMenu.value = null
}

function redoFromContext() {
    redo()
    contextMenu.value = null
}

async function pasteFromContext() {
    contextMenu.value = null
    await pasteSelected()
}

function addNode(
    type: CanvasNodeType,
    position: { x: number; y: number },
    metadata: Record<string, any> = {}
) {
    const hasExplicitMediaSizing =
        (type === 'image' || type === 'video') &&
        mediaSizingKeys.some((key) => key in metadata)
    const nodeMetadata = {
        ...defaultMetadataForNode(type),
        ...metadata,
        ...((type === 'image' || type === 'video') && !('mediaPreviewRatioActive' in metadata)
            ? { mediaPreviewRatioActive: hasExplicitMediaSizing }
            : {})
    }
    const dimensions = nodeDimensions(type, nodeMetadata)
    const node = {
        ...createNativeCanvasNode(type, position, nodeMetadata),
        ...dimensions
    }
    nodes.value = [...nodes.value, node]
    selectedIds.value = new Set([node.id])
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    commit()
    return node
}

async function applyAgentWorkspaceAction(action: any) {
    const actionType = String(action?.action_type || '')
    if (actionType === 'apply_json_canvas') {
        await applyAgentJsonCanvasAction(action)
        return
    }
    if (actionType === 'insert_workflow') {
        await insertAgentWorkflow(action)
        return
    }
    if (!['insert_image', 'insert_video', 'insert_audio'].includes(actionType)) {
        ElMessage.warning('该 Agent 动作需要确认后才能执行')
        return
    }
    const asset = action?.input?.asset || {}
    const url = String(
        asset.url || asset.image_url || asset.video_url || asset.audio_url || ''
    ).trim()
    const type: CanvasNodeType =
        actionType === 'insert_video' ? 'video' : actionType === 'insert_audio' ? 'audio' : 'image'
    const taskId = resultTaskId(asset)
    const targetElementId = String(
        action?.input?.target_element_id || asset?.target_element_id || ''
    ).trim()
    const targetNode = targetElementId
        ? nodes.value.find(
              (node) =>
                  String(
                      node.metadata?.agentElementId || node.metadata?.targetElementId || ''
                  ) === targetElementId
          )
        : undefined
    if (targetNode) {
        const nextStatus = url ? 'success' : taskId ? 'running' : 'failed'
        const metadata: Record<string, any> = {
            status: nextStatus,
            errorDetails: nextStatus === 'failed' ? 'Agent 结果缺少素材地址' : '',
            taskId: taskId || targetNode.metadata.taskId,
            ratio: agentActionRatio(action, asset) || targetNode.metadata.ratio,
            source: 'agent',
            mediaSource: 'agent',
            agentActionId: action.id,
            agentThreadId: action.thread_id,
            agentMessageId: action.message_id,
            agentToolCallId: action.tool_call_id,
            targetElementId
        }
        if (type === 'image' && url) {
            metadata.image = url
            metadata.url = url
        } else if (url) {
            metadata.url = url
            metadata.poster = String(asset.cover_url || '')
        }
        const dimensions = nodeDimensions(type, { ...targetNode.metadata, ...metadata })
        updateNode(targetNode.id, { metadata, ...dimensions })
        notifyAgentGenerationAction(action, type, targetNode.id, nextStatus, {
            taskId,
            url,
            poster: String(asset.cover_url || ''),
            ratio: agentActionRatio(action, asset),
            error: metadata.errorDetails
        })
        try {
            await applyCanvasAgentWorkspaceAction({
                action_id: action.id,
                status: nextStatus === 'failed' ? 'failed' : 'applied',
                result: {
                    node_id: targetNode.id,
                    node_type: targetNode.type,
                    task_id: taskId || '',
                    target_element_id: targetElementId,
                    pending: nextStatus === 'running'
                },
                error: metadata.errorDetails
            })
        } catch {
            // The target element is already updated locally.
        }
        if (taskId && !url) {
            void resolveAgentPendingGenerationNode(targetNode.id, type, taskId)
        }
        return
    }
    if (!url && taskId) {
        createAgentPendingGenerationNode(action, type, asset, taskId)
        return
    }
    if (!url) {
        ElMessage.error('Agent 结果缺少素材地址')
        return
    }
    const position = agentActionInsertPosition(action, type)
    const title = String(
        asset.title ||
            (type === 'video' ? 'Agent 视频' : type === 'audio' ? 'Agent 音频' : 'Agent 图片')
    )
    const metadata: Record<string, any> = {
        title,
        prompt: String(action?.input?.prompt || ''),
        status: 'success',
        source: 'agent',
        mediaSource: 'agent',
        generatedAt: Date.now(),
        agentActionId: action.id,
        agentThreadId: action.thread_id,
        agentMessageId: action.message_id,
        agentToolCallId: action.tool_call_id,
        assetId: asset.id || '',
        ratio: agentActionRatio(action, asset),
        assetType: type,
        designWidth: Number(action?.input?.design_width || asset?.design_width || 750),
        targetElementId,
        sectionIndex: Number(action?.input?.section_index || asset?.section_index || 0),
        batchId: Number(action?.input?.batch_id || asset?.batch_id || 0),
        batchKind: String(action?.input?.batch_kind || asset?.batch_kind || 'initial'),
        revisionNo: Number(action?.input?.revision_no || asset?.revision_no || 0),
        sourceNodeId: String(action?.input?.source_node_id || asset?.source_node_id || ''),
        sourceSectionKey: String(action?.input?.source_section_key || asset?.source_section_key || ''),
        sectionKey: String(action?.input?.section_key || asset?.section_key || '')
    }
    if (type === 'image') {
        metadata.image = url
        metadata.url = url
    } else if (type === 'video') {
        metadata.url = url
        metadata.poster = String(asset.cover_url || '')
    } else {
        metadata.url = url
        metadata.duration = Number(asset.duration || 0)
    }
    const node = addNode(type, position, metadata)
    notifyAgentGenerationAction(action, type, node.id, 'success', {
        url,
        poster: String(asset.cover_url || ''),
        ratio: agentActionRatio(action, asset)
    })
    try {
        await applyCanvasAgentWorkspaceAction({
            action_id: action.id,
            status: 'applied',
            result: {
                node_id: node.id,
                node_type: node.type
            }
        })
    } catch {
        // The node has already been inserted through the normal canvas path; action audit can be retried server-side.
    }
}

async function applyAgentJsonCanvasAction(action: any) {
    const canvasJson = action?.input?.canvas_json || {}
    const actions = Array.isArray(canvasJson.actions) ? canvasJson.actions : []
    if (!actions.length) {
        ElMessage.warning('Agent 画布协议为空')
        return
    }
    const addActions = actions.filter((item: any) => String(item?.type || '') === 'add_element')
    const updateActions = actions.filter(
        (item: any) => String(item?.type || '') === 'update_element'
    )
    const pageAction = actions.find((item: any) => String(item?.type || '') === 'create_page')
    const center = getCanvasCenter()
    const minX = addActions.length
        ? Math.min(...addActions.map((item: any) => Number(item?.element?.x || 0)))
        : 0
    const minY = addActions.length
        ? Math.min(...addActions.map((item: any) => Number(item?.element?.y || 0)))
        : 0
    const page = pageAction?.page || {}
    const pageTitle = String(page?.title || 'AI Design Page')
    const existingElementIds = new Set(
        nodes.value.map((node) => String(node.metadata?.agentElementId || '')).filter(Boolean)
    )
    const elementNodes = addActions
        .filter((item: any, index: number) => {
            const sourceId = String(item?.element?.id || `json_el_${index}`)
            return !existingElementIds.has(sourceId)
        })
        .map((item: any, index: number) => {
            const element = item?.element || {}
            const type = normalizeJsonCanvasNodeType(element?.type)
            const sourceId = String(element?.id || `json_el_${index}`)
            const content = String(element?.content || element?.text || element?.prompt || '')
            const url = String(element?.url || element?.src || element?.image || '').trim()
            const metadata: Record<string, any> = {
                ...defaultMetadataForNode(type),
                ...(typeof element?.metadata === 'object' && element.metadata
                    ? element.metadata
                    : {}),
                title: String(element?.title || content.slice(0, 18) || pageTitle),
                content: type === 'text' || type === 'config' ? content : '',
                prompt: content,
                status: String(element?.metadata?.status || (url ? 'success' : 'idle')),
                source: 'design_agent',
                mediaSource: 'agent',
                agentActionId: action.id,
                agentElementId: sourceId,
                jsonCanvasPageId: String(item?.page_id || 'page_1'),
                jsonCanvasStyle: element?.style || {}
            }
            if (type === 'image') {
                metadata.image = url
                metadata.url = url
            } else if (type === 'video' || type === 'audio') {
                metadata.url = url
            }
            return {
                ...createNativeCanvasNode(
                    type,
                    {
                        x: center.x + Number(element?.x || 0) - minX,
                        y: center.y + Number(element?.y || 0) - minY
                    },
                    metadata
                ),
                width:
                    type === 'image'
                        ? nodeSize('image').width
                        : Math.max(160, Number(element?.width || nodeSize(type).width)),
                height:
                    type === 'image'
                        ? nodeSize('image').height
                        : Math.max(120, Number(element?.height || nodeSize(type).height))
            }
        })
    const pageSourceId = String(page?.id || '')
    const pageNode =
        pageSourceId &&
        !pageSourceId.startsWith('ecommerce_page') &&
        !existingElementIds.has(pageSourceId)
            ? {
                  ...createNativeCanvasNode(
                      'config',
                      { x: center.x, y: center.y },
                      {
                          title: pageTitle,
                          content: '',
                          status: 'success',
                          source: 'design_agent',
                          isPageArtboard: true,
                          agentActionId: action.id,
                          agentElementId: pageSourceId,
                          jsonCanvasPageId: pageSourceId,
                          background: String(page?.background || '#ffffff')
                      }
                  ),
                  width: Math.max(320, Number(page?.width || 750)),
                  height: Math.max(320, Number(page?.height || 900))
              }
            : null
    const nextNodes = [...(pageNode ? [pageNode] : []), ...elementNodes]
    const updatedIds: string[] = []
    if (updateActions.length) {
        nodes.value = nodes.value.map((node) => {
            const patchAction = updateActions.find((item: any) => {
                const elementId = String(item?.element_id || '')
                return elementId && String(node.metadata?.agentElementId || node.id) === elementId
            })
            if (!patchAction) return node
            const patch = patchAction.patch || {}
            updatedIds.push(node.id)
            return {
                ...node,
                title: String(patch.title || node.title),
                metadata: {
                    ...node.metadata,
                    ...patch.metadata,
                    content: patch.content ?? node.metadata.content,
                    prompt: patch.prompt ?? patch.content ?? node.metadata.prompt
                }
            }
        })
    }
    if (nextNodes.length) {
        nodes.value = [...nodes.value, ...nextNodes]
        selectedIds.value = new Set(elementNodes.map((node) => node.id))
        selectedConnectionId.value = ''
    }
    commit()
    try {
        await applyCanvasAgentWorkspaceAction({
            action_id: action.id,
            status: 'applied',
            result: {
                node_ids: nextNodes.map((node) => node.id),
                updated_node_ids: updatedIds,
                canvas_action_count: actions.length
            }
        })
    } catch {
        // The JSON Canvas was already applied locally; action audit can be retried server-side.
    }
}

function normalizeJsonCanvasNodeType(type: any): CanvasNodeType {
    const value = String(type || 'text')
    if (['image', 'video', 'audio', 'config'].includes(value)) return value as CanvasNodeType
    return 'text'
}

async function insertAgentWorkflow(action: any) {
    const workflow = action?.input?.workflow || {}
    const templateNodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
    const templateConnections = Array.isArray(workflow.connections)
        ? workflow.connections
        : Array.isArray(workflow.edges)
          ? workflow.edges
          : []
    if (!templateNodes.length) {
        ElMessage.warning('该工作流模板暂无节点')
        return
    }
    const center = getCanvasCenter()
    const minX = Math.min(...templateNodes.map((node: any) => Number(node?.position?.x || 0)))
    const minY = Math.min(...templateNodes.map((node: any) => Number(node?.position?.y || 0)))
    const idMap = new Map<string, string>()
    const nextNodes = templateNodes.map((raw: any, index: number) => {
        const type = normalizeWorkflowNodeType(raw?.type)
        const sourceId = String(raw?.id || `node_${index}`)
        const nextId = createId(type)
        idMap.set(sourceId, nextId)
        return createNativeCanvasNode(
            type,
            {
                x: center.x + Number(raw?.position?.x || 0) - minX,
                y: center.y + Number(raw?.position?.y || 0) - minY
            },
            {
                ...(raw?.metadata || raw?.data || {}),
                title: raw?.title || raw?.metadata?.title || raw?.data?.title || undefined,
                source: 'agent_skill',
                agentActionId: action.id,
                agentSkillKey: action?.input?.skill?.skill_key || ''
            },
            nextId
        )
    })
    const nextConnections = templateConnections
        .map((edge: any) => {
            const from = idMap.get(String(edge?.fromNodeId || edge?.source || ''))
            const to = idMap.get(String(edge?.toNodeId || edge?.target || ''))
            return from && to ? createNativeConnection(from, to) : null
        })
        .filter(Boolean) as CanvasConnection[]
    nodes.value = [...nodes.value, ...nextNodes]
    connections.value = [...connections.value, ...nextConnections]
    selectedIds.value = new Set(nextNodes.map((node) => node.id))
    selectedConnectionId.value = ''
    commit()
    try {
        await applyCanvasAgentWorkspaceAction({
            action_id: action.id,
            status: 'applied',
            result: {
                node_ids: nextNodes.map((node) => node.id),
                connection_ids: nextConnections.map((connection) => connection.id)
            }
        })
    } catch {
        // The workflow has already been inserted locally; action audit can be retried server-side.
    }
}

function normalizeWorkflowNodeType(type: any): CanvasNodeType {
    const value = String(type || 'text')
    return ['text', 'image', 'video', 'audio', 'config'].includes(value)
        ? (value as CanvasNodeType)
        : 'text'
}

function openAgentAssetLibrary(payload?: {
    acceptTypes?: Array<'image' | 'video' | 'audio'>
}) {
    assetGalleryTarget.value = 'agent'
    assetGalleryNodeId.value = ''
    const requestedTypes = Array.isArray(payload?.acceptTypes)
        ? payload!.acceptTypes.filter((type) => ['image', 'video', 'audio'].includes(type))
        : []
    agentAssetGalleryAcceptTypes.value = requestedTypes.length
        ? requestedTypes
        : ['image', 'video']
    showAssetGallery.value = true
}

function syncAgentMediaConfig(mode: AgentMediaMode, config: Record<string, any> = {}) {
    return syncNodeMetadataWithOptions(mode, {
        ...defaultMetadataForNode(mode),
        ...config
    })
}

function refreshAgentMediaConfigs() {
    agentImageConfig.value = syncAgentMediaConfig('image', agentImageConfig.value)
    agentVideoConfig.value = syncAgentMediaConfig('video', agentVideoConfig.value)
}

function updateAgentMediaConfig(payload: AgentMediaConfigPayload) {
    if (payload.mode === 'image') {
        agentImageConfig.value = syncAgentMediaConfig('image', {
            ...agentImageConfig.value,
            [payload.key]: payload.value
        })
        return
    }
    agentVideoConfig.value = syncAgentMediaConfig('video', {
        ...agentVideoConfig.value,
        [payload.key]: payload.value
    })
}

async function generateAgentMedia(payload: AgentMediaGeneratePayload) {
    const prompt = String(payload.prompt || '').trim()
    const jobId = payload.jobId || `${Date.now()}`
    if (!prompt) {
        ElMessage.warning(payload.mode === 'image' ? '请输入图片提示词' : '请输入视频提示词')
        agentMediaGenerationStatus.value = {
            jobId,
            mode: payload.mode,
            status: 'failed',
            error: payload.mode === 'image' ? '请输入图片提示词' : '请输入视频提示词'
        }
        return
    }
    agentMediaGeneratingCount.value += 1
    agentMediaGenerating.value = true
    agentMediaGenerationStatus.value = { jobId, mode: payload.mode, status: 'running' }
    const type: CanvasNodeType = payload.mode
    const baseConfig = payload.mode === 'image' ? agentImageConfig.value : agentVideoConfig.value
    const attachmentReferences = agentAttachmentReferences(payload.attachments || [], type)
    const metadata = syncNodeMetadataWithOptions(type, {
        ...defaultMetadataForNode(type),
        ...baseConfig,
        ...payload.config,
        ...attachmentReferences,
        title: prompt.slice(0, 18) || (type === 'image' ? 'Agent 图像' : 'Agent 视频'),
        prompt,
        status: 'running',
        errorDetails: '',
        source: 'agent_panel',
        mediaSource: 'generated',
        agentJobId: jobId
    })
    const center = getCanvasCenter()
    const size = nodeDimensions(type, metadata)
    const position = findAgentInsertPosition(
        {
            x: center.x + 120,
            y: center.y - size.height / 2
        },
        size
    )
    const node = addNode(type, position, metadata)
    runningNodeId.value = node.id
    try {
        const current = findNode(node.id) || node
        if (type === 'image') {
            await runImageNode(current)
        } else {
            await runVideoNode(current)
        }
        agentMediaGenerationStatus.value = {
            jobId,
            mode: payload.mode,
            status: 'success',
            nodeId: node.id,
            url: nodeMediaRawUrl(findNode(node.id) || node),
            ratio: (findNode(node.id) || node).metadata.ratio,
            taskId: (findNode(node.id) || node).metadata.taskId
        }
        ElMessage.success(type === 'image' ? '图像已生成并加入画布' : '视频已生成并加入画布')
    } catch (error: any) {
        if (isGenerationPendingError(error)) {
            updateNode(node.id, {
                metadata: {
                    status: 'running',
                    taskId: error.taskId || node.metadata.taskId,
                    errorDetails: '',
                    pending: true
                }
            })
            agentMediaGenerationStatus.value = {
                jobId,
                mode: payload.mode,
                status: 'running',
                nodeId: node.id,
                taskId: error.taskId || node.metadata.taskId,
                ratio: node.metadata.ratio
            }
            return
        }
        const message = String(error?.msg || error?.message || error || '生成失败')
        updateNode(node.id, {
            metadata: {
                status: 'failed',
                errorDetails: message
            }
        })
        agentMediaGenerationStatus.value = {
            jobId,
            mode: payload.mode,
            status: 'failed',
            nodeId: node.id,
            taskId: node.metadata.taskId,
            ratio: node.metadata.ratio,
            error: message
        }
        ElMessage.error(message)
    } finally {
        runningNodeId.value = ''
        agentMediaGeneratingCount.value = Math.max(0, agentMediaGeneratingCount.value - 1)
        agentMediaGenerating.value = agentMediaGeneratingCount.value > 0
    }
}

function agentAttachmentReferences(
    attachments: Array<Record<string, any>>,
    nodeType: CanvasNodeType
) {
    const images: Array<Record<string, any>> = []
    const videos: Array<Record<string, any>> = []
    const audios: Array<Record<string, any>> = []
    attachments.forEach((item) => {
        const url = String(item.remoteUrl || item.url || item.uri || '').trim()
        if (!url) return
        const rawType = String(item.type || item.asset_type || '').toLowerCase()
        const isVideo = rawType.includes('video')
        const isAudio = rawType.includes('audio')
        const name = String(
            item.name || item.title || (isVideo ? '参考视频' : isAudio ? '参考音频' : '参考图')
        )
        if (isAudio) {
            audios.push({ url, name, role: item.role || 'reference_audio' })
            return
        }
        if (isVideo) {
            videos.push({ url, name, role: item.role || 'reference_video' })
            return
        }
        images.push({
            url,
            name,
            role: item.role || 'reference_image'
        })
    })
    return {
        referenceImages: images,
        referenceVideos: videos,
        referenceAudios: audios,
        referenceCount: images.length + videos.length + audios.length
    }
}

async function createAgentPendingGenerationNode(
    action: any,
    type: CanvasNodeType,
    asset: Record<string, any>,
    taskId: string | number
) {
    const position = agentActionInsertPosition(action, type)
    const title = String(
        asset.title ||
            (type === 'video'
                ? 'Agent 视频生成中'
                : type === 'audio'
                  ? 'Agent 音频生成中'
                  : 'Agent 图片生成中')
    )
    const node = addNode(type, position, {
        title,
        prompt: String(action?.input?.prompt || ''),
        status: 'running',
        errorDetails: '',
        source: 'agent',
        mediaSource: 'agent',
        taskId,
        ratio: agentActionRatio(action, asset),
        assetType: type,
        agentActionId: action.id,
        agentThreadId: action.thread_id,
        agentMessageId: action.message_id,
        agentToolCallId: action.tool_call_id,
        assetId: asset.id || '',
        designWidth: Number(action?.input?.design_width || asset?.design_width || 750),
        targetElementId: String(
            action?.input?.target_element_id || asset?.target_element_id || ''
        ),
        sectionIndex: Number(action?.input?.section_index || asset?.section_index || 0),
        batchId: Number(action?.input?.batch_id || asset?.batch_id || 0),
        batchKind: String(action?.input?.batch_kind || asset?.batch_kind || 'initial'),
        revisionNo: Number(action?.input?.revision_no || asset?.revision_no || 0),
        sourceNodeId: String(action?.input?.source_node_id || asset?.source_node_id || ''),
        sourceSectionKey: String(action?.input?.source_section_key || asset?.source_section_key || ''),
        sectionKey: String(action?.input?.section_key || asset?.section_key || '')
    })
    try {
        await applyCanvasAgentWorkspaceAction({
            action_id: action.id,
            status: 'applied',
            result: {
                node_id: node.id,
                node_type: node.type,
                task_id: taskId,
                pending: true
            }
        })
    } catch {
        // The pending node is already visible; action audit can be retried server-side.
    }
    notifyAgentGenerationAction(action, type, node.id, 'running', {
        taskId,
        ratio: agentActionRatio(action, asset)
    })
    void resolveAgentPendingGenerationNode(node.id, type, taskId)
}

function agentActionRatio(action: any, asset: Record<string, any> = {}) {
    const config = action?.input?.config || action?.input?.params || {}
    return String(asset.ratio || config.ratio || config.size || '').trim()
}

function notifyAgentGenerationAction(
    action: any,
    type: CanvasNodeType,
    nodeId: string,
    status: 'running' | 'success' | 'failed',
    payload: {
        taskId?: string | number
        url?: string
        poster?: string
        ratio?: string | number
        error?: string
    } = {}
) {
    if (!['image', 'video', 'audio'].includes(type)) return
    agentMediaGenerationStatus.value = {
        mode: type === 'video' ? 'video' : 'image',
        type: type as 'image' | 'video' | 'audio',
        status,
        nodeId,
        actionId: action?.id,
        taskId: payload.taskId || action?.input?.asset?.task_id || action?.input?.asset?.taskId,
        url: payload.url,
        poster: payload.poster,
        ratio: payload.ratio || agentActionRatio(action, action?.input?.asset || {}),
        error: payload.error
    }
}

function notifyAgentGenerationNode(
    node: CanvasNodeData,
    status: 'running' | 'success' | 'failed',
    payload: {
        url?: string
        poster?: string
        error?: string
    } = {}
) {
    if (!['image', 'video', 'audio'].includes(node.type)) return
    const actionId = node.metadata.agentActionId
    if (!actionId && !node.metadata.taskId) return
    agentMediaGenerationStatus.value = {
        mode: node.type === 'video' ? 'video' : 'image',
        type: node.type as 'image' | 'video' | 'audio',
        status,
        nodeId: node.id,
        actionId,
        taskId: node.metadata.taskId,
        url: payload.url,
        poster: payload.poster || String(node.metadata.poster || ''),
        ratio: node.metadata.ratio,
        error: payload.error
    }
}

async function resolveAgentPendingGenerationNode(
    nodeId: string,
    type: CanvasNodeType,
    taskId: string | number
) {
    try {
        const url =
            type === 'video'
                ? await resolveVideoResult({ task_id: taskId })
                : type === 'audio'
                  ? await resolveMusicResult({ task_id: taskId })
                  : await resolveImageResult({ task_id: taskId })
        if (!url) throw new Error('Agent 生成任务未返回素材地址')
        const metadata: Record<string, any> = {
            status: 'success',
            errorDetails: '',
            mediaSource: 'agent',
            generatedAt: Date.now(),
            taskId
        }
        if (type === 'image') {
            metadata.image = url
            metadata.url = url
        } else {
            metadata.url = url
        }
        updateNode(nodeId, { metadata })
        const updated = findNode(nodeId)
        if (updated) {
            notifyAgentGenerationNode(updated, 'success', {
                url,
                poster: String(metadata.poster || '')
            })
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Agent 生成任务查询失败'
        updateNode(nodeId, {
            metadata: {
                status: 'failed',
                errorDetails: message
            }
        })
        const failed = findNode(nodeId)
        if (failed) notifyAgentGenerationNode(failed, 'failed', { error: message })
    }
}

function findAgentInsertPosition(
    position: { x: number; y: number },
    size: { width: number; height: number }
) {
    let candidate = { ...position }
    const overlaps = (point: { x: number; y: number }) =>
        nodes.value.some(
            (node) =>
                point.x < node.position.x + node.width + 24 &&
                point.x + size.width + 24 > node.position.x &&
                point.y < node.position.y + node.height + 24 &&
                point.y + size.height + 24 > node.position.y
        )
    while (overlaps(candidate)) {
        candidate = { ...candidate, y: candidate.y + size.height + 36 }
    }
    return candidate
}

function agentActionInsertPosition(action: any, type: CanvasNodeType) {
    const asset = action?.input?.asset || {}
    const size = nodeDimensions(type, {
        batchId: Number(action?.input?.batch_id || asset?.batch_id || 0),
        batchKind: String(action?.input?.batch_kind || asset?.batch_kind || ''),
        targetElementId: String(
            action?.input?.target_element_id || asset?.target_element_id || ''
        ),
        ratio: agentActionRatio(action, asset)
    })
    const sourceNodeId = String(
        action?.input?.source_node_id || action?.input?.asset?.source_node_id || ''
    ).trim()
    const source = sourceNodeId ? findNode(sourceNodeId) : undefined
    if (source) {
        return findAgentInsertPosition(
            {
                x: source.position.x + source.width + 72,
                y: source.position.y
            },
            size
        )
    }
    const center = getCanvasCenter()
    return findAgentInsertPosition(
        {
            x: center.x + 120,
            y: center.y - size.height / 2
        },
        size
    )
}

function nextRightSidePosition(source: CanvasNodeData, type: CanvasNodeType) {
    const size = nodeSize(type)
    let position = {
        x: source.position.x + source.width + 80,
        y: source.position.y + Math.round((source.height - size.height) / 2)
    }
    const overlaps = (candidate: { x: number; y: number }) =>
        nodes.value.some((node) => {
            if (node.id === source.id) return false
            return (
                candidate.x < node.position.x + node.width + 24 &&
                candidate.x + size.width + 24 > node.position.x &&
                candidate.y < node.position.y + node.height + 24 &&
                candidate.y + size.height + 24 > node.position.y
            )
        })
    while (overlaps(position)) {
        position = { ...position, y: position.y + size.height + 36 }
    }
    return position
}

function updateNode(id: string, patch: Record<string, any>) {
    nodes.value = nodes.value.map((node) => {
        if (node.id !== id) return node
        const nextPatchMetadata = patch.metadata || {}
        const metadata = syncNodeMetadataWithOptions(node.type, {
            ...node.metadata,
            ...nextPatchMetadata,
            updatedAt: Date.now()
        })
        const shouldResize =
            (node.type === 'image' || node.type === 'video') &&
            !('width' in patch) &&
            !('height' in patch) &&
            nextPatchMetadata &&
            mediaSizingKeys.some((key) => key in nextPatchMetadata)
        if (shouldResize) metadata.mediaPreviewRatioActive = true
        const dimensions = shouldResize ? nodeDimensions(node.type, metadata) : {}
        return {
            ...node,
            ...withoutMetadata(patch),
            ...dimensions,
            title: patch.title !== undefined ? String(patch.title) : node.title,
            metadata
        }
    })
    persistProject()
}

function openNodeAssetGallery(id: string) {
    const node = findNode(id)
    if (!node || (node.type !== 'image' && node.type !== 'video' && node.type !== 'audio')) return
    assetGalleryTarget.value = 'node'
    assetGalleryNodeId.value = id
    showAssetGallery.value = true
}

function selectAssetGalleryItem(item: any) {
    if (assetGalleryTarget.value === 'agent') {
        selectAgentAssetGalleryItem(item)
        return
    }
    selectNodeAssetGalleryItem(item)
}

function selectNodeAssetGalleryItem(item: any) {
    const node = findNode(assetGalleryNodeId.value)
    const url = String(item?.url || item?.uri || item?.cover || '').trim()
    if (!node || !url) return
    if (item?.type === 'audio') {
        const referenceAudios = [
            ...(Array.isArray(node.metadata.referenceAudios) ? node.metadata.referenceAudios : []),
            { url, name: item.name || '资产音频', asset_id: item.id }
        ]
        updateNode(node.id, {
            metadata: {
                referenceAudios,
                referenceCount:
                    referenceAudios.length +
                    (node.metadata.referenceImages?.length || 0) +
                    (node.metadata.referenceVideos?.length || 0)
            }
        })
    } else if (item?.type === 'video') {
        const referenceVideos = [
            ...(Array.isArray(node.metadata.referenceVideos) ? node.metadata.referenceVideos : []),
            { url, name: item.name || '资产视频' }
        ]
        updateNode(node.id, {
            metadata: {
                referenceVideos,
                referenceCount:
                    referenceVideos.length + (node.metadata.referenceImages?.length || 0)
            }
        })
    } else {
        const role = node.type === 'video' ? 'first_frame_image' : 'reference_image'
        const referenceImages = [
            ...(Array.isArray(node.metadata.referenceImages) ? node.metadata.referenceImages : []),
            { url, name: item.name || '资产图片', role }
        ]
        updateNode(node.id, {
            metadata: {
                referenceImages,
                referenceCount:
                    referenceImages.length + (node.metadata.referenceVideos?.length || 0)
            }
        })
    }
    showAssetGallery.value = false
    assetGalleryNodeId.value = ''
}

function selectAgentAssetGalleryItem(item: any) {
    const url = String(item?.url || item?.uri || item?.cover || '').trim()
    if (!url) return
    agentPanelRef.value?.addAttachments?.([
        {
            id: item.id || `${item.type || 'asset'}-${url}`,
            name:
                item.name ||
                (item.type === 'video'
                    ? '资产视频'
                    : item.type === 'audio'
                      ? '资产音频'
                      : '资产图片'),
            title: item.name,
            type: item.type || 'image',
            asset_type: item.type || 'image',
            url,
            uri: item.uri || url,
            preview_url: item.cover || url,
            cover_url: item.cover || ''
        }
    ])
    showAssetGallery.value = false
    assetGalleryTarget.value = 'node'
}

async function addNodeMediaToAsset(id: string) {
    if (!ensureTopbarLogin('请先登录后再添加到资产库')) return
    const node = findNode(id)
    if (node?.type === 'text') {
        addNodeTextToAsset(node)
        return
    }
    const rawUrl = node ? nodeMediaRawUrl(node) : ''
    if (
        !node ||
        !rawUrl ||
        (node.type !== 'image' && node.type !== 'video' && node.type !== 'audio')
    ) {
        ElMessage.warning('当前节点没有可添加的媒体')
        return
    }
    try {
        const previewUrl = normalizeCanvasMediaUrl(rawUrl)
        const posterPreviewUrl =
            node.type === 'video' ? normalizeCanvasMediaUrl(nodePosterRawUrl(node)) : ''
        const result: any = await registerCanvasAgentAsset({
            project_id: currentProject.value?.id || route.params.id,
            node_id: node.id,
            asset_type:
                node.type === 'audio'
                    ? 'reference_audio'
                    : node.type === 'video'
                      ? 'reference_video'
                      : 'reference_image',
            title: nodeMediaTitle(node),
            uri: rawUrl,
            url: rawUrl,
            preview_url: previewUrl,
            cover_url: node.type === 'video' ? nodePosterRawUrl(node) : '',
            cover_preview_url: posterPreviewUrl,
            mime_type:
                node.type === 'audio'
                    ? 'audio/mpeg'
                    : node.type === 'video'
                      ? 'video/mp4'
                      : 'image/png',
            meta: {
                source: 'aigc_canvas',
                node_id: node.id,
                node_type: node.type,
                media_source: node.metadata.mediaSource || node.metadata.source || '',
                preview_url: previewUrl,
                cover_preview_url: posterPreviewUrl
            }
        })
        const asset = normalizeRegisteredAsset(result)
        if (asset) {
            registeredAssets.value = [
                asset,
                ...registeredAssets.value.filter((item) => String(item.id) !== String(asset.id))
            ]
            assetSidebarTab.value = 'assets'
        }
        await refreshRegisteredAssetsFromRemote()
        ElMessage.success('已添加到资产库')
    } catch (error: any) {
        ElMessage.error(error?.msg || error?.message || error || '添加到资产库失败')
    }
}

function addNodeTextToAsset(node: CanvasNodeData) {
    const content = String(node.metadata.content || node.metadata.prompt || '').trim()
    if (!content) {
        ElMessage.warning('当前文本节点没有可添加的内容')
        return
    }
    const id = `text-${node.id}`
    const asset = {
        id,
        type: 'text',
        asset_type: 'text',
        title: nodeMediaTitle(node),
        content,
        prompt: content,
        url: '',
        uri: '',
        mime_type: 'text/plain',
        meta: {
            source: 'aigc_canvas',
            node_id: node.id,
            node_type: node.type,
            content
        },
        updatedAt: Date.now()
    }
    registeredAssets.value = [
        asset,
        ...registeredAssets.value.filter((item) => String(item.id) !== id)
    ]
    assetSidebarTab.value = 'assets'
    persistProject()
    ElMessage.success('已添加到资产库')
}

async function refreshRegisteredAssetsFromRemote() {
    const id = String(currentProject.value?.id || route.params.id || '')
    if (!userStore.isLogin || !isRemoteProjectId(id)) return
    try {
        const project = await loadRemoteCanvasProjectDetail(id)
        registeredAssets.value = mergeRegisteredAssets(
            project.registeredAssets || [],
            registeredAssets.value
        )
        if (currentProject.value) {
            currentProject.value = {
                ...currentProject.value,
                registeredAssets: clone(registeredAssets.value)
            }
        }
    } catch {
        // Keep the locally inserted asset visible when the forced refresh fails.
    }
}

async function downloadNodeMedia(id: string) {
    const node = findNode(id)
    const url = node ? normalizeCanvasMediaUrl(nodeMediaRawUrl(node)) : ''
    if (
        !node ||
        !url ||
        (node.type !== 'image' && node.type !== 'video' && node.type !== 'audio')
    ) {
        ElMessage.warning('当前节点没有可下载的媒体')
        return
    }
    const fileName = nodeDownloadFileName(node, url)
    try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        triggerBrowserDownload(objectUrl, fileName)
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
        triggerBrowserDownload(url, fileName)
    }
}

function openNodeMediaPreview(id: string) {
    const node = findNode(id)
    const url = node ? normalizeCanvasMediaUrl(nodeMediaRawUrl(node)) : ''
    if (
        !node ||
        !url ||
        (node.type !== 'image' && node.type !== 'video' && node.type !== 'audio')
    ) {
        ElMessage.warning('当前节点没有可查看的媒体')
        return
    }
    mediaPreview.value = {
        type: node.type,
        url,
        poster: node.type === 'video' ? normalizeCanvasMediaUrl(nodePosterRawUrl(node)) : '',
        title: nodeMediaTitle(node)
    }
}

async function captureVideoFrame(sourceId: string, blob: Blob, width: number, height: number) {
    const source = findNode(sourceId)
    if (!source || source.type !== 'video') return
    const file = new File([blob], `video-frame-${Date.now()}.png`, { type: 'image/png' })
    const previewUrl = URL.createObjectURL(file)
    const node = addNode(
        'image',
        { x: source.position.x + source.width + 80, y: source.position.y },
        {
            title: `${source.title || '视频'} 截帧`,
            image: previewUrl,
            url: previewUrl,
            localPreviewUrl: previewUrl,
            mimeType: file.type,
            imageWidth: width,
            imageHeight: height,
            mediaPreviewRatioActive: true,
            status: 'running',
            mediaSource: 'video_frame'
        }
    )
    addConnection(sourceId, node.id)
    try {
        const result: any = await uploadAppImage({ file })
        const uri = pickUploadUri(result)
        if (!uri) throw new Error('上传接口未返回文件地址')
        updateNode(node.id, {
            metadata: {
                image: uri,
                url: uri,
                localPreviewUrl: '',
                fileName: file.name,
                mimeType: file.type,
                imageWidth: width,
                imageHeight: height,
                mediaPreviewRatioActive: true,
                status: 'success',
                mediaSource: 'video_frame'
            }
        })
        URL.revokeObjectURL(previewUrl)
        ElMessage.success('已从视频截取图片帧')
    } catch (error) {
        updateNode(node.id, {
            metadata: {
                status: 'failed',
                errorDetails: error instanceof Error ? error.message : '视频截帧上传失败'
            }
        })
    }
}

function openAgentMediaPreview(payload: {
    type: 'image' | 'video' | 'audio'
    url: string
    poster?: string
    title?: string
}) {
    const url = normalizeCanvasMediaUrl(payload.url)
    if (!url) return
    mediaPreview.value = {
        type: payload.type,
        url,
        poster: payload.type === 'video' ? normalizeCanvasMediaUrl(payload.poster || '') : '',
        title: payload.title || (payload.type === 'video' ? 'Agent 视频' : 'Agent 图片')
    }
}

function closeMediaPreview() {
    mediaPreview.value = null
}

function nodeMediaRawUrl(node: CanvasNodeData) {
    return String(
        node.metadata.image ||
            node.metadata.url ||
            node.metadata.image_url ||
            node.metadata.preview_url ||
            node.metadata.thumbnail ||
            node.metadata.cover ||
            ''
    ).trim()
}

function nodePosterRawUrl(node: CanvasNodeData) {
    return String(
        node.metadata.poster ||
            node.metadata.cover ||
            node.metadata.thumbnail ||
            node.metadata.image ||
            ''
    ).trim()
}

function nodeMediaTitle(node: CanvasNodeData) {
    return String(
        node.metadata.title ||
            node.title ||
            (node.type === 'text'
                ? '文本'
                : node.type === 'audio'
                  ? '音乐'
                  : node.type === 'video'
                    ? '视频'
                    : '图片')
    ).trim()
}

function normalizeCanvasMediaUrl(value: unknown) {
    let raw = String(value || '').trim()
    if (!raw) return ''
    raw = raw.replace(/\\/g, '/')
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:'))
        return raw
    const normalized = normalizeFileUrl(raw)
    const apiUrl = String(getApiUrl() || '').replace(/\/+$/, '')
    if (apiUrl && /^(\/uploads\/|\/storage\/|\/public\/|\/resource\/)/i.test(normalized)) {
        return `${apiUrl}${normalized}`
    }
    return normalized
}

function normalizeRegisteredAsset(result: any) {
    const asset = result?.asset || result?.data?.asset || result?.data || result
    if (!asset || typeof asset !== 'object') return null
    return asset
}

function isTextRegisteredAsset(asset: any) {
    const meta = asset?.meta && typeof asset.meta === 'object' ? asset.meta : {}
    const assetType = String(asset?.asset_type || asset?.type || '').toLowerCase()
    const mimeType = String(asset?.mime_type || '').toLowerCase()
    const content = String(asset?.content || asset?.prompt || asset?.text || meta.content || '').trim()
    return assetType.includes('text') || mimeType.startsWith('text/') || !!content
}

function registeredAssetKey(asset: any) {
    const meta = asset?.meta && typeof asset.meta === 'object' ? asset.meta : {}
    return String(
        asset?.id ||
            asset?.asset_id ||
            asset?.uri ||
            asset?.url ||
            `${asset?.asset_type || asset?.type || 'asset'}:${meta.node_id || ''}:${asset?.title || ''}`
    )
}

function mergeRegisteredAssets(primary: any[] = [], secondary: any[] = []) {
    const seen = new Set<string>()
    const result: any[] = []
    ;[...primary, ...secondary].forEach((asset) => {
        const key = registeredAssetKey(asset)
        if (!key || seen.has(key)) return
        seen.add(key)
        result.push(asset)
    })
    return result
}

function isLikelyVideoUrl(value: unknown) {
    return /\.(mp4|webm|mov|m4v|avi|mkv)(?:[?#].*)?$/i.test(String(value || '').trim())
}

function firstUsableAssetThumb(candidates: unknown[]) {
    for (const candidate of candidates) {
        const raw = String(candidate || '').trim()
        if (!raw || isLikelyVideoUrl(raw)) continue
        const url = normalizeCanvasMediaUrl(raw)
        if (!url || brokenAssetThumbs.value.has(url)) continue
        return url
    }
    return ''
}

function toRegisteredAssetSidebarItem(asset: any): AssetSidebarItem {
    const meta = asset.meta && typeof asset.meta === 'object' ? asset.meta : {}
    const assetType = String(asset.asset_type || asset.type || '').toLowerCase()
    const mimeType = String(asset.mime_type || '').toLowerCase()
    const isText = isTextRegisteredAsset(asset)
    const isAudio =
        !isText && (assetType.includes('audio') || mimeType.startsWith('audio/'))
    const isVideo =
        !isText && (assetType.includes('video') || mimeType.startsWith('video/'))
    const type: CanvasNodeType = isText ? 'text' : isAudio ? 'audio' : isVideo ? 'video' : 'image'
    const title = String(
        asset.title ||
            asset.name ||
            (isText ? '资产文本' : isAudio ? '资产音乐' : isVideo ? '资产视频' : '资产图片')
    ).trim()
    const thumb = isText || isAudio
        ? ''
        : isVideo
          ? firstUsableAssetThumb([
                meta.cover_preview_url,
                asset.cover_preview_url,
                asset.cover_url,
                asset.cover,
                asset.thumbnail
            ])
          : firstUsableAssetThumb([
                meta.preview_url,
                asset.preview_url,
                meta.cover_preview_url,
                asset.cover_preview_url,
                asset.cover_url,
                asset.cover,
                asset.thumbnail,
                asset.url,
                asset.uri
            ])
    return {
        id: `asset-${asset.id || asset.url || asset.uri || title}`,
        type,
        status: 'success',
        title,
        subtitle: `${nodeTypeLabel(type)} 资产`,
        icon: nodeTypeIcon(type),
        thumb
    }
}

function getCanvasMentionOptions(node: CanvasNodeData): CanvasMention[] {
    const mentions: CanvasMention[] = []
    const pushMention = (mention: CanvasMention) => {
        const name = String(mention.name || '').trim()
        if (!name) return
        const signature = `${mention.type}:${mention.node_id || ''}:${mention.asset_id || ''}:${mention.url || ''}:${mention.prompt || ''}`
        if (
            mentions.some(
                (item) =>
                    `${item.type}:${item.node_id || ''}:${item.asset_id || ''}:${item.url || ''}:${item.prompt || ''}` ===
                    signature
            )
        )
            return
        mentions.push({ ...mention, name })
    }

    nodes.value.forEach((item) => {
        if (item.id === node.id) return
        const title = String(item.title || item.metadata.title || nodeTypeLabel(item.type)).trim()
        const text = String(item.metadata.content || item.metadata.prompt || '').trim()
        const media = String(item.metadata.image || item.metadata.url || '').trim()
        if ((item.type === 'text' || item.type === 'config') && text) {
            pushMention({
                id: `node-${item.id}`,
                type: 'text',
                source: 'node',
                name: title,
                prompt: text,
                node_id: item.id
            })
        } else if (item.type === 'image' && media) {
            pushMention({
                id: `node-${item.id}`,
                type: 'image',
                source: 'node',
                name: title,
                prompt: text,
                url: media,
                node_id: item.id
            })
        } else if (item.type === 'video' && media) {
            pushMention({
                id: `node-${item.id}`,
                type: 'video',
                source: 'node',
                name: title,
                prompt: text,
                url: media,
                preview_url: String(item.metadata.poster || item.metadata.image || '').trim(),
                node_id: item.id
            })
        } else if (item.type === 'audio' && media) {
            pushMention({
                id: `node-${item.id}`,
                type: 'audio',
                source: 'node',
                name: title,
                prompt: text,
                url: media,
                node_id: item.id,
                mime_type: String(item.metadata.mimeType || item.metadata.mime_type || 'audio/mpeg')
            })
        }
    })

    const ownImages = Array.isArray(node.metadata.referenceImages)
        ? node.metadata.referenceImages
        : []
    ownImages.forEach((item: any, index: number) => {
        const url = String(item?.url || '').trim()
        if (!url) return
        pushMention({
            id: `reference-${node.id}-image-${index}`,
            type: 'image',
            source: 'reference',
            name: String(item.name || `参考图${index + 1}`),
            url,
            node_id: node.id,
            role: item.role || (node.type === 'video' ? 'first_frame_image' : 'reference_image')
        })
    })
    const ownVideos = Array.isArray(node.metadata.referenceVideos)
        ? node.metadata.referenceVideos
        : []
    ownVideos.forEach((item: any, index: number) => {
        const url = String(item?.url || '').trim()
        if (!url) return
        pushMention({
            id: `reference-${node.id}-video-${index}`,
            type: 'video',
            source: 'reference',
            name: String(item.name || `参考视频${index + 1}`),
            url,
            preview_url: String(item.preview_url || item.poster || '').trim(),
            node_id: node.id
        })
    })

    getNodeInputReferences(node).forEach((item: any, index: number) => {
        const type =
            item.type === 'video'
                ? 'video'
                : item.type === 'audio'
                  ? 'audio'
                  : item.type === 'image'
                    ? 'image'
                    : 'text'
        pushMention({
            id: `connection-${item.sourceId || index}`,
            type,
            source: 'connection',
            name: String(item.name || nodeTypeLabel(type)),
            prompt: String(item.text || ''),
            url: String(item.url || ''),
            node_id: item.sourceId
        })
    })

    registeredAssets.value.forEach((asset: any) => {
        const meta = asset.meta && typeof asset.meta === 'object' ? asset.meta : {}
        const assetType = String(asset.asset_type || asset.type || '').toLowerCase()
        const mimeType = String(asset.mime_type || '').toLowerCase()
        const isText = isTextRegisteredAsset(asset)
        if (isText) {
            const content = String(
                asset.content || asset.prompt || asset.text || meta.content || ''
            ).trim()
            if (!content) return
            pushMention({
                id: `asset-${asset.id || content}`,
                type: 'text',
                source: 'asset',
                name: String(asset.title || asset.name || '资产文本'),
                prompt: content,
                asset_id: asset.id,
                role: 'reference_text',
                mime_type: mimeType || 'text/plain',
                asset_type: assetType || 'text'
            })
            return
        }
        const isAudio = assetType.includes('audio') || mimeType.startsWith('audio/')
        const isVideo = assetType.includes('video') || mimeType.startsWith('video/')
        const isImage =
            assetType.includes('image') ||
            mimeType.startsWith('image/') ||
            (!isAudio && !isVideo && !mimeType)
        const url = String(
            asset.url || asset.uri || asset.media_url || asset.preview_url || asset.cover_url || ''
        ).trim()
        const previewUrl = isVideo
            ? firstUsableAssetThumb([
                  meta.cover_preview_url,
                  asset.cover_preview_url,
                  asset.cover_url,
                  asset.cover,
                  asset.thumbnail
              ])
            : firstUsableAssetThumb([
                  meta.preview_url,
                  asset.preview_url,
                  meta.cover_preview_url,
                  asset.cover_preview_url,
                  asset.cover_url,
                  asset.cover,
                  asset.thumbnail,
                  asset.url,
                  asset.uri
              ])
        if (!url || (!isAudio && !isVideo && !isImage)) return
        pushMention({
            id: `asset-${asset.id || url}`,
            type: 'asset',
            source: 'asset',
            name: String(
                asset.title ||
                    asset.name ||
                    (isAudio ? '资产音乐' : isVideo ? '资产视频' : '资产图片')
            ),
            url,
            preview_url: previewUrl,
            asset_id: asset.id,
            role: isAudio ? 'reference_audio' : isVideo ? 'reference_video' : 'reference_image',
            mime_type: mimeType,
            asset_type: assetType
        })
    })

    return mentions
}

function handleAssetThumbError(item: AssetSidebarItem) {
    if (item.thumb) {
        brokenAssetThumbs.value = new Set([...brokenAssetThumbs.value, item.thumb])
    }
    item.thumb = ''
}

function nodeDownloadFileName(node: CanvasNodeData, url: string) {
    const mediaType = node.type === 'audio' ? 'audio' : node.type === 'video' ? 'video' : 'image'
    const rawName = nodeMediaTitle(node).replace(/[\\/:*?"<>|]+/g, '_') || mediaType
    const ext = mediaFileExtension(url, mediaType)
    return rawName.toLowerCase().endsWith(`.${ext}`) ? rawName : `${rawName}.${ext}`
}

function mediaFileExtension(url: string, type: 'image' | 'video' | 'audio') {
    const clean = url.split('?')[0]?.split('#')[0] || ''
    const matched = clean.match(/\.([a-z0-9]{2,5})$/i)
    if (matched?.[1]) return matched[1].toLowerCase()
    return type === 'audio' ? 'mp3' : type === 'video' ? 'mp4' : 'png'
}

function triggerBrowserDownload(url: string, fileName: string) {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
}

function duplicateNode(id: string) {
    const source = findNode(id)
    if (!source) return
    const copy: CanvasNodeData = clone({
        ...source,
        id: createId(source.type),
        position: { x: source.position.x + 36, y: source.position.y + 36 },
        title: `${source.title} 副本`
    })
    nodes.value = [...nodes.value, copy]
    selectedIds.value = new Set([copy.id])
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    commit()
}

function removeNode(id: string) {
    nodes.value = nodes.value.filter((node) => node.id !== id)
    connections.value = connections.value.filter(
        (connection) => connection.fromNodeId !== id && connection.toNodeId !== id
    )
    selectedIds.value.delete(id)
    selectedIds.value = new Set(selectedIds.value)
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    commit()
}

function setNodeRef(id: string, instance: any) {
    if (instance) {
        nodeRefs.value[id] = instance
    } else {
        delete nodeRefs.value[id]
    }
}

function playDraggedVideoNodes() {
    dragState.value.initial.forEach((item) => {
        const node = findNode(item.id)
        if (node?.type === 'video') nodeRefs.value[item.id]?.playPreviewVideo?.()
    })
}

function startNodeDrag(event: PointerEvent, id: string) {
    const multiSelect = event.shiftKey || event.ctrlKey || event.metaKey
    if (multiSelect) {
        const next = new Set(selectedIds.value)
        next.has(id) ? next.delete(id) : next.add(id)
        selectedIds.value = next
    } else if (!selectedIds.value.has(id)) {
        selectedIds.value = new Set([id])
    }
    selectedConnectionId.value = ''
    connectionCreateMenu.value = null
    dragState.value = {
        active: false,
        pending: true,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        initial: nodes.value
            .filter((node) => selectedIds.value.has(node.id))
            .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }))
    }
}

function handleStagePointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null
    if (isBlockingCanvasSelectionTarget(target)) return
    if (isInteractiveNodeTarget(target)) return
    const hitNodeId = findNodeHitAreaAtPoint(event.clientX, event.clientY)
    if (hitNodeId) {
        if (event.button !== 0) return
        const next = new Set(event.shiftKey ? selectedIds.value : [])
        next.has(hitNodeId) ? next.delete(hitNodeId) : next.add(hitNodeId)
        selectedIds.value = next
        selectedConnectionId.value = ''
        contextMenu.value = null
        connectionCreateMenu.value = null
        return
    }
    showAddMenu.value = false
    contextMenu.value = null
    connectionCreateMenu.value = null
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    selectedConnectionId.value = ''
    if (event.button === 1) {
        event.preventDefault()
        beginPan(event)
        return
    }
    if (event.button !== 0) return
    selectionBaseIds.value = event.shiftKey ? new Set(selectedIds.value) : new Set()
    beginSelection(event, event.shiftKey)
    if (!event.shiftKey) selectedIds.value = new Set()
}

function handleStageDblClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    if (
        isBlockingCanvasSelectionTarget(target) ||
        isInteractiveNodeTarget(target) ||
        findNodeHitAreaAtPoint(event.clientX, event.clientY)
    )
        return
    showAddMenu.value = false
    connectionCreateMenu.value = null
    selectedConnectionId.value = ''
    contextMenu.value = { ...menuPoint(event.clientX, event.clientY, 220, 184), mode: 'add' }
}

function seedDefaultCanvas() {
    const rect = stageRef.value?.getBoundingClientRect()
    const width = rect?.width || window.innerWidth || 1280
    const height = rect?.height || window.innerHeight || 720
    const top = Math.round(height * 0.42)
    const textSize = nodeSize('text')
    const mediaSize = nodeSize('image')
    const seededNodes = [
        createNativeCanvasNode(
            'text',
            { x: Math.round(width * 0.198), y: top },
            { content: '', prompt: '' }
        ),
        createNativeCanvasNode(
            'image',
            { x: Math.round(width * 0.432), y: top - 8 },
            { prompt: '' }
        ),
        createNativeCanvasNode('video', { x: Math.round(width * 0.69), y: top - 8 }, { prompt: '' })
    ].map((node) => ({
        ...node,
        width: node.type === 'text' ? textSize.width : mediaSize.width,
        height: node.type === 'text' ? textSize.height : mediaSize.height
    }))
    nodes.value = seededNodes
    connections.value = []
    selectedIds.value = new Set()
    setViewport({ x: 0, y: 0, k: 1 })
    resetHistory()
    persistProject()
}

function handleStageWheel(event: WheelEvent) {
    handleWheel(event)
    persistProject()
}

function handleStageContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    if (isInteractiveNodeTarget(target) || findNodeHitAreaAtPoint(event.clientX, event.clientY))
        return
    selectedConnectionId.value = ''
    connectionCreateMenu.value = null
    contextMenu.value = { ...menuPoint(event.clientX, event.clientY, 196, 238), mode: 'root' }
}

function isBlockingCanvasSelectionTarget(target: HTMLElement | null) {
    return !!target?.closest(
        '.bottom-toolbar,.canvas-rail,.asset-sidebar,.floating-palette,.next-step,.mini-map,.shortcut-popover,.context-menu,.zoom-menu,.canvas-topbar'
    )
}

function isInteractiveNodeTarget(target: HTMLElement | null) {
    return !!target?.closest(
        '.native-canvas-node,.node-body,.node-head,.node-composer,.node-port,.image-action-bar,.redraw-action-bar,.text-action-bar'
    )
}

function findNodeHitAreaAtPoint(clientX: number, clientY: number) {
    const world = screenToCanvas(clientX, clientY)
    const scale = Math.max(0.05, Number(viewport.value.k || 1))
    const sideInset = 10 / scale
    const topInset = 62 / scale
    const bottomInset = 12 / scale
    for (let index = nodes.value.length - 1; index >= 0; index -= 1) {
        const node = nodes.value[index]
        const left = node.position.x - sideInset
        const right = node.position.x + node.width + sideInset
        const top = node.position.y - topInset
        const bottom = node.position.y + node.height + bottomInset
        if (world.x >= left && world.x <= right && world.y >= top && world.y <= bottom)
            return node.id
    }
    return ''
}

function handleNodeContextMenu(event: MouseEvent, id: string) {
    selectedIds.value = new Set([id])
    selectedConnectionId.value = ''
    connectionCreateMenu.value = null
    contextMenu.value = { ...menuPoint(event.clientX, event.clientY, 192, 96), nodeId: id }
}

function handleConnectionContextMenu(event: MouseEvent, id: string) {
    selectedIds.value = new Set()
    selectedConnectionId.value = id
    connectionCreateMenu.value = null
    contextMenu.value = { ...menuPoint(event.clientX, event.clientY, 192, 60), connectionId: id }
}

function selectConnection(id: string) {
    selectedIds.value = new Set()
    selectedConnectionId.value = id
    contextMenu.value = null
    connectionCreateMenu.value = null
}

function resolveConnectionSourceIds(state: { fromNodeId?: string; fromNodeIds?: string[] } | null) {
    if (!state) return []
    return state.fromNodeIds?.length
        ? state.fromNodeIds
        : state.fromNodeId
          ? [state.fromNodeId]
          : []
}

function startConnection(event: PointerEvent, id: string, direction: 'before' | 'after' = 'after') {
    const current = screenToCanvas(event.clientX, event.clientY)
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    connecting.value =
        direction === 'before' ? { targetNodeId: id, current } : { fromNodeId: id, current }
}

function finishConnectionOnNode(id: string) {
    if (connecting.value?.targetNodeId) {
        const targetNodeId = connecting.value.targetNodeId
        if (id !== targetNodeId) addConnection(id, targetNodeId)
        connecting.value = null
        connectionCreateMenu.value = null
        return
    }
    const sourceIds = resolveConnectionSourceIds(connecting.value)
    if (!sourceIds.length || sourceIds.includes(id)) return
    sourceIds.forEach((fromNodeId) => addConnection(fromNodeId, id))
    connecting.value = null
    connectionCreateMenu.value = null
}

function addConnection(fromNodeId: string, toNodeId: string) {
    if (
        fromNodeId === toNodeId ||
        connections.value.some(
            (item) => item.fromNodeId === fromNodeId && item.toNodeId === toNodeId
        )
    )
        return
    connections.value = [...connections.value, createNativeConnection(fromNodeId, toNodeId)]
    selectedConnectionId.value = ''
    commit()
}

function startMultiSelectionConnection(event: PointerEvent) {
    const bounds = multiSelectionBounds.value
    if (!bounds) return
    const sourceIds = nodes.value
        .filter((node) => selectedIds.value.has(node.id))
        .map((node) => node.id)
    if (!sourceIds.length) return
    connecting.value = {
        fromNodeIds: sourceIds,
        current: screenToCanvas(event.clientX, event.clientY)
    }
    connectionCreateMenu.value = null
    contextMenu.value = null
    selectedConnectionId.value = ''
}

function removeConnection(id: string) {
    connections.value = connections.value.filter((connection) => connection.id !== id)
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    commit()
}

function removeReferenceConnection(targetId: string, sourceId?: string) {
    if (!sourceId) return
    const before = connections.value.length
    connections.value = connections.value.filter(
        (connection) => !(connection.fromNodeId === sourceId && connection.toNodeId === targetId)
    )
    if (connections.value.length === before) return
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    commit()
}

function createConnectedNode(type: CanvasNodeType) {
    const menu = connectionCreateMenu.value
    if (!menu) return
    const size = nodeSize(type)
    const node = {
        ...createNativeCanvasNode(
            type,
            { x: menu.worldX - size.width / 2, y: menu.worldY - size.height / 2 },
            defaultMetadataForNode(type)
        ),
        ...size
    }
    const sourceIds = menu.fromNodeIds?.length
        ? menu.fromNodeIds
        : menu.fromNodeId
          ? [menu.fromNodeId]
          : []
    nodes.value = [...nodes.value, node]
    const nextConnections = [...connections.value]
    sourceIds.forEach((fromNodeId) => {
        if (
            fromNodeId !== node.id &&
            !nextConnections.some(
                (item) => item.fromNodeId === fromNodeId && item.toNodeId === node.id
            )
        ) {
            nextConnections.push(createNativeConnection(fromNodeId, node.id))
        }
    })
    if (
        menu.targetNodeId &&
        menu.targetNodeId !== node.id &&
        !nextConnections.some(
            (item) => item.fromNodeId === node.id && item.toNodeId === menu.targetNodeId
        )
    ) {
        nextConnections.push(createNativeConnection(node.id, menu.targetNodeId))
    }
    connections.value = nextConnections
    selectedIds.value = new Set([node.id])
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    commit()
}

function handlePointerMove(event: PointerEvent) {
    if (miniMapDragging.value) {
        centerMiniMapFromEvent(event)
        return
    }
    if (dragState.value.pending || dragState.value.active) {
        const dx = (event.clientX - dragState.value.startX) / viewport.value.k
        const dy = (event.clientY - dragState.value.startY) / viewport.value.k
        const screenDx = event.clientX - dragState.value.startX
        const screenDy = event.clientY - dragState.value.startY
        const overDragThreshold = Math.hypot(screenDx, screenDy) >= 5
        if (!dragState.value.active && !overDragThreshold) return
        dragState.value.active = true
        dragState.value.pending = false
        dragState.value.moved = true
        nodes.value = nodes.value.map((node) => {
            const initial = dragState.value.initial.find((item) => item.id === node.id)
            return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node
        })
        return
    }
    if (isPanning.value) {
        updatePan(event)
        return
    }
    if (selectionBox.value) {
        updateSelection(event)
        if (selectionBox.value) selectNodesInBox(selectionBox.value)
        return
    }
    if (connecting.value) {
        connecting.value = {
            ...connecting.value,
            current: screenToCanvas(event.clientX, event.clientY)
        }
    }
}

function handlePointerUp(event: PointerEvent) {
    if (miniMapDragging.value) {
        miniMapDragging.value = false
        persistProject()
        return
    }
    if (dragState.value.pending || dragState.value.active) {
        const moved = dragState.value.moved
        dragState.value.active = false
        dragState.value.pending = false
        if (moved) {
            commit()
            playDraggedVideoNodes()
        }
        return
    }
    if (isPanning.value) {
        endPan()
        persistProject()
        return
    }
    if (selectionBox.value) {
        const box = endSelection()
        if (box) selectNodesInBox(box)
        return
    }
    if (connecting.value) {
        const target = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>('[data-native-node-id]')
        const targetId = target?.dataset.nativeNodeId
        if (connecting.value.targetNodeId) {
            const targetNodeId = connecting.value.targetNodeId
            if (targetId && targetId !== targetNodeId) {
                addConnection(targetId, targetNodeId)
                connecting.value = null
                return
            }
            const world = screenToCanvas(event.clientX, event.clientY)
            connectionCreateMenu.value = {
                ...menuPoint(event.clientX, event.clientY, 220, 184),
                worldX: world.x,
                worldY: world.y,
                targetNodeId
            }
            connecting.value = null
            return
        }
        const sourceIds = resolveConnectionSourceIds(connecting.value)
        if (targetId && !sourceIds.includes(targetId)) {
            sourceIds.forEach((fromNodeId) => addConnection(fromNodeId, targetId))
            connecting.value = null
            return
        }
        const world = screenToCanvas(event.clientX, event.clientY)
        connectionCreateMenu.value = {
            ...menuPoint(event.clientX, event.clientY, 220, 184),
            worldX: world.x,
            worldY: world.y,
            ...(sourceIds.length > 1 ? { fromNodeIds: sourceIds } : { fromNodeId: sourceIds[0] })
        }
        connecting.value = null
    }
}

function selectNodesInBox(box: SelectionBoxState) {
    const minX = Math.min(box.startWorldX, box.currentWorldX)
    const minY = Math.min(box.startWorldY, box.currentWorldY)
    const maxX = Math.max(box.startWorldX, box.currentWorldX)
    const maxY = Math.max(box.startWorldY, box.currentWorldY)
    const next = box.additive ? new Set(selectionBaseIds.value) : new Set<string>()
    nodes.value.forEach((node) => {
        if (!['text', 'image', 'video', 'audio'].includes(node.type)) return
        if (
            node.position.x + node.width >= minX &&
            node.position.x <= maxX &&
            node.position.y + node.height >= minY &&
            node.position.y <= maxY
        )
            next.add(node.id)
    })
    selectedIds.value = next
}

function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (event.key === 'Escape' && mediaPreview.value) {
        closeMediaPreview()
        return
    }
    if (target?.closest('input,textarea,select,[contenteditable=true]')) return
    const key = event.key.toLowerCase()
    const mod = event.ctrlKey || event.metaKey
    if (mod && key === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
    } else if (mod && key === 'y') {
        event.preventDefault()
        redo()
    } else if (mod && key === 'a') {
        event.preventDefault()
        selectedIds.value = new Set(nodes.value.map((node) => node.id))
        selectedConnectionId.value = ''
    } else if (mod && key === 'c') {
        event.preventDefault()
        void copySelected()
    } else if (mod && key === 'v') {
        contextMenu.value = null
        connectionCreateMenu.value = null
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelection()
    } else if (event.key === 'Escape') {
        selectedIds.value = new Set()
        selectedConnectionId.value = ''
        contextMenu.value = null
        connectionCreateMenu.value = null
        connecting.value = null
    }
}

function deleteSelection() {
    if (selectedIds.value.size) {
        nodes.value = nodes.value.filter((node) => !selectedIds.value.has(node.id))
        connections.value = connections.value.filter(
            (connection) =>
                !selectedIds.value.has(connection.fromNodeId) &&
                !selectedIds.value.has(connection.toNodeId)
        )
        selectedIds.value = new Set()
        selectedConnectionId.value = ''
        commit()
        return
    }
    if (selectedConnectionId.value) {
        removeConnection(selectedConnectionId.value)
    }
}

async function copySelected() {
    const payload = getSelectedClipboardPayload()
    if (!payload.nodes.length) return
    const serialized = JSON.stringify(payload)
    sessionStorage.setItem('aigc-canvas-clipboard', serialized)
    try {
        await navigator.clipboard?.writeText(serialized)
    } catch {
        // Browser permission can block clipboard writes; session clipboard remains available.
    }
}

function handleCopy(event: ClipboardEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('input,textarea,select,[contenteditable=true]')) return
    const payload = getSelectedClipboardPayload()
    if (!payload.nodes.length) return
    const serialized = JSON.stringify(payload)
    sessionStorage.setItem('aigc-canvas-clipboard', serialized)
    event.clipboardData?.setData('text/plain', serialized)
    event.preventDefault()
}

function getSelectedClipboardPayload(): CanvasClipboardPayload {
    return {
        nodes: nodes.value
            .filter((node) => selectedIds.value.has(node.id))
            .map((node) => clone(node)),
        connections: connections.value
            .filter(
                (connection) =>
                    selectedIds.value.has(connection.fromNodeId) &&
                    selectedIds.value.has(connection.toNodeId)
            )
            .map((connection) => clone(connection))
    }
}

async function pasteSelected() {
    const localPayload = readCanvasClipboardPayload(sessionStorage.getItem('aigc-canvas-clipboard'))
    if (localPayload?.nodes.length) {
        pasteCanvasPayload(localPayload)
        return
    }
    const systemPayload = await readSystemClipboardPayload()
    if (systemPayload?.nodes.length) {
        pasteCanvasPayload(systemPayload)
    }
}

function pasteCanvasPayload(payload: CanvasClipboardPayload) {
    const center = getCanvasCenter()
    const minX = Math.min(...payload.nodes.map((node) => node.position.x))
    const minY = Math.min(...payload.nodes.map((node) => node.position.y))
    const idMap = new Map<string, string>()
    const pasted = payload.nodes.map((node) => {
        const nextId = createId(node.type)
        idMap.set(node.id, nextId)
        return {
            ...clone(node),
            id: nextId,
            position: {
                x: center.x + (node.position.x - minX),
                y: center.y + (node.position.y - minY)
            }
        }
    })
    const pastedConnections = payload.connections
        .map((connection) => {
            const fromNodeId = idMap.get(connection.fromNodeId)
            const toNodeId = idMap.get(connection.toNodeId)
            return fromNodeId && toNodeId ? createNativeConnection(fromNodeId, toNodeId) : null
        })
        .filter((connection): connection is CanvasConnection => !!connection)
    nodes.value = [...nodes.value, ...pasted]
    connections.value = [...connections.value, ...pastedConnections]
    selectedIds.value = new Set(pasted.map((node) => node.id))
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    commit()
}

function readCanvasClipboardPayload(raw: string | null): CanvasClipboardPayload | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return { nodes: parsed, connections: [] }
        if (Array.isArray(parsed?.nodes))
            return {
                nodes: parsed.nodes,
                connections: Array.isArray(parsed.connections) ? parsed.connections : []
            }
    } catch {
        return null
    }
    return null
}

function handlePaste(event: ClipboardEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('input,textarea,select,[contenteditable=true]')) return
    const items = Array.from(event.clipboardData?.items || [])
    const fileItem = items.find(
        (item) =>
            item.kind === 'file' &&
            (item.type.startsWith('image/') ||
                item.type.startsWith('video/') ||
                item.type.startsWith('audio/'))
    )
    if (fileItem) {
        const file = fileItem.getAsFile()
        if (!file) return
        event.preventDefault()
        addFileNode(file, getCanvasCenter())
        return
    }
    const text = event.clipboardData?.getData('text/plain') || ''
    if (!text.trim()) return
    const payload = readCanvasClipboardPayload(text)
    event.preventDefault()
    if (payload?.nodes.length) pasteCanvasPayload(payload)
    else addNode('text', getCanvasCenter(), { content: text.trim(), prompt: text.trim() })
}

async function readSystemClipboardPayload(): Promise<CanvasClipboardPayload | null> {
    const center = getCanvasCenter()
    try {
        const items = await navigator.clipboard?.read?.()
        for (const item of items || []) {
            const imageType = item.types.find((type) => type.startsWith('image/'))
            if (!imageType) continue
            const blob = await item.getType(imageType)
            const url = URL.createObjectURL(blob)
            return {
                nodes: [
                    createNativeCanvasNode('image', center, {
                        image: url,
                        url,
                        status: 'success',
                        mimeType: imageType,
                        mediaSource: 'clipboard'
                    })
                ],
                connections: []
            }
        }
    } catch {
        // Fall back to text clipboard below.
    }
    try {
        const text = await navigator.clipboard?.readText?.()
        const payload = readCanvasClipboardPayload(text || '')
        if (payload?.nodes.length) return payload
        if (text?.trim())
            return {
                nodes: [
                    createNativeCanvasNode('text', center, {
                        content: text.trim(),
                        prompt: text.trim()
                    })
                ],
                connections: []
            }
    } catch {
        return null
    }
    return null
}

async function runNode(id: string) {
    const node = findNode(id)
    if (!node) return
    if (!(await ensurePcLogin())) return
    if (node.type === 'image' && node.metadata.redrawMode) {
        try {
            await runLocalRedrawNode(node)
        } catch (error) {
            const hasSourceImage = Boolean(node.metadata.image || node.metadata.url)
            const fallbackStatus = hasSourceImage
                ? 'success'
                : node.metadata.status === 'running'
                  ? 'idle'
                  : node.metadata.status || 'idle'
            updateNode(id, {
                metadata: {
                    status: fallbackStatus,
                    errorDetails: error instanceof Error ? error.message : '生成失败'
                }
            })
            ElMessage.error(error instanceof Error ? error.message : '生成失败')
        } finally {
            runningNodeId.value = ''
            commit()
        }
        return
    }
    runningNodeId.value = id
    updateNode(id, { metadata: { status: 'running', errorDetails: '' } })
    try {
        if (node.type === 'text' || node.type === 'config') await runTextNode(node)
        else if (node.type === 'image') await runImageNode(node)
        else if (node.type === 'audio') await runMusicNode(node)
        else await runVideoNode(node)
    } catch (error) {
        if (isGenerationPendingError(error)) {
            updateNode(id, {
                metadata: {
                    status: 'running',
                    taskId: error.taskId || node.metadata.taskId,
                    errorDetails: '',
                    pending: true
                }
            })
            return
        }
        updateNode(id, {
            metadata: {
                status: 'failed',
                errorDetails: error instanceof Error ? error.message : '生成失败'
            }
        })
        ElMessage.error(error instanceof Error ? error.message : '生成失败')
    } finally {
        runningNodeId.value = ''
        commit()
    }
}

async function runTextNode(node: CanvasNodeData) {
    const prompt = buildPrompt(node)
    if (!prompt) throw new Error('请输入文本提示词')
    const composerPrompt = String(node.metadata.prompt || '')
    const mentionPayload = canvasMentionGenerationPayload(node)
    let received = ''
    try {
        await streamCanvasText(
            {
                prompt,
                node_id: node.id,
                project_id: currentProject.value?.id,
                reference_images: collectReferenceImages(node.id),
                ...mentionPayload,
                ...nodeGenerationConfig(node)
            },
            {
                onEvent(event) {
                    const data = event.data || {}
                    const text = data.delta || data.content || data.text || data.message || ''
                    if (text) {
                        received += String(text)
                        updateNode(node.id, {
                            metadata: {
                                content: received,
                                richContent: '',
                                prompt: composerPrompt,
                                status: 'running'
                            }
                        })
                    }
                }
            }
        )
    } catch {
        const result: any = await proxyChat({
            prompt,
            reference_images: collectReferenceImages(node.id),
            ...mentionPayload,
            ...nodeGenerationConfig(node)
        })
        received = String(result?.content || result?.text || result?.message || result || '')
    }
    updateNode(node.id, {
        metadata: {
            content: received || prompt,
            richContent: '',
            prompt: composerPrompt,
            status: 'success'
        }
    })
}

async function runImageNode(node: CanvasNodeData) {
    if (node.metadata.redrawMode) {
        await runLocalRedrawNode(node)
        return
    }
    const prompt = buildPrompt(node)
    if (!prompt) throw new Error('请输入图片提示词')
    const mentionPayload = canvasMentionGenerationPayload(node)
    const result: any = await proxyImage({
        prompt,
        node_id: node.id,
        project_id: currentProject.value?.id,
        reference_images: collectReferenceImages(node.id),
        ...mentionPayload,
        ...nodeGenerationConfig(node)
    })
    const image = await resolveImageResult(result)
    if (!image) throw new Error('图片接口没有返回结果')
    updateNode(node.id, {
        metadata: {
            prompt,
            image,
            url: image,
            status: 'success',
            mediaSource: 'generated',
            generatedAt: Date.now()
        }
    })
}

async function runLocalRedrawNode(node: CanvasNodeData) {
    const prompt = buildPrompt(node)
    const sourceImage = String(node.metadata.image || node.metadata.url || '').trim()
    const maskPreviewImage = String(node.metadata.redrawMaskImage || '').trim()
    const maskImage = String(
        node.metadata.redrawMaskImage || node.metadata.redrawProviderMaskImage || ''
    ).trim()
    if (!sourceImage) throw new Error('请先选择需要局部重绘的原图')
    if (!maskPreviewImage && !maskImage) throw new Error('请先绘制局部重绘的蒙版')
    if (!prompt) throw new Error('请输入局部重绘提示词')
    const generationConfig = localRedrawGenerationConfig(node)
    const created = addNode(
        'image',
        { x: node.position.x + node.width + 80, y: node.position.y },
        {
            title: '局部重绘',
            prompt,
            image: '',
            url: '',
            status: 'running',
            errorDetails: '',
            mediaSource: 'generated',
            sourceNodeId: node.id,
            redrawSourceImage: sourceImage,
            redrawMaskImage: maskPreviewImage || maskImage,
            redrawProviderMaskImage: maskImage,
            referenceImages: buildLocalRedrawReferenceImages(maskPreviewImage || maskImage),
            ...generationConfig
        }
    )
    addConnection(node.id, created.id)
    selectedIds.value = new Set([created.id])
    selectedConnectionId.value = ''
    runningNodeId.value = created.id
    updateNode(node.id, {
        metadata: clearLocalRedrawMetadata({
            ...localRedrawOriginalComposer(node.metadata),
            status: sourceImage ? 'success' : node.metadata.status || 'idle',
            errorDetails: ''
        })
    })
    try {
        const result: any = await generateAigcLocalRedraw(
            compactPayload({
                source_image: sourceImage,
                mask_image: maskImage,
                prompt,
                ...generationConfig
            })
        )
        const taskId = resultTaskId(result)
        updateNode(created.id, {
            metadata: { prompt, localRedrawTaskId: taskId, status: 'running', errorDetails: '' }
        })
        const resolved = await resolveLocalRedrawResult(result)
        const image = resolved.image
        if (!image) {
            if (!taskId) throw new Error('局部重绘接口没有返回任务 ID')
            void refreshPendingLocalRedrawNodes()
            return
        }
        const resolvedSourceImage = localRedrawSourceImage(resolved.detail) || sourceImage
        const resolvedMaskImage = localRedrawMaskImage(resolved.detail) || maskImage
        updateNode(created.id, {
            metadata: {
                prompt,
                image,
                url: image,
                status: 'success',
                errorDetails: '',
                mediaSource: 'generated',
                generatedAt: Date.now(),
                localRedrawTaskId: taskId,
                redrawSourceImage: resolvedSourceImage,
                redrawMaskImage: resolvedMaskImage,
                referenceImages: buildLocalRedrawReferenceImages(resolvedMaskImage)
            }
        })
    } catch (error) {
        updateNode(created.id, {
            metadata: {
                status: 'failed',
                errorDetails: error instanceof Error ? error.message : '局部重绘生成失败'
            }
        })
        throw error
    }
}

async function runVideoNode(node: CanvasNodeData) {
    const prompt = buildPrompt(node)
    const mentionPayload = canvasMentionGenerationPayload(node)
    const ownReferenceAssets = [
        ...(Array.isArray(node.metadata.referenceImages) ? node.metadata.referenceImages : []).map(
            (item: any) => ({
                type: 'image',
                uri: String(item.url || ''),
                url: String(item.url || ''),
                name: String(item.name || '参考图'),
                role: String(item.role || 'reference_image')
            })
        ),
        ...(Array.isArray(node.metadata.referenceVideos) ? node.metadata.referenceVideos : []).map(
            (item: any) => ({
                type: 'video',
                uri: String(item.url || ''),
                url: String(item.url || ''),
                name: String(item.name || '参考视频'),
                role: String(item.role || 'reference_video')
            })
        ),
        ...(Array.isArray(node.metadata.referenceAudios) ? node.metadata.referenceAudios : []).map(
            (item: any) => ({
                type: 'audio',
                uri: String(item.url || ''),
                url: String(item.url || ''),
                name: String(item.name || '参考音频'),
                role: String(item.role || 'reference_audio')
            })
        )
    ].filter((item) => item.url)
    const referenceAssets = uniqueReferenceAssets([
        ...ownReferenceAssets,
        ...(Array.isArray(mentionPayload.reference_assets)
            ? mentionPayload.reference_assets
            : [])
    ])
    const referenceImages = collectReferenceImages(node.id)
    if (!prompt && !referenceAssets.length && !referenceImages.length)
        throw new Error('请输入视频提示词或添加参考素材')
    const firstFrame = ownReferenceAssets.find(
        (item) => item.type === 'image' && item.role === 'first_frame_image'
    )
    const lastFrame = ownReferenceAssets.find(
        (item) => item.type === 'image' && item.role === 'last_frame_image'
    )
    const result: any = await proxyVideo({
        prompt,
        node_id: node.id,
        project_id: currentProject.value?.id,
        reference_images: referenceImages,
        ...mentionPayload,
        reference_assets: referenceAssets,
        first_frame_image: firstFrame?.url,
        last_frame_image: lastFrame?.url,
        ...nodeGenerationConfig(node)
    })
    const taskId = resultTaskId(result)
    if (taskId) {
        updateNode(node.id, { metadata: { prompt, taskId, status: 'running', errorDetails: '' } })
    }
    const video = await resolveVideoResult(result)
    if (!video) throw new Error('视频接口没有返回结果')
    updateNode(node.id, {
        metadata: {
            prompt,
            taskId,
            url: video,
            status: 'success',
            errorDetails: '',
            mediaSource: 'generated',
            generatedAt: Date.now()
        }
    })
}

async function runMusicNode(node: CanvasNodeData) {
    const prompt = buildPrompt(node)
    if (!prompt && !String(node.metadata.lyrics || '').trim())
        throw new Error('请输入音乐提示词或歌词')
    const mentionPayload = canvasMentionGenerationPayload(node)
    const referenceAudios = collectReferenceAudios(node.id)
    const referenceAssets = [
        ...(Array.isArray(mentionPayload.reference_assets) ? mentionPayload.reference_assets : []),
        ...referenceAudios.map((url) => ({ type: 'audio', uri: url, url, name: '参考音频' }))
    ]
    const result: any = await proxyMusic({
        prompt,
        node_id: node.id,
        project_id: currentProject.value?.id,
        audio_url: referenceAudios[0],
        reference_audio: referenceAudios[0],
        ...mentionPayload,
        reference_assets: uniqueReferenceAssets(referenceAssets),
        ...nodeGenerationConfig(node)
    })
    const taskId = resultTaskId(result)
    if (taskId) {
        updateNode(node.id, { metadata: { prompt, taskId, status: 'running', errorDetails: '' } })
    }
    const audio = await resolveMusicResult(result)
    if (!audio) throw new Error('音乐接口没有返回结果')
    updateNode(node.id, {
        metadata: {
            prompt,
            taskId,
            url: audio,
            status: 'success',
            errorDetails: '',
            mediaSource: 'generated',
            generatedAt: Date.now()
        }
    })
}

async function resolveImageResult(result: any) {
    const direct = resultUrl(result, ['url', 'image_url', 'image'])
    if (direct) return direct
    const taskId = result?.task_id || result?.taskId || result?.id
    if (!taskId) return ''
    for (let index = 0; index < 300; index += 1) {
        await delay(3000)
        const detail: any = await proxyImageQuery(taskId)
        const url = resultUrl(detail, ['url', 'image_url', 'image'])
        if (url) return url
        if (isRecoverableImagePendingDetail(detail)) continue
        if (
            String(detail?.status || detail?.state || '')
                .toLowerCase()
                .includes('fail')
        )
            throw new Error(detail?.error || detail?.msg || '图片生成失败')
    }
    throw new GenerationPendingError('', taskId)
}

function isRecoverableImagePendingDetail(detail: any) {
    const status = String(detail?.status || detail?.state || '').toLowerCase()
    const message = String(detail?.error || detail?.msg || detail?.message || '')
    if (
        ['running', 'queued', 'loading', 'processing', 'pending'].some((item) =>
            status.includes(item)
        )
    ) {
        return true
    }
    return [
        '上游任务仍在生成中',
        '稍后自动重试',
        '任务查询暂时失败',
        '自动查询结果',
        '仍在生成'
    ].some((needle) => message.includes(needle))
}

type LocalRedrawResolvedResult = {
    image: string
    detail?: any
}

const localRedrawImageResultKeys = [
    'url',
    'image_url',
    'image',
    'download_url',
    'file_url',
    'output_url',
    'image_uri'
]

async function resolveLocalRedrawResult(result: any): Promise<LocalRedrawResolvedResult> {
    const direct = resultUrl(result, localRedrawImageResultKeys)
    if (direct) return { image: direct, detail: result }
    const taskId = resultTaskId(result)
    if (!taskId) return { image: '', detail: result }
    try {
        const detail: any = await getAigcLocalRedrawTask({ id: taskId })
        const url = resultUrl(detail, localRedrawImageResultKeys)
        if (url) return { image: url, detail }
        return { image: '', detail }
    } catch {
        return { image: '', detail: result }
    }
}

function localRedrawSourceImage(payload: any) {
    return resultUrl(payload, ['source_image_url', 'source_image'])
}

function localRedrawMaskImage(payload: any) {
    return resultUrl(payload, ['mask_image_url', 'mask_image', 'mask_url'])
}

function buildLocalRedrawReferenceImages(maskImage: string) {
    const url = String(maskImage || '').trim()
    return url ? [{ url, name: '蒙版', role: 'redraw_mask' }] : []
}

function hasLocalRedrawMaskReference(node: CanvasNodeData) {
    const references = Array.isArray(node.metadata.referenceImages)
        ? node.metadata.referenceImages
        : []
    return references.some((item: any) => item?.role === 'redraw_mask')
}

function mergeLocalRedrawReferenceImages(node: CanvasNodeData, maskImage: string) {
    const references = Array.isArray(node.metadata.referenceImages)
        ? node.metadata.referenceImages
        : []
    return [
        ...references.filter((item: any) => item?.role !== 'redraw_mask'),
        ...buildLocalRedrawReferenceImages(maskImage)
    ]
}

function localRedrawOriginalComposer(metadata: Record<string, any> = {}) {
    const original = metadata.redrawOriginalComposer
    return original && typeof original === 'object' ? original : { prompt: '', content: '' }
}

function clearLocalRedrawMetadata(metadata: Record<string, any> = {}) {
    return {
        ...metadata,
        redrawMode: false,
        redrawMaskImage: '',
        redrawTool: undefined,
        redrawBrushSize: undefined,
        redrawPrompt: '',
        redrawConfig: undefined,
        redrawOriginalComposer: undefined,
        redrawProviderMaskImage: '',
        localRedrawTaskId: undefined,
        redrawSourceImage: undefined
    }
}

async function resolveVideoResult(result: any) {
    const direct = resultUrl(result, [
        'url',
        'video_url',
        'videoUrl',
        'video',
        'download_url',
        'file_url',
        'output_url',
        'video_uri'
    ])
    if (direct) return direct
    const taskId = resultTaskId(result)
    if (!taskId) return ''
    for (let index = 0; index < 300; index += 1) {
        await delay(3000)
        const detail: any = await proxyVideoQuery(taskId)
        const url = resultUrl(detail, [
            'url',
            'video_url',
            'videoUrl',
            'video',
            'download_url',
            'file_url',
            'output_url',
            'video_uri'
        ])
        if (url) return url
        if (
            String(detail?.status || detail?.state || '')
                .toLowerCase()
                .includes('fail')
        )
            throw new Error(detail?.error || detail?.msg || '视频生成失败')
    }
    throw new Error('视频生成超时')
}

async function resolveMusicResult(result: any) {
    const direct = resultUrl(result, [
        'url',
        'audio_url',
        'audioUrl',
        'audio',
        'download_url',
        'file_url',
        'output_url',
        'audio_uri'
    ])
    if (direct) return direct
    const taskId = resultTaskId(result)
    if (!taskId) return ''
    for (let index = 0; index < 180; index += 1) {
        await delay(3000)
        const detail: any = await proxyMusicQuery(taskId)
        const url = resultUrl(detail, [
            'url',
            'audio_url',
            'audioUrl',
            'audio',
            'download_url',
            'file_url',
            'output_url',
            'audio_uri'
        ])
        if (url) return url
        if (
            String(detail?.status || detail?.state || '')
                .toLowerCase()
                .includes('fail')
        )
            throw new Error(detail?.error || detail?.msg || '音乐生成失败')
    }
    throw new Error('音乐生成超时')
}

async function refreshPendingImageNodes() {
    if (imageRefreshInFlight.value) return
    const pendingNodes = nodes.value.filter((node) => {
        const status = String(node.metadata.status || '').toLowerCase()
        const errorDetails = String(node.metadata.errorDetails || node.metadata.error || '')
        const needsResult = !nodeMediaRawUrl(node)
        const isPendingText =
            errorDetails.includes('超时') ||
            errorDetails.includes('仍在生成中') ||
            errorDetails.includes('自动刷新') ||
            errorDetails.toLowerCase().includes('pending')
        return (
            node.type === 'image' &&
            !!node.metadata.taskId &&
            (node.metadata.pending ||
                ['running', 'queued', 'loading', 'processing'].includes(status) ||
                isPendingText ||
                (needsResult && status !== 'success' && status !== 'canceled'))
        )
    })
    if (!pendingNodes.length) return
    imageRefreshInFlight.value = true
    try {
        for (const node of pendingNodes) {
            try {
                const detail: any = await proxyImageQuery(node.metadata.taskId as string | number)
                const url = resultUrl(detail, ['url', 'image_url', 'image'])
                if (url) {
                    updateNode(node.id, {
                        metadata: {
                            image: url,
                            url,
                            status: 'success',
                            errorDetails: '',
                            mediaSource: 'generated',
                            pending: false,
                            generatedAt: Date.now()
                        }
                    })
                    if (node.metadata.agentJobId) {
                        agentMediaGenerationStatus.value = {
                            jobId: String(node.metadata.agentJobId),
                            mode: 'image',
                            status: 'success',
                            nodeId: node.id,
                            taskId: node.metadata.taskId,
                            url,
                            ratio: node.metadata.ratio
                        }
                    }
                    notifyAgentGenerationNode(node, 'success', { url })
                } else if (
                    String(detail?.status || detail?.state || '')
                        .toLowerCase()
                        .includes('fail') &&
                    !isRecoverableImagePendingDetail(detail)
                ) {
                    const message = detail?.error || detail?.msg || '图片生成失败'
                    updateNode(node.id, {
                        metadata: {
                            status: 'failed',
                            errorDetails: message,
                            pending: false
                        }
                    })
                    if (node.metadata.agentJobId) {
                        agentMediaGenerationStatus.value = {
                            jobId: String(node.metadata.agentJobId),
                            mode: 'image',
                            status: 'failed',
                            nodeId: node.id,
                            taskId: node.metadata.taskId,
                            ratio: node.metadata.ratio,
                            error: message
                        }
                    }
                    notifyAgentGenerationNode(node, 'failed', { error: message })
                }
            } catch {
                // Keep the node running; the next polling cycle will retry.
            }
        }
    } finally {
        imageRefreshInFlight.value = false
    }
}

async function refreshPendingVideoNodes() {
    const pendingNodes = nodes.value.filter((node) => {
        const status = String(node.metadata.status || '').toLowerCase()
        return (
            node.type === 'video' &&
            !!node.metadata.taskId &&
            ['running', 'queued', 'loading'].includes(status)
        )
    })
    if (!pendingNodes.length) return
    for (const node of pendingNodes) {
        try {
            const detail: any = await proxyVideoQuery(node.metadata.taskId as string | number)
            const url = resultUrl(detail, [
                'url',
                'video_url',
                'videoUrl',
                'video',
                'download_url',
                'file_url',
                'output_url',
                'video_uri'
            ])
            if (url) {
                updateNode(node.id, {
                    metadata: {
                        url,
                        status: 'success',
                        errorDetails: '',
                        mediaSource: 'generated',
                        generatedAt: Date.now()
                    }
                })
                if (node.metadata.agentJobId) {
                    agentMediaGenerationStatus.value = {
                        jobId: String(node.metadata.agentJobId),
                        mode: 'video',
                        status: 'success',
                        nodeId: node.id,
                        taskId: node.metadata.taskId,
                        url,
                        poster: String(node.metadata.poster || ''),
                        ratio: node.metadata.ratio
                    }
                }
                notifyAgentGenerationNode(node, 'success', {
                    url,
                    poster: String(node.metadata.poster || '')
                })
            } else if (
                String(detail?.status || detail?.state || '')
                    .toLowerCase()
                    .includes('fail')
            ) {
                updateNode(node.id, {
                    metadata: {
                        status: 'failed',
                        errorDetails: detail?.error || detail?.msg || '视频生成失败'
                    }
                })
                const message = detail?.error || detail?.msg || '视频生成失败'
                if (node.metadata.agentJobId) {
                    agentMediaGenerationStatus.value = {
                        jobId: String(node.metadata.agentJobId),
                        mode: 'video',
                        status: 'failed',
                        nodeId: node.id,
                        taskId: node.metadata.taskId,
                        ratio: node.metadata.ratio,
                        error: message
                    }
                }
                notifyAgentGenerationNode(node, 'failed', { error: message })
            }
        } catch {
            // Keep the existing node state; the next page load or manual run can retry polling.
        }
    }
}

async function refreshPendingLocalRedrawNodes() {
    if (localRedrawRefreshInFlight.value) return
    const pendingNodes = nodes.value.filter((node) => {
        const status = String(node.metadata.status || '').toLowerCase()
        const needsResult = !String(node.metadata.image || node.metadata.url || '').trim()
        const needsMaskReference = !hasLocalRedrawMaskReference(node)
        return (
            node.type === 'image' &&
            !!node.metadata.localRedrawTaskId &&
            (needsResult || needsMaskReference) &&
            (needsMaskReference || status !== 'canceled')
        )
    })
    if (!pendingNodes.length) return
    localRedrawRefreshInFlight.value = true
    try {
        for (const node of pendingNodes) {
            try {
                const detail: any = await getAigcLocalRedrawTask({
                    id: node.metadata.localRedrawTaskId
                })
                const url = resultUrl(detail, localRedrawImageResultKeys)
                const sourceImage =
                    localRedrawSourceImage(detail) || String(node.metadata.redrawSourceImage || '')
                const maskImage =
                    localRedrawMaskImage(detail) || String(node.metadata.redrawMaskImage || '')
                const metadataPatch: Record<string, any> = {}
                if (url && !String(node.metadata.image || node.metadata.url || '').trim()) {
                    Object.assign(metadataPatch, {
                        image: url,
                        url,
                        status: 'success',
                        errorDetails: '',
                        mediaSource: 'generated',
                        generatedAt: Date.now(),
                        redrawSourceImage: sourceImage
                    })
                }
                if (maskImage && !hasLocalRedrawMaskReference(node)) {
                    Object.assign(metadataPatch, {
                        redrawMaskImage: maskImage,
                        redrawProviderMaskImage: maskImage,
                        referenceImages: mergeLocalRedrawReferenceImages(node, maskImage)
                    })
                }
                if (Object.keys(metadataPatch).length) {
                    updateNode(node.id, {
                        metadata: metadataPatch
                    })
                }
                if (url && runningNodeId.value === node.id) runningNodeId.value = ''
                const detailStatus = String(detail?.status || detail?.state || '').toLowerCase()
                if (!url && detailStatus.includes('fail')) {
                    updateNode(node.id, {
                        metadata: {
                            status: 'failed',
                            errorDetails: detail?.error || detail?.msg || '局部重绘生成失败'
                        }
                    })
                } else if (!url && detailStatus.includes('cancel')) {
                    updateNode(node.id, {
                        metadata: { status: 'canceled', errorDetails: '局部重绘任务已取消' }
                    })
                }
            } catch {
                // Keep the existing node state; the next polling cycle will retry.
            }
        }
    } finally {
        localRedrawRefreshInFlight.value = false
    }
}

async function refreshPendingMusicNodes() {
    if (musicRefreshInFlight.value) return
    const pendingNodes = nodes.value.filter((node) => {
        const status = String(node.metadata.status || '').toLowerCase()
        return (
            node.type === 'audio' &&
            !!node.metadata.taskId &&
            ['running', 'queued', 'loading'].includes(status)
        )
    })
    if (!pendingNodes.length) return
    musicRefreshInFlight.value = true
    try {
        for (const node of pendingNodes) {
            try {
                const detail: any = await proxyMusicQuery(node.metadata.taskId as string | number)
                const url = resultUrl(detail, [
                    'url',
                    'audio_url',
                    'audioUrl',
                    'audio',
                    'download_url',
                    'file_url',
                    'output_url',
                    'audio_uri'
                ])
                if (url) {
                    updateNode(node.id, {
                        metadata: {
                            url,
                            status: 'success',
                            errorDetails: '',
                            mediaSource: 'generated',
                            generatedAt: Date.now()
                        }
                    })
                } else if (
                    String(detail?.status || detail?.state || '')
                        .toLowerCase()
                        .includes('fail')
                ) {
                    updateNode(node.id, {
                        metadata: {
                            status: 'failed',
                            errorDetails: detail?.error || detail?.msg || '音乐生成失败'
                        }
                    })
                }
            } catch {
                // Keep node state; later polling can retry.
            }
        }
    } finally {
        musicRefreshInFlight.value = false
    }
}

function resultTaskId(payload: any): string | number {
    if (!payload) return ''
    return (
        payload.task_id ||
        payload.taskId ||
        payload.id ||
        payload.data?.task_id ||
        payload.data?.taskId ||
        payload.data?.id ||
        ''
    )
}

function resultUrl(payload: any, keys: string[]): string {
    if (!payload) return ''
    if (typeof payload === 'string') {
        return /^(https?:|data:(image|audio)\/|\/|uploads\/|storage\/|resource\/)/.test(payload)
            ? payload
            : ''
    }
    for (const key of keys) {
        if (payload?.[key]) return String(payload[key])
    }
    const lists = [
        payload?.images,
        payload?.videos,
        payload?.audios,
        payload?.music,
        payload?.results,
        payload?.data,
        payload?.lists,
        payload?.items,
        payload?.output
    ].filter(Array.isArray)
    for (const list of lists) {
        for (const item of list) {
            const url = resultUrl(item, keys)
            if (url) return url
        }
    }
    if (payload.data && !Array.isArray(payload.data)) return resultUrl(payload.data, keys)
    if (payload.result && !Array.isArray(payload.result)) return resultUrl(payload.result, keys)
    if (payload.output && !Array.isArray(payload.output)) return resultUrl(payload.output, keys)
    for (const value of Object.values(payload)) {
        if (value && typeof value === 'object') {
            const url = resultUrl(value, keys)
            if (url) return url
        }
    }
    return ''
}

function firstFileUrl(payload: any, keys: string[]): string {
    if (!payload) return ''
    if (typeof payload === 'string') return payload.trim()
    if (Array.isArray(payload)) {
        for (const item of payload) {
            const url = firstFileUrl(item, keys)
            if (url) return url
        }
        return ''
    }
    if (typeof payload !== 'object') return ''
    for (const key of keys) {
        const value = payload[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    const nested = [
        payload.data,
        payload.result,
        payload.file,
        payload.info,
        payload.asset,
        payload.url_info,
        payload.upload,
        payload.output
    ]
    for (const item of nested) {
        const url = firstFileUrl(item, keys)
        if (url) return url
    }
    for (const value of Object.values(payload)) {
        if (value && typeof value === 'object') {
            const url = firstFileUrl(value, keys)
            if (url) return url
        }
    }
    return ''
}

function buildPrompt(node: CanvasNodeData) {
    const ownPrompt = node.metadata.redrawMode
        ? node.metadata.redrawPrompt ||
          (!node.metadata.redrawOriginalComposer ? node.metadata.prompt : '')
        : node.metadata.prompt
    const source = String(node.metadata.source || node.metadata.mediaSource || '').toLowerCase()
    const isAgentMediaNode =
        ['image', 'video', 'audio'].includes(node.type) &&
        ['agent', 'design_agent'].includes(source)
    if (
        isAgentMediaNode ||
        (node.metadata.source === 'design_agent' &&
            (node.metadata.section_key || node.metadata.sectionKey))
    ) {
        return String(ownPrompt || '').trim()
    }
    const ownContent = node.type === 'text' || node.metadata.redrawMode ? '' : node.metadata.content
    return [collectConnectedPrompts(node.id), ownPrompt, ownContent]
        .filter(Boolean)
        .join('\n\n')
        .trim()
}

function collectConnectedPrompts(id: string) {
    return connections.value
        .filter((connection) => connection.toNodeId === id)
        .map((connection) => findNode(connection.fromNodeId))
        .filter((node): node is CanvasNodeData => !!node)
        .filter((node) => node.type === 'text' || node.type === 'config')
        .map((node) => node.metadata.content || node.metadata.prompt || '')
        .filter(Boolean)
        .join('\n\n')
}

function getNodeInputReferences(node: CanvasNodeData): CanvasNodeExternalReference[] {
    const seen = new Set<string>()
    const references: CanvasNodeExternalReference[] = []
    connections.value
        .filter((connection) => connection.toNodeId === node.id)
        .map((connection) => findNode(connection.fromNodeId))
        .filter((source): source is CanvasNodeData => !!source)
        .forEach((source) => {
            if (source.type === 'image') {
                const url = String(source.metadata.image || source.metadata.url || '').trim()
                if (url)
                    references.push({ type: 'image', url, name: source.title, sourceId: source.id })
                return
            }
            if (source.type === 'video') {
                const url = String(source.metadata.url || '').trim()
                if (url)
                    references.push({ type: 'video', url, name: source.title, sourceId: source.id })
                return
            }
            if (source.type === 'audio') {
                const url = String(source.metadata.url || '').trim()
                if (url)
                    references.push({ type: 'audio', url, name: source.title, sourceId: source.id })
                return
            }
            if (source.type === 'text' || source.type === 'config') {
                const text = String(source.metadata.content || source.metadata.prompt || '').trim()
                if (text)
                    references.push({ type: 'text', text, name: source.title, sourceId: source.id })
            }
        })
    return references.filter((item) => {
        const key = `${item.type}:${item.url || item.text || item.sourceId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function selectedCanvasMentions(node: CanvasNodeData): CanvasMention[] {
    const saved = Array.isArray(node.metadata.mentions) ? node.metadata.mentions : []
    return saved
        .filter((item: any) => item && typeof item === 'object')
        .map(
            (item: any) =>
                ({
                    id: String(
                        item.id ||
                            `${item.type || 'mention'}-${item.node_id || item.asset_id || item.url || item.name || ''}`
                    ),
                    type: ['text', 'image', 'video', 'audio', 'asset'].includes(String(item.type))
                        ? item.type
                        : 'text',
                    source: String(item.source || 'mention'),
                    name: String(item.name || '').trim(),
                    prompt: String(item.prompt || '').trim(),
                    url: String(item.url || '').trim(),
                    asset_id: item.asset_id,
                    node_id: item.node_id ? String(item.node_id) : undefined,
                    role: item.role ? String(item.role) : undefined,
                    mime_type: item.mime_type ? String(item.mime_type) : undefined,
                    asset_type: item.asset_type ? String(item.asset_type) : undefined
                }) as CanvasMention
        )
        .filter((item) => item.name)
}

function canvasMentionGenerationPayload(node: CanvasNodeData) {
    const mentions = selectedCanvasMentions(node)
    const mentionPrompts = mentions
        .map((item) => {
            const prompt = String(item.prompt || '').trim()
            if (!prompt) return ''
            return `${item.name}: ${prompt}`
        })
        .filter(Boolean)
    const referenceAssets = mentions.map(mentionToReferenceAsset).filter(
        (
            item
        ): item is {
            type: 'image' | 'video' | 'audio'
            uri: string
            url: string
            name: string
        } => !!item
    )
    return compactPayload({
        selected_mentions: mentions,
        mention_prompts: Array.from(new Set(mentionPrompts)),
        reference_assets: referenceAssets
    })
}

function mentionToReferenceImage(mention: CanvasMention) {
    const url = String(mention.url || '').trim()
    if (!url) return ''
    if (mention.type === 'image') return url
    if (mention.type !== 'asset') return ''
    const assetType = String(mention.asset_type || mention.role || '').toLowerCase()
    const mimeType = String(mention.mime_type || '').toLowerCase()
    return assetType.includes('image') ||
        mimeType.startsWith('image/') ||
        (!assetType.includes('video') &&
            !mimeType.startsWith('video/') &&
            !assetType.includes('audio') &&
            !mimeType.startsWith('audio/'))
        ? url
        : ''
}

function mentionToReferenceAsset(mention: CanvasMention) {
    const url = String(mention.url || '').trim()
    if (!url) return null
    const assetType = String(mention.asset_type || mention.role || '').toLowerCase()
    const mimeType = String(mention.mime_type || '').toLowerCase()
    const type =
        mention.type === 'video' || assetType.includes('video') || mimeType.startsWith('video/')
            ? 'video'
            : mention.type === 'audio' ||
                assetType.includes('audio') ||
                mimeType.startsWith('audio/')
              ? 'audio'
              : mention.type === 'image' || mention.type === 'asset'
                ? 'image'
                : ''
    if (!type) return null
    return {
        type: type as 'image' | 'video' | 'audio',
        uri: url,
        url,
        name: mention.name || nodeTypeLabel(type === 'audio' ? 'asset' : type)
    }
}

function collectReferenceImages(id: string) {
    const ownNode = findNode(id)
    const ownReferences = Array.isArray(ownNode?.metadata.referenceImages)
        ? ownNode!.metadata.referenceImages.map((item) => String(item.url || '')).filter(Boolean)
        : []
    const redrawReference =
        ownNode?.metadata.redrawMode && ownNode.type === 'image'
            ? [String(ownNode.metadata.image || ownNode.metadata.url || '').trim()].filter(Boolean)
            : []
    const connectedReferences = connections.value
        .filter((connection) => connection.toNodeId === id)
        .map((connection) => findNode(connection.fromNodeId))
        .filter(
            (node): node is CanvasNodeData =>
                !!node && node.type === 'image' && !!(node.metadata.image || node.metadata.url)
        )
        .map((node) => String(node.metadata.image || node.metadata.url))
    const mentionReferences = ownNode
        ? selectedCanvasMentions(ownNode).map(mentionToReferenceImage).filter(Boolean)
        : []
    return Array.from(
        new Set([
            ...redrawReference,
            ...ownReferences,
            ...mentionReferences,
            ...connectedReferences
        ])
    )
}

function collectReferenceAudios(id: string) {
    const ownNode = findNode(id)
    const ownReferences = Array.isArray(ownNode?.metadata.referenceAudios)
        ? ownNode!.metadata.referenceAudios.map((item) => String(item.url || '')).filter(Boolean)
        : []
    const connectedReferences = connections.value
        .filter((connection) => connection.toNodeId === id)
        .map((connection) => findNode(connection.fromNodeId))
        .filter(
            (node): node is CanvasNodeData => !!node && node.type === 'audio' && !!node.metadata.url
        )
        .map((node) => String(node.metadata.url))
    const mentionReferences = ownNode
        ? selectedCanvasMentions(ownNode)
              .filter((mention) => {
                  const assetType = String(mention.asset_type || mention.role || '').toLowerCase()
                  const mimeType = String(mention.mime_type || '').toLowerCase()
                  return (
                      mention.type === 'audio' ||
                      assetType.includes('audio') ||
                      mimeType.startsWith('audio/')
                  )
              })
              .map((mention) => String(mention.url || '').trim())
              .filter(Boolean)
        : []
    return Array.from(new Set([...ownReferences, ...mentionReferences, ...connectedReferences]))
}

function nodeGenerationConfig(node: CanvasNodeData) {
    const metadata = node.metadata || {}
    if (node.type === 'text' || node.type === 'config') {
        return compactPayload({
            model_code: metadata.model_code || metadata.model
        })
    }
    if (node.type === 'image') {
        return compactPayload({
            channel: metadata.channel || metadata.model,
            quality: metadata.quality || metadata.resolution,
            ratio: metadata.ratio || metadata.size,
            quantity: metadata.quantity || metadata.count,
            style: metadata.style || 'general',
            negative_prompt: metadata.negative_prompt,
            edit_mode: metadata.redrawMode ? 'local_redraw' : undefined,
            redraw_tool: metadata.redrawMode ? metadata.redrawTool || 'brush' : undefined,
            redraw_brush_size: metadata.redrawMode ? metadata.redrawBrushSize || 32 : undefined
        })
    }
    if (node.type === 'audio') {
        return compactPayload({
            channel: metadata.channel || metadata.model,
            quality: metadata.quality,
            duration: metadata.duration || 30,
            style: metadata.style,
            genre: metadata.genre || metadata.style,
            title: metadata.title || node.title,
            lyrics: metadata.lyrics,
            instrumental: metadata.instrumental
        })
    }
    return compactPayload({
        channel: metadata.channel || metadata.model,
        quality: metadata.quality,
        ratio: metadata.ratio,
        duration: metadata.duration,
        mode: metadata.mode || metadata.videoMode,
        generation_method: metadata.generation_method || metadata.generationMethod,
        quantity: metadata.quantity || metadata.count,
        negative_prompt: metadata.negative_prompt
    })
}

function localRedrawGenerationConfig(node: CanvasNodeData) {
    const metadata = node.metadata || {}
    const redrawConfig =
        metadata.redrawConfig && typeof metadata.redrawConfig === 'object'
            ? metadata.redrawConfig
            : {}
    return compactPayload({
        channel: redrawConfig.channel || metadata.channel || metadata.model,
        quality: redrawConfig.quality || metadata.quality || metadata.resolution,
        ratio: redrawConfig.ratio || metadata.ratio || metadata.size,
        negative_prompt: redrawConfig.negative_prompt || metadata.negative_prompt,
        quantity: 1
    })
}

function compactPayload(payload: Record<string, any>) {
    return Object.keys(payload).reduce((result: Record<string, any>, key) => {
        const value = payload[key]
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            result[key] = value
        }
        return result
    }, {})
}

function uniqueReferenceAssets(items: any[]) {
    const seen = new Set<string>()
    return items.filter((item) => {
        const type = String(item?.type || item?.media_type || '').trim()
        const url = String(item?.uri || item?.url || item?.path || '').trim()
        if (!type || !url) return false
        const key = `${type}:${url}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function handleToolbarUpload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    addFileNode(file, getCanvasCenter())
    input.value = ''
}

function handleDrop(event: DragEvent) {
    const file = Array.from(event.dataTransfer?.files || []).find(
        (item) =>
            item.type.startsWith('image/') ||
            item.type.startsWith('video/') ||
            item.type.startsWith('audio/')
    )
    if (!file) return
    addFileNode(file, screenToCanvas(event.clientX, event.clientY))
}

async function addFileNode(file: File, position: { x: number; y: number }) {
    const url = URL.createObjectURL(file)
    const node = file.type.startsWith('audio/')
        ? addNode('audio', position, {
              title: file.name,
              url,
              localPreviewUrl: url,
              mimeType: file.type,
              status: 'running',
              mediaSource: 'local'
          })
        : file.type.startsWith('video/')
          ? addNode('video', position, {
                title: file.name,
                url,
                localPreviewUrl: url,
                mimeType: file.type,
                status: 'running',
                mediaSource: 'local'
            })
          : addNode('image', position, {
                title: file.name,
                image: url,
                url,
                localPreviewUrl: url,
                mimeType: file.type,
                status: 'running',
                mediaSource: 'local'
            })
    try {
        const res: any = file.type.startsWith('audio/')
            ? await uploadAigcMusicAudio({ file })
            : file.type.startsWith('video/')
              ? await uploadAppVideo({ file })
              : await uploadAppImage({ file })
        const uri = pickUploadUri(res)
        if (!uri) throw new Error('上传接口未返回文件地址')
        if (file.type.startsWith('audio/')) {
            updateNode(node.id, {
                metadata: {
                    url: uri,
                    localPreviewUrl: '',
                    fileName: file.name,
                    mimeType: file.type,
                    status: 'success',
                    mediaSource: 'local'
                }
            })
        } else if (file.type.startsWith('video/')) {
            updateNode(node.id, {
                metadata: {
                    url: uri,
                    localPreviewUrl: '',
                    fileName: file.name,
                    mimeType: file.type,
                    status: 'success',
                    mediaSource: 'local'
                }
            })
        } else {
            updateNode(node.id, {
                metadata: {
                    image: uri,
                    url: uri,
                    localPreviewUrl: '',
                    fileName: file.name,
                    mimeType: file.type,
                    status: 'success',
                    mediaSource: 'local'
                }
            })
        }
        URL.revokeObjectURL(url)
    } catch (error) {
        updateNode(node.id, {
            metadata: {
                status: 'failed',
                errorDetails: error instanceof Error ? error.message : '上传失败'
            }
        })
    }
}

function pickUploadUri(res: any) {
    return firstFileUrl(res, [
        'uri',
        'url',
        'path',
        'file_url',
        'src',
        'image_url',
        'video_url',
        'audio_url'
    ])
}

function nodeTypeLabel(type: CanvasNodeType | 'asset') {
    return (
        (
            {
                text: '文本',
                image: '图片',
                video: '视频',
                audio: '音乐',
                config: '文本',
                asset: '资产'
            } as const
        )[type] || '节点'
    )
}

function nodeTypeIcon(type: CanvasNodeType | 'asset') {
    return (
        (
            {
                text: '/aigc_canva/icon/text.svg',
                config: '/aigc_canva/icon/text.svg',
                image: '/aigc_canva/icon/pic.svg',
                video: '/aigc_canva/icon/shipin.svg',
                audio: '/short-drama/figma/icon/shengyin.svg',
                asset: '/aigc_canva/icon/asset-library.svg'
            } as const
        )[type] || '/aigc_canva/icon/asset-library.svg'
    )
}

function nodeStatusLabel(status: unknown) {
    const value = String(status || 'idle').toLowerCase()
    if (['running', 'queued', 'loading'].includes(value)) return '生成中'
    if (['success'].includes(value)) return '已生成'
    if (['failed', 'error'].includes(value)) return '失败'
    if (['canceled'].includes(value)) return '已取消'
    return '未生成'
}

function nodeAssetThumb(node: CanvasNodeData) {
    const metadata = node.metadata || {}
    if (node.type === 'image') {
        return String(metadata.image || metadata.url || metadata.localPreviewUrl || '').trim()
    }
    if (node.type === 'video') {
        return String(
            metadata.poster || metadata.cover || metadata.thumbnail || metadata.image || ''
        ).trim()
    }
    if (node.type === 'audio') {
        return String(metadata.cover || metadata.thumbnail || metadata.poster || '').trim()
    }
    return ''
}

function toAssetSidebarItem(node: CanvasNodeData): AssetSidebarItem {
    const title = String(node.metadata.title || node.title || nodeTypeLabel(node.type)).trim()
    const status = String(node.metadata.status || 'idle').toLowerCase()
    return {
        id: node.id,
        type: node.type,
        status,
        title,
        subtitle: `${nodeTypeLabel(node.type)} 路 ${nodeStatusLabel(node.metadata.status)}`,
        icon: nodeTypeIcon(node.type),
        thumb: nodeAssetThumb(node)
    }
}

function selectAssetSidebarFilter(value: AssetSidebarFilter) {
    assetSidebarFilter.value = value
    assetSidebarFilterOpen.value = false
}

function selectAssetSidebarItem(id: string) {
    const node = findNode(id)
    if (!node) return
    selectedIds.value = new Set([node.id])
    selectedConnectionId.value = ''
    contextMenu.value = null
    connectionCreateMenu.value = null
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return
    setViewport({
        x: rect.width / 2 - (node.position.x + node.width / 2) * viewport.value.k,
        y: rect.height / 2 - (node.position.y + node.height / 2) * viewport.value.k,
        k: viewport.value.k
    })
    persistProject()
}

function fitCanvas() {
    if (!nodes.value.length) {
        centerViewport()
        persistProject()
        return
    }
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return
    const minX = Math.min(...nodes.value.map((node) => node.position.x))
    const minY = Math.min(...nodes.value.map((node) => node.position.y))
    const maxX = Math.max(...nodes.value.map((node) => node.position.x + node.width))
    const maxY = Math.max(...nodes.value.map((node) => node.position.y + node.height))
    const scale = Math.min(
        1.4,
        Math.max(
            0.15,
            Math.min(
                (rect.width - 180) / Math.max(1, maxX - minX),
                (rect.height - 180) / Math.max(1, maxY - minY)
            )
        )
    )
    setViewport({
        x: rect.width / 2 - ((minX + maxX) / 2) * scale,
        y: rect.height / 2 - ((minY + maxY) / 2) * scale,
        k: scale
    })
    persistProject()
}

function setZoom(k: number) {
    const center = getCanvasCenter()
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return
    setViewport({ x: rect.width / 2 - center.x * k, y: rect.height / 2 - center.y * k, k })
    persistProject()
}

function zoomBy(ratio: number) {
    setZoom(Math.min(5, Math.max(0.05, viewport.value.k * ratio)))
}

function toggleZoomMenu(event: MouseEvent) {
    if (zoomMenu.value) {
        zoomMenu.value = null
        return
    }
    showAddMenu.value = false
    contextMenu.value = null
    connectionCreateMenu.value = null
    shortcutsOpen.value = false
    const toolbarRect = (event.currentTarget as HTMLElement | null)
        ?.closest('.bottom-toolbar')
        ?.getBoundingClientRect()
    zoomMenu.value = {
        x: event.clientX,
        bottomY: toolbarRect?.top || event.clientY
    }
}

function runZoomMenuAction(action: 'in' | 'out' | 'fit' | number) {
    if (action === 'in') zoomBy(1.16)
    else if (action === 'out') zoomBy(0.86)
    else if (action === 'fit') fitCanvas()
    else setZoom(action)
    zoomMenu.value = null
}

function handleWindowPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('.zoom-menu')) return
    zoomMenu.value = null
}

function resetViewport() {
    centerViewport()
    persistProject()
}

function addNodeFromRail(type: CanvasNodeType) {
    addNodeAtCenter(type)
    showAddMenu.value = false
}

function staticTool(label: string) {
    ElMessage.info(label + '功能待接入')
}

function handleMiniMapPointer(event: PointerEvent) {
    miniMapDragging.value = true
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    centerMiniMapFromEvent(event)
}

function centerMiniMapFromEvent(event: PointerEvent) {
    const bounds = miniBounds.value
    const rect = document.querySelector<HTMLElement>('.mini-map')?.getBoundingClientRect()
    if (!rect) return
    const worldX = (event.clientX - rect.left) / bounds.scale + bounds.minX
    const worldY = (event.clientY - rect.top) / bounds.scale + bounds.minY
    const stageRect = stageRef.value?.getBoundingClientRect()
    if (!stageRect) return
    setViewport({
        x: stageRect.width / 2 - worldX * viewport.value.k,
        y: stageRect.height / 2 - worldY * viewport.value.k
    })
    persistProject()
}

function connectionPath(connection: CanvasConnection) {
    const from = findNode(connection.fromNodeId)
    const to = findNode(connection.toNodeId)
    if (!from || !to) return ''
    return pathBetween(nodeOutputPoint(from), nodeInputPoint(to))
}

function pathBetween(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = Math.max(80, Math.abs(to.x - from.x) * 0.45)
    return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
}

function nodeOutputPoint(node: CanvasNodeData) {
    const anchor = nodeRefs.value[node.id]?.getConnectionAnchor?.('right')
    if (anchor) return anchor
    return { x: node.position.x + node.width, y: nodeBodyCenterY(node) }
}

function nodeInputPoint(node: CanvasNodeData) {
    const anchor = nodeRefs.value[node.id]?.getConnectionAnchor?.('left')
    if (anchor) return anchor
    return { x: node.position.x, y: nodeBodyCenterY(node) }
}

function nodeBodyCenterY(node: CanvasNodeData) {
    const bodyHeight =
        node.type === 'image'
            ? Math.max(191, node.height - 26)
            : node.type === 'video'
              ? 191
              : node.type === 'audio'
                ? 170
                : 112
    return node.position.y + 26 + bodyHeight / 2
}

function miniNodeStyle(node: CanvasNodeData) {
    const bounds = miniBounds.value
    return {
        left: `${(node.position.x - bounds.minX) * bounds.scale}px`,
        top: `${(node.position.y - bounds.minY) * bounds.scale}px`,
        width: `${Math.max(3, node.width * bounds.scale)}px`,
        height: `${Math.max(3, node.height * bounds.scale)}px`
    }
}

function normalizeEcommerceAgentLayout(source: CanvasNodeData[]) {
    let changed = false
    const retained = source.filter((node) => {
        const elementId = String(node.metadata?.agentElementId || '')
        const pageId = String(node.metadata?.jsonCanvasPageId || '')
        const removeCopy = /^ecommerce_(?:\d+_)?copy_\d+$/i.test(elementId)
        const removePage =
            !!node.metadata?.isPageArtboard &&
            (elementId.startsWith('ecommerce_page') || pageId.startsWith('ecommerce_page'))
        if (removeCopy || removePage) changed = true
        return !removeCopy && !removePage
    })
    const legacyAgentGroups = new Map<string, CanvasNodeData[]>()
    retained.forEach((node) => {
        if (node.type !== 'image' || !node.metadata?.agentActionId) return
        const messageId = String(node.metadata?.agentMessageId || '')
        const sourceType = String(node.metadata?.source || node.metadata?.mediaSource || '')
        if (!messageId || !sourceType.includes('agent')) return
        legacyAgentGroups.set(messageId, [...(legacyAgentGroups.get(messageId) || []), node])
    })
    legacyAgentGroups.forEach((items) => {
        if (items.length < 3) return
        items.forEach((node) => {
            if (!node.metadata.ecommerceBatchLegacy) changed = true
            node.metadata = { ...node.metadata, ecommerceBatchLegacy: true }
        })
    })
    const groups = new Map<string, CanvasNodeData[]>()
    retained.forEach((node) => {
        if (node.type !== 'image') return
        const elementId = String(node.metadata?.agentElementId || '')
        const match = elementId.match(/^(ecommerce_(?:\d+_)?visual)_\d+$/i)
        const messageId = String(node.metadata?.agentMessageId || '')
        if (!match && !node.metadata?.ecommerceBatchLegacy) return
        const key = `${messageId}:${match?.[1] || 'legacy_batch'}`
        groups.set(key, [...(groups.get(key) || []), node])
    })
    groups.forEach((items) => {
        items.sort((left, right) => {
            const leftIndex = Number(
                left.metadata?.sectionIndex ||
                    left.metadata?.section_index ||
                    String(left.metadata?.agentElementId || '').match(/_(\d+)$/)?.[1] ||
                    left.metadata?.agentActionId ||
                    0
            )
            const rightIndex = Number(
                right.metadata?.sectionIndex ||
                    right.metadata?.section_index ||
                    String(right.metadata?.agentElementId || '').match(/_(\d+)$/)?.[1] ||
                    right.metadata?.agentActionId ||
                    0
            )
            return leftIndex - rightIndex
        })
        const baseX = Math.min(...items.map((node) => Number(node.position.x || 0)))
        const baseY = Math.min(...items.map((node) => Number(node.position.y || 0)))
        const dimensions = items.map((node) => nodeDimensions('image', node.metadata || {}))
        const rowOffsets: number[] = [0]
        for (let row = 0; row < Math.ceil(items.length / 4); row += 1) {
            const rowHeight = Math.max(
                ...dimensions.slice(row * 4, row * 4 + 4).map((item) => item.height)
            )
            rowOffsets[row + 1] = rowOffsets[row] + rowHeight + 24
        }
        items.forEach((node, index) => {
            const size = dimensions[index]
            const nextPosition = {
                x: baseX + (index % 4) * 364,
                y: baseY + rowOffsets[Math.floor(index / 4)]
            }
            if (
                Math.abs(Number(node.position.x) - nextPosition.x) > 0.5 ||
                Math.abs(Number(node.position.y) - nextPosition.y) > 0.5 ||
                node.width !== size.width ||
                node.height !== size.height
            ) {
                changed = true
            }
            node.position = nextPosition
            node.width = size.width
            node.height = size.height
        })
    })
    return { nodes: retained, changed }
}

function nodeSize(type: CanvasNodeType) {
    return (
        {
            text: { width: 250, height: 250 },
            image: { width: 250, height: 250 },
            video: { width: 250, height: 250 },
            audio: { width: 444, height: 250 },
            config: { width: 250, height: 250 }
        } as const
    )[type]
}

const mediaSizingKeys = [
    'ratio',
    'size',
    'aspectRatio',
    'aspect_ratio',
    'width',
    'height',
    'imageWidth',
    'imageHeight',
    'videoWidth',
    'videoHeight',
    'mediaWidth',
    'mediaHeight'
]

function nodeDimensions(type: CanvasNodeType, metadata: Record<string, any> = {}) {
    const base = nodeSize(type)
    if (type !== 'image' && type !== 'video') return base
    const ratioSource =
        metadata.ratio || metadata.size || metadata.aspectRatio || metadata.aspect_ratio || ''
    const hasRatio = hasCanvasRatio(ratioSource)
    const rawWidth = Number(
        metadata.width || metadata.imageWidth || metadata.videoWidth || metadata.mediaWidth || 0
    )
    const rawHeight = Number(
        metadata.height || metadata.imageHeight || metadata.videoHeight || metadata.mediaHeight || 0
    )
    const hasMediaDimensions = rawWidth > 0 && rawHeight > 0
    if (metadata.mediaPreviewRatioActive === false && !hasMediaDimensions) return base
    if (!hasRatio && !hasMediaDimensions) return base
    const [ratioWidth, ratioHeight] = hasMediaDimensions
        ? [rawWidth, rawHeight]
        : parseCanvasRatio(ratioSource, [1, 1])
    const ratio = ratioWidth / ratioHeight
    if (ratio >= 1) {
        return {
            width: Math.max(base.width, Math.min(622, Math.round(base.height * ratio))),
            height: base.height
        }
    }
    return {
        width: base.width,
        height: Math.max(base.height, Math.min(622, Math.round(base.width / ratio)))
    }
}

function isEcommerceAgentNode(metadata: Record<string, any> = {}) {
    const targetId = String(
        metadata.targetElementId || metadata.agentElementId || metadata.jsonCanvasElementId || ''
    )
    return (
        Number(metadata.batchId || 0) > 0 ||
        !!metadata.ecommerceBatchLegacy ||
        targetId.startsWith('ecommerce_batch_') ||
        /^ecommerce_(?:\d+_)?visual_/i.test(targetId)
    )
}

function hasCanvasRatio(value: any) {
    return /^(\d+(?:\.\d+)?)\s*[:/xX]\s*(\d+(?:\.\d+)?)$/.test(String(value || '').trim())
}

function parseCanvasRatio(value: any, fallback: [number, number] = [3, 4]): [number, number] {
    const match = String(value || `${fallback[0]}:${fallback[1]}`)
        .trim()
        .match(/^(\d+(?:\.\d+)?)\s*[:/xX]\s*(\d+(?:\.\d+)?)$/)
    const width = Number(match?.[1] || fallback[0])
    const height = Number(match?.[2] || fallback[1])
    return width > 0 && height > 0 ? [width, height] : fallback
}

function findNode(id: string) {
    return nodes.value.find((node) => node.id === id)
}

function withoutMetadata(patch: Record<string, any>) {
    const copy = { ...patch }
    delete copy.metadata
    return copy
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

onMounted(() => {
    loadProject()
    loadCanvasDependencyConfigs()
    imageRefreshTimer.value = setInterval(refreshPendingImageNodes, 5000)
    localRedrawRefreshTimer.value = setInterval(refreshPendingLocalRedrawNodes, 5000)
    musicRefreshTimer.value = setInterval(refreshPendingMusicNodes, 6000)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointerdown', handleWindowPointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('copy', handleCopy)
    window.addEventListener('paste', handlePaste)
})

onBeforeUnmount(() => {
    if (saveTimer.value) clearTimeout(saveTimer.value)
    if (imageRefreshTimer.value) clearInterval(imageRefreshTimer.value)
    if (localRedrawRefreshTimer.value) clearInterval(localRedrawRefreshTimer.value)
    if (musicRefreshTimer.value) clearInterval(musicRefreshTimer.value)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointerdown', handleWindowPointerDown)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('copy', handleCopy)
    window.removeEventListener('paste', handlePaste)
})

watch(() => route.params.id, loadProject)
watch(() => userStore.isLogin, loadProject)
</script>

<style scoped lang="scss">
.native-canvas-page {
    --canvas-agent-panel-width: 0px;
    --canvas-safe-center-x: calc((100vw - var(--canvas-agent-panel-width)) / 2);
    --canvas-agent-center-transition: left 180ms ease, transform 180ms ease;
    --canvas-bg: #000;
    --canvas-dot: #474747;
    --surface: rgba(32, 32, 32, 0.92);
    --surface-soft: rgba(38, 38, 38, 0.72);
    --surface-strong: rgba(18, 18, 18, 0.96);
    --border: rgba(255, 255, 255, 0.12);
    --text: #f5f5f5;
    --muted: rgba(255, 255, 255, 0.56);
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--canvas-bg);
    color: var(--text);
}

.canvas-topbar {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    padding: 0 12px 0 18px;
    pointer-events: none;
}

.topbar-left,
.topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
}

.brand-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(36, 36, 36, 0.42);
    color: var(--text);
    box-shadow: none;
    -webkit-backdrop-filter: blur(20px) saturate(1.25);
    backdrop-filter: blur(20px);
    text-decoration: none;
}

.back-mark {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: transparent;
    color: #fff;
    font-size: 12px;
    font-weight: 800;
}

.back-mark::before {
    width: 7px;
    height: 7px;
    border-left: 1.8px solid #fff;
    border-bottom: 1.8px solid #fff;
    content: '';
    transform: translateX(1px) rotate(45deg);
}

.topbar-separator {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.18);
}

.project-name-input {
    width: 150px;
    height: 30px;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--text);
    font-weight: 600;
}

.canvas-stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: default;
    background: var(--canvas-bg);
    user-select: none;
}

.canvas-stage.panning {
    cursor: grabbing;
}

.canvas-stage.selecting {
    cursor: crosshair;
}

.canvas-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 1;
    background-image: radial-gradient(circle, var(--canvas-dot) 0.62px, transparent 0.82px);
    will-change: background-position, background-size;
}

.canvas-transform {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
}

.connection-layer {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
}

.connection-path {
    fill: none;
    stroke: rgba(255, 255, 255, 0.46);
    stroke-width: 2;
}

.connection-path.selected {
    stroke: #f5f5f5;
    stroke-width: 3;
}

.connection-path.temp {
    stroke: #f5f5f5;
    stroke-dasharray: 8 6;
}

.connection-hit-path {
    fill: none;
    stroke: transparent;
    stroke-width: 18;
    pointer-events: stroke;
    cursor: pointer;
}

.selection-box {
    position: absolute;
    z-index: 20;
    border: 1px solid rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.09);
    pointer-events: none;
}

.multi-selection-box {
    position: absolute;
    z-index: 21;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 22px;
    background: transparent;
    pointer-events: none;
    box-sizing: border-box;
}

.multi-selection-add {
    position: absolute;
    right: -39px;
    top: 50%;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: #202020;
    cursor: pointer;
    pointer-events: auto;
    transform: translateY(-50%);
}

.multi-selection-add::before,
.multi-selection-add::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 12px;
    height: 2px;
    border-radius: 999px;
    background: #f4f4f4;
    transform: translate(-50%, -50%);
    pointer-events: none;
}

.multi-selection-add::after {
    transform: translate(-50%, -50%) rotate(90deg);
}

.empty-canvas {
    position: absolute;
    left: var(--canvas-safe-center-x);
    top: 50%;
    z-index: 5;
    display: grid;
    gap: 12px;
    transform: translate(-50%, -50%);
    transition: var(--canvas-agent-center-transition);
    color: var(--muted);
    text-align: center;
}

.empty-canvas strong {
    color: var(--text);
    font-size: 18px;
}

.empty-canvas div {
    display: flex;
    justify-content: center;
    gap: 10px;
}

.empty-canvas button,
.toolbar-button,
.context-menu button,
.shortcut-popover button {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
}

.empty-canvas button {
    height: 34px;
    padding: 0 14px;
    border-radius: 8px;
}

.asset-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    width: 252px;
    padding: 14px 12px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(26, 26, 26, 0.98);
    box-shadow: none;
    backdrop-filter: blur(18px);
}

.asset-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    margin-bottom: 12px;
}

.asset-sidebar-header strong {
    color: rgba(255, 255, 255, 0.94);
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
}

.asset-sidebar-close {
    flex: 0 0 auto;
}

.asset-sidebar-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    height: 34px;
    padding: 3px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
}

.asset-sidebar-tabs button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
}

.asset-sidebar-tabs button.active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.asset-sidebar-tabs em {
    font-style: normal;
    color: inherit;
    opacity: 0.8;
}

.asset-sidebar-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 82px;
    gap: 8px;
    margin-top: 12px;
}

.asset-sidebar-search {
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 10px 0 30px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
}

.asset-sidebar-search span {
    position: absolute;
    left: 12px;
    top: 50%;
    width: 12px;
    height: 12px;
    border: 1.5px solid rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    transform: translateY(-50%);
}

.asset-sidebar-search span::after {
    content: '';
    position: absolute;
    right: -4px;
    bottom: -3px;
    width: 5px;
    height: 1.5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.5);
    transform: rotate(45deg);
}

.asset-sidebar-search input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-size: 12px;
}

.asset-sidebar-search input::placeholder {
    color: rgba(255, 255, 255, 0.38);
}

.asset-sidebar-filter-wrap {
    position: relative;
    min-width: 0;
}

.asset-sidebar-filter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    cursor: pointer;
}

.asset-sidebar-filter i {
    width: 6px;
    height: 6px;
    border-right: 1px solid rgba(255, 255, 255, 0.62);
    border-bottom: 1px solid rgba(255, 255, 255, 0.62);
    transform: rotate(45deg) translateY(-2px);
}

.asset-sidebar-filter-menu {
    position: absolute;
    right: 0;
    top: 36px;
    z-index: 10001;
    display: grid;
    gap: 2px;
    width: 96px;
    padding: 5px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9px;
    background: rgba(36, 36, 36, 0.98);
    box-shadow: none;
}

.asset-sidebar-filter-menu button {
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
}

.asset-sidebar-filter-menu button:hover,
.asset-sidebar-filter-menu button.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.asset-sidebar-list {
    flex: 1;
    min-height: 0;
    margin-top: 8px;
    overflow: auto;
    scrollbar-width: none;
}

.asset-sidebar-list::-webkit-scrollbar {
    width: 0;
    height: 0;
}

.asset-sidebar-item {
    display: grid;
    grid-template-columns: 34px 1fr;
    align-items: center;
    gap: 9px;
    width: 100%;
    height: 46px;
    padding: 5px 7px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #fff;
    text-align: left;
    cursor: pointer;
}

.asset-sidebar-item:hover,
.asset-sidebar-item.active {
    background: rgba(255, 255, 255, 0.08);
}

.asset-sidebar-thumb {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    overflow: hidden;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
}

.asset-sidebar-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.asset-sidebar-thumb.is-text img,
.asset-sidebar-thumb.is-config img,
.asset-sidebar-thumb.is-audio img,
.asset-sidebar-thumb.is-asset img,
.asset-sidebar-thumb.is-image:not(.has-thumb) img,
.asset-sidebar-thumb.is-video:not(.has-thumb) img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    opacity: 0.9;
}

.asset-sidebar-thumb.is-image:not(.has-thumb) img,
.asset-sidebar-thumb.is-video:not(.has-thumb) img {
    width: 24px;
    height: 24px;
}

.asset-sidebar-text {
    display: grid;
    gap: 4px;
    min-width: 0;
}

.asset-sidebar-text strong,
.asset-sidebar-text small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.asset-sidebar-text strong {
    color: rgba(255, 255, 255, 0.92);
    font-size: 12px;
    font-weight: 500;
}

.asset-sidebar-text small {
    color: rgba(255, 255, 255, 0.42);
    font-size: 11px;
    font-weight: 400;
}

.asset-sidebar-empty {
    display: grid;
    place-items: center;
    height: 120px;
    color: rgba(255, 255, 255, 0.36);
    font-size: 12px;
}

.asset-sidebar-footer {
    flex: 0 0 auto;
    padding-top: 10px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
    line-height: 18px;
}

.canvas-rail {
    position: fixed;
    left: var(--canvas-safe-center-x);
    bottom: 8px;
    z-index: 34;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 46px;
    padding: 5px 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(36, 36, 36, 0.42);
    box-shadow: none;
    -webkit-backdrop-filter: blur(20px) saturate(1.25);
    backdrop-filter: blur(20px);
    transform: translateX(-50%);
    transition: var(--canvas-agent-center-transition);
}

.rail-button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #fff;
    cursor: pointer;
}

.rail-button:hover,
.rail-button.active {
    background: rgba(255, 255, 255, 0.08);
}

.rail-button-primary {
    width: 32px;
    height: 32px;
    border-radius: 7px;
    background: #fff;
    color: #111;
}

.rail-button-primary:hover {
    background: #fff;
}

.rail-button img {
    width: 16px;
    height: 16px;
    max-width: none;
    max-height: none;
    object-fit: contain;
    filter: brightness(0) invert(1);
    opacity: 0.82;
}

.rail-button-primary img {
    width: 18px;
    height: 18px;
    filter: none;
    opacity: 1;
}

.floating-palette {
    position: fixed;
    left: calc(var(--canvas-safe-center-x) - 80px);
    bottom: 58px;
    z-index: 10000;
    display: grid;
    gap: 6px;
    width: 128px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: rgba(30, 30, 30, 0.94);
    box-shadow: none;
    backdrop-filter: blur(18px);
    transform: translateX(-50%);
    transition: var(--canvas-agent-center-transition);
}

.floating-palette button {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    cursor: pointer;
}

.floating-palette button:hover {
    background: rgba(255, 255, 255, 0.08);
}

.floating-palette img {
    width: 16px;
    height: 16px;
    max-width: 16px;
    max-height: 16px;
    flex: 0 0 16px;
    object-fit: contain;
    opacity: 0.86;
}

.floating-palette img[src*='shengyin'] {
    transform: scale(1.38);
    transform-origin: center;
}

.bottom-toolbar {
    position: fixed;
    left: 10px;
    bottom: 8px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 4px 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(36, 36, 36, 0.42);
    box-shadow: none;
    -webkit-backdrop-filter: blur(20px) saturate(1.25);
    backdrop-filter: blur(20px);
}

.bottom-toolbar > .toolbar-button:first-child {
    display: none;
}

.toolbar-button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    font-weight: 700;
}

.zoom-symbol {
    position: relative;
    display: block;
    width: 14px;
    height: 14px;
    opacity: 0.9;
}

.zoom-symbol::before,
.zoom-symbol-plus::after {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 11px;
    height: 1.5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.86);
    content: '';
    transform: translate(-50%, -50%);
}

.zoom-symbol-plus::after {
    transform: translate(-50%, -50%) rotate(90deg);
}

.toolbar-button:hover,
.toolbar-button.active {
    background: rgba(255, 255, 255, 0.1);
}

.toolbar-button img {
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    object-fit: contain;
    filter: none;
    opacity: 0.92;
}

.bottom-toolbar .toolbar-button img[src$='.svg'] {
    width: 18px;
    height: 18px;
    filter: none;
    opacity: 0.9;
}

.toolbar-button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
}

.toolbar-divider {
    width: 1px;
    height: 14px;
    margin: 0 4px;
    background: rgba(255, 255, 255, 0.18);
}

.hidden-input {
    display: none;
}

.zoom-value {
    display: grid;
    place-items: center;
    width: 44px;
    height: 24px;
    border: 0;
    background: transparent;
    color: var(--text);
    font-size: 12px;
}

.zoom-menu {
    position: fixed;
    z-index: 10020;
    width: 188px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    background: rgba(36, 36, 36, 0.96);
    box-shadow: none;
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
    backdrop-filter: blur(18px) saturate(1.2);
    transform: translate(-50%, -100%);
}

.zoom-menu-current,
.zoom-menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.92);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    text-align: left;
}

.zoom-menu-current {
    margin-bottom: 8px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    cursor: default;
}

.zoom-menu-current em {
    color: rgba(255, 255, 255, 0.56);
    font-style: normal;
}

.zoom-menu-row:hover {
    background: rgba(255, 255, 255, 0.08);
}

.zoom-menu-row kbd {
    color: rgba(255, 255, 255, 0.42);
    font: inherit;
    font-size: 12px;
    font-weight: 500;
}

.zoom-menu-divider {
    display: block;
    height: 1px;
    margin: 6px 2px;
    background: rgba(255, 255, 255, 0.1);
}

.next-step {
    position: fixed;
    right: 20px;
    bottom: 18px;
    z-index: 34;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: rgba(36, 36, 36, 0.82);
    color: var(--text);
    box-shadow: none;
    backdrop-filter: blur(18px);
    font-size: 14px;
}

.next-step > span,
.next-step-arrow {
    display: none;
}

.next-step-logo,
.next-step-arrow {
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
}

.next-step-logo {
    width: 28px;
    height: 28px;
    background: #f5f5f5;
    color: #111;
    font-weight: 800;
}

.next-step-arrow {
    width: 34px;
    height: 34px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--text);
    font-size: 18px;
}

.next-step .next-step-arrow {
    display: none;
}

.edge-scrollbar {
    position: fixed;
    right: 0;
    top: 76px;
    z-index: 24;
    width: 6px;
    height: calc(100vh - 126px);
    border-radius: 999px 0 0 999px;
    background: rgba(104, 110, 116, 0.5);
    pointer-events: none;
}

.mini-map {
    position: fixed;
    left: 16px;
    bottom: 76px;
    z-index: 30;
    width: 240px;
    height: 160px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: rgba(38, 38, 38, 0.92);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
    cursor: crosshair;
}

.mini-node {
    position: absolute;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.62);
}

.mini-viewport {
    position: absolute;
    border: 1px solid #fff;
    background: rgba(255, 255, 255, 0.08);
}

.shortcut-popover {
    position: fixed;
    left: 16px;
    bottom: 76px;
    z-index: 10000;
    width: 260px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    padding: 12px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
}

.shortcut-popover header,
.shortcut-popover p {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.shortcut-popover p {
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 12px;
}

.shortcut-popover b {
    color: var(--text);
    font-weight: 500;
}

.context-menu {
    position: fixed;
    z-index: 10020;
    width: 196px;
    padding: 8px 14px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 15px;
    background: #242424;
    box-shadow: none;
    color: #fff;
}

.context-menu-add,
.connection-create-menu {
    display: flex;
    flex-direction: column;
    width: auto;
    min-width: 220px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: rgba(30, 30, 30, 0.94);
    backdrop-filter: blur(18px);
}

.context-menu-title {
    display: flex;
    align-items: center;
    height: 30px;
    padding: 0 8px;
    color: #8d8d8d;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
}

.context-menu .context-menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    height: 34px;
    padding: 0 2px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #fff;
    text-align: left;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
}

.context-menu-add .context-menu-row,
.connection-create-menu .context-menu-row {
    height: 36px;
    padding: 0 10px;
    border-radius: 6px;
}

.context-menu .context-menu-row:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.045);
}

.context-menu .context-menu-row.is-disabled,
.context-menu .context-menu-row:disabled {
    color: #595959;
    cursor: default;
}

.context-menu .context-menu-row kbd {
    min-width: 42px;
    color: #747474;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    text-align: right;
}

.context-menu .context-menu-row:disabled kbd,
.context-menu .context-menu-row.is-disabled kbd {
    color: #555;
}

.context-menu-divider {
    display: block;
    height: 1px;
    margin: 4px 2px;
    background: #363636;
}

.context-menu .context-node-row {
    justify-content: flex-start;
    gap: 24px;
    color: #f8f8f8;
}

.context-menu .context-node-icon {
    display: block;
    width: 16px;
    height: 16px;
    max-width: 16px;
    max-height: 16px;
    flex: 0 0 16px;
    object-fit: contain;
    opacity: 0.86;
}

.context-menu .context-node-icon[src*='shengyin'] {
    transform: scale(1.38);
    transform-origin: center;
}

.media-preview-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 42px;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(10px);
}

.media-preview-dialog {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: min(92vw, 1440px);
    max-height: 88vh;
    margin: 0;
}

.media-preview-dialog img,
.media-preview-dialog video {
    display: block;
    max-width: 100%;
    max-height: 88vh;
    border-radius: 12px;
    background: #101010;
    object-fit: contain;
}

.media-preview-dialog audio {
    display: block;
    width: min(560px, 86vw);
}

.media-preview-close {
    position: fixed;
    top: 22px;
    right: 24px;
    z-index: 20001;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 999px;
    background: rgba(32, 32, 32, 0.72);
    color: #fff;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    backdrop-filter: blur(10px);
}

.media-preview-close:hover {
    background: rgba(255, 255, 255, 0.12);
}
</style>
