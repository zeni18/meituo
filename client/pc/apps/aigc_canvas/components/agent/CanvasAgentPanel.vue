<template>
    <aside
        ref="panelRef"
        class="canvas-agent-panel"
        :class="{ collapsed, 'is-resizing': panelResizing, 'is-embedded-composer': embeddedComposer }"
        :style="panelStyle"
        @pointerdown.stop="handlePanelPointerDown"
    >
        <button
            v-if="!collapsed && !embeddedComposer"
            class="agent-resize-handle"
            type="button"
            title="拖动调整对话框宽度"
            aria-label="调整对话框宽度"
            @pointerdown.stop.prevent="startPanelResize"
        />
        <button
            v-if="collapsed"
            class="agent-float-trigger"
            type="button"
            title="打开 Agent"
            @click="collapsed = false"
        >
            AI
        </button>

        <template v-if="!collapsed">
            <header class="agent-header">
                <div class="agent-title">
                    <strong>新的对话</strong>
                    <span v-if="threadTitle !== '新的对话'">{{ threadTitle }}</span>
                </div>
                <div class="agent-header-actions">
                    <button
                        type="button"
                        :title="messages.length ? '新建对话' : '当前已是新对话'"
                        :class="{ disabled: !messages.length && !threadId }"
                        @click="startNewThread"
                    >
                        <ElIcon><EditPen /></ElIcon>
                    </button>
                    <button
                        type="button"
                        title="历史对话"
                        data-agent-popover-trigger
                        @click="togglePopover('history', $event)"
                    >
                        <ElIcon><Clock /></ElIcon>
                    </button>
                    <button
                        type="button"
                        :title="messages.length ? '分享' : '新对话无法分享'"
                        :class="{ disabled: !messages.length }"
                        data-agent-popover-trigger
                        @click="toggleShare($event)"
                    >
                        <ElIcon><Share /></ElIcon>
                    </button>
                    <button type="button" title="关闭" @click="collapsed = true">
                        <ElIcon><Close /></ElIcon>
                    </button>
                </div>

                <div
                    v-if="activePopover === 'history'"
                    class="agent-popover agent-popover-header agent-history-popover"
                    data-agent-popover
                    :style="activePopoverStyle"
                >
                    <strong>历史对话</strong>
                    <div v-if="!historyItems.length" class="agent-history-empty">暂无历史对话</div>
                    <div
                        v-for="item in historyItems"
                        :key="item.id"
                        class="agent-history-row"
                        :class="{ active: item.id === activeLocalThreadId }"
                    >
                        <button type="button" @click="selectHistoryItem(item)">
                            <span>{{ historyDisplayTitle(item.title) }}</span>
                            <em>{{ threadMessageCount(item) }} 条消息</em>
                        </button>
                        <button
                            class="agent-history-delete"
                            type="button"
                            title="删除对话"
                            @click.stop="deleteHistoryItem(item)"
                        >
                            <ElIcon><Close /></ElIcon>
                        </button>
                    </div>
                    <button class="agent-history-new" type="button" @click="startNewThread">
                        <span>新建空白对话</span>
                    </button>
                </div>
                <div
                    v-else-if="activePopover === 'share'"
                    class="agent-popover agent-popover-header"
                    data-agent-popover
                    :style="activePopoverStyle"
                >
                    <strong>{{ messages.length ? '分享' : '新对话无法分享' }}</strong>
                    <button
                        type="button"
                        :disabled="!messages.length"
                        @click="notifyComingSoon('复制分享链接')"
                    >
                        <span>复制当前画布链接</span>
                        <em>{{ messages.length ? '静态入口' : '先完成一轮对话' }}</em>
                    </button>
                    <button
                        type="button"
                        :disabled="!messages.length"
                        @click="notifyComingSoon('导出对话记录')"
                    >
                        <span>导出对话记录</span>
                        <em>{{ messages.length ? '静态入口' : '暂无可分享内容' }}</em>
                    </button>
                </div>
            </header>

            <section ref="messageListRef" class="agent-messages">
                <div v-if="!messages.length && composerMode === 'agent'" class="agent-empty-mode">
                    <span aria-hidden="true">
                        <ElIcon><MagicStick /></ElIcon>
                    </span>
                    <strong>AI Design Agent</strong>
                </div>

                <article
                    v-for="message in messages"
                    :key="message.local_id || message.id"
                    class="agent-message"
                    :data-message-id="message.id || message.local_id"
                    :data-next-action="messageNextAction(message)"
                    :data-batch-id="messageBatchId(message) || undefined"
                    :class="[
                        `is-${message.role}`,
                        `status-${message.status}`,
                        { 'has-media-task': !!message.media_task }
                    ]"
                >
                    <div v-if="message.attachments?.length" class="agent-message-attachments">
                        <figure
                            v-for="item in message.attachments"
                            :key="item.id"
                            class="agent-message-attachment"
                            :title="item.name"
                        >
                            <img
                                v-if="item.type === 'image' && attachmentPreviewUrl(item)"
                                :src="attachmentPreviewUrl(item)"
                                alt=""
                                @error="markAttachmentPreviewBroken(attachmentPreviewUrl(item))"
                            />
                            <video
                                v-else-if="item.type === 'video' && attachmentPreviewUrl(item)"
                                :src="attachmentPreviewUrl(item)"
                                muted
                            />
                            <span v-else>{{ attachmentTypeLabel(item.type) }}</span>
                        </figure>
                    </div>
                    <div
                        v-if="
                            (message.content ||
                                message.status === 'running' ||
                                message.status === 'failed') &&
                            !(message.media_task && message.role === 'assistant')
                        "
                        class="agent-message-bubble"
                        :class="{
                            'is-collapsible': isLongUserMessage(message),
                            'is-expanded': isMessageExpanded(message)
                        }"
                    >
                        <div
                            v-if="message.content"
                            class="agent-message-content"
                            v-html="formatMessageContent(message)"
                        />
                        <small v-if="message.status === 'running' && !message.content"
                            >{{ assistantProgressText(message) }}</small
                        >
                        <small v-else-if="message.status === 'failed'">{{
                            message.error || '执行失败'
                        }}</small>
                        <button
                            v-if="isLongUserMessage(message)"
                            class="agent-message-expand"
                            type="button"
                            @click="toggleMessageExpanded(message)"
                        >
                            {{ isMessageExpanded(message) ? '收起' : '展开全部' }}
                        </button>
                    </div>
                    <div
                        v-if="
                            shouldShowInitialBatchAction(message)
                        "
                        class="agent-confirm-actions"
                    >
                        <button
                            class="is-initial-batch"
                            type="button"
                            :disabled="sending"
                            :aria-label="`确认生成前${initialBatchCount(message)}张`"
                            @click="executeAgentBatch(message, 'initial')"
                        >
                            <span>确认生成前{{ initialBatchCount(message) }}张</span>
                            确认生成
                        </button>
                    </div>
                    <div
                        v-if="
                            message.role === 'assistant' &&
                            messageNextAction(message) === 'confirm_next_batch'
                        "
                        class="agent-confirm-actions"
                    >
                        <button
                            type="button"
                            :disabled="sending"
                            @click="executeAgentBatch(message, 'next')"
                        >
                            继续生成{{ nextBatchCount(message) }}张
                        </button>
                        <button
                            type="button"
                            class="is-secondary"
                            :disabled="sending"
                            @click="executeAgentBatch(message, 'all_remaining')"
                        >
                            生成全部剩余
                        </button>
                    </div>
                    <button
                        v-if="message.role === 'user' && message.content"
                        class="agent-message-copy"
                        type="button"
                        title="复制"
                        @click="copyMessageText(message)"
                    >
                        <img :src="copyIcon" alt="" />
                    </button>
                    <div
                        v-if="message.media_task"
                        class="agent-media-task-card"
                        :class="[
                            `is-${message.media_task.status}`,
                            `is-${message.media_task.mode}`
                        ]"
                        :style="mediaTaskCardStyle(message.media_task)"
                        :aria-label="mediaTaskTitle(message.media_task)"
                    >
                        <span class="agent-media-task-placeholder" aria-hidden="true" />
                    </div>
                    <div
                        v-if="generationActionRecords(message.workspace_actions).length"
                        class="agent-generation-list"
                    >
                        <div
                            v-for="action in generationActionRecords(message.workspace_actions)"
                            :key="`generation-${action.id || actionApplyKey(action)}`"
                            class="agent-generation-card"
                            :class="[
                                `is-${assetType(action)}`,
                                `status-${action.status || 'pending'}`,
                                {
                                    'is-generating': actionIsGenerating(action),
                                    'has-result': !!actionMediaUrl(action)
                                }
                            ]"
                            :style="generationCardStyle(action)"
                            @click="openGenerationPreview(action)"
                        >
                            <div
                                class="agent-generation-preview"
                                :class="`is-${assetType(action)}`"
                            >
                                <img
                                    v-if="assetType(action) === 'image' && actionMediaUrl(action)"
                                    :src="actionMediaUrl(action)"
                                    alt=""
                                />
                                <video
                                    v-else-if="
                                        assetType(action) === 'video' && actionMediaUrl(action)
                                    "
                                    :src="actionMediaUrl(action)"
                                    muted
                                    playsinline
                                />
                                <span v-else aria-hidden="true" />
                                <button
                                    v-if="
                                        actionMediaUrl(action) &&
                                        ['image', 'video'].includes(assetType(action))
                                    "
                                    class="agent-generation-download"
                                    type="button"
                                    title="下载"
                                    aria-label="下载生成结果"
                                    @click.stop="downloadGenerationMedia(action)"
                                >
                                    <img src="/aigc_canva/icon/Download).svg" alt="" />
                                </button>
                            </div>
                            <div
                                v-if="!['image', 'video'].includes(assetType(action))"
                                class="agent-generation-main"
                            >
                                <strong>{{ actionTitle(action) }}</strong>
                                <small>{{ generationStatusText(action) }}</small>
                            </div>
                        </div>
                    </div>
                    <div
                        v-if="visibleWorkspaceActions(message.workspace_actions).length"
                        class="agent-action-list"
                    >
                        <div
                            v-for="action in visibleWorkspaceActions(message.workspace_actions)"
                            :key="action.id"
                            class="agent-action-card"
                        >
                            <div class="agent-action-preview" :class="`is-${assetType(action)}`">
                                <img
                                    v-if="assetType(action) === 'image' && action.input?.asset?.url"
                                    :src="action.input.asset.url"
                                    alt=""
                                />
                                <video
                                    v-else-if="
                                        assetType(action) === 'video' && action.input?.asset?.url
                                    "
                                    :src="action.input.asset.url"
                                    muted
                                    playsinline
                                />
                                <span v-else>{{
                                    assetType(action) === 'audio' ? 'Audio' : 'Result'
                                }}</span>
                            </div>
                            <div class="agent-action-main">
                                <strong>{{ actionTitle(action) }}</strong>
                                <small>{{
                                    action.status === 'applied' ? '已插入画布' : '等待插入画布'
                                }}</small>
                            </div>
                            <button
                                type="button"
                                :disabled="
                                    action.status === 'applying' || action.status === 'applied'
                                "
                                @click="applyAction(action)"
                            >
                                {{ action.status === 'applied' ? '已添加' : '添加' }}
                            </button>
                        </div>
                    </div>
                </article>
            </section>

            <footer class="agent-composer-shell">
                <div class="agent-composer">
                    <div
                        v-if="selectedSummary || (composerMode === 'agent' && selectedSkillTitle)"
                        class="agent-context-row"
                    >
                        <div v-if="selectedSummary" class="agent-context-pill">
                            <span>引用</span>
                            <em>{{ selectedSummary }}</em>
                        </div>
                        <div
                            v-if="composerMode === 'agent' && selectedSkillTitle"
                            class="agent-context-pill"
                        >
                            <span>Skill</span>
                            <em>{{ selectedSkillTitle }}</em>
                        </div>
                    </div>
                    <section
                        v-if="composerMode === 'image'"
                        class="agent-media-reference-area agent-video-reference-grid is-image"
                    >
                        <figure
                            v-for="item in uploadedAttachments"
                            :key="item.id"
                            class="agent-video-reference-item"
                        >
                            <img :src="item.previewUrl || item.url" alt="" />
                            <button
                                type="button"
                                title="移除参考图"
                                @click="removeUploadedAttachment(item.id)"
                            >
                                <ElIcon><Close /></ElIcon>
                            </button>
                        </figure>
                        <button
                            class="agent-video-add-reference"
                            type="button"
                            @click="openReferenceUploadMenu('image', '', $event)"
                        >
                            <ElIcon><Picture /></ElIcon>
                            <span>参考图</span>
                        </button>
                    </section>
                    <section
                        v-else-if="composerMode === 'video'"
                        class="agent-media-reference-area"
                    >
                        <div
                            v-if="!supportedVideoMethods.length"
                            class="agent-video-method-unavailable"
                        >
                            当前模型未配置可用的参考生成模式
                        </div>
                        <div
                            v-else-if="videoGenerationMethod === 'omni_reference'"
                            class="agent-video-reference-grid is-omni"
                        >
                            <figure
                                v-for="item in currentVideoMethodAttachments"
                                :key="item.id"
                                class="agent-video-reference-item"
                            >
                                <img v-if="item.type === 'image'" :src="item.url" alt="" />
                                <video v-else-if="item.type === 'video'" :src="item.url" muted />
                                <span v-else class="is-audio">
                                    <ElIcon><Headset /></ElIcon>
                                    音频
                                </span>
                                <button
                                    type="button"
                                    title="移除素材"
                                    @click="removeUploadedAttachment(item.id)"
                                >
                                    <ElIcon><Close /></ElIcon>
                                </button>
                            </figure>
                            <button
                                v-for="referenceType in videoOmniReferenceDefinitions"
                                :key="referenceType.value"
                                class="agent-video-add-reference"
                                type="button"
                                :disabled="!canAddVideoReferenceType(referenceType.value)"
                                @click="openReferenceUploadMenu(referenceType.value, '', $event)"
                            >
                                <ElIcon><component :is="referenceType.icon" /></ElIcon>
                                <span>{{ referenceType.label }}</span>
                            </button>
                        </div>
                        <div
                            v-else-if="videoGenerationMethod === 'start_end'"
                            class="agent-start-end-frames"
                        >
                            <button
                                class="agent-frame-slot"
                                type="button"
                                @click="firstFrameAttachment ? undefined : openReferenceUploadMenu('image', 'first_frame_image', $event)"
                            >
                                <img v-if="firstFrameAttachment" :src="firstFrameAttachment.url" alt="" />
                                <span v-else><ElIcon><Plus /></ElIcon></span>
                                <em>首帧</em>
                                <i
                                    v-if="firstFrameAttachment"
                                    role="button"
                                    title="移除首帧"
                                    @click.stop="removeUploadedAttachment(firstFrameAttachment.id)"
                                ><ElIcon><Close /></ElIcon></i>
                            </button>
                            <button
                                class="agent-frame-swap"
                                type="button"
                                title="交换首尾帧"
                                :disabled="!firstFrameAttachment && !lastFrameAttachment"
                                @click="swapStartEndFrames"
                            >
                                <ElIcon><Switch /></ElIcon>
                            </button>
                            <button
                                class="agent-frame-slot"
                                type="button"
                                @click="lastFrameAttachment ? undefined : openReferenceUploadMenu('image', 'last_frame_image', $event)"
                            >
                                <img v-if="lastFrameAttachment" :src="lastFrameAttachment.url" alt="" />
                                <span v-else><ElIcon><Plus /></ElIcon></span>
                                <em>尾帧</em>
                                <i
                                    v-if="lastFrameAttachment"
                                    role="button"
                                    title="移除尾帧"
                                    @click.stop="removeUploadedAttachment(lastFrameAttachment.id)"
                                ><ElIcon><Close /></ElIcon></i>
                            </button>
                        </div>
                        <div v-else class="agent-video-reference-grid is-multi">
                            <figure
                                v-for="(item, index) in currentVideoMethodAttachments"
                                :key="item.id"
                                class="agent-video-reference-item"
                            >
                                <img :src="item.url" alt="" />
                                <em>{{ index + 1 }}</em>
                                <button
                                    type="button"
                                    title="移除参考图"
                                    @click="removeUploadedAttachment(item.id)"
                                >
                                    <ElIcon><Close /></ElIcon>
                                </button>
                            </figure>
                            <button
                                class="agent-video-add-reference"
                                type="button"
                                @click="openReferenceUploadMenu('image', '', $event)"
                            >
                                <ElIcon><Plus /></ElIcon>
                                <span>添加图片</span>
                            </button>
                        </div>
                    </section>
                    <div
                        v-if="composerMode === 'agent' && uploadedAttachments.length"
                        class="agent-uploaded-references"
                    >
                        <figure
                            v-for="item in uploadedAttachments"
                            :key="item.id"
                            class="agent-uploaded-reference"
                            :class="[`is-${item.status || 'success'}`]"
                            :title="item.name"
                        >
                            <img
                                v-if="item.type === 'image'"
                                :src="item.previewUrl || item.url"
                                alt=""
                            />
                            <video
                                v-else-if="item.type === 'video'"
                                :src="item.previewUrl || item.url"
                                muted
                            />
                            <span v-else>{{ attachmentTypeLabel(item.type) }}</span>
                            <em v-if="item.status === 'uploading'">上传中</em>
                            <em v-else-if="item.status === 'failed'">失败</em>
                            <button
                                type="button"
                                title="移除"
                                @click="removeUploadedAttachment(item.id)"
                            >
                                <ElIcon><Close /></ElIcon>
                            </button>
                        </figure>
                    </div>
                    <textarea
                        ref="composerRef"
                        v-model="draft"
                        rows="3"
                        :placeholder="composerPlaceholder"
                        :disabled="sending"
                        @input="resizeComposer"
                        @keydown.enter.exact.prevent="send"
                    />
                    <div class="agent-composer-actions">
                        <div class="agent-toolbar-left">
                            <button
                                v-if="composerMode === 'agent'"
                                type="button"
                                title="添加附件"
                                data-agent-popover-trigger
                                @click="openAddPopover($event)"
                            >
                                <ElIcon><Paperclip /></ElIcon>
                            </button>
                            <button
                                class="agent-mode-trigger"
                                type="button"
                                title="模式"
                                data-agent-popover-trigger
                                @click="togglePopover('composerMode', $event)"
                            >
                                <ElIcon>
                                    <MagicStick v-if="composerMode === 'agent'" />
                                    <Picture v-else-if="composerMode === 'image'" />
                                    <VideoCamera v-else />
                                </ElIcon>
                                <em>{{ currentComposerMode.label }}</em>
                                <ElIcon><ArrowDown /></ElIcon>
                            </button>
                            <template v-if="composerMode !== 'agent'">
                                <button
                                    class="agent-param-trigger"
                                    type="button"
                                    title="生成参数"
                                    data-agent-popover-trigger
                                    @click="togglePopover('mediaParams', $event)"
                                >
                                    <em>{{ mediaParamSummary }}</em>
                                    <ElIcon><ArrowDown /></ElIcon>
                                </button>
                                <button
                                    type="button"
                                    title="选择模型"
                                    data-agent-popover-trigger
                                    @click="togglePopover('mediaModel', $event)"
                                >
                                    <img
                                        class="agent-model-trigger-icon"
                                        :src="modelSwitchIcon"
                                        alt=""
                                    />
                                </button>
                            </template>
                            <template v-else>
                                <button
                                    type="button"
                                    title="Skill"
                                    data-agent-popover-trigger
                                    @click="openSkillBrowser('skill', $event)"
                                >
                                    <ElIcon><Collection /></ElIcon>
                                </button>
                                <button
                                    type="button"
                                    title="模型偏好"
                                    data-agent-popover-trigger
                                    @click="togglePopover('agentModel', $event)"
                                >
                                    <img
                                        class="agent-model-trigger-icon"
                                        :src="modelSwitchIcon"
                                        alt=""
                                    />
                                </button>
                            </template>
                        </div>
                        <button
                            class="agent-send"
                            :class="{ 'is-stopping': sending }"
                            type="button"
                            :title="sending ? '停止生成' : '发送'"
                            :disabled="!sending && !draft.trim()"
                            @click="sending ? stopAgentResponse() : send()"
                        >
                            <ElIcon v-if="!sending"><Top /></ElIcon>
                            <span v-else class="agent-stop-icon" aria-hidden="true" />
                        </button>
                    </div>

                    <Teleport to="body">
                    <div
                        v-if="activePopover === 'add'"
                        class="agent-popover agent-composer-popover agent-upload-popover"
                        data-agent-popover
                        :style="activePopoverStyle"
                    >
                        <button type="button" @click="openLocalUpload">
                            <span>
                                <ElIcon><Picture /></ElIcon>
                                本地上传
                            </span>
                        </button>
                        <button type="button" @click="openAssetLibrary">
                            <span>
                                <ElIcon><Collection /></ElIcon>
                                资产库上传
                            </span>
                        </button>
                    </div>

                    <div
                        v-else-if="activePopover === 'composerMode'"
                        class="agent-popover agent-mode-menu"
                        data-agent-popover
                        :style="activePopoverStyle"
                    >
                        <button
                            v-for="mode in composerModes"
                            :key="mode.value"
                            type="button"
                            :class="{ active: composerMode === mode.value }"
                            @click="selectComposerMode(mode.value)"
                        >
                            <span>
                                <ElIcon>
                                    <MagicStick v-if="mode.value === 'agent'" />
                                    <Picture v-else-if="mode.value === 'image'" />
                                    <VideoCamera v-else />
                                </ElIcon>
                                {{ mode.label }}
                            </span>
                            <ElIcon v-if="composerMode === mode.value"><Check /></ElIcon>
                        </button>
                    </div>

                    <div
                        v-else-if="activePopover === 'mediaModel'"
                        class="agent-popover agent-model-popover"
                        data-agent-popover
                        :style="activePopoverStyle"
                    >
                        <div class="agent-popover-title">
                            <strong>选择模型</strong>
                        </div>
                        <button
                            v-for="model in mediaModelOptions"
                            :key="String(model.value)"
                            class="agent-model-row"
                            type="button"
                            :class="{ active: isMediaOptionActive('channel', model.value) }"
                            @click="updateMediaOption('channel', model.value)"
                        >
                            <span class="agent-model-icon">
                                <ElIcon>
                                    <Picture v-if="composerMode === 'image'" />
                                    <VideoCamera v-else />
                                </ElIcon>
                            </span>
                            <span>
                                <strong>{{ model.label }}</strong>
                                <em>{{ String(model.value) }}</em>
                            </span>
                            <ElIcon v-if="isMediaOptionActive('channel', model.value)">
                                <Check />
                            </ElIcon>
                        </button>
                    </div>

                    <div
                        v-else-if="activePopover === 'agentModel'"
                        class="agent-popover agent-model-popover agent-preference-popover"
                        data-agent-popover
                        :style="activePopoverStyle"
                    >
                        <div class="agent-popover-title">
                            <strong>模型偏好</strong>
                        </div>
                        <div class="agent-preference-tabs">
                            <button
                                type="button"
                                :class="{ active: agentModelTab === 'image' }"
                                @click="agentModelTab = 'image'"
                            >
                                Image
                            </button>
                            <button
                                type="button"
                                :class="{ active: agentModelTab === 'video' }"
                                @click="agentModelTab = 'video'"
                            >
                                Video
                            </button>
                        </div>
                        <div class="agent-preference-list">
                            <button
                                v-for="model in agentModelOptions"
                                :key="String(model.value)"
                                class="agent-model-row"
                                type="button"
                                :class="{
                                    active: isAgentModelOptionActive('channel', model.value)
                                }"
                                @click="updateAgentModelOption('channel', model.value)"
                            >
                                <span class="agent-model-icon">
                                    <ElIcon>
                                        <Picture v-if="agentModelTab === 'image'" />
                                        <VideoCamera v-else />
                                    </ElIcon>
                                </span>
                                <span>
                                    <strong>{{ model.label }}</strong>
                                    <em>{{ String(model.value) }}</em>
                                </span>
                                <ElIcon v-if="isAgentModelOptionActive('channel', model.value)">
                                    <Check />
                                </ElIcon>
                            </button>
                        </div>
                    </div>

                    <div
                        v-else-if="activePopover === 'mediaParams'"
                        class="agent-popover agent-media-params"
                        data-agent-popover
                        :style="activePopoverStyle"
                        @pointerdown.stop
                    >
                        <div class="agent-popover-title">
                            <strong>{{
                                composerMode === 'image' ? '图像参数' : '视频参数'
                            }}</strong>
                        </div>
                        <section v-if="composerMode === 'video'" class="agent-video-methods">
                            <div
                                class="agent-video-method-tabs"
                                role="tablist"
                                @mousedown.capture.stop.prevent="selectVideoGenerationMethodFromEvent"
                                @pointerdown.capture.stop.prevent="selectVideoGenerationMethodFromEvent"
                                @click.capture.stop="selectVideoGenerationMethodFromEvent"
                            >
                                <button
                                    v-for="method in videoMethodDefinitions"
                                    :key="method.value"
                                    type="button"
                                    role="tab"
                                    :data-video-method="method.value"
                                    :disabled="!isVideoMethodSupported(method.value)"
                                    :class="{ active: videoGenerationMethod === method.value }"
                                    :title="
                                        isVideoMethodSupported(method.value)
                                            ? method.description
                                            : '当前模型不支持此模式'
                                    "
                                    data-agent-popover-trigger
                                    @mousedown.stop.prevent="selectVideoGenerationMethod(method.value)"
                                    @pointerdown.stop.prevent="selectVideoGenerationMethod(method.value)"
                                    @pointerup.stop
                                    @mouseup.stop
                                    @click.stop="selectVideoGenerationMethod(method.value)"
                                    @keydown.enter.stop.prevent="selectVideoGenerationMethod(method.value)"
                                    @keydown.space.stop.prevent="selectVideoGenerationMethod(method.value)"
                                >
                                    {{ method.label }}
                                </button>
                            </div>
                            <div
                                v-if="!supportedVideoMethods.length"
                                class="agent-video-method-unavailable"
                            >
                                当前模型未配置可用的参考生成模式
                            </div>
                        </section>
                        <div
                            v-for="option in mediaParamOptions"
                            :key="option.key"
                            class="agent-param-section"
                        >
                            <span>{{ optionTitle(option.key) }}</span>
                            <div class="agent-param-grid" :class="`is-${option.key}`">
                                <button
                                    v-for="value in option.values"
                                    :key="String(value.value)"
                                    type="button"
                                    :class="{
                                        active: isMediaOptionActive(option.key, value.value)
                                    }"
                                    @click="updateMediaOption(option.key, value.value)"
                                >
                                    <span
                                        v-if="option.key === 'ratio'"
                                        class="agent-ratio-shape"
                                        :style="ratioPreviewStyle(value.value)"
                                        aria-hidden="true"
                                    />
                                    <em>{{ displayOptionValueLabel(value.value, value.label) }}</em>
                                </button>
                            </div>
                        </div>
                        <div v-if="false && composerMode === 'video'" class="agent-param-section">
                            <span>暂未接入</span>
                            <div class="agent-param-grid is-static">
                                <button type="button" disabled>视频编辑</button>
                                <button type="button" disabled>首尾帧</button>
                                <button type="button" disabled>网络搜索</button>
                            </div>
                        </div>
                    </div>
                    </Teleport>
                    <input
                        ref="uploadInputRef"
                        class="agent-upload-input"
                        type="file"
                        :accept="uploadAccept"
                        multiple
                        @change="handleLocalUpload"
                    />
                </div>
            </footer>

            <Teleport to="body">
            <div
                v-if="activePopover === 'skill'"
                class="agent-skill-browser"
                data-agent-popover
                :style="activePopoverStyle"
            >
                <header>
                    <strong>Skill</strong>
                    <button type="button" @click="notifyComingSoon('创建 Skill')">创建</button>
                    <button type="button" @click="skillTab = 'all'">全部</button>
                </header>
                <div class="agent-skill-tabs">
                    <button
                        v-for="tab in skillTabs"
                        :key="tab.value"
                        type="button"
                        :class="{ active: skillTab === tab.value }"
                        @click="skillTab = tab.value"
                    >
                        {{ tab.label }}
                    </button>
                </div>
                <label class="agent-skill-search">
                    <ElIcon><Search /></ElIcon>
                    <input v-model="skillKeyword" type="text" placeholder="搜索 Skill" />
                </label>
                <div class="agent-skill-list">
                    <div v-if="skillLoading" class="agent-empty">Skill 加载中...</div>
                    <div v-else-if="!filteredSkills.length" class="agent-empty">暂无匹配 Skill</div>
                    <button
                        v-for="skill in filteredSkills"
                        :key="skill.skill_key || skill.prompt"
                        type="button"
                        @click="selectSkillCard(skill)"
                    >
                        <span class="agent-skill-thumb">{{ skill.icon }}</span>
                        <span class="agent-skill-info">
                            <strong>{{ skill.title }}</strong>
                            <em>{{ skill.prompt }}</em>
                            <small>{{ skill.desc }}</small>
                        </span>
                        <span class="agent-skill-type">
                            {{
                                skill.skill_type === 'workflow_template'
                                    ? 'Workflow'
                                    : skill.skill_type === 'agent_workflow'
                                      ? 'Agent'
                                      : 'Prompt'
                            }}
                        </span>
                        <span class="agent-skill-detail" @click.stop="openSkillDetail(skill)">
                            详情
                        </span>
                    </button>
                </div>
                <footer>
                    <button type="button" @click="notifyComingSoon('查看全部 Skill')">
                        没找到合适的？查看全部 Skill
                    </button>
                </footer>
            </div>

            <div v-if="activeSkillDetail" class="agent-modal-mask" @pointerdown.self="closeModal">
                <section class="agent-detail-modal" @pointerdown.stop>
                    <header>
                        <div>
                            <span class="agent-skill-thumb">{{ activeSkillDetail.icon }}</span>
                            <strong>{{ activeSkillDetail.title }}</strong>
                        </div>
                        <button type="button" @click="closeModal">
                            <ElIcon><Close /></ElIcon>
                        </button>
                    </header>
                    <p>{{ activeSkillDetail.desc }}</p>
                    <dl>
                        <dt>调用指令</dt>
                        <dd>{{ activeSkillDetail.prompt }}</dd>
                        <dt>当前状态</dt>
                        <dd>静态详情页，选择后可填入输入框并接入现有 Agent 发送链路</dd>
                    </dl>
                    <footer>
                        <button type="button" @click="selectSkillCard(activeSkillDetail)">
                            使用 Skill
                        </button>
                    </footer>
                </section>
            </div>
            </Teleport>
        </template>
    </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { ElIcon, ElMessage } from 'element-plus'
import {
    ArrowDown,
    Check,
    Clock,
    Close,
    Collection,
    EditPen,
    Headset,
    MagicStick,
    Paperclip,
    Picture,
    Plus,
    Search,
    Share,
    Switch,
    Top,
    VideoCamera
} from '@element-plus/icons-vue'
import {
    cancelCanvasAgentChat,
    deleteCanvasAgentChatThread,
    executeCanvasAgentBatch,
    getCanvasAgentBatchStatus,
    getCanvasAgentRunStatus,
    getCanvasAgentChatThread,
    getCanvasAgentChatThreads,
    getCanvasSkillDetail,
    getCanvasSkills,
    proxyImageQuery,
    proxyVideoQuery,
    sendCanvasAgentChatMessage,
    streamCanvasAgentChat
} from '@/apps/aigc_canvas/api'
import {
    uploadFile as uploadAppFile,
    uploadImage as uploadAppImage,
    uploadVideo as uploadAppVideo
} from '@/api/app'
import { normalizeFileUrl } from '@/utils/file-url'
import { getApiUrl } from '@/utils/env'

type AgentMessage = {
    id?: number
    local_id?: string
    role: 'user' | 'assistant'
    content: string
    status: string
    error?: string
    content_json?: Record<string, any>
    attachments?: UploadedAttachment[]
    tool_calls?: any[]
    workspace_actions?: any[]
    media_task?: {
        mode: MediaMode
        status: 'running' | 'success' | 'failed'
        model: string
        params: string
        ratio?: string | number
        nodeId?: string
        error?: string
    }
}

type LibSkill = {
    code: string
    title: string
    prompt: string
    desc: string
    icon: string
    skill_key?: string
    skill_type?: 'agent_prompt' | 'workflow_template' | 'agent_workflow'
    skill_version?: number
    source_type?: string
    category?: string
    content_markdown?: string
    workflow_json?: Record<string, any>
}

type ComposerMode = 'agent' | 'image' | 'video'
type MediaMode = Exclude<ComposerMode, 'agent'>
type CanvasOptionValue = {
    label: string
    value: string | number
    [key: string]: any
}
type CanvasOption = {
    key: string
    values: CanvasOptionValue[]
    defaultValue?: string | number
}
type UploadedAttachment = {
    id: string
    name: string
    type: 'image' | 'video' | 'audio' | 'file'
    url: string
    remoteUrl?: string
    previewUrl?: string
    status?: 'uploading' | 'success' | 'failed'
    error?: string
    source?: string
    role?: string
    generationMethod?: VideoGenerationMethod
}
type InitialComposerPayload = {
    draft?: string
    mode?: ComposerMode
    selectedSkill?: string
    selectedSkillPrompt?: string
    attachments?: Array<Partial<UploadedAttachment> & Record<string, any>>
    autoSubmit?: boolean
}
type VideoGenerationMethod = 'omni_reference' | 'start_end' | 'multi_frame'
type MediaGenerationStatus = {
    jobId?: string
    mode?: MediaMode
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
type AgentThreadRecord = {
    id: string
    title: string
    messages: AgentMessage[]
    messageCount?: number
    threadId?: number | string
    composerMode: ComposerMode
    selectedSkill: string
    selectedSkillPrompt: string
    pendingSkillContext?: Record<string, any> | null
    updatedAt: number
}

const props = defineProps<{
    projectId?: string | number
    canvasSnapshot: Record<string, any>
    imageOptions?: CanvasOption[]
    videoOptions?: CanvasOption[]
    imageConfig?: Record<string, any>
    videoConfig?: Record<string, any>
    generatingMedia?: boolean
    mediaGenerationStatus?: MediaGenerationStatus
    initialComposer?: InitialComposerPayload | null
    embeddedComposer?: boolean
    submitMode?: 'agent' | 'defer'
}>()

const emit = defineEmits<{
    (
        event: 'layout-change',
        payload: { collapsed: boolean; width: number; resizing: boolean }
    ): void
    (event: 'apply-action', action: any): void
    (
        event: 'open-asset-library',
        payload?: { acceptTypes: Array<'image' | 'video' | 'audio'> }
    ): void
    (
        event: 'update-media-config',
        payload: { mode: MediaMode; key: string; value: string | number }
    ): void
    (
        event: 'generate-media',
        payload: {
            jobId: string
            mode: MediaMode
            prompt: string
            config: Record<string, any>
            attachments?: UploadedAttachment[]
        }
    ): void
    (
        event: 'preview-media',
        payload: { type: 'image' | 'video' | 'audio'; url: string; poster?: string; title?: string }
    ): void
    (
        event: 'submit-composer',
        payload: {
            draft: string
            mode: ComposerMode
            selectedSkill: string
            selectedSkillPrompt: string
            attachments: UploadedAttachment[]
            imageConfig: Record<string, any>
            videoConfig: Record<string, any>
        }
    ): void
}>()

const skills = [
    { code: 'agent_auto', label: '自动' },
    { code: 'generate_image', label: '图片' },
    { code: 'generate_video', label: '视频' },
    { code: 'generate_music', label: '音乐' },
    { code: 'creative_plan', label: '方案' }
]

const skillCards: LibSkill[] = []

const composerModes = [
    { value: 'agent', label: 'Agent' },
    { value: 'image', label: '图像' },
    { value: 'video', label: '视频' }
] as const

const skillTabs = [
    { value: 'general', label: '通用' },
    { value: 'favorite', label: '收藏' },
    { value: 'mine', label: '我的' }
] as const
const modelSwitchIcon = '/short-drama/figma/icon/moxing.svg'
const copyIcon = '/short-drama/figma/icon/Copy.svg'
const embeddedComposer = computed(() => Boolean(props.embeddedComposer))

const collapsed = ref(false)
const PANEL_MIN_WIDTH = 400
const PANEL_MAX_WIDTH = 600
const PANEL_WIDTH_STORAGE_KEY = 'aigc_canvas_agent_panel_width'
const panelWidth = ref(PANEL_MIN_WIDTH)
const panelResizing = ref(false)
const sending = ref(false)
const draft = ref('')
const composerMode = ref<ComposerMode>('agent')
const selectedSkill = ref('agent_auto')
const selectedSkillPrompt = ref('')
const activePopover = ref('')
const activePopoverStyle = ref<CSSProperties>({})
const agentModelTab = ref<MediaMode>('image')
const videoGenerationMethod = ref<VideoGenerationMethod>('omni_reference')
const requestedVideoUploadType = ref<'image' | 'video' | 'audio' | ''>('')
const requestedFrameRole = ref<'first_frame_image' | 'last_frame_image' | ''>('')
const agentMediaConfigs = ref<Record<MediaMode, Record<string, any>>>({
    image: {},
    video: {}
})
const skillTab = ref<'general' | 'favorite' | 'mine' | 'all'>('general')
const skillKeyword = ref('')
const remoteSkills = ref<LibSkill[]>([])
const skillLoading = ref(false)
const threadId = ref<number | string>('')
const generationRecordPolling = ref(false)
let generationRecordTimer: ReturnType<typeof setInterval> | undefined
const threadTitle = ref('新的对话')
const activeSkillDetail = ref<LibSkill | null>(null)
const messages = ref<AgentMessage[]>([])
const expandedMessageIds = ref<Set<string>>(new Set())
const messageListRef = ref<HTMLElement | null>(null)
const composerRef = ref<HTMLTextAreaElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploadedAttachments = ref<UploadedAttachment[]>([])
const threadRecords = ref<AgentThreadRecord[]>([])
const activeLocalThreadId = ref('')
const restoringThread = ref(false)
const pendingSkillContext = ref<Record<string, any> | null>(null)
const appliedActionKeys = new Set<string>()
let activeStreamController: AbortController | null = null
let activeAssistantMessage: AgentMessage | null = null
let activeRequestId = ''
const stoppedAssistantMessages = new WeakSet<object>()
const consumedInitialComposerSignatures = new Set<string>()
const brokenAttachmentPreviews = ref(new Set<string>())

const generatingMedia = computed(() => Boolean(props.generatingMedia))
const panelStyle = computed(() =>
    collapsed.value || embeddedComposer.value ? undefined : { width: `${panelWidth.value}px` }
)

const historyItems = computed(() => threadRecords.value)

const currentComposerMode = computed(() => {
    return composerModes.find((mode) => mode.value === composerMode.value) || composerModes[0]
})

const currentMediaMode = computed<MediaMode>(() =>
    composerMode.value === 'video' ? 'video' : 'image'
)

const mediaOptions = computed(() => {
    return composerMode.value === 'video' ? props.videoOptions || [] : props.imageOptions || []
})

const mediaConfig = computed(() => {
    return composerMode.value === 'video' ? props.videoConfig || {} : props.imageConfig || {}
})

const mediaModelOptions = computed(() => {
    return mediaOptions.value.find((option) => option.key === 'channel')?.values || []
})

const currentVideoChannel = computed<any>(() => {
    if (composerMode.value !== 'video') return null
    return (
        mediaModelOptions.value.find(
            (item) => String(item.value) === String(currentOptionValue('channel'))
        ) || mediaModelOptions.value[0]
    )
})

const videoMethodDefinitions: Array<{
    value: VideoGenerationMethod
    label: string
    description: string
}> = [
    { value: 'omni_reference', label: '全能参考', description: '图片、视频、音频参考' },
    { value: 'start_end', label: '首尾帧', description: '设置开始与结束画面' },
    { value: 'multi_frame', label: '智能多帧', description: '多张图片引导镜头' }
]

const videoOmniReferenceDefinitions = [
    { value: 'video', label: '视频', icon: VideoCamera },
    { value: 'image', label: '图片', icon: Picture },
    { value: 'audio', label: '音频', icon: Headset }
] as const

const supportedVideoMethods = computed<VideoGenerationMethod[]>(() => {
    const channel = currentVideoChannel.value || {}
    const configured = Array.isArray(channel.generation_modes)
        ? channel.generation_modes.filter((item: string) =>
              ['omni_reference', 'start_end', 'multi_frame'].includes(item)
          )
        : []
    if (configured.length) return configured as VideoGenerationMethod[]
    const types = Array.isArray(channel.supported_asset_types)
        ? channel.supported_asset_types.map(String)
        : ['image']
    const maxImages = Number(channel.max_reference_images || 0)
    const methods: VideoGenerationMethod[] = []
    if (
        maxImages > 0 &&
        Number(channel.max_reference_videos || 0) > 0 &&
        Number(channel.max_reference_audios || 0) > 0 &&
        ['image', 'video', 'audio'].every((type) => types.includes(type))
    ) {
        methods.push('omni_reference')
    }
    if (maxImages >= 2 && types.includes('image')) methods.push('start_end')
    if (maxImages >= 3 && types.includes('image')) methods.push('multi_frame')
    return methods
})

const currentVideoMethodAttachments = computed(() =>
    uploadedAttachments.value.filter(
        (item) => !item.generationMethod || item.generationMethod === videoGenerationMethod.value
    )
)

const firstFrameAttachment = computed(() =>
    currentVideoMethodAttachments.value.find((item) => item.role === 'first_frame_image')
)

const lastFrameAttachment = computed(() =>
    currentVideoMethodAttachments.value.find((item) => item.role === 'last_frame_image')
)

const agentModelOptions = computed(() => {
    const options =
        agentModelTab.value === 'video' ? props.videoOptions || [] : props.imageOptions || []
    return options.find((option) => option.key === 'channel')?.values || []
})

const mediaParamOptions = computed(() => {
    return mediaOptions.value.filter((option) => option.key !== 'channel' && option.values.length)
})

const currentMediaModelLabel = computed(() => optionLabel('channel'))

const agentMediaPayload = computed(() => ({
    image: buildAgentMediaPayload('image'),
    video: buildAgentMediaPayload('video')
}))

const mediaParamSummary = computed(() => {
    if (composerMode.value === 'agent') return ''
    const preferredKeys =
        composerMode.value === 'image'
            ? ['quality', 'ratio', 'quantity']
            : ['mode', 'resolution', 'quality', 'ratio', 'duration']
    const labels = preferredKeys
        .filter((key) => currentOption(key)?.values?.length)
        .map((key) => optionLabel(key))
        .filter(Boolean)
    return labels.slice(0, 4).join(' · ') || '默认参数'
})

const composerPlaceholder = computed(() => {
    if (composerMode.value === 'image') return '今天我们要创作什么图像'
    if (composerMode.value === 'video') return '描述你想生成的视频画面'
    return '开始你的创作，或者 @ 引用工作流/节点/资源'
})

const uploadAccept = computed(() => {
    if (composerMode.value === 'video') {
        if (
            videoGenerationMethod.value === 'omni_reference' &&
            requestedVideoUploadType.value
        ) {
            return `${requestedVideoUploadType.value}/*`
        }
        return videoGenerationMethod.value === 'omni_reference'
            ? 'image/*,video/*,audio/*'
            : 'image/*'
    }
    if (composerMode.value === 'image') return 'image/*'
    return 'image/*,video/*'
})

watch(
    () => props.initialComposer,
    (payload) => {
        applyInitialComposer(payload || null)
    },
    { deep: true, immediate: true }
)

watch(
    () => props.mediaGenerationStatus,
    async (status) => {
        updateGenerationActionsFromStatus(status)
        updateMediaGenerationMessage(status)
        await scrollToBottom()
    },
    { deep: true }
)

watch(
    [() => composerMode.value, currentVideoChannel],
    ([mode]) => {
        if (mode === 'video') ensureSupportedVideoMethod()
    },
    { immediate: true }
)

watch(
    () => props.canvasSnapshot?.agent_generation_results,
    () => reconcileGenerationActionsFromCanvas(),
    { deep: true }
)

watch(
    messages,
    () => {
        upsertCurrentThread()
    },
    { deep: true }
)

watch(
    agentMediaConfigs,
    () => {
        persistAgentModelPreferences()
    },
    { deep: true }
)

watch([threadId, threadTitle, composerMode, selectedSkill, selectedSkillPrompt], () => {
    upsertCurrentThread()
})

const selectedSkillTitle = computed(() => {
    return (
        allSkills.value.find((skill) => skill.skill_key === selectedSkillPrompt.value)?.title ||
        allSkills.value.find((skill) => skill.prompt === selectedSkillPrompt.value)?.title ||
        skills.find((skill) => skill.code === selectedSkill.value)?.label ||
        ''
    )
})

const allSkills = computed(() => {
    return remoteSkills.value.length ? remoteSkills.value : skillCards
})

const filteredSkills = computed(() => {
    const keyword = skillKeyword.value.trim().toLowerCase()
    const source =
        skillTab.value === 'favorite'
            ? allSkills.value.filter((skill) => skill.source_type === 'builtin').slice(0, 4)
            : skillTab.value === 'mine'
              ? allSkills.value.filter((skill) => skill.source_type !== 'builtin')
              : allSkills.value
    if (!keyword) return source
    return source.filter((skill) => {
        return [skill.title, skill.prompt, skill.desc, skill.category || ''].some((text) =>
            text.toLowerCase().includes(keyword)
        )
    })
})

const selectedSummary = computed(() => {
    const selected = Array.isArray(props.canvasSnapshot?.selected_elements)
        ? props.canvasSnapshot.selected_elements
        : []
    if (!selected.length) return ''
    const names = selected
        .slice(0, 2)
        .map((item: any) => item.title || item.id || item.type)
        .filter(Boolean)
    return `${names.join('、')}${selected.length > 2 ? ` 等 ${selected.length} 个元素` : ''}`
})

function attachmentPreviewUrl(item: Partial<UploadedAttachment> & Record<string, any>) {
    const url = String(item?.previewUrl || item?.url || '').trim()
    return url && !brokenAttachmentPreviews.value.has(url) ? url : ''
}

function markAttachmentPreviewBroken(url: string) {
    if (!url || brokenAttachmentPreviews.value.has(url)) return
    brokenAttachmentPreviews.value = new Set([...brokenAttachmentPreviews.value, url])
}

function applyInitialComposer(payload: InitialComposerPayload | null) {
    if (!payload) return
    const normalizedMode: ComposerMode = ['agent', 'image', 'video'].includes(String(payload.mode))
        ? (payload.mode as ComposerMode)
        : 'agent'
    const normalizedAttachments = normalizeInitialComposerAttachments(
        payload.attachments || [],
        normalizedMode
    )
    const signature = JSON.stringify({
        draft: String(payload.draft || ''),
        mode: normalizedMode,
        selectedSkill: String(payload.selectedSkill || ''),
        selectedSkillPrompt: String(payload.selectedSkillPrompt || ''),
        attachments: normalizedAttachments.map((item) => item.remoteUrl || item.url),
        autoSubmit: Boolean(payload.autoSubmit)
    })
    if (consumedInitialComposerSignatures.has(signature)) return
    consumedInitialComposerSignatures.add(signature)

    composerMode.value = normalizedMode
    draft.value = String(payload.draft || '')
    selectedSkill.value =
        String(payload.selectedSkill || '') ||
        (normalizedMode === 'image'
            ? 'generate_image'
            : normalizedMode === 'video'
              ? 'generate_video'
              : 'agent_auto')
    selectedSkillPrompt.value = String(payload.selectedSkillPrompt || '')
    pendingSkillContext.value = null
    activePopover.value = ''
    activeSkillDetail.value = null
    if (normalizedAttachments.length) {
        const existed = new Set(uploadedAttachments.value.map((item) => item.remoteUrl || item.url))
        uploadedAttachments.value = [
            ...uploadedAttachments.value,
            ...normalizedAttachments.filter((item) => !existed.has(item.remoteUrl || item.url))
        ]
    }
    nextTick(() => {
        resizeComposer()
        if (payload.autoSubmit && draft.value.trim()) {
            void send()
            return
        }
        focusComposer()
    })
}

function normalizeInitialComposerAttachments(
    items: Array<Partial<UploadedAttachment> & Record<string, any>>,
    mode: ComposerMode = composerMode.value
): UploadedAttachment[] {
    if (!Array.isArray(items)) return []
    return items
        .map((item) => {
            const url = normalizeUploadedAssetUrl(item)
            if (!url || url.startsWith('blob:')) return null
            const type = normalizeAttachmentType(item, url)
            if (!['image', 'video', 'audio'].includes(type)) return null
            return {
                id: String(item.id || `${type}_${url}`),
                name: String(item.name || item.title || (type === 'video' ? '参考视频' : '参考图')),
                type,
                url,
                remoteUrl: url,
                previewUrl: String(item.previewUrl || item.preview_url || url),
                status: 'success',
                source: String(item.source || 'home_upload'),
                role: String(
                    item.role ||
                        (type === 'video'
                            ? 'reference_video'
                            : type === 'audio'
                              ? 'reference_audio'
                              : 'reference_image')
                ),
                generationMethod:
                    (item.generationMethod || item.generation_method) === 'start_end' ||
                    (item.generationMethod || item.generation_method) === 'multi_frame' ||
                    (item.generationMethod || item.generation_method) === 'omni_reference'
                        ? (item.generationMethod || item.generation_method)
                        : mode === 'video'
                          ? videoGenerationMethod.value
                          : undefined
            } as UploadedAttachment
        })
        .filter(Boolean) as UploadedAttachment[]
}

function escapeHtml(value: string) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function formatInlineMarkdown(value: string) {
    return escapeHtml(value)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function formatMarkdownLite(content: string) {
    const lines = String(content || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
    const html: string[] = []
    let paragraph: string[] = []
    let list: string[] = []

    const flushParagraph = () => {
        if (!paragraph.length) return
        html.push(`<p>${paragraph.map(formatInlineMarkdown).join('<br>')}</p>`)
        paragraph = []
    }
    const flushList = () => {
        if (!list.length) return
        html.push(
            `<ul>${list.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ul>`
        )
        list = []
    }

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) {
            flushParagraph()
            flushList()
            continue
        }
        if (/^```/.test(line)) {
            flushParagraph()
            flushList()
            continue
        }
        const heading = line.match(/^#{1,6}\s+(.+)$/)
        if (heading) {
            flushParagraph()
            flushList()
            html.push(`<p class="agent-message-heading">${formatInlineMarkdown(heading[1])}</p>`)
            continue
        }
        const bullet = line.match(/^[-*]\s+(.+)$/)
        const ordered = line.match(/^\d+[.)]\s+(.+)$/)
        if (bullet || ordered) {
            flushParagraph()
            list.push((bullet?.[1] || ordered?.[1] || '').trim())
            continue
        }
        flushList()
        paragraph.push(rawLine)
    }
    flushParagraph()
    flushList()
    return html.join('')
}

function formatMessageContent(message: AgentMessage) {
    return formatMarkdownLite(message.content || '')
}

function messageIdentity(message: AgentMessage) {
    return String(message.id || message.local_id || '')
}

function isLongUserMessage(message: AgentMessage) {
    if (message.role !== 'user') return false
    const content = String(message.content || '')
    return content.length > 900 || content.split(/\r?\n/).length > 18
}

function isMessageExpanded(message: AgentMessage) {
    return expandedMessageIds.value.has(messageIdentity(message))
}

function toggleMessageExpanded(message: AgentMessage) {
    const key = messageIdentity(message)
    const next = new Set(expandedMessageIds.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedMessageIds.value = next
}

function typeAssistantText(message: AgentMessage, text: string) {
    message.content = String(text || '')
    message.status = 'success'
    upsertCurrentThread()
    void scrollToBottom()
}

function appendAssistantDelta(message: AgentMessage, delta: string) {
    const nextDelta = String(delta || '')
    if (!nextDelta || nextDelta === 'Agent is preparing your result.') return false
    message.content += nextDelta
    message.status = 'running'
    void scrollToBottom()
    return true
}

function finishAssistantStream(message: AgentMessage, finalText = '') {
    const nextText = String(finalText || '')
    if (nextText) message.content = nextText
    message.status = 'success'
    upsertCurrentThread()
    void scrollToBottom()
}

function assistantProgressText(message: AgentMessage) {
    const stage = String(message.content_json?.progress_stage || '')
    if (stage === 'planning') return '正在整理设计分析与页面结构...'
    if (stage === 'recovering') return '正在同步分析结果...'
    return '正在理解需求并分析参考内容...'
}

function messageNextAction(message: AgentMessage) {
    const contentJson = message.content_json || {}
    const action = String(contentJson.next_action || '')
    if (
        action === 'confirm_execution' &&
        (Number(contentJson.batch_id || 0) > 0 ||
            String(contentJson.batch?.status || '') === 'awaiting_initial_confirmation')
    ) {
        return 'confirm_initial_batch'
    }
    return action
}

function shouldShowInitialBatchAction(message: AgentMessage) {
    if (message.role !== 'assistant') return false
    const contentJson = message.content_json || {}
    const batchStatus = String(messageBatch(message)?.status || '')
    if (messageNextAction(message) === 'confirm_initial_batch') {
        return !batchStatus || batchStatus === 'awaiting_initial_confirmation'
    }
    return (
        String(contentJson.skill_key || '') === 'ecommerce_detail_page' &&
        messageBatchId(message) > 0 &&
        batchStatus === 'awaiting_initial_confirmation' &&
        String(message.content || '').includes('第一批')
    )
}

function createLocalThreadId() {
    return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function threadStorageKey() {
    return `aigc_canvas_agent_threads:${props.projectId || 'local'}`
}

function agentModelStorageKey() {
    return `aigc_canvas_agent_model_preferences:${props.projectId || 'global'}`
}

function loadAgentModelPreferences() {
    if (typeof window === 'undefined') return
    try {
        const raw = window.localStorage.getItem(agentModelStorageKey())
        const parsed = raw ? JSON.parse(raw) : {}
        agentMediaConfigs.value = {
            image: parsed?.image && typeof parsed.image === 'object' ? parsed.image : {},
            video: parsed?.video && typeof parsed.video === 'object' ? parsed.video : {}
        }
    } catch {
        agentMediaConfigs.value = { image: {}, video: {} }
    }
}

function persistAgentModelPreferences() {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(agentModelStorageKey(), JSON.stringify(agentMediaConfigs.value))
    } catch {
        // Model preferences are local-only and should never block sending.
    }
}

function cloneMessages(source: AgentMessage[]) {
    return JSON.parse(JSON.stringify(source || [])) as AgentMessage[]
}

function deriveThreadTitle(source: AgentMessage[], fallback = '新的对话') {
    const firstUserMessage = source.find((message) => message.role === 'user')?.content || ''
    const title = firstUserMessage.trim().replace(/\s+/g, ' ')
    if (!title) return fallback
    return title.length > 28 ? `${title.slice(0, 28)}...` : title
}

function historyDisplayTitle(title: string) {
    const normalized = String(title || '新的对话').trim()
    return normalized.length > 6 ? `${normalized.slice(0, 6)}...` : normalized
}

function threadMessageCount(record: AgentThreadRecord) {
    return Number(record.messageCount ?? record.messages.length) || 0
}

function extractPendingSkillContext(source: AgentMessage[]) {
    for (let index = source.length - 1; index >= 0; index -= 1) {
        const message = source[index]
        if (message.role !== 'assistant') continue
        const contentJson = message.content_json || {}
        const pending = contentJson.pending_skill_context
        if (
            ['clarify', 'confirm_execution', 'confirm_initial_batch'].includes(
                String(contentJson.next_action || '')
            ) &&
            pending &&
            Object.keys(pending).length
        ) {
            return pending
        }
        if (
            contentJson.next_action &&
            !['clarify', 'confirm_execution', 'confirm_initial_batch'].includes(
                String(contentJson.next_action)
            )
        )
            return null
    }
    return null
}

function syncPendingSkillContext(result?: any, assistant?: any) {
    const contentJson = assistant?.content_json || result?.assistant_message?.content_json || {}
    const nextAction = result?.next_action || contentJson?.next_action || ''
    const pending = result?.pending_skill_context || contentJson?.pending_skill_context || null
    if (
        ['clarify', 'confirm_execution', 'confirm_initial_batch'].includes(String(nextAction)) &&
        pending &&
        Object.keys(pending).length
    ) {
        pendingSkillContext.value = pending
    } else if (
        nextAction &&
        !['clarify', 'confirm_execution', 'confirm_initial_batch'].includes(String(nextAction))
    ) {
        pendingSkillContext.value = null
    }
}

function normalizeServerMessage(message: any): AgentMessage {
    const contentJson = message?.content_json || {}
    return {
        id: message?.id,
        local_id: `server_message_${message?.id || Date.now()}_${Math.random().toString(16).slice(2)}`,
        role: message?.role === 'user' ? 'user' : 'assistant',
        content: String(message?.content || ''),
        status: String(message?.status || 'success'),
        error: String(message?.error || ''),
        content_json: contentJson,
        attachments: normalizeMessageAttachments(
            contentJson?.attachments || contentJson?.uploaded_references || []
        ),
        tool_calls: Array.isArray(contentJson?.tool_calls) ? contentJson.tool_calls : [],
        workspace_actions: normalizeActions(contentJson?.workspace_actions || [])
    }
}

function normalizeServerThreadRecord(
    thread: any,
    messages: AgentMessage[] = []
): AgentThreadRecord {
    const threadId = thread?.id || thread?.thread_id || ''
    const updatedAt = Number(thread?.updated_at || thread?.update_time || 0)
    return {
        id: `server_${threadId}`,
        title: thread?.title || deriveThreadTitle(messages),
        messages,
        messageCount: Number(thread?.message_count ?? messages.length) || messages.length,
        threadId,
        composerMode: 'agent',
        selectedSkill: 'agent_auto',
        selectedSkillPrompt: '',
        pendingSkillContext: extractPendingSkillContext(messages),
        updatedAt: updatedAt > 0 ? updatedAt * 1000 : Date.now()
    }
}

function normalizeThreadRecord(record: any): AgentThreadRecord | null {
    if (!record || !record.id || !Array.isArray(record.messages)) return null
    const mode: ComposerMode = ['agent', 'image', 'video'].includes(record.composerMode)
        ? record.composerMode
        : 'agent'
    return {
        id: String(record.id),
        title: record.title || deriveThreadTitle(record.messages),
        messages: cloneMessages(record.messages),
        messageCount:
            Number(record.messageCount ?? record.messages.length) || record.messages.length,
        threadId: record.threadId || '',
        composerMode: mode,
        selectedSkill: record.selectedSkill || 'agent_auto',
        selectedSkillPrompt: record.selectedSkillPrompt || '',
        pendingSkillContext:
            record.pendingSkillContext || extractPendingSkillContext(record.messages),
        updatedAt: Number(record.updatedAt) || Date.now()
    }
}

function loadThreadRecords() {
    if (typeof window === 'undefined') return
    try {
        const raw = window.localStorage.getItem(threadStorageKey())
        const parsed = raw ? JSON.parse(raw) : []
        threadRecords.value = Array.isArray(parsed)
            ? parsed
                  .map((record) => normalizeThreadRecord(record))
                  .filter(Boolean)
                  .sort((a, b) => b!.updatedAt - a!.updatedAt)
                  .slice(0, 30)
                  .map((record) => record!)
            : []
    } catch {
        threadRecords.value = []
    }
}

async function syncServerThreadRecords() {
    if (!props.projectId) return
    try {
        const rows: any = await getCanvasAgentChatThreads({
            project_id: props.projectId,
            limit: 30
        })
        let serverRecords = Array.isArray(rows)
            ? rows.map((thread) => normalizeServerThreadRecord(thread))
            : []
        let localRecords = threadRecords.value.filter((record) => {
            if (!record.threadId) return true
            return !serverRecords.some(
                (serverRecord) => String(serverRecord.threadId) === String(record.threadId)
            )
        })
        const staleLocal = localRecords.find(
            (record) =>
                !record.threadId &&
                record.messages.some(
                    (message) => message.role === 'assistant' && message.status === 'running'
                )
        )
        const staleUserContent = String(
            [...(staleLocal?.messages || [])]
                .reverse()
                .find((message) => message.role === 'user')?.content || ''
        ).trim()
        const matchingServer = staleUserContent
            ? serverRecords.find((record) => {
                  const title = String(record.title || '').trim()
                  return title.length >= 12 && staleUserContent.startsWith(title)
              })
            : undefined
        if (staleLocal && matchingServer?.threadId) {
            const detail: any = await getCanvasAgentChatThread({
                thread_id: matchingServer.threadId
            })
            const detailMessages = Array.isArray(detail?.messages)
                ? detail.messages.map((message: any) => normalizeServerMessage(message))
                : []
            const recoveredRecord = normalizeServerThreadRecord(
                detail || { id: matchingServer.threadId },
                detailMessages
            )
            serverRecords = serverRecords.map((record) =>
                String(record.threadId) === String(recoveredRecord.threadId)
                    ? recoveredRecord
                    : record
            )
            localRecords = localRecords.filter((record) => record.id !== staleLocal.id)
            const activeUserContent = String(
                [...messages.value]
                    .reverse()
                    .find((message) => message.role === 'user')?.content || ''
            ).trim()
            if (activeUserContent === staleUserContent) {
                await restoreThread(recoveredRecord)
            }
        }
        threadRecords.value = [...serverRecords, ...localRecords]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 30)
        persistThreadRecords()
        if (!messages.value.length && !threadId.value && threadRecords.value[0]) {
            await restoreThread(threadRecords.value[0])
        }
    } catch {
        // Server history is best-effort; local history remains available if the request fails.
    }
}

function persistThreadRecords() {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(threadStorageKey(), JSON.stringify(threadRecords.value))
    } catch {
        // Local history is a convenience layer; generation should never fail because storage is full.
    }
}

function ensureActiveThreadId() {
    if (!activeLocalThreadId.value) {
        activeLocalThreadId.value = createLocalThreadId()
    }
    return activeLocalThreadId.value
}

function upsertCurrentThread() {
    if (restoringThread.value || (!messages.value.length && !threadId.value)) return
    const id = ensureActiveThreadId()
    const title =
        threadTitle.value && threadTitle.value !== '新的对话'
            ? threadTitle.value
            : deriveThreadTitle(messages.value)
    const record: AgentThreadRecord = {
        id,
        title,
        messages: cloneMessages(messages.value),
        threadId: threadId.value || '',
        composerMode: composerMode.value,
        selectedSkill: selectedSkill.value,
        selectedSkillPrompt: selectedSkillPrompt.value,
        pendingSkillContext: pendingSkillContext.value,
        updatedAt: Date.now()
    }
    const index = threadRecords.value.findIndex((item) => item.id === id)
    const nextRecords = [...threadRecords.value]
    if (index >= 0) {
        nextRecords.splice(index, 1, record)
    } else {
        nextRecords.unshift(record)
    }
    threadRecords.value = nextRecords.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
    persistThreadRecords()
}

function snapshotCurrentThread() {
    upsertCurrentThread()
}

async function resolveThreadRecord(record: AgentThreadRecord) {
    if (!record.threadId || record.messages.length) return record
    try {
        const detail: any = await getCanvasAgentChatThread({ thread_id: record.threadId })
        const detailMessages = Array.isArray(detail?.messages)
            ? detail.messages.map((message: any) => normalizeServerMessage(message))
            : []
        return {
            ...normalizeServerThreadRecord(detail || { id: record.threadId }, detailMessages),
            selectedSkill: record.selectedSkill || 'agent_auto',
            selectedSkillPrompt: record.selectedSkillPrompt || ''
        }
    } catch {
        return record
    }
}

async function restoreThread(record: AgentThreadRecord) {
    const resolvedRecord = await resolveThreadRecord(record)
    restoringThread.value = true
    activeLocalThreadId.value = resolvedRecord.id
    threadId.value = resolvedRecord.threadId || ''
    threadTitle.value = resolvedRecord.title || deriveThreadTitle(resolvedRecord.messages)
    messages.value = cloneMessages(resolvedRecord.messages)
    reconcileGenerationActionsFromCanvas()
    composerMode.value = resolvedRecord.composerMode || 'agent'
    selectedSkill.value = resolvedRecord.selectedSkill || 'agent_auto'
    selectedSkillPrompt.value = resolvedRecord.selectedSkillPrompt || ''
    pendingSkillContext.value =
        resolvedRecord.pendingSkillContext || extractPendingSkillContext(messages.value)
    const index = threadRecords.value.findIndex((item) => item.id === resolvedRecord.id)
    if (index >= 0) {
        const nextRecords = [...threadRecords.value]
        nextRecords.splice(index, 1, resolvedRecord)
        threadRecords.value = nextRecords
        persistThreadRecords()
    }
    draft.value = ''
    activePopover.value = ''
    await nextTick()
    restoringThread.value = false
    await scrollToBottom()
    await focusComposer()
}

function startNewThread() {
    snapshotCurrentThread()
    activeLocalThreadId.value = createLocalThreadId()
    threadId.value = ''
    threadTitle.value = '新的对话'
    messages.value = []
    draft.value = ''
    selectedSkill.value = 'agent_auto'
    selectedSkillPrompt.value = ''
    pendingSkillContext.value = null
    appliedActionKeys.clear()
    activePopover.value = ''
    focusComposer()
}

function selectComposerMode(mode: ComposerMode) {
    composerMode.value = mode
    activePopover.value = ''
    pendingSkillContext.value = null
    if (mode === 'agent') selectedSkill.value = 'agent_auto'
    if (mode === 'image') selectedSkill.value = 'generate_image'
    if (mode === 'video') selectedSkill.value = 'generate_video'
    focusComposer()
}

function selectSkillCard(skill: LibSkill) {
    selectedSkill.value = skill.code || 'agent_prompt'
    selectedSkillPrompt.value = skill.skill_key || skill.prompt
    pendingSkillContext.value = null
    if (!skill.skill_key && !draft.value.trim()) {
        draft.value = `${skill.prompt} `
    }
    activePopover.value = ''
    activeSkillDetail.value = null
    focusComposer()
}

const POPOVER_GAP = 4
const POPOVER_VIEWPORT_PADDING = 8
const popoverMetrics: Record<string, { width: number; height: number }> = {
    history: { width: 210, height: 320 },
    share: { width: 210, height: 148 },
    add: { width: 180, height: 104 },
    composerMode: { width: 180, height: 132 },
    mediaModel: { width: 320, height: 360 },
    agentModel: { width: 340, height: 380 },
    mediaParams: { width: 420, height: 440 },
    skill: { width: 520, height: 420 }
}

function togglePopover(name: string, event?: MouseEvent) {
    activeSkillDetail.value = null
    if (activePopover.value === name) {
        closeActivePopover()
        return
    }
    openAnchoredPopover(name, event?.currentTarget)
}

function openAddPopover(event?: MouseEvent) {
    activeSkillDetail.value = null
    if (activePopover.value === 'add') {
        closeActivePopover()
        return
    }
    openAnchoredPopover('add', event?.currentTarget)
}

function openAnchoredPopover(name: string, target?: EventTarget | null) {
    activePopover.value = name
    positionAnchoredPopover(name, target)
    nextTick(() => positionAnchoredPopover(name, target))
}

function popoverWidthFor(name: string, anchor: HTMLElement | null) {
    const metric = popoverMetrics[name] || popoverMetrics.composerMode
    const composer = anchor?.closest<HTMLElement>('.agent-composer')
    const panel = anchor?.closest<HTMLElement>('.canvas-agent-panel')
    const containerWidth = name === 'skill'
        ? Number(panel?.getBoundingClientRect().width || composer?.getBoundingClientRect().width || metric.width)
        : Number(composer?.getBoundingClientRect().width || panel?.getBoundingClientRect().width || metric.width)
    const natural = name === 'mediaParams'
        ? Math.min(metric.width, Math.max(280, containerWidth - 16))
        : name === 'skill'
          ? Math.min(metric.width, Math.max(300, containerWidth - 24))
          : metric.width
    return Math.max(120, Math.min(natural, window.innerWidth - POPOVER_VIEWPORT_PADDING * 2))
}

function positionAnchoredPopover(name: string, target?: EventTarget | null) {
    const anchor = target instanceof HTMLElement ? target : null
    if (!anchor || typeof window === 'undefined') {
        activePopoverStyle.value = {}
        return
    }
    const anchorRect = anchor.getBoundingClientRect()
    const metric = popoverMetrics[name] || popoverMetrics.composerMode
    const width = popoverWidthFor(name, anchor)
    const maxLeft = window.innerWidth - width - POPOVER_VIEWPORT_PADDING
    const left = Math.min(
        Math.max(POPOVER_VIEWPORT_PADDING, anchorRect.left + anchorRect.width / 2 - width / 2),
        Math.max(POPOVER_VIEWPORT_PADDING, maxLeft)
    )
    const availableAbove = anchorRect.top - POPOVER_VIEWPORT_PADDING - POPOVER_GAP
    const availableBelow = window.innerHeight - anchorRect.bottom - POPOVER_VIEWPORT_PADDING - POPOVER_GAP
    const preferBelow = embeddedComposer.value
    const placeBelow = preferBelow
        ? availableBelow >= metric.height || availableBelow >= availableAbove
        : availableAbove < metric.height && availableBelow > availableAbove
    const maxHeight = Math.max(120, Math.floor((placeBelow ? availableBelow : availableAbove)))
    activePopoverStyle.value = {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        right: 'auto',
        top: placeBelow
            ? `${Math.round(anchorRect.bottom + POPOVER_GAP)}px`
            : 'auto',
        bottom: placeBelow
            ? 'auto'
            : `${Math.round(window.innerHeight - anchorRect.top + POPOVER_GAP)}px`,
        width: `${Math.round(width)}px`,
        maxHeight: `${maxHeight}px`,
        transform: 'none'
    }
}

function closeActivePopover() {
    activePopover.value = ''
    activePopoverStyle.value = {}
}

function handlePanelPointerDown(event: PointerEvent) {
    if (!activePopover.value) return
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('[data-agent-popover]') || target.closest('[data-agent-popover-trigger]')) {
        return
    }
    closeActivePopover()
}

let panelResizeStartX = 0
let panelResizeStartWidth = PANEL_MIN_WIDTH
let previousBodyUserSelect = ''
let previousBodyCursor = ''

function clampPanelWidth(width: number) {
    if (!Number.isFinite(width)) return PANEL_MIN_WIDTH
    return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width)))
}

function loadPanelWidth() {
    try {
        panelWidth.value = clampPanelWidth(
            Number(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY) || PANEL_MIN_WIDTH)
        )
    } catch {
        panelWidth.value = PANEL_MIN_WIDTH
    }
}

function startPanelResize(event: PointerEvent) {
    if (event.button !== 0 || window.innerWidth <= 900) return
    panelResizeStartX = event.clientX
    panelResizeStartWidth = panelWidth.value
    panelResizing.value = true
    previousBodyUserSelect = document.body.style.userSelect
    previousBodyCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    window.addEventListener('pointermove', resizePanel)
    window.addEventListener('pointerup', finishPanelResize, { once: true })
    window.addEventListener('pointercancel', finishPanelResize, { once: true })
}

function resizePanel(event: PointerEvent) {
    if (!panelResizing.value) return
    panelWidth.value = clampPanelWidth(panelResizeStartWidth + panelResizeStartX - event.clientX)
}

function finishPanelResize() {
    if (!panelResizing.value) return
    panelResizing.value = false
    window.removeEventListener('pointermove', resizePanel)
    window.removeEventListener('pointerup', finishPanelResize)
    window.removeEventListener('pointercancel', finishPanelResize)
    document.body.style.userSelect = previousBodyUserSelect
    document.body.style.cursor = previousBodyCursor
    try {
        window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidth.value))
    } catch {
        // Resizing still works when browser storage is unavailable.
    }
}

function handleDocumentPointerDown(event: PointerEvent) {
    if (!activePopover.value) return
    const target = event.target as HTMLElement | null
    if (
        target?.closest('[data-agent-popover]') ||
        target?.closest('[data-agent-popover-trigger]')
    ) {
        return
    }
    closeActivePopover()
}

function toggleShare(event?: MouseEvent) {
    togglePopover('share', event)
}

function openSkillBrowser(name: 'skill', event?: MouseEvent) {
    activeSkillDetail.value = null
    if (activePopover.value === name) {
        closeActivePopover()
        return
    }
    openAnchoredPopover(name, event?.currentTarget)
}

async function selectHistoryItem(item: AgentThreadRecord) {
    if (item.id === activeLocalThreadId.value) {
        activePopover.value = ''
        return
    }
    snapshotCurrentThread()
    await restoreThread(item)
}

async function deleteHistoryItem(item: AgentThreadRecord) {
    const isActive = item.id === activeLocalThreadId.value
    if (item.threadId) {
        try {
            await deleteCanvasAgentChatThread({ thread_id: item.threadId })
        } catch (error) {
            ElMessage.error(error instanceof Error ? error.message : '删除对话失败')
            return
        }
    }
    threadRecords.value = threadRecords.value.filter((record) => record.id !== item.id)
    persistThreadRecords()
    if (!isActive) return
    restoringThread.value = true
    activeLocalThreadId.value = createLocalThreadId()
    threadId.value = ''
    threadTitle.value = '新的对话'
    messages.value = []
    draft.value = ''
    selectedSkill.value = 'agent_auto'
    selectedSkillPrompt.value = ''
    pendingSkillContext.value = null
    nextTick(() => {
        restoringThread.value = false
        focusComposer()
    })
}

function openAssetLibrary() {
    activePopover.value = ''
    const requestedType = requestedVideoUploadType.value
    const acceptTypes: Array<'image' | 'video' | 'audio'> =
        composerMode.value === 'image'
            ? ['image']
            : composerMode.value === 'video' && requestedType
              ? [requestedType]
              : ['image', 'video']
    emit('open-asset-library', { acceptTypes })
}

function openLocalUpload() {
    activePopover.value = ''
    if (composerMode.value === 'agent') {
        requestedVideoUploadType.value = ''
        requestedFrameRole.value = ''
    }
    uploadInputRef.value?.click()
}

function openReferenceUploadMenu(
    type: 'image' | 'video' | 'audio',
    frameRole: 'first_frame_image' | 'last_frame_image' | '' = '',
    event?: MouseEvent
) {
    if (composerMode.value === 'video') {
        if (!isVideoMethodSupported(videoGenerationMethod.value)) return
        if (
            videoGenerationMethod.value === 'omni_reference' &&
            !canAddVideoReferenceType(type)
        ) {
            ElMessage.warning('当前模型不支持继续添加该类型参考素材')
            return
        }
        if (currentVideoMethodAttachments.value.length >= videoMethodAttachmentLimit()) {
            ElMessage.warning('当前模式的参考素材已达到模型上限')
            return
        }
    }
    requestedVideoUploadType.value = type
    requestedFrameRole.value = frameRole
    openAnchoredPopover('add', event?.currentTarget)
}

async function handleLocalUpload(event: Event) {
    const input = event.target as HTMLInputElement
    let files = Array.from(input.files || [])
    const requestedType = requestedVideoUploadType.value
    const frameRole = requestedFrameRole.value
    requestedVideoUploadType.value = ''
    requestedFrameRole.value = ''
    if (!files.length) return
    if (composerMode.value === 'video') {
        const method = videoGenerationMethod.value
        const channel = currentVideoChannel.value || {}
        const supportedTypes = new Set(
            Array.isArray(channel.supported_asset_types)
                ? channel.supported_asset_types.map(String)
                : ['image']
        )
        const existing = currentVideoMethodAttachments.value
        const counts: Record<'image' | 'video' | 'audio', number> = {
            image: existing.filter((item) => item.type === 'image').length,
            video: existing.filter((item) => item.type === 'video').length,
            audio: existing.filter((item) => item.type === 'audio').length
        }
        const limits: Record<'image' | 'video' | 'audio', number> = {
            image: Number(channel.max_reference_images || 0),
            video: Number(channel.max_reference_videos || 0),
            audio: Number(channel.max_reference_audios || 0)
        }
        const totalRemaining = Math.max(0, videoMethodAttachmentLimit() - existing.length)
        files = files
            .filter((file) => {
                const type = file.type.startsWith('image/')
                    ? 'image'
                    : file.type.startsWith('video/')
                      ? 'video'
                      : file.type.startsWith('audio/')
                        ? 'audio'
                        : ''
                if (requestedType && type !== requestedType) return false
                if (!type || (method !== 'omni_reference' && type !== 'image')) return false
                if (!supportedTypes.has(type) || counts[type] >= limits[type]) return false
                counts[type] += 1
                return true
            })
            .slice(0, totalRemaining)
        if (!files.length) {
            input.value = ''
            ElMessage.warning('所选素材类型或数量不受当前模型支持')
            return
        }
    }
    let firstFrameTaken = Boolean(firstFrameAttachment.value)
    let lastFrameTaken = Boolean(lastFrameAttachment.value)
    const nextItems = files.map((file) => {
        const type = file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('video/')
              ? 'video'
              : file.type.startsWith('audio/')
                ? 'audio'
              : 'file'
        let role =
            type === 'video'
                ? 'reference_video'
                : type === 'audio'
                  ? 'reference_audio'
                  : 'reference_image'
        if (composerMode.value === 'video' && videoGenerationMethod.value === 'start_end') {
            if (frameRole === 'first_frame_image' && !firstFrameTaken) {
                role = 'first_frame_image'
                firstFrameTaken = true
            } else if (frameRole === 'last_frame_image' && !lastFrameTaken) {
                role = 'last_frame_image'
                lastFrameTaken = true
            } else if (!firstFrameTaken) {
                role = 'first_frame_image'
                firstFrameTaken = true
            } else if (!lastFrameTaken) {
                role = 'last_frame_image'
                lastFrameTaken = true
            }
        }
        return {
            id: `${Date.now()}_${file.name}_${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type,
            url: URL.createObjectURL(file),
            previewUrl: '',
            status: type === 'file' ? 'failed' : 'uploading',
            error: type === 'file' ? '暂不支持该文件类型' : '',
            source: 'local_upload',
            role,
            generationMethod:
                composerMode.value === 'video' ? videoGenerationMethod.value : undefined
        } as UploadedAttachment
    })
    uploadedAttachments.value = [...uploadedAttachments.value, ...nextItems]
    input.value = ''
    await Promise.all(
        nextItems.map(async (item, index) => {
            const file = files[index]
            if (!file || item.type === 'file') return
            try {
                const response: any =
                    item.type === 'video'
                        ? await uploadAppVideo({ file })
                        : item.type === 'audio'
                          ? await uploadAppFile({ file })
                          : await uploadAppImage({ file })
                const remoteUrl = normalizeUploadedAssetUrl(response)
                if (!remoteUrl) throw new Error('上传接口没有返回文件地址')
                updateUploadedAttachment(item.id, {
                    remoteUrl,
                    status: 'success',
                    error: ''
                })
            } catch (error) {
                updateUploadedAttachment(item.id, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : '上传失败'
                })
                ElMessage.error(error instanceof Error ? error.message : '上传失败')
            }
        })
    )
}

function removeUploadedAttachment(id: string) {
    const target = uploadedAttachments.value.find((item) => item.id === id)
    if (target?.url?.startsWith('blob:')) URL.revokeObjectURL(target.url)
    if (target?.previewUrl?.startsWith('blob:') && target.previewUrl !== target.url) {
        URL.revokeObjectURL(target.previewUrl)
    }
    uploadedAttachments.value = uploadedAttachments.value.filter((item) => item.id !== id)
}

function updateUploadedAttachment(id: string, patch: Partial<UploadedAttachment>) {
    uploadedAttachments.value = uploadedAttachments.value.map((item) => {
        if (item.id !== id) return item
        if (patch.url && patch.url !== item.url && item.url?.startsWith('blob:')) {
            URL.revokeObjectURL(item.url)
        }
        return { ...item, ...patch }
    })
}

function addAttachments(items: Array<Partial<UploadedAttachment> & Record<string, any>>) {
    const requestedType = requestedVideoUploadType.value
    const frameRole = requestedFrameRole.value
    requestedVideoUploadType.value = ''
    requestedFrameRole.value = ''
    const normalized = items
        .map((item) => {
            const url = normalizeUploadedAssetUrl(item)
            if (!url) return null
            const type = normalizeAttachmentType(item, url)
            if (!['image', 'video', 'audio'].includes(type)) return null
            return {
                id: String(item.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`),
                name: String(item.name || item.title || (type === 'video' ? '参考视频' : '参考图')),
                type,
                url,
                remoteUrl: url,
                previewUrl: url,
                status: 'success',
                source: String(item.source || 'asset_library'),
                role: String(
                    item.role ||
                        (type === 'video'
                            ? 'reference_video'
                            : type === 'audio'
                              ? 'reference_audio'
                              : 'reference_image')
                ),
                generationMethod:
                    composerMode.value === 'video' ? videoGenerationMethod.value : undefined
            } as UploadedAttachment
        })
        .filter(Boolean) as UploadedAttachment[]
    if (!normalized.length) return
    const existed = new Set(uploadedAttachments.value.map((item) => item.remoteUrl || item.url))
    let candidates = normalized.filter((item) => !existed.has(item.remoteUrl || item.url))
    if (composerMode.value === 'video') {
        const method = videoGenerationMethod.value
        const channel = currentVideoChannel.value || {}
        const supportedTypes = new Set(
            Array.isArray(channel.supported_asset_types)
                ? channel.supported_asset_types.map(String)
                : ['image']
        )
        const existing = currentVideoMethodAttachments.value
        const counts: Record<'image' | 'video' | 'audio', number> = {
            image: existing.filter((item) => item.type === 'image').length,
            video: existing.filter((item) => item.type === 'video').length,
            audio: existing.filter((item) => item.type === 'audio').length
        }
        const limits: Record<'image' | 'video' | 'audio', number> = {
            image: Math.max(0, Number(channel.max_reference_images || 0)),
            video: Math.max(0, Number(channel.max_reference_videos || 0)),
            audio: Math.max(0, Number(channel.max_reference_audios || 0))
        }
        let firstTaken = Boolean(firstFrameAttachment.value)
        let lastTaken = Boolean(lastFrameAttachment.value)
        let remaining = Math.max(0, videoMethodAttachmentLimit() - existing.length)
        candidates = candidates.flatMap((item) => {
            const type = item.type as 'image' | 'video' | 'audio'
            if (
                remaining <= 0 ||
                (requestedType && type !== requestedType) ||
                !supportedTypes.has(type) ||
                (method !== 'omni_reference' && type !== 'image') ||
                counts[type] >= limits[type]
            ) {
                return []
            }
            let role = item.role
            if (method === 'start_end') {
                if (frameRole === 'first_frame_image' && !firstTaken) {
                    role = 'first_frame_image'
                    firstTaken = true
                } else if (frameRole === 'last_frame_image' && !lastTaken) {
                    role = 'last_frame_image'
                    lastTaken = true
                } else if (!firstTaken) {
                    role = 'first_frame_image'
                    firstTaken = true
                } else if (!lastTaken) {
                    role = 'last_frame_image'
                    lastTaken = true
                } else {
                    return []
                }
            } else if (type === 'image') {
                role = 'reference_image'
            }
            counts[type] += 1
            remaining -= 1
            return [{ ...item, role }]
        })
        if (normalized.length && !candidates.length) {
            ElMessage.warning('所选素材类型或数量不受当前模型支持')
        }
    }
    uploadedAttachments.value = [...uploadedAttachments.value, ...candidates]
}

function normalizeUploadedAssetUrl(payload: any): string {
    const source = payload?.data?.data || payload?.data || payload?.asset || payload
    const raw = String(
        typeof source === 'string'
            ? source
            : source?.url ||
                  source?.uri ||
                  source?.file_url ||
                  source?.image_url ||
                  source?.video_url ||
                  source?.preview_url ||
                  source?.cover_url ||
                  ''
    ).trim()
    if (!raw) return ''
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw
    const normalized = normalizeFileUrl(raw)
    const apiUrl = String(getApiUrl() || '').replace(/\/+$/, '')
    if (apiUrl && /^(\/uploads\/|\/storage\/|\/public\/|\/resource\/)/i.test(normalized)) {
        return `${apiUrl}${normalized}`
    }
    return normalized
}

function normalizeAttachmentType(item: Record<string, any>, url = ''): UploadedAttachment['type'] {
    const raw = String(item.type || item.asset_type || item.mime_type || '').toLowerCase()
    if (raw.includes('video') || /\.(mp4|webm|mov|m4v)(?:\?|$)/i.test(url)) return 'video'
    if (raw.includes('audio') || /\.(mp3|wav|m4a|aac|flac|ogg)(?:\?|$)/i.test(url)) return 'audio'
    if (raw.includes('image') || /\.(png|jpe?g|webp|gif|bmp)(?:\?|$)/i.test(url)) return 'image'
    return 'file'
}

function attachmentTypeLabel(type: UploadedAttachment['type']) {
    const map: Partial<Record<UploadedAttachment['type'], string>> = {
        image: '图',
        video: '视频',
        file: '文件'
    }
    return map[type] || (type === 'audio' ? '音频' : '文件')
}

function mediaModeLabel(mode?: MediaMode) {
    return mode === 'video' ? '视频' : '图像'
}

function mediaFailedContent(mode?: MediaMode, error?: string) {
    return error || `${mediaModeLabel(mode)}生成失败，请调整提示词或参数后重试。`
}

function mediaTaskMessageId(jobId: string) {
    return `media_assistant_${jobId}`
}

function legacyMediaAssistantId(jobId: string) {
    return `media_user_${jobId}`
}

function mediaTaskTitle(task: NonNullable<AgentMessage['media_task']>) {
    if (task.status === 'success') return `${mediaModeLabel(task.mode)}已生成`
    if (task.status === 'failed') return `${mediaModeLabel(task.mode)}生成失败`
    return `${mediaModeLabel(task.mode)}生成中`
}

function mediaTaskCardStyle(task: NonNullable<AgentMessage['media_task']>) {
    return {
        '--agent-media-task-ratio': normalizedRatioValue(
            task.ratio,
            task.mode === 'video' ? '16 / 9' : '1 / 1'
        )
    }
}

function applyMediaGenerationStatusToMessage(
    assistantMessage: AgentMessage,
    status: MediaGenerationStatus
) {
    const mode = status.mode || assistantMessage.media_task?.mode
    const nextStatus = status.status || 'running'
    const tool = assistantMessage.tool_calls?.[0]
    if (assistantMessage.media_task) {
        assistantMessage.media_task.status = nextStatus
        assistantMessage.media_task.nodeId = status.nodeId
        assistantMessage.media_task.error = status.error || ''
        if (status.ratio) assistantMessage.media_task.ratio = status.ratio
    }
    if (nextStatus === 'running') {
        if (assistantMessage.role === 'assistant') {
            assistantMessage.status = 'running'
            assistantMessage.content = ''
        }
        if (tool) tool.status = 'running'
        return
    }
    if (nextStatus === 'success') {
        if (assistantMessage.role === 'assistant') {
            assistantMessage.status = 'success'
            assistantMessage.content = ''
        }
        if (tool) tool.status = 'success'
        return
    }
    if (assistantMessage.role === 'assistant') {
        assistantMessage.status = 'failed'
        assistantMessage.content = mediaFailedContent(mode, status.error)
        assistantMessage.error = assistantMessage.content
    }
    if (tool) tool.status = 'failed'
}

function updateMediaGenerationMessage(status?: MediaGenerationStatus) {
    if (!status?.jobId || !status.status) return
    const localIds = [
        mediaTaskMessageId(String(status.jobId)),
        legacyMediaAssistantId(String(status.jobId))
    ]
    const assistantMessage = messages.value.find((message) =>
        localIds.includes(String(message.local_id || ''))
    )
    if (assistantMessage) {
        applyMediaGenerationStatusToMessage(assistantMessage, status)
        upsertCurrentThread()
        return
    }
    const recordIndex = threadRecords.value.findIndex((record) =>
        record.messages.some((message) => localIds.includes(String(message.local_id || '')))
    )
    if (recordIndex < 0) return
    const nextRecords = [...threadRecords.value]
    const record = {
        ...nextRecords[recordIndex],
        messages: cloneMessages(nextRecords[recordIndex].messages)
    }
    const targetMessage = record.messages.find((message) =>
        localIds.includes(String(message.local_id || ''))
    )
    if (!targetMessage) return
    applyMediaGenerationStatusToMessage(targetMessage, status)
    record.updatedAt = Date.now()
    nextRecords.splice(recordIndex, 1, record)
    threadRecords.value = nextRecords.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
    persistThreadRecords()
}

async function openSkillDetail(skill: LibSkill) {
    activeSkillDetail.value = skill
    if (!skill.skill_key) return
    try {
        const detail: any = await getCanvasSkillDetail({ skill_key: skill.skill_key })
        activeSkillDetail.value = normalizeRemoteSkill({
            ...skill,
            ...detail
        })
    } catch {
        activeSkillDetail.value = skill
    }
}

function closeModal() {
    activeSkillDetail.value = null
}

function displayOptionValueLabel(value: unknown, label?: string) {
    const rawValue = String(value ?? '').trim()
    const rawLabel = String(label || '').trim()
    const normalized = rawValue.toLowerCase()
    if (normalized === 'adaptive' && (!rawLabel || rawLabel.toLowerCase() === normalized)) return '自适应'
    if (normalized === 'original' && (!rawLabel || rawLabel.toLowerCase() === normalized)) return '原比例'
    return rawLabel || rawValue
}

function currentOption(key: string) {
    return mediaOptions.value.find((option) => option.key === key)
}

function currentOptionValue(key: string) {
    const option = currentOption(key)
    const raw = mediaConfig.value?.[key] ?? option?.defaultValue ?? option?.values[0]?.value
    return raw
}

function optionLabel(key: string) {
    const option = currentOption(key)
    if (!option) return ''
    const value = currentOptionValue(key)
    const matched = option.values.find((item) => String(item.value) === String(value))
    return value === undefined ? '' : displayOptionValueLabel(value, matched?.label)
}

function isMediaOptionActive(key: string, value: string | number) {
    return String(currentOptionValue(key)) === String(value)
}

function updateMediaOption(key: string, value: string | number) {
    emit('update-media-config', { mode: currentMediaMode.value, key, value })
    if (composerMode.value === 'video' && key === 'channel') {
        nextTick(ensureSupportedVideoMethod)
    }
}

function isVideoMethodSupported(method: VideoGenerationMethod) {
    return supportedVideoMethods.value.includes(method)
}

function ensureSupportedVideoMethod() {
    if (isVideoMethodSupported(videoGenerationMethod.value)) return
    const fallback = supportedVideoMethods.value[0]
    if (fallback) videoGenerationMethod.value = fallback
}

function selectVideoGenerationMethod(method: VideoGenerationMethod) {
    if (!isVideoMethodSupported(method)) return
    videoGenerationMethod.value = method
}

function selectVideoGenerationMethodFromEvent(event: Event) {
    const target = event.target as HTMLElement | null
    const button = target?.closest<HTMLButtonElement>('[data-video-method]')
    const method = button?.dataset.videoMethod as VideoGenerationMethod | undefined
    if (!method || button?.disabled) return
    selectVideoGenerationMethod(method)
}

function videoMethodAttachmentLimit() {
    const channel = currentVideoChannel.value || {}
    if (videoGenerationMethod.value === 'start_end') return 2
    if (videoGenerationMethod.value === 'multi_frame') {
        return Math.max(0, Number(channel.max_reference_images || 0))
    }
    const explicit = Number(channel.max_reference_assets || 0)
    return explicit > 0
        ? explicit
        : Math.max(0, Number(channel.max_reference_images || 0)) +
              Math.max(0, Number(channel.max_reference_videos || 0)) +
              Math.max(0, Number(channel.max_reference_audios || 0))
}

function canAddVideoReferenceType(type: 'image' | 'video' | 'audio') {
    const channel = currentVideoChannel.value || {}
    const supportedTypes = Array.isArray(channel.supported_asset_types)
        ? channel.supported_asset_types.map(String)
        : ['image']
    const limitKey =
        type === 'video'
            ? 'max_reference_videos'
            : type === 'audio'
              ? 'max_reference_audios'
              : 'max_reference_images'
    const typeCount = currentVideoMethodAttachments.value.filter((item) => item.type === type).length
    return (
        isVideoMethodSupported('omni_reference') &&
        supportedTypes.includes(type) &&
        typeCount < Math.max(0, Number(channel[limitKey] || 0)) &&
        currentVideoMethodAttachments.value.length < videoMethodAttachmentLimit()
    )
}

function swapStartEndFrames() {
    const first = firstFrameAttachment.value
    const last = lastFrameAttachment.value
    if (!first && !last) return
    uploadedAttachments.value = uploadedAttachments.value.map((item) => {
        if (item.id === first?.id) return { ...item, role: 'last_frame_image' }
        if (item.id === last?.id) return { ...item, role: 'first_frame_image' }
        return item
    })
}

function agentOptionValue(mode: MediaMode, key: string) {
    const options = mode === 'video' ? props.videoOptions || [] : props.imageOptions || []
    const config = agentMediaPayload.value[mode] || {}
    const option = options.find((item) => item.key === key)
    return config[key] ?? option?.defaultValue ?? option?.values?.[0]?.value
}

function buildAgentMediaPayload(mode: MediaMode) {
    const options = mode === 'video' ? props.videoOptions || [] : props.imageOptions || []
    const baseConfig = mode === 'video' ? props.videoConfig || {} : props.imageConfig || {}
    const storedConfig = agentMediaConfigs.value[mode] || {}
    const payload: Record<string, any> = {}
    options.forEach((option) => {
        const value =
            storedConfig[option.key] ??
            baseConfig[option.key] ??
            option.defaultValue ??
            option.values?.[0]?.value
        if (value !== undefined && value !== null && value !== '') {
            payload[option.key] = value
        }
    })
    return payload
}

function isAgentModelOptionActive(key: string, value: string | number) {
    return String(agentOptionValue(agentModelTab.value, key)) === String(value)
}

function updateAgentModelOption(key: string, value: string | number) {
    agentMediaConfigs.value = {
        ...agentMediaConfigs.value,
        [agentModelTab.value]: {
            ...(agentMediaConfigs.value[agentModelTab.value] || {}),
            [key]: value
        }
    }
}

function optionTitle(key: string) {
    const map: Record<string, string> = {
        mode: '模式',
        resolution: '清晰度',
        quality: composerMode.value === 'image' ? '质量' : '规格',
        ratio: '尺寸',
        duration: '时长',
        quantity: composerMode.value === 'image' ? 'Image' : '数量'
    }
    return map[key] || key
}

function ratioPreviewStyle(value: string | number) {
    const text = String(value || '')
    const match = text.match(/(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)/)
    if (!match) return {}
    const width = Number(match[1]) || 1
    const height = Number(match[2]) || 1
    const landscape = width >= height
    const longSide = 18
    const shortSide = Math.max(
        7,
        Math.round((Math.min(width, height) / Math.max(width, height)) * longSide)
    )
    return {
        width: `${landscape ? longSide : shortSide}px`,
        height: `${landscape ? shortSide : longSide}px`
    }
}

async function focusComposer() {
    await nextTick()
    composerRef.value?.focus()
}

const COMPOSER_MIN_TEXTAREA_HEIGHT = 62
const COMPOSER_MAX_HEIGHT = 320

async function resizeComposer() {
    await nextTick()
    if (typeof window === 'undefined') return
    const textarea = composerRef.value
    const composer = textarea?.closest<HTMLElement>('.agent-composer')
    if (!textarea || !composer) return

    textarea.style.height = 'auto'
    const contentHeight = textarea.scrollHeight
    const styles = window.getComputedStyle(composer)
    const paddingHeight =
        Number.parseFloat(styles.paddingTop || '0') +
        Number.parseFloat(styles.paddingBottom || '0')
    const borderHeight =
        Number.parseFloat(styles.borderTopWidth || '0') +
        Number.parseFloat(styles.borderBottomWidth || '0')
    const gap = Number.parseFloat(styles.rowGap || styles.gap || '0')
    const siblings = Array.from(composer.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement && element !== textarea
    )
    const visibleSiblings = siblings.filter((element) => element.offsetHeight > 0)
    const occupiedHeight =
        paddingHeight +
        borderHeight +
        visibleSiblings.reduce((height, element) => height + element.offsetHeight, 0) +
        visibleSiblings.length * gap
    const maxTextareaHeight = Math.max(
        COMPOSER_MIN_TEXTAREA_HEIGHT,
        COMPOSER_MAX_HEIGHT - occupiedHeight
    )
    const nextHeight = Math.min(
        Math.max(COMPOSER_MIN_TEXTAREA_HEIGHT, contentHeight),
        maxTextareaHeight
    )
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = contentHeight > maxTextareaHeight ? 'auto' : 'hidden'
}

watch(
    [collapsed, panelWidth, panelResizing],
    ([isCollapsed, width, resizing]) => {
        emit('layout-change', {
            collapsed: Boolean(isCollapsed),
            width: Number(width),
            resizing: Boolean(resizing)
        })
    },
    { immediate: true }
)

watch([draft, panelWidth], resizeComposer, { flush: 'post' })
watch(
    [composerMode, videoGenerationMethod, () => uploadedAttachments.value.length],
    resizeComposer,
    { flush: 'post' }
)

watch(
    () => props.projectId,
    async () => {
        activeLocalThreadId.value = ''
        threadId.value = ''
        threadTitle.value = '新的对话'
        messages.value = []
        loadAgentModelPreferences()
        loadThreadRecords()
        await syncServerThreadRecords()
    }
)

onMounted(async () => {
    loadPanelWidth()
    await resizeComposer()
    loadAgentModelPreferences()
    loadThreadRecords()
    await loadCanvasSkills()
    await syncServerThreadRecords()
    generationRecordTimer = setInterval(refreshGenerationActionRecords, 5000)
    void refreshGenerationActionRecords()
    document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
    finishPanelResize()
    activeStreamController?.abort()
    snapshotCurrentThread()
    if (generationRecordTimer) clearInterval(generationRecordTimer)
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    revokeAttachmentBlobUrls()
    clearUploadedAttachments()
})

defineExpose({
    addAttachments,
    setDraft(value: string) {
        draft.value = String(value || '')
        nextTick(() => {
            resizeComposer()
            focusComposer()
        })
    },
    submit: send
})

function notifyComingSoon(label: string) {
    ElMessage.info(`${label}能力正在接入`)
}

function normalizeRemoteSkill(row: any): LibSkill {
    const key = String(row?.skill_key || '')
    const type =
        row?.skill_type === 'workflow_template'
            ? 'workflow_template'
            : row?.skill_type === 'agent_workflow'
              ? 'agent_workflow'
              : 'agent_prompt'
    return {
        code:
            type === 'workflow_template'
                ? 'workflow_template'
                : type === 'agent_workflow'
                  ? 'agent_workflow'
                  : 'agent_prompt',
        title: String(row?.name || key || 'Skill'),
        prompt: key ? `/${key}` : '',
        desc: String(row?.description || row?.trigger_description || ''),
        icon: type === 'workflow_template' ? 'Wf' : type === 'agent_workflow' ? 'Ag' : 'Sk',
        skill_key: key,
        skill_type: type,
        skill_version: Number(row?.version || 1),
        source_type: String(row?.source_type || 'tenant'),
        category: String(row?.category || 'general'),
        content_markdown: String(row?.content_markdown || ''),
        workflow_json: row?.workflow_json || {}
    }
}

async function loadCanvasSkills() {
    skillLoading.value = true
    try {
        const rows: any = await getCanvasSkills({ limit: 80 })
        const list = Array.isArray(rows)
            ? rows
            : Array.isArray(rows?.lists)
              ? rows.lists
              : Array.isArray(rows?.data)
                ? rows.data
                : []
        remoteSkills.value = list.map((item: any) => normalizeRemoteSkill(item))
    } catch {
        remoteSkills.value = []
    } finally {
        skillLoading.value = false
    }
}

function emitDeferredComposerSubmit(content: string, attachments: UploadedAttachment[]) {
    emit('submit-composer', {
        draft: content,
        mode: composerMode.value,
        selectedSkill: selectedSkill.value,
        selectedSkillPrompt: selectedSkillPrompt.value,
        attachments,
        imageConfig: buildAgentMediaPayload('image'),
        videoConfig: buildAgentMediaPayload('video')
    })
}

async function send() {
    const content = draft.value.trim()
    if (!content || sending.value) return
    if (uploadedAttachments.value.some((item) => item.status === 'uploading')) {
        ElMessage.warning('附件上传中，请稍后再发送')
        return
    }
    const allAttachments = usableUploadedAttachments()
    const attachments =
        composerMode.value === 'video'
            ? allAttachments.filter(
                  (item) =>
                      !item.generationMethod ||
                      item.generationMethod === videoGenerationMethod.value
              )
            : allAttachments
    if (composerMode.value === 'agent' && generatingMedia.value) return
    if (composerMode.value !== 'agent') {
        if (composerMode.value === 'video') {
            if (!isVideoMethodSupported(videoGenerationMethod.value)) {
                ElMessage.warning('当前模型不支持所选视频生成模式')
                return
            }
            if (videoGenerationMethod.value === 'start_end' && attachments.length !== 2) {
                ElMessage.warning('首尾帧模式需要上传首帧和尾帧两张图片')
                return
            }
            if (videoGenerationMethod.value === 'multi_frame' && attachments.length < 2) {
                ElMessage.warning('智能多帧模式至少需要两张参考图')
                return
            }
            if (
                videoGenerationMethod.value === 'omni_reference' &&
                attachments.length > 0 &&
                !attachments.some((item) => item.type === 'image' || item.type === 'video')
            ) {
                ElMessage.warning('全能参考不能只上传音频，请同时添加图片或视频')
                return
            }
        }
        if (props.submitMode === 'defer') {
            emitDeferredComposerSubmit(content, attachments)
            return
        }
        const jobId = `${Date.now()}_${Math.random().toString(16).slice(2)}`
        const mode = currentMediaMode.value
        const userMessage: AgentMessage = {
            local_id: `media_prompt_${jobId}`,
            role: 'user',
            content,
            status: 'success',
            attachments,
            content_json: {
                attachments,
                uploaded_references: attachmentReferenceAssets(attachments),
                reference_images: attachments
                    .filter((item) => item.type === 'image')
                    .map((item) => item.remoteUrl || item.url),
                reference_assets: attachmentReferenceAssets(attachments)
            },
            tool_calls: [],
            workspace_actions: []
        }
        const assistantMessage: AgentMessage = {
            local_id: mediaTaskMessageId(jobId),
            role: 'assistant',
            content: '',
            status: 'running',
            media_task: {
                mode,
                status: 'running',
                model: currentMediaModelLabel.value || mediaModeLabel(mode),
                ratio: currentOptionValue('ratio'),
                params: mediaParamSummary.value || '默认参数'
            },
            tool_calls: [],
            workspace_actions: []
        }
        messages.value = [...messages.value, userMessage, assistantMessage]
        emit('generate-media', {
            jobId,
            mode,
            prompt: content,
            config: {
                ...mediaConfig.value,
                ...(composerMode.value === 'video'
                    ? { generation_method: videoGenerationMethod.value }
                    : {})
            },
            attachments
        })
        draft.value = ''
        clearUploadedAttachments()
        activePopover.value = ''
        await scrollToBottom()
        await focusComposer()
        return
    }
    if (props.submitMode === 'defer') {
        emitDeferredComposerSubmit(content, attachments)
        return
    }
    sending.value = true
    const userMessage: AgentMessage = {
        local_id: `user_${Date.now()}`,
        role: 'user',
        content,
        status: 'success',
        attachments,
        content_json: {
            attachments,
            uploaded_references: attachmentReferenceAssets(attachments),
            reference_images: attachments
                .filter((item) => item.type === 'image')
                .map((item) => item.remoteUrl || item.url),
            reference_assets: attachmentReferenceAssets(attachments)
        }
    }
    const assistantMessage = reactive<AgentMessage>({
        local_id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: '',
        status: 'running',
        content_json: { progress_stage: 'analyzing' },
        tool_calls: [],
        workspace_actions: []
    })
    messages.value = [...messages.value, userMessage, assistantMessage]
    activeAssistantMessage = assistantMessage
    draft.value = ''
    upsertCurrentThread()
    await scrollToBottom()
    try {
        const agentSkillCode = selectedSkill.value || 'agent_auto'
        const selectedDbSkill = allSkills.value.find(
            (skill) =>
                skill.skill_key &&
                (skill.skill_key === selectedSkillPrompt.value ||
                    `/${skill.skill_key}` === selectedSkillPrompt.value)
        )
        const payload = {
            request_id:
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : `agent_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            project_id: props.projectId,
            thread_id: threadId.value || undefined,
            content,
            skill_code: agentSkillCode,
            skill_key: selectedDbSkill?.skill_key || undefined,
            skill_type: selectedDbSkill?.skill_type || undefined,
            skill_version: selectedDbSkill?.skill_version || undefined,
            pending_skill_context: selectedDbSkill
                ? undefined
                : pendingSkillContext.value || undefined,
            conversation_cursor: messages.value.length
                ? messages.value[messages.value.length - 1]?.id || undefined
                : undefined,
            explicit_references: attachmentReferenceAssets(attachments),
            selected_delivery_ids: [],
            mode: composerMode.value,
            agent_media_config: agentMediaPayload.value,
            attachments,
            reference_assets: attachmentReferenceAssets(attachments),
            reference_images: attachments
                .filter((item) => item.type === 'image')
                .map((item) => item.remoteUrl || item.url),
            canvas_snapshot: canvasSnapshotWithAttachments(attachments)
        }
        activeRequestId = payload.request_id
        let hasDelta = false
        let hasFinalMessage = false
        let streamError = ''
        const streamController = new AbortController()
        activeStreamController = streamController
        let recoveryTimer: ReturnType<typeof setTimeout> | undefined
        let recoveryBusy = false
        const applyAgentResult = (result: any, animated = false) => {
            threadId.value = result?.thread?.id || result?.thread_id || threadId.value
            threadTitle.value = result?.thread?.title || threadTitle.value
            const assistant = result?.assistant_message || result?.message || {}
            const actions = normalizeActions(
                result?.workspace_actions || assistant?.content_json?.workspace_actions || []
            )
            const finalContent = String(assistant?.content || result?.content || '')
            Object.assign(assistantMessage, {
                id: assistant.id || assistantMessage.id,
                status: finalContent ? 'running' : assistant.status || 'success',
                content_json: assistant?.content_json || {
                    next_action: result?.next_action,
                    pending_skill_context: result?.pending_skill_context
                },
                tool_calls: result?.tool_calls || assistant?.content_json?.tool_calls || [],
                workspace_actions: actions
            })
            syncPendingSkillContext(result, assistant)
            if (finalContent) {
                if (animated) {
                    typeAssistantText(assistantMessage, finalContent)
                } else {
                    finishAssistantStream(assistantMessage, finalContent)
                }
            } else if (assistant.status) {
                assistantMessage.status = assistant.status
            }
            for (const action of actions) {
                if (isAutoAction(action)) {
                    applyAction(action)
                }
            }
            upsertCurrentThread()
        }
        function scheduleRunRecovery() {
            if (hasFinalMessage || streamError || streamController.signal.aborted) return
            recoveryTimer = setTimeout(recoverRun, 3000)
        }
        async function recoverRun() {
            if (hasFinalMessage || streamError || recoveryBusy || streamController.signal.aborted)
                return
            recoveryBusy = true
            try {
                const run: any = await getCanvasAgentRunStatus({ request_id: payload.request_id })
                if (streamController.signal.aborted) return
                if (run?.thread_id) threadId.value = run.thread_id
                if (run?.status === 'success' && run?.output) {
                    hasFinalMessage = true
                    applyAgentResult(run.output, !hasDelta)
                    streamController.abort()
                    return
                }
                if (run?.status === 'failed') {
                    streamError = String(run.error || 'Agent 执行失败')
                    streamController.abort()
                    return
                }
                assistantMessage.content_json = {
                    ...(assistantMessage.content_json || {}),
                    progress_stage: run?.run_id ? 'planning' : 'analyzing'
                }
            } catch {
                assistantMessage.content_json = {
                    ...(assistantMessage.content_json || {}),
                    progress_stage: 'recovering'
                }
            } finally {
                recoveryBusy = false
                scheduleRunRecovery()
            }
        }
        scheduleRunRecovery()
        await streamCanvasAgentChat(payload, {
            signal: streamController.signal,
            onEvent(event) {
                if (streamController.signal.aborted) return
                const data = event.data || {}
                if (event.event === 'agent.message.delta') {
                    const delta = String(data.delta || data.content || data.text || '')
                    if (appendAssistantDelta(assistantMessage, delta)) {
                        hasDelta = true
                        assistantMessage.id = data.message_id || assistantMessage.id
                        upsertCurrentThread()
                    }
                    return
                }
                if (event.event === 'agent.message.done') {
                    if (hasFinalMessage) return
                    hasFinalMessage = true
                    if (recoveryTimer) clearTimeout(recoveryTimer)
                    applyAgentResult(data, !hasDelta)
                    return
                }
                if (event.event === 'agent.route.resolved') {
                    assistantMessage.content_json = {
                        ...(assistantMessage.content_json || {}),
                        ...data
                    }
                    syncPendingSkillContext(data, assistantMessage)
                    return
                }
                if (event.event === 'agent.error') {
                    streamError = String(data.message || 'Agent 执行失败')
                    assistantMessage.status = 'failed'
                    assistantMessage.content = streamError
                    assistantMessage.error = streamError
                    upsertCurrentThread()
                    return
                }
                if (
                    event.event === 'agent.tool.started' ||
                    event.event === 'agent.tool.completed' ||
                    event.event === 'agent.task.updated'
                ) {
                    const tool = data.tool_code ? data : data.tool || data.call || {}
                    if (tool?.tool_code) {
                        const nextTools = [...(assistantMessage.tool_calls || [])]
                        const index = nextTools.findIndex(
                            (item) =>
                                String(item.id || item.tool_code) ===
                                String(tool.id || tool.tool_code)
                        )
                        if (index >= 0) nextTools.splice(index, 1, tool)
                        else nextTools.push(tool)
                        assistantMessage.tool_calls = nextTools
                    }
                    return
                }
                if (event.event === 'agent.workspace.action_pending') {
                    const action = data.action_type ? data : data.action || {}
                    if (action?.action_type) {
                        if (isAutoAction(action)) {
                            applyAction(action)
                        }
                        assistantMessage.workspace_actions = normalizeActions([
                            ...(assistantMessage.workspace_actions || []),
                            action
                        ])
                    }
                }
            },
            onError(error) {
                streamError = error.message || 'Agent 执行失败'
            }
        })
        if (recoveryTimer) clearTimeout(recoveryTimer)
        if (streamController.signal.aborted) return
        if (streamError && !hasFinalMessage) {
            throw new Error(streamError)
        }
        if (!hasFinalMessage) {
            const result: any = await sendCanvasAgentChatMessage(payload)
            applyAgentResult(result, !hasDelta)
        }
    } catch (error) {
        if (
            stoppedAssistantMessages.has(assistantMessage) ||
            (error instanceof DOMException && error.name === 'AbortError')
        ) {
            assistantMessage.status = 'canceled'
            upsertCurrentThread()
            return
        }
        assistantMessage.status = 'failed'
        assistantMessage.content = error instanceof Error ? error.message : 'Agent 执行失败'
        assistantMessage.error = assistantMessage.content
        upsertCurrentThread()
        ElMessage.error(assistantMessage.content)
    } finally {
        if (activeAssistantMessage === assistantMessage) {
            sending.value = false
            activeStreamController = null
            activeAssistantMessage = null
            activeRequestId = ''
            if (assistantMessage.status !== 'failed') clearUploadedAttachments()
        }
        await scrollToBottom()
    }
}

async function stopAgentResponse() {
    if (!sending.value) return
    activeStreamController?.abort()
    const assistant = activeAssistantMessage
    if (assistant) {
        stoppedAssistantMessages.add(assistant)
        assistant.status = 'canceled'
        assistant.content_json = {
            ...(assistant.content_json || {}),
            stopped: true,
            next_action: 'chat'
        }
        if (!assistant.content.trim()) {
            assistant.content = '已停止。发送“继续”可以从当前上下文继续。'
        }
        upsertCurrentThread()
    }
    sending.value = false
    try {
        await cancelCanvasAgentChat({
            message_id: assistant?.id || 0,
            request_id: activeRequestId,
            thread_id: threadId.value || undefined
        })
    } catch {
        // The local stream is already stopped; server cancellation is best effort.
    }
    await focusComposer()
}

async function confirmAgentExecution() {
    if (sending.value || !pendingSkillContext.value) return
    draft.value = '确认生成'
    await nextTick()
    await send()
}

function messageBatch(message: AgentMessage) {
    return message.content_json?.batch || {}
}

function messageBatchId(message: AgentMessage) {
    return Number(message.content_json?.batch_id || messageBatch(message)?.id || 0)
}

function initialBatchCount(message: AgentMessage) {
    const batch = messageBatch(message)
    return Math.min(5, Number(batch.total_count || message.content_json?.total_count || 0))
}

function nextBatchCount(message: AgentMessage) {
    const batch = messageBatch(message)
    return Math.max(0, Number(batch.next_batch_count || Math.min(5, batch.remaining_count || 0)))
}

function mergeBatchState(batch: any) {
    if (!batch?.id) return
    messages.value.forEach((message) => {
        if (messageBatchId(message) !== Number(batch.id)) return
        message.content_json = { ...(message.content_json || {}), batch }
        if (['running', 'running_all_remaining'].includes(String(batch.status || ''))) {
            message.content_json.next_action = 'execute_tool'
        }
    })
}

function appendServerAssistant(message: any) {
    if (!message?.id) return
    const normalized = normalizeServerMessage(message)
    const index = messages.value.findIndex((item) => Number(item.id || 0) === Number(normalized.id))
    if (index >= 0) messages.value.splice(index, 1, normalized)
    else messages.value.push(normalized)
}

async function executeAgentBatch(message: AgentMessage, action: 'initial' | 'next' | 'all_remaining') {
    const batchId = messageBatchId(message)
    if (sending.value || !batchId) return
    sending.value = true
    try {
        const result: any = await executeCanvasAgentBatch({
            batch_id: batchId,
            action,
            request_id:
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : `batch_${batchId}_${action}_${Date.now()}`
        })
        mergeBatchState(result?.batch)
        appendServerAssistant(result?.assistant_message)
        const actions = normalizeActions(result?.workspace_actions || [])
        actions.forEach((workspaceAction) => {
            if (isAutoAction(workspaceAction)) applyAction(workspaceAction)
        })
        pendingSkillContext.value = null
        upsertCurrentThread()
        await scrollToBottom()
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '批次生成提交失败')
    } finally {
        sending.value = false
    }
}

function usableUploadedAttachments(): UploadedAttachment[] {
    return uploadedAttachments.value
        .filter((item) => item.status !== 'failed')
        .map((item) => ({
            ...item,
            previewUrl: item.previewUrl || item.url,
            url: item.remoteUrl || item.url
        }))
        .filter((item) => item.url && !item.url.startsWith('blob:'))
}

function attachmentReferenceAssets(items: UploadedAttachment[]) {
    return items.map((item) => ({
        type: item.type,
        uri: item.remoteUrl || item.url,
        url: item.remoteUrl || item.url,
        name: item.name,
        role:
            item.role ||
            (item.type === 'video'
                ? 'reference_video'
                : item.type === 'audio'
                  ? 'reference_audio'
                  : 'reference_image'),
        generation_method: item.generationMethod
    }))
}

function normalizeMessageAttachments(items: any[]): UploadedAttachment[] {
    return Array.isArray(items)
        ? (items
              .map((item) => {
                  const previewUrl = String(item?.previewUrl || item?.url || item?.uri || '').trim()
                  const url = String(item?.remoteUrl || item?.url || item?.uri || '').trim()
                  if (!url) return null
                  const type = normalizeAttachmentType(item || {}, url)
                  if (!['image', 'video', 'audio'].includes(type)) return null
                  return {
                      id: String(item?.id || `${type}_${url}`),
                      name: String(
                          item?.name || item?.title || (type === 'video' ? '参考视频' : '参考图')
                      ),
                      type,
                      url: previewUrl || url,
                      remoteUrl: url,
                      previewUrl: previewUrl || url,
                      status: 'success',
                      source: String(item?.source || 'agent_history'),
                      role: String(item?.role || ''),
                      generationMethod: item?.generationMethod || item?.generation_method
                  } as UploadedAttachment
              })
              .filter(Boolean) as UploadedAttachment[])
        : []
}

function canvasSnapshotWithAttachments(items: UploadedAttachment[]) {
    if (!items.length) return props.canvasSnapshot
    const selected = Array.isArray(props.canvasSnapshot?.selected_elements)
        ? [...props.canvasSnapshot.selected_elements]
        : []
    const attached = items.map((item) => ({
        id: item.id,
        node_id: item.id,
        type: item.type,
        source: item.source || 'agent_upload',
        title: item.name,
        name: item.name,
        url: item.remoteUrl || item.url,
        role:
            item.role ||
            (item.type === 'video'
                ? 'reference_video'
                : item.type === 'audio'
                  ? 'reference_audio'
                  : 'reference_image')
    }))
    return {
        ...props.canvasSnapshot,
        selected_elements: [...selected, ...attached]
    }
}

function clearUploadedAttachments() {
    uploadedAttachments.value = []
}

function revokeAttachmentBlobUrls() {
    const urls = new Set<string>()
    uploadedAttachments.value.forEach((item) => {
        if (item.url?.startsWith('blob:')) urls.add(item.url)
        if (item.previewUrl?.startsWith('blob:')) urls.add(item.previewUrl)
    })
    messages.value.forEach((message) => {
        message.attachments?.forEach((item) => {
            if (item.url?.startsWith('blob:')) urls.add(item.url)
            if (item.previewUrl?.startsWith('blob:')) urls.add(item.previewUrl)
        })
    })
    urls.forEach((url) => URL.revokeObjectURL(url))
}

function normalizeActions(actions: any[]) {
    return Array.isArray(actions)
        ? actions.map((action) => ({ ...action, status: action.status || 'pending' }))
        : []
}

function actionMediaUrl(action: any) {
    const asset = action?.input?.asset || {}
    return String(
        asset.url ||
            asset.image_url ||
            asset.video_url ||
            asset.audio_url ||
            asset.image ||
            asset.video ||
            asset.file_url ||
            asset.output_url ||
            ''
    ).trim()
}

function actionPosterUrl(action: any) {
    const asset = action?.input?.asset || {}
    return String(asset.poster || asset.cover_url || asset.cover || asset.thumbnail || '').trim()
}

function actionTaskId(action: any) {
    const asset = action?.input?.asset || {}
    return String(asset.task_id || asset.taskId || '').trim()
}

function generationResultUrl(payload: any, keys: string[], depth = 0): string {
    if (!payload || depth > 4) return ''
    if (typeof payload === 'string') return payload.trim()
    if (Array.isArray(payload)) {
        for (const item of payload) {
            const url = generationResultUrl(item, keys, depth + 1)
            if (url) return url
        }
        return ''
    }
    if (typeof payload !== 'object') return ''
    for (const key of keys) {
        const value = payload[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    for (const value of Object.values(payload)) {
        if (value && typeof value === 'object') {
            const url = generationResultUrl(value, keys, depth + 1)
            if (url) return url
        }
    }
    return ''
}

async function refreshGenerationActionRecords() {
    if (generationRecordPolling.value) return
    const candidates = new Map<string, any>()
    const batchIds = new Set<number>()
    const collect = (source: AgentMessage[]) => {
        source.forEach((message) => {
            const batch = messageBatch(message)
            if (
                batch?.id &&
                ['running', 'running_all_remaining'].includes(String(batch.status || ''))
            ) {
                batchIds.add(Number(batch.id))
            }
            generationActionRecords(message.workspace_actions).forEach((action) => {
                const taskId = actionTaskId(action)
                const type = assetType(action)
                if (!taskId || actionMediaUrl(action) || String(action?.status || '') === 'failed')
                    return
                if (!['image', 'video'].includes(type)) return
                candidates.set(`${type}:${taskId}`, action)
            })
        })
    }
    collect(messages.value)
    threadRecords.value.forEach((record) => collect(record.messages))
    if (!candidates.size && !batchIds.size) return

    generationRecordPolling.value = true
    try {
        for (const action of candidates.values()) {
            const taskId = actionTaskId(action)
            const type = assetType(action)
            try {
                const detail: any =
                    type === 'video' ? await proxyVideoQuery(taskId) : await proxyImageQuery(taskId)
                const url = generationResultUrl(
                    detail,
                    type === 'video'
                        ? ['url', 'video_url', 'video', 'file_url']
                        : ['url', 'image_url', 'image', 'file_url']
                )
                if (url) {
                    updateGenerationActionsFromStatus({
                        actionId: action?.id,
                        taskId,
                        type: type as 'image' | 'video',
                        status: 'success',
                        url,
                        poster: generationResultUrl(detail, ['poster', 'cover_url', 'cover', 'thumbnail']),
                        ratio: action?.input?.asset?.ratio
                    })
                    continue
                }
                const status = String(detail?.status || detail?.state || '').toLowerCase()
                if (status.includes('fail') || status.includes('error') || status.includes('cancel')) {
                    updateGenerationActionsFromStatus({
                        actionId: action?.id,
                        taskId,
                        type: type as 'image' | 'video',
                        status: 'failed',
                        error: String(detail?.error || detail?.msg || '生成失败')
                    })
                }
            } catch {
                // Keep the conversation record running and retry on the next interval.
            }
        }
        for (const batchId of batchIds) {
            try {
                const result: any = await getCanvasAgentBatchStatus({ batch_id: batchId })
                mergeBatchState(result?.batch)
                appendServerAssistant(result?.assistant_message)
            } catch {
                // Batch status is retried on the next polling interval.
            }
        }
        upsertCurrentThread()
    } finally {
        generationRecordPolling.value = false
    }
}

function normalizedActionRatio(action: any) {
    const asset = action?.input?.asset || {}
    const config = action?.input?.config || action?.input?.params || {}
    const fallback = assetType(action) === 'video' ? '16 / 9' : '1 / 1'
    const dimensionsRatio = normalizedRatioValue(
        asset.width && asset.height ? `${asset.width}:${asset.height}` : '',
        ''
    )
    if (dimensionsRatio) return dimensionsRatio
    const configDimensionsRatio = normalizedRatioValue(
        config.width && config.height ? `${config.width}:${config.height}` : '',
        ''
    )
    if (configDimensionsRatio) return configDimensionsRatio
    return normalizedRatioValue(asset.ratio || config.ratio || config.size, fallback)
}

function normalizedRatioValue(value: string | number | undefined, fallback = '1 / 1') {
    const ratio = String(value || '').trim()
    const dimensions = ratio.match(/^(\d+(?:\.\d+)?)\s*[:xX]\s*(\d+(?:\.\d+)?)$/)
    if (dimensions) {
        const width = Number(dimensions[1])
        const height = Number(dimensions[2])
        if (width > 0 && height > 0) return `${width} / ${height}`
    }
    return fallback
}

function generationCardStyle(action: any) {
    return {
        '--agent-generation-ratio': normalizedActionRatio(action)
    }
}

function updateActionAsset(action: any, status: MediaGenerationStatus) {
    const asset = action.input?.asset || {}
    action.input = { ...(action.input || {}), asset: { ...asset } }
    if (status.url) {
        action.input.asset.url = status.url
        if ((status.type || assetType(action)) === 'image') {
            action.input.asset.image_url = status.url
        }
        if ((status.type || assetType(action)) === 'video') {
            action.input.asset.video_url = status.url
        }
        if ((status.type || assetType(action)) === 'audio') {
            action.input.asset.audio_url = status.url
        }
    }
    if (status.poster) action.input.asset.cover_url = status.poster
    if (status.ratio) action.input.asset.ratio = status.ratio
    if (status.taskId) action.input.asset.task_id = status.taskId
    if (status.status === 'success' && status.url) action.status = 'applied'
    if (status.status === 'failed') {
        action.status = 'failed'
        action.error = status.error || action.error || ''
    }
}

function statusMatchesAction(action: any, status: MediaGenerationStatus) {
    const actionId = String(action?.id || '')
    const statusActionId = String(status.actionId || '')
    if (actionId && statusActionId && actionId === statusActionId) return true
    const taskId = actionTaskId(action)
    const statusTaskId = String(status.taskId || '')
    if (taskId && statusTaskId && taskId === statusTaskId) return true
    return false
}

function updateGenerationActionsFromStatus(status?: MediaGenerationStatus) {
    if (!status || (!status.actionId && !status.taskId)) return
    let changed = false
    messages.value.forEach((message) => {
        ;(message.workspace_actions || []).forEach((action) => {
            if (statusMatchesAction(action, status)) {
                updateActionAsset(action, status)
                changed = true
            }
        })
    })
    threadRecords.value.forEach((record) => {
        record.messages.forEach((message) => {
            ;(message.workspace_actions || []).forEach((action) => {
                if (statusMatchesAction(action, status)) {
                    updateActionAsset(action, status)
                    changed = true
                }
            })
        })
    })
    if (changed) upsertCurrentThread()
}

function reconcileGenerationActionsFromCanvas() {
    const results = Array.isArray(props.canvasSnapshot?.agent_generation_results)
        ? props.canvasSnapshot.agent_generation_results
        : []
    results.forEach((result: any) => {
        const status = String(result?.status || '')
        if (!['running', 'success', 'failed'].includes(status)) return
        updateGenerationActionsFromStatus({
            actionId: result.actionId,
            taskId: result.taskId,
            nodeId: result.nodeId,
            type: result.type,
            status: status as MediaGenerationStatus['status'],
            url: result.url,
            poster: result.poster,
            ratio: result.ratio
        })
    })
}

function isAutoAction(action: any) {
    const actionType = String(action?.action_type || '')
    if (actionType === 'apply_json_canvas') return true
    if (actionType === 'insert_workflow') return true
    return ['insert_image', 'insert_video', 'insert_audio'].includes(actionType)
}

function visibleWorkspaceActions(actions?: any[]) {
    return Array.isArray(actions) ? actions.filter((action) => !isAutoAction(action)) : []
}

function generationActionRecords(actions?: any[]) {
    return Array.isArray(actions) ? actions.filter((action) => isAutoAction(action)) : []
}

function applyAction(action: any) {
    if (!action || action.status === 'applying' || action.status === 'applied') return
    const key = actionApplyKey(action)
    if (key && appliedActionKeys.has(key)) {
        action.status = 'applied'
        return
    }
    if (key) appliedActionKeys.add(key)
    action.status = 'applying'
    emit('apply-action', action)
    action.status = 'applied'
}

function actionApplyKey(action: any) {
    const id = String(action?.id || '')
    if (id) return `id:${id}`
    const parts = [
        action?.action_type || '',
        action?.tool_call_id || '',
        action?.input?.asset?.task_id || '',
        action?.input?.asset?.url || '',
        action?.input?.prompt || ''
    ]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    return parts.length ? parts.join('|') : ''
}

function assetType(action: any) {
    const type = String(action?.input?.asset?.type || action?.action_type || '')
    if (type.includes('json_canvas') || type.includes('canvas')) return 'canvas'
    if (type.includes('workflow')) return 'workflow'
    if (type.includes('video')) return 'video'
    if (type.includes('audio')) return 'audio'
    return 'image'
}

function actionTitle(action: any) {
    if (assetType(action) === 'canvas') {
        return '设计画布结构'
    }
    if (assetType(action) === 'workflow') {
        return action?.input?.skill?.name || 'Agent 工作流'
    }
    const asset = action?.input?.asset || {}
    return (
        asset.title ||
        (assetType(action) === 'video'
            ? 'Agent 视频'
            : assetType(action) === 'audio'
              ? 'Agent 音频'
              : 'Agent 图片')
    )
}
function generationStatusText(action: any) {
    const status = String(action?.status || 'pending')
    if (actionIsGenerating(action)) return '生成中'
    if (status === 'applied') {
        return assetType(action) === 'canvas' ? '已插入画布' : '已添加到画布'
    }
    if (status === 'failed') return '生成失败'
    if (status === 'applying') return '正在插入画布'
    return '准备中'
}

function actionIsGenerating(action: any) {
    const asset = action?.input?.asset || {}
    return Boolean((asset.task_id || asset.taskId) && !actionMediaUrl(action))
}

function openGenerationPreview(action: any) {
    const url = actionMediaUrl(action)
    const type = assetType(action)
    if (!url || actionIsGenerating(action) || String(action?.status || '') === 'failed') return
    if (!['image', 'video', 'audio'].includes(type)) return
    emit('preview-media', {
        type: type as 'image' | 'video' | 'audio',
        url,
        poster: actionPosterUrl(action),
        title: actionTitle(action)
    })
}

function normalizedGenerationDownloadUrl(value: unknown) {
    const raw = String(value || '').trim()
    if (!raw) return ''
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw
    }
    const normalized = normalizeFileUrl(raw.replace(/\\/g, '/'))
    const apiUrl = String(getApiUrl() || '').replace(/\/+$/, '')
    if (apiUrl && /^(\/uploads\/|\/storage\/|\/public\/|\/resource\/)/i.test(normalized)) {
        return `${apiUrl}${normalized}`
    }
    return normalized
}

function generationDownloadExtension(type: string, url: string, mimeType = '') {
    const mimeExtensions: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov'
    }
    const normalizedMime = mimeType.split(';')[0].trim().toLowerCase()
    if (mimeExtensions[normalizedMime]) return mimeExtensions[normalizedMime]
    const matched = url.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i)
    if (matched?.[1]) return matched[1].toLowerCase()
    return type === 'video' ? 'mp4' : 'png'
}

function triggerGenerationDownload(url: string, fileName: string) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
}

async function downloadGenerationMedia(action: any) {
    const type = assetType(action)
    const url = normalizedGenerationDownloadUrl(actionMediaUrl(action))
    if (!url || !['image', 'video'].includes(type)) {
        ElMessage.warning('当前生成结果不可下载')
        return
    }
    try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        const extension = generationDownloadExtension(type, url, blob.type)
        const objectUrl = URL.createObjectURL(blob)
        triggerGenerationDownload(objectUrl, `agent-${type}-${Date.now()}.${extension}`)
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
        const extension = generationDownloadExtension(type, url)
        triggerGenerationDownload(url, `agent-${type}-${Date.now()}.${extension}`)
    }
}

async function copyMessageText(message: AgentMessage) {
    const text = String(message.content || '').trim()
    if (!text) return
    try {
        await navigator.clipboard?.writeText(text)
        ElMessage.success('已复制')
    } catch {
        ElMessage.warning('复制失败，请手动选择文本复制')
    }
}

async function scrollToBottom() {
    await nextTick()
    const list = messageListRef.value
    if (list) list.scrollTop = list.scrollHeight
}
</script>

<style scoped>
.canvas-agent-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 15100;
    display: flex;
    flex-direction: column;
    width: 400px;
    border-left: 0;
    background: #141414;
    color: #fff;
    backdrop-filter: blur(20px);
}

.agent-resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -5px;
    z-index: 20;
    width: 10px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: ew-resize;
    touch-action: none;
}

.agent-resize-handle::after {
    position: absolute;
    top: 50%;
    left: 4px;
    width: 2px;
    height: 48px;
    border-radius: 2px;
    background: transparent;
    content: '';
    opacity: 0;
    transform: translateY(-50%);
    transition: opacity 0.16s ease;
}

.agent-resize-handle:hover::after,
.canvas-agent-panel.is-resizing .agent-resize-handle::after {
    opacity: 1;
}

.canvas-agent-panel.collapsed {
    top: auto;
    right: 16px;
    bottom: 8px;
    width: 46px;
    height: 46px;
    overflow: visible;
    border: 0;
    background: transparent;
}

.agent-float-trigger {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border: 0;
    border-radius: 14px;
    background: #fff;
    color: #111;
    font-weight: 800;
    cursor: pointer;
}

.agent-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
    padding: 12px 12px 10px 18px;
    border-bottom: 0;
}

.agent-title {
    display: grid;
    gap: 3px;
    min-width: 0;
}

.agent-title strong {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
}

.agent-title span {
    overflow: hidden;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.agent-header-actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 6px;
}

.agent-header-actions button,
.agent-toolbar-left button,
.agent-action-card button {
    border: 0;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    cursor: pointer;
}

.agent-header-actions button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-size: 18px;
    line-height: 1;
}

.agent-header-actions button .el-icon,
.agent-header-actions button .el-icon svg {
    width: 18px;
    height: 18px;
}

.agent-header-actions button.disabled {
    color: rgba(255, 255, 255, 0.34);
}

.agent-header-actions button:hover,
.agent-toolbar-left button:hover,
.agent-toolbar-left button.active {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
}

.canvas-agent-panel.is-embedded-composer {
    position: relative;
    top: auto;
    right: auto;
    bottom: auto;
    z-index: 15100;
    display: block;
    width: 100%;
    height: auto;
    min-width: 0;
    max-width: none;
    border-left: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
}

.canvas-agent-panel.is-embedded-composer .agent-header,
.canvas-agent-panel.is-embedded-composer .agent-messages {
    display: none;
}

.canvas-agent-panel.is-embedded-composer .agent-composer-shell {
    padding: 0;
}

.canvas-agent-panel.is-embedded-composer .agent-composer {
    min-height: 126px;
    box-shadow: 0 22px 60px rgba(0, 0, 0, 0.4);
}

.canvas-agent-panel.is-embedded-composer .agent-skill-browser {
    position: absolute;
    left: 0;
    right: auto;
    bottom: calc(100% + 12px);
    top: auto;
    width: min(520px, 100%);
    max-height: min(520px, 72vh);
    border-radius: 16px;
}

.agent-popover {
    position: fixed;
    z-index: 15120;
    display: grid;
    box-sizing: border-box;
    gap: 6px;
    min-width: 190px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    background: rgba(30, 30, 30, 0.98);
    color: #fff;
    backdrop-filter: blur(18px);
}

.agent-popover strong {
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    font-weight: 700;
}

.agent-popover > strong {
    padding: 3px 6px 5px;
}

.agent-popover button {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 34px;
    padding: 7px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    text-align: left;
    cursor: pointer;
}

.agent-popover button:hover,
.agent-popover button.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.agent-popover button:disabled {
    cursor: default;
    opacity: 0.5;
}

.agent-popover button span,
.agent-popover button em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.agent-popover button span {
    font-size: 12px;
    font-weight: 600;
}

.agent-popover button em {
    color: rgba(255, 255, 255, 0.44);
    font-style: normal;
    font-size: 11px;
}

.agent-popover-header {
    top: 48px;
    right: 14px;
}

.agent-history-popover {
    width: 210px;
    min-width: 210px;
}

.agent-history-empty {
    padding: 12px 8px;
    color: rgba(255, 255, 255, 0.42);
    text-align: center;
    font-size: 12px;
}

.agent-history-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 26px;
    align-items: center;
    gap: 4px;
    border-radius: 8px;
}

.agent-history-row.active {
    background: rgba(255, 255, 255, 0.08);
}

.agent-popover .agent-history-row > button {
    min-height: 34px;
}

.agent-popover .agent-history-row > button:first-child {
    min-width: 0;
}

.agent-popover .agent-history-delete {
    display: grid;
    place-items: center;
    width: 26px;
    min-height: 26px;
    padding: 0;
    color: rgba(255, 255, 255, 0.42);
}

.agent-popover .agent-history-delete:hover {
    background: rgba(251, 113, 133, 0.16);
    color: #fb7185;
}

.agent-history-new {
    margin-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 0 0 8px 8px !important;
    color: rgba(255, 255, 255, 0.72) !important;
}

.agent-messages {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 0;
    padding: 18px 16px 12px;
    overflow: auto;
}

.agent-empty-mode {
    display: grid;
    place-items: center;
    gap: 9px;
    margin: auto 0;
    color: rgba(255, 255, 255, 0.62);
    text-align: center;
}

.agent-empty-mode > span {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.78);
}

.agent-empty-mode strong {
    color: #fff;
    font-size: 15px;
}

.agent-empty-mode p {
    max-width: 260px;
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
}

.agent-message {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 7px;
    width: 100%;
    min-width: 0;
    margin-bottom: 16px;
}

.agent-message.is-user {
    justify-items: end;
    padding-bottom: 11px;
}

.agent-message.is-assistant {
    justify-items: start;
}

.agent-message-bubble {
    min-width: 0;
    max-width: 92%;
    padding: 13px 12px;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.86);
}

.agent-message.is-user .agent-message-bubble {
    justify-self: end;
    width: fit-content;
    border: 0;
    background: rgba(255, 255, 255, 0.09);
    box-shadow: none;
    color: #fff;
}

.agent-message.is-user .agent-message-bubble.is-collapsible {
    width: 92%;
}

.agent-message.is-user .agent-message-bubble.is-collapsible .agent-message-content {
    position: relative;
    max-height: 320px;
    overflow: hidden;
    mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 54px), transparent 100%);
}

.agent-message.is-user .agent-message-bubble.is-collapsible.is-expanded .agent-message-content {
    max-height: none;
    mask-image: none;
}

.agent-message-expand {
    display: block;
    margin: 8px auto 0;
    padding: 4px 10px;
    border: 0;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    cursor: pointer;
}

.agent-message-expand:hover {
    background: rgba(255, 255, 255, 0.13);
    color: #fff;
}

.agent-message.is-assistant .agent-message-bubble {
    justify-self: stretch;
    width: 100%;
    max-width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
}

.agent-message.status-running.is-assistant .agent-message-bubble {
    border-color: transparent;
}

.agent-message-content {
    width: 100%;
    min-width: 0;
    font-size: 13px;
    line-height: 1.78;
    overflow-wrap: anywhere;
    word-break: break-word;
    user-select: text;
    -webkit-user-select: text;
}

.agent-message.status-running.is-assistant .agent-message-content::after {
    display: inline-block;
    width: 7px;
    height: 1em;
    margin-left: 2px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    content: '';
    vertical-align: -0.14em;
    animation: agent-stream-caret 0.95s steps(2, start) infinite;
}

.agent-message-copy {
    position: absolute;
    right: 6px;
    bottom: -14px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    opacity: 0;
    pointer-events: none;
    transition:
        opacity 0.16s ease,
        background 0.16s ease;
    cursor: pointer;
}

.agent-confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-start;
    margin-top: 8px;
}

.agent-confirm-actions button.is-secondary {
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.agent-confirm-actions button.is-initial-batch {
    font-size: 0;
}

.agent-confirm-actions button.is-initial-batch span {
    font-size: 13px;
}

.agent-confirm-actions button {
    min-height: 32px;
    padding: 0 14px;
    border: 0;
    border-radius: 6px;
    background: #fff;
    color: #111;
    font-size: 13px;
    cursor: pointer;
}

.agent-confirm-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.agent-message.is-user:hover .agent-message-copy {
    opacity: 1;
    pointer-events: auto;
}

.agent-message-copy:hover {
    background: transparent;
}

.agent-message-copy img {
    display: block;
    width: 16px;
    height: 16px;
    object-fit: contain;
    filter: brightness(0) invert(1);
    opacity: 0.9;
}

.agent-message-content p {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.agent-message-content p + p,
.agent-message-content ul + p,
.agent-message-content p + ul {
    margin-top: 12px;
}

.agent-message-content ul {
    display: grid;
    gap: 8px;
    margin: 10px 0 0;
    padding-left: 18px;
}

.agent-message-content li {
    padding-left: 2px;
}

.agent-message-content strong,
.agent-message-content .agent-message-heading {
    color: rgba(255, 255, 255, 0.94);
    font-weight: 700;
}

.agent-message-content code {
    padding: 1px 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 12px;
}

.agent-message-bubble small {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
}

.agent-message.status-running .agent-message-bubble small::before {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.74);
    content: '';
    animation: agent-status-pulse 1s ease-in-out infinite;
}

.agent-message.status-failed .agent-message-bubble {
    border-color: rgba(251, 113, 133, 0.36);
}

.agent-message.status-failed.is-assistant .agent-message-bubble {
    border-color: transparent;
}

.agent-message.status-failed .agent-message-bubble small {
    color: #fb7185;
}

.agent-media-task-card {
    position: relative;
    width: 92px;
    height: auto;
    aspect-ratio: var(--agent-media-task-ratio, 1 / 1);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.16), transparent 28%),
        linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.035));
}

.agent-media-task-card.is-running {
    border-color: rgba(255, 255, 255, 0.18);
}

.agent-media-task-card.is-failed {
    border-color: rgba(251, 113, 133, 0.34);
}

.agent-media-task-card.is-video {
    width: min(168px, 72%);
    height: auto;
    aspect-ratio: var(--agent-media-task-ratio, 16 / 9);
}

.agent-media-task-placeholder {
    position: absolute;
    inset: 0;
    background: linear-gradient(
            100deg,
            transparent 28%,
            rgba(255, 255, 255, 0.18) 48%,
            transparent 68%
        ),
        linear-gradient(135deg, rgba(58, 86, 115, 0.42), rgba(23, 24, 26, 0.7));
    background-size:
        220% 100%,
        100% 100%;
    animation: agent-task-skeleton 1.35s ease-in-out infinite;
}

.agent-media-task-card.is-success .agent-media-task-placeholder {
    animation: none;
    background: linear-gradient(135deg, rgba(77, 119, 94, 0.5), rgba(24, 28, 25, 0.72));
}

.agent-media-task-card.is-failed .agent-media-task-placeholder {
    animation: none;
    background: linear-gradient(135deg, rgba(108, 45, 55, 0.5), rgba(28, 22, 24, 0.72));
}

.agent-generation-list {
    display: grid;
    gap: 8px;
    margin-top: 10px;
}

.agent-generation-card {
    display: grid;
    gap: 8px;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: transparent;
}

.agent-generation-card.has-result {
    cursor: zoom-in;
}

.agent-generation-card.has-result:hover {
    background: transparent;
}

.agent-generation-card.has-result .agent-generation-preview {
    width: fit-content;
    max-width: 100%;
    min-height: 0;
    aspect-ratio: auto;
    max-height: none;
    background: transparent;
}

.agent-generation-card.is-canvas,
.agent-generation-card.is-workflow,
.agent-generation-card.is-audio {
    grid-template-columns: 46px minmax(0, 1fr);
    align-items: center;
    min-height: 58px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.035);
}

.agent-generation-preview {
    position: relative;
    width: 100%;
    min-height: 168px;
    overflow: hidden;
    aspect-ratio: var(--agent-generation-ratio, 1 / 1);
    max-height: 360px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(58, 86, 115, 0.38), rgba(23, 24, 26, 0.74));
}

.agent-generation-card.is-canvas .agent-generation-preview,
.agent-generation-card.is-workflow .agent-generation-preview,
.agent-generation-card.is-audio .agent-generation-preview {
    width: 46px;
    height: 46px;
    min-height: 46px;
    aspect-ratio: 1 / 1;
}

.agent-generation-preview::before {
    position: absolute;
    inset: 0;
    content: '';
    background: linear-gradient(
        100deg,
        transparent 28%,
        rgba(255, 255, 255, 0.18) 48%,
        transparent 68%
    );
    background-size: 220% 100%;
    animation: agent-task-skeleton 1.35s ease-in-out infinite;
}

.agent-generation-card.status-applied:not(.is-generating) .agent-generation-preview::before,
.agent-generation-card.status-failed .agent-generation-preview::before {
    animation: none;
    opacity: 0;
}

.agent-generation-preview img,
.agent-generation-preview video {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.agent-generation-card.has-result .agent-generation-preview > img,
.agent-generation-card.has-result .agent-generation-preview > video {
    position: static;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 260px;
    object-fit: contain;
}

.agent-generation-download {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    background: rgba(20, 20, 20, 0.82);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
    cursor: pointer;
    opacity: 0;
    transform: translateY(4px);
    transition:
        opacity 0.16s ease,
        transform 0.16s ease,
        background 0.16s ease;
    backdrop-filter: blur(8px);
}

.agent-generation-download img {
    position: static;
    width: 16px;
    height: 16px;
    object-fit: contain;
}

.agent-generation-preview:hover .agent-generation-download,
.agent-generation-download:focus-visible {
    opacity: 1;
    transform: translateY(0);
}

.agent-generation-download:hover {
    background: rgba(42, 42, 42, 0.94);
}

.agent-generation-preview.is-canvas span::after {
    position: absolute;
    inset: 11px 9px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 3px;
    content: '';
}

.agent-generation-preview span {
    position: absolute;
    inset: 0;
    display: block;
}

.agent-generation-main {
    display: grid;
    min-width: 0;
    gap: 4px;
}

.agent-generation-main strong {
    overflow: hidden;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.agent-generation-main small {
    color: rgba(255, 255, 255, 0.48);
    font-size: 12px;
}

@keyframes agent-status-pulse {
    0%,
    100% {
        opacity: 0.35;
        transform: scale(0.8);
    }

    50% {
        opacity: 1;
        transform: scale(1);
    }
}

@keyframes agent-task-skeleton {
    0%,
    100% {
        background-position:
            180% 0,
            0 0;
    }

    50% {
        background-position:
            -40% 0,
            0 0;
    }
}

@keyframes agent-stream-caret {
    0%,
    45% {
        opacity: 1;
    }

    46%,
    100% {
        opacity: 0;
    }
}

.agent-action-list {
    display: grid;
    gap: 8px;
}

.agent-action-card {
    display: grid;
    grid-template-columns: 58px 1fr 58px;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.045);
}

.agent-action-preview {
    display: grid;
    place-items: center;
    width: 58px;
    height: 48px;
    overflow: hidden;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.66);
    font-size: 11px;
}

.agent-action-preview img,
.agent-action-preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.agent-action-main {
    display: grid;
    gap: 5px;
    min-width: 0;
}

.agent-action-main strong,
.agent-action-main small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.agent-action-main strong {
    font-size: 12px;
}

.agent-action-main small {
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
}

.agent-action-card button {
    height: 30px;
    border-radius: 8px;
    font-size: 12px;
}

.agent-action-card button:disabled {
    cursor: default;
    opacity: 0.55;
}

.agent-composer-shell {
    position: relative;
    z-index: 90;
    padding: 0 10px 12px;
}

.agent-composer {
    position: relative;
    display: grid;
    gap: 8px;
    min-height: 126px;
    max-height: 320px;
    overflow: visible;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 16px;
    background: #141414;
}

.agent-context-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
}

.agent-context-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    padding: 3px 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.68);
    font-size: 12px;
}

.agent-context-pill span {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.38);
}

.agent-context-pill em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-style: normal;
}

.agent-composer textarea {
    width: 100%;
    height: 62px;
    min-height: 62px;
    max-height: 256px;
    overflow-y: hidden;
    resize: none;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    padding: 4px 2px;
    font-size: 13px;
    line-height: 1.55;
}

.agent-composer textarea::placeholder {
    color: rgba(255, 255, 255, 0.36);
}

.agent-composer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.agent-toolbar-left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
}

.agent-toolbar-left button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 15px;
    line-height: 1;
}

.agent-model-trigger-icon {
    width: 26px;
    height: 26px;
    opacity: 1;
}

.agent-mode-trigger,
.agent-param-trigger {
    display: inline-flex !important;
    width: auto !important;
    gap: 6px;
    padding: 0 9px;
}

.agent-mode-trigger {
    min-width: 92px;
}

.agent-param-trigger {
    max-width: 132px;
}

.agent-mode-trigger em,
.agent-param-trigger em {
    overflow: hidden;
    max-width: 82px;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-style: normal;
    font-size: 12px;
    font-weight: 700;
}

.agent-param-trigger em {
    max-width: 96px;
}

.agent-send {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: #111;
    font-size: 18px;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;
}

.agent-send:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.agent-send.is-stopping {
    cursor: pointer;
    opacity: 1;
}

.agent-stop-icon {
    display: block;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: currentColor;
}

.agent-media-params {
    left: 8px;
    bottom: 50px;
    width: calc(100% - 16px);
}

.agent-composer-popover {
    left: 8px;
    bottom: 50px;
    width: min(260px, calc(100% - 16px));
}

.agent-model-popover {
    right: 8px;
    bottom: 50px;
    width: min(320px, calc(100% - 16px));
    min-width: min(280px, calc(100% - 16px));
}

.agent-preference-popover {
    width: min(340px, calc(100% - 16px));
}

.agent-model-popover,
.agent-media-params {
    max-height: 440px;
    overflow: auto;
}

.agent-popover-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 6px 2px;
}

.agent-media-params .agent-popover-title {
    position: sticky;
    top: -8px;
    z-index: 2;
    margin: -8px -8px 2px;
    padding: 11px 14px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(30, 30, 30, 0.98);
}

.agent-mode-menu {
    left: 42px;
    bottom: 50px;
    min-width: 180px;
}

.agent-mode-menu button {
    grid-template-columns: minmax(0, 1fr) 16px;
}

.agent-mode-menu button span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.agent-preference-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 2px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.06);
}

.agent-preference-tabs button {
    display: grid;
    place-items: center;
    min-height: 28px;
    padding: 0 8px;
    border-radius: 7px;
    color: rgba(255, 255, 255, 0.58);
    text-align: center;
    font-size: 12px;
    font-weight: 700;
}

.agent-preference-tabs button.active {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
}

.agent-preference-list {
    display: grid;
    gap: 4px;
    max-height: 300px;
    overflow: auto;
}

.agent-model-row {
    grid-template-columns: 32px minmax(0, 1fr) 16px !important;
    width: 100%;
}

.agent-model-icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
}

.agent-model-row > span:nth-child(2) {
    display: grid;
    gap: 3px;
    min-width: 0;
}

.agent-video-methods {
    display: grid;
    gap: 10px;
    padding: 5px 4px 8px;
}

.agent-video-method-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3px;
    padding: 3px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
}

.agent-video-method-tabs button {
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 30px;
    padding: 0 5px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
}

.agent-video-method-tabs button.active {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
}

.agent-video-method-tabs button:disabled {
    cursor: not-allowed;
    opacity: 0.28;
}

.agent-video-method-unavailable {
    padding: 14px 10px;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.42);
    text-align: center;
    font-size: 12px;
}

.agent-video-reference-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
}

.agent-media-reference-area {
    min-width: 0;
}

.agent-media-reference-area.agent-video-reference-grid,
.agent-media-reference-area .agent-video-reference-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.agent-media-reference-area .agent-video-reference-item,
.agent-media-reference-area .agent-video-add-reference,
.agent-media-reference-area.agent-video-reference-grid .agent-video-reference-item,
.agent-media-reference-area.agent-video-reference-grid .agent-video-add-reference {
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    aspect-ratio: 1 / 1;
}

.agent-media-reference-area .agent-start-end-frames {
    grid-template-columns: 58px 28px 58px;
    justify-content: flex-start;
    width: max-content;
}

.agent-media-reference-area .agent-frame-slot {
    width: 58px;
    height: 58px;
    aspect-ratio: 1 / 1;
}

.agent-media-reference-area .agent-frame-swap {
    width: 26px;
    height: 26px;
}

.agent-video-reference-item,
.agent-video-add-reference {
    position: relative;
    min-width: 0;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.045);
}

.agent-video-reference-item {
    margin: 0;
}

.agent-video-reference-item > img,
.agent-video-reference-item > video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.agent-video-reference-item > .is-audio {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    width: 100%;
    height: 100%;
    color: rgba(255, 255, 255, 0.64);
    font-size: 10px;
}

.agent-video-reference-item > button,
.agent-frame-slot > i {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: rgba(12, 12, 12, 0.76);
    color: #fff;
    cursor: pointer;
    font-style: normal;
    opacity: 0;
}

.agent-video-reference-item:hover > button,
.agent-frame-slot:hover > i {
    opacity: 1;
}

.agent-video-reference-item > em {
    position: absolute;
    left: 5px;
    bottom: 5px;
    display: grid;
    place-items: center;
    width: 19px;
    height: 19px;
    border-radius: 50%;
    background: rgba(12, 12, 12, 0.72);
    color: #fff;
    font-size: 10px;
    font-style: normal;
}

.agent-video-add-reference {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    padding: 5px;
    border-style: dashed;
    color: rgba(255, 255, 255, 0.52);
    font-size: 10px;
    line-height: 1.25;
    text-align: center;
}

.agent-video-add-reference:disabled {
    cursor: not-allowed;
    opacity: 0.28;
}

.agent-video-add-reference:hover {
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.agent-start-end-frames {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
}

.agent-frame-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    padding: 6px 4px 5px;
    border: 1px dashed rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
}

.agent-frame-slot:hover {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.28);
    color: #fff;
}

.agent-frame-slot > span {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.68);
}

.agent-frame-slot > img {
    position: static;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    border-radius: 6px;
    object-fit: cover;
}

.agent-frame-slot > em {
    position: static;
    z-index: auto;
    padding: 0;
    border-radius: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-size: 10px;
    font-style: normal;
    line-height: 1;
    text-align: center;
}

.agent-frame-swap {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.72);
}

.agent-frame-swap:disabled {
    cursor: not-allowed;
    opacity: 0.3;
}

.agent-param-section {
    display: grid;
    gap: 8px;
    padding: 5px 4px 8px;
}

.agent-param-section > span {
    padding: 0 2px;
    color: rgba(255, 255, 255, 0.54);
    font-size: 12px;
    font-weight: 700;
}

.agent-param-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
}

.agent-param-grid.is-ratio {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.agent-param-grid button {
    display: grid;
    place-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 7px 5px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    text-align: center;
}

.agent-param-grid.is-ratio button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 7px 8px;
}

.agent-param-grid button.active {
    border-color: rgba(255, 255, 255, 0.32);
    background: rgba(255, 255, 255, 0.13);
}

.agent-param-grid button:disabled {
    cursor: default;
    opacity: 0.38;
}

.agent-param-grid em {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-style: normal;
    font-size: 12px;
}

.agent-param-grid.is-ratio em {
    font-size: 13px;
    line-height: 1;
}

.agent-ratio-shape {
    display: block;
    flex: 0 0 auto;
    border: 1px solid rgba(255, 255, 255, 0.76);
    border-radius: 2px;
}

.agent-upload-popover {
    width: min(180px, calc(100% - 16px));
    min-width: min(180px, calc(100% - 16px));
}

.agent-upload-popover button {
    grid-template-columns: minmax(0, 1fr) 16px;
}

.agent-upload-popover button span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.agent-uploaded-references {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
}

.agent-message-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
}

.agent-message.is-user .agent-message-attachments {
    justify-content: flex-end;
}

.agent-message-attachment {
    width: 54px;
    height: 54px;
    margin: 0;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.07);
}

.agent-message-attachment img,
.agent-message-attachment video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.agent-message-attachment span {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.68);
}

.agent-uploaded-reference {
    position: relative;
    width: 54px;
    height: 54px;
    margin: 0;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.07);
}

.agent-uploaded-reference img,
.agent-uploaded-reference video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.agent-uploaded-reference.is-uploading img,
.agent-uploaded-reference.is-uploading video,
.agent-uploaded-reference.is-failed img,
.agent-uploaded-reference.is-failed video {
    opacity: 0.42;
}

.agent-uploaded-reference em {
    position: absolute;
    inset: auto 4px 4px;
    overflow: hidden;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.62);
    color: #fff;
    font-size: 10px;
    font-style: normal;
    line-height: 16px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.agent-uploaded-reference > span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
}

.agent-uploaded-reference button {
    position: absolute;
    top: 3px;
    right: 3px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.58);
    color: #fff;
    cursor: pointer;
}

.agent-upload-input {
    display: none;
}

.agent-skill-thumb {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.86);
    font-size: 12px;
    font-weight: 800;
}

.agent-skill-info {
    display: grid;
    min-width: 0;
    gap: 4px;
}

.agent-skill-info strong,
.agent-skill-info em,
.agent-skill-info small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.agent-skill-info strong {
    font-size: 13px;
    font-weight: 700;
}

.agent-skill-info em {
    color: rgba(255, 255, 255, 0.52);
    font-style: normal;
    font-size: 12px;
}

.agent-skill-info small {
    color: rgba(255, 255, 255, 0.42);
    font-size: 11px;
}

.agent-skill-browser {
    position: fixed;
    right: 12px;
    bottom: 62px;
    z-index: 15120;
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr) auto;
    box-sizing: border-box;
    width: calc(100% - 24px);
    height: auto;
    max-height: min(420px, calc(100dvh - 16px));
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    background: rgba(28, 28, 28, 0.98);
    backdrop-filter: blur(18px);
}

.agent-skill-browser header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
    padding: 12px 12px 8px;
}

.agent-skill-browser header strong {
    font-size: 14px;
}

.agent-skill-browser header button,
.agent-skill-browser footer button,
.agent-skill-tabs button {
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.76);
    cursor: pointer;
}

.agent-skill-browser header button {
    height: 28px;
    padding: 0 10px;
    font-size: 12px;
}

.agent-skill-tabs {
    display: flex;
    gap: 6px;
    padding: 0 12px 8px;
}

.agent-skill-tabs button {
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
}

.agent-skill-tabs button.active,
.agent-skill-browser header button:hover,
.agent-skill-browser footer button:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
}

.agent-skill-search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 12px 8px;
    height: 34px;
    padding: 0 10px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.54);
}

.agent-skill-search input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-size: 12px;
}

.agent-skill-search input::placeholder {
    color: rgba(255, 255, 255, 0.36);
}

.agent-skill-list {
    display: grid;
    align-content: start;
    gap: 6px;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 10px 8px;
}

.agent-skill-list > button {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 64px;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 10px;
    row-gap: 3px;
    min-height: 76px;
    padding: 9px 8px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: #fff;
    text-align: left;
    cursor: pointer;
}

.agent-skill-list > button:hover {
    background: rgba(255, 255, 255, 0.07);
}

.agent-skill-list .agent-skill-thumb {
    grid-row: 1 / span 2;
}

.agent-skill-list .agent-skill-info {
    grid-row: 1 / span 2;
}

.agent-skill-type {
    grid-column: 3;
    justify-self: end;
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
}

.agent-skill-detail {
    grid-column: 3;
    justify-self: end;
    padding: 4px 0;
    border-radius: 7px;
    color: rgba(255, 255, 255, 0.56);
    font-size: 12px;
    line-height: 1;
}

.agent-skill-detail:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.agent-empty {
    padding: 18px;
    color: rgba(255, 255, 255, 0.44);
    text-align: center;
    font-size: 12px;
}

.agent-skill-browser footer {
    padding: 8px 12px 12px;
}

.agent-skill-browser footer button {
    width: 100%;
    height: 34px;
    font-size: 12px;
}

.agent-modal-mask {
    position: fixed;
    inset: 0;
    z-index: 15400;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.52);
}

.agent-detail-modal {
    display: grid;
    width: min(420px, calc(100vw - 32px));
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    background: rgba(28, 28, 28, 0.98);
    color: #fff;
}

.agent-detail-modal header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.agent-detail-modal header strong {
    font-size: 15px;
}

.agent-detail-modal header button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
}

.agent-detail-modal footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 14px 14px;
}

.agent-detail-modal footer button {
    min-width: 72px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    cursor: pointer;
}

.agent-detail-modal footer button {
    background: #fff;
    color: #111;
    font-weight: 700;
}

.agent-detail-modal header > div {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.agent-detail-modal p {
    margin: 0;
    padding: 14px 16px 4px;
    color: rgba(255, 255, 255, 0.76);
    font-size: 13px;
    line-height: 1.6;
}

.agent-detail-modal dl {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 10px 16px;
}

.agent-detail-modal dt {
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
}

.agent-detail-modal dd {
    margin: 0 0 8px;
    color: rgba(255, 255, 255, 0.78);
    font-size: 13px;
}

@media (max-width: 900px) {
    .canvas-agent-panel {
        width: min(400px, 100vw);
    }

    .agent-resize-handle {
        display: none;
    }

    .agent-header-actions {
        gap: 4px;
    }

    .agent-header-actions button {
        width: 32px;
        height: 32px;
    }

    .agent-skill-browser {
        height: min(390px, calc(100vh - 178px));
        max-height: min(390px, calc(100vh - 178px));
    }
}
</style>
