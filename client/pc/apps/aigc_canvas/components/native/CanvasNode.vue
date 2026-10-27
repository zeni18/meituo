<template>
    <article
        ref="rootRef"
        class="native-canvas-node"
        :class="[
            `is-${node.type}`,
            {
                selected,
                running: isRunning,
                failed: status === 'failed' || status === 'error',
                'is-page-artboard': isPageArtboard,
                'has-media-result': hasMediaResult
            }
        ]"
        :style="rootStyle"
        :data-native-node-id="node.id"
        @pointerdown="handlePointerDown"
        @mouseenter="playPreviewVideo"
        @mouseleave="pausePreviewVideo"
        @contextmenu.prevent.stop="$emit('contextmenu', $event, node.id)"
    >
        <button
            v-if="!isPageArtboard"
            :class="[
                'node-port',
                'node-port-left',
                {
                    'node-port-force-hidden':
                        connecting || dragging || isZoomedIn || isMaterialMediaNode
                }
            ]"
            type="button"
            title="在左侧添加节点"
            @pointerdown.stop="$emit('connectStart', $event, node.id, 'before')"
            @pointermove="moveNodePortMagnet"
            @pointerleave="resetNodePortMagnet"
        >
            <span class="node-port-icon" aria-hidden="true" />
        </button>
        <button
            v-if="!isPageArtboard"
            :class="[
                'node-port',
                'node-port-right',
                { 'node-port-force-hidden': connecting || dragging || isZoomedIn }
            ]"
            type="button"
            title="在右侧添加节点"
            @pointerdown.stop="$emit('connectStart', $event, node.id, 'after')"
            @pointermove="moveNodePortMagnet"
            @pointerleave="resetNodePortMagnet"
        >
            <span class="node-port-icon" aria-hidden="true" />
        </button>
        <header v-if="!isPageArtboard" class="node-head">
            <div class="node-head-inner">
                <span class="node-kind" :class="`node-kind-${node.type}`">
                    <img :src="nodeIcon" alt="" />
                </span>
                <div v-if="selected" class="node-title-edit">
                    <span class="node-title-measure" aria-hidden="true">
                        {{ node.title || '输入标题' }}
                    </span>
                    <input
                        :value="node.title"
                        placeholder="输入标题"
                        @input="updateTitle(($event.target as HTMLInputElement).value)"
                        @pointerdown.stop
                    />
                </div>
                <span v-else class="node-head-title" :title="node.title">{{ node.title }}</span>
            </div>
        </header>

        <div v-if="showTextActionBar" class="text-action-bar" @pointerdown.stop @mousedown.prevent>
            <button
                type="button"
                :class="['text-tool', { active: textBlockType === 'h1' }]"
                title="一级标题"
                @click.stop="setTextBlock('h1')"
            >
                H1
            </button>
            <button
                type="button"
                :class="['text-tool', { active: textBlockType === 'h2' }]"
                title="二级标题"
                @click.stop="setTextBlock('h2')"
            >
                H2
            </button>
            <button
                type="button"
                :class="['text-tool', { active: textBlockType === 'h3' }]"
                title="三级标题"
                @click.stop="setTextBlock('h3')"
            >
                H3
            </button>
            <button
                type="button"
                :class="['text-tool', { active: textBlockType === 'p' }]"
                title="正文"
                @click.stop="setTextBlock('p')"
            >
                ¶
            </button>
            <span class="text-action-divider" />
            <button
                type="button"
                :class="['text-tool', { active: textBold }]"
                title="加粗"
                @click.stop="toggleTextBold"
            >
                <span class="text-tool-bold">B</span>
            </button>
            <button
                type="button"
                :class="['text-tool', { active: textItalic }]"
                title="斜体"
                @click.stop="toggleTextItalic"
            >
                <span class="text-tool-italic">I</span>
            </button>
            <button
                type="button"
                :class="['text-tool', { active: textListStyle === 'bullet' }]"
                title="项目符号列表"
                @click.stop="toggleTextList('bullet')"
            >
                <span class="text-tool-icon text-tool-icon-list" aria-hidden="true" />
            </button>
            <button
                type="button"
                :class="['text-tool', { active: textListStyle === 'ordered' }]"
                title="编号列表"
                @click.stop="toggleTextList('ordered')"
            >
                <span class="text-tool-icon text-tool-icon-ordered" aria-hidden="true" />
            </button>
            <button
                type="button"
                class="text-tool"
                title="插入分隔线"
                @click.stop="insertTextDivider"
            >
                <span class="text-tool-icon text-tool-icon-divider" aria-hidden="true" />
            </button>
            <div class="text-background-picker">
                <button
                    type="button"
                    :class="['text-tool', { active: textBackgroundOpen }]"
                    title="背景颜色"
                    @click.stop="toggleTextBackgroundMenu"
                >
                    <span class="text-background-swatch" :style="{ background: textBackground }" />
                </button>
                <div v-if="textBackgroundOpen" class="text-background-menu">
                    <button
                        v-for="color in textBackgroundColors"
                        :key="color"
                        type="button"
                        :class="{ active: color === textBackground }"
                        :style="{ background: color }"
                        :title="color"
                        @click.stop="setTextBackground(color)"
                    />
                </div>
            </div>
            <span class="text-action-divider" />
            <button
                type="button"
                class="text-tool"
                title="复制内容"
                @click.stop="copyTextContent"
            >
                <img class="action-icon-img" src="/short-drama/figma/icon/Copy.svg" alt="" />
            </button>
            <button
                type="button"
                class="text-tool"
                title="添加到资产库"
                @click.stop="emit('addToAsset', node.id)"
            >
                <img class="action-icon-img" src="/aigc_canva/icon/add-zichanku.svg" alt="" />
            </button>
            <button
                type="button"
                :class="['text-tool', { active: textExpanded }]"
                title="展开/收起"
                @click.stop="toggleTextExpanded"
            >
                <img class="action-icon-img" src="/aigc_canva/icon/Full.svg" alt="" />
            </button>
            <span class="text-action-divider" />
            <button type="button" class="text-tool is-danger" title="删除节点" @click.stop="emit('remove', node.id)">
                <img class="action-icon-img" src="/short-drama/figma/icon/Delete.svg" alt="" />
            </button>
        </div>

        <section class="node-body">
            <div v-if="showRedrawActionBar" class="redraw-action-bar" @pointerdown.stop>
                <button
                    class="redraw-title"
                    type="button"
                    title="退出局部重绘"
                    @click.stop="exitRedrawMode"
                >
                    <img
                        class="redraw-title-icon"
                        src="/aigc_canva/icon/Logout.svg"
                        alt=""
                        aria-hidden="true"
                    />
                    重绘
                </button>
                <span class="redraw-divider" />
                <button
                    type="button"
                    :class="['redraw-tool', { active: redrawTool === 'move' }]"
                    title="移动"
                    @click.stop="setRedrawTool('move')"
                >
                    <img
                        class="redraw-icon"
                        src="/aigc_canva/icon/Move-one.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    :class="['redraw-tool', { active: redrawTool === 'brush' }]"
                    title="画笔"
                    @click.stop="setRedrawTool('brush')"
                >
                    <img
                        class="redraw-icon"
                        src="/aigc_canva/icon/brush.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    :class="['redraw-tool', { active: redrawTool === 'select' }]"
                    title="框选"
                    @click.stop="setRedrawTool('select')"
                >
                    <img
                        class="redraw-icon"
                        src="/aigc_canva/icon/Rectangle.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    :class="['redraw-tool', { active: redrawTool === 'erase' }]"
                    title="橡皮擦"
                    @click.stop="setRedrawTool('erase')"
                >
                    <img
                        class="redraw-icon"
                        src="/aigc_canva/icon/Clear-format.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <span class="redraw-divider" />
                <img
                    class="redraw-size-icon"
                    src="/aigc_canva/icon/Writing-fluently.svg"
                    alt=""
                    aria-hidden="true"
                />
                <input
                    class="redraw-size"
                    type="range"
                    min="8"
                    max="80"
                    :value="redrawBrushSize"
                    title="笔刷大小"
                    @input.stop="setRedrawBrushSize(($event.target as HTMLInputElement).value)"
                />
                <span class="redraw-divider" />
                <button
                    class="redraw-tool"
                    type="button"
                    title="撤销"
                    :disabled="!canUndoRedrawMask"
                    @click.stop="undoRedrawMask"
                >
                    <img
                        class="redraw-icon"
                        src="/aigc_canva/icon/shangyibu.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <button
                    class="redraw-tool"
                    type="button"
                    title="重做"
                    :disabled="!canRedoRedrawMask"
                    @click.stop="redoRedrawMask"
                >
                    <img
                        class="redraw-icon"
                        src="/aigc_canva/icon/xiayibu.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
            </div>

            <div v-if="showMediaActionBar" class="image-action-bar" @pointerdown.stop>
                <template v-if="node.type === 'image'">
                    <button type="button" @click.stop="enterRedrawMode">
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/Edit-two.svg"
                            alt=""
                            aria-hidden="true"
                        />
                        局部重绘
                    </button>
                    <CropperUpload
                        ref="imageCropperRef"
                        :source="mediaUrl"
                        :crop-width="imageCropSize.width"
                        :crop-height="imageCropSize.height"
                        file-name="canvas-image"
                        @change="handleCroppedImage"
                    >
                        <button type="button" @pointerdown.stop>
                            <img
                                class="action-icon-img"
                                src="/aigc_canva/icon/Tailoring.svg"
                                alt=""
                                aria-hidden="true"
                            />
                            裁剪
                        </button>
                    </CropperUpload>
                    <button type="button" @click.stop="openImageCropper(1)">
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/Rotating-forward.svg"
                            alt=""
                            aria-hidden="true"
                        />
                        旋转
                    </button>
                    <button
                        :class="['action-icon-only', { active: mediaMoreOpen }]"
                        type="button"
                        title="更多"
                        @click.stop="toggleMediaMore"
                    >
                        <span class="action-icon action-icon-more" aria-hidden="true" />
                    </button>
                    <div v-if="mediaMoreOpen" class="media-more-menu">
                        <button type="button" @click.stop="duplicateMediaNode">复制节点</button>
                        <button class="is-danger" type="button" @click.stop="removeMediaNode">
                            删除节点
                        </button>
                    </div>
                    <span class="image-action-divider" />
                </template>
                <div v-if="node.type === 'video'" class="video-capture-wrap">
                    <button
                        :class="{ active: videoCaptureMenuOpen }"
                        type="button"
                        title="截取视频帧"
                        :disabled="isCapturingVideoFrame"
                        @click.stop="toggleVideoCaptureMenu"
                    >
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/pic.svg"
                            alt=""
                            aria-hidden="true"
                        />
                        截帧
                    </button>
                    <div v-if="videoCaptureMenuOpen" class="video-capture-menu">
                        <button type="button" :disabled="isCapturingVideoFrame" @click.stop="captureVideoFrame('current')">
                            当前帧
                        </button>
                        <button type="button" :disabled="isCapturingVideoFrame" @click.stop="captureVideoFrame('first')">
                            首帧
                        </button>
                        <button type="button" :disabled="isCapturingVideoFrame" @click.stop="captureVideoFrame('last')">
                            尾帧
                        </button>
                    </div>
                </div>
                <span v-if="node.type === 'video'" class="image-action-divider" />
                <template v-if="node.type === 'audio'">
                    <button
                        class="action-icon-only"
                        type="button"
                        title="下载当前媒体"
                        @click.stop="emit('downloadMedia', node.id)"
                    >
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/Download).svg"
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                    <button
                        class="action-icon-only"
                        type="button"
                        title="添加到资产库"
                        @click.stop="emit('addToAsset', node.id)"
                    >
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/add-zichanku.svg"
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                </template>
                <template v-else>
                    <button
                        class="action-icon-only"
                        type="button"
                        title="添加到资产库"
                        @click.stop="emit('addToAsset', node.id)"
                    >
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/add-zichanku.svg"
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                    <button
                        class="action-icon-only"
                        type="button"
                        title="下载当前媒体"
                        @click.stop="emit('downloadMedia', node.id)"
                    >
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/Download).svg"
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                    <button
                        class="action-icon-only"
                        type="button"
                        title="全屏查看"
                        @click.stop="emit('fullscreenMedia', node.id)"
                    >
                        <img
                            class="action-icon-img"
                            src="/aigc_canva/icon/Full.svg"
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                </template>
                <span class="image-action-divider" />
                <button
                    class="action-icon-only is-danger"
                    type="button"
                    title="删除节点"
                    @click.stop="emit('remove', node.id)"
                >
                    <img
                        class="action-icon-img"
                        src="/short-drama/figma/icon/Delete.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
            </div>

            <div v-if="isPageArtboard" class="page-artboard-body" />

            <div
                v-else-if="node.type === 'text'"
                class="text-display"
                :class="{ 'is-empty': !textValue && !isTextEditing, 'is-editing': isTextEditing }"
                @dblclick.stop="startTextEditing"
                @pointerdown.stop="selectForEditing"
            >
                <div
                    v-if="isTextEditing"
                    ref="textEditorRef"
                    :class="['text-editor', textDisplayClass]"
                    contenteditable="true"
                    role="textbox"
                    aria-multiline="true"
                    data-placeholder="开始输入文本..."
                    v-html="textEditorHtml"
                    @input="handleRichTextInput($event)"
                    @blur="finishTextEditing"
                    @keydown.esc.prevent="finishTextEditing"
                    @keyup="syncTextEditorState"
                    @mouseup="syncTextEditorState"
                    @pointerdown.stop
                />
                <div
                    v-else-if="textValue"
                    class="text-display-content"
                    :class="textDisplayClass"
                    v-html="textDisplayHtml"
                />
                <div v-else class="text-display-placeholder">双击开始编辑...</div>
            </div>

            <textarea
                v-else-if="node.type === 'config'"
                :value="textValue"
                placeholder="输入生成提示词，或连接文本、图片节点作为参考"
                @input="updateText(($event.target as HTMLTextAreaElement).value)"
                @pointerdown.stop="selectForEditing"
            />

            <template v-else-if="node.type === 'image'">
                <div
                    class="media-frame image-frame"
                    :class="{ 'has-media': mediaUrl && !isRunning, 'is-running': isRunning }"
                >
                    <div v-if="isRunning && !isRedrawEditing" class="media-content media-loading">
                        <ShortDramaGrainientPlaceholder :label="runningPlaceholderLabel" />
                    </div>
                    <div v-else-if="mediaUrl" ref="imageContentRef" class="media-content">
                        <img
                            v-if="imagePreviousUrl"
                            class="image-transition-previous"
                            :src="imagePreviousUrl"
                            alt=""
                            draggable="false"
                            aria-hidden="true"
                        />
                        <img
                            :key="`image-${imageRetryKey}`"
                            ref="redrawImageRef"
                            :class="[
                                'image-transition-current',
                                {
                                    'is-transitioning': !!imagePreviousUrl,
                                    'is-revealing': imageRevealing
                                }
                            ]"
                            :src="mediaUrl"
                            alt=""
                            draggable="false"
                            referrerpolicy="no-referrer"
                            @load="handleImageLoaded"
                            @error="imagePreviewError = true"
                            @dragstart.prevent
                        />
                        <div v-if="imagePreviewError" class="media-preview-error" @pointerdown.stop>
                            <strong>图片预览加载失败</strong>
                            <span>图片已生成，但当前无法显示</span>
                            <button type="button" @click.stop="retryImagePreview">重试</button>
                        </div>
                        <canvas
                            v-if="isRedrawEditing && !isRunning"
                            ref="redrawCanvasRef"
                            class="redraw-mask-canvas"
                            :class="`is-${activeRedrawTool}`"
                            :style="redrawCanvasStyle"
                            @pointerdown="startRedrawDrawing"
                            @pointermove="drawRedrawMask"
                            @pointerup="stopRedrawDrawing"
                            @pointerleave="stopRedrawDrawing"
                            @pointercancel="stopRedrawDrawing"
                        />
                        <div v-if="isRedrawEditing && isRunning" class="media-redraw-loading">
                            <ShortDramaGrainientPlaceholder :label="runningPlaceholderLabel" />
                        </div>
                    </div>
                    <div v-else-if="isFailed" class="media-empty is-failed">
                        <span>生成失败</span>
                        <small>请调整提示词或参数后重试</small>
                    </div>
                    <div v-else class="media-empty media-empty-editable">
                        <img :src="nodeIcon" alt="" aria-hidden="true" />
                    </div>
                </div>
            </template>

            <template v-else-if="node.type === 'audio'">
                <div
                    class="media-frame audio-frame"
                    :class="{ 'has-media': mediaUrl && !isRunning, 'is-running': isRunning }"
                >
                    <div v-if="isRunning" class="media-content media-loading">
                        <ShortDramaGrainientPlaceholder :label="runningPlaceholderLabel" />
                    </div>
                    <div v-else-if="mediaUrl" class="media-content audio-content" @pointerdown.stop>
                        <div
                            class="audio-waveform"
                            role="slider"
                            aria-label="音频进度"
                            :aria-valuemin="0"
                            :aria-valuemax="audioDuration"
                            :aria-valuenow="audioCurrent"
                            @pointerdown.stop="startAudioScrubbing"
                        >
                            <span
                                v-for="(height, index) in audioWaveBars"
                                :key="index"
                                :class="{ 'is-played': index / Math.max(1, audioWaveBars.length - 1) <= audioProgress }"
                                :style="audioWaveBarStyle(index, height)"
                            />
                        </div>
                        <div class="audio-player">
                            <div class="audio-player-controls">
                                <button
                                    class="audio-skip-button is-back"
                                    type="button"
                                    title="后退 10 秒"
                                    @click.stop="skipAudio(-10)"
                                >
                                    <span aria-hidden="true" />
                                </button>
                                <button
                                    :class="['audio-play-button', { 'is-playing': audioPlaying }]"
                                    type="button"
                                    :title="audioPlaying ? '暂停' : '播放'"
                                    @click.stop="toggleAudioPlayback"
                                >
                                    <span aria-hidden="true" />
                                </button>
                                <button
                                    class="audio-skip-button is-forward"
                                    type="button"
                                    title="前进 10 秒"
                                    @click.stop="skipAudio(10)"
                                >
                                    <span aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <audio
                            ref="audioRef"
                            class="audio-element"
                            :src="mediaUrl"
                            preload="metadata"
                            @loadedmetadata="syncAudioState"
                            @durationchange="syncAudioState"
                            @timeupdate="syncAudioState"
                            @play="audioPlaying = true"
                            @pause="audioPlaying = false"
                            @ended="audioPlaying = false"
                        />
                    </div>
                    <div v-else-if="isFailed" class="media-empty is-failed">
                        <span>生成失败</span>
                        <small>请调整提示词或参数后重试</small>
                    </div>
                    <div v-else class="media-empty audio-empty">
                        <img src="/short-drama/figma/icon/shengyin.svg" alt="" aria-hidden="true" />
                    </div>
                </div>
            </template>

            <template v-else>
                <div
                    class="media-frame video-frame"
                    :class="{ 'has-media': mediaUrl && !isRunning, 'is-running': isRunning }"
                >
                    <div v-if="isRunning" class="media-content media-loading">
                        <ShortDramaGrainientPlaceholder :label="runningPlaceholderLabel" />
                    </div>
                    <div
                        v-else-if="mediaUrl"
                        class="media-content video-content"
                        @mouseenter="setVideoHover(true)"
                        @mouseleave="setVideoHover(false)"
                    >
                        <video
                            :key="`video-${videoRetryKey}`"
                            ref="videoRef"
                            :src="mediaUrl"
                            :poster="posterUrl"
                            :muted="videoMuted"
                            crossorigin="anonymous"
                            preload="metadata"
                            playsinline
                            draggable="false"
                            @loadedmetadata="handleVideoMetadataLoaded"
                            @durationchange="syncVideoState"
                            @timeupdate="syncVideoState"
                            @play="videoPlaying = true"
                            @pause="videoPlaying = false"
                            @ended="videoPlaying = false"
                            @error="videoPreviewError = true"
                            @dragstart.prevent
                        />
                        <div v-if="videoPreviewError" class="media-preview-error" @pointerdown.stop>
                            <strong>视频预览加载失败</strong>
                            <span>视频已生成，但当前无法显示</span>
                            <button type="button" @click.stop="retryVideoPreview">重试</button>
                        </div>
                        <div
                            :class="[
                                'video-top-controls',
                                { 'is-visible': selected || videoHovered }
                            ]"
                            @pointerdown.stop
                        >
                            <button
                                type="button"
                                :title="videoMuted ? '打开声音' : '静音'"
                                @click.stop="toggleVideoMute"
                            >
                                <img
                                    :src="
                                        videoMuted
                                            ? '/short-drama/figma/icon/Volume-guan.svg'
                                            : '/short-drama/figma/icon/Volume-kai.svg'
                                    "
                                    alt=""
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                        <div
                            :class="[
                                'video-hover-controls',
                                { 'is-visible': selected || videoHovered }
                            ]"
                            @pointerdown.stop
                        >
                            <button
                                class="video-control-button"
                                type="button"
                                :title="videoPlaying ? '暂停' : '播放'"
                                @click.stop="toggleVideoPlayback"
                            >
                                <span :class="{ 'is-pause': videoPlaying }" aria-hidden="true" />
                            </button>
                            <span class="video-time">{{ formatVideoTime(videoCurrent) }}</span>
                            <input
                                class="video-progress"
                                type="range"
                                min="0"
                                :max="videoDuration || 1"
                                step="0.1"
                                :value="videoCurrent"
                                aria-label="视频进度"
                                :style="{ '--video-progress': `${videoProgress * 100}%` }"
                                @input.stop="seekVideo"
                                @pointerdown.stop
                            />
                            <span class="video-time">{{ formatVideoTime(videoDuration) }}</span>
                            <button
                                class="video-control-button"
                                type="button"
                                title="全屏查看"
                                @click.stop="emit('fullscreenMedia', node.id)"
                            >
                                <img src="/aigc_canva/icon/Full.svg" alt="" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <div v-else-if="isFailed" class="media-empty is-failed">
                        <span>生成失败</span>
                        <small>请调整提示词或参数后重试</small>
                    </div>
                    <div v-else class="media-empty media-empty-editable">
                        <img :src="nodeIcon" alt="" aria-hidden="true" />
                    </div>
                </div>
            </template>

            <p v-if="errorText" class="node-error">{{ errorText }}</p>
        </section>

        <footer
            v-if="showComposer"
            class="node-composer"
            :class="{ 'has-references': displayReferenceItems.length, 'is-redraw': isRedrawMode }"
            @pointerdown.stop
        >
            <div class="composer-main" @wheel.stop>
                <div v-if="displayReferenceItems.length" class="composer-references">
                    <figure
                        v-for="item in referenceItems"
                        :key="item.key"
                        :class="['composer-reference-thumb', `is-${item.type}`]"
                        draggable="false"
                        @dragstart.prevent
                        @mouseenter="item.type === 'video' && playReferenceVideo($event)"
                        @mouseleave="item.type === 'video' && stopReferenceVideo($event)"
                    >
                        <div class="composer-reference-clip">
                            <video
                                v-if="item.type === 'video'"
                                :src="item.url"
                                muted
                                playsinline
                                preload="metadata"
                                draggable="false"
                                @dragstart.prevent
                            />
                            <img
                                v-else-if="item.type === 'image'"
                                :src="item.url"
                                alt=""
                                draggable="false"
                                @dragstart.prevent
                            />
                            <img
                                v-else
                                class="reference-text-icon"
                                src="/short-drama/figma/icon/shengyin.svg"
                                alt=""
                            />
                            <button type="button" title="移除" @click.stop="removeReference(item)">
                                ×
                            </button>
                        </div>
                        <div v-if="item.type === 'video'" class="reference-video-preview">
                            <video :src="item.url" muted playsinline />
                        </div>
                    </figure>
                    <figure
                        v-for="item in externalDisplayReferences"
                        :key="item.key"
                        :class="['composer-reference-thumb', `is-${item.type}`, 'is-linked']"
                        draggable="false"
                        @dragstart.prevent
                        @mouseenter="item.type === 'video' && playReferenceVideo($event)"
                        @mouseleave="item.type === 'video' && stopReferenceVideo($event)"
                    >
                        <div class="composer-reference-clip">
                            <video
                                v-if="item.type === 'video'"
                                :src="item.url"
                                muted
                                playsinline
                                preload="metadata"
                                draggable="false"
                                @dragstart.prevent
                            />
                            <img
                                v-else-if="item.type === 'image'"
                                :src="item.url"
                                alt=""
                                draggable="false"
                                @dragstart.prevent
                            />
                            <img
                                v-else-if="item.type === 'audio'"
                                class="reference-text-icon"
                                src="/short-drama/figma/icon/shengyin.svg"
                                alt=""
                            />
                            <template v-else>
                                <img
                                    class="reference-text-icon"
                                    src="/aigc_canva/icon/text.svg"
                                    alt=""
                                />
                                <span>{{ item.text }}</span>
                            </template>
                            <button
                                type="button"
                                title="删除连接"
                                @click.stop="
                                    $emit('removeReferenceConnection', node.id, item.sourceId)
                                "
                            >
                                ×
                            </button>
                        </div>
                        <div v-if="item.type === 'video'" class="reference-video-preview">
                            <video :src="item.url" muted playsinline />
                        </div>
                    </figure>
                </div>
                <div
                    class="composer-editor-viewport"
                    @pointerdown="handleComposerEditorPointerDown"
                    @wheel.stop
                >
                    <div
                        ref="composerEditorRef"
                        class="composer-editor"
                        contenteditable="true"
                        :data-placeholder="composerPlaceholder"
                        role="textbox"
                        aria-multiline="true"
                        @input="syncComposerFromEditor"
                        @keydown="handleComposerKeydown"
                        @paste.prevent="handleComposerPaste"
                        @focus="renderComposerEditor"
                        @wheel.stop
                    ></div>
                </div>
            </div>
            <div class="composer-toolbar">
                <div
                    v-if="!isRedrawMode"
                    class="composer-upload-wrap"
                >
                    <button type="button" class="icon-button" @click.stop="toggleUploadMenu">
                        <img src="/aigc_canva/icon/prompt_add.png" alt="" />
                    </button>
                    <div v-if="uploadMenuOpen" class="composer-upload-menu">
                        <button type="button" @click.stop="triggerLocalReferenceUpload">
                            <span
                                class="upload-menu-icon upload-menu-icon-link"
                                aria-hidden="true"
                            />
                            本地上传
                        </button>
                        <button type="button" @click.stop="selectAssetReference">
                            <span
                                class="upload-menu-icon upload-menu-icon-folder"
                                aria-hidden="true"
                            />
                            从资产库选择
                        </button>
                    </div>
                    <input
                        ref="referenceInputRef"
                        class="reference-input"
                        type="file"
                        :accept="referenceAccept"
                        @change="handleReferenceUpload"
                    />
                </div>
                <div class="composer-mention-wrap">
                    <button
                        type="button"
                        :class="['icon-button', 'mention-button', { active: mentionMenuOpen }]"
                        title="@引用"
                        @click.stop="toggleMentionMenu"
                    >
                        <img src="/short-drama/figma/icon/@.svg" alt="" />
                    </button>
                    <div v-if="mentionMenuOpen" class="mention-menu" @wheel.stop>
                        <div class="mention-menu__head">
                            <strong>素材引用</strong>
                            <button type="button" @click.stop="clearMentions">清空</button>
                        </div>
                        <div class="mention-tabs" role="tablist" aria-label="素材引用分类">
                            <button
                                v-for="tab in mentionTabs"
                                :key="tab.key"
                                type="button"
                                :class="{ active: activeMentionTab === tab.key }"
                                @click.stop="activeMentionTab = tab.key"
                            >
                                {{ tab.label }} {{ tab.count }}
                            </button>
                        </div>
                        <div class="mention-menu__body">
                            <div v-if="activeMentionItems.length" class="mention-list">
                                <button
                                    v-for="item in activeMentionItems"
                                    :key="item.id"
                                    :class="[
                                        'mention-item',
                                        { 'is-active': selectedMentionIds.includes(item.id) }
                                    ]"
                                    type="button"
                                    @click.stop="selectMentionItem(item)"
                                >
                                    <span class="mention-thumb" :class="`is-${item.previewType}`">
                                        <video
                                            v-if="item.previewType === 'video'"
                                            :src="item.previewUrl"
                                            muted
                                            playsinline
                                            preload="metadata"
                                        />
                                        <img
                                            v-else-if="item.previewUrl"
                                            :src="item.previewUrl"
                                            alt=""
                                        />
                                        <img
                                            v-else
                                            class="mention-thumb-icon"
                                            :src="item.previewIcon"
                                            alt=""
                                        />
                                    </span>
                                    <span class="mention-main">
                                        <b>{{ item.name }}</b>
                                        <small>{{ item.sourceLabel }}</small>
                                    </span>
                                </button>
                            </div>
                            <div v-else class="mention-empty">暂无可引用内容</div>
                        </div>
                    </div>
                </div>
                <div
                    v-for="option in composerOptions"
                    :key="option.key"
                    class="composer-select-wrap"
                >
                    <button
                        type="button"
                        :class="['composer-select', { 'is-open': openedOption === option.key }]"
                        @click.stop="toggleComposerOption(option.key)"
                    >
                        <img v-if="option.icon" :src="option.icon" alt="" />
                        {{ option.selectedLabel }}
                        <img
                            class="composer-select-arrow"
                            src="/aigc_canva/icon/prompt_style_chevron.png"
                            alt=""
                        />
                    </button>

                    <div
                        v-if="openedOption === option.key"
                        class="composer-select-menu"
                        @wheel.stop
                    >
                        <button
                            v-for="value in option.values"
                            :key="`${option.key}-${value.value}`"
                            :class="[
                                'composer-select-menu__item',
                                {
                                    'is-active':
                                        option.currentValue === normalizeOptionValue(value.value)
                                }
                            ]"
                            type="button"
                            @click.stop="setComposerOption(option.key, value.value)"
                        >
                            <span
                                v-if="option.key === 'ratio'"
                                class="composer-ratio-preview"
                                aria-hidden="true"
                            >
                                <span
                                    class="composer-ratio-shape"
                                    :style="getRatioPreviewStyle(value.value)"
                                />
                            </span>
                            {{ value.label }}
                        </button>
                    </div>
                </div>
                <span class="composer-spacer" />
                <button type="button" class="icon-button composer-cost-icon" title="积分消耗">
                    <img src="/aigc_canva/icon/prompt_sparkle.png" alt="" />
                </button>
                <span class="composer-cost">{{ composerCost }}</span>
                <button
                    type="button"
                    class="send-button"
                    :disabled="isRunning"
                    @click.stop="$emit('run', node.id)"
                >
                    <img src="/short-drama/figma/icon/Arrow-up.svg" alt="" />
                </button>
            </div>
        </footer>

        <Teleport to="body">
            <div
                v-if="textExpanded"
                class="text-expanded-overlay"
                @pointerdown.self="closeTextExpanded"
            >
                <section class="text-expanded-dialog" @pointerdown.stop>
                    <header class="text-expanded-header">
                        <button
                            type="button"
                            class="text-tool text-expanded-copy"
                            title="复制内容"
                            @click.stop="copyTextContent"
                        >
                            <img
                                class="action-icon-img"
                                src="/short-drama/figma/icon/Copy.svg"
                                alt=""
                            />
                        </button>
                        <div class="text-expanded-toolbar" @mousedown.prevent>
                            <button
                                type="button"
                                :class="['text-tool', { active: textBlockType === 'h1' }]"
                                title="一级标题"
                                @click.stop="setTextBlock('h1')"
                            >
                                H1
                            </button>
                            <button
                                type="button"
                                :class="['text-tool', { active: textBlockType === 'h2' }]"
                                title="二级标题"
                                @click.stop="setTextBlock('h2')"
                            >
                                H2
                            </button>
                            <button
                                type="button"
                                :class="['text-tool', { active: textBlockType === 'h3' }]"
                                title="三级标题"
                                @click.stop="setTextBlock('h3')"
                            >
                                H3
                            </button>
                            <button
                                type="button"
                                :class="['text-tool', { active: textBlockType === 'p' }]"
                                title="正文"
                                @click.stop="setTextBlock('p')"
                            >
                                ¶
                            </button>
                            <span class="text-action-divider" />
                            <button
                                type="button"
                                :class="['text-tool', { active: textBold }]"
                                title="加粗"
                                @click.stop="toggleTextBold"
                            >
                                <span class="text-tool-bold">B</span>
                            </button>
                            <button
                                type="button"
                                :class="['text-tool', { active: textItalic }]"
                                title="斜体"
                                @click.stop="toggleTextItalic"
                            >
                                <span class="text-tool-italic">I</span>
                            </button>
                            <button
                                type="button"
                                :class="['text-tool', { active: textListStyle === 'bullet' }]"
                                title="项目符号列表"
                                @click.stop="toggleTextList('bullet')"
                            >
                                <span
                                    class="text-tool-icon text-tool-icon-list"
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                :class="['text-tool', { active: textListStyle === 'ordered' }]"
                                title="编号列表"
                                @click.stop="toggleTextList('ordered')"
                            >
                                <span
                                    class="text-tool-icon text-tool-icon-ordered"
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                class="text-tool"
                                title="插入分隔线"
                                @click.stop="insertTextDivider"
                            >
                                <span
                                    class="text-tool-icon text-tool-icon-divider"
                                    aria-hidden="true"
                                />
                            </button>
                            <div class="text-background-picker">
                                <button
                                    type="button"
                                    :class="['text-tool', { active: textBackgroundOpen }]"
                                    title="背景颜色"
                                    @click.stop="toggleTextBackgroundMenu"
                                >
                                    <span
                                        class="text-background-swatch"
                                        :style="{ background: textBackground }"
                                    />
                                </button>
                                <div v-if="textBackgroundOpen" class="text-background-menu">
                                    <button
                                        v-for="color in textBackgroundColors"
                                        :key="color"
                                        type="button"
                                        :class="{ active: color === textBackground }"
                                        :style="{ background: color }"
                                        :title="color"
                                        @click.stop="setTextBackground(color)"
                                    />
                                </div>
                            </div>
                        </div>
                        <PcCloseButton
                            class="text-expanded-close"
                            aria-label="关闭"
                            @click.stop="closeTextExpanded"
                        />
                    </header>
                    <div
                        class="text-expanded-body"
                        :class="{
                            'is-empty': !textValue && !isTextEditing,
                            'is-editing': isTextEditing
                        }"
                        @dblclick.stop="startTextEditing"
                        @pointerdown.stop="selectForEditing"
                    >
                        <div
                            v-if="isTextEditing"
                            ref="textEditorRef"
                            :class="['text-editor', textDisplayClass]"
                            contenteditable="true"
                            role="textbox"
                            aria-multiline="true"
                            data-placeholder="开始输入文本..."
                            v-html="textEditorHtml"
                            @input="handleRichTextInput($event)"
                            @blur="finishTextEditing"
                            @keydown.esc.prevent="finishTextEditing"
                            @keyup="syncTextEditorState"
                            @mouseup="syncTextEditorState"
                            @pointerdown.stop
                        />
                        <div
                            v-else-if="textValue"
                            class="text-display-content"
                            :class="textDisplayClass"
                            v-html="textDisplayHtml"
                        />
                        <div v-else class="text-display-placeholder">双击开始编辑...</div>
                    </div>
                </section>
            </div>
        </Teleport>
    </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ShortDramaGrainientPlaceholder from '~/components/short-drama/ShortDramaGrainientPlaceholder.vue'
import {
    uploadFile as uploadAppFile,
    uploadImage as uploadAppImage,
    uploadVideo as uploadAppVideo
} from '@/api/app'
import { getApiUrl } from '@/utils/env'
import { normalizeFileUrl } from '@/utils/file-url'
import CropperUpload from '@/components/cropper-upload/index.vue'
import type {
    CanvasMention,
    CanvasMentionType,
    CanvasNodeData,
    CanvasNodeExternalReference,
    CanvasNodeType
} from '../../types'

type CanvasNodeComposerOptionValue = {
    label: string
    value: string | number
}

type TextBlockType = 'p' | 'h1' | 'h2' | 'h3'
type TextListStyle = 'none' | 'bullet' | 'ordered'
type VideoFrameCaptureMode = 'current' | 'first' | 'last'
type TextEditorState = {
    blockType: TextBlockType
    bold: boolean
    italic: boolean
    listStyle: TextListStyle
}
type CanvasNodeComposerOption = {
    key: string
    icon?: string
    values: CanvasNodeComposerOptionValue[]
    defaultValue?: string | number
}

const props = defineProps<{
    node: CanvasNodeData
    selected?: boolean
    running?: boolean
    connecting?: boolean
    dragging?: boolean
    scale?: number
    nodeOptions?: CanvasNodeComposerOption[]
    externalReferences?: CanvasNodeExternalReference[]
    mentionOptions?: CanvasMention[]
}>()

const emit = defineEmits<{
    update: [id: string, patch: Record<string, any>]
    remove: [id: string]
    duplicate: [id: string]
    run: [id: string]
    pointerDown: [event: PointerEvent, id: string]
    connectStart: [event: PointerEvent, id: string, direction?: 'before' | 'after']
    connectEnd: [id: string]
    assetLibrary: [id: string]
    addToAsset: [id: string]
    downloadMedia: [id: string]
    fullscreenMedia: [id: string]
    captureVideoFrame: [id: string, blob: Blob, width: number, height: number]
    removeReferenceConnection: [targetId: string, sourceId?: string]
    contextmenu: [event: MouseEvent, id: string]
}>()

const status = computed(() => String(props.node.metadata.status || 'idle'))
const rawErrorText = computed(() =>
    String(props.node.metadata.errorDetails || props.node.metadata.error || '')
)
const isPendingGeneration = computed(() => {
    const metadata = props.node.metadata || {}
    const hasTaskId = !!String(metadata.taskId || metadata.task_id || '').trim()
    const normalizedStatus = status.value.toLowerCase()
    const normalizedError = rawErrorText.value.toLowerCase()
    return (
        Boolean(metadata.pending) ||
        (hasTaskId && ['running', 'queued', 'loading', 'processing'].includes(normalizedStatus)) ||
        (hasTaskId &&
            (rawErrorText.value.includes('仍在生成中') ||
                rawErrorText.value.includes('自动刷新') ||
                rawErrorText.value.includes('超时') ||
                normalizedError.includes('pending')))
    )
})
const isRunning = computed(
    () =>
        props.running ||
        isPendingGeneration.value ||
        status.value === 'running' ||
        status.value === 'loading' ||
        status.value === 'queued'
)
const isFailed = computed(
    () => !isPendingGeneration.value && (status.value === 'failed' || status.value === 'error')
)
const isRedrawMode = computed(() => props.node.type === 'image' && !!props.node.metadata.redrawMode)
const textValue = computed(() =>
    repairVisibleText(
        String(
            props.node.type === 'text'
                ? props.node.metadata.content || ''
                : props.node.metadata.content || props.node.metadata.prompt || ''
        )
    )
)
const promptValue = computed(() => {
    if (isRedrawMode.value) return repairVisibleText(String(props.node.metadata.redrawPrompt || ''))
    if (props.node.type === 'text') return repairVisibleText(String(props.node.metadata.prompt || ''))
    return repairVisibleText(String(props.node.metadata.prompt || props.node.metadata.content || ''))
})
const mediaUrl = computed(() =>
    normalizeCanvasMediaUrl(
        props.node.metadata.image ||
            props.node.metadata.url ||
            props.node.metadata.image_url ||
            props.node.metadata.preview_url ||
            props.node.metadata.thumbnail ||
            props.node.metadata.cover ||
            ''
    )
)
const hasMediaResult = computed(
    () =>
        (props.node.type === 'image' || props.node.type === 'video' || props.node.type === 'audio') &&
        !!mediaUrl.value &&
        !isRunning.value
)
const posterUrl = computed(() =>
    normalizeCanvasMediaUrl(
        props.node.metadata.poster ||
            props.node.metadata.cover ||
            props.node.metadata.thumbnail ||
            props.node.metadata.image ||
            props.node.metadata.url ||
            ''
    )
)
const errorText = computed(() => (isPendingGeneration.value ? '' : rawErrorText.value))
const composerCost = computed(() =>
    String(
        props.node.metadata.costLabel ||
            props.node.metadata.estimatedCost ||
            props.node.metadata.cost ||
            '1'
    )
)
const isRedrawEditing = computed(() => props.selected && isRedrawMode.value)
const redrawTool = computed(() => String(props.node.metadata.redrawTool || 'move'))
const redrawBrushSize = computed(() => Number(props.node.metadata.redrawBrushSize || 32))
const isMaterialMediaNode = computed(() => {
    if (props.node.type !== 'image' && props.node.type !== 'video' && props.node.type !== 'audio')
        return false
    const metadata = props.node.metadata || {}
    const source = String(
        metadata.mediaSource || metadata.source || metadata.origin || metadata.nodeSource || ''
    ).toLowerCase()
    if (
        [
            'local',
            'upload',
            'uploaded',
            'asset',
            'asset_library',
            'clipboard',
            'drop',
            'material'
        ].includes(source)
    )
        return true
    const hasPrompt = !!String(metadata.prompt || metadata.content || '').trim()
    const hasTask = !!String(metadata.taskId || metadata.task_id || '').trim()
    const hasGeneratedFlag = !!metadata.generatedAt || source === 'generated'
    const hasUploadFlag = !!String(
        metadata.fileName || metadata.filename || metadata.mimeType || ''
    ).trim()
    return !!mediaUrl.value && hasUploadFlag && !hasPrompt && !hasTask && !hasGeneratedFlag
})
const isUploadingMediaNode = computed(() => {
    if (props.node.type !== 'image' && props.node.type !== 'video' && props.node.type !== 'audio')
        return false
    const metadata = props.node.metadata || {}
    const source = String(
        metadata.mediaSource || metadata.source || metadata.origin || metadata.nodeSource || ''
    ).toLowerCase()
    const hasUploadFlag = !!String(
        metadata.fileName || metadata.filename || metadata.mimeType || ''
    ).trim()
    return (
        isRunning.value &&
        ([
            'local',
            'upload',
            'uploaded',
            'asset',
            'asset_library',
            'clipboard',
            'drop',
            'material'
        ].includes(source) ||
            hasUploadFlag)
    )
})
const runningPlaceholderLabel = computed(() => {
    if (isUploadingMediaNode.value) return '上传中'
    return '生成中'
})
const isPageArtboard = computed(() => Boolean(props.node.metadata.isPageArtboard))
const showComposer = computed(
    () =>
        props.selected &&
        !isPageArtboard.value &&
        (!isMaterialMediaNode.value || isRedrawMode.value)
)
const showMediaActionBar = computed(
    () =>
        props.selected &&
        (props.node.type === 'image' ||
            props.node.type === 'video' ||
            props.node.type === 'audio') &&
        !!mediaUrl.value &&
        !isRunning.value &&
        !isRedrawMode.value
)
const showTextActionBar = computed(
    () => props.selected && props.node.type === 'text' && !isPageArtboard.value && !isRunning.value
)
const showRedrawActionBar = computed(
    () =>
        props.selected &&
        props.node.type === 'image' &&
        !!mediaUrl.value &&
        !isRunning.value &&
        isRedrawMode.value
)
const nodeIcon = computed(() => {
    if (props.node.type === 'image') return '/aigc_canva/icon/pic.svg'
    if (props.node.type === 'video') return '/aigc_canva/icon/shipin.svg'
    if (props.node.type === 'audio') return '/short-drama/figma/icon/shengyin.svg'
    return '/aigc_canva/icon/text.svg'
})
const openedOption = ref('')
const uploadMenuOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const textEditorRef = ref<HTMLElement | null>(null)
const isTextEditing = ref(false)
const textEditorState = ref<TextEditorState>({
    blockType: 'p',
    bold: false,
    italic: false,
    listStyle: 'none'
})
const textSelectionRange = ref<Range | null>(null)
let richTextSyncTimer: number | null = null
let pendingRichTextContent = ''
const videoRef = ref<HTMLVideoElement | null>(null)
const videoHovered = ref(false)
const videoPlaying = ref(false)
const videoMuted = ref(true)
const videoCurrent = ref(0)
const videoDuration = ref(0)
const videoPreviewError = ref(false)
const videoRetryKey = ref(0)
const audioRef = ref<HTMLAudioElement | null>(null)
const audioPlaying = ref(false)
const audioCurrent = ref(0)
const audioDuration = ref(0)
const imagePreviewError = ref(false)
const imageRetryKey = ref(0)
const imagePreviousUrl = ref('')
const imageRevealing = ref(false)
let imageTransitionTimer: number | null = null
let titleSyncTimer: number | null = null
let pendingNodeTitle = ''
const isAudioScrubbing = ref(false)
const resumeAudioAfterScrub = ref(false)
const referenceInputRef = ref<HTMLInputElement | null>(null)
const composerEditorRef = ref<HTMLElement | null>(null)
const imageContentRef = ref<HTMLElement | null>(null)
const imageCropperRef = ref<{ openImage: (source: string, rotateSteps?: number) => void } | null>(
    null
)
const redrawImageRef = ref<HTMLImageElement | null>(null)
const redrawCanvasRef = ref<HTMLCanvasElement | null>(null)
type RedrawTool = 'move' | 'brush' | 'select' | 'erase'
type RedrawPoint = { x: number; y: number }
const redrawCanvasBox = ref({ left: 0, top: 0, width: 0, height: 0 })
const redrawMaskHistory = ref<string[]>([])
const redrawProviderMaskHistory = ref<string[]>([])
const redrawMaskHistoryIndex = ref(-1)
const isRedrawPointerDown = ref(false)
const lastRedrawPoint = ref<RedrawPoint | null>(null)
const redrawSelectStart = ref<RedrawPoint | null>(null)
const redrawSelectSnapshot = ref('')
const redrawSelectImageData = ref<ImageData | null>(null)
const composerFitScale = ref(1)
const mediaMoreOpen = ref(false)
const videoCaptureMenuOpen = ref(false)
const isCapturingVideoFrame = ref(false)
const activeRedrawTool = computed<RedrawTool>(() => {
    const tool = String(props.node.metadata.redrawTool || 'move')
    return tool === 'brush' || tool === 'select' || tool === 'erase' ? tool : 'move'
})
const redrawCanvasStyle = computed(() => ({
    left: `${redrawCanvasBox.value.left}px`,
    top: `${redrawCanvasBox.value.top}px`,
    width: `${redrawCanvasBox.value.width}px`,
    height: `${redrawCanvasBox.value.height}px`
}))
const canUndoRedrawMask = computed(() => redrawMaskHistoryIndex.value > 0)
const canRedoRedrawMask = computed(
    () =>
        redrawMaskHistoryIndex.value >= 0 &&
        redrawMaskHistoryIndex.value < redrawMaskHistory.value.length - 1
)
const inputCounterScale = computed(() => {
    const scale = Number(props.scale || 1)
    return scale > 0 ? 1 / scale : 1
})
const isZoomedIn = computed(() => Number(props.scale || 1) > 1)
const rootStyle = computed(() => ({
    width: `${props.node.width}px`,
    minHeight: `${props.node.height}px`,
    '--node-media-height': `${Math.max(250, Number(props.node.height || 250))}px`,
    '--node-text-height': `${Math.max(250, Number(props.node.height || 250))}px`,
    '--page-artboard-bg': String(props.node.metadata.background || '#ffffff'),
    '--node-text-background': String(props.node.metadata.textBackground || '#202020'),
    '--node-input-counter-scale': String(inputCounterScale.value),
    '--node-composer-fit-scale': String(composerFitScale.value),
    '--node-composer-half-width': `${320 * inputCounterScale.value}px`,
    '--node-composer-gap': `${20 * inputCounterScale.value}px`,
    '--node-action-gap': `${Math.min(48 * inputCounterScale.value, 60)}px`,
    '--node-head-space': '0px',
    '--node-head-top': `${-28 * inputCounterScale.value}px`,
    '--node-port-offset': '18px',
    '--node-text-port-top': '50%',
    '--node-media-port-top': '50%'
}))
const textBlockType = computed(() =>
    isTextEditing.value
        ? textEditorState.value.blockType
        : normalizeTextBlockType(String(props.node.metadata.textBlockType || 'p'))
)
const textListStyle = computed(() =>
    isTextEditing.value
        ? textEditorState.value.listStyle
        : normalizeTextListStyle(String(props.node.metadata.textListStyle || 'none'))
)
const textBold = computed(() =>
    isTextEditing.value ? textEditorState.value.bold : Boolean(props.node.metadata.textBold)
)
const textItalic = computed(() =>
    isTextEditing.value ? textEditorState.value.italic : Boolean(props.node.metadata.textItalic)
)
const textBackground = computed(() => String(props.node.metadata.textBackground || '#202020'))
const textBackgroundOpen = ref(false)
const textBackgroundColors = ['#202020', '#292929', '#1f2937', '#2b2028', '#1f2b25', '#302617']
const textExpanded = ref(false)
const previousTextBodyOverflow = ref('')
const previousTextHtmlOverflow = ref('')
const textBodyScrollLocked = ref(false)
const textDisplayClass = computed(() => ({
    'is-h1': textBlockType.value === 'h1',
    'is-h2': textBlockType.value === 'h2',
    'is-h3': textBlockType.value === 'h3',
    'is-p': textBlockType.value === 'p',
    'is-list-bullet': textListStyle.value === 'bullet',
    'is-list-ordered': textListStyle.value === 'ordered',
    'is-bold': textBold.value,
    'is-italic': textItalic.value
}))
const textDisplayHtml = computed(() =>
    textRichHtml.value ||
    renderTextDisplayHtml(textValue.value, {
        listStyle: textListStyle.value
    })
)
const textRichHtml = computed(() => sanitizeRichTextHtml(String(props.node.metadata.richContent || '')))
const textEditorHtml = computed(() => textDisplayHtml.value)
const imageCropSize = computed(() => {
    const width = Math.max(1, Number(props.node.metadata.imageWidth || props.node.width || 250))
    const height = Math.max(1, Number(props.node.metadata.imageHeight || props.node.height || 250))
    const longestEdge = Math.max(width, height)
    const scale = longestEdge > 1600 ? 1600 / longestEdge : 1
    return {
        width: Math.max(48, Math.round(width * scale)),
        height: Math.max(48, Math.round(height * scale))
    }
})
const defaultAudioWaveBars = [
    22, 38, 54, 32, 76, 47, 64, 92, 44, 70, 108, 62, 34, 83, 52, 96, 72, 118, 58, 39,
    86, 68, 104, 49, 78, 38, 63, 90, 45, 72, 31, 56
]
const audioWaveBars = ref([...defaultAudioWaveBars])
let audioWaveformRequestId = 0
const videoProgress = computed(() =>
    videoDuration.value > 0 ? Math.min(1, Math.max(0, videoCurrent.value / videoDuration.value)) : 0
)
const audioProgress = computed(() =>
    audioDuration.value > 0 ? Math.min(1, Math.max(0, audioCurrent.value / audioDuration.value)) : 0
)

const composerPlaceholder = computed(() => {
    if (isRedrawMode.value) return '开始你的设计'
    if (props.node.type === 'text' || props.node.type === 'config')
        return '描述你想要生成的文本内容，@引用素材'
    if (props.node.type === 'image') return '描述你想要生成的画面内容，@引用素材'
    if (props.node.type === 'audio') return '描述你想要生成的音乐内容，@引用素材'
    return '描述你想要生成的视频内容，@引用素材'
})

const referenceAccept = computed(() => {
    if (props.node.type === 'audio') return 'audio/*'
    return props.node.type === 'video' ? 'image/*,video/*' : 'image/*'
})
const referenceItems = computed(() => {
    const images = Array.isArray(props.node.metadata.referenceImages)
        ? props.node.metadata.referenceImages
        : []
    const videos = Array.isArray(props.node.metadata.referenceVideos)
        ? props.node.metadata.referenceVideos
        : []
    const audios = Array.isArray(props.node.metadata.referenceAudios)
        ? props.node.metadata.referenceAudios
        : []
    const hasMaskReference = images.some(
        (item) => item.role === 'redraw_mask' || item.url === props.node.metadata.redrawMaskImage
    )
    const maskImage = String(props.node.metadata.redrawMaskImage || '').trim()
    const redrawMaskReferences =
        maskImage && !hasMaskReference
            ? [{ url: maskImage, name: '蒙版', role: 'redraw_mask' }]
            : []
    return [
        ...images.map((item, index) => ({
            key: `image-${index}-${item.url}`,
            type: 'image' as const,
            url: normalizeCanvasMediaUrl(item.url),
            rawUrl: item.url,
            name: item.name || ''
        })),
        ...redrawMaskReferences.map((item, index) => ({
            key: `redraw-mask-${index}-${item.url}`,
            type: 'image' as const,
            url: normalizeCanvasMediaUrl(item.url),
            rawUrl: item.url,
            name: item.name || '',
            role: item.role
        })),
        ...videos.map((item, index) => ({
            key: `video-${index}-${item.url}`,
            type: 'video' as const,
            url: normalizeCanvasMediaUrl(item.url),
            rawUrl: item.url,
            name: item.name || ''
        })),
        ...audios.map((item, index) => ({
            key: `audio-${index}-${item.url}`,
            type: 'audio' as const,
            url: normalizeCanvasMediaUrl(item.url),
            rawUrl: item.url,
            name: item.name || ''
        }))
    ].filter((item) => item.url)
})
const externalDisplayReferences = computed(() =>
    (props.externalReferences || [])
        .map((item, index) => ({
            key: `linked-${item.sourceId || index}-${item.type}-${item.url || item.text || ''}`,
            type: item.type,
            url: item.url ? normalizeCanvasMediaUrl(item.url) : '',
            text:
                item.type === 'text'
                    ? '文本'
                    : formatReferenceText(item.text || item.name || '参考文本'),
            sourceId: item.sourceId
        }))
        .filter((item) => item.type === 'text' || item.url)
)
const displayReferenceItems = computed(() => [
    ...referenceItems.value,
    ...externalDisplayReferences.value
])
const mentionMenuOpen = ref(false)
const activeMentionTab = ref<'canvas' | 'asset'>('canvas')
const mentionOptions = computed(() =>
    (props.mentionOptions || []).filter((item) => item.id && item.name)
)
const selectedMentions = computed<CanvasMention[]>(() =>
    (Array.isArray(props.node.metadata.mentions) ? props.node.metadata.mentions : []).filter(
        (item: any) => item && typeof item === 'object' && item.id && item.name
    )
)
const selectedMentionIds = computed(() => selectedMentions.value.map((item) => item.id))
const normalizedMentionOptions = computed(() => {
    const labels: Record<CanvasMentionType, string> = {
        text: '文本',
        image: '图片',
        video: '视频',
        audio: '音乐',
        asset: '资产'
    }
    const sourceLabels: Record<string, string> = {
        node: '画布元素',
        reference: '参考对象',
        connection: '连线对象',
        asset: '资产库'
    }
    return mentionOptions.value.map((item) => ({
        ...item,
        sourceLabel: sourceLabels[item.source] || item.source || labels[item.type],
        previewUrl: mentionPreviewUrl(item),
        previewType: mentionPreviewType(item),
        previewIcon: mentionPreviewIcon(item)
    }))
})
const canvasMentionItems = computed(() =>
    normalizedMentionOptions.value.filter((item) => item.source !== 'asset')
)
const assetMentionItems = computed(() =>
    normalizedMentionOptions.value.filter((item) => item.source === 'asset')
)
const mentionTabs = computed(() => [
    { key: 'canvas' as const, label: '画布元素', count: canvasMentionItems.value.length },
    { key: 'asset' as const, label: '资产', count: assetMentionItems.value.length }
])
const activeMentionItems = computed(() =>
    activeMentionTab.value === 'asset' ? assetMentionItems.value : canvasMentionItems.value
)

const fallbackComposerCatalog: Record<CanvasNodeType, CanvasNodeComposerOption[]> = {
    text: [{ key: 'model_code', values: [{ label: '默认模型', value: '' }], defaultValue: '' }],
    config: [{ key: 'model_code', values: [{ label: '默认模型', value: '' }], defaultValue: '' }],
    image: [
        {
            key: 'channel',
            values: [{ label: '生图模型', value: 'gpt_image_2' }],
            defaultValue: 'gpt_image_2'
        },
        { key: 'ratio', values: [{ label: '16:9', value: '16:9' }], defaultValue: '16:9' },
        { key: 'quality', values: [{ label: '1K', value: '1k' }], defaultValue: '1k' },
        { key: 'quantity', values: [{ label: '1', value: 1 }], defaultValue: 1 }
    ],
    video: [
        {
            key: 'channel',
            values: [{ label: '视频模型', value: 'seedance2_pro' }],
            defaultValue: 'seedance2_pro'
        },
        { key: 'ratio', values: [{ label: '16:9', value: '16:9' }], defaultValue: '16:9' },
        { key: 'duration', values: [{ label: '5秒', value: 5 }], defaultValue: 5 },
        {
            key: 'mode',
            values: [
                { label: 'Pro', value: 'pro' },
                { label: 'Fast', value: 'fast' }
            ],
            defaultValue: 'pro'
        },
        { key: 'quantity', values: [{ label: '1', value: 1 }], defaultValue: 1 }
    ],
    audio: [
        {
            key: 'duration',
            values: [
                { label: '30秒', value: 30 },
                { label: '60秒', value: 60 },
                { label: '120秒', value: 120 }
            ],
            defaultValue: 30
        },
        {
            key: 'instrumental',
            values: [
                { label: '人声', value: 0 },
                { label: '纯音乐', value: 1 }
            ],
            defaultValue: 0
        }
    ]
}

const composerOptions = computed(() => {
    const list =
        props.nodeOptions ||
        fallbackComposerCatalog[props.node.type] ||
        fallbackComposerCatalog.text
    const redrawConfig =
        props.node.metadata.redrawConfig && typeof props.node.metadata.redrawConfig === 'object'
            ? props.node.metadata.redrawConfig
            : {}
    return list
        .filter((item) => {
            if (item.key === 'quantity' && item.values.length <= 1) return false
            return true
        })
        .map((item) => {
            const rawValue =
                (isRedrawMode.value ? redrawConfig[item.key] : undefined) ??
                props.node.metadata[item.key] ??
                item.defaultValue ??
                item.values[0]?.value ??
                ''
            return {
                ...item,
                currentValue: normalizeOptionValue(rawValue),
                selectedLabel: resolveOptionLabel(item, rawValue)
            }
        })
})

function updateComposerFitScale() {
    if (typeof window === 'undefined') return
    composerFitScale.value = Math.min(1, Math.max(0.45, (window.innerWidth - 32) / 640))
}

function syncTextExpandedScroll(visible: boolean) {
    if (typeof window === 'undefined') return
    if (visible && !textBodyScrollLocked.value) {
        previousTextHtmlOverflow.value = document.documentElement.style.overflow
        previousTextBodyOverflow.value = document.body.style.overflow
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        textBodyScrollLocked.value = true
        return
    }
    if (!visible && textBodyScrollLocked.value) {
        document.documentElement.style.overflow = previousTextHtmlOverflow.value
        document.body.style.overflow = previousTextBodyOverflow.value
        textBodyScrollLocked.value = false
    }
}

onMounted(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    window.addEventListener('resize', syncRedrawCanvas)
    window.addEventListener('resize', updateComposerFitScale)
    window.addEventListener('canvas-node-audio-play', handleCanvasAudioPlay)
    updateComposerFitScale()
    nextTick(renderComposerEditor)
    if (props.node.type === 'audio') void loadAudioWaveform(mediaUrl.value)
})

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    window.removeEventListener('resize', syncRedrawCanvas)
    window.removeEventListener('resize', updateComposerFitScale)
    window.removeEventListener('canvas-node-audio-play', handleCanvasAudioPlay)
    window.removeEventListener('pointermove', handleAudioScrubMove)
    window.removeEventListener('pointerup', stopAudioScrubbing)
    window.removeEventListener('pointercancel', stopAudioScrubbing)
    if (imageTransitionTimer !== null) window.clearTimeout(imageTransitionTimer)
    if (richTextSyncTimer !== null) window.clearTimeout(richTextSyncTimer)
    if (titleSyncTimer !== null) {
        window.clearTimeout(titleSyncTimer)
        emit('update', props.node.id, { title: pendingNodeTitle })
    }
    audioWaveformRequestId += 1
    syncTextExpandedScroll(false)
    audioRef.value?.pause()
})

watch([isRedrawEditing, mediaUrl, () => props.scale], async () => {
    if (!isRedrawEditing.value) {
        resetRedrawRuntimeState()
        return
    }
    ensureRedrawHistory()
    await syncRedrawCanvas()
})

watch(
    () => props.node.metadata.redrawMaskImage,
    async (value) => {
        if (!isRedrawEditing.value) return
        if (!redrawMaskHistory.value.length) ensureRedrawHistory(String(value || ''))
        await syncRedrawCanvas(String(value || ''))
    }
)

watch(
    [promptValue, selectedMentions, showComposer],
    () => {
        nextTick(renderComposerEditor)
    },
    { deep: true }
)

watch(
    [() => props.selected, isTextEditing],
    async () => {
        if (props.selected && props.node.type === 'text' && isTextEditing.value) {
            await nextTick()
            textEditorRef.value?.focus()
        }
    }
)

watch(
    () => props.selected,
    (selected) => {
        if (!selected) isTextEditing.value = false
        if (!selected) mediaMoreOpen.value = false
        if (!selected) videoCaptureMenuOpen.value = false
        if (!selected) textBackgroundOpen.value = false
    }
)

watch(mediaUrl, (nextUrl, previousUrl) => {
    if (
        props.node.type === 'image' &&
        previousUrl &&
        nextUrl &&
        previousUrl !== nextUrl
    ) {
        if (imageTransitionTimer !== null) {
            window.clearTimeout(imageTransitionTimer)
            imageTransitionTimer = null
        }
        imagePreviousUrl.value = previousUrl
        imageRevealing.value = false
    } else if (!nextUrl) {
        imagePreviousUrl.value = ''
        imageRevealing.value = false
    }
    videoHovered.value = false
    videoPlaying.value = false
    videoCurrent.value = 0
    videoDuration.value = 0
    videoPreviewError.value = false
    videoCaptureMenuOpen.value = false
    audioPlaying.value = false
    audioCurrent.value = 0
    audioDuration.value = 0
    imagePreviewError.value = false
    if (props.node.type === 'audio') void loadAudioWaveform(nextUrl)
})

watch(textExpanded, (visible) => {
    syncTextExpandedScroll(visible)
})

function normalizeOptionValue(value: unknown) {
    return typeof value === 'number' ? value : String(value ?? '')
}

function resolveOptionLabel(option: CanvasNodeComposerOption, value: unknown) {
    const normalized = normalizeOptionValue(value)
    const matched = option.values.find((item) => normalizeOptionValue(item.value) === normalized)
    return matched?.label || String(value || option.values[0]?.label || option.key)
}

function resetNodePortMagnet(event: PointerEvent) {
    const port = event.currentTarget as HTMLElement | null
    const icon = port?.querySelector<HTMLElement>('.node-port-icon')
    if (!icon) return
    icon.style.removeProperty('--node-port-magnet-x')
    icon.style.removeProperty('--node-port-magnet-y')
}

function moveNodePortMagnet(event: PointerEvent) {
    const port = event.currentTarget as HTMLElement | null
    const icon = port?.querySelector<HTMLElement>('.node-port-icon')
    if (!port || !icon) return
    const rect = port.getBoundingClientRect()
    const scale = Math.max(Number(props.scale || 1), 0.05)
    const offsetX = (event.clientX - (rect.left + rect.width / 2)) / scale
    const offsetY = (event.clientY - (rect.top + rect.height / 2)) / scale
    const isLeftPort = port.classList.contains('node-port-left')
    const horizontalBounds = isLeftPort ? { left: 40, right: 24 } : { left: 24, right: 40 }

    if (
        offsetX < -horizontalBounds.left ||
        offsetX > horizontalBounds.right ||
        offsetY < -40 ||
        offsetY > 40
    ) {
        resetNodePortMagnet(event)
        return
    }

    icon.style.setProperty('--node-port-magnet-x', `${offsetX}px`)
    icon.style.setProperty('--node-port-magnet-y', `${offsetY}px`)
}

function handlePointerDown(event: PointerEvent) {
    event.stopPropagation()
    const target = event.target as HTMLElement | null
    if (target?.closest('button,input,textarea,label,[contenteditable=true]')) return
    if (props.node.type === 'text' && target?.closest('.node-body')) return
    emit('pointerDown', event, props.node.id)
}

function playPreviewVideo() {
    if (props.node.type !== 'video' || !mediaUrl.value || isRunning.value) return
    const video = videoRef.value
    if (!video) return
    video.muted = videoMuted.value
    video.loop = false
    if (video.ended) video.currentTime = 0
    const result = video.play()
    if (result && typeof result.catch === 'function') result.catch(() => {})
}

function pausePreviewVideo() {
    if (props.node.type !== 'video' || props.selected) return
    videoHovered.value = false
    videoRef.value?.pause()
}

function setVideoHover(hovered: boolean) {
    videoHovered.value = hovered
    if (hovered) {
        playPreviewVideo()
        return
    }
    pausePreviewVideo()
}

function syncVideoState() {
    const video = videoRef.value
    if (!video) return
    videoCurrent.value = Number.isFinite(video.currentTime) ? video.currentTime : 0
    videoDuration.value = Number.isFinite(video.duration) ? video.duration : 0
}

function toggleVideoPlayback() {
    const video = videoRef.value
    if (!video) return
    if (video.paused) {
        if (video.ended) video.currentTime = 0
        const result = video.play()
        if (result && typeof result.catch === 'function') result.catch(() => {})
        return
    }
    video.pause()
}

function toggleVideoMute() {
    const video = videoRef.value
    videoMuted.value = !videoMuted.value
    if (video) video.muted = videoMuted.value
}

function retryVideoPreview() {
    videoPreviewError.value = false
    videoRetryKey.value += 1
}

function waitForVideoSeek(video: HTMLVideoElement, timeoutMs = 2500) {
    return new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            cleanup()
            reject(new Error('Video seek timed out'))
        }, timeoutMs)
        const cleanup = () => {
            window.clearTimeout(timeout)
            video.removeEventListener('seeked', onSeeked)
            video.removeEventListener('error', onError)
        }
        const onSeeked = () => {
            cleanup()
            resolve()
        }
        const onError = () => {
            cleanup()
            reject(new Error('Video seek failed'))
        }
        video.addEventListener('seeked', onSeeked, { once: true })
        video.addEventListener('error', onError, { once: true })
    })
}

function toggleVideoCaptureMenu() {
    openedOption.value = ''
    uploadMenuOpen.value = false
    mentionMenuOpen.value = false
    mediaMoreOpen.value = false
    videoCaptureMenuOpen.value = !videoCaptureMenuOpen.value
}

function resolveVideoCaptureTime(video: HTMLVideoElement, mode: VideoFrameCaptureMode) {
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    if (mode === 'current') return Math.max(0.001, video.currentTime)

    const params = props.node.metadata.params || {}
    const rawTrimStart = Number(props.node.metadata.trimStart ?? params.trimStart)
    const rawTrimEnd = Number(props.node.metadata.trimEnd ?? params.trimEnd)
    const trimStart = Number.isFinite(rawTrimStart) && rawTrimStart >= 0 ? rawTrimStart : 0
    const trimEnd = Number.isFinite(rawTrimEnd) && rawTrimEnd > trimStart ? rawTrimEnd : duration
    if (!Number.isFinite(trimEnd) || trimEnd <= trimStart) return null
    return mode === 'first'
        ? Math.max(0.001, trimStart)
        : Math.max(trimStart, trimEnd - 0.001)
}

async function loadVideoFrame(source: string, time: number) {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                cleanup()
                reject(new Error('Video load timed out'))
            }, 30000)
            const cleanup = () => {
                window.clearTimeout(timeout)
                video.removeEventListener('loadedmetadata', onLoadedMetadata)
                video.removeEventListener('error', onError)
            }
            const onLoadedMetadata = () => {
                const duration = Number.isFinite(video.duration) ? video.duration : time
                const targetTime = Math.max(0.001, Math.min(time, Math.max(0.001, duration - 0.001)))
                const seeked = waitForVideoSeek(video, 30000)
                seeked.then(resolve).catch(reject).finally(cleanup)
                video.currentTime = targetTime
            }
            const onError = () => {
                cleanup()
                reject(new Error('Video load failed'))
            }
            video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
            video.addEventListener('error', onError, { once: true })
            video.src = source
        })

        const width = Number(video.videoWidth || 0)
        const height = Number(video.videoHeight || 0)
        if (!width || !height) throw new Error('Video dimensions unavailable')
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas context unavailable')
        context.drawImage(video, 0, 0, width, height)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('Frame encoding failed')
        return { blob, width, height }
    } finally {
        video.removeAttribute('src')
        video.load()
    }
}

async function captureVideoFrame(mode: VideoFrameCaptureMode = 'current') {
    videoCaptureMenuOpen.value = false
    const video = videoRef.value
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        ElMessage.warning('视频尚未加载完成')
        return
    }
    const source = mediaUrl.value
    if (!source) return
    const captureTime = resolveVideoCaptureTime(video, mode)
    if (captureTime === null) {
        ElMessage.warning('视频时长尚未加载完成')
        return
    }
    isCapturingVideoFrame.value = true
    try {
        const { blob, width, height } = await loadVideoFrame(source, captureTime)
        emit('captureVideoFrame', props.node.id, blob, width, height)
    } catch {
        ElMessage.warning('截帧失败，请重试')
    } finally {
        isCapturingVideoFrame.value = false
    }
}

function seekVideo(event: Event) {
    const video = videoRef.value
    if (!video) return
    const nextTime = Number((event.currentTarget as HTMLInputElement).value)
    if (!Number.isFinite(nextTime)) return
    video.currentTime = nextTime
    videoCurrent.value = nextTime
}

function formatVideoTime(value: number) {
    const seconds = Number.isFinite(value) && value > 0 ? value : 0
    return `${seconds.toFixed(1)}s`
}

function retryImagePreview() {
    imagePreviewError.value = false
    imageRetryKey.value += 1
}

function playReferenceVideo(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement | null
    const videos =
        target?.querySelectorAll<HTMLVideoElement>('.reference-video-preview video') || []
    videos.forEach((video) => {
        video.muted = true
        video.loop = false
        video.currentTime = 0
        const result = video.play()
        if (result && typeof result.catch === 'function') result.catch(() => {})
    })
}

function stopReferenceVideo(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement | null
    const videos =
        target?.querySelectorAll<HTMLVideoElement>('.reference-video-preview video') || []
    videos.forEach((video) => {
        video.pause()
        video.currentTime = 0
    })
}

function selectForEditing(event: PointerEvent) {
    event.stopPropagation()
    if (event.button !== 0 || isRunning.value) return
    emit('pointerDown', event, props.node.id)
}

function handleComposerEditorPointerDown(event: PointerEvent) {
    event.stopPropagation()
}

function updateTitle(title: string) {
    pendingNodeTitle = title
    if (titleSyncTimer !== null) window.clearTimeout(titleSyncTimer)
    titleSyncTimer = window.setTimeout(() => {
        emit('update', props.node.id, { title: pendingNodeTitle })
        titleSyncTimer = null
    }, 1000)
}

function updateText(content: string) {
    emit('update', props.node.id, { metadata: { content, prompt: content } })
}

function syncAudioState() {
    const audio = audioRef.value
    if (!audio) return
    audioCurrent.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    audioDuration.value = Number.isFinite(audio.duration) ? audio.duration : 0
}

async function loadAudioWaveform(source: string) {
    const requestId = ++audioWaveformRequestId
    audioWaveBars.value = [...defaultAudioWaveBars]
    if (!source || typeof window === 'undefined') return
    const AudioContextCtor =
        window.AudioContext ||
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
    if (!AudioContextCtor) return
    let context: AudioContext | null = null
    try {
        const response = await fetch(source)
        if (!response.ok) throw new Error('Audio source request failed')
        const buffer = await response.arrayBuffer()
        context = new AudioContextCtor()
        const decoded = await context.decodeAudioData(buffer)
        if (requestId !== audioWaveformRequestId || !decoded.numberOfChannels) return
        const samples = decoded.getChannelData(0)
        const sourceBars = 100
        const chunkSize = Math.max(1, Math.floor(samples.length / sourceBars))
        const amplitudes = Array.from({ length: sourceBars }, (_, index) => {
            const start = index * chunkSize
            const end = Math.min(samples.length, start + chunkSize)
            let total = 0
            for (let cursor = start; cursor < end; cursor += 1) total += Math.abs(samples[cursor])
            return end > start ? total / (end - start) : 0
        })
        const peak = Math.max(...amplitudes, 0.0001)
        const visibleBars = defaultAudioWaveBars.length
        audioWaveBars.value = Array.from({ length: visibleBars }, (_, index) => {
            const sourceIndex = Math.min(
                amplitudes.length - 1,
                Math.floor((index / Math.max(1, visibleBars - 1)) * (amplitudes.length - 1))
            )
            return Math.max(12, Math.round((amplitudes[sourceIndex] / peak) * 120))
        })
    } catch {
        // Keep the stable placeholder waveform when the source cannot be decoded client-side.
    } finally {
        if (context) void context.close().catch(() => {})
    }
}

function audioWaveBarStyle(index: number, height: number) {
    const progress = index / Math.max(1, audioWaveBars.value.length - 1)
    const played = progress <= audioProgress.value
    return {
        height: `${height}px`,
        background: played
            ? `linear-gradient(to ${index % 2 === 0 ? 'bottom' : 'top'}, rgba(153, 153, 153, 0.6), #fff)`
            : 'rgba(255, 255, 255, 0.25)'
    }
}

function handleCanvasAudioPlay(event: Event) {
    const detail = (event as CustomEvent<{ nodeId?: string }>).detail
    if (detail?.nodeId === props.node.id) return
    audioRef.value?.pause()
}

function requestAudioPlayback() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('canvas-node-audio-play', { detail: { nodeId: props.node.id } })
        )
    }
}

function playAudio() {
    const audio = audioRef.value
    if (!audio) return
    requestAudioPlayback()
    const result = audio.play()
    if (result && typeof result.catch === 'function') result.catch(() => {})
}

function toggleAudioPlayback() {
    const audio = audioRef.value
    if (!audio) return
    if (audio.paused) {
        playAudio()
        return
    }
    audio.pause()
}

function updateAudioSeekFromPointer(event: PointerEvent, waveform?: HTMLElement) {
    const audio = audioRef.value
    if (!audio) return
    const target = waveform || (event.currentTarget as HTMLElement)
    const rect = target.getBoundingClientRect()
    if (!rect.width || !audioDuration.value) return
    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const nextTime = progress * audioDuration.value
    audio.currentTime = nextTime
    audioCurrent.value = nextTime
}

function handleAudioScrubMove(event: PointerEvent) {
    if (!isAudioScrubbing.value) return
    const waveform = rootRef.value?.querySelector<HTMLElement>('.audio-waveform')
    if (!waveform) return
    updateAudioSeekFromPointer(event, waveform)
}

function startAudioScrubbing(event: PointerEvent) {
    const audio = audioRef.value
    if (!audio) return
    event.preventDefault()
    resumeAudioAfterScrub.value = !audio.paused
    if (resumeAudioAfterScrub.value) audio.pause()
    isAudioScrubbing.value = true
    updateAudioSeekFromPointer(event)
    window.addEventListener('pointermove', handleAudioScrubMove)
    window.addEventListener('pointerup', stopAudioScrubbing)
    window.addEventListener('pointercancel', stopAudioScrubbing)
}

function stopAudioScrubbing() {
    if (!isAudioScrubbing.value) return
    isAudioScrubbing.value = false
    window.removeEventListener('pointermove', handleAudioScrubMove)
    window.removeEventListener('pointerup', stopAudioScrubbing)
    window.removeEventListener('pointercancel', stopAudioScrubbing)
    if (resumeAudioAfterScrub.value) playAudio()
    resumeAudioAfterScrub.value = false
}

function skipAudio(delta: number) {
    const audio = audioRef.value
    if (!audio) return
    const limit = Number.isFinite(audio.duration) ? audio.duration : audioDuration.value
    const nextTime = Math.min(Math.max(0, audio.currentTime + delta), Math.max(0, limit || 0))
    audio.currentTime = nextTime
    audioCurrent.value = nextTime
}

function updateTextContent(content: string) {
    emit('update', props.node.id, { metadata: { content, richContent: '' } })
}

function sanitizeRichTextHtml(value: string) {
    const source = String(value || '').trim()
    if (!source) return ''
    if (typeof document === 'undefined') return ''
    const allowedTags = new Set([
        'div',
        'p',
        'h1',
        'h2',
        'h3',
        'strong',
        'b',
        'em',
        'i',
        'code',
        'ul',
        'ol',
        'li',
        'hr',
        'br',
        'blockquote'
    ])
    const container = document.createElement('div')
    container.innerHTML = source
    const serialize = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '')
        if (node.nodeType !== Node.ELEMENT_NODE) return ''
        const element = node as HTMLElement
        const tag = element.tagName.toLowerCase()
        const children = Array.from(element.childNodes).map(serialize).join('')
        if (!allowedTags.has(tag)) return children
        if (tag === 'br' || tag === 'hr') return `<${tag} />`
        const normalizedTag = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag
        return `<${normalizedTag}>${children}</${normalizedTag}>`
    }
    return Array.from(container.childNodes).map(serialize).join('').trim()
}

function richTextToPlainText(value: string) {
    if (typeof document === 'undefined') return String(value || '').replace(/<[^>]*>/g, '')
    const container = document.createElement('div')
    container.innerHTML = value
    return String(container.innerText || container.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function updateRichTextContent(event: Event) {
    const editor = event.currentTarget as HTMLElement | null
    if (!editor) return
    const richContent = sanitizeRichTextHtml(editor.innerHTML)
    pendingRichTextContent = richContent
    if (richTextSyncTimer !== null) window.clearTimeout(richTextSyncTimer)
    richTextSyncTimer = window.setTimeout(() => {
        emitRichTextContent(pendingRichTextContent)
        richTextSyncTimer = null
    }, 300)
}

function emitRichTextContent(richContent: string) {
    emit('update', props.node.id, {
        metadata: {
            content: richTextToPlainText(richContent),
            richContent
        }
    })
}

function handleRichTextInput(event: Event) {
    updateRichTextContent(event)
    syncTextEditorState()
}

function getTextEditor() {
    const refEditor = textEditorRef.value
    if (refEditor?.isContentEditable) return refEditor
    if (typeof window === 'undefined') return null
    const anchor = window.getSelection()?.anchorNode
    const anchorElement =
        anchor?.nodeType === Node.ELEMENT_NODE
            ? (anchor as HTMLElement)
            : (anchor?.parentElement as HTMLElement | null)
    const selectionEditor = anchorElement?.closest<HTMLElement>(
        '.text-editor[contenteditable="true"]'
    )
    if (selectionEditor) return selectionEditor
    return rootRef.value?.querySelector<HTMLElement>('.text-editor[contenteditable="true"]') || null
}

function captureTextSelection(editor = getTextEditor()) {
    if (!editor || typeof window === 'undefined') return
    const selection = window.getSelection()
    if (!selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode)) return
    textSelectionRange.value = selection.getRangeAt(0).cloneRange()
}

function restoreTextSelection(editor: HTMLElement) {
    const range = textSelectionRange.value
    if (!range || !editor.contains(range.commonAncestorContainer)) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
}

function syncTextEditorState() {
    const editor = getTextEditor()
    const selection = typeof window === 'undefined' ? null : window.getSelection()
    const anchor = selection?.anchorNode
    if (!editor || !anchor || !editor.contains(anchor)) return
    captureTextSelection(editor)
    const element =
        anchor.nodeType === Node.ELEMENT_NODE
            ? (anchor as HTMLElement)
            : (anchor.parentElement as HTMLElement | null)
    const block = element?.closest('h1,h2,h3,p,div,li')
    const list = element?.closest('ul,ol')
    textEditorState.value = {
        blockType: block?.tagName.toLowerCase() === 'h1'
            ? 'h1'
            : block?.tagName.toLowerCase() === 'h2'
              ? 'h2'
              : block?.tagName.toLowerCase() === 'h3'
                ? 'h3'
                : 'p',
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        listStyle: list?.tagName.toLowerCase() === 'ul'
            ? 'bullet'
            : list?.tagName.toLowerCase() === 'ol'
              ? 'ordered'
              : 'none'
    }
}

function persistTextEditor() {
    const editor = getTextEditor()
    if (!editor) return false
    const richContent = sanitizeRichTextHtml(editor.innerHTML)
    pendingRichTextContent = richContent
    if (richTextSyncTimer !== null) {
        window.clearTimeout(richTextSyncTimer)
        richTextSyncTimer = null
    }
    emitRichTextContent(richContent)
    syncTextEditorState()
    return true
}

function applyTextEditorCommand(command: string, value?: string) {
    const editor = getTextEditor()
    if (!editor || typeof document === 'undefined') return false
    editor.focus({ preventScroll: true })
    restoreTextSelection(editor)
    document.execCommand(command, false, value)
    captureTextSelection(editor)
    persistTextEditor()
    return true
}

function updateTextFormatting(patch: Record<string, any>) {
    emit('update', props.node.id, { metadata: patch })
}

function startTextEditing() {
    if (props.node.type !== 'text' || isRunning.value) return
    isTextEditing.value = true
    textSelectionRange.value = null
    nextTick(() => {
        textEditorRef.value?.focus()
        syncTextEditorState()
    })
}

function finishTextEditing() {
    persistTextEditor()
    isTextEditing.value = false
    textSelectionRange.value = null
}

function normalizeTextBlockType(value: string): TextBlockType {
    return ['h1', 'h2', 'h3'].includes(value) ? (value as TextBlockType) : 'p'
}

function normalizeTextListStyle(value: string): TextListStyle {
    return ['bullet', 'ordered'].includes(value) ? (value as TextListStyle) : 'none'
}

function setTextBlock(type: TextBlockType) {
    if (applyTextEditorCommand('formatBlock', type === 'p' ? '<div>' : `<${type}>`)) return
    updateTextFormatting({
        textBlockType: type,
        textListStyle: 'none'
    })
}

function toggleTextList(style: Exclude<TextListStyle, 'none'>) {
    if (applyTextEditorCommand(style === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList')) return
    updateTextFormatting({
        textListStyle: textListStyle.value === style ? 'none' : style,
        textBlockType: 'p'
    })
}

function toggleTextBold() {
    if (applyTextEditorCommand('bold')) return
    updateTextFormatting({ textBold: !textBold.value })
}

function toggleTextItalic() {
    if (applyTextEditorCommand('italic')) return
    updateTextFormatting({ textItalic: !textItalic.value })
}

function insertTextDivider() {
    const editor = getTextEditor()
    if (editor && typeof document !== 'undefined') {
        editor.focus({ preventScroll: true })
        document.execCommand('insertHTML', false, '<hr /><div><br /></div>')
        persistTextEditor()
        return
    }
    const current = textValue.value.trim()
    const next = current ? `${current}\n\n---` : '---'
    updateTextContent(next)
    if (!isTextEditing.value) startTextEditing()
}

function toggleTextBackgroundMenu() {
    textBackgroundOpen.value = !textBackgroundOpen.value
}

function setTextBackground(color: string) {
    updateTextFormatting({ textBackground: color })
    textBackgroundOpen.value = false
}

async function copyTextContent() {
    const content = String(textValue.value || '').trim()
    if (!content) {
        ElMessage.warning('当前文本节点没有可复制的内容')
        return
    }
    try {
        await navigator.clipboard.writeText(content)
        ElMessage.success('已复制文本内容')
    } catch {
        const textarea = document.createElement('textarea')
        textarea.value = content
        textarea.setAttribute('readonly', 'readonly')
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        textarea.remove()
        if (copied) {
            ElMessage.success('已复制文本内容')
        } else {
            ElMessage.warning('复制失败，请手动选择文本')
        }
    }
}

function toggleTextExpanded() {
    textExpanded.value = !textExpanded.value
}

function closeTextExpanded() {
    textExpanded.value = false
    textBackgroundOpen.value = false
    finishTextEditing()
}

function escapeHtml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function renderInlineMarkdown(line: string) {
    return escapeHtml(line)
        .replace(/`([^`]+)`/g, '<code class="text-display-code">$1</code>')
        .replace(/(?:\*\*|__)(.+?)(?:\*\*|__)/g, '<strong>$1</strong>')
        .replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/(^|[^\w_])_([^_\n]+)_/g, '$1<em>$2</em>')
        .replace(/\u00a0/g, ' ')
}

function renderTextDisplayHtml(value: string, state: { listStyle: TextListStyle }) {
    const lines = String(value || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
    const inline = (line: string) => renderInlineMarkdown(line)

    if (state.listStyle !== 'none') {
        const items = lines
            .map((line) => line.trim())
            .filter((line) => line && line !== '---')
            .map((line) => line.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, ''))
        const tag = state.listStyle === 'ordered' ? 'ol' : 'ul'
        const body = items.length
            ? items.map((line) => `<li>${inline(line)}</li>`).join('')
            : '<li><br /></li>'
        return `<${tag} class="text-display-list">${body}</${tag}>`
    }

    const blocks: string[] = []
    let listType: 'ul' | 'ol' | null = null
    let listItems: string[] = []
    const flushList = () => {
        if (!listType) return
        blocks.push(`<${listType} class="text-display-list">${listItems.join('')}</${listType}>`)
        listType = null
        listItems = []
    }

    lines.forEach((line) => {
        const trimmed = line.trim()
        const bullet = trimmed.match(/^[-*+]\s+(.+)$/)
        const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)
        const nextListType = bullet ? 'ul' : ordered ? 'ol' : null
        if (nextListType) {
            if (listType && listType !== nextListType) flushList()
            listType = nextListType
            listItems.push(`<li>${inline(bullet?.[1] || ordered?.[1] || '')}</li>`)
            return
        }
        flushList()
        if (trimmed === '---') {
            blocks.push('<hr class="text-display-divider" />')
            return
        }
        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
            const level = heading[1].length
            blocks.push(
                `<h${level} class="text-display-markdown-h${level}">${inline(heading[2])}</h${level}>`
            )
            return
        }
        blocks.push(`<div class="text-display-block">${trimmed ? inline(line) : '<br />'}</div>`)
    })
    flushList()
    return blocks.join('')
}

function mentionPreviewType(item: CanvasMention): 'image' | 'video' | 'audio' | 'text' {
    const assetType = String(item.asset_type || item.role || '').toLowerCase()
    const mimeType = String(item.mime_type || '').toLowerCase()
    const previewUrl = String(item.preview_url || '').trim()
    if (previewUrl && !isLikelyVideoUrl(previewUrl)) return 'image'
    if (item.type === 'video' || assetType.includes('video') || mimeType.startsWith('video/'))
        return 'video'
    if (item.type === 'audio' || assetType.includes('audio') || mimeType.startsWith('audio/'))
        return 'audio'
    if (item.type === 'image' || assetType.includes('image') || mimeType.startsWith('image/'))
        return 'image'
    if (
        item.type === 'asset' &&
        item.url &&
        !assetType.includes('audio') &&
        !mimeType.startsWith('audio/')
    )
        return 'image'
    return 'text'
}

function mentionPreviewUrl(item: CanvasMention) {
    const type = mentionPreviewType(item)
    if (type === 'text' || type === 'audio') return ''
    if (type === 'image') return normalizeCanvasMediaUrl(item.preview_url || item.url || '')
    return normalizeCanvasMediaUrl(
        isLikelyVideoUrl(item.preview_url) ? item.preview_url : item.url || ''
    )
}

function mentionPreviewIcon(item: CanvasMention) {
    if (mentionPreviewType(item) === 'video') return '/aigc_canva/icon/shipin.svg'
    if (mentionPreviewType(item) === 'image') return '/aigc_canva/icon/pic.svg'
    if (mentionPreviewType(item) === 'audio') return '/short-drama/figma/icon/shengyin.svg'
    return '/aigc_canva/icon/text.svg'
}

function isLikelyVideoUrl(value: unknown) {
    return /\.(mp4|webm|mov|m4v|avi|mkv)(?:[?#].*)?$/i.test(String(value || '').trim())
}

function readComposerEditorText() {
    const editor = composerEditorRef.value
    if (!editor) return promptValue.value
    const readNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
        if (!(node instanceof HTMLElement)) return ''
        if (node.classList.contains('composer-mention-chip'))
            return node.dataset.name ? `@${node.dataset.name}` : node.textContent || ''
        if (node.tagName === 'BR') return '\n'
        return Array.from(node.childNodes).map(readNode).join('')
    }
    return Array.from(editor.childNodes)
        .map(readNode)
        .join('')
        .replace(/\u00a0/g, ' ')
        .trim()
}

function syncComposerFromEditor() {
    const prompt = readComposerEditorText()
    const chips = Array.from(
        composerEditorRef.value?.querySelectorAll<HTMLElement>('.composer-mention-chip') || []
    )
    const chipIds = new Set(chips.map((chip) => chip.dataset.id || '').filter(Boolean))
    const typedMentions = mentionOptions.value.filter((item) => prompt.includes(`@${item.name}`))
    const mentions = mentionOptions.value.filter(
        (item) => chipIds.has(item.id) || typedMentions.some((typed) => typed.id === item.id)
    )
    updatePromptWithMentions(prompt, mentions)
}

function updatePromptWithMentions(prompt: string, mentions = selectedMentions.value) {
    if (isRedrawMode.value) {
        emit('update', props.node.id, { metadata: { redrawPrompt: prompt, mentions } })
        return
    }
    emit('update', props.node.id, { metadata: { prompt, mentions } })
}

function renderComposerEditor() {
    const editor = composerEditorRef.value
    if (!editor) return
    if (document.activeElement !== editor) renderMentionedEditorText(editor, promptValue.value)
}

function renderMentionedEditorText(editor: HTMLElement, text: string) {
    const mentions = [...selectedMentions.value].sort((a, b) => b.name.length - a.name.length)
    editor.innerHTML = ''
    const source = String(text || '')
    let cursor = 0
    while (cursor < source.length) {
        const match = findNextMention(source, cursor, mentions)
        if (!match) {
            editor.appendChild(document.createTextNode(source.slice(cursor)))
            break
        }
        if (match.index > cursor)
            editor.appendChild(document.createTextNode(source.slice(cursor, match.index)))
        editor.appendChild(createMentionChip(match.mention))
        cursor = match.index + match.value.length
    }
}

function findNextMention(text: string, start: number, mentions: CanvasMention[]) {
    let cursor = Math.max(0, start)
    while (cursor < text.length) {
        const index = text.indexOf('@', cursor)
        if (index < 0) return null
        const mention = mentions.find(
            (item) => item.name && text.startsWith(`@${item.name}`, index)
        )
        if (mention) return { index, value: `@${mention.name}`, mention }
        cursor = index + 1
    }
    return null
}

function createMentionChip(item: CanvasMention) {
    const chip = document.createElement('span')
    chip.className = 'composer-mention-chip'
    chip.contentEditable = 'false'
    chip.dataset.id = item.id
    chip.dataset.name = item.name
    chip.dataset.type = item.type
    const previewUrl = mentionPreviewUrl(item)
    const previewType = mentionPreviewType(item)
    if (previewUrl) {
        const media =
            previewType === 'video'
                ? document.createElement('video')
                : document.createElement('img')
        media.className = 'composer-mention-chip__thumb'
        media.setAttribute('src', previewUrl)
        media.setAttribute('draggable', 'false')
        if (media instanceof HTMLVideoElement) {
            media.muted = true
            media.playsInline = true
            media.preload = 'metadata'
        } else {
            media.alt = ''
        }
        chip.appendChild(media)
    } else {
        const icon = document.createElement('img')
        icon.className = 'composer-mention-chip__thumb composer-mention-chip__thumb--icon'
        icon.src = mentionPreviewIcon(item)
        icon.alt = ''
        icon.draggable = false
        chip.appendChild(icon)
    }
    const label = document.createElement('span')
    label.className = 'composer-mention-chip__label'
    label.textContent = `@${item.name}`
    chip.appendChild(label)
    return chip
}

function appendMentionToComposer(item: CanvasMention) {
    const editor = composerEditorRef.value
    if (!editor) return
    editor.focus()
    const existed = Array.from(editor.querySelectorAll<HTMLElement>('.composer-mention-chip')).some(
        (chip) => chip.dataset.id === item.id
    )
    if (existed) return
    editor.appendChild(createMentionChip(item))
    editor.appendChild(document.createTextNode(' '))
    placeCaretAtEditorEnd()
    syncComposerFromEditor()
}

function selectMentionItem(item: CanvasMention) {
    appendMentionToComposer(item)
    mentionMenuOpen.value = false
}

function toggleMentionMenu() {
    openedOption.value = ''
    uploadMenuOpen.value = false
    mentionMenuOpen.value = !mentionMenuOpen.value
    if (mentionMenuOpen.value) nextTick(() => composerEditorRef.value?.focus())
}

function clearMentions() {
    const editor = composerEditorRef.value
    editor?.querySelectorAll('.composer-mention-chip').forEach((chip) => chip.remove())
    mentionMenuOpen.value = false
    updatePromptWithMentions(readComposerEditorText(), [])
}

function removePreviousMentionChip() {
    const selection = window.getSelection()
    const editor = composerEditorRef.value
    if (!selection?.isCollapsed || !editor || !editor.contains(selection.anchorNode)) return false
    const node = selection.anchorNode
    const offset = selection.anchorOffset
    if (!node) return false
    if (node.nodeType === Node.TEXT_NODE) {
        if (
            offset > 1 ||
            String(node.textContent || '')
                .slice(0, offset)
                .trim()
        )
            return false
        const previous = node.previousSibling
        if (
            previous instanceof HTMLElement &&
            previous.classList.contains('composer-mention-chip')
        ) {
            node.textContent = String(node.textContent || '').slice(offset)
            previous.remove()
            syncComposerFromEditor()
            placeCaretAtEditorEnd()
            return true
        }
        return false
    }
    if (node === editor && offset > 0) {
        const previous = editor.childNodes[offset - 1]
        const chip =
            previous instanceof HTMLElement && previous.classList.contains('composer-mention-chip')
                ? previous
                : previous?.previousSibling instanceof HTMLElement &&
                    previous.previousSibling.classList.contains('composer-mention-chip')
                  ? previous.previousSibling
                  : null
        if (chip) {
            if (previous.nodeType === Node.TEXT_NODE && previous.textContent?.trim() === '')
                previous.remove()
            chip.remove()
            syncComposerFromEditor()
            placeCaretAtEditorEnd()
            return true
        }
    }
    return false
}

function handleComposerKeydown(event: KeyboardEvent) {
    if (event.key === 'Backspace' && removePreviousMentionChip()) {
        event.preventDefault()
        return
    }
    if (event.key === '@') {
        mentionMenuOpen.value = true
    }
}

function handleComposerPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text/plain') || ''
    if (!text) return
    document.execCommand('insertText', false, text)
    nextTick(syncComposerFromEditor)
}

function placeCaretAtEditorEnd() {
    const editor = composerEditorRef.value
    if (!editor) return
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
}

function enterRedrawMode() {
    emit('update', props.node.id, {
        metadata: {
            redrawMode: true,
            redrawTool: 'move',
            redrawBrushSize: props.node.metadata.redrawBrushSize || 32,
            redrawPrompt: '',
            redrawConfig: {},
            redrawOriginalComposer: {
                prompt: props.node.metadata.prompt || '',
                content: props.node.metadata.content || '',
                channel: props.node.metadata.channel,
                quality: props.node.metadata.quality,
                ratio: props.node.metadata.ratio,
                quantity: props.node.metadata.quantity,
                style: props.node.metadata.style,
                negative_prompt: props.node.metadata.negative_prompt,
                model: props.node.metadata.model,
                resolution: props.node.metadata.resolution,
                size: props.node.metadata.size,
                count: props.node.metadata.count
            }
        }
    })
}

function exitRedrawMode() {
    const originalComposer =
        props.node.metadata.redrawOriginalComposer &&
        typeof props.node.metadata.redrawOriginalComposer === 'object'
            ? props.node.metadata.redrawOriginalComposer
            : { prompt: '', content: '' }
    emit('update', props.node.id, {
        metadata: {
            ...originalComposer,
            redrawMode: false,
            redrawMaskImage: '',
            redrawTool: undefined,
            redrawBrushSize: undefined,
            redrawPrompt: '',
            redrawConfig: undefined,
            redrawProviderMaskImage: '',
            redrawOriginalComposer: undefined
        }
    })
}

function setRedrawTool(tool: RedrawTool) {
    emit('update', props.node.id, { metadata: { redrawTool: tool } })
}

function setRedrawBrushSize(value: string) {
    const size = Math.max(8, Math.min(80, Number(value) || 32))
    emit('update', props.node.id, { metadata: { redrawBrushSize: size } })
}

function resetRedrawRuntimeState() {
    redrawMaskHistory.value = []
    redrawProviderMaskHistory.value = []
    redrawMaskHistoryIndex.value = -1
    isRedrawPointerDown.value = false
    lastRedrawPoint.value = null
    redrawSelectStart.value = null
    redrawSelectSnapshot.value = ''
    redrawSelectImageData.value = null
}

function updateNaturalMediaSize(width: number, height: number) {
    if (
        (props.node.type !== 'image' && props.node.type !== 'video') ||
        width <= 0 ||
        height <= 0
    )
        return
    const widthKey = props.node.type === 'image' ? 'imageWidth' : 'videoWidth'
    const heightKey = props.node.type === 'image' ? 'imageHeight' : 'videoHeight'
    if (
        Number(props.node.metadata[widthKey] || 0) === width &&
        Number(props.node.metadata[heightKey] || 0) === height &&
        props.node.metadata.mediaPreviewRatioActive === true
    )
        return
    emit('update', props.node.id, {
        metadata: {
            [widthKey]: width,
            [heightKey]: height,
            mediaWidth: width,
            mediaHeight: height,
            mediaPreviewRatioActive: true
        }
    })
}

function handleImageLoaded(event: Event) {
    void syncRedrawCanvas()
    const image = event.currentTarget as HTMLImageElement | null
    updateNaturalMediaSize(Number(image?.naturalWidth || 0), Number(image?.naturalHeight || 0))
    if (imagePreviousUrl.value && imagePreviousUrl.value !== mediaUrl.value) {
        requestAnimationFrame(() => {
            imageRevealing.value = true
            if (imageTransitionTimer !== null) window.clearTimeout(imageTransitionTimer)
            imageTransitionTimer = window.setTimeout(() => {
                imagePreviousUrl.value = ''
                imageRevealing.value = false
                imageTransitionTimer = null
            }, 2100)
        })
    }
}

function handleVideoMetadataLoaded(event: Event) {
    const video = event.currentTarget as HTMLVideoElement | null
    updateNaturalMediaSize(Number(video?.videoWidth || 0), Number(video?.videoHeight || 0))
    syncVideoState()
}

function ensureRedrawHistory(snapshot = String(props.node.metadata.redrawMaskImage || '')) {
    if (redrawMaskHistory.value.length) return
    redrawMaskHistory.value = [snapshot]
    redrawProviderMaskHistory.value = [String(props.node.metadata.redrawProviderMaskImage || '')]
    redrawMaskHistoryIndex.value = 0
}

async function syncRedrawCanvas(snapshot?: unknown) {
    if (!isRedrawEditing.value) return
    const maskSnapshot =
        typeof snapshot === 'string' ? snapshot : String(props.node.metadata.redrawMaskImage || '')
    await nextTick()
    const content = imageContentRef.value
    const image = redrawImageRef.value
    const canvas = redrawCanvasRef.value
    if (!content || !image || !canvas) return
    const contentWidth = content.clientWidth
    const contentHeight = content.clientHeight
    if (!contentWidth || !contentHeight) return
    const naturalWidth = image.naturalWidth || contentWidth
    const naturalHeight = image.naturalHeight || contentHeight
    const imageRatio = naturalWidth / Math.max(1, naturalHeight)
    const contentRatio = contentWidth / Math.max(1, contentHeight)
    let width = contentWidth
    let height = contentHeight
    let left = 0
    let top = 0
    if (imageRatio > contentRatio) {
        height = width / imageRatio
        top = (contentHeight - height) / 2
    } else {
        width = height * imageRatio
        left = (contentWidth - width) / 2
    }
    redrawCanvasBox.value = { left, top, width, height }
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    const ctx = getRedrawCanvasContext()
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    restoreRedrawMask(maskSnapshot)
}

function getRedrawCanvasContext() {
    return redrawCanvasRef.value?.getContext('2d') || null
}

function restoreRedrawMask(snapshot = '') {
    const canvas = redrawCanvasRef.value
    const ctx = getRedrawCanvasContext()
    if (!canvas || !ctx) return
    const width = redrawCanvasBox.value.width || canvas.clientWidth
    const height = redrawCanvasBox.value.height || canvas.clientHeight
    ctx.clearRect(0, 0, width, height)
    if (!snapshot) return
    const image = new Image()
    image.onload = () => {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0, width, height)
    }
    image.src = snapshot
}

function redrawPointFromEvent(event: PointerEvent): RedrawPoint | null {
    const canvas = redrawCanvasRef.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
        x: ((event.clientX - rect.left) / rect.width) * redrawCanvasBox.value.width,
        y: ((event.clientY - rect.top) / rect.height) * redrawCanvasBox.value.height
    }
}

function saveRedrawMask() {
    const canvas = redrawCanvasRef.value
    if (!canvas) return ''
    const image = redrawImageRef.value
    const width = Math.max(
        1,
        Math.round(image?.naturalWidth || redrawCanvasBox.value.width || canvas.width)
    )
    const height = Math.max(
        1,
        Math.round(image?.naturalHeight || redrawCanvasBox.value.height || canvas.height)
    )
    const output = document.createElement('canvas')
    output.width = width
    output.height = height
    const ctx = output.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height)
    return output.toDataURL('image/png')
}

function pushRedrawMaskHistory(snapshot: string, providerSnapshot = snapshot) {
    const current = redrawMaskHistory.value[redrawMaskHistoryIndex.value]
    if (current === snapshot) return
    redrawMaskHistory.value = [
        ...redrawMaskHistory.value.slice(0, redrawMaskHistoryIndex.value + 1),
        snapshot
    ]
    redrawProviderMaskHistory.value = [
        ...redrawProviderMaskHistory.value.slice(0, redrawMaskHistoryIndex.value + 1),
        providerSnapshot
    ]
    redrawMaskHistoryIndex.value = redrawMaskHistory.value.length - 1
}

function commitRedrawMask(snapshot = saveRedrawMask()) {
    const providerSnapshot = snapshot
    pushRedrawMaskHistory(snapshot, providerSnapshot)
    emit('update', props.node.id, {
        metadata: { redrawMaskImage: snapshot, redrawProviderMaskImage: providerSnapshot }
    })
}

function startRedrawDrawing(event: PointerEvent) {
    if (!isRedrawEditing.value || isRunning.value) return
    if (activeRedrawTool.value === 'move') return
    event.stopPropagation()
    event.preventDefault()
    ensureRedrawHistory()
    const canvas = redrawCanvasRef.value
    const ctx = getRedrawCanvasContext()
    const point = redrawPointFromEvent(event)
    if (!canvas || !ctx || !point) return
    isRedrawPointerDown.value = true
    canvas.setPointerCapture?.(event.pointerId)
    if (activeRedrawTool.value === 'select') {
        redrawSelectStart.value = point
        redrawSelectSnapshot.value = saveRedrawMask()
        redrawSelectImageData.value = ctx.getImageData(0, 0, canvas.width, canvas.height)
        return
    }
    lastRedrawPoint.value = point
    drawRedrawSegment(point, point)
}

function drawRedrawMask(event: PointerEvent) {
    if (!isRedrawPointerDown.value) return
    event.stopPropagation()
    event.preventDefault()
    const point = redrawPointFromEvent(event)
    if (!point) return
    if (activeRedrawTool.value === 'select') {
        drawRedrawSelection(point)
        return
    }
    if (!lastRedrawPoint.value) {
        lastRedrawPoint.value = point
        return
    }
    drawRedrawSegment(lastRedrawPoint.value, point)
    lastRedrawPoint.value = point
}

function stopRedrawDrawing(event?: PointerEvent) {
    if (!isRedrawPointerDown.value) return
    event?.stopPropagation()
    event?.preventDefault()
    isRedrawPointerDown.value = false
    lastRedrawPoint.value = null
    redrawSelectStart.value = null
    redrawSelectSnapshot.value = ''
    redrawSelectImageData.value = null
    if (event) redrawCanvasRef.value?.releasePointerCapture?.(event.pointerId)
    commitRedrawMask()
}

function drawRedrawSegment(from: RedrawPoint, to: RedrawPoint) {
    const ctx = getRedrawCanvasContext()
    if (!ctx) return
    ctx.globalCompositeOperation =
        activeRedrawTool.value === 'erase' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = 'rgba(255,255,255,1)'
    ctx.lineWidth = redrawBrushSize.value
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
}

function drawRedrawSelection(current: RedrawPoint) {
    const canvas = redrawCanvasRef.value
    const ctx = getRedrawCanvasContext()
    const start = redrawSelectStart.value
    if (!canvas || !ctx || !start) return
    if (redrawSelectImageData.value) {
        const dpr = window.devicePixelRatio || 1
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.putImageData(redrawSelectImageData.value, 0, 0)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    } else {
        restoreRedrawMask(redrawSelectSnapshot.value)
    }
    const left = Math.min(start.x, current.x)
    const top = Math.min(start.y, current.y)
    const width = Math.abs(current.x - start.x)
    const height = Math.abs(current.y - start.y)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(255,255,255,1)'
    ctx.fillRect(left, top, width, height)
}

function undoRedrawMask() {
    if (!canUndoRedrawMask.value) return
    redrawMaskHistoryIndex.value -= 1
    const snapshot = redrawMaskHistory.value[redrawMaskHistoryIndex.value] || ''
    const providerSnapshot = redrawProviderMaskHistory.value[redrawMaskHistoryIndex.value] || ''
    restoreRedrawMask(snapshot)
    emit('update', props.node.id, {
        metadata: { redrawMaskImage: snapshot, redrawProviderMaskImage: providerSnapshot }
    })
}

function redoRedrawMask() {
    if (!canRedoRedrawMask.value) return
    redrawMaskHistoryIndex.value += 1
    const snapshot = redrawMaskHistory.value[redrawMaskHistoryIndex.value] || ''
    const providerSnapshot = redrawProviderMaskHistory.value[redrawMaskHistoryIndex.value] || ''
    restoreRedrawMask(snapshot)
    emit('update', props.node.id, {
        metadata: { redrawMaskImage: snapshot, redrawProviderMaskImage: providerSnapshot }
    })
}

function toggleComposerOption(key: string) {
    uploadMenuOpen.value = false
    mentionMenuOpen.value = false
    mediaMoreOpen.value = false
    textBackgroundOpen.value = false
    openedOption.value = openedOption.value === key ? '' : key
}

function setComposerOption(key: string, value: string | number) {
    openedOption.value = ''
    if (isRedrawMode.value) {
        const redrawConfig =
            props.node.metadata.redrawConfig && typeof props.node.metadata.redrawConfig === 'object'
                ? props.node.metadata.redrawConfig
                : {}
        emit('update', props.node.id, {
            metadata: { redrawConfig: { ...redrawConfig, [key]: value } }
        })
        return
    }
    emit('update', props.node.id, { metadata: { [key]: value } })
}

function handleDocumentPointerDown(event: PointerEvent) {
    if (
        !openedOption.value &&
        !uploadMenuOpen.value &&
        !mentionMenuOpen.value &&
        !mediaMoreOpen.value &&
        !videoCaptureMenuOpen.value &&
        !textBackgroundOpen.value
    )
        return
    const target = event.target as HTMLElement | null
    if (!target || !rootRef.value?.contains(target)) {
        openedOption.value = ''
        uploadMenuOpen.value = false
        mentionMenuOpen.value = false
        mediaMoreOpen.value = false
        videoCaptureMenuOpen.value = false
        textBackgroundOpen.value = false
        return
    }
    if (openedOption.value && !target.closest('.composer-select-wrap')) openedOption.value = ''
    if (uploadMenuOpen.value && !target.closest('.composer-upload-wrap'))
        uploadMenuOpen.value = false
    if (mentionMenuOpen.value && !target.closest('.composer-mention-wrap'))
        mentionMenuOpen.value = false
    if (mediaMoreOpen.value && !target.closest('.media-more-menu, .action-icon-only'))
        mediaMoreOpen.value = false
    if (videoCaptureMenuOpen.value && !target.closest('.video-capture-wrap'))
        videoCaptureMenuOpen.value = false
    if (textBackgroundOpen.value && !target.closest('.text-background-picker'))
        textBackgroundOpen.value = false
}

function openImageCropper(rotateSteps = 0) {
    if (!mediaUrl.value) return
    mediaMoreOpen.value = false
    void imageCropperRef.value?.openImage(mediaUrl.value, rotateSteps)
}

function handleCroppedImage(url: string) {
    const image = String(url || '').trim()
    if (!image) return
    emit('update', props.node.id, {
        metadata: {
            image,
            url: image,
            status: 'success',
            errorDetails: '',
            mediaSource: 'edited',
            sourceImage: props.node.metadata.sourceImage || mediaUrl.value
        }
    })
}

function toggleMediaMore() {
    openedOption.value = ''
    uploadMenuOpen.value = false
    mentionMenuOpen.value = false
    mediaMoreOpen.value = !mediaMoreOpen.value
}

function duplicateMediaNode() {
    mediaMoreOpen.value = false
    emit('duplicate', props.node.id)
}

function removeMediaNode() {
    mediaMoreOpen.value = false
    emit('remove', props.node.id)
}

function toggleUploadMenu() {
    openedOption.value = ''
    mentionMenuOpen.value = false
    textBackgroundOpen.value = false
    uploadMenuOpen.value = !uploadMenuOpen.value
}

function triggerLocalReferenceUpload() {
    uploadMenuOpen.value = false
    referenceInputRef.value?.click()
}

function selectAssetReference() {
    uploadMenuOpen.value = false
    emit('assetLibrary', props.node.id)
}

function removeReference(item: { type: 'image' | 'video' | 'audio'; rawUrl: string; role?: string }) {
    if (item.type === 'audio') {
        const referenceAudios = (
            Array.isArray(props.node.metadata.referenceAudios)
                ? props.node.metadata.referenceAudios
                : []
        ).filter((ref) => ref.url !== item.rawUrl)
        emit('update', props.node.id, {
            metadata: {
                referenceAudios,
                referenceCount:
                    referenceAudios.length +
                    (props.node.metadata.referenceImages?.length || 0) +
                    (props.node.metadata.referenceVideos?.length || 0)
            }
        })
        return
    }
    if (item.type === 'video') {
        const referenceVideos = (
            Array.isArray(props.node.metadata.referenceVideos)
                ? props.node.metadata.referenceVideos
                : []
        ).filter((ref) => ref.url !== item.rawUrl)
        emit('update', props.node.id, {
            metadata: {
                referenceVideos,
                referenceCount:
                    referenceVideos.length + (props.node.metadata.referenceImages?.length || 0)
            }
        })
        return
    }
    const referenceImages = (
        Array.isArray(props.node.metadata.referenceImages)
            ? props.node.metadata.referenceImages
            : []
    ).filter((ref) => ref.url !== item.rawUrl)
    emit('update', props.node.id, {
        metadata: {
            referenceImages,
            referenceCount:
                referenceImages.length + (props.node.metadata.referenceVideos?.length || 0),
            redrawMaskImage: item.role === 'redraw_mask' ? '' : props.node.metadata.redrawMaskImage
        }
    })
}

function formatReferenceText(text: string) {
    const value = repairVisibleText(String(text || '')).trim()
    return value.length > 22 ? `${value.slice(0, 22)}...` : value
}

function repairVisibleText(value: string) {
    return value
        .replaceAll('\u74A7\u52EA\u9A87\u7459\u55DB\uE576', '资产视频')
        .replaceAll('璧勪骇鍥剧墖', '资产图片')
        .replaceAll('鍓湰', '副本')
        .replaceAll('宸茶嚜鍔ㄤ繚瀛?', '已自动保存')
}

function getRatioPreviewStyle(value: string | number) {
    const [w, h] = String(value || '')
        .split(':')
        .map((item) => Number(item))
    if (!w || !h) return { width: '16px', height: '10px' }
    const width = w >= h ? 18 : Math.max(8, Math.round((w / h) * 18))
    const height = h > w ? 18 : Math.max(8, Math.round((h / w) * 18))
    return { width: `${Math.min(18, width)}px`, height: `${Math.min(18, height)}px` }
}

async function handleReferenceUpload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    appendReference(file, localUrl)
    try {
        const res: any = file.type.startsWith('audio/')
            ? await uploadAppFile({ file })
            : file.type.startsWith('video/')
              ? await uploadAppVideo({ file })
              : await uploadAppImage({ file })
        const uri = pickUploadUri(res)
        if (!uri) throw new Error('upload response missing url')
        replaceReference(localUrl, file, uri)
        URL.revokeObjectURL(localUrl)
    } catch (error) {
        emit('update', props.node.id, {
            metadata: { errorDetails: error instanceof Error ? error.message : '上传失败' }
        })
    }
    input.value = ''
}

function appendReference(file: File, url: string) {
    if (file.type.startsWith('audio/')) {
        const referenceAudios = [
            ...(Array.isArray(props.node.metadata.referenceAudios)
                ? props.node.metadata.referenceAudios
                : []),
            { url, name: file.name }
        ]
        emit('update', props.node.id, {
            metadata: {
                referenceAudios,
                referenceCount:
                    referenceAudios.length +
                    (props.node.metadata.referenceImages?.length || 0) +
                    (props.node.metadata.referenceVideos?.length || 0)
            }
        })
        return
    }
    if (file.type.startsWith('video/')) {
        const referenceVideos = [
            ...(Array.isArray(props.node.metadata.referenceVideos)
                ? props.node.metadata.referenceVideos
                : []),
            { url, name: file.name }
        ]
        emit('update', props.node.id, {
            metadata: {
                referenceVideos,
                referenceCount:
                    referenceVideos.length + (props.node.metadata.referenceImages?.length || 0)
            }
        })
        return
    }
    const role = props.node.type === 'video' ? 'first_frame_image' : 'reference_image'
    const referenceImages = [
        ...(Array.isArray(props.node.metadata.referenceImages)
            ? props.node.metadata.referenceImages
            : []),
        { url, name: file.name, role }
    ]
    emit('update', props.node.id, {
        metadata: {
            referenceImages,
            referenceCount:
                referenceImages.length + (props.node.metadata.referenceVideos?.length || 0)
        }
    })
}

function replaceReference(fromUrl: string, file: File, toUrl: string) {
    if (file.type.startsWith('audio/')) {
        const current = Array.isArray(props.node.metadata.referenceAudios)
            ? props.node.metadata.referenceAudios
            : []
        const referenceAudios = current.map((item) =>
            item.url === fromUrl ? { ...item, url: toUrl, name: item.name || file.name } : item
        )
        if (!referenceAudios.some((item) => item.url === toUrl))
            referenceAudios.push({ url: toUrl, name: file.name })
        emit('update', props.node.id, {
            metadata: {
                referenceAudios,
                referenceCount:
                    referenceAudios.length +
                    (props.node.metadata.referenceImages?.length || 0) +
                    (props.node.metadata.referenceVideos?.length || 0)
            }
        })
        return
    }
    if (file.type.startsWith('video/')) {
        const current = Array.isArray(props.node.metadata.referenceVideos)
            ? props.node.metadata.referenceVideos
            : []
        const referenceVideos = current.map((item) =>
            item.url === fromUrl ? { ...item, url: toUrl, name: item.name || file.name } : item
        )
        if (!referenceVideos.some((item) => item.url === toUrl))
            referenceVideos.push({ url: toUrl, name: file.name })
        emit('update', props.node.id, {
            metadata: {
                referenceVideos,
                referenceCount:
                    referenceVideos.length + (props.node.metadata.referenceImages?.length || 0)
            }
        })
        return
    }
    const role = props.node.type === 'video' ? 'first_frame_image' : 'reference_image'
    const current = Array.isArray(props.node.metadata.referenceImages)
        ? props.node.metadata.referenceImages
        : []
    const referenceImages = current.map((item) =>
        item.url === fromUrl
            ? { ...item, url: toUrl, name: item.name || file.name, role: item.role || role }
            : item
    )
    if (!referenceImages.some((item) => item.url === toUrl))
        referenceImages.push({ url: toUrl, name: file.name, role })
    emit('update', props.node.id, {
        metadata: {
            referenceImages,
            referenceCount:
                referenceImages.length + (props.node.metadata.referenceVideos?.length || 0)
        }
    })
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

function getConnectionAnchor(side: 'left' | 'right') {
    const root = rootRef.value
    if (!root) return null
    const target = root.querySelector<HTMLElement>(
        '.media-frame, .node-body > textarea, .node-body'
    )
    if (!target) return null
    const scale = Number(props.scale || 1) || 1
    const rootRect = root.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const x = side === 'right' ? targetRect.right - rootRect.left : targetRect.left - rootRect.left
    const y = targetRect.top + targetRect.height / 2 - rootRect.top
    return {
        x: props.node.position.x + x / scale,
        y: props.node.position.y + y / scale
    }
}

defineExpose({ playPreviewVideo, getConnectionAnchor })
</script>

<style scoped lang="scss">
.native-canvas-node {
    position: absolute;
    z-index: 1;
    border: 0;
    border-radius: 20px;
    background: transparent;
    color: #f4f4f5;
    cursor: grab;
    overflow: visible;
    pointer-events: none;
    user-select: none;
}

.native-canvas-node.is-page-artboard {
    z-index: 0;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 2px;
    background: var(--page-artboard-bg);
    box-shadow: none;
    pointer-events: auto;
}

.native-canvas-node.is-page-artboard .node-body {
    height: 100%;
    min-height: inherit;
    border-radius: 2px;
    background: var(--page-artboard-bg);
}

.page-artboard-body {
    width: 100%;
    height: 100%;
    min-height: inherit;
}

.node-head {
    position: absolute;
    left: 0;
    top: var(--node-head-top);
    z-index: 19;
    display: block;
    width: max-content;
    height: calc(20px * var(--node-input-counter-scale));
    padding: 0;
    color: rgba(255, 255, 255, 0.58);
    overflow: visible;
    box-sizing: border-box;
    pointer-events: auto;
}

.node-head-inner {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 4px;
    transform: scale(var(--node-input-counter-scale));
    transform-origin: left top;
    white-space: nowrap;
}

.node-kind {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 18px;
    height: 20px;
    border-radius: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
}

.node-kind img {
    display: block;
    width: 12px;
    height: 12px;
    max-width: 12px;
    max-height: 12px;
    object-fit: contain;
    opacity: 0.86;
}

.node-kind-audio img {
    width: 12px;
    height: 12px;
    max-width: 12px;
    max-height: 12px;
    transform: scale(1.38);
    transform-origin: center;
}

.node-head-title,
.node-title-edit,
.node-title-measure,
.node-head input {
    min-width: 0;
    max-width: 160px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
}

.node-head-title {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.node-title-edit {
    position: relative;
    display: inline-block;
    width: max-content;
}

.node-title-measure {
    display: block;
    visibility: hidden;
    padding: 0 2px;
    white-space: pre;
}

.node-head input {
    position: absolute;
    inset: 0;
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    padding: 0 2px;
}

.node-body {
    position: relative;
    display: grid;
    margin-top: var(--node-head-space);
    min-height: 112px;
    padding: 18px 22px;
    border: 1px solid transparent;
    border-radius: 16px;
    background: #1f1f1f;
    box-shadow: none;
    backdrop-filter: none;
    box-sizing: border-box;
    pointer-events: auto;
}

.image-action-bar,
.redraw-action-bar {
    position: absolute;
    left: 50%;
    bottom: calc(100% + var(--node-action-gap));
    z-index: 1001;
    display: flex;
    align-items: center;
    gap: 4px;
    width: max-content;
    max-width: 820px;
    height: 48px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(31, 31, 31, 0.8);
    color: rgba(255, 255, 255, 0.92);
    box-shadow: none;
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    transform: translateX(-50%) scale(var(--node-input-counter-scale));
    transform-origin: center bottom;
    user-select: none;
}

.image-action-bar {
    overflow: visible;
}

.text-action-bar {
    position: absolute;
    left: 50%;
    top: calc(var(--node-head-space) - var(--node-action-gap) - 48px);
    z-index: 1001;
    display: flex;
    align-items: center;
    gap: 4px;
    width: max-content;
    max-width: 820px;
    height: 48px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(31, 31, 31, 0.8);
    color: rgba(255, 255, 255, 0.92);
    box-shadow: none;
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    transform: translateX(-50%) scale(var(--node-input-counter-scale));
    transform-origin: center bottom;
    pointer-events: auto;
    user-select: none;
}

.text-expanded-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: rgba(0, 0, 0, 0.56);
    backdrop-filter: blur(8px);
    pointer-events: auto;
}

.text-expanded-dialog {
    display: flex;
    flex-direction: column;
    width: min(1060px, 86vw);
    height: min(810px, 82vh);
    min-height: 520px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 22px;
    background: #111;
    color: rgba(255, 255, 255, 0.92);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    box-sizing: border-box;
}

.text-expanded-header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 62px;
    padding: 10px 22px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    box-sizing: border-box;
    user-select: none;
}

.text-expanded-toolbar {
    position: absolute;
    left: 50%;
    top: 50%;
    display: flex;
    align-items: center;
    gap: 4px;
    transform: translate(-50%, -50%);
}

.text-expanded-copy {
    margin-right: auto;
}

.text-expanded-close {
    margin-left: auto;
}

.text-expanded-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.text-expanded-body .text-display-content,
.text-expanded-body .text-display-placeholder {
    padding: 22px 24px;
    color: rgba(255, 255, 255, 0.92);
    font-size: 16px;
    font-weight: 500;
    line-height: 1.7;
}

.text-expanded-body textarea {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 22px 24px;
    border: 0;
    outline: 0;
    resize: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.92);
    font-size: 16px;
    font-weight: 500;
    line-height: 1.7;
    box-sizing: border-box;
}

.text-expanded-body textarea::placeholder {
    color: rgba(255, 255, 255, 0.42);
}

.redraw-action-bar {
    max-width: none;
}

.native-canvas-node.selected,
.native-canvas-node:has(.composer-select-menu),
.native-canvas-node:has(.composer-upload-menu),
.native-canvas-node:has(.composer-reference-thumb:hover),
.native-canvas-node:has(.text-action-bar),
.native-canvas-node:has(.redraw-action-bar) {
    z-index: 1000;
}

.image-action-bar button,
.redraw-action-bar button,
.text-action-bar button,
.text-expanded-header button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    padding: 0 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
}

.image-action-bar button:hover,
.redraw-action-bar button:hover:not(:disabled),
.text-action-bar button:hover,
.text-expanded-header button:hover,
.redraw-tool.active,
.text-tool.active {
    background: #25262b;
}

.image-action-bar button.is-danger:hover,
.text-action-bar button.is-danger:hover {
    background: rgba(239, 68, 68, 0.14);
}

.image-action-bar button.is-danger:hover .action-icon-img,
.text-action-bar button.is-danger:hover .action-icon-img {
    filter: invert(72%) sepia(18%) saturate(924%) hue-rotate(316deg) brightness(101%) contrast(96%);
}

.text-action-bar .text-tool,
.text-expanded-toolbar .text-tool,
.text-expanded-copy {
    width: 40px;
    padding: 0;
    cursor: pointer;
}

.text-background-picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.text-background-swatch {
    display: block;
    width: 15px;
    height: 15px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}

.text-background-menu {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    z-index: 4;
    display: grid;
    grid-template-columns: repeat(3, 24px);
    gap: 6px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: #242424;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.34);
    transform: translateX(-50%);
}

.text-background-menu button {
    width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 5px;
}

.text-background-menu button:hover,
.text-background-menu button.active {
    border-color: rgba(255, 255, 255, 0.9);
    background: inherit;
}

.text-action-divider {
    width: 1px;
    height: 18px;
    margin: 0 2px;
    background: rgba(255, 255, 255, 0.1);
}

.text-tool-bold,
.text-tool-italic {
    display: inline-block;
    font-size: 13px;
    line-height: 1;
}

.text-tool-bold {
    font-weight: 800;
}

.text-tool-italic {
    font-style: italic;
    font-weight: 700;
}

.text-tool-icon {
    position: relative;
    display: inline-block;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    color: rgba(255, 255, 255, 0.9);
}

.text-tool-icon-list::before,
.text-tool-icon-list::after,
.text-tool-icon-ordered::before,
.text-tool-icon-ordered::after,
.text-tool-icon-divider::before {
    position: absolute;
    content: '';
}

.text-tool-icon-list::before {
    left: 4px;
    top: 4px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 5px 0 currentColor, 0 10px 0 currentColor;
}

.text-tool-icon-list::after {
    left: 8px;
    top: 4px;
    width: 6px;
    height: 1.5px;
    background: currentColor;
    box-shadow:
        0 5px 0 currentColor,
        0 10px 0 currentColor;
}

.text-tool-icon-ordered::before {
    left: 2px;
    top: 3px;
    width: 8px;
    height: 1.5px;
    background: currentColor;
    box-shadow:
        0 5px 0 currentColor,
        0 10px 0 currentColor;
}

.text-tool-icon-ordered::after {
    left: 11px;
    top: 1px;
    width: 4px;
    height: 12px;
    color: currentColor;
    content: '1.';
    font-size: 9px;
    font-weight: 700;
    line-height: 12px;
    text-align: right;
}

.text-tool-icon-divider::before {
    left: 2px;
    top: 7px;
    width: 12px;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
}

.image-action-bar .action-icon-only {
    width: 40px;
    padding: 0;
}

.redraw-action-bar button {
    cursor: pointer;
}

.redraw-title {
    padding: 0 8px;
}

.redraw-tool {
    width: 40px;
    padding: 0;
}

.redraw-tool:disabled {
    cursor: default;
    opacity: 0.38;
}

.redraw-divider {
    width: 1px;
    height: 18px;
    margin: 0 2px;
    background: rgba(255, 255, 255, 0.1);
}

.redraw-icon {
    display: block;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}

.redraw-title-icon,
.redraw-size-icon {
    display: block;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}

.redraw-size {
    width: 72px;
    height: 18px;
    accent-color: #fff;
}

.image-action-divider {
    width: 1px;
    height: 18px;
    margin: 0 2px;
    background: rgba(255, 255, 255, 0.1);
}

.action-icon-img {
    display: block;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    object-fit: contain;
}

.action-icon {
    position: relative;
    display: inline-block;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    color: rgba(255, 255, 255, 0.9);
}

.action-icon-frame::before,
.action-icon-lens::before,
.action-icon-select::before,
.action-icon-crop::before {
    position: absolute;
    inset: 2px;
    border: 1.5px solid currentColor;
    border-radius: 3px;
    content: '';
}

.action-icon-frame::after {
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 4px;
    height: 4px;
    border-radius: 4px 4px 1px 1px;
    background: currentColor;
    content: '';
}

.action-icon-sun::before {
    position: absolute;
    left: 5px;
    top: 5px;
    width: 6px;
    height: 6px;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    content: '';
}

.action-icon-sun::after {
    position: absolute;
    inset: 0;
    background:
        linear-gradient(currentColor, currentColor) center 0 / 1.5px 4px no-repeat,
        linear-gradient(currentColor, currentColor) center 12px / 1.5px 4px no-repeat,
        linear-gradient(90deg, currentColor, currentColor) 0 center / 4px 1.5px no-repeat,
        linear-gradient(90deg, currentColor, currentColor) 12px center / 4px 1.5px no-repeat;
    content: '';
}

.action-icon-lens::before {
    inset: 3px 2px;
    border-radius: 5px;
}

.action-icon-lens::after {
    position: absolute;
    left: 6px;
    top: 6px;
    width: 4px;
    height: 4px;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    content: '';
}

.action-icon-spark::before,
.action-icon-spark::after {
    position: absolute;
    background: currentColor;
    content: '';
}

.action-icon-spark::before {
    left: 7px;
    top: 1px;
    width: 2px;
    height: 14px;
    transform: rotate(35deg);
}

.action-icon-spark::after {
    left: 1px;
    top: 7px;
    width: 14px;
    height: 2px;
    transform: rotate(35deg);
}

.action-icon-select::before {
    inset: 2px;
    border-style: dashed;
}

.action-icon-crop::before {
    inset: 5px 2px 2px 5px;
    border-top: 0;
    border-left: 0;
    border-radius: 0;
}

.action-icon-crop::after {
    position: absolute;
    left: 2px;
    top: 2px;
    width: 9px;
    height: 9px;
    border-top: 1.5px solid currentColor;
    border-left: 1.5px solid currentColor;
    content: '';
}

.action-icon-rotate::before {
    position: absolute;
    inset: 3px;
    border: 1.5px solid currentColor;
    border-left-color: transparent;
    border-radius: 50%;
    content: '';
}

.action-icon-rotate::after {
    position: absolute;
    right: 1px;
    top: 2px;
    border: 4px solid transparent;
    border-left-color: currentColor;
    content: '';
}

.action-icon-more::before {
    position: absolute;
    left: 2px;
    top: 7px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    box-shadow:
        5px 0 0 currentColor,
        10px 0 0 currentColor;
    content: '';
}

.action-icon-pen::before {
    position: absolute;
    left: 7px;
    top: 2px;
    width: 2px;
    height: 13px;
    border-radius: 999px;
    background: currentColor;
    content: '';
    transform: rotate(45deg);
}

.action-icon-pen::after {
    position: absolute;
    left: 2px;
    bottom: 1px;
    width: 7px;
    height: 1.5px;
    border-radius: 999px;
    background: currentColor;
    content: '';
}

.action-icon-download::before {
    position: absolute;
    left: 7px;
    top: 1px;
    width: 2px;
    height: 10px;
    border-radius: 999px;
    background: currentColor;
    content: '';
}

.action-icon-download::after {
    position: absolute;
    left: 4px;
    top: 6px;
    width: 8px;
    height: 8px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    content: '';
    transform: rotate(45deg);
}

.vip-mark {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: 2px;
    background: #8b5cf6;
    transform: rotate(45deg);
}

.native-canvas-node.selected .node-body {
    border-color: rgba(255, 255, 255, 0.88);
}

.media-more-menu {
    position: absolute;
    right: 8px;
    top: calc(100% + 8px);
    z-index: 2;
    display: grid;
    width: 116px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: #262626;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.34);
}

.media-more-menu button {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
    text-align: left;
}

.media-more-menu button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.media-more-menu button.is-danger:hover {
    background: rgba(239, 68, 68, 0.14);
    color: #fca5a5;
}

.video-capture-wrap {
    position: relative;
    display: inline-flex;
}

.video-capture-menu {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    z-index: 2;
    display: grid;
    width: 76px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: #262626;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.34);
    transform: translateX(-50%);
}

.video-capture-menu button {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
    text-align: left;
}

.video-capture-menu button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.video-capture-wrap > button:disabled,
.video-capture-menu button:disabled {
    cursor: wait;
    opacity: 0.48;
}

.native-canvas-node.running .node-body,
.native-canvas-node.failed .node-body {
    box-shadow: none;
}

.native-canvas-node.has-media-result .node-body {
    border-color: transparent;
    border-radius: 16px;
    background: transparent;
}

.is-image .node-body,
.is-video .node-body,
.is-audio .node-body {
    width: 100%;
    height: var(--node-media-height, 250px);
    min-height: 0;
    aspect-ratio: 16 / 9;
    padding: 0;
}

.is-image .node-body,
.is-video .node-body {
    height: var(--node-media-height, 191px);
    aspect-ratio: auto;
}

.is-audio .node-body {
    height: var(--node-media-height, 250px);
    aspect-ratio: auto;
}

.is-text .node-body {
    width: 100%;
    height: var(--node-text-height, 191px);
    min-height: 0;
    padding: 0;
    overflow: hidden;
    background: var(--node-text-background);
}

.text-display {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    cursor: default;
}

.text-display-content,
.text-display-placeholder {
    width: 100%;
    height: 100%;
    padding: 12px 16px;
    overflow: auto;
    box-sizing: border-box;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    word-break: break-word;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
}

.text-display-content {
    white-space: normal;
}

.text-display-content.is-h1 {
    font-size: 24px;
    line-height: 1.32;
    font-weight: 800;
}

.text-display-content.is-h2 {
    font-size: 20px;
    line-height: 1.36;
    font-weight: 800;
}

.text-display-content.is-h3 {
    font-size: 17px;
    line-height: 1.42;
    font-weight: 800;
}

.text-display-content.is-bold {
    font-weight: 800;
}

.text-display-content.is-italic {
    font-style: italic;
}

.text-display-content.is-list-bullet,
.text-display-content.is-list-ordered {
    font-size: 14px;
    font-weight: 600;
}

.text-display-content :deep(.text-display-block) {
    margin: 0;
}

.text-display-content :deep(.text-display-block + .text-display-block) {
    margin-top: 10px;
}

.text-display-content :deep(.text-display-markdown-h1),
.text-display-content :deep(.text-display-markdown-h2),
.text-display-content :deep(.text-display-markdown-h3) {
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 700;
}

.text-display-content :deep(.text-display-markdown-h1) {
    font-size: 24px;
    line-height: 1.32;
}

.text-display-content :deep(.text-display-markdown-h2) {
    font-size: 20px;
    line-height: 1.36;
}

.text-display-content :deep(.text-display-markdown-h3) {
    font-size: 17px;
    line-height: 1.42;
}

.text-display-content :deep(.text-display-code) {
    display: inline;
    padding: 0 2px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    font-weight: 400;
}

.text-display-content :deep(.text-display-divider) {
    height: 1px;
    margin: 14px 0;
    border: 0;
    background: rgba(255, 255, 255, 0.18);
}

.text-display-content :deep(.text-display-list) {
    display: grid;
    gap: 8px;
    margin: 0;
    padding-left: 22px;
}

.text-display-content :deep(.text-display-list li) {
    min-width: 0;
}

.text-display-placeholder {
    color: rgba(255, 255, 255, 0.32);
    font-weight: 500;
}

.text-editor {
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: 12px 16px;
    border: 0;
    outline: 0;
    background: transparent;
    box-sizing: border-box;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    white-space: normal;
    word-break: break-word;
    cursor: text;
}

.text-editor:empty::before {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.32);
    pointer-events: none;
}

.text-editor.is-h1 {
    font-size: 24px;
    line-height: 1.32;
    font-weight: 800;
}

.text-editor.is-h2 {
    font-size: 20px;
    line-height: 1.36;
    font-weight: 800;
}

.text-editor.is-h3 {
    font-size: 17px;
    line-height: 1.42;
    font-weight: 800;
}

.text-editor.is-bold {
    font-weight: 800;
}

.text-editor.is-italic {
    font-style: italic;
}

.text-display-content :deep(h1),
.text-display-content :deep(h2),
.text-display-content :deep(h3),
.text-editor :deep(h1),
.text-editor :deep(h2),
.text-editor :deep(h3) {
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 700;
}

.text-display-content :deep(h1),
.text-editor :deep(h1) {
    font-size: 24px;
    line-height: 1.32;
}

.text-display-content :deep(h2),
.text-editor :deep(h2) {
    font-size: 20px;
    line-height: 1.36;
}

.text-display-content :deep(h3),
.text-editor :deep(h3) {
    font-size: 17px;
    line-height: 1.42;
}

.text-editor :deep(p),
.text-editor :deep(div) {
    margin: 0;
}

.text-editor :deep(p + p),
.text-editor :deep(div + div) {
    margin-top: 10px;
}

.text-editor :deep(ul),
.text-editor :deep(ol) {
    display: grid;
    gap: 8px;
    margin: 0;
    padding-left: 22px;
}

.text-editor :deep(hr) {
    height: 1px;
    margin: 14px 0;
    border: 0;
    background: rgba(255, 255, 255, 0.18);
}

.text-display-content::-webkit-scrollbar {
    width: 6px;
}

.text-display-content::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.28);
}

textarea {
    width: 100%;
    min-height: 74px;
    border: 0;
    border-radius: 0;
    outline: none;
    resize: none;
    background: transparent;
    color: #f4f4f5;
    padding: 0;
    line-height: 1.55;
    font-size: 13px;
}

.is-text .node-body textarea,
.is-config .node-body textarea {
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
}

textarea::placeholder {
    color: rgba(255, 255, 255, 0.38);
}

.media-frame {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    aspect-ratio: auto;
    overflow: hidden;
    border: 0;
    border-radius: 16px;
    background: transparent;
}

.media-frame.has-media {
    overflow: hidden;
    border-radius: 16px;
}

.audio-frame.has-media,
.audio-frame.has-media .media-content {
    border-radius: 12px;
}

.media-content {
    position: absolute;
    inset: 0;
    display: block;
    overflow: hidden;
    border-radius: 16px;
    background: #101010;
    box-sizing: border-box;
}

.media-frame.has-media .media-content {
    border-radius: 16px;
    background: transparent;
}

.media-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #101010;
}

.media-loading :deep(.short-drama-grainient-placeholder) {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 100%;
    height: 100%;
    min-height: 100%;
    flex: 1 1 auto;
    border-radius: inherit;
}

.media-loading :deep(.short-drama-grainient-placeholder__label) {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}

.media-content img,
.media-content video,
.media-content :deep(.short-drama-grainient-placeholder) {
    display: block;
    width: 100%;
    height: 100%;
    min-width: 100%;
    min-height: 100%;
    max-height: 100%;
}

.media-loading :deep(.short-drama-grainient-placeholder__canvas) {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
}

.media-content img,
.media-content video {
    object-fit: contain;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
}

.image-transition-previous,
.image-transition-current {
    position: absolute;
    inset: 0;
}

.image-transition-previous {
    opacity: 1;
    filter: blur(14px);
    transform: scale(1.1);
}

.image-transition-current.is-transitioning {
    opacity: 0;
    filter: blur(36px);
    transform: scale(1.06);
    transition: none;
}

.image-transition-current.is-transitioning.is-revealing {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
        filter 2s cubic-bezier(0.16, 1, 0.3, 1),
        transform 2s cubic-bezier(0.16, 1, 0.3, 1);
}

.media-frame.has-media .media-content img,
.media-frame.has-media .media-content video {
    border-radius: 16px;
}

.media-frame.is-running .media-content img,
.media-frame.is-running .media-content video,
.media-frame.is-running .media-content :deep(.short-drama-grainient-placeholder) {
    object-fit: cover;
}

.media-preview-error {
    position: absolute;
    inset: 0;
    z-index: 8;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    border-radius: inherit;
    background: rgba(16, 16, 16, 0.88);
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    box-sizing: border-box;
}

.media-preview-error strong {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
}

.media-preview-error span {
    max-width: 200px;
    color: rgba(255, 255, 255, 0.56);
    font-size: 12px;
    line-height: 1.45;
}

.media-preview-error button {
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.92);
    font-size: 12px;
    cursor: pointer;
}

.media-preview-error button:hover {
    background: rgba(255, 255, 255, 0.08);
}

.video-content {
    isolation: isolate;
}

.video-top-controls,
.video-hover-controls {
    position: absolute;
    z-index: 3;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

.video-top-controls {
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    transform: scale(0.9);
}

.video-top-controls.is-visible {
    pointer-events: auto;
    opacity: 1;
    transform: scale(1);
}

.video-top-controls button {
    display: grid;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.5);
    color: #f5f5f5;
    cursor: pointer;
    place-items: center;
    transition: background 0.16s ease;
}

.video-top-controls button:hover {
    background: rgba(0, 0, 0, 0.7);
}

.video-top-controls img {
    display: block;
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(1);
}

.video-hover-controls {
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 32px 8px 10px;
    border-radius: 0 0 16px 16px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.2), transparent);
    transform: translateY(4px);
}

.video-hover-controls.is-visible {
    pointer-events: auto;
    opacity: 1;
    transform: translateY(0);
}

.video-control-button {
    display: grid;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #fff;
    cursor: pointer;
    place-items: center;
}

.video-control-button > span {
    display: block;
    width: 0;
    height: 0;
    margin-left: 2px;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 8px solid currentColor;
}

.video-control-button > span.is-pause {
    width: 3px;
    height: 12px;
    margin-left: 0;
    border: 0;
    background: currentColor;
    box-shadow: 6px 0 0 currentColor;
}

.video-control-button img {
    display: block;
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(1);
}

.video-time {
    min-width: 40px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    line-height: 1;
    text-align: right;
    white-space: nowrap;
}

.video-progress {
    width: 100%;
    min-width: 0;
    height: 16px;
    flex: 1;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
}

.video-progress::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(
        to right,
        #fff 0 var(--video-progress),
        rgba(255, 255, 255, 0.2) var(--video-progress) 100%
    );
}

.video-progress::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    margin-top: -4px;
    appearance: none;
    border: 0;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.video-progress::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
}

.video-progress::-moz-range-progress {
    height: 4px;
    border-radius: 999px;
    background: #fff;
}

.video-progress::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.audio-content {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: #1f1f1f !important;
}

.audio-waveform {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 0;
    margin-top: 16px;
    padding: 0 16px;
    overflow: hidden;
    cursor: pointer;
    touch-action: none;
}

.audio-waveform::before,
.audio-waveform::after {
    position: absolute;
    inset: 0;
    z-index: 2;
    content: '';
    pointer-events: none;
}

.audio-waveform::before {
    background: linear-gradient(
        to right,
        #1f1f1f 0%,
        transparent 15%,
        transparent 85%,
        #1f1f1f 100%
    );
}

.audio-waveform::after {
    display: none;
}

.audio-waveform > span {
    display: block;
    width: 8px;
    max-height: 120px;
    flex: 0 0 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.25);
    transition: background 0.08s linear;
}

.audio-player {
    display: grid;
    place-items: center;
    padding: 8px 0 16px;
}

.audio-player-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
}

.audio-play-button {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #e5e5e5;
    color: #1a1a1a;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease;
}

.audio-play-button:hover {
    background: #fff;
}

.audio-play-button span {
    display: block;
    width: 0;
    height: 0;
    margin-left: 2px;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 9px solid currentColor;
}

.audio-play-button.is-playing span {
    width: 3px;
    height: 12px;
    margin-left: 0;
    border: 0;
    background: currentColor;
    box-shadow: 6px 0 0 currentColor;
}

.audio-skip-button {
    position: relative;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #808080;
    cursor: pointer;
    transition: color 0.16s ease;
}

.audio-skip-button:hover {
    color: rgba(255, 255, 255, 0.9);
}

.audio-skip-button span {
    position: relative;
    display: block;
    width: 13px;
    height: 13px;
    border: 1.5px solid currentColor;
    border-radius: 50%;
}

.audio-skip-button span::before,
.audio-skip-button span::after {
    position: absolute;
    content: '';
}

.audio-skip-button.is-back span::before {
    left: -3px;
    top: 1px;
    width: 5px;
    height: 5px;
    border-left: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(45deg);
}

.audio-skip-button.is-forward span::before {
    right: -3px;
    top: 1px;
    width: 5px;
    height: 5px;
    border-top: 1.5px solid currentColor;
    border-right: 1.5px solid currentColor;
    transform: rotate(45deg);
}

.audio-skip-button span::after {
    left: 50%;
    top: 50%;
    color: currentColor;
    content: '10';
    font-size: 6px;
    font-weight: 700;
    line-height: 1;
    transform: translate(-50%, -50%);
}

.audio-element {
    display: none;
}

.redraw-mask-canvas {
    position: absolute;
    z-index: 3;
    display: block;
    border-radius: 10px;
    opacity: 0.62;
    touch-action: none;
    pointer-events: auto;
}

.redraw-mask-canvas.is-move {
    cursor: grab;
}

.redraw-mask-canvas.is-brush {
    cursor: crosshair;
}

.redraw-mask-canvas.is-select {
    cursor: cell;
}

.redraw-mask-canvas.is-erase {
    cursor: not-allowed;
}

.media-redraw-loading {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.28);
    pointer-events: none;
}

.media-redraw-loading :deep(.short-drama-grainient-placeholder) {
    width: 100%;
    height: 100%;
}

.media-redraw-loading :deep(.short-drama-grainient-placeholder__label) {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}

.media-empty {
    position: absolute;
    inset: 0;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 6px;
    text-align: center;
    color: rgba(255, 255, 255, 0.28);
}

.media-empty span {
    color: rgba(255, 255, 255, 0.46);
    font-weight: 700;
}

.media-empty.is-failed span {
    color: rgba(251, 113, 133, 0.9);
}

.media-empty.is-failed small {
    color: rgba(255, 255, 255, 0.46);
}

.media-empty-editable img {
    width: 32px;
    height: 32px;
    margin: auto;
    object-fit: contain;
    opacity: 0.22;
}

.media-empty.audio-empty img {
    width: 48px;
    height: 48px;
    opacity: 0.2;
}

.node-error {
    margin: 8px 0 0;
    color: #fb7185;
    font-size: 12px;
}

.node-source-bar {
    position: absolute;
    left: 50%;
    top: -48px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 34px;
    padding: 0 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: #222;
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    font-weight: 600;
    transform: translateX(-50%);
}

.node-source-bar label,
.node-source-bar button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    white-space: nowrap;
}

.node-source-bar input {
    display: none;
}

.node-composer {
    position: absolute;
    top: calc(100% + var(--node-composer-gap));
    left: 50%;
    z-index: 1001;
    display: grid;
    grid-template-rows: minmax(0, 1fr) 28px;
    gap: 12px;
    width: 640px;
    height: 190px;
    min-height: 190px;
    padding: 16px 12px 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: #202020;
    box-shadow: none;
    transform: translateX(-50%)
        scale(calc(var(--node-input-counter-scale) * var(--node-composer-fit-scale)));
    transform-origin: top center;
    pointer-events: auto;
}

.node-composer.has-references {
    grid-template-rows: minmax(0, 1fr) 28px;
    height: 190px;
    min-height: 190px;
}

.node-composer.is-redraw {
    height: 190px;
    min-height: 190px;
}

.node-composer.is-redraw.has-references {
    grid-template-rows: minmax(0, 1fr) 28px;
    height: 190px;
    min-height: 190px;
}

.composer-main {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    overscroll-behavior: contain;
}

.node-composer textarea {
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    color: rgba(255, 255, 255, 0.84);
    line-height: 20px;
}

.composer-editor-viewport {
    position: relative;
    flex: 1 1 0;
    align-self: stretch;
    width: 100%;
    height: auto;
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: clip;
    box-sizing: border-box;
    cursor: text;
}

.node-composer.has-references .composer-editor-viewport {
    flex: 1 1 0;
    height: auto;
    min-height: 0;
    max-height: none;
    padding: 6px 4px 6px 0;
    overflow: hidden;
}

/* Vue may preserve the pre-HMR composer DOM while a selected canvas node is
   being edited. Keep that direct-editor shape in the same stacked layout. */
.node-composer.has-references .composer-main > .composer-editor {
    flex: 1 1 0;
    height: auto;
    min-height: 0;
    max-height: none;
    margin-top: 10px;
    overflow-x: hidden;
    overflow-y: auto;
}

.node-composer.has-references .composer-editor-viewport .composer-editor {
    height: 100%;
    min-height: 0;
    max-height: 100%;
}

.composer-editor {
    display: block;
    width: 100%;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    box-sizing: border-box;
    overflow-y: auto;
    outline: none;
    padding-right: 2px;
    color: rgba(255, 255, 255, 0.84);
    line-height: 20px;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
    overscroll-behavior: contain;
    scrollbar-width: none;
    cursor: text;
}

.composer-editor::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
}

.composer-editor:empty::before {
    color: rgba(255, 255, 255, 0.38);
    content: attr(data-placeholder);
    pointer-events: none;
}

.composer-editor :deep(.composer-mention-chip) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 240px;
    height: 24px;
    margin: 0 3px 2px;
    padding: 2px 7px 2px 3px;
    border: 1px solid rgba(32, 215, 255, 0.28);
    border-radius: 7px;
    background: rgba(32, 215, 255, 0.12);
    color: #7eeaff;
    font-weight: 700;
    line-height: 1;
    vertical-align: middle;
    white-space: nowrap;
    cursor: default;
}

.composer-editor :deep(.composer-mention-chip__thumb) {
    display: block;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    flex: 0 0 18px;
    background: rgba(255, 255, 255, 0.1);
    object-fit: cover;
    pointer-events: none;
}

.composer-editor :deep(.composer-mention-chip__thumb--icon) {
    padding: 3px;
    object-fit: contain;
    opacity: 0.84;
}

.composer-editor :deep(.composer-mention-chip__label) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}

.composer-references {
    position: relative;
    z-index: 2;
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
    max-width: 100%;
    min-height: 48px;
    height: auto;
    margin-bottom: 10px;
    min-width: 0;
    align-items: flex-start;
    overflow: visible;
    pointer-events: auto;
}

.composer-reference-thumb {
    position: relative;
    width: 48px;
    height: 48px;
    margin: 0;
    overflow: visible;
    flex: 0 0 auto;
}

.composer-reference-clip {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: #121212;
    box-sizing: border-box;
}

.composer-reference-clip img,
.composer-reference-clip video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
}

.composer-reference-clip button {
    position: absolute;
    right: -1px;
    top: -1px;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.72);
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
}

.composer-reference-thumb.is-linked {
    border-color: transparent;
}

.composer-reference-thumb.is-linked .composer-reference-clip {
    border-color: rgba(255, 255, 255, 0.18);
}

.composer-reference-thumb.is-text {
    width: 48px;
    height: 48px;
}

.composer-reference-thumb.is-text .composer-reference-clip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 5px 6px;
    background: rgba(255, 255, 255, 0.06);
}

.composer-reference-thumb.is-text span {
    display: -webkit-box;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.82);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.reference-text-icon {
    display: block !important;
    width: 20px !important;
    height: 20px !important;
    flex: 0 0 20px;
    object-fit: contain !important;
    opacity: 0.9;
}

.reference-video-preview {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 10px);
    z-index: 1004;
    display: none;
    width: 220px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background: #0f0f0f;
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.46);
    transform: translateX(-50%);
}

.reference-video-preview video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
}

.composer-reference-thumb:hover .reference-video-preview {
    display: block;
}

.composer-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.composer-upload-wrap {
    position: relative;
    display: inline-flex;
}

.composer-mention-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
}

.reference-input {
    display: none;
}

.composer-upload-menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 10px);
    z-index: 1005;
    display: grid;
    gap: 2px;
    width: 220px;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background: #252525;
    box-shadow: none;
}

.mention-menu {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 10px);
    z-index: 1006;
    display: flex;
    flex-direction: column;
    width: 264px;
    max-height: 320px;
    overflow: hidden;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background: #252525;
    box-shadow: none;
    transform: translateX(-50%);
}

.mention-menu__body {
    min-height: 0;
    overflow-y: auto;
    padding-right: 2px;
    scrollbar-width: none;
}

.mention-menu__body::-webkit-scrollbar {
    display: none;
}

.mention-menu__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.mention-menu__head strong {
    color: #fff;
    font-size: 14px;
}

.mention-menu__head button {
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.76);
    font-size: 12px;
}

.mention-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    height: 32px;
    padding: 3px;
    margin-bottom: 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
}

.mention-tabs button {
    height: 26px;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}

.mention-tabs button.active {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}

.mention-list {
    display: grid;
    gap: 6px;
}

.mention-item {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    min-height: 46px;
    padding: 6px 8px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.86);
    text-align: left;
}

.mention-item:hover,
.mention-item.is-active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.mention-thumb {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
}

.mention-thumb img,
.mention-thumb video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.mention-thumb .mention-thumb-icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
    opacity: 0.78;
}

.mention-main {
    display: grid;
    gap: 3px;
    min-width: 0;
}

.mention-item b,
.mention-item small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mention-item b {
    font-size: 13px;
}

.mention-item small {
    color: rgba(255, 255, 255, 0.48);
    font-size: 12px;
}

.mention-empty {
    display: grid;
    min-height: 58px;
    place-items: center;
    color: rgba(255, 255, 255, 0.46);
    font-size: 13px;
}

.composer-upload-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    padding: 0 4px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
}

.composer-upload-menu button:hover {
    background: rgba(255, 255, 255, 0.06);
}

.upload-menu-icon {
    position: relative;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    opacity: 0.78;
}

.upload-menu-icon-link::before {
    position: absolute;
    inset: 3px 2px;
    border: 1.5px solid currentColor;
    border-radius: 999px;
    content: '';
    transform: rotate(45deg);
}

.upload-menu-icon-folder::before {
    position: absolute;
    left: 1px;
    top: 5px;
    width: 14px;
    height: 9px;
    border: 1.5px solid currentColor;
    border-radius: 2px;
    content: '';
}

.upload-menu-icon-folder::after {
    position: absolute;
    left: 3px;
    top: 3px;
    width: 6px;
    height: 3px;
    border: 1.5px solid currentColor;
    border-bottom: 0;
    border-radius: 2px 2px 0 0;
    content: '';
}

.icon-button,
.composer-select,
.send-button,
.composer-select-menu__item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}

.icon-button {
    width: 28px;
}

.mention-button {
    width: 26px;
    height: 26px;
}

.mention-button img {
    width: 26px;
    height: 26px;
}

.mention-button:hover,
.mention-button.active {
    background: rgba(255, 255, 255, 0.08);
}

.icon-button img,
.composer-select img {
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
}

.icon-button.mention-button img {
    display: block;
    width: 26px;
    height: 26px;
    max-width: 26px;
    max-height: 26px;
    flex: 0 0 26px;
}

.composer-select-wrap {
    position: relative;
    display: inline-flex;
}

.composer-select {
    gap: 5px;
    padding: 0 2px;
    white-space: nowrap;
}

.composer-select:hover,
.composer-select.is-open {
    color: #fff;
}

.composer-select-arrow {
    opacity: 0.68;
}

.composer-select-menu {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    z-index: 1005;
    min-width: 148px;
    max-height: 260px;
    overflow-y: auto;
    padding: 6px;
    border-radius: 12px;
    background: rgba(21, 21, 21, 0.98);
    box-shadow: none;
    scrollbar-width: none;
    transform: translateX(-50%);
}

.composer-select-menu::-webkit-scrollbar {
    display: none;
}

.composer-select-menu__item {
    justify-content: flex-start;
    gap: 8px;
    width: 100%;
    height: 34px;
    min-height: 34px;
    padding: 0 10px;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
}

.composer-select-menu__item:hover,
.composer-select-menu__item.is-active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.composer-ratio-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}

.composer-ratio-shape {
    display: block;
    border: 1px solid rgba(255, 255, 255, 0.48);
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
}

.composer-spacer {
    flex: 1;
    min-width: 8px;
}

.composer-cost-icon {
    margin-right: -5px;
}

.composer-cost-icon img {
    filter: brightness(0) invert(1);
}

.composer-cost {
    color: #fff;
    font-size: 12px;
    font-weight: 700;
}

.send-button {
    width: 34px;
    min-width: 34px;
    height: 34px;
    padding: 0;
    margin-left: 2px;
    opacity: 1;
    background: #fff !important;
    color: #0c0c0d;
}

.send-button:disabled {
    cursor: not-allowed;
    opacity: 0.56;
}

.send-button img {
    width: 17px;
    height: 17px;
    filter: brightness(0);
}

.node-port {
    position: absolute;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 80px;
    height: 80px;
    padding: 0;
    border: 0;
    background: transparent;
    box-sizing: border-box;
    cursor: crosshair;
    pointer-events: none;
    transform-origin: center;
}

.node-port-icon {
    --node-port-magnet-x: 0px;
    --node-port-magnet-y: 0px;
    --node-port-reveal-x: 0px;
    position: relative;
    display: block;
    width: 24px;
    height: 24px;
    border: 2px solid #7a7a7a;
    border-radius: 50%;
    box-sizing: border-box;
    color: #7a7a7a;
    opacity: 0;
    transform: translate3d(
        calc(var(--node-port-reveal-x) + var(--node-port-magnet-x)),
        var(--node-port-magnet-y),
        0
    );
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
        opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.16s ease,
        border-color 0.16s ease;
}

.node-port-icon::before,
.node-port-icon::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 12px;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
    transform: translate(-50%, -50%);
    pointer-events: none;
}

.node-port-icon::after {
    transform: translate(-50%, -50%) rotate(90deg);
}

.node-port:hover .node-port-icon {
    border-color: #f5f5f5;
    color: #f5f5f5;
}

.node-port:active .node-port-icon {
    border-color: #fff;
    color: #fff;
}

.native-canvas-node:hover .node-port,
.native-canvas-node:has(.node-composer:hover) .node-port,
.native-canvas-node:has(.node-port:hover) .node-port,
.native-canvas-node.selected .node-port {
    pointer-events: auto;
}

.node-port-force-hidden,
.native-canvas-node.selected .node-port-force-hidden {
    pointer-events: none;
}

.node-port-left {
    left: -80px;
    top: var(--node-text-port-top);
    transform: translateY(-50%);
}

.node-port-left .node-port-icon {
    --node-port-reveal-x: 24px;
}

.node-port-right {
    right: -80px;
    top: var(--node-text-port-top);
    transform: translateY(-50%);
}

.node-port-right .node-port-icon {
    --node-port-reveal-x: -24px;
}

.native-canvas-node:hover .node-port-icon,
.native-canvas-node:has(.node-composer:hover) .node-port-icon,
.native-canvas-node:has(.node-port:hover) .node-port-icon,
.native-canvas-node.selected .node-port-icon {
    --node-port-reveal-x: 0px;
    opacity: 1;
}

.native-canvas-node .node-port-force-hidden .node-port-icon,
.native-canvas-node.selected .node-port-force-hidden .node-port-icon {
    opacity: 0;
}

.native-canvas-node .node-port-force-hidden.node-port-left .node-port-icon,
.native-canvas-node.selected .node-port-force-hidden.node-port-left .node-port-icon {
    --node-port-reveal-x: 24px;
}

.native-canvas-node .node-port-force-hidden.node-port-right .node-port-icon,
.native-canvas-node.selected .node-port-force-hidden.node-port-right .node-port-icon {
    --node-port-reveal-x: -24px;
}

.is-image .node-port-left,
.is-image .node-port-right,
.is-video .node-port-left,
.is-video .node-port-right,
.is-audio .node-port-left,
.is-audio .node-port-right {
    top: var(--node-media-port-top);
}
</style>
