<template>
    <div class="storyboard-page" :style="storyboardAspectStyle" @click="closeFloatingMenus">
        <ShortDramaFlowTopbar
            active="storyboard"
            :title="projectTitle"
            editable
            :show-steps="true"
            @back="goPlan"
            @rename="renameProjectTitle"
            @step="goStep"
        >
            <template #actions>
                <div :class="['batch-menu-wrap', { 'is-open': batchMenuOpen }]" @click.stop>
                    <button class="top-dark-action" type="button" @click.stop="toggleBatchMenu">
                        批量操作
                    </button>
                    <div class="batch-menu-panel">
                        <button
                            class="export-menu-btn export-menu-btn--primary"
                            type="button"
                            :disabled="generatingShotImages"
                            @click="runBatchShotImageGeneration"
                        >
                            <span>{{ batchShotImageBillingText }}</span>
                            <span>{{ generatingShotImages ? '生成中...' : '生成分镜图' }}</span>
                        </button>
                        <button
                            class="export-menu-btn"
                            type="button"
                            :disabled="generatingVideos"
                            @click="runBatchVideoGeneration"
                        >
                            {{ generatingVideos ? '生成中...' : '一键转视频' }}
                        </button>
                    </div>
                </div>
                <div class="export-menu-wrap" @click.stop>
                    <button class="top-light-action" type="button" @click.stop="toggleExportMenu">
                        {{ exportBusy ? '导出中...' : '导出' }}
                    </button>
                    <div v-if="exportMenuOpen" class="export-menu-panel">
                        <div class="export-watermark-row">
                            <span>视频水印</span>
                            <button
                                class="export-switch"
                                :class="{ 'is-on': exportWatermarkEnabled }"
                                type="button"
                                @click="exportWatermarkEnabled = !exportWatermarkEnabled"
                            >
                                <i></i>
                            </button>
                        </div>
                        <button
                            class="export-menu-btn export-menu-btn--primary"
                            type="button"
                            :disabled="exportBusy"
                            @click="submitExportTask('export_video')"
                        >
                            {{ exportingVideo ? '导出中...' : '导出完整视频' }}
                        </button>
                        <button
                            class="export-menu-btn"
                            type="button"
                            :disabled="exportBusy"
                            @click="submitExportTask('export_package')"
                        >
                            {{ exportingPackage ? '导出中...' : '导出全部分镜' }}
                        </button>
                    </div>
                </div>
            </template>
        </ShortDramaFlowTopbar>

        <main class="storyboard-workspace">
            <section class="storyboard-stage">
                <div class="stage-preview-row">
                    <div
                        :class="[
                            'preview-shell',
                            {
                                'has-preview-media': !!activePreviewAsset?.url,
                                'is-generating': activeShotGenerating
                            }
                        ]"
                    >
                        <video
                            v-if="activePreviewAsset?.asset_type === 'shot_video' && activePreviewAsset.url"
                            ref="previewVideoRef"
                            class="preview-video"
                            :src="activePreviewAsset.url"
                            controls
                            playsinline
                            preload="auto"
                            @loadedmetadata="handlePreviewVideoLoadedMetadata"
                            @timeupdate="handlePreviewVideoTimeUpdate"
                            @ended="handlePreviewVideoEnded"
                            @error="handlePreviewVideoError"
                        ></video>
                        <ShortDramaImagePreview
                            v-else-if="activePreviewAsset?.url"
                            :src="activePreviewAsset.url"
                            :alt="activeShot?.title || '分镜图'"
                        />
                        <div v-else class="preview-empty">
                            <ShortDramaGrainientPlaceholder v-if="activeShotGenerating" />
                            <div v-else class="preview-empty__actions">
                                <button
                                    class="preview-empty__primary"
                                    type="button"
                                    :disabled="activeShotImageBusy"
                                    @click.stop="generateActiveShotImage"
                                >
                                    <span>+</span>
                                    {{ activeShotImageBusy ? '生成中...' : '生成分镜图' }}
                                </button>
                                <button
                                    class="preview-empty__secondary"
                                    type="button"
                                    :disabled="replacingPreviewAsset"
                                    @click.stop="triggerPreviewManualUpload"
                                >
                                    <span>+</span>
                                    {{ replacingPreviewAsset ? '上传中...' : '上传素材' }}
                                </button>
                            </div>
                        </div>
                        <div v-if="activePreviewAsset?.url" class="preview-actions">
                            <button class="preview-action-btn" type="button" @click.stop="downloadPreviewAsset">
                                <span>↓</span>
                                下载
                            </button>
                            <button class="preview-action-btn" type="button" :disabled="replacingPreviewAsset" @click.stop="triggerPreviewReplace">
                                <span>↻</span>
                                {{ replacingPreviewAsset ? '替换中...' : '替换' }}
                            </button>
                        </div>
                        <input
                            ref="previewReplaceInputRef"
                            class="preview-replace-input"
                            type="file"
                            :accept="previewReplaceAccept"
                            @change="handlePreviewReplaceFile"
                        />
                    </div>

                    <div class="vertical-shot-rail" @wheel="handleVerticalRailWheel">
                        <button
                            v-for="(record, index) in activeShotRecords"
                            :key="record.id || `${record.asset_type}-${index}`"
                            :class="['rail-thumb', { 'is-active': activePreviewAsset?.id === record.id }]"
                            type="button"
                            @click="selectPreviewRecord(record.id)"
                        >
                            <video
                                v-if="record.asset_type === 'shot_video' && record.url"
                                :src="record.url"
                                muted
                                playsinline
                                preload="metadata"
                            ></video>
                            <img v-else-if="record.url" :src="record.url" :alt="record.title" draggable="false" />
                            <span v-else>{{ index + 1 }}</span>
                            <i>
                                <img :src="iconUrl(record.asset_type === 'shot_video' ? 'shipin.svg' : 'Pic.svg')" alt="" />
                            </i>
                        </button>
                    </div>
                </div>

                <section class="timeline-panel">
                    <div class="timeline-play">
                        <button type="button" :aria-label="timelinePlaying ? '暂停' : '播放'" @click="toggleTimelinePlayback">
                            <span :class="['timeline-play-icon', { 'is-playing': timelinePlaying }]"></span>
                        </button>
                        <span>{{ timelineTimeText }}</span>
                    </div>
                    <div ref="shotStripRef" class="shot-strip" @wheel="handleTimelineWheel" @pointerdown="startTimelineGlobalSeek">
                        <template v-for="(shot, index) in timelineShots" :key="shot.id">
                            <div class="shot-timeline-item">
                                <article
                                    :class="['shot-thumb', { 'is-active': activeShotId === shot.id }]"
                                    @click="selectShot(shot.id)"
                                >
                                    <video
                                        v-if="shot.asset_type === 'shot_video' && shot.video_url"
                                        :src="shot.video_url"
                                        muted
                                        playsinline
                                        preload="metadata"
                                    ></video>
                                    <img v-else-if="shot.url" :src="shot.url" :alt="shot.title" draggable="false" />
                                    <div v-else class="shot-thumb-empty">
                                        <ShortDramaGrainientPlaceholder v-if="shotIsGenerating(shot.id)" compact />
                                        <span v-else>{{ shotStatusText(shot.id) }}</span>
                                    </div>
                                    <div class="shot-bottom-bar">
                                        <div class="shot-meta">
                                            <img :src="iconUrl(shot.asset_type === 'shot_video' ? 'shipin.svg' : 'Pic.svg')" alt="" />
                                            <span>{{ activeShotId === shot.id ? shotTimeLabel(shot) : `分镜${index + 1}` }}</span>
                                        </div>
                                        <div v-if="activeShotId === shot.id" class="shot-actions" @click.stop @pointerdown.stop>
                                            <button type="button" aria-label="复制" :disabled="storyboardStructureBusy" @click="copyStoryboardShotAction(shot.id)">
                                                <img :src="iconUrl('Copy.svg')" alt="" />
                                            </button>
                                            <button type="button" aria-label="删除" :disabled="storyboardStructureBusy || timelineShots.length <= 1" @click="deleteStoryboardShotAction(shot.id)">
                                                <img :src="iconUrl('Delete.svg')" alt="" />
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        v-if="activeShotId === shot.id"
                                        :class="['shot-play-progress', { 'is-playing': timelinePlaying && timelineProgressShotId === shot.id }]"
                                        :style="{ left: `${timelineProgressShotId === shot.id ? timelineProgressPercent : 0}%` }"
                                    ></div>
                                </article>
                                <button
                                    v-if="index < timelineShots.length - 1"
                                    class="shot-insert-btn"
                                    type="button"
                                    :disabled="storyboardStructureBusy"
                                    aria-label="插入空白分镜"
                                    @click.stop="insertStoryboardShotAfter(shot.id)"
                                    @pointerdown.stop
                                >
                                    <span>+</span>
                                </button>
                            </div>
                        </template>
                    </div>
                    <div
                        :class="['music-track', {
                            'is-active': bgmPlaying,
                            'is-busy': bgmIsBusy,
                            'is-failed': bgmStatus === 'failed',
                            'is-ready': !!bgmAsset,
                            'is-muted': !bgmExportEnabled
                        }]"
                    >
                        <button
                            class="music-mix-btn"
                            type="button"
                            :disabled="!bgmAsset"
                            :aria-label="bgmExportEnabled ? '关闭背景音乐导出混音' : '开启背景音乐导出混音'"
                            @click="toggleBgmExportEnabled"
                        >
                            <img :src="iconUrl(bgmExportEnabled ? 'Volume-kai.svg' : 'Volume-guan.svg')" alt="" />
                        </button>
                        <span class="music-track-label">背景音乐</span>
                    </div>
                </section>
            </section>

            <aside class="creation-panel">
                <div class="panel-tabs">
                    <button :class="{ 'is-active': rightTab === 'draw' }" type="button" @click="rightTab = 'draw'">
                        分镜创作
                    </button>
                    <button :class="{ 'is-active': rightTab === 'music' }" type="button" @click="rightTab = 'music'">
                        背景音乐
                    </button>
                </div>

                <div v-if="rightTab === 'draw'" class="draw-panel">
                    <div ref="drawScrollRef" class="draw-scroll">
                        <section class="prompt-card">
                            <div class="prompt-card__head">
                                <strong>{{ promptCardTitle }}</strong>
                                <div>
                                    <button type="button" aria-label="复制提示词" @click="copyActivePrompt">
                                        <img :src="iconUrl('Copy.svg')" alt="" />
                                    </button>
                                    <button
                                        v-if="promptExpandable"
                                        :class="{ 'is-collapsed': promptCollapsed }"
                                        type="button"
                                        :aria-label="promptCollapsed ? '展开提示词' : '收起提示词'"
                                        @click="promptCollapsed = !promptCollapsed"
                                    >
                                        <img :src="iconUrl('Down.svg')" alt="" />
                                    </button>
                                </div>
                            </div>
                            <textarea
                                :value="currentStoryboardPromptText"
                                :class="{ 'is-collapsed': promptExpandable && promptCollapsed }"
                                :placeholder="activePromptPlaceholder"
                                readonly
                            ></textarea>
                        </section>

                        <div v-if="currentStoryboardImageAsset?.url" class="panel-result-frame">
                            <ShortDramaImagePreview
                                class="panel-result-image"
                                :src="currentStoryboardImageAsset.url"
                                :alt="currentStoryboardShot?.title || '分镜图'"
                            />
                        </div>

                        <div v-if="hasPanelConversation" class="conversation-stream">
                                <div v-for="record in panelHistoryRecords" :key="record.taskId" class="history-record">
                                <div v-if="record.message" class="chat-message is-user">
                                    <div class="chat-bubble">
                                        <p v-html="highlightMentionHtml(record.message)"></p>
                                    </div>
                                </div>
                                <div
                                    v-if="record.assetUrl"
                                    :class="['panel-result-frame', 'is-history', { 'is-video': record.assetMediaType === 'video', 'is-selected': record.isSelected }]"
                                    @click="record.assetId ? usePreviewRecord(record.assetId) : undefined"
                                >
                                    <video
                                        v-if="record.assetMediaType === 'video'"
                                        class="panel-result-video"
                                        :src="record.assetUrl"
                                        controls
                                        playsinline
                                        preload="metadata"
                                        :poster="record.assetCoverUrl"
                                        @error="markHistoryVideoError(record.taskId)"
                                        @click.stop
                                    ></video>
                                    <ShortDramaImagePreview
                                        v-else-if="record.assetUrl"
                                        class="panel-result-image"
                                        :src="record.assetUrl"
                                        :alt="record.message || '生成结果'"
                                    />
                                </div>
                                <div
                                    v-else-if="record.isGenerating || record.status === 'failed'"
                                    :class="['panel-result-frame', 'is-generating', { 'is-failed': record.status === 'failed' }]"
                                >
                                    <div v-if="record.status === 'failed'" class="panel-result-failed-placeholder">生成失败</div>
                                    <ShortDramaGrainientPlaceholder v-else label="生成中" />
                                </div>
                            </div>

                            <div
                                v-for="message in visibleChatMessages"
                                :key="message.id"
                                :class="['chat-message', `is-${message.role}`, { 'is-loading': message.loading }]"
                            >
                                <div class="chat-bubble">
                                    <p v-if="message.loading && message.text === '生成中'">
                                        生成中<span class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                                    </p>
                                    <p v-else v-html="highlightMentionHtml(message.text)"></p>
                                    <small v-if="message.status && !message.loading">{{ message.status }}</small>
                                </div>
                            </div>

                            <div v-if="showPanelGeneratingFallback" class="panel-result-frame is-generating">
                                <ShortDramaGrainientPlaceholder />
                            </div>

                            <div
                                v-if="latestPanelResultUrl && !panelHistoryRecords.some((record) => record.assetId === latestPanelResultAsset?.id)"
                                class="panel-result-frame is-response"
                                @click="latestPanelResultAsset?.id ? usePreviewRecord(latestPanelResultAsset.id) : undefined"
                            >
                                <ShortDramaImagePreview
                                    class="panel-result-image"
                                    :src="latestPanelResultUrl"
                                    :alt="activeShot?.title || '分镜图'"
                                />
                            </div>
                        </div>
                    </div>

                        <div ref="composerRef" :class="['composer', `is-${generationMode}`]">
                            <div v-if="modeMenuOpen" class="mode-menu" :style="modeMenuStyle" @click.stop>
                            <button
                                v-for="item in modeOptions"
                                :key="item.value"
                                :class="{ 'is-active': generationMode === item.value }"
                                type="button"
                                @click="chooseMode(item.value)"
                            >
                                {{ item.label }}
                                <span v-if="generationMode === item.value">✓</span>
                            </button>
                        </div>
                        <div v-if="modelMenuOpen" class="generation-settings-menu" @click.stop>
                            <div class="generation-settings-row">
                                <span>选用模型</span>
                                <strong>{{ activeGenerationModelName }}</strong>
                            </div>
                            <div class="generation-settings-model-list">
                                <template v-if="generationMode !== 'video_generate'">
                                    <template v-if="imageNanoPickerStep === 'root'">
                                        <button v-for="model in imageNonNanoModelOptions" :key="model.id" :class="{ 'is-active': activeGenerationModel?.id === model.id }" type="button" @click="selectGenerationModel(model)">
                                            <span>{{ model.name }}</span>
                                            <i v-if="activeGenerationModel?.id === model.id">✓</i>
                                        </button>
                                        <button v-if="imageNanoModelOptions.length" :class="{ 'is-active': isActiveImageNanoModel }" type="button" @click="openImageNanoPicker">
                                            <span>Nano Banana</span>
                                            <i v-if="isActiveImageNanoModel">✓</i>
                                        </button>
                                    </template>
                                    <template v-else-if="imageNanoPickerStep === 'series'">
                                        <button class="generation-settings-nano-back" type="button" @click="imageNanoPickerStep = 'root'">‹ Nano Banana</button>
                                        <button v-for="series in imageNanoSeriesOptions" :key="series.value" type="button" @click="selectImageNanoSeries(series.value)"><span>{{ series.label }}</span></button>
                                    </template>
                                    <template v-else>
                                        <button class="generation-settings-nano-back" type="button" @click="imageNanoPickerStep = imageNanoSeriesOptions.length > 1 ? 'series' : 'root'">‹ {{ activeImageNanoSeriesLabel }}</button>
                                        <button v-for="model in imageNanoVariants" :key="model.id" :class="{ 'is-active': activeGenerationModel?.id === model.id }" type="button" @click="selectImageNanoVariant(model)">
                                            <span>{{ nanoVariantLabel(model) }}</span>
                                            <i v-if="activeGenerationModel?.id === model.id">✓</i>
                                        </button>
                                    </template>
                                </template>
                                <template v-else>
                                <button
                                    v-for="model in activeModelOptions"
                                    :key="model.id"
                                    :class="{ 'is-active': activeGenerationModel?.id === model.id }"
                                    type="button"
                                    @click="selectGenerationModel(model)"
                                >
                                    <span>{{ model.name }}</span>
                                    <i v-if="activeGenerationModel?.id === model.id">✓</i>
                                </button>
                                </template>
                            </div>
                            <div v-if="activeGenerationResolutionOptions.length" class="generation-settings-row is-options">
                                <span>分辨率</span>
                                <div class="generation-settings-options">
                                    <button
                                        v-for="item in activeGenerationResolutionOptions"
                                        :key="item.value"
                                        :class="{ 'is-active': selectedGenerationResolution === item.value }"
                                        type="button"
                                        @click="selectGenerationResolution(item.value)"
                                    >
                                        {{ item.label }}
                                    </button>
                                </div>
                            </div>
                            <div v-if="generationMode === 'video_generate' && activeVideoModeOptions.length > 1" class="generation-settings-row is-options">
                                <span>生成模式</span>
                                <div class="generation-settings-options">
                                    <button
                                        v-for="item in activeVideoModeOptions"
                                        :key="item.value"
                                        :class="{ 'is-active': selectedVideoMode === item.value }"
                                        type="button"
                                        @click="selectVideoMode(item.value)"
                                    >
                                        {{ item.label }}
                                    </button>
                                </div>
                            </div>
                            <div v-if="generationMode === 'video_generate' && activeVideoRatioOptions.length" class="generation-settings-row">
                                <span>画幅比例</span>
                                <strong>{{ projectRatio }} <small>跟随项目</small></strong>
                            </div>
                            <button
                                v-if="generationMode === 'video_generate' && activeVideoDurationOptions.length"
                                :class="['generation-settings-row', 'is-button', { 'is-active': durationMenuOpen }]"
                                type="button"
                                @click.stop="toggleDurationMenu"
                            >
                                <span>视频时长</span>
                                <strong>{{ selectedVideoDuration }}秒</strong>
                            </button>
                            <div v-if="durationMenuOpen" class="settings-duration-menu" @click.stop>
                                <button
                                    v-for="item in activeVideoDurationOptions"
                                    :key="item.value"
                                    :class="{ 'is-active': selectedVideoDuration === item.value }"
                                    type="button"
                                    @click="selectVideoDuration(item.value)"
                                >
                                    <span>{{ item.label }}</span>
                                    <i v-if="selectedVideoDuration === item.value">✓</i>
                                </button>
                            </div>
                        </div>
                        <div v-if="mentionMenuOpen" class="mention-menu" :style="mentionMenuStyle" @click.stop>
                            <div class="mention-tabs">
                                <button
                                    :class="{ 'is-active': activeMentionTab === 'subject' }"
                                    type="button"
                                    @click="activeMentionTab = 'subject'"
                                >
                                    主体
                                </button>
                                <button
                                    :class="{ 'is-active': activeMentionTab === 'scene' }"
                                    type="button"
                                    @click="activeMentionTab = 'scene'"
                                >
                                    场景
                                </button>
                            </div>
                            <div class="mention-menu__head">
                                <strong>@主体/场景</strong>
                                <button type="button" @click="clearMentionSelections">清空</button>
                            </div>
                            <div v-if="activeMentionTab === 'subject' && subjects.length" class="mention-group">
                                <span>角色</span>
                                <button
                                    v-for="subject in subjects"
                                    :key="subject.id"
                                    :class="{ 'is-active': selectedSubjectIds.includes(subject.id) }"
                                    type="button"
                                    @click="selectMentionItem('subject', subject)"
                                >
                                    {{ subject.name }}
                                </button>
                            </div>
                            <div v-if="activeMentionTab === 'scene' && scenes.length" class="mention-group">
                                <span>场景</span>
                                <button
                                    v-for="scene in scenes"
                                    :key="scene.id"
                                    :class="{ 'is-active': selectedSceneIds.includes(scene.id) }"
                                    type="button"
                                    @click="selectMentionItem('scene', scene)"
                                >
                                    {{ scene.name }}
                                </button>
                            </div>
                        </div>
                        <div v-if="generationMode === 'video_generate'" class="composer-frame-strip">
                            <div class="composer-frame-thumb is-first">
                                <img v-if="videoStartFrameUrl" :src="videoStartFrameUrl" alt="" />
                            </div>
                            <button class="frame-switch" type="button" @click.stop="swapVideoFrames">
                                <span>⇄</span>
                            </button>
                            <button ref="lastFrameButtonRef" class="composer-frame-thumb is-last" type="button" @click.stop="toggleLastFrameMenu">
                                <img v-if="videoEndFrameUrl" :src="videoEndFrameUrl" alt="" />
                                <span v-else class="frame-empty-mark"><em>尾帧</em></span>
                                <b v-if="lastFramePreviewUrl" @click.stop="clearLastFrame">×</b>
                            </button>
                        </div>
                        <div
                            v-if="lastFrameMenuOpen"
                            ref="lastFrameMenuRef"
                            class="last-frame-menu"
                            :style="lastFrameMenuStyle"
                            @click.stop
                        >
                            <button type="button" @click="chooseLastFrameUpload">上传尾帧</button>
                            <button
                                v-if="previousFrameOptionVisible"
                                type="button"
                                :disabled="previousFrameOptionDisabled"
                                @click="choosePreviousShotFrame"
                            >
                                {{ extractingPreviousVideoTail ? '提取中...' : previousFrameOptionLabel }}
                            </button>
                            <button type="button" @click="chooseNextShotFrame">使用下一分镜图</button>
                        </div>
                        <input
                            v-if="generationMode === 'video_generate'"
                            ref="lastFrameInputRef"
                            type="file"
                            accept="image/*"
                            hidden
                            @change="handleLastFrameFile"
                        />
                        <div class="composer-input-row">
                            <div v-if="generationMode === 'image_edit' && activeImageAsset?.url" class="composer-reference-thumb">
                                <img :src="activeImageAsset.url" alt="" />
                            </div>
                            <div
                                ref="composerEditorRef"
                                class="composer-editor"
                                :contenteditable="submittingGeneration ? 'false' : 'true'"
                                :data-placeholder="composerPlaceholder"
                                role="textbox"
                                aria-multiline="true"
                                @input="syncComposerFromEditor"
                                @keydown="handleComposerKeydown"
                                @paste.prevent="handleComposerPaste"
                            ></div>
                        </div>
                        <div class="composer-actions">
                            <button
                                :class="['cube-btn', { 'is-active': modelMenuOpen }]"
                                type="button"
                                :title="activeGenerationModelName"
                                aria-label="输入提示词"
                                @click.stop="toggleModelMenu"
                            >
                                <img :src="iconUrl('moxing.svg')" alt="" />
                                <span>{{ activeGenerationModelName }}</span>
                            </button>
                            <button ref="modeButtonRef" class="mode-pill" type="button" @click.stop="toggleModeMenu">
                                {{ activeModeLabel }}
                                <img :src="iconUrl('Down.svg')" alt="" />
                            </button>
                            <button
                                v-if="mentionEnabled"
                                ref="mentionButtonRef"
                                :class="['mention-btn', { 'is-active': mentionMenuOpen || selectedMentionCount > 0 }]"
                                type="button"
                                aria-label="@角色/场景"
                                @click.stop="toggleMentionMenu"
                            >
                                <img :src="iconUrl('@.svg')" alt="" />
                            </button>
                            <span class="composer-count" :title="composerBillingTip">
                                <img :src="iconUrl('shengcheng.svg')" alt="" />
                                <span>{{ composerBillingText }}</span>
                            </span>
                            <button class="send-btn" type="button" :disabled="submittingGeneration" aria-label="发送" @click="submitGeneration">
                                <img :src="iconUrl('Arrow-up.svg')" alt="" />
                            </button>
                        </div>
                    </div>
                </div>

                <div v-else class="music-editor">
                    <div class="music-editor-head">
                        <h3>背景音乐</h3>
                    </div>
                    <div class="music-prompt-box">
                        <textarea
                            v-model="draftBgmPrompt"
                            placeholder="描述你想要生成的音乐"
                            @input="bgmPromptDirty = true"
                        ></textarea>
                        <div class="music-prompt-tools">
                            <span class="music-cost" :title="isBgmActualUsageSettlement ? '按实际 Token 用量结算' : (estimatingBgm ? '点数估算中' : '预计消耗点数')">
                                <img :src="iconUrl('shengcheng.svg')" alt="" />
                                <span>{{ bgmBillingText }}</span>
                            </span>
                            <button
                                :class="['music-generate-btn', { 'is-ready': !!effectiveBgmPrompt && !bgmIsBusy }]"
                                type="button"
                                :disabled="bgmIsBusy || !effectiveBgmPrompt"
                                aria-label="生成背景音乐"
                                @click="submitBgmTask(true)"
                            >
                                <img :src="iconUrl('Arrow-up.svg')" alt="" />
                            </button>
                        </div>
                    </div>
                    <p v-if="bgmErrorText" class="music-error">{{ bgmErrorText }}</p>
                    <p v-else class="music-tip">生成背景音乐后可随预览播放，是否合成到导出视频由下方音轨开关控制。</p>
                    <div class="music-history">
                        <div class="music-history-head">
                            <span>生成记录</span>
                            <em>{{ bgmHistoryRecords.length ? `${bgmHistoryRecords.length}条` : '暂无记录' }}</em>
                        </div>
                        <div v-if="bgmHistoryRecords.length" class="music-history-list">
                            <div
                                v-for="record in bgmHistoryRecords"
                                :key="record.id"
                                :class="['music-record-card', {
                                    'is-active': record.url && activeBgmPlaybackUrl === record.url && bgmPlaying,
                                    'is-selected': record.isSelected,
                                    'is-applied': record.isApplied,
                                    'is-failed': record.status === 'failed',
                                    'is-busy': record.isBusy
                                }]"
                                @click="selectBgmRecord(record)"
                            >
                                <button
                                    class="music-record-play"
                                    type="button"
                                    :disabled="!record.url"
                                    :aria-label="record.url && activeBgmPlaybackUrl === record.url && bgmPlaying ? '暂停背景音乐' : '播放背景音乐'"
                                    @click="toggleBgmPlayback(record.asset)"
                                >
                                    <span></span>
                                </button>
                                <div class="music-record-main">
                                    <div class="music-record-title-row">
                                        <div class="music-record-title">{{ record.title }}</div>
                                        <div class="music-record-actions">
                                            <button
                                                v-if="record.status === 'success' && record.url"
                                                class="music-record-download"
                                                type="button"
                                                aria-label="下载背景音乐"
                                                @click.stop="downloadBgmRecord(record)"
                                            >
                                                <img :src="downloadIcon" alt="" />
                                            </button>
                                            <button
                                                v-if="record.asset?.id || record.status === 'failed'"
                                                class="music-record-delete"
                                                type="button"
                                                :disabled="isDeletingBgmRecord(record)"
                                                aria-label="删除背景音乐"
                                                @click.stop="deleteBgmRecord(record)"
                                            >
                                                <img :src="iconUrl('Delete.svg')" alt="" />
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        class="music-record-progress"
                                        type="button"
                                        :disabled="!record.url || !record.duration"
                                        aria-label="跳转背景音乐播放位置"
                                        @click.stop="seekBgmRecord(record, $event)"
                                    >
                                        <i :style="{ width: `${record.progressPercent}%` }"></i>
                                    </button>
                                    <div class="music-record-meta">
                                        <span>{{ record.timeText }}</span>
                                        <em>{{ record.statusText }}</em>
                                    </div>
                                    <p v-if="record.error" class="music-record-error">{{ record.error }}</p>
                                </div>
                            </div>
                        </div>
                        <div v-else class="music-history-empty">暂无背景音乐生成记录</div>
                    </div>
                    <button
                        class="music-apply-btn"
                        type="button"
                        :disabled="!canApplyBgm"
                        @click="applySelectedBgm"
                    >
                        应用
                    </button>
                </div>
            </aside>
        </main>

        <div v-if="batchVideoDialogVisible" class="batch-video-mask" @click.self="closeBatchVideoDialog">
            <div class="batch-video-dialog">
                <div class="batch-video-count">
                    <img :src="iconUrl('shipin.svg')" alt="" />
                    <strong>x {{ batchVideoShotCount }}</strong>
                </div>
                <section class="batch-video-panel">
                    <header>转视频任务明细</header>
                    <div class="batch-video-row">
                        <div>
                            <span>视频模型</span>
                            <em>{{ batchVideoShotCount }} 个分镜</em>
                        </div>
                        <div class="batch-video-model-wrap" @click.stop>
                            <button
                                type="button"
                                :class="['batch-video-model-trigger', { 'is-active': batchVideoModelMenuOpen }]"
                                :disabled="generatingVideos"
                                @click="toggleBatchVideoModelMenu"
                            >
                                <span>{{ batchVideoModelName }}</span>
                                <img :src="iconUrl('Down.svg')" alt="" />
                            </button>
                            <div v-if="batchVideoModelMenuOpen" class="batch-video-model-menu">
                                <button
                                    v-for="model in videoModelOptions"
                                    :key="model.id || model.value"
                                    type="button"
                                    :class="{ 'is-active': batchVideoModelId === (model.value || model.id) }"
                                    @click="selectBatchVideoModel(model)"
                                >
                                    <span>{{ model.name }}</span>
                                    <i v-if="batchVideoModelId === (model.value || model.id)">✓</i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div v-if="batchVideoResolutionOptions.length" class="batch-video-row is-resolution">
                        <div>
                            <span>分辨率</span>
                            <em>用于本次批量生成</em>
                        </div>
                        <div class="batch-video-resolution">
                            <button
                                v-for="item in batchVideoResolutionOptions"
                                :key="item.value"
                                type="button"
                                :class="{ 'is-active': batchVideoResolution === item.value }"
                                @click="selectBatchVideoResolution(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>
                    <div v-if="batchVideoModeOptions.length > 1" class="batch-video-row is-resolution">
                        <div>
                            <span>生成模式</span>
                            <em>切换后将同步规格、时长和价格</em>
                        </div>
                        <div class="batch-video-resolution">
                            <button
                                v-for="item in batchVideoModeOptions"
                                :key="item.value"
                                type="button"
                                :class="{ 'is-active': batchVideoMode === item.value }"
                                @click="selectBatchVideoMode(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>
                    <div v-if="batchVideoDurationOptions.length" class="batch-video-row is-resolution">
                        <div>
                            <span>时长</span>
                            <em>按最终市场 SKU 计费</em>
                        </div>
                        <div class="batch-video-resolution">
                            <button
                                v-for="item in batchVideoDurationOptions"
                                :key="item.value"
                                type="button"
                                :class="{ 'is-active': batchVideoDuration === item.value }"
                                @click="selectBatchVideoDuration(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>
                    <div class="batch-video-row">
                        <div>
                            <span>生成数量</span>
                            <em>已生成或生成中的分镜不会重复提交</em>
                        </div>
                        <strong>{{ batchVideoShotCount }}</strong>
                    </div>
                    <div class="batch-video-row">
                        <div>
                            <span>积分消耗</span>
                            <em>{{ batchVideoBillingTip }}</em>
                        </div>
                        <strong>{{ batchVideoCostText }}</strong>
                    </div>
                </section>
                <footer class="batch-video-actions">
                    <button type="button" class="batch-video-cancel" :disabled="generatingVideos" @click="closeBatchVideoDialog">取消</button>
                    <button type="button" class="batch-video-confirm" :disabled="generatingVideos || !batchVideoShotCount || !batchVideoModelId" @click="generateShotVideos">
                        {{ generatingVideos ? '提交中...' : '确认' }}
                    </button>
                </footer>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { uploadImage, uploadVideo } from '@/api/app'
import {
    copyShortDramaStoryboardShot,
    createShortDramaExportPackage,
    createShortDramaExportVideo,
    createShortDramaGeneration,
    deleteShortDramaAsset,
    deleteShortDramaGeneration,
    deleteShortDramaStoryboardShot,
    estimateShortDramaGeneration,
    extractShortDramaVideoLastFrame,
    getShortDramaAssets,
    getShortDramaGenerationDetail,
    getShortDramaGenerationLists,
    getShortDramaHome,
    getShortDramaScriptPlanDetail,
    insertShortDramaStoryboardShot,
    registerShortDramaAsset,
    renameShortDramaProject,
    selectShortDramaStoryboardAsset,
    saveShortDramaProjectGenerationSettings,
    streamShortDramaGeneration
} from '@/api/short_drama'
import feedback from '@/utils/feedback'
import downloadIcon from '@/assets/images/icon/xiazai.svg'
import {
    cleanUserDisplayPrompt,
    cleanUserVisiblePrompt,
    cleanVisibleImagePrompt,
    cleanVisibleVideoDisplayPrompt,
    cleanVisibleVideoPrompt,
    stripPromptNoise
} from '@/utils/short-drama-prompt'
import {
    readShortDramaCreationCache,
    readShortDramaHomeConfigCache,
    readShortDramaImageModelSelection,
    writeShortDramaCreationCache,
    writeShortDramaHomeConfigCache,
    writeShortDramaImageModelSelection
} from '@/utils/short-drama-cache'
import { resolveShortDramaResolution, shortDramaResolutionOptions } from '@/utils/short-drama-model-resolution'
import ShortDramaFlowTopbar from '~/components/short-drama/ShortDramaFlowTopbar.vue'
import ShortDramaGrainientPlaceholder from '~/components/short-drama/ShortDramaGrainientPlaceholder.vue'
import ShortDramaImagePreview from '~/components/short-drama/ShortDramaImagePreview.vue'

type FlowStepKey = 'script' | 'subject' | 'scene' | 'storyboard'
type GenerationStatus = 'pending' | 'queued' | 'running' | 'success' | 'failed' | 'canceled' | ''
type GenerationMode = 'image_edit' | 'image_generate' | 'video_generate'
type LastFrameMode = 'empty' | 'next_shot' | 'previous_shot_image' | 'previous_video_tail' | 'upload'
type NanoPickerStep = 'root' | 'series' | 'variant'
type ShotItem = {
    id: string
    title: string
    description: string
    scene_name: string
    time_of_day: string
    visual_description: string
    composition: string
    shot_type: string
    angle: string
    action: string
    result: string
    atmosphere: string
    camera_movement: string
    dialogue: string
    image_prompt: string
    video_prompt: string
    scene_ref_id: string
    subject_ref_ids: string[]
    voice_role: string
    bgm_prompt: string
    duration: number
    selected_image_asset_id: number
    selected_video_asset_id: number
    selected_image_asset?: AssetItem | null
    selected_video_asset?: AssetItem | null
}
type AssetItem = {
    id: number
    task_id: string
    shot_id: string
    asset_type: string
    title: string
    uri: string
    url: string
    cover_url?: string
    duration: number
    created_at: string
    meta: Record<string, any>
}
type GenerationTask = {
    task_id: string
    task_type: string
    status: GenerationStatus
    shot_id: string
    error_msg: string
    progress: number
    request?: Record<string, any>
    result?: Record<string, any>
    input_asset_ids: number[]
    output_asset_ids: number[]
    created_at?: string
    finished_at?: string
}
type MusicHistoryRecord = {
    id: string
    title: string
    status: GenerationStatus
    statusText: string
    error: string
    url: string
    duration: number
    timeText: string
    progressPercent: number
    isBusy: boolean
    isApplied: boolean
    isSelected: boolean
    sortTime: number
    asset: AssetItem | null
}
type NamedItem = { id: string; name: string; image?: string; description?: string; visual_prompt?: string; image_prompt?: string }
type ModelOption = {
    id: string
    value: string
    channel_code?: string
    name: string
    model_code?: string
    display_group?: string
    display_series?: string
    display_series_label?: string
    display_variant_label?: string
    max_reference_images?: number
    max_reference_assets?: number
    billing_unit?: string
    billing_unit_size?: number
    settlement_mode?: string
    platform_unit_cost?: string | number
    tenant_unit_price?: string | number
    default_quality?: string
    ratio_options?: string[]
    mode_options?: string[]
    quality_options?: unknown[]
    resolution_options?: unknown[]
    duration_options?: Array<{ value?: number | string; label?: string }>
    durations?: Array<number | string>
    market_product_id?: number
    resource_type?: string
    app_code?: string
    skus?: Array<{
        market_sku_id?: number
        title?: string
        quality?: string
        resolution?: string
        duration?: number | string
        model?: string
        input_mode?: string
        usage_unit?: string
        usage_unit_size?: number | string
        platform_unit_cost?: string | number
        tenant_unit_price?: string | number
    }>
}
type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string; status?: string; loading?: boolean }
type ImageEditHistoryRecord = {
    taskId: string
    message: string
    status: GenerationStatus
    statusText: string
    sortTime: number
    assetUrl: string
    assetCoverUrl: string
    assetId: number
    assetType: string
    assetMediaType: 'image' | 'video'
    isSelected: boolean
    isGenerating?: boolean
}
type ImageEditSession = {
    shotId: string
    taskId: string
    sourceAsset: AssetItem | null
}
type StoryboardCacheData = {
    projectTitle: string
    projectRatio?: string
    shots: ShotItem[]
    subjects: NamedItem[]
    scenes: NamedItem[]
    assets: AssetItem[]
    tasks: GenerationTask[]
    imageModelOptions: ModelOption[]
    videoModelOptions: ModelOption[]
    selectedModelId: string
    selectedVideoModelId: string
    selectedVideoMode: string
    musicPlan: Record<string, any>
    draftBgmPrompt: string
    savedBgmPrompt: string
    activeShotId: string
    activePreviewAssetId: number
}

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()

const syncingData = ref(false)
const restoredFromCache = ref(false)
const projectRatio = ref('16:9')
const projectTitle = ref('短剧项目')
const shots = ref<ShotItem[]>([])
const subjects = ref<NamedItem[]>([])
const scenes = ref<NamedItem[]>([])
const assets = ref<AssetItem[]>([])
const tasks = ref<GenerationTask[]>([])
const imageModelOptions = ref<ModelOption[]>([])
const videoModelOptions = ref<ModelOption[]>([])
const activeShotId = ref('')
const activePreviewAssetId = ref(0)
const storyboardStructureBusy = ref(false)
const rightTab = ref<'draw' | 'music'>('draw')
const generationMode = ref<GenerationMode>('image_edit')
const selectedModelId = ref('')
const selectedVideoModelId = ref('')
const selectedImageResolution = ref('')
const selectedVideoResolution = ref('')
const selectedVideoDuration = ref(0)
const selectedVideoMode = ref('')
const projectGenerationSettings = ref<Record<string, any>>({})
const selectedSubjectIds = ref<string[]>([])
const selectedSceneIds = ref<string[]>([])
const composerText = ref('')
const composerDrafts = ref<Record<string, string>>({})
const composerMentionDrafts = ref<Record<string, { subjectIds: string[]; sceneIds: string[] }>>({})
const visiblePromptDraft = ref('')
const visiblePromptDrafts = ref<Record<string, string>>({})
const suppressShotDraftSave = ref(false)
const chatMessages = ref<ChatMessage[]>([])
const currentGenerationTaskId = ref('')
const lastUserEditText = ref('')
const imageEditSession = ref<ImageEditSession | null>(null)
const submittingGeneration = ref(false)
const modeMenuOpen = ref(false)
const modelMenuOpen = ref(false)
const imageNanoPickerStep = ref<NanoPickerStep>('root')
const imageNanoPickerSeries = ref('')
const resolutionMenuOpen = ref(false)
const durationMenuOpen = ref(false)
const mentionMenuOpen = ref(false)
const lastFrameMenuOpen = ref(false)
const activeMentionTab = ref<'subject' | 'scene'>('subject')
const drawScrollRef = ref<HTMLElement | null>(null)
const composerRef = ref<HTMLElement | null>(null)
const composerEditorRef = ref<HTMLElement | null>(null)
const historyVideoErrors = ref<Record<string, boolean>>({})
const modeButtonRef = ref<HTMLElement | null>(null)
const mentionButtonRef = ref<HTMLElement | null>(null)
const lastFrameButtonRef = ref<HTMLElement | null>(null)
const lastFrameMenuRef = ref<HTMLElement | null>(null)
const modeMenuLeft = ref(77)
const mentionMenuLeft = ref(179)
const lastFrameMenuLeft = ref(116)
const lastFrameMenuTop = ref(0)
const promptCollapsed = ref(true)
const lastFrameMode = ref<LastFrameMode>('empty')
const frameOrderSwapped = ref(false)
const lastFrameFile = ref<File | null>(null)
const lastFramePreviewLocal = ref('')
const lastFrameAsset = ref<AssetItem | null>(null)
const extractingPreviousVideoTail = ref(false)
const lastFrameInputRef = ref<HTMLInputElement | null>(null)
const previewReplaceInputRef = ref<HTMLInputElement | null>(null)
const previewVideoRef = ref<HTMLVideoElement | null>(null)
const shotStripRef = ref<HTMLElement | null>(null)
const replacingPreviewAsset = ref(false)
const previewUploadMode = ref<'replace' | 'manual'>('replace')

const musicPlan = ref<Record<string, any>>({})
const draftBgmPrompt = ref('')
const savedBgmPrompt = ref('')
const bgmPromptDirty = ref(false)
const submittingBgm = ref(false)
const retryingBgm = ref(false)
const bgmPlaying = ref(false)
const bgmDuration = ref(0)
const bgmCurrentTime = ref(0)
const bgmExportEnabled = ref(true)
const appliedBgmAssetId = ref(0)
const pendingBgmAssetId = ref(0)
const bgmEstimateInfo = ref<Record<string, any>>({})
const estimatingBgm = ref(false)
const deletingBgmAssetIds = ref<number[]>([])
const deletingBgmTaskIds = ref<string[]>([])
const activeBgmPlaybackUrl = ref('')
const bgmPlaybackSource = ref<'manual' | 'timeline' | ''>('')
const generatingShotImages = ref(false)
const generatingActiveShotImageTask = ref(false)
const generatingVideos = ref(false)
const batchVideoDialogVisible = ref(false)
const batchVideoModelId = ref('')
const batchVideoModelMenuOpen = ref(false)
const batchVideoResolution = ref('')
const batchVideoDuration = ref(0)
const batchVideoMode = ref('')
const exportingVideo = ref(false)
const exportingPackage = ref(false)
const batchMenuOpen = ref(false)
const exportMenuOpen = ref(false)
const exportWatermarkEnabled = ref(true)
const exportBusy = computed(() => exportingVideo.value || exportingPackage.value)
const timelinePlaying = ref(false)
const timelineProgressShotId = ref('')
const timelineProgressPercent = ref(0)
const timelineSeeking = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let exportPollTimer: ReturnType<typeof setTimeout> | null = null
let timelineTimer: ReturnType<typeof setTimeout> | null = null
let timelineProgressTimer: ReturnType<typeof setInterval> | null = null
let bgmEstimateTimer: ReturnType<typeof setTimeout> | null = null
let generationSettingsSaveTimer: ReturnType<typeof setTimeout> | null = null
let timelineStartedAt = 0
let timelineCurrentDurationMs = 3000
let timelineCurrentIndex = 0
let audioPlayer: HTMLAudioElement | null = null
let previousBodyOverflow = ''
let previousHtmlOverflow = ''
const modeOptions: Array<{ value: GenerationMode; label: string }> = [
    { value: 'image_edit', label: '图片修改' },
    { value: 'image_generate', label: '图片生成' },
    { value: 'video_generate', label: '视频生成' }
]

const queryValue = (key: string) => {
    const value = route.query[key]
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}
const parseStoryboardRatio = (value: any) => {
    const normalized = String(value || '')
        .trim()
        .replace(/[：]/g, ':')
        .replace(/\s+/g, '')
    const matched = normalized.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
        || normalized.match(/^(\d+(?:\.\d+)?)[/／](\d+(?:\.\d+)?)$/)
    const width = Number(matched?.[1] || 0)
    const height = Number(matched?.[2] || 0)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { width: 16, height: 9, ratio: '16:9' }
    }
    return { width, height, ratio: `${width}:${height}` }
}
const normalizeStoryboardRatio = (value: any) => parseStoryboardRatio(value).ratio
const storyboardAspectStyle = computed(() => {
    const ratio = parseStoryboardRatio(projectRatio.value)
    return {
        '--storyboard-aspect-ratio': `${ratio.width} / ${ratio.height}`,
        '--storyboard-aspect-width': String(ratio.width),
        '--storyboard-aspect-height': String(ratio.height)
    }
})
const projectId = computed(() => queryValue('project_id'))
const scriptTaskId = computed(() => queryValue('task_id'))
const routeQuery = computed(() => ({ project_id: projectId.value, task_id: scriptTaskId.value }))
const activeShot = computed(() => timelineShots.value.find((shot) => shot.id === activeShotId.value) || timelineShots.value[0] || null)
const currentStoryboardShot = computed(() => activeShot.value)
const currentStoryboardImageAsset = computed(() => {
    const shotId = currentStoryboardShot.value?.id || ''
    return initialStoryboardImageAssetForShot(shotId) || displayImageAssetForShot(shotId)
})
const activeImageAsset = computed(() => {
    const shotId = activeShot.value?.id || ''
    return displayImageAssetForShot(shotId) || initialStoryboardImageAssetForShot(shotId)
})
const activeShotRecords = computed(() => {
    const shotId = activeShot.value?.id || ''
    if (!shotId) return []
    return assets.value
        .filter((asset) => ['shot_image', 'shot_video'].includes(asset.asset_type) && asset.url && asset.shot_id === shotId)
        .sort((a, b) => b.id - a.id)
        .slice(0, 8)
})
const activePreviewAsset = computed(() => {
    return activeShotRecords.value.find((asset) => asset.id === activePreviewAssetId.value)
        || timelineAssetForShot(activeShot.value?.id || '')
        || activeImageAsset.value
        || null
})
const previewReplaceAccept = computed(() => activePreviewAsset.value?.asset_type === 'shot_video' ? 'video/*' : 'image/*')
const isPreviewReplaceAsset = (asset: AssetItem | null | undefined) => {
    if (!asset) return false
    return String(asset.task_id || '').startsWith('manual_replace_')
        || String(asset.meta?.source || '') === 'pc_storyboard_preview_replace'
}
const isGeneratedShotImageAsset = (asset: AssetItem | null | undefined) => {
    return !!asset?.url && asset.asset_type === 'shot_image' && !isPreviewReplaceAsset(asset)
}
const isLikelyVideoUrl = (url: string) => {
    return /^(blob:|data:video\/)/i.test(url) || /\.(mp4|webm|mov|m4v|ogg)(?:[?#]|$)/i.test(url)
}
const markHistoryVideoError = (taskId: string) => {
    if (!taskId) return
    historyVideoErrors.value = {
        ...historyVideoErrors.value,
        [taskId]: true
    }
}
const activePanelImageAsset = computed(() => {
    const session = imageEditSession.value
    if (
        generationMode.value === 'image_edit'
        && session?.shotId
        && session.shotId === activeShot.value?.id
        && session.sourceAsset?.url
        && (chatMessages.value.length || submittingGeneration.value)
    ) {
        return session.sourceAsset
    }
    return activeImageAsset.value
})
const latestPanelResultAsset = computed(() => {
    const session = imageEditSession.value
    if (!session?.shotId || session.shotId !== activeShot.value?.id) return null
    const sourceId = session.sourceAsset?.id || 0
    const sourceUrl = session.sourceAsset?.url || ''
    const records = activeShotRecords.value.filter((asset) => {
        return isGeneratedShotImageAsset(asset)
            && asset.id !== sourceId
            && asset.url !== sourceUrl
    })
    if (session.taskId) {
        const taskAsset = records.find((asset) => asset.task_id === session.taskId)
        if (taskAsset) return taskAsset
    }
    return records[0] || null
})
const latestPanelResultUrl = computed(() => {
    const result = latestPanelResultAsset.value
    const baseUrl = activePanelImageAsset.value?.url || ''
    if (!result?.url || result.url === baseUrl) return ''
    return result.url
})
const silentStoryboardImageSources = ['pc_storyboard_step', 'pc_scene_step', 'pc_storyboard_quick_image', 'pc_storyboard_batch_image']
const isSilentStoryboardImageTask = (task: GenerationTask) => {
    const request = task.request || {}
    const params = task.request?.params || {}
    const nested = params.params || {}
    const mode = String(request.mode || params.mode || nested.mode || '')
    const source = String(request.source || params.source || nested.source || '')
    const hasUserMessage = !!String(request.message || params.message || nested.message || '').trim()
    if (task.task_type !== 'shot_image' || mode !== 'image_generate' || hasUserMessage) return false
    if (request.silent_panel || params.silent_panel || nested.silent_panel) return true
    return silentStoryboardImageSources.includes(source)
}
const isSilentStoryboardImageAsset = (asset: AssetItem | null | undefined) => {
    if (!asset?.id || asset.asset_type !== 'shot_image') return false
    const relatedTask = tasks.value.find((task) => {
        if (task.task_type !== 'shot_image') return false
        if (asset.task_id && task.task_id === asset.task_id) return true
        return (task.output_asset_ids || []).map(Number).includes(Number(asset.id))
    })
    if (relatedTask && isSilentStoryboardImageTask(relatedTask)) return true
    const meta = asset.meta || {}
    const params = meta.params || {}
    const source = String(meta.source || params.source || '')
    return silentStoryboardImageSources.includes(source)
}
const taskOutputAsset = (task: GenerationTask) => {
    const isVideo = task.task_type === 'shot_video'
    const outputIds = new Set((task.output_asset_ids || []).map(Number).filter(Boolean))
    return assets.value.find((asset) => {
        return asset.asset_type === (isVideo ? 'shot_video' : 'shot_image')
            && asset.shot_id === task.shot_id
            && (asset.task_id === task.task_id || outputIds.has(asset.id))
            && (isVideo || isGeneratedShotImageAsset(asset))
    }) || null
}
const panelHistoryRecords = computed((): ImageEditHistoryRecord[] => {
    const shotId = activeShot.value?.id || ''
    if (!shotId) return []
    const shot = shotById(shotId) || activeShot.value
    const selectedImageId = Number(shot?.selected_image_asset_id || 0)
    const selectedVideoId = Number(shot?.selected_video_asset_id || 0)
    const currentPanelImageId = Number(activePanelImageAsset.value?.id || 0)
    const isSelectedAsset = (asset: AssetItem | null | undefined) => {
        if (!asset?.id) return false
        return asset.asset_type === 'shot_video'
            ? asset.id === selectedVideoId
            : asset.id === selectedImageId
    }
    const isCurrentPanelAsset = (asset: AssetItem | null | undefined) => {
        if (!asset?.id) return false
        return isSelectedAsset(asset) || asset.id === currentPanelImageId
    }
    const taskRecords = tasks.value
        .filter((task) => {
            return ['shot_image', 'shot_video'].includes(task.task_type)
                && task.shot_id === shotId
                && !isSilentStoryboardImageTask(task)
        })
        .map((task) => {
            const request = task.request || {}
            const params = task.request?.params || {}
            const nested = params.params || {}
            const rawMode = String(request.mode || params.mode || nested.mode || '')
            const mode = ['image_edit', 'image_generate', 'video_generate'].includes(rawMode)
                ? rawMode
                : (task.task_type === 'shot_video' ? 'video_generate' : 'image_generate')
            const isVideo = task.task_type === 'shot_video' || mode === 'video_generate'
            const asset = taskOutputAsset(task)
            const rawMessage = String(isVideo
                ? (
                    request.visible_prompt
                    || params.visible_prompt
                    || nested.visible_prompt
                    || request.video_prompt
                    || params.video_prompt
                    || nested.video_prompt
                    || request.message
                    || params.message
                    || nested.message
                    || '视频生成'
                )
                : (
                    request.message
                    || params.message
                    || nested.message
                    || request.visible_prompt
                    || params.visible_prompt
                    || nested.visible_prompt
                    || request.image_prompt
                    || params.image_prompt
                    || nested.image_prompt
                    || (mode === 'image_generate' ? '图片生成' : '图片修改')
                )
            )
            const message = isVideo
                ? normalizeVideoPromptForShot(rawMessage, shot)
                : cleanUserDisplayPrompt(rawMessage, { removeItems: shotVisibleRemoveItems(shot) })
            const videoUrl = isVideo ? String(asset?.url || '') : ''
            const coverUrl = String(asset?.cover_url || '')
            const imageUrl = isVideo ? coverUrl : String(asset?.cover_url || asset?.url || '')
            const shouldRenderVideo = isVideo && !!videoUrl && !historyVideoErrors.value[task.task_id] && (asset?.asset_type === 'shot_video' || isLikelyVideoUrl(videoUrl))
            const assetType = asset?.asset_type || (isVideo ? 'shot_video' : 'shot_image')
            const isGenerating = isActiveStatus(task.status)
            return {
                taskId: task.task_id,
                message,
                status: task.status,
                statusText: isGenerating ? '生成中' : (task.status === 'failed' ? (task.error_msg || '生成失败') : (isVideo ? '视频已生成' : '图片已生成')),
                sortTime: historySortTime(task),
                assetUrl: shouldRenderVideo ? videoUrl : imageUrl,
                assetCoverUrl: isVideo ? coverUrl : imageUrl,
                assetId: asset?.id || 0,
                assetType,
                assetMediaType: shouldRenderVideo ? 'video' : 'image',
                isSelected: isCurrentPanelAsset(asset),
                isGenerating
            }
        })
        .filter((record): record is ImageEditHistoryRecord => {
            if (!record) return false
            if (isActiveStatus(record.status) && !record.assetUrl) return true
            if (record.assetId === currentPanelImageId && record.assetType === 'shot_image' && record.status === 'success') return true
            return !!(record.assetUrl || record.status === 'failed')
        })
    const existingAssetIds = new Set(taskRecords.map((record) => record.assetId).filter(Boolean))
    const assetRecords = activeShotRecords.value
        .filter((asset) => {
            return asset.id
                && asset.url
                && !existingAssetIds.has(asset.id)
                && !isSilentStoryboardImageAsset(asset)
                && asset.id !== currentStoryboardImageAsset.value?.id
        })
        .map((asset) => {
            const isVideo = asset.asset_type === 'shot_video'
            const selected = isSelectedAsset(asset)
            const defaultMessage = isVideo ? shotVideoPromptText(shot) : shotImagePromptText(shot)
            return {
                taskId: `asset_${asset.id}`,
                message: isVideo
                    ? normalizeVideoPromptForShot(String(asset.meta?.visible_prompt || asset.meta?.video_prompt || asset.meta?.prompt || defaultMessage || '视频生成'), shot)
                    : cleanDisplayPromptForMode(
                        String(asset.meta?.visible_prompt || asset.meta?.prompt || defaultMessage || '图片生成'),
                        'image_generate',
                        shot
                    ),
                status: 'success' as GenerationStatus,
                statusText: selected ? '已替换到分镜' : '历史结果',
                sortTime: historySortTime({ created_at: asset.created_at, task_id: `asset_${asset.id}` } as GenerationTask) || asset.id,
                assetUrl: isVideo ? String(asset.url || '') : String(asset.cover_url || asset.url || ''),
                assetCoverUrl: String(asset.cover_url || asset.url || ''),
                assetId: asset.id,
                assetType: asset.asset_type,
                assetMediaType: isVideo && isLikelyVideoUrl(String(asset.url || '')) ? 'video' as const : 'image' as const,
                isSelected: selected
            }
        })
    const records = [...taskRecords, ...assetRecords]
        .sort((a, b) => {
            if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime
            return String(a.taskId).localeCompare(String(b.taskId))
        })
    return records
})
const activeImageModel = computed(() => {
    return imageModelOptions.value.find((model) => model.id === selectedModelId.value || model.value === selectedModelId.value)
        || imageModelOptions.value[0]
        || null
})
const activeImageModelName = computed(() => activeImageModel.value?.name || '默认模型')
const isNanoBananaImageModel = (model: ModelOption | null | undefined) => Boolean(model && (model.display_group === 'nano_banana' || model.value.startsWith('market_nano_banana:')))
const nanoSeriesValue = (model: ModelOption) => model.display_series || (String(model.model_code || '').includes(':official') ? 'official' : 'common')
const nanoSeriesLabel = (model: ModelOption) => model.display_series_label || (nanoSeriesValue(model) === 'official' ? '官方' : '常规')
const nanoVariantLabel = (model: ModelOption) => model.display_variant_label || model.name
const imageNanoModelOptions = computed(() => imageModelOptions.value.filter((model) => isNanoBananaImageModel(model)))
const imageNonNanoModelOptions = computed(() => imageModelOptions.value.filter((model) => !isNanoBananaImageModel(model)))
const isActiveImageNanoModel = computed(() => isNanoBananaImageModel(activeImageModel.value))
const activeImageNanoSeries = computed(() => imageNanoPickerSeries.value || nanoSeriesValue(activeImageModel.value || imageNanoModelOptions.value[0] || ({ id: '', value: '', name: '' } as ModelOption)))
const imageNanoSeriesOptions = computed(() => {
    const values = new Map<string, string>()
    imageNanoModelOptions.value.forEach((model) => values.set(nanoSeriesValue(model), nanoSeriesLabel(model)))
    return Array.from(values, ([value, label]) => ({ value, label }))
})
const activeImageNanoSeriesLabel = computed(() => imageNanoSeriesOptions.value.find((item) => item.value === activeImageNanoSeries.value)?.label || activeImageNanoSeries.value)
const imageNanoVariants = computed(() => imageNanoModelOptions.value.filter((model) => nanoSeriesValue(model) === activeImageNanoSeries.value))
const activeVideoModel = computed(() => {
    return videoModelOptions.value.find((model) => model.id === selectedVideoModelId.value || model.value === selectedVideoModelId.value)
        || videoModelOptions.value[0]
        || null
})
const normalizeVideoResolutionOption = (value: string) => {
    const text = String(value || '').trim()
    const lower = text.toLowerCase()
    if (!text) return ''
    if (/(^|[^0-9])4k([^0-9]|$)|2160/.test(lower)) return '4K'
    if (/(^|[^0-9])2k([^0-9]|$)|1440/.test(lower)) return '2K'
    if (/1080/.test(lower)) return '1080P'
    if (/720/.test(lower)) return '720P'
    if (/480/.test(lower)) return '480P'
    if (text.includes('超清')) return '1080P'
    if (text.includes('高清')) return '720P'
    if (text.includes('标清')) return '480P'
    return ''
}
const videoResolutionOptionsForModel = (model: ModelOption | null | undefined) => shortDramaResolutionOptions(model)
const marketVideoAppCode = (model: ModelOption | null | undefined) => {
    const explicit = String(model?.app_code || '').trim().toLowerCase()
    if (explicit) return explicit
    const value = String(model?.value || model?.id || '').trim().toLowerCase()
    return value.match(/^market_video_app:([^:]+):\d+$/)?.[1] || ''
}
const videoModeOptionsForModel = (model: ModelOption | null | undefined) => {
    if (marketVideoAppCode(model) !== 'grok_video') return []
    const modes = new Set((model?.mode_options || []).map((item) => String(item || '').trim().toLowerCase()))
    const options: Array<{ value: string; label: string }> = []
    if (modes.has('fast')) options.push({ value: 'fast', label: '快速生成' })
    if (modes.has('standard')) options.push({ value: 'standard', label: '标准生成' })
    return options
}
const resolveVideoMode = (model: ModelOption | null | undefined, current = '') => {
    const options = videoModeOptionsForModel(model)
    const selected = String(current || '').trim().toLowerCase()
    if (options.some((item) => item.value === selected)) return selected
    return options[0]?.value || ''
}
const videoSkuModel = (sku: any) => String(sku?.model || '').trim()
const videoSkuMatchesMode = (model: ModelOption | null | undefined, sku: any, mode = '') => {
    if (marketVideoAppCode(model) !== 'grok_video') return true
    const selected = resolveVideoMode(model, mode)
    const skuModel = videoSkuModel(sku)
    return (selected === 'fast' && skuModel === 'grok-imagine-video-1.5-fast')
        || (selected === 'standard' && skuModel === 'grok-imagine-video-1.5')
}
const videoDurationOptionsForModel = (model: ModelOption | null | undefined, resolution = '', mode = '') => {
    const fromSkus = (model?.skus || [])
        .filter((sku) => !resolution || String(sku.resolution || sku.quality || '').toLowerCase() === resolution.toLowerCase())
        .filter((sku) => videoSkuMatchesMode(model, sku, mode))
        .map((sku) => Number(sku.duration || 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    const fromOptions = (model?.duration_options || []).map((item: any) => Number(typeof item === 'object' ? item?.value : item || 0)).filter((value) => value > 0)
    const values = Array.from(new Set([...fromSkus, ...fromOptions]))
        .filter((value) => marketVideoAppCode(model) !== 'grok_video' || resolveVideoMode(model, mode) !== 'standard' || value <= 15)
        .sort((a, b) => a - b)
    return values.map((value) => ({ value, label: `${value}秒` }))
}
const closestDurationValue = (values: number[], requestedDuration: number) => {
    const options = Array.from(new Set(values.map((value) => Number(value || 0)).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b)
    const requested = Number(requestedDuration || 0)
    if (!options.length || !Number.isFinite(requested) || requested <= 0) return options[0] || 0
    let closest = options[0]
    options.forEach((option) => {
        const currentDiff = Math.abs(option - requested)
        const closestDiff = Math.abs(closest - requested)
        if (currentDiff < closestDiff || (currentDiff === closestDiff && option > closest)) {
            closest = option
        }
    })
    return closest
}
const closestVideoDurationForModel = (model: ModelOption | null | undefined, resolution = '', requestedDuration = 0, mode = '') => {
    const values = videoDurationOptionsForModel(model, resolution, mode).map((item) => item.value)
    return closestDurationValue(values, Number(requestedDuration || 0)) || Math.max(1, Math.round(Number(requestedDuration || 0) || 0))
}
const batchVideoModel = computed(() => {
    return videoModelOptions.value.find((model) => model.id === batchVideoModelId.value || model.value === batchVideoModelId.value)
        || activeVideoModel.value
        || videoModelOptions.value[0]
        || null
})
const activeVideoResolutionOptions = computed(() => videoResolutionOptionsForModel(activeVideoModel.value))
const batchVideoResolutionOptions = computed(() => videoResolutionOptionsForModel(batchVideoModel.value))
const activeVideoModeOptions = computed(() => videoModeOptionsForModel(activeVideoModel.value))
const batchVideoModeOptions = computed(() => videoModeOptionsForModel(batchVideoModel.value))
const activeVideoRatioOptions = computed(() => activeVideoModel.value?.ratio_options || [])
const activeVideoDurationOptions = computed(() => videoDurationOptionsForModel(activeVideoModel.value, selectedVideoResolution.value, selectedVideoMode.value))
const batchVideoDurationOptions = computed(() => videoDurationOptionsForModel(batchVideoModel.value, batchVideoResolution.value, batchVideoMode.value))
const videoSkuForSelection = (model: ModelOption | null | undefined, resolution = '', mode = '') => {
    const skus = model?.skus || []
    return skus.find((sku) => {
        const skuResolution = String(sku.resolution || sku.quality || '')
        return (!resolution || !skuResolution || skuResolution.toLowerCase() === resolution.toLowerCase())
            && videoSkuMatchesMode(model, sku, mode)
    })
}
const activeVideoSku = computed(() => videoSkuForSelection(activeVideoModel.value, selectedVideoResolution.value, selectedVideoMode.value))
const batchVideoSku = computed(() => videoSkuForSelection(batchVideoModel.value, batchVideoResolution.value, batchVideoMode.value))
const batchVideoModelName = computed(() => batchVideoModel.value?.name || '选择模型')
const activeModelOptions = computed(() => generationMode.value === 'video_generate' ? videoModelOptions.value : imageModelOptions.value)
const activeGenerationModel = computed(() => generationMode.value === 'video_generate' ? activeVideoModel.value : activeImageModel.value)
const activeGenerationResolutionOptions = computed(() => shortDramaResolutionOptions(activeGenerationModel.value))
const selectedGenerationResolution = computed(() => generationMode.value === 'video_generate'
    ? selectedVideoResolution.value
    : selectedImageResolution.value)
const activeGenerationModelName = computed(() => {
    if (generationMode.value === 'video_generate') return activeVideoModel.value?.name || '默认模型'
    return activeImageModelName.value
})
const marketVideoSelection = (model: ModelOption | null | undefined, resolution: string, duration: number, inputMode: 'text_to_video' | 'image_reference' | 'video_edit' = 'text_to_video', videoMode = '') => {
    if (!model) return {}
    // Older cached market responses expose the entries as `specs`, while the
    // current contract uses `skus`. Keep the selection stable across a
    // frontend rollout so a valid model never submits with SKU 0.
    const skus = model.skus?.length ? model.skus : ((model as any).specs || [])
    const matchesSkuBase = (item: any, requireInputMode: boolean) => {
        const skuResolution = String(item.resolution || item.quality || '')
        const matchesResolution = !resolution || !skuResolution || skuResolution.toLowerCase() === resolution.toLowerCase()
        if (!matchesResolution) return false
        if (!videoSkuMatchesMode(model, item, videoMode)) return false
        if (!requireInputMode) return true
        const skuMode = String(item.input_mode || 'text_to_video')
        const isHappyHorse = String(model.app_code || '').toLowerCase() === 'happy_horse'
        const isSeedance = String(model.app_code || '').toLowerCase() === 'seedance'
        const isGrokFast = marketVideoAppCode(model) === 'grok_video' && resolveVideoMode(model, videoMode) === 'fast'
        return skuMode === inputMode
            || ((isHappyHorse || isSeedance || isGrokFast) && inputMode === 'image_reference' && skuMode === 'text_to_video')
    }
    const chooseClosestSku = (items: any[]) => {
        if (!items.length) return undefined
        const fixedDurationItems = items.filter((item: any) => Number(item.duration || 0) > 0)
        if (!fixedDurationItems.length || !duration) return items[0]
        const closest = closestDurationValue(fixedDurationItems.map((item: any) => Number(item.duration || 0)), duration)
        return fixedDurationItems.find((item: any) => Number(item.duration || 0) === closest) || fixedDurationItems[0] || items[0]
    }
    // The SKU's locked request contract is the server-side source of truth for
    // supported input modes. Prefer an exact mode, then retain the matched SKU
    // for models whose market metadata only declares the capability on product.
    const sku = chooseClosestSku(skus.filter((item: any) => matchesSkuBase(item, true)))
        // A reference/video-edit request must never be silently billed with a
        // text-to-video SKU. With no exact row, omit the SKU and let the
        // server resolve the market product against the actual input mode.
        || (inputMode === 'text_to_video' ? chooseClosestSku(skus.filter((item: any) => matchesSkuBase(item, false))) : undefined)
    return {
        resource_type: model.resource_type || '',
        market_product_id: Number(model.market_product_id || 0),
        market_sku_id: Number(sku?.market_sku_id || 0)
    }
}
const selectedMentionCount = computed(() => selectedSubjectIds.value.length + selectedSceneIds.value.length)
const selectedMentionLabel = computed(() => {
    if (selectedMentionCount.value <= 0) return '角色/场景'
    const names = [
        ...selectedSubjectIds.value.map((id) => subjects.value.find((item) => item.id === id)?.name || '').filter(Boolean),
        ...selectedSceneIds.value.map((id) => scenes.value.find((item) => item.id === id)?.name || '').filter(Boolean)
    ]
    if (!names.length) return `已选 ${selectedMentionCount.value} 个`
    return names.length > 1 ? `${names[0]} 等 ${names.length} 个` : names[0]
})
const modeMenuStyle = computed(() => ({ left: `${modeMenuLeft.value}px` }))
const mentionMenuStyle = computed(() => ({ left: `${mentionMenuLeft.value}px` }))
const lastFrameMenuStyle = computed(() => ({
    left: `${lastFrameMenuLeft.value}px`,
    top: `${lastFrameMenuTop.value}px`
}))
const selectedMentionPayload = computed(() => [
    ...selectedSubjectIds.value.map((id) => {
        const item = subjects.value.find((subject) => subject.id === id)
        return item ? {
            type: 'subject',
            id: item.id,
            name: item.name,
            image: item.image || '',
            prompt: cleanUserVisiblePrompt(item.visual_prompt || item.image_prompt || item.description || '')
        } : null
    }),
    ...selectedSceneIds.value.map((id) => {
        const item = scenes.value.find((scene) => scene.id === id)
        return item ? {
            type: 'scene',
            id: item.id,
            name: item.name,
            image: item.image || '',
            prompt: cleanUserVisiblePrompt(item.visual_prompt || item.image_prompt || item.description || '')
        } : null
    })
].filter(Boolean))
type VideoReferenceCandidate = {
    id: number
    priority: number
    order: number
    label: string
}
const DEFAULT_VIDEO_REFERENCE_LIMIT = 4
const videoReferenceLimitForModel = (model: ModelOption | null | undefined) => {
    const imageLimit = Number(model?.max_reference_images || 0)
    const assetLimit = Number(model?.max_reference_assets || 0)
    const limits = [imageLimit, assetLimit].filter((limit) => limit > 0)
    const configuredLimit = limits.length ? Math.min(...limits) : DEFAULT_VIDEO_REFERENCE_LIMIT
    return Math.max(1, configuredLimit)
}
const activeVideoReferenceLimit = computed(() => videoReferenceLimitForModel(activeVideoModel.value))
const assetGenerationParams = (asset: AssetItem | null | undefined) => {
    if (!asset?.task_id) return {}
    const task = tasks.value.find((item) => item.task_id === asset.task_id)
    const request = task?.request || {}
    const params = typeof request?.params === 'object' && request.params ? request.params : {}
    const nested = typeof (params as any)?.params === 'object' && (params as any).params ? (params as any).params : {}
    return { ...nested, ...params } as Record<string, any>
}
const assetSubjectRefId = (asset: AssetItem | null | undefined) => {
    const meta = asset?.meta || {}
    const params = assetGenerationParams(asset)
    return String(meta.subject_id || meta.subject_ref_id || meta.character_id || meta.item_id || params.subject_id || params.subject_ref_id || params.character_id || params.item_id || '')
}
const assetSceneRefId = (asset: AssetItem | null | undefined) => {
    const meta = asset?.meta || {}
    const params = assetGenerationParams(asset)
    return String(meta.scene_id || meta.scene_ref_id || meta.location_id || meta.item_id || params.scene_id || params.scene_ref_id || params.location_id || params.item_id || '')
}
const videoFirstFrameAssetId = computed(() => frameOrderSwapped.value ? lastFrameAssetId.value : (activeImageAsset.value?.id || 0))
const videoLastFrameAssetId = computed(() => frameOrderSwapped.value ? (activeImageAsset.value?.id || 0) : lastFrameAssetId.value)
const selectedMentionReferenceAssets = () => {
    const subjectIds = new Set(selectedSubjectIds.value.map(String))
    const sceneIds = new Set(selectedSceneIds.value.map(String))
    return assets.value.filter((asset) => {
        if (!['subject_image', 'three_view', 'scene_image', 'reference_image'].includes(asset.asset_type)) return false
        const subjectId = assetSubjectRefId(asset)
        const sceneId = assetSceneRefId(asset)
        if (subjectId && subjectIds.has(subjectId)) return true
        if (sceneId && sceneIds.has(sceneId)) return true
        return false
    })
}
const selectedMentionReferenceAssetIds = () => selectedMentionReferenceAssets().map((asset) => asset.id).filter(Boolean)
const videoSubjectIdsForShot = (shot: ShotItem | null | undefined, includeSelected = true) => {
    const ids = [
        ...(includeSelected ? selectedSubjectIds.value : []),
        ...(shot?.subject_ref_ids || [])
    ].map(String).filter(Boolean)
    return Array.from(new Set(ids))
}
const videoSceneIdsForShot = (shot: ShotItem | null | undefined, includeSelected = true) => {
    const ids = [
        ...(includeSelected ? selectedSceneIds.value : []),
        shot?.scene_ref_id || ''
    ].map(String).filter(Boolean)
    return Array.from(new Set(ids))
}
const latestSubjectAssetMap = (assetType: 'three_view' | 'subject_image') => {
    const latestAssets = new Map<string, AssetItem>()
    assets.value
        .filter((asset) => asset.asset_type === assetType)
        .forEach((asset) => {
            const subjectId = assetSubjectRefId(asset)
            if (!subjectId) return
            const existing = latestAssets.get(subjectId)
            if (!existing || Number(asset.id || 0) > Number(existing.id || 0)) {
                latestAssets.set(subjectId, asset)
            }
    })
    return latestAssets
}
const latestSceneAssetMap = () => {
    const latestAssets = new Map<string, AssetItem>()
    assets.value
        .filter((asset) => asset.asset_type === 'scene_image')
        .forEach((asset) => {
            const sceneId = assetSceneRefId(asset)
            if (!sceneId) return
            const existing = latestAssets.get(sceneId)
            if (!existing || Number(asset.id || 0) > Number(existing.id || 0)) {
                latestAssets.set(sceneId, asset)
            }
        })
    return latestAssets
}
const videoSubjectReferenceAssets = (shot: ShotItem | null | undefined, assetType: 'three_view' | 'subject_image', includeSelected = true) => {
    const latestAssets = latestSubjectAssetMap(assetType)
    return videoSubjectIdsForShot(shot, includeSelected)
        .map((id) => latestAssets.get(id))
        .filter((asset): asset is AssetItem => !!asset?.id)
}
const videoSceneReferenceAssets = (shot: ShotItem | null | undefined, includeSelected = true) => {
    const latestAssets = latestSceneAssetMap()
    return videoSceneIdsForShot(shot, includeSelected)
        .map((id) => latestAssets.get(id))
        .filter((asset): asset is AssetItem => !!asset?.id)
}
const shotImageReferenceAssetIds = (shot: ShotItem | null | undefined, includeSelected = true) => {
    const ids = [
        ...videoSubjectReferenceAssets(shot, 'three_view', includeSelected).map((asset) => asset.id),
        ...videoSubjectReferenceAssets(shot, 'subject_image', includeSelected).map((asset) => asset.id),
        ...videoSceneReferenceAssets(shot, includeSelected).map((asset) => asset.id)
    ]
    return Array.from(new Set(ids.map(Number).filter(Boolean)))
}
const buildVideoReferenceBudget = (
    shot: ShotItem | null | undefined,
    firstFrameId = videoFirstFrameAssetId.value,
    lastFrameId = videoLastFrameAssetId.value,
    model: ModelOption | null | undefined = activeVideoModel.value,
    includeSelected = true
) => {
    const limit = videoReferenceLimitForModel(model)
    const candidates = new Map<number, VideoReferenceCandidate>()
    let order = 0
    const addCandidate = (id: number, priority: number, label: string) => {
        id = Number(id || 0)
        if (!id) return
        const existing = candidates.get(id)
        if (!existing || priority < existing.priority) {
            candidates.set(id, { id, priority, order: existing?.order ?? order++, label })
        }
    }
    addCandidate(firstFrameId, 10, 'first_frame')
    addCandidate(lastFrameId, 20, 'last_frame')
    videoSubjectReferenceAssets(shot, 'three_view', includeSelected).forEach((asset) => addCandidate(asset.id, 30, 'subject_three_view'))
    videoSubjectReferenceAssets(shot, 'subject_image', includeSelected).forEach((asset) => addCandidate(asset.id, 40, 'subject_front'))
    videoSceneReferenceAssets(shot, includeSelected).forEach((asset) => addCandidate(asset.id, 50, 'scene'))
    const ordered = Array.from(candidates.values()).sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.order - b.order
    })
    const submitted = ordered.slice(0, limit)
    const submittedSet = new Set(submitted.map((item) => item.id))
    const ignored = [
        ...ordered.slice(limit).filter((item) => !submittedSet.has(item.id))
    ].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.order - b.order
    })
    return {
        limit,
        total: submitted.length + ignored.length,
        submitted,
        ignored,
        submittedIds: submitted.map((item) => item.id),
        ignoredIds: ignored.map((item) => item.id)
    }
}
const videoReferenceBudget = computed(() => buildVideoReferenceBudget(activeShot.value))
const formatComposerPoints = (value: unknown) => {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number <= 0) return '0'
    return number.toFixed(2).replace(/\.?0+$/, '') || '0'
}
const secondBillingVideoChannels = ['happy_horse', 'wan', 'seedance2_pro']
const isSecondBillingVideoModel = (model: ModelOption | null | undefined, sku?: any) => {
    const billingUnit = String(sku?.usage_unit || model?.billing_unit || '').toLowerCase()
    const channel = String(model?.value || model?.id || '').toLowerCase()
    return billingUnit.includes('second') || secondBillingVideoChannels.includes(channel)
}
const composerModelBillingPoints = computed(() => {
    const model = activeGenerationModel.value
    const resolution = generationMode.value === 'video_generate' ? selectedVideoResolution.value : selectedImageResolution.value
    const selectedSku = generationMode.value === 'video_generate'
        ? activeVideoSku.value
        : model?.skus?.find((sku) => String(sku.quality || sku.resolution || '') === resolution)
    const unitPrice = Number(selectedSku?.tenant_unit_price ?? model?.tenant_unit_price ?? 0)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return 0
    if (generationMode.value === 'video_generate' && isSecondBillingVideoModel(model, selectedSku)) {
        const duration = closestVideoDurationForModel(activeVideoModel.value, selectedVideoResolution.value, Number(activeShot.value?.duration || selectedVideoDuration.value || 0), selectedVideoMode.value)
        return unitPrice * Math.max(1, duration || 1)
    }
    return unitPrice
})
const composerBillingPoints = computed(() => {
    return composerModelBillingPoints.value
})
const composerBillingText = computed(() => {
    const unit = String((generationMode.value === 'video_generate' ? activeVideoSku.value?.usage_unit : undefined) || activeGenerationModel.value?.billing_unit || '').toLowerCase()
    if (unit.includes('token')) {
        const sku = generationMode.value === 'video_generate'
            ? activeVideoSku.value
            : activeGenerationModel.value?.skus?.find((item) => String(item.quality || item.resolution || '') === selectedImageResolution.value)
        const price = Number(sku?.tenant_unit_price ?? activeGenerationModel.value?.tenant_unit_price ?? 0)
        return `${formatComposerPoints(price)}/百万 Token`
    }
    return `${formatComposerPoints(composerBillingPoints.value)} 点`
})
const composerBillingTip = computed(() => {
    const unit = String((generationMode.value === 'video_generate' ? activeVideoSku.value?.usage_unit : undefined) || activeGenerationModel.value?.billing_unit || '')
    const unitText = isSecondBillingVideoModel(activeGenerationModel.value, activeVideoSku.value) ? '按秒计费' : (unit.includes('token') ? '按 Token 计费' : '按次计费')
    const modelName = activeGenerationModelName.value
    const priceText = unit.includes('token')
        ? `模型 ${modelName}，${unitText}，按实际用量结算`
        : `模型 ${modelName}，${unitText}，点数 ${formatComposerPoints(composerBillingPoints.value)} 点`
    if (generationMode.value !== 'video_generate') return priceText
    const budget = videoReferenceBudget.value
    const hasBothFrames = Boolean(videoFirstFrameAssetId.value && videoLastFrameAssetId.value)
    const modeText = hasBothFrames
        ? `首尾帧优先，剩余按主体三视图/正面图裁剪${budget.submitted.length > 2 ? `，另含 ${budget.submitted.length - 2} 张主体参考` : ''}`
        : `将提交参考图 ${budget.submitted.length}/${budget.limit} 张`
    const refText = budget.ignored.length
        ? `${modeText}，已裁剪 ${budget.ignored.length} 张超出参考图`
        : modeText
    return `${priceText}，${refText}`
})
const hasReadyShotVideo = (shotId: string) => {
    return !!(selectedAssetForShot(shotId, 'shot_video') || latestAssetForShot(shotId, 'shot_video'))
}
const hasActiveShotVideoTask = (shotId: string) => {
    return tasks.value.some((task) => task.task_type === 'shot_video' && task.shot_id === shotId && isActiveStatus(task.status))
}
const batchVideoSourceShots = computed(() => shots.value
    .filter((shot) => shot.id && !hasReadyShotVideo(shot.id) && !hasActiveShotVideoTask(shot.id))
    .map((shot) => ({
        shot,
        firstFrameAssetId: selectedImageAssetForShot(shot.id)?.id || 0
    }))
    .filter((item) => item.firstFrameAssetId > 0))
const batchVideoShotCount = computed(() => batchVideoSourceShots.value.length)
const batchVideoBillableSeconds = computed(() => batchVideoSourceShots.value.reduce((sum, item) => {
    return sum + Math.max(1, closestVideoDurationForModel(batchVideoModel.value, batchVideoResolution.value, Number(item.shot.duration || batchVideoDuration.value || 0), batchVideoMode.value))
}, 0))
const batchVideoCost = computed(() => {
    const model = batchVideoModel.value
    const unitPrice = Number(batchVideoSku.value?.tenant_unit_price ?? model?.tenant_unit_price ?? 0)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return 0
    const quantity = isSecondBillingVideoModel(model, batchVideoSku.value) ? Math.max(1, batchVideoBillableSeconds.value) : batchVideoShotCount.value
    return unitPrice * quantity
})
const batchVideoCostText = computed(() => String(batchVideoSku.value?.usage_unit || batchVideoModel.value?.billing_unit || '').toLowerCase().includes('token')
    ? `${formatComposerPoints(Number(batchVideoSku.value?.tenant_unit_price ?? batchVideoModel.value?.tenant_unit_price ?? 0))}/百万 Token`
    : `${formatComposerPoints(batchVideoCost.value)} 点`)
const batchVideoBillingTip = computed(() => {
    if (String(batchVideoSku.value?.usage_unit || batchVideoModel.value?.billing_unit || '').toLowerCase().includes('token')) return '按实际 Token 用量结算'
    return isSecondBillingVideoModel(batchVideoModel.value, batchVideoSku.value) ? `按总时长 ${Math.max(1, batchVideoBillableSeconds.value)} 秒估算` : '按任务数量估算'
})
const composerDraftKey = (mode = generationMode.value, shotId = activeShot.value?.id || '') => [
    projectId.value || 'no_project',
    scriptTaskId.value || 'no_task',
    shotId || 'no_shot',
    mode
].join(':')
const shotHasVisibleSubjects = (shot?: ShotItem | null) => {
    if (!shot) return false
    if (String(shot.shot_type || '').includes('空镜')) return false
    return Array.isArray(shot.subject_ref_ids) && shot.subject_ref_ids.length > 0
}
const shotVisibleRemoveItems = (shot?: ShotItem | null): Array<string | undefined | null> => [
    shot?.scene_name,
    shot?.title
].filter(Boolean)
const normalizeVisibleVideoPrompt = (
    text: string,
    keepNoSubjectConstraints = true,
    removeItems: Array<string | undefined | null> = []
) => {
    return cleanVisibleVideoPrompt(text, keepNoSubjectConstraints, removeItems)
}
const shotTimelineIndex = (shot?: ShotItem | null) => {
    if (!shot?.id) return -1
    return timelineShots.value.findIndex((item) => item.id === shot.id)
}
const shotStartSeconds = (shot?: ShotItem | null) => {
    const index = shotTimelineIndex(shot)
    if (index <= 0) return 0
    return timelineShots.value
        .slice(0, index)
        .reduce((sum, item) => sum + (Number(item.duration) || 3), 0)
}
const shotPromptHeader = (shot?: ShotItem | null) => {
    if (!shot) return ''
    const index = shotTimelineIndex(shot)
    const shotNo = index >= 0 ? index + 1 : 1
    const start = shotStartSeconds(shot)
    const duration = Number(shot.duration) || 3
    return `分镜${shotNo}：${formatDuration(start) || '00:00'}-${formatDuration(start + duration) || '00:00'}`
}
const normalizeVideoPromptHeader = (text: string, shot?: ShotItem | null) => {
    const header = shotPromptHeader(shot)
    const source = String(text || '').trim()
    if (!header) return source
    if (!source) return header
    const lines = source.split(/\r?\n/)
    if (/^\s*分镜[^\n\r]*/u.test(lines[0] || '')) {
        lines[0] = header
        return lines.join('\n').trim()
    }
    return `${header}\n${source}`.trim()
}
const normalizeVideoPromptColumns = (text: string) => {
    const labels = ['景别', '构图', '运镜手法', '画面内容', '声音']
    const values: Record<string, string> = {}
    const extras: string[] = []
    let header = ''
    let skipNestedShotBlock = false
    String(text || '').split(/\r?\n/).forEach((line) => {
        const current = line.trim()
        if (!current) return
        if (/^分镜[^\n\r]*/u.test(current)) {
            if (!header) header = current
            return
        }
        const normalized = /^运镜(?!手法)\s*[：:]/u.test(current)
            ? current.replace(/^运镜\s*[：:]\s*/u, '运镜手法：')
            : current
        for (const label of labels) {
            const match = normalized.match(new RegExp(`^${label}\\s*[：:]?\\s*(.*)$`, 'u'))
            if (!match) continue
            const value = String(match[1] || '').trim()
            if (label === '画面内容' && /^分镜[一二三四五六七八九十百千万\d]+[：:、\s-]/u.test(value)) {
                skipNestedShotBlock = true
                return
            }
            if (skipNestedShotBlock && label !== '画面内容') return
            skipNestedShotBlock = false
            if (value) values[label] = label === '景别' && /^普通画[~～。\.\s]*$/u.test(value) ? '普通画面' : value
            return
        }
        if (skipNestedShotBlock) return
        extras.push(current)
    })
    return [
        header,
        ...labels.map((label) => values[label] ? `${label}：${values[label]}` : ''),
        ...extras
    ].filter(Boolean).join('\n')
}
const normalizeVideoPromptForShot = (text: string, shot?: ShotItem | null) => {
    return normalizeVisibleVideoPrompt(
        normalizeVideoPromptColumns(normalizeVideoPromptHeader(text, shot)),
        !shotHasVisibleSubjects(shot),
        shotVisibleRemoveItems(shot)
    )
}
const hasReadableVideoPromptFields = (text: string) => {
    const source = String(text || '')
    return ['分镜', '景别', '构图', '运镜手法', '画面内容', '声音']
        .every((label) => new RegExp(`(?:^|\\n)\\s*${label}\\s*[：:]`, 'u').test(source))
}
const usableVideoPromptDraft = (draft: string | undefined, shot: ShotItem | null) => {
    if (draft === undefined) return undefined
    const fallback = defaultVisiblePromptText('video_generate', shot)
    if (fallback && hasReadableVideoPromptFields(fallback) && !hasReadableVideoPromptFields(draft)) {
        return fallback
    }
    return draft
}
const normalizeDisplayVideoPrompt = (
    text: string,
    keepNoSubjectConstraints = true,
    removeItems: Array<string | undefined | null> = []
) => {
    return cleanVisibleVideoDisplayPrompt(text, keepNoSubjectConstraints, removeItems)
}
const mentionColor = '#20d7ff'
const escapeHtml = (text: string) => String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentionTokenPattern = (name: string) => new RegExp(`@${escapeRegExp(name)}`, 'u')
const mentionNamePattern = (name: string) => new RegExp(`(^|[^@])${escapeRegExp(name)}`, 'g')
const mentionableItems = () => [
    ...subjects.value.map((item) => ({ type: 'subject' as const, item })),
    ...scenes.value.map((item) => ({ type: 'scene' as const, item }))
]
    .filter(({ item }) => item.id && item.name)
    .sort((a, b) => b.item.name.length - a.item.name.length)
const findMentionAt = (
    text: string,
    index: number,
    mentions = mentionableItems()
) => {
    if (text[index] !== '@') return null
    for (const mention of mentions) {
        const name = mention.item.name.trim()
        if (name && text.startsWith(`@${name}`, index)) {
            return { ...mention, index, value: `@${name}` }
        }
    }
    return null
}
const findNextMention = (
    text: string,
    start = 0,
    mentions = mentionableItems()
) => {
    let cursor = Math.max(0, start)
    while (cursor < text.length) {
        const index = text.indexOf('@', cursor)
        if (index < 0) return null
        const match = findMentionAt(text, index, mentions)
        if (match) return match
        cursor = index + 1
    }
    return null
}
const highlightMentionHtml = (text: string) => {
    const source = stripPromptNoise(text)
    let cursor = 0
    let html = ''
    while (cursor < source.length) {
        const match = findNextMention(source, cursor)
        if (!match) {
            html += escapeHtml(source.slice(cursor))
            break
        }
        html += escapeHtml(source.slice(cursor, match.index))
        html += `<span class="chat-mention">${escapeHtml(match.value)}</span>`
        cursor = match.index + match.value.length
    }
    return html
}
const mentionizeProjectNames = (text: string) => {
    let next = String(text || '')
    mentionableItems().forEach(({ item }) => {
        const name = item.name.trim()
        if (!name) return
        next = next.replace(mentionNamePattern(name), `$1@${name}`)
    })
    return next
}
const defaultComposerText = (mode = generationMode.value) => {
    if (mode === 'video_generate') return mentionizeProjectNames(shotVideoPromptText(activeShot.value))
    return ''
}
const currentImageEditTask = computed(() => {
    const session = imageEditSession.value
    if (!session?.shotId || session.shotId !== activeShot.value?.id) return null
    if (session.taskId) {
        return tasks.value.find((task) => task.task_id === session.taskId) || null
    }
    return tasks.value.find((task) => task.task_type === 'shot_image' && task.shot_id === session.shotId && isActiveStatus(task.status)) || null
})
const currentTaskRecordHasTakenOver = computed(() => {
    const taskId = currentGenerationTaskId.value
    if (!['image_generate', 'video_generate'].includes(generationMode.value) || !taskId) return false
    return panelHistoryRecords.value.some((record) => record.taskId === taskId)
})
const visibleChatMessages = computed(() => chatMessages.value
    .map((message) => {
        if (!message.text || message.loading) return message
        const text = cleanDisplayPromptForMode(message.text, generationMode.value, activeShot.value)
        return text === message.text ? message : { ...message, text }
    })
    .filter((message) => {
        if (currentTaskRecordHasTakenOver.value) return false
        return message.text || message.loading || message.status
    }))
const showPanelGeneratingFallback = computed(() => {
    if (latestPanelResultUrl.value) return false
    if (!visibleChatMessages.value.some((message) => message.loading)) return false
    return !panelHistoryRecords.value.some((record) => record.isGenerating)
})
const hasPanelConversation = computed(() => panelHistoryRecords.value.length > 0 || visibleChatMessages.value.length > 0)
const cleanImagePromptText = (text: string, removeItems: Array<string | undefined | null> = []) => {
    return cleanVisibleImagePrompt(text, removeItems)
}
const cleanImageDisplayPrompt = (text: string, shot?: ShotItem | null) => {
    return cleanUserDisplayPrompt(text, { removeItems: shotVisibleRemoveItems(shot) })
}
const shotImagePromptText = (shot?: ShotItem | null) => {
    if (!shot) return ''
    const cleaned = cleanImagePromptText(shot.image_prompt, [
        ...shotVisibleRemoveItems(shot),
        shot.camera_movement,
        shot.dialogue,
        shot.voice_role,
        shot.video_prompt,
        shot.bgm_prompt
    ])
    if (cleaned) return cleaned
    const parts = [
        shot.visual_description || shot.description,
        shot.action,
        shot.result,
        shot.atmosphere
    ]
    return parts.map((item) => String(item || '').trim()).filter(Boolean).join('\n')
}
const shotHasVideoVisualContent = (shot?: ShotItem | null) => {
    if (!shot) return false
    return [
        shot.video_prompt,
        shot.visual_description || shot.description,
        shot.composition,
        shot.camera_movement,
        shot.shot_type,
        shot.action,
        shot.result,
        shot.atmosphere
    ].some((item) => String(item || '').trim())
}
const adjacentVideoPromptSourceShot = (shot?: ShotItem | null) => {
    if (!shot?.id) return null
    const index = timelineShots.value.findIndex((item) => item.id === shot.id)
    if (index < 0) return null
    for (let prev = index - 1; prev >= 0; prev -= 1) {
        if (shotHasVideoVisualContent(timelineShots.value[prev])) return timelineShots.value[prev]
    }
    for (let next = index + 1; next < timelineShots.value.length; next += 1) {
        if (shotHasVideoVisualContent(timelineShots.value[next])) return timelineShots.value[next]
    }
    return null
}
const fallbackVideoPromptText = (shot?: ShotItem | null) => {
    if (!shot) return ''
    const source = adjacentVideoPromptSourceShot(shot)
    const shotType = source?.shot_type || shot.shot_type || '普通画面'
    const composition = source?.composition || shot.composition || '按当前首帧参考图构图，保持主体位置和空间关系稳定'
    const movement = source?.camera_movement || shot.camera_movement || '固定镜头或轻微推镜头，动作自然连贯'
    const sourceVisual = [
        source?.visual_description || source?.description,
        source?.action,
        source?.result,
        source?.atmosphere
    ].map((item) => String(item || '').trim()).filter(Boolean).join('，')
    const ownVisual = [
        shot.visual_description || shot.description,
        shot.action,
        shot.result,
        shot.atmosphere
    ].map((item) => String(item || '').trim()).filter(Boolean).join('，')
    const content = ownVisual
        || (sourceVisual ? `延续相邻分镜画面：${sourceVisual}` : '根据首帧参考图延续当前画面动作，保持主体、场景、光线、构图和美术风格一致，动作从开始到结束清晰可见')
    const hasSubjects = shotHasVisibleSubjects(shot) || shotHasVisibleSubjects(source)
    const sound = hasSubjects
        ? '轻微环境声和动作音效，画面中所有角色全程不说话'
        : '轻微环境声和动作音效，画面中角色不说话'
    return [
        `景别：${shotType}`,
        `构图：${composition}`,
        `运镜手法：${movement}`,
        `画面内容：${content}`,
        `声音：${sound}`
    ].join('\n')
}
const shotVideoPromptText = (shot?: ShotItem | null) => {
    if (!shot) return ''
    const fallback = normalizeVideoPromptForShot(fallbackVideoPromptText(shot), shot)
    const cleaned = normalizeVideoPromptForShot(shot.video_prompt, shot)
    if (hasReadableVideoPromptFields(cleaned)) return cleaned
    if (fallback) {
        // Existing shot fields override the fallback, which supplies any missing column.
        return normalizeVideoPromptForShot([fallback, cleaned].filter(Boolean).join('\n'), shot)
    }
    if (cleaned) return cleaned
    const parts = [
        shot.visual_description || shot.description,
        shot.action,
        shot.result,
        shot.atmosphere
    ]
    const sourceText = parts.map((item) => String(item || '').trim()).filter(Boolean).join('\n')
    return normalizeVideoPromptForShot(sourceText || fallbackVideoPromptText(shot), shot)
}
const cleanVisiblePromptForShot = (text: string, shot?: ShotItem | null, removeNoSubjectLines = false) => cleanUserVisiblePrompt(text, {
    removeItems: shotVisibleRemoveItems(shot),
    removeNoSubjectLines
})
const cleanDisplayPromptForMode = (
    text: string,
    mode = generationMode.value,
    shot: ShotItem | null = activeShot.value
) => {
    return mode === 'video_generate'
        ? normalizeDisplayVideoPrompt(text, !shotHasVisibleSubjects(shot), shotVisibleRemoveItems(shot))
        : cleanImageDisplayPrompt(text, shot)
}
const firstText = (...items: unknown[]) => {
    for (const item of items) {
        const text = String(item || '').trim()
        if (text) return text
    }
    return ''
}
const relatedTaskForAsset = (asset: AssetItem | null | undefined) => {
    if (!asset?.task_id) return null
    return tasks.value.find((task) => task.task_id === asset.task_id) || null
}
const imageEditReferenceContext = (asset: AssetItem | null | undefined, shot: ShotItem | null = activeShot.value) => {
    if (!asset?.id) return null
    const task = relatedTaskForAsset(asset)
    const request = task?.request || {}
    const params = request?.params || {}
    const nested = params?.params || {}
    const meta = asset.meta || {}
    const rawPrompt = firstText(
        meta.visible_prompt,
        meta.prompt,
        meta.image_prompt,
        request.visible_prompt,
        params.visible_prompt,
        nested.visible_prompt,
        request.message,
        params.message,
        nested.message,
        request.image_prompt,
        params.image_prompt,
        nested.image_prompt,
        shotImagePromptText(shot)
    )
    const prompt = cleanImageDisplayPrompt(rawPrompt, shot)
    return {
        asset_id: asset.id,
        task_id: asset.task_id,
        asset_type: asset.asset_type,
        title: asset.title || shot?.title || '',
        prompt,
        visible_prompt: prompt,
        scene_name: shot?.scene_name || '',
        shot_title: shot?.title || '',
        visual_description: shot?.visual_description || shot?.description || '',
        composition: shot?.composition || '',
        shot_type: shot?.shot_type || '',
        action: shot?.action || '',
        atmosphere: shot?.atmosphere || '',
        model_id: firstText(request.model_id, params.model_id, nested.model_id)
    }
}
const imageEditProviderPrompt = (messageText: string, sourceContext: ReturnType<typeof imageEditReferenceContext>, shot: ShotItem | null = activeShot.value) => {
    const editText = cleanVisiblePromptForShot(messageText, shot)
    const sourcePrompt = cleanImageDisplayPrompt(String(sourceContext?.prompt || ''), shot)
    return [
        sourcePrompt ? `参考原图内容：${sourcePrompt}` : '',
        sourceContext?.scene_name ? `参考场景：${sourceContext.scene_name}` : '',
        sourceContext?.composition ? `参考构图：${sourceContext.composition}` : '',
        sourceContext?.shot_type ? `参考景别：${sourceContext.shot_type}` : '',
        '保持画面主体、场景、风格一致，只根据用户修改要求调整。',
        editText ? `修改要求：${editText}` : ''
    ].filter(Boolean).join('\n')
}
const visiblePromptDraftKey = (mode = generationMode.value, shotId = activeShot.value?.id || '') => [
    projectId.value || 'no_project',
    scriptTaskId.value || 'no_task',
    shotId || 'no_shot',
    mode,
    'visible'
].join(':')
const defaultVisiblePromptText = (mode = generationMode.value, shot: ShotItem | null = activeShot.value) => {
    if (mode === 'video_generate') return mentionizeProjectNames(shotVideoPromptText(shot))
    return shotImagePromptText(shot)
}
const activeVisiblePromptKey = computed(() => visiblePromptDraftKey(generationMode.value, activeShot.value?.id || ''))
const activeVisiblePromptDraft = computed({
    get() {
        const draft = visiblePromptDrafts.value[activeVisiblePromptKey.value]
        const normalizedDraft = generationMode.value === 'video_generate'
            ? usableVideoPromptDraft(draft, activeShot.value)
            : draft
        const text = normalizedDraft !== undefined ? normalizedDraft : defaultVisiblePromptText(generationMode.value, activeShot.value)
        return generationMode.value === 'video_generate'
            ? mentionizeProjectNames(normalizeVideoPromptForShot(text, activeShot.value))
            : cleanImageDisplayPrompt(text, activeShot.value)
    },
    set(value: string) {
        const text = String(value || '')
        visiblePromptDrafts.value[activeVisiblePromptKey.value] = text
        visiblePromptDraft.value = text
    }
})
const activePromptPlaceholder = computed(() => '输入你想生成或修改的画面描述')
const promptCardTitle = computed(() => '提示词')
const currentStoryboardPromptText = computed(() => {
    const shot = currentStoryboardShot.value
    return cleanImageDisplayPrompt(shotImagePromptText(shot), shot)
})
const promptExpandable = computed(() => {
    const text = currentStoryboardPromptText.value
    if (!text) return false
    const visualLineCount = text.split(/\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.trim().length / 52)), 0)
    return visualLineCount > 3
})
const nextShot = computed(() => {
    const index = timelineShots.value.findIndex((shot) => shot.id === activeShot.value?.id)
    return index >= 0 ? timelineShots.value[index + 1] || null : null
})
const previousShot = computed(() => {
    const index = timelineShots.value.findIndex((shot) => shot.id === activeShot.value?.id)
    return index > 0 ? timelineShots.value[index - 1] || null : null
})
const nextShotImageAsset = computed(() => selectedImageAssetForShot(nextShot.value?.id || ''))
const previousShotDisplayAsset = computed(() => previousShot.value ? displayTimelineAssetForShot(previousShot.value.id) : null)
const previousShotImageAsset = computed(() => previousShot.value ? displayImageAssetForShot(previousShot.value.id) : null)
const previousShotVideoAsset = computed(() => {
    if (!previousShot.value) return null
    const displayAsset = previousShotDisplayAsset.value
    if (displayAsset?.asset_type === 'shot_video') return displayAsset
    return selectedAssetForShot(previousShot.value.id, 'shot_video')
        || latestAssetForShot(previousShot.value.id, 'shot_video')
        || null
})
const previousFrameOptionVisible = computed(() => !!previousShot.value)
const previousFrameOptionLabel = computed(() => {
    if (previousShotVideoAsset.value?.id) return '使用上一分镜视频尾帧'
    if (previousShotImageAsset.value?.id) return '使用上一分镜图'
    return '使用上一分镜图'
})
const previousFrameOptionDisabled = computed(() => {
    return extractingPreviousVideoTail.value || !previousShot.value || (!previousShotVideoAsset.value?.id && !previousShotImageAsset.value?.id)
})
const lastFramePreviewUrl = computed(() => {
    if (lastFrameMode.value === 'upload') return lastFramePreviewLocal.value || lastFrameAsset.value?.url || ''
    if (lastFrameMode.value === 'next_shot') return nextShotImageAsset.value?.url || ''
    if (lastFrameMode.value === 'previous_shot_image') return previousShotImageAsset.value?.url || ''
    if (lastFrameMode.value === 'previous_video_tail') return lastFrameAsset.value?.url || ''
    return ''
})
const lastFrameAssetId = computed(() => {
    if (lastFrameMode.value === 'upload') return lastFrameAsset.value?.id || 0
    if (lastFrameMode.value === 'next_shot') return nextShotImageAsset.value?.id || 0
    if (lastFrameMode.value === 'previous_shot_image') return previousShotImageAsset.value?.id || 0
    if (lastFrameMode.value === 'previous_video_tail') return lastFrameAsset.value?.id || 0
    return 0
})
const videoStartFrameUrl = computed(() => {
    if (frameOrderSwapped.value) return lastFramePreviewUrl.value
    return activeImageAsset.value?.url || ''
})
const videoEndFrameUrl = computed(() => {
    if (frameOrderSwapped.value) return activeImageAsset.value?.url || ''
    return lastFramePreviewUrl.value
})
const activeModeLabel = computed(() => modeOptions.find((item) => item.value === generationMode.value)?.label || '生成')
const mentionEnabled = computed(() => ['image_generate', 'video_generate'].includes(generationMode.value))
const composerPlaceholder = computed(() => {
    if (generationMode.value === 'image_edit') return '描述你想修改的画面内容'
    if (generationMode.value === 'image_generate') return '描述分镜画面，可 @ 角色或场景'
    return '描述视频动作，可 @ 角色或场景'
})
const timelineShots = computed(() => {
    const source = shots.value.length ? shots.value : fallbackShots.value
    return source.map((shot) => {
        const asset = displayTimelineAssetForShot(shot.id)
        const imageAsset = displayImageAssetForShot(shot.id)
        return {
            ...shot,
            asset_type: asset?.asset_type || '',
            video_url: asset?.asset_type === 'shot_video' ? asset.url : '',
            url: asset?.asset_type === 'shot_video'
                ? (asset.cover_url || imageAsset?.url || '')
                : (asset?.url || '')
        }
    })
})
const fallbackShots = computed((): ShotItem[] => {
    const shotAssets = assets.value.filter((asset) => asset.asset_type === 'shot_image')
    if (shotAssets.length) {
        return shotAssets.map((asset, index) => ({
            id: asset.shot_id || String(asset.id),
            title: `分镜${index + 1}`,
            description: '',
            scene_name: '',
            time_of_day: '',
            visual_description: '',
            composition: '',
            shot_type: '',
            angle: '',
            action: '',
            result: '',
            atmosphere: '',
            camera_movement: '',
            dialogue: '',
            image_prompt: '',
            video_prompt: '',
            scene_ref_id: '',
            subject_ref_ids: [],
            voice_role: '',
            bgm_prompt: '',
            duration: 3,
            selected_image_asset_id: 0,
            selected_video_asset_id: 0,
            selected_image_asset: null,
            selected_video_asset: null
        }))
    }
    return Array.from({ length: 6 }, (_, index) => ({
        id: `shot_${index + 1}`,
        title: `分镜${index + 1}`,
        description: '',
        scene_name: '',
        time_of_day: '',
        visual_description: '',
        composition: '',
        shot_type: '',
        angle: '',
        action: '',
        result: '',
        atmosphere: '',
        camera_movement: '',
        dialogue: '',
        image_prompt: '',
        video_prompt: '',
        scene_ref_id: '',
        subject_ref_ids: [],
        voice_role: '',
        bgm_prompt: '',
        duration: 3,
        selected_image_asset_id: 0,
        selected_video_asset_id: 0,
        selected_image_asset: null,
        selected_video_asset: null
    }))
})
const activeShotStatusText = computed(() => activeShot.value ? shotStatusText(activeShot.value.id) : '待生成')
const timelineTotalSeconds = computed(() => timelineShots.value.reduce((sum, shot) => sum + (Number(shot.duration) || 3), 0))
const timelineElapsedSeconds = computed(() => {
    const items = timelineShots.value
    if (!items.length) return 0
    const progressShotId = timelineProgressShotId.value || activeShotId.value || items[0].id
    const index = Math.max(0, items.findIndex((shot) => shot.id === progressShotId))
    const activeIndex = index >= 0 ? index : 0
    const before = items
        .slice(0, activeIndex)
        .reduce((sum, shot) => sum + (Number(shot.duration) || 3), 0)
    const currentDuration = Number(items[activeIndex]?.duration) || 3
    const percent = Math.min(100, Math.max(0, timelineProgressPercent.value || 0))
    return Math.min(timelineTotalSeconds.value, before + currentDuration * (percent / 100))
})
const timelineTimeText = computed(() => {
    const total = timelineTotalSeconds.value
    return `${formatDuration(timelineElapsedSeconds.value) || '00:00'}/${formatDuration(total || 0) || '00:00'}`
})

const bgmAudioAssets = computed(() => assets.value
    .filter((asset) => asset.asset_type === 'bgm_audio' && asset.url)
    .slice()
    .sort((a, b) => {
        const aTime = historySortTime({ task_id: a.task_id || `asset_${a.id}`, created_at: a.created_at } as GenerationTask) || a.id
        const bTime = historySortTime({ task_id: b.task_id || `asset_${b.id}`, created_at: b.created_at } as GenerationTask) || b.id
        return bTime - aTime
    }))
const bgmAsset = computed(() => {
    const applied = appliedBgmAssetId.value > 0
        ? bgmAudioAssets.value.find((asset) => asset.id === appliedBgmAssetId.value)
        : null
    return applied || bgmAudioAssets.value[0] || null
})
const bgmTask = computed(() => {
    const bgmTasks = tasks.value.filter((task) => task.task_type === 'bgm_audio')
    return bgmTasks.find((task) => isActiveStatus(task.status))
        || bgmTasks.find((task) => task.status === 'success')
        || bgmTasks.find((task) => task.status === 'failed')
        || bgmTasks[0]
        || null
})
const bgmStatus = computed((): GenerationStatus => bgmAsset.value ? 'success' : (bgmTask.value?.status || ''))
const bgmIsBusy = computed(() => submittingBgm.value || retryingBgm.value || isActiveStatus(bgmStatus.value))
const fallbackBgmPrompt = computed(() => {
    const globalPrompt = musicPlan.value?.global_bgm_prompt || musicPlan.value?.prompt || musicPlan.value?.bgm_prompt || ''
    if (globalPrompt) return String(globalPrompt)
    const shotPrompts = shots.value.map((shot) => shot.bgm_prompt).filter(Boolean).slice(0, 8)
    return shotPrompts.length ? `根据当前分镜生成背景音乐，情绪参考：${shotPrompts.join('、')}` : ''
})
const effectiveBgmPrompt = computed(() => String(savedBgmPrompt.value || draftBgmPrompt.value || fallbackBgmPrompt.value).trim())
const bgmTrackText = computed(() => {
    if (bgmAsset.value) return bgmPlaying.value ? '背景音乐播放中' : '背景音乐已生成'
    if (bgmIsBusy.value) return '背景音乐生成中'
    if (bgmStatus.value === 'failed') return '背景音乐生成失败'
    return effectiveBgmPrompt.value ? '可生成背景音乐' : '暂无背景音乐描述'
})
const bgmPanelStatusText = computed(() => statusText(bgmStatus.value) || '待生成')
const bgmActionText = computed(() => bgmIsBusy.value ? '生成中...' : (bgmAsset.value || bgmStatus.value === 'failed' ? '重新生成' : '生成背景音乐'))
const bgmErrorText = computed(() => bgmStatus.value === 'failed' ? (bgmTask.value?.error_msg || '背景音乐生成失败') : '')
const bgmDurationText = computed(() => formatDuration(bgmDuration.value || bgmAsset.value?.duration || 0))
const selectedBgmAsset = computed(() => pendingBgmAssetId.value > 0
    ? bgmAudioAssets.value.find((asset) => asset.id === pendingBgmAssetId.value) || null
    : null)
const canApplyBgm = computed(() => !!selectedBgmAsset.value?.url && selectedBgmAsset.value.id !== bgmAsset.value?.id)
const bgmBillingPoints = computed(() => Number(bgmEstimateInfo.value?.user_charge_points ?? bgmEstimateInfo.value?.display_points ?? 0))
const isBgmActualUsageSettlement = computed(() => String(bgmEstimateInfo.value?.settlement_mode || '').toLowerCase() === 'actual_usage')
const bgmBillingText = computed(() => isBgmActualUsageSettlement.value
    ? `${formatComposerPoints(Number(bgmEstimateInfo.value?.user_unit_points || 0))}/百万 Token`
    : `${formatComposerPoints(bgmBillingPoints.value)} 点`)
const bgmHistoryRecords = computed<MusicHistoryRecord[]>(() => {
    const bgmAssets = bgmAudioAssets.value
    const usedAssetIds = new Set<number>()
    const makeRecord = (task: GenerationTask | null, asset: AssetItem | null): MusicHistoryRecord => {
        const request = task?.request || {}
        const params = request?.params || {}
        const nested = params?.params || {}
        const plan = params?.music_plan || nested?.music_plan || musicPlan.value || {}
        const url = String(asset?.url || task?.result?.audio_url || task?.result?.url || '')
        const duration = Number(asset?.duration || params?.duration_seconds || nested?.duration_seconds || plan?.duration_seconds || bgmDuration.value || 0)
        const isCurrentAudio = !!url && activeBgmPlaybackUrl.value === url
        const current = isCurrentAudio ? bgmCurrentTime.value : 0
        const isBusy = !!task && isActiveStatus(task.status)
        const status = asset?.url ? 'success' : (task?.status || 'success')
        const title = String(
            asset?.title
            || plan?.music_title
            || plan?.title
            || params?.title
            || nested?.title
            || '背景音乐'
        )
        const progressPercent = duration > 0
            ? Math.min(100, Math.max(0, (current / duration) * 100))
            : (isBusy ? Math.min(100, Math.max(0, Number(task?.progress || 0))) : (status === 'success' ? 100 : 0))
        const playableAsset = asset || (url ? {
            id: 0,
            task_id: task?.task_id || '',
            shot_id: '',
            asset_type: 'bgm_audio',
            title,
            uri: '',
            url,
            duration,
            created_at: task?.created_at || '',
            meta: {}
        } : null)
        return {
            id: task?.task_id || `asset_${asset?.id || url}`,
            title,
            status: status as GenerationStatus,
            statusText: isBusy ? '生成中' : (status === 'failed' ? '生成失败' : (asset?.url ? '已生成' : (statusText(status) || '已生成'))),
            error: status === 'failed' ? String(task?.error_msg || '背景音乐生成失败') : '',
            url,
            duration,
            timeText: `${formatDuration(current) || '00:00'}/${formatDuration(duration) || '00:00'}`,
            progressPercent,
            isBusy,
            isApplied: !!playableAsset?.id && playableAsset.id === bgmAsset.value?.id,
            isSelected: !!playableAsset?.id && playableAsset.id === pendingBgmAssetId.value,
            sortTime: task ? historySortTime(task) : historySortTime({ task_id: `asset_${asset?.id || ''}`, created_at: asset?.created_at || '' } as GenerationTask),
            asset: playableAsset
        }
    }
    const taskRecords = tasks.value
        .filter((task) => task.task_type === 'bgm_audio')
        .map((task) => {
            const asset = bgmAssets.find((item) => item.task_id && item.task_id === task.task_id)
                || (task.status === 'success' ? bgmAssets.find((item) => !usedAssetIds.has(item.id)) || null : null)
            if (asset?.id) usedAssetIds.add(asset.id)
            return makeRecord(task, asset)
        })
        .filter((record) => record.isBusy || record.status === 'failed' || !!record.url)
    const assetRecords = bgmAssets
        .filter((asset) => !usedAssetIds.has(asset.id))
        .map((asset) => makeRecord(null, asset))
    return [...taskRecords, ...assetRecords]
        .sort((a, b) => {
            if (a.sortTime !== b.sortTime) return b.sortTime - a.sortTime
            return String(b.id).localeCompare(String(a.id))
        })
})

const iconUrl = (name: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/short-drama/figma/icon/${name}`
}
const listFromResponse = (data: any) => Array.isArray(data)
    ? data
    : (Array.isArray(data?.lists) ? data.lists : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : [])))
const numericList = (value: any): number[] => {
    if (Array.isArray(value)) return value.map((item) => Number(item)).filter(Boolean)
    if (typeof value === 'string') {
        try {
            const decoded = JSON.parse(value)
            if (Array.isArray(decoded)) return decoded.map((item) => Number(item)).filter(Boolean)
        } catch {}
    }
    return []
}
const historySortTime = (task: GenerationTask) => {
    const created = String(task.created_at || '').trim()
    if (/^\d+$/.test(created)) {
        const value = Number(created)
        return value > 100000000000 ? value : value * 1000
    }
    const parsed = Date.parse(created.replace(/-/g, '/'))
    if (!Number.isNaN(parsed)) return parsed
    const matched = String(task.task_id || '').match(/(\d{10,})/)
    return matched ? Number(matched[1].slice(0, 13).padEnd(13, '0')) : 0
}
const isActiveStatus = (status?: GenerationStatus | string) => ['pending', 'queued', 'running'].includes(String(status || ''))
const statusText = (status?: GenerationStatus | string) => ({
    pending: '排队中',
    queued: '排队中',
    running: '生成中',
    success: '已完成',
    failed: '失败',
    canceled: '已取消'
}[String(status || '')] || '')

const normalizeShot = (item: any, index: number): ShotItem => ({
    id: String(item?.shot_id || item?.id || index + 1),
    title: String(item?.title || item?.name || `分镜${index + 1}`),
    description: String(item?.visual_description || item?.description || item?.action || item?.image_prompt || ''),
    scene_name: String(item?.scene_name || item?.scene || ''),
    time_of_day: String(item?.time_of_day || ''),
    visual_description: String(item?.visual_description || item?.description || ''),
    composition: String(item?.composition || ''),
    shot_type: String(item?.shot_type || ''),
    angle: String(item?.angle || ''),
    action: String(item?.action || ''),
    result: String(item?.result || ''),
    atmosphere: String(item?.atmosphere || ''),
    camera_movement: String(item?.camera_movement || ''),
    dialogue: String(item?.dialogue || ''),
    image_prompt: String(item?.image_prompt || ''),
    video_prompt: String(item?.video_prompt || item?.motion_prompt || item?.video_generation_prompt || item?.animation_prompt || ''),
    scene_ref_id: String(item?.scene_ref_id || item?.scene_ref || item?.location_id || ''),
    subject_ref_ids: Array.isArray(item?.subject_ref_ids)
        ? item.subject_ref_ids.map((id: any) => String(id)).filter(Boolean)
        : [],
    voice_role: String(item?.voice_role || ''),
    bgm_prompt: String(item?.bgm_prompt || ''),
    duration: Number(item?.recommended_duration_seconds || item?.duration || 3),
    selected_image_asset_id: Number(item?.selected_image_asset_id || 0),
    selected_video_asset_id: Number(item?.selected_video_asset_id || 0),
    selected_image_asset: normalizeAsset(item?.selected_image_asset),
    selected_video_asset: normalizeAsset(item?.selected_video_asset)
})
const normalizeNamedItem = (item: any, index: number, prefix: string): NamedItem => ({
    id: String(item?.id || item?.subject_id || item?.scene_id || item?.location_id || `${prefix}_${index + 1}`),
    name: String(item?.name || item?.title || `${prefix === 'subject' ? '??' : '??'}${index + 1}`),
    image: String(item?.image || item?.cover || item?.url || item?.image_url || ''),
    description: String(item?.description || item?.role_label || item?.scene_description || ''),
    visual_prompt: String(item?.visual_prompt || item?.appearance_lock || item?.space_lock || ''),
    image_prompt: String(item?.image_prompt || '')
})
const normalizeAsset = (item: any): AssetItem | null => {
    const inferredType = String(item?.asset_type || item?.type || (item?.video_url ? 'shot_video' : (item?.audio_url ? 'bgm_audio' : 'shot_image')))
    const url = item?.url
        || item?.video_url
        || item?.audio_url
        || item?.image_url
        || item?.file_url
        || (inferredType === 'shot_video' ? '' : item?.cover_url)
        || ''
    if (!url) return null
    return {
        id: Number(item?.id || item?.asset_id || 0),
        task_id: String(item?.task_id || ''),
        shot_id: String(item?.shot_id || ''),
        asset_type: inferredType,
        title: String(item?.title || ''),
        uri: String(item?.uri || ''),
        url,
        cover_url: String(item?.cover_url || ''),
        duration: Number(item?.duration || item?.duration_seconds || 0),
        created_at: String(item?.created_at || ''),
        meta: typeof item?.meta === 'object' && item.meta ? item.meta : {}
    }
}
const normalizeTask = (item: any): GenerationTask | null => {
    const taskId = item?.task_id || item?.id
    if (!taskId) return null
    const request = item?.request || {}
    const params = request?.params || {}
    const nested = params?.params || {}
    const videoParams = request?.video_params || {}
    const shotId = String(
        item?.shot_id
        || params?.shot_id
        || nested?.shot_id
        || request?.shot_id
        || videoParams?.shot_id
        || item?.params?.shot_id
        || item?.result?.shot_id
        || ''
    )
    return {
        task_id: String(taskId),
        task_type: String(item?.task_type || ''),
        status: String(item?.status || '') as GenerationStatus,
        shot_id: shotId,
        error_msg: String(item?.error_msg || item?.error || item?.message || ''),
        progress: Number(item?.progress || 0),
        request,
        result: typeof item?.result === 'object' && item.result ? item.result : {},
        input_asset_ids: numericList([
            ...numericList(item?.input_asset_ids),
            ...numericList(request?.input_asset_ids),
            ...numericList(params?.input_asset_ids),
            ...numericList(nested?.input_asset_ids),
            ...numericList(videoParams?.input_asset_ids),
            Number(request?.first_frame_asset_id || params?.first_frame_asset_id || nested?.first_frame_asset_id || videoParams?.first_frame_asset_id || 0),
            Number(request?.last_frame_asset_id || params?.last_frame_asset_id || nested?.last_frame_asset_id || videoParams?.last_frame_asset_id || 0)
        ]),
        output_asset_ids: numericList(item?.output_asset_ids || item?.result?.asset_ids),
        created_at: String(item?.created_at || item?.create_time || ''),
        finished_at: String(item?.finished_at || item?.finish_time || item?.completed_at || '')
    }
}
const normalizeModel = (model: any): ModelOption => ({
    id: String(model?.id || model?.value || model?.channel_code || model?.channel || model?.model_code || ''),
    value: String(model?.value || model?.channel_code || model?.channel || model?.model_code || model?.id || ''),
    channel_code: String(model?.channel_code || model?.channel || model?.model_code || model?.id || ''),
    name: String(model?.name || model?.title || model?.id || '默认模型')
    ,
    model_code: String(model?.model_code || model?.provider_model || ''),
    display_group: String(model?.display_group || ''),
    display_series: String(model?.display_series || ''),
    display_series_label: String(model?.display_series_label || ''),
    display_variant_label: String(model?.display_variant_label || ''),
    max_reference_images: Number(model?.max_reference_images || 0),
    max_reference_assets: Number(model?.max_reference_assets || 0),
    billing_unit: String(model?.billing_unit || ''),
    billing_unit_size: Number(model?.billing_unit_size || 1),
    settlement_mode: String(model?.settlement_mode || ''),
    platform_unit_cost: model?.platform_unit_cost ?? 0,
    tenant_unit_price: model?.tenant_unit_price ?? 0,
    default_quality: String(model?.default_quality || model?.quality || ''),
    ratio_options: Array.isArray(model?.ratio_options) ? model.ratio_options.map(String) : [],
    mode_options: Array.isArray(model?.mode_options) ? model.mode_options.map(String) : [],
    quality_options: Array.isArray(model?.quality_options) ? model.quality_options : [],
    resolution_options: Array.isArray(model?.resolution_options) ? model.resolution_options : [],
    duration_options: Array.isArray(model?.duration_options) ? model.duration_options : [],
    durations: Array.isArray(model?.durations) ? model.durations : [],
    market_product_id: Number(model?.market_product_id || 0),
    resource_type: String(model?.resource_type || ''),
    app_code: String(model?.app_code || ''),
    skus: Array.isArray(model?.skus) ? model.skus : []
})
const assetBelongsToShot = (asset: AssetItem | null | undefined, shotId: string, assetType = '') => {
    if (!asset?.url || !shotId) return false
    if (assetType && asset.asset_type !== assetType) return false
    return asset.shot_id === shotId
}
const latestAssetForShot = (shotId: string, assetType: string) => {
    return assets.value.find((asset) => assetBelongsToShot(asset, shotId, assetType)) || null
}
const latestGeneratedImageAssetForShot = (shotId: string) => {
    return assets.value.find((asset) => isGeneratedShotImageAsset(asset) && assetBelongsToShot(asset, shotId, 'shot_image')) || null
}
const assetById = (assetId: number) => assets.value.find((asset) => asset.id === assetId) || null
const shotById = (shotId: string) => shots.value.find((shot) => shot.id === shotId) || fallbackShots.value.find((shot) => shot.id === shotId) || null
const selectedAssetForShot = (shotId: string, assetType: 'shot_image' | 'shot_video') => {
    const shot = shotById(shotId)
    const selectedId = Number(assetType === 'shot_video' ? shot?.selected_video_asset_id : shot?.selected_image_asset_id)
    const embedded = assetType === 'shot_video' ? shot?.selected_video_asset : shot?.selected_image_asset
    const selected = selectedId > 0 ? assetById(selectedId) || embedded : embedded
    if (selectedId > 0 && selected?.url && selected.asset_type === assetType) return selected
    return assetBelongsToShot(selected, shotId, assetType) ? selected : null
}
const timelineAssetForShot = (shotId: string) => {
    return selectedAssetForShot(shotId, 'shot_video')
        || selectedAssetForShot(shotId, 'shot_image')
        || null
}
const selectedImageAssetForShot = (shotId: string) => {
    return selectedAssetForShot(shotId, 'shot_image')
}
const displayTimelineAssetForShot = (shotId: string) => {
    return timelineAssetForShot(shotId)
        || latestAssetForShot(shotId, 'shot_video')
        || latestAssetForShot(shotId, 'shot_image')
}
const displayImageAssetForShot = (shotId: string) => {
    return selectedImageAssetForShot(shotId) || latestAssetForShot(shotId, 'shot_image')
}
const firstStoryboardAssetFrom = (sourceAssets: AssetItem[]) => {
    if (!sourceAssets.length) return null
    const initialAssets = sourceAssets.filter((asset) => isSilentStoryboardImageAsset(asset))
    return (initialAssets.length ? initialAssets : sourceAssets)
        .slice()
        .sort((a, b) => {
            const aTime = historySortTime({ task_id: a.task_id || `asset_${a.id}`, created_at: a.created_at } as GenerationTask) || a.id
            const bTime = historySortTime({ task_id: b.task_id || `asset_${b.id}`, created_at: b.created_at } as GenerationTask) || b.id
            if (aTime !== bTime) return aTime - bTime
            return a.id - b.id
        })[0] || null
}
const initialStoryboardImageAssetForShot = (shotId: string) => {
    if (!shotId) return null
    const shotImageAssets = assets.value.filter((asset) => assetBelongsToShot(asset, shotId, 'shot_image'))
    return firstStoryboardAssetFrom(shotImageAssets)
}
const shotTasksForShot = (shotId: string, taskType = 'shot_image') => {
    if (!shotId) return []
    return tasks.value
        .filter((task) => task.task_type === taskType && task.shot_id === shotId)
        .sort((a, b) => (historySortTime(b) || 0) - (historySortTime(a) || 0))
}
const latestTaskForShot = (shotId: string, taskType = 'shot_image') => shotTasksForShot(shotId, taskType)[0] || null
const activeTaskForShot = (shotId: string, taskType = 'shot_image') => {
    return shotTasksForShot(shotId, taskType).find((task) => isActiveStatus(task.status)) || null
}
const hasSubmittedShotTask = (shotId: string, taskType = 'shot_image') => {
    return shotTasksForShot(shotId, taskType).some((task) => isActiveStatus(task.status) || task.status === 'success')
}
const taskForShot = (shotId: string, taskType = 'shot_image') => activeTaskForShot(shotId, taskType) || latestTaskForShot(shotId, taskType)
const activeShotImageTask = computed(() => {
    const shotId = activeShot.value?.id || ''
    return shotId ? taskForShot(shotId, 'shot_image') : null
})
const activeShotImageBusy = computed(() => {
    return generatingActiveShotImageTask.value || isActiveStatus(activeShotImageTask.value?.status || '')
})
const shotIsGenerating = (shotId: string) => {
    return ['shot_image', 'shot_video'].some((taskType) => {
        return isActiveStatus(taskForShot(shotId, taskType)?.status || '')
    })
}
const activeShotGenerating = computed(() => {
    const shotId = activeShot.value?.id || ''
    return !!shotId && (generatingActiveShotImageTask.value || shotIsGenerating(shotId))
})
const hasPendingShotResultSync = () => {
    return tasks.value.some((task) => {
        return ['shot_image', 'shot_video'].includes(task.task_type)
            && task.shot_id
            && task.status === 'success'
            && !taskOutputAsset(task)
    })
}
const shotStatusText = (shotId: string) => {
    const image = latestAssetForShot(shotId, 'shot_image')
    if (image) return '已生成'
    const task = taskForShot(shotId)
    if (!task) return '待生成'
    if (isActiveStatus(task.status)) return '生成中'
    if (task.status === 'failed') return '生成失败'
    if (task.status === 'success') return '同步中'
    return statusText(task.status) || '待生成'
}
const shotTimeLabel = (shot: ShotItem) => {
    const seconds = Number(shot.duration) || 3
    return formatDuration(seconds) || '00:00'
}
const formatDuration = (seconds: number) => {
    const total = Math.floor(Number(seconds) || 0)
    if (total <= 0) return ''
    const minutes = Math.floor(total / 60)
    const rest = String(total % 60).padStart(2, '0')
    return `${String(minutes).padStart(2, '0')}:${rest}`
}

const loadPlanContext = async () => {
    if (!scriptTaskId.value) return
    const data = await getShortDramaScriptPlanDetail({ task_id: scriptTaskId.value, project_id: projectId.value })
    const result = data?.result || data?.plan || {}
    projectTitle.value = String(result?.title || data?.title || projectTitle.value)
    applyProjectGenerationSettings(data?.generation_settings || data?.project_generation_settings || data?.project?.generation_settings)
    projectRatio.value = normalizeStoryboardRatio(
        projectGenerationSettings.value?.ratio
        || projectGenerationSettings.value?.aspect_ratio
        || result?.generation_settings?.aspect_ratio
        || result?.generation_settings?.ratio
        || result?.aspect_ratio
        || result?.ratio
        || data?.project?.aspect_ratio
        || data?.project?.ratio
        || data?.aspect_ratio
        || data?.ratio
        || projectRatio.value
    )
    musicPlan.value = result?.music_plan && typeof result.music_plan === 'object' ? result.music_plan : {}
    const rawShots = Array.isArray(result?.storyboard) ? result.storyboard : (Array.isArray(result?.shots) ? result.shots : [])
    shots.value = rawShots.map(normalizeShot)
    subjects.value = (Array.isArray(result?.subjects) ? result.subjects : []).map((item: any, index: number) => normalizeNamedItem(item, index, 'subject'))
    scenes.value = (Array.isArray(result?.scenes) ? result.scenes : (Array.isArray(result?.locations) ? result.locations : []))
        .map((item: any, index: number) => normalizeNamedItem(item, index, 'scene'))
    hydrateBgmPrompt()
    if (!activeShotId.value && shots.value[0]) activeShotId.value = shots.value[0].id
}
const modelMatchesSelection = (model: ModelOption, target?: { id?: string; value?: string; channel_code?: string } | null) => {
    const targetValues = [target?.id, target?.value, target?.channel_code]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    if (!targetValues.length) return false
    const modelValues = [model.id, model.value, (model as any).channel_code]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    return modelValues.some((value) => targetValues.includes(value))
}
const modelSettings = (model: ModelOption | null | undefined, resolution = '', ratio = projectRatio.value) => {
    const modelValue = model?.value || model?.channel_code || model?.id || ''
    return {
        model_id: modelValue,
        id: model?.id || modelValue,
        value: model?.value || modelValue,
        channel_code: model?.channel_code || modelValue,
        channel: model?.channel_code || modelValue,
        name: model?.name || '',
        model_name: model?.name || '',
        resolution,
        quality: resolution,
        ratio,
        aspect_ratio: ratio
    }
}
const projectGenerationSettingsPayload = () => ({
    ratio: projectRatio.value,
    aspect_ratio: projectRatio.value,
    image: {
        ...modelSettings(activeImageModel.value, selectedImageResolution.value, projectRatio.value),
        image_model_id: activeImageModel.value?.value || activeImageModel.value?.channel_code || activeImageModel.value?.id || selectedModelId.value
    },
    video: {
        ...modelSettings(activeVideoModel.value, selectedVideoResolution.value, projectRatio.value),
        video_model_id: activeVideoModel.value?.value || activeVideoModel.value?.channel_code || activeVideoModel.value?.id || selectedVideoModelId.value,
        video_mode: selectedVideoMode.value,
        duration: selectedVideoDuration.value || 0,
        duration_seconds: selectedVideoDuration.value || 0
    }
})
const saveProjectGenerationSettingsNow = async () => {
    if (!projectId.value) return
    await saveShortDramaProjectGenerationSettings({
        project_id: projectId.value,
        generation_settings: projectGenerationSettingsPayload()
    })
}
const scheduleProjectGenerationSettingsSave = () => {
    if (!projectId.value) return
    if (generationSettingsSaveTimer) clearTimeout(generationSettingsSaveTimer)
    generationSettingsSaveTimer = setTimeout(() => {
        generationSettingsSaveTimer = null
        saveProjectGenerationSettingsNow().catch(() => {})
    }, 300)
}
const applyProjectGenerationSettings = (settings: any) => {
    if (!settings || typeof settings !== 'object') return
    projectGenerationSettings.value = settings
    const ratio = String(settings.ratio || settings.aspect_ratio || settings.image?.ratio || settings.video?.ratio || '').trim()
    if (ratio) projectRatio.value = normalizeStoryboardRatio(ratio)
    const image = settings.image || {}
    const video = settings.video || {}
    if (video.video_mode || video.mode) selectedVideoMode.value = String(video.video_mode || video.mode || '').trim().toLowerCase()
    if (image.resolution || image.quality) {
        selectedImageResolution.value = String(image.resolution || image.quality || selectedImageResolution.value)
    }
    if (video.resolution || video.quality) {
        selectedVideoResolution.value = String(video.resolution || video.quality || selectedVideoResolution.value)
        batchVideoResolution.value = batchVideoResolution.value || selectedVideoResolution.value
    }
    const duration = Number(video.duration || video.duration_seconds || 0)
    if (duration > 0) {
        selectedVideoDuration.value = duration
        batchVideoDuration.value = batchVideoDuration.value || duration
    }
    if (imageModelOptions.value.length) {
        const matched = imageModelOptions.value.find((model) => modelMatchesSelection(model, image))
        if (matched) {
            selectedModelId.value = matched.value || matched.id
            selectedImageResolution.value = resolveShortDramaResolution(matched, selectedImageResolution.value)
            persistStoryboardImageModelSelection(matched, selectedImageResolution.value)
        }
    }
    if (videoModelOptions.value.length) {
        const matched = videoModelOptions.value.find((model) => modelMatchesSelection(model, video))
        if (matched) {
            selectedVideoModelId.value = matched.value || matched.id
            selectedVideoResolution.value = resolveShortDramaResolution(matched, selectedVideoResolution.value)
            selectedVideoMode.value = resolveVideoMode(matched, selectedVideoMode.value)
            const durations = videoDurationOptionsForModel(matched, selectedVideoResolution.value, selectedVideoMode.value)
            if (!durations.some((item) => item.value === selectedVideoDuration.value)) {
                selectedVideoDuration.value = durations[0]?.value || selectedVideoDuration.value
            }
        }
    }
}
const persistStoryboardImageModelSelection = (model?: ModelOption | null, resolution = selectedImageResolution.value) => {
    if (!model) return
    writeShortDramaImageModelSelection(projectId.value, scriptTaskId.value, {
        id: model.id,
        value: model.value,
        channel_code: (model as any).channel_code,
        name: model.name,
        default_quality: model.default_quality,
        resolution
    })
}
const applyHomeConfig = (data: any) => {
    const groups = Array.isArray(data?.model_groups) ? data.model_groups : []
    const groupKey = (group: any) => String(group?.key || group?.type || group?.app_code || '').toLowerCase()
    const isVideoGroup = (group: any) => ['video', 'shot_video', 'video_generation', 'aigc_video'].some((needle) => groupKey(group).includes(needle))
    const imageGroups = groups.filter((group: any) => {
        const key = groupKey(group)
        return ['image', 'shot_image', 'image_generation', 'aigc_image'].some((needle) => key.includes(needle)) && !isVideoGroup(group)
    })
    const videoGroups = groups.filter(isVideoGroup)
    const sourceGroups = imageGroups.length ? imageGroups : groups
    const models = sourceGroups.filter((group: any) => !isVideoGroup(group)).flatMap((group: any) => Array.isArray(group?.options) ? group.options : [])
        .concat(!imageGroups.length && Array.isArray(data?.models) ? data.models : [])
        .map(normalizeModel)
        .filter((model: ModelOption) => model.id)
    const videoModels = videoGroups.flatMap((group: any) => Array.isArray(group?.options) ? group.options : [])
        .concat(Array.isArray(data?.video_models) ? data.video_models : [])
        .map(normalizeModel)
        .filter((model: ModelOption) => model.id)
    imageModelOptions.value = models
    videoModelOptions.value = videoModels
    applyProjectGenerationSettings(projectGenerationSettings.value)
    const remoteImageModel = projectGenerationSettings.value?.image
    const persistedImageModel = remoteImageModel && typeof remoteImageModel === 'object'
        ? remoteImageModel
        : readShortDramaImageModelSelection(projectId.value, scriptTaskId.value)
    const restoredImageModel = models.find((model) => modelMatchesSelection(model, persistedImageModel))
    if (restoredImageModel) {
        selectedModelId.value = restoredImageModel.value || restoredImageModel.id
        selectedImageResolution.value = resolveShortDramaResolution(restoredImageModel, persistedImageModel?.resolution || selectedImageResolution.value)
    } else if (!selectedModelId.value && models[0]) {
        selectedModelId.value = models[0].value || models[0].id
        selectedImageResolution.value = resolveShortDramaResolution(models[0], selectedImageResolution.value)
    }
    if (!selectedVideoModelId.value && videoModels[0]) selectedVideoModelId.value = videoModels[0].value || videoModels[0].id
    selectedVideoMode.value = resolveVideoMode(activeVideoModel.value, selectedVideoMode.value)
}

const loadHomeConfig = async () => {
    const cached = readShortDramaHomeConfigCache<any>()
    if (cached && (!imageModelOptions.value.length || !videoModelOptions.value.length)) {
        applyHomeConfig(cached)
    }
    try {
        const data = await getShortDramaHome()
        writeShortDramaHomeConfigCache(data)
        applyHomeConfig(data)
    } catch {
        if (!imageModelOptions.value.length) imageModelOptions.value = []
        if (!videoModelOptions.value.length) videoModelOptions.value = []
    }
}
const loadAssets = async () => {
    const groups = await Promise.all(['shot_image', 'shot_video', 'bgm_audio', 'reference_image', 'subject_image', 'three_view', 'scene_image', 'final_video', 'export_package'].map(async (type) => {
        try {
            const data = await getShortDramaAssets({ project_id: projectId.value, task_id: scriptTaskId.value, asset_type: type })
            return listFromResponse(data).map(normalizeAsset).filter(Boolean) as AssetItem[]
        } catch {
            return []
        }
    }))
    assets.value = groups.flat().sort((a, b) => b.id - a.id)
}
const loadTasks = async () => {
    const taskTypeGroups = [
        'shot_image,shot_video,export_video,export_package,bgm_audio',
        'subject_image,three_view,scene_image'
    ]
    const groups = await Promise.all(taskTypeGroups.map((taskTypes) => getShortDramaGenerationLists({
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        task_types: taskTypes
    })))
    const taskMap = new Map<string, GenerationTask>()
    groups
        .flatMap((data) => listFromResponse(data))
        .map(normalizeTask)
        .filter((task): task is GenerationTask => !!task?.task_id)
        .forEach((task) => taskMap.set(task.task_id, task))
    tasks.value = Array.from(taskMap.values()).sort((a, b) => (historySortTime(b) || 0) - (historySortTime(a) || 0))
}
const upsertLocalAssets = (items: Array<any>) => {
    const normalized = items.map(normalizeAsset).filter((asset): asset is AssetItem => !!asset?.id && !!asset.url)
    if (!normalized.length) return []
    const next = [...assets.value]
    normalized.forEach((asset) => {
        const index = next.findIndex((item) => item.id === asset.id)
        if (index >= 0) next.splice(index, 1, { ...next[index], ...asset })
        else next.unshift(asset)
    })
    assets.value = next.sort((a, b) => b.id - a.id)
    return normalized
}
const outputAssetsFromGenerationDetail = (detail: any, fallbackTask: GenerationTask) => {
    const rawAssets = [
        ...(Array.isArray(detail?.output_assets) ? detail.output_assets : []),
        ...(Array.isArray(detail?.assets) ? detail.assets : [])
    ]
    const seen = new Set<number>()
    return rawAssets
        .map((item) => {
            const asset = normalizeAsset(item)
            if (!asset?.id || !asset.url) return null
            return {
                ...asset,
                shot_id: asset.shot_id || fallbackTask.shot_id,
                asset_type: asset.asset_type || (fallbackTask.task_type === 'shot_video' ? 'shot_video' : 'shot_image'),
                task_id: asset.task_id || fallbackTask.task_id
            }
        })
        .filter((asset): asset is AssetItem => {
            if (!asset?.id || seen.has(asset.id)) return false
            seen.add(asset.id)
            return ['shot_image', 'shot_video'].includes(asset.asset_type)
        })
}
const rememberSubmittedGenerationTask = (data: any, fallbackShotId = activeShot.value?.id || '') => {
    const taskId = String(data?.task_id || data?.task?.task_id || data?.data?.task_id || data?.data?.task?.task_id || '')
    if (!taskId) return ''
    if (fallbackShotId === activeShot.value?.id) currentGenerationTaskId.value = taskId
    return taskId
}
const syncGeneratedTaskAssetsToStoryboard = async () => {
    const missingResultTasks = tasks.value
        .filter((task) => ['shot_image', 'shot_video'].includes(task.task_type) && task.shot_id)
        .filter((task) => {
            const asset = taskOutputAsset(task)
            if (asset?.id) {
                updateLocalShotSelection(task.shot_id, asset)
                if (task.shot_id === activeShotId.value) {
                    syncActivePreviewAssetToTimeline(task.task_type === 'shot_video')
                }
                return false
            }
            return task.status === 'success'
        })
    if (!missingResultTasks.length) return
    await Promise.all(missingResultTasks.map(async (task) => {
        try {
            const detail: any = await getShortDramaGenerationDetail(task.task_id)
            const freshTask = normalizeTask(detail)
            if (freshTask) {
                const index = tasks.value.findIndex((item) => item.task_id === freshTask.task_id)
                if (index >= 0) tasks.value.splice(index, 1, freshTask)
                else tasks.value.unshift(freshTask)
            }
            const detailAssets = upsertLocalAssets(outputAssetsFromGenerationDetail(detail, freshTask || task))
            const targetAsset = detailAssets.find((asset) => asset.shot_id === task.shot_id && asset.asset_type === task.task_type)
                || detailAssets.find((asset) => asset.shot_id === task.shot_id)
                || detailAssets[0]
            if (targetAsset?.id) {
                updateLocalShotSelection(task.shot_id, targetAsset)
                if (task.shot_id === activeShotId.value) {
                    syncActivePreviewAssetToTimeline(targetAsset.asset_type === 'shot_video')
                }
            }
        } catch {}
    }))
}
const storyboardCacheSnapshot = (): StoryboardCacheData => ({
    projectTitle: projectTitle.value,
    projectRatio: projectRatio.value,
    shots: shots.value,
    subjects: subjects.value,
    scenes: scenes.value,
    assets: assets.value,
    tasks: [],
    imageModelOptions: imageModelOptions.value,
    videoModelOptions: videoModelOptions.value,
    selectedModelId: selectedModelId.value,
    selectedVideoModelId: selectedVideoModelId.value,
    selectedVideoMode: selectedVideoMode.value,
    musicPlan: musicPlan.value,
    draftBgmPrompt: draftBgmPrompt.value,
    savedBgmPrompt: savedBgmPrompt.value,
    activeShotId: activeShotId.value,
    activePreviewAssetId: activePreviewAssetId.value
})
const persistStoryboardCache = () => {
    writeShortDramaCreationCache(projectId.value, scriptTaskId.value, 'storyboard', storyboardCacheSnapshot())
}
const applyStoryboardCache = (cache: StoryboardCacheData | null) => {
    if (!cache) return false
    projectTitle.value = cache.projectTitle || projectTitle.value
    projectRatio.value = normalizeStoryboardRatio(cache.projectRatio || projectRatio.value)
    shots.value = Array.isArray(cache.shots) ? cache.shots : []
    subjects.value = Array.isArray(cache.subjects) ? cache.subjects : []
    scenes.value = Array.isArray(cache.scenes) ? cache.scenes : []
    assets.value = Array.isArray(cache.assets) ? cache.assets : []
    tasks.value = []
    imageModelOptions.value = Array.isArray(cache.imageModelOptions) ? cache.imageModelOptions : []
    videoModelOptions.value = Array.isArray(cache.videoModelOptions) ? cache.videoModelOptions : []
    selectedModelId.value = cache.selectedModelId || selectedModelId.value
    selectedVideoModelId.value = cache.selectedVideoModelId || selectedVideoModelId.value
    selectedVideoMode.value = cache.selectedVideoMode || selectedVideoMode.value
    musicPlan.value = cache.musicPlan && typeof cache.musicPlan === 'object' ? cache.musicPlan : {}
    draftBgmPrompt.value = cache.draftBgmPrompt || draftBgmPrompt.value
    savedBgmPrompt.value = cache.savedBgmPrompt || savedBgmPrompt.value
    activeShotId.value = cache.activeShotId || activeShotId.value
    activePreviewAssetId.value = Number(cache.activePreviewAssetId || 0)
    restoredFromCache.value = true
    return true
}
const restoreStoryboardCache = () => applyStoryboardCache(readShortDramaCreationCache<StoryboardCacheData>(projectId.value, scriptTaskId.value, 'storyboard'))

const refreshAll = async (silent = false) => {
    if (!projectId.value || !scriptTaskId.value) {
        feedback.msgError('项目任务不存在，请重新创建')
        await router.replace('/ai/short-drama')
        return
    }
    syncingData.value = silent
    try {
        await Promise.all([loadPlanContext(), loadAssets(), loadTasks(), loadHomeConfig()])
        await syncGeneratedTaskAssetsToStoryboard()
        if (!activeShotId.value && timelineShots.value[0]) activeShotId.value = timelineShots.value[0].id
        if (!activePreviewAssetId.value && activeShotId.value) {
            activePreviewAssetId.value = activeDisplayTimelineAssetId(activeShotId.value)
        }
        syncActivePreviewAssetToTimeline(true)
        hydrateBgmPrompt()
        await nextTick()
        loadComposerDraft()
        loadVisiblePromptDraft()
        persistStoryboardCache()
        schedulePolling()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || (restoredFromCache.value ? '数据同步失败，请稍后刷新' : '分镜数据读取失败'))
    } finally {
        syncingData.value = false
    }
}
const stopPolling = () => {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
}
const clearTimelinePlaybackTimers = () => {
    if (timelineTimer) clearTimeout(timelineTimer)
    if (timelineProgressTimer) clearInterval(timelineProgressTimer)
    timelineTimer = null
    timelineProgressTimer = null
}
const stopTimelinePlayback = () => {
    clearTimelinePlaybackTimers()
    previewVideoRef.value?.pause()
    pauseBgmAudio('timeline')
    timelinePlaying.value = false
    if (!timelineProgressShotId.value && activeShotId.value) {
        timelineProgressShotId.value = activeShotId.value
    }
}
const advanceTimelineToNext = () => {
    if (!timelinePlaying.value || timelineSeeking.value) return
    clearTimelinePlaybackTimers()
    timelineProgressPercent.value = 100
    if (timelineCurrentIndex >= timelineShots.value.length - 1) {
        stopTimelinePlayback()
        return
    }
    playTimelineAt(timelineCurrentIndex + 1)
}
const schedulePolling = () => {
    stopPolling()
    if (!tasks.value.some((task) => isActiveStatus(task.status)) && !hasPendingShotResultSync()) return
    pollTimer = setTimeout(() => refreshAll(true), 5000)
}

const updateLocalShotSelection = (shotId: string, asset: AssetItem) => {
    const index = shots.value.findIndex((shot) => shot.id === shotId)
    if (index < 0) return
    const key = asset.asset_type === 'shot_video' ? 'selected_video_asset_id' : 'selected_image_asset_id'
    const assetKey = asset.asset_type === 'shot_video' ? 'selected_video_asset' : 'selected_image_asset'
    shots.value[index] = {
        ...shots.value[index],
        [key]: asset.id,
        [assetKey]: asset
    }
    persistStoryboardCache()
}
const mergeEmbeddedShotAssets = (items: ShotItem[]) => {
    const embedded = items
        .flatMap((shot) => [shot.selected_image_asset, shot.selected_video_asset])
        .filter((asset): asset is AssetItem => !!asset?.id && !!asset.url)
    if (!embedded.length) return
    const existing = new Set(assets.value.map((asset) => asset.id))
    const additions = embedded.filter((asset) => !existing.has(asset.id))
    if (additions.length) {
        assets.value = [...additions, ...assets.value]
    }
}
const applyStoryboardStructureResult = (result: any, fallbackActiveShotId = '') => {
    const rawShots = Array.isArray(result?.shots) ? result.shots : listFromResponse(result)
    const nextShots = rawShots.map(normalizeShot).filter(Boolean) as ShotItem[]
    if (nextShots.length) {
        shots.value = nextShots
        mergeEmbeddedShotAssets(nextShots)
    }
    const nextActiveId = String(result?.active_shot_id || result?.shot?.shot_id || fallbackActiveShotId || '')
    if (nextActiveId) activeShotId.value = nextActiveId
    if (!shots.value.some((shot) => shot.id === activeShotId.value) && shots.value[0]) {
        activeShotId.value = shots.value[0].id
    }
    activePreviewAssetId.value = activeDisplayTimelineAssetId(activeShotId.value)
    timelineProgressShotId.value = activeShotId.value
    timelineProgressPercent.value = 0
    clearLastFrame()
    persistStoryboardCache()
}
const confirmStoryboardAsset = async (asset: AssetItem | null, silent = true) => {
    const shot = activeShot.value
    if (!shot || !asset?.id || !['shot_image', 'shot_video'].includes(asset.asset_type)) return
    updateLocalShotSelection(shot.id, asset)
    try {
        const result: any = await selectShortDramaStoryboardAsset({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            shot_id: shot.id,
            asset_id: asset.id,
            asset_type: asset.asset_type
        })
        const selectedAsset = normalizeAsset(result?.asset)
        if (selectedAsset) updateLocalShotSelection(shot.id, selectedAsset)
        if (!silent) feedback.msgSuccess('已替换到分镜')
    } catch (error: any) {
        await loadPlanContext()
        feedback.msgError(error?.msg || error?.message || '替换到分镜失败')
    }
}
const activeTimelineAssetId = (shotId: string) => timelineAssetForShot(shotId)?.id || 0
const activeDisplayTimelineAssetId = (shotId: string) => displayTimelineAssetForShot(shotId)?.id || 0
const syncActivePreviewAssetToTimeline = (preferVideo = false) => {
    const shotId = activeShotId.value
    if (!shotId) return
    const preferred = displayTimelineAssetForShot(shotId)
    if (!preferred?.id) return
    const current = activePreviewAssetId.value ? assetById(activePreviewAssetId.value) : null
    const currentBelongsToShot = assetBelongsToShot(current, shotId)
    const shouldPreferVideo = preferVideo && preferred.asset_type === 'shot_video' && current?.asset_type !== 'shot_video'
    if (!currentBelongsToShot || shouldPreferVideo) {
        activePreviewAssetId.value = preferred.id
    }
}
const selectShot = (shotId: string) => {
    if (timelineSeeking.value) return
    if (activeShotId.value !== shotId) {
        saveCurrentComposerDraft(generationMode.value, activeShotId.value)
        saveVisiblePromptDraft(generationMode.value, activeShotId.value)
    }
    activeShotId.value = shotId
    activePreviewAssetId.value = activeDisplayTimelineAssetId(shotId)
    timelineProgressShotId.value = shotId
    timelineProgressPercent.value = 0
}
const insertStoryboardShotAfter = async (afterShotId: string) => {
    if (storyboardStructureBusy.value) return
    saveCurrentComposerDraft(generationMode.value, activeShotId.value)
    saveVisiblePromptDraft(generationMode.value, activeShotId.value)
    storyboardStructureBusy.value = true
    try {
        const result = await insertShortDramaStoryboardShot({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            after_shot_id: afterShotId
        })
        applyStoryboardStructureResult(result)
        feedback.msgSuccess('已替换到分镜')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '新增分镜失败')
        await refreshAll(true)
    } finally {
        storyboardStructureBusy.value = false
    }
}
const copyStoryboardShotAction = async (shotId: string) => {
    if (storyboardStructureBusy.value) return
    const imageAsset = displayImageAssetForShot(shotId)
    const videoAsset = selectedAssetForShot(shotId, 'shot_video') || latestAssetForShot(shotId, 'shot_video')
    storyboardStructureBusy.value = true
    try {
        const result = await copyShortDramaStoryboardShot({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            shot_id: shotId,
            selected_image_asset_id: imageAsset?.id || 0,
            selected_video_asset_id: videoAsset?.id || 0
        })
        applyStoryboardStructureResult(result)
        feedback.msgSuccess('保存成功')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '复制分镜失败')
        await refreshAll(true)
    } finally {
        storyboardStructureBusy.value = false
    }
}
const deleteStoryboardShotAction = async (shotId: string) => {
    if (storyboardStructureBusy.value) return
    if (timelineShots.value.length <= 1) {
        feedback.msgWarning('请选择分镜')
        return
    }
    try {
        await ElMessageBox.confirm('确定删除当前素材吗？历史记录不会被物理删除。', '删除素材', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })
    } catch {
        return
    }
    storyboardStructureBusy.value = true
    try {
        const result = await deleteShortDramaStoryboardShot({
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            shot_id: shotId
        })
        applyStoryboardStructureResult(result)
        feedback.msgSuccess('保存成功')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '删除分镜失败')
        await refreshAll(true)
    } finally {
        storyboardStructureBusy.value = false
    }
}
const selectPreviewRecord = async (assetId: number) => {
    activePreviewAssetId.value = assetId
    const asset = assets.value.find((item) => item.id === assetId) || null
    await confirmStoryboardAsset(asset)
}
const usePreviewRecord = async (assetId: number) => {
    activePreviewAssetId.value = assetId
    const asset = assets.value.find((item) => item.id === assetId) || null
    await confirmStoryboardAsset(asset, false)
}
const fileExtensionFromUrl = (url: string, fallback: string) => {
    const clean = url.split('?')[0].split('#')[0]
    const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1).toLowerCase() : ''
    return ext && ext.length <= 8 ? ext : fallback
}
const downloadPreviewAsset = async () => {
    const asset = activePreviewAsset.value
    if (!asset?.url) return
    const ext = fileExtensionFromUrl(asset.url, asset.asset_type === 'shot_video' ? 'mp4' : 'png')
    const filename = `${activeShot.value?.title || asset.title || '分镜素材'}-${asset.id || Date.now()}.${ext}`.replace(/[\/:*?"<>|]/g, '_')
    try {
        const response = await fetch(asset.url, { mode: 'cors' })
        if (!response.ok) throw new Error('download failed')
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
    } catch {
        const link = document.createElement('a')
        link.href = asset.url
        link.download = filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        link.remove()
    }
}
const triggerPreviewReplace = () => {
    if (!activePreviewAsset.value?.url || replacingPreviewAsset.value) return
    previewUploadMode.value = 'replace'
    previewReplaceInputRef.value?.click()
}
const triggerPreviewManualUpload = () => {
    if (!activeShot.value || replacingPreviewAsset.value) return
    previewUploadMode.value = 'manual'
    previewReplaceInputRef.value?.click()
}
const handlePreviewReplaceFile = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || replacingPreviewAsset.value) return
    const shot = activeShot.value
    if (!shot) return
    const isManualUpload = previewUploadMode.value === 'manual'
    const current = activePreviewAsset.value
    if (!isManualUpload && !current?.url) return
    if (isManualUpload && !file.type.startsWith('image/')) {
        feedback.msgWarning('请选择文件')
        return
    }
    const isVideo = !isManualUpload && current?.asset_type === 'shot_video'
    if (isVideo && !file.type.startsWith('video/')) {
        feedback.msgWarning('请选择文件')
        return
    }
    if (!isVideo && !file.type.startsWith('image/')) {
        feedback.msgWarning('请选择文件')
        return
    }
    replacingPreviewAsset.value = true
    try {
        const upload: any = isVideo ? await uploadVideo({ file }) : await uploadImage({ file })
        const uri = upload?.url || upload?.uri || upload?.file_url || upload
        if (!uri) throw new Error(isVideo ? '视频上传失败' : '图片上传失败')
        const asset: any = await registerShortDramaAsset({
            project_id: projectId.value,
            task_id: `${isManualUpload ? 'manual_upload' : 'manual_replace'}_${Date.now()}`,
            shot_id: shot.id,
            asset_type: isManualUpload ? 'shot_image' : current!.asset_type,
            uri,
            title: `${isManualUpload ? '本地上传' : (isVideo ? '视频替换' : '图片替换')}-${shot.title || shot.id}`,
            mime_type: file.type || (isManualUpload ? 'image/png' : (isVideo ? 'video/mp4' : 'image/png')),
            file_size: file.size || 0,
            meta: isManualUpload
                ? { source: 'pc_storyboard_manual_upload' }
                : {
                    source: 'pc_storyboard_preview_replace',
                    replaced_asset_id: current!.id,
                    replaced_task_id: current!.task_id
                }
        })
        const normalized = normalizeAsset(asset)
        await loadAssets()
        if (normalized?.id) {
            activePreviewAssetId.value = normalized.id
            await confirmStoryboardAsset(normalized)
        }
        feedback.msgSuccess(isManualUpload ? '上传成功' : '替换成功')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || (isManualUpload ? '上传素材失败' : '替换素材失败'))
    } finally {
        replacingPreviewAsset.value = false
        previewUploadMode.value = 'replace'
    }
}
const closeFloatingMenus = () => {
    modeMenuOpen.value = false
    modelMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    batchMenuOpen.value = false
    exportMenuOpen.value = false
    batchVideoModelMenuOpen.value = false
}
const anchorMenuToButton = (button: HTMLElement | null, target: typeof modeMenuLeft) => {
    const composer = composerRef.value
    if (!button || !composer) return
    const buttonRect = button.getBoundingClientRect()
    const composerRect = composer.getBoundingClientRect()
    target.value = Math.round(buttonRect.left - composerRect.left + buttonRect.width / 2)
}
const anchorLastFrameMenu = () => {
    const button = lastFrameButtonRef.value
    const composer = composerRef.value
    if (!button || !composer) return
    const buttonRect = button.getBoundingClientRect()
    const composerRect = composer.getBoundingClientRect()
    const menuWidth = lastFrameMenuRef.value?.offsetWidth || 160
    const minimumLeft = menuWidth / 2 + 8
    const maximumLeft = Math.max(minimumLeft, composerRect.width - menuWidth / 2 - 8)
    const preferredLeft = buttonRect.left - composerRect.left + buttonRect.width / 2

    lastFrameMenuLeft.value = Math.round(Math.min(Math.max(preferredLeft, minimumLeft), maximumLeft))
    lastFrameMenuTop.value = Math.round(buttonRect.bottom - composerRect.top + 8)
}
const toggleExportMenu = () => {
    modeMenuOpen.value = false
    modelMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    batchMenuOpen.value = false
    exportMenuOpen.value = !exportMenuOpen.value
}
const toggleBatchMenu = () => {
    modeMenuOpen.value = false
    modelMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    exportMenuOpen.value = false
    batchMenuOpen.value = !batchMenuOpen.value
}
const runBatchShotImageGeneration = () => {
    batchMenuOpen.value = false
    generateShotImages()
}
const runBatchVideoGeneration = () => {
    batchMenuOpen.value = false
    openBatchVideoDialog()
}
const toggleModeMenu = () => {
    modelMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    modeMenuOpen.value = !modeMenuOpen.value
    if (modeMenuOpen.value) nextTick(() => anchorMenuToButton(modeButtonRef.value, modeMenuLeft))
}
const setGenerationMode = (mode: GenerationMode) => {
    if (mode === generationMode.value) {
        modeMenuOpen.value = false
        return
    }
    saveCurrentComposerDraft()
    saveVisiblePromptDraft()
    generationMode.value = mode
    modeMenuOpen.value = false
    modelMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    if (!['image_generate', 'video_generate'].includes(mode)) {
        selectedSubjectIds.value = []
        selectedSceneIds.value = []
    }
    if (mode === 'video_generate') clearLastFrame()
    nextTick(() => {
        loadComposerDraft(mode)
        loadVisiblePromptDraft(mode)
    })
}
const cycleMode = () => {
    const index = modeOptions.findIndex((item) => item.value === generationMode.value)
    setGenerationMode(modeOptions[(index + 1) % modeOptions.length].value)
}
const chooseMode = (mode: GenerationMode) => {
    setGenerationMode(mode)
}
const toggleModelMenu = () => {
    if (!activeModelOptions.value.length) {
        feedback.msgWarning(generationMode.value === 'video_generate' ? '请输入视频提示词' : '请输入图片提示词')
        return
    }
    modeMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    if (!modelMenuOpen.value) imageNanoPickerStep.value = 'root'
    modelMenuOpen.value = !modelMenuOpen.value
}
const selectGenerationModel = (model: ModelOption) => {
    if (generationMode.value === 'video_generate') {
        selectedVideoModelId.value = model.value || model.id
        selectedVideoResolution.value = resolveShortDramaResolution(model, selectedVideoResolution.value)
        selectedVideoMode.value = resolveVideoMode(model, selectedVideoMode.value)
        const durations = videoDurationOptionsForModel(model, selectedVideoResolution.value, selectedVideoMode.value)
        if (!durations.some((item) => item.value === selectedVideoDuration.value)) selectedVideoDuration.value = durations[0]?.value || 0
    } else {
        selectedModelId.value = model.value || model.id
        selectedImageResolution.value = resolveShortDramaResolution(model, selectedImageResolution.value)
        persistStoryboardImageModelSelection(model, selectedImageResolution.value)
    }
    scheduleProjectGenerationSettingsSave()
    modelMenuOpen.value = false
    durationMenuOpen.value = false
}
const openImageNanoPicker = () => {
    const model = isActiveImageNanoModel.value ? activeImageModel.value : imageNanoModelOptions.value[0]
    imageNanoPickerSeries.value = nanoSeriesValue(model || ({ id: '', value: '', name: '' } as ModelOption))
    imageNanoPickerStep.value = imageNanoSeriesOptions.value.length > 1 ? 'series' : 'variant'
}
const selectImageNanoSeries = (series: string) => {
    imageNanoPickerSeries.value = series
    imageNanoPickerStep.value = 'variant'
}
const selectImageNanoVariant = (model: ModelOption) => {
    selectGenerationModel(model)
    imageNanoPickerStep.value = 'root'
}
const selectGenerationResolution = (value: string) => {
    if (generationMode.value === 'video_generate') {
        selectedVideoResolution.value = value
        const durations = videoDurationOptionsForModel(activeVideoModel.value, value, selectedVideoMode.value)
        if (!durations.some((item) => item.value === selectedVideoDuration.value)) selectedVideoDuration.value = durations[0]?.value || 0
    }
    else {
        selectedImageResolution.value = value
        persistStoryboardImageModelSelection(activeImageModel.value, value)
    }
    scheduleProjectGenerationSettingsSave()
    resolutionMenuOpen.value = false
}
const selectVideoMode = (value: string) => {
    selectedVideoMode.value = resolveVideoMode(activeVideoModel.value, value)
    const durations = videoDurationOptionsForModel(activeVideoModel.value, selectedVideoResolution.value, selectedVideoMode.value)
    if (!durations.some((item) => item.value === selectedVideoDuration.value)) selectedVideoDuration.value = durations[0]?.value || 0
    scheduleProjectGenerationSettingsSave()
}
const toggleDurationMenu = () => {
    if (!activeVideoDurationOptions.value.length) return
    modeMenuOpen.value = false
    resolutionMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    durationMenuOpen.value = !durationMenuOpen.value
}
const selectVideoDuration = (value: number) => {
    selectedVideoDuration.value = value
    scheduleProjectGenerationSettingsSave()
    durationMenuOpen.value = false
}
const toggleBatchVideoModelMenu = () => {
    if (!videoModelOptions.value.length) {
        feedback.msgWarning('暂无可用视频模型')
        return
    }
    batchVideoModelMenuOpen.value = !batchVideoModelMenuOpen.value
}
const selectBatchVideoModel = (model: ModelOption) => {
    const value = model.value || model.id
    if (!value) return
    batchVideoModelId.value = value
    batchVideoModelMenuOpen.value = false
    const options = videoResolutionOptionsForModel(model)
    const values = options.map((item) => item.value)
    if (!values.includes(batchVideoResolution.value)) {
        batchVideoResolution.value = resolveShortDramaResolution(model, batchVideoResolution.value)
    }
    batchVideoMode.value = resolveVideoMode(model, batchVideoMode.value)
    const durations = videoDurationOptionsForModel(model, batchVideoResolution.value, batchVideoMode.value)
    if (!durations.some((item) => item.value === batchVideoDuration.value)) batchVideoDuration.value = durations[0]?.value || 0
    selectedVideoModelId.value = value
    selectedVideoResolution.value = batchVideoResolution.value
    selectedVideoDuration.value = batchVideoDuration.value
    selectedVideoMode.value = batchVideoMode.value
    scheduleProjectGenerationSettingsSave()
}
const selectBatchVideoResolution = (value: string) => {
    batchVideoResolution.value = value
    selectedVideoResolution.value = value
    const durations = videoDurationOptionsForModel(batchVideoModel.value, value, batchVideoMode.value)
    if (!durations.some((item) => item.value === batchVideoDuration.value)) {
        batchVideoDuration.value = durations[0]?.value || 0
    }
    selectedVideoDuration.value = batchVideoDuration.value
    scheduleProjectGenerationSettingsSave()
}
const selectBatchVideoMode = (value: string) => {
    batchVideoMode.value = resolveVideoMode(batchVideoModel.value, value)
    const durations = videoDurationOptionsForModel(batchVideoModel.value, batchVideoResolution.value, batchVideoMode.value)
    if (!durations.some((item) => item.value === batchVideoDuration.value)) batchVideoDuration.value = durations[0]?.value || 0
    selectedVideoMode.value = batchVideoMode.value
    selectedVideoDuration.value = batchVideoDuration.value
    scheduleProjectGenerationSettingsSave()
}
const selectBatchVideoDuration = (value: number) => {
    batchVideoDuration.value = value
    selectedVideoDuration.value = value
    scheduleProjectGenerationSettingsSave()
}
const toggleMentionMenu = () => {
    modelMenuOpen.value = false
    modeMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    lastFrameMenuOpen.value = false
    mentionMenuOpen.value = !mentionMenuOpen.value
    if (mentionMenuOpen.value) nextTick(() => anchorMenuToButton(mentionButtonRef.value, mentionMenuLeft))
}
const placeCaretAtEditorEnd = () => {
    const editor = composerEditorRef.value
    if (!editor) return
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
}
const readComposerEditorText = () => {
    const editor = composerEditorRef.value
    if (!editor) return composerText.value.trim()
    const walk = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
        if (node.nodeType !== Node.ELEMENT_NODE) return ''
        const element = node as HTMLElement
        if (element.classList.contains('composer-mention-chip')) {
            return element.dataset.name ? `@${element.dataset.name}` : element.textContent || ''
        }
        if (element.tagName === 'BR') return '\n'
        return Array.from(element.childNodes).map(walk).join('')
    }
    return Array.from(editor.childNodes)
        .map(walk)
        .join('')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
const syncSelectedMentionsFromEditor = () => {
    const editor = composerEditorRef.value
    if (!editor) return
    const chips = Array.from(editor.querySelectorAll<HTMLElement>('.composer-mention-chip'))
    selectedSubjectIds.value = chips
        .filter((chip) => chip.dataset.type === 'subject')
        .map((chip) => chip.dataset.id || '')
        .filter(Boolean)
    selectedSceneIds.value = chips
        .filter((chip) => chip.dataset.type === 'scene')
        .map((chip) => chip.dataset.id || '')
        .filter(Boolean)
}
const syncComposerFromEditor = () => {
    composerText.value = readComposerEditorText()
    syncSelectedMentionsFromEditor()
}
const setComposerEditorText = (text: string) => {
    const editor = composerEditorRef.value
    if (!editor) return
    editor.textContent = text || ''
}
const mentionItemsForSelection = () => [
    ...selectedSubjectIds.value
        .map((id) => subjects.value.find((subject) => subject.id === id))
        .filter(Boolean)
        .map((item) => ({ type: 'subject' as const, item: item as NamedItem })),
    ...selectedSceneIds.value
        .map((id) => scenes.value.find((scene) => scene.id === id))
        .filter(Boolean)
        .map((item) => ({ type: 'scene' as const, item: item as NamedItem }))
]
const appendEditorText = (editor: HTMLElement, text: string) => {
    if (text) editor.appendChild(document.createTextNode(text))
}
const createMentionTextSpan = (text: string) => {
    const span = document.createElement('span')
    span.className = 'composer-mention-text'
    span.textContent = text
    span.style.color = mentionColor
    return span
}
const renderMentionedEditorText = (editor: HTMLElement, text: string) => {
    const selectedMentions = mentionItemsForSelection()
        .filter(({ item }) => item.name)
        .sort((a, b) => b.item.name.length - a.item.name.length)
    let cursor = 0
    while (cursor < text.length) {
        const match = findNextMention(text, cursor)
        if (!match) {
            appendEditorText(editor, text.slice(cursor))
            break
        }
        appendEditorText(editor, text.slice(cursor, match.index))
        const selectedMatch = findMentionAt(text, match.index, selectedMentions)
        if (selectedMatch && selectedMatch.value === match.value) {
            editor.appendChild(createMentionChip(selectedMatch.type, selectedMatch.item))
        } else {
            editor.appendChild(createMentionTextSpan(match.value))
        }
        cursor = match.index + match.value.length
    }
}
const renderComposerEditor = (text: string) => {
    const editor = composerEditorRef.value
    const nextText = generationMode.value === 'video_generate'
        ? mentionizeProjectNames(normalizeVideoPromptForShot(text, activeShot.value))
        : stripPromptNoise(text)
    if (!editor) {
        composerText.value = nextText
        return
    }
    editor.innerHTML = ''
    if (mentionEnabled.value) {
        renderMentionedEditorText(editor, nextText)
    } else {
        editor.textContent = nextText
    }
    composerText.value = readComposerEditorText()
    placeCaretAtEditorEnd()
}
const saveCurrentComposerDraft = (mode = generationMode.value, shotId = activeShot.value?.id || '') => {
    const key = composerDraftKey(mode, shotId)
    const shot = shotById(shotId) || (shotId === activeShot.value?.id ? activeShot.value : null)
    composerDrafts.value[key] = cleanComposerDraftForMode(readComposerEditorText(), mode, shot)
    if (['image_generate', 'video_generate'].includes(mode)) {
        composerMentionDrafts.value[key] = {
            subjectIds: [...selectedSubjectIds.value],
            sceneIds: [...selectedSceneIds.value]
        }
    }
}
const saveVisiblePromptDraft = (mode = generationMode.value, shotId = activeShot.value?.id || '') => {
    if (!shotId) return
    const key = visiblePromptDraftKey(mode, shotId)
    const shot = shotById(shotId) || (shotId === activeShot.value?.id ? activeShot.value : null)
    const isActivePrompt = mode === generationMode.value && shotId === activeShot.value?.id
    const text = isActivePrompt ? activeVisiblePromptDraft.value : visiblePromptDrafts.value[key]
    if (text !== undefined) {
        visiblePromptDrafts.value[key] = mode === 'video_generate'
            ? mentionizeProjectNames(normalizeVideoPromptForShot(text, shot))
            : cleanImageDisplayPrompt(text, shot)
    }
}
const loadVisiblePromptDraft = (mode = generationMode.value, shotId = activeShot.value?.id || '') => {
    const key = visiblePromptDraftKey(mode, shotId)
    const shot = shotById(shotId) || activeShot.value
    const draft = visiblePromptDrafts.value[key]
    const normalizedDraft = mode === 'video_generate' ? usableVideoPromptDraft(draft, shot) : draft
    const nextText = mode === 'video_generate'
        ? mentionizeProjectNames(normalizeVideoPromptForShot(normalizedDraft !== undefined ? normalizedDraft : defaultVisiblePromptText(mode, shot), shot))
        : cleanImageDisplayPrompt(normalizedDraft !== undefined ? normalizedDraft : defaultVisiblePromptText(mode, shot), shot)
    if (draft !== undefined && nextText !== draft) {
        visiblePromptDrafts.value[key] = nextText
    }
    visiblePromptDraft.value = nextText
}
const normalizeVisiblePromptDraft = () => {
    activeVisiblePromptDraft.value = generationMode.value === 'video_generate'
        ? mentionizeProjectNames(normalizeVideoPromptForShot(activeVisiblePromptDraft.value, activeShot.value))
        : cleanImageDisplayPrompt(activeVisiblePromptDraft.value, activeShot.value)
    saveVisiblePromptDraft()
}
const activeVisiblePromptForSubmit = (mode = generationMode.value, shot: ShotItem | null = activeShot.value) => {
    const key = visiblePromptDraftKey(mode, shot?.id || '')
    const draft = visiblePromptDrafts.value[key]
    const normalizedDraft = mode === 'video_generate' ? usableVideoPromptDraft(draft, shot) : draft
    const visible = normalizedDraft !== undefined
        ? normalizedDraft
        : (shot?.id === activeShot.value?.id && mode === generationMode.value ? activeVisiblePromptDraft.value : defaultVisiblePromptText(mode, shot))
    return mode === 'video_generate'
        ? mentionizeProjectNames(normalizeVideoPromptForShot(visible || defaultVisiblePromptText(mode, shot), shot))
        : cleanVisiblePromptForShot(visible || defaultVisiblePromptText(mode, shot), shot)
}
const cleanComposerDraftForMode = (text: string, mode = generationMode.value, shot: ShotItem | null = activeShot.value) => {
    if (mode === 'video_generate') {
        return mentionizeProjectNames(normalizeVideoPromptForShot(text, shot))
    }
    return stripPromptNoise(text)
}
const loadComposerDraft = (mode = generationMode.value, shotId = activeShot.value?.id || '') => {
    const key = composerDraftKey(mode, shotId)
    const shot = shotById(shotId) || activeShot.value
    const draft = composerDrafts.value[key]
    if (['image_generate', 'video_generate'].includes(mode)) {
        const mentionDraft = composerMentionDrafts.value[key]
        if (mentionDraft) {
            selectedSubjectIds.value = mentionDraft.subjectIds.filter((id) => subjects.value.some((subject) => subject.id === id))
            selectedSceneIds.value = mentionDraft.sceneIds.filter((id) => scenes.value.some((scene) => scene.id === id))
        } else {
            selectedSubjectIds.value = []
            selectedSceneIds.value = []
        }
    } else {
        selectedSubjectIds.value = []
        selectedSceneIds.value = []
    }
    const normalizedDraft = mode === 'video_generate' ? usableVideoPromptDraft(draft, shot) : draft
    const nextText = cleanComposerDraftForMode(normalizedDraft !== undefined ? normalizedDraft : defaultComposerText(mode), mode, shot)
    if (draft !== undefined && nextText !== draft) {
        composerDrafts.value[key] = nextText
    }
    if (['image_generate', 'video_generate'].includes(mode)) {
        applyMentionSelectionsFromText(nextText)
    }
    renderComposerEditor(nextText)
}
const createMentionChip = (type: 'subject' | 'scene', item: NamedItem) => {
    const chip = document.createElement('span')
    chip.className = 'composer-mention-chip'
    chip.contentEditable = 'false'
    chip.dataset.type = type
    chip.dataset.id = item.id
    chip.dataset.name = item.name
    chip.style.display = 'inline-flex'
    chip.style.alignItems = 'center'
    chip.style.gap = '4px'
    chip.style.marginRight = '2px'
    chip.style.color = mentionColor
    chip.style.verticalAlign = 'baseline'
    chip.style.whiteSpace = 'nowrap'

    const name = document.createElement('span')
    name.className = 'composer-mention-name'
    name.textContent = `@${item.name}`
    chip.appendChild(name)
    return chip
}
const appendMentionToComposer = (type: 'subject' | 'scene', item: NamedItem) => {
    const editor = composerEditorRef.value
    if (!editor || !item.name) return
    const existed = Array.from(editor.querySelectorAll<HTMLElement>('.composer-mention-chip'))
        .some((chip) => chip.dataset.type === type && chip.dataset.id === item.id)
    if (existed) return
    editor.focus()
    editor.appendChild(createMentionChip(type, item))
    editor.appendChild(document.createTextNode('\u00a0'))
    placeCaretAtEditorEnd()
    syncComposerFromEditor()
}
const selectMentionItem = (type: 'subject' | 'scene', item: NamedItem) => {
    if (type === 'subject') {
        if (!selectedSubjectIds.value.includes(item.id)) selectedSubjectIds.value.push(item.id)
    } else {
        selectedSceneIds.value = [item.id]
        composerEditorRef.value?.querySelectorAll('.composer-mention-chip[data-type="scene"]').forEach((chip) => chip.remove())
    }
    appendMentionToComposer(type, item)
    mentionMenuOpen.value = false
}
const removePreviousMentionChip = () => {
    const selection = window.getSelection()
    const editor = composerEditorRef.value
    if (!selection?.isCollapsed || !editor || !editor.contains(selection.anchorNode)) return false
    let node: Node | null = selection.anchorNode
    let offset = selection.anchorOffset
    if (!node) return false
    if (node.nodeType === Node.TEXT_NODE) {
        if (offset > 1 || String(node.textContent || '').slice(0, offset).trim()) return false
        const previous = node.previousSibling
        if (previous instanceof HTMLElement && previous.classList.contains('composer-mention-chip')) {
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
        const chip = previous instanceof HTMLElement && previous.classList.contains('composer-mention-chip')
            ? previous
            : (previous?.previousSibling instanceof HTMLElement && previous.previousSibling.classList.contains('composer-mention-chip') ? previous.previousSibling : null)
        if (chip) {
            previous.nodeType === Node.TEXT_NODE && previous.textContent?.trim() === '' && previous.remove()
            chip.remove()
            syncComposerFromEditor()
            placeCaretAtEditorEnd()
            return true
        }
    }
    return false
}
const handleComposerKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        submitGeneration()
        return
    }
    if (event.key === 'Backspace' && removePreviousMentionChip()) {
        event.preventDefault()
    }
}
const handleComposerPaste = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData('text/plain') || ''
    document.execCommand('insertText', false, text)
    syncComposerFromEditor()
}
const applyMentionSelectionsFromText = (text: string) => {
    if (!text || !mentionEnabled.value) return false
    let changed = false
    subjects.value.forEach((subject) => {
        if (!subject.name || selectedSubjectIds.value.includes(subject.id)) return
        if (mentionTokenPattern(subject.name).test(text)) {
            selectedSubjectIds.value.push(subject.id)
            changed = true
        }
    })
    scenes.value.forEach((scene) => {
        if (!scene.name || selectedSceneIds.value.includes(scene.id)) return
        if (mentionTokenPattern(scene.name).test(text)) {
            selectedSceneIds.value.push(scene.id)
            changed = true
        }
    })
    return changed
}
const resolveTypedMentionsFromComposer = () => {
    const text = mentionizeProjectNames(readComposerEditorText())
    if (!text || !mentionEnabled.value) return
    const changed = applyMentionSelectionsFromText(text)
    if (changed || text !== readComposerEditorText()) {
        renderComposerEditor(text)
    }
}
const clearMentionSelections = () => {
    selectedSubjectIds.value = []
    selectedSceneIds.value = []
}
const copyActivePrompt = async () => {
    const text = currentStoryboardPromptText.value
    if (!text) return
    try {
        await navigator.clipboard?.writeText(text)
        feedback.msgSuccess('提示词已复制')
    } catch {
        feedback.msgWarning('复制失败，请手动复制')
    }
}
const applyQuickEdit = (text: string) => {
    if (generationMode.value !== 'image_edit') setGenerationMode('image_edit')
    composerText.value = text
    composerDrafts.value[composerDraftKey('image_edit')] = text
    nextTick(() => renderComposerEditor(text))
}
const toggleSelected = (list: string[], id: string) => {
    const index = list.indexOf(id)
    if (index >= 0) list.splice(index, 1)
    else list.push(id)
}
const setLastFrameMode = (mode: LastFrameMode) => {
    lastFrameMode.value = mode
    lastFrameMenuOpen.value = false
    if (mode === 'empty') frameOrderSwapped.value = false
}
const triggerLastFrameUpload = () => {
    if (lastFrameMode.value !== 'upload') return
    lastFrameInputRef.value?.click()
}
const toggleLastFrameMenu = () => {
    modeMenuOpen.value = false
    modelMenuOpen.value = false
    resolutionMenuOpen.value = false
    durationMenuOpen.value = false
    mentionMenuOpen.value = false
    lastFrameMenuOpen.value = !lastFrameMenuOpen.value
    if (lastFrameMenuOpen.value) nextTick(anchorLastFrameMenu)
}
const chooseLastFrameUpload = () => {
    setLastFrameMode('upload')
    nextTick(triggerLastFrameUpload)
}
const chooseNextShotFrame = () => {
    if (!nextShotImageAsset.value?.url) {
        feedback.msgWarning('上一分镜没有可用素材')
        lastFrameMenuOpen.value = false
        return
    }
    setLastFrameMode('next_shot')
}
const choosePreviousShotFrame = async () => {
    if (!previousShot.value) {
        lastFrameMenuOpen.value = false
        return
    }
    const videoAsset = previousShotVideoAsset.value
    if (videoAsset?.id) {
        if (extractingPreviousVideoTail.value) return
        extractingPreviousVideoTail.value = true
        lastFrameMenuOpen.value = false
        try {
            const result: any = await extractShortDramaVideoLastFrame({
                project_id: projectId.value,
                task_id: scriptTaskId.value,
                shot_id: activeShot.value?.id || '',
                asset_id: videoAsset.id
            })
            const asset = normalizeAsset(result?.asset || result)
            if (!asset?.id || !asset.url) {
                throw new Error('上一分镜视频尾帧提取失败')
            }
            if (lastFramePreviewLocal.value) URL.revokeObjectURL(lastFramePreviewLocal.value)
            lastFrameFile.value = null
            lastFramePreviewLocal.value = ''
            if (lastFrameInputRef.value) lastFrameInputRef.value.value = ''
            lastFrameAsset.value = asset
            if (!assets.value.some((item) => item.id === asset.id)) {
                assets.value = [asset, ...assets.value]
            }
            setLastFrameMode('previous_video_tail')
            feedback.msgSuccess('已使用上一分镜视频尾帧')
        } catch (error: any) {
            feedback.msgError(error?.msg || error?.message || '上一分镜视频尾帧提取失败，请改用本地上传或上一分镜图')
        } finally {
            extractingPreviousVideoTail.value = false
        }
        return
    }
    if (previousShotImageAsset.value?.id) {
        if (lastFramePreviewLocal.value) URL.revokeObjectURL(lastFramePreviewLocal.value)
        lastFrameFile.value = null
        lastFramePreviewLocal.value = ''
        lastFrameAsset.value = null
        if (lastFrameInputRef.value) lastFrameInputRef.value.value = ''
        setLastFrameMode('previous_shot_image')
        feedback.msgSuccess('已使用上一分镜图')
        return
    }
    feedback.msgWarning('请先选择分镜图')
    lastFrameMenuOpen.value = false
}
const clearLastFrame = () => {
    if (lastFramePreviewLocal.value) URL.revokeObjectURL(lastFramePreviewLocal.value)
    lastFrameFile.value = null
    lastFramePreviewLocal.value = ''
    lastFrameAsset.value = null
    extractingPreviousVideoTail.value = false
    if (lastFrameInputRef.value) lastFrameInputRef.value.value = ''
    setLastFrameMode('empty')
}
const swapVideoFrames = () => {
    if (!lastFramePreviewUrl.value) {
        feedback.msgWarning('请选择分镜')
        return
    }
    frameOrderSwapped.value = !frameOrderSwapped.value
}
const handleLastFrameFile = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (lastFramePreviewLocal.value) URL.revokeObjectURL(lastFramePreviewLocal.value)
    lastFrameFile.value = file
    lastFramePreviewLocal.value = URL.createObjectURL(file)
    lastFrameAsset.value = null
    lastFrameMode.value = 'upload'
}
const ensureUploadedReferenceAsset = async (file: File | null, role: string) => {
    if (!file) return null
    const upload: any = await uploadImage({ file })
    const uri = upload?.url || upload?.uri || upload?.file_url || upload
    if (!uri) throw new Error('上传失败')
    const asset: any = await registerShortDramaAsset({
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        shot_id: activeShot.value?.id || '',
        asset_type: 'reference_image',
        uri,
        title: role === 'last_frame' ? '尾帧参考图' : '首帧参考图',
        mime_type: file.type || 'image/png',
        file_size: file.size || 0,
        meta: { role, source: 'pc_storyboard_step' }
    })
    return normalizeAsset(asset)
}
const scrollDrawToLatest = async (smooth = true) => {
    await nextTick()
    const target = drawScrollRef.value
    if (!target) return
    target.scrollTo({
        top: target.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    })
}
const appendChat = (role: 'assistant' | 'user', text: string, extra: Partial<ChatMessage> = {}) => {
    const message: ChatMessage = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        role,
        text,
        ...extra
    }
    chatMessages.value.push(message)
    scrollDrawToLatest()
    return message
}
const lastAssistantMessage = () => [...chatMessages.value].reverse().find((message) => message.role === 'assistant')
const syncAssistantFromImageEditTask = () => {
    if (generationMode.value !== 'image_edit') return
    const assistant = lastAssistantMessage()
    if (!assistant) return
    if (latestPanelResultUrl.value) {
        assistant.loading = false
        assistant.text = '生成已完成'
        assistant.status = ''
        return
    }
    const task = currentImageEditTask.value
    if (!task) return
    if (isActiveStatus(task.status)) {
        assistant.loading = true
        assistant.text = '生成中'
        assistant.status = ''
    } else if (task.status === 'failed') {
        assistant.loading = false
        assistant.text = task.error_msg || '生成失败，请稍后重试'
        assistant.status = '失败'
    } else if (task.status === 'success') {
        assistant.loading = true
        assistant.text = '生成中'
        assistant.status = ''
    }
}
const submitGeneration = async () => {
    if (submittingGeneration.value) return
    syncComposerFromEditor()
    const shot = activeShot.value
    if (!shot) {
        feedback.msgWarning('请选择模型')
        return
    }
    if ((generationMode.value === 'image_edit' || generationMode.value === 'video_generate') && !activeImageAsset.value?.id) {
        feedback.msgWarning('当前分镜缺少可用首帧图')
        return
    }
    resolveTypedMentionsFromComposer()
    syncComposerFromEditor()
    normalizeVisiblePromptDraft()
    const visiblePromptText = activeVisiblePromptForSubmit(generationMode.value, shot)
    let messageText = cleanVisiblePromptForShot(composerText.value.trim(), shot)
    if (generationMode.value === 'image_generate' && !messageText) {
        messageText = visiblePromptText
    }
    if (generationMode.value === 'video_generate') {
        const normalizedMessage = normalizeVideoPromptForShot(messageText || visiblePromptText, shot)
        if (normalizedMessage !== composerText.value.trim()) {
            composerText.value = normalizedMessage
            setComposerEditorText(normalizedMessage)
        }
        messageText = normalizedMessage
    }
    if (!messageText && generationMode.value !== 'video_generate') {
        feedback.msgWarning('请选择文件')
        return
    }
    const sourceAsset = activeImageAsset.value ? { ...activeImageAsset.value } : null
    modelMenuOpen.value = false
    mentionMenuOpen.value = false
    modeMenuOpen.value = false
    resolutionMenuOpen.value = false
    currentGenerationTaskId.value = ''
    if (generationMode.value === 'image_edit') {
        lastUserEditText.value = messageText
        imageEditSession.value = {
            shotId: shot.id,
            taskId: '',
            sourceAsset
        }
    }
    submittingGeneration.value = true
    const submittedText = messageText || visiblePromptText || activeModeLabel.value
    const submittedDisplayText = generationMode.value === 'video_generate'
        ? normalizeDisplayVideoPrompt(submittedText, !shotHasVisibleSubjects(shot), shotVisibleRemoveItems(shot))
        : cleanUserDisplayPrompt(submittedText, { removeItems: shotVisibleRemoveItems(shot) })
    appendChat('user', submittedDisplayText || activeModeLabel.value)
    const assistant = appendChat('assistant', '生成中', { loading: true })
    let assistantStreamRawText = ''
    try {
        let tailAsset: AssetItem | null = null
        if (generationMode.value === 'video_generate' && lastFrameMode.value === 'upload' && lastFrameFile.value) {
            tailAsset = await ensureUploadedReferenceAsset(lastFrameFile.value, 'last_frame')
            if (tailAsset) {
                lastFrameAsset.value = tailAsset
                await loadAssets()
            }
        }
        const payload = buildGenerationPayload(messageText, tailAsset || undefined)
        await saveProjectGenerationSettingsNow().catch(() => {})
        if (generationMode.value === 'video_generate') {
            await preflightShotVideoGenerations([payload])
        }
        await streamShortDramaGeneration(payload, {
            onEvent: async ({ event, data }) => {
                if (event === 'thinking') {
                    assistant.text = '生成中'
                    scrollDrawToLatest()
                } else if (event === 'message_delta') {
                    if (generationMode.value === 'image_edit') return
                    const delta = String(data?.text || '')
                    if (generationMode.value === 'video_generate') {
                        assistantStreamRawText = `${assistantStreamRawText}${delta}`
                        const displayText = normalizeDisplayVideoPrompt(
                            assistantStreamRawText,
                            !shotHasVisibleSubjects(shot),
                            shotVisibleRemoveItems(shot)
                        )
                        assistant.text = displayText || '生成中'
                    } else {
                        assistant.text = assistant.text === '生成中' ? delta : `${assistant.text}${delta}`
                    }
                    scrollDrawToLatest()
                } else if (event === 'task') {
                    const taskStatus = String(data?.task?.status || '')
                    if (taskStatus === 'failed') {
                        assistant.loading = false
                        assistant.text = String(data?.task?.error_msg || data?.task?.error || data?.message || '生成失败，请稍后重试')
                        assistant.status = '失败'
                    } else {
                    assistant.loading = true
                    assistant.text = '生成中'
                    assistant.status = ''
                    }
                    const taskId = String(data?.task?.task_id || '')
                    if (taskId) {
                        currentGenerationTaskId.value = taskId
                    }
                    if (generationMode.value === 'image_edit' && imageEditSession.value && taskId) {
                        imageEditSession.value.taskId = taskId
                    }
                    await refreshAll(true)
                    syncAssistantFromImageEditTask()
                    scrollDrawToLatest()
                } else if (event === 'asset') {
                    assistant.loading = false
                    assistant.text = generationMode.value === 'video_generate' ? '视频已生成' : '图片已生成'
                    assistant.status = ''
                    const firstAsset = Array.isArray(data?.assets) ? data.assets[0] : null
                    const taskId = String(firstAsset?.task_id || data?.task?.task_id || imageEditSession.value?.taskId || '')
                    if (taskId) {
                        currentGenerationTaskId.value = taskId
                    }
                    if (generationMode.value === 'image_edit' && imageEditSession.value && taskId) {
                        imageEditSession.value.taskId = taskId
                    }
                    await refreshAll(true)
                    syncPanelResultPreview()
                    syncAssistantFromImageEditTask()
                    scrollDrawToLatest()
                } else if (event === 'done') {
                    assistant.loading = false
                    await refreshAll(true)
                    syncPanelResultPreview()
                    syncAssistantFromImageEditTask()
                    if (assistant.status !== '失败' && generationMode.value === 'video_generate') {
                        assistant.loading = true
                        assistant.text = '生成中'
                        assistant.status = ''
                    } else if (assistant.status !== '失败' && !latestPanelResultUrl.value && !isActiveStatus(currentImageEditTask.value?.status || '')) {
                        assistant.text = '生成中'
                        assistant.status = ''
                    }
                } else if (event === 'error') {
                    assistant.loading = false
                    assistant.text = data?.message || '生成失败，请稍后重试'
                    assistant.status = '失败'
                }
            },
            onError: (error) => {
                assistant.loading = false
                assistant.text = error.message || '生成失败，请稍后重试'
                assistant.status = '失败'
            }
        })
        composerText.value = ''
        setComposerEditorText('')
        clearMentionSelections()
    } catch (error: any) {
        assistant.loading = false
        assistant.text = error?.msg || error?.message || '生成任务提交失败'
        assistant.status = '失败'
    } finally {
        submittingGeneration.value = false
        schedulePolling()
    }
}
const syncPanelResultPreview = () => {
    nextTick(async () => {
        const asset = latestPanelResultAsset.value
        if (asset?.id) {
            syncAssistantFromImageEditTask()
        }
    })
}
const buildGenerationPayload = (messageText: string, uploadedTailAsset?: AssetItem) => {
    const shot = activeShot.value
    const currentImageId = activeImageAsset.value?.id || 0
    const isVideoMode = generationMode.value === 'video_generate'
    const visiblePromptText = activeVisiblePromptForSubmit(generationMode.value, shot)
    const cleanMessageText = isVideoMode
        ? normalizeVideoPromptForShot(messageText || visiblePromptText, shot)
        : cleanVisiblePromptForShot(messageText || (generationMode.value === 'image_generate' ? visiblePromptText : ''), shot)
    const sourceImageContext = generationMode.value === 'image_edit'
        ? imageEditReferenceContext(activeImageAsset.value, shot)
        : null
    const cleanShotImagePrompt = generationMode.value === 'image_generate'
        ? cleanVisibleImagePrompt(cleanMessageText || visiblePromptText)
        : (generationMode.value === 'image_edit'
            ? imageEditProviderPrompt(cleanMessageText, sourceImageContext, shot)
            : '')
    const payloadVisiblePrompt = generationMode.value === 'image_edit'
        ? cleanMessageText
        : (cleanMessageText || cleanShotImagePrompt)
    const mentionAssetIds = ['image_generate', 'video_generate'].includes(generationMode.value) ? selectedMentionReferenceAssetIds() : []
    const tailId = uploadedTailAsset?.id || lastFrameAssetId.value
    const firstFrameId = frameOrderSwapped.value ? tailId : currentImageId
    const lastFrameId = frameOrderSwapped.value ? currentImageId : tailId
    const budget = isVideoMode ? buildVideoReferenceBudget(shot, firstFrameId, lastFrameId) : null
    const submittedReferenceIds = budget?.submittedIds || []
    const selectedSubjectIdsForPayload = isVideoMode ? videoSubjectIdsForShot(shot) : selectedSubjectIds.value
    const selectedSceneIdsForPayload = isVideoMode ? videoSceneIdsForShot(shot) : selectedSceneIds.value
    const mentionPayload = ['image_generate', 'video_generate'].includes(generationMode.value)
        ? selectedMentionPayload.value
        : []
    const mentionPrompts = mentionPayload.map((item: any) => cleanUserVisiblePrompt(item.prompt)).filter(Boolean)
    const inputAssetIds: number[] = []
    if (generationMode.value === 'image_edit' && currentImageId) inputAssetIds.push(currentImageId)
    if (generationMode.value === 'image_generate') inputAssetIds.push(...mentionAssetIds)
    if (isVideoMode) inputAssetIds.push(...submittedReferenceIds)
    const normalizedInputAssetIds = Array.from(new Set(inputAssetIds.filter(Boolean)))
    const selectedModelValue = activeGenerationModel.value?.value
        || (isVideoMode ? selectedVideoModelId.value : selectedModelId.value)
    const generationResolution = activeGenerationResolutionOptions.value.some((item) => item.value === selectedGenerationResolution.value)
        ? selectedGenerationResolution.value
        : ''
    const requestedVideoDuration = Number(shot?.duration || selectedVideoDuration.value || 0)
    const generationDuration = isVideoMode ? closestVideoDurationForModel(activeVideoModel.value, generationResolution, requestedVideoDuration, selectedVideoMode.value) : 0
    const referenceAssetIds = generationMode.value === 'image_edit'
        ? normalizedInputAssetIds
        : (isVideoMode
            ? submittedReferenceIds.filter((id) => id !== firstFrameId && id !== lastFrameId)
            : (generationMode.value === 'image_generate' ? Array.from(new Set(mentionAssetIds.filter(Boolean))) : []))
    const marketSelection = isVideoMode
        ? marketVideoSelection(
            activeVideoModel.value,
            generationResolution,
            generationDuration,
                submittedReferenceIds.some((id) => assets.value.find((asset) => asset.id === id)?.asset_type === 'shot_video')
                    ? 'video_edit'
                    : (submittedReferenceIds.length ? 'image_reference' : 'text_to_video'),
                selectedVideoMode.value
        )
        : {}
    return {
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        shot_id: shot?.id || '',
        task_type: isVideoMode ? 'shot_video' : 'shot_image',
        mode: generationMode.value,
        message: cleanMessageText,
        model_id: selectedModelValue,
        resolution: generationResolution,
        quality: generationResolution,
        duration: generationDuration,
        video_mode: isVideoMode ? selectedVideoMode.value : '',
        ...marketSelection,
        input_asset_ids: normalizedInputAssetIds,
        reference_asset_ids: referenceAssetIds,
        first_frame_asset_id: isVideoMode ? firstFrameId : 0,
        last_frame_asset_id: isVideoMode ? lastFrameId : 0,
        scene_ref_id: shot?.scene_ref_id || '',
        subject_ref_ids: shot?.subject_ref_ids || [],
        selected_subject_ids: ['image_generate', 'video_generate'].includes(generationMode.value) ? selectedSubjectIdsForPayload : [],
        selected_scene_ids: ['image_generate', 'video_generate'].includes(generationMode.value) ? selectedSceneIdsForPayload : [],
        selected_mentions: mentionPayload,
        mention_prompts: mentionPrompts,
        image_prompt: cleanShotImagePrompt,
        video_prompt: isVideoMode ? cleanMessageText || shotVideoPromptText(shot) : '',
        visible_prompt: payloadVisiblePrompt,
        source_image_context: sourceImageContext,
        source_asset_id: sourceImageContext?.asset_id || 0,
        source_asset_prompt: sourceImageContext?.prompt || '',
        params: {
            source: 'pc_storyboard_step',
            mode: generationMode.value,
            message: cleanMessageText,
            model_id: selectedModelValue,
            video_model_id: isVideoMode ? selectedModelValue : '',
            resolution: generationResolution,
            quality: generationResolution,
            duration: generationDuration,
            video_mode: isVideoMode ? selectedVideoMode.value : '',
            ...marketSelection,
            input_asset_ids: normalizedInputAssetIds,
            reference_asset_ids: referenceAssetIds,
            first_frame_asset_id: isVideoMode ? firstFrameId : 0,
            last_frame_asset_id: isVideoMode ? lastFrameId : 0,
            scene_ref_id: shot?.scene_ref_id || '',
            subject_ref_ids: shot?.subject_ref_ids || [],
            selected_subject_ids: ['image_generate', 'video_generate'].includes(generationMode.value) ? selectedSubjectIdsForPayload : [],
            selected_scene_ids: ['image_generate', 'video_generate'].includes(generationMode.value) ? selectedSceneIdsForPayload : [],
            selected_mentions: mentionPayload,
            mention_prompts: mentionPrompts,
            image_prompt: cleanShotImagePrompt,
            visible_prompt: payloadVisiblePrompt,
            video_prompt: isVideoMode ? cleanMessageText || shotVideoPromptText(shot) : '',
            source_image_context: sourceImageContext,
            source_asset_id: sourceImageContext?.asset_id || 0,
            source_asset_prompt: sourceImageContext?.prompt || ''
        }
    }
}

const preflightShotVideoGenerations = async (payloads: Record<string, any>[]) => {
    if (!payloads.length) return
    const estimates = await Promise.all(payloads.map((payload) => estimateShortDramaGeneration(payload)))
    const messages = Array.from(new Set(estimates
        .map((estimate: any) => String(estimate?.effective_video_params?.fallback_message || '').trim())
        .filter(Boolean)))
    if (!messages.length) return
    const affectedCount = estimates.filter((estimate: any) => !!estimate?.effective_video_params?.ratio_fallback).length
    const prefix = payloads.length > 1
        ? `本次有 ${affectedCount} 个分镜将自动调整视频比例：`
        : ''
    feedback.msgWarning(`${prefix}${messages.join('；')}`)
}

const handleTimelineWheel = (event: WheelEvent) => {
    const target = event.currentTarget as HTMLElement | null
    if (!target || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    target.scrollLeft += event.deltaY
}
const handleVerticalRailWheel = (event: WheelEvent) => {
    const target = event.currentTarget as HTMLElement | null
    if (!target) return
    event.preventDefault()
    target.scrollTop += event.deltaY
}
const hydrateBgmPrompt = () => {
    if (bgmPromptDirty.value || draftBgmPrompt.value || savedBgmPrompt.value) return
    const prompt = fallbackBgmPrompt.value
    draftBgmPrompt.value = prompt
    savedBgmPrompt.value = prompt
}
const createBgmPayload = (force = false) => ({
    project_id: projectId.value,
    task_id: scriptTaskId.value,
    task_type: 'bgm_audio',
    music_prompt: effectiveBgmPrompt.value,
    duration_seconds: Number(musicPlan.value?.duration_seconds || 0),
    force,
    params: {
        source: 'pc_storyboard_step',
        music_prompt: effectiveBgmPrompt.value,
        music_plan: musicPlan.value,
        duration_seconds: Number(musicPlan.value?.duration_seconds || 0)
    }
})
const updateBgmEstimate = async () => {
    const prompt = effectiveBgmPrompt.value
    if (!prompt) {
        bgmEstimateInfo.value = {}
        return
    }
    estimatingBgm.value = true
    try {
        bgmEstimateInfo.value = await estimateShortDramaGeneration(createBgmPayload(true))
    } catch {
        bgmEstimateInfo.value = {}
    } finally {
        estimatingBgm.value = false
    }
}
const scheduleBgmEstimate = () => {
    if (bgmEstimateTimer) clearTimeout(bgmEstimateTimer)
    bgmEstimateTimer = setTimeout(() => {
        updateBgmEstimate()
    }, 400)
}
const submitBgmTask = async (force = false, silent = false) => {
    if (submittingBgm.value || isActiveStatus(bgmStatus.value)) return
    const prompt = effectiveBgmPrompt.value
    if (!prompt) {
        if (!silent) feedback.msgWarning('请先选择分镜图')
        return
    }
    if (!force && bgmAsset.value) return
    submittingBgm.value = true
    try {
        savedBgmPrompt.value = prompt
        draftBgmPrompt.value = prompt
        bgmPromptDirty.value = false
        await createShortDramaGeneration(createBgmPayload(force))
        if (!silent) feedback.msgSuccess('背景音乐生成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        if (!silent) feedback.msgError(error?.msg || error?.message || '背景音乐生成失败')
    } finally {
        submittingBgm.value = false
    }
}
const retryBgmTask = async () => {
    if (submittingBgm.value || isActiveStatus(bgmStatus.value)) return
    retryingBgm.value = true
    try {
        await submitBgmTask(true)
    } finally {
        retryingBgm.value = false
    }
}
const saveBgmPrompt = () => {
    const prompt = draftBgmPrompt.value.trim()
    if (!prompt) {
        feedback.msgWarning('请先选择分镜图')
        return
    }
    savedBgmPrompt.value = prompt
    bgmPromptDirty.value = false
    feedback.msgSuccess('背景音乐提示词已保存')
}
const selectBgmRecord = (record: MusicHistoryRecord) => {
    if (!record.asset?.id || !record.asset?.url) return
    pendingBgmAssetId.value = record.asset.id
}
const applySelectedBgm = () => {
    const asset = selectedBgmAsset.value
    if (!asset?.id) {
        feedback.msgWarning('请选择背景音乐')
        return
    }
    appliedBgmAssetId.value = asset.id
    if (timelinePlaying.value) {
        syncTimelineBgm(true)
    }
    feedback.msgSuccess('背景音乐已应用')
}
const isDeletingBgmRecord = (record: MusicHistoryRecord) => {
    const assetId = Number(record.asset?.id || 0)
    if (assetId > 0 && deletingBgmAssetIds.value.includes(assetId)) return true
    return deletingBgmTaskIds.value.includes(record.id)
}
const downloadBgmRecord = async (record: MusicHistoryRecord) => {
    if (record.status !== 'success' || !record.asset?.url) return
    await downloadExportAsset(record.asset, 'short-drama-bgm.mp3')
}
const deleteBgmRecord = async (record: MusicHistoryRecord) => {
    const asset = record.asset
    const assetId = Number(asset?.id || 0)
    const taskId = record.id
    if (assetId <= 0 && !taskId) return
    try {
        await ElMessageBox.confirm('确定删除这条背景音乐吗？', '删除背景音乐', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })
    } catch {
        return
    }
    if (isDeletingBgmRecord(record)) return
    if (assetId > 0) {
        deletingBgmAssetIds.value = [...deletingBgmAssetIds.value, assetId]
    } else {
        deletingBgmTaskIds.value = [...deletingBgmTaskIds.value, taskId]
    }
    try {
        if (assetId > 0) {
            await deleteShortDramaAsset({
                project_id: projectId.value,
                id: assetId,
                asset_type: 'bgm_audio'
            })
            if (activeBgmPlaybackUrl.value === asset?.url) cleanupAudio()
            assets.value = assets.value.filter((item) => item.id !== assetId)
            if (appliedBgmAssetId.value === assetId) appliedBgmAssetId.value = 0
            if (pendingBgmAssetId.value === assetId) pendingBgmAssetId.value = 0
        } else {
            await deleteShortDramaGeneration({ task_id: taskId })
            tasks.value = tasks.value.filter((item) => item.task_id !== taskId)
        }
        feedback.msgSuccess('删除成功')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '删除背景音乐失败')
    } finally {
        if (assetId > 0) {
            deletingBgmAssetIds.value = deletingBgmAssetIds.value.filter((id) => id !== assetId)
        } else {
            deletingBgmTaskIds.value = deletingBgmTaskIds.value.filter((id) => id !== taskId)
        }
    }
}
const cleanupAudio = () => {
    if (!audioPlayer) return
    audioPlayer.pause()
    audioPlayer.src = ''
    audioPlayer = null
    bgmPlaying.value = false
    bgmCurrentTime.value = 0
    activeBgmPlaybackUrl.value = ''
    bgmPlaybackSource.value = ''
}
const ensureAudioPlayer = (asset: AssetItem) => {
    if (!asset?.url) return
    if (!audioPlayer || activeBgmPlaybackUrl.value !== asset.url) {
        cleanupAudio()
        audioPlayer = new Audio(asset.url)
        activeBgmPlaybackUrl.value = asset.url
        audioPlayer.addEventListener('loadedmetadata', () => {
            bgmDuration.value = Math.floor(audioPlayer?.duration || 0)
        })
        audioPlayer.addEventListener('timeupdate', () => {
            bgmCurrentTime.value = Math.floor(audioPlayer?.currentTime || 0)
        })
        audioPlayer.addEventListener('ended', () => {
            bgmPlaying.value = false
            bgmPlaybackSource.value = ''
            bgmCurrentTime.value = 0
        })
        audioPlayer.addEventListener('pause', () => {
            bgmPlaying.value = false
        })
        audioPlayer.addEventListener('play', () => {
            bgmPlaying.value = true
        })
    }
}
const seekBgmAudio = (seconds: number) => {
    if (!audioPlayer) return
    const duration = Number(audioPlayer.duration || bgmDuration.value || 0)
    if (!Number.isFinite(duration) || duration <= 0) return
    audioPlayer.currentTime = Math.min(duration - 0.1, Math.max(0, seconds % duration))
}
const playBgmAudio = async (asset: AssetItem | null, source: 'manual' | 'timeline', offsetSeconds = 0, loop = false) => {
    if (!asset?.url) return
    ensureAudioPlayer(asset)
    if (!audioPlayer) return
    audioPlayer.loop = loop
    audioPlayer.volume = 0.18
    bgmPlaybackSource.value = source
    if (offsetSeconds > 0) {
        if (Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
            seekBgmAudio(offsetSeconds)
        } else {
            audioPlayer.addEventListener('loadedmetadata', () => seekBgmAudio(offsetSeconds), { once: true })
        }
    }
    try {
        await audioPlayer.play()
    } catch {
        bgmPlaybackSource.value = ''
        feedback.msgError('播放失败')
    }
}
const pauseBgmAudio = (source?: 'manual' | 'timeline') => {
    if (source && bgmPlaybackSource.value !== source) return
    if (audioPlayer) {
        audioPlayer.pause()
    }
    bgmPlaybackSource.value = ''
}
const toggleBgmPlayback = (asset: AssetItem | null = bgmAsset.value) => {
    if (!asset?.url) return
    if (bgmPlaying.value && activeBgmPlaybackUrl.value === asset.url) {
        pauseBgmAudio()
        return
    }
    playBgmAudio(asset, 'manual')
}
const seekBgmRecord = (record: MusicHistoryRecord, event: MouseEvent) => {
    const asset = record.asset
    if (!asset?.url || record.duration <= 0) return
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)))
    selectBgmRecord(record)
    playBgmAudio(asset, 'manual', record.duration * percent)
}
const toggleBgmExportEnabled = () => {
    if (!bgmAsset.value) return
    bgmExportEnabled.value = !bgmExportEnabled.value
    if (!bgmExportEnabled.value) {
        pauseBgmAudio('timeline')
    } else if (timelinePlaying.value) {
        syncTimelineBgm(true)
    }
}
const syncTimelineBgm = (force = false) => {
    if (!timelinePlaying.value || !bgmExportEnabled.value || !bgmAsset.value) {
        pauseBgmAudio('timeline')
        return
    }
    if (!force && bgmPlaybackSource.value === 'timeline' && bgmPlaying.value) return
    playBgmAudio(bgmAsset.value, 'timeline', timelineElapsedSeconds.value, true)
}
const playTimelineAt = async (index: number, startPercent = 0) => {
    const items = timelineShots.value
    if (!items.length) {
        stopTimelinePlayback()
        return
    }
    if (index >= items.length) {
        stopTimelinePlayback()
        timelineProgressPercent.value = 100
        return
    }
    const currentIndex = Math.max(0, index)
    const shot = items[currentIndex]
    const targetAsset = displayTimelineAssetForShot(shot.id)
    timelineCurrentIndex = currentIndex
    activeShotId.value = shot.id
    activePreviewAssetId.value = targetAsset?.id || 0
    let durationMs = Math.max(1000, (Number(shot.duration) || 3) * 1000)
    clearTimelinePlaybackTimers()
    timelineProgressShotId.value = shot.id
    timelineProgressPercent.value = Math.min(100, Math.max(0, startPercent))
    timelineCurrentDurationMs = durationMs
    const scheduleTimelineAdvance = (delayMs: number) => {
        if (timelineTimer) clearTimeout(timelineTimer)
        timelineTimer = setTimeout(() => {
            if (!timelinePlaying.value || timelineSeeking.value || timelineCurrentIndex !== currentIndex) return
            advanceTimelineToNext()
        }, Math.max(300, delayMs))
    }
    await nextTick()
    const video = targetAsset?.asset_type === 'shot_video' ? previewVideoRef.value : null
    if (video) {
        const syncVideoDuration = () => {
            if (Number.isFinite(video.duration) && video.duration > 0) {
                durationMs = Math.max(1000, video.duration * 1000)
                timelineCurrentDurationMs = durationMs
                const startRatio = Math.min(0.998, Math.max(0, timelineProgressPercent.value / 100))
                video.currentTime = Math.min(Math.max(0, video.duration - 0.05), Math.max(0, video.duration * startRatio))
                timelineStartedAt = Date.now() - durationMs * startRatio
                scheduleTimelineAdvance(durationMs * (1 - startRatio) + 600)
            }
        }
        if (Number.isFinite(video.duration) && video.duration > 0) {
            syncVideoDuration()
        } else {
            video.addEventListener('loadedmetadata', syncVideoDuration, { once: true })
            scheduleTimelineAdvance(durationMs + 1200)
        }
        video.play().catch(() => scheduleTimelineAdvance(durationMs + 600))
    }
    timelineCurrentDurationMs = durationMs
    timelineStartedAt = Date.now() - durationMs * (timelineProgressPercent.value / 100)
    syncTimelineBgm()
    timelineProgressTimer = setInterval(() => {
        if (timelineSeeking.value) return
        if (video && Number.isFinite(video.duration) && video.duration > 0) {
            timelineProgressPercent.value = Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100))
            if (video.ended || video.duration - video.currentTime <= 0.12) {
                advanceTimelineToNext()
            }
            return
        }
        const elapsed = Date.now() - timelineStartedAt
        timelineProgressPercent.value = Math.min(100, Math.max(0, (elapsed / timelineCurrentDurationMs) * 100))
    }, 80)
    if (!video) {
        timelineTimer = setTimeout(() => {
            if (!timelinePlaying.value || timelineCurrentIndex !== currentIndex) return
            advanceTimelineToNext()
        }, durationMs)
    }
}
const handlePreviewVideoEnded = () => {
    if (!timelinePlaying.value || activePreviewAsset.value?.asset_type !== 'shot_video') return
    advanceTimelineToNext()
}
const handlePreviewVideoTimeUpdate = () => {
    const video = previewVideoRef.value
    if (!timelinePlaying.value || !video || !Number.isFinite(video.duration) || video.duration <= 0) return
    timelineProgressPercent.value = Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100))
    if (video.ended || video.duration - video.currentTime <= 0.12) {
        advanceTimelineToNext()
    }
}
const handlePreviewVideoLoadedMetadata = () => {
    const video = previewVideoRef.value
    if (!timelinePlaying.value || !video || !Number.isFinite(video.duration) || video.duration <= 0) return
    timelineCurrentDurationMs = Math.max(1000, video.duration * 1000)
}
const handlePreviewVideoError = () => {
    if (!timelinePlaying.value || activePreviewAsset.value?.asset_type !== 'shot_video') return
    advanceTimelineToNext()
}
const seekPreviewVideoToPercent = async (percent: number) => {
    await nextTick()
    const video = activePreviewAsset.value?.asset_type === 'shot_video' ? previewVideoRef.value : null
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return
    const ratio = Math.min(0.998, Math.max(0, percent / 100))
    video.currentTime = Math.min(Math.max(0, video.duration - 0.05), Math.max(0, video.duration * ratio))
}
const resolveTimelineSeekTarget = (event: PointerEvent) => {
    const strip = shotStripRef.value
    if (!strip) return null
    const thumbs = Array.from(strip.querySelectorAll<HTMLElement>('.shot-thumb'))
    if (!thumbs.length) return null
    let targetThumb: HTMLElement | null = null
    let targetIndex = -1
    for (const [index, thumb] of thumbs.entries()) {
        const rect = thumb.getBoundingClientRect()
        if (event.clientX >= rect.left && event.clientX <= rect.right) {
            targetThumb = thumb
            targetIndex = index
            break
        }
    }
    if (!targetThumb) {
        targetIndex = event.clientX < thumbs[0].getBoundingClientRect().left ? 0 : thumbs.length - 1
        targetThumb = thumbs[targetIndex]
    }
    const shot = timelineShots.value[targetIndex]
    if (!shot) return null
    return { shot, thumb: targetThumb, index: targetIndex }
}
const updateTimelineSeekFromEvent = (event: PointerEvent) => {
    const target = resolveTimelineSeekTarget(event)
    if (!target) return 0
    const { shot, thumb } = target
    const rect = thumb.getBoundingClientRect()
    const percent = Math.min(100, Math.max(0, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100))
    activeShotId.value = shot.id
    activePreviewAssetId.value = activeDisplayTimelineAssetId(shot.id)
    timelineProgressShotId.value = shot.id
    timelineProgressPercent.value = percent
    seekPreviewVideoToPercent(percent)
    return percent
}
const startTimelineGlobalSeek = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('button')) return
    const initialTarget = resolveTimelineSeekTarget(event)
    if (!initialTarget) return
    const wasPlaying = timelinePlaying.value
    timelineSeeking.value = true
    if (timelineTimer) clearTimeout(timelineTimer)
    if (timelineProgressTimer) clearInterval(timelineProgressTimer)
    previewVideoRef.value?.pause()
    pauseBgmAudio('timeline')
    updateTimelineSeekFromEvent(event)
    const move = (moveEvent: PointerEvent) => updateTimelineSeekFromEvent(moveEvent)
    const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        timelineSeeking.value = false
        if (wasPlaying) {
            const shotIndex = Math.max(0, timelineShots.value.findIndex((item) => item.id === activeShotId.value))
            timelinePlaying.value = true
            playTimelineAt(shotIndex, timelineProgressPercent.value)
        } else {
            timelinePlaying.value = false
        }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
}
const toggleTimelinePlayback = () => {
    if (timelinePlaying.value) {
        stopTimelinePlayback()
        return
    }
    if (!timelineShots.value.length) {
        feedback.msgWarning('请选择分镜')
        return
    }
    timelinePlaying.value = true
    const activeIndex = timelineShots.value.findIndex((shot) => shot.id === activeShotId.value)
    const atTimelineEnd = activeIndex >= timelineShots.value.length - 1 && timelineProgressPercent.value >= 99
    const startIndex = atTimelineEnd ? 0 : Math.max(0, activeIndex)
    playTimelineAt(startIndex, atTimelineEnd ? 0 : timelineProgressPercent.value)
}
const buildShotImageTaskPayload = (shot: ShotItem, batch = false) => {
    const modelValue = activeImageModel.value?.value || selectedModelId.value
    const imageModelValue = activeImageModel.value?.value || (activeImageModel.value as any)?.channel_code || activeImageModel.value?.id || modelValue || ''
    const resolution = shortDramaResolutionOptions(activeImageModel.value).some((item) => item.value === selectedImageResolution.value)
        ? selectedImageResolution.value
        : ''
    const imageReferenceIds = shotImageReferenceAssetIds(shot, !batch)
    const selectedSubjectIdsForPayload = videoSubjectIdsForShot(shot, !batch)
    const selectedSceneIdsForPayload = videoSceneIdsForShot(shot, !batch)
    const mentionPayload = !batch ? selectedMentionPayload.value : []
    const mentionPrompts = mentionPayload.map((item: any) => cleanUserVisiblePrompt(item.prompt)).filter(Boolean)
    const userPrompt = !batch && shot.id === activeShot.value?.id
        ? activeVisiblePromptForSubmit('image_generate', shot)
        : shotImagePromptText(shot)
    const imagePrompt = cleanVisibleImagePrompt(userPrompt)
    const source = batch ? 'pc_storyboard_batch_image' : 'pc_storyboard_quick_image'
    return {
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        shot_id: shot.id,
        task_type: 'shot_image',
        mode: 'image_generate',
        model_id: imageModelValue,
        image_model_id: imageModelValue,
        channel: imageModelValue,
        channel_code: imageModelValue,
        model_name: activeImageModel.value?.name || '',
        resolution,
        quality: resolution,
        silent_panel: true,
        shot_title: shot.title,
        shot_description: shot.description,
        scene_name: shot.scene_name,
        time_of_day: shot.time_of_day,
        visual_description: shot.visual_description,
        composition: shot.composition,
        shot_type: shot.shot_type,
        angle: shot.angle,
        action: shot.action,
        result: shot.result,
        atmosphere: shot.atmosphere,
        image_prompt: imagePrompt,
        video_prompt: shot.video_prompt,
        scene_ref_id: shot.scene_ref_id,
        subject_ref_ids: shot.subject_ref_ids,
        input_asset_ids: imageReferenceIds,
        reference_asset_ids: imageReferenceIds,
        selected_subject_ids: selectedSubjectIdsForPayload,
        selected_scene_ids: selectedSceneIdsForPayload,
        selected_mentions: mentionPayload,
        mention_prompts: mentionPrompts,
        voice_role: shot.voice_role,
        bgm_prompt: shot.bgm_prompt,
        visible_prompt: imagePrompt,
        params: {
            source,
            batch,
            silent_panel: true,
            mode: 'image_generate',
            model_id: imageModelValue,
            image_model_id: imageModelValue,
            channel: imageModelValue,
            channel_code: imageModelValue,
            model_name: activeImageModel.value?.name || '',
            resolution,
            quality: resolution,
            shot_id: shot.id,
            shot_title: shot.title,
            shot_description: shot.description,
            scene_name: shot.scene_name,
            time_of_day: shot.time_of_day,
            visual_description: shot.visual_description,
            composition: shot.composition,
            shot_type: shot.shot_type,
            angle: shot.angle,
            action: shot.action,
            result: shot.result,
            atmosphere: shot.atmosphere,
            image_prompt: imagePrompt,
            video_prompt: shot.video_prompt,
            scene_ref_id: shot.scene_ref_id,
            subject_ref_ids: shot.subject_ref_ids,
            input_asset_ids: imageReferenceIds,
            reference_asset_ids: imageReferenceIds,
            selected_subject_ids: selectedSubjectIdsForPayload,
            selected_scene_ids: selectedSceneIdsForPayload,
            selected_mentions: mentionPayload,
            mention_prompts: mentionPrompts,
            voice_role: shot.voice_role,
            bgm_prompt: shot.bgm_prompt,
            visible_prompt: imagePrompt
        }
    }
}
const shouldCreateShotImageTask = (shot: ShotItem) => {
    if (!shot?.id) return false
    if (latestAssetForShot(shot.id, 'shot_image')) return false
    if (hasSubmittedShotTask(shot.id, 'shot_image')) return false
    const task = latestTaskForShot(shot.id, 'shot_image')
    return !task || task.status === 'failed' || task.status === 'canceled'
}
const hasShotImageResult = (shotId: string) => {
    return Boolean(selectedAssetForShot(shotId, 'shot_image') || latestAssetForShot(shotId, 'shot_image') || hasSubmittedShotTask(shotId, 'shot_image'))
}
const hasShotVideoResult = (shotId: string) => {
    return Boolean(selectedAssetForShot(shotId, 'shot_video') || latestAssetForShot(shotId, 'shot_video') || hasSubmittedShotTask(shotId, 'shot_video'))
}
const shouldCreateBatchShotImageTask = (shot: ShotItem) => {
    if (!shot?.id) return false
    if (hasShotImageResult(shot.id) || hasShotVideoResult(shot.id)) return false
    const task = latestTaskForShot(shot.id, 'shot_image')
    return !task || task.status === 'failed' || task.status === 'canceled'
}
const imageSkuForResolution = (model: ModelOption | null | undefined, resolution = '') => {
    const selected = String(resolution || '').trim()
    const sources = Array.isArray(model?.skus) ? model.skus : []
    if (!selected) return sources.find((item) => item?.tenant_unit_price !== undefined) || null
    return sources.find((item) => String(item?.quality || item?.resolution || '') === selected && item?.tenant_unit_price !== undefined) || null
}
const imageModelUnitPrice = (model: ModelOption | null | undefined, resolution = '') => {
    const sku = imageSkuForResolution(model, resolution)
    const price = Number(sku?.tenant_unit_price ?? model?.tenant_unit_price ?? 0)
    return Number.isFinite(price) && price > 0 ? price : 0
}
const batchShotImageCount = computed(() => shots.value.filter(shouldCreateBatchShotImageTask).length)
const batchShotImageBillingText = computed(() => {
    const model = activeImageModel.value
    if (String(model?.billing_unit || '').toLowerCase().includes('token')) {
        return `${formatComposerPoints(imageModelUnitPrice(model, selectedImageResolution.value))}/百万 Token`
    }
    return `${formatComposerPoints(imageModelUnitPrice(model, selectedImageResolution.value) * batchShotImageCount.value)} 点`
})
const generateActiveShotImage = async () => {
    if (generatingActiveShotImageTask.value || activeShotImageBusy.value) return
    const shot = activeShot.value
    if (!shot?.id) {
        feedback.msgWarning('请选择模型')
        return
    }
    if (!shouldCreateShotImageTask(shot)) {
        feedback.msgSuccess('没有未生成分镜图，已进入查看分镜图')
        return
    }
    generatingActiveShotImageTask.value = true
    try {
        await saveProjectGenerationSettingsNow().catch(() => {})
        const result = await createShortDramaGeneration(buildShotImageTaskPayload(shot))
        rememberSubmittedGenerationTask(result, shot.id)
        feedback.msgSuccess('分镜图生成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '分镜图生成失败')
    } finally {
        generatingActiveShotImageTask.value = false
        schedulePolling()
    }
}
const generateShotImages = async () => {
    if (generatingShotImages.value) return
    const sourceShots = shots.value.filter((shot) => shot.id)
    if (!sourceShots.length) {
        feedback.msgWarning('请选择分镜')
        return
    }
    generatingShotImages.value = true
    try {
        await Promise.all([loadTasks(), loadAssets()])
    } catch (error: any) {
        generatingShotImages.value = false
        feedback.msgError(error?.msg || error?.message || '状态刷新失败')
        return
    }
    const pendingShots = sourceShots.filter(shouldCreateBatchShotImageTask)
    if (!pendingShots.length) {
        generatingShotImages.value = false
        feedback.msgSuccess('没有未生成分镜图，已进入查看分镜图')
        return
    }
    generatingShotImages.value = true
    try {
        await saveProjectGenerationSettingsNow().catch(() => {})
        const results = await Promise.all(pendingShots.map((shot) => createShortDramaGeneration(buildShotImageTaskPayload(shot, true))))
        results.forEach((result, index) => rememberSubmittedGenerationTask(result, pendingShots[index]?.id || ''))
        feedback.msgSuccess('分镜图生成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '分镜图生成失败')
    } finally {
        generatingShotImages.value = false
        schedulePolling()
    }
}
const openBatchVideoDialog = () => {
    if (generatingVideos.value) return
    batchVideoModelMenuOpen.value = false
    batchVideoModelId.value = activeVideoModel.value?.value || selectedVideoModelId.value || videoModelOptions.value[0]?.value || videoModelOptions.value[0]?.id || ''
    if (!batchVideoModelId.value) {
        feedback.msgWarning('暂无可用视频模型')
        return
    }
    const optionValues = batchVideoResolutionOptions.value.map((item) => item.value)
    if (!optionValues.includes(batchVideoResolution.value)) {
        batchVideoResolution.value = resolveShortDramaResolution(batchVideoModel.value, batchVideoResolution.value)
    }
    batchVideoMode.value = resolveVideoMode(batchVideoModel.value, selectedVideoMode.value)
    const durations = batchVideoDurationOptions.value
    if (!durations.some((item) => item.value === batchVideoDuration.value)) batchVideoDuration.value = durations[0]?.value || 0
    if (!batchVideoShotCount.value) {
        feedback.msgWarning('暂无需要转视频的分镜')
        return
    }
    batchVideoDialogVisible.value = true
}
const closeBatchVideoDialog = () => {
    if (generatingVideos.value) return
    batchVideoModelMenuOpen.value = false
    batchVideoDialogVisible.value = false
}
const generateShotVideos = async () => {
    if (generatingVideos.value) return
    const sourceShots = batchVideoSourceShots.value
    if (!sourceShots.length) {
        feedback.msgWarning('暂无需要转视频的分镜')
        return
    }
    generatingVideos.value = true
    try {
        const videoModelValue = batchVideoModel.value?.value || batchVideoModelId.value || activeVideoModel.value?.value || selectedVideoModelId.value
        selectedVideoModelId.value = videoModelValue
        const resolution = batchVideoResolutionOptions.value.some((item) => item.value === batchVideoResolution.value)
            ? batchVideoResolution.value
            : ''
        const duration = batchVideoDurationOptions.value.some((item) => item.value === batchVideoDuration.value)
            ? batchVideoDuration.value
            : 0
        selectedVideoResolution.value = resolution || selectedVideoResolution.value
        selectedVideoDuration.value = duration || selectedVideoDuration.value
        selectedVideoMode.value = batchVideoMode.value
        await saveProjectGenerationSettingsNow().catch(() => {})
        const payloads = sourceShots.map(({ shot, firstFrameAssetId }) => {
            const videoPrompt = shotVideoPromptText(shot)
            const shotDuration = closestVideoDurationForModel(batchVideoModel.value, resolution, Number(shot.duration || duration || 0), batchVideoMode.value)
            const budget = buildVideoReferenceBudget(shot, firstFrameAssetId, 0, batchVideoModel.value, false)
            const submittedReferenceIds = budget.submittedIds
            const referenceAssetIds = submittedReferenceIds.filter((id) => id !== firstFrameAssetId)
            const selectedSubjectIdsForPayload = videoSubjectIdsForShot(shot, false)
            const selectedSceneIdsForPayload = videoSceneIdsForShot(shot, false)
            const marketSelection = marketVideoSelection(
                batchVideoModel.value,
                resolution,
                shotDuration,
                submittedReferenceIds.some((id) => assets.value.find((asset) => asset.id === id)?.asset_type === 'shot_video')
                    ? 'video_edit'
                    : 'image_reference',
                batchVideoMode.value
            )
            return {
                project_id: projectId.value,
                task_id: scriptTaskId.value,
                shot_id: shot.id,
                task_type: 'shot_video',
                mode: 'video_generate',
                model_id: videoModelValue,
                resolution,
                quality: resolution,
                duration: shotDuration,
                video_mode: batchVideoMode.value,
                ...marketSelection,
                video_prompt: videoPrompt,
                visible_prompt: videoPrompt,
                input_asset_ids: submittedReferenceIds,
                reference_asset_ids: referenceAssetIds,
                first_frame_asset_id: firstFrameAssetId,
                scene_ref_id: shot.scene_ref_id,
                subject_ref_ids: shot.subject_ref_ids,
                selected_subject_ids: selectedSubjectIdsForPayload,
                selected_scene_ids: selectedSceneIdsForPayload,
                params: {
                    source: 'pc_storyboard_step',
                    model_id: videoModelValue,
                    video_model_id: videoModelValue,
                    resolution,
                    quality: resolution,
                    duration: shotDuration,
                    video_mode: batchVideoMode.value,
                    ...marketSelection,
                    video_prompt: videoPrompt,
                    visible_prompt: videoPrompt,
                    input_asset_ids: submittedReferenceIds,
                    reference_asset_ids: referenceAssetIds,
                    first_frame_asset_id: firstFrameAssetId,
                    scene_ref_id: shot.scene_ref_id,
                    subject_ref_ids: shot.subject_ref_ids,
                    selected_subject_ids: selectedSubjectIdsForPayload,
                    selected_scene_ids: selectedSceneIdsForPayload
                }
            }
        })
        await preflightShotVideoGenerations(payloads)
        const results = await Promise.all(payloads.map((payload) => createShortDramaGeneration(payload)))
        results.forEach((result, index) => rememberSubmittedGenerationTask(result, sourceShots[index]?.shot.id || ''))
        batchVideoModelMenuOpen.value = false
        batchVideoDialogVisible.value = false
        const failedResults = results.filter((result: any) => String(result?.status || '') === 'failed')
        if (failedResults.length) {
            const errorMessage = String(failedResults[0]?.error_msg || failedResults[0]?.error || '分镜视频生成失败')
            feedback.msgError(errorMessage)
        } else {
            feedback.msgSuccess('分镜视频生成任务已提交')
        }
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '分镜视频生成失败')
    } finally {
        generatingVideos.value = false
        schedulePolling()
    }
}
type ExportTaskType = 'export_video' | 'export_package'
const stopExportPolling = () => {
    if (exportPollTimer) {
        clearTimeout(exportPollTimer)
        exportPollTimer = null
    }
}
const downloadExportAsset = async (asset: AssetItem | null, fallbackName: string) => {
    if (!asset?.url) return
    const ext = fileExtensionFromUrl(asset.url, fallbackName.includes('.zip') ? 'zip' : 'mp4')
    const baseName = fallbackName.replace(/\.[^.]+$/, '')
    const filename = `${baseName}-${asset.id || Date.now()}.${ext}`.replace(/[\\/:*?"<>|]/g, '_')
    try {
        const response = await fetch(asset.url, { mode: 'cors' })
        if (!response.ok) throw new Error('download failed')
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
    } catch {
        const link = document.createElement('a')
        link.href = asset.url
        link.download = filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        link.remove()
    }
}
const pollExportTask = (taskId: string, type: ExportTaskType) => {
    stopExportPolling()
    exportPollTimer = setTimeout(async () => {
        try {
            const detail: any = await getShortDramaGenerationDetail(taskId)
            const task = normalizeTask(detail)
            if (task) {
                const index = tasks.value.findIndex((item) => item.task_id === task.task_id)
                if (index >= 0) tasks.value.splice(index, 1, task)
                else tasks.value.unshift(task)
            }
            const status = String(detail?.status || task?.status || '')
            if (['success', 'failed', 'canceled'].includes(status)) {
                if (status === 'success') {
                    const output = Array.isArray(detail?.output_assets) ? detail.output_assets : (Array.isArray(detail?.assets) ? detail.assets : [])
                    const asset = normalizeAsset(output[0]) || null
                    if (asset?.url) {
                        if (type === 'export_video') {
                            window.open(asset.url, '_blank', 'noopener')
                        } else {
                            await downloadExportAsset(asset, 'short-drama-shots.zip')
                        }
                        feedback.msgSuccess(type === 'export_package' ? '分镜包已下载' : '完整视频已下载')
                    } else {
                        feedback.msgError('下载失败，请稍后重试')
                    }
                } else {
                    feedback.msgError(detail?.error_msg || detail?.error || '导出失败')
                }
                if (type === 'export_package') exportingPackage.value = false
                else exportingVideo.value = false
                await refreshAll(true)
                return
            }
            pollExportTask(taskId, type)
        } catch (error: any) {
            feedback.msgError(error?.msg || error?.message || '导出任务查询失败')
            if (type === 'export_package') exportingPackage.value = false
            else exportingVideo.value = false
        }
    }, 1800)
}
const submitExportTask = async (type: ExportTaskType) => {
    if (exportBusy.value) return
    if (type === 'export_video' && exportingVideo.value) return
    if (type === 'export_package' && exportingPackage.value) return
    if (type === 'export_package') exportingPackage.value = true
    else exportingVideo.value = true
    exportMenuOpen.value = false
    try {
        const payload = {
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            params: {
                source: 'pc_storyboard_step',
                export_mode: type === 'export_package' ? 'shot_package' : 'full_video',
                watermark_enabled: exportWatermarkEnabled.value,
                bgm_enabled: bgmExportEnabled.value && !!bgmAsset.value,
                bgm_asset_id: bgmAsset.value?.id || 0
            }
        }
        const data: any = type === 'export_package'
            ? await createShortDramaExportPackage(payload)
            : await createShortDramaExportVideo(payload)
        const taskId = rememberSubmittedGenerationTask(data, '')
        feedback.msgSuccess(type === 'export_package' ? '导出分镜任务已提交' : '导出视频任务已提交')
        await refreshAll(true)
        if (taskId) pollExportTask(taskId, type)
        else {
            if (type === 'export_package') exportingPackage.value = false
            else exportingVideo.value = false
        }
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || (type === 'export_package' ? '导出分镜失败' : '导出视频失败'))
        if (type === 'export_package') exportingPackage.value = false
        else exportingVideo.value = false
    }
}
const goPlan = () => router.push({ path: '/ai/short-drama/plan', query: routeQuery.value })
const goSubject = () => router.push({ path: '/ai/short-drama/subject-create', query: routeQuery.value })
const goScene = () => router.push({ path: '/ai/short-drama/scene', query: routeQuery.value })
const renameProjectTitle = async () => {
    if (!projectId.value) {
        feedback.msgError('项目不存在，请重新进入')
        return
    }
    try {
        const { value } = await ElMessageBox.prompt('请输入新的项目名称', '重命名项目', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputValue: projectTitle.value,
            inputPattern: /\S/,
            inputErrorMessage: '名称不能为空'
        })
        const title = String(value || '').trim()
        if (!title || title === projectTitle.value) return
        const project = await renameShortDramaProject({ id: projectId.value, title })
        projectTitle.value = String(project?.title || title)
        feedback.msgSuccess('保存成功')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(error?.msg || error?.message || '重命名失败')
    }
}
const goStep = (key: FlowStepKey) => {
    if (key === 'script') goPlan()
    if (key === 'subject') goSubject()
    if (key === 'scene') goScene()
}
onMounted(() => {
    previousBodyOverflow = document.body.style.overflow
    previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const hasCache = restoreStoryboardCache()
    refreshAll(hasCache)
})
onBeforeUnmount(() => {
    document.body.style.overflow = previousBodyOverflow
    document.documentElement.style.overflow = previousHtmlOverflow
    stopPolling()
    stopExportPolling()
    stopTimelinePlayback()
    if (bgmEstimateTimer) clearTimeout(bgmEstimateTimer)
    if (generationSettingsSaveTimer) clearTimeout(generationSettingsSaveTimer)
    cleanupAudio()
    if (lastFramePreviewLocal.value) URL.revokeObjectURL(lastFramePreviewLocal.value)
})
watch(() => bgmAsset.value?.url, (url) => {
    if (!url) cleanupAudio()
})
watch(bgmAudioAssets, (items) => {
    const hasApplied = items.some((asset) => asset.id === appliedBgmAssetId.value)
    if (!hasApplied) {
        appliedBgmAssetId.value = items[0]?.id || 0
    }
    const hasPending = items.some((asset) => asset.id === pendingBgmAssetId.value)
    if (!hasPending) {
        pendingBgmAssetId.value = appliedBgmAssetId.value || items[0]?.id || 0
    }
}, { immediate: true })
watch(() => [rightTab.value, effectiveBgmPrompt.value, musicPlan.value?.duration_seconds], () => {
    if (rightTab.value !== 'music') return
    scheduleBgmEstimate()
}, { immediate: true })
watch(batchVideoResolutionOptions, (options) => {
    if (!batchVideoDialogVisible.value) return
    const values = options.map((item) => item.value)
    if (!values.includes(batchVideoResolution.value)) {
        batchVideoResolution.value = resolveShortDramaResolution(batchVideoModel.value, batchVideoResolution.value)
    }
})
watch(activeVideoResolutionOptions, (options) => {
    const values = options.map((item) => item.value)
    if (!values.includes(selectedVideoResolution.value)) {
        selectedVideoResolution.value = resolveShortDramaResolution(activeVideoModel.value, selectedVideoResolution.value)
    }
}, { immediate: true })
watch(activeVideoDurationOptions, (options) => {
    if (!options.some((item) => item.value === selectedVideoDuration.value)) {
        selectedVideoDuration.value = options[0]?.value || 0
    }
}, { immediate: true })
watch(() => shortDramaResolutionOptions(activeImageModel.value), (options) => {
    const values = options.map((item) => item.value)
    if (!values.includes(selectedImageResolution.value)) {
        selectedImageResolution.value = resolveShortDramaResolution(activeImageModel.value, selectedImageResolution.value)
    }
}, { immediate: true })
watch(() => latestPanelResultAsset.value?.id, async (id) => {
    if (id) {
        syncAssistantFromImageEditTask()
    }
})
watch(
    () => [latestPanelResultUrl.value, currentImageEditTask.value?.status, currentImageEditTask.value?.progress],
    () => {
        syncAssistantFromImageEditTask()
    }
)
watch(
    () => visibleChatMessages.value.map((message) => `${message.id}:${message.role}:${message.text}:${message.status || ''}:${message.loading ? 1 : 0}`).join('|'),
    () => {
        scrollDrawToLatest()
    }
)
watch(
    () => panelHistoryRecords.value.map((record) => `${record.taskId}:${record.status}:${record.assetId}:${record.assetUrl}`).join('|'),
    () => {
        scrollDrawToLatest(false)
    }
)
watch(
    () => `${projectId.value}:${scriptTaskId.value}`,
    async (_next, prev) => {
        if (!prev) return
        stopPolling()
        suppressShotDraftSave.value = true
        try {
            tasks.value = []
            assets.value = []
            shots.value = []
            subjects.value = []
            scenes.value = []
            composerText.value = ''
            composerDrafts.value = {}
            composerMentionDrafts.value = {}
            visiblePromptDraft.value = ''
            visiblePromptDrafts.value = {}
            selectedSubjectIds.value = []
            selectedSceneIds.value = []
            chatMessages.value = []
            currentGenerationTaskId.value = ''
            lastUserEditText.value = ''
            imageEditSession.value = null
            activeShotId.value = ''
            activePreviewAssetId.value = 0
            clearLastFrame()
            restoredFromCache.value = false
            const hasCache = restoreStoryboardCache()
            await refreshAll(hasCache)
        } finally {
            await nextTick()
            suppressShotDraftSave.value = false
        }
    }
)
watch(() => activeShotId.value, (shotId, oldShotId) => {
    if (suppressShotDraftSave.value) return
    if (oldShotId) saveCurrentComposerDraft(generationMode.value, oldShotId)
    modelMenuOpen.value = false
    modeMenuOpen.value = false
    mentionMenuOpen.value = false
    resolutionMenuOpen.value = false
    lastFrameMenuOpen.value = false
    clearLastFrame()
    nextTick(() => {
        loadComposerDraft(generationMode.value, shotId)
        loadVisiblePromptDraft(generationMode.value, shotId)
    })
})
</script>

<style scoped lang="scss">
.storyboard-page {
    min-width: 1180px;
    height: 100vh;
    overflow: hidden;
    background: #0c0c0d;
    color: #fff;
    font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.storyboard-page,
.storyboard-page * {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.storyboard-page::-webkit-scrollbar,
.storyboard-page *::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

button,
textarea,
select {
    font: inherit;
}

.top-dark-action,
.top-light-action {
    min-width: 128px;
    width: auto;
    height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.56;
    }
}

.top-sync-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 15px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
}

.top-dark-action {
    color: #fff;
    background: #1e1f20;
}

.top-light-action {
    color: #0c0c0d;
    background: #fff;
}

.batch-menu-wrap,
.export-menu-wrap {
    position: relative;
}

.batch-menu-panel,
.export-menu-panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 30;
    width: 196px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    background: rgba(22, 23, 25, 0.96);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
    backdrop-filter: blur(12px);
}

.batch-menu-panel {
    width: 180px;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-4px);
    transition:
        opacity 0.16s ease,
        transform 0.16s ease,
        visibility 0.16s ease;
}

.batch-menu-wrap.is-open .batch-menu-panel,
.batch-menu-wrap:focus-within .batch-menu-panel {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0);
}

.export-watermark-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 34px;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.86);
    font-size: 14px;
}

.export-switch {
    position: relative;
    width: 42px;
    height: 24px;
    border: 0;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.18);
    cursor: pointer;
    transition: background 0.2s ease;

    i {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.2s ease;
    }

    &.is-on {
        background: #ffffff;

        i {
            transform: translateX(18px);
            background: #0c0c0d;
        }
    }
}

.export-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    height: 38px;
    margin-top: 8px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-size: 14px;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.56;
    }
}

.export-menu-btn--primary {
    background: #fff;
    color: #0c0c0d;
}

.storyboard-workspace {
    display: grid;
    grid-template-columns: minmax(720px, 1fr) 428px;
    gap: 20px;
    height: calc(100vh - 72px);
    min-height: 0;
    overflow: hidden;
    margin-top: 72px;
    padding: 10px 24px 16px 60px;
    box-sizing: border-box;
}

.storyboard-stage {
    --storyboard-preview-max-height: calc(100vh - 72px - 226px - clamp(14px, 2vh, 22px) - 48px);
    display: grid;
    grid-template-rows: minmax(0, 1fr) 226px;
    gap: clamp(14px, 2vh, 22px);
    min-width: 0;
    min-height: 0;
    padding-top: clamp(4px, 1vh, 12px);
}

.stage-preview-row {
    --rail-reserve: 84px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 0;
    min-height: 0;
    padding-right: var(--rail-reserve);
    box-sizing: border-box;
}

.preview-shell {
    position: relative;
    align-self: center;
    flex: 0 1 auto;
    width: min(
        1280px,
        100%,
        calc(var(--storyboard-preview-max-height) * var(--storyboard-aspect-width, 16) / var(--storyboard-aspect-height, 9))
    );
    min-width: 0;
    height: auto;
    max-height: min(100%, var(--storyboard-preview-max-height));
    aspect-ratio: var(--storyboard-aspect-ratio, 16 / 9);
    overflow: hidden;
    border-radius: 8px;
    background: transparent;
}

.preview-actions {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    background: rgba(20, 20, 22, 0.72);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    backdrop-filter: blur(12px);
    transition: opacity 0.16s ease, transform 0.16s ease;
}

.preview-shell:hover .preview-actions,
.preview-actions:focus-within {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

.preview-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 26px;
    padding: 0 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;

    span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        color: rgba(255, 255, 255, 0.82);
        font-size: 13px;
        line-height: 1;
    }

    &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.58;
    }
}

.preview-replace-input {
    display: none;
}

.vertical-shot-rail {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 9px;
    width: 60px;
    max-height: min(430px, 100%);
    overflow-y: auto;
    padding-right: 2px;
    scrollbar-width: none;
}

.vertical-shot-rail::-webkit-scrollbar {
    display: none;
}

.rail-thumb {
    position: relative;
    flex: 0 0 58px;
    width: 58px;
    height: 58px;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 0;
    background: #1e1f20;
    color: rgba(255, 255, 255, 0.58);
    cursor: pointer;

    &.is-active {
        border-color: rgba(255, 255, 255, 0.92);
    }

    > img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    > video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
    }

    i {
        position: absolute;
        left: 4px;
        bottom: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 17px;
        height: 17px;
        border-radius: 3px;
        background: rgba(0, 0, 0, 0.32);
        font-style: normal;

        img {
            width: 13px;
            height: 13px;
            filter: brightness(0) invert(1);
        }
    }
}

.preview-shell :deep(.short-drama-image-preview),
.preview-video {
    display: block;
    width: 100%;
    height: 100%;
    background: transparent;
}

.preview-shell :deep(.short-drama-image-preview__image),
.preview-video {
    object-fit: cover;
}

.preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    gap: 16px;
    color: rgba(255, 255, 255, 0.48);
}

.preview-empty :deep(.short-drama-grainient-placeholder),
.shot-thumb-empty :deep(.short-drama-grainient-placeholder) {
    width: 100%;
    height: 100%;
}

.preview-empty__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.preview-empty__primary,
.preview-empty__secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 126px;
    height: 44px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;

    span {
        font-size: 20px;
        font-weight: 400;
        line-height: 1;
        transform: translateY(-1px);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.58;
    }
}

.preview-empty__primary {
    border: 0;
    color: #101112;
    background: #fff;
}

.preview-empty__secondary {
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: rgba(255, 255, 255, 0.92);
    background: #2a2b2c;
}

.preview-caption {
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 42px;
    padding: 0 14px;
    border-radius: 8px;
    background: rgba(12, 12, 13, 0.72);
    backdrop-filter: blur(12px);

    strong {
        flex: 0 0 auto;
        font-size: 15px;
        font-weight: 600;
    }

    span {
        min-width: 0;
        overflow: hidden;
        color: rgba(255, 255, 255, 0.72);
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.timeline-panel {
    --shot-card-height: 110px;
    min-width: 0;
    height: 100%;
    padding: 14px 20px;
    border: 1px solid #2a2b2c;
    border-radius: 16px;
    background: #101012;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}

.timeline-play {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 34px;
    font-size: 16px;

    button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: 0;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
    }

    img {
        width: 14px;
        height: 14px;
        filter: brightness(0);
    }
}

.timeline-play-icon {
    position: relative;
    display: block;
    width: 12px;
    height: 12px;

    &::before {
        content: '';
        position: absolute;
        left: 3px;
        top: 1px;
        width: 0;
        height: 0;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        border-left: 7px solid #050505;
    }

    &.is-playing::before,
    &.is-playing::after {
        content: '';
        position: absolute;
        top: 1px;
        width: 3px;
        height: 10px;
        border: 0;
        background: #050505;
    }

    &.is-playing::before {
        left: 2px;
    }

    &.is-playing::after {
        left: 7px;
    }
}

.shot-strip {
    display: flex;
    align-items: flex-start;
    gap: 0;
    flex: 0 0 auto;
    min-width: 0;
    height: calc(var(--shot-card-height) + 14px);
    min-height: calc(var(--shot-card-height) + 14px);
    margin-top: 0;
    padding-top: 14px;
    overflow-x: auto;
    overflow-y: visible;
    scrollbar-width: none;
}

.shot-timeline-item {
    position: relative;
    flex: 0 0 auto;
    width: auto;
    height: var(--shot-card-height);
    aspect-ratio: 16 / 9;
    margin-right: 10px;

    &:last-child {
        margin-right: 0;
    }
}

.shot-thumb {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: visible;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    background: #1e1f20;
    cursor: pointer;

    &.is-active {
        border-color: #fff;
    }

    > img,
    > video {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 7px;
        object-fit: cover;
    }

    > video {
        pointer-events: none;
    }
}

.shot-insert-btn {
    position: absolute;
    top: 50%;
    right: -21px;
    z-index: 8;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 36px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    opacity: 0;
    transform: translateY(-50%);
    transition: opacity 0.16s ease;

    &:disabled {
        cursor: not-allowed;
    }

    &::before,
    &::after {
        position: absolute;
        top: 50%;
        width: 14px;
        height: 0.5px;
        background: repeating-linear-gradient(
            to right,
            rgba(255, 255, 255, 0.82) 0,
            rgba(255, 255, 255, 0.82) 4px,
            transparent 4px,
            transparent 9px
        );
        content: '';
        transform: translateY(-50%);
    }

    &::before {
        right: calc(50% + 17px);
        -webkit-mask-image: linear-gradient(to right, transparent 0, #000 100%);
        mask-image: linear-gradient(to right, transparent 0, #000 100%);
    }

    &::after {
        left: calc(50% + 17px);
        -webkit-mask-image: linear-gradient(to left, transparent 0, #000 100%);
        mask-image: linear-gradient(to left, transparent 0, #000 100%);
    }

    span {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        background: #1e1f20;
        color: #fff;
        font-size: 20px;
        font-weight: 400;
        line-height: 28px;
        transition:
            background 0.16s ease,
            color 0.16s ease;
    }

    &:hover,
    &:focus-visible {
        opacity: 1;
    }

    &:hover span,
    &:focus-visible span {
        background: #fff;
        color: #1e1f20;
    }
}

.shot-actions {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    pointer-events: auto;

    button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 50%;
        padding: 0;
        background: transparent;
        color: #fff;
        font-size: 19px;
        line-height: 1;
        cursor: pointer;
        opacity: 0.92;

        &:hover {
            opacity: 1;
        }

        &:disabled {
            cursor: not-allowed;
            opacity: 0.42;
        }

        img {
            display: block;
            width: 16px;
            height: 16px;
        }
    }
}

.shot-play-progress {
    position: absolute;
    top: -8px;
    bottom: 0;
    z-index: 4;
    width: 2px;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12), 0 0 8px rgba(255, 255, 255, 0.52);
    pointer-events: none;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: -10px;
        width: 22px;
    }

    &::after {
        content: '';
        position: absolute;
        top: -1px;
        left: 50%;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.36);
        transform: translateX(-50%);
    }
}

.shot-thumb-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: rgba(255, 255, 255, 0.52);
    font-size: 13px;
}

.shot-thumb-empty :deep(.short-drama-grainient-placeholder) {
    border-radius: 8px;
}

.shot-bottom-bar {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    width: 100%;
    min-height: 36px;
    padding: 12px 8px 5px;
    border-radius: 0 0 7px 7px;
    background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0.30) 30%,
        rgba(0, 0, 0, 0.82) 100%
    );
    pointer-events: none;
}

.shot-meta {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 5px;
    color: #fff;
    font-size: 14px;
    line-height: 16px;
}

.shot-meta span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.shot-meta img,
.music-track img {
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(1);
}

.music-track {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 32px;
    height: 32px;
    margin-top: 8px;
    padding: 0 14px;
    border-radius: 6px;
    background: #1e1f20;
    color: rgba(255, 255, 255, 0.72);
    font-size: 14px;

    &.is-ready {
        color: #fff;
        background: #242526;
    }

    &.is-failed {
        color: #ff8c8c;
        background: rgba(255, 92, 92, 0.12);
    }

    span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    em {
        margin-left: auto;
        color: rgba(255, 255, 255, 0.48);
        font-style: normal;
        font-size: 13px;
    }
}

.music-mix-btn,
.music-track-retry {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.music-mix-btn {
    display: grid;
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    place-items: center;
    padding: 0;
    background: transparent;

    img {
        width: 20px;
        height: 20px;
    }

    &:disabled {
        cursor: default;
        opacity: 0.52;
    }
}

.music-track.is-muted .music-mix-btn {
    opacity: 0.58;
}

.music-track-label {
    flex: 0 1 auto;
    color: #fff;
    font-weight: 600;
}

.music-mix-status {
    flex: 0 0 auto;
    border-radius: 4px;
    padding: 3px 8px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    font-weight: 500;
}

.music-track.is-muted .music-mix-status {
    color: rgba(255, 255, 255, 0.46);
}

.music-track-retry {
    height: 24px;
    margin-left: 8px;
    border-radius: 4px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.12);
    font-size: 12px;
}

.creation-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    min-height: 0;
    overflow: visible;
    padding: 18px 24px 20px;
    border: 1px solid #2a2b2c;
    border-radius: 16px;
    background: #101012;
    box-sizing: border-box;
}

.panel-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 47px;
    padding: 4px;
    border-radius: 6px;
    background: #2a2b2c;
    box-sizing: border-box;

    button {
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: rgba(255, 255, 255, 0.42);
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;

        &.is-active {
            background: #fff;
            color: #0c0c0d;
        }
    }
}

.draw-panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: visible;
    padding-top: 14px;
}

.draw-scroll {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: auto;
    will-change: scroll-position;
    contain: layout paint;
    padding-right: 2px;
    scrollbar-width: none;
}

.draw-scroll::-webkit-scrollbar {
    display: none;
}

.prompt-card {
    flex: 0 0 auto;
    min-height: 56px;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 8px;
    padding: 12px 12px 10px;
    background: #1b1b1d;
    box-sizing: border-box;
}

.prompt-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    strong {
        color: rgba(255, 255, 255, 0.92);
        font-size: 15px;
        font-weight: 600;
    }

    div {
        display: inline-flex;
        align-items: center;
        gap: 10px;
    }

    button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border: 0;
        border-radius: 0;
        padding: 0;
        background: transparent;
        opacity: 0.88;
        cursor: pointer;

        &.is-collapsed img {
            transform: rotate(180deg);
        }
    }

    img {
        width: 14px;
        height: 14px;
        filter: brightness(0) invert(1);
        transition: transform 0.16s ease;
    }
}

.prompt-card textarea {
    display: block;
    width: 100%;
    min-height: 116px;
    max-height: 260px;
    margin: 0;
    overflow-y: auto;
    resize: vertical;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 7px;
    padding: 10px 11px;
    background: #141416;
    color: rgba(255, 255, 255, 0.78);
    font-size: 13px;
    line-height: 22px;
    outline: none;
    box-sizing: border-box;

    &::placeholder {
        color: rgba(255, 255, 255, 0.34);
    }

    &:focus {
        border-color: rgba(255, 255, 255, 0.22);
        background: #171719;
    }

    &.is-collapsed {
        min-height: 84px;
        max-height: 84px;
        resize: none;
    }
}

.panel-result-frame {
    position: relative;
    display: block;
    width: 66.666%;
    flex: 0 0 auto;
    height: auto;
    aspect-ratio: var(--storyboard-aspect-ratio, 16 / 9);
    padding-top: 0;
    margin: 10px 0 0;
    overflow: hidden;
    border-radius: 8px;
    background: transparent;
}

.panel-result-frame.is-history,
.panel-result-frame.is-response {
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 0.18s ease;

    &:hover {
        border-color: rgba(255, 255, 255, 0.26);
    }

    &.is-selected {
        border-color: rgba(255, 255, 255, 0.42);
    }
}

.panel-result-image,
.panel-result-frame :deep(.short-drama-image-preview) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.panel-result-frame :deep(.short-drama-image-preview__image) {
    object-fit: cover;
}

.panel-result-frame.is-generating {
    display: flex;
    flex: 0 0 auto;
    height: auto;
    aspect-ratio: var(--storyboard-aspect-ratio, 16 / 9);
    padding-top: 0;
    margin-top: 0;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
}

.panel-result-failed-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: inherit;
    background: #171719;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 600;
}

.panel-result-frame.is-generating :deep(.short-drama-grainient-placeholder) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.panel-result-video {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: transparent;
}

.panel-record-state {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0 12px;
    background: rgba(18, 18, 20, 0.82);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    backdrop-filter: blur(10px);
}

.quick-edit-chip {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: fit-content;
    max-width: 72%;
    min-width: 0;
    min-height: 48px;
    height: auto;
    margin: 18px 0 24px auto;
    border: 0;
    border-radius: 24px;
    padding: 12px 18px;
    background: #222224;
    color: #fff;
    font-size: 14px;
    line-height: 20px;
    text-align: left;
    white-space: normal;
    word-break: break-word;
    cursor: pointer;
}

.thinking-title {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 9px;
    margin: 14px 0 10px;

    img {
        width: 31px;
        height: 31px;
    }

    strong {
        display: inline-flex;
        align-items: center;
        font-size: 15px;
        font-weight: 600;
    }
}

.loading-dots {
    display: inline-flex;
    align-items: center;
    width: 18px;
    margin-left: 1px;

    i {
        width: 3px;
        height: 3px;
        margin-left: 3px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0;
        animation: thinking-dot 1.2s infinite;
    }

    i:nth-child(2) {
        animation-delay: 0.2s;
    }

    i:nth-child(3) {
        animation-delay: 0.4s;
    }
}

@keyframes thinking-dot {
    0%,
    20% {
        opacity: 0;
        transform: translateY(1px);
    }

    35%,
    65% {
        opacity: 1;
        transform: translateY(0);
    }

    100% {
        opacity: 0;
        transform: translateY(-1px);
    }
}

.shot-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px;
    border-radius: 10px;
    background: #1a1b1d;

    div {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    span,
    em {
        color: rgba(255, 255, 255, 0.52);
        font-style: normal;
        font-size: 12px;
    }

    strong {
        overflow: hidden;
        font-size: 15px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.mode-segment {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 14px;

    button {
        height: 36px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: #171719;
        color: rgba(255, 255, 255, 0.62);
        cursor: pointer;

        &.is-active {
            border-color: #fff;
            background: #fff;
            color: #0c0c0d;
        }
    }
}

.mode-body {
    flex: 0 0 auto;
    margin-top: 14px;
}

.reference-card,
.frame-card,
.field-block,
.mention-picker {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 12px;
    background: #171719;
}

.reference-card {
    p {
        margin: 8px 0 0;
        color: rgba(255, 255, 255, 0.46);
        font-size: 12px;
        line-height: 20px;
    }
}

.reference-card > span,
.frame-card > span,
.field-block > span {
    display: block;
    margin-bottom: 8px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
}

.reference-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 8px;
    background: #242526;
    color: rgba(255, 255, 255, 0.44);
    font-size: 13px;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    button {
        height: 34px;
        border: 0;
        border-radius: 6px;
        padding: 0 14px;
        background: #fff;
        color: #0c0c0d;
        cursor: pointer;
    }
}

.field-block {
    display: block;

    select {
        width: 100%;
        height: 38px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        outline: none;
        padding: 0 10px;
        background: #242526;
        color: #fff;
    }
}

.mention-picker {
    margin-top: 10px;
}

.mention-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 8px 0;

    span {
        font-size: 13px;
        font-weight: 600;
    }

    small {
        color: rgba(255, 255, 255, 0.38);
        font-size: 12px;
    }
}

.mention-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 70px;
    overflow-y: auto;

    button {
        max-width: 100%;
        height: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        padding: 0 10px;
        overflow: hidden;
        background: #242526;
        color: rgba(255, 255, 255, 0.68);
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;

        &.is-active {
            border-color: #fff;
            background: #fff;
            color: #0c0c0d;
        }
    }
}

.video-frames {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.last-frame-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 8px;

    button {
        height: 28px;
        border: 0;
        border-radius: 6px;
        background: #242526;
        color: rgba(255, 255, 255, 0.62);
        cursor: pointer;

        &.is-active {
            background: #fff;
            color: #0c0c0d;
        }
    }
}

.conversation-stream {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
    padding-right: 4px;
    overflow: visible;
    content-visibility: auto;
    contain-intrinsic-size: 1px 520px;
}

.chat-message {
    display: flex;
    gap: 10px;
    margin-bottom: 0;

    &:last-child {
        margin-bottom: 0;
    }

    &.is-user {
        flex-direction: row-reverse;

        .chat-bubble {
            border-radius: 12px;
            padding: 14px 17px;
            background: #222224;
            color: #fff;
        }
    }

    &.is-assistant {
        .chat-bubble {
            max-width: 100%;
            padding: 0;
            background: transparent;
            color: rgba(255, 255, 255, 0.56);
        }
    }
}

.chat-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    overflow: hidden;
    border-radius: 50%;
    background: #2a2b2c;
    color: #fff;
    font-size: 12px;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.chat-bubble {
    min-width: 0;
    max-width: calc(100% - 46px);
    max-height: none;
    overflow: visible;
    border-radius: 12px;
    padding: 10px 12px;
    background: #1e1f20;
    color: rgba(255, 255, 255, 0.84);

    p {
        margin: 0;
        max-height: none;
        overflow: visible;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        line-height: 21px;
        overscroll-behavior: contain;
    }

    small {
        display: block;
        margin-top: 6px;
        color: rgba(255, 255, 255, 0.42);
        font-size: 12px;
    }
}

:deep(.chat-mention),
:deep(.composer-mention-text) {
    color: #20d7ff;
}

.chat-empty {
    display: none;
    color: rgba(255, 255, 255, 0.52);
    font-size: 14px;
    line-height: 24px;
}

.history-record-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 14px;
}

.history-record {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 0 0 auto;

    .chat-message {
        margin-bottom: 0;
    }

    .chat-bubble p {
        max-height: none;
    }
}

.panel-result-frame.is-response {
    display: block;
    flex: 0 0 auto;
    height: auto;
    aspect-ratio: var(--storyboard-aspect-ratio, 16 / 9);
    padding-top: 0;
    margin-top: 0;
    border-radius: 8px;
}

.panel-result-frame.is-history {
    display: block;
    flex: 0 0 auto;
    height: auto;
    aspect-ratio: var(--storyboard-aspect-ratio, 16 / 9);
    padding-top: 0;
    margin-top: 0;
    border-radius: 8px;
}

.panel-result-frame.is-history.is-video {
    cursor: default;
}

.composer {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    width: calc(100% + 48px);
    min-height: 148px;
    margin: 14px -24px -20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 14px 16px 12px;
    background: #1e1f20;
    box-sizing: border-box;

    .composer-editor {
        flex: 1 1 auto;
        width: 100%;
        min-height: 82px;
        height: auto;
        max-height: 200px;
        overflow-y: auto;
        border: 0;
        outline: none;
        background: transparent;
        color: #fff;
        font-size: 14px;
        line-height: 22px;
        box-sizing: border-box;
        white-space: pre-wrap;
        word-break: break-word;

        &:empty::before {
            content: attr(data-placeholder);
            color: rgba(255, 255, 255, 0.36);
            pointer-events: none;
        }
    }
}

:deep(.composer-mention-chip) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    margin-right: 2px;
    color: #20d7ff;
    vertical-align: baseline;
    white-space: nowrap;
    user-select: all;
}

.composer.is-image_edit {
    min-height: 158px;
}

.composer.is-video_generate {
    margin-top: 52px;
    min-height: 182px;
}

.composer.is-video_generate .composer-input-row {
    padding-top: 22px;
}

.composer-input-row {
    display: flex;
    flex: 1 1 auto;
    align-items: flex-start;
    gap: 12px;
    min-height: 0;
}

.composer-reference-thumb {
    flex: 0 0 56px;
    width: 56px;
    height: 78px;
    margin-top: 0;
    overflow: hidden;
    border-radius: 6px;
    background: #242526;
    transform: rotate(-8deg);
    transform-origin: center;

    img {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 6px;
        object-fit: cover;
    }
}

.composer-frame-strip {
    position: absolute;
    top: -54px;
    left: 18px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
}

.composer-frame-thumb {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 74px;
    overflow: visible;
    border: 0;
    border-radius: 6px;
    padding: 0;
    background: #242526;
    color: rgba(255, 255, 255, 0.72);
    transform: rotate(-8deg);
    cursor: pointer;

    &.is-last {
        transform: rotate(8deg);
    }

    b {
        position: absolute;
        top: -7px;
        right: -7px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #4a4b4e;
        color: #fff;
        font-size: 14px;
        font-style: normal;
        font-weight: 400;
        line-height: 18px;
        transform: rotate(-8deg);
    }

    img {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 6px;
        object-fit: cover;
    }
}

.frame-empty-mark {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: rgba(255, 255, 255, 0.72);
    transform: rotate(-8deg);

    i,
    em {
        font-style: normal;
        line-height: 1;
    }

    i {
        font-size: 20px;
    }

    em {
        font-size: 11px;
    }
}

.frame-switch {
    position: absolute;
    top: 21px;
    left: 46px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    margin: 0;
    background: #232426;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
}

.last-frame-menu {
    position: absolute;
    z-index: 8;
    width: 160px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 16px;
    padding: 8px;
    background: #1f2022;
    box-sizing: border-box;
    transform: translateX(-50%);

    button {
        display: flex;
        align-items: center;
        width: 100%;
        height: 34px;
        border: 0;
        border-radius: 10px;
        padding: 0 10px;
        background: transparent;
        color: rgba(255, 255, 255, 0.88);
        font-size: 13px;
        text-align: left;
        cursor: pointer;

        &:hover {
            background: #2a2b2c;
            color: #fff;
        }

        &:disabled {
            cursor: not-allowed;
            opacity: 0.42;
        }

        &:disabled:hover {
            background: transparent;
            color: rgba(255, 255, 255, 0.88);
        }
    }
}

.mode-menu {
    position: absolute;
    left: 16px;
    bottom: 66px;
    z-index: 5;
    width: 122px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 8px;
    background: #161618;
    box-sizing: border-box;
    transform: translateX(-50%);

    button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        height: 34px;
        border: 0;
        border-radius: 8px;
        padding: 0 8px;
        background: transparent;
        color: #fff;
        font-size: 14px;
        cursor: pointer;

        &.is-active,
        &:hover {
            background: #26272a;
        }

        span {
            color: rgba(255, 255, 255, 0.72);
        }
    }
}

.model-menu {
    position: absolute;
    left: 126px;
    bottom: 66px;
    z-index: 6;
    width: max-content;
    min-width: 222px;
    max-width: calc(100% - 24px);
    transform: translateX(-50%);
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
    padding: 10px;
    background: #161618;
    box-sizing: border-box;
}

.model-menu__head {
    display: block;
    padding: 2px 4px 8px;

    span {
        color: rgba(255, 255, 255, 0.92);
        font-size: 13px;
        font-weight: 600;
    }
}

.model-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 38px;
    border: 0;
    border-radius: 10px;
    padding: 0 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
    cursor: pointer;

    &:hover,
    &.is-active {
        background: #26272a;
        color: #fff;
    }

    span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    i {
        flex: 0 0 auto;
        color: #fff;
        font-style: normal;
    }
}

.resolution-menu {
    position: absolute;
    bottom: 66px;
    z-index: 6;
    width: 118px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
    padding: 8px;
    background: #161618;
    box-sizing: border-box;
    transform: translateX(-50%);

    button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        height: 34px;
        border: 0;
        border-radius: 8px;
        padding: 0 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.82);
        font-size: 13px;
        cursor: pointer;

        &:hover,
        &.is-active {
            background: #26272a;
            color: #fff;
        }

        i {
            color: rgba(255, 255, 255, 0.72);
            font-style: normal;
        }
    }
}

.generation-settings-menu {
    position: absolute;
    left: 16px;
    bottom: 58px;
    z-index: 8;
    width: min(360px, calc(100% - 32px));
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 18px;
    padding: 10px 12px 12px;
    background: rgba(31, 32, 34, 0.96);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
    box-sizing: border-box;
    backdrop-filter: blur(18px);
}

.generation-settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 42px;
    border: 0;
    border-radius: 14px;
    padding: 0 8px;
    background: transparent;
    color: #fff;
    font-size: 14px;
    box-sizing: border-box;

    > span {
        flex: 0 0 auto;
        color: rgba(255, 255, 255, 0.92);
        font-weight: 600;
    }

    strong {
        min-width: 0;
        overflow: hidden;
        color: rgba(255, 255, 255, 0.86);
        font-size: 13px;
        font-weight: 500;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.generation-settings-row.is-button {
    width: 100%;
    cursor: pointer;

    &.is-active,
    &:hover {
        background: rgba(255, 255, 255, 0.08);
    }
}

.generation-settings-row.is-options {
    align-items: flex-start;
    min-height: 40px;
    padding-top: 8px;
    padding-bottom: 8px;
}

.generation-settings-model-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 150px;
    margin: 4px 0 8px;
    padding: 4px;
    overflow-y: auto;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    scrollbar-width: none;

    button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        min-height: 34px;
        border: 0;
        border-radius: 10px;
        padding: 0 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.78);
        font-size: 13px;
        cursor: pointer;

        &:hover,
        &.is-active {
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
        }

        span {
            min-width: 0;
            overflow: hidden;
            text-align: left;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        i {
            flex: 0 0 auto;
            color: #fff;
            font-style: normal;
        }
    }
}

.generation-settings-model-list .generation-settings-nano-back {
    min-height: 28px;
    padding: 0 8px;
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
    text-align: left;
}

.generation-settings-nano-series {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 4px 8px;

    button {
        min-height: 28px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.62);

        &.is-active {
            border-color: rgba(255, 255, 255, 0.5);
        }
    }
}

.generation-settings-model-list button.is-nano-variant {
    margin-left: 10px;
    width: calc(100% - 10px);
}

.generation-settings-options {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;

    button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 52px;
        height: 28px;
        border: 0;
        border-radius: 14px;
        padding: 0 10px;
        background: transparent;
        color: rgba(255, 255, 255, 0.52);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;

        &.is-active,
        &:hover {
            background: rgba(255, 255, 255, 0.14);
            color: #fff;
        }
    }
}

.settings-duration-menu {
    position: absolute;
    right: 12px;
    bottom: 14px;
    z-index: 9;
    width: 138px;
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 18px;
    padding: 8px;
    background: rgba(31, 32, 34, 0.98);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38);
    box-sizing: border-box;
    scrollbar-width: none;

    button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        height: 34px;
        border: 0;
        border-radius: 10px;
        padding: 0 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.86);
        font-size: 13px;
        cursor: pointer;

        &:hover,
        &.is-active {
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
        }

        i {
            flex: 0 0 auto;
            font-style: normal;
        }
    }
}

.mention-menu {
    position: absolute;
    left: 50%;
    bottom: 66px;
    z-index: 7;
    width: 176px;
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 16px;
    padding: 8px;
    background: #1f2022;
    box-sizing: border-box;
    transform: translateX(-50%);

    p {
        display: none;
        margin: 0;
        color: rgba(255, 255, 255, 0.42);
        font-size: 12px;
        line-height: 18px;
    }
}

.mention-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    height: 31px;
    padding: 3px;
    border-radius: 16px;
    background: #2a2b2c;
    box-sizing: border-box;

    button {
        border: 0;
        border-radius: 13px;
        background: transparent;
        color: rgba(255, 255, 255, 0.52);
        font-size: 13px;
        cursor: pointer;

        &.is-active {
            background: #fff;
            color: #0c0c0d;
        }
    }
}

.mention-menu__head {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    strong {
        color: rgba(255, 255, 255, 0.92);
        font-size: 13px;
        font-weight: 600;
    }

    button {
        height: 26px;
        border: 0;
        border-radius: 13px;
        padding: 0 10px;
        background: #26272a;
        color: rgba(255, 255, 255, 0.62);
        cursor: pointer;
    }
}

.mention-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;

    > span {
        display: none;
    }

    button {
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 100%;
        height: 34px;
        border: 0;
        border-radius: 10px;
        padding: 0 10px;
        overflow: hidden;
        background: transparent;
        color: rgba(255, 255, 255, 0.86);
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;

        &::before {
            content: '@';
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 20px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #313233;
            color: #fff;
            font-size: 12px;
            line-height: 1;
        }

        &.is-active {
            color: #fff;
        }
    }
}

.composer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    width: 100%;
    margin-top: auto;
    min-width: 0;
}

.cube-btn,
.mode-pill,
.mention-btn,
.send-btn {
    height: 34px;
    border: 0;
    border-radius: 17px;
    cursor: pointer;
}

.cube-btn {
    order: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    min-width: 34px;
    padding: 0;
    background: transparent;

    img {
        width: 32px;
        height: 32px;
        filter: none;
        opacity: 1;
    }

    &.is-active {
        background: transparent;

        img {
            filter: brightness(0) invert(1);
            opacity: 1;
        }
    }
}

.composer {
    .cube-btn {
        flex: 0 0 34px;
        width: 34px;
        max-width: 34px;
        min-width: 34px;
        padding: 0;
        background: transparent;
        color: rgba(255, 255, 255, 0.82);
        font-size: 13px;

        img {
            flex: 0 0 auto;
            width: 32px;
            height: 32px;
            filter: none;
        }

        span {
            display: none;
        }

        &.is-active {
            background: rgba(255, 255, 255, 0.08);
        }
    }

    .mention-btn {
        flex: 0 0 34px;
        width: 34px;
        max-width: 34px;
        min-width: 34px;
        padding: 0;
        overflow: hidden;
        background: transparent;
        color: rgba(255, 255, 255, 0.82);
        font-size: 15px;

        > span {
            flex: 0 0 auto;
            font-size: 15px;
            line-height: 1;
        }

        img {
            width: 32px;
            height: 32px;
            filter: none;
        }

        &.is-active {
            background: transparent;
            color: #fff;
        }
    }
}

.mode-pill {
    order: 1;
    display: inline-flex;
    align-items: center;
    flex: 0 1 96px;
    gap: 6px;
    min-width: 72px;
    max-width: 108px;
    padding: 0 12px;
    overflow: hidden;
    background: #242526;
    color: rgba(255, 255, 255, 0.78);
    text-overflow: ellipsis;
    white-space: nowrap;

    img {
        width: 12px;
        height: 12px;
        filter: brightness(0) invert(1);
        opacity: 0.65;
    }
}

.mention-btn {
    order: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.68);
    font-size: 22px;
    line-height: 1;
}

.resolution-pill {
    order: 4;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    gap: 5px;
    width: auto;
    height: 30px;
    border: 0;
    outline: none;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    font-size: 14px;
    cursor: pointer;

    img {
        width: 10px;
        height: 10px;
        filter: brightness(0) invert(1);
        opacity: 0.64;
    }

    &.is-active {
        background: transparent;
        color: #fff;
    }
}

.composer-count {
    order: 5;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    color: rgba(255, 255, 255, 0.50);
    font-size: 0;

    img {
        width: 14px;
        height: 14px;
        opacity: 0.75;
    }

    span {
        font-size: 13px;
        line-height: 18px;
    }
}

.send-btn {
    order: 6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    min-width: 34px;
    padding: 0;
    background: #fff;
    color: #0c0c0d;

    img {
        width: 17px;
        height: 17px;
        filter: brightness(0);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.56;
    }
}

.music-editor {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding-top: 24px;
}

.music-prompt-box {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 190px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    background: #1e1f20;

    textarea {
        width: 100%;
        flex: 1;
        min-height: 128px;
        border: 0;
        border-radius: 10px 10px 0 0;
        outline: none;
        padding: 14px;
        resize: vertical;
        background: transparent;
        color: #fff;
        line-height: 22px;
        box-sizing: border-box;
    }
}

.music-prompt-tools {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 6px 10px 10px;
    box-sizing: border-box;
    background: #1e1f20;
}

.music-cost {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: rgba(255, 255, 255, 0.52);
    font-size: 13px;

    img {
        width: 14px;
        height: 14px;
        opacity: 0.7;
    }
}

.music-generate-btn {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: #4a4b4d;
    cursor: pointer;

    img {
        width: 16px;
        height: 16px;
        filter: brightness(0) invert(1);
    }

    &.is-ready {
        background: #fff;

        img {
            filter: none;
        }
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
}

.music-editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
        margin: 0;
        font-size: 16px;
    }

    span {
        color: rgba(255, 255, 255, 0.52);
        font-size: 13px;
    }
}

.music-tip,
.music-error {
    margin: 0;
    font-size: 13px;
    line-height: 22px;
}

.music-tip {
    color: rgba(255, 255, 255, 0.46);
}

.music-error {
    color: #ff8c8c;
}

.music-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.music-secondary,
.music-primary,
.music-preview-btn {
    height: 40px;
    border: 0;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
}

.music-secondary {
    color: #fff;
    background: #1e1f20;
}

.music-primary {
    color: #0c0c0d;
    background: #fff;
}

.music-preview-btn {
    color: #fff;
    background: #2a2b2c;
}

.music-history {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    margin-top: 2px;
}

.music-history-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: rgba(255, 255, 255, 0.88);
    font-size: 14px;

    em {
        color: rgba(255, 255, 255, 0.42);
        font-style: normal;
        font-size: 12px;
    }
}

.music-history-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    overflow-y: auto;
}

.music-record-card {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px;
    background: #1a1b1c;
    cursor: pointer;

    &.is-active {
        border-color: rgba(255, 255, 255, 0.34);
        background: #202122;
    }

    &.is-selected {
        border-color: rgba(255, 255, 255, 0.46);
    }

    &.is-applied {
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    }

    &.is-failed {
        border-color: rgba(255, 92, 92, 0.34);
    }
}

.music-record-play {
    display: grid;
    width: 58px;
    height: 58px;
    place-items: center;
    border: 0;
    border-radius: 4px;
    background: linear-gradient(135deg, #5d7f63, #005a88);
    cursor: pointer;

    span {
        width: 0;
        height: 0;
        margin-left: 3px;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 9px solid #fff;
    }

    &:disabled {
        cursor: default;
        opacity: 0.55;
    }
}

.music-record-card.is-active .music-record-play span {
    width: 12px;
    height: 12px;
    margin-left: 0;
    border: 0;
    background: linear-gradient(90deg, #fff 0 35%, transparent 35% 65%, #fff 65% 100%);
}

.music-record-main {
    min-width: 0;
}

.music-record-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.music-record-delete,
.music-record-download {
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    border: 0;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    opacity: 0.58;

    img {
        width: 15px;
        height: 15px;
        filter: brightness(0) invert(1);
    }

    &:hover {
        background: rgba(255, 255, 255, 0.08);
        opacity: 1;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.32;
    }
}

.music-record-download img {
    filter: none;
}

.music-record-actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
}

.music-record-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.music-record-progress {
    position: relative;
    display: block;
    width: 100%;
    height: 4px;
    margin-top: 9px;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;

    i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: rgba(255, 255, 255, 0.78);
    }

    &:disabled {
        cursor: default;
    }
}

.music-record-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.56);
    font-size: 12px;

    em {
        flex: 0 0 auto;
        margin-left: auto;
        color: rgba(255, 255, 255, 0.72);
        font-style: normal;
    }
}

.music-record-error {
    margin: 8px 0 0;
    color: #ff8c8c;
    font-size: 12px;
    line-height: 18px;
}

.music-history-empty {
    display: grid;
    flex: 1;
    min-height: 120px;
    place-items: center;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.36);
    font-size: 13px;
}

.music-apply-btn {
    flex: 0 0 44px;
    height: 44px;
    border: 0;
    border-radius: 999px;
    background: #fff;
    color: #0c0c0d;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
}

.batch-video-mask {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.62);
    backdrop-filter: blur(10px);
}

.batch-video-dialog {
    width: min(420px, calc(100vw - 40px));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 28px 32px 32px;
    background: #1b1c1d;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
}

.batch-video-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-bottom: 22px;
    color: #fff;

    img {
        width: 62px;
        height: 62px;
        opacity: 0.86;
        filter: brightness(0) invert(1);
    }

    strong {
        font-size: 20px;
        line-height: 24px;
    }
}

.batch-video-panel {
    overflow: visible;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: #242526;

    header {
        height: 42px;
        padding: 0 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        line-height: 42px;
    }
}

.batch-video-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: center;
    min-height: 54px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);

    &:last-child {
        border-bottom: 0;
    }

    span,
    strong {
        display: block;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
    }

    em {
        display: block;
        margin-top: 3px;
        color: rgba(255, 255, 255, 0.42);
        font-style: normal;
        font-size: 12px;
    }

}

.batch-video-model-wrap {
    position: relative;
    width: 142px;
}

.batch-video-model-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 142px;
    height: 34px;
    border: 0;
    border-radius: 8px;
    outline: none;
    padding: 0 10px 0 12px;
    background: #303133;
    color: #fff;
    cursor: pointer;
    font-size: 13px;

    span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    img {
        flex: 0 0 auto;
        width: 10px;
        height: 10px;
        filter: brightness(0) invert(1);
        opacity: 0.64;
    }

    &.is-active {
        background: #363739;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
}

.batch-video-model-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 4;
    width: 180px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
    padding: 8px;
    background: #161618;
    box-sizing: border-box;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.38);

    button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        min-height: 34px;
        border: 0;
        border-radius: 8px;
        padding: 0 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.82);
        cursor: pointer;
        font-size: 13px;
        text-align: left;

        &:hover,
        &.is-active {
            background: #26272a;
            color: #fff;
        }

        span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        i {
            flex: 0 0 auto;
            color: #fff;
            font-style: normal;
        }
    }
}

.batch-video-row.is-resolution {
    grid-template-columns: 1fr;
    gap: 10px;
}

.batch-video-resolution {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    button {
        height: 32px;
        border: 0;
        border-radius: 6px;
        background: #303133;
        color: rgba(255, 255, 255, 0.58);
        cursor: pointer;
        font-size: 13px;

        &.is-active {
            background: #fff;
            color: #0c0c0d;
            font-weight: 600;
        }
    }
}

.batch-video-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 20px;

    button {
        height: 40px;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;

        &:disabled {
            cursor: not-allowed;
            opacity: 0.48;
        }
    }
}

.batch-video-cancel {
    background: #303133;
    color: #fff;
}

.batch-video-confirm {
    background: #fff;
    color: #0c0c0d;
}

@media (max-width: 1440px) {
    .storyboard-workspace {
        grid-template-columns: minmax(680px, 1fr) 360px;
        padding-left: 32px;
    }

    .stage-preview-row {
        --rail-reserve: 76px;
        gap: 16px;
    }

    .vertical-shot-rail {
        width: 54px;
    }

    .rail-thumb {
        flex-basis: 52px;
        width: 52px;
        height: 52px;
    }

    .video-frames {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 1366px) {
    .storyboard-workspace {
        grid-template-columns: minmax(620px, 1fr) 344px;
        gap: 14px;
        padding-right: 16px;
        padding-left: 24px;
    }

    .stage-preview-row {
        --rail-reserve: 68px;
        gap: 14px;
    }

    .vertical-shot-rail {
        width: 48px;
    }

    .rail-thumb {
        flex-basis: 46px;
        width: 46px;
        height: 46px;
    }

}
</style>
