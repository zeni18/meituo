<template>
    <div
        :class="['script-plan-page', { 'is-expanded': planDocumentVisible, 'is-dragging': isDragging }]"
        :style="pageStyle"
    >
        <ShortDramaFlowTopbar
            active="script"
            :title="scriptPlan.title"
            :editable="Boolean(projectId)"
            :show-steps="false"
            @back="goBack"
            @rename="renameProjectTitle"
            @step="goFlowStep"
        />

        <main ref="workspaceRef" class="script-plan-workspace">
            <section class="script-chat" aria-label="剧本对话">
                <div ref="chatRailRef" :class="['script-chat__rail', { 'is-empty': isCreateDraftMode }]">
                    <div v-if="isCreateDraftMode" class="plan-empty-state">
                        <strong>还没有创作内容</strong>
                        <p>在下方输入故事灵感，AI 会为你生成短剧脚本。</p>
                    </div>
                    <div v-else class="plan-chat-turn plan-chat-turn--initial">
                        <div class="user-story-wrap">
                            <article :class="['user-story-card', { 'is-open': userPromptExpanded }]">
                                <button
                                    v-if="isUserPromptLong"
                                    class="user-story-card__toggle"
                                    type="button"
                                    :aria-label="userPromptExpanded ? '收起故事灵感' : '展开故事灵感'"
                                    @click="userPromptExpanded = !userPromptExpanded"
                                >
                                    <ElIcon :class="{ 'is-open': userPromptExpanded }"><ArrowDown /></ElIcon>
                                </button>
                                <p>{{ userPrompt }}</p>
                            </article>
                            <img class="user-avatar" :src="displayAvatarUrl" alt="" />
                        </div>

                        <article v-if="showInitialAgentReply" class="agent-reply">
                            <div class="agent-reply__spark">
                                <ElIcon><MagicStick /></ElIcon>
                            </div>
                            <div class="agent-reply__content">
                            <template v-if="isInitialTaskStreaming">
                                    <div class="agent-thinking">
                                        <strong>正在生成...</strong>
                                        <span>{{ thinkingSeconds }}s</span>
                                    </div>
                                    <ul class="stream-steps">
                                        <li
                                            v-for="step in streamStepItems"
                                            :key="step.label"
                                            :class="{ 'is-done': step.done, 'is-active': step.active }"
                                        >
                                            <i></i>
                                            <span>{{ step.label }}</span>
                                        </li>
                                    </ul>
                                </template>
                                <template v-else>
                                    <p v-if="initialReplyMainText">{{ initialReplyMainText }}</p>
                                    <ul v-if="initialReplySteps.length" class="planning-checklist">
                                        <li v-for="step in initialReplySteps" :key="step.id">
                                            <div class="planning-checklist__row">
                                                <i class="planning-checklist__dot"></i>
                                                <span>{{ step.label }}</span>
                                                <ElIcon v-if="step.children?.length" class="planning-checklist__arrow"><ArrowDown /></ElIcon>
                                            </div>
                                            <div v-if="step.children?.length" class="planning-checklist__children">
                                                <span v-for="child in step.children" :key="child">
                                                    <i></i>
                                                    {{ child }}
                                                </span>
                                            </div>
                                        </li>
                                    </ul>
                                </template>
                            </div>
                        </article>

                        <article
                            v-if="initialPlanCard"
                            :class="['generated-file-card', 'generated-file-card--turn', { 'is-current': initialPlanCard.task_id === taskId }]"
                        >
                            <span class="generated-file-card__icon">
                                <ElIcon><Document /></ElIcon>
                            </span>
                            <div class="generated-file-card__meta">
                                <strong>{{ initialPlanCard.title }}</strong>
                                <span>{{ initialPlanCard.meta }}</span>
                            </div>
                            <button type="button" @click="openPlanVersionCard(initialPlanCard)">
                                {{ versionCardButtonText(initialPlanCard) }}
                            </button>
                        </article>
                    </div>

                    <div v-if="revisionChatRecords.length" class="revision-chat-list" aria-label="修改记录">
                        <div
                            v-for="record in revisionChatRecords"
                            :key="record.id"
                            class="plan-chat-turn revision-chat-item"
                        >
                            <div class="user-story-wrap revision-story-wrap">
                                <article :class="['user-story-card', 'revision-story-card', { 'is-open': record.expanded }]">
                                    <button
                                        v-if="isRevisionMessageLong(record.message)"
                                        class="user-story-card__toggle"
                                        type="button"
                                        :aria-label="record.expanded ? '收起修改内容' : '展开修改内容'"
                                        @click="toggleRevisionRecord(record)"
                                    >
                                        <ElIcon :class="{ 'is-open': record.expanded }"><ArrowDown /></ElIcon>
                                    </button>
                                    <p>{{ record.message }}</p>
                                </article>
                                <img class="user-avatar" :src="displayAvatarUrl" alt="" />
                            </div>

                            <article class="agent-reply agent-reply--revision">
                                <div class="agent-reply__spark">
                                    <ElIcon><MagicStick /></ElIcon>
                                </div>
                                <div class="agent-reply__content">
                                    <template v-if="isStreamingRevisionRecord(record)">
                                        <div class="agent-thinking">
                                            <strong>正在生成...</strong>
                                            <span>{{ thinkingSeconds }}s</span>
                                        </div>
                                        <ul class="stream-steps">
                                            <li
                                                v-for="step in streamStepItems"
                                                :key="step.label"
                                                :class="{ 'is-done': step.done, 'is-active': step.active }"
                                            >
                                                <i></i>
                                                <span>{{ step.label }}</span>
                                            </li>
                                        </ul>
                                    </template>
                                    <template v-else>
                                        <p>{{ revisionRecordStatusText(record) }}</p>
                                        <ul v-if="revisionReplySteps(record).length" class="planning-checklist">
                                            <li v-for="step in revisionReplySteps(record)" :key="step.id">
                                                <div class="planning-checklist__row">
                                                    <i class="planning-checklist__dot"></i>
                                                    <span>{{ step.label }}</span>
                                                    <ElIcon v-if="step.children?.length" class="planning-checklist__arrow"><ArrowDown /></ElIcon>
                                                </div>
                                                <div v-if="step.children?.length" class="planning-checklist__children">
                                                    <span v-for="child in step.children" :key="child">
                                                        <i></i>
                                                        {{ child }}
                                                    </span>
                                                </div>
                                            </li>
                                        </ul>
                                    </template>
                                </div>
                            </article>

                            <article
                                v-if="versionCardForRevision(record)"
                                :class="['generated-file-card', 'generated-file-card--turn', { 'is-current': versionCardForRevision(record)?.task_id === taskId }]"
                            >
                                <span class="generated-file-card__icon">
                                    <ElIcon><Document /></ElIcon>
                                </span>
                                <div class="generated-file-card__meta">
                                    <strong>{{ versionCardForRevision(record)?.title }}</strong>
                                    <span>{{ versionCardForRevision(record)?.meta }}</span>
                                </div>
                                <button type="button" @click="openRevisionVersionCard(record)">
                                    {{ revisionVersionCardButtonText(record) }}
                                </button>
                            </article>
                        </div>
                    </div>
                </div>

                <GlassSurface class="plan-composer" v-bind="planComposerProps">
                    <textarea
                        v-model.trim="planMessage"
                        :disabled="sendingMessage"
                        :placeholder="composerPlaceholder"
                        @keydown.ctrl.enter.prevent="sendPlanMessage"
                    ></textarea>

                    <div class="plan-composer__toolbar">
                        <div class="plan-composer__tools" aria-label="创作工具">
                            <button
                                v-for="tool in composerTools"
                                :key="tool.key"
                                :class="{
                                    'is-active': isComposerToolActive(tool.key),
                                    'has-selected-style': tool.key === 'style' && selectedComposerStyle
                                }"
                                type="button"
                                :aria-label="tool.label"
                                :title="tool.label"
                                @click.stop="handleComposerTool(tool.key)"
                            >
                                <template v-if="tool.key === 'style' && selectedComposerStyle">
                                    <img class="plan-style-tool__avatar" :src="selectedComposerStyle.image" :alt="selectedComposerStyle.name" />
                                    <span>{{ selectedComposerStyle.name }}</span>
                                    <i aria-label="清除画风" title="清除画风" @click.stop="clearSelectedComposerStyle"><img :src="closeSmallIcon" alt="" /></i>
                                </template>
                                <img v-else class="script-plan-icon script-plan-icon--tool" :src="tool.icon" alt="" />
                            </button>
                            <button
                                v-if="false"
                                :class="{ 'is-active': composerMentionMenuOpen }"
                                type="button"
                                aria-label="@角色/场景"
                                title="@角色/场景"
                                @click.stop="toggleComposerMentionMenu"
                            >
                                <span class="plan-composer__mention">@</span>
                            </button>
                        </div>

                        <label class="plan-composer__multi">
                            <span>多集</span>
                            <input v-model="composerMultiEpisode" type="checkbox" />
                            <span class="plan-composer__multi-track">
                                <i></i>
                            </span>
                        </label>

                        <button
                            :class="['plan-composer__send', { 'has-message': planMessage.trim() }]"
                            type="button"
                            aria-label="发送"
                            :disabled="sendingMessage || (!planMessage.trim() && !canRetryCurrentPlan)"
                            @click="sendPlanMessage"
                        >
                            <ElIcon v-if="sendingMessage" class="plan-composer__loading"><Loading /></ElIcon>
                            <img v-else class="script-plan-icon script-plan-icon--send" :src="iconAssets.arrowUp" alt="" />
                        </button>
                    </div>
                </GlassSurface>

                <transition name="image-model-menu-fade">
                    <div
                        v-if="isComposerPanelOpen('model')"
                        class="plan-tool-panel plan-tool-panel--model"
                        @click.stop
                    >
                        <section
                            v-for="group in enabledComposerModelGroups"
                            :key="group.key"
                            class="plan-model-group"
                        >
                            <p>{{ group.label }}</p>
                            <button
                                v-for="model in group.options"
                                :key="`${group.key}-${model.id}`"
                                :class="['plan-model-option', { 'is-active': isComposerModelSelected(group.key, model) }]"
                                type="button"
                                @click.stop="selectComposerModel(group.key, model)"
                            >
                                <img :src="model.image || sharedDramaImage" :alt="model.name" />
                                <span>
                                    <strong>{{ model.name }}</strong>
                                    <small>{{ model.description }}</small>
                                </span>
                                <i v-if="isComposerModelSelected(group.key, model)">✓</i>
                            </button>
                        </section>
                    </div>
                </transition>

                <transition name="image-model-menu-fade">
                    <div
                        v-if="isComposerPanelOpen('subject')"
                        class="plan-tool-panel plan-tool-panel--picker plan-tool-panel--subject"
                        @click.stop
                    >
                        <div class="plan-picker-panel">
                            <div class="plan-picker-panel__head">
                                <div class="plan-picker-tabs" aria-label="主体来源">
                                    <button
                                        :class="{ 'is-active': activeComposerSubjectSource === 'all' }"
                                        type="button"
                                        @click.stop="activeComposerSubjectSource = 'all'"
                                    >
                                        全部
                                    </button>
                                    <button
                                        :class="{ 'is-active': activeComposerSubjectSource === 'public' }"
                                        type="button"
                                        @click.stop="activeComposerSubjectSource = 'public'"
                                    >
                                        官方
                                    </button>
                                    <button
                                        :class="{ 'is-active': activeComposerSubjectSource === 'user' }"
                                        type="button"
                                        @click.stop="activeComposerSubjectSource = 'user'"
                                    >
                                        我的
                                    </button>
                                </div>
                                <div class="plan-picker-category" aria-label="主体筛选">
                                    <button
                                        :class="['plan-picker-category__trigger', { 'is-open': composerSubjectCategoryMenuOpen }]"
                                        type="button"
                                        @click.stop="toggleComposerSubjectCategoryMenu"
                                    >
                                        <span>{{ activeComposerSubjectCategoryLabel }}</span>
                                        <img :src="iconAssets.down" alt="" />
                                    </button>
                                    <div v-if="composerSubjectCategoryMenuOpen" class="plan-picker-category__menu" @click.stop>
                                        <button
                                            v-for="category in composerSubjectCategoryOptions"
                                            :key="category.value"
                                            :class="{ 'is-active': category.value === activeComposerSubjectCategory }"
                                            type="button"
                                            @click.stop="selectComposerSubjectCategory(category.value)"
                                        >
                                            {{ category.label }}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="plan-subject-grid">
                                <button
                                    v-for="subject in displayedComposerSubjectOptions"
                                    :key="subject.id"
                                    :class="['plan-subject-card', { 'is-create': subject.isCreate, 'is-selected': selectedComposerSubjectIds.includes(String(subject.id)) }]"
                                    type="button"
                                    @click.stop="selectComposerSubject(subject)"
                                >
                                    <template v-if="subject.isCreate">
                                        <span class="plan-subject-card__plus">+</span>
                                        <span>创建新主体</span>
                                    </template>
                                    <template v-else>
                                        <img :src="subject.image" :alt="subject.name" />
                                        <span>{{ subject.name }}</span>
                                    </template>
                                </button>
                            </div>
                        </div>
                    </div>
                </transition>

                <transition name="image-model-menu-fade">
                    <div
                        v-if="isComposerPanelOpen('style')"
                        class="plan-tool-panel plan-tool-panel--picker plan-tool-panel--style"
                        @click.stop
                    >
                        <div class="plan-picker-panel">
                            <div class="plan-picker-panel__head">
                                <strong>选择画风</strong>
                            </div>
                            <div class="plan-style-grid">
                                <button
                                    v-for="style in composerStyleOptions"
                                    :key="style.id"
                                    :class="{ 'is-active': selectedComposerStyle?.id === style.id }"
                                    type="button"
                                    @click.stop="selectComposerStyle(style)"
                                >
                                    <img :src="style.image" :alt="style.name" />
                                    <em v-if="style.isNew">New</em>
                                    <span>{{ style.name }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </transition>

                <transition name="image-model-menu-fade">
                    <div v-if="composerMentionMenuOpen" class="plan-mention-menu" @click.stop>
                        <section class="plan-mention-menu__group">
                            <p>角色</p>
                            <button
                                v-for="subject in scriptPlan.subjects"
                                :key="`subject-${subject.id || subject.name}`"
                                type="button"
                                @click="insertComposerMention(subject, '角色')"
                            >
                                <span>@</span>{{ subject.name }}
                            </button>
                            <em v-if="!scriptPlan.subjects.length">暂无可选角色</em>
                        </section>
                        <section class="plan-mention-menu__group">
                            <p>角色</p>
                            <button
                                v-for="scene in scriptPlan.locations"
                                :key="`scene-${scene.id || scene.name}`"
                                type="button"
                                @click="insertComposerMention(scene, '场景')"
                            >
                                <span>@</span>{{ scene.name }}
                            </button>
                            <em v-if="!scriptPlan.locations.length">暂无可选场景</em>
                        </section>
                    </div>
                </transition>
            </section>

            <button
                v-if="planDocumentVisible"
                class="split-divider"
                type="button"
                aria-label="拖动调整宽度"
                @pointerdown="startSplitDrag"
            ></button>

            <section v-if="planDocumentVisible" class="plan-document" aria-label="剧本文档">
                <header class="plan-document__header">
                    <div class="plan-document__title">
                        <ElIcon><Document /></ElIcon>
                        <div>
                            <strong>{{ scriptPlan.title }}</strong>
                            <span>{{ createdAtText }}</span>
                        </div>
                    </div>
                    <button type="button" aria-label="收起文档" @click="collapsePlanDocument">
                        <ElIcon><DArrowRight /></ElIcon>
                    </button>
                </header>

                <div
                    ref="documentScrollRef"
                    class="plan-document__scroll"
                    @scroll="updateActiveCatalog"
                    @wheel.passive="markStreamingUserInteraction"
                    @pointermove.passive="markStreamingUserInteraction"
                >
                    <section
                        v-if="hasScriptSection"
                        id="doc-section-script"
                        :class="['doc-section', 'doc-section--script', { 'doc-section--typing': streamingCursorSection === 'script' }]"
                    >
                        <h2>剧本内容</h2>
                        <article :class="['story-content-card', { 'is-open': scriptContentExpanded }]">
                            <div class="story-content-card__actions">
                                <button type="button" aria-label="复制剧本" @click="copyScriptContent">
                                    <ElIcon><CopyDocument /></ElIcon>
                                </button>
                                <button
                                    v-if="isScriptContentLong"
                                    type="button"
                                    :aria-label="scriptContentExpanded ? '收起剧本' : '展开剧本'"
                                    @click="scriptContentExpanded = !scriptContentExpanded"
                                >
                                    <ElIcon :class="{ 'is-open': scriptContentExpanded }"><ArrowDown /></ElIcon>
                                </button>
                            </div>
                            <p v-if="scriptPlan.type_judgement" class="story-content-card__meta">类型判断：{{ scriptPlan.type_judgement }}</p>
                            <p v-if="scriptPlan.core_theme" class="story-content-card__meta">核心主题：{{ scriptPlan.core_theme }}</p>
                            <p v-if="subjectNames" class="story-content-card__roles">主要角色：{{ subjectNames }}</p>
                            <ul>
                                <li
                                    v-for="(line, index) in scriptPlan.script_lines"
                                    :key="`${index}-${line}`"
                                    :class="{ 'is-typewriting-line': streamingCursorSection === 'script' && index === scriptPlan.script_lines.length - 1 }"
                                >
                                    {{ line }}
                                </li>
                            </ul>
                        </article>
                    </section>

                    <section
                        v-if="hasArtSection"
                        id="doc-section-art"
                        :class="['doc-section', { 'doc-section--typing': streamingCursorSection === 'art' }]"
                    >
                        <h2>画风设定</h2>
                        <div class="plain-copy">
                            <p v-if="scriptPlan.art_style.base_style">基础风格：{{ scriptPlan.art_style.base_style }}</p>
                            <p v-if="scriptPlan.art_style.visual_description">视觉描述：{{ scriptPlan.art_style.visual_description }}</p>
                            <p v-if="scriptPlan.art_style.color_tone">色彩基调：{{ scriptPlan.art_style.color_tone }}</p>
                            <p v-if="scriptPlan.art_style.lighting_design">光影设计：{{ scriptPlan.art_style.lighting_design }}</p>
                            <p v-if="scriptPlan.art_style.camera_texture">镜头质感：{{ scriptPlan.art_style.camera_texture }}</p>
                            <p v-if="scriptPlan.art_style.atmosphere_keywords?.length">氛围关键词：{{ scriptPlan.art_style.atmosphere_keywords.join('、') }}</p>
                        </div>
                    </section>

                    <section
                        v-if="hasSubjectSection"
                        id="doc-section-subjects"
                        :class="['doc-section', { 'doc-section--typing': streamingCursorSection === 'subjects' }]"
                    >
                        <h2>主体角色</h2>
                        <div class="plain-copy">
                            <article v-for="subject in scriptPlan.subjects" :key="subject.id || subject.name" class="prompt-detail">
                                <strong>{{ subject.name || '未命名角色' }}</strong>
                                <p v-if="subject.description">{{ subject.description }}</p>
                            </article>
                        </div>
                    </section>

                    <section
                        v-if="hasSceneSection"
                        id="doc-section-scenes"
                        :class="['doc-section', { 'doc-section--typing': streamingCursorSection === 'scenes' }]"
                    >
                        <h2>场景列表</h2>
                        <div class="plain-copy">
                            <article v-for="location in scriptPlan.locations" :key="location.id || location.name" class="prompt-detail">
                                <strong>{{ location.story_order ? `第${location.story_order}场` : '' }}{{ location.name || '未命名场景' }}</strong>
                                <p v-if="location.story_phase">剧情阶段：{{ location.story_phase }}</p>
                                <p v-if="location.description">{{ location.description }}</p>
                            </article>
                        </div>
                    </section>

                    <section
                        v-if="hasStoryboardSection"
                        id="doc-section-storyboard"
                        :class="['doc-section', 'storyboard-section', { 'doc-section--typing': streamingCursorSection === 'storyboard' }]"
                    >
                        <h2>分镜头</h2>
                        <article v-for="act in storyboardActs" :key="act.name" class="act-card">
                            <button class="act-card__header" type="button" @click="toggleAct(act.name)">
                                <span>{{ act.name }}</span>
                                <ElIcon :class="{ 'is-open': openedActs.includes(act.name) }"><ArrowDown /></ElIcon>
                            </button>
                            <div v-if="openedActs.includes(act.name)" class="shot-list">
                                <template v-for="(shot, shotIndex) in act.shots" :key="shot.shot_id">
                                    <button
                                        v-if="shotIndex > 0"
                                        class="shot-insert-btn"
                                        type="button"
                                        aria-label="更多操作"
                                        @click="insertShotAfter(act.shots[shotIndex - 1])"
                                    >
                                        <span>+</span>
                                    </button>
                                    <article :class="['shot-card', { 'is-editing': editingShotId === shot.shot_id }]">
                                    <div v-if="editingShotId === shot.shot_id" class="shot-card__actions shot-card__actions--editing">
                                        <button
                                            class="shot-edit-action shot-edit-action--cancel"
                                            type="button"
                                            :disabled="savingShotId === shot.shot_id"
                                            @click="cancelShotEdit(shot)"
                                        >
                                            新增分镜
                                        </button>
                                        <button
                                            class="shot-edit-action shot-edit-action--done"
                                            type="button"
                                            :disabled="savingShotId === shot.shot_id"
                                            @click="completeShotEdit"
                                        >
                                            <ElIcon v-if="savingShotId === shot.shot_id" class="shot-save-loading"><Loading /></ElIcon>
                                            新增分镜
                                        </button>
                                    </div>
                                    <div v-else class="shot-card__actions">
                                        <button type="button" aria-label="更多操作" @click="deleteShot(shot)">
                                            <ElIcon><Delete /></ElIcon>
                                        </button>
                                        <button type="button" aria-label="更多操作" @click="startShotEdit(shot)">
                                            <ElIcon><EditPen /></ElIcon>
                                        </button>
                                    </div>
                                    <h3>分镜 {{ storyboardDisplayNo(shot) }}</h3>
                                    <dl>
                                        <div>
                                            <dt>画面描述</dt>
                                            <dd>
                                                <textarea
                                                    v-if="editingShotId === shot.shot_id"
                                                    v-model="shot.visual_description"
                                                    class="shot-field shot-field--textarea"
                                                ></textarea>
                                                <span v-else>{{ shot.visual_description }}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>构图</dt>
                                            <dd>
                                                <textarea
                                                    v-if="editingShotId === shot.shot_id"
                                                    v-model="shot.composition"
                                                    class="shot-field shot-field--textarea"
                                                ></textarea>
                                                <span v-else>{{ shot.composition }}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>运镜</dt>
                                            <dd>
                                                <textarea
                                                    v-if="editingShotId === shot.shot_id"
                                                    v-model="shot.camera_movement"
                                                    class="shot-field shot-field--textarea"
                                                ></textarea>
                                                <span v-else>{{ shot.camera_movement }}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>动作</dt>
                                            <dd>
                                                <textarea
                                                    v-if="editingShotId === shot.shot_id"
                                                    v-model="shot.action"
                                                    class="shot-field shot-field--textarea"
                                                ></textarea>
                                                <span v-else>{{ shot.action || '无' }}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>对白/配音</dt>
                                            <dd>
                                                <div v-if="editingShotId === shot.shot_id" class="shot-dialogue-edit">
                                                    <div class="shot-select-dropdown" @click.stop>
                                                        <button
                                                            :class="[
                                                                'shot-select-card',
                                                                { 'is-open': openedShotSelect === shotSelectKey(shot.shot_id, 'voice_role') }
                                                            ]"
                                                            type="button"
                                                            @click="toggleShotSelect(shot.shot_id, 'voice_role')"
                                                        >
                                                            <span :class="{ 'is-placeholder': !shot.voice_role }">{{ voiceRoleText(shot.voice_role) }}</span>
                                                            <ElIcon><ArrowDown /></ElIcon>
                                                        </button>
                                                        <div
                                                            v-if="openedShotSelect === shotSelectKey(shot.shot_id, 'voice_role')"
                                                            class="shot-select-menu"
                                                        >
                                                            <button
                                                                v-for="option in voiceRoleOptions"
                                                                :key="option.value"
                                                                :class="{ 'is-active': shot.voice_role === option.value }"
                                                                type="button"
                                                                @click="selectShotOption(shot, 'voice_role', option.value)"
                                                            >
                                                                {{ option.label }}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        v-model="shot.dialogue"
                                                        class="shot-field shot-field--textarea"
                                                    ></textarea>
                                                </div>
                                                <span v-else>{{ shotVoiceText(shot) }}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>氛围</dt>
                                            <dd>
                                                <textarea
                                                    v-if="editingShotId === shot.shot_id"
                                                    v-model="shot.atmosphere"
                                                    class="shot-field shot-field--textarea"
                                                ></textarea>
                                                <span v-else>{{ shot.atmosphere || '无' }}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>画面类型</dt>
                                            <dd>
                                                <div v-if="editingShotId === shot.shot_id" class="shot-select-dropdown" @click.stop>
                                                    <button
                                                        :class="[
                                                            'shot-select-card',
                                                            { 'is-open': openedShotSelect === shotSelectKey(shot.shot_id, 'frame_type') }
                                                        ]"
                                                        type="button"
                                                        @click="toggleShotSelect(shot.shot_id, 'frame_type')"
                                                    >
                                                        <span>{{ shot.shot_type || frameTypeText(shot.frame_type) }}</span>
                                                        <ElIcon><ArrowDown /></ElIcon>
                                                    </button>
                                                    <div
                                                        v-if="openedShotSelect === shotSelectKey(shot.shot_id, 'frame_type')"
                                                        class="shot-select-menu"
                                                    >
                                                        <button
                                                            v-for="option in frameTypeOptions"
                                                            :key="option.value"
                                                            :class="{ 'is-active': shot.frame_type === option.value }"
                                                            type="button"
                                                            @click="selectShotOption(shot, 'frame_type', option.value)"
                                                        >
                                                            {{ option.label }}
                                                        </button>
                                                    </div>
                                                </div>
                                                <span v-else>{{ shot.shot_type || frameTypeText(shot.frame_type) }}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>时长</dt>
                                            <dd>
                                                <input
                                                    v-if="editingShotId === shot.shot_id"
                                                    v-model.number="shot.recommended_duration_seconds"
                                                    class="shot-field shot-field--input"
                                                    min="1"
                                                    type="number"
                                                />
                                                <span v-else>{{ shot.recommended_duration_seconds }}s</span>
                                            </dd>
                                        </div>
                                    </dl>
                                    </article>
                                    <button
                                        v-if="shotIndex === act.shots.length - 1"
                                        class="shot-insert-btn shot-insert-btn--tail"
                                        type="button"
                                        aria-label="更多操作"
                                        @click="insertShotAfter(shot)"
                                    >
                                        <span>+</span>
                                    </button>
                                </template>
                            </div>
                        </article>
                    </section>

                    <div
                        v-if="isTaskStreaming"
                        ref="streamTailRef"
                        :class="['streaming-tail', { 'is-empty': !hasStreamingDraftContent }]"
                    >
                        <span>{{ hasStreamingDraftContent ? '生成中' : '等待生成' }}</span>
                        <i></i><i></i><i></i>
                    </div>
                </div>

                <div class="plan-catalog">
                    <button
                        v-for="item in catalogItems"
                        :key="item.key"
                        :class="['plan-catalog__item', { 'is-active': item.key === activeCatalogKey }]"
                        type="button"
                        @click="scrollToCatalog(item.key, $event)"
                    >
                        {{ item.label }}
                    </button>
                </div>

                <footer class="plan-document__footer">
                    <div class="plan-ratio-picker" @click.stop>
                        <transition name="image-model-menu-fade">
                            <div v-if="ratioMenuOpen" class="plan-ratio-menu">
                                <button
                                    v-for="ratio in ratioOptions"
                                    :key="ratio.label"
                                    :class="{ 'is-active': ratio.label === selectedRatio.label }"
                                    type="button"
                                    @click="selectRatio(ratio)"
                                >
                                    <span class="plan-ratio-option__shape" :style="getRatioShapeStyle(ratio, 26, 24)"></span>
                                    <span>{{ ratio.label }}</span>
                                </button>
                            </div>
                        </transition>
                        <button
                            class="plan-ratio-trigger"
                            type="button"
                            :disabled="generatingImageTask"
                            @click="toggleRatioMenu"
                        >
                            <span class="plan-ratio-trigger__shape" :style="selectedRatioStyle"></span>
                            <span>{{ selectedRatio.label }}</span>
                            <ElIcon :class="{ 'is-open': ratioMenuOpen }"><ArrowDown /></ElIcon>
                        </button>
                    </div>
                    <div class="image-model-picker" @click.stop>
                        <transition name="image-model-menu-fade">
                            <div v-if="imageModelMenuOpen" class="image-model-menu">
                                <button
                                    v-for="model in imageModelOptions"
                                    :key="model.id"
                                    :class="{ 'is-active': selectedImageModel?.id === model.id }"
                                    type="button"
                                    @click="selectImageModel(model)"
                                >
                                    {{ model.name }}
                                </button>
                            </div>
                        </transition>
                        <button
                            class="image-model-trigger"
                            type="button"
                            :disabled="!imageModelOptions.length || generatingImageTask"
                            @click="toggleImageModelMenu"
                        >
                            <img class="image-model-trigger__icon" src="/short-drama/figma/icon/moxing.svg" alt="" />
                            <span>{{ selectedImageModel?.name || '默认模型' }}</span>
                            <ElIcon :class="{ 'is-open': imageModelMenuOpen }"><ArrowDown /></ElIcon>
                        </button>
                    </div>
                    <div v-if="imageResolutionOptions.length" class="image-resolution-picker" @click.stop>
                        <transition name="image-model-menu-fade">
                            <div v-if="imageResolutionMenuOpen" class="image-model-menu image-resolution-menu">
                                <button
                                    v-for="item in imageResolutionOptions"
                                    :key="item.value"
                                    :class="{ 'is-active': selectedImageResolution === item.value }"
                                    type="button"
                                    @click="selectImageResolution(item.value)"
                                >
                                    {{ item.label }}
                                </button>
                            </div>
                        </transition>
                        <button
                            class="image-resolution-trigger"
                            type="button"
                            :disabled="generatingImageTask"
                            aria-label="图片分辨率"
                            @click="toggleImageResolutionMenu"
                        >
                            <span>{{ selectedImageResolution }}</span>
                            <ElIcon :class="{ 'is-open': imageResolutionMenuOpen }"><ArrowDown /></ElIcon>
                        </button>
                    </div>
                    <button
                        class="generate-subject-scene"
                        type="button"
                        :disabled="!canGenerateSubjectSceneImages"
                        @click="generateSubjectSceneImages"
                    >
                        {{ imageActionText }}
                    </button>
                </footer>
            </section>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
    ArrowDown,
    CopyDocument,
    DArrowRight,
    Delete,
    Document,
    EditPen,
    Loading,
    MagicStick
} from '@element-plus/icons-vue'
import {
    createShortDramaScriptPlan,
    createShortDramaGeneration,
    getShortDramaAssets,
    getShortDramaGenerationLists,
    getShortDramaHome,
    getShortDramaProjectDetail,
    getShortDramaScriptPlanDetail,
    renameShortDramaProject,
    retryShortDramaScriptPlan,
    saveShortDramaProjectGenerationSettings,
    saveShortDramaStoryboard,
    sendShortDramaScriptMessage,
    streamShortDramaScriptPlan
} from '@/api/short_drama'
import { ElMessageBox } from 'element-plus'
import feedback from '@/utils/feedback'
import closeSmallIcon from '@/assets/images/icon/Close-small.svg'
import { resolveShortDramaResolution, shortDramaResolutionOptions } from '@/utils/short-drama-model-resolution'
import {
    readShortDramaImageModelSelection,
    writeShortDramaImageModelSelection
} from '@/utils/short-drama-cache'
import GlassSurface from '~/components/ai-workspace/GlassSurface.vue'
import ShortDramaFlowTopbar from '~/components/short-drama/ShortDramaFlowTopbar.vue'
import { useAiUserDisplay } from '~/composables/useAiUserDisplay'

definePageMeta({ layout: 'blank' })

type StoryboardShot = {
    shot_id: string
    sort?: number
    act: string
    scene_order?: number
    scene_name?: string
    time_of_day?: string
    interior_exterior?: 'interior' | 'exterior'
    visual_description: string
    composition: string
    camera_movement: string
    shot_type: string
    angle: string
    action: string
    result: string
    atmosphere: string
    voice_role: string
    dialogue: string
    frame_type: 'normal' | 'lip_sync'
    recommended_duration_seconds: number
    scene_ref_id: string
    subject_ref_ids: string[]
    prompt_summary?: string
    image_prompt?: string
    video_prompt?: string
    subject_prompt_summary?: string
    scene_prompt_summary?: string
}
type PromptEntity = {
    id: string
    name: string
    description: string
    story_order?: number
    story_phase?: string
    visual_prompt?: string
    unified_prompt?: string
    prompt_summary?: string
}
type ScriptPlanResult = {
    title: string
    created_at?: string
    createdAt?: string
    type_judgement?: string
    core_theme?: string
    opening_feedback: string
    planning_steps: string[]
    story_outline?: string
    script_lines: string[]
    art_style: {
        base_style: string
        visual_description: string
        color_tone?: string
        lighting_design?: string
        camera_texture?: string
        atmosphere_keywords?: string[]
    }
    subjects: PromptEntity[]
    locations: PromptEntity[]
    storyboard: StoryboardShot[]
    duration_stats?: {
        estimated_total_seconds?: number
        shot_count?: number
        scene_count?: number
        [key: string]: any
    }
    generation_settings?: {
        aspect_ratio?: string
        [key: string]: any
    }
}
type ModelOption = {
    id: string
    name: string
    description?: string
    channel_code?: string
    model_code?: string
    value?: string
    image?: string
    enabled?: boolean
    default_quality?: string
    quality_options?: unknown[]
    resolution_options?: unknown[]
    default_ratio?: string
    ratio_options?: string[]
}
type ModelGroup = {
    key: string
    label: string
    app_code?: string
    type?: string
    description?: string
    default?: string
    options: ModelOption[]
}
type SubjectOption = {
    id: string
    name: string
    image: string
    isCreate?: boolean
    source?: 'public' | 'user' | string
    category?: string
    gender?: string
    ageStage?: string
}
type SubjectCategoryOption = {
    value: string
    label: string
}
type StyleOption = {
    id: string
    name: string
    image: string
    isNew?: boolean
}
type RatioOption = {
    label: string
    width: number
    height: number
}
type PlanVersionCard = {
    id?: number
    version_no?: number
    title: string
    task_id: string
    meta: string
    is_current?: boolean
}
type PlanRevisionChatRecord = {
    id: string
    message: string
    task_id?: string
    status: 'submitting' | 'running' | 'success' | 'failed'
    error?: string
    created_at: number
    expanded?: boolean
}
type PlanDisplayStep = {
    id: string
    label: string
    children?: string[]
}
type CreationStepKey = 'script' | 'image' | 'video'
type FlowStepKey = 'script' | 'subject' | 'scene' | 'storyboard'
type VisualTaskType = 'subject_image' | 'scene_image'
type ComposerToolKey = 'attach' | 'model' | 'role' | 'style'
type ComposerPanelKind = 'model' | 'subject' | 'style'

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const { displayAvatarUrl } = useAiUserDisplay()
const taskId = computed(() => {
    const value = route.query.task_id
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
})
const projectId = computed(() => {
    const value = route.query.project_id
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
})
const pageMode = computed(() => {
    const value = route.query.mode
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
})
const isCreateDraftMode = computed(() => pageMode.value === 'create' && !taskId.value)
const extractSubjectMentions = (content: string) => {
    return Array.from(content.matchAll(/@([^\s@]+)/g)).map((match) => match[1]).filter(Boolean)
}
const completed = ref(false)
const planDocumentOpen = ref(true)
const streamingDocumentVisible = ref(false)
const openedActs = ref<string[]>([])
const workspaceRef = ref<HTMLElement | null>(null)
const chatRailRef = ref<HTMLElement | null>(null)
const documentScrollRef = ref<HTMLElement | null>(null)
const streamTailRef = ref<HTMLElement | null>(null)
const splitX = ref(877)
const isDragging = ref(false)
const hasDragged = ref(false)
const activeCatalogKey = ref('script')
const editingShotId = ref('')
const editingShotBackup = ref<StoryboardShot | null>(null)
const openedShotSelect = ref('')
const savingShotId = ref('')
const creatingShotId = ref('')
const storyboardDirty = ref(false)
const loadingTask = ref(false)
const taskStatus = ref<'pending' | 'queued' | 'running' | 'success' | 'failed' | 'canceled'>('pending')
const taskError = ref('')
const planMessage = ref('')
const sendingMessage = ref(false)
const canReviseCurrentPlan = computed(() => taskStatus.value === 'success' && !!scriptPlan.value.storyboard.length)
const canRetryCurrentPlan = computed(() => ['failed', 'canceled'].includes(taskStatus.value) || (!!taskError.value && !canReviseCurrentPlan.value))
const composerPlaceholder = computed(() =>
    isCreateDraftMode.value
        ? '输入故事灵感，让 AI 为你生成短剧脚本'
        : canRetryCurrentPlan.value
        ? '剧本生成失败，可点击下方按钮重新生成'
        : '告诉 AI 你想怎样调整剧本内容'
)
const composerMentionMenuOpen = ref(false)
const planVersions = ref<PlanVersionCard[]>([])
const revisionChatRecords = ref<PlanRevisionChatRecord[]>([])
const imageModelOptions = ref<ModelOption[]>([])
const selectedImageModel = ref<ModelOption | null>(null)
const imageModelMenuOpen = ref(false)
const selectedImageResolution = ref('')
const imageResolutionMenuOpen = ref(false)
const imageResolutionOptions = computed(() => shortDramaResolutionOptions(selectedImageModel.value))
const projectGenerationSettings = ref<Record<string, any>>({})
const fallbackRatioOptions: RatioOption[] = [
    { label: '9:16', width: 9, height: 16 },
    { label: '16:9', width: 16, height: 9 },
    { label: '1:1', width: 1, height: 1 },
    { label: '4:3', width: 4, height: 3 },
    { label: '3:4', width: 3, height: 4 }
]
const ratioOptions = ref<RatioOption[]>(fallbackRatioOptions)
const selectedRatio = ref<RatioOption>(fallbackRatioOptions[0])
const ratioMenuOpen = ref(false)
const generatingImageTask = ref(false)
const visualWorkflowStarted = ref(false)
const visualWorkflowTaskKeys = ref<string[]>([])
const thinkingSeconds = ref(0)
const streamContent = ref('')
const streamRunning = ref(false)
const lastStreamingUserInteractionAt = ref(0)
const userPromptExpanded = ref(false)
const scriptContentExpanded = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let thinkingTimer: ReturnType<typeof setInterval> | null = null
let streamingFollowTimer: ReturnType<typeof setTimeout> | null = null
let generationSettingsSaveTimer: ReturnType<typeof setTimeout> | null = null

const withPublicBase = (path: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/${path.replace(/^\/+/, '')}` || '/'
}
const asset = (name: string) => withPublicBase(`/short-drama/figma/${name}.png`)
const iconAsset = (name: string) => withPublicBase(`/short-drama/figma/icon/${name}.svg`)
const sharedDramaImage = asset('c043b523b8dbf7fb1bb877caef75c7ce0d4f1e06')
const iconAssets = {
    arrowUp: iconAsset('Arrow-up'),
    down: iconAsset('Down'),
    file: iconAsset('wenjian'),
    model: iconAsset('moxing'),
    roleTool: iconAsset('juese'),
    style: iconAsset('fengge')
}
const composerTools = [
    { key: 'attach' as const, label: '附件', icon: iconAssets.file },
    { key: 'role' as const, label: '主体', icon: iconAssets.roleTool },
    { key: 'style' as const, label: '画风', icon: iconAssets.style }
]
const baseCatalogItems = [
    { key: 'script', label: '剧本内容', target: 'doc-section-script' },
    { key: 'art', label: '画风设定', target: 'doc-section-art' },
    { key: 'subjects', label: '主体角色', target: 'doc-section-subjects' },
    { key: 'scenes', label: '场景列表', target: 'doc-section-scenes' },
    { key: 'storyboard', label: '分镜头', target: 'doc-section-storyboard' }
]
const frameTypeOptions: Array<{ label: string; value: StoryboardShot['frame_type'] }> = [
    { label: '普通画面', value: 'normal' },
    { label: '对口型', value: 'lip_sync' }
]

const glassSurfaceConfig = {
    borderWidth: 0.07,
    brightness: 50,
    opacity: 0.93,
    blur: 11,
    displace: 0.5,
    backgroundOpacity: 0,
    saturation: 1,
    distortionScale: -180,
    redOffset: 0,
    greenOffset: 10,
    blueOffset: 20,
    xChannel: 'R',
    yChannel: 'G',
    mixBlendMode: 'difference'
} as const
const creditGlassProps = {
    width: 'auto',
    height: 32,
    borderRadius: 20,
    ...glassSurfaceConfig
} as const
const planComposerProps = {
    width: '100%',
    height: '136px',
    borderRadius: 20,
    ...glassSurfaceConfig
} as const

const scriptFallbackModelOptions: ModelOption[] = [
    {
        id: 'script-planner-default',
        name: '剧本创作模型',
        description: '用于生成短剧大纲、人物设定和分镜脚本',
        image: sharedDramaImage
    }
]
const fallbackComposerModelGroups: ModelGroup[] = [
    {
        key: 'script_plan',
        label: '剧本创作模型',
        app_code: 'aigc_llm',
        type: 'llm',
        options: scriptFallbackModelOptions
    }
]
const fallbackComposerSubjectOptions: SubjectOption[] = [
    { id: 'create', name: '创建新主体', image: sharedDramaImage, isCreate: true }
]
const fallbackComposerStyleOptions: StyleOption[] = [
    { id: 'dunhuang', name: '敦煌壁画', image: sharedDramaImage, isNew: true },
    { id: 'wuxia', name: '国风武侠', image: sharedDramaImage, isNew: true },
    { id: 'modern-3d', name: '3D 写实', image: sharedDramaImage, isNew: true },
    { id: 'manga', name: '日漫风格', image: sharedDramaImage, isNew: true },
    { id: 'film', name: '电影质感', image: sharedDramaImage },
    { id: 'sunny', name: '清新明亮', image: sharedDramaImage }
]
const composerPanelOpen = ref<ComposerPanelKind | null>(null)
const composerModelGroups = ref<ModelGroup[]>(fallbackComposerModelGroups)
const selectedComposerModelMap = ref<Record<string, ModelOption>>({
    script_plan: scriptFallbackModelOptions[0]
})
const selectedComposerModel = ref<ModelOption>(scriptFallbackModelOptions[0])
const activeComposerSubjectSource = ref<'all' | 'public' | 'user'>('all')
const activeComposerSubjectCategory = ref('all')
const composerSubjectCategoryMenuOpen = ref(false)
const composerSubjectOptions = ref<SubjectOption[]>(fallbackComposerSubjectOptions)
const selectedComposerSubjectIds = ref<string[]>([])
const composerStyleOptions = ref<StyleOption[]>(fallbackComposerStyleOptions)
const selectedComposerStyle = ref<StyleOption | null>(null)
const composerMultiEpisode = ref(false)

const fallbackUserPrompt = computed(() => {
    const prompt = route.query.prompt
    return Array.isArray(prompt) ? prompt[0] || '' : String(prompt || '')
})
const userPrompt = computed(() => taskPrompt.value || fallbackUserPrompt.value)
const isUserPromptLong = computed(() => userPrompt.value.length > 180 || userPrompt.value.split(/\n/).length > 5)
const pageStyle = computed(() => ({ '--split-x': `${splitX.value}px` }))
const isTaskStreaming = computed(() => ['pending', 'queued', 'running'].includes(taskStatus.value) && !completed.value && !taskError.value)
const planDocumentVisible = computed(() => streamingDocumentVisible.value || (completed.value && planDocumentOpen.value))

const emptyScriptPlan: ScriptPlanResult = {
    title: '短剧脚本',
    created_at: '',
    type_judgement: '',
    core_theme: '',
    opening_feedback: '',
    planning_steps: [],
    script_lines: [],
        art_style: {
            base_style: '',
            visual_description: '',
            color_tone: '',
            lighting_design: '',
            camera_texture: '',
            atmosphere_keywords: []
        },
    subjects: [],
    locations: [],
    storyboard: [],
    duration_stats: {}
}
const createEmptyScriptPlan = (): ScriptPlanResult => ({
    ...emptyScriptPlan,
    art_style: {
        ...emptyScriptPlan.art_style,
        atmosphere_keywords: []
    },
    planning_steps: [],
    script_lines: [],
    subjects: [],
    locations: [],
    storyboard: [],
    duration_stats: {}
})
const scriptPlan = ref<ScriptPlanResult>(createEmptyScriptPlan())
const taskPrompt = ref('')
const storyboardDraft = ref<StoryboardShot[]>([])
const streamStepLabels = [
    '正在理解故事灵感',
    '正在规划角色和场景',
    '正在拆解剧情结构',
    '正在生成分镜脚本'
]

const createdAtText = computed(() => scriptPlan.value.created_at || scriptPlan.value.createdAt || '')
const hasPlanResult = computed(() => (
    taskStatus.value === 'success' ||
    scriptPlan.value.title !== emptyScriptPlan.title ||
    scriptPlan.value.script_lines.length > 0 ||
    scriptPlan.value.subjects.length > 0 ||
    scriptPlan.value.locations.length > 0 ||
    storyboardDraft.value.length > 0
))
const hasScriptSection = computed(() => scriptPlan.value.script_lines.some((line) => String(line || '').trim()))
const hasArtSection = computed(() => Boolean(scriptPlan.value.art_style.base_style || scriptPlan.value.art_style.visual_description))
const hasSubjectSection = computed(() => scriptPlan.value.subjects.length > 0)
const hasSceneSection = computed(() => scriptPlan.value.locations.length > 0)
const hasStoryboardSection = computed(() => storyboardDraft.value.length > 0)
const hasStreamingDraftContent = computed(() => hasScriptSection.value || hasArtSection.value || hasSubjectSection.value || hasSceneSection.value || hasStoryboardSection.value)
const hasCompleteScriptPlanContent = computed(() => (
    hasScriptSection.value &&
    hasSubjectSection.value &&
    hasSceneSection.value &&
    hasStoryboardSection.value
))
const hasCompleteScriptPlan = computed(() => (
    taskStatus.value === 'success' &&
    completed.value &&
    !taskError.value &&
    hasCompleteScriptPlanContent.value
))
const sectionHasContent = (key: string) => {
    if (key === 'script') return hasScriptSection.value
    if (key === 'art') return hasArtSection.value
    if (key === 'subjects') return hasSubjectSection.value
    if (key === 'scenes') return hasSceneSection.value
    if (key === 'storyboard') return hasStoryboardSection.value
    return false
}
const catalogItems = computed(() => baseCatalogItems.filter((item) => sectionHasContent(item.key)))
const streamingCursorSection = computed(() => {
    if (!isTaskStreaming.value || !streamingDocumentVisible.value) return ''
    if (hasStoryboardSection.value) return 'storyboard'
    if (hasSceneSection.value) return 'scenes'
    if (hasSubjectSection.value) return 'subjects'
    if (hasArtSection.value) return 'art'
    if (hasScriptSection.value) return 'script'
    return ''
})
const visibleSteps = computed(() => completed.value ? scriptPlan.value.planning_steps : scriptPlan.value.planning_steps.slice(0, 3))
const isStreamingRevisionRecord = (record: PlanRevisionChatRecord) => {
    const recordTaskId = String(record.task_id || '')
    if (!recordTaskId || recordTaskId !== taskId.value) return false
    return isTaskStreaming.value && ['submitting', 'running'].includes(record.status)
}
const hasStreamingRevisionRecord = computed(() => revisionChatRecords.value.some((record) => isStreamingRevisionRecord(record)))
const isInitialTaskStreaming = computed(() => isTaskStreaming.value && !hasStreamingRevisionRecord.value)
const showInitialAgentReply = computed(() => (
    isInitialTaskStreaming.value ||
    Boolean(taskError.value) ||
    Boolean(initialPlanCard.value) ||
    Boolean(initialReplyMainText.value) ||
    initialReplySteps.value.length > 0
))
const streamStepItems = computed(() => streamStepLabels.map((label, index) => {
    const startAt = index * 3
    const doneAt = startAt + 3
    const done = completed.value || thinkingSeconds.value >= doneAt
    const active = isTaskStreaming.value && !done && thinkingSeconds.value >= startAt
    return { label, done, active }
}))
const getRatioShapeStyle = (ratio: RatioOption, maxWidth = 22, maxHeight = 22) => {
    const widthValue = Math.max(1, Number(ratio.width || 1))
    const heightValue = Math.max(1, Number(ratio.height || 1))
    const scale = Math.min(maxWidth / widthValue, maxHeight / heightValue)
    const width = Math.max(10, widthValue * scale)
    const height = Math.max(10, heightValue * scale)
    return {
        width: `${Number(width.toFixed(2))}px`,
        height: `${Number(height.toFixed(2))}px`
    }
}
const selectedRatioStyle = computed(() => getRatioShapeStyle(selectedRatio.value))
const firstStoryboardAct = computed(() => storyboardDraft.value[0]?.act || '')
const subjectNames = computed(() => scriptPlan.value.subjects.map((subject) => subject.name).filter(Boolean).join('、'))
const isScriptContentLong = computed(() => {
    const lines = scriptPlan.value.script_lines || []
    return lines.length > 7 || lines.join('').length > 320
})
const imageActionText = computed(() => {
    if (generatingImageTask.value) return '生成中...'
    if (visualWorkflowStarted.value) return storyboardDirty.value ? '保存并继续创作' : '继续创作'
    return '生成主体场景图'
})
const canGenerateSubjectSceneImages = computed(() => (
    hasCompleteScriptPlan.value &&
    !generatingImageTask.value &&
    (visualWorkflowStarted.value || !!scriptPlan.value.subjects.length || !!scriptPlan.value.locations.length)
))
const voiceRoleOptions = computed(() => [
    { label: '无', value: '' },
    ...scriptPlan.value.subjects
        .map((subject) => subject.name)
        .filter(Boolean)
        .map((name) => ({ label: name, value: name }))
])
const activeCreationStep = computed<CreationStepKey>(() => 'script')
const creationSteps = computed(() => [
    { key: 'script' as const, index: '01', label: '剧本内容', done: completed.value, enabled: true },
    { key: 'image' as const, index: '02', label: '主体场景图', done: false, enabled: hasCompleteScriptPlan.value },
    { key: 'video' as const, index: '03', label: '视频创作', done: false, enabled: false }
])
const normalizedStoryboardTextKey = (value: any) => String(value || '')
    .toLowerCase()
    .replace(/[\s,，、;；:：.!！？（）()\"'‘’“”\-—_]/g, '')
const storyboardLocationForShot = (shot: StoryboardShot) => {
    const refId = String(shot.scene_ref_id || '').trim()
    if (refId) {
        const byId = scriptPlan.value.locations.find((location) => String(location.id || '') === refId)
        if (byId) return byId
    }
    const sceneName = String(shot.scene_name || '').trim()
    if (sceneName) {
        const byName = scriptPlan.value.locations.find((location) => String(location.name || '').trim() === sceneName)
        if (byName) return byName
    }
    const order = Number(shot.scene_order || 0)
    if (order > 0) {
        const byOrder = scriptPlan.value.locations.find((location) => Number(location.story_order || 0) === order)
        if (byOrder) return byOrder
    }
    return null
}
const storyboardSceneGroupKey = (shot: StoryboardShot, index: number) => {
    const location = storyboardLocationForShot(shot)
    if (location?.id) return `location:${location.id}`
    if (shot.scene_ref_id) return `ref:${shot.scene_ref_id}`
    if (shot.scene_name) return `scene:${normalizedStoryboardTextKey(shot.scene_name)}`
    const actBase = String(shot.act || '').replace(/\s+(清晨|早晨|上午|下午|傍晚|夜晚|黄昏|深夜)?\s*(室内|室外)$/u, '')
    return actBase ? `act:${normalizedStoryboardTextKey(actBase)}` : `shot:${index}`
}
const storyboardActDisplayName = (shot: StoryboardShot, index: number) => {
    const location = storyboardLocationForShot(shot)
    const order = Number(location?.story_order || shot.scene_order || index + 1)
    const sceneName = String(location?.name || shot.scene_name || '').trim()
    const timeOfDay = String(shot.time_of_day || '').trim()
    const space = shot.interior_exterior === 'interior' ? '室内' : (shot.interior_exterior === 'exterior' ? '室外' : '')
    const suffix = [sceneName, timeOfDay, space].filter(Boolean).join(' ')
    if (suffix) return `第${Math.max(1, order)}幕：${suffix}`
    return shot.act || '未分幕'
}
const numericStoryboardOrder = (value: any) => {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) return numeric
    const match = String(value || '').match(/\d+/)
    return match ? Number(match[0]) : 0
}
const storyboardShotOrder = (shot: StoryboardShot, index = 0) => {
    const sort = numericStoryboardOrder(shot.sort)
    if (sort > 0) return sort
    const shotId = numericStoryboardOrder(shot.shot_id)
    return shotId > 0 ? shotId : index + 1
}
const compareStoryboardShots = (a: StoryboardShot, b: StoryboardShot) => {
    const sceneA = Number(a.scene_order || 0)
    const sceneB = Number(b.scene_order || 0)
    if (sceneA > 0 && sceneB > 0 && sceneA !== sceneB) return sceneA - sceneB
    return storyboardShotOrder(a) - storyboardShotOrder(b)
}
const storyboardActs = computed(() => {
    const groups = new Map<string, { name: string; shots: StoryboardShot[]; sortOrder: number; firstShotOrder: number }>()
    const sortedShots = storyboardDraft.value
        .map((shot, index) => ({ shot, index }))
        .sort((a, b) => {
            const sceneA = Number(storyboardLocationForShot(a.shot)?.story_order || a.shot.scene_order || 0)
            const sceneB = Number(storyboardLocationForShot(b.shot)?.story_order || b.shot.scene_order || 0)
            if (sceneA > 0 && sceneB > 0 && sceneA !== sceneB) return sceneA - sceneB
            return storyboardShotOrder(a.shot, a.index) - storyboardShotOrder(b.shot, b.index)
        })
    sortedShots.forEach(({ shot, index }) => {
        const groupKey = storyboardSceneGroupKey(shot, index)
        const actName = storyboardActDisplayName(shot, index)
        if (!groups.has(groupKey)) {
            const location = storyboardLocationForShot(shot)
            groups.set(groupKey, {
                name: actName,
                shots: [],
                sortOrder: Number(location?.story_order || shot.scene_order || index + 1),
                firstShotOrder: storyboardShotOrder(shot, index)
            })
        }
        const group = groups.get(groupKey)!
        group.shots.push({
            ...shot,
            act: group.name,
            scene_name: String(storyboardLocationForShot(shot)?.name || shot.scene_name || '')
        })
    })
    return Array.from(groups.values())
        .filter(({ shots }) => shots.length > 0)
        .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.firstShotOrder - b.firstShotOrder))
        .map(({ name, shots }) => ({ name, shots }))
})
const storyboardDisplayNoMap = computed(() => {
    const map = new Map<string, number>()
    let displayNo = 1
    storyboardActs.value.forEach((act) => {
        act.shots.forEach((shot) => {
            map.set(String(shot.shot_id), displayNo)
            displayNo += 1
        })
    })
    return map
})
const storyboardDisplayNo = (shot: StoryboardShot) => storyboardDisplayNoMap.value.get(String(shot.shot_id)) || storyboardShotOrder(shot)
const generatedPlanCards = computed<PlanVersionCard[]>(() => {
    const cards = new Map<string, PlanVersionCard>()
    planVersions.value.forEach((version) => {
        if (!version.task_id) return
        const versionLabel = version.version_no ? `版本 ${version.version_no}` : '历史版本'
        cards.set(version.task_id, {
            ...version,
            title: version.title || scriptPlan.value.title || '短剧脚本',
            meta: `${version.task_id === taskId.value ? '当前版本' : (version.is_current ? '最新版本' : versionLabel)}${version.meta ? ` · ${version.meta}` : ''}`
        })
    })
    if (completed.value && taskId.value && !cards.has(taskId.value)) {
        cards.set(taskId.value, {
            title: scriptPlan.value.title || '短剧脚本',
            task_id: taskId.value,
            meta: createdAtText.value || '刚刚创建',
            is_current: true
        })
    }
    return Array.from(cards.values()).sort((a, b) => {
        if (a.task_id === taskId.value) return -1
        if (b.task_id === taskId.value) return 1
        return Number(b.version_no || 0) - Number(a.version_no || 0)
    })
})
const revisionTaskIdSet = computed(() => new Set(revisionChatRecords.value.map((record) => record.task_id).filter(Boolean) as string[]))
const planCardByTaskId = computed(() => {
    const map = new Map<string, PlanVersionCard>()
    generatedPlanCards.value.forEach((card) => {
        if (card.task_id) map.set(card.task_id, card)
    })
    return map
})
const initialPlanCard = computed(() => {
    const initialCards = generatedPlanCards.value
        .filter((card) => !revisionTaskIdSet.value.has(card.task_id))
        .sort((a, b) => Number(a.version_no || 0) - Number(b.version_no || 0))
    if (initialCards.length) return initialCards[0]
    if (!revisionChatRecords.value.length) return generatedPlanCards.value[0] || null
    return null
})
const versionCardForRevision = (record: PlanRevisionChatRecord) => record.task_id
    ? planCardByTaskId.value.get(record.task_id) || null
    : null
const versionCardButtonText = (card: PlanVersionCard) => card.task_id === taskId.value && planDocumentVisible.value ? '收起' : '查看'
const revisionVersionCardButtonText = (record: PlanRevisionChatRecord) => {
    const card = versionCardForRevision(record)
    return card ? versionCardButtonText(card) : '查看'
}
const openRevisionVersionCard = (record: PlanRevisionChatRecord) => {
    const card = versionCardForRevision(record)
    if (card) openPlanVersionCard(card)
}
const displayNameList = (items: Array<{ name?: string }>, fallback: string, limit = 3) => {
    const names = items.map((item) => String(item.name || '').trim()).filter(Boolean)
    if (!names.length) return fallback
    const visible = names.slice(0, limit).join('、')
    return names.length > limit ? `${visible}等` : visible
}
const planTitleText = (title: string) => {
    const value = String(title || '').trim() || '未命名'
    return value.replace(/^《/, '').replace(/》$/, '')
}
const buildPlanDisplaySteps = (): PlanDisplayStep[] => {
    const title = planTitleText(scriptPlan.value.title)
    const style = scriptPlan.value.art_style.base_style || scriptPlan.value.type_judgement || '默认风格'
    const subjectLabel = displayNameList(scriptPlan.value.subjects, '暂无主体角色')
    const sceneLabel = displayNameList(scriptPlan.value.locations, '暂无场景')
    const sceneCount = scriptPlan.value.locations.length
    const shotCount = storyboardDraft.value.length
    const backendDuration = Number(scriptPlan.value.duration_stats?.estimated_total_seconds || 0)
    const duration = Math.round(backendDuration || storyboardDraft.value.reduce((total, shot) => total + Number(shot.recommended_duration_seconds || 0), 0))
    const steps: PlanDisplayStep[] = [
        {
            id: 'script',
            label: `已生成「${title}」的完整剧本`
        },
        {
            id: 'style',
            label: `已确认「${style}」画风`,
        },
        {
            id: 'subjects',
            label: `已整理 ${subjectLabel} 主体`,
            children: ['主体关系清晰', '可用于后续生图']
        },
        {
            id: 'scenes',
            label: sceneCount ? `已规划 ${sceneCount} 个场景：${sceneLabel}` : `已规划场景：${sceneLabel}`,
            children: ['场景顺序清晰', '可用于分镜生成']
        }
    ]
    if (shotCount) {
        steps.push({
            id: 'storyboard',
            label: `已生成 ${shotCount} 个分镜${duration ? `，总时长约 ${duration}s` : ''}`,
            children: ['剧情顺序完整', '可进入主体场景图创作']
        })
    } else if (visibleSteps.value.length) {
        steps.push(...visibleSteps.value.slice(0, 2).map((label, index) => ({
            id: `planning-${index}`,
            label
        })))
    }
    return steps
}
const currentPlanDisplaySteps = computed(() => buildPlanDisplaySteps())
const initialReplyMainText = computed(() => {
    if (hasStreamingRevisionRecord.value && initialPlanCard.value) return '正在生成新的剧本版本，请稍候'
    if (taskError.value) return taskError.value
    if (scriptPlan.value.opening_feedback) return scriptPlan.value.opening_feedback
    if (initialPlanCard.value) return '已保留原版本，新剧本生成完成后可切换查看'
    return ''
})
const initialReplySteps = computed<PlanDisplayStep[]>(() => {
    if (hasStreamingRevisionRecord.value && initialPlanCard.value) {
        return [{ id: 'kept', label: '原剧本版本已保留' }]
    }
    return currentPlanDisplaySteps.value.length ? currentPlanDisplaySteps.value : visibleSteps.value.map((label, index) => ({
        id: `step-${index}`,
        label
    }))
})
const revisionReplySteps = (record: PlanRevisionChatRecord): PlanDisplayStep[] => {
    if (record.status === 'failed') return []
    if (record.task_id === taskId.value && currentPlanDisplaySteps.value.length) return currentPlanDisplaySteps.value
    const card = versionCardForRevision(record)
    if (card) return [{ id: 'saved', label: '剧本版本已保存，可继续创作' }]
    return []
}
const revisionStorageKey = () => `short-drama-plan-revisions:${projectId.value || 'unknown'}`
const persistRevisionChatRecords = () => {
    if (!process.client || !projectId.value) return
    const records = revisionChatRecords.value.slice(-20).map((record) => ({
        ...record,
        expanded: Boolean(record.expanded)
    }))
    window.localStorage.setItem(revisionStorageKey(), JSON.stringify(records))
}
const loadRevisionChatRecords = () => {
    if (!process.client || !projectId.value) return
    try {
        const parsed = JSON.parse(window.localStorage.getItem(revisionStorageKey()) || '[]')
        revisionChatRecords.value = Array.isArray(parsed)
            ? parsed
                .filter((record) => record?.id && record?.message)
                .filter((record) => !String(record.id).startsWith('resume-') && String(record.message || '') !== '正在恢复修改记录')
                .map((record) => ({
                    id: String(record.id),
                    message: String(record.message || ''),
                    task_id: record.task_id ? String(record.task_id) : '',
                    status: ['submitting', 'running', 'success', 'failed'].includes(record.status) ? record.status : 'success',
                    error: String(record.error || ''),
                    created_at: Number(record.created_at || Date.now()),
                    expanded: Boolean(record.expanded)
                }))
            : []
    } catch {
        revisionChatRecords.value = []
    }
}
const scrollChatToBottom = async () => {
    await nextTick()
    const rail = chatRailRef.value
    if (!rail) return
    rail.scrollTo({
        top: rail.scrollHeight,
        behavior: 'smooth'
    })
}
const scrollDocumentToLatest = async (behavior: ScrollBehavior = 'auto') => {
    await nextTick()
    const scrollEl = documentScrollRef.value
    if (!scrollEl) return
    scrollEl.scrollTo({
        top: scrollEl.scrollHeight,
        behavior
    })
    updateActiveCatalog()
}
const clearStreamingFollowTimer = () => {
    if (streamingFollowTimer) clearTimeout(streamingFollowTimer)
    streamingFollowTimer = null
}
const markStreamingUserInteraction = () => {
    if (!isTaskStreaming.value) return
    lastStreamingUserInteractionAt.value = Date.now()
}
const scheduleStreamingFollow = (behavior: ScrollBehavior = 'smooth') => {
    clearStreamingFollowTimer()
    if (!isTaskStreaming.value) return
    const wait = Math.max(0, 3000 - (Date.now() - lastStreamingUserInteractionAt.value))
    streamingFollowTimer = setTimeout(() => {
        streamingFollowTimer = null
        if (!isTaskStreaming.value) return
        if (Date.now() - lastStreamingUserInteractionAt.value < 3000) {
            scheduleStreamingFollow(behavior)
            return
        }
        scrollDocumentToLatest(behavior)
    }, wait)
}
const followStreamingOutput = (behavior: ScrollBehavior = 'auto') => {
    if (!isTaskStreaming.value) return
    streamingDocumentVisible.value = true
    scrollChatToBottom()
    if (Date.now() - lastStreamingUserInteractionAt.value < 3000) {
        scheduleStreamingFollow('smooth')
        return
    }
    clearStreamingFollowTimer()
    scrollDocumentToLatest(behavior)
}
const isRevisionMessageLong = (message: string) => message.length > 180 || message.split(/\n/).length > 5
const toggleRevisionRecord = (record: PlanRevisionChatRecord) => {
    record.expanded = !record.expanded
    persistRevisionChatRecords()
}
const appendRevisionRecord = (message: string) => {
    const record: PlanRevisionChatRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        status: 'submitting',
        created_at: Date.now()
    }
    revisionChatRecords.value = [...revisionChatRecords.value, record].slice(-20)
    persistRevisionChatRecords()
    scrollChatToBottom()
    return record.id
}
const updateRevisionRecord = (id: string, patch: Partial<PlanRevisionChatRecord>) => {
    revisionChatRecords.value = revisionChatRecords.value.map((record) =>
        record.id === id ? { ...record, ...patch } : record
    )
    persistRevisionChatRecords()
}
const syncRevisionRecordWithTask = (rawTaskId: unknown, status: typeof taskStatus.value, error = '') => {
    const targetTaskId = String(rawTaskId || '')
    if (!targetTaskId) return
    const normalized = status === 'success'
        ? 'success'
        : (status === 'failed' || status === 'canceled' ? 'failed' : 'running')
    let changed = false
    revisionChatRecords.value = revisionChatRecords.value.map((record) => {
        if (record.task_id !== targetTaskId) return record
        changed = true
        return {
            ...record,
            status: normalized,
            error: normalized === 'failed' ? (error || record.error || '生成失败') : record.error
        }
    })
    if (changed) persistRevisionChatRecords()
}
const revisionRecordStatusText = (record: PlanRevisionChatRecord) => {
    if (record.status === 'submitting') return '正在提交...'
    if (record.status === 'running') return '正在生成新剧本...'
    if (record.status === 'failed') return record.error || '剧本修改失败'
    return '正在根据你的要求生成新剧本'
}

const completePlan = () => {
    if (!hasCompleteScriptPlanContent.value) {
        completed.value = false
        if (taskStatus.value === 'success') {
            taskStatus.value = 'failed'
            taskError.value = taskError.value || 'AI 返回内容不完整，请重试'
        }
        return
    }
    completed.value = true
    planDocumentOpen.value = true
    scriptContentExpanded.value = false
    openedActs.value = storyboardActs.value.map((act) => act.name)
    nextTick(() => {
        syncSplitToViewport()
        updateActiveCatalog()
    })
}
const collapsePlanDocument = () => {
    planDocumentOpen.value = false
    streamingDocumentVisible.value = false
}
const resetCurrentPlanDraft = () => {
    scriptPlan.value = createEmptyScriptPlan()
    storyboardDraft.value = []
    storyboardDirty.value = false
    openedActs.value = []
    activeCatalogKey.value = 'script'
    scriptContentExpanded.value = false
    streamContent.value = ''
}
const normalizePlanVersionCard = (item: any): PlanVersionCard | null => {
    const task_id = String(item?.task_id || '')
    if (!task_id) return null
    return {
        id: Number(item?.id || 0),
        version_no: Number(item?.version_no || 0),
        title: String(item?.title || scriptPlan.value.title || '未命名剧本'),
        task_id,
        meta: String(item?.created_at || item?.update_time || ''),
        is_current: Boolean(item?.is_current)
    }
}
const loadPlanVersions = async () => {
    if (!projectId.value) return
    try {
        const project = await getShortDramaProjectDetail(projectId.value)
        const versions = Array.isArray(project?.versions) ? project.versions : []
        planVersions.value = versions
            .map(normalizePlanVersionCard)
            .filter(Boolean) as PlanVersionCard[]
    } catch {}
}
const openPlanVersionCard = async (card: PlanVersionCard) => {
    if (!card.task_id) return
    if (card.task_id === taskId.value) {
        if (planDocumentVisible.value) {
            collapsePlanDocument()
        } else {
            completePlan()
        }
        return
    }
    stopPolling()
    stopThinkingTimer()
    streamRunning.value = false
    streamContent.value = ''
    streamingDocumentVisible.value = false
    completed.value = false
    planDocumentOpen.value = true
    taskStatus.value = 'pending'
    taskError.value = ''
    await router.replace({
        path: '/ai/short-drama/plan',
        query: {
            project_id: projectId.value,
            task_id: card.task_id
        }
    })
    await loadTaskDetail()
    await loadVisualWorkflowState()
}
const notifyComposerInherited = (message: string) => {
    feedback.msgWarning(message)
}
const closeComposerConfigPanels = () => {
    composerPanelOpen.value = null
    composerSubjectCategoryMenuOpen.value = false
}
const isComposerPanelOpen = (kind: ComposerPanelKind) => composerPanelOpen.value === kind
const composerToolPanelKind = (key: ComposerToolKey): ComposerPanelKind | null => {
    if (key === 'model') return 'model'
    if (key === 'role') return 'subject'
    if (key === 'style') return 'style'
    return null
}
const isComposerToolActive = (key: ComposerToolKey) => {
    const kind = composerToolPanelKind(key)
    return kind ? isComposerPanelOpen(kind) : false
}
const toggleComposerPanel = (kind: ComposerPanelKind) => {
    composerMentionMenuOpen.value = false
    composerPanelOpen.value = isComposerPanelOpen(kind) ? null : kind
}
const handleComposerTool = (key: ComposerToolKey) => {
    if (key === 'attach') {
        notifyComposerInherited('附件暂不支持，请直接输入创作或修改要求')
        return
    }
    const kind = composerToolPanelKind(key)
    if (kind) toggleComposerPanel(kind)
}
const enabledComposerModelGroups = computed(() =>
    composerModelGroups.value
        .filter((group) => group.key === 'script_plan')
        .map((group) => ({
            ...group,
            options: (group.options || []).filter((model) => model.enabled !== false)
        }))
        .filter((group) => group.options.length)
)
const ensureSelectedComposerModels = () => {
    const next = { ...selectedComposerModelMap.value }
    enabledComposerModelGroups.value.forEach((group) => {
        const current = next[group.key]
        const matched = current
            ? group.options.find((model) => model.id === current.id || model.value === current.value)
            : null
        next[group.key] = matched || group.options.find((model) => model.id === group.default) || group.options[0]
    })
    selectedComposerModelMap.value = next
    selectedComposerModel.value = next.script_plan || enabledComposerModelGroups.value[0]?.options[0] || scriptFallbackModelOptions[0]
}
const isComposerModelSelected = (groupKey: string, model: ModelOption) => {
    const selected = selectedComposerModelMap.value[groupKey]
    return Boolean(selected && (selected.id === model.id || selected.value === model.value))
}
const selectComposerModel = (groupKey: string, model: ModelOption) => {
    selectedComposerModelMap.value = {
        ...selectedComposerModelMap.value,
        [groupKey]: model
    }
    if (groupKey === 'script_plan') selectedComposerModel.value = model
}
const selectedComposerModelPayload = computed(() =>
    Object.entries(selectedComposerModelMap.value)
        .filter(([key]) => key === 'script_plan')
        .reduce((payload: Record<string, any>, [key, model]) => {
            payload[key] = {
                id: model.id,
                value: model.value || model.id,
                model_code: model.model_code || model.channel_code || model.value || model.id
            }
            return payload
        }, {})
)
const legacyComposerSubjectNames = new Set(['清冷师妹', '赛艇少年'])
const composerSubjectCategoryLabels: Record<string, string> = {
    character: '人物',
    person: '人物',
    people: '人物',
    role: '人物',
    prop: '物品',
    object: '物品',
    item: '物品',
    scene: '场景',
    location: '场景',
    environment: '场景'
}
const composerSubjectCategoryValue = (category?: string) => String(category || '').trim()
const composerSubjectCategoryLabel = (category: string) => composerSubjectCategoryLabels[category] || category || '未分类'
const shouldHideComposerSubjectOption = (subject: SubjectOption) => legacyComposerSubjectNames.has(String(subject.name || '').trim())
const sourceFilteredComposerSubjectOptions = computed(() =>
    composerSubjectOptions.value.filter((subject) => {
        if (subject.isCreate) return false
        if (shouldHideComposerSubjectOption(subject)) return false
        if (activeComposerSubjectSource.value === 'all') return true
        return subject.source === activeComposerSubjectSource.value
    })
)
const composerSubjectCategoryOptions = computed<SubjectCategoryOption[]>(() => {
    const options: SubjectCategoryOption[] = [{ value: 'all', label: '全部' }]
    const seen = new Set<string>()
    sourceFilteredComposerSubjectOptions.value.forEach((subject) => {
        const value = composerSubjectCategoryValue(subject.category)
        if (!value || seen.has(value)) return
        seen.add(value)
        options.push({ value, label: composerSubjectCategoryLabel(value) })
    })
    return options
})
const activeComposerSubjectCategoryLabel = computed(() =>
    composerSubjectCategoryOptions.value.find((option) => option.value === activeComposerSubjectCategory.value)?.label
    || composerSubjectCategoryOptions.value[0]?.label
    || '鍏ㄩ儴'
)
const displayedComposerSubjectOptions = computed(() => {
    const createItems = activeComposerSubjectSource.value === 'public'
        ? []
        : composerSubjectOptions.value.filter((subject) => subject.isCreate)
    const subjects = sourceFilteredComposerSubjectOptions.value.filter((subject) => {
        if (activeComposerSubjectCategory.value === 'all') return true
        return composerSubjectCategoryValue(subject.category) === activeComposerSubjectCategory.value
    })
    return [...createItems, ...subjects]
})
const toggleComposerSubjectCategoryMenu = () => {
    composerSubjectCategoryMenuOpen.value = !composerSubjectCategoryMenuOpen.value
}
const selectComposerSubjectCategory = (value: string) => {
    activeComposerSubjectCategory.value = value
    composerSubjectCategoryMenuOpen.value = false
}
const selectComposerSubject = async (subject: SubjectOption) => {
    if (subject.isCreate) return
    const subjectId = String(subject.id || '')
    if (subjectId && !selectedComposerSubjectIds.value.includes(subjectId)) {
        selectedComposerSubjectIds.value = [...selectedComposerSubjectIds.value, subjectId]
    }
    const token = `@${subject.name}`
    const current = planMessage.value.trim()
    planMessage.value = current ? `${current} ${token}` : token
    closeComposerConfigPanels()
    await nextTick()
    const textarea = document.querySelector<HTMLTextAreaElement>('.plan-composer textarea')
    textarea?.focus()
}
const selectComposerStyle = (style: StyleOption) => {
    selectedComposerStyle.value = style
    closeComposerConfigPanels()
}
const clearSelectedComposerStyle = () => {
    selectedComposerStyle.value = null
}
const normalizeComposerModelGroup = (group: any): ModelGroup => ({
    key: String(group?.key || ''),
    label: String(group?.label || '模型'),
    app_code: group?.app_code,
    type: group?.type,
    description: group?.description,
    default: group?.default,
    options: (Array.isArray(group?.options) ? group.options : []).map((model: any) => ({
        ...model,
        id: String(model?.id || model?.value || model?.model_code || model?.channel_code || ''),
        value: String(model?.value || model?.id || model?.model_code || model?.channel_code || ''),
        model_code: String(model?.model_code || model?.value || model?.id || ''),
        channel_code: String(model?.channel_code || model?.channel || model?.value || model?.id || ''),
        name: String(model?.name || model?.id || '默认模型'),
        description: String(model?.description || ''),
        image: model?.image || sharedDramaImage,
        enabled: model?.enabled !== false
    }))
})
const loadComposerConfig = async () => {
    try {
        const data = await getShortDramaHome()
        if (Array.isArray(data?.model_groups) && data.model_groups.length) {
            composerModelGroups.value = data.model_groups
                .map(normalizeComposerModelGroup)
                .filter((group: ModelGroup) => group.key === 'script_plan' && group.options.length)
            ensureSelectedComposerModels()
        } else if (Array.isArray(data?.models) && data.models.length) {
            const options = data.models
                .map((model: any) => normalizeComposerModelGroup({ key: 'script_plan', label: '剧本创作模型', options: [model] }).options[0])
                .filter((model: ModelOption) => model.enabled !== false)
            if (options.length) {
                composerModelGroups.value = [{ ...fallbackComposerModelGroups[0], options }]
                ensureSelectedComposerModels()
            }
        }
        if (Array.isArray(data?.subjects) && data.subjects.length) {
            composerSubjectOptions.value = [
                fallbackComposerSubjectOptions[0],
                ...data.subjects.map((subject: any) => ({
                    id: String(subject.id),
                    name: String(subject.name || ''),
                    image: subject.image || sharedDramaImage,
                    source: subject.source,
                    category: subject.category,
                    gender: subject.gender,
                    ageStage: subject.age_stage || subject.ageStage
                }))
            ]
        }
        if (Array.isArray(data?.styles) && data.styles.length) {
            composerStyleOptions.value = data.styles.map((style: any) => ({
                id: String(style.id),
                name: String(style.name || ''),
                image: style.image || sharedDramaImage,
                isNew: Boolean(style.is_new ?? style.isNew)
            }))
        }
    } catch {}
}
const composerConfigPayload = (message: string) => ({
    multi_episode: composerMultiEpisode.value,
    style_id: selectedComposerStyle.value?.id || '',
    subject_ids: selectedComposerSubjectIds.value,
    subject_mentions: extractSubjectMentions(message),
    ratio: selectedRatio.value.label || undefined,
    image_model_id: imageModelChannelCode(selectedImageModel.value) || undefined,
    image_resolution: selectedImageResolution.value || undefined,
    resolution: selectedImageResolution.value || undefined,
    model_selections: {
        ...selectedComposerModelPayload.value,
        image: {
            id: imageModelChannelCode(selectedImageModel.value) || selectedImageModel.value?.id || '',
            value: selectedImageModel.value?.value || imageModelChannelCode(selectedImageModel.value) || '',
            channel_code: selectedImageModel.value?.channel_code || imageModelChannelCode(selectedImageModel.value) || '',
            model_code: selectedImageModel.value?.model_code || selectedImageModel.value?.channel_code || imageModelChannelCode(selectedImageModel.value) || ''
        }
    }
})
const toggleComposerMentionMenu = () => {
    closeComposerConfigPanels()
    composerMentionMenuOpen.value = !composerMentionMenuOpen.value
}
const insertComposerMention = async (entity: PromptEntity, type: '角色' | '场景') => {
    const token = `@${type}:${entity.name}`
    const current = planMessage.value.trim()
    planMessage.value = current ? `${current} ${token}` : token
    composerMentionMenuOpen.value = false
    await nextTick()
    const textarea = document.querySelector<HTMLTextAreaElement>('.plan-composer textarea')
    textarea?.focus()
}
const copyScriptContent = async () => {
    const content = [
        subjectNames.value ? `当前角色：${subjectNames.value}` : '',
        ...(scriptPlan.value.script_lines || [])
    ].filter(Boolean).join('\n')
    if (!content) {
        feedback.msgWarning('没有可复制的内容')
        return
    }
    try {
        await navigator.clipboard?.writeText(content)
        feedback.msgSuccess('已复制')
    } catch {
        feedback.msgError('复制失败，请手动选择文本')
    }
}
const toggleAct = (act: string) => {
    openedActs.value = openedActs.value.includes(act)
        ? openedActs.value.filter((item) => item !== act)
        : [...openedActs.value, act]
}
const nextStoryboardShotId = () => {
    const maxId = storyboardDraft.value.reduce((max, shot) => {
        const value = Number.parseInt(String(shot.shot_id || '').replace(/[^\d]/g, ''), 10)
        return Number.isFinite(value) ? Math.max(max, value) : max
    }, 0)
    return String(maxId + 1)
}
const normalizeStoryboardDraftOrder = () => {
    const used = new Set<string>()
    storyboardDraft.value = storyboardDraft.value.map((shot) => {
        let shotId = String(shot.shot_id || '').trim()
        if (!shotId || used.has(shotId)) {
            shotId = nextStoryboardShotId()
            while (used.has(shotId)) {
                shotId = String(Number(shotId) + 1)
            }
        }
        used.add(shotId)
        return {
            ...shot,
            shot_id: shotId
        }
    })
    scriptPlan.value.storyboard = storyboardDraft.value.map((shot) => ({ ...shot }))
}
const createEmptyShotAfter = (shot: StoryboardShot): StoryboardShot => ({
    shot_id: '',
    act: shot.act || storyboardDraft.value[0]?.act || '未命名幕',
    scene_name: shot.scene_name || '',
    time_of_day: shot.time_of_day || '',
    interior_exterior: shot.interior_exterior || 'exterior',
    visual_description: '',
    composition: '居中构图',
    camera_movement: '固定镜头',
    shot_type: '',
    angle: '',
    action: '',
    result: '',
    atmosphere: '',
    voice_role: '',
    dialogue: '',
    frame_type: 'normal',
    recommended_duration_seconds: Number(shot.recommended_duration_seconds || 3),
    scene_ref_id: shot.scene_ref_id || '',
    subject_ref_ids: [...(shot.subject_ref_ids || [])],
    prompt_summary: '',
    image_prompt: '',
    video_prompt: '',
    subject_prompt_summary: '',
    scene_prompt_summary: ''
})
const persistStoryboardDraft = async () => {
    if (!taskId.value) {
        feedback.msgError('剧本结果不完整')
        return []
    }
    normalizeStoryboardDraftOrder()
    const result = await saveShortDramaStoryboard({
        task_id: taskId.value,
        replace_storyboard: true,
        storyboard: storyboardDraft.value.map((shot) => ({ ...shot }))
    })
    const updatedShots: StoryboardShot[] = Array.isArray(result?.shots)
        ? result.shots.map(normalizeStoryboardShot)
        : []
    if (updatedShots.length) {
        const sortedShots = updatedShots.sort(compareStoryboardShots)
        storyboardDraft.value = sortedShots
        scriptPlan.value.storyboard = sortedShots.map((shot) => ({ ...shot }))
    } else {
        scriptPlan.value.storyboard = storyboardDraft.value.map((shot) => ({ ...shot }))
    }
    return storyboardDraft.value
}
const markStoryboardEdited = () => {
    if (visualWorkflowStarted.value) {
        storyboardDirty.value = true
    }
}
const insertShotAfter = (shot: StoryboardShot) => {
    if (savingShotId.value) return
    if (editingShotId.value) {
        feedback.msgWarning('请等待剧本生成完成')
        return
    }
    const index = storyboardDraft.value.findIndex((item) => item.shot_id === shot.shot_id)
    const nextShot = createEmptyShotAfter(shot)
    storyboardDraft.value.splice(index >= 0 ? index + 1 : storyboardDraft.value.length, 0, nextShot)
    normalizeStoryboardDraftOrder()
    const inserted = storyboardDraft.value[index >= 0 ? index + 1 : storyboardDraft.value.length - 1]
    if (!openedActs.value.includes(inserted.act)) {
        openedActs.value = [...openedActs.value, inserted.act]
    }
    startShotEdit(inserted)
    creatingShotId.value = inserted.shot_id
}
const startShotEdit = (shot: StoryboardShot) => {
    editingShotId.value = shot.shot_id
    editingShotBackup.value = { ...shot }
    openedShotSelect.value = ''
}
const cancelShotEdit = (shot: StoryboardShot) => {
    if (savingShotId.value) return
    if (creatingShotId.value === shot.shot_id) {
        storyboardDraft.value = storyboardDraft.value.filter((item) => item.shot_id !== shot.shot_id)
        normalizeStoryboardDraftOrder()
        creatingShotId.value = ''
        editingShotId.value = ''
        editingShotBackup.value = null
        openedShotSelect.value = ''
        return
    }
    if (editingShotBackup.value?.shot_id === shot.shot_id) {
        Object.assign(shot, editingShotBackup.value)
    }
    editingShotId.value = ''
    editingShotBackup.value = null
    openedShotSelect.value = ''
}
const completeShotEdit = async () => {
    const shot = storyboardDraft.value.find((item) => item.shot_id === editingShotId.value)
    if (!shot || savingShotId.value) return
    savingShotId.value = shot.shot_id
    try {
        await persistStoryboardDraft()
        editingShotId.value = ''
        editingShotBackup.value = null
        creatingShotId.value = ''
        openedShotSelect.value = ''
        markStoryboardEdited()
        feedback.msgSuccess('已复制')
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '分镜保存失败'))
    } finally {
        savingShotId.value = ''
    }
}
const deleteShot = async (shot: StoryboardShot) => {
    if (savingShotId.value) return
    try {
        await ElMessageBox.confirm(`确定删除分镜 ${storyboardDisplayNo(shot)} 吗？`, '删除分镜', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })
        if (editingShotId.value === shot.shot_id) {
            editingShotId.value = ''
            editingShotBackup.value = null
            creatingShotId.value = ''
            openedShotSelect.value = ''
        }
        const prevShots = storyboardDraft.value.map((item) => ({ ...item }))
        storyboardDraft.value = storyboardDraft.value.filter((item) => item.shot_id !== shot.shot_id)
        normalizeStoryboardDraftOrder()
        savingShotId.value = shot.shot_id
        try {
            await persistStoryboardDraft()
            markStoryboardEdited()
            feedback.msgSuccess('已复制')
        } catch (error) {
            storyboardDraft.value = prevShots
            scriptPlan.value.storyboard = prevShots.map((item) => ({ ...item }))
            throw error
        }
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(getRequestErrorMessage(error, '分镜保存失败'))
    } finally {
        savingShotId.value = ''
    }
}
const shotSelectKey = (shotId: string, field: 'voice_role' | 'frame_type') => `${shotId}:${field}`
const toggleShotSelect = (shotId: string, field: 'voice_role' | 'frame_type') => {
    const key = shotSelectKey(shotId, field)
    openedShotSelect.value = openedShotSelect.value === key ? '' : key
}
const voiceRoleText = (role: string) => voiceRoleOptions.value.find((option) => option.value === role)?.label || role || voiceRoleOptions.value[0].label
const shotVoiceText = (shot: StoryboardShot) => {
    const role = voiceRoleText(shot.voice_role)
    const dialogue = String(shot.dialogue || '').trim()
    if (!dialogue) return role && role !== '无对白' ? role : '无对白'
    return role && role !== '无对白' ? `${role}：${dialogue}` : dialogue
}
const selectShotOption = (
    shot: StoryboardShot,
    field: 'voice_role' | 'frame_type',
    value: string | StoryboardShot['frame_type']
) => {
    if (field === 'voice_role') {
        shot.voice_role = String(value)
    } else {
        shot.frame_type = value as StoryboardShot['frame_type']
    }
    openedShotSelect.value = ''
}

const frameTypeText = (type: StoryboardShot['frame_type']) => type === 'lip_sync' ? '对口型' : '普通画面'
const goBack = () => router.push('/ai/short-drama')
const getRequestErrorMessage = (error: any, fallback: string) => {
    if (typeof error === 'string') return error
    return error?.msg || error?.message || fallback
}
const renameProjectTitle = async () => {
    if (!projectId.value) {
        feedback.msgError('剧本结果不完整')
        return
    }
    try {
        const { value } = await ElMessageBox.prompt('请输入新的项目名称', '重命名项目', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputValue: scriptPlan.value.title,
            inputPattern: /\S/,
            inputErrorMessage: '名称不能为空'
        })
        const title = String(value || '').trim()
        if (!title || title === scriptPlan.value.title) return
        const project = await renameShortDramaProject({
            id: projectId.value,
            title
        })
        scriptPlan.value.title = String(project?.title || title)
        feedback.msgSuccess('已复制')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(getRequestErrorMessage(error, '操作失败'))
    }
}
const hasUsablePlanResultPayload = (result: any) => {
    if (!result || Array.isArray(result) || typeof result !== 'object') return false
    return Boolean(
        String(result?.title || '').trim() ||
        String(result?.story_outline || '').trim() ||
        (Array.isArray(result?.script_lines) && result.script_lines.length > 0) ||
        (Array.isArray(result?.subjects) && result.subjects.length > 0) ||
        (Array.isArray(result?.locations) && result.locations.length > 0) ||
        (Array.isArray(result?.scenes) && result.scenes.length > 0) ||
        (Array.isArray(result?.storyboard) && result.storyboard.length > 0)
    )
}
const hasCompletePlanResultPayload = (result: any) => {
    if (!result || Array.isArray(result) || typeof result !== 'object') return false
    const scriptLines = Array.isArray(result?.script_lines) ? result.script_lines : []
    const subjects = Array.isArray(result?.subjects) ? result.subjects : []
    const locations = Array.isArray(result?.locations)
        ? result.locations
        : (Array.isArray(result?.scenes) ? result.scenes : [])
    const storyboard = Array.isArray(result?.storyboard) ? result.storyboard : []
    return Boolean(
        String(result?.title || '').trim() &&
        (String(result?.story_outline || '').trim() || scriptLines.length > 0) &&
        scriptLines.length > 0 &&
        subjects.length > 0 &&
        locations.length > 0 &&
        storyboard.length > 0
    )
}
const applyTaskResult = (data: any) => {
    taskStatus.value = (data?.status || taskStatus.value) as typeof taskStatus.value
    taskError.value = isActiveTaskStatus(taskStatus.value) ? '' : (data?.error || '')
    taskPrompt.value = data?.prompt || taskPrompt.value
    applyProjectGenerationSettings(data?.generation_settings || data?.project_generation_settings || data?.project?.generation_settings)
    applyRatioLabel(data?.ratio || data?.result?.generation_settings?.aspect_ratio)
    const latestStreamContent = String(data?.stream_content || '')
    if (latestStreamContent && taskStatus.value !== 'success') {
        if (latestStreamContent.length >= streamContent.value.length || !streamContent.value) {
            streamContent.value = latestStreamContent
            applyStreamingPlanDraft()
            followStreamingOutput()
        }
    }
    if (taskStatus.value === 'success' && !hasCompletePlanResultPayload(data?.result)) {
        taskStatus.value = 'failed'
        taskError.value = data?.error || 'AI 返回内容不完整，请重试'
        completed.value = false
    }
    if (taskStatus.value === 'success' && hasCompletePlanResultPayload(data?.result)) {
        const result = normalizePlanResult(data.result)
        scriptPlan.value = result
        storyboardDraft.value = result.storyboard.map((shot) => ({ ...shot })).sort(compareStoryboardShots)
        storyboardDirty.value = false
        taskStatus.value = 'success'
        taskError.value = ''
        completed.value = true
        scriptContentExpanded.value = false
        openedActs.value = storyboardActs.value.map((act) => act.name)
    }
    if (['success', 'failed', 'canceled'].includes(taskStatus.value)) {
        stopThinkingTimer()
        clearStreamingFollowTimer()
    }
    syncRevisionRecordWithTask(data?.task_id || taskId.value, taskStatus.value, taskError.value)
}
const cleanArtStyleDescription = (value: any) => String(value || '')
    .replace(/(?:recommended\s+aspect\s+ratio|aspect\s+ratio|ratio)\s*[:\uff1a]?\s*\d+\s*:\s*\d+[,，\u3001;\uff1b\u3002]*/giu, '')
    .replace(/(^|[,，\u3001;\uff1b\s])\d+\s*:\s*\d+\s*(?:\u6a2a\u7248|\u7ad6\u7248|\u6a2a\u5c4f|\u7ad6\u5c4f|portrait|landscape|vertical|horizontal)?[,，\u3001;\uff1b\s]*/giu, '$1')
    .replace(/(?:\u6a2a\u7248|\u7ad6\u7248|\u6a2a\u5c4f|\u7ad6\u5c4f|portrait\s+canvas|landscape\s+canvas|vertical\s+screen|horizontal\s+screen)[,，\u3001;\uff1b\s]*/giu, '')
    .replace(/^[\s,，\u3001;\uff1b]+|[\s,，\u3001;\uff1b]+$/g, '')
const hasChineseText = (value: string) => /[\u4e00-\u9fa5]/.test(value)
const hasLatinText = (value: string) => /[A-Za-z]/.test(value)
const normalizeEnglishDisplayKey = (value: any) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
const exactEnglishDisplayMap: Record<string, string> = {
    'short drama': '短剧',
    drama: '短剧',
    'script planning': '剧本规划',
    'script plan': '剧本方案',
    'story outline': '故事大纲',
    storyboard: '分镜脚本',
    'subject list': '主体列表',
    'scene list': '场景列表',
    'art style': '美术风格',
    'visual style': '视觉风格',
    'opening feedback': '开篇反馈',
    'planning steps': '规划步骤'
}
const englishDisplayMap: Record<string, string> = {
    'character relationship': '角色关系',
    'core conflict': '核心冲突',
    'selling point': '看点',
    'plot twist': '反转',
    'emotional hook': '情绪钩子',
    'main character': '主角',
    'supporting character': '配角',
    protagonist: '主角',
    antagonist: '反派',
    character: '角色',
    location: '地点',
    school: '学校',
    street: '街道',
    'dining room': '餐厅',
    home: '家',
    scene: '场景',
    shot: '分镜',
    dialogue: '对白',
    'voice role': '声音角色',
    'frame type': '画面类型',
    'recommended duration': '建议时长',
    interior: '室内',
    exterior: '室外',
    morning: '早晨',
    afternoon: '下午',
    evening: '傍晚',
    night: '夜晚',
    day: '白天',
    'visible picture description': '画面描述',
    'composition guidance': '构图建议',
    'camera movement guidance': '运镜建议',
    'one clear visible action': '一个清晰可见的动作',
    'result of the action': '动作结果',
    'shot atmosphere': '镜头氛围',
    'time of day': '时间',
    'scene name': '场景名称',
    'rule of thirds': '三分法构图',
    ruleofthirds: '三分法构图',
    'medium shot': '中景',
    'wide shot': '远景',
    'long shot': '远景',
    'close-up': '特写',
    'close up': '特写',
    'eye level': '平视',
    'low angle': '低角度',
    'high angle': '高角度',
    'static shot': '固定镜头',
    'static camera': '固定机位',
    'slow push in': '缓慢推近',
    'slow pull back': '缓慢拉远',
    'tracking forward': '向前跟拍',
    'shot of': '画面',
    'view of': '视角'
}
const residualEnglishTokenMap: Record<string, string> = {
    a: '',
    an: '',
    the: '',
    and: '和',
    or: '或',
    of: '的',
    from: '来自',
    to: '到',
    in: '在',
    on: '在',
    above: '上方',
    with: '带有',
    without: '没有',
    small: '小',
    large: '大',
    black: '黑色',
    white: '白色',
    red: '红色',
    blue: '蓝色',
    green: '绿色',
    yellow: '黄色',
    grey: '灰色',
    gray: '灰色',
    smoke: '烟雾',
    monster: '怪物',
    monsters: '怪物',
    beast: '野兽',
    character: '角色',
    scene: '场景',
    shot: '分镜',
    camera: '镜头',
    view: '视角',
    angle: '角度',
    dialogue: '对白',
    voice: '声音',
    role: '角色',
    style: '风格',
    visual: '视觉',
    description: '描述',
    planning: '规划',
    script: '剧本',
    outline: '大纲',
    story: '故事'
}
const removeResidualEnglish = (value: string, fallback = '') => {
    const converted = value
        .replace(/[A-Za-z][A-Za-z'?.-]*/g, (word) => {
            const key = word.toLowerCase().replace(/[?']/g, '').replace(/[-.]/g, '')
            return residualEnglishTokenMap[key] ?? ''
        })
        .replace(/\s*,\s*/g, '，')
        .replace(/\s*:\s*/g, '：')
        .replace(/\s*\.\s*/g, '。')
        .replace(/\s+/g, '')
        .replace(/[()（）]+/g, '')
        .replace(/[，。]{2,}/g, '，')
        .replace(/^[，。：、\s]+|[，。：、\s]+$/g, '')
        .trim()
    if (converted && hasChineseText(converted) && !hasLatinText(converted)) return converted
    const cleaned = converted.replace(/[A-Za-z][A-Za-z'?.-]*/g, '').trim()
    return hasChineseText(cleaned) ? cleaned : fallback
}
const localizeDisplayText = (value: any, fallback = '') => {
    const text = String(value || '').trim()
    if (!text || !hasLatinText(text)) return text
    const normalizedText = normalizeEnglishDisplayKey(text)
    if (exactEnglishDisplayMap[normalizedText]) return exactEnglishDisplayMap[normalizedText]
    let translated = text
    Object.entries({ ...englishDisplayMap, ...exactEnglishDisplayMap })
        .sort((a, b) => b[0].length - a[0].length)
        .forEach(([source, target]) => {
            const pattern = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-–—]')
            translated = translated.replace(new RegExp(pattern, 'gi'), target)
        })
    translated = translated
        .replace(/\bAct\s*(\d+)\s*:?\s*/gi, '第$1幕')
        .replace(/\bShot\s*(\d+)\b/gi, '分镜$1')
        .replace(/\s*,\s*/g, '，')
        .replace(/\s*:\s*/g, '：')
        .replace(/\s*\.\s*/g, '。')
        .replace(/\s+/g, '')
        .replace(/[，。]{2,}/g, '，')
        .trim()
    if (!hasLatinText(translated) && hasChineseText(translated)) return translated
    if (hasChineseText(translated)) return removeResidualEnglish(translated, fallback)
    return removeResidualEnglish(translated, fallback)
}
const localizeDisplayList = (items: any[]) => items
    .map((item) => localizeDisplayText(item))
    .filter((item) => String(item || '').trim())
const isStructureOnlyScriptLine = (value: any) => {
    const text = String(value || '').trim()
    if (!text) return true
    const normalized = text.replace(/\s+/g, '')
    return [
        /^第[0-9一二三四五六七八九十百千]+[幕章节][：:]/u,
        /^Act\s*\d+\s*[:：]/i,
        /^Scene\s*\d+\s*[:：]/i,
        /^分镜\s*\d+\s*[:：]?/u,
        /^(类型判断|核心主题|主要角色|角色列表|主体列表|场景列表|美术风格|剧本摘要|故事梗概|预计总时长)[：:]/u,
        /^《(类型判断|核心主题|主体列表|场景列表|分镜脚本|美术风格)》$/u
    ].some((pattern) => pattern.test(normalized))
}
const normalizeScriptContentLines = (lines: any[], fallback = '') => {
    const cleaned = localizeDisplayList(lines).filter((line) => !isStructureOnlyScriptLine(line))
    if (cleaned.length) return cleaned
    const fallbackLine = localizeDisplayText(fallback || '')
    return fallbackLine && !isStructureOnlyScriptLine(fallbackLine) ? [fallbackLine] : []
}
const normalizePromptEntity = (item: any, index: number): PromptEntity => ({
    id: String(item?.id || item?.subject_id || item?.scene_id || item?.item_id || index + 1),
    name: localizeDisplayText(item?.name || item?.title || item?.scene_name || item?.subject_name || '', '未命名'),
    description: localizeDisplayText(item?.description || item?.desc || item?.profile || ''),
    story_order: Number(item?.story_order || item?.scene_order || 0),
    story_phase: localizeDisplayText(item?.story_phase || item?.phase || ''),
    visual_prompt: String(item?.visual_prompt || item?.image_prompt || item?.prompt || ''),
    unified_prompt: String(item?.unified_prompt || item?.consistency_prompt || item?.unify_prompt || ''),
    prompt_summary: String(item?.prompt_summary || item?.summary || item?.prompt_overview || '')
})
const localizeActName = (value: any) => {
    const text = localizeDisplayText(value)
    const match = text.match(/^第?(\d+)幕[:：]?\s*(.*)$/)
    if (match) {
        return `第${match[1]}幕${match[2] ? `：${match[2]}` : ''}`
    }
    const actMatch = String(value || '').match(/^Act\s*(\d+)\s*:?\s*(.*)$/i)
    if (actMatch) {
        const suffix = localizeDisplayText(actMatch[2])
        return `第${actMatch[1]}幕${suffix ? `：${suffix}` : ''}`
    }
    return text || '未分幕'
}
const localizeShotActName = (value: any, index: number) => {
    const text = localizeActName(value)
    if (text && text !== '未分幕') return text
    return `第${Math.max(1, Math.ceil((index + 1) / 2))}幕`
}
const technicalTextMap: Record<string, string> = {
    'center close-up': '居中特写',
    'center close up': '居中特写',
    'close-up': '特写',
    'close up': '特写',
    'extreme close-up': '大特写',
    'medium close-up': '中特写',
    'medium shot': '中景',
    'wide shot': '远景',
    'long shot': '远景',
    'establishing shot': '建立镜头',
    'over the shoulder': '过肩镜头',
    'over-the-shoulder': '过肩镜头',
    'rule of thirds': '三分法构图',
    ruleofthirds: '三分法构图',
    'two-shot': '双人镜头',
    'two shot': '双人镜头',
    symmetrical: '对称构图',
    symmetry: '对称构图',
    centered: '居中构图',
    static: '固定镜头',
    'slow zoom out': '缓慢拉远',
    'slow zoom in': '缓慢推近',
    'zoom out': '拉远',
    'zoom in': '推近',
    pan: '摇镜',
    'pan left': '向左摇镜',
    'pan right': '向右摇镜',
    tilt: '俯仰镜头',
    'tilt up': '上摇',
    'tilt down': '下摇',
    tracking: '跟拍',
    'tracking shot': '跟拍镜头',
    dolly: '移动镜头',
    'dolly in': '推轨前进',
    'dolly out': '推轨后退',
    handheld: '手持镜头',
    crane: '升降镜头',
    'push in': '推近',
    'pull back': '拉远'
}
const localizeTechnicalText = (value: any) => {
    const text = String(value || '').trim()
    if (!text) return ''
    const normalized = text.toLowerCase().replace(/\s+/g, ' ')
    if (technicalTextMap[normalized]) return technicalTextMap[normalized]
    let translated = localizeDisplayText(text)
    Object.entries(technicalTextMap)
        .sort((a, b) => b[0].length - a[0].length)
        .forEach(([source, target]) => {
            translated = translated.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), target)
        })
    return translated
}
const normalizeStoryboardRefIds = (value: any) => {
    if (Array.isArray(value)) return value.map((id) => String(id)).filter(Boolean)
    if (typeof value === 'string') {
        const text = value.trim()
        if (!text) return []
        try {
            const parsed = JSON.parse(text)
            if (Array.isArray(parsed)) return parsed.map((id) => String(id)).filter(Boolean)
        } catch (error) {}
        return text.split(/[,\s，、]+/).map((id) => id.trim()).filter(Boolean)
    }
    return []
}
const normalizeStoryboardShot = (shot: any, index: number): StoryboardShot => {
    const visualDescription = localizeDisplayText(shot?.visual_description || shot?.description || '', `第${index + 1}个分镜`)
    const composition = localizeTechnicalText(shot?.composition || '') || '常规构图'
    const cameraMovement = localizeTechnicalText(shot?.camera_movement || shot?.camera || '') || '固定镜头'
    const voiceRole = localizeDisplayText(shot?.voice_role || '')
    const dialogue = localizeDisplayText(shot?.dialogue || shot?.line || '')
    const sceneName = localizeDisplayText(shot?.scene_name || shot?.location_name || '')
    const timeOfDay = localizeDisplayText(shot?.time_of_day || '')
    const interiorExterior = shot?.interior_exterior === 'interior' || shot?.interior_exterior === 'exterior'
        ? shot.interior_exterior
        : undefined
    const fallbackAct = [sceneName, timeOfDay, interiorExterior === 'interior' ? '室内' : (interiorExterior === 'exterior' ? '室外' : '')]
        .filter(Boolean)
        .join(' ')
    return {
        shot_id: String(shot?.shot_id || shot?.id || index + 1),
        sort: Number(shot?.sort || shot?.shot_sort || shot?.order || 0),
        act: localizeShotActName(shot?.act || shot?.chapter || shot?.section || (fallbackAct ? `第${index + 1}幕：${fallbackAct}` : '未分幕'), index),
        scene_order: Number(shot?.scene_order || shot?.story_order || 0),
        scene_name: sceneName,
        time_of_day: timeOfDay,
        interior_exterior: interiorExterior,
        visual_description: visualDescription,
        composition,
        camera_movement: cameraMovement,
        shot_type: localizeTechnicalText(shot?.shot_type || shot?.frame_size || ''),
        angle: localizeTechnicalText(shot?.angle || ''),
        action: localizeDisplayText(shot?.action || ''),
        result: localizeDisplayText(shot?.result || ''),
        atmosphere: localizeDisplayText(shot?.atmosphere || ''),
        voice_role: voiceRole,
        dialogue,
        frame_type: shot?.frame_type === 'lip_sync' ? 'lip_sync' : 'normal',
        recommended_duration_seconds: Number(shot?.recommended_duration_seconds || shot?.duration || 3),
        scene_ref_id: String(shot?.scene_ref_id || shot?.scene_ref || shot?.location_id || ''),
        subject_ref_ids: normalizeStoryboardRefIds(shot?.subject_ref_ids || shot?.subject_refs || shot?.character_ids),
        prompt_summary: String(shot?.prompt_summary || shot?.prompt_overview || ''),
        image_prompt: String(shot?.image_prompt || shot?.visual_prompt || ''),
        video_prompt: String(shot?.video_prompt || shot?.motion_prompt || ''),
        subject_prompt_summary: String(shot?.subject_prompt_summary || shot?.subject_unified_prompt || ''),
        scene_prompt_summary: String(shot?.scene_prompt_summary || shot?.scene_unified_prompt || '')
    }
}
const normalizePlanResult = (result: any): ScriptPlanResult => {
    const subjects = Array.isArray(result?.subjects)
        ? result.subjects
        : (Array.isArray(result?.enhanced_subjects) ? result.enhanced_subjects : [])
    const locations = Array.isArray(result?.scenes)
        ? result.scenes
        : (Array.isArray(result?.locations) ? result.locations : (Array.isArray(result?.enhanced_scenes) ? result.enhanced_scenes : []))
    const storyboard = Array.isArray(result?.storyboard)
        ? result.storyboard
        : (Array.isArray(result?.shots) ? result.shots : [])
    const scriptLines = normalizeScriptContentLines(
        Array.isArray(result?.script_lines) ? result.script_lines : [],
        result?.story_outline || ''
    )
    return {
        title: localizeDisplayText(result?.title || emptyScriptPlan.title, emptyScriptPlan.title),
        created_at: result?.created_at || result?.createdAt || '',
        type_judgement: localizeDisplayText(result?.type_judgement || result?.type || ''),
        core_theme: localizeDisplayText(result?.core_theme || result?.theme || ''),
        opening_feedback: localizeDisplayText(result?.opening_feedback || ''),
        planning_steps: Array.isArray(result?.planning_steps) ? localizeDisplayList(result.planning_steps) : [],
        story_outline: localizeDisplayText(result?.story_outline || ''),
        script_lines: scriptLines,
        art_style: {
            base_style: localizeDisplayText(result?.art_style?.base_style || result?.style?.base_style || ''),
            visual_description: localizeDisplayText(cleanArtStyleDescription(result?.art_style?.visual_description || result?.style?.visual_description || '')),
            color_tone: localizeDisplayText(result?.art_style?.color_tone || ''),
            lighting_design: localizeDisplayText(result?.art_style?.lighting_design || result?.art_style?.light_design || ''),
            camera_texture: localizeDisplayText(result?.art_style?.camera_texture || result?.art_style?.lens_texture || ''),
            atmosphere_keywords: Array.isArray(result?.art_style?.atmosphere_keywords) ? localizeDisplayList(result.art_style.atmosphere_keywords) : []
        },
        subjects: subjects.map(normalizePromptEntity),
        locations: locations.map(normalizePromptEntity),
        storyboard: storyboard.map(normalizeStoryboardShot).sort(compareStoryboardShots),
        duration_stats: result?.duration_stats || {},
        generation_settings: result?.generation_settings || {}
    }
}
const decodeJsonString = (value: string) => {
    try {
        return JSON.parse(`"${value.replace(/"/g, '\\"')}"`)
    } catch {
        return value
    }
}
const decodeJsonStringFragment = (value: string) => {
    try {
        return JSON.parse(`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    } catch {
        return value
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
    }
}
const findJsonStringValue = (raw: string, key: string, allowPartial = false) => {
    const keyMatch = new RegExp(`"${key}"\\s*:\\s*"`).exec(raw)
    if (!keyMatch) return ''
    const start = keyMatch.index + keyMatch[0].length
    let escaped = false
    for (let index = start; index < raw.length; index += 1) {
        const char = raw[index]
        if (escaped) {
            escaped = false
            continue
        }
        if (char === '\\') {
            escaped = true
            continue
        }
        if (char === '"') {
            return decodeJsonString(raw.slice(start, index)).trim()
        }
    }
    return allowPartial ? decodeJsonStringFragment(raw.slice(start)).trim() : ''
}
const extractJsonStringField = (raw: string, key: string) => {
    return findJsonStringValue(raw, key, false)
}
const extractJsonStringFieldPartial = (raw: string, key: string) => {
    return findJsonStringValue(raw, key, true)
}
const extractJsonStringArray = (raw: string, key: string) => {
    const match = raw.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`))
    if (!match?.[1]) return []
    const items: string[] = []
    const itemReg = /"((?:\\.|[^"\\])*)"/g
    let item: RegExpExecArray | null
    while ((item = itemReg.exec(match[1]))) {
        const rawText = decodeJsonString(item[1]).trim()
        if (!rawText || /^(title|description|name|id|shot_id|scene_name|visual_prompt|image_prompt|video_prompt)$/i.test(rawText)) continue
        const text = localizeDisplayText(rawText)
        if (text && !items.includes(text)) items.push(text)
    }
    return items
}
const extractJsonArraySlice = (raw: string, key: string) => {
    const keyMatch = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(raw)
    if (!keyMatch) return ''
    const start = keyMatch.index + keyMatch[0].length - 1
    let depth = 0
    let escaped = false
    let inString = false
    for (let index = start; index < raw.length; index += 1) {
        const char = raw[index]
        if (escaped) {
            escaped = false
            continue
        }
        if (char === '\\') {
            escaped = true
            continue
        }
        if (char === '"') {
            inString = !inString
            continue
        }
        if (inString) continue
        if (char === '[') depth += 1
        if (char === ']') {
            depth -= 1
            if (depth === 0) return raw.slice(start + 1, index)
        }
    }
    return raw.slice(start + 1)
}
const extractCompleteObjectsFromArray = (raw: string, key: string) => {
    const slice = extractJsonArraySlice(raw, key)
    if (!slice) return []
    const objects: any[] = []
    let depth = 0
    let escaped = false
    let inString = false
    let objectStart = -1
    for (let index = 0; index < slice.length; index += 1) {
        const char = slice[index]
        if (escaped) {
            escaped = false
            continue
        }
        if (char === '\\') {
            escaped = true
            continue
        }
        if (char === '"') {
            inString = !inString
            continue
        }
        if (inString) continue
        if (char === '{') {
            if (depth === 0) objectStart = index
            depth += 1
        } else if (char === '}') {
            depth -= 1
            if (depth === 0 && objectStart >= 0) {
                try {
                    objects.push(JSON.parse(slice.slice(objectStart, index + 1)))
                } catch {}
                objectStart = -1
            }
        }
    }
    return objects
}
const extractStreamingEntities = (raw: string, key: 'subjects' | 'locations') => extractCompleteObjectsFromArray(raw, key)
    .map(normalizePromptEntity)
    .filter((item) => item.name || item.description || item.visual_prompt || item.unified_prompt)
const extractStreamingStoryboard = (raw: string) => {
    const completeShots = extractCompleteObjectsFromArray(raw, 'storyboard')
        .map(normalizeStoryboardShot)
        .filter((shot) => shot.visual_description || shot.dialogue || shot.composition || shot.camera_movement)
    if (completeShots.length) return completeShots

    const shots: StoryboardShot[] = []
    const storyboardSlice = extractJsonArraySlice(raw, 'storyboard')
    if (!storyboardSlice) return shots
    const visualReg = /"visual_description"\s*:\s*"((?:\\.|[^"\\])*)"/g
    let match: RegExpExecArray | null
    while ((match = visualReg.exec(storyboardSlice))) {
        const visual = localizeDisplayText(decodeJsonString(match[1]).trim())
        if (!visual || shots.some((shot) => shot.visual_description === visual)) continue
        shots.push(normalizeStoryboardShot({
            shot_id: String(shots.length + 1),
            act: firstStoryboardAct.value || 'Act 1',
            visual_description: visual,
            composition: '',
            camera_movement: '',
            frame_type: 'normal',
            recommended_duration_seconds: 3
        }, shots.length))
    }
    return shots
}
const extractPlainScriptLines = (raw: string) => {
    if (/[{}\[\]]|"visual_prompt"|"image_prompt"|"video_prompt"|"negative_prompt"/.test(raw)) return []
    return raw
        .split(/\r?\n/)
        .map((line) => localizeDisplayText(line.trim()))
        .filter((line) => /[\u4e00-\u9fa5]/.test(line) && line.length >= 8)
        .filter((line) => !isStructureOnlyScriptLine(line))
        .filter((line) => !/提示词|negative|prompt|visual|location|spatial|color_palette/i.test(line))
        .slice(0, 30)
}
const applyStreamingPlanDraft = () => {
    const raw = streamContent.value
    if (!raw.trim()) {
        followStreamingOutput()
        return
    }
    const title = extractJsonStringFieldPartial(raw, 'title')
    const outline = extractJsonStringFieldPartial(raw, 'story_outline')
    const scriptLines = extractJsonStringArray(raw, 'script_lines')
    const artBaseStyle = extractJsonStringFieldPartial(raw, 'base_style')
    const artVisualDescription = extractJsonStringFieldPartial(raw, 'visual_description')
    const subjects = extractStreamingEntities(raw, 'subjects')
    const locations = extractStreamingEntities(raw, 'locations')
    const storyboard = extractStreamingStoryboard(raw)
    const plainLines = !outline && !scriptLines.length && !storyboard.length ? extractPlainScriptLines(raw) : []
    const visibleLines = normalizeScriptContentLines([...(outline ? [outline] : []), ...scriptLines, ...plainLines], outline)
        .filter((line, index, array) => line && array.indexOf(line) === index)
    if (!visibleLines.length && !artBaseStyle && !artVisualDescription && !subjects.length && !locations.length && !storyboard.length) {
        streamingDocumentVisible.value = true
        followStreamingOutput()
        return
    }

    scriptPlan.value = {
        ...scriptPlan.value,
        title: title ? localizeDisplayText(title, scriptPlan.value.title) : scriptPlan.value.title,
        script_lines: visibleLines.length ? visibleLines : scriptPlan.value.script_lines,
        art_style: {
            base_style: artBaseStyle ? localizeDisplayText(artBaseStyle) : scriptPlan.value.art_style.base_style,
            visual_description: artVisualDescription ? localizeDisplayText(cleanArtStyleDescription(artVisualDescription)) : scriptPlan.value.art_style.visual_description
        },
        subjects: subjects.length ? subjects : scriptPlan.value.subjects,
        locations: locations.length ? locations : scriptPlan.value.locations
    }
    if (storyboard.length) {
        const sortedStoryboard = storyboard.map((shot) => ({ ...shot })).sort(compareStoryboardShots)
        storyboardDraft.value = sortedStoryboard
        scriptPlan.value.storyboard = sortedStoryboard.map((shot) => ({ ...shot }))
        storyboardDirty.value = false
        openedActs.value = storyboardActs.value.map((act) => act.name)
    }
    streamingDocumentVisible.value = true
    followStreamingOutput()
}
const stopPolling = () => {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
}
const startThinkingTimer = () => {
    if (thinkingTimer || !isTaskStreaming.value) return
    thinkingTimer = setInterval(() => {
        thinkingSeconds.value += 1
    }, 1000)
}
const stopThinkingTimer = () => {
    if (thinkingTimer) clearInterval(thinkingTimer)
    thinkingTimer = null
}
const isActiveTaskStatus = (status?: string) => ['pending', 'queued', 'running'].includes(String(status || ''))
const handleStreamEvent = (event: string, data: any) => {
    if (event === 'delta') {
        streamContent.value += String(data?.delta || data?.content || '')
        taskStatus.value = 'running'
        applyStreamingPlanDraft()
        startThinkingTimer()
        followStreamingOutput()
        return
    }
    if (event === 'stage') {
        taskStatus.value = String(data?.status || 'running') as typeof taskStatus.value
        streamingDocumentVisible.value = true
        startThinkingTimer()
        followStreamingOutput()
        return
    }
    if (event === 'task') {
        applyTaskResult(data)
        return
    }
    if (event === 'done') {
        applyTaskResult(data)
        streamingDocumentVisible.value = false
        if (taskStatus.value === 'success' && hasCompletePlanResultPayload(data?.result)) {
            completePlan()
        }
        return
    }
    if (event === 'error') {
        if (data?.task) {
            applyTaskResult(data.task)
            if (!isActiveTaskStatus(data.task?.status)) {
                taskStatus.value = 'failed'
                taskError.value = data?.message || data?.error || '剧本生成失败'
                stopThinkingTimer()
                feedback.msgError(taskError.value)
            }
            return
        }
        taskStatus.value = 'pending'
        taskError.value = ''
        schedulePolling()
    }
}
const startScriptPlanStream = async () => {
    if (streamRunning.value || !taskId.value || !isTaskStreaming.value) return
    streamRunning.value = true
    streamingDocumentVisible.value = true
    startThinkingTimer()
    followStreamingOutput('smooth')
    schedulePolling()
    try {
        await streamShortDramaScriptPlan({
            task_id: taskId.value,
            project_id: projectId.value
        }, {
            onEvent: ({ event, data }) => handleStreamEvent(event, data),
            onError: () => {}
        })
    } catch {
        schedulePolling()
    } finally {
        streamRunning.value = false
        if (isTaskStreaming.value) {
            schedulePolling()
        }
    }
}
const normalizeImageModel = (model: any): ModelOption => {
    const ratioOptions = Array.isArray(model?.ratio_options)
        ? model.ratio_options.map((item: any) => String(item?.label || item?.value || item?.ratio || item || '').trim()).filter(Boolean)
        : []
    return {
        id: String(model?.id || model?.value || model?.channel_code || model?.channel || ''),
        value: String(model?.value || model?.id || model?.channel_code || model?.channel || ''),
        channel_code: String(model?.channel_code || model?.channel || model?.id || ''),
        name: String(model?.name || model?.id || '默认模型'),
        description: String(model?.description || ''),
        default_quality: String(model?.default_quality || model?.quality || ''),
        quality_options: Array.isArray(model?.quality_options) ? model.quality_options : [],
        resolution_options: Array.isArray(model?.resolution_options) ? model.resolution_options : [],
        default_ratio: String(model?.default_ratio || model?.ratio || ''),
        ratio_options: Array.from(new Set(ratioOptions))
    }
}
const normalizeRatio = (ratio: any): RatioOption | null => {
    const label = String(ratio?.label || ratio?.value || ratio?.ratio || '').trim()
    if (!label) return null
    const [rawWidth, rawHeight] = label.split(':').map((item) => Number(item))
    return {
        label,
        width: Number(ratio?.width || rawWidth || 1),
        height: Number(ratio?.height || rawHeight || 1)
    }
}
const applyRatioLabel = (label?: string) => {
    const ratioLabel = String(label || '').trim()
    if (!ratioLabel) return
    const found = ratioOptions.value.find((ratio) => ratio.label === ratioLabel)
    if (found) {
        selectedRatio.value = found
        return
    }
    const normalized = normalizeRatio({ label: ratioLabel })
    if (normalized) {
        ratioOptions.value = [...ratioOptions.value, normalized]
        selectedRatio.value = normalized
    }
}
const projectGenerationSettingsPayload = () => {
    const model = selectedImageModel.value
    const modelValue = imageModelChannelCode(model)
    return {
        ratio: selectedRatio.value.label || '',
        aspect_ratio: selectedRatio.value.label || '',
        image: {
            model_id: modelValue,
            image_model_id: modelValue,
            id: model?.id || modelValue,
            value: model?.value || modelValue,
            channel_code: model?.channel_code || modelValue,
            channel: model?.channel_code || modelValue,
            name: model?.name || '',
            model_name: model?.name || '',
            resolution: selectedImageResolution.value || '',
            quality: selectedImageResolution.value || '',
            ratio: selectedRatio.value.label || '',
            aspect_ratio: selectedRatio.value.label || ''
        }
    }
}
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
    applyRatioLabel(settings.ratio || settings.aspect_ratio || settings.image?.ratio || settings.image?.aspect_ratio || settings.video?.ratio || settings.video?.aspect_ratio)
    const imageSettings = settings.image || {}
    if (imageSettings.resolution || imageSettings.quality) {
        selectedImageResolution.value = String(imageSettings.resolution || imageSettings.quality || selectedImageResolution.value)
    }
    if (imageModelOptions.value.length) {
        const matched = matchImageModel(imageModelOptions.value, imageSettings)
        if (matched) {
            selectedImageModel.value = matched
            selectedImageResolution.value = resolveShortDramaResolution(matched, selectedImageResolution.value)
        }
    }
}
const imageModelChannelCode = (model?: ModelOption | null) => String(model?.channel_code || model?.value || model?.id || '').trim()
const imageModelStorageKey = computed(() => projectId.value && taskId.value
    ? `short-drama-image-model:${projectId.value}:${taskId.value}`
    : '')
const matchImageModel = (options: ModelOption[], target?: Partial<ModelOption> | null) => {
    if (!target) return null
    const targetValues = [
        target.id,
        target.value,
        target.channel_code
    ].map((item) => String(item || '').trim()).filter(Boolean)
    if (!targetValues.length) return null
    return options.find((model) => {
        const modelValues = [model.id, model.value, model.channel_code].map((item) => String(item || '').trim()).filter(Boolean)
        return modelValues.some((value) => targetValues.includes(value))
    }) || null
}
const readPersistedImageModel = (): Partial<ModelOption> | null => {
    const remoteImage = projectGenerationSettings.value?.image
    if (remoteImage && typeof remoteImage === 'object') {
        selectedImageResolution.value = String(remoteImage.resolution || remoteImage.quality || selectedImageResolution.value)
        return remoteImage
    }
    const shared = readShortDramaImageModelSelection(projectId.value, taskId.value)
    if (shared) {
        selectedImageResolution.value = shared.resolution || selectedImageResolution.value
        return shared
    }
    const key = imageModelStorageKey.value
    if (!process.client || !key) return null
    try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}
const persistImageModel = (model?: ModelOption | null) => {
    if (model) {
        writeShortDramaImageModelSelection(projectId.value, taskId.value, {
            id: model.id,
            value: model.value,
            channel_code: model.channel_code,
            name: model.name,
            default_quality: model.default_quality,
            default_ratio: model.default_ratio,
            resolution: selectedImageResolution.value
        })
    }
    const key = imageModelStorageKey.value
    if (!process.client || !key || !model) return
    try {
        window.localStorage.setItem(key, JSON.stringify({
            id: model.id,
            value: model.value,
            channel_code: model.channel_code,
            name: model.name,
            default_quality: model.default_quality,
            default_ratio: model.default_ratio,
            resolution: selectedImageResolution.value
        }))
    } catch {}
}
const ensureImageModelRatio = (model?: ModelOption | null, notify = true) => {
    const ratios = Array.isArray(model?.ratio_options)
        ? model.ratio_options.map((item) => String(item || '').trim()).filter(Boolean)
        : []
    if (!ratios.length || ratios.includes(selectedRatio.value.label)) return
    const nextRatio = ratios.includes(String(model?.default_ratio || '').trim())
        ? String(model?.default_ratio || '').trim()
        : ratios[0]
    if (!nextRatio) return
    applyRatioLabel(nextRatio)
    if (notify) feedback.msgWarning(`当前模型不支持原比例，已切换为 ${nextRatio}`)
}
const loadImageModels = async () => {
    try {
        const data = await getShortDramaHome()
        const ratios = Array.isArray(data?.ratios)
            ? data.ratios.map(normalizeRatio).filter(Boolean) as RatioOption[]
            : []
        if (ratios.length) {
            ratioOptions.value = ratios
            selectedRatio.value = ratios.find((ratio) => ratio.label === selectedRatio.value.label) || ratios[0]
        }
        const groups = Array.isArray(data?.model_groups) ? data.model_groups : []
        const imageGroup = groups.find((group: any) => group?.key === 'image')
        const options = (Array.isArray(imageGroup?.options) ? imageGroup.options : [])
            .map(normalizeImageModel)
            .filter((model: ModelOption) => model.id)
        imageModelOptions.value = options
        applyProjectGenerationSettings(projectGenerationSettings.value)
        const restored = matchImageModel(options, readPersistedImageModel())
        const current = matchImageModel(options, selectedImageModel.value)
        selectedImageModel.value = restored || current || options[0] || null
        if (selectedImageModel.value) {
            selectedImageResolution.value = resolveShortDramaResolution(selectedImageModel.value, selectedImageResolution.value)
            persistImageModel(selectedImageModel.value)
            ensureImageModelRatio(selectedImageModel.value, false)
        }
    } catch {
        imageModelOptions.value = []
        selectedImageModel.value = null
    }
}
const toggleImageModelMenu = () => {
    if (!imageModelOptions.value.length || generatingImageTask.value) return
    imageModelMenuOpen.value = !imageModelMenuOpen.value
}
const selectImageModel = (model: ModelOption) => {
    selectedImageModel.value = model
    selectedImageResolution.value = resolveShortDramaResolution(model, selectedImageResolution.value)
    persistImageModel(model)
    ensureImageModelRatio(model)
    scheduleProjectGenerationSettingsSave()
    imageModelMenuOpen.value = false
}
const toggleImageResolutionMenu = () => {
    if (!imageResolutionOptions.value.length || generatingImageTask.value) return
    imageModelMenuOpen.value = false
    imageResolutionMenuOpen.value = !imageResolutionMenuOpen.value
}
const selectImageResolution = (value: string) => {
    selectedImageResolution.value = value
    persistImageModel(selectedImageModel.value)
    scheduleProjectGenerationSettingsSave()
    imageResolutionMenuOpen.value = false
}
const toggleRatioMenu = () => {
    if (generatingImageTask.value) return
    ratioMenuOpen.value = !ratioMenuOpen.value
}
const selectRatio = (ratio: RatioOption) => {
    selectedRatio.value = ratio
    scheduleProjectGenerationSettingsSave()
    ratioMenuOpen.value = false
}
const visualRouteQuery = computed(() => ({
    project_id: projectId.value,
    task_id: taskId.value
}))
const visualWorkflowStorageKey = computed(() => projectId.value && taskId.value
    ? `short-drama-visual-started:${projectId.value}:${taskId.value}`
    : '')
const restoreVisualWorkflowStarted = () => {
    const key = visualWorkflowStorageKey.value
    visualWorkflowStarted.value = !!key && sessionStorage.getItem(key) === '1'
}
const markVisualWorkflowStarted = () => {
    visualWorkflowStarted.value = true
    const key = visualWorkflowStorageKey.value
    if (key) sessionStorage.setItem(key, '1')
}
const clearVisualWorkflowStarted = () => {
    visualWorkflowStarted.value = false
    visualWorkflowTaskKeys.value = []
}
const goSubjectCreation = () => router.push({
    path: '/ai/short-drama/subject-create',
    query: visualRouteQuery.value
})
const goCreationStep = (key: CreationStepKey) => {
    if (key === 'script') return
    if (key === 'image' && projectId.value && taskId.value) {
        goSubjectCreation()
    }
}
const goFlowStep = (key: FlowStepKey) => {
    if (key === 'script') return
    if (key === 'subject') {
        goSubjectCreation()
        return
    }
    if (key === 'scene') {
        router.push({
            path: '/ai/short-drama/scene',
            query: visualRouteQuery.value
        })
        return
    }
    if (key === 'storyboard') {
        router.push({
            path: '/ai/short-drama/storyboard',
            query: visualRouteQuery.value
        })
    }
}
const listFromResponse = (data: any) => Array.isArray(data)
    ? data
    : (Array.isArray(data?.lists) ? data.lists : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : [])))
const visualTaskKey = (type: VisualTaskType, entity: PromptEntity) => `${type}:${entity.id}`
const visualTaskKeyFromRow = (item: any) => {
    const type = item?.task_type as VisualTaskType
    if (!['subject_image', 'scene_image'].includes(type)) return ''
    const params = item?.request?.params || item?.params || {}
    const itemId = type === 'subject_image'
        ? (item?.subject_id || item?.item_id || params?.subject_id || '')
        : (item?.scene_id || item?.item_id || params?.scene_id || '')
    return itemId ? `${type}:${itemId}` : ''
}
const loadVisualWorkflowState = async () => {
    if (!projectId.value || !taskId.value) return
    try {
        const [taskData, subjectAssets, sceneAssets] = await Promise.all([
            getShortDramaGenerationLists({
                project_id: projectId.value,
                task_id: taskId.value,
                task_types: 'subject_image,scene_image,three_view'
            }),
            getShortDramaAssets({
                project_id: projectId.value,
                task_id: taskId.value,
                asset_type: 'subject_image'
            }),
            getShortDramaAssets({
                project_id: projectId.value,
                task_id: taskId.value,
                asset_type: 'scene_image'
            })
        ])
        const visualRows = listFromResponse(taskData)
        visualWorkflowTaskKeys.value = visualRows.map(visualTaskKeyFromRow).filter(Boolean)
        const hasRemoteWorkflow = [
            ...visualRows,
            ...listFromResponse(subjectAssets),
            ...listFromResponse(sceneAssets)
        ].length > 0
        if (hasRemoteWorkflow) {
            markVisualWorkflowStarted()
        } else {
            restoreVisualWorkflowStarted()
        }
    } catch {}
}
const createVisualTask = (type: VisualTaskType, entity: PromptEntity) => {
    const model = selectedImageModel.value
    const channelCode = imageModelChannelCode(model)
    const resolution = imageResolutionOptions.value.some((item) => item.value === selectedImageResolution.value)
        ? selectedImageResolution.value
        : ''
    return createShortDramaGeneration({
        project_id: projectId.value,
        task_id: taskId.value,
        task_type: type,
        subject_id: type === 'subject_image' ? entity.id : undefined,
        scene_id: type === 'scene_image' ? entity.id : undefined,
        item_id: entity.id,
        item_name: entity.name,
        item_description: entity.description,
        visual_prompt: entity.visual_prompt || entity.unified_prompt || entity.description,
        image_prompt: entity.visual_prompt || entity.unified_prompt || entity.description,
        subject_name: type === 'subject_image' ? entity.name : undefined,
        scene_name: type === 'scene_image' ? entity.name : undefined,
        subject_prompt: type === 'subject_image' ? (entity.visual_prompt || entity.unified_prompt || entity.description) : undefined,
        scene_prompt: type === 'scene_image' ? (entity.visual_prompt || entity.unified_prompt || entity.description) : undefined,
        model_id: channelCode,
        image_model_id: channelCode,
        channel: channelCode,
        channel_code: channelCode,
        model_name: model?.name || '',
        resolution: resolution || undefined,
        quality: resolution || undefined,
        ratio: selectedRatio.value.label || undefined,
        params: {
            source: 'script_plan',
            batch: true,
            model_id: channelCode,
            image_model_id: channelCode,
            channel: channelCode,
            channel_code: channelCode,
            model_name: model?.name || '',
            resolution: resolution || undefined,
            quality: resolution || undefined,
            item_id: entity.id,
            item_name: entity.name,
            item_description: entity.description,
            visual_prompt: entity.visual_prompt || entity.unified_prompt || entity.description,
            image_prompt: entity.visual_prompt || entity.unified_prompt || entity.description,
            subject_id: type === 'subject_image' ? entity.id : undefined,
            scene_id: type === 'scene_image' ? entity.id : undefined,
            subject_name: type === 'subject_image' ? entity.name : undefined,
            scene_name: type === 'scene_image' ? entity.name : undefined,
            subject_prompt: type === 'subject_image' ? (entity.visual_prompt || entity.unified_prompt || entity.description) : undefined,
            scene_prompt: type === 'scene_image' ? (entity.visual_prompt || entity.unified_prompt || entity.description) : undefined,
            ratio: selectedRatio.value.label || undefined
        }
    })
}
const generateSubjectSceneImages = async () => {
    if (generatingImageTask.value) return
    if (!hasCompleteScriptPlan.value) {
        feedback.msgWarning('剧本生成完整后才能进入创作')
        return
    }
    if (!projectId.value || !taskId.value) {
        feedback.msgError('项目任务不存在，请重新创建')
        return
    }
    await loadVisualWorkflowState()
    if (visualWorkflowStarted.value) {
        if (storyboardDirty.value) {
            generatingImageTask.value = true
            try {
                await persistStoryboardDraft()
                storyboardDirty.value = false
                feedback.msgSuccess('已复制')
            } catch (error: any) {
                feedback.msgError(getRequestErrorMessage(error, '操作失败'))
                return
            } finally {
                generatingImageTask.value = false
            }
        }
        await goSubjectCreation()
        return
    }
    const subjectItems = scriptPlan.value.subjects
    const sceneItems = scriptPlan.value.locations
    if (!subjectItems.length && !sceneItems.length) {
        feedback.msgWarning('请等待剧本生成完成')
        return
    }
    if (!selectedImageModel.value) {
        feedback.msgWarning('请选择可用的生图模型')
        return
    }
    ensureImageModelRatio(selectedImageModel.value)
    generatingImageTask.value = true
    try {
        await saveProjectGenerationSettingsNow().catch(() => {})
        const existingKeys = new Set(visualWorkflowTaskKeys.value)
        const pendingSubjects = subjectItems.filter((subject) => !existingKeys.has(visualTaskKey('subject_image', subject)))
        const pendingScenes = sceneItems.filter((scene) => !existingKeys.has(visualTaskKey('scene_image', scene)))
        if (visualWorkflowStarted.value && !pendingSubjects.length && !pendingScenes.length) {
            await goSubjectCreation()
            return
        }
        const visualTasks: Array<Promise<any>> = [
            ...pendingSubjects.map((subject) => createVisualTask('subject_image', subject)),
            ...pendingScenes.map((scene) => createVisualTask('scene_image', scene))
        ]
        if (visualTasks.length) {
            await Promise.all(visualTasks)
        }
        markVisualWorkflowStarted()
        await goSubjectCreation()
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '生成任务提交失败'))
    } finally {
        generatingImageTask.value = false
    }
}
const schedulePolling = () => {
    stopPolling()
    if (!isTaskStreaming.value) return
    pollTimer = setTimeout(loadTaskDetail, 1500)
}
const loadTaskDetail = async () => {
    if (!taskId.value) {
        feedback.msgError('剧本结果不完整')
        await router.replace('/ai/short-drama')
        return
    }
    loadingTask.value = true
    try {
        const data = await getShortDramaScriptPlanDetail({
            task_id: taskId.value,
            project_id: projectId.value
        })
        applyTaskResult(data)
        if (isTaskStreaming.value) {
            streamingDocumentVisible.value = true
            startThinkingTimer()
            applyStreamingPlanDraft()
            followStreamingOutput()
        } else {
            stopThinkingTimer()
        }
        if (data?.status === 'success' && hasCompletePlanResultPayload(data?.result)) {
            completePlan()
            loadPlanVersions()
        }
        if (data?.status === 'failed') {
            feedback.msgError(data?.error || '剧本生成失败')
        }
        if (['pending', 'queued'].includes(String(data?.status || ''))) {
            startScriptPlanStream()
        } else if (isTaskStreaming.value) {
            schedulePolling()
        }
    } catch (error: any) {
        taskStatus.value = 'failed'
        taskError.value = getRequestErrorMessage(error, '读取任务失败')
        stopThinkingTimer()
        feedback.msgError(taskError.value)
    } finally {
        loadingTask.value = false
    }
}
const createPlanFromDraft = async (message: string) => {
    if (!message) {
        feedback.msgWarning('请输入故事灵感')
        return
    }
    planMessage.value = ''
    const result = await createShortDramaScriptPlan({
        prompt: message,
        ...composerConfigPayload(message),
        source: 'script_plan_empty'
    })
    const redirectUrl = result?.redirect_url || `/ai/short-drama/plan?project_id=${result?.project_id || ''}&task_id=${result?.task_id || ''}`
    await router.replace(redirectUrl)
    await nextTick()
    thinkingSeconds.value = 0
    resetCurrentPlanDraft()
    streamingDocumentVisible.value = true
    planDocumentOpen.value = true
    completed.value = false
    taskError.value = ''
    taskStatus.value = result?.status === 'success' ? 'success' : 'pending'
    taskPrompt.value = message
    await loadTaskDetail()
    await loadPlanVersions()
    await loadVisualWorkflowState()
    scrollChatToBottom()
    feedback.msgSuccess('剧本任务已提交')
}
const sendPlanMessage = async () => {
    const message = planMessage.value.trim()
    if (isCreateDraftMode.value) {
        if (sendingMessage.value) return
        composerMentionMenuOpen.value = false
        closeComposerConfigPanels()
        sendingMessage.value = true
        try {
            await createPlanFromDraft(message)
        } catch (error: any) {
            planMessage.value = message
            feedback.msgError(getRequestErrorMessage(error, '剧本任务创建失败'))
        } finally {
            sendingMessage.value = false
        }
        return
    }
    if (!taskId.value) {
        feedback.msgError('剧本结果不完整')
        return
    }
    if (sendingMessage.value) return
    composerMentionMenuOpen.value = false
    closeComposerConfigPanels()
    sendingMessage.value = true
    if (canRetryCurrentPlan.value) {
        try {
            const result = await retryShortDramaScriptPlan(taskId.value)
            const nextProjectId = result?.project_id || projectId.value
            const nextTaskId = result?.task_id || taskId.value
            planMessage.value = ''
            await router.replace({
                path: '/ai/short-drama/plan',
                query: {
                    project_id: nextProjectId,
                    task_id: nextTaskId
                }
            })
            thinkingSeconds.value = 0
            resetCurrentPlanDraft()
            streamingDocumentVisible.value = true
            planDocumentOpen.value = true
            completed.value = false
            taskError.value = ''
            taskStatus.value = 'pending'
            await loadTaskDetail()
            await loadPlanVersions()
            await loadVisualWorkflowState()
            scrollChatToBottom()
            feedback.msgSuccess('剧本任务已提交')
        } catch (error: any) {
            feedback.msgError(getRequestErrorMessage(error, '操作失败'))
        } finally {
            sendingMessage.value = false
        }
        return
    }
    if (!message) {
        feedback.msgWarning('没有可复制的内容')
        sendingMessage.value = false
        return
    }
    const revisionRecordId = appendRevisionRecord(message)
    planMessage.value = ''
    try {
        const result = await sendShortDramaScriptMessage({
            task_id: taskId.value,
            message,
            mode: 'revise_plan',
            ...composerConfigPayload(message)
        })
        const nextTaskId = result?.task_id || taskId.value
        updateRevisionRecord(revisionRecordId, {
            task_id: String(nextTaskId || ''),
            status: result?.status === 'success' ? 'success' : 'running',
            error: ''
        })
        await router.replace({
            path: '/ai/short-drama/plan',
            query: {
                project_id: projectId.value,
                task_id: nextTaskId
            }
        })
        thinkingSeconds.value = 0
        resetCurrentPlanDraft()
        streamingDocumentVisible.value = true
        planDocumentOpen.value = true
        completed.value = false
        taskError.value = ''
        taskStatus.value = result?.status === 'success' ? 'success' : 'pending'
        await loadTaskDetail()
        await loadPlanVersions()
        await loadVisualWorkflowState()
        syncRevisionRecordWithTask(nextTaskId, taskStatus.value, taskError.value)
        scrollChatToBottom()
        if (result?.status === 'success') {
            feedback.msgSuccess('剧本任务已提交')
        } else {
            feedback.msgSuccess('修改任务已提交，正在生成新剧本')
        }
    } catch (error: any) {
        const message = getRequestErrorMessage(error, '提交失败')
        updateRevisionRecord(revisionRecordId, {
            status: 'failed',
            error: message
        })
        feedback.msgError(message)
    } finally {
        sendingMessage.value = false
    }
}

const clampSplit = (value: number) => {
    const width = workspaceRef.value?.clientWidth || window.innerWidth
    const min = Math.min(760, Math.max(560, width * 0.38))
    const max = Math.max(min + 80, width - Math.min(680, Math.max(560, width * 0.34)))
    return Math.round(Math.min(Math.max(value, min), max))
}
const syncSplitToViewport = () => {
    if (typeof window === 'undefined' || hasDragged.value) return
    splitX.value = clampSplit(window.innerWidth * 877 / 1920)
}
const startSplitDrag = (event: PointerEvent) => {
    isDragging.value = true
    hasDragged.value = true
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    window.addEventListener('pointermove', handleSplitDrag)
    window.addEventListener('pointerup', stopSplitDrag, { once: true })
    handleSplitDrag(event)
}
const handleSplitDrag = (event: PointerEvent) => {
    splitX.value = clampSplit(event.clientX)
}
const stopSplitDrag = () => {
    isDragging.value = false
    window.removeEventListener('pointermove', handleSplitDrag)
}
const closeShotSelect = () => {
    openedShotSelect.value = ''
    imageModelMenuOpen.value = false
    imageResolutionMenuOpen.value = false
    ratioMenuOpen.value = false
    composerMentionMenuOpen.value = false
    closeComposerConfigPanels()
}
const scrollToCatalog = (key: string, event?: MouseEvent) => {
    ;(event?.currentTarget as HTMLElement | undefined)?.blur()
    const item = catalogItems.value.find((catalog) => catalog.key === key)
    const scrollEl = documentScrollRef.value
    const target = item ? document.getElementById(item.target) : null
    if (!item || !scrollEl || !target) return

    activeCatalogKey.value = item.key
    scrollEl.scrollTo({
        top: target.offsetTop,
        behavior: 'smooth'
    })
}
const updateActiveCatalog = () => {
    const scrollEl = documentScrollRef.value
    if (!scrollEl || !catalogItems.value.length) return

    const current = catalogItems.value.reduce((latest, item) => {
        const target = document.getElementById(item.target)
        if (!target) return latest
        return target.offsetTop <= scrollEl.scrollTop + 24 ? item : latest
    }, catalogItems.value[0])
    activeCatalogKey.value = current.key
}

watch(
    () => visualWorkflowStorageKey.value,
    () => {
        clearVisualWorkflowStarted()
        restoreVisualWorkflowStarted()
    },
    { immediate: true }
)

watch(selectedImageModel, (model) => {
    selectedImageResolution.value = resolveShortDramaResolution(model, selectedImageResolution.value)
}, { immediate: true })

watch(composerSubjectCategoryOptions, (options) => {
    if (!options.some((option) => option.value === activeComposerSubjectCategory.value)) {
        activeComposerSubjectCategory.value = 'all'
    }
    composerSubjectCategoryMenuOpen.value = false
})

onMounted(() => {
    syncSplitToViewport()
    loadComposerConfig()
    loadImageModels()
    if (!isCreateDraftMode.value) {
        startThinkingTimer()
        loadRevisionChatRecords()
        loadTaskDetail()
        loadPlanVersions()
        loadVisualWorkflowState()
    }
    window.addEventListener('resize', syncSplitToViewport)
    window.addEventListener('click', closeShotSelect)
})

onBeforeUnmount(() => {
    stopPolling()
    stopThinkingTimer()
    clearStreamingFollowTimer()
    if (generationSettingsSaveTimer) clearTimeout(generationSettingsSaveTimer)
    window.removeEventListener('resize', syncSplitToViewport)
    window.removeEventListener('click', closeShotSelect)
    window.removeEventListener('pointermove', handleSplitDrag)
})
</script>

<style lang="scss" scoped>
.script-plan-page {
    min-width: 1180px;
    min-height: 100vh;
    background: #0c0c0d;
    color: #fff;
    font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    overflow: hidden;
}

.script-plan-page.is-dragging,
.script-plan-page.is-dragging * {
    cursor: col-resize !important;
    user-select: none;
}

button,
textarea {
    font: inherit;
}

.script-plan-topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
    padding: 0 24px 0 28px;
    border-bottom: 1px solid #1e1f20;
    background: #0c0c0d;
    box-sizing: border-box;
}

.script-plan-back {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 14px;
    cursor: pointer;
}

.script-plan-back .el-icon {
    font-size: 14px;
}

.script-plan-steps {
    position: absolute;
    left: 50%;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    transform: translateX(-50%);
}

.script-plan-step {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    border: 0;
    border-radius: 18px;
    padding: 0 14px 0 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.46);
    cursor: default;
}

.script-plan-step:not(:last-child)::after {
    content: '';
    position: absolute;
    right: -9px;
    width: 8px;
    height: 1px;
    background: rgba(255, 255, 255, 0.16);
}

.script-plan-step span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.52);
    font-size: 11px;
    font-weight: 500;
    line-height: 11px;
}

.script-plan-step strong {
    font-size: 14px;
    font-weight: 500;
    line-height: 14px;
    white-space: nowrap;
}

.script-plan-step.is-active {
    background: #1e1f20;
    color: #fff;
}

.script-plan-step.is-active span,
.script-plan-step.is-done span {
    background: #fff;
    color: #050505;
}

.script-plan-credit {
    border: 0;
    color: #fff;
}

:deep(.script-plan-credit > .glass-surface__content) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 13px;
    box-sizing: border-box;
}

.script-plan-credit span,
.script-plan-credit button {
    position: relative;
    z-index: 5;
    font-size: 14px;
    font-weight: 400;
    line-height: 14px;
}

.script-plan-credit button {
    border: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.32);
    padding: 0 0 0 12px;
    background: transparent;
    color: #ffbe32;
    cursor: pointer;
}

.script-plan-workspace {
    position: fixed;
    top: 72px;
    left: 0;
    right: 0;
    bottom: 0;
    min-width: 0;
    min-height: 0;
}

.script-chat {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    min-width: 0;
}

.script-plan-page.is-expanded .script-chat {
    width: var(--split-x);
}

.script-chat__rail {
    position: absolute;
    top: 40px;
    bottom: 180px;
    left: 50%;
    width: 808px;
    transform: translateX(-50%);
    overflow-y: auto;
    padding-bottom: 28px;
    scrollbar-width: none;
    box-sizing: border-box;
}

.script-chat__rail::-webkit-scrollbar {
    display: none;
}

.script-chat__rail.is-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-bottom: 0;
}

.plan-empty-state {
    width: min(520px, 100%);
    text-align: center;
}

.plan-empty-state strong {
    display: block;
    color: #fff;
    font-size: 22px;
    font-weight: 600;
    line-height: 30px;
}

.plan-empty-state p {
    margin: 12px 0 0;
    color: rgba(255, 255, 255, 0.46);
    font-size: 14px;
    line-height: 22px;
}

.script-plan-page.is-expanded .script-chat__rail {
    left: clamp(24px, calc((var(--split-x) - 819px) / 2), 77px);
    width: min(808px, calc(var(--split-x) - 58px));
    transform: none;
}

.user-story-wrap {
    position: relative;
    width: 100%;
}

.plan-chat-turn {
    width: 100%;
}

.plan-chat-turn + .plan-chat-turn {
    margin-top: 40px;
}

.user-story-card {
    position: relative;
    width: calc(100% - 96px);
    height: auto;
    max-height: 214px;
    margin-left: 48px;
    padding: 16px 58px 16px 27px;
    border-radius: 20px;
    background: #1e1f20;
    box-sizing: border-box;
    overflow: hidden;
}

.user-story-card.is-open {
    max-height: none;
    overflow: visible;
}

.user-story-card p {
    margin: 0;
    color: #fff;
    font-size: 16px;
    font-weight: 400;
    line-height: 30px;
    white-space: pre-wrap;
    word-break: break-word;
}

.user-story-card__toggle {
    position: absolute;
    top: 18px;
    right: 22px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #a5a5a6;
    font-size: 18px;
    cursor: pointer;
}

.user-story-card__toggle .el-icon {
    transition: transform 0.18s ease;
}

.user-story-card__toggle .el-icon.is-open {
    transform: rotate(180deg);
}

.user-avatar {
    position: absolute;
    top: 0;
    right: 0;
    display: block;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
}

.agent-reply {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 16px;
    margin-top: 24px;
}

.agent-reply__spark {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 2px;
    color: #fff;
    font-size: 28px;
}

.agent-reply__content {
    min-width: 0;
}

.agent-reply__content p {
    width: calc(100% - 96px);
    margin: 0;
    color: #fff;
    font-size: 16px;
    font-weight: 400;
    line-height: 30px;
    word-break: break-word;
}

.agent-thinking {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 30px;
    color: #fff;
}

.agent-thinking strong {
    font-size: 16px;
    font-weight: 500;
    line-height: 30px;
}

.agent-thinking span {
    color: rgba(255, 255, 255, 0.56);
    font-size: 13px;
    line-height: 18px;
}

.stream-steps {
    display: grid;
    gap: 18px;
    margin: 24px 0 0;
    padding: 0;
    list-style: none;
}

.stream-steps li {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 14px;
    line-height: 20px;
    transition: color 0.2s ease;
}

.stream-steps i {
    position: relative;
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.22);
    justify-self: center;
}

.stream-steps li.is-active {
    color: rgba(255, 255, 255, 0.86);
}

.stream-steps li.is-active i {
    background: #9dc6f4;
    box-shadow: 0 0 0 6px rgba(157, 198, 244, 0.12);
}

.stream-steps li.is-done {
    color: rgba(255, 255, 255, 0.72);
}

.stream-steps li.is-done i {
    background: #fff;
}

.planning-lines {
    display: grid;
    gap: 24px;
    margin: 24px 0 0;
    padding: 0;
    list-style: none;
    color: #a1a1a1;
    font-size: 14px;
    font-weight: 400;
    line-height: 14px;
}

.planning-checklist {
    display: grid;
    gap: 14px;
    margin: 22px 0 0;
    padding: 0;
    list-style: none;
    color: rgba(255, 255, 255, 0.9);
    font-size: 15px;
    line-height: 22px;
}

.planning-checklist li {
    position: relative;
    padding-left: 28px;
}

.planning-checklist li:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 22px;
    bottom: -14px;
    border-left: 1px dashed rgba(255, 255, 255, 0.14);
}

.planning-checklist__row {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 10px;
    font-weight: 500;
}

.planning-checklist__row span {
    min-width: 0;
    word-break: break-word;
}

.planning-checklist__dot {
    position: absolute;
    left: 0;
    top: 3px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.88);
}

.planning-checklist__dot::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 3px;
    width: 6px;
    height: 4px;
    border-left: 1.5px solid #151515;
    border-bottom: 1.5px solid #151515;
    transform: rotate(-45deg);
}

.planning-checklist__arrow {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    color: rgba(255, 255, 255, 0.7);
    transform: rotate(180deg);
}

.planning-checklist__children {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 9px;
}

.planning-checklist__children span {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
    line-height: 18px;
    word-break: break-word;
}

.planning-checklist__children i {
    position: relative;
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
}

.planning-checklist__children i::after {
    content: '';
    position: absolute;
    left: 3px;
    top: 2px;
    width: 4px;
    height: 3px;
    border-left: 1px solid rgba(255, 255, 255, 0.86);
    border-bottom: 1px solid rgba(255, 255, 255, 0.86);
    transform: rotate(-45deg);
}

.generated-file-list {
    display: grid;
    gap: 12px;
    width: calc(100% - 96px);
    max-height: 220px;
    margin-top: 38px;
    margin-left: 48px;
    overflow: auto;
    scrollbar-width: none;
}

.generated-file-list::-webkit-scrollbar {
    display: none;
}

.generated-file-card {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 91px;
    align-items: center;
    width: 100%;
    height: 78px;
    padding: 0 18px 0 24px;
    border: 1px solid transparent;
    border-radius: 20px;
    background: rgba(30, 31, 32, 0.6);
    box-sizing: border-box;
}

.generated-file-card--turn {
    width: calc(100% - 96px);
    margin: 34px 0 0 48px;
}

.generated-file-card.is-current {
    border-color: rgba(157, 198, 244, 0.28);
    background: rgba(38, 43, 50, 0.7);
}

.generated-file-card__icon {
    display: inline-flex;
    align-items: center;
    color: #a5a5a6;
    font-size: 24px;
}

.generated-file-card__meta {
    min-width: 0;
}

.generated-file-card__meta strong,
.generated-file-card__meta span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.generated-file-card__meta strong {
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    line-height: 16px;
}

.generated-file-card__meta span {
    margin-top: 12px;
    color: #a5a5a6;
    font-size: 12px;
    font-weight: 400;
    line-height: 12px;
}

.generated-file-card button {
    width: 91px;
    height: 40px;
    border: 0;
    border-radius: 20px;
    background: #9dc6f4;
    color: #050505;
    font-size: 16px;
    font-weight: 500;
    line-height: 16px;
    cursor: pointer;
}

.revision-chat-list {
    display: grid;
    gap: 40px;
    width: 100%;
    margin-top: 40px;
}

.revision-chat-item {
    width: 100%;
}

.revision-story-wrap {
    margin-top: 0;
}

.revision-story-card {
    max-height: 154px;
}

.agent-reply--revision {
    margin-top: 24px;
}

.agent-reply--revision .agent-reply__spark {
    font-size: 24px;
}

.agent-reply--revision .agent-reply__content p {
    color: rgba(255, 255, 255, 0.72);
}

.plan-composer {
    position: absolute;
    left: 50%;
    bottom: 24px;
    z-index: 8;
    width: 808px !important;
    height: 136px !important;
    transform: translateX(-50%);
    text-align: left;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 20px !important;
    background: #1e1f20 !important;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
}

.script-plan-page.is-expanded .plan-composer {
    left: clamp(24px, calc((var(--split-x) - 819px) / 2), 77px);
    width: min(808px, calc(var(--split-x) - 58px)) !important;
    transform: none;
}

:deep(.plan-composer > .glass-surface__content) {
    display: block;
    position: relative;
    padding: 18px 18px 14px 18px;
    box-sizing: border-box;
}

.plan-composer::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 0;
    border-radius: inherit;
    pointer-events: none;
}

.plan-composer textarea {
    position: relative;
    z-index: 5;
    display: block;
    width: 100%;
    height: 76px;
    padding: 0 52px 0 0;
    border: 0;
    outline: none;
    resize: none;
    background: transparent;
    color: #fff;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.7;
    letter-spacing: 0;
    overflow-y: auto;
    scrollbar-width: none;
    box-sizing: border-box;
}

.plan-composer textarea:disabled {
    opacity: 0.62;
}

.plan-composer textarea::placeholder {
    color: #7f7f80;
    opacity: 1;
}

.plan-composer textarea::-webkit-scrollbar {
    display: none;
}

.plan-composer__toolbar,
.plan-composer__tools {
    position: relative;
    z-index: 5;
    display: flex;
    align-items: center;
}

.plan-composer__toolbar {
    position: absolute;
    right: 18px;
    bottom: 14px;
    left: 18px;
    justify-content: flex-start;
    height: 32px;
    min-height: 0;
}

.plan-composer__tools {
    gap: 16px;
    width: auto;
}

.plan-composer__tools button,
.plan-composer__send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    cursor: pointer;
}

.plan-composer__tools button {
    width: 32px;
    height: 32px;
    font-size: 22px;
    border-radius: 50%;
    transition: background 0.16s ease, opacity 0.16s ease, width 0.16s ease;
}

.plan-composer__tools button.is-active,
.plan-composer__tools button:hover {
    background: rgba(255, 255, 255, 0.12);
}

.plan-composer__tools button.has-selected-style {
    gap: 8px;
    width: 132px;
    max-width: 190px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 999px;
    padding: 0 8px 0 6px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    justify-content: flex-start;
    box-sizing: border-box;
}

.plan-composer__tools button.has-selected-style span {
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.plan-composer__tools button.has-selected-style i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    border: 1px solid rgba(255, 255, 255, 0.56);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.74);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}

.plan-composer__tools button.has-selected-style i img {
    display: block;
    width: 12px;
    height: 12px;
}

.plan-style-tool__avatar {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
}

.plan-composer__mention {
    color: rgba(255, 255, 255, 0.74);
    font-size: 23px;
    font-weight: 400;
    line-height: 1;
}

.plan-composer__send {
    margin-left: 0;
    width: 28px;
    height: 28px;
    margin-left: -2px;
    border-radius: 50%;
    background: #fff;
    color: #fff;
}

.plan-composer__multi {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    margin-right: 14px;
    color: #fff;
    font-size: 14px;
    line-height: 14px;
    cursor: pointer;
    user-select: none;
}

.plan-composer__multi input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.plan-composer__multi-track {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    width: 36px;
    height: 20px;
    padding: 0 3px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.14);
    box-sizing: border-box;
    transition: background 0.18s ease;
}

.plan-composer__multi-track i {
    display: block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.18s ease, background 0.18s ease;
}

.plan-composer__multi input:checked + .plan-composer__multi-track {
    background: #fff;
}

.plan-composer__multi input:checked + .plan-composer__multi-track i {
    background: #292929;
    transform: translateX(18px);
}

.plan-composer__send.has-message:not(:disabled) .script-plan-icon--send {
    filter: brightness(0);
    opacity: 1;
}

.plan-composer__send:disabled {
    cursor: default;
    opacity: 0.58;
}

.plan-composer__loading {
    font-size: 16px;
    animation: plan-spin 0.9s linear infinite;
}

@keyframes plan-spin {
    to {
        transform: rotate(360deg);
    }
}

.script-plan-icon {
    display: block;
    flex: 0 0 auto;
    object-fit: contain;
}

.script-plan-icon--tool {
    width: 32px;
    height: 32px;
    filter: brightness(0) invert(1);
    opacity: 1;
}

.script-plan-icon--send {
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(54%);
    opacity: 1;
}

.plan-tool-panel {
    position: absolute;
    left: calc(50% - 404px);
    bottom: 75px;
    z-index: 42;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 20px;
    background: rgba(30, 31, 32, 0.96);
    box-shadow: none;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    color: #fff;
    text-align: left;
    box-sizing: border-box;
}

.script-plan-page.is-expanded .plan-tool-panel {
    left: clamp(24px, calc((var(--split-x) - 819px) / 2), 77px);
}

.plan-tool-panel--model {
    left: calc(50% - 432px);
    width: 220px;
    max-height: min(320px, calc(100vh - 220px));
    padding: 18px 8px 10px;
    overflow-y: auto;
    scrollbar-width: none;
}

.script-plan-page.is-expanded .plan-tool-panel--model {
    left: max(8px, calc(clamp(24px, calc((var(--split-x) - 819px) / 2), 77px) - 28px));
}

.plan-tool-panel--model::-webkit-scrollbar {
    display: none;
}

.plan-model-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.plan-model-group p {
    margin: 0 0 10px;
    padding: 0 12px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    line-height: 1;
}

.plan-model-option {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 16px;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 52px;
    border: 0;
    border-radius: 10px;
    padding: 0 12px;
    background: transparent;
    color: #fff;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.16s ease;
}

.plan-model-option:hover,
.plan-model-option.is-active {
    background: rgba(255, 255, 255, 0.1);
}

.plan-model-option img {
    display: block;
    width: 24px;
    height: 24px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 50%;
    object-fit: cover;
}

.plan-model-option span {
    min-width: 0;
}

.plan-model-option strong,
.plan-model-option small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.plan-model-option strong {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
}

.plan-model-option small {
    margin-top: 2px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
    line-height: 15px;
}

.plan-model-option i {
    color: #fff;
    font-size: 13px;
    font-style: normal;
}

.plan-tool-panel--picker {
    width: min(808px, calc(100vw - 120px));
    height: min(320px, calc(100vh - 220px));
}

.script-plan-page.is-expanded .plan-tool-panel--picker {
    width: min(808px, calc(var(--split-x) - 58px));
}

.plan-picker-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
}

.plan-picker-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    min-height: 28px;
    margin-bottom: 12px;
}

.plan-picker-panel__head strong {
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
}

.plan-picker-tabs,
.plan-picker-category {
    display: flex;
    align-items: center;
}

.plan-picker-tabs {
    gap: 12px;
}

.plan-picker-tabs button {
    border: 0;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.42);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
}

.plan-picker-tabs button.is-active {
    color: #fff;
    font-weight: 600;
}

.plan-picker-category {
    position: relative;
    margin-left: auto;
}

.plan-picker-category__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 92px;
    height: 28px;
    border: 0;
    border-radius: 999px;
    padding: 0 28px 0 14px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    line-height: 28px;
    outline: none;
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.16s ease;
}

.plan-picker-category__trigger:hover,
.plan-picker-category__trigger.is-open {
    background: rgba(255, 255, 255, 0.12);
}

.plan-picker-category__trigger span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.plan-picker-category__trigger img {
    position: absolute;
    top: 50%;
    right: 10px;
    width: 12px;
    height: 12px;
    pointer-events: none;
    filter: brightness(0) invert(1);
    opacity: 0.72;
    transform: translateY(-50%);
}

.plan-picker-category__trigger.is-open img {
    transform: translateY(-50%) rotate(180deg);
}

.plan-picker-category__menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 6;
    min-width: 92px;
    max-height: 156px;
    padding: 6px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: #171717;
    box-shadow: none;
    scrollbar-width: none;
    box-sizing: border-box;
}

.plan-picker-category__menu::-webkit-scrollbar {
    display: none;
}

.plan-picker-category__menu button {
    display: flex;
    align-items: center;
    width: 100%;
    height: 32px;
    border: 0;
    border-radius: 8px;
    padding: 0 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    line-height: 1;
    text-align: left;
    cursor: pointer;
}

.plan-picker-category__menu button:hover,
.plan-picker-category__menu button.is-active {
    background: #252525;
    color: #fff;
}

.plan-subject-grid,
.plan-style-grid {
    display: grid;
    min-height: 0;
    overflow: hidden auto;
    scrollbar-width: none;
}

.plan-subject-grid::-webkit-scrollbar,
.plan-style-grid::-webkit-scrollbar {
    display: none;
}

.plan-subject-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
}

.plan-style-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
}

.plan-subject-card,
.plan-style-grid button {
    position: relative;
    min-width: 0;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    overflow: hidden;
    cursor: pointer;
}

.plan-subject-card {
    height: 174px;
}

.plan-style-grid button {
    height: 154px;
}

.plan-subject-card img,
.plan-style-grid img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.plan-subject-card::after,
.plan-style-grid button::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 52%;
    content: '';
    background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.62));
    pointer-events: none;
}

.plan-subject-card > span:last-child,
.plan-style-grid span {
    position: absolute;
    right: 10px;
    bottom: 12px;
    left: 10px;
    z-index: 2;
    overflow: hidden;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
}

.plan-subject-card.is-selected {
    box-shadow: inset 0 0 0 2px rgba(157, 198, 244, 0.9);
}

.plan-subject-card.is-create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.plan-subject-card.is-create::after {
    display: none;
}

.plan-subject-card.is-create > span:last-child {
    position: static;
    color: rgba(255, 255, 255, 0.68);
    text-align: center;
}

.plan-subject-card__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(255, 255, 255, 0.56);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.74);
}

.plan-style-grid button.is-active {
    box-shadow: inset 0 0 0 2px rgba(157, 198, 244, 0.9);
}

.plan-style-grid em {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 2;
    border-radius: 0 8px 0 8px;
    padding: 4px 8px;
    background: #ffb42e;
    color: #171719;
    font-size: 12px;
    font-style: normal;
    font-weight: 700;
    line-height: 1;
}

.plan-mention-menu {
    position: absolute;
    left: calc(50% - 360px);
    bottom: 75px;
    z-index: 40;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    width: min(392px, calc(100% - 96px));
    max-height: 246px;
    padding: 10px;
    overflow: auto;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    background: rgba(18, 19, 20, 0.94);
    box-shadow: none;
    scrollbar-width: none;
    box-sizing: border-box;
}

.script-plan-page.is-expanded .plan-mention-menu {
    left: max(16px, calc(clamp(24px, calc((var(--split-x) - 819px) / 2), 77px) - 59px));
}

.plan-mention-menu::-webkit-scrollbar,
.plan-mention-menu__group::-webkit-scrollbar {
    display: none;
}

.plan-mention-menu__group {
    display: grid;
    align-content: start;
    gap: 4px;
    min-width: 0;
    max-height: 226px;
    overflow: auto;
    scrollbar-width: none;
}

.plan-mention-menu__group p {
    margin: 0 0 4px;
    padding: 0 8px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
    line-height: 24px;
}

.plan-mention-menu__group button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.86);
    font-size: 13px;
    line-height: 34px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.plan-mention-menu__group button span {
    flex: 0 0 auto;
    margin-right: 2px;
    color: #9dc6f4;
}

.plan-mention-menu__group button:hover {
    background: rgba(255, 255, 255, 0.1);
}

.plan-mention-menu__group em {
    margin: 0;
    padding: 10px 8px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
    font-style: normal;
}

.split-divider {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--split-x);
    z-index: 12;
    width: 13px;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: col-resize;
    transform: translateX(-6px);
}

.split-divider::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 6px;
    width: 1px;
    background: #1e1f20;
}

.split-divider:hover::before,
.script-plan-page.is-dragging .split-divider::before {
    background: rgba(255, 255, 255, 0.28);
}

.plan-document {
    position: absolute;
    top: 0;
    right: 24px;
    bottom: 0;
    left: calc(var(--split-x) + 24px);
    min-width: 0;
    background: #0c0c0d;
}

.plan-document::before,
.plan-document::after {
    content: '';
    position: fixed;
    right: 0;
    left: var(--split-x);
    height: 1px;
    background: #1e1f20;
}

.plan-document::before {
    top: 160px;
}

.plan-document::after {
    bottom: 101px;
}

.plan-document__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 88px;
    box-sizing: border-box;
}

.plan-document__title {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: start;
    gap: 16px;
    min-width: 0;
}

.plan-document__title > .el-icon {
    color: #a5a5a6;
    font-size: 24px;
}

.plan-document__title strong,
.plan-document__title span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.plan-document__title strong {
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    line-height: 16px;
}

.plan-document__title span {
    margin-top: 12px;
    color: #a5a5a6;
    font-size: 12px;
    font-weight: 400;
    line-height: 12px;
}

.plan-document__header button {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #a5a5a6;
    font-size: 22px;
    cursor: pointer;
}

.plan-document__scroll {
    position: absolute;
    top: 112px;
    right: 0;
    bottom: 102px;
    left: 0;
    padding: 0 42px 28px 0;
    overflow-y: auto;
    scrollbar-width: none;
    box-sizing: border-box;
}

.plan-catalog {
    position: absolute;
    top: 120px;
    right: 4px;
    z-index: 5;
    display: grid;
    align-content: center;
    gap: 0;
    width: 26px;
    min-height: 164px;
    padding: 8px 0;
    border: 0;
    border-radius: 14px;
    background: transparent;
    overflow: hidden;
    transition:
        width 0.18s ease,
        padding 0.18s ease,
        background 0.18s ease,
        box-shadow 0.18s ease;
}

.plan-catalog:hover {
    width: 112px;
    padding: 16px 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(30, 31, 32, 0.92);
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.24);
}

.plan-catalog__item {
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
    border: 0;
    padding: 0 12px 0 28px;
    background: transparent;
    color: #7e7e80;
    font-size: 14px;
    font-weight: 500;
    line-height: 14px;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
    opacity: 1;
    transition:
        color 0.14s ease,
        padding 0.18s ease;
}

.plan-catalog__item::before {
    content: '';
    position: absolute;
    left: 12px;
    width: 2px;
    height: 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    transition:
        background 0.14s ease,
        left 0.18s ease;
}

.plan-catalog:not(:hover) .plan-catalog__item {
    width: 26px;
    padding: 0;
    color: transparent;
    font-size: 0;
    pointer-events: auto;
}

.plan-catalog:not(:hover) .plan-catalog__item::before {
    left: 12px;
}

.plan-catalog__item.is-active {
    color: #fff;
}

.plan-catalog__item.is-active::before {
    background: #fff;
}

.plan-document__scroll::-webkit-scrollbar {
    display: none;
}

.doc-section {
    margin-bottom: 28px;
}

.doc-section h2 {
    margin: 0 0 16px;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 18px;
}

.story-content-card {
    position: relative;
    height: auto;
    max-height: 285px;
    padding: 18px 72px 18px 20px;
    border-radius: 20px;
    background: #1e1f20;
    box-sizing: border-box;
    overflow: hidden;
}

.story-content-card.is-open {
    max-height: none;
    overflow: visible;
}

.story-content-card__actions {
    position: absolute;
    top: 20px;
    right: 18px;
    display: inline-flex;
    gap: 18px;
}

.story-content-card__actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: #a5a5a6;
    font-size: 18px;
    cursor: pointer;
}

.story-content-card__actions .el-icon {
    transition: transform 0.18s ease;
}

.story-content-card__actions .el-icon.is-open {
    transform: rotate(180deg);
}

.story-content-card__meta,
.story-content-card__roles,
.story-content-card li,
.plain-copy p {
    margin: 0;
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 30px;
    letter-spacing: 0;
}

.story-content-card ul {
    margin: 20px 0 0;
    padding: 0;
    list-style: none;
}

.plain-copy {
    display: grid;
    gap: 10px;
}

.plain-copy p {
    color: #a1a1a1;
    word-break: break-word;
}

.doc-section--typing .is-typewriting-line::after,
.doc-section--typing .plain-copy > p:last-child::after,
.doc-section--typing .prompt-detail:last-child p:last-child::after,
.doc-section--typing .shot-card:last-child dd span:last-child::after {
    content: '';
    display: inline-block;
    width: 1px;
    height: 1em;
    margin-left: 3px;
    background: rgba(255, 255, 255, 0.82);
    vertical-align: -2px;
    animation: short-drama-type-caret 0.9s steps(2, start) infinite;
}

@keyframes short-drama-type-caret {
    0%,
    45% {
        opacity: 1;
    }

    46%,
    100% {
        opacity: 0;
    }
}

.streaming-tail {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: 34px;
    margin: 6px 0 18px;
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    font-weight: 500;
    line-height: 22px;
}

.streaming-tail.is-empty {
    margin-top: 0;
}

.streaming-tail i {
    display: inline-block;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.2;
    animation: script-plan-thinking-dot 1.05s infinite ease-in-out;
}

.streaming-tail i:nth-child(3) {
    animation-delay: 0.16s;
}

.streaming-tail i:nth-child(4) {
    animation-delay: 0.32s;
}

@keyframes script-plan-thinking-dot {
    0%,
    80%,
    100% {
        opacity: 0.2;
        transform: translateY(0);
    }

    35% {
        opacity: 1;
        transform: translateY(-2px);
    }
}

.prompt-detail {
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    border-radius: 12px;
    background: #1e1f20;
}

.prompt-detail strong {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
}

.prompt-detail p {
    line-height: 24px;
}

.shot-card dd p {
    margin: 0 0 6px;
}

.shot-card dd p:last-child {
    margin-bottom: 0;
}

.act-card {
    margin-bottom: 12px;
}

.act-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    border: 0;
    border-radius: 12px;
    padding: 0 16px;
    background: #1e1f20;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 14px;
    cursor: pointer;
}

.act-card__header .el-icon {
    transition: transform 0.18s ease;
}

.act-card__header .el-icon.is-open {
    transform: rotate(180deg);
}

.shot-list {
    display: grid;
    gap: 0;
    margin-top: 10px;
}

.shot-insert-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 10px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
}

.shot-insert-btn::before,
.shot-insert-btn::after {
    position: absolute;
    top: 50%;
    height: 0.5px;
    background: repeating-linear-gradient(
        to right,
        rgba(255, 255, 255, 0.82) 0,
        rgba(255, 255, 255, 0.82) 4px,
        transparent 4px,
        transparent 9px
    );
    content: '';
    opacity: 0;
    transform: translateY(-50%);
    transition: opacity 0.16s ease;
}

.shot-insert-btn::before {
    left: 0;
    right: calc(50% + 20px);
    -webkit-mask-image: linear-gradient(to right, transparent 0, #000 100%);
    mask-image: linear-gradient(to right, transparent 0, #000 100%);
}

.shot-insert-btn::after {
    left: calc(50% + 20px);
    right: 0;
    -webkit-mask-image: linear-gradient(to left, transparent 0, #000 100%);
    mask-image: linear-gradient(to left, transparent 0, #000 100%);
}

.shot-insert-btn span {
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
    opacity: 0;
    transition:
        opacity 0.16s ease,
        background 0.16s ease,
        color 0.16s ease;
}

.shot-insert-btn:hover::before,
.shot-insert-btn:hover::after,
.shot-insert-btn:hover span,
.shot-insert-btn:focus-visible::before,
.shot-insert-btn:focus-visible::after,
.shot-insert-btn:focus-visible span {
    opacity: 1;
}

.shot-insert-btn:hover span {
    background: #fff;
    color: #1e1f20;
}

.shot-card {
    position: relative;
    padding: 16px 68px 16px 18px;
    border-radius: 12px;
    background: #1e1f20;
}

.shot-card.is-editing {
    padding-right: 18px;
    padding-bottom: 16px;
}

.shot-card.is-editing {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.shot-card__actions {
    position: absolute;
    top: 16px;
    right: 16px;
    display: inline-flex;
    gap: 14px;
}

.shot-card__actions--editing {
    top: 11px;
    gap: 8px;
    z-index: 2;
}

.shot-card__actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: #a5a5a6;
    font-size: 18px;
    cursor: pointer;
}

.shot-card__actions--editing button {
    height: 30px;
    min-width: 52px;
    padding: 0 14px;
    border-radius: 999px;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 14px;
}

.shot-card__actions--editing button:disabled {
    cursor: not-allowed;
    opacity: 0.68;
}

.shot-card__actions--editing .shot-edit-action--cancel {
    background: #303030;
}

.shot-card__actions--editing .shot-edit-action--done {
    background: #fff;
    color: #1e1f20;
}

.shot-save-loading {
    margin-right: 4px;
    animation: shot-save-spin 0.8s linear infinite;
}

@keyframes shot-save-spin {
    from {
        transform: rotate(0);
    }

    to {
        transform: rotate(360deg);
    }
}

.shot-card h3 {
    margin: 0 0 12px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
}

.shot-card dl,
.shot-card dl > div {
    display: grid;
    gap: 8px;
}

.shot-card dl {
    margin: 0;
}

.shot-card dl > div {
    grid-template-columns: 72px minmax(0, 1fr);
}

.shot-card dl > div.shot-card__prompt-row {
    grid-template-columns: 96px minmax(0, 1fr);
}

.shot-card dt,
.shot-card dd {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 24px;
}

.shot-card dt {
    color: #fff;
}

.shot-card dd {
    color: #a1a1a1;
    word-break: break-word;
}

.shot-prompt-text {
    display: block;
    white-space: pre-wrap;
    line-height: 22px;
}

.shot-field {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    outline: none;
    background: rgba(5, 5, 5, 0.28);
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 22px;
    box-sizing: border-box;
}

.shot-field:focus {
    border-color: rgba(255, 255, 255, 0.34);
}

.shot-field--textarea {
    min-height: 58px;
    padding: 8px 10px;
    resize: vertical;
}

.shot-field--prompt {
    min-height: 148px;
    white-space: pre-wrap;
}

.shot-field--input {
    height: 34px;
    padding: 0 10px;
}

.shot-dialogue-edit {
    display: grid;
    gap: 8px;
}

.shot-select-dropdown {
    position: relative;
    width: 100%;
}

.shot-select-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 34px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(5, 5, 5, 0.28);
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 22px;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 0.2s ease, background 0.2s ease;
}

.shot-select-card:hover,
.shot-select-card.is-open {
    border-color: rgba(255, 255, 255, 0.34);
    background: rgba(255, 255, 255, 0.03);
}

.shot-select-card span {
    min-width: 0;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.shot-select-card span.is-placeholder {
    color: rgba(255, 255, 255, 0.46);
}

.shot-select-card .el-icon {
    flex-shrink: 0;
    margin-left: 10px;
    color: rgba(255, 255, 255, 0.54);
    font-size: 14px;
    transition: transform 0.2s ease;
}

.shot-select-card.is-open .el-icon {
    transform: rotate(180deg);
}

.shot-select-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 30;
    width: 100%;
    max-height: 188px;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    background: #171717;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    overflow-y: auto;
    box-sizing: border-box;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.shot-select-menu::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

.shot-select-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #fff;
    font-size: 14px;
    line-height: 20px;
    text-align: left;
    cursor: pointer;
}

.shot-select-menu button:hover,
.shot-select-menu button.is-active {
    background: #252525;
}

.plan-document__footer {
    position: absolute;
    right: 4px;
    bottom: 37px;
    z-index: 3;
    display: flex;
    align-items: flex-end;
    gap: 12px;
}

.plan-ratio-picker {
    position: relative;
    width: 116px;
}

.plan-ratio-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 116px;
    height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 23px;
    background: rgba(5, 5, 5, 0.4);
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 14px;
    cursor: pointer;
}

.plan-ratio-trigger:disabled {
    cursor: default;
    opacity: 0.55;
}

.plan-ratio-trigger__shape,
.plan-ratio-option__shape {
    display: inline-block;
    flex: 0 0 auto;
    border: 1.5px solid currentColor;
    border-radius: 2px;
    box-sizing: border-box;
}

.plan-ratio-trigger .el-icon {
    font-size: 14px;
    transition: transform 0.18s ease;
}

.plan-ratio-trigger .el-icon.is-open {
    transform: rotate(180deg);
}

.plan-ratio-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 10px);
    z-index: 30;
    width: 116px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.32);
    border-radius: 12px;
    background: rgba(17, 17, 17, 0.92);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.38);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-sizing: border-box;
}

.plan-ratio-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 36px;
    border: 0;
    border-radius: 8px;
    padding: 0 10px;
    background: transparent;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
}

.plan-ratio-menu button:hover,
.plan-ratio-menu button.is-active {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.08));
}

.generate-subject-scene {
    width: 173px;
    height: 44px;
    border: 0;
    border-radius: 8px;
    background: #fff;
    color: #1e1f20;
    font-size: 16px;
    font-weight: 500;
    line-height: 16px;
    cursor: pointer;
}

.generate-subject-scene:disabled {
    cursor: default;
    opacity: 0.52;
}

.image-model-picker {
    position: relative;
    width: 185px;
}

.image-resolution-picker {
    position: relative;
    width: 96px;
}

.image-model-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 185px;
    height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 23px;
    background: rgba(5, 5, 5, 0.4);
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 14px;
    cursor: pointer;
}

.image-resolution-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 96px;
    height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 23px;
    background: rgba(5, 5, 5, 0.4);
    color: #fff;
    font-size: 14px;
    cursor: pointer;

    &:disabled {
        cursor: default;
        opacity: 0.55;
    }

    .el-icon {
        font-size: 14px;
        transition: transform 0.18s ease;

        &.is-open {
            transform: rotate(180deg);
        }
    }
}

.image-model-trigger:disabled {
    cursor: default;
    opacity: 0.55;
}

.image-model-trigger span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.image-model-trigger__icon {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
}

.image-model-trigger .el-icon:last-child {
    font-size: 14px;
    transition: transform 0.18s ease;
}

.image-model-trigger .el-icon.is-open {
    transform: rotate(180deg);
}

.image-model-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 10px);
    z-index: 30;
    width: 185px;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.32);
    border-radius: 12px;
    background: rgba(17, 17, 17, 0.92);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.38);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-sizing: border-box;
}

.image-resolution-menu {
    width: 120px;
}

.image-model-menu button {
    display: flex;
    align-items: center;
    width: 100%;
    height: 38px;
    border: 0;
    border-radius: 8px;
    padding: 0 12px;
    background: transparent;
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 14px;
    text-align: left;
    cursor: pointer;
}

.image-model-menu button:hover,
.image-model-menu button.is-active {
    background: rgba(255, 255, 255, 0.12);
}

.image-model-menu-fade-enter-active,
.image-model-menu-fade-leave-active {
    transition: opacity 0.16s ease, transform 0.16s ease;
}

.image-model-menu-fade-enter-from,
.image-model-menu-fade-leave-to {
    opacity: 0;
    transform: translateY(8px);
}

@media (max-width: 1500px) {
    .script-plan-page {
        min-width: 1180px;
    }

    .agent-reply__content p,
    .user-story-card,
    .generated-file-list,
    .generated-file-card {
        width: calc(100% - 72px);
        margin-left: 36px;
    }

    .generated-file-card {
        width: 100%;
        margin-left: 0;
    }

    .user-avatar {
        right: 0;
    }
}
</style>
