<template>
    <div class="visual-creation-page">
        <ShortDramaFlowTopbar
            :active="mode"
            :title="projectTitle"
            editable
            :show-steps="true"
            @back="goPlan"
            @rename="renameProjectTitle"
            @step="goStep"
        />

        <main class="visual-canvas" :class="`is-${mode}`">
            <section v-if="mode === 'subject'" class="subject-gallery" aria-label="主体列表">
                <div v-for="subject in subjectItems" :key="subject.id" class="subject-pair">
                    <article class="creation-card subject-card">
                        <ShortDramaImagePreview
                            v-if="subjectImageFor(subject)"
                            :src="subjectImageFor(subject)"
                            :alt="subject.name"
                        />
                        <div v-else class="creation-placeholder">
                            <ShortDramaGrainientPlaceholder v-if="isTaskActive(taskFor('subject_image', subject)?.status)" />
                            <span v-else>{{ statusText(taskFor('subject_image', subject)?.status, '待生成') }}</span>
                        </div>
                        <div class="card-tools is-double">
                            <button type="button" aria-label="删除主体" @click.stop="deleteSubject(subject)">
                                <img :src="iconUrl('shanchu.svg')" alt="" />
                            </button>
                            <button type="button" aria-label="编辑主体" @click.stop="openSubjectEditor(subject)">
                                <img :src="iconUrl('bianji.svg')" alt="" />
                            </button>
                        </div>
                        <div class="card-label">
                            <img :src="iconUrl('renwu.svg')" alt="" />
                            <span>{{ subject.name }}</span>
                        </div>
                        <button class="sound-btn" type="button" aria-label="选择声音">
                            <img :src="iconUrl('shengyin.svg')" alt="" />
                        </button>
                    </article>

                    <article class="creation-card three-card">
                        <ShortDramaImagePreview
                            v-if="subjectThreeViewFor(subject)"
                            :src="subjectThreeViewFor(subject)"
                            :alt="subject.name"
                        />
                        <div v-else-if="activeThreeViewTaskFor(subject)" class="three-empty">
                            <ShortDramaGrainientPlaceholder compact />
                        </div>
                        <div v-else class="three-empty">
                            <button
                                v-if="!isTaskActive(taskFor('three_view', subject)?.status)"
                                type="button"
                                :disabled="generatingSubjectId === subject.id || !hasSubjectMainImage(subject)"
                                @click="generateThreeView(subject)"
                            >
                                <img :src="iconUrl('shengcheng.svg')" alt="" />
                                <span>{{ threeViewBillingTextFor(subject) }}</span>
                                <strong>三视图</strong>
                            </button>
                            <ShortDramaGrainientPlaceholder v-else compact />
                        </div>
                        <div class="card-tools">
                            <button type="button" aria-label="生成三视图" @click.stop="openThreeViewEditor(subject)">
                                <img :src="iconUrl('bianji.svg')" alt="" />
                            </button>
                        </div>
                        <div class="card-label">
                            <img :src="iconUrl('renwu.svg')" alt="" />
                            <span>{{ subject.name }}三视图</span>
                        </div>
                    </article>
                </div>
            </section>

            <section v-else class="scene-gallery" aria-label="场景列表">
                <article v-for="scene in sceneItems" :key="scene.id" class="creation-card scene-card">
                    <ShortDramaImagePreview
                        v-if="sceneImageFor(scene)"
                        :src="sceneImageFor(scene)"
                        :alt="scene.name"
                    />
                    <div v-else class="creation-placeholder">
                        <ShortDramaGrainientPlaceholder v-if="isTaskActive(taskFor('scene_image', scene)?.status)" />
                        <span v-else>{{ statusText(taskFor('scene_image', scene)?.status, '待生成') }}</span>
                    </div>
                    <div class="card-tools">
                        <button type="button" aria-label="编辑场景" @click.stop="openSceneEditor(scene)">
                            <img :src="iconUrl('bianji.svg')" alt="" />
                        </button>
                    </div>
                    <div class="card-label">
                        <img :src="iconUrl('changjing.svg')" alt="" />
                        <span>{{ scene.name }}</span>
                    </div>
                </article>
            </section>

            <div v-if="!loading && mode === 'subject' && !subjectItems.length" class="empty-state">暂无主体</div>
            <div v-if="!loading && mode === 'scene' && !sceneItems.length" class="empty-state">暂无场景</div>
        </main>

        <footer class="flow-bottom-bar">
            <div v-if="mode === 'subject'" class="bottom-actions is-subject">
                <button class="dark-btn" type="button" @click="openCreateSubject">
                    <img :src="iconUrl('tianjia.svg')" alt="" />
                    新增主体
                </button>
                <button
                    class="light-btn"
                    type="button"
                    :disabled="batchGeneratingThreeViews || !batchThreeViewActionSubjects.length"
                    @click="generateAllThreeViews"
                >
                    <img :src="iconUrl('shengcheng.svg')" alt="" />
                    <span>{{ batchThreeViewBillingText }}</span>
                    {{ batchThreeViewActionText }}
                </button>
                <button class="dark-btn" type="button" @click="goScene">下一步</button>
            </div>
            <div v-else class="bottom-actions is-scene">
                <button class="dark-btn" type="button" @click="openCreateScene">
                    <img :src="iconUrl('tianjia.svg')" alt="" />
                    新增场景
                </button>
                <button
                    class="light-btn"
                    type="button"
                    :disabled="generatingShotImages || !storyboardShots.length"
                    @click="generateStoryboardImages"
                >
                    <img :src="iconUrl('shengcheng.svg')" alt="" />
                    <span v-if="hasMissingStoryboardImages">{{ storyboardImageBillingText }}</span>
                    {{ storyboardImageActionText }}
                </button>
            </div>
        </footer>

        <Teleport to="body">
            <div v-if="subjectEditorVisible" class="subject-editor-backdrop" @click.self="closeSubjectEditor">
                <section class="subject-editor-modal" role="dialog" aria-modal="true" aria-label="编辑主体">
                    <header class="subject-editor-head">
                        <h2>{{ editingSubjectId ? '编辑主体' : '新增主体' }}</h2>
                        <button type="button" aria-label="关闭" @click="closeSubjectEditor">×</button>
                    </header>
                    <div class="subject-editor-body">
                        <div class="subject-editor-form">
                            <label class="editor-field">
                                <span>名称</span>
                                <input v-model.trim="subjectForm.name" placeholder="请输入主体名称" />
                            </label>

                            <div class="editor-field">
                                <span>声音</span>
                                <button class="voice-select-card" type="button" @click="openVoicePicker">
                                    <span class="voice-icon">
                                        <img :src="iconUrl('shengyin.svg')" alt="" />
                                    </span>
                                    <span class="voice-copy">
                                        <strong>{{ subjectForm.voice_name || '选择声音' }}</strong>
                                        <em>{{ subjectForm.voice_label || '用于后续配音和口型参考' }}</em>
                                    </span>
                                    <span class="voice-switch">›</span>
                                </button>
                            </div>

                            <div class="editor-field">
                                <span>生成方式</span>
                                <div class="segmented-control">
                                    <button
                                        :class="{ 'is-active': subjectForm.mode === 'upload' }"
                                        type="button"
                                        @click="subjectForm.mode = 'upload'"
                                    >
                                        本地上传
                                    </button>
                                    <button
                                        :class="{ 'is-active': subjectForm.mode === 'ai' }"
                                        type="button"
                                        @click="subjectForm.mode = 'ai'"
                                    >
                                        AI生成
                                    </button>
                                </div>
                                <div class="subject-prompt-panel">
                                    <button
                                        v-if="subjectForm.mode === 'upload'"
                                        class="upload-subject-btn"
                                        type="button"
                                        :disabled="uploadingSubject"
                                        @click="triggerSubjectUpload"
                                    >
                                        {{ uploadingSubject ? '上传中...' : '上传图片' }}
                                    </button>
                                    <textarea
                                        v-model.trim="subjectForm.visual_prompt"
                                        :placeholder="subjectForm.mode === 'upload' ? '可补充描述，方便 AI 保持一致' : '描述主体外貌、服装、性格和风格'"
                                    />
                                    <div class="subject-prompt-foot">
                                        <div v-if="subjectForm.mode === 'ai'" class="model-picker" @click.stop>
                                            <button
                                                class="model-trigger"
                                                type="button"
                                                :disabled="generatingSubjectImage"
                                                aria-label="选择模型"
                                                @click="toggleSubjectModelMenu"
                                            >
                                                <img :src="iconUrl('moxing.svg')" alt="" />
                                            </button>
                                            <div v-if="subjectModelMenuOpen" class="model-menu">
                                                <button
                                                    v-for="model in subjectModelOptions"
                                                    :key="model.id"
                                                    :class="{ 'is-active': selectedSubjectModel?.id === model.id }"
                                                    type="button"
                                                    @click="selectSubjectModel(model)"
                                                >
                                                    <span>{{ model.name }}</span>
                                                    <i v-if="selectedSubjectModel?.id === model.id">✓</i>
                                                </button>
                                                <div v-if="!subjectModelOptions.length" class="model-menu-empty">暂无可用模型</div>
                                            </div>
                                        </div>
                                        <div v-if="subjectForm.mode === 'ai' && subjectResolutionOptions.length" class="resolution-picker" @click.stop>
                                            <button
                                                class="resolution-trigger"
                                                type="button"
                                                :disabled="generatingSubjectImage"
                                                aria-label="图片分辨率"
                                                @click="toggleSubjectResolutionMenu"
                                            >
                                                {{ selectedSubjectResolution }}
                                            </button>
                                            <div v-if="subjectResolutionMenuOpen" class="model-menu model-menu--resolution">
                                                <button
                                                    v-for="item in subjectResolutionOptions"
                                                    :key="item.value"
                                                    :class="{ 'is-active': selectedSubjectResolution === item.value }"
                                                    type="button"
                                                    @click="selectSubjectResolution(item.value)"
                                                >
                                                    <span>{{ item.label }}</span>
                                                    <i v-if="selectedSubjectResolution === item.value">✓</i>
                                                </button>
                                            </div>
                                        </div>
                                        <span v-else class="upload-status">{{ describingSubject ? 'AI 正在识别...' : '' }}</span>
                                        <div v-if="subjectForm.mode === 'ai'" class="prompt-cost">
                                            <span>{{ subjectImageBillingText }}</span>
                                            <button
                                                type="button"
                                                :disabled="generatingSubjectImage"
                                                aria-label="生成主体图"
                                                @click="generateSubjectImageFromEditor"
                                            >
                                                <img :src="iconUrl('Arrow-up.svg')" alt="" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button class="library-import-btn" type="button" @click="openLibraryImport">
                                <img :src="iconUrl('zhutu.svg')" alt="" />
                                从主体库导入
                            </button>
                        </div>

                        <div class="subject-editor-preview">
                            <div class="main-preview">
                                <button
                                    class="main-preview-hit"
                                    type="button"
                                    :disabled="!activeSubjectPreviewImage"
                                    @click="openPreviewViewer(activeSubjectPreviewImage)"
                                >
                                    <img v-if="activeSubjectPreviewImage" :src="activeSubjectPreviewImage" :alt="activeSubjectPreview === 'three' ? '三视图' : '主体图'" />
                                    <span v-else>{{ activeSubjectPreview === 'three' ? '三视图' : '主体图' }}</span>
                                </button>
                                <div v-if="activeSubjectPreview === 'subject' && activeSubjectImageTasks.length" class="main-preview-loading">
                                    <ShortDramaGrainientPlaceholder />
                                </div>
                                <button
                                    v-if="subjectFormHasMainImage || subjectForm.three_view_image"
                                    class="three-view-entry"
                                    type="button"
                                    aria-label="打开三视图"
                                    title="打开三视图"
                                    @click.stop="openThreeViewModal"
                                >
                                    <img :src="iconUrl('shengcheng.svg')" alt="" />
                                </button>
                            </div>
                            <aside class="preview-side">
                                <button
                                    v-for="task in activeSubjectImageTasks"
                                    :key="`subject-task-${task.task_id}`"
                                    class="mini-preview is-generating"
                                    type="button"
                                    disabled
                                >
                                    <ShortDramaGrainientPlaceholder compact />
                                </button>
                                <button
                                    v-for="asset in subjectImageHistoryAssets"
                                    :key="asset.id"
                                    :class="['mini-preview', { 'is-active': isSubjectImageAssetSelected(asset) }]"
                                    type="button"
                                    @click="selectSubjectImageAssetForPreview(asset)"
                                >
                                    <img :src="asset.url" alt="" />
                                </button>
                                <div :class="['three-preview-box', { 'is-active': activeSubjectPreview === 'three' }]">
                                    <button
                                        :class="['three-trigger', { 'has-image': subjectForm.three_view_image }]"
                                        type="button"
                                        :disabled="!subjectFormHasMainImage && !subjectForm.three_view_image"
                                        @click="handleThreeViewClick"
                                    >
                                        <img v-if="subjectForm.three_view_image" :src="subjectForm.three_view_image" alt="" />
                                        <template v-else>
                                            <i>+</i>
                                            三视图
                                        </template>
                                    </button>
                                </div>
                            </aside>
                        </div>
                    </div>
                    <footer class="subject-editor-actions">
                        <button class="ghost" type="button" @click="closeSubjectEditor">取消</button>
                        <button type="button" :disabled="savingSubject" @click="saveSubjectEditor">
                            {{ savingSubject ? '保存中...' : '保存' }}
                        </button>
                    </footer>
                </section>
            </div>

            <div v-if="sceneEditorVisible" class="subject-editor-backdrop" @click.self="closeSceneEditor">
                <section class="subject-editor-modal scene-editor-modal" role="dialog" aria-modal="true" aria-label="编辑场景">
                    <header class="subject-editor-head">
                        <h2>{{ editingSceneId ? '编辑场景' : '新增场景' }}</h2>
                        <button type="button" aria-label="关闭" @click="closeSceneEditor">×</button>
                    </header>
                    <div class="subject-editor-body">
                        <div class="subject-editor-form">
                            <label class="editor-field">
                                <span>名称</span>
                                <input v-model.trim="sceneForm.name" placeholder="请输入场景名称" />
                            </label>

                            <div class="scene-editor-spacer" aria-hidden="true"></div>

                            <div class="editor-field">
                                <span>生成方式</span>
                                <div class="segmented-control">
                                    <button
                                        :class="{ 'is-active': sceneForm.mode === 'upload' }"
                                        type="button"
                                        @click="sceneForm.mode = 'upload'"
                                    >
                                        本地上传
                                    </button>
                                    <button
                                        :class="{ 'is-active': sceneForm.mode === 'ai' }"
                                        type="button"
                                        @click="sceneForm.mode = 'ai'"
                                    >
                                        AI生成
                                    </button>
                                </div>
                                <div class="subject-prompt-panel">
                                    <button
                                        v-if="sceneForm.mode === 'upload'"
                                        class="upload-subject-btn"
                                        type="button"
                                        :disabled="uploadingScene"
                                        @click="triggerSceneUpload"
                                    >
                                        {{ uploadingScene ? '上传中...' : '上传图片' }}
                                    </button>
                                    <textarea
                                        v-model.trim="sceneForm.visual_prompt"
                                        :placeholder="sceneForm.mode === 'upload' ? '可补充描述，方便 AI 保持一致' : '描述场景空间、光线、时间和氛围'"
                                    />
                                    <div class="subject-prompt-foot">
                                        <div v-if="sceneForm.mode === 'ai'" class="model-picker" @click.stop>
                                            <button
                                                class="model-trigger"
                                                type="button"
                                                :disabled="generatingSceneImage"
                                                aria-label="选择模型"
                                                @click="toggleSceneModelMenu"
                                            >
                                                <img :src="iconUrl('moxing.svg')" alt="" />
                                            </button>
                                            <div v-if="sceneModelMenuOpen" class="model-menu">
                                                <button
                                                    v-for="model in subjectModelOptions"
                                                    :key="model.id"
                                                    :class="{ 'is-active': selectedSceneModel?.id === model.id }"
                                                    type="button"
                                                    @click="selectSceneModel(model)"
                                                >
                                                    <span>{{ model.name }}</span>
                                                    <i v-if="selectedSceneModel?.id === model.id">✓</i>
                                                </button>
                                                <div v-if="!subjectModelOptions.length" class="model-menu-empty">暂无可用模型</div>
                                            </div>
                                        </div>
                                        <div v-if="sceneForm.mode === 'ai' && sceneResolutionOptions.length" class="resolution-picker" @click.stop>
                                            <button
                                                class="resolution-trigger"
                                                type="button"
                                                :disabled="generatingSceneImage"
                                                aria-label="图片分辨率"
                                                @click="toggleSceneResolutionMenu"
                                            >
                                                {{ selectedSceneResolution }}
                                            </button>
                                            <div v-if="sceneResolutionMenuOpen" class="model-menu model-menu--resolution">
                                                <button
                                                    v-for="item in sceneResolutionOptions"
                                                    :key="item.value"
                                                    :class="{ 'is-active': selectedSceneResolution === item.value }"
                                                    type="button"
                                                    @click="selectSceneResolution(item.value)"
                                                >
                                                    <span>{{ item.label }}</span>
                                                    <i v-if="selectedSceneResolution === item.value">✓</i>
                                                </button>
                                            </div>
                                        </div>
                                        <span v-else class="upload-status">{{ describingScene ? 'AI 正在识别...' : '' }}</span>
                                        <div v-if="sceneForm.mode === 'ai'" class="prompt-cost">
                                            <span>{{ sceneImageBillingText }}</span>
                                            <button
                                                type="button"
                                                :disabled="generatingSceneImage"
                                                aria-label="生成场景图"
                                                @click="generateSceneImageFromEditor"
                                            >
                                                <img :src="iconUrl('Arrow-up.svg')" alt="" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button class="library-import-btn" type="button" @click="openSceneLibraryImport">
                                <img :src="iconUrl('zhutu.svg')" alt="" />
                                从主体库导入
                            </button>
                        </div>

                        <div class="subject-editor-preview scene-editor-preview">
                            <div class="main-preview">
                                <button
                                    class="main-preview-hit"
                                    type="button"
                                    :disabled="!scenePreviewImage"
                                    @click="openPreviewViewer(scenePreviewImage)"
                                >
                                    <img v-if="scenePreviewImage" :src="scenePreviewImage" alt="场景图" />
                                    <span v-else>场景图</span>
                                </button>
                            </div>
                            <aside class="scene-history">
                                <button
                                    v-for="task in activeSceneTasks"
                                    :key="`scene-task-${task.task_id}`"
                                    class="is-generating"
                                    type="button"
                                    disabled
                                >
                                    <ShortDramaGrainientPlaceholder compact />
                                </button>
                                <button
                                    v-for="asset in sceneHistoryAssets"
                                    :key="asset.id"
                                    :class="{ 'is-active': isSceneAssetSelected(asset) }"
                                    type="button"
                                    @click="selectSceneAsset(asset)"
                                >
                                    <img :src="asset.url" alt="" />
                                </button>
                            </aside>
                        </div>
                    </div>
                    <footer class="subject-editor-actions">
                        <button class="ghost" type="button" @click="closeSceneEditor">取消</button>
                        <button type="button" :disabled="savingScene" @click="saveSceneEditor">
                            {{ savingScene ? '保存中...' : '保存' }}
                        </button>
                    </footer>
                </section>
            </div>

            <div v-if="voicePickerVisible" class="sub-modal-backdrop" @click.self="closeVoicePicker">
                <section class="sub-picker-modal is-voice-picker" role="dialog" aria-modal="true" aria-label="声音库" @click="closeVoiceFilterMenu">
                    <header class="voice-picker-head">
                        <h2>声音库</h2>
                        <button type="button" aria-label="关闭" @click="closeVoicePicker">×</button>
                    </header>
                    <div class="voice-picker-toolbar">
                        <div class="voice-picker-tabs">
                            <button
                                v-for="item in voiceScopes"
                                :key="item.value"
                                :class="{ 'is-active': voiceScope === item.value }"
                                type="button"
                                @click="switchVoiceScope(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                        <div class="voice-picker-filters" @click.stop>
                            <div
                                v-for="filter in voiceFilterConfigs"
                                :key="filter.key"
                                class="voice-filter"
                                :class="{ 'is-open': activeVoiceFilter === filter.key }"
                            >
                                <button
                                    class="voice-filter-trigger"
                                    type="button"
                                    :aria-label="filter.label"
                                    @click="toggleVoiceFilter(filter.key)"
                                >
                                    <span>{{ voiceFilterLabel(filter.key) }}</span>
                                    <span class="voice-filter-arrow" aria-hidden="true">⌄</span>
                                </button>
                                <div v-if="activeVoiceFilter === filter.key" class="voice-filter-menu">
                                    <button
                                        v-for="option in filter.options"
                                        :key="option.value || 'all'"
                                        :class="{ 'is-active': voiceFilterValue(filter.key) === option.value }"
                                        type="button"
                                        @click="selectVoiceFilter(filter.key, option.value)"
                                    >
                                        {{ option.label }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="voice-picker-list">
                        <button
                            v-for="voice in filteredVoiceItems"
                            :key="voice.id"
                            :class="{ 'is-active': String(pendingVoiceId) === String(voice.id) }"
                            class="voice-picker-card"
                            type="button"
                            @click="selectVoice(voice)"
                        >
                            <span class="voice-avatar">
                                <img v-if="voice.cover_url" :src="voice.cover_url" alt="" />
                                <img v-else :src="iconUrl('shengyin.svg')" alt="" />
                            </span>
                            <span class="voice-card-copy">
                                <strong>{{ voice.name }}</strong>
                                <em>{{ voice.label }}</em>
                            </span>
                            <span class="voice-card-mark" aria-hidden="true">✓</span>
                        </button>
                        <div v-if="!voiceLoading && !filteredVoiceItems.length" class="picker-empty">暂无声音</div>
                        <div v-if="voiceLoading" class="picker-empty">加载中...</div>
                    </div>
                    <footer class="voice-picker-actions">
                        <button type="button" :disabled="!pendingVoice" @click="confirmVoiceSelection">
                            确定
                        </button>
                    </footer>
                </section>
            </div>

            <div v-if="libraryImportVisible" class="sub-modal-backdrop" @click.self="closeLibraryImport">
                <section
                    class="sub-picker-modal is-library"
                    role="dialog"
                    aria-modal="true"
                    aria-label="主体库导入"
                >
                    <header class="voice-picker-head library-picker-head">
                        <h2>主体库导入</h2>
                        <button type="button" aria-label="关闭" @click="closeLibraryImport">×</button>
                    </header>
                    <div class="voice-picker-toolbar library-picker-toolbar">
                        <div class="voice-picker-tabs library-picker-tabs">
                            <button
                                v-for="item in libraryScopeOptions"
                                :key="item.value"
                                :class="{ 'is-active': libraryScope === item.value }"
                                type="button"
                                @click="switchLibraryScope(item.value)"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>
                    <div class="library-picker-list">
                        <button
                            v-for="item in librarySubjects"
                            :key="item.id"
                            class="library-picker-card"
                            type="button"
                            @click="importFromLibrary(item)"
                        >
                            <span class="library-card-preview">
                                <img v-if="item.image" :src="item.image" alt="" />
                                <span v-else>{{ libraryImportTarget === 'scene' ? '场景图' : '主体图' }}</span>
                            </span>
                            <strong>{{ item.name }}</strong>
                        </button>
                        <div v-if="!libraryLoading && !librarySubjects.length" class="picker-empty">
                            {{ libraryImportTarget === 'scene' ? '暂无可导入场景' : '暂无可导入主体' }}
                        </div>
                        <div v-if="libraryLoading" class="picker-empty">加载中...</div>
                    </div>
                </section>
            </div>

            <div v-if="threeViewModalVisible" class="sub-modal-backdrop" @click.self="closeThreeViewModal">
                <section class="three-create-modal" role="dialog" aria-modal="true" aria-label="三视图生成">
                    <header class="subject-editor-head">
                        <h2>三视图</h2>
                        <button type="button" aria-label="关闭" @click="closeThreeViewModal">×</button>
                    </header>
                    <div class="three-modal__body">
                        <div class="three-preview">
                            <img v-if="threeViewModalPreviewImage" :src="threeViewModalPreviewImage" alt="三视图" />
                            <ShortDramaGrainientPlaceholder v-else-if="generatingThreeView || activeThreeViewTasks.length" />
                            <span v-else>{{ generatingThreeView ? '生成中...' : '暂无三视图' }}</span>
                        </div>
                        <aside class="three-history">
                            <button
                                v-for="task in activeThreeViewTasks"
                                :key="`task-${task.task_id}`"
                                class="is-generating"
                                type="button"
                                disabled
                            >
                                <ShortDramaGrainientPlaceholder compact />
                            </button>
                            <button
                                v-for="asset in threeViewHistoryAssets"
                                :key="asset.id"
                                :class="{ 'is-active': isThreeViewAssetSelected(asset) }"
                                type="button"
                                @click="selectThreeViewAsset(asset)"
                            >
                                <img :src="asset.url" alt="" />
                            </button>
                        </aside>
                    </div>
                    <div class="three-prompt-panel">
                        <textarea v-model.trim="threeViewPrompt" class="three-prompt" placeholder="描述三视图生成要求" />
                        <div class="three-prompt-panel__foot">
                            <div class="model-picker" @click.stop>
                                <button
                                    class="model-trigger"
                                    type="button"
                                    :disabled="generatingThreeView"
                                    aria-label="选择模型"
                                    @click="toggleThreeViewModelMenu"
                                >
                                    <img :src="iconUrl('moxing.svg')" alt="" />
                                </button>
                                <div v-if="subjectModelMenuOpen" class="model-menu">
                                    <button
                                        v-for="model in subjectModelOptions"
                                        :key="model.id"
                                        :class="{ 'is-active': selectedSubjectModel?.id === model.id }"
                                        type="button"
                                        @click="selectSubjectModel(model)"
                                    >
                                        <span>{{ model.name }}</span>
                                        <i v-if="selectedSubjectModel?.id === model.id">✓</i>
                                    </button>
                                    <div v-if="!subjectModelOptions.length" class="model-menu-empty">暂无可用模型</div>
                                </div>
                            </div>
                            <div v-if="subjectResolutionOptions.length" class="resolution-picker" @click.stop>
                                <button
                                    class="resolution-trigger"
                                    type="button"
                                    :disabled="generatingThreeView"
                                    aria-label="图片分辨率"
                                    @click="toggleSubjectResolutionMenu"
                                >
                                    {{ selectedSubjectResolution }}
                                </button>
                                <div v-if="subjectResolutionMenuOpen" class="model-menu model-menu--resolution">
                                    <button
                                        v-for="item in subjectResolutionOptions"
                                        :key="item.value"
                                        :class="{ 'is-active': selectedSubjectResolution === item.value }"
                                        type="button"
                                        @click="selectSubjectResolution(item.value)"
                                    >
                                        <span>{{ item.label }}</span>
                                        <i v-if="selectedSubjectResolution === item.value">✓</i>
                                    </button>
                                </div>
                            </div>
                            <div class="prompt-cost">
                                <span>{{ threeViewUnitBillingText }}</span>
                                <button
                                    type="button"
                                    :disabled="generatingThreeView || !subjectFormHasMainImage"
                                    aria-label="生成三视图"
                                    @click="generateThreeViewInModal"
                                >
                                    <img :src="iconUrl('Arrow-up.svg')" alt="" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <footer class="subject-editor-actions">
                        <button class="ghost" type="button" @click="closeThreeViewModal">取消</button>
                        <button type="button" @click="confirmThreeViewModal">确定</button>
                    </footer>
                </section>
            </div>

            <div v-if="previewViewerVisible" class="preview-viewer-backdrop" @click.self="closePreviewViewer">
                <button class="preview-viewer-close" type="button" aria-label="关闭预览" @click="closePreviewViewer">×</button>
                <img v-if="previewViewerUrl" :src="previewViewerUrl" alt="预览" />
            </div>
        </Teleport>

        <input ref="subjectUploadInputRef" accept="image/*" class="hidden-file" type="file" @change="onSubjectUploadChange" />
        <input ref="sceneUploadInputRef" accept="image/*" class="hidden-file" type="file" @change="onSceneUploadChange" />
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
    createShortDramaGeneration,
    describeShortDramaSubjectImage,
    getShortDramaAssets,
    getShortDramaGenerationLists,
    getShortDramaHome,
    getShortDramaScriptPlanDetail,
    getShortDramaSubjects,
    getShortDramaVoices,
    registerShortDramaAsset,
    saveShortDramaProjectGenerationSettings,
    saveShortDramaVisualPlan,
    renameShortDramaProject
} from '@/api/short_drama'
import { uploadImage } from '@/api/app'
import { ElMessageBox } from 'element-plus'
import feedback from '@/utils/feedback'
import {
    cleanUserVisiblePrompt,
    cleanVisibleImagePrompt,
    composePromptForSubmit,
    extractInternalPrompt
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

type Mode = 'subject' | 'scene'
type FlowStepKey = 'script' | 'subject' | 'scene' | 'storyboard'
type VisualTaskType = 'subject_image' | 'scene_image' | 'three_view' | 'shot_image'
type GenerationStatus = 'pending' | 'queued' | 'running' | 'success' | 'failed' | 'canceled' | ''
type VisualEntity = {
    id: string
    name: string
    description: string
    visual_prompt: string
    image_prompt: string
    unified_prompt: string
    image?: string
    raw_image?: string
    voice_id?: string | number
    voice_name?: string
    voice_label?: string
    voice_source?: string
    category?: string
    model_id?: string
    model_name?: string
    three_view_image?: string
    three_view_raw_image?: string
}
type SubjectForm = {
    id: string
    name: string
    description: string
    visual_prompt: string
    image_prompt: string
    unified_prompt: string
    image: string
    raw_image: string
    voice_id: string | number
    voice_name: string
    voice_label: string
    voice_source: string
    category: string
    mode: 'upload' | 'ai'
    model_id: string
    model_name: string
    three_view_image: string
    three_view_raw_image: string
}
type ModelOption = {
    id: string
    value: string
    channel_code: string
    name: string
    billing_unit?: string
    billing_unit_size?: number
    platform_unit_cost?: string | number
    tenant_unit_price?: string | number
    default_quality?: string
    quality_options?: unknown[]
    resolution_options?: unknown[]
    skus?: Array<{
        market_sku_id?: number
        title?: string
        quality?: string
        resolution?: string
        usage_unit?: string
        usage_unit_size?: number | string
        platform_unit_cost?: string | number
        tenant_unit_price?: string | number
    }>
}
type VoiceItem = {
    id: string | number
    name: string
    label: string
    source: string
    gender: string
    age_group: string
    language: string
    cover_url: string
}
type VoiceFilterKey = 'gender' | 'age' | 'language'
type VoiceFilterOption = {
    value: string
    label: string
}
type LibrarySubjectItem = {
    id: string | number
    name: string
    image: string
    raw_image: string
    description: string
    visual_prompt: string
    category: string
}
type StoryboardShot = {
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
    scene_ref_id: string
    subject_ref_ids: string[]
    image_prompt: string
    video_prompt: string
    voice_role: string
    bgm_prompt: string
    image: string
    selected_image_asset_id: string
    selected_image_asset?: AssetItem | null
}
type GenerationTask = {
    task_id: string
    task_type: VisualTaskType
    status: GenerationStatus
    item_id: string
    error_msg: string
}
type AssetItem = {
    id: string
    task_id: string
    shot_id?: string
    asset_type: VisualTaskType
    url: string
    uri?: string
    meta?: Record<string, any>
}
type VisualCacheData = {
    projectTitle: string
    projectRatio: string
    subjects: VisualEntity[]
    scenes: VisualEntity[]
    storyboardShots: StoryboardShot[]
    tasks: GenerationTask[]
    assets: AssetItem[]
    subjectModelOptions: ModelOption[]
    selectedSubjectModel: ModelOption | null
    selectedSceneModel: ModelOption | null
    selectedSubjectResolution?: string
    selectedSceneResolution?: string
}

const props = defineProps<{
    mode: Mode
}>()

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const loading = ref(false)
const syncingData = ref(false)
const restoredFromCache = ref(false)
const projectTitle = ref('短剧项目')
const projectRatio = ref('')
const subjects = ref<VisualEntity[]>([])
const scenes = ref<VisualEntity[]>([])
const storyboardShots = ref<StoryboardShot[]>([])
const tasks = ref<GenerationTask[]>([])
const assets = ref<AssetItem[]>([])
const generatingSubjectId = ref('')
const batchGeneratingThreeViews = ref(false)
const generatingShotImages = ref(false)
const savingSubject = ref(false)
const uploadingSubject = ref(false)
const describingSubject = ref(false)
const visionTextAvailable = ref(false)
const generatingSubjectImage = ref(false)
const generatingThreeView = ref(false)
const subjectEditorVisible = ref(false)
const sceneEditorVisible = ref(false)
const voicePickerVisible = ref(false)
const libraryImportVisible = ref(false)
const threeViewModalVisible = ref(false)
const previewViewerVisible = ref(false)
const subjectModelMenuOpen = ref(false)
const sceneModelMenuOpen = ref(false)
const subjectResolutionMenuOpen = ref(false)
const sceneResolutionMenuOpen = ref(false)
const editingSubjectId = ref('')
const editingSceneId = ref('')
const activeSubjectPreview = ref<'subject' | 'three'>('subject')
const selectedSubjectImageAsset = ref<AssetItem | null>(null)
const selectedThreeViewAsset = ref<AssetItem | null>(null)
const selectedSceneAsset = ref<AssetItem | null>(null)
const pendingSubjectImageTaskIds = ref<string[]>([])
const previewViewerUrl = ref('')
const subjectUploadInputRef = ref<HTMLInputElement | null>(null)
const sceneUploadInputRef = ref<HTMLInputElement | null>(null)
const subjectModelOptions = ref<ModelOption[]>([])
const selectedSubjectModel = ref<ModelOption | null>(null)
const selectedSceneModel = ref<ModelOption | null>(null)
const selectedSubjectResolution = ref('')
const selectedSceneResolution = ref('')
const projectGenerationSettings = ref<Record<string, any>>({})
const subjectResolutionOptions = computed(() => shortDramaResolutionOptions(selectedSubjectModel.value))
const sceneResolutionOptions = computed(() => shortDramaResolutionOptions(selectedSceneModel.value))
const voiceScope = ref<'official' | 'mine'>('official')
const voiceLoading = ref(false)
const voiceItems = ref<VoiceItem[]>([])
const pendingVoiceId = ref<string | number>('')
const voiceGenderFilter = ref('')
const voiceAgeFilter = ref('')
const voiceLanguageFilter = ref('')
const activeVoiceFilter = ref<VoiceFilterKey | ''>('')
const libraryScope = ref<'public' | 'user'>('user')
const libraryImportTarget = ref<'subject' | 'scene'>('subject')
const libraryLoading = ref(false)
const librarySubjects = ref<LibrarySubjectItem[]>([])
const savingScene = ref(false)
const uploadingScene = ref(false)
const describingScene = ref(false)
const generatingSceneImage = ref(false)
const subjectForm = ref<SubjectForm>({
    id: '',
    name: '',
    description: '',
    visual_prompt: '',
    image_prompt: '',
    unified_prompt: '',
    image: '',
    raw_image: '',
    voice_id: '',
    voice_name: '',
    voice_label: '',
    voice_source: '',
    category: 'character',
    mode: 'ai',
    model_id: '',
    model_name: '',
    three_view_image: '',
    three_view_raw_image: ''
})
const sceneForm = ref<SubjectForm>({
    id: '',
    name: '',
    description: '',
    visual_prompt: '',
    image_prompt: '',
    unified_prompt: '',
    image: '',
    raw_image: '',
    voice_id: '',
    voice_name: '',
    voice_label: '',
    voice_source: '',
    category: 'scene',
    mode: 'ai',
    model_id: '',
    model_name: '',
    three_view_image: '',
    three_view_raw_image: ''
})
const defaultCharacterThreeViewPrompt = '基于主体主图生成角色三视图，保持身份、五官、发型、服装和比例一致，输出正面、侧面、背面，干净背景。'
const defaultObjectThreeViewPrompt = '基于主体主图生成物体三视图，保持材质、结构、颜色和比例一致，输出正面、侧面、背面，干净背景。'
const defaultThreeViewPrompt = ''
const threeViewPrompt = ref(defaultThreeViewPrompt)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const mode = computed(() => props.mode)
const visualTaskTypes: VisualTaskType[] = ['subject_image', 'scene_image', 'three_view', 'shot_image']
const voiceScopes = [
    { value: 'official' as const, label: '官方' },
    { value: 'mine' as const, label: '我的' }
]
const voiceFilterConfigs: Array<{ key: VoiceFilterKey; label: string; options: VoiceFilterOption[] }> = [
    {
        key: 'gender',
        label: '性别',
        options: [
            { value: '', label: '全部' },
            { value: 'female', label: '女声' },
            { value: 'male', label: '男声' },
            { value: 'unknown', label: '未知' }
        ]
    },
    {
        key: 'age',
        label: '年龄',
        options: [
            { value: '', label: '全部' },
            { value: 'child', label: '儿童' },
            { value: 'teen', label: '少年' },
            { value: 'young', label: '青年' },
            { value: 'middle', label: '中年' },
            { value: 'elder', label: '老年' }
        ]
    },
    {
        key: 'language',
        label: '语言',
        options: [
            { value: '', label: '全部' },
            { value: 'zh', label: '中文' },
            { value: 'en', label: '英文' },
            { value: 'ja', label: '日文' },
            { value: 'ko', label: '韩文' }
        ]
    }
]
const libraryScopeOptions = computed(() => [
    { value: 'user' as const, label: '我的' },
    { value: 'public' as const, label: '官方主体库' }
])

const queryValue = (key: string) => {
    const value = route.query[key]
    return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}
const projectId = computed(() => queryValue('project_id'))
const scriptTaskId = computed(() => queryValue('task_id'))
const routeQuery = computed(() => ({
    project_id: projectId.value,
    task_id: scriptTaskId.value
}))
const subjectItems = computed(() => subjects.value.length ? subjects.value : fallbackItems('subject_image'))
const sceneItems = computed(() => scenes.value.length ? scenes.value : fallbackItems('scene_image'))
const activeSubjectPreviewImage = computed(() => activeSubjectPreview.value === 'three'
    ? subjectForm.value.three_view_image
    : (selectedSubjectImageAsset.value?.url || subjectForm.value.image))
const threeViewModalPreviewImage = computed(() => {
    if (selectedThreeViewAsset.value?.url) return selectedThreeViewAsset.value.url
    if (generatingThreeView.value || activeThreeViewTasks.value.length) return ''
    return threeViewHistoryAssets.value[0]?.url || subjectForm.value.three_view_image
})
const subjectImageHistoryAssets = computed<AssetItem[]>(() => {
    const subjectId = subjectForm.value.id
    const currentAsset = subjectForm.value.image
        ? [{
            id: `current-subject-${subjectForm.value.raw_image || subjectForm.value.image}`,
            task_id: '',
            asset_type: 'subject_image' as const,
            url: subjectForm.value.image,
            uri: subjectForm.value.raw_image || subjectForm.value.image,
            meta: {
                subject_id: subjectId,
                item_id: subjectId,
                subject_name: subjectForm.value.name
            }
        }]
        : []
    if (!subjectId) return currentAsset
    const relatedTaskIds = new Set(
        tasks.value
            .filter((task) => task.task_type === 'subject_image' && task.item_id === subjectId)
            .map((task) => task.task_id)
    )
    const matchedAssets = assets.value.filter((asset) => {
        if (asset.asset_type !== 'subject_image') return false
        const meta = asset.meta || {}
        const sameSubject = String(meta.subject_id || meta.item_id || '') === subjectId
        const sameTask = relatedTaskIds.has(asset.task_id)
        return sameSubject || sameTask
    })
    const seen = new Set<string>()
    return [...matchedAssets, ...currentAsset].filter((asset) => {
        const key = asset.url || asset.uri || asset.id
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
})
const activeSubjectImageTasks = computed(() => {
    const subjectId = subjectForm.value.id
    if (!subjectId) return []
    const assetTaskIds = new Set(subjectImageHistoryAssets.value.map((asset) => asset.task_id).filter(Boolean))
    return tasks.value.filter((task) => {
        if (task.task_type !== 'subject_image' || task.item_id !== subjectId) return false
        if (!isTaskActive(task.status)) return false
        return !assetTaskIds.has(task.task_id)
    })
})
const threeViewHistoryAssets = computed<AssetItem[]>(() => {
    const subjectId = subjectForm.value.id
    if (!subjectId) {
        return subjectForm.value.three_view_image
            ? [{
                id: `current-${subjectForm.value.three_view_raw_image || subjectForm.value.three_view_image}`,
                task_id: '',
                asset_type: 'three_view' as const,
                url: subjectForm.value.three_view_image,
                uri: subjectForm.value.three_view_raw_image || subjectForm.value.three_view_image
            }]
            : []
    }
    const relatedTaskIds = new Set(
        tasks.value
            .filter((task) => task.task_type === 'three_view' && task.item_id === subjectId)
            .map((task) => task.task_id)
    )
    const matchedAssets = assets.value.filter((asset) => {
        if (asset.asset_type !== 'three_view') return false
        return relatedTaskIds.size ? relatedTaskIds.has(asset.task_id) : asset.url === subjectForm.value.three_view_image
    })
    const currentAsset = subjectForm.value.three_view_image
        ? [{
            id: `current-${subjectForm.value.three_view_raw_image || subjectForm.value.three_view_image}`,
            task_id: '',
            asset_type: 'three_view' as const,
            url: subjectForm.value.three_view_image,
            uri: subjectForm.value.three_view_raw_image || subjectForm.value.three_view_image
        }]
        : []
    const seen = new Set<string>()
    return [...currentAsset, ...matchedAssets].filter((asset) => {
        const key = asset.url || asset.uri || asset.id
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
})
const activeThreeViewTasks = computed(() => {
    const subjectId = subjectForm.value.id
    if (!subjectId) return []
    const assetTaskIds = new Set(threeViewHistoryAssets.value.map((asset) => asset.task_id).filter(Boolean))
    return tasks.value.filter((task) => {
        if (task.task_type !== 'three_view' || task.item_id !== subjectId) return false
        if (!isTaskActive(task.status)) return false
        return !assetTaskIds.has(task.task_id)
    })
})
const activeThreeViewTaskFor = (subject: VisualEntity) => {
    if (subjectThreeViewFor(subject)) return null
    return tasks.value.find((task) => task.task_type === 'three_view' && task.item_id === subject.id && isTaskActive(task.status)) || null
}
const scenePreviewImage = computed(() => selectedSceneAsset.value?.url || sceneForm.value.image)
const sceneHistoryAssets = computed<AssetItem[]>(() => {
    const sceneId = sceneForm.value.id
    const currentAsset = sceneForm.value.image
        ? [{
            id: `current-scene-${sceneForm.value.raw_image || sceneForm.value.image}`,
            task_id: '',
            asset_type: 'scene_image' as const,
            url: sceneForm.value.image,
            uri: sceneForm.value.raw_image || sceneForm.value.image,
            meta: {
                scene_id: sceneId,
                item_id: sceneId,
                scene_name: sceneForm.value.name
            }
        }]
        : []
    if (!sceneId) return currentAsset
    const relatedTaskIds = new Set(
        tasks.value
            .filter((task) => task.task_type === 'scene_image' && task.item_id === sceneId)
            .map((task) => task.task_id)
    )
    const matchedAssets = assets.value.filter((asset) => {
        if (asset.asset_type !== 'scene_image') return false
        const meta = asset.meta || {}
        const sameScene = String(meta.scene_id || meta.item_id || '') === sceneId
        const sameTask = relatedTaskIds.has(asset.task_id)
        return sameScene || sameTask
    })
    const seen = new Set<string>()
    return [...currentAsset, ...matchedAssets].filter((asset) => {
        const key = asset.url || asset.uri || asset.id
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
})
const activeSceneTasks = computed(() => {
    const sceneId = sceneForm.value.id
    if (!sceneId) return []
    const assetTaskIds = new Set(sceneHistoryAssets.value.map((asset) => asset.task_id).filter(Boolean))
    return tasks.value.filter((task) => {
        if (task.task_type !== 'scene_image' || task.item_id !== sceneId) return false
        if (!isTaskActive(task.status)) return false
        return !assetTaskIds.has(task.task_id)
    })
})

const iconUrl = (name: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/short-drama/figma/icon/${name}` || `/short-drama/figma/icon/${name}`
}
const listFromResponse = (data: any) => Array.isArray(data)
    ? data
    : (Array.isArray(data?.lists) ? data.lists : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : [])))

const normalizeEntity = (item: any, index: number, prefix: string): VisualEntity => ({
    id: String(item?.id || item?.subject_id || item?.scene_id || item?.item_id || `${prefix}_${index + 1}`),
    name: String(item?.name || item?.title || item?.subject_name || item?.scene_name || `${prefix === 'subject' ? '主体' : '场景'}${index + 1}`)
    ,description: cleanUserVisiblePrompt(item?.description || item?.desc || item?.profile || item?.visual_description || ''),
    visual_prompt: cleanUserVisiblePrompt(item?.visual_prompt || item?.prompt || ''),
    image_prompt: cleanUserVisiblePrompt(item?.image_prompt || ''),
    unified_prompt: cleanUserVisiblePrompt(item?.unified_prompt || item?.consistency_prompt || item?.unify_prompt || ''),
    image: String(item?.image || item?.image_url || item?.cover_url || ''),
    raw_image: String(item?.raw_image || item?.uri || item?.image || ''),
    voice_id: item?.voice_id || '',
    voice_name: String(item?.voice_name || item?.voice || ''),
    voice_label: String(item?.voice_label || ''),
    voice_source: String(item?.voice_source || ''),
    category: String(item?.category || (prefix === 'subject' ? 'character' : 'scene')),
    model_id: String(item?.model_id || ''),
    model_name: String(item?.model_name || ''),
    three_view_image: String(item?.three_view_image || item?.three_view_url || ''),
    three_view_raw_image: String(item?.three_view_raw_image || item?.three_view_uri || item?.three_view_image || item?.three_view_url || '')
})

const normalizeShot = (item: any, index: number): StoryboardShot => ({
    id: String(item?.shot_id || item?.id || index + 1),
    title: String(item?.title || item?.name || `分镜${index + 1}`),
    description: String(item?.visual_description || item?.description || item?.image_prompt || ''),
    scene_name: String(item?.scene_name || ''),
    time_of_day: String(item?.time_of_day || ''),
    visual_description: String(item?.visual_description || item?.description || ''),
    composition: String(item?.composition || ''),
    shot_type: String(item?.shot_type || item?.frame_size || ''),
    angle: String(item?.angle || ''),
    action: String(item?.action || ''),
    result: String(item?.result || ''),
    atmosphere: String(item?.atmosphere || ''),
    scene_ref_id: String(item?.scene_ref_id || item?.scene_ref || item?.location_id || ''),
    subject_ref_ids: Array.isArray(item?.subject_ref_ids)
        ? item.subject_ref_ids.map((id: any) => String(id)).filter(Boolean)
        : [],
    image_prompt: String(item?.image_prompt || ''),
    video_prompt: String(item?.video_prompt || ''),
    voice_role: String(item?.voice_role || ''),
    bgm_prompt: String(item?.bgm_prompt || ''),
    image: String(item?.image || item?.cover || item?.url || item?.image_url || ''),
    selected_image_asset_id: String(item?.selected_image_asset_id || ''),
    selected_image_asset: normalizeAsset(item?.selected_image_asset, 'shot_image')
})

const normalizeTask = (item: any): GenerationTask | null => {
    const taskId = item?.task_id || item?.id
    const taskType = item?.task_type as VisualTaskType
    if (!taskId || !visualTaskTypes.includes(taskType)) return null
    const params = item?.request?.params || item?.params || {}
    return {
        task_id: String(taskId),
        task_type: taskType,
        status: String(item?.status || '') as GenerationStatus,
        item_id: String(item?.item_id || item?.subject_id || item?.scene_id || item?.shot_id || params?.subject_id || params?.scene_id || params?.shot_id || ''),
        error_msg: String(item?.error_msg || item?.error || '')
    }
}

const normalizeAsset = (item: any, fallbackType: VisualTaskType): AssetItem | null => {
    const url = item?.url || item?.image_url || item?.file_url || item?.cover_url || ''
    const type = item?.asset_type || item?.type || fallbackType
    if (!url || !visualTaskTypes.includes(type)) return null
    return {
        id: String(item?.id || item?.asset_id || item?.task_id || url),
        task_id: String(item?.task_id || ''),
        shot_id: String(item?.shot_id || item?.item_id || ''),
        asset_type: type,
        url,
        uri: String(item?.uri || item?.path || ''),
        meta: item?.meta && typeof item.meta === 'object' ? item.meta : {}
    }
}

const fallbackItems = (type: VisualTaskType) => tasks.value
    .filter((task) => task.task_type === type)
    .map((task, index) => ({
        id: task.item_id || task.task_id,
        name: `${type === 'scene_image' ? '场景' : '主体'}${index + 1}`
        ,description: '',
        visual_prompt: '',
        image_prompt: '',
        unified_prompt: '',
        image: '',
        raw_image: '',
        category: type === 'scene_image' ? 'scene' : 'character',
        model_id: '',
        model_name: '',
        three_view_image: '',
        three_view_raw_image: ''
    }))

const isTaskActive = (status?: GenerationStatus) => ['pending', 'queued', 'running'].includes(String(status || ''))
const statusText = (status?: GenerationStatus, fallback = '') => {
    const textMap: Record<string, string> = {
        pending: '排队中',
        queued: '排队中',
        running: '生成中',
        success: '已完成',
        failed: '生成失败',
        canceled: '已取消'
    }
    return textMap[String(status || '')] || fallback
}

const taskFor = (type: VisualTaskType, entity: VisualEntity) => {
    const byItem = tasks.value.find((task) => task.task_type === type && task.item_id && task.item_id === entity.id)
    if (byItem) return byItem
    if (type === 'subject_image' || type === 'three_view' || type === 'scene_image') return null
    const entityIndex = type === 'scene_image'
        ? sceneItems.value.findIndex((item) => item.id === entity.id)
        : subjectItems.value.findIndex((item) => item.id === entity.id)
    return tasks.value.filter((task) => task.task_type === type)[entityIndex] || null
}

const assetFor = (type: VisualTaskType, entity: VisualEntity) => {
    if (type === 'subject_image' || type === 'three_view' || type === 'scene_image') {
        const byMeta = assets.value.find((asset) => {
            if (asset.asset_type !== type) return false
            const meta = asset.meta || {}
            const metaId = type === 'scene_image'
                ? String(meta.scene_id || meta.item_id || '')
                : String(meta.subject_id || meta.item_id || '')
            return metaId === entity.id
        })
        if (byMeta) return byMeta
    }
    const task = taskFor(type, entity)
    if (task) {
        const byTask = assets.value.find((asset) => asset.asset_type === type && asset.task_id === task.task_id)
        if (byTask) return byTask
    }
    if (type === 'subject_image' || type === 'three_view' || type === 'scene_image') return null
    const entityIndex = type === 'scene_image'
        ? sceneItems.value.findIndex((item) => item.id === entity.id)
        : subjectItems.value.findIndex((item) => item.id === entity.id)
    return assets.value.filter((asset) => asset.asset_type === type)[entityIndex] || null
}

const subjectImageFor = (subject: VisualEntity) => {
    const asset = assetFor('subject_image', subject)
    return subject.image || asset?.url || ''
}

const subjectRawImageFor = (subject: VisualEntity) => {
    const asset = assetFor('subject_image', subject)
    return subject.raw_image || asset?.uri || asset?.url || subject.image || ''
}

const hasSubjectMainImage = (subject: VisualEntity) => Boolean(subjectRawImageFor(subject))
const subjectFormHasMainImage = computed(() => Boolean(subjectForm.value.raw_image || subjectForm.value.image))

const assetNumericId = (asset?: AssetItem | null) => {
    const id = Number(asset?.id || 0)
    return Number.isFinite(id) && id > 0 ? id : 0
}

const findSubjectImageAssetByFile = (subjectId: string, rawImage = '', image = '') => {
    return assets.value.find((asset) => {
        if (asset.asset_type !== 'subject_image') return false
        if (assetNumericId(asset) <= 0) return false
        const meta = asset.meta || {}
        const sameSubject = !subjectId || String(meta.subject_id || meta.item_id || '') === subjectId
        const sameFile = [asset.uri, asset.url].filter(Boolean).some((value) => value === rawImage || value === image)
        return sameSubject && sameFile
    }) || null
}

const subjectImageReferenceAsset = (subject: VisualEntity) => {
    const asset = assetFor('subject_image', subject)
    if (assetNumericId(asset) > 0) return asset
    return findSubjectImageAssetByFile(subject.id, subject.raw_image || '', subject.image || '')
}

const referenceAssetIdsFor = (asset?: AssetItem | null) => {
    const id = assetNumericId(asset)
    return id > 0 ? [id] : []
}

const sceneImageFor = (scene: VisualEntity) => {
    const asset = assetFor('scene_image', scene)
    return scene.image || asset?.url || ''
}

const sceneRawImageFor = (scene: VisualEntity) => {
    const asset = assetFor('scene_image', scene)
    return scene.raw_image || asset?.uri || asset?.url || scene.image || ''
}

const subjectThreeViewFor = (subject: VisualEntity) => {
    const asset = assetFor('three_view', subject)
    return asset?.url || subject.three_view_image || ''
}

const subjectThreeViewRawFor = (subject: VisualEntity) => {
    const asset = assetFor('three_view', subject)
    return asset?.uri || asset?.url || subject.three_view_raw_image || subject.three_view_image || ''
}

const batchThreeViewSubjects = computed(() => subjectItems.value.filter((subject) => {
    const task = taskFor('three_view', subject)
    return hasSubjectMainImage(subject) && !assetFor('three_view', subject) && !isTaskActive(task?.status) && task?.status !== 'success'
}))
const batchThreeViewRegenerationSubjects = computed(() => subjectItems.value.filter((subject) => {
    return hasSubjectMainImage(subject) && !activeThreeViewTaskFor(subject)
}))
const batchThreeViewActionSubjects = computed(() => batchThreeViewSubjects.value.length
    ? batchThreeViewSubjects.value
    : batchThreeViewRegenerationSubjects.value)
const isBatchThreeViewRegeneration = computed(() => !batchThreeViewSubjects.value.length && batchThreeViewRegenerationSubjects.value.length > 0)
const batchThreeViewActionText = computed(() => {
    if (batchGeneratingThreeViews.value) return '生成中...'
    return isBatchThreeViewRegeneration.value ? '重新生成三视图' : '生成三视图'
})

const formatVisualBillingPoints = (value: unknown) => {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number <= 0) return '0'
    return number.toFixed(2).replace(/\.?0+$/, '') || '0'
}
const modelSkuForResolution = (model: ModelOption | null | undefined, resolution = '') => {
    const selected = String(resolution || '').trim()
    const sources = [
        ...(Array.isArray(model?.skus) ? model.skus : []),
        ...(Array.isArray(model?.quality_options) ? model.quality_options : []),
        ...(Array.isArray(model?.resolution_options) ? model.resolution_options : [])
    ] as Array<Record<string, any>>
    if (!selected) return sources.find((item) => item?.tenant_unit_price !== undefined) || null
    return sources.find((item) => String(item?.quality || item?.resolution || item?.value || '') === selected && item?.tenant_unit_price !== undefined) || null
}
const imageModelUnitPrice = (model: ModelOption | null | undefined, resolution = '') => {
    const sku = modelSkuForResolution(model, resolution)
    const price = Number(sku?.tenant_unit_price ?? model?.tenant_unit_price ?? 0)
    return Number.isFinite(price) && price > 0 ? price : 0
}
const imageModelBillingText = (model: ModelOption | null | undefined, resolution = '', quantity = 1) => {
    const unit = String(model?.billing_unit || '').toLowerCase()
    const price = imageModelUnitPrice(model, resolution)
    if (unit.includes('token')) return `${formatVisualBillingPoints(price)}/百万 Token`
    return `${formatVisualBillingPoints(price * Math.max(0, quantity))} 点`
}
const subjectImageBillingText = computed(() => imageModelBillingText(selectedSubjectModel.value, selectedSubjectResolution.value))
const sceneImageBillingText = computed(() => imageModelBillingText(selectedSceneModel.value, selectedSceneResolution.value))
const threeViewUnitBillingText = computed(() => imageModelBillingText(selectedSubjectModel.value, selectedSubjectResolution.value))
const modelMatchesCode = (model: ModelOption, code = '') => {
    const target = String(code || '').trim()
    if (!target) return false
    return [model.id, model.value, model.channel_code].some((item) => item === target)
}
const imageModelCode = (model?: ModelOption | null) => String(model?.value || model?.channel_code || model?.id || '').trim()
const remoteImageModelSelection = () => {
    const image = projectGenerationSettings.value?.image
    return image && typeof image === 'object' ? image : null
}
const sharedImageModelSelection = () => remoteImageModelSelection() || readShortDramaImageModelSelection(projectId.value, scriptTaskId.value)
const sharedImageModelForGeneration = () => {
    const persisted = sharedImageModelSelection()
    const code = String(persisted?.value || persisted?.id || persisted?.channel_code || '').trim()
    return subjectModelOptions.value.find((model) => modelMatchesCode(model, code)) || null
}
const defaultImageModelForGeneration = () => sharedImageModelForGeneration()
    || selectedSubjectModel.value
    || selectedSceneModel.value
    || null
const modelForSubject = (subject: VisualEntity) => {
    const modelCode = String(subject.model_id || '').trim()
    return defaultImageModelForGeneration()
        || subjectModelOptions.value.find((model) => modelMatchesCode(model, modelCode))
        || null
}
const persistDefaultImageModelSelection = (model?: ModelOption | null, resolution = selectedSubjectResolution.value) => {
    if (!model) return
    writeShortDramaImageModelSelection(projectId.value, scriptTaskId.value, {
        id: model.id,
        value: model.value,
        channel_code: model.channel_code,
        name: model.name,
        default_quality: model.default_quality,
        resolution
    })
    scheduleProjectGenerationSettingsSave(model, resolution)
}
let generationSettingsSaveTimer: ReturnType<typeof setTimeout> | null = null
const projectGenerationModelSettings = (model?: ModelOption | null, resolution = '') => {
    const modelValue = imageModelCode(model)
    return {
        model_id: modelValue,
        image_model_id: modelValue,
        id: model?.id || modelValue,
        value: model?.value || modelValue,
        channel_code: model?.channel_code || modelValue,
        channel: model?.channel_code || modelValue,
        name: model?.name || '',
        model_name: model?.name || '',
        resolution,
        quality: resolution,
        ratio: projectRatio.value || '',
        aspect_ratio: projectRatio.value || ''
    }
}
const projectGenerationSettingsPayload = (model?: ModelOption | null, resolution = '') => ({
    ratio: projectRatio.value || '',
    aspect_ratio: projectRatio.value || '',
    image: projectGenerationModelSettings(
        model || selectedSubjectModel.value || selectedSceneModel.value,
        resolution || selectedSubjectResolution.value || selectedSceneResolution.value
    )
})
const saveProjectGenerationSettingsNow = async (model?: ModelOption | null, resolution = '') => {
    if (!projectId.value) return
    await saveShortDramaProjectGenerationSettings({
        project_id: projectId.value,
        generation_settings: projectGenerationSettingsPayload(model, resolution)
    })
}
const scheduleProjectGenerationSettingsSave = (model?: ModelOption | null, resolution = '') => {
    if (!projectId.value) return
    if (generationSettingsSaveTimer) clearTimeout(generationSettingsSaveTimer)
    generationSettingsSaveTimer = setTimeout(() => {
        generationSettingsSaveTimer = null
        saveProjectGenerationSettingsNow(model, resolution).catch(() => {})
    }, 300)
}
const applyProjectGenerationSettings = (settings: any) => {
    if (!settings || typeof settings !== 'object') return
    projectGenerationSettings.value = settings
    const ratio = String(settings.ratio || settings.aspect_ratio || settings.image?.ratio || settings.image?.aspect_ratio || '').trim()
    if (ratio) projectRatio.value = ratio
    const image = remoteImageModelSelection()
    if (!image) return
    const resolution = String(image.resolution || image.quality || '').trim()
    if (resolution) {
        selectedSubjectResolution.value = resolution
        selectedSceneResolution.value = resolution
    }
    if (subjectModelOptions.value.length) {
        const code = String(image.value || image.id || image.channel_code || image.model_id || image.image_model_id || '').trim()
        const matched = subjectModelOptions.value.find((model) => modelMatchesCode(model, code))
        if (matched) {
            selectedSubjectModel.value = matched
            selectedSceneModel.value = matched
            selectedSubjectResolution.value = resolveShortDramaResolution(matched, selectedSubjectResolution.value)
            selectedSceneResolution.value = resolveShortDramaResolution(matched, selectedSceneResolution.value)
        }
    }
}
const resolutionForImageModel = (model: ModelOption | null | undefined) => resolveShortDramaResolution(model, selectedSubjectResolution.value)
const threeViewBillingTextFor = (subject: VisualEntity) => {
    const model = modelForSubject(subject)
    return imageModelBillingText(model, resolutionForImageModel(model))
}
const batchThreeViewBillingText = computed(() => {
    const actionSubjects = batchThreeViewActionSubjects.value
    const hasTokenModel = actionSubjects.some((subject) => String(modelForSubject(subject)?.billing_unit || '').toLowerCase().includes('token'))
    if (hasTokenModel) return threeViewUnitBillingText.value
    const points = actionSubjects.reduce((sum, subject) => {
        const model = modelForSubject(subject)
        return sum + imageModelUnitPrice(model, resolutionForImageModel(model))
    }, 0)
    return `${formatVisualBillingPoints(points)} 点`
})

const shotAssetBelongsToShot = (asset: AssetItem | null | undefined, shotId: string) => {
    if (!asset?.url || asset.asset_type !== 'shot_image' || !shotId) return false
    const meta = asset.meta || {}
    return asset.shot_id === shotId
        || String(meta.shot_id || meta.item_id || '') === shotId
}

const shotImageAssetFor = (shot: StoryboardShot) => {
    const selectedAssetId = shot.selected_image_asset_id
    const selected = selectedAssetId
        ? assets.value.find((asset) => asset.asset_type === 'shot_image' && asset.id === selectedAssetId)
        : null
    if (selected?.url) return selected
    if (shotAssetBelongsToShot(shot.selected_image_asset, shot.id)) return shot.selected_image_asset || null
    return assets.value.find((asset) => shotAssetBelongsToShot(asset, shot.id)) || null
}

const hasStoryboardShotImage = (shot: StoryboardShot) => Boolean(shot.image || shotImageAssetFor(shot)?.url)
const pendingStoryboardImageShots = computed(() => storyboardShots.value.filter((shot) => {
    if (!shot.id || hasStoryboardShotImage(shot)) return false
    const task = tasks.value.find((item) => item.task_type === 'shot_image' && item.item_id === shot.id)
    return !isTaskActive(task?.status)
}))
const hasMissingStoryboardImages = computed(() => storyboardShots.value.some((shot) => shot.id && !hasStoryboardShotImage(shot)))
const storyboardImageModel = computed(() => defaultImageModelForGeneration() || subjectModelOptions.value[0] || null)
const storyboardImageResolution = computed(() => resolveShortDramaResolution(storyboardImageModel.value, selectedSubjectResolution.value || selectedSceneResolution.value))
const storyboardImageBillingText = computed(() => imageModelBillingText(storyboardImageModel.value, storyboardImageResolution.value, pendingStoryboardImageShots.value.length))
const storyboardImageActionText = computed(() => {
    if (generatingShotImages.value) return '生成中...'
    return hasMissingStoryboardImages.value ? '生成分镜图' : '查看分镜图'
})
const isObjectLikeSubject = (subject: Partial<VisualEntity | SubjectForm | LibrarySubjectItem>) => {
    const category = String((subject as any)?.category || '').toLowerCase()
    if (['character', 'characters', 'human', 'person', 'role', 'actor', 'actress', 'people', '角色', '人物', '人类', '真人', '男生', '女生', '主角'].includes(category)) return false
    if (['prop', 'props', 'object', 'item', 'tool', 'symbol', 'artifact', '物品', '道具', '工具', '器物', '场景'].includes(category)) return true
    const name = String((subject as any)?.name || '').toLowerCase()
    const text = [
        (subject as any)?.name,
        (subject as any)?.description,
        (subject as any)?.visual_prompt,
        (subject as any)?.image_prompt,
        (subject as any)?.unified_prompt
    ].map((item) => String(item || '').toLowerCase()).join(' ')
    const includesAny = (value: string, keywords: string[]) => keywords.some((keyword) => keyword && value.includes(keyword))
    const scoreBy = (value: string, keywords: string[]) => keywords.reduce((score, keyword) => score + (keyword && value.includes(keyword) ? 1 : 0), 0)
    const characterNameKeywords = ['男主', '女主', '男孩', '女孩', '少年', '少女', '老人', '孩子', '母亲', '父亲', '老师', '学生', '医生', '警察', '角色', '人物', '主角', '反派']
    const objectNameKeywords = ['桌子', '椅子', '手机', '电脑', '汽车', '剑', '刀', '枪', '书', '花', '杯', '道具', '物品', '工具', '器物', '建筑']
    if (includesAny(name, characterNameKeywords)) return false
    if (includesAny(name, objectNameKeywords)) return true
    const characterKeywords = ['五官', '发型', '表情', '服装', '身材', '脸', '眼睛', '头发', '皮肤', '人物', '角色', '男人', '女人', '男孩', '女孩', '肖像', '站姿', '动作', '穿着', '演员', '主角', '配角']
    const objectKeywords = ['材质', '结构', '金属', '木质', '布料', '道具', '物体', '物品', '器物', '工具', '家具', '设备', '车辆', '建筑', '空间', '房间', '街道', '场景', '环境', '摆件']
    const characterScore = scoreBy(text, characterKeywords)
    const objectScore = scoreBy(text, objectKeywords)
    if (characterScore >= 2 && characterScore >= objectScore) return false
    if (characterScore >= 3) return false
    if (objectScore >= 2 && objectScore > characterScore) return true
    return objectScore >= 1 && characterScore === 0
}
const threeViewPromptForSubject = (subject: Partial<VisualEntity | SubjectForm | LibrarySubjectItem>) => {
    return isObjectLikeSubject(subject) ? defaultObjectThreeViewPrompt : defaultCharacterThreeViewPrompt
}
const visibleThreeViewPromptForSubject = (subject: Partial<VisualEntity | SubjectForm | LibrarySubjectItem>) => {
    return cleanUserVisiblePrompt(threeViewPromptForSubject(subject))
}
const effectiveThreeViewPromptForSubject = (subject: Partial<VisualEntity | SubjectForm | LibrarySubjectItem>) => {
    const visiblePrompt = cleanUserVisiblePrompt(threeViewPrompt.value)
    const internalPrompt = threeViewPromptForSubject(subject)
    if (visiblePrompt === cleanUserVisiblePrompt(internalPrompt)) {
        return internalPrompt
    }
    return composePromptForSubmit(visiblePrompt, threeViewPromptForSubject(subject))
}

const normalizeVoice = (item: any, source: string): VoiceItem => ({
    id: item?.id || item?.voice_id || item?.value || '',
    name: String(item?.name || item?.voice_name || item?.title || '未命名声音'),
    label: String(item?.label || item?.desc || item?.description || [item?.gender, item?.age_group, item?.language].filter(Boolean).join(' / ') || item?.status || ''),
    source,
    gender: String(item?.gender || ''),
    age_group: String(item?.age_group || item?.age || ''),
    language: String(item?.language || item?.lang || ''),
    cover_url: String(item?.cover_url || item?.avatar_url || item?.image_url || '')
})

const normalizeLibrarySubject = (item: any): LibrarySubjectItem => ({
    id: item?.id || item?.subject_id || item?.scene_id || '',
    name: String(item?.name || item?.title || item?.subject_name || item?.scene_name || (item?.category === 'scene' ? '未命名场景' : '未命名主体')),
    image: String(item?.image || item?.image_url || item?.cover_url || ''),
    raw_image: String(item?.raw_image || item?.uri || item?.image || ''),
    description: cleanUserVisiblePrompt(item?.description || item?.prompt || item?.visual_prompt || ''),
    visual_prompt: cleanUserVisiblePrompt(item?.visual_prompt || item?.prompt || item?.description || ''),
    category: String(item?.category || 'character')
})

const normalizeSubjectModel = (model: any): ModelOption => ({
    id: String(model?.id || model?.value || model?.channel_code || model?.channel || model?.model_code || ''),
    value: String(model?.value || model?.channel_code || model?.channel || model?.model_code || model?.id || ''),
    channel_code: String(model?.channel_code || model?.channel || model?.model_code || model?.id || ''),
    name: String(model?.name || model?.title || model?.id || '默认模型'),
    billing_unit: String(model?.billing_unit || ''),
    billing_unit_size: Number(model?.billing_unit_size || 1),
    platform_unit_cost: model?.platform_unit_cost ?? 0,
    tenant_unit_price: model?.tenant_unit_price ?? 0,
    default_quality: String(model?.default_quality || model?.quality || ''),
    quality_options: Array.isArray(model?.quality_options) ? model.quality_options : [],
    resolution_options: Array.isArray(model?.resolution_options) ? model.resolution_options : [],
    skus: Array.isArray(model?.skus) ? model.skus : []
})

const pickUploadRaw = (res: any) => res?.url || res?.path || res?.uri || ''
const pickUploadPreview = (res: any) => res?.uri || res?.url || res?.path || ''
const firstAsset = (task: any): AssetItem | null => {
    const outputAssets = Array.isArray(task?.assets)
        ? task.assets
        : (Array.isArray(task?.output_assets) ? task.output_assets : [])
    const asset = outputAssets.find((item: any) => item?.url) || null
    return asset
        ? {
              id: String(asset.id || asset.asset_id || asset.task_id || asset.url),
              task_id: String(asset.task_id || task?.task_id || ''),
              asset_type: String(asset.asset_type || task?.task_type || 'subject_image') as VisualTaskType,
              url: String(asset.url || ''),
              uri: String(asset.uri || asset.path || '')
          }
        : null
}

const resetSubjectForm = () => {
    subjectForm.value = {
        id: '',
        name: '',
        description: '',
        visual_prompt: '',
        image_prompt: '',
        unified_prompt: '',
        image: '',
        raw_image: '',
        voice_id: '',
        voice_name: '',
        voice_label: '',
        voice_source: '',
        category: 'character',
        mode: 'ai',
        model_id: '',
        model_name: '',
        three_view_image: '',
        three_view_raw_image: ''
    }
}

const resetSceneForm = () => {
    sceneForm.value = {
        id: '',
        name: '',
        description: '',
        visual_prompt: '',
        image_prompt: '',
        unified_prompt: '',
        image: '',
        raw_image: '',
        voice_id: '',
        voice_name: '',
        voice_label: '',
        voice_source: '',
        category: 'scene',
        mode: 'ai',
        model_id: '',
        model_name: '',
        three_view_image: '',
        three_view_raw_image: ''
    }
}

const makeNewSubjectId = () => {
    const used = new Set([
        ...subjects.value.map((item) => item.id),
        ...tasks.value
            .filter((task) => task.task_type === 'subject_image' || task.task_type === 'three_view')
            .map((task) => task.item_id)
            .filter(Boolean)
    ])
    for (let index = subjects.value.length + 1; index < subjects.value.length + 1000; index += 1) {
        const id = `subject_${index}`
        if (!used.has(id)) return id
    }
    return `subject_${Date.now()}`
}

const makeNewSceneId = () => {
    const used = new Set([
        ...scenes.value.map((item) => item.id),
        ...tasks.value
            .filter((task) => task.task_type === 'scene_image')
            .map((task) => task.item_id)
            .filter(Boolean)
    ])
    for (let index = scenes.value.length + 1; index < scenes.value.length + 1000; index += 1) {
        const id = `scene_${index}`
        if (!used.has(id)) return id
    }
    return `scene_${Date.now()}`
}

const ensureSubjectFormId = () => {
    if (!subjectForm.value.id) {
        subjectForm.value.id = makeNewSubjectId()
    }
    return subjectForm.value.id
}

const ensureSceneFormId = () => {
    if (!sceneForm.value.id) {
        sceneForm.value.id = makeNewSceneId()
    }
    return sceneForm.value.id
}

const clearSubjectThreeViewState = () => {
    subjectForm.value.three_view_image = ''
    subjectForm.value.three_view_raw_image = ''
    selectedThreeViewAsset.value = null
    if (activeSubjectPreview.value === 'three') activeSubjectPreview.value = 'subject'
}

const applySelectedSubjectImageAsset = () => {
    if (!selectedSubjectImageAsset.value?.url) return
    subjectForm.value.image = selectedSubjectImageAsset.value.url
    subjectForm.value.raw_image = selectedSubjectImageAsset.value.uri || selectedSubjectImageAsset.value.url
    const selectedAsset: AssetItem = {
        ...selectedSubjectImageAsset.value,
        asset_type: 'subject_image',
        meta: {
            ...(selectedSubjectImageAsset.value.meta || {}),
            subject_id: subjectForm.value.id,
            item_id: subjectForm.value.id,
            subject_name: subjectForm.value.name
        }
    }
    assets.value = [
        selectedAsset,
        ...assets.value.filter((asset) => asset.id !== selectedAsset.id)
    ]
}

const toEditableSubject = (subject: VisualEntity): SubjectForm => ({
    id: subject.id,
    name: subject.name,
    description: cleanUserVisiblePrompt(subject.description),
    visual_prompt: cleanUserVisiblePrompt(subject.visual_prompt || subject.image_prompt || subject.description),
    image_prompt: cleanUserVisiblePrompt(subject.image_prompt || subject.visual_prompt || subject.description),
    unified_prompt: cleanUserVisiblePrompt(subject.unified_prompt),
    image: subjectImageFor(subject),
    raw_image: subjectRawImageFor(subject),
    voice_id: subject.voice_id || '',
    voice_name: subject.voice_name || '',
    voice_label: subject.voice_label || '',
    voice_source: subject.voice_source || '',
    category: subject.category || 'character',
    mode: 'ai',
    model_id: subject.model_id || '',
    model_name: subject.model_name || '',
    three_view_image: subjectThreeViewFor(subject),
    three_view_raw_image: subjectThreeViewRawFor(subject)
})

const packSubject = (item: VisualEntity | SubjectForm): VisualEntity => ({
    id: String(item.id),
    name: String(item.name || ''),
    description: cleanUserVisiblePrompt(item.description || item.visual_prompt || ''),
    visual_prompt: cleanUserVisiblePrompt(item.visual_prompt || item.image_prompt || item.description || ''),
    image_prompt: cleanUserVisiblePrompt(item.image_prompt || item.visual_prompt || item.description || ''),
    unified_prompt: cleanUserVisiblePrompt(item.unified_prompt || ''),
    image: String(item.image || ''),
    raw_image: String(item.raw_image || item.image || ''),
    voice_id: item.voice_id || '',
    voice_name: String(item.voice_name || ''),
    voice_label: String(item.voice_label || ''),
    voice_source: String(item.voice_source || ''),
    category: String(item.category || 'character'),
    model_id: String(item.model_id || ''),
    model_name: String(item.model_name || ''),
    three_view_image: String(item.three_view_image || ''),
    three_view_raw_image: String(item.three_view_raw_image || item.three_view_image || '')
})

const toEditableScene = (scene: VisualEntity): SubjectForm => ({
    id: scene.id,
    name: scene.name,
    description: cleanUserVisiblePrompt(scene.description),
    visual_prompt: cleanUserVisiblePrompt(scene.visual_prompt || scene.image_prompt || scene.description),
    image_prompt: cleanUserVisiblePrompt(scene.image_prompt || scene.visual_prompt || scene.description),
    unified_prompt: cleanUserVisiblePrompt(scene.unified_prompt),
    image: sceneImageFor(scene),
    raw_image: sceneRawImageFor(scene),
    voice_id: '',
    voice_name: '',
    voice_label: '',
    voice_source: '',
    category: 'scene',
    mode: 'ai',
    model_id: scene.model_id || '',
    model_name: scene.model_name || '',
    three_view_image: '',
    three_view_raw_image: ''
})

const packScene = (item: VisualEntity | SubjectForm): VisualEntity => ({
    id: String(item.id),
    name: String(item.name || ''),
    description: cleanUserVisiblePrompt(item.description || item.visual_prompt || ''),
    visual_prompt: cleanUserVisiblePrompt(item.visual_prompt || item.image_prompt || item.description || ''),
    image_prompt: cleanUserVisiblePrompt(item.image_prompt || item.visual_prompt || item.description || ''),
    unified_prompt: cleanUserVisiblePrompt(item.unified_prompt || ''),
    image: String(item.image || ''),
    raw_image: String(item.raw_image || item.image || ''),
    voice_id: '',
    voice_name: '',
    voice_label: '',
    voice_source: '',
    category: 'scene',
    model_id: String(item.model_id || ''),
    model_name: String(item.model_name || ''),
    three_view_image: '',
    three_view_raw_image: ''
})

const persistVisualPlan = async () => {
    await saveShortDramaVisualPlan({
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        subjects: subjects.value.map(packSubject),
        locations: scenes.value.map(packScene)
    })
}

const registerSubjectImageAssetIfNeeded = async (subject: VisualEntity): Promise<AssetItem | null> => {
    const uri = subject.raw_image || subject.image
    if (!projectId.value || !uri) return null
    const exists = findSubjectImageAssetByFile(subject.id, uri, subject.image)
    if (exists) return exists
    const registered: any = await registerShortDramaAsset({
        project_id: projectId.value,
        task_id: scriptTaskId.value || `manual_subject_${subject.id}`,
        asset_type: 'subject_image',
        uri,
        title: subject.name || '未命名主体',
        meta: {
            source: 'pc_subject_create_manual',
            project_task_id: scriptTaskId.value,
            source_task_id: scriptTaskId.value,
            subject_id: subject.id,
            item_id: subject.id,
            subject_name: subject.name
        }
    })
    const normalized = normalizeAsset(registered, 'subject_image')
    if (normalized) {
        assets.value = [normalized, ...assets.value.filter((asset) => asset.id !== normalized.id)]
        return normalized
    }
    return null
}

const registerSceneImageAssetIfNeeded = async (scene: VisualEntity) => {
    const uri = scene.raw_image || scene.image
    if (!projectId.value || !uri) return
    const exists = assets.value.some((asset) => {
        if (asset.asset_type !== 'scene_image') return false
        const meta = asset.meta || {}
        const sameScene = String(meta.scene_id || meta.item_id || '') === scene.id
        const sameFile = asset.uri === uri || asset.url === uri || asset.url === scene.image
        return sameScene && sameFile
    })
    if (exists) return
    const registered: any = await registerShortDramaAsset({
        project_id: projectId.value,
        task_id: scriptTaskId.value || `manual_scene_${scene.id}`,
        asset_type: 'scene_image',
        uri,
        title: scene.name || '未命名场景',
        meta: {
            source: 'pc_scene_create_manual',
            project_task_id: scriptTaskId.value,
            source_task_id: scriptTaskId.value,
            scene_id: scene.id,
            item_id: scene.id,
            scene_name: scene.name
        }
    })
    const normalized = normalizeAsset(registered, 'scene_image')
    if (normalized) {
        assets.value = [normalized, ...assets.value.filter((asset) => asset.id !== normalized.id)]
    }
}

const applySubjectModelConfig = (data: any) => {
    const groups = Array.isArray(data?.model_groups) ? data.model_groups : []
    visionTextAvailable.value = Boolean(data?.vision_model_configured)
    const groupKey = (group: any) => String(group?.key || group?.type || group?.app_code || '').toLowerCase()
    const imageGroups = groups.filter((group: any) => {
        const key = groupKey(group)
        return ['image', 'subject_image', 'image_generation', 'aigc_image'].some((needle) => key.includes(needle))
            && !['video', 'shot_video', 'video_generation', 'aigc_video'].some((needle) => key.includes(needle))
    })
    const sourceGroups = imageGroups.length ? imageGroups : groups
    const models = sourceGroups
        .flatMap((group: any) => Array.isArray(group?.options) ? group.options : [])
        .concat(!imageGroups.length && Array.isArray(data?.models) ? data.models : [])
        .map(normalizeSubjectModel)
        .filter((model: ModelOption) => model.id)
    subjectModelOptions.value = models
    applyProjectGenerationSettings(projectGenerationSettings.value)
    const persisted = sharedImageModelSelection()
    const persistedModel = models.find((model) => modelMatchesCode(model, persisted?.value || persisted?.id || persisted?.channel_code || ''))
    selectedSubjectModel.value = persistedModel
        || models.find((model) => model.value === subjectForm.value.model_id || model.id === subjectForm.value.model_id)
        || selectedSubjectModel.value
        || models[0]
        || null
    selectedSceneModel.value = persistedModel
        || models.find((model) => model.value === sceneForm.value.model_id || model.id === sceneForm.value.model_id)
        || selectedSceneModel.value
        || selectedSubjectModel.value
        || models[0]
        || null
    selectedSubjectResolution.value = resolveShortDramaResolution(selectedSubjectModel.value, persisted?.resolution || selectedSubjectResolution.value)
    selectedSceneResolution.value = resolveShortDramaResolution(selectedSceneModel.value, persisted?.resolution || selectedSceneResolution.value)
}

const loadSubjectModels = async () => {
    const cached = readShortDramaHomeConfigCache<any>()
    if (cached && !subjectModelOptions.value.length) {
        applySubjectModelConfig(cached)
    }
    try {
        const data = await getShortDramaHome()
        writeShortDramaHomeConfigCache(data)
        applySubjectModelConfig(data)
    } catch {
        if (!subjectModelOptions.value.length) {
            subjectModelOptions.value = []
            selectedSubjectModel.value = null
            selectedSceneModel.value = null
        }
    }
}

const mergeTasks = (nextTasks: GenerationTask[]) => {
    const map = new Map(tasks.value.map((task) => [task.task_id, task]))
    nextTasks.forEach((task) => map.set(task.task_id, task))
    tasks.value = Array.from(map.values())
    persistVisualCache()
}

const loadPlanContext = async () => {
    if (!scriptTaskId.value) return
    const data = await getShortDramaScriptPlanDetail({
        task_id: scriptTaskId.value,
        project_id: projectId.value
    })
    const result = data?.result || data?.plan || {}
    projectTitle.value = String(result?.title || data?.title || projectTitle.value)
    applyProjectGenerationSettings(data?.generation_settings || data?.project_generation_settings || data?.project?.generation_settings)
    projectRatio.value = String(
        projectGenerationSettings.value?.ratio
        || projectGenerationSettings.value?.aspect_ratio
        || data?.project_ratio
        || data?.ratio
        || result?.generation_settings?.aspect_ratio
        || result?.generation_settings?.ratio
        || ''
    )
    subjects.value = (Array.isArray(result?.subjects) ? result.subjects : [])
        .map((item: any, index: number) => normalizeEntity(item, index, 'subject'))
    const rawScenes = Array.isArray(result?.scenes)
        ? result.scenes
        : (Array.isArray(result?.locations) ? result.locations : [])
    scenes.value = rawScenes.map((item: any, index: number) => normalizeEntity(item, index, 'scene'))
    const rawShots = Array.isArray(result?.storyboard)
        ? result.storyboard
        : (Array.isArray(result?.shots) ? result.shots : [])
    storyboardShots.value = rawShots.map(normalizeShot)
}

const loadTasks = async () => {
    const data = await getShortDramaGenerationLists({
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        task_types: visualTaskTypes.join(',')
    })
    tasks.value = listFromResponse(data).map(normalizeTask).filter(Boolean) as GenerationTask[]
}

const loadAssets = async () => {
    const groups = await Promise.all(visualTaskTypes.map(async (type) => {
        try {
            const data = await getShortDramaAssets({
                project_id: projectId.value,
                task_id: scriptTaskId.value,
                asset_type: type
            })
            return listFromResponse(data).map((item: any) => normalizeAsset(item, type)).filter(Boolean) as AssetItem[]
        } catch {
            return []
        }
    }))
    assets.value = groups.flat().sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
}

const selectGeneratedSubjectImageFromTask = (taskId: string) => {
    if (!taskId || !subjectEditorVisible.value || !subjectForm.value.id) return false
    const task = tasks.value.find((item) => item.task_id === taskId)
    if (task?.item_id && task.item_id !== subjectForm.value.id) return false
    const asset = assets.value.find((item) => {
        if (item.asset_type !== 'subject_image') return false
        if (item.task_id !== taskId) return false
        const meta = item.meta || {}
        const subjectId = String(meta.subject_id || meta.item_id || '')
        return !subjectId || subjectId === subjectForm.value.id
    })
    if (!asset) return false
    selectedSubjectImageAsset.value = {
        ...asset,
        asset_type: 'subject_image',
        meta: {
            ...(asset.meta || {}),
            subject_id: subjectForm.value.id,
            item_id: subjectForm.value.id,
            subject_name: subjectForm.value.name
        }
    }
    activeSubjectPreview.value = 'subject'
    return true
}

const syncPendingSubjectImageSelection = () => {
    if (!pendingSubjectImageTaskIds.value.length) return
    const remaining: string[] = []
    pendingSubjectImageTaskIds.value.forEach((taskId) => {
        const selected = selectGeneratedSubjectImageFromTask(taskId)
        if (!selected) {
            const task = tasks.value.find((item) => item.task_id === taskId)
            if (task && ['success', 'failed', 'canceled'].includes(task.status)) return
            remaining.push(taskId)
        }
    })
    pendingSubjectImageTaskIds.value = remaining
}

const stopPolling = () => {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
}

const schedulePolling = () => {
    stopPolling()
    if (!tasks.value.some((task) => isTaskActive(task.status)) && !pendingSubjectImageTaskIds.value.length) return
    pollTimer = setTimeout(() => refreshAll(true), 5000)
}

const visualCacheSnapshot = (): VisualCacheData => ({
    projectTitle: projectTitle.value,
    projectRatio: projectRatio.value,
    subjects: subjects.value,
    scenes: scenes.value,
    storyboardShots: storyboardShots.value,
    tasks: tasks.value,
    assets: assets.value,
    subjectModelOptions: subjectModelOptions.value,
    selectedSubjectModel: selectedSubjectModel.value,
    selectedSceneModel: selectedSceneModel.value,
    selectedSubjectResolution: selectedSubjectResolution.value,
    selectedSceneResolution: selectedSceneResolution.value
})
const persistVisualCache = () => {
    writeShortDramaCreationCache(projectId.value, scriptTaskId.value, 'visual', visualCacheSnapshot())
}
const applyVisualCache = (cache: VisualCacheData | null) => {
    if (!cache) return false
    projectTitle.value = cache.projectTitle || projectTitle.value
    projectRatio.value = cache.projectRatio || projectRatio.value
    subjects.value = Array.isArray(cache.subjects) ? cache.subjects : []
    scenes.value = Array.isArray(cache.scenes) ? cache.scenes : []
    storyboardShots.value = Array.isArray(cache.storyboardShots) ? cache.storyboardShots : []
    tasks.value = Array.isArray(cache.tasks) ? cache.tasks : []
    assets.value = Array.isArray(cache.assets) ? cache.assets : []
    subjectModelOptions.value = Array.isArray(cache.subjectModelOptions) ? cache.subjectModelOptions : []
    selectedSubjectModel.value = cache.selectedSubjectModel || selectedSubjectModel.value
    selectedSceneModel.value = cache.selectedSceneModel || selectedSceneModel.value
    selectedSubjectResolution.value = resolveShortDramaResolution(selectedSubjectModel.value, cache.selectedSubjectResolution || selectedSubjectResolution.value)
    selectedSceneResolution.value = resolveShortDramaResolution(selectedSceneModel.value, cache.selectedSceneResolution || selectedSceneResolution.value)
    restoredFromCache.value = true
    return true
}
const restoreVisualCache = () => applyVisualCache(readShortDramaCreationCache<VisualCacheData>(projectId.value, scriptTaskId.value, 'visual'))

const refreshAll = async (silent = false) => {
    if (!projectId.value || !scriptTaskId.value) {
        feedback.msgError('项目任务不存在，请重新创建')
        await router.replace('/ai/short-drama')
        return
    }
    if (silent) {
        syncingData.value = true
    } else {
        loading.value = true
    }
    try {
        await loadPlanContext()
        await loadSubjectModels()
        await loadTasks()
        await loadAssets()
        syncPendingSubjectImageSelection()
        persistVisualCache()
        schedulePolling()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || (restoredFromCache.value ? '数据同步失败，请稍后刷新' : '数据读取失败'))
    } finally {
        loading.value = false
        syncingData.value = false
    }
}

const openCreateSubject = () => {
    resetSubjectForm()
    subjectForm.value.id = makeNewSubjectId()
    editingSubjectId.value = ''
    activeSubjectPreview.value = 'subject'
    selectedSubjectImageAsset.value = null
    selectedThreeViewAsset.value = null
    selectedSubjectModel.value = selectedSubjectModel.value || subjectModelOptions.value[0] || null
    selectedSubjectResolution.value = resolveShortDramaResolution(selectedSubjectModel.value)
    subjectEditorVisible.value = true
    if (!subjectModelOptions.value.length) loadSubjectModels()
}

const openSubjectEditor = (subject: VisualEntity) => {
    editingSubjectId.value = subject.id
    subjectForm.value = toEditableSubject(subject)
    activeSubjectPreview.value = 'subject'
    selectedSubjectImageAsset.value = null
    selectedThreeViewAsset.value = null
    selectedSubjectModel.value = subjectModelOptions.value.find((model) => model.value === subjectForm.value.model_id || model.id === subjectForm.value.model_id)
        || selectedSubjectModel.value
        || subjectModelOptions.value[0]
        || null
    selectedSubjectResolution.value = resolveShortDramaResolution(selectedSubjectModel.value)
    subjectEditorVisible.value = true
    if (!subjectModelOptions.value.length) loadSubjectModels()
}

const closeSubjectEditor = () => {
    if (savingSubject.value || uploadingSubject.value || generatingSubjectImage.value || generatingThreeView.value) return
    subjectEditorVisible.value = false
    voicePickerVisible.value = false
    libraryImportVisible.value = false
    threeViewModalVisible.value = false
    subjectModelMenuOpen.value = false
    subjectResolutionMenuOpen.value = false
    editingSubjectId.value = ''
    activeSubjectPreview.value = 'subject'
    selectedSubjectImageAsset.value = null
    selectedThreeViewAsset.value = null
    resetSubjectForm()
}

const saveSubjectEditor = async () => {
    const name = subjectForm.value.name.trim()
    if (!name) {
        feedback.msgWarning('请输入主体名称')
        return
    }
    if (!editingSubjectId.value && !subjectForm.value.image && !subjectForm.value.visual_prompt.trim()) {
        feedback.msgWarning('请上传主体图或填写生成提示词')
        return
    }
    savingSubject.value = true
    const prevSubjects = subjects.value
    try {
        applySelectedSubjectImageAsset()
        const subjectId = editingSubjectId.value || subjectForm.value.id || makeNewSubjectId()
        const nextSubject = packSubject({
            ...subjectForm.value,
            id: subjectId,
            name,
            description: subjectForm.value.visual_prompt || subjectForm.value.description,
            image_prompt: subjectForm.value.image_prompt || subjectForm.value.visual_prompt
        })
        subjects.value = editingSubjectId.value
            ? subjects.value.map((subject) => subject.id === editingSubjectId.value ? nextSubject : subject)
            : [...subjects.value, nextSubject]
        await registerSubjectImageAssetIfNeeded(nextSubject)
        await persistVisualPlan()
        feedback.msgSuccess(editingSubjectId.value ? '主体已更新' : '主体已新增')
        subjectEditorVisible.value = false
        editingSubjectId.value = ''
        activeSubjectPreview.value = 'subject'
        selectedSubjectImageAsset.value = null
        selectedThreeViewAsset.value = null
        resetSubjectForm()
    } catch (error: any) {
        subjects.value = prevSubjects
        feedback.msgError(error?.msg || error?.message || '保存失败')
    } finally {
        savingSubject.value = false
    }
}

const openCreateScene = () => {
    resetSceneForm()
    sceneForm.value.id = makeNewSceneId()
    editingSceneId.value = ''
    selectedSceneAsset.value = null
    selectedSceneModel.value = selectedSceneModel.value || selectedSubjectModel.value || subjectModelOptions.value[0] || null
    selectedSceneResolution.value = resolveShortDramaResolution(selectedSceneModel.value)
    sceneEditorVisible.value = true
    if (!subjectModelOptions.value.length) loadSubjectModels()
}

const openSceneEditor = (scene: VisualEntity) => {
    editingSceneId.value = scene.id
    sceneForm.value = toEditableScene(scene)
    selectedSceneAsset.value = null
    selectedSceneModel.value = subjectModelOptions.value.find((model) => model.value === sceneForm.value.model_id || model.id === sceneForm.value.model_id)
        || selectedSceneModel.value
        || selectedSubjectModel.value
        || subjectModelOptions.value[0]
        || null
    selectedSceneResolution.value = resolveShortDramaResolution(selectedSceneModel.value)
    sceneEditorVisible.value = true
    if (!subjectModelOptions.value.length) loadSubjectModels()
}

const closeSceneEditor = () => {
    if (savingScene.value || uploadingScene.value || generatingSceneImage.value) return
    sceneEditorVisible.value = false
    sceneModelMenuOpen.value = false
    sceneResolutionMenuOpen.value = false
    editingSceneId.value = ''
    selectedSceneAsset.value = null
    if (libraryImportTarget.value === 'scene') libraryImportVisible.value = false
    resetSceneForm()
}

const saveSceneEditor = async () => {
    const name = sceneForm.value.name.trim()
    if (!name) {
        feedback.msgWarning('请输入场景名称')
        return
    }
    if (!editingSceneId.value && !sceneForm.value.image && !sceneForm.value.visual_prompt.trim()) {
        feedback.msgWarning('请上传场景图或填写生成提示词')
        return
    }
    savingScene.value = true
    const prevScenes = scenes.value
    try {
        if (selectedSceneAsset.value?.url) {
            sceneForm.value.image = selectedSceneAsset.value.url
            sceneForm.value.raw_image = selectedSceneAsset.value.uri || selectedSceneAsset.value.url
        }
        const sceneId = editingSceneId.value || sceneForm.value.id || makeNewSceneId()
        const nextScene = packScene({
            ...sceneForm.value,
            id: sceneId,
            name,
            description: sceneForm.value.visual_prompt || sceneForm.value.description,
            image_prompt: sceneForm.value.image_prompt || sceneForm.value.visual_prompt
        })
        scenes.value = editingSceneId.value
            ? scenes.value.map((scene) => scene.id === editingSceneId.value ? nextScene : scene)
            : [...scenes.value, nextScene]
        await registerSceneImageAssetIfNeeded(nextScene)
        await persistVisualPlan()
        feedback.msgSuccess(editingSceneId.value ? '场景已更新' : '场景已新增')
        sceneEditorVisible.value = false
        sceneModelMenuOpen.value = false
        editingSceneId.value = ''
        selectedSceneAsset.value = null
        resetSceneForm()
    } catch (error: any) {
        scenes.value = prevScenes
        feedback.msgError(error?.msg || error?.message || '保存失败')
    } finally {
        savingScene.value = false
    }
}

const deleteSubject = async (subject: VisualEntity) => {
    try {
        await ElMessageBox.confirm(`确定删除主体「${subject.name}」吗？`, '删除主体', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })
        const prevSubjects = subjects.value
        const prevShots = storyboardShots.value
        const prevTasks = tasks.value
        const prevAssets = assets.value
        subjects.value = subjects.value.filter((item) => item.id !== subject.id)
        tasks.value = tasks.value.filter((task) => task.item_id !== subject.id)
        assets.value = assets.value.filter((asset) => {
            const meta = asset.meta || {}
            return String(meta.subject_id || meta.item_id || '') !== subject.id
        })
        storyboardShots.value = storyboardShots.value.map((shot) => ({
            ...shot,
            subject_ref_ids: shot.subject_ref_ids.filter((id) => id !== subject.id)
        }))
        try {
            await persistVisualPlan()
        } catch (error) {
            subjects.value = prevSubjects
            storyboardShots.value = prevShots
            tasks.value = prevTasks
            assets.value = prevAssets
            throw error
        }
        feedback.msgSuccess('已删除')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(error?.msg || error?.message || '删除失败')
    }
}

const loadVoices = async () => {
    voiceLoading.value = true
    try {
        const data = await getShortDramaVoices({
            page_no: 1,
            page_size: 80,
            source: voiceScope.value
        })
        voiceItems.value = listFromResponse(data)
            .map((item: any) => normalizeVoice(item, voiceScope.value))
            .filter((item: VoiceItem) => item.id)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '声音库读取失败')
        voiceItems.value = []
    } finally {
        voiceLoading.value = false
    }
}

const filteredVoiceItems = computed(() => voiceItems.value.filter((voice) => {
    if (voiceGenderFilter.value && voice.gender !== voiceGenderFilter.value) return false
    if (voiceAgeFilter.value && voice.age_group !== voiceAgeFilter.value) return false
    if (voiceLanguageFilter.value && voice.language !== voiceLanguageFilter.value) return false
    return true
}))

const pendingVoice = computed(() => voiceItems.value.find((voice) => String(voice.id) === String(pendingVoiceId.value)) || null)

const voiceFilterValue = (key: VoiceFilterKey) => {
    if (key === 'gender') return voiceGenderFilter.value
    if (key === 'age') return voiceAgeFilter.value
    return voiceLanguageFilter.value
}

const voiceFilterLabel = (key: VoiceFilterKey) => {
    const value = voiceFilterValue(key)
    const filter = voiceFilterConfigs.find((item) => item.key === key)
    return filter?.options.find((option) => option.value === value)?.label || filter?.options[0]?.label || ''
}

const setVoiceFilterValue = (key: VoiceFilterKey, value: string) => {
    if (key === 'gender') voiceGenderFilter.value = value
    if (key === 'age') voiceAgeFilter.value = value
    if (key === 'language') voiceLanguageFilter.value = value
}

const toggleVoiceFilter = (key: VoiceFilterKey) => {
    activeVoiceFilter.value = activeVoiceFilter.value === key ? '' : key
}

const closeVoiceFilterMenu = () => {
    activeVoiceFilter.value = ''
}

const selectVoiceFilter = (key: VoiceFilterKey, value: string) => {
    setVoiceFilterValue(key, value)
    closeVoiceFilterMenu()
}

const openVoicePicker = async () => {
    voicePickerVisible.value = true
    pendingVoiceId.value = subjectForm.value.voice_id || ''
    closeVoiceFilterMenu()
    await loadVoices()
}

const closeVoicePicker = () => {
    closeVoiceFilterMenu()
    voicePickerVisible.value = false
}

const switchVoiceScope = async (scope: 'official' | 'mine') => {
    voiceScope.value = scope
    pendingVoiceId.value = ''
    closeVoiceFilterMenu()
    await loadVoices()
}

const selectVoice = (voice: VoiceItem) => {
    closeVoiceFilterMenu()
    pendingVoiceId.value = voice.id
}

const confirmVoiceSelection = () => {
    const voice = pendingVoice.value
    if (!voice) return
    subjectForm.value.voice_id = voice.id
    subjectForm.value.voice_name = voice.name
    subjectForm.value.voice_label = voice.label
    subjectForm.value.voice_source = voice.source
    voicePickerVisible.value = false
}

const loadLibrarySubjects = async () => {
    libraryLoading.value = true
    try {
        const data = await getShortDramaSubjects({
            scope: libraryScope.value,
            category: libraryImportTarget.value === 'scene' ? 'scene' : 'character',
            page_no: 1,
            page_size: 80
        })
        librarySubjects.value = listFromResponse(data)
            .map(normalizeLibrarySubject)
            .filter((item: LibrarySubjectItem) => item.id)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '主体库读取失败')
        librarySubjects.value = []
    } finally {
        libraryLoading.value = false
    }
}

const openLibraryImport = async () => {
    libraryImportTarget.value = 'subject'
    libraryImportVisible.value = true
    await loadLibrarySubjects()
}

const openSceneLibraryImport = async () => {
    libraryImportTarget.value = 'scene'
    libraryImportVisible.value = true
    await loadLibrarySubjects()
}

const closeLibraryImport = () => {
    libraryImportVisible.value = false
}

const switchLibraryScope = async (scope: 'public' | 'user') => {
    libraryScope.value = scope
    await loadLibrarySubjects()
}

const importSubjectFromLibrary = (item: LibrarySubjectItem) => {
    ensureSubjectFormId()
    clearSubjectThreeViewState()
    subjectForm.value.name = item.name || subjectForm.value.name
    subjectForm.value.category = item.category || subjectForm.value.category
    subjectForm.value.description = item.description || item.visual_prompt
    subjectForm.value.visual_prompt = item.visual_prompt || item.description
    subjectForm.value.image_prompt = item.visual_prompt || item.description
    subjectForm.value.image = item.image
    subjectForm.value.raw_image = item.raw_image || item.image
    libraryImportVisible.value = false
}

const importSceneFromLibrary = (item: LibrarySubjectItem) => {
    ensureSceneFormId()
    selectedSceneAsset.value = null
    sceneForm.value.name = item.name || sceneForm.value.name
    sceneForm.value.category = 'scene'
    sceneForm.value.description = item.description || item.visual_prompt
    sceneForm.value.visual_prompt = item.visual_prompt || item.description
    sceneForm.value.image_prompt = item.visual_prompt || item.description
    sceneForm.value.image = item.image
    sceneForm.value.raw_image = item.raw_image || item.image
    libraryImportVisible.value = false
}

const importFromLibrary = (item: LibrarySubjectItem) => {
    if (libraryImportTarget.value === 'scene') {
        importSceneFromLibrary(item)
        return
    }
    importSubjectFromLibrary(item)
}

const handleThreeViewClick = () => {
    if (subjectForm.value.three_view_image) {
        activeSubjectPreview.value = 'three'
        return
    }
    openThreeViewModal()
}

const openThreeViewEditor = (subject: VisualEntity) => {
    if (!hasSubjectMainImage(subject) && !subjectThreeViewFor(subject)) {
        feedback.msgWarning('请先生成或上传主体图')
        return
    }
    editingSubjectId.value = subject.id
    subjectForm.value = toEditableSubject(subject)
    activeSubjectPreview.value = subjectForm.value.three_view_image ? 'three' : 'subject'
    selectedThreeViewAsset.value = null
    selectedSubjectModel.value = modelForSubject(subject)
    selectedSubjectResolution.value = resolveShortDramaResolution(selectedSubjectModel.value, selectedSubjectResolution.value)
    threeViewPrompt.value = visibleThreeViewPromptForSubject(subjectForm.value)
    threeViewModalVisible.value = true
}

const openPreviewViewer = (url?: string) => {
    const previewUrl = String(url || '')
    if (!previewUrl) return
    previewViewerUrl.value = previewUrl
    previewViewerVisible.value = true
}

const closePreviewViewer = () => {
    previewViewerVisible.value = false
    previewViewerUrl.value = ''
}

const openThreeViewModal = () => {
    if (!subjectFormHasMainImage.value && !subjectForm.value.three_view_image) {
        feedback.msgWarning('请先生成或上传主体图')
        return
    }
    ensureSubjectFormId()
    selectedThreeViewAsset.value = null
    selectedSubjectModel.value = selectedSubjectModel.value || subjectModelOptions.value[0] || null
    selectedSubjectResolution.value = resolveShortDramaResolution(selectedSubjectModel.value, selectedSubjectResolution.value)
    threeViewPrompt.value = visibleThreeViewPromptForSubject(subjectForm.value)
    threeViewModalVisible.value = true
}

const closeThreeViewModal = () => {
    if (generatingThreeView.value) return
    selectedThreeViewAsset.value = null
    threeViewModalVisible.value = false
    if (!subjectEditorVisible.value) {
        editingSubjectId.value = ''
        activeSubjectPreview.value = 'subject'
        resetSubjectForm()
    }
}

const confirmThreeViewModal = async () => {
    if (generatingThreeView.value || savingSubject.value) return
    const selectedThreeView = selectedThreeViewAsset.value?.url
        ? selectedThreeViewAsset.value
        : (threeViewHistoryAssets.value[0] || null)
    if (selectedThreeView?.url) {
        subjectForm.value.three_view_image = selectedThreeView.url
        subjectForm.value.three_view_raw_image = selectedThreeView.uri || selectedThreeView.url
        const selectedAsset: AssetItem = {
            ...selectedThreeView,
            asset_type: 'three_view',
            meta: {
                ...(selectedThreeView.meta || {}),
                subject_id: subjectForm.value.id,
                item_id: subjectForm.value.id,
                subject_name: subjectForm.value.name
            }
        }
        assets.value = [
            selectedAsset,
            ...assets.value.filter((asset) => asset.id !== selectedAsset.id)
        ]
    }
    if (subjectForm.value.three_view_image) activeSubjectPreview.value = 'three'
    const shouldPersistStandalone = Boolean(editingSubjectId.value && !subjectEditorVisible.value)
    const prevSubjects = subjects.value
    try {
        if (editingSubjectId.value) {
            const nextSubject = packSubject(subjectForm.value)
            subjects.value = subjects.value.map((subject) => subject.id === editingSubjectId.value ? nextSubject : subject)
            if (shouldPersistStandalone) {
                savingSubject.value = true
                await persistVisualPlan()
                feedback.msgSuccess('三视图已应用')
            }
        }
        threeViewModalVisible.value = false
        selectedThreeViewAsset.value = null
        if (!subjectEditorVisible.value) {
            editingSubjectId.value = ''
            activeSubjectPreview.value = 'subject'
            resetSubjectForm()
        }
    } catch (error: any) {
        subjects.value = prevSubjects
        feedback.msgError(error?.msg || error?.message || '保存失败')
    } finally {
        savingSubject.value = false
    }
}

const toggleSubjectModelMenu = async () => {
    if (subjectForm.value.mode !== 'ai' || generatingSubjectImage.value) return
    if (!subjectModelOptions.value.length) await loadSubjectModels()
    subjectModelMenuOpen.value = !subjectModelMenuOpen.value
}

const selectSubjectModel = (model: ModelOption) => {
    selectedSubjectModel.value = model
    subjectForm.value.model_id = model.value || model.channel_code || model.id
    subjectForm.value.model_name = model.name
    selectedSubjectResolution.value = resolveShortDramaResolution(model, selectedSubjectResolution.value)
    persistDefaultImageModelSelection(model, selectedSubjectResolution.value)
    subjectModelMenuOpen.value = false
}

const toggleSceneModelMenu = async () => {
    if (sceneForm.value.mode !== 'ai' || generatingSceneImage.value) return
    if (!subjectModelOptions.value.length) await loadSubjectModels()
    sceneModelMenuOpen.value = !sceneModelMenuOpen.value
}

const selectSceneModel = (model: ModelOption) => {
    selectedSceneModel.value = model
    sceneForm.value.model_id = model.value || model.channel_code || model.id
    sceneForm.value.model_name = model.name
    selectedSceneResolution.value = resolveShortDramaResolution(model, selectedSceneResolution.value)
    persistDefaultImageModelSelection(model, selectedSceneResolution.value)
    sceneModelMenuOpen.value = false
}

const toggleThreeViewModelMenu = async () => {
    if (generatingThreeView.value) return
    if (!subjectModelOptions.value.length) await loadSubjectModels()
    subjectModelMenuOpen.value = !subjectModelMenuOpen.value
}

const toggleSubjectResolutionMenu = () => {
    if (!subjectResolutionOptions.value.length || generatingSubjectImage.value || generatingThreeView.value) return
    subjectModelMenuOpen.value = false
    subjectResolutionMenuOpen.value = !subjectResolutionMenuOpen.value
}

const toggleSceneResolutionMenu = () => {
    if (!sceneResolutionOptions.value.length || generatingSceneImage.value) return
    sceneModelMenuOpen.value = false
    sceneResolutionMenuOpen.value = !sceneResolutionMenuOpen.value
}

const selectSubjectResolution = (value: string) => {
    selectedSubjectResolution.value = value
    persistDefaultImageModelSelection(selectedSubjectModel.value, value)
    subjectResolutionMenuOpen.value = false
}

const selectSceneResolution = (value: string) => {
    selectedSceneResolution.value = value
    persistDefaultImageModelSelection(selectedSceneModel.value, value)
    sceneResolutionMenuOpen.value = false
}

const selectThreeViewAsset = (asset: AssetItem) => {
    selectedThreeViewAsset.value = asset
}

const selectSubjectImageAssetForPreview = (asset: AssetItem) => {
    selectedSubjectImageAsset.value = asset
    activeSubjectPreview.value = 'subject'
}

const isSubjectImageAssetSelected = (asset: AssetItem) => {
    const selectedUrl = selectedSubjectImageAsset.value?.url || subjectForm.value.image
    const selectedUri = selectedSubjectImageAsset.value?.uri || subjectForm.value.raw_image
    return Boolean((selectedUrl && asset.url === selectedUrl) || (selectedUri && asset.uri === selectedUri))
}

const isThreeViewAssetSelected = (asset: AssetItem) => {
    const fallbackAsset = threeViewHistoryAssets.value[0] || null
    const selectedUrl = selectedThreeViewAsset.value?.url || fallbackAsset?.url || subjectForm.value.three_view_image
    const selectedUri = selectedThreeViewAsset.value?.uri || fallbackAsset?.uri || subjectForm.value.three_view_raw_image
    return Boolean((selectedUrl && asset.url === selectedUrl) || (selectedUri && asset.uri === selectedUri))
}

const triggerSubjectUpload = () => subjectUploadInputRef.value?.click()
const triggerSceneUpload = () => sceneUploadInputRef.value?.click()

const onSubjectUploadChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    uploadingSubject.value = true
    try {
        ensureSubjectFormId()
        const res: any = await uploadImage({ file })
        selectedSubjectImageAsset.value = null
        subjectForm.value.raw_image = pickUploadRaw(res)
        subjectForm.value.image = pickUploadPreview(res)
        clearSubjectThreeViewState()
        activeSubjectPreview.value = 'subject'
        await describeSubjectImage()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '上传失败')
    } finally {
        uploadingSubject.value = false
    }
}

const describeSubjectImage = async () => {
    if (!subjectForm.value.image && !subjectForm.value.raw_image) return
    if (!visionTextAvailable.value) return
    describingSubject.value = true
    try {
        const res: any = await describeShortDramaSubjectImage({
            image: subjectForm.value.image || subjectForm.value.raw_image,
            category: subjectForm.value.category
        })
        if (res?.prompt) {
            const prompt = cleanUserVisiblePrompt(res.prompt)
            subjectForm.value.visual_prompt = prompt
            subjectForm.value.image_prompt = prompt
        }
    } catch (error: any) {
        feedback.msgWarning(error?.msg || error?.message || 'AI 识别失败，请手动补充描述')
    } finally {
        describingSubject.value = false
    }
}

const onSceneUploadChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    uploadingScene.value = true
    try {
        ensureSceneFormId()
        selectedSceneAsset.value = null
        const res: any = await uploadImage({ file })
        sceneForm.value.raw_image = pickUploadRaw(res)
        sceneForm.value.image = pickUploadPreview(res)
        await describeSceneImage()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '上传失败')
    } finally {
        uploadingScene.value = false
    }
}

const describeSceneImage = async () => {
    if (!sceneForm.value.image && !sceneForm.value.raw_image) return
    if (!visionTextAvailable.value) return
    describingScene.value = true
    try {
        const res: any = await describeShortDramaSubjectImage({
            image: sceneForm.value.image || sceneForm.value.raw_image,
            category: 'scene'
        })
        if (res?.prompt) {
            const prompt = cleanUserVisiblePrompt(res.prompt)
            sceneForm.value.visual_prompt = prompt
            sceneForm.value.image_prompt = prompt
        }
    } catch (error: any) {
        feedback.msgWarning(error?.msg || error?.message || 'AI 识别失败，请手动补充描述')
    } finally {
        describingScene.value = false
    }
}

const selectSceneAsset = (asset: AssetItem) => {
    selectedSceneAsset.value = asset
}

const isSceneAssetSelected = (asset: AssetItem) => {
    const selectedUrl = selectedSceneAsset.value?.url || sceneForm.value.image
    const selectedUri = selectedSceneAsset.value?.uri || sceneForm.value.raw_image
    return Boolean((selectedUrl && asset.url === selectedUrl) || (selectedUri && asset.uri === selectedUri))
}

const mergeGenerationResult = (detail: any, fallbackTaskType: VisualTaskType, fallbackItemId = '') => {
    const taskItem = normalizeTask({
        ...detail,
        task_type: detail?.task_type || fallbackTaskType,
        item_id: detail?.item_id || fallbackItemId
    })
    if (taskItem) mergeTasks([taskItem])
    const outputAssets = Array.isArray(detail?.assets)
        ? detail.assets
        : (Array.isArray(detail?.output_assets) ? detail.output_assets : [])
    const normalizedAssets = outputAssets
        .map((item: any) => normalizeAsset(item, fallbackTaskType))
        .filter(Boolean) as AssetItem[]
    if (normalizedAssets.length) {
        const map = new Map(assets.value.map((item) => [item.id, item]))
        normalizedAssets.forEach((asset) => map.set(asset.id, asset))
        assets.value = Array.from(map.values())
    }
    return normalizedAssets[0] || firstAsset({ ...detail, task_type: fallbackTaskType })
}

const generateSubjectImageFromEditor = async () => {
    if (!subjectForm.value.name.trim()) {
        feedback.msgWarning('请输入主体名称')
        return
    }
    if (!subjectForm.value.visual_prompt.trim()) {
        feedback.msgWarning('请输入生成提示词')
        return
    }
    if (!selectedSubjectModel.value) {
        await loadSubjectModels()
    }
    if (!selectedSubjectModel.value) {
        feedback.msgWarning('暂无可用生图模型')
        return
    }
    generatingSubjectImage.value = true
    subjectModelMenuOpen.value = false
    try {
        ensureSubjectFormId()
        selectedSubjectImageAsset.value = null
        const visiblePrompt = cleanUserVisiblePrompt(subjectForm.value.visual_prompt)
        subjectForm.value.visual_prompt = visiblePrompt
        subjectForm.value.image_prompt = visiblePrompt
        const selectedModel = selectedSubjectModel.value
        subjectForm.value.model_id = selectedModel.value || selectedModel.channel_code || selectedModel.id
        subjectForm.value.model_name = selectedModel.name
        const task: any = await createShortDramaGeneration({
            task_type: 'subject_image',
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            subject_id: subjectForm.value.id || undefined,
            item_id: subjectForm.value.id || undefined,
            subject_name: subjectForm.value.name,
            item_name: subjectForm.value.name,
            category: subjectForm.value.category,
            subject_prompt: visiblePrompt,
            visual_prompt: visiblePrompt,
            image_prompt: visiblePrompt,
            prompt: visiblePrompt,
            visible_prompt: visiblePrompt,
            internal_prompt: extractInternalPrompt(subjectForm.value.unified_prompt),
            ratio: projectRatio.value || undefined,
            model_id: subjectForm.value.model_id,
            image_model_id: subjectForm.value.model_id,
            channel: subjectForm.value.model_id,
            channel_code: subjectForm.value.model_id,
            model_name: subjectForm.value.model_name,
            resolution: selectedSubjectResolution.value || undefined,
            quality: selectedSubjectResolution.value || undefined,
            reference_image: undefined,
            reference_images: [],
            params: {
                source: 'pc_subject_create_edit',
                subject_id: subjectForm.value.id || undefined,
                item_id: subjectForm.value.id || undefined,
                subject_name: subjectForm.value.name,
                item_name: subjectForm.value.name,
                category: subjectForm.value.category,
                subject_prompt: visiblePrompt,
                visual_prompt: visiblePrompt,
                image_prompt: visiblePrompt,
                prompt: visiblePrompt,
                visible_prompt: visiblePrompt,
                internal_prompt: extractInternalPrompt(subjectForm.value.unified_prompt),
                prompt_override: true,
                ratio: projectRatio.value || undefined,
                model_id: subjectForm.value.model_id,
                image_model_id: subjectForm.value.model_id,
                channel: subjectForm.value.model_id,
                channel_code: subjectForm.value.model_id,
                model_name: subjectForm.value.model_name,
                resolution: selectedSubjectResolution.value || undefined,
                quality: selectedSubjectResolution.value || undefined,
                reference_images: []
            }
        })
        const asset = mergeGenerationResult(task, 'subject_image', subjectForm.value.id)
        const taskItem = normalizeTask({ ...task, task_type: 'subject_image', item_id: subjectForm.value.id })
        const submittedTaskId = taskItem?.task_id || String(task?.task_id || '')
        if (submittedTaskId && !asset && !pendingSubjectImageTaskIds.value.includes(submittedTaskId)) {
            pendingSubjectImageTaskIds.value = [submittedTaskId, ...pendingSubjectImageTaskIds.value]
        }
        if (taskItem && taskItem.status === 'failed' && !asset) {
            mergeTasks([{ ...taskItem, status: 'running', error_msg: '' }])
        }
        if (asset) {
            selectedSubjectImageAsset.value = {
                ...asset,
                asset_type: 'subject_image',
                meta: {
                    ...(asset.meta || {}),
                    subject_id: subjectForm.value.id,
                    item_id: subjectForm.value.id,
                    subject_name: subjectForm.value.name
                }
            }
        }
        activeSubjectPreview.value = 'subject'
        feedback.msgSuccess(asset ? '主体图已生成' : '主体图生成任务已提交')
        schedulePolling()
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '主体图生成失败')
    } finally {
        generatingSubjectImage.value = false
    }
}

const generateSceneImageFromEditor = async () => {
    if (!sceneForm.value.name.trim()) {
        feedback.msgWarning('请输入场景名称')
        return
    }
    if (!sceneForm.value.visual_prompt.trim()) {
        feedback.msgWarning('请输入生成提示词')
        return
    }
    if (!selectedSceneModel.value) {
        await loadSubjectModels()
        selectedSceneModel.value = selectedSceneModel.value || selectedSubjectModel.value || subjectModelOptions.value[0] || null
    }
    if (!selectedSceneModel.value) {
        feedback.msgWarning('暂无可用生图模型')
        return
    }
    generatingSceneImage.value = true
    sceneModelMenuOpen.value = false
    try {
        ensureSceneFormId()
        selectedSceneAsset.value = null
        const visiblePrompt = cleanUserVisiblePrompt(sceneForm.value.visual_prompt)
        sceneForm.value.visual_prompt = visiblePrompt
        sceneForm.value.image_prompt = visiblePrompt
        const selectedModel = selectedSceneModel.value
        sceneForm.value.model_id = selectedModel.value || selectedModel.channel_code || selectedModel.id
        sceneForm.value.model_name = selectedModel.name
        const task: any = await createShortDramaGeneration({
            task_type: 'scene_image',
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            scene_id: sceneForm.value.id || undefined,
            item_id: sceneForm.value.id || undefined,
            scene_name: sceneForm.value.name,
            item_name: sceneForm.value.name,
            category: 'scene',
            scene_prompt: visiblePrompt,
            visual_prompt: visiblePrompt,
            image_prompt: visiblePrompt,
            prompt: visiblePrompt,
            visible_prompt: visiblePrompt,
            internal_prompt: extractInternalPrompt(sceneForm.value.unified_prompt),
            ratio: projectRatio.value || undefined,
            model_id: sceneForm.value.model_id,
            image_model_id: sceneForm.value.model_id,
            channel: sceneForm.value.model_id,
            channel_code: sceneForm.value.model_id,
            model_name: sceneForm.value.model_name,
            resolution: selectedSceneResolution.value || undefined,
            quality: selectedSceneResolution.value || undefined,
            reference_image: undefined,
            reference_images: [],
            params: {
                source: 'pc_scene_create_edit',
                scene_id: sceneForm.value.id || undefined,
                item_id: sceneForm.value.id || undefined,
                scene_name: sceneForm.value.name,
                item_name: sceneForm.value.name,
                category: 'scene',
                scene_prompt: visiblePrompt,
                visual_prompt: visiblePrompt,
                image_prompt: visiblePrompt,
                prompt: visiblePrompt,
                visible_prompt: visiblePrompt,
                internal_prompt: extractInternalPrompt(sceneForm.value.unified_prompt),
                ratio: projectRatio.value || undefined,
                model_id: sceneForm.value.model_id,
                image_model_id: sceneForm.value.model_id,
                channel: sceneForm.value.model_id,
                channel_code: sceneForm.value.model_id,
                model_name: sceneForm.value.model_name,
                resolution: selectedSceneResolution.value || undefined,
                quality: selectedSceneResolution.value || undefined,
                reference_images: []
            }
        })
        const taskItem = normalizeTask({ ...task, task_type: 'scene_image', item_id: sceneForm.value.id })
        if (taskItem) mergeTasks([taskItem])
        if (isTaskActive(taskItem?.status)) {
            feedback.msgSuccess('场景图已生成')
            schedulePolling()
            return
        }
        if (String(task?.status || '') !== 'success') {
            throw new Error(task?.error_msg || '场景图生成失败')
        }
        const asset = mergeGenerationResult(task, 'scene_image', sceneForm.value.id)
        if (!asset) {
            feedback.msgSuccess('场景图生成任务已提交')
            schedulePolling()
            return
        }
        const nextAsset: AssetItem = {
            ...asset,
            asset_type: 'scene_image',
            task_id: asset.task_id || String(task?.task_id || ''),
            meta: {
                ...(asset.meta || {}),
                scene_id: sceneForm.value.id,
                item_id: sceneForm.value.id,
                scene_name: sceneForm.value.name
            }
        }
        selectedSceneAsset.value = nextAsset
        sceneForm.value.raw_image = nextAsset.uri || nextAsset.url
        sceneForm.value.image = nextAsset.url
        assets.value = [nextAsset, ...assets.value.filter((item) => item.id !== nextAsset.id)]
        feedback.msgSuccess('场景图已应用')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '场景图生成失败')
    } finally {
        generatingSceneImage.value = false
    }
}

const generateThreeViewInModal = async () => {
    if (!subjectFormHasMainImage.value) {
        feedback.msgWarning('请先生成或上传主体图')
        return
    }
    if (!subjectForm.value.name.trim()) {
        feedback.msgWarning('请输入场景名称')
        return
    }
    if (!selectedSubjectModel.value) {
        await loadSubjectModels()
    }
    if (!selectedSubjectModel.value) {
        feedback.msgWarning('暂无可用生图模型')
        return
    }
    generatingThreeView.value = true
    subjectModelMenuOpen.value = false
    selectedThreeViewAsset.value = null
    try {
        ensureSubjectFormId()
        const subjectForReference = packSubject({ ...subjectForm.value, id: subjectForm.value.id })
        const registeredReferenceAsset = await registerSubjectImageAssetIfNeeded(subjectForReference)
        const referenceAsset = registeredReferenceAsset
            || (assetNumericId(selectedSubjectImageAsset.value) > 0 ? selectedSubjectImageAsset.value : null)
            || findSubjectImageAssetByFile(subjectForm.value.id, subjectForm.value.raw_image, subjectForm.value.image)
        const referenceImage = subjectForm.value.raw_image || subjectForm.value.image || referenceAsset?.uri || referenceAsset?.url || ''
        const referenceAssetIds = referenceAssetIdsFor(referenceAsset)
        const visiblePrompt = cleanUserVisiblePrompt(threeViewPrompt.value)
        threeViewPrompt.value = visiblePrompt
        const internalPrompt = threeViewPromptForSubject(subjectForm.value)
        const prompt = effectiveThreeViewPromptForSubject(subjectForm.value)
        const selectedModel = selectedSubjectModel.value
        subjectForm.value.model_id = selectedModel.value || selectedModel.channel_code || selectedModel.id
        subjectForm.value.model_name = selectedModel.name
        const task: any = await createShortDramaGeneration({
            task_type: 'three_view',
            project_id: projectId.value,
            task_id: scriptTaskId.value,
            subject_id: subjectForm.value.id || undefined,
            item_id: subjectForm.value.id || undefined,
            subject_name: subjectForm.value.name,
            item_name: subjectForm.value.name,
            category: subjectForm.value.category,
            subject_prompt: subjectForm.value.visual_prompt,
            prompt,
            visible_prompt: visiblePrompt,
            internal_prompt: internalPrompt,
            view_mode: 'three_view',
            ratio: projectRatio.value || undefined,
            model_id: subjectForm.value.model_id,
            model_name: subjectForm.value.model_name,
            resolution: selectedSubjectResolution.value || undefined,
            quality: selectedSubjectResolution.value || undefined,
            reference_image: referenceImage,
            reference_images: referenceImage ? [referenceImage] : [],
            input_asset_ids: referenceAssetIds,
            reference_asset_ids: referenceAssetIds,
            params: {
                source: 'pc_subject_create_edit',
                subject_id: subjectForm.value.id || undefined,
                item_id: subjectForm.value.id || undefined,
                subject_name: subjectForm.value.name,
                item_name: subjectForm.value.name,
                category: subjectForm.value.category,
                subject_prompt: subjectForm.value.visual_prompt,
                prompt,
                visible_prompt: visiblePrompt,
                internal_prompt: internalPrompt,
                view_mode: 'three_view',
                ratio: projectRatio.value || undefined,
                model_id: subjectForm.value.model_id,
                model_name: subjectForm.value.model_name,
                resolution: selectedSubjectResolution.value || undefined,
                quality: selectedSubjectResolution.value || undefined,
                reference_image: referenceImage,
                reference_images: referenceImage ? [referenceImage] : [],
                input_asset_ids: referenceAssetIds,
                reference_asset_ids: referenceAssetIds
            }
        })
        const taskItem = normalizeTask({ ...task, task_type: 'three_view', item_id: subjectForm.value.id })
        if (taskItem) mergeTasks([taskItem])
        if (isTaskActive(taskItem?.status)) {
            feedback.msgSuccess('场景图已生成')
            schedulePolling()
            return
        }
        if (String(task?.status || '') !== 'success') {
            throw new Error(task?.error_msg || '三视图生成失败')
        }
        const asset = mergeGenerationResult(task, 'three_view', subjectForm.value.id)
        if (!asset) {
            feedback.msgSuccess('场景图生成任务已提交')
            schedulePolling()
            return
        }
        const nextAsset: AssetItem = {
            ...asset,
            asset_type: 'three_view',
            task_id: asset.task_id || String(task?.task_id || '')
        }
        selectedThreeViewAsset.value = nextAsset
        assets.value = [nextAsset, ...assets.value.filter((item) => item.id !== nextAsset.id)]
        feedback.msgSuccess('场景图已应用')
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '三视图生成失败')
    } finally {
        generatingThreeView.value = false
    }
}

const createThreeViewTask = async (subject: VisualEntity) => {
    const subjectPrompt = cleanUserVisiblePrompt(subject.visual_prompt || subject.image_prompt || subject.unified_prompt || subject.description)
    const visiblePrompt = cleanUserVisiblePrompt(threeViewPrompt.value)
    const internalPrompt = threeViewPromptForSubject(subject)
    const prompt = effectiveThreeViewPromptForSubject(subject)
    const referenceImage = subjectRawImageFor(subject)
    const referenceAsset = subjectImageReferenceAsset(subject)
    const referenceAssetIds = referenceAssetIdsFor(referenceAsset)
    const selectedModel = modelForSubject(subject)
    const modelCode = selectedModel?.value || selectedModel?.channel_code || selectedModel?.id || subject.model_id || subjectForm.value.model_id || ''
    const modelName = selectedModel?.name || subject.model_name || subjectForm.value.model_name || ''
    const resolution = resolutionForImageModel(selectedModel)
    if (!referenceImage) {
        throw new Error('主体图生成失败')
    }
    const result = await createShortDramaGeneration({
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        task_type: 'three_view',
        subject_id: subject.id,
        item_id: subject.id,
        item_name: subject.name,
        item_description: subject.description,
        visual_prompt: subjectPrompt,
        image_prompt: subjectPrompt,
        subject_name: subject.name,
        subject_prompt: subjectPrompt,
        prompt,
        visible_prompt: visiblePrompt,
        internal_prompt: internalPrompt,
        view_mode: 'three_view',
        ratio: projectRatio.value || undefined,
        model_id: modelCode,
        image_model_id: modelCode,
        channel: modelCode,
        channel_code: modelCode,
        model_name: modelName,
        resolution: resolution || undefined,
        quality: resolution || undefined,
        reference_image: referenceImage || undefined,
        reference_images: referenceImage ? [referenceImage] : [],
        input_asset_ids: referenceAssetIds,
        reference_asset_ids: referenceAssetIds,
        params: {
            source: 'pc_subject_step',
            view_mode: 'three_view',
            item_id: subject.id,
            item_name: subject.name,
            item_description: subject.description,
            visual_prompt: subjectPrompt,
            image_prompt: subjectPrompt,
            subject_id: subject.id,
            subject_name: subject.name,
            subject_prompt: subjectPrompt,
            prompt,
            visible_prompt: visiblePrompt,
            internal_prompt: internalPrompt,
            ratio: projectRatio.value || undefined,
            model_id: modelCode,
            image_model_id: modelCode,
            channel: modelCode,
            channel_code: modelCode,
            model_name: modelName,
            resolution: resolution || undefined,
            quality: resolution || undefined,
            reference_image: referenceImage || undefined,
            reference_images: referenceImage ? [referenceImage] : [],
            input_asset_ids: referenceAssetIds,
            reference_asset_ids: referenceAssetIds
        }
    })
    const task = normalizeTask(result)
    if (task) mergeTasks([task])
}

const generateThreeView = async (subject: VisualEntity) => {
    if (generatingSubjectId.value || isTaskActive(taskFor('three_view', subject)?.status)) return
    if (!hasSubjectMainImage(subject)) {
        feedback.msgWarning('请先生成或上传主体图')
        return
    }
    generatingSubjectId.value = subject.id
    try {
        await createThreeViewTask(subject)
        feedback.msgSuccess('三视图生成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '三视图生成失败')
    } finally {
        generatingSubjectId.value = ''
    }
}

const generateAllThreeViews = async () => {
    if (batchGeneratingThreeViews.value) return
    const pendingSubjects = batchThreeViewActionSubjects.value
    if (!pendingSubjects.length) {
        const hasMainImage = subjectItems.value.some(hasSubjectMainImage)
        feedback.msgWarning(hasMainImage ? '暂无可生成三视图的主体' : '请先生成或上传主体图')
        return
    }
    batchGeneratingThreeViews.value = true
    try {
        await Promise.all(pendingSubjects.map(createThreeViewTask))
        feedback.msgSuccess('三视图生成任务已提交')
        await refreshAll(true)
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '三视图生成失败')
    } finally {
        batchGeneratingThreeViews.value = false
    }
}

const goPlan = () => router.push({ path: '/ai/short-drama/plan', query: routeQuery.value })
const goScene = () => router.push({ path: '/ai/short-drama/scene', query: routeQuery.value })
const goStoryboard = () => router.push({ path: '/ai/short-drama/storyboard', query: routeQuery.value })
const createShotImageTask = async (shot: StoryboardShot) => {
    const imagePrompt = cleanVisibleImagePrompt(shot.image_prompt || [
        shot.scene_name,
        shot.time_of_day,
        shot.visual_description || shot.description,
        shot.composition ? `构图：${shot.composition}` : '',
        shot.shot_type ? `景别：${shot.shot_type}` : '',
        shot.angle ? `角度：${shot.angle}` : '',
        shot.action ? `动作：${shot.action}` : '',
        shot.result ? `结果：${shot.result}` : '',
        shot.atmosphere ? `氛围：${shot.atmosphere}` : ''
    ].filter(Boolean).join('\n'), [shot.video_prompt, shot.bgm_prompt, shot.voice_role])
    const internalPrompt = extractInternalPrompt([shot.image_prompt, shot.video_prompt].filter(Boolean).join('\n'))
    const selectedModel = storyboardImageModel.value
    const modelCode = imageModelCode(selectedModel)
    const modelName = selectedModel?.name || ''
    const resolution = storyboardImageResolution.value
    const result = await createShortDramaGeneration({
        project_id: projectId.value,
        task_id: scriptTaskId.value,
        shot_id: shot.id,
        task_type: 'shot_image',
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
        visible_prompt: imagePrompt,
        internal_prompt: internalPrompt,
        ratio: projectRatio.value || undefined,
        model_id: modelCode,
        image_model_id: modelCode,
        channel: modelCode,
        channel_code: modelCode,
        model_name: modelName,
        resolution: resolution || undefined,
        quality: resolution || undefined,
        scene_ref_id: shot.scene_ref_id,
        subject_ref_ids: shot.subject_ref_ids,
        voice_role: shot.voice_role,
        bgm_prompt: shot.bgm_prompt,
        params: {
            source: 'pc_scene_step',
            batch: true,
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
            visible_prompt: imagePrompt,
            internal_prompt: internalPrompt,
            ratio: projectRatio.value || undefined,
            model_id: modelCode,
            image_model_id: modelCode,
            channel: modelCode,
            channel_code: modelCode,
            model_name: modelName,
            resolution: resolution || undefined,
            quality: resolution || undefined,
            scene_ref_id: shot.scene_ref_id,
            subject_ref_ids: shot.subject_ref_ids,
            voice_role: shot.voice_role,
            bgm_prompt: shot.bgm_prompt
        }
    })
    const task = normalizeTask(result)
    if (task) mergeTasks([task])
}
const generateStoryboardImages = async () => {
    if (generatingShotImages.value) return
    const sourceShots = storyboardShots.value.filter((shot) => shot.id)
    if (!sourceShots.length) {
        feedback.msgWarning('暂无分镜')
        return
    }
    const pendingShots = pendingStoryboardImageShots.value
    if (!pendingShots.length) {
        feedback.msgSuccess('所有分镜图已生成')
        goStoryboard()
        return
    }
    generatingShotImages.value = true
    try {
        await Promise.all(pendingShots.map(createShotImageTask))
        feedback.msgSuccess('分镜图生成任务已提交')
        await router.push({ path: '/ai/short-drama/storyboard', query: routeQuery.value })
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '分镜图生成失败')
    } finally {
        generatingShotImages.value = false
    }
}
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
        const project = await renameShortDramaProject({
            id: projectId.value,
            title
        })
        projectTitle.value = String(project?.title || title)
        feedback.msgSuccess('保存成功')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(error?.msg || error?.message || '重命名失败')
    }
}
const goStep = (key: FlowStepKey) => {
    if (key === 'script') goPlan()
    if (key === 'subject') router.push({ path: '/ai/short-drama/subject-create', query: routeQuery.value })
    if (key === 'scene') goScene()
    if (key === 'storyboard') goStoryboard()
}

watch(
    () => `${projectId.value}:${scriptTaskId.value}`,
    async (_next, prev) => {
        if (!prev) return
        stopPolling()
        tasks.value = []
        assets.value = []
        subjects.value = []
        scenes.value = []
        storyboardShots.value = []
        pendingSubjectImageTaskIds.value = []
        projectGenerationSettings.value = {}
        restoredFromCache.value = false
        const hasCache = restoreVisualCache()
        await refreshAll(hasCache)
    }
)
watch(selectedSubjectModel, (model) => {
    selectedSubjectResolution.value = resolveShortDramaResolution(model, selectedSubjectResolution.value)
}, { immediate: true })
watch(selectedSceneModel, (model) => {
    selectedSceneResolution.value = resolveShortDramaResolution(model, selectedSceneResolution.value)
}, { immediate: true })

onMounted(() => {
    const hasCache = restoreVisualCache()
    refreshAll(hasCache)
})
onBeforeUnmount(() => {
    stopPolling()
    if (generationSettingsSaveTimer) clearTimeout(generationSettingsSaveTimer)
})
</script>

<style lang="scss" scoped>
.visual-creation-page {
    min-width: 1180px;
    min-height: 100vh;
    background: #0c0c0d;
    color: #fff;
    font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    overflow: hidden;
}

button {
    font: inherit;
}

.visual-canvas {
    height: calc(100vh - 72px);
    margin-top: 72px;
    padding: 40px 60px 126px;
    overflow-y: auto;
    scrollbar-width: none;
    box-sizing: border-box;
}

.visual-canvas::-webkit-scrollbar {
    display: none;
}

.subject-gallery {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 28px 44px;
    align-items: start;
}

.subject-pair {
    display: grid;
    grid-template-columns: 263fr 587fr;
    gap: clamp(18px, 1.46vw, 28px);
    min-width: 0;
    padding: 10px;
    border-radius: 8px;
    background: #151617;
    box-sizing: border-box;
}

.scene-gallery {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 44px;
}

.creation-card {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    background: #1e1f20;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.creation-card :deep(.short-drama-image-preview),
.creation-card :deep(.short-drama-image-preview__image) {
    width: 100%;
    height: 100%;
}

.subject-card,
.three-card {
    height: auto;
}

.subject-card {
    aspect-ratio: 263 / 354;
    background: #f5f5f0;
}

.three-card {
    aspect-ratio: 587 / 354;
}

.scene-card {
    aspect-ratio: 878 / 471;
    min-height: 300px;
    box-shadow: 0 0 0 10px #151617;
    margin: 10px;
}

.creation-placeholder,
.three-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #1e1f20;
    color: rgba(255, 255, 255, 0.72);
    font-size: 14px;
}

.creation-placeholder :deep(.short-drama-grainient-placeholder),
.three-empty :deep(.short-drama-grainient-placeholder),
.three-preview :deep(.short-drama-grainient-placeholder),
.main-preview-loading :deep(.short-drama-grainient-placeholder),
.mini-preview.is-generating :deep(.short-drama-grainient-placeholder),
.scene-history button.is-generating :deep(.short-drama-grainient-placeholder),
.three-history button.is-generating :deep(.short-drama-grainient-placeholder) {
    width: 100%;
    height: 100%;
}

.three-empty button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 46px;
    border: 0;
    border-radius: 8px;
    padding: 0 22px;
    background: #333436;
    color: #fff;
    cursor: pointer;

    img {
        width: 16px;
        height: 16px;
        filter: brightness(0) invert(1);
    }

    span,
    strong {
        font-size: 14px;
        font-weight: 500;
        line-height: 14px;
    }
}

.card-tools {
    position: absolute;
    top: 8px;
    right: 8px;
    display: inline-flex;
    gap: 4px;
    z-index: 2;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;

    button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
    }

    img {
        width: 30px;
        height: 30px;
        object-fit: contain;
    }
}

.creation-card:hover .card-tools {
    opacity: 1;
    pointer-events: auto;
}

.card-label {
    position: absolute;
    left: 12px;
    bottom: 14px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: calc(100% - 70px);
    height: 30px;
    padding: 0 12px;
    border-radius: 15px;
    background: rgba(31, 32, 34, 0.58);
    color: #fff;
    backdrop-filter: blur(12px);

    img {
        width: 16px;
        height: 16px;
        object-fit: contain;
        filter: brightness(0) invert(1);
    }

    span {
        min-width: 0;
        overflow: hidden;
        font-size: 14px;
        line-height: 14px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.sound-btn {
    position: absolute;
    right: 12px;
    bottom: 14px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 50%;
    background: rgba(31, 32, 34, 0.58);
    cursor: pointer;
    backdrop-filter: blur(12px);

    img {
        width: 18px;
        height: 18px;
        filter: brightness(0) invert(1);
    }
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 320px;
    color: rgba(255, 255, 255, 0.5);
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

.flow-bottom-bar {
    position: fixed;
    left: 0;
    bottom: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 101px;
    border-top: 1px solid #242426;
    background: #0c0c0d;
}

.bottom-actions {
    display: grid;
    gap: 20px;
    height: 44px;

    &.is-subject {
        grid-template-columns: 173px 210px 173px;
        width: 596px;
    }

    &.is-scene {
        grid-template-columns: 173px 173px;
        width: 366px;
    }
}

.dark-btn,
.light-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    border: 0;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    line-height: 16px;
    cursor: pointer;

    img {
        width: 16px;
        height: 16px;
        object-fit: contain;
    }
}

.dark-btn {
    color: #fff;
    background: #1e1f20;
}

.light-btn {
    color: #0c0c0d;
    background: #fff;

    img {
        filter: brightness(0);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.56;
    }
}

.subject-editor-backdrop,
.sub-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
}

.sub-modal-backdrop {
    z-index: 3010;
}

.subject-editor-modal,
.sub-picker-modal {
    width: min(820px, calc(100vw - 48px));
    overflow: hidden;
    border-radius: 10px;
    background: #1f2022;
    color: #fff;
    box-sizing: border-box;
}

.sub-picker-modal {
    width: min(560px, calc(100vw - 48px));
    max-height: min(680px, calc(100vh - 48px));
    display: flex;
    flex-direction: column;
}

.sub-picker-modal.is-library {
    width: clamp(760px, 54vw, 860px);
    height: clamp(520px, 68vh, 680px);
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    background: #1d1e20;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
}

.sub-picker-modal.is-voice-picker {
    width: clamp(680px, 48vw, 720px);
    height: clamp(460px, 62vh, 620px);
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    background: #1d1e20;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
}

.scene-editor-modal {
    width: min(820px, calc(100vw - 48px));
}

.subject-editor-head,
.subject-editor-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 0;
}

.subject-editor-head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
}

.subject-editor-head button {
    border: 0;
    background: transparent;
    color: #fff;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
}

.subject-editor-body {
    display: grid;
    grid-template-columns: 360px 400px;
    gap: 22px;
    padding: 17px 20px 0;
}

.subject-editor-form {
    display: flex;
    flex-direction: column;
    min-height: 434px;
    gap: 16px;
}

.scene-editor-spacer {
    flex: 0 0 70px;
}

.editor-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: rgba(255, 255, 255, 0.86);
    font-size: 14px;
}

.editor-field input {
    height: 40px;
    padding: 0 14px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 7px;
    background: #171719;
    color: #fff;
    outline: none;
    box-sizing: border-box;
}

.segmented-control {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    overflow: hidden;
    padding: 3px;
    border-radius: 7px;
    background: #303133;
}

.segmented-control button {
    height: 32px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: rgba(255, 255, 255, 0.48);
    cursor: pointer;
}

.segmented-control button.is-active {
    background: #fff;
    color: #111;
    font-weight: 700;
}

.voice-select-card,
.picker-list button {
    display: flex;
    align-items: center;
    width: 100%;
    border: 0;
    border-radius: 8px;
    background: #303133;
    color: #fff;
    cursor: pointer;
    box-sizing: border-box;
}

.voice-select-card {
    height: 70px;
    gap: 12px;
    padding: 0 14px;
    text-align: left;
}

.voice-icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);

    img {
        width: 18px;
        height: 18px;
        filter: brightness(0) invert(1);
    }
}

.voice-copy,
.picker-list button > span:last-child {
    min-width: 0;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 5px;

    strong {
        overflow: hidden;
        font-size: 15px;
        font-weight: 600;
        line-height: 18px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    em {
        overflow: hidden;
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
        font-style: normal;
        line-height: 14px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.voice-switch {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.82);
    font-size: 24px;
}

.subject-prompt-panel {
    display: flex;
    flex-direction: column;
    height: 174px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    background: #171719;
    box-sizing: border-box;
}

.upload-subject-btn {
    flex: 0 0 auto;
    height: 42px;
    margin: 5px 5px 0;
    border: 0;
    border-radius: 7px;
    background: #303133;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
}

.subject-prompt-panel textarea {
    flex: 1 1 auto;
    min-height: 0;
    padding: 14px;
    border: 0;
    background: transparent;
    color: #fff;
    font-size: 14px;
    line-height: 1.55;
    outline: none;
    resize: none;
    box-sizing: border-box;
}

.subject-prompt-foot {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 38px;
    gap: 8px;
    padding: 0 10px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

.model-picker {
    position: relative;
    flex: 0 0 auto;
}

.resolution-picker {
    position: relative;
    flex: 0 0 auto;
}

.resolution-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 32px;
    border: 0;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    font-size: 14px;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
}

.model-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;

    img {
        display: block;
        width: 32px;
        height: 32px;
        object-fit: contain;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
}

.model-menu {
    position: absolute;
    left: 0;
    bottom: 34px;
    z-index: 4;
    width: 188px;
    max-height: 220px;
    overflow-y: auto;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: #292a2c;
}

.model-menu--resolution {
    width: 132px;
}

.model-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.78);
    cursor: pointer;
    text-align: left;

    span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    i {
        flex: 0 0 auto;
        font-style: normal;
    }
}

.model-menu button:hover,
.model-menu button.is-active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.model-menu-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 68px;
    color: rgba(255, 255, 255, 0.45);
}

.upload-status {
    flex: 1 1 auto;
    min-width: 0;
}

.prompt-cost {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    color: rgba(255, 255, 255, 0.75);
}

.prompt-cost button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: #111;
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }

    img {
        width: 15px;
        height: 15px;
        object-fit: contain;
        filter: brightness(0);
    }
}

.library-import-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    margin-top: auto;
    padding: 0 14px;
    border: 0;
    border-radius: 17px;
    background: #303133;
    color: #fff;
    font-size: 14px;
    cursor: pointer;

    img {
        width: 16px;
        height: 16px;
        object-fit: contain;
        filter: brightness(0) invert(1);
    }
}

.cube-icon {
    position: relative;
    width: 18px;
    height: 18px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0;
    line-height: 0;
}

.cube-icon::before,
.cube-icon::after {
    content: '';
    position: absolute;
    border: 1.4px solid currentColor;
    box-sizing: border-box;
}

.cube-icon::before {
    left: 4px;
    top: 5px;
    width: 10px;
    height: 10px;
    transform: rotate(30deg) skewY(-12deg);
}

.cube-icon::after {
    left: 7px;
    top: 4px;
    width: 7px;
    height: 7px;
    border-left: 0;
    border-bottom: 0;
    transform: skewY(28deg);
}

.subject-editor-preview {
    display: grid;
    grid-template-columns: 320px 56px;
    gap: 14px;
}

.scene-editor-preview {
    grid-template-columns: 320px 56px;
}

.main-preview,
.mini-preview,
.three-trigger {
    overflow: hidden;
    border-radius: 8px;
    background: #303133;
}

.main-preview {
    position: relative;
    width: 320px;
    height: 434px;
    overflow: hidden;
    border-radius: 8px;
    background: #303133;
    color: rgba(255, 255, 255, 0.4);
}

.main-preview-hit {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: zoom-in;

    &:disabled {
        cursor: default;
    }
}

.main-preview-hit img,
.mini-preview img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.preview-side {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.mini-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    padding: 0;
    border: 0;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    cursor: pointer;
}

.mini-preview.is-generating {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: #28292b;
    cursor: default;
}

.mini-preview.is-generating span {
    position: relative;
    padding-top: 18px;
    font-size: 12px;
}

.mini-preview.is-generating span::before {
    position: absolute;
    top: 0;
    left: 50%;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border: 2px solid rgba(255, 255, 255, 0.28);
    border-top-color: #fff;
    border-radius: 50%;
    content: '';
    animation: three-loading-spin 0.8s linear infinite;
}

.mini-preview.is-active,
.three-preview-box.is-active {
    box-shadow: 0 0 0 2px #fff;
}

.main-preview-loading {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.34);
    pointer-events: none;
    backdrop-filter: blur(2px);
}

.main-preview-loading span {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 8px 34px;
    border-radius: 999px;
    background: rgba(30, 31, 32, 0.82);
    color: #fff;
    font-size: 13px;
}

.main-preview-loading span::before {
    position: absolute;
    left: 14px;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.28);
    border-top-color: #fff;
    border-radius: 50%;
    content: '';
    animation: three-loading-spin 0.8s linear infinite;
}

.three-preview-box {
    position: relative;
    width: 56px;
    height: 56px;
    overflow: hidden;
    border-radius: 8px;
}

.three-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 4px;
    width: 56px;
    height: 56px;
    border: 0;
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;

    &.has-image {
        height: 56px;
        background: #171719;
    }

    i {
        font-size: 24px;
        font-style: normal;
        line-height: 20px;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
}

.three-trigger img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.scene-history {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 434px;
    overflow-y: auto;
    padding-right: 2px;
}

.scene-history button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 56px;
    height: 56px;
    overflow: hidden;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 8px;
    background: #303133;
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
}

.scene-history button.is-active {
    border-color: #fff;
}

.scene-history button.is-generating {
    border-color: rgba(255, 255, 255, 0.16);
    background: #28292b;
    cursor: default;
}

.scene-history button.is-generating span {
    position: relative;
    padding-top: 18px;
    font-size: 12px;
}

.scene-history button.is-generating span::before {
    position: absolute;
    top: 0;
    left: 50%;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border: 2px solid rgba(255, 255, 255, 0.28);
    border-top-color: #fff;
    border-radius: 50%;
    content: '';
    animation: three-loading-spin 0.8s linear infinite;
}

.scene-history img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.three-view-entry {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(31, 32, 34, 0.82);
    cursor: pointer;
    backdrop-filter: blur(8px);

    img {
        width: 16px;
        height: 16px;
        object-fit: contain;
    }
}

.subject-editor-actions {
    justify-content: flex-end;
    gap: 20px;
    padding: 20px;
}

.subject-editor-actions button {
    width: 120px;
    height: 44px;
    border: 0;
    border-radius: 8px;
    background: #fff;
    color: #111;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;

    &.ghost {
        background: #303133;
        color: #fff;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
}

.three-create-modal {
    width: min(884px, calc(100vw - 64px));
    min-height: 544px;
    overflow: hidden;
    border-radius: 10px;
    background: #1f2022;
    color: #fff;
    box-sizing: border-box;
}

.three-create-modal .subject-editor-head {
    padding: 20px 20px 0;
}

.three-create-modal .subject-editor-head h2 {
    font-size: 18px;
    line-height: 24px;
}

.three-create-modal .subject-editor-actions {
    gap: 16px;
    padding: 18px 16px 16px;
}

.three-create-modal .subject-editor-actions button {
    width: 96px;
    height: 36px;
    border-radius: 7px;
    font-size: 14px;
}

.three-modal__body {
    position: relative;
    min-height: 306px;
    padding: 20px 16px 0;
}

.three-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 544px;
    max-width: calc(100% - 176px);
    height: 306px;
    margin: 0 auto;
    overflow: hidden;
    border-radius: 8px;
    background: #28292b;
    color: rgba(255, 255, 255, 0.45);
}

.three-preview img,
.three-history img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.three-history {
    position: absolute;
    top: 20px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100px;
    max-height: 306px;
    overflow-y: auto;
}

.three-history button {
    width: 100px;
    height: 56px;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 7px;
    padding: 0;
    background: #333;
    cursor: pointer;
}

.three-history button.is-active {
    border-color: #fff;
}

.three-history button.is-generating {
    display: flex;
    align-items: center;
    justify-content: center;
    border-color: rgba(255, 255, 255, 0.16);
    background: #28292b;
    color: rgba(255, 255, 255, 0.72);
    cursor: default;
}

.three-history button.is-generating span {
    position: relative;
    padding-top: 18px;
    font-size: 12px;
}

.three-history button.is-generating span::before {
    position: absolute;
    top: 0;
    left: 50%;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border: 2px solid rgba(255, 255, 255, 0.28);
    border-top-color: #fff;
    border-radius: 50%;
    content: '';
    animation: three-loading-spin 0.8s linear infinite;
}

@keyframes three-loading-spin {
    to {
        transform: rotate(360deg);
    }
}

.three-prompt-panel {
    display: flex;
    flex-direction: column;
    width: calc(100% - 64px);
    height: 90px;
    margin: 24px 32px 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: #171719;
    box-sizing: border-box;
}

.three-prompt {
    flex: 1 1 auto;
    min-height: 0;
    padding: 12px;
    border: 0;
    background: transparent;
    color: #fff;
    line-height: 1.6;
    outline: none;
    resize: none;
    box-sizing: border-box;
}

.three-prompt-panel__foot {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 38px;
    padding: 0 10px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

@media (max-width: 920px) {
    .three-create-modal {
        width: min(720px, calc(100vw - 40px));
    }

    .three-preview {
        max-width: calc(100% - 128px);
    }

    .three-history {
        width: 88px;
    }

    .three-history button {
        width: 88px;
        height: 50px;
    }
}

.preview-viewer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3020;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
    background: rgba(0, 0, 0, 0.82);
    box-sizing: border-box;
}

.preview-viewer-backdrop img {
    display: block;
    max-width: min(1120px, 100%);
    max-height: 100%;
    border-radius: 8px;
    object-fit: contain;
}

.preview-viewer-close {
    position: fixed;
    top: 28px;
    right: 32px;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
}

.picker-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    margin: 18px 20px 0;
    padding: 3px;
    border-radius: 8px;
    background: #303133;
}

.picker-tabs button {
    height: 34px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
}

.picker-tabs button.is-active {
    background: #fff;
    color: #111;
    font-weight: 700;
}

.voice-picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    padding: 20px 20px 0;
    color: #fff;

    h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        line-height: 22px;
    }

    button {
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        background: transparent;
        color: rgba(255, 255, 255, 0.8);
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
    }
}

.voice-picker-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    gap: 20px;
    padding: 14px 20px 0;
}

.voice-picker-tabs {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 14px;
}

.voice-picker-tabs button {
    height: 28px;
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.38);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}

.voice-picker-tabs button.is-active {
    color: #fff;
}

.library-picker-toolbar {
    justify-content: flex-start;
}

.library-picker-tabs {
    gap: 18px;
}

.library-picker-tabs button {
    height: 28px;
}

.voice-picker-filters {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 0 0 auto;
    min-width: 0;
    gap: 8px;
}

.voice-filter {
    position: relative;
    flex: 0 0 auto;
}

.voice-filter-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    min-width: 74px;
    height: 28px;
    gap: 7px;
    padding: 0 10px 0 13px;
    border: 0;
    border-radius: 999px;
    background: #303133;
    color: rgba(255, 255, 255, 0.74);
    font-size: 12px;
    line-height: 28px;
    outline: none;
    cursor: pointer;
}

.voice-filter.is-open .voice-filter-trigger {
    background: #3a3b3d;
    color: #fff;
}

.voice-filter-arrow {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    line-height: 1;
    transform: translateY(-1px);
}

.voice-filter-menu {
    position: absolute;
    z-index: 12;
    top: calc(100% + 6px);
    right: 0;
    min-width: 82px;
    overflow: hidden;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    background: #262729;
}

.voice-filter-menu button {
    display: block;
    width: 100%;
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
}

.voice-filter-menu button:hover,
.voice-filter-menu button.is-active {
    background: #3a3b3d;
    color: #fff;
}

.voice-picker-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: flex-start;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    gap: 8px;
    margin: 14px 20px 0;
    padding: 0 4px 0 0;
}

.voice-picker-card {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 62px;
    gap: 10px;
    padding: 0 12px 0 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: #2a2b2d;
    color: #fff;
    cursor: pointer;
    text-align: left;
    box-sizing: border-box;
}

.voice-picker-card.is-active {
    border-color: rgba(255, 255, 255, 0.82);
    background: #303133;
}

.voice-avatar {
    flex: 0 0 auto;
    width: 46px;
    height: 46px;
    overflow: hidden;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    img[src$='shengyin.svg'] {
        padding: 13px;
        filter: brightness(0) invert(1);
        box-sizing: border-box;
        object-fit: contain;
    }
}

.voice-card-copy {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    gap: 4px;

    strong,
    em {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    strong {
        font-size: 14px;
        font-weight: 700;
        line-height: 18px;
    }

    em {
        color: rgba(255, 255, 255, 0.54);
        font-size: 12px;
        font-style: normal;
        line-height: 16px;
    }
}

.voice-card-mark {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.48);
    font-size: 18px;
    line-height: 1;
}

.voice-picker-card.is-active .voice-card-mark {
    color: rgba(255, 255, 255, 0.88);
}

.voice-picker-actions {
    display: flex;
    justify-content: flex-end;
    flex: 0 0 auto;
    padding: 12px 20px 20px;
}

.voice-picker-actions button {
    min-width: 82px;
    height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 999px;
    background: #fff;
    color: #111;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
}

@media (max-width: 960px) {
    .sub-picker-modal.is-library {
        width: calc(100vw - 36px);
        height: calc(100vh - 60px);
    }

    .library-picker-list {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 760px) {
    .sub-picker-modal.is-voice-picker,
    .sub-picker-modal.is-library {
        width: calc(100vw - 28px);
        height: calc(100vh - 60px);
    }

    .voice-picker-toolbar {
        align-items: flex-start;
        flex-direction: column;
        gap: 10px;
    }

    .voice-picker-filters {
        justify-content: flex-start;
        width: 100%;
    }

    .voice-filter {
        flex: 1 1 0;
    }

    .voice-filter-trigger {
        width: 100%;
        max-width: none;
    }

    .voice-filter-menu {
        right: auto;
        left: 0;
    }

    .voice-picker-list {
        grid-template-columns: 1fr;
    }

    .library-picker-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 520px) {
    .library-picker-list {
        grid-template-columns: 1fr;
    }
}

.picker-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 220px;
    overflow-y: auto;
    padding: 18px 20px 20px;
}

.picker-list button {
    min-height: 64px;
    gap: 12px;
    padding: 0 14px;
    text-align: left;
}

.picker-list button.is-active {
    box-shadow: inset 0 0 0 1px #fff;
}

.library-picker-list {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-content: flex-start;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    gap: 12px;
    margin: 16px 20px 0;
    padding: 0 4px 20px 0;
}

.library-picker-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 8px;
    background: #2a2b2d;
    color: #fff;
    cursor: pointer;
    text-align: left;
}

.library-picker-card:hover {
    border-color: rgba(255, 255, 255, 0.18);
    background: #303133;
}

.library-card-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1 / 1.26;
    overflow: hidden;
    background: #171719;
    color: rgba(255, 255, 255, 0.42);
    font-size: 13px;
}

.library-card-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.library-picker-card strong {
    display: block;
    overflow: hidden;
    padding: 10px 12px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.library-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    min-height: 260px;
    overflow-y: auto;
    padding: 18px 20px 20px;
}

.library-grid button {
    min-width: 0;
    overflow: hidden;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: #303133;
    color: #fff;
    cursor: pointer;
    text-align: left;
}

.library-grid img,
.library-grid button > span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1 / 1.24;
    background: #171719;
    color: rgba(255, 255, 255, 0.4);
    object-fit: cover;
}

.library-grid strong {
    display: block;
    overflow: hidden;
    padding: 10px;
    font-size: 13px;
    font-weight: 500;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.picker-empty {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 160px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 14px;
}

.hidden-file {
    display: none;
}

@media (max-width: 1500px) {
    .visual-canvas {
        padding-right: 32px;
        padding-left: 32px;
    }

    .scene-gallery {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 1180px) {
    .visual-creation-page {
        overflow-x: auto;
    }

    .visual-canvas {
        min-width: 1180px;
    }
}
</style>
