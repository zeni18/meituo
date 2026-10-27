<template>
    <div ref="pageScrollRef" class="short-drama-page" @scroll.passive="scheduleScrollEffects">
        <video
            :key="activeBackgroundVideoIndex"
            class="short-drama-page__media-bg is-active"
            :src="activeBackgroundImage"
            autoplay
            muted
            playsinline
            @ended="playNextBackgroundVideo"
        ></video>
        <div
            class="short-drama-page__mask"
            :style="{ opacity: scrollMaskTopOpacity }"
        ></div>
        <div class="short-drama-page__gradient-mask"></div>

        <button class="short-drama-back" type="button" @click="goBackHome">
            <GlassSurface class="short-drama-back__icon" v-bind="smallGlassProps">
                <img class="short-drama-icon short-drama-icon--back" :src="iconAssets.arrowRight" alt="" />
            </GlassSurface>
            <span>返回首页</span>
        </button>

        <ShortDramaCreditPill
            class="short-drama-home-credit"
            :points="userPoints"
            :action-text="userStore.isLogin ? '\u5f00\u901a\u4f1a\u5458' : '\u767b\u5f55'"
            :membership-enabled="membershipEnabled"
            @refresh="loadHomeData"
        />

        <ShortDramaSideNav active="home" />

        <main class="short-drama-content">
            <section class="short-drama-hero" aria-label="短剧创作">
                <h1>今天想拍点什么故事？</h1>

                <GlassSurface ref="composerRef" class="drama-composer" v-bind="glassComposerProps">
                    <textarea
                        ref="composerTextareaRef"
                        v-model.trim="prompt"
                        :maxlength="promptMaxLengthAttr"
                        placeholder="输入故事灵感，让 AI 为你生成短剧脚本"
                        @input="adjustComposerHeight"
                    ></textarea>

                    <div class="drama-composer__toolbar">
                        <div class="drama-composer__tools" aria-label="创作工具">
                            <button
                                v-for="tool in composerTools"
                                :key="tool.key"
                                :class="{
                                    'is-active': isComposerToolActive(tool.key, 'main'),
                                    'has-selected-style': tool.key === 'style' && selectedStyle
                                }"
                                type="button"
                                :aria-label="tool.label"
                                :title="tool.label"
                                @click.stop="handleComposerTool(tool.key, 'main')"
                            >
                                <template v-if="tool.key === 'style' && selectedStyle">
                                    <img class="drama-style-tool__avatar" :src="selectedStyle.image" :alt="selectedStyle.name" />
                                    <span>{{ selectedStyle.name }}</span>
                                    <i aria-label="清除画风" title="清除画风" @click.stop="clearSelectedStyle"><img :src="closeSmallIcon" alt="" /></i>
                                </template>
                                <img v-else class="short-drama-icon short-drama-icon--tool" :src="tool.icon" alt="" />
                            </button>
                        </div>

                        <label class="drama-multi">
                            <span>多集</span>
                            <input v-model="multiEpisode" type="checkbox" />
                            <span class="drama-multi__track">
                                <i></i>
                            </span>
                        </label>

                        <button
                            :class="['drama-submit', { 'has-prompt': prompt.trim() }]"
                            type="button"
                            aria-label="开始生成"
                            :disabled="submittingPlan"
                            @click="goScriptPlan"
                        >
                            <img class="short-drama-icon short-drama-icon--submit" :src="iconAssets.arrowUp" alt="" />
                        </button>
                    </div>

                    <transition name="tool-panel-fade">
                        <GlassSurface
                            v-if="isToolPanelOpen('model', 'main')"
                            class="drama-tool-panel drama-tool-panel--model"
                            v-bind="modelMenuGlassProps"
                        >
                            <div class="drama-model-menu">
                                <section
                                    v-for="group in enabledModelGroups"
                                    :key="group.key"
                                    class="drama-model-group"
                                >
                                    <p>{{ group.label }}</p>
                                    <template v-if="group.key === 'image'">
                                        <template v-if="imageNanoPickerStep === 'root'">
                                            <button
                                                v-for="model in imageNonNanoModels(group)"
                                                :key="`${group.key}-${model.id}`"
                                                :class="['drama-model-option', { 'is-active': isModelSelected(group.key, model) }]"
                                                type="button"
                                                @click.stop="selectModel(group.key, model)"
                                            >
                                                <img class="drama-model-option__image" :src="model.image" :alt="model.name" />
                                                <span><strong>{{ model.name }}</strong><small>{{ model.description }}</small></span>
                                                <i v-if="isModelSelected(group.key, model)">✓</i>
                                            </button>
                                            <button v-if="imageNanoModels(group).length" :class="['drama-model-option', { 'is-active': isImageNanoModelSelected(group) }]" type="button" @click.stop="selectImageNanoModel(group)">
                                                <img class="drama-model-option__image" :src="imageNanoModels(group)[0].image" alt="Nano Banana" />
                                                <span><strong>Nano Banana</strong></span>
                                                <i v-if="isImageNanoModelSelected(group)">✓</i>
                                            </button>
                                        </template>
                                        <template v-else-if="imageNanoPickerStep === 'series'">
                                            <button class="drama-model-back" type="button" @click.stop="imageNanoPickerStep = 'root'">‹ Nano Banana</button>
                                            <button v-for="series in imageNanoSeriesOptions(group)" :key="series.value" class="drama-model-option" type="button" @click.stop="selectImageNanoSeries(group, series.value)">
                                                <span><strong>{{ series.label }}</strong></span>
                                            </button>
                                        </template>
                                        <template v-else>
                                            <button class="drama-model-back" type="button" @click.stop="imageNanoPickerStep = imageNanoSeriesOptions(group).length > 1 ? 'series' : 'root'">‹ {{ imageNanoSeriesOptions(group).find((item) => item.value === activeImageNanoSeries)?.label || activeImageNanoSeries }}</button>
                                            <button v-for="model in imageNanoVariants(group)" :key="`${group.key}-nano-${model.id}`" :class="['drama-model-option', 'is-nano-variant', { 'is-active': isModelSelected(group.key, model) }]" type="button" @click.stop="selectImageNanoVariant(group.key, model)">
                                                <span><strong>{{ nanoVariantLabel(model) }}</strong></span>
                                                <i v-if="isModelSelected(group.key, model)">✓</i>
                                            </button>
                                        </template>
                                    </template>
                                    <template v-else>
                                    <button
                                        v-for="model in group.options"
                                        :key="`${group.key}-${model.id}`"
                                        :class="['drama-model-option', { 'is-active': isModelSelected(group.key, model) }]"
                                        type="button"
                                        @click.stop="selectModel(group.key, model)"
                                    >
                                        <img class="drama-model-option__image" :src="model.image" :alt="model.name" />
                                        <span>
                                            <strong>{{ model.name }}</strong>
                                            <small>{{ model.description }}</small>
                                        </span>
                                        <i v-if="isModelSelected(group.key, model)">✓</i>
                                    </button>
                                    </template>
                                </section>
                            </div>
                        </GlassSurface>
                    </transition>

                    <transition name="tool-panel-fade">
                        <GlassSurface
                            v-if="isToolPanelOpen('subject', 'main')"
                            class="drama-tool-panel drama-tool-panel--picker drama-tool-panel--subject"
                            v-bind="pickerPanelGlassProps"
                        >
                            <div class="drama-picker-panel">
                                <div class="drama-picker-panel__head">
                                    <div class="drama-picker-tabs" aria-label="主体来源">
                                        <button
                                            :class="{ 'is-active': activeSubjectSource === 'all' }"
                                            type="button"
                                            @click.stop="activeSubjectSource = 'all'"
                                        >
                                            全部
                                        </button>
                                        <button
                                            :class="{ 'is-active': activeSubjectSource === 'public' }"
                                            type="button"
                                            @click.stop="activeSubjectSource = 'public'"
                                        >
                                            官方
                                        </button>
                                        <button
                                            :class="{ 'is-active': activeSubjectSource === 'user' }"
                                            type="button"
                                            @click.stop="activeSubjectSource = 'user'"
                                        >
                                            我的
                                        </button>
                                    </div>
                                    <div class="drama-picker-category" aria-label="主体筛选">
                                        <button
                                            :class="['drama-picker-category__trigger', { 'is-open': subjectCategoryMenuOpen }]"
                                            type="button"
                                            @click.stop="toggleSubjectCategoryMenu"
                                        >
                                            <span>{{ activeSubjectCategoryLabel }}</span>
                                            <img :src="iconAssets.down" alt="" />
                                        </button>
                                        <div v-if="subjectCategoryMenuOpen" class="drama-picker-category__menu" @click.stop>
                                            <button
                                                v-for="category in subjectCategoryOptions"
                                                :key="category.value"
                                                :class="{ 'is-active': category.value === activeSubjectCategory }"
                                                type="button"
                                                @click.stop="selectSubjectCategory(category.value)"
                                            >
                                                {{ category.label }}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="drama-subject-grid">
                                    <button
                                        v-for="subject in displayedSubjectOptions"
                                        :key="subject.id"
                                        :class="['drama-subject-card', { 'is-create': subject.isCreate }]"
                                        type="button"
                                        @click.stop="selectSubject(subject, 'main')"
                                    >
                                        <template v-if="subject.isCreate">
                                            <span class="drama-subject-card__plus"><ElIcon><Plus /></ElIcon></span>
                                            <span>创建新主体</span>
                                        </template>
                                        <template v-else>
                                            <img :src="subject.image" :alt="subject.name" />
                                            <span>{{ subject.name }}</span>
                                        </template>
                                    </button>
                                </div>
                            </div>
                        </GlassSurface>
                    </transition>

                    <transition name="tool-panel-fade">
                        <GlassSurface
                            v-if="isToolPanelOpen('style', 'main')"
                            class="drama-tool-panel drama-tool-panel--picker drama-tool-panel--style"
                            v-bind="pickerPanelGlassProps"
                        >
                            <div class="drama-picker-panel">
                                <div class="drama-picker-panel__head">
                                    <strong>选择画风</strong>
                                </div>
                                <div class="drama-style-grid">
                                    <button
                                        v-for="style in styleOptions"
                                        :key="style.id"
                                        type="button"
                                        @click.stop="selectStyle(style)"
                                    >
                                        <img :src="style.image" :alt="style.name" />
                                        <em v-if="style.isNew">New</em>
                                        <span>{{ style.name }}</span>
                                    </button>
                                </div>
                            </div>
                        </GlassSurface>
                    </transition>
                </GlassSurface>

                <div class="model-chips" aria-label="模型选择">
                    <GlassSurface
                        v-for="model in modelChips"
                        :key="model.id"
                        tag="button"
                        class="model-chip"
                        v-bind="modelGlassProps"
                        type="button"
                        :title="`使用「${model.name}」故事灵感`"
                        @click="applyModelChipPrompt(model)"
                    >
                        <img :src="figmaAssets.avatar" alt="" />
                        <span>{{ model.name }}</span>
                    </GlassSurface>
                </div>
            </section>

            <section ref="recentSectionRef" class="short-drama-section recent-section" aria-label="最近项目">
                <div class="section-heading">
                    <h2>最近项目</h2>
                    <button type="button" @click="openProjectLibrary">查看全部</button>
                </div>
                <div class="project-grid">
                    <button class="project-card project-card--new" type="button" @click="startNewProject">
                        <span class="project-card__plus"><ElIcon><Plus /></ElIcon></span>
                        <span>新建项目</span>
                    </button>
                    <article
                        v-for="project in recentProjects"
                        :key="project.id"
                        class="project-card project-card--item"
                        :class="{ 'is-opening': openingProjectId === project.id }"
                        role="button"
                        tabindex="0"
                        @click="openProject(project)"
                        @keydown.enter.prevent="openProject(project)"
                    >
                        <img v-if="project.image" :src="project.image" :alt="project.title" />
                        <div v-else class="project-card__empty-cover"></div>
                        <button
                            class="project-card__more"
                            type="button"
                            :aria-expanded="activeProjectMenuId === project.id"
                            aria-label="项目操作"
                            @click.stop="toggleProjectMenu(project.id)"
                        >
                            <ElIcon><MoreFilled /></ElIcon>
                        </button>
                        <div v-if="activeProjectMenuId === project.id" class="project-card__menu" @click.stop>
                            <button type="button" @click="openCoverPicker(project)">
                                <ElIcon><Picture /></ElIcon>
                                <span>修改封面</span>
                            </button>
                            <button type="button" @click="renameProjectCard(project)">
                                <ElIcon><Edit /></ElIcon>
                                <span>重命名</span>
                            </button>
                            <button type="button" class="is-danger" @click="deleteProjectCard(project)">
                                <ElIcon><Delete /></ElIcon>
                                <span>删除</span>
                            </button>
                        </div>
                        <footer>
                            <span>{{ project.title }}</span>
                        </footer>
                    </article>
                </div>
            </section>

            <section class="short-drama-section inspiration-section" aria-label="灵感广场">
                <div class="section-heading">
                    <h2>灵感广场</h2>
                </div>
                <div class="inspiration-grid">
                    <button
                        v-for="item in inspirationTiles"
                        :key="item.id"
                        class="inspiration-tile"
                        type="button"
                        @pointerenter="playInspirationPreview"
                        @pointerleave="pauseInspirationPreview"
                        @click="openInspirationDetail(item, $event)"
                    >
                        <video
                            :src="item.video"
                            muted
                            playsinline
                            preload="auto"
                            @loadedmetadata="primeInspirationPreview"
                        ></video>
                    </button>
                </div>
            </section>
        </main>


        <Teleport to="body">
            <transition name="project-cover-fade">
                <div v-if="coverDialogVisible" class="project-cover-picker" @click.self="closeCoverPicker">
                    <div class="project-cover-picker__panel" role="dialog" aria-modal="true" aria-label="选择封面">
                        <header class="project-cover-picker__header">
                            <h3>选择封面</h3>
                            <button type="button" aria-label="关闭" @click="closeCoverPicker">
                                <ElIcon><Close /></ElIcon>
                            </button>
                        </header>
                        <div v-if="loadingCoverOptions" class="project-cover-picker__state">加载中...</div>
                        <div v-else-if="coverOptions.length" class="project-cover-picker__grid">
                            <button
                                v-for="option in coverOptions"
                                :key="option.id"
                                class="project-cover-option"
                                :class="{ 'is-selected': selectedCoverAssetId === option.id }"
                                type="button"
                                @click="selectedCoverAssetId = option.id"
                            >
                                <img :src="option.url || option.cover_url" :alt="option.title || '分镜封面'" />
                                <span class="project-cover-option__radio">
                                    <ElIcon v-if="selectedCoverAssetId === option.id"><Check /></ElIcon>
                                </span>
                            </button>
                        </div>
                        <div v-else class="project-cover-picker__state">
                            暂无可选分镜图，请先生成分镜图后再修改封面。
                        </div>
                        <footer class="project-cover-picker__footer">
                            <button type="button" @click="closeCoverPicker">取消</button>
                            <button
                                type="button"
                                class="is-primary"
                                :disabled="!selectedCoverAssetId || savingCover"
                                @click="saveCoverPicker"
                            >
                                {{ savingCover ? '保存中' : '选择' }}
                            </button>
                        </footer>
                    </div>
                </div>
            </transition>
        </Teleport>

        <transition name="floating-drama-fade">
            <GlassSurface
                v-if="showFloatingComposer"
                :class="['drama-floating-composer', { 'is-expanded': floatingComposerExpanded }]"
                v-bind="floatingGlassProps"
                @click="expandFloatingComposer"
            >
                <div class="drama-floating-composer__inner">
                    <textarea
                        ref="floatingTextareaRef"
                        v-model.trim="prompt"
                        :maxlength="promptMaxLengthAttr"
                        placeholder="输入故事灵感，让 AI 为你生成短剧脚本"
                    ></textarea>

                    <div class="drama-composer__toolbar drama-floating-composer__toolbar">
                        <div class="drama-composer__tools" aria-label="创作工具">
                            <button
                                v-for="tool in composerTools"
                                :key="tool.key"
                                :class="{
                                    'is-active': isComposerToolActive(tool.key, 'floating'),
                                    'has-selected-style': tool.key === 'style' && selectedStyle
                                }"
                                type="button"
                                :aria-label="tool.label"
                                :title="tool.label"
                                @click.stop="handleComposerTool(tool.key, 'floating')"
                            >
                                <template v-if="tool.key === 'style' && selectedStyle">
                                    <img class="drama-style-tool__avatar" :src="selectedStyle.image" :alt="selectedStyle.name" />
                                    <span>{{ selectedStyle.name }}</span>
                                    <i aria-label="清除画风" title="清除画风" @click.stop="clearSelectedStyle"><img :src="closeSmallIcon" alt="" /></i>
                                </template>
                                <img v-else class="short-drama-icon short-drama-icon--tool" :src="tool.icon" alt="" />
                            </button>
                        </div>

                        <label class="drama-multi">
                            <span>多集</span>
                            <input v-model="multiEpisode" type="checkbox" />
                            <span class="drama-multi__track">
                                <i></i>
                            </span>
                        </label>

                        <button
                            :class="['drama-submit', 'drama-floating-composer__submit', { 'has-prompt': prompt.trim() }]"
                            type="button"
                            aria-label="开始生成"
                            :disabled="submittingPlan"
                            @click.stop="goScriptPlan"
                        >
                            <img class="short-drama-icon short-drama-icon--submit" :src="iconAssets.arrowUp" alt="" />
                        </button>
                    </div>

                    <transition name="tool-panel-fade">
                        <GlassSurface
                            v-if="isToolPanelOpen('model', 'floating')"
                            class="drama-tool-panel drama-tool-panel--model is-floating"
                            v-bind="modelMenuGlassProps"
                        >
                            <div class="drama-model-menu">
                                <section
                                    v-for="group in enabledModelGroups"
                                    :key="group.key"
                                    class="drama-model-group"
                                >
                                    <p>{{ group.label }}</p>
                                    <template v-if="group.key === 'image'">
                                        <template v-if="imageNanoPickerStep === 'root'">
                                            <button v-for="model in imageNonNanoModels(group)" :key="`${group.key}-${model.id}`" :class="['drama-model-option', { 'is-active': isModelSelected(group.key, model) }]" type="button" @click.stop="selectModel(group.key, model)">
                                                <img class="drama-model-option__image" :src="model.image" :alt="model.name" />
                                                <span><strong>{{ model.name }}</strong><small>{{ model.description }}</small></span>
                                                <i v-if="isModelSelected(group.key, model)">✓</i>
                                            </button>
                                            <button v-if="imageNanoModels(group).length" :class="['drama-model-option', { 'is-active': isImageNanoModelSelected(group) }]" type="button" @click.stop="selectImageNanoModel(group)">
                                                <img class="drama-model-option__image" :src="imageNanoModels(group)[0].image" alt="Nano Banana" />
                                                <span><strong>Nano Banana</strong></span>
                                                <i v-if="isImageNanoModelSelected(group)">✓</i>
                                            </button>
                                        </template>
                                        <template v-else-if="imageNanoPickerStep === 'series'">
                                            <button class="drama-model-back" type="button" @click.stop="imageNanoPickerStep = 'root'">‹ Nano Banana</button>
                                            <button v-for="series in imageNanoSeriesOptions(group)" :key="series.value" class="drama-model-option" type="button" @click.stop="selectImageNanoSeries(group, series.value)"><span><strong>{{ series.label }}</strong></span></button>
                                        </template>
                                        <template v-else>
                                            <button class="drama-model-back" type="button" @click.stop="imageNanoPickerStep = imageNanoSeriesOptions(group).length > 1 ? 'series' : 'root'">‹ {{ imageNanoSeriesOptions(group).find((item) => item.value === activeImageNanoSeries)?.label || activeImageNanoSeries }}</button>
                                            <button v-for="model in imageNanoVariants(group)" :key="`${group.key}-nano-${model.id}`" :class="['drama-model-option', 'is-nano-variant', { 'is-active': isModelSelected(group.key, model) }]" type="button" @click.stop="selectImageNanoVariant(group.key, model)">
                                                <span><strong>{{ nanoVariantLabel(model) }}</strong></span>
                                                <i v-if="isModelSelected(group.key, model)">✓</i>
                                            </button>
                                        </template>
                                    </template>
                                    <template v-else>
                                    <button
                                        v-for="model in group.options"
                                        :key="`${group.key}-${model.id}`"
                                        :class="['drama-model-option', { 'is-active': isModelSelected(group.key, model) }]"
                                        type="button"
                                        @click.stop="selectModel(group.key, model)"
                                    >
                                        <img class="drama-model-option__image" :src="model.image" :alt="model.name" />
                                        <span><strong>{{ model.name }}</strong><small>{{ model.description }}</small></span>
                                        <i v-if="isModelSelected(group.key, model)">✓</i>
                                    </button>
                                    </template>
                                </section>
                            </div>
                        </GlassSurface>
                    </transition>

                    <transition name="tool-panel-fade">
                        <GlassSurface
                            v-if="isToolPanelOpen('subject', 'floating')"
                            class="drama-tool-panel drama-tool-panel--picker drama-tool-panel--subject is-floating"
                            v-bind="pickerPanelGlassProps"
                        >
                            <div class="drama-picker-panel">
                                <div class="drama-picker-panel__head">
                                    <div class="drama-picker-tabs" aria-label="主体来源">
                                        <button type="button" @click.stop="activeSubjectSource = 'all'">
                                            全部
                                        </button>
                                        <button type="button" @click.stop="activeSubjectSource = 'public'">
                                            官方
                                        </button>
                                        <button type="button" @click.stop="activeSubjectSource = 'user'">
                                            我的
                                        </button>
                                    </div>
                                    <div class="drama-picker-category" aria-label="主体筛选">
                                        <button
                                            :class="['drama-picker-category__trigger', { 'is-open': subjectCategoryMenuOpen }]"
                                            type="button"
                                            @click.stop="toggleSubjectCategoryMenu"
                                        >
                                            <span>{{ activeSubjectCategoryLabel }}</span>
                                            <img :src="iconAssets.down" alt="" />
                                        </button>
                                        <div v-if="subjectCategoryMenuOpen" class="drama-picker-category__menu" @click.stop>
                                            <button
                                                v-for="category in subjectCategoryOptions"
                                                :key="category.value"
                                                :class="{ 'is-active': category.value === activeSubjectCategory }"
                                                type="button"
                                                @click.stop="selectSubjectCategory(category.value)"
                                            >
                                                {{ category.label }}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="drama-subject-grid">
                                    <button
                                        v-for="subject in displayedSubjectOptions"
                                        :key="subject.id"
                                        :class="['drama-subject-card', { 'is-create': subject.isCreate }]"
                                        type="button"
                                        @click.stop="selectSubject(subject, 'floating')"
                                    >
                                        <template v-if="subject.isCreate">
                                            <span class="drama-subject-card__plus"><ElIcon><Plus /></ElIcon></span>
                                            <span>创建新主体</span>
                                        </template>
                                        <template v-else>
                                            <img :src="subject.image" :alt="subject.name" />
                                            <span>{{ subject.name }}</span>
                                        </template>
                                    </button>
                                </div>
                            </div>
                        </GlassSurface>
                    </transition>

                    <transition name="tool-panel-fade">
                        <GlassSurface
                            v-if="isToolPanelOpen('style', 'floating')"
                            class="drama-tool-panel drama-tool-panel--picker drama-tool-panel--style is-floating"
                            v-bind="pickerPanelGlassProps"
                        >
                            <div class="drama-picker-panel">
                                <div class="drama-picker-panel__head">
                                    <strong>选择画风</strong>
                                </div>
                                <div class="drama-style-grid">
                                    <button
                                        v-for="style in styleOptions"
                                        :key="style.id"
                                        type="button"
                                        @click.stop="selectStyle(style)"
                                    >
                                        <img :src="style.image" :alt="style.name" />
                                        <em v-if="style.isNew">New</em>
                                        <span>{{ style.name }}</span>
                                    </button>
                                </div>
                            </div>
                        </GlassSurface>
                    </transition>
                </div>
            </GlassSurface>
        </transition>

        <Teleport to="body">
            <transition name="detail-fade">
                <div
                    v-if="activeInspirationDetail"
                    class="short-drama-work-detail"
                    @click.self="closeInspirationDetail"
                >
                    <div class="short-drama-work-detail__panel">
                        <div class="short-drama-work-detail__media">
                            <PcCloseButton
                                class="short-drama-work-detail__close"
                                aria-label="关闭"
                                @click="closeInspirationDetail"
                            />
                            <div class="short-drama-work-detail__media-frame">
                                <video
                                    ref="detailVideoRef"
                                    :src="activeInspirationDetail.video"
                                    autoplay
                                    controls
                                    muted
                                    playsinline
                                    @canplay="playDetailVideo"
                                ></video>
                            </div>
                        </div>

                        <div class="short-drama-work-detail__content">
                            <div class="short-drama-work-detail__header">
                                <div class="short-drama-work-detail__author-row">
                                    <div class="short-drama-work-detail__author">
                                        <span class="short-drama-work-detail__avatar">
                                            <img :src="figmaAssets.avatar" :alt="activeInspirationDetail.author" />
                                        </span>
                                        <strong>{{ activeInspirationDetail.author }}</strong>
                                    </div>
                                </div>

                                <div class="short-drama-work-detail__subline">
                                    <span>{{ activeInspirationDetail.date }}</span>
                                    <span>由 AI 生成</span>
                                </div>
                            </div>

                            <div class="short-drama-work-detail__prompt">
                                <div class="short-drama-work-detail__prompt-head">
                                    <span>灵感提示词</span>
                                </div>
                                <div class="short-drama-work-detail__prompt-body">
                                    <p>{{ activeInspirationVisiblePrompt }}</p>
                                </div>
                                <div class="short-drama-work-detail__config">
                                    <span
                                        v-for="field in activeInspirationDetail.config"
                                        :key="field"
                                        class="short-drama-work-detail__config-text"
                                    >
                                        {{ field }}
                                    </span>
                                </div>
                            </div>

                            <div class="short-drama-work-detail__footer">
                                <button type="button" @click="generateSameInspiration">生成同款</button>
                            </div>
                        </div>
                    </div>
                </div>
            </transition>
        </Teleport>
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
    Check,
    Close,
    Delete,
    Edit,
    MoreFilled,
    Picture,
    Plus
} from '@element-plus/icons-vue'
import {
    createShortDramaScriptPlan,
    deleteShortDramaProject,
    getShortDramaHome,
    getShortDramaInspirationDetail,
    getShortDramaProjectCoverOptions,
    getShortDramaProjectDetail,
    getShortDramaProjects,
    renameShortDramaProject,
    updateShortDramaProjectCover
} from '@/api/short_drama'
import feedback from '@/utils/feedback'
import { cleanUserVisiblePrompt } from '@/utils/short-drama-prompt'
import closeSmallIcon from '@/assets/images/icon/Close-small.svg'
import GlassSurface from '~/components/ai-workspace/GlassSurface.vue'
import PcCloseButton from '~/components/pc-close-button.vue'
import { isPcLoginRequiredError, usePcLoginGate } from '@/composables/usePcLoginGate'
import ShortDramaCreditPill from '~/components/short-drama/ShortDramaCreditPill.vue'
import ShortDramaSideNav from '~/components/short-drama/ShortDramaSideNav.vue'
import { useUserStore } from '@/stores/user'

definePageMeta({ layout: 'blank' })

type ComposerSource = 'main' | 'floating'
type ComposerToolKey = 'attach' | 'model' | 'role' | 'style'
type ToolPanelKind = 'model' | 'subject' | 'style'
type NanoPickerStep = 'root' | 'series' | 'variant'
type ModelOption = {
    id: string
    name: string
    description: string
    image: string
    value?: string
    app_code?: string
    type?: string
    model_code?: string
    channel_code?: string
    provider_model?: string
    display_group?: string
    display_series?: string
    display_series_label?: string
    display_variant_label?: string
    billing_unit?: string
    platform_unit_cost?: string | number
    tenant_unit_price?: string | number
    badge?: string
    enabled?: boolean
    sort?: number
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
    source?: string
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
type InspirationTile = {
    id: string
    title: string
    video: string
    prompt: string
    author: string
    date: string
    config: string[]
    multiEpisode?: boolean
    modelId?: string
    styleId?: string
}
type ProjectCard = {
    id: string | number
    title: string
    image: string
    status?: string
    taskId?: string
    coverAssetId?: string | number
}
type ProjectCoverOption = {
    id: string | number
    title: string
    url: string
    cover_url?: string
    selected?: boolean
    shot_title?: string
    shot_sort?: number
}

const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const { ensurePcLogin } = usePcLoginGate()
const userStore = useUserStore()
const prompt = ref('')
const promptMaxLength = ref(20000)
const multiEpisode = ref(false)
const openToolPanel = ref<{ source: ComposerSource; kind: ToolPanelKind } | null>(null)
const activeBackgroundVideoIndex = ref(0)
const composerRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const recentSectionRef = ref<HTMLElement | null>(null)
const composerTextareaRef = ref<HTMLTextAreaElement | null>(null)
const floatingTextareaRef = ref<HTMLTextAreaElement | null>(null)
const detailVideoRef = ref<HTMLVideoElement | null>(null)
const activeInspirationDetail = ref<InspirationTile | null>(null)
const scrollMaskTopOpacity = ref(0.2)
const showFloatingComposer = ref(false)
const floatingComposerExpanded = ref(false)
const isUserAuthenticated = ref(false)
const loadingHome = ref(false)
const loadingProjects = ref(false)
const submittingPlan = ref(false)
const openingProjectId = ref<string | number | null>(null)
const activeProjectMenuId = ref<string | number | null>(null)
const coverDialogVisible = ref(false)
const coverDialogProject = ref<ProjectCard | null>(null)
const coverOptions = ref<ProjectCoverOption[]>([])
const selectedCoverAssetId = ref<string | number | null>(null)
const loadingCoverOptions = ref(false)
const savingCover = ref(false)
const userPoints = ref(0)
const membershipEnabled = ref(false)
const pageScrollRef = ref<HTMLElement | null>(null)
let previousPcMinWidth = ''
let scrollRafId: number | null = null
let composerHeightRafId: number | null = null

const withPublicBase = (path: string) => {
    const baseURL = String(runtimeConfig.app?.baseURL || '/')
    const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
    return `${normalizedBase}/${path.replace(/^\/+/, '')}` || '/'
}
const asset = (name: string) => withPublicBase(`/short-drama/figma/${name}.png`)
const iconAsset = (name: string) => withPublicBase(`/short-drama/figma/icon/${name}.svg`)
const sharedDramaImage = asset('c043b523b8dbf7fb1bb877caef75c7ce0d4f1e06')
const figmaAssets = {
    avatar: sharedDramaImage
}
const iconAssets = {
    arrowRight: iconAsset('Arrow-right'),
    arrowUp: iconAsset('Arrow-up'),
    down: iconAsset('Down'),
    file: iconAsset('wenjian'),
    model: iconAsset('moxing'),
    roleTool: iconAsset('juese'),
    style: iconAsset('fengge')
}
const composerTools = [
    { key: 'attach' as const, label: '附件', icon: iconAssets.file },
    { key: 'model' as const, label: '模型', icon: iconAssets.model },
    { key: 'role' as const, label: '主体', icon: iconAssets.roleTool },
    { key: 'style' as const, label: '画风', icon: iconAssets.style }
]
const fallbackModelOptions: ModelOption[] = [
    { id: 'g2', name: '剧本 G2', description: '适合短剧结构规划和分镜拆解' },
    { id: 'nb-pro', name: '剧本 NB Pro', description: '适合复杂剧情、悬疑反转和多场景故事' },
    { id: 'v8', name: '文本 V8.1', description: '响应稳定，适合日常剧本创作' },
    { id: 'v7', name: '文本 V7', description: '适合轻量脚本和口播内容' },
    { id: 'niji', name: '文本 Niji7', description: '适合更强风格化表达' }
].map(model => ({ ...model, image: sharedDramaImage }))
const creationModelGroupKeys = new Set(['script_plan', 'image'])
const creationFallbackModelOptions: ModelOption[] = [
    {
        id: 'image-model-default',
        name: '主体/场景生成模型',
        description: '用于生成主体图、场景图和分镜图',
        image: sharedDramaImage
    }
]
const fallbackModelGroups: ModelGroup[] = [
    {
        key: 'script_plan',
        label: '剧本策划模型',
        app_code: 'aigc_llm',
        type: 'llm',
        options: fallbackModelOptions
    },
    {
        key: 'image',
        label: '主体/场景生成模型',
        app_code: 'aigc_image',
        type: 'image',
        options: creationFallbackModelOptions
    }
]
const modelGroups = ref<ModelGroup[]>(fallbackModelGroups)
const modelOptions = ref<ModelOption[]>(creationFallbackModelOptions)
const selectedModel = ref<ModelOption>(creationFallbackModelOptions[0])
const selectedModelMap = ref<Record<string, ModelOption>>({
    script_plan: fallbackModelOptions[0],
    image: creationFallbackModelOptions[0]
})
const imageNanoPickerStep = ref<NanoPickerStep>('root')
const imageNanoPickerSeries = ref('')
const selectedStyle = ref<StyleOption | null>(null)
const activeSubjectSource = ref<'all' | 'public' | 'user'>('all')
const activeSubjectCategory = ref('all')
const subjectCategoryMenuOpen = ref(false)
const fallbackSubjectOptions: SubjectOption[] = [
    { id: 'create', name: '创建新主体', image: sharedDramaImage, isCreate: true }
]
const subjectOptions = ref<SubjectOption[]>(fallbackSubjectOptions)
const legacyBuiltinSubjectNames = new Set(['清冷师妹', '赛艇少年'])
const subjectCategoryLabels: Record<string, string> = {
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
const subjectCategoryValue = (category?: string) => String(category || '').trim()
const subjectCategoryLabel = (category: string) => subjectCategoryLabels[category] || category || '未分类'
const shouldHideSubjectOption = (subject: SubjectOption) => legacyBuiltinSubjectNames.has(String(subject.name || '').trim())
const sourceFilteredSubjectOptions = computed(() =>
    subjectOptions.value.filter((subject) => {
        if (subject.isCreate) return false
        if (shouldHideSubjectOption(subject)) return false
        if (activeSubjectSource.value === 'all') return true
        return subject.source === activeSubjectSource.value
    })
)
const subjectCategoryOptions = computed<SubjectCategoryOption[]>(() => {
    const options: SubjectCategoryOption[] = [{ value: 'all', label: '全部' }]
    const seen = new Set<string>()
    sourceFilteredSubjectOptions.value.forEach((subject) => {
        const value = subjectCategoryValue(subject.category)
        if (!value || seen.has(value)) return
        seen.add(value)
        options.push({ value, label: subjectCategoryLabel(value) })
    })
    return options
})
const activeSubjectCategoryLabel = computed(() =>
    subjectCategoryOptions.value.find((option) => option.value === activeSubjectCategory.value)?.label || '全部'
)
const displayedSubjectOptions = computed(() => {
    const createItems = activeSubjectSource.value === 'public'
        ? []
        : subjectOptions.value.filter((subject) => subject.isCreate)
    const subjects = sourceFilteredSubjectOptions.value.filter((subject) => {
        if (activeSubjectCategory.value === 'all') return true
        return subjectCategoryValue(subject.category) === activeSubjectCategory.value
    })
    return [...createItems, ...subjects]
})
const toggleSubjectCategoryMenu = () => {
    subjectCategoryMenuOpen.value = !subjectCategoryMenuOpen.value
}
const selectSubjectCategory = (value: string) => {
    activeSubjectCategory.value = value
    subjectCategoryMenuOpen.value = false
}
const fallbackStyleOptions: StyleOption[] = [
    { id: 'dunhuang', name: '敦煌壁画', image: sharedDramaImage, isNew: true },
    { id: 'wuxia', name: '国风武侠', image: sharedDramaImage, isNew: true },
    { id: 'modern-3d', name: '3D 写实', image: sharedDramaImage, isNew: true },
    { id: 'manga', name: '日漫风格', image: sharedDramaImage, isNew: true },
    { id: 'film', name: '电影质感', image: sharedDramaImage },
    { id: 'sunny', name: '清新明亮', image: sharedDramaImage },
    { id: 'clean', name: '干净写实', image: sharedDramaImage },
    { id: 'chinese', name: '新中式', image: sharedDramaImage },
    { id: 'japan', name: '日系治愈', image: sharedDramaImage },
    { id: 'korea', name: '韩剧质感', image: sharedDramaImage },
    { id: 'fantasy', name: '奇幻梦境', image: sharedDramaImage },
    { id: 'ink', name: '水墨国风', image: sharedDramaImage }
]
const styleOptions = ref<StyleOption[]>(fallbackStyleOptions)
const fallbackBackgroundVideos = [
    'https://aigclikeadmin.oss-cn-shenzhen.aliyuncs.com/uploads/video/20260702/20260702030949da9924540.mp4',
    'https://aigclikeadmin.oss-cn-shenzhen.aliyuncs.com/uploads/video/20260601/20260601112012e02b49571.mov'
]
const modelChips = [
    {
        id: 'mystery-rain',
        name: '雨夜疑云',
        prompt: '暴雨夜，一名年轻女记者回到废弃老宅调查十年前的失踪案，却发现每一次闪电都会映出不同的真相。她必须在天亮前找出真正的凶手，否则下一个消失的人就是她自己。'
    },
    {
        id: 'revenge-city',
        name: '逆袭归来',
        prompt: '被家族抛弃的落魄青年三年后以新身份回到城市，在商业晚宴上与昔日背叛者重逢。他表面隐忍克制，暗中一步步夺回事业、亲情和尊严，最终让所有人看清真相。'
    },
    {
        id: 'romance-contract',
        name: '契约心动',
        prompt: '独立设计师为救工作室，和冷面投资人签下一份假扮情侣的契约。两人在一次次公开场合互相拆台又互相救场，假关系逐渐变成真心动，却被一场旧误会推向分离。'
    },
    {
        id: 'fantasy-door',
        name: '异界来客',
        prompt: '普通便利店店员深夜关门时，货架尽头突然出现一扇发光的门。来自异界的少年带着追兵闯入现实世界，两人被迫合作，在城市街巷中寻找关闭裂缝的方法。'
    }
]
const backgroundVideos = ref<string[]>(fallbackBackgroundVideos)
const recentProjectLimit = 4
const recentProjects = ref<ProjectCard[]>([])
const projectCards = ref<ProjectCard[]>([])
const fallbackInspirationTiles: InspirationTile[] = Array.from({ length: 15 }, (_, index) => ({
    id: `tile-${String(index + 1).padStart(2, '0')}`,
    title: `灵感短剧 ${index + 1}`,
    video: fallbackBackgroundVideos[index % fallbackBackgroundVideos.length],
    prompt: '一个普通人在一次意外后发现隐藏真相，并在反转中完成自我救赎。',
    author: '官方灵感',
    date: '2026-07-02',
    config: ['短剧', '多分镜']
}))
const inspirationTiles = ref<InspirationTile[]>(fallbackInspirationTiles)
const activeBackgroundImage = computed(() => backgroundVideos.value[activeBackgroundVideoIndex.value] || backgroundVideos.value[0])
const promptMaxLengthAttr = computed(() => promptMaxLength.value > 0 ? promptMaxLength.value : undefined)
const activeInspirationVisiblePrompt = computed(() => cleanUserVisiblePrompt(activeInspirationDetail.value?.prompt || ''))

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
const glassComposerProps = {
    width: '100%',
    height: 'auto',
    borderRadius: 20,
    ...glassSurfaceConfig
} as const
const smallGlassProps = {
    width: 20,
    height: 20,
    borderRadius: 20,
    ...glassSurfaceConfig
} as const
const modelGlassProps = {
    width: 144,
    height: 46,
    borderRadius: 55,
    ...glassSurfaceConfig
} as const
const floatingGlassProps = {
    width: 'min(860px, calc(100vw - 36px))',
    height: 187,
    borderRadius: 20,
    ...glassSurfaceConfig
} as const
const modelMenuGlassProps = {
    width: 282,
    height: 'auto',
    borderRadius: 20,
    ...glassSurfaceConfig
} as const
const pickerPanelGlassProps = {
    width: 'min(860px, calc(100vw - 120px))',
    height: 476,
    borderRadius: 20,
    ...glassSurfaceConfig
} as const

const goBackHome = () => router.push('/ai')
const getRequestErrorMessage = (error: any, fallback: string) => {
    if (typeof error === 'string') return error
    return error?.msg || error?.message || fallback
}
const syncLoginStateFromTokenCookie = () => {
    userStore.restoreToken()
    isUserAuthenticated.value = userStore.isLogin
}
const hasUserToken = () => {
    syncLoginStateFromTokenCookie()
    return userStore.isLogin
}
const handleCreditAction = () => {
    if (!hasUserToken()) {
        ensurePcLogin({
            redirect: '/ai/short-drama',
            returnTo: '/ai/short-drama'
        })
    }
}
const openProjectLibrary = () => {
    if (!ensurePcLogin({
        redirect: '/ai/short-drama/projects',
        returnTo: '/ai/short-drama/projects'
    })) return
    router.push('/ai/short-drama/projects')
}
const startNewProject = () => {
    if (!ensurePcLogin({
        redirect: '/ai/short-drama/plan?mode=create',
        returnTo: '/ai/short-drama/plan?mode=create'
    })) return
    router.push({
        path: '/ai/short-drama/plan',
        query: { mode: 'create' }
    })
}
const goScriptPlan = async () => {
    const content = prompt.value.trim()
    if (!content) {
        feedback.msgWarning('请输入故事灵感')
        return
    }
    if (promptMaxLength.value > 0 && content.length > promptMaxLength.value) {
        feedback.msgWarning(`故事灵感不能超过 ${promptMaxLength.value} 字`)
        return
    }
    if (!ensurePcLogin({
        redirect: '/ai/short-drama',
        returnTo: '/ai/short-drama'
    })) return
    if (submittingPlan.value) return
    submittingPlan.value = true
    try {
        const result = await createShortDramaScriptPlan({
            prompt: content,
            multi_episode: multiEpisode.value,
            image_model_id: selectedModel.value.id,
            model_selections: selectedModelPayload.value,
            style_id: selectedStyle.value?.id || '',
            subject_ids: [],
            subject_mentions: extractSubjectMentions(content),
            source: 'home',
            inspiration_id: activeInspirationDetail.value?.id || null
        })
        const redirectUrl = result?.redirect_url || `/ai/short-drama/plan?project_id=${result?.project_id || ''}&task_id=${result?.task_id || ''}`
        await router.push(redirectUrl)
    } catch (error: any) {
        if (isPcLoginRequiredError(error)) return
        feedback.msgError(getRequestErrorMessage(error, '剧本任务创建失败'))
    } finally {
        submittingPlan.value = false
    }
}
const playNextBackgroundVideo = () => {
    activeBackgroundVideoIndex.value = (activeBackgroundVideoIndex.value + 1) % Math.max(1, backgroundVideos.value.length)
}
const closeToolPanel = () => {
    openToolPanel.value = null
}
const closeComposerPanels = () => {
    closeToolPanel()
    subjectCategoryMenuOpen.value = false
}
const isToolPanelOpen = (kind: ToolPanelKind, source: ComposerSource) => {
    return openToolPanel.value?.kind === kind && openToolPanel.value.source === source
}
const getComposerToolPanelKind = (key: ComposerToolKey): ToolPanelKind | null => {
    if (key === 'model') return 'model'
    if (key === 'role') return 'subject'
    if (key === 'style') return 'style'
    return null
}
const isComposerToolActive = (key: ComposerToolKey, source: ComposerSource) => {
    const kind = getComposerToolPanelKind(key)
    return kind ? isToolPanelOpen(kind, source) : false
}
const toggleToolPanel = (kind: ToolPanelKind, source: ComposerSource) => {
    openToolPanel.value = isToolPanelOpen(kind, source) ? null : { kind, source }
}
const handleComposerTool = (key: ComposerToolKey, source: ComposerSource) => {
    if (key === 'attach') return
    if (key === 'model') {
        if (!isToolPanelOpen('model', source)) imageNanoPickerStep.value = 'root'
        toggleToolPanel('model', source)
        return
    }
    if (key === 'role') {
        toggleToolPanel('subject', source)
        return
    }
    toggleToolPanel('style', source)
}
const enabledModelGroups = computed(() =>
    modelGroups.value
        .filter((group) => creationModelGroupKeys.has(group.key))
        .map((group) => ({
            ...group,
            options: (group.options || []).filter((model) => model.enabled !== false)
        }))
        .filter((group) => group.options.length)
)
const ensureSelectedModels = () => {
    const next = { ...selectedModelMap.value }
    enabledModelGroups.value.forEach((group) => {
        const current = next[group.key]
        const matched = current
            ? group.options.find((model) => model.id === current.id || model.value === current.value)
            : null
        next[group.key] = matched || group.options.find((model) => model.id === group.default) || group.options[0]
    })
    selectedModelMap.value = next
    selectedModel.value = next.image || enabledModelGroups.value[0]?.options[0] || creationFallbackModelOptions[0]
}
const isModelSelected = (groupKey: string, model: ModelOption) => {
    const selected = selectedModelMap.value[groupKey]
    return Boolean(selected && (selected.id === model.id || selected.value === model.value))
}
const isNanoBananaModel = (model: ModelOption) => model.display_group === 'nano_banana' || String(model.value || model.id).startsWith('market_nano_banana:')
const nanoSeriesValue = (model?: ModelOption) => model?.display_series || (String(model?.model_code || '').includes(':official') ? 'official' : 'common')
const nanoSeriesLabel = (model?: ModelOption) => model?.display_series_label || (nanoSeriesValue(model) === 'official' ? '官方' : '常规')
const nanoVariantLabel = (model: ModelOption) => model.display_variant_label || model.name
const imageNanoModels = (group: ModelGroup) => group.options.filter(isNanoBananaModel)
const imageNonNanoModels = (group: ModelGroup) => group.options.filter((model) => !isNanoBananaModel(model))
const isImageNanoModelSelected = (group: ModelGroup) => {
    const selected = selectedModelMap.value[group.key]
    return Boolean(selected && isNanoBananaModel(selected))
}
const activeImageNanoSeries = computed(() => {
    const selected = selectedModelMap.value.image
    return imageNanoPickerSeries.value || nanoSeriesValue(selected && isNanoBananaModel(selected) ? selected : imageNanoModels(enabledModelGroups.value.find((group) => group.key === 'image') || fallbackModelGroups[0])[0])
})
const imageNanoSeriesOptions = (group: ModelGroup) => {
    const values = new Map<string, string>()
    imageNanoModels(group).forEach((model) => values.set(nanoSeriesValue(model), nanoSeriesLabel(model)))
    return Array.from(values, ([value, label]) => ({ value, label }))
}
const imageNanoVariants = (group: ModelGroup) => imageNanoModels(group).filter((model) => nanoSeriesValue(model) === activeImageNanoSeries.value)
const selectImageNanoModel = (group: ModelGroup) => {
    const models = imageNanoModels(group)
    const selected = selectedModelMap.value[group.key]
    const next = selected && isNanoBananaModel(selected) ? selected : models[0]
    imageNanoPickerSeries.value = nanoSeriesValue(next)
    imageNanoPickerStep.value = imageNanoSeriesOptions(group).length > 1 ? 'series' : 'variant'
}
const selectImageNanoSeries = (group: ModelGroup, series: string) => {
    imageNanoPickerSeries.value = series
    imageNanoPickerStep.value = 'variant'
}
const selectImageNanoVariant = (groupKey: string, model: ModelOption) => {
    selectModel(groupKey, model)
    imageNanoPickerStep.value = 'root'
    closeToolPanel()
}
const selectModel = (groupKey: string, model: ModelOption) => {
    selectedModelMap.value = {
        ...selectedModelMap.value,
        [groupKey]: model
    }
    if (groupKey === 'image') {
        selectedModel.value = model
    }
}
const selectedModelPayload = computed(() =>
    Object.entries(selectedModelMap.value).filter(([key]) => creationModelGroupKeys.has(key)).reduce((payload: Record<string, any>, [key, model]) => {
        payload[key] = {
            id: model.id,
            value: model.value || model.id,
        model_code: model.model_code || model.channel_code || model.value || model.id
        }
        return payload
    }, {})
)
const selectSubject = async (subject: SubjectOption, source: ComposerSource) => {
    if (subject.isCreate) return
    const token = `@${subject.name}`
    const currentPrompt = prompt.value.trim()
    prompt.value = currentPrompt ? `${currentPrompt} ${token}` : token
    closeToolPanel()
    await nextTick()
    adjustComposerHeight()
    const textarea = source === 'floating' ? floatingTextareaRef.value : composerTextareaRef.value
    textarea?.focus()
}
const selectStyle = (style: StyleOption) => {
    selectedStyle.value = style
    closeToolPanel()
}
const clearSelectedStyle = () => {
    selectedStyle.value = null
}
const handleDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!target.closest('.project-card__menu, .project-card__more')) {
        closeProjectMenu()
    }
    if (target.closest('.drama-tool-panel, .drama-composer__tools')) return
    closeComposerPanels()
}
const handleDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        if (coverDialogVisible.value) closeCoverPicker()
        closeProjectMenu()
        closeComposerPanels()
    }
}
const getComposerElement = () => {
    const node = composerRef.value
    return node instanceof HTMLElement ? node : node?.$el || null
}
const smoothProgress = (value: number) => value * value * (3 - 2 * value)
const updateScrollEffects = () => {
    if (typeof window === 'undefined') return
    const node = getComposerElement()
    if (!node) {
        scrollMaskTopOpacity.value = 0.2
        showFloatingComposer.value = false
        floatingComposerExpanded.value = false
        return
    }

    const rect = node.getBoundingClientRect()
    const recentTop = recentSectionRef.value?.getBoundingClientRect().top ?? rect.bottom
    const scrollContainer = pageScrollRef.value
    const scrollTop = scrollContainer?.scrollTop ?? window.scrollY
    const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0
    const fadeDistance = Math.max(recentTop - containerTop + scrollTop, 1)
    const rawProgress = Math.min(Math.max(scrollTop / fadeDistance, 0), 1)
    const progress = Math.min(Math.max(rawProgress, 0), 1)
    const shouldShowFloating = rect.bottom <= 0

    scrollMaskTopOpacity.value = Number((0.2 + smoothProgress(progress) * 0.8).toFixed(3))
    showFloatingComposer.value = shouldShowFloating
    if (!shouldShowFloating) floatingComposerExpanded.value = false
    if (shouldShowFloating && floatingComposerExpanded.value && !prompt.value.trim()) {
        floatingComposerExpanded.value = false
    }
}
const scheduleScrollEffects = () => {
    if (typeof window === 'undefined' || scrollRafId !== null) return
    scrollRafId = window.requestAnimationFrame(() => {
        scrollRafId = null
        updateScrollEffects()
    })
}
const readCssPixelValue = (element: HTMLElement, property: string, fallback: number) => {
    const value = Number.parseFloat(window.getComputedStyle(element).getPropertyValue(property))
    return Number.isFinite(value) ? value : fallback
}
const applyComposerHeight = () => {
    if (typeof window === 'undefined') return
    const textarea = composerTextareaRef.value
    if (!textarea) return

    const minHeight = readCssPixelValue(textarea, '--drama-composer-textarea-min-height', 132)
    const maxHeight = readCssPixelValue(textarea, '--drama-composer-textarea-max-height', 370)
    textarea.style.height = 'auto'
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}
const adjustComposerHeight = () => {
    void nextTick(() => {
        applyComposerHeight()
        updateScrollEffects()
    })
}
const scheduleComposerHeight = () => {
    if (typeof window === 'undefined' || composerHeightRafId !== null) return
    composerHeightRafId = window.requestAnimationFrame(() => {
        composerHeightRafId = null
        applyComposerHeight()
    })
}
const expandFloatingComposer = async () => {
    if (floatingComposerExpanded.value) return
    floatingComposerExpanded.value = true
    await nextTick()
    window.setTimeout(() => floatingTextareaRef.value?.focus(), 180)
}
const openInspirationDetail = (item: InspirationTile, event?: MouseEvent) => {
    if (event) pauseInspirationPreview(event)
    activeInspirationDetail.value = item
}
const getPreviewVideo = (event: Event) => {
    const target = event.currentTarget
    return target instanceof HTMLElement ? target.querySelector('video') : null
}
const primeInspirationPreview = (event: Event) => {
    const video = event.currentTarget
    if (!(video instanceof HTMLVideoElement)) return
    if (video.currentTime === 0) {
        video.currentTime = 0.001
    }
}
const playInspirationPreview = (event: Event) => {
    const video = getPreviewVideo(event)
    if (!video) return
    video.play().catch(() => undefined)
}
const pauseInspirationPreview = (event: Event) => {
    const video = getPreviewVideo(event)
    if (!video) return
    video.pause()
    video.currentTime = 0
}
const closeInspirationDetail = () => {
    detailVideoRef.value?.pause()
    activeInspirationDetail.value = null
}
const applyModelChipPrompt = async (model: { name: string; prompt: string }) => {
    prompt.value = model.prompt
    activeInspirationDetail.value = null
    closeToolPanel()
    await nextTick()
    adjustComposerHeight()
    getComposerElement()?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    composerTextareaRef.value?.focus()
}
const playDetailVideo = () => {
    detailVideoRef.value?.play().catch(() => undefined)
}
const generateSameInspiration = async () => {
    if (!activeInspirationDetail.value) return
    const current = activeInspirationDetail.value
    try {
        const detail = await getShortDramaInspirationDetail(current.id)
        const mapped = mapInspiration(detail)
        prompt.value = mapped.prompt || current.prompt
        applyInspirationConfig(mapped)
    } catch (error: any) {
        prompt.value = current.prompt
        applyInspirationConfig(current)
        feedback.msgWarning(getRequestErrorMessage(error, '灵感详情读取失败，已使用当前提示词'))
    }
    closeInspirationDetail()
    await nextTick()
    getComposerElement()?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const extractSubjectMentions = (content: string) => {
    return Array.from(content.matchAll(/@([^\s@]+)/g)).map((match) => match[1]).filter(Boolean)
}
const mapInspiration = (item: any): InspirationTile => {
    const config = item?.config || {}
    const configLabels = Array.isArray(config)
        ? config
        : [
            config.multi_episode ? '多集' : '',
            config.style_name,
            config.model_name
        ].filter(Boolean)
    return {
        id: String(item?.id || ''),
        title: item?.title || '灵感短剧',
        video: item?.video_url || item?.video || '',
        prompt: item?.prompt || '',
        author: item?.author?.nickname || item?.author || 'AI 创作者',
        date: item?.created_at || item?.date || '',
        config: configLabels,
        multiEpisode: config.multi_episode,
        modelId: config.model_id,
        styleId: config.style_id
    }
}
const applyInspirationConfig = (item: InspirationTile) => {
    if (typeof item.multiEpisode === 'boolean') {
        multiEpisode.value = item.multiEpisode
    }
    if (item.modelId) {
        const model = modelOptions.value.find((option) => option.id === item.modelId)
        if (model) {
            selectedModel.value = model
            selectedModelMap.value = {
                ...selectedModelMap.value,
                image: model
            }
        }
    }
    if (item.styleId) {
        selectedStyle.value = styleOptions.value.find((option) => option.id === item.styleId) || selectedStyle.value
    }
}
const mapProject = (item: any): ProjectCard => ({
    id: item?.id || item?.task_id || '',
        title: item?.title || '未命名项目',
    image: item?.cover_url || item?.image || '',
    status: item?.status || '',
    taskId: item?.task_id || item?.last_task_id || item?.current_version?.task_id || '',
    coverAssetId: item?.cover_asset_id || ''
})
const updateProjectCardInLists = (project: ProjectCard) => {
    const apply = (items: ProjectCard[]) => items.map((item) => (item.id === project.id ? { ...item, ...project } : item))
    recentProjects.value = apply(recentProjects.value)
    projectCards.value = apply(projectCards.value)
}
const removeProjectCardFromLists = (projectId: string | number) => {
    recentProjects.value = recentProjects.value.filter((item) => item.id !== projectId)
    projectCards.value = projectCards.value.filter((item) => item.id !== projectId)
}
const refreshRecentProjects = async () => {
    if (!hasUserToken()) {
        recentProjects.value = []
        return
    }
    const data = await getShortDramaProjects({ page_no: 1, page_size: recentProjectLimit })
    recentProjects.value = (Array.isArray(data?.lists) ? data.lists : []).map(mapProject)
}
const refreshProjectListsAfterDelete = async (projectId: string | number) => {
    removeProjectCardFromLists(projectId)
    const [recentResult] = await Promise.allSettled([
        refreshRecentProjects(),
        loadProjects(true)
    ])
    if (recentResult.status === 'rejected') {
        feedback.msgWarning(getRequestErrorMessage(recentResult.reason, '最近项目刷新失败，请稍后手动刷新'))
    }
}
const toggleProjectMenu = (projectId: string | number) => {
    activeProjectMenuId.value = activeProjectMenuId.value === projectId ? null : projectId
}
const closeProjectMenu = () => {
    activeProjectMenuId.value = null
}
const openCoverPicker = async (project: ProjectCard) => {
    closeProjectMenu()
    coverDialogProject.value = project
    coverDialogVisible.value = true
    coverOptions.value = []
    selectedCoverAssetId.value = null
    loadingCoverOptions.value = true
    try {
        const data = await getShortDramaProjectCoverOptions(project.id)
        coverOptions.value = (Array.isArray(data?.lists) ? data.lists : []).map((item: any) => ({
            id: item?.id || '',
            title: item?.shot_title || item?.title || '',
            url: item?.url || '',
            cover_url: item?.cover_url || '',
            selected: !!item?.selected,
            shot_title: item?.shot_title || '',
            shot_sort: Number(item?.shot_sort || 0)
        }))
        const selected = coverOptions.value.find((item) => item.selected)
        selectedCoverAssetId.value = data?.selected_asset_id || selected?.id || coverOptions.value[0]?.id || null
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '封面列表读取失败'))
    } finally {
        loadingCoverOptions.value = false
    }
}
const closeCoverPicker = () => {
    if (savingCover.value) return
    coverDialogVisible.value = false
    coverDialogProject.value = null
    coverOptions.value = []
    selectedCoverAssetId.value = null
}
const saveCoverPicker = async () => {
    if (!coverDialogProject.value || !selectedCoverAssetId.value) return
    savingCover.value = true
    try {
        const updated = await updateShortDramaProjectCover({
            id: coverDialogProject.value.id,
            asset_id: selectedCoverAssetId.value
        })
        updateProjectCardInLists(mapProject(updated))
        feedback.msgSuccess('封面已更新')
        savingCover.value = false
        closeCoverPicker()
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '封面保存失败'))
    } finally {
        savingCover.value = false
    }
}
const renameProjectCard = async (project: ProjectCard) => {
    closeProjectMenu()
    try {
        const { value } = await feedback.prompt('请输入新的项目名称', '重命名', {
            inputValue: project.title,
            inputPattern: /\S+/,
            inputErrorMessage: '项目名称不能为空',
            confirmButtonText: '确定'
        })
        const title = String(value || '').trim()
        if (!title || title === project.title) return
        const updated = await renameShortDramaProject({ id: project.id, title })
        updateProjectCardInLists(mapProject(updated))
        feedback.msgSuccess('项目名称已更新')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(getRequestErrorMessage(error, '重命名失败'))
    }
}
const deleteProjectCard = async (project: ProjectCard) => {
    closeProjectMenu()
    try {
        await feedback.confirm(`确定删除「${project.title}」吗？删除后不会影响已保存的历史资产。`)
        await deleteShortDramaProject(project.id)
        await refreshProjectListsAfterDelete(project.id)
        feedback.msgSuccess('项目已删除')
    } catch (error: any) {
        if (error === 'cancel' || error === 'close') return
        feedback.msgError(getRequestErrorMessage(error, '删除失败'))
    }
}
const getProjectPlanTaskId = async (project: ProjectCard) => {
    if (project.taskId) return project.taskId
    const detail = await getShortDramaProjectDetail(project.id)
    return detail?.task_id || detail?.current_version?.task_id || ''
}
const openProject = async (project: ProjectCard) => {
    if (!project.id) {
        feedback.msgWarning('项目不存在')
        return
    }
    if (openingProjectId.value) return
    openingProjectId.value = project.id
    try {
        const taskId = await getProjectPlanTaskId(project)
        if (!taskId) {
            feedback.msgWarning('项目缺少剧本任务，请重新创建')
            return
        }
        await router.push({
            path: '/ai/short-drama/plan',
            query: {
                project_id: project.id,
                task_id: taskId
            }
        })
    } catch (error: any) {
        feedback.msgError(getRequestErrorMessage(error, '打开项目失败'))
    } finally {
        openingProjectId.value = null
    }
}
const loadProjects = async (force = false) => {
    if (!hasUserToken()) return
    if (loadingProjects.value) return
    if (!force && projectCards.value.length) return
    loadingProjects.value = true
    try {
        const data = await getShortDramaProjects({ page_no: 1, page_size: 50 })
        projectCards.value = (Array.isArray(data?.lists) ? data.lists : []).map(mapProject)
    } catch (error: any) {
        if (isPcLoginRequiredError(error)) {
            userStore.logout()
            return
        }
        if (isPcLoginRequiredError(error)) return
        feedback.msgError(getRequestErrorMessage(error, '项目列表读取失败'))
    } finally {
        loadingProjects.value = false
    }
}
const normalizeModelGroup = (group: any): ModelGroup => ({
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
        name: String(model?.name || model?.id || '默认模型'),
        display_group: String(model?.display_group || ''),
        display_series: String(model?.display_series || ''),
        display_series_label: String(model?.display_series_label || ''),
        display_variant_label: String(model?.display_variant_label || ''),
        description: String(model?.description || ''),
        image: model?.image || sharedDramaImage,
        enabled: model?.enabled !== false
    }))
})
const loadHomeData = async () => {
    syncLoginStateFromTokenCookie()
    loadingHome.value = true
    try {
        const data = await getShortDramaHome()
        userPoints.value = Number(data?.user?.points ?? userPoints.value)
        membershipEnabled.value = Boolean(data?.user?.vip_enabled || data?.user?.membership_enabled)
        promptMaxLength.value = Math.max(0, Number(data?.prompt_max_length ?? promptMaxLength.value) || 0)
        const videos = (data?.background?.items || []).map((item: any) => item?.url).filter(Boolean)
        if (videos.length) backgroundVideos.value = videos
        if (Array.isArray(data?.model_groups) && data.model_groups.length) {
            modelGroups.value = data.model_groups
                .map(normalizeModelGroup)
                .filter((group: ModelGroup) => creationModelGroupKeys.has(group.key) && group.options.length)
            modelOptions.value = modelGroups.value.flatMap((group) => group.options)
            ensureSelectedModels()
        } else if (Array.isArray(data?.models) && data.models.length) {
            modelOptions.value = data.models.filter((model: ModelOption) => model.enabled !== false)
            selectedModel.value = modelOptions.value.find((model) => model.id === selectedModel.value.id) || modelOptions.value[0] || creationFallbackModelOptions[0]
            const imageFallbackGroup = fallbackModelGroups.find((group) => group.key === 'image') || fallbackModelGroups[0]
            modelGroups.value = [{ ...imageFallbackGroup, options: modelOptions.value }]
            ensureSelectedModels()
        }
        if (Array.isArray(data?.subjects) && data.subjects.length) {
            subjectOptions.value = [
                fallbackSubjectOptions[0],
                ...data.subjects.map((subject: any) => ({
                    id: String(subject.id),
                    name: subject.name,
                    image: subject.image || sharedDramaImage,
                    source: subject.source,
                    category: subject.category,
                    gender: subject.gender,
                    ageStage: subject.age_stage || subject.ageStage
                }))
            ]
        }
        if (Array.isArray(data?.styles) && data.styles.length) {
            styleOptions.value = data.styles.map((style: any) => ({
                id: String(style.id),
                name: style.name,
                image: style.image || sharedDramaImage,
                isNew: Boolean(style.is_new ?? style.isNew)
            }))
        }
        if (userStore.isLogin && Array.isArray(data?.recent_projects)) {
            recentProjects.value = data.recent_projects.map(mapProject)
        } else {
            recentProjects.value = []
        }
        if (Array.isArray(data?.inspirations) && data.inspirations.length) {
            inspirationTiles.value = data.inspirations.map(mapInspiration)
        }
    } catch (error: any) {
        if (isPcLoginRequiredError(error)) {
            userStore.logout()
            recentProjects.value = []
            projectCards.value = []
            userPoints.value = 0
            return
        }
        feedback.msgWarning(getRequestErrorMessage(error, '首页数据读取失败，已使用本地兜底内容'))
    } finally {
        loadingHome.value = false
    }
}

onMounted(() => {
    syncLoginStateFromTokenCookie()
    if (typeof document !== 'undefined') {
        previousPcMinWidth = document.documentElement.style.getPropertyValue('--pc-min-width')
        document.documentElement.style.setProperty('--pc-min-width', '0px')
        document.documentElement.style.overflow = 'auto'
        document.body.style.overflow = 'auto'
    }
    loadHomeData()
    nextTick(() => {
        applyComposerHeight()
        updateScrollEffects()
    })
    window.addEventListener('resize', scheduleScrollEffects)
    window.addEventListener('resize', scheduleComposerHeight)
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeydown)
})

watch(() => userStore.isLogin, (loggedIn) => {
    syncLoginStateFromTokenCookie()
    if (!loggedIn) {
        recentProjects.value = []
        projectCards.value = []
        return
    }
    loadHomeData()
})

watch(subjectCategoryOptions, (options) => {
    if (!options.some((option) => option.value === activeSubjectCategory.value)) {
        activeSubjectCategory.value = 'all'
    }
    subjectCategoryMenuOpen.value = false
})

watch(prompt, () => {
    adjustComposerHeight()
})

onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
        if (scrollRafId !== null) window.cancelAnimationFrame(scrollRafId)
        if (composerHeightRafId !== null) window.cancelAnimationFrame(composerHeightRafId)
        window.removeEventListener('resize', scheduleScrollEffects)
        window.removeEventListener('resize', scheduleComposerHeight)
    }
    detailVideoRef.value?.pause()
    if (typeof document === 'undefined') return
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    document.removeEventListener('keydown', handleDocumentKeydown)
    if (previousPcMinWidth) {
        document.documentElement.style.setProperty('--pc-min-width', previousPcMinWidth)
    } else {
        document.documentElement.style.removeProperty('--pc-min-width')
    }
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.short-drama-page {
    position: relative;
    min-width: 0;
    height: 100dvh;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    background: #050505;
    color: #fff;
    box-sizing: border-box;
}

.short-drama-page__media-bg,
.short-drama-page__mask,
.short-drama-page__gradient-mask {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.short-drama-page__media-bg {
    z-index: 0;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.8s ease;
}

.short-drama-page__media-bg.is-active {
    opacity: 1;
}




.short-drama-page__mask {
    z-index: 1;
    background: #0c0c0d;
    opacity: 0;
    transition: opacity 0.08s linear;
    will-change: opacity;
}

.short-drama-page__gradient-mask {
    z-index: 2;
    background: linear-gradient(180deg, rgba(12, 12, 13, 0.1) 0%, #0c0c0d 100%);
}

.short-drama-back,
.short-drama-credit,
.short-drama-content {
    position: relative;
    z-index: 5;
}

.short-drama-page :deep(.glass-surface.glass-surface--svg),
.short-drama-page :deep(.glass-surface.glass-surface--fallback) {
    border: 0 !important;
    box-shadow: none !important;
}

.short-drama-icon {
    position: relative;
    z-index: 5;
    display: block;
    flex: 0 0 auto;
    object-fit: contain;
    pointer-events: none;
}

.short-drama-icon--dropdown,
.short-drama-icon--submit {
    width: 16px;
    height: 16px;
}

.short-drama-icon--back {
    width: 14px;
    height: 14px;
    filter: brightness(0) invert(1);
    transform: rotate(-180deg);
}

.short-drama-icon--nav {
    width: 24px;
    height: 24px;
}

.short-drama-icon--tool {
    width: 32px;
    height: 32px;
}

.short-drama-back {
    position: fixed;
    top: 24px;
    left: 24px;
    z-index: 12;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    font-size: 16px;
    line-height: 16px;
    cursor: pointer;
}

.short-drama-home-credit {
    position: fixed !important;
    top: 24px !important;
    right: 24px !important;
    left: auto !important;
    z-index: 20 !important;
}

.short-drama-back__icon {
    flex: 0 0 auto;
    color: #a1a1a1;
}

:deep(.short-drama-back__icon > .glass-surface__content) {
    padding: 0;
}

.short-drama-credit {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 12;
    color: #fff;
    font-size: 16px;
    line-height: 16px;
}

:deep(.short-drama-credit > .glass-surface__content) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    min-width: 0;
    white-space: nowrap;
    box-sizing: border-box;
}

.short-drama-credit__icon {
    position: relative;
    z-index: 5;
    display: block;
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(1);
    object-fit: contain;
}

.short-drama-credit button {
    border: 0;
    padding: 0;
    background: transparent;
    color: #ffbe32;
    font-size: 16px;
    line-height: 16px;
    cursor: pointer;
}




.short-drama-content {
    width: 100%;
    padding-top: 200px;
    padding-bottom: 80px;
    box-sizing: border-box;
}


.short-drama-hero {
    position: relative;
    z-index: 30;
    width: min(860px, calc(100vw - 64px));
    margin: 0 auto;
    text-align: center;
}

.short-drama-hero h1 {
    width: min(400px, 100%);
    height: 40px;
    margin: 0 auto 40px;
    color: #fff;
    font-size: 40px;
    font-weight: 600;
    line-height: 40px;
    letter-spacing: 0;
    text-align: left;
    text-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
}

.drama-composer {
    position: relative;
    z-index: 80;
    width: 100%;
    min-height: 206px;
    overflow: visible;
    text-align: left;
}

:deep(.drama-composer > .glass-surface__content) {
    z-index: 8;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 10px;
    height: auto;
    min-height: inherit;
    padding: 20px 18px 10px 14px;
    box-sizing: border-box;
}

.drama-composer::after,
.drama-floating-composer::after,
.model-chip::after,
.short-drama-credit::after,
.short-drama-back__icon::after {
    position: absolute;
    inset: 0;
    z-index: 3;
    border-radius: inherit;
    content: '';
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.018) 48%, rgba(0, 0, 0, 0.2)),
        rgba(30, 31, 32, 0.2);
    pointer-events: none;
}

.drama-composer::before,
.drama-floating-composer::before,
.model-chip::before,
.short-drama-credit::before,
.short-drama-back__icon::before {
    position: absolute;
    inset: 0;
    z-index: 4;
    border-radius: inherit;
    content: '';
    --glass-border-size: 1px;
    --glass-border-color: rgba(255, 255, 255, 0.3);
    box-sizing: border-box;
    box-shadow: inset 0 0 0 var(--glass-border-size) var(--glass-border-color);
    pointer-events: none;
}

.drama-composer textarea,
.drama-floating-composer textarea {
    position: relative;
    z-index: 5;
    display: block;
    width: 100%;
    border: 0;
    outline: none;
    resize: none;
    background: transparent;
    color: #fff;
    font-family: Inter, sans-serif;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 28px;
    letter-spacing: 0;
}

.drama-composer textarea {
    --drama-composer-textarea-min-height: 132px;
    --drama-composer-textarea-max-height: 370px;
    min-height: var(--drama-composer-textarea-min-height);
    max-height: var(--drama-composer-textarea-max-height);
    height: var(--drama-composer-textarea-min-height);
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.drama-composer textarea::-webkit-scrollbar {
    display: none;
}

.drama-composer textarea::placeholder,
.drama-floating-composer textarea::placeholder {
    color: #fff;
    opacity: 1;
}

.drama-composer__toolbar {
    position: relative;
    z-index: 9;
    display: flex;
    align-items: center;
    gap: 18px;
}

.drama-composer__tools {
    display: flex;
    align-items: center;
    gap: 16px;
    width: auto;
    min-width: 176px;
}

.drama-composer__tools button,
.drama-submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    cursor: pointer;
}

.drama-composer__tools button {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    transition: background 0.16s ease, opacity 0.16s ease;
}

.drama-composer__tools button.has-selected-style {
    gap: 8px;
    width: 132px;
    max-width: 190px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 999px;
    padding: 0 8px 0 6px;
    background: rgba(255, 255, 255, 0.08);
    box-sizing: border-box;
}

.drama-composer__tools button.is-active,
.drama-composer__tools button:hover {
    background: rgba(255, 255, 255, 0.12);
}

.drama-style-tool__avatar {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
}

.drama-composer__tools button.has-selected-style span {
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.drama-composer__tools button.has-selected-style i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    color: rgba(255, 255, 255, 0.78);
    font-size: 18px;
    font-style: normal;
    line-height: 1;
}

.drama-composer__tools button.has-selected-style i img {
    display: block;
    width: 14px;
    height: 14px;
}

.drama-composer .short-drama-icon {
    filter: brightness(0) invert(1);
    opacity: 1;
}

.drama-floating-composer .short-drama-icon {
    filter: brightness(0) invert(1);
    opacity: 1;
}

.short-drama-icon--dropdown {
    transition: transform 0.18s ease;
}

.short-drama-icon--dropdown.is-open {
    transform: rotate(180deg);
}

.drama-tool-panel::before {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: inherit;
    content: '';
    background: rgba(30, 31, 32, 0.92);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    pointer-events: none;
}

.drama-tool-panel {
    position: absolute;
    top: calc(100% + 10px);
    left: 50%;
    z-index: 1000;
    border: 0;
    background: transparent !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    color: #fff;
    isolation: isolate;
    overflow: hidden;
    text-align: left;
    transform: translateX(-50%);
}

.drama-tool-panel.is-floating {
    top: auto;
    bottom: calc(100% + 12px);
}

.drama-tool-panel--model {
    left: 0;
    height: auto !important;
    max-height: min(410px, calc(100vh - 220px));
    transform: none;
}

.drama-tool-panel--model.is-floating {
    left: 0;
}

:deep(.drama-tool-panel > .glass-surface__content) {
    position: relative;
    z-index: 3;
    display: block;
    padding: 0;
    box-sizing: border-box;
}

:deep(.drama-tool-panel--model > .glass-surface__content) {
    height: auto;
}

.drama-model-menu {
    position: relative;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: auto;
    max-height: min(410px, calc(100vh - 220px));
    padding: 18px 8px 10px;
    box-sizing: border-box;
    overflow-y: auto;
}

.drama-model-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.drama-model-menu p {
    margin: 0 0 10px;
    padding: 0 12px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    line-height: 1;
}

.drama-model-option {
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

.drama-model-option:hover,
.drama-model-option.is-active {
    background: rgba(255, 255, 255, 0.1);
}

.drama-model-option__image {
    display: block;
    width: 24px;
    height: 24px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 50%;
    object-fit: cover;
}

.drama-model-option span:nth-child(2) {
    min-width: 0;
}

.drama-model-option strong,
.drama-model-option small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.drama-model-option strong {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
}

.drama-model-option small {
    margin-top: 2px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
    line-height: 15px;
}

.drama-model-option i {
    color: #fff;
    font-size: 13px;
    font-style: normal;
}

.drama-model-back {
    width: 100%;
    padding: 6px 12px;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    text-align: left;
    font-size: 12px;
}

.drama-model-back:hover {
    color: #fff;
}

.drama-model-series {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 2px 8px 6px 40px;
}

.drama-model-series button {
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.64);
    font-size: 12px;
}

.drama-model-series button.is-active {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.drama-model-option.is-nano-variant {
    grid-template-columns: minmax(0, 1fr) 16px;
    margin-left: 40px;
    padding: 8px 12px;
}

.drama-picker-panel {
    position: relative;
    z-index: 5;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 22px 20px 20px;
    box-sizing: border-box;
}

.drama-picker-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    min-height: 28px;
    margin-bottom: 12px;
}

.drama-picker-panel__head strong {
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
}

.drama-picker-tabs,
.drama-picker-category {
    display: flex;
    align-items: center;
}

.drama-picker-tabs {
    gap: 12px;
}

.drama-picker-tabs button {
    border: 0;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.42);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
}

.drama-picker-tabs button.is-active {
    color: #fff;
    font-weight: 600;
}

.drama-picker-category {
    position: relative;
    margin-left: auto;
}

.drama-picker-category__trigger {
    position: relative;
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
    text-align: left;
    cursor: pointer;
}

.drama-picker-category__trigger span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.drama-picker-category__trigger img {
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

.drama-picker-category__trigger.is-open img {
    transform: translateY(-50%) rotate(180deg);
}

.drama-picker-category__menu {
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

.drama-picker-category__menu::-webkit-scrollbar {
    display: none;
}

.drama-picker-category__menu button {
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

.drama-picker-category__menu button:hover,
.drama-picker-category__menu button.is-active {
    background: #252525;
    color: #fff;
}

.drama-subject-grid,
.drama-style-grid {
    display: grid;
    min-height: 0;
    overflow: hidden auto;
    scrollbar-width: none;
}

.drama-subject-grid::-webkit-scrollbar,
.drama-style-grid::-webkit-scrollbar {
    display: none;
}

.drama-subject-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
}

.drama-subject-card {
    position: relative;
    height: 174px;
    min-width: 0;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    overflow: hidden;
    cursor: pointer;
}

.drama-subject-card img,
.drama-style-grid img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.drama-subject-card::after,
.drama-style-grid button::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 52%;
    content: '';
    background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.62));
    pointer-events: none;
}

.drama-subject-card > span:last-child,
.drama-style-grid span {
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

.drama-subject-card.is-create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.08);
}

.drama-subject-card.is-create::after {
    display: none;
}

.drama-subject-card.is-create > span:last-child {
    position: static;
    color: rgba(255, 255, 255, 0.68);
    text-align: center;
}

.drama-subject-card__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(255, 255, 255, 0.56);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.74);
}

.drama-style-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
}

.drama-style-grid button {
    position: relative;
    height: 154px;
    min-width: 0;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    overflow: hidden;
    cursor: pointer;
}

.drama-style-grid em {
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

.tool-panel-fade-enter-active,
.tool-panel-fade-leave-active {
    transition: opacity 0.16s ease;
}

.tool-panel-fade-enter-from,
.tool-panel-fade-leave-to {
    opacity: 0;
}

.drama-multi {
    position: relative;
    z-index: 9;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    width: auto;
    margin-left: auto;
    color: #fff;
    font-size: 14px;
    line-height: 14px;
    cursor: pointer;
}

.drama-multi input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.drama-multi__track {
    flex: 0 0 auto;
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

.drama-multi__track i {
    display: block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.18s ease, background 0.18s ease, width 0.18s ease, height 0.18s ease;
}

.drama-multi input:checked + .drama-multi__track {
    background: #fff;
}

.drama-multi input:checked + .drama-multi__track i {
    background: #292929;
    transform: translateX(18px);
}

.drama-submit {
    position: relative;
    z-index: 9;
    width: 28px;
    height: 28px;
    margin-left: -2px;
    border-radius: 50%;
    background: #fff;
    color: #fff;
}

.drama-submit .short-drama-icon--submit {
    filter: brightness(0) invert(54%);
    opacity: 1;
}

.drama-submit.has-prompt .short-drama-icon--submit {
    filter: brightness(0);
}

.floating-drama-fade-enter-active,
.floating-drama-fade-leave-active {
    transition:
        opacity 0.2s ease,
        transform 0.2s ease;
}

.floating-drama-fade-enter-from,
.floating-drama-fade-leave-to {
    opacity: 0;
    transform: translate3d(-50%, 18px, 0);
}

.drama-floating-composer {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 90;
    width: min(720px, calc(100vw - 36px)) !important;
    height: 56px !important;
    border-radius: 40px !important;
    overflow: visible;
    transform: translateX(-50%);
    text-align: left;
    cursor: text;
    transition:
        width 0.34s cubic-bezier(0.16, 1, 0.3, 1),
        height 0.34s cubic-bezier(0.16, 1, 0.3, 1),
        border-radius 0.34s cubic-bezier(0.16, 1, 0.3, 1),
        bottom 0.34s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: width, height, border-radius;
}

.drama-floating-composer.is-expanded {
    width: min(860px, calc(100vw - 36px)) !important;
    height: 187px !important;
    border-radius: 20px !important;
    bottom: 24px;
}

:deep(.drama-floating-composer > .glass-surface__content) {
    display: block;
    padding: 0;
    box-sizing: border-box;
}

.drama-floating-composer__inner {
    position: relative;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 14px 14px 8px 20px;
    box-sizing: border-box;
    transition: padding 0.28s ease;
}

.drama-floating-composer.is-expanded .drama-floating-composer__inner {
    padding: 20px 18px 10px 14px;
}

.drama-floating-composer textarea {
    flex: 1 1 auto;
    height: 24px;
    min-height: 24px;
    max-height: 92px;
    padding-right: 42px;
    line-height: 24px;
    overflow: hidden;
    white-space: nowrap;
    transition:
        height 0.28s cubic-bezier(0.16, 1, 0.3, 1),
        line-height 0.28s ease,
        padding-right 0.28s ease;
}

.drama-floating-composer.is-expanded textarea {
    height: 92px;
    line-height: 14px;
    padding-right: 0;
    overflow: auto;
    white-space: normal;
}

.drama-floating-composer__toolbar {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transform: translateY(8px);
    transition:
        max-height 0.24s ease,
        opacity 0.22s ease,
        transform 0.24s ease;
}

.drama-floating-composer.is-expanded .drama-floating-composer__toolbar {
    max-height: 40px;
    opacity: 1;
    overflow: visible;
    transform: translateY(0);
}

.drama-floating-composer__submit {
    position: absolute;
    right: 14px;
    top: 50%;
    flex: 0 0 auto;
    margin-left: 0;
    transform: translateY(-50%);
    transition:
        right 0.28s ease,
        top 0.28s ease,
        transform 0.28s ease;
}

.drama-floating-composer.is-expanded .drama-floating-composer__submit {
    position: relative;
    right: auto;
    top: auto;
    transform: none;
}

.model-chips {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: min(612px, 100%);
    margin: 32px auto 0;
}

.model-chip {
    flex: 0 0 auto;
    border: 0;
    color: #fff;
    cursor: pointer;
}

:deep(.model-chip > .glass-surface__content) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 16px;
    box-sizing: border-box;
}

.model-chip img {
    position: relative;
    z-index: 5;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
}

.model-chip span {
    position: relative;
    z-index: 5;
    font-size: 14px;
    font-weight: 500;
    line-height: 14px;
    white-space: nowrap;
}

.short-drama-section {
    position: relative;
    z-index: 1;
    width: calc(100vw - 76px);
    margin-left: 76px;
    padding: 0 44px;
    box-sizing: border-box;
}

.recent-section {
    margin-top: 64px;
}

.inspiration-section {
    margin-top: 40px;
}

.project-library-section {
    min-height: calc(100vh - 200px);
}

.section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 16px;
    margin-bottom: 20px;
}

.section-heading h2 {
    margin: 0;
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    line-height: 16px;
    letter-spacing: 0;
}

.section-heading button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #a1a1a1;
    font-size: 14px;
    line-height: 14px;
    cursor: pointer;
}

.section-heading button:disabled {
    cursor: default;
    opacity: 0.55;
}

.section-heading button::after {
    display: block;
    width: 6px;
    height: 6px;
    border-top: 1px solid currentColor;
    border-right: 1px solid currentColor;
    content: '';
    transform: rotate(45deg);
}

.project-grid {
    --project-columns: 5;
    --project-card-width: calc((100vw - 76px - 88px - (var(--project-columns) - 1) * 12px) / var(--project-columns));
    --project-image-width: calc(var(--project-card-width) - 8px);
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
}

.inspiration-grid {
    display: block;
    column-count: 5;
    column-gap: 2px;
}

.project-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    min-width: 0;
    border: 0;
    padding: 0;
    border-radius: 12px;
    height: calc(var(--project-image-width) * 301 / 465 + 52px) !important;
    background: rgba(30, 31, 32, 0.22);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    color: #fff;
    overflow: hidden;
    box-sizing: border-box;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.project-card--item:hover {
    background: rgba(42, 43, 44, 0.52);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42), 0 18px 42px rgba(0, 0, 0, 0.25);
    transform: translateY(-2px);
}

.project-card:disabled {
    cursor: default;
    opacity: 0.72;
}

.inspiration-tile {
    min-width: 0;
    border: 0;
    padding: 0;
    border-radius: 0;
    background: rgba(30, 31, 32, 0.22);
    color: #fff;
    overflow: hidden;
    box-sizing: border-box;
    cursor: pointer;
    font: inherit;
    line-height: 0;
    text-align: left;
}

.project-card--new {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 96px;
    cursor: pointer;
}

.project-card__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: #a1a1a1;
}

.project-card--new > span:last-child {
    position: relative;
    z-index: 5;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 15px;
}

.project-card img {
    display: block;
    position: relative;
    z-index: 5;
    margin: 4px 4px 0;
    width: calc(100% - 8px);
    height: calc(var(--project-image-width) * 301 / 465 - 20px);
    border-radius: 8px;
    object-fit: cover;
}

.project-card__empty-cover {
    position: relative;
    z-index: 5;
    margin: 4px 4px 0;
    width: calc(100% - 8px);
    height: calc(var(--project-image-width) * 301 / 465 - 20px);
    border-radius: 8px;
    background: #202123;
}

.project-card footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 68px;
    padding: 0 10px;
    box-sizing: border-box;
}

.project-card footer span {
    min-width: 0;
    overflow: hidden;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.project-card footer i {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1;
}

.project-card.is-opening {
    pointer-events: none;
    opacity: 0.72;
}

.project-card__more {
    position: absolute;
    z-index: 8;
    top: 10px;
    right: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: rgba(255, 255, 255, 0.92);
    cursor: pointer;
    opacity: 0;
    transform: translateY(-2px);
    transition: opacity 0.16s ease, transform 0.16s ease, background 0.16s ease;
}

.project-card--item:hover .project-card__more,
.project-card__more[aria-expanded='true'] {
    opacity: 1;
    transform: translateY(0);
}

.project-card__more:hover {
    background: rgba(255, 255, 255, 0.14);
}

.project-card__menu {
    position: absolute;
    z-index: 12;
    top: 44px;
    right: 10px;
    display: grid;
    gap: 2px;
    min-width: 126px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(18, 18, 20, 0.96);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}

.project-card__menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    padding: 9px 10px;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    cursor: pointer;
    font-size: 13px;
    line-height: 18px;
    text-align: left;
    transition: background 0.16s ease, color 0.16s ease;
}

.project-card__menu button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.project-card__menu button.is-danger {
    color: #ff8a8a;
}

.project-card__menu button.is-danger:hover {
    background: rgba(255, 82, 82, 0.12);
    color: #ffaaaa;
}

.project-cover-picker {
    position: fixed;
    inset: 0;
    z-index: 4000;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    background:
        radial-gradient(circle at 18% 18%, rgba(82, 54, 34, 0.22), transparent 34%),
        radial-gradient(circle at 78% 82%, rgba(90, 77, 50, 0.18), transparent 32%),
        rgba(3, 3, 5, 0.94);
    color: #fff;
}

.project-cover-picker__panel {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    padding: 74px 64px 42px;
    box-sizing: border-box;
}

.project-cover-picker__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 28px;
}

.project-cover-picker__header h3 {
    margin: 0;
    color: #fff;
    font-size: 28px;
    font-weight: 700;
    line-height: 34px;
}

.project-cover-picker__header button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.78);
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease;
}

.project-cover-picker__header button:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}

.project-cover-picker__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
    align-content: start;
    gap: 14px;
    max-height: calc(100vh - 230px);
    overflow: auto;
    padding-right: 4px;
}

.project-cover-option {
    position: relative;
    display: block;
    min-width: 0;
    border: 0;
    padding: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    aspect-ratio: 16 / 9;
    overflow: hidden;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    transition: box-shadow 0.16s ease, transform 0.16s ease;
}

.project-cover-option:hover,
.project-cover-option.is-selected {
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.76);
}

.project-cover-option:hover {
    transform: translateY(-1px);
}

.project-cover-option img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-cover-option__radio {
    position: absolute;
    top: 8px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.78);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.35);
    color: #111;
    font-size: 12px;
    box-sizing: border-box;
}

.project-cover-option.is-selected .project-cover-option__radio {
    border-color: #fff;
    background: #fff;
}

.project-cover-picker__state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
}

.project-cover-picker__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin-top: auto;
    padding-top: 28px;
}

.project-cover-picker__footer button {
    min-width: 96px;
    height: 40px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.78);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: background 0.16s ease, color 0.16s ease, opacity 0.16s ease;
}

.project-cover-picker__footer button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
}

.project-cover-picker__footer button.is-primary {
    background: rgba(255, 255, 255, 0.82);
    color: #2a2926;
}

.project-cover-picker__footer button:disabled {
    cursor: not-allowed;
    opacity: 0.48;
}

.project-cover-fade-enter-active,
.project-cover-fade-leave-active {
    transition: opacity 0.18s ease;
}

.project-cover-fade-enter-from,
.project-cover-fade-leave-to {
    opacity: 0;
}

.project-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 320px;
    border-radius: 12px;
    background: rgba(23, 23, 25, 0.88);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    color: #fff;
    text-align: center;
}

.project-empty strong {
    margin-top: 16px;
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
}

.project-empty p {
    margin: 8px 0 18px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    line-height: 20px;
}

.project-empty button {
    border: 0;
    border-radius: 999px;
    padding: 10px 18px;
    background: #fff;
    color: #0c0c0d;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}

.inspiration-tile {
    display: block;
    width: 100%;
    margin: 0 0 2px;
    break-inside: avoid;
}

.inspiration-tile video {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0;
    object-fit: contain;
    background: #0c0c0d;
}

.detail-fade-enter-active,
.detail-fade-leave-active {
    transition: opacity 0.2s ease;
}

.detail-fade-enter-from,
.detail-fade-leave-to {
    opacity: 0;
}

.short-drama-work-detail {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(10, 10, 12, 0.96);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);

    &__panel {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        width: 100%;
        height: 100%;
    }

    &__close {
        position: absolute;
        top: 24px;
        left: 24px;
        z-index: 4;
    }

    &__media {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
        padding: 20px 24px;
        background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.06), transparent 36%),
            #111114;
    }

    &__media-frame {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 56px 24px 32px;
        box-sizing: border-box;
    }

    &__media video {
        display: block;
        width: auto;
        height: auto;
        max-width: min(100%, calc(100vw - 500px));
        max-height: calc(100vh - 112px);
        border-radius: 12px;
        object-fit: contain;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.4);
        background: #000;
    }

    &__content {
        display: flex;
        flex-direction: column;
        gap: 22px;
        height: 100%;
        min-height: 0;
        padding: 20px 22px 22px;
        border-left: 1px solid rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.96);
        background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.05), transparent 26%),
            linear-gradient(180deg, #171719 0%, #101012 100%);
        overflow-y: auto;
        box-sizing: border-box;
    }

    &__header {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    &__author-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
    }

    &__author {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
    }

    &__author strong {
        min-width: 0;
        overflow: hidden;
        color: rgba(255, 255, 255, 0.98);
        font-size: 16px;
        font-weight: 600;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;
    }

    &__avatar img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__subline {
        display: flex;
        align-items: center;
        gap: 18px;
        padding-bottom: 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.78);
        font-size: 12px;
    }

    &__prompt {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
        padding: 2px 0 0;
    }

    &__prompt-head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
    }

    &__prompt-head span {
        color: rgba(255, 255, 255, 0.94);
        font-size: 15px;
        font-weight: 600;
    }

    &__prompt-body {
        flex: 1;
        min-height: 0;
        padding-right: 8px;
        overflow: auto;
    }

    &__prompt-body p {
        margin: 0;
        color: rgba(255, 255, 255, 0.94);
        font-size: 15px;
        font-weight: 600;
        line-height: 2;
        white-space: pre-wrap;
        word-break: break-word;
    }

    &__config {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0;
        min-height: 16px;
        margin-top: 20px;
        white-space: nowrap;
    }

    &__config-text {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.48);
        font-size: 14px;
        font-weight: 500;
        line-height: 1;
    }

    &__config-text + .short-drama-work-detail__config-text::before {
        content: '|';
        margin: 0 8px;
        color: rgba(255, 255, 255, 0.24);
    }

    &__footer {
        display: flex;
        align-items: center;
    }

    &__footer button {
        width: 100%;
        height: 44px;
        border: 0;
        border-radius: 12px;
        padding: 0 20px;
        background: #fff;
        color: #111;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
    }
}

.short-drama-work-detail__content,
.short-drama-work-detail__prompt-body {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.short-drama-work-detail__content::-webkit-scrollbar,
.short-drama-work-detail__prompt-body::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

@media (max-width: 1024px) {
    .short-drama-section {
        width: calc(100vw - 32px);
        margin-left: 16px;
        padding: 0;
    }

    .project-grid {
        --project-columns: 3;
        --project-card-width: calc((100vw - 32px - (var(--project-columns) - 1) * 12px) / var(--project-columns));
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .inspiration-grid {
        column-count: 3;
    }

    .short-drama-work-detail__panel {
        grid-template-columns: 1fr;
        overflow-y: auto;
    }

    .short-drama-work-detail__media {
        min-height: 360px;
        padding: 72px 20px 20px;
    }

    .short-drama-work-detail__media-frame {
        padding: 0;
    }

    .short-drama-work-detail__media video {
        max-width: 100%;
        max-height: 300px;
    }

    .short-drama-work-detail__content {
        height: auto;
        padding: 24px 18px 18px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        border-left: 0;
    }
}

@media (max-width: 920px) {
    .short-drama-back {
        top: 18px;
        left: 18px;
    }

    .short-drama-credit {
        top: 14px;
        right: 14px;
        transform: scale(0.9);
        transform-origin: top right;
    }


    .short-drama-content {
        padding: 124px 18px 96px;
    }

    .short-drama-hero {
        width: 100%;
    }

    .short-drama-hero h1 {
        height: auto;
        margin-bottom: 28px;
        font-size: 30px;
        line-height: 1.2;
        text-align: center;
    }

    .drama-composer {
        min-height: 194px;
    }

    :deep(.drama-composer > .glass-surface__content) {
        gap: 10px;
        padding: 16px 14px;
    }

    .drama-composer textarea {
        --drama-composer-textarea-min-height: 118px;
        min-height: var(--drama-composer-textarea-min-height);
        height: var(--drama-composer-textarea-min-height);
        line-height: 20px;
    }

    .drama-composer__toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
    }

    .drama-composer__tools {
        flex: 1 1 176px;
    }

    .drama-multi {
        margin-left: auto;
    }

    .model-chips {
        flex-wrap: wrap;
    }

    .recent-section {
        margin-top: 44px;
    }

    .inspiration-section {
        margin-top: 34px;
    }
}

@media (max-width: 620px) {
    .short-drama-credit {
        display: none;
    }

    .short-drama-content {
        padding-top: 112px;
    }

    .short-drama-hero h1 {
        font-size: 26px;
    }

    .project-grid {
        --project-columns: 2;
        --project-card-width: calc((100vw - 36px - (var(--project-columns) - 1) * 12px) / var(--project-columns));
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .inspiration-grid {
        column-count: 2;
    }

    .drama-multi {
        order: 3;
    }

    .drama-submit {
        order: 4;
    }
}

@media (max-width: 420px) {
    .project-grid {
        --project-columns: 1;
        --project-card-width: calc(100vw - 36px);
        grid-template-columns: 1fr;
    }

    .inspiration-grid {
        column-count: 1;
    }
}
</style>
