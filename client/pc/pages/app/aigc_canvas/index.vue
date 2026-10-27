<template>
    <div class="canvas-home" @wheel="handleHomeWheel">
        <header class="home-topbar">
            <NuxtLink class="home-icon-button" to="/ai/tools" title="返回工具">
                <el-icon><ArrowLeft /></el-icon>
            </NuxtLink>
            <CanvasAccountActions />
        </header>

        <AiWorkspaceAssetGalleryModal
            :visible="showHomeAssetGallery"
            :accept-types="homeAssetGalleryAcceptTypes"
            title="资产库上传"
            description="选择资产作为 Agent 输入参考素材"
            @close="showHomeAssetGallery = false"
            @select="selectHomeAssetGalleryItem"
        />

        <Teleport to="body">
        <div v-if="moveDialogVisible" class="project-dialog-backdrop" @click.self="closeMoveDialog">
            <section class="project-dialog project-move-dialog">
                <header>
                    <strong>{{ moveDialogProjectCount > 1 ? `移动 ${moveDialogProjectCount} 个项目至...` : '移动至...' }}</strong>
                    <button type="button" title="关闭" @click="closeMoveDialog">×</button>
                </header>
                <div class="project-dialog-body">
                    <button
                        v-if="activeFolderId"
                        class="project-folder-choice is-move-out"
                        :class="{ active: moveTargetFolderId === MOVE_ROOT_TARGET_ID }"
                        type="button"
                        @click="moveTargetFolderId = MOVE_ROOT_TARGET_ID"
                    >
                        <span class="project-folder-choice-icon">
                            <el-icon><Folder /></el-icon>
                        </span>
                        <span class="project-folder-choice-copy">
                            <strong>移出当前文件夹</strong>
                            <em>{{ activeProjectScope === 'team' ? '回到团队项目' : '回到个人项目' }}</em>
                        </span>
                    </button>
                    <button
                        v-for="folder in availableMoveFolders"
                        :key="folder.id"
                        class="project-folder-choice"
                        :class="{ active: moveTargetFolderId === folder.id }"
                        type="button"
                        @click="moveTargetFolderId = folder.id"
                    >
                        <span class="project-folder-choice-copy">
                            <strong>{{ folder.name }}</strong>
                            <em>{{ folderProjectCount(folder.id) }} 个项目</em>
                        </span>
                    </button>
                    <button
                        v-if="!availableMoveFolders.length && !activeFolderId"
                        class="project-folder-choice is-create"
                        type="button"
                        @click="createMoveFolderAndMove"
                    >
                        <span class="project-folder-choice-icon">
                            <el-icon><Plus /></el-icon>
                        </span>
                        <span class="project-folder-choice-copy">
                            <strong>新建文件夹</strong>
                            <em>创建并移入当前项目</em>
                        </span>
                    </button>
                </div>
                <footer>
                    <button type="button" @click="closeMoveDialog">取消</button>
                    <button type="button" :disabled="!moveTargetFolderId" @click="confirmMoveToFolder()">
                        继续
                    </button>
                </footer>
            </section>
        </div>
        </Teleport>

        <Teleport to="body">
        <div v-if="deleteDialog" class="project-dialog-backdrop" @click.self="closeDeleteDialog">
            <section class="project-dialog project-delete-dialog" :class="`is-${deleteDialog.kind}`">
                <header>
                    <strong>{{ deleteDialog.title }}</strong>
                    <button type="button" title="关闭" @click="closeDeleteDialog">×</button>
                </header>
                <div class="project-delete-body">
                    <p v-if="deleteDialog.kind === 'folder'">
                        确定要删除
                        <span>{{ deleteDialog.subjectName }}</span>
                        吗？这将永久删除其中的所有
                        <span>{{ deleteDialog.deleteCount || 0 }} 个项目</span>
                        。此操作无法撤销。
                    </p>
                    <p v-else-if="deleteDialog.kind === 'batch'">
                        确定要删除选中的
                        <span>{{ deleteDialog.deleteCount || deleteDialog.projectIds.length }} 个项目</span>
                        吗？此操作无法撤销。
                    </p>
                    <p v-else>
                        确定要删除项目
                        <span>{{ deleteDialog.subjectName }}</span>
                        吗？此操作无法撤销。
                    </p>
                </div>
                <footer>
                    <button type="button" @click="closeDeleteDialog">取消</button>
                    <button
                        class="danger"
                        type="button"
                        :disabled="deleteDialogSubmitting"
                        @click="confirmDeleteDialog"
                    >
                        {{ deleteDialog.confirmLabel }}
                    </button>
                </footer>
            </section>
        </div>
        </Teleport>

        <Teleport to="body">
        <div v-if="teamMoveDialog" class="project-dialog-backdrop" @click.self="closeTeamMoveDialog">
            <section class="project-dialog project-team-dialog">
                <header>
                    <strong>{{ teamMoveDialog.title }}</strong>
                    <button type="button" title="关闭" @click="closeTeamMoveDialog">×</button>
                </header>
                <div class="project-confirm-body">
                    <p>
                        这会将
                        <span>{{ teamMoveDialog.projectCount || teamMoveDialog.projectIds.length }} 个项目</span>
                        转移到团队协作空间。之后可以在
                        <span>团队项目</span>
                        中找到它们。
                    </p>
                </div>
                <footer>
                    <button type="button" @click="closeTeamMoveDialog">取消</button>
                    <button type="button" :disabled="teamMoveDialogSubmitting" @click="confirmTeamMoveDialog">
                        移动至团队
                    </button>
                </footer>
            </section>
        </div>
        </Teleport>

        <Teleport to="body">
        <div v-if="shareToast" class="project-share-toast" role="status" aria-live="polite">
            <strong>{{ shareToast.title }}</strong>
            <span>{{ shareToast.description }}</span>
        </div>
        </Teleport>

        <main class="home-main">
            <section class="home-compose">
                <div class="home-compose__heading">
                    <span class="home-compose__mark" aria-hidden="true"></span>
                    <h1>今天要做点什么？</h1>
                </div>
                <CanvasAgentPanel
                    ref="homeAgentPanelRef"
                    class="home-agent-panel"
                    embedded-composer
                    submit-mode="defer"
                    :project-id="'home'"
                    :canvas-snapshot="homeCanvasSnapshot"
                    :image-options="agentImageOptions"
                    :video-options="agentVideoOptions"
                    :image-config="agentImageConfig"
                    :video-config="agentVideoConfig"
                    @submit-composer="createFromComposer"
                    @open-asset-library="openHomeAgentAssetLibrary"
                    @update-media-config="updateHomeAgentMediaConfig"
                />
            </section>

            <section class="projects-section">
                <div class="projects-head">
                    <div class="project-tabs" role="tablist" aria-label="项目范围">
                        <button
                            type="button"
                            :class="{ active: activeProjectScope === 'personal' }"
                            @click="selectProjectScope('personal')"
                        >
                            个人
                        </button>
                        <button
                            type="button"
                            :class="{ active: activeProjectScope === 'team' }"
                            @click="selectProjectScope('team')"
                        >
                            团队项目
                        </button>
                    </div>
                    <div class="project-toolbar">
                        <label class="project-search" :class="{ 'is-expanded': projectKeyword }">
                            <el-icon><Search /></el-icon>
                            <input v-model="projectKeyword" type="text" placeholder="搜索" />
                        </label>
                        <div class="project-filter-wrap">
                            <button class="project-filter" type="button" @click="toggleProjectFilter($event)">
                                <span>{{ currentProjectFilterLabel }}</span>
                                <el-icon><ArrowDown /></el-icon>
                            </button>
                            <Teleport to="body">
                            <div
                                v-if="projectFilterOpen"
                                class="project-filter-menu"
                                :style="projectFilterMenuStyle"
                                @click.stop
                                @pointerdown.stop
                                @mousedown.stop
                            >
                                <template v-if="!activeFolderId">
                                    <strong>筛选</strong>
                                    <button
                                        v-for="(filter, index) in projectFilters"
                                        :key="filter.value"
                                        type="button"
                                        :class="{ active: index === projectFilterIndex }"
                                        @click="selectProjectFilter(index)"
                                    >
                                        <span>{{ filter.label }}</span>
                                        <el-icon v-if="index === projectFilterIndex" class="project-menu-check">
                                            <Check />
                                        </el-icon>
                                    </button>
                                </template>
                                <strong>排序方式</strong>
                                <button
                                    v-for="option in projectSortOptions"
                                    :key="option.value"
                                    type="button"
                                    :class="{ active: option.value === projectSortBy }"
                                    @click="selectProjectSortBy(option.value)"
                                >
                                    <span>{{ option.label }}</span>
                                    <el-icon v-if="option.value === projectSortBy" class="project-menu-check">
                                        <Check />
                                    </el-icon>
                                </button>
                                <strong>顺序</strong>
                                <button
                                    v-for="option in projectSortOrders"
                                    :key="option.value"
                                    type="button"
                                    :class="{ active: option.value === projectSortOrder }"
                                    @click="selectProjectSortOrder(option.value)"
                                >
                                    <span>{{ option.label }}</span>
                                    <el-icon v-if="option.value === projectSortOrder" class="project-menu-check">
                                        <Check />
                                    </el-icon>
                                </button>
                            </div>
                            </Teleport>
                        </div>
                        <div class="project-view-toggle" role="group" aria-label="显示模式">
                            <button
                                type="button"
                                title="网格"
                                :class="{ active: projectViewMode === 'grid' }"
                                @click="projectViewMode = 'grid'"
                            >
                                <el-icon><Grid /></el-icon>
                            </button>
                            <button
                                type="button"
                                title="列表"
                                :class="{ active: projectViewMode === 'list' }"
                                @click="projectViewMode = 'list'"
                            >
                                <el-icon><List /></el-icon>
                            </button>
                        </div>
                        <button
                            v-if="!activeFolderId"
                            class="project-icon-action"
                            type="button"
                            title="新建文件夹"
                            @click="createProjectFolder()"
                        >
                            <el-icon><FolderAdd /></el-icon>
                        </button>
                        <button class="project-create-action" type="button" @click="createBlank">
                            <el-icon><Plus /></el-icon>
                            新建项目
                        </button>
                    </div>
                </div>

                <div v-if="currentFolder" class="project-folder-crumb">
                    <button type="button" @click="setActiveFolder('')">全部项目</button>
                    <span>/</span>
                    <strong>{{ currentFolder.name }}</strong>
                </div>

                <div v-if="loading && !projectEntries.length" class="project-grid project-grid-skeleton">
                    <article v-for="index in 8" :key="index" class="project-card project-card-skeleton">
                        <div class="project-skeleton-preview"></div>
                        <div class="project-skeleton-meta">
                            <span></span>
                            <small></small>
                        </div>
                    </article>
                </div>

                <div v-else-if="!projectEntries.length" class="empty-projects">
                    <el-icon><Folder /></el-icon>
                    <strong>暂无项目</strong>
                    <p>创建一个工作区，开始搭建脚本、角色、分镜和生成节点。</p>
                    <button type="button" @click="createBlank">创建项目</button>
                </div>

                <div v-else-if="projectViewMode === 'grid'" class="project-grid">
                    <article class="project-card project-card-create" @click="createBlank">
                        <div class="project-create-card-sizer" aria-hidden="true">
                            <div></div>
                            <span>Project</span>
                            <small>Updated</small>
                        </div>
                        <div class="project-create-card-body">
                            <span><el-icon><Plus /></el-icon></span>
                            <strong>新建项目</strong>
                        </div>
                    </article>
                    <article
                        v-for="entry in projectEntries"
                        :key="entry.key"
                        class="project-card"
                        :data-project-entry-key="entry.key"
                        :class="{
                            'is-folder': entry.kind === 'folder',
                            selected: isProjectSelected(entry.key),
                            'is-selection-mode': projectSelectionMode,
                            'is-drop-target': activeProjectDropTarget === entry.key,
                            'is-project-drop-target':
                                entry.kind === 'project' &&
                                activeProjectDropTarget === entry.key &&
                                !!draggingProjectId &&
                                draggingProjectId !== entry.id,
                            'is-dragging': draggingProjectId === entry.id
                        }"
                        :draggable="false"
                        @dragstart="handleProjectDragStart(entry, $event)"
                        @dragenter.prevent="handleProjectDragEnter(entry, $event)"
                        @dragover.prevent="handleProjectDragOver(entry, $event)"
                        @dragleave="handleProjectDragLeave(entry, $event)"
                        @drop.prevent="handleProjectDrop(entry, $event)"
                        @dragend="handleProjectDragEnd"
                        @pointerdown="handleProjectPointerDown(entry, $event)"
                        @mousedown="handleProjectMouseDown(entry, $event)"
                        @contextmenu.prevent="openProjectContextMenu(entry, $event)"
                        @click="handleProjectCardClick(entry)"
                    >
                        <div
                            v-if="
                                entry.kind === 'project' &&
                                activeProjectDropTarget === entry.key &&
                                draggingProjectId &&
                                draggingProjectId !== entry.id
                            "
                            class="project-collection-morph"
                            aria-hidden="true"
                        >
                            <div class="project-morph-preview">
                                <div class="project-morph-page" :style="projectMarbleStyle(entry.id)">
                                    <img
                                        v-if="entryPreviewImage(entry)"
                                        :src="entryPreviewImage(entry)"
                                        alt=""
                                        @error="markPreviewImageBroken(entryPreviewImageKey(entry))"
                                    />
                                </div>
                            </div>
                            <div class="project-collection-pocket project-morph-pocket"></div>
                            <div class="project-morph-meta">
                                <strong>未命名文件夹</strong>
                                <small>1 个项目</small>
                            </div>
                        </div>
                        <button
                            v-if="entry.kind === 'project'"
                            class="project-select-toggle"
                            type="button"
                            title="选择"
                            :class="{ checked: isProjectSelected(entry.key) }"
                            @click.stop="toggleProjectSelection(entry.key)"
                        >
                            <el-icon v-if="isProjectSelected(entry.key)"><Check /></el-icon>
                        </button>
                        <div class="project-thumb" :class="{ 'is-collection': entry.kind === 'folder' }">
                            <template v-if="entry.kind === 'folder'">
                                <div class="project-collection-stack" aria-hidden="true">
                                    <div
                                        v-for="(cover, coverIndex) in folderCoverSet(entry.id)"
                                        :key="cover.id"
                                        class="project-collection-page"
                                        :class="[`is-${coverIndex}`, { empty: !coverPreviewImage(cover) }]"
                                        :style="projectMarbleStyle(cover.id)"
                                    >
                                        <img
                                            v-if="coverPreviewImage(cover)"
                                            :src="coverPreviewImage(cover)"
                                            alt=""
                                            @error="markPreviewImageBroken(coverPreviewImageKey(cover))"
                                        />
                                    </div>
                                </div>
                            </template>
                            <template v-else>
                                <img
                                    v-if="entryPreviewImage(entry)"
                                    :src="entryPreviewImage(entry)"
                                    alt=""
                                    @error="markPreviewImageBroken(entryPreviewImageKey(entry))"
                                />
                                <div v-else class="project-marble" :style="projectMarbleStyle(entry.id)" />
                            </template>
                        </div>
                        <button
                            v-if="!projectSelectionMode"
                            class="project-more"
                            type="button"
                            title="更多"
                            @click.stop="toggleProjectMenu(entry.key, $event)"
                        >
                            <el-icon><MoreFilled /></el-icon>
                        </button>
                        <Teleport to="body">
                        <div
                            v-if="activeProjectMenuId === entry.key"
                            class="project-menu"
                            :style="activeProjectMenuStyle"
                            @click.stop
                            @pointerdown.stop
                            @mousedown.stop
                            @contextmenu.stop
                        >
                            <button type="button" @click.stop="openProjectEntry(entry)">打开</button>
                            <button type="button" @click.stop="renameProjectEntry(entry)">重命名</button>
                            <button
                                v-if="entry.kind === 'project'"
                                type="button"
                                @click.stop="enterProjectSelection(entry)"
                            >
                                {{ isProjectSelected(entry.key) ? '取消选择' : '选择' }}
                            </button>
                            <span v-if="entry.kind === 'project'" />
                            <button v-if="entry.kind === 'project'" type="button" @click.stop="openMoveDialog(entry)">移动至...</button>
                            <button v-if="entry.kind === 'project'" type="button" @click.stop="shareProjectEntry(entry)">分享链接</button>
                            <button
                                v-if="entry.kind === 'project' && activeProjectScope === 'personal'"
                                type="button"
                                @click.stop="moveProjectEntryToTeam(entry)"
                            >
                                移动至团队
                            </button>
                            <span />
                            <button type="button" @click.stop="removeProjectEntry(entry)">删除</button>
                        </div>
                        </Teleport>
                        <template v-if="entry.kind === 'folder'">
                            <div class="project-collection-pocket" aria-hidden="true"></div>
                            <div class="project-collection-meta">
                                <div class="project-name-row">
                                    <input
                                        v-if="renameEntryKey === entry.key"
                                        v-model="renameDraft"
                                        class="project-rename-input"
                                        type="text"
                                        maxlength="30"
                                        :disabled="renamingEntryKey === entry.key"
                                        @click.stop
                                        @pointerdown.stop
                                        @mousedown.stop
                                        @keydown.enter.prevent="submitRenameEntry"
                                        @keydown.esc.prevent="cancelRenameEntry"
                                        @blur="submitRenameEntry"
                                    />
                                    <button v-else type="button" @click.stop="handleProjectCardClick(entry)">
                                        <strong>{{ entry.name }}</strong>
                                    </button>
                                    <button type="button" title="重命名" @click.stop="renameProjectEntry(entry)">
                                        <el-icon><Edit /></el-icon>
                                    </button>
                                </div>
                                <small>{{ folderProjectCount(entry.id) }} 个项目</small>
                            </div>
                        </template>
                        <div v-else class="project-meta">
                            <div class="project-name-row">
                                <input
                                    v-if="renameEntryKey === entry.key"
                                    v-model="renameDraft"
                                    class="project-rename-input"
                                    type="text"
                                    maxlength="30"
                                    :disabled="renamingEntryKey === entry.key"
                                    @click.stop
                                    @pointerdown.stop
                                    @mousedown.stop
                                    @keydown.enter.prevent="submitRenameEntry"
                                    @keydown.esc.prevent="cancelRenameEntry"
                                    @blur="submitRenameEntry"
                                />
                                <button v-else type="button" @click.stop="handleProjectCardClick(entry)">
                                    <strong>{{ entry.name }}</strong>
                                </button>
                                <button type="button" title="重命名" @click.stop="renameProjectEntry(entry)">
                                    <el-icon><Edit /></el-icon>
                                </button>
                            </div>
                            <small>编辑于 {{ formatTapProjectTime(entry.updatedAt) }}</small>
                        </div>
                    </article>
                </div>

                <div v-else class="project-list">
                    <button v-if="false" class="project-list-create" type="button" @click="createBlank">
                        <span><el-icon><Plus /></el-icon></span>
                        <strong>新建项目</strong>
                    </button>
                    <div class="project-table">
                        <div class="project-table-head">
                            <span />
                            <span>预览</span>
                            <span>名称</span>
                            <span>类型</span>
                            <span>内容</span>
                            <span>创建时间</span>
                            <span>最近更新</span>
                            <span />
                        </div>
                        <div class="project-table-body">
                            <article
                                v-for="entry in projectEntries"
                                :key="entry.key"
                                class="project-row"
                                :data-project-entry-key="entry.key"
                                :class="{
                                    selected: isProjectSelected(entry.key),
                                    'is-selection-mode': projectSelectionMode,
                                    'is-drop-target': activeProjectDropTarget === entry.key,
                                    'is-dragging': draggingProjectId === entry.id
                                }"
                                :draggable="false"
                                @dragstart="handleProjectDragStart(entry, $event)"
                                @dragenter.prevent="handleProjectDragEnter(entry, $event)"
                                @dragover.prevent="handleProjectDragOver(entry, $event)"
                                @dragleave="handleProjectDragLeave(entry, $event)"
                                @drop.prevent="handleProjectDrop(entry, $event)"
                                @dragend="handleProjectDragEnd"
                                @pointerdown="handleProjectPointerDown(entry, $event)"
                                @mousedown="handleProjectMouseDown(entry, $event)"
                                @contextmenu.prevent="openProjectContextMenu(entry, $event)"
                                @click="handleProjectCardClick(entry)"
                            >
                                <button
                                    v-if="entry.kind === 'project'"
                                    class="project-row-select"
                                    type="button"
                                    title="选择"
                                    :class="{ checked: isProjectSelected(entry.key) }"
                                    @click.stop="toggleProjectSelection(entry.key)"
                                >
                                    <el-icon v-if="isProjectSelected(entry.key)"><Check /></el-icon>
                                </button>
                                <span v-else class="project-row-select-spacer" aria-hidden="true"></span>
                                <button
                                    class="project-row-thumb"
                                    :class="{ 'is-collection': entry.kind === 'folder' }"
                                    type="button"
                                    @click.stop="handleProjectCardClick(entry)"
                                >
                                    <template v-if="entry.kind === 'folder'">
                                        <span
                                            v-for="(cover, coverIndex) in folderCoverSet(entry.id)"
                                            :key="cover.id"
                                            class="project-row-collection-page"
                                            :class="`is-${coverIndex}`"
                                            :style="projectMarbleStyle(cover.id)"
                                        >
                                            <img
                                                v-if="coverPreviewImage(cover)"
                                                :src="coverPreviewImage(cover)"
                                                alt=""
                                                @error="markPreviewImageBroken(coverPreviewImageKey(cover))"
                                            />
                                        </span>
                                    </template>
                                    <template v-else>
                                        <img
                                            v-if="entryPreviewImage(entry)"
                                            :src="entryPreviewImage(entry)"
                                            alt=""
                                            @error="markPreviewImageBroken(entryPreviewImageKey(entry))"
                                        />
                                        <div v-else class="project-marble" :style="projectMarbleStyle(entry.id)" />
                                    </template>
                                </button>
                                <input
                                    v-if="renameEntryKey === entry.key"
                                    v-model="renameDraft"
                                    class="project-row-rename-input"
                                    type="text"
                                    maxlength="30"
                                    :disabled="renamingEntryKey === entry.key"
                                    @click.stop
                                    @pointerdown.stop
                                    @mousedown.stop
                                    @keydown.enter.prevent="submitRenameEntry"
                                    @keydown.esc.prevent="cancelRenameEntry"
                                    @blur="submitRenameEntry"
                                />
                                <button v-else class="project-row-name" type="button" @click.stop="handleProjectCardClick(entry)">
                                    <strong>{{ entry.name }}</strong>
                                </button>
                                <span class="project-row-type">{{ entry.typeLabel }}</span>
                                <span class="project-row-content">{{ entry.contentSummary }}</span>
                                <span class="project-row-date">{{ formatProjectDate(entry.createdAt) }}</span>
                                <span class="project-row-date">编辑于 {{ formatTapProjectTime(entry.updatedAt) }}</span>
                                <button
                                    v-if="!projectSelectionMode"
                                    class="project-row-more"
                                    :class="{ active: activeProjectMenuId === entry.key }"
                                    type="button"
                                    title="更多"
                                    @click.stop="toggleProjectMenu(entry.key, $event)"
                                >
                                    <el-icon><MoreFilled /></el-icon>
                                </button>
                                <Teleport to="body">
                                <div
                                    v-if="activeProjectMenuId === entry.key"
                                    class="project-menu is-row"
                                    :style="activeProjectMenuStyle"
                                    @click.stop
                                    @pointerdown.stop
                                    @mousedown.stop
                                    @contextmenu.stop
                                >
                                    <button type="button" @click.stop="openProjectEntry(entry)">打开</button>
                                    <button type="button" @click.stop="renameProjectEntry(entry)">重命名</button>
                                    <button
                                        v-if="entry.kind === 'project'"
                                        type="button"
                                        @click.stop="enterProjectSelection(entry)"
                                    >
                                        {{ isProjectSelected(entry.key) ? '取消选择' : '选择' }}
                                    </button>
                                    <span v-if="entry.kind === 'project'" />
                                    <button v-if="entry.kind === 'project'" type="button" @click.stop="openMoveDialog(entry)">移动至...</button>
                                    <button v-if="entry.kind === 'project'" type="button" @click.stop="shareProjectEntry(entry)">分享链接</button>
                                    <button
                                        v-if="entry.kind === 'project' && activeProjectScope === 'personal'"
                                        type="button"
                                        @click.stop="moveProjectEntryToTeam(entry)"
                                    >
                                        移动至团队
                                    </button>
                                    <span />
                                    <button type="button" @click.stop="removeProjectEntry(entry)">删除</button>
                                </div>
                                </Teleport>
                            </article>
                            <template v-if="loading">
                                <article v-for="index in 3" :key="`list-skeleton-${index}`" class="project-row project-row-skeleton">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </article>
                            </template>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <Teleport to="body">
        <div v-if="projectSelectionMode" class="project-bulk-bar">
            <button type="button" title="取消选择" @click="clearProjectSelection">
                <el-icon><Close /></el-icon>
            </button>
            <strong>已选择 {{ selectedProjectCount }} 个画布</strong>
            <div class="project-bulk-actions">
                <button type="button" title="添加到文件夹" @click="openBatchMoveDialog">
                    <el-icon><FolderAdd /></el-icon>
                </button>
                <button
                    v-if="activeProjectScope === 'personal'"
                    type="button"
                    title="移动至团队"
                    @click="moveSelectedProjectsToTeam"
                >
                    <el-icon><User /></el-icon>
                </button>
                <button type="button" title="删除" @click="removeSelectedProjects">
                    <el-icon><DeleteIcon /></el-icon>
                </button>
            </div>
        </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import {
    ArrowDown,
    ArrowLeft,
    Check,
    Close,
    Delete as DeleteIcon,
    Document,
    Edit,
    Folder,
    FolderAdd,
    Grid,
    List,
    MoreFilled,
    Plus,
    Search,
    User
} from '@element-plus/icons-vue'
import { getAigcCanvasConfig } from '@/apps/aigc_canvas/api'
import CanvasAccountActions from '@/apps/aigc_canvas/components/CanvasAccountActions.vue'
import CanvasAgentPanel from '@/apps/aigc_canvas/components/agent/CanvasAgentPanel.vue'
import {
    createCanvasProject,
    createRemoteCanvasProject,
    deleteRemoteCanvasProject,
    formatProjectTime,
    importLocalCanvasProjectsToRemote,
    loadCanvasProjects,
    loadCanvasProjectsRemote,
    renameRemoteCanvasProject,
    saveCanvasProjects
} from '@/apps/aigc_canvas/stores/projects'
import type { CanvasNodeData, CanvasProject } from '@/apps/aigc_canvas/types'
import { getAigcImageConfig } from '@/apps/aigc_image/api'
import { getAigcVideoConfig } from '@/apps/aigc_video/api'
import { useUserStore } from '@/stores/user'
import feedback from '@/utils/feedback'
import { resolveToolDisplayName } from '@/apps/useToolDisplayName'
import AiWorkspaceAssetGalleryModal from '~/components/ai-workspace/asset-gallery-modal.vue'

definePageMeta({ layout: 'blank', auth: false })

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const projects = ref<CanvasProject[]>([])
const loading = ref(false)
const appConfig = ref<any>({})
const remoteAvailable = ref(false)
const projectKeyword = ref('')
const activeProjectScope = ref<ProjectScope>('personal')
const activeFolderId = ref('')
const projectViewMode = ref<'grid' | 'list'>('grid')
const projectFilterIndex = ref(0)
const projectFilterOpen = ref(false)
const projectFilterMenuStyle = ref<CSSProperties>({})
const projectSortBy = ref<ProjectSortBy>('updated')
const projectSortOrder = ref<ProjectSortOrder>('desc')
const activeProjectMenuId = ref('')
const activeProjectMenuStyle = ref<CSSProperties>({})
const selectedProjectIds = ref(new Set<string>())
const projectFolders = ref<ProjectFolder[]>([])
const projectFolderMap = ref<Record<string, string>>({})
const teamProjectIds = ref(new Set<string>())
const moveDialogVisible = ref(false)
const moveDialogEntry = ref<ProjectEntry | null>(null)
const moveTargetFolderId = ref('')
const moveNewFolderName = ref('未命名文件夹')
const renameEntryKey = ref('')
const renameDraft = ref('')
const renamingEntryKey = ref('')
const deleteDialog = ref<DeleteDialogState | null>(null)
const deleteDialogSubmitting = ref(false)
const teamMoveDialog = ref<TeamMoveDialogState | null>(null)
const teamMoveDialogSubmitting = ref(false)
const shareToast = ref<ShareToastState | null>(null)
const draggingProjectId = ref('')
const activeProjectDropTarget = ref('')
const brokenPreviewImages = ref(new Set<string>())
let suppressProjectClickUntil = 0
let shareToastTimer: ReturnType<typeof setTimeout> | null = null
const PROJECT_DRAG_START_DISTANCE = 18
let projectPointerDrag:
    | {
          projectId: string
          startX: number
          startY: number
          pointerId: number
          active: boolean
      }
    | null = null
let projectMouseDrag:
    | {
          projectId: string
          startX: number
          startY: number
          active: boolean
      }
    | null = null
const MOVE_ROOT_TARGET_ID = '__root__'
const PROJECT_FLOATING_Z_INDEX = 15020
const projectFilters = [
    { label: '显示全部', value: 'all' },
    { label: '仅文件夹', value: 'folders' },
    { label: '仅项目', value: 'projects' }
] as const
const PROJECT_ORG_STORAGE_KEY = 'likeadmin-aigc-canvas-project-org'
type ProjectScope = 'personal' | 'team'
type ProjectSortBy = 'updated' | 'created'
type ProjectSortOrder = 'desc' | 'asc'
type ProjectFolder = {
    id: string
    name: string
    scope: ProjectScope
    createdAt: number
    updatedAt: number
}
type ProjectEntry = {
    key: string
    id: string
    kind: 'project' | 'folder'
    name: string
    thumbnail: string
    typeLabel: string
    contentSummary: string
    createdAt: number
    updatedAt: number
    project?: CanvasProject
    folder?: ProjectFolder
}
type DeleteDialogState = {
    kind: 'project' | 'folder' | 'batch'
    title: string
    message: string
    confirmLabel: string
    projectIds: string[]
    subjectName?: string
    deleteCount?: number
    folderId?: string
}
type TeamMoveDialogState = {
    title: string
    message: string
    projectIds: string[]
    teamName?: string
    projectCount?: number
}
type ShareToastState = {
    title: string
    description: string
}
type ProjectCover = {
    id: string
    thumbnail: string
}
type HomeComposerMode = 'agent' | 'image' | 'video'
type HomeAssetType = 'image' | 'video' | 'audio'
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
type HomeComposerSubmitPayload = {
    draft: string
    mode: HomeComposerMode
    selectedSkill: string
    selectedSkillPrompt: string
    attachments: any[]
    imageConfig: Record<string, any>
    videoConfig: Record<string, any>
}
const toolDisplayName = computed(() => resolveToolDisplayName(appConfig.value, '无限画布'))
const homeAgentPanelRef = ref<any>(null)
const showHomeAssetGallery = ref(false)
const homeAssetGalleryAcceptTypes = ref<HomeAssetType[]>(['image', 'video'])
const imageOptionConfig = ref<any>({
    channels: [],
    defaults: { channel: 'gpt_image_2', quality: '1k', ratio: '1:1', quantity: 1 },
    quantity_options: [1]
})
const videoOptionConfig = ref<any>({
    channels: [],
    defaults: {
        channel: 'seedance2_pro',
        resolution: '',
        quality: '',
        ratio: 'adaptive',
        duration: 5,
        mode: 'pro',
        quantity: 1
    },
    quantity_options: [1]
})
const agentImageConfig = ref<Record<string, any>>({})
const agentVideoConfig = ref<Record<string, any>>({})
const homeCanvasSnapshot = computed(() => ({
    project: { id: 'home', name: toolDisplayName.value },
    selected_elements: []
}))
const agentImageOptions = computed(() => buildHomeImageOptions(agentImageConfig.value))
const agentVideoOptions = computed(() => buildHomeVideoOptions(agentVideoConfig.value))
const currentProjectFilter = computed(() => projectFilters[projectFilterIndex.value] || projectFilters[0])
const currentProjectFilterLabel = computed(() => currentProjectFilter.value.label)
const projectSortOptions: Array<{ label: string; value: ProjectSortBy }> = [
    { label: '按最近修改', value: 'updated' },
    { label: '按创建日期', value: 'created' }
]
const projectSortOrders: Array<{ label: string; value: ProjectSortOrder }> = [
    { label: '最新优先', value: 'desc' },
    { label: '最早优先', value: 'asc' }
]
const currentFolder = computed(
    () => projectFolders.value.find((folder) => folder.id === activeFolderId.value) || null
)
const selectedProjectCount = computed(() => selectedCanvasProjects.value.length)
const projectSelectionMode = computed(() => selectedProjectCount.value > 0)
const selectedProjectEntries = computed(() =>
    selectedCanvasProjects.value.map(projectToEntry)
)
const selectedCanvasProjects = computed(() =>
    projects.value.filter((project) => selectedProjectIds.value.has(entryKey('project', project.id)))
)
const availableMoveFolders = computed(() =>
    projectFolders.value.filter(
        (folder) => folder.scope === activeProjectScope.value && folder.id !== activeFolderId.value
    )
)
const moveDialogProjectCount = computed(() => moveProjectIdsForEntry(moveDialogEntry.value).length)
const projectEntries = computed<ProjectEntry[]>(() => {
    const keyword = projectKeyword.value.trim().toLowerCase()
    const folders = activeFolderId.value
        ? []
        : projectFolders.value
              .filter((folder) => folder.scope === activeProjectScope.value)
              .map(folderToEntry)
    const projectItems = projects.value
        .filter(projectInCurrentScope)
        .map(projectToEntry)
    return [...folders, ...projectItems]
        .filter((entry) => {
            if (!keyword) return true
            return `${entry.name} ${entry.typeLabel} ${entry.contentSummary}`.toLowerCase().includes(keyword)
        })
        .filter((entry) => {
            if (activeFolderId.value) return true
            if (currentProjectFilter.value.value === 'folders') return entry.kind === 'folder'
            if (currentProjectFilter.value.value === 'projects') return entry.kind === 'project'
            return true
        })
        .sort((a, b) => {
            const key = projectSortBy.value === 'created' ? 'createdAt' : 'updatedAt'
            const diff = Number(a[key] || 0) - Number(b[key] || 0)
            return projectSortOrder.value === 'asc' ? diff : -diff
        })
})

let previousHtmlOverflowY = ''
let previousBodyOverflowY = ''
let previousBodyOverflowX = ''
let previousHtmlHeight = ''
let previousBodyHeight = ''
let previousBodyPosition = ''
let previousBodyTop = ''
let previousBodyLeft = ''
let previousBodyRight = ''
let previousBodyWidth = ''
let previousScrollRestoration: ScrollRestoration | '' = ''
let homeScrollPinFrame = 0
const HOME_SCROLL_LOCK_CLASS = 'aigc-canvas-home-scroll-lock'

useHead({
    htmlAttrs: { class: HOME_SCROLL_LOCK_CLASS },
    bodyAttrs: { class: HOME_SCROLL_LOCK_CLASS }
})

function resetHomeScroll() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    window.scrollTo({ top: 0, left: 0 })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.scrollingElement?.scrollTo({ top: 0, left: 0 })
    document.querySelector<HTMLElement>('.canvas-home')?.scrollTo({ top: 0, left: 0 })
}

function pinHomeScrollForFirstFrames(frames = 8) {
    if (typeof window === 'undefined') return
    cancelAnimationFrame(homeScrollPinFrame)
    let remainingFrames = frames
    const pin = () => {
        resetHomeScroll()
        remainingFrames -= 1
        if (remainingFrames > 0) {
            homeScrollPinFrame = requestAnimationFrame(pin)
        }
    }
    homeScrollPinFrame = requestAnimationFrame(pin)
}

function keepHomeWindowPinned(event?: Event) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const target = event?.target
    if (
        target &&
        target !== window &&
        target !== document &&
        target !== document.documentElement &&
        target !== document.body
    ) {
        return
    }
    const scrollTop =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        document.scrollingElement?.scrollTop ||
        0
    if (scrollTop <= 0) return
    resetHomeScroll()
}

function lockHomePageScroll() {
    if (typeof document === 'undefined') return
    previousHtmlOverflowY = document.documentElement.style.overflowY
    previousBodyOverflowY = document.body.style.overflowY
    previousBodyOverflowX = document.body.style.overflowX
    previousHtmlHeight = document.documentElement.style.height
    previousBodyHeight = document.body.style.height
    previousBodyPosition = document.body.style.position
    previousBodyTop = document.body.style.top
    previousBodyLeft = document.body.style.left
    previousBodyRight = document.body.style.right
    previousBodyWidth = document.body.style.width
    previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    resetHomeScroll()
    document.documentElement.style.overflowY = 'hidden'
    document.body.style.overflowY = 'hidden'
    document.body.style.overflowX = 'hidden'
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'
    document.body.style.position = 'fixed'
    document.body.style.top = '0'
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.documentElement.classList.add(HOME_SCROLL_LOCK_CLASS)
    document.body.classList.add(HOME_SCROLL_LOCK_CLASS)
    requestAnimationFrame(() => {
        resetHomeScroll()
    })
}

function restoreHomePageScroll() {
    if (typeof document === 'undefined') return
    document.documentElement.classList.remove(HOME_SCROLL_LOCK_CLASS)
    document.body.classList.remove(HOME_SCROLL_LOCK_CLASS)
    document.documentElement.style.overflowY = previousHtmlOverflowY
    document.body.style.overflowY = previousBodyOverflowY
    document.body.style.overflowX = previousBodyOverflowX
    document.documentElement.style.height = previousHtmlHeight
    document.body.style.height = previousBodyHeight
    document.body.style.position = previousBodyPosition
    document.body.style.top = previousBodyTop
    document.body.style.left = previousBodyLeft
    document.body.style.right = previousBodyRight
    document.body.style.width = previousBodyWidth
    if (previousScrollRestoration) {
        window.history.scrollRestoration = previousScrollRestoration
    }
}

function currentProjectScroller() {
    if (typeof document === 'undefined') return null
    return document.querySelector<HTMLElement>(
        projectViewMode.value === 'list' ? '.project-table-body' : '.project-grid'
    )
}

function handleHomeWheel(event: WheelEvent) {
    if (!event.deltaY) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
        target.closest(
            '.project-grid,.project-list,.project-dialog,.project-menu,.project-filter-menu,[data-agent-popover],textarea,input'
        )
    ) {
        return
    }
    const scroller = currentProjectScroller()
    if (!scroller) return
    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight
    if (maxScrollTop <= 0) return
    event.preventDefault()
    scroller.scrollTop = Math.max(0, Math.min(maxScrollTop, scroller.scrollTop + event.deltaY))
}

function handleHomeTouchMove(event: TouchEvent) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
        target.closest(
            '.project-grid,.project-list,.project-dialog,.project-menu,.project-filter-menu,[data-agent-popover],textarea,input'
        )
    ) {
        return
    }
    event.preventDefault()
}

function entryKey(kind: ProjectEntry['kind'], id: string | number) {
    return `${kind}:${id}`
}

function folderToEntry(folder: ProjectFolder): ProjectEntry {
    const updatedAt = normalizeProjectDisplayTime(folder.updatedAt)
    const createdAt = normalizeProjectDisplayTime(folder.createdAt) || updatedAt
    return {
        key: entryKey('folder', folder.id),
        id: folder.id,
        kind: 'folder',
        name: folder.name,
        thumbnail: '',
        typeLabel: '文件夹',
        contentSummary: `${folderProjectCount(folder.id)} 个项目`,
        createdAt,
        updatedAt,
        folder
    }
}

function projectToEntry(project: CanvasProject): ProjectEntry {
    const activityAt = projectActivityTime(project)
    const updatedAt = normalizeProjectDisplayTime(project.updatedAt) || activityAt
    const createdAt = normalizeProjectDisplayTime(project.createdAt) || updatedAt
    return {
        key: entryKey('project', project.id),
        id: String(project.id),
        kind: 'project',
        name: project.name,
        thumbnail: projectPreviewUrl(project),
        typeLabel: '项目',
        contentSummary: projectContentSummary(project),
        createdAt,
        updatedAt,
        project
    }
}

function projectInCurrentScope(project: CanvasProject) {
    const id = String(project.id)
    const inTeam = teamProjectIds.value.has(id)
    if (activeProjectScope.value === 'team' && !inTeam) return false
    if (activeProjectScope.value === 'personal' && inTeam) return false
    const folderId = projectFolderMap.value[id] || ''
    return activeFolderId.value ? folderId === activeFolderId.value : !folderId
}

function folderProjectCount(folderId: string) {
    return projects.value.filter((project) => projectFolderMap.value[String(project.id)] === folderId).length
}

function projectNodeImageUrl(node: CanvasNodeData) {
    return String(
        node.metadata?.image ||
            node.metadata?.url ||
            node.metadata?.preview_url ||
            node.metadata?.thumbnail ||
            node.metadata?.cover ||
            ''
    ).trim()
}

function isGeneratedImageNode(node: CanvasNodeData) {
    const metadata = node.metadata || {}
    const source = String(metadata.source || metadata.mediaSource || '').toLowerCase()
    return (
        String(node.type) === 'image' &&
        projectNodeImageUrl(node) &&
        (!!metadata.generatedAt || ['generated', 'agent'].includes(source))
    )
}

function projectNodeSortTime(node: CanvasNodeData, fallbackIndex: number) {
    const metadata = node.metadata || {}
    const time = Number(metadata.generatedAt || metadata.createdAt || metadata.updatedAt || 0)
    return Number.isFinite(time) && time > 0 ? time : fallbackIndex
}

function projectPreviewUrl(project: CanvasProject) {
    const nodes = Array.isArray(project.nodes) ? project.nodes : []
    const firstGeneratedImage = nodes
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => isGeneratedImageNode(node))
        .sort(
            (a, b) =>
                projectNodeSortTime(a.node, a.index) - projectNodeSortTime(b.node, b.index) ||
                a.index - b.index
        )[0]
    const generatedUrl = firstGeneratedImage ? projectNodeImageUrl(firstGeneratedImage.node) : ''
    if (generatedUrl) return generatedUrl

    const direct = String(project.thumbnail || '').trim()
    if (direct) return direct
    const media = nodes
        .filter((node) => ['image', 'video'].includes(String(node.type)))
        .map((node) => ({
            url: String(node.metadata?.image || node.metadata?.poster || node.metadata?.url || '').trim(),
            updatedAt: Number(node.metadata?.updatedAt || 0)
        }))
        .filter((item) => item.url)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    return media?.url || ''
}

function folderCoverSet(folderId: string): ProjectCover[] {
    const covers = projects.value
        .filter((project) => projectFolderMap.value[String(project.id)] === folderId)
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
        .slice(0, 3)
        .map((project) => ({
            id: String(project.id),
            thumbnail: projectPreviewUrl(project)
        }))
    return [0, 1, 2].map((index) => covers[index] || { id: `${folderId}_${index}`, thumbnail: '' })
}

function entryPreviewImageKey(entry: ProjectEntry) {
    return `${entry.key}::${entry.thumbnail}`
}

function coverPreviewImageKey(cover: ProjectCover) {
    return `${cover.id}::${cover.thumbnail}`
}

function entryPreviewImage(entry: ProjectEntry) {
    return entry.thumbnail && !brokenPreviewImages.value.has(entryPreviewImageKey(entry)) ? entry.thumbnail : ''
}

function coverPreviewImage(cover: ProjectCover) {
    return cover.thumbnail && !brokenPreviewImages.value.has(coverPreviewImageKey(cover)) ? cover.thumbnail : ''
}

function markPreviewImageBroken(key: string) {
    if (!key || brokenPreviewImages.value.has(key)) return
    brokenPreviewImages.value = new Set([...brokenPreviewImages.value, key])
}

function projectMarbleStyle(seed: string | number): CSSProperties {
    const palettes = [
        ['#3e3e41', '#3f66a2', '#567ebb', '#606d80', '#a3a7ae'],
        ['#2b3038', '#496078', '#9aa5b2', '#c8ced3', '#626a73'],
        ['#262729', '#39465b', '#607899', '#a8b0bb', '#d1d4d8'],
        ['#1f2528', '#4b5b63', '#8c969b', '#c5cbcb', '#59666b']
    ]
    const text = String(seed || 'project')
    const hash = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const colors = palettes[hash % palettes.length]
    return {
        '--marble-a': colors[0],
        '--marble-b': colors[1],
        '--marble-c': colors[2],
        '--marble-d': colors[3],
        '--marble-e': colors[4]
    } as CSSProperties
}

function loadProjectOrg() {
    if (typeof window === 'undefined') return
    try {
        const raw = localStorage.getItem(PROJECT_ORG_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        projectFolders.value = Array.isArray(parsed?.folders)
            ? parsed.folders
                  .map((folder: any) => ({
                      id: String(folder?.id || ''),
                      name: String(folder?.name || '未命名文件夹'),
                      scope: folder?.scope === 'team' ? 'team' : 'personal',
                      createdAt: Number(folder?.createdAt || Date.now()),
                      updatedAt: Number(folder?.updatedAt || Date.now())
                  }))
                  .filter((folder: ProjectFolder) => folder.id)
            : []
        projectFolderMap.value = parsed?.projectFolderMap && typeof parsed.projectFolderMap === 'object'
            ? Object.fromEntries(
                  Object.entries(parsed.projectFolderMap)
                      .map(([projectId, folderId]) => [String(projectId), String(folderId || '')])
                      .filter(([, folderId]) => folderId)
              )
            : {}
        teamProjectIds.value = new Set(
            Array.isArray(parsed?.teamProjectIds)
                ? parsed.teamProjectIds.map((id: any) => String(id)).filter(Boolean)
                : []
        )
    } catch {
        projectFolders.value = []
        projectFolderMap.value = {}
        teamProjectIds.value = new Set()
    }
}

function persistProjectOrg() {
    if (typeof window === 'undefined') return
    localStorage.setItem(
        PROJECT_ORG_STORAGE_KEY,
        JSON.stringify({
            folders: projectFolders.value,
            projectFolderMap: projectFolderMap.value,
            teamProjectIds: Array.from(teamProjectIds.value)
        })
    )
}

function placeProjectInCurrentContext(id: string | number) {
    const projectId = String(id)
    if (activeProjectScope.value === 'team') {
        const next = new Set(teamProjectIds.value)
        next.add(projectId)
        teamProjectIds.value = next
    }
    if (activeFolderId.value) {
        projectFolderMap.value = {
            ...projectFolderMap.value,
            [projectId]: activeFolderId.value
        }
        bumpFolderUpdatedAt(activeFolderId.value)
    }
    persistProjectOrg()
}

function bumpFolderUpdatedAt(folderId: string) {
    if (!folderId) return
    const now = Date.now()
    projectFolders.value = projectFolders.value.map((folder) =>
        folder.id === folderId ? { ...folder, updatedAt: now } : folder
    )
}

function isRemoteProjectId(id: string | number) {
    return /^\d+$/.test(String(id))
}

function persist() {
    saveCanvasProjects(projects.value)
}

async function loadProjects() {
    if (!userStore.isLogin) {
        remoteAvailable.value = false
        projects.value = loadCanvasProjects()
        return
    }
    loading.value = true
    try {
        try {
            projects.value = await loadCanvasProjectsRemote()
            remoteAvailable.value = true
            const localProjects = loadCanvasProjects()
            if (!projects.value.length && localProjects.length && !localStorage.getItem('likeadmin-aigc-canvas-remote-imported')) {
                const imported = await importLocalCanvasProjectsToRemote(localProjects)
                if (imported.length) {
                    projects.value = imported
                    localStorage.setItem('likeadmin-aigc-canvas-remote-imported', '1')
                }
            }
        } catch {
            remoteAvailable.value = false
            projects.value = loadCanvasProjects()
        }
    } finally {
        loading.value = false
    }
}

async function createFromComposer(payload: HomeComposerSubmitPayload) {
    const content = String(payload.draft || '').trim()
    if (!content) return
    const name = content ? content.slice(0, 18) : '未命名工作区'
    const data: Record<string, any> = {}
    let project: CanvasProject
    try {
        project = remoteAvailable.value && userStore.isLogin ? await createRemoteCanvasProject(name, data) : createCanvasProject(name, data)
    } catch {
        remoteAvailable.value = false
        project = createCanvasProject(name, data)
    }
    projects.value = [project, ...projects.value.filter((item) => item.id !== project.id)]
    persist()
    placeProjectInCurrentContext(project.id)
    if (content) {
        sessionStorage.setItem('ai-canvas-initial-prompt', content)
        sessionStorage.setItem('aigc-canvas-home-composer', JSON.stringify({
            projectId: project.id,
            draft: content,
            mode: payload.mode,
            selectedSkill: payload.selectedSkill,
            selectedSkillPrompt: payload.selectedSkillPrompt,
            attachments: payload.attachments || [],
            imageConfig: payload.imageConfig || {},
            videoConfig: payload.videoConfig || {}
        }))
    }
    router.push(`/app/aigc_canvas/project/${project.id}`)
}

async function createBlank() {
    const name = await inputProjectName('新建项目', '未命名工作区')
    if (!name) return
    let project: CanvasProject
    try {
        project = remoteAvailable.value && userStore.isLogin ? await createRemoteCanvasProject(name) : createCanvasProject(name)
    } catch {
        remoteAvailable.value = false
        project = createCanvasProject(name)
    }
    projects.value = [project, ...projects.value.filter((item) => item.id !== project.id)]
    persist()
    placeProjectInCurrentContext(project.id)
    router.push(`/app/aigc_canvas/project/${project.id}`)
}

function selectProjectScope(scope: ProjectScope) {
    if (scope === 'team') {
        notifyTeamFeaturePending()
        return
    }
    activeProjectScope.value = scope
    setActiveFolder('')
    clearProjectSelection()
    closeProjectFloatingMenus()
}

function replaceHomeFolderQuery(folderId: string) {
    const nextQuery = { ...route.query }
    if (folderId) nextQuery.folder = folderId
    else delete nextQuery.folder
    router.replace({ path: route.path, query: nextQuery }).catch(() => {})
}

function setActiveFolder(folderId: string, syncRoute = true) {
    activeFolderId.value = folderId
    if (folderId) projectFilterIndex.value = 0
    clearProjectSelection()
    closeProjectFloatingMenus()
    if (syncRoute) replaceHomeFolderQuery(folderId)
}

function hydrateActiveFolderFromRoute() {
    const folderId = String(route.query.folder || '').trim()
    if (!folderId) {
        activeFolderId.value = ''
        return
    }
    const folder = projectFolders.value.find((item) => item.id === folderId)
    if (!folder) {
        activeFolderId.value = ''
        replaceHomeFolderQuery('')
        return
    }
    activeProjectScope.value = folder.scope
    activeFolderId.value = folder.id
    projectFilterIndex.value = 0
}

function openProject(id: string) {
    closeProjectFloatingMenus()
    clearProjectSelection()
    const targetPath = `/app/aigc_canvas/project/${encodeURIComponent(id)}`
    if (route.path === targetPath) return
    router.push({ path: targetPath }).catch(() => {})
}

function openProjectEntry(entry: ProjectEntry) {
    closeProjectFloatingMenus()
    if (entry.kind === 'folder') {
        setActiveFolder(entry.id)
        return
    }
    openProject(entry.id)
}

function handleProjectCardClick(entry: ProjectEntry) {
    if (Date.now() < suppressProjectClickUntil || projectPointerDrag?.active || projectMouseDrag?.active) {
        projectPointerDrag = null
        projectMouseDrag = null
        handleProjectDragEnd()
        return
    }
    projectPointerDrag = null
    projectMouseDrag = null
    handleProjectDragEnd()
    if (projectSelectionMode.value) {
        if (entry.kind === 'project') toggleProjectSelection(entry.key)
        return
    }
    clearProjectSelection()
    openProjectEntry(entry)
}

function canDragProjectEntry(entry: ProjectEntry) {
    return entry.kind === 'project' && !projectSelectionMode.value && !loading.value
}

function canDropProjectOnEntry(entry: ProjectEntry) {
    if (!draggingProjectId.value || entry.id === draggingProjectId.value) return false
    if (entry.kind === 'folder') return true
    return entry.kind === 'project' && !activeFolderId.value
}

function handleProjectDragStart(entry: ProjectEntry, event: DragEvent) {
    if (!canDragProjectEntry(entry)) {
        event.preventDefault()
        return
    }
    closeProjectFloatingMenus()
    draggingProjectId.value = entry.id
    activeProjectDropTarget.value = ''
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', entry.id)
    }
}

function handleProjectDragEnter(entry: ProjectEntry, event: DragEvent) {
    if (!canDropProjectOnEntry(entry)) return
    event.preventDefault()
    activeProjectDropTarget.value = entry.key
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
    }
}

function handleProjectDragOver(entry: ProjectEntry, event: DragEvent) {
    if (!canDropProjectOnEntry(entry)) return
    event.preventDefault()
    activeProjectDropTarget.value = entry.key
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
    }
}

function handleProjectDragLeave(entry: ProjectEntry, event: DragEvent) {
    if (activeProjectDropTarget.value !== entry.key) return
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget instanceof HTMLElement) {
        if (event.currentTarget.contains(relatedTarget)) return
    }
    activeProjectDropTarget.value = ''
}

function handleProjectDrop(entry: ProjectEntry, event: DragEvent) {
    event.preventDefault()
    const projectId = draggingProjectId.value || event.dataTransfer?.getData('text/plain') || ''
    const source = projects.value.find((project) => String(project.id) === String(projectId))
    if (!source || !canDropProjectOnEntry(entry)) {
        handleProjectDragEnd()
        return
    }
    suppressProjectClickUntil = Date.now() + 350
    if (entry.kind === 'folder') {
        moveProjectsToFolder([String(source.id)], entry.id, true)
    } else {
        createCollectionFromProjectDrop(source, entry)
    }
    handleProjectDragEnd()
}

function handleProjectDragEnd() {
    draggingProjectId.value = ''
    activeProjectDropTarget.value = ''
}

function handleProjectPointerDown(entry: ProjectEntry, event: PointerEvent) {
    if (!canDragProjectEntry(entry) || event.button !== 0) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button,input,textarea,[data-agent-popover]')) return
    projectMouseDrag = null
    projectPointerDrag = {
        projectId: entry.id,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        active: false
    }
}

function projectEntryFromPoint(x: number, y: number) {
    if (typeof document === 'undefined') return null
    const element = document.elementFromPoint(x, y)
    const card = element?.closest<HTMLElement>('[data-project-entry-key]')
    const key = card?.dataset.projectEntryKey
    return key ? projectEntries.value.find((entry) => entry.key === key) || null : null
}

function handleProjectPointerMove(event: PointerEvent) {
    if (!projectPointerDrag || event.pointerId !== projectPointerDrag.pointerId) return
    const dx = event.clientX - projectPointerDrag.startX
    const dy = event.clientY - projectPointerDrag.startY
    const moved = Math.hypot(dx, dy)
    if (!projectPointerDrag.active && moved < PROJECT_DRAG_START_DISTANCE) return
    projectPointerDrag.active = true
    draggingProjectId.value = projectPointerDrag.projectId
    suppressProjectClickUntil = Date.now() + 350
    const targetEntry = projectEntryFromPoint(event.clientX, event.clientY)
    activeProjectDropTarget.value =
        targetEntry && canDropProjectOnEntry(targetEntry) ? targetEntry.key : ''
}

function handleProjectPointerUp(event: PointerEvent) {
    if (!projectPointerDrag || event.pointerId !== projectPointerDrag.pointerId) return
    const wasActive = projectPointerDrag.active
    const projectId = projectPointerDrag.projectId
    projectPointerDrag = null
    if (!wasActive) return
    suppressProjectClickUntil = Date.now() + 350
    const source = projects.value.find((project) => String(project.id) === String(projectId))
    const targetEntry = projectEntryFromPoint(event.clientX, event.clientY)
    if (source && targetEntry && canDropProjectOnEntry(targetEntry)) {
        if (targetEntry.kind === 'folder') {
            moveProjectsToFolder([String(source.id)], targetEntry.id, true)
        } else {
            createCollectionFromProjectDrop(source, targetEntry)
        }
    }
    handleProjectDragEnd()
}

function handleProjectPointerCancel(event: PointerEvent) {
    if (!projectPointerDrag || event.pointerId !== projectPointerDrag.pointerId) return
    projectPointerDrag = null
    handleProjectDragEnd()
}

function handleProjectMouseDown(entry: ProjectEntry, event: MouseEvent) {
    if (!canDragProjectEntry(entry) || event.button !== 0 || projectPointerDrag) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button,input,textarea,[data-agent-popover]')) return
    projectMouseDrag = {
        projectId: entry.id,
        startX: event.clientX,
        startY: event.clientY,
        active: false
    }
}

function handleProjectMouseMove(event: MouseEvent) {
    if (!projectMouseDrag || projectPointerDrag) return
    const dx = event.clientX - projectMouseDrag.startX
    const dy = event.clientY - projectMouseDrag.startY
    const moved = Math.hypot(dx, dy)
    if (!projectMouseDrag.active && moved < PROJECT_DRAG_START_DISTANCE) return
    projectMouseDrag.active = true
    draggingProjectId.value = projectMouseDrag.projectId
    suppressProjectClickUntil = Date.now() + 350
    const targetEntry = projectEntryFromPoint(event.clientX, event.clientY)
    activeProjectDropTarget.value =
        targetEntry && canDropProjectOnEntry(targetEntry) ? targetEntry.key : ''
}

function handleProjectMouseUp(event: MouseEvent) {
    if (!projectMouseDrag || projectPointerDrag) return
    const wasActive = projectMouseDrag.active
    const projectId = projectMouseDrag.projectId
    projectMouseDrag = null
    if (!wasActive) return
    suppressProjectClickUntil = Date.now() + 350
    const source = projects.value.find((project) => String(project.id) === String(projectId))
    const targetEntry = projectEntryFromPoint(event.clientX, event.clientY)
    if (source && targetEntry && canDropProjectOnEntry(targetEntry)) {
        if (targetEntry.kind === 'folder') {
            moveProjectsToFolder([String(source.id)], targetEntry.id, true)
        } else {
            createCollectionFromProjectDrop(source, targetEntry)
        }
    }
    handleProjectDragEnd()
}

function handleProjectMouseCancel() {
    projectMouseDrag = null
    handleProjectDragEnd()
}

function handleProjectKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    if (teamMoveDialog.value) {
        event.preventDefault()
        event.stopPropagation()
        closeTeamMoveDialog()
        return
    }
    if (deleteDialog.value) {
        event.preventDefault()
        event.stopPropagation()
        closeDeleteDialog()
        return
    }
    if (renameEntryKey.value) {
        event.preventDefault()
        event.stopPropagation()
        cancelRenameEntry()
        return
    }
    if (activeProjectMenuId.value || projectFilterOpen.value) {
        event.preventDefault()
        event.stopPropagation()
        closeProjectFloatingMenus()
        return
    }
    if (!projectSelectionMode.value) return
    event.preventDefault()
    event.stopPropagation()
    clearProjectSelection()
}

function handleProjectDocumentPointerDown(event: PointerEvent) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
        target.closest(
            '.project-menu,.project-filter-menu,.project-more,.project-row-more,.project-filter,.project-dialog,.project-bulk-bar,.project-rename-input,.project-row-rename-input'
        )
    ) {
        return
    }
    closeProjectFloatingMenus()
}

function moveProjectsToFolder(ids: string[], folderId: string, notify = false) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (!uniqueIds.length) return
    const folder = projectFolders.value.find((item) => item.id === folderId)
    if (!folder) return
    const nextMap = { ...projectFolderMap.value }
    uniqueIds.forEach((id) => {
        nextMap[id] = folderId
    })
    projectFolderMap.value = nextMap
    bumpFolderUpdatedAt(folderId)
    persistProjectOrg()
    clearProjectSelection()
    if (notify) feedback.msgSuccess(`${uniqueIds.length} 个项目已移入文件夹`)
}

function createCollectionFromProjectDrop(source: CanvasProject, target: ProjectEntry) {
    if (target.kind !== 'project' || source.id === target.id || activeFolderId.value) return
    const ids = [String(source.id), target.id]
    const folder = createProjectFolder('未命名文件夹', ids)
    projectSortBy.value = 'updated'
    projectSortOrder.value = 'desc'
    projectFilterIndex.value = 0
    feedback.msgSuccess('已创建文件夹')
    activeProjectDropTarget.value = entryKey('folder', folder.id)
}

function floatingMenuStyle(
    target?: EventTarget | null,
    width = 132,
    estimatedHeight = 280,
    preferBelow = true
): CSSProperties {
    if (!(target instanceof HTMLElement) || typeof window === 'undefined') return {}
    const gap = 4
    const padding = 8
    const rect = target.getBoundingClientRect()
    const menuWidth = Math.max(112, Math.min(width, window.innerWidth - padding * 2))
    const left = Math.min(
        Math.max(padding, rect.left + rect.width / 2 - menuWidth / 2),
        Math.max(padding, window.innerWidth - menuWidth - padding)
    )
    const above = rect.top - padding - gap
    const below = window.innerHeight - rect.bottom - padding - gap
    const placeBelow = preferBelow
        ? below >= estimatedHeight || below >= above
        : above < estimatedHeight && below > above
    return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        right: 'auto',
        top: placeBelow ? `${Math.round(rect.bottom + gap)}px` : 'auto',
        bottom: placeBelow ? 'auto' : `${Math.round(window.innerHeight - rect.top + gap)}px`,
        width: `${Math.round(menuWidth)}px`,
        maxHeight: `${Math.max(120, Math.floor(placeBelow ? below : above))}px`,
        zIndex: PROJECT_FLOATING_Z_INDEX,
        transform: 'none'
    }
}

function floatingMenuStyleAtPoint(
    x: number,
    y: number,
    width = 136,
    estimatedHeight = 312
): CSSProperties {
    if (typeof window === 'undefined') return {}
    const padding = 8
    const menuWidth = Math.max(112, Math.min(width, window.innerWidth - padding * 2))
    const left = Math.min(Math.max(padding, x), Math.max(padding, window.innerWidth - menuWidth - padding))
    const below = window.innerHeight - y - padding
    const top = below >= estimatedHeight
        ? Math.max(padding, y)
        : Math.max(padding, y - estimatedHeight)
    return {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        right: 'auto',
        top: `${Math.round(top)}px`,
        bottom: 'auto',
        width: `${Math.round(menuWidth)}px`,
        maxHeight: `${Math.max(120, Math.floor(window.innerHeight - top - padding))}px`,
        zIndex: PROJECT_FLOATING_Z_INDEX,
        transform: 'none'
    }
}

function closeProjectFloatingMenus() {
    activeProjectMenuId.value = ''
    activeProjectMenuStyle.value = {}
    projectFilterOpen.value = false
    projectFilterMenuStyle.value = {}
}

function toggleProjectFilter(event?: MouseEvent) {
    projectFilterOpen.value = !projectFilterOpen.value
    activeProjectMenuId.value = ''
    activeProjectMenuStyle.value = {}
    if (projectFilterOpen.value) {
        projectFilterMenuStyle.value = floatingMenuStyle(event?.currentTarget, 180, 336, true)
    } else {
        projectFilterMenuStyle.value = {}
    }
}

function toggleProjectMenu(id: string, event?: MouseEvent) {
    projectFilterOpen.value = false
    projectFilterMenuStyle.value = {}
    if (activeProjectMenuId.value === id) {
        activeProjectMenuId.value = ''
        activeProjectMenuStyle.value = {}
        return
    }
    activeProjectMenuId.value = id
    activeProjectMenuStyle.value = floatingMenuStyle(event?.currentTarget, 136, 312, true)
}

function openProjectContextMenu(entry: ProjectEntry, event: MouseEvent) {
    if (projectSelectionMode.value) return
    closeProjectFloatingMenus()
    activeProjectMenuId.value = entry.key
    activeProjectMenuStyle.value = floatingMenuStyleAtPoint(event.clientX, event.clientY, 136, 312)
}

function selectProjectFilter(index: number) {
    projectFilterIndex.value = Math.max(0, Math.min(projectFilters.length - 1, index))
    closeProjectFloatingMenus()
}

function selectProjectSortBy(value: ProjectSortBy) {
    projectSortBy.value = value
    closeProjectFloatingMenus()
}

function selectProjectSortOrder(value: ProjectSortOrder) {
    projectSortOrder.value = value
    closeProjectFloatingMenus()
}

function createProjectFolder(name = '未命名文件夹', moveProjectIds: string[] = []) {
    const now = Date.now()
    const folder: ProjectFolder = {
        id: `folder_${now}_${Math.random().toString(16).slice(2)}`,
        name: String(name || '未命名文件夹').trim() || '未命名文件夹',
        scope: activeProjectScope.value,
        createdAt: now,
        updatedAt: now
    }
    projectFolders.value = [folder, ...projectFolders.value]
    if (moveProjectIds.length) {
        const nextMap = { ...projectFolderMap.value }
        moveProjectIds.forEach((id) => {
            nextMap[id] = folder.id
        })
        projectFolderMap.value = nextMap
    }
    persistProjectOrg()
    return folder
}

function openMoveDialog(entry: ProjectEntry) {
    closeProjectFloatingMenus()
    if (entry.kind !== 'project') {
        feedback.msgWarning('文件夹暂不支持移动至文件夹')
        return
    }
    moveDialogEntry.value = entry
    moveTargetFolderId.value = ''
    moveNewFolderName.value = '未命名文件夹'
    moveDialogVisible.value = true
}

function closeMoveDialog() {
    moveDialogVisible.value = false
    moveDialogEntry.value = null
    moveTargetFolderId.value = ''
}

function moveProjectIdsForEntry(entry: ProjectEntry | null) {
    if (!entry || entry.kind !== 'project') return []
    const selectedProjectIdsInScope = Array.from(selectedProjectIds.value)
        .filter((key) => key.startsWith('project:'))
        .map((key) => key.replace(/^project:/, ''))
        .filter((id) => projects.value.some((project) => String(project.id) === id))
    return selectedProjectIds.value.has(entry.key) && selectedProjectIdsInScope.length
        ? selectedProjectIdsInScope
        : [entry.id]
}

function confirmMoveToFolder(targetFolderId = moveTargetFolderId.value) {
    const ids = moveProjectIdsForEntry(moveDialogEntry.value)
    if (!ids.length || !targetFolderId) return
    if (targetFolderId !== MOVE_ROOT_TARGET_ID) {
        moveProjectsToFolder(ids, targetFolderId)
    } else {
        const nextMap = { ...projectFolderMap.value }
        ids.forEach((id) => {
            delete nextMap[id]
        })
        projectFolderMap.value = nextMap
        persistProjectOrg()
        clearProjectSelection()
    }
    closeMoveDialog()
}

function createMoveFolderAndMove() {
    const ids = moveProjectIdsForEntry(moveDialogEntry.value)
    if (!ids.length) return
    createProjectFolder('未命名文件夹', ids)
    closeMoveDialog()
    clearProjectSelection()
}

async function moveProjectEntryToTeam(entry: ProjectEntry) {
    closeProjectFloatingMenus()
    if (entry.kind !== 'project') return
    notifyTeamFeaturePending()
}

function isProjectSelected(id: string) {
    return selectedProjectIds.value.has(id)
}

function enterProjectSelection(entry: ProjectEntry) {
    closeProjectFloatingMenus()
    if (entry.kind !== 'project') return
    toggleProjectSelection(entry.key)
}

function toggleProjectSelection(id: string) {
    closeProjectFloatingMenus()
    const next = new Set(selectedProjectIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedProjectIds.value = next
}

function clearProjectSelection() {
    selectedProjectIds.value = new Set()
}

function openBatchMoveDialog() {
    const first = selectedProjectEntries.value[0]
    if (!first) return
    openMoveDialog(first)
}

function moveSelectedProjectsToTeam() {
    if (!selectedCanvasProjects.value.length) return
    notifyTeamFeaturePending()
}

function notifyTeamFeaturePending() {
    feedback.msg('未开发功能')
}

function currentTeamName() {
    return String((userStore as any)?.userInfo?.org_name || '团队')
}

function openTeamMoveDialog(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (!uniqueIds.length) return
    const teamName = currentTeamName()
    teamMoveDialog.value = {
        title: `移动至 ${teamName}`,
        message: `这会将 ${uniqueIds.length} 个项目转移到团队协作空间。之后可在“团队项目”中找到它们。`,
        projectIds: uniqueIds,
        teamName,
        projectCount: uniqueIds.length
    }
}

function closeTeamMoveDialog() {
    if (teamMoveDialogSubmitting.value) return
    teamMoveDialog.value = null
}

async function confirmTeamMoveDialog() {
    const state = teamMoveDialog.value
    if (!state || teamMoveDialogSubmitting.value) return
    teamMoveDialogSubmitting.value = true
    try {
        await executeMoveProjectsToTeam(state.projectIds)
        teamMoveDialog.value = null
    } finally {
        teamMoveDialogSubmitting.value = false
    }
}

async function executeMoveProjectsToTeam(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (!uniqueIds.length) return
    const next = new Set(teamProjectIds.value)
    uniqueIds.forEach((id) => next.add(id))
    teamProjectIds.value = next
    const nextMap = { ...projectFolderMap.value }
    uniqueIds.forEach((id) => {
        delete nextMap[id]
    })
    projectFolderMap.value = nextMap
    persistProjectOrg()
    clearProjectSelection()
    feedback.msgSuccess('已移动至团队项目')
}

function removeSelectedProjects() {
    const items = selectedCanvasProjects.value
    if (!items.length) return
    deleteDialog.value = {
        kind: 'batch',
        title: '确认删除',
        message: `确定删除选中的 ${items.length} 个项目吗？此操作无法撤销。`,
        confirmLabel: '删除',
        projectIds: items.map((project) => String(project.id)),
        deleteCount: items.length
    }
}

async function shareProjectEntry(entry: ProjectEntry) {
    closeProjectFloatingMenus()
    const url =
        entry.kind === 'folder'
            ? `${window.location.origin}/app/aigc_canvas?folder=${encodeURIComponent(entry.id)}`
            : `${window.location.origin}/app/aigc_canvas/project/${entry.id}`
    try {
        await copyTextToClipboard(url)
        showProjectShareToast('分享成功', '链接已复制到剪贴板')
    } catch {
        showProjectShareToast('分享失败', '浏览器暂时无法写入剪贴板')
    }
}

async function copyTextToClipboard(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }
    if (typeof document === 'undefined') throw new Error('clipboard unavailable')
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!copied) throw new Error('copy failed')
}

function showProjectShareToast(title: string, description: string) {
    shareToast.value = { title, description }
    if (shareToastTimer) window.clearTimeout(shareToastTimer)
    shareToastTimer = window.setTimeout(() => {
        shareToast.value = null
        shareToastTimer = null
    }, 2400)
}

function normalizeProjectDisplayTime(value?: number) {
    const raw = Number(value || 0)
    if (!Number.isFinite(raw) || raw <= 0) return 0
    const time = raw < 100000000000 ? raw * 1000 : raw
    return time >= 946684800000 ? time : 0
}

function projectActivityTime(project: CanvasProject) {
    const times = [
        project.updatedAt,
        project.createdAt,
        ...(Array.isArray(project.canvases)
            ? project.canvases.flatMap((canvas) => [canvas.updatedAt, canvas.createdAt])
            : []),
        ...(Array.isArray(project.nodes)
            ? project.nodes.flatMap((node) => [
                  node.metadata?.updatedAt,
                  node.metadata?.generatedAt,
                  node.metadata?.createdAt
              ])
            : [])
    ]
        .map((value) => normalizeProjectDisplayTime(Number(value || 0)))
        .filter((value) => value > 0)
    return times.length ? Math.max(...times) : 0
}

function formatTapProjectTime(value?: number) {
    const time = normalizeProjectDisplayTime(value)
    if (!time) return '刚刚'
    const diff = Math.max(0, Date.now() - time)
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    const month = 30 * day
    if (diff < minute) return '1 分钟前'
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`
    if (diff < month) return `${Math.floor(diff / day)} 天前`
    return formatProjectTime(time)
}

function formatProjectDate(value?: number) {
    const time = normalizeProjectDisplayTime(value)
    if (!time) return '-'
    const date = new Date(time)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function projectContentSummary(project: CanvasProject) {
    const count = Array.isArray(project.nodes) ? project.nodes.length : 0
    return count ? `${count} 个节点` : '-'
}

function focusProjectRenameInput() {
    if (typeof document === 'undefined') return
    nextTick(() => {
        const input = document.querySelector<HTMLInputElement>('.project-rename-input, .project-row-rename-input')
        input?.focus()
        input?.select()
    })
}

function renameProjectEntry(entry: ProjectEntry) {
    closeProjectFloatingMenus()
    renameEntryKey.value = entry.key
    renameDraft.value = entry.name
    focusProjectRenameInput()
}

function cancelRenameEntry() {
    if (renamingEntryKey.value) return
    renameEntryKey.value = ''
    renameDraft.value = ''
}

async function submitRenameEntry() {
    const key = renameEntryKey.value
    if (!key || renamingEntryKey.value) return
    const entry = projectEntries.value.find((item) => item.key === key)
    if (!entry) {
        cancelRenameEntry()
        return
    }
    const name = renameDraft.value.trim()
    if (!name || name === entry.name) {
        cancelRenameEntry()
        return
    }
    renamingEntryKey.value = key
    if (entry.kind === 'folder') {
        const folder = projectFolders.value.find((item) => item.id === entry.id)
        if (!folder) {
            renamingEntryKey.value = ''
            cancelRenameEntry()
            return
        }
        projectFolders.value = projectFolders.value.map((item) =>
            item.id === entry.id ? { ...item, name, updatedAt: Date.now() } : item
        )
        persistProjectOrg()
        renamingEntryKey.value = ''
        cancelRenameEntry()
        return
    }
    const project = projects.value.find((item) => String(item.id) === String(entry.id))
    if (!project) {
        renamingEntryKey.value = ''
        cancelRenameEntry()
        return
    }
    let updated = project
    try {
        if (remoteAvailable.value && userStore.isLogin && isRemoteProjectId(entry.id)) {
            updated = await renameRemoteCanvasProject(entry.id, name)
        } else {
            updated = { ...project, name, updatedAt: Date.now() }
        }
        projects.value = projects.value.map((item) => String(item.id) === String(entry.id) ? updated : item)
        persist()
        renameEntryKey.value = ''
        renameDraft.value = ''
    } catch {
        remoteAvailable.value = false
        feedback.msgError('重命名失败')
    } finally {
        renamingEntryKey.value = ''
    }
}

function removeProjectEntry(entry: ProjectEntry) {
    closeProjectFloatingMenus()
    if (entry.kind === 'folder') {
        const folder = projectFolders.value.find((item) => item.id === entry.id)
        if (!folder) return
        const projectIds = projects.value
            .filter((project) => projectFolderMap.value[String(project.id)] === folder.id)
            .map((project) => String(project.id))
        deleteDialog.value = {
            kind: 'folder',
            title: '删除文件夹',
            message: `确定删除 ${folder.name} 吗？这将永久删除其中的所有 ${projectIds.length} 个项目。此操作无法撤销。`,
            confirmLabel: '删除文件夹',
            projectIds,
            subjectName: folder.name,
            deleteCount: projectIds.length,
            folderId: folder.id
        }
        return
    }
    deleteDialog.value = {
        kind: 'project',
        title: '确认删除',
        message: `确定删除 ${entry.name} 吗？此操作无法撤销。`,
        confirmLabel: '删除',
        projectIds: [entry.id],
        subjectName: entry.name,
        deleteCount: 1
    }
}

function renameProject(id: string) {
    const project = projects.value.find((item) => String(item.id) === String(id))
    if (!project) return
    renameProjectEntry(projectToEntry(project))
}

function removeProject(id: string) {
    const project = projects.value.find((item) => String(item.id) === String(id))
    if (!project) return
    removeProjectEntry(projectToEntry(project))
}

function closeDeleteDialog() {
    if (deleteDialogSubmitting.value) return
    deleteDialog.value = null
}

async function confirmDeleteDialog() {
    const state = deleteDialog.value
    if (!state || deleteDialogSubmitting.value) return
    deleteDialogSubmitting.value = true
    try {
        if (state.kind === 'folder' && state.folderId) {
            await executeDeleteFolder(state.folderId, state.projectIds)
        } else {
            await executeDeleteProjects(state.projectIds, state.kind === 'batch' ? '已删除选中项目' : '已删除项目')
        }
        deleteDialog.value = null
    } finally {
        deleteDialogSubmitting.value = false
    }
}

async function executeDeleteProjects(projectIds: string[], successMessage = '已删除项目') {
    const ids = new Set(projectIds.map(String).filter(Boolean))
    if (!ids.size) return
    if (remoteAvailable.value && userStore.isLogin) {
        for (const id of ids) {
            if (!isRemoteProjectId(id)) continue
            try {
                await deleteRemoteCanvasProject(id)
            } catch {
                remoteAvailable.value = false
            }
        }
    }
    projects.value = projects.value.filter((item) => !ids.has(String(item.id)))
    projectFolderMap.value = Object.fromEntries(
        Object.entries(projectFolderMap.value).filter(([projectId]) => !ids.has(projectId))
    )
    teamProjectIds.value = new Set(Array.from(teamProjectIds.value).filter((id) => !ids.has(id)))
    selectedProjectIds.value = new Set(
        Array.from(selectedProjectIds.value).filter((key) => !ids.has(key.replace(/^project:/, '')))
    )
    persistProjectOrg()
    persist()
    clearProjectSelection()
    feedback.msgSuccess(successMessage)
}

async function executeDeleteFolder(folderId: string, projectIds: string[]) {
    await executeDeleteProjects(projectIds, '已删除文件夹')
    projectFolders.value = projectFolders.value.filter((item) => item.id !== folderId)
    projectFolderMap.value = Object.fromEntries(
        Object.entries(projectFolderMap.value).filter(([, mappedFolderId]) => mappedFolderId !== folderId)
    )
    if (activeFolderId.value === folderId) setActiveFolder('')
    persistProjectOrg()
}

function openHomeAgentAssetLibrary(payload?: { acceptTypes?: HomeAssetType[] }) {
    const requestedTypes = Array.isArray(payload?.acceptTypes)
        ? payload.acceptTypes.filter((type) => ['image', 'video', 'audio'].includes(type))
        : []
    homeAssetGalleryAcceptTypes.value = requestedTypes.length ? requestedTypes : ['image', 'video']
    showHomeAssetGallery.value = true
}

function selectHomeAssetGalleryItem(item: any) {
    const url = String(item?.url || item?.uri || item?.cover || '').trim()
    if (!url) return
    homeAgentPanelRef.value?.addAttachments?.([
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
    showHomeAssetGallery.value = false
}

function updateHomeAgentMediaConfig(payload: {
    mode: Exclude<HomeComposerMode, 'agent'>
    key: string
    value: string | number
}) {
    const target = payload.mode === 'video' ? agentVideoConfig : agentImageConfig
    target.value = {
        ...target.value,
        [payload.key]: payload.value
    }
}

function uniqueOptions(items: CanvasOptionValue[]) {
    const seen = new Set<string>()
    return items.filter((item) => {
        const key = String(item.value)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function numberOptions(items: any[], suffix = '') {
    return uniqueOptions(
        items
            .map((item) => Number(item))
            .filter(Boolean)
            .map((value) => ({ label: `${value}${suffix}`, value }))
    )
}

function ratioOptionLabel(value: string, label?: string) {
    const normalized = String(value || '').trim().toLowerCase()
    const rawLabel = String(label || '').trim()
    if (normalized === 'adaptive' && (!rawLabel || rawLabel.toLowerCase() === normalized)) return '自适应'
    if (normalized === 'original' && (!rawLabel || rawLabel.toLowerCase() === normalized)) return '原比例'
    return rawLabel || value
}

function ratioOptions(source: any[], fallback = ['1:1', '16:9', '9:16']) {
    const values = Array.isArray(source) && source.length ? source : fallback
    return uniqueOptions(
        values
            .map((item: any) => {
                const value = String(item?.value || item?.ratio || item).trim()
                return value ? { label: ratioOptionLabel(value, item?.label), value } : null
            })
            .filter(Boolean) as CanvasOptionValue[]
    )
}

function imageChannels() {
    return (Array.isArray(imageOptionConfig.value?.channels) ? imageOptionConfig.value.channels : [])
        .map((channel: any) => ({
            label: String(channel.label || channel.name || channel.code || '图像模型'),
            value: String(channel.value || channel.code || ''),
            qualities: Array.isArray(channel.qualities) ? channel.qualities : [],
            quantity_options: Array.isArray(channel.quantity_options) ? channel.quantity_options : []
        }))
        .filter((channel: any) => channel.value)
}

function buildHomeImageOptions(metadata: Record<string, any> = {}): CanvasOption[] {
    const defaults = imageOptionConfig.value.defaults || {}
    const channels = imageChannels()
    const channel =
        channels.find((item: any) => String(item.value) === String(metadata.channel || defaults.channel)) ||
        channels[0]
    const qualities = (channel?.qualities || [])
        .map((quality: any) => ({
            label: String(quality.label || quality.quality_label || quality.value || quality.quality || '1K'),
            value: String(quality.value || quality.quality || ''),
            ratios: ratioOptions(quality.ratios || quality.ratio_options || [])
        }))
        .filter((quality: any) => quality.value)
    const quality =
        qualities.find((item: any) => String(item.value) === String(metadata.quality || defaults.quality)) ||
        qualities[0]
    const quantities = numberOptions(
        channel?.quantity_options?.length
            ? channel.quantity_options
            : imageOptionConfig.value.quantity_options || [1],
        '张'
    )
    return [
        {
            key: 'channel',
            values: channels.length
                ? channels
                : [{ label: '图像模型', value: defaults.channel || 'gpt_image_2' }],
            defaultValue: channel?.value || defaults.channel || 'gpt_image_2'
        },
        {
            key: 'quantity',
            values: quantities.length ? quantities : [{ label: '1张', value: 1 }],
            defaultValue: Number(metadata.quantity || defaults.quantity || quantities[0]?.value || 1)
        },
        {
            key: 'ratio',
            values: quality?.ratios?.length ? quality.ratios : ratioOptions([]),
            defaultValue: metadata.ratio || defaults.ratio || quality?.ratios?.[0]?.value || '1:1'
        },
        {
            key: 'quality',
            values: qualities.length ? qualities : [{ label: '1K', value: defaults.quality || '1k' }],
            defaultValue: quality?.value || defaults.quality || '1k'
        }
    ]
}

function videoChannels() {
    return (Array.isArray(videoOptionConfig.value?.channels) ? videoOptionConfig.value.channels : [])
        .map((channel: any) => ({
            label: String(channel.label || channel.name || channel.code || '视频模型'),
            value: String(channel.value || channel.code || ''),
            mode_options: Array.isArray(channel.mode_options) ? channel.mode_options : [],
            generation_modes: Array.isArray(channel.generation_modes) ? channel.generation_modes : [],
            supported_asset_types: Array.isArray(channel.supported_asset_types)
                ? channel.supported_asset_types
                : ['image'],
            max_reference_images: Number(channel.max_reference_images || 0),
            max_reference_videos: Number(channel.max_reference_videos || 0),
            max_reference_audios: Number(channel.max_reference_audios || 0),
            max_reference_assets: Number(channel.max_reference_assets || 0),
            ratio_options: ratioOptions(channel.ratio_options || []),
            quantity_options: Array.isArray(channel.quantity_options) ? channel.quantity_options : [],
            duration_options: Array.isArray(channel.duration_options) ? channel.duration_options : [],
            qualities: Array.isArray(channel.qualities) ? channel.qualities : []
        }))
        .filter((channel: any) => channel.value)
}

function buildHomeVideoOptions(metadata: Record<string, any> = {}): CanvasOption[] {
    const defaults = videoOptionConfig.value.defaults || {}
    const channels = videoChannels()
    const channel =
        channels.find((item: any) => String(item.value) === String(metadata.channel || defaults.channel)) ||
        channels[0]
    const modes = uniqueOptions(
        (channel?.mode_options || [])
            .filter((mode: string) => ['pro', 'fast'].includes(String(mode)))
            .map((mode: string) => ({ label: mode === 'fast' ? '快速' : '专业', value: mode }))
    )
    const qualityValues = uniqueOptions(
        (channel?.qualities || [])
            .map((quality: any) => {
                const value = String(quality.value || quality.quality || quality.resolution || '').trim()
                const label = String(
                    quality.resolution || quality.label || quality.quality_label || value || '默认'
                )
                return value ? { label, value } : null
            })
            .filter((item: any) => {
                if (!item) return false
                const value = String(item.value || '').toLowerCase()
                const label = String(item.label || '').toLowerCase()
                const channelValue = String(channel?.value || '').toLowerCase()
                const channelLabel = String(channel?.label || '').toLowerCase()
                return value !== channelValue && label !== channelLabel
            }) as CanvasOptionValue[]
    )
    const ratios = channel?.ratio_options?.length ? channel.ratio_options : ratioOptions([])
    const durations = numberOptions(
        channel?.duration_options?.length
            ? channel.duration_options
            : videoOptionConfig.value.duration_options || [5],
        '秒'
    )
    const quantities = numberOptions(
        channel?.quantity_options?.length
            ? channel.quantity_options
            : videoOptionConfig.value.quantity_options || [1]
    )
    const options: CanvasOption[] = [
        {
            key: 'channel',
            values: channels.length
                ? channels
                : [{ label: '视频模型', value: defaults.channel || 'seedance2_pro' }],
            defaultValue: channel?.value || defaults.channel || 'seedance2_pro'
        }
    ]
    if (modes.length > 1) {
        options.push({ key: 'mode', values: modes, defaultValue: metadata.mode || defaults.mode || modes[0].value })
    }
    if (qualityValues.length) {
        const defaultResolution =
            metadata.resolution ||
            defaults.resolution ||
            (qualityValues.some((item) => String(item.value) === String(defaults.quality))
                ? defaults.quality
                : qualityValues[0].value)
        options.push({
            key: 'resolution',
            values: qualityValues,
            defaultValue: defaultResolution
        })
    }
    options.push(
        {
            key: 'ratio',
            values: ratios.length ? ratios : [{ label: '16:9', value: '16:9' }],
            defaultValue: metadata.ratio || defaults.ratio || ratios[0]?.value || '16:9'
        },
        {
            key: 'duration',
            values: durations.length ? durations : [{ label: '5秒', value: 5 }],
            defaultValue: Number(metadata.duration || defaults.duration || durations[0]?.value || 5)
        },
        {
            key: 'quantity',
            values: quantities.length ? quantities : [{ label: '1', value: 1 }],
            defaultValue: Number(metadata.quantity || defaults.quantity || quantities[0]?.value || 1)
        }
    )
    return options
}

async function loadHomeAgentConfigs() {
    const [imageConfig, videoConfig] = await Promise.allSettled([
        getAigcImageConfig(),
        getAigcVideoConfig()
    ])
    if (imageConfig.status === 'fulfilled') {
        imageOptionConfig.value = imageConfig.value?.option_config || imageOptionConfig.value
    }
    if (videoConfig.status === 'fulfilled') {
        videoOptionConfig.value = videoConfig.value?.option_config || videoOptionConfig.value
    }
}

async function inputProjectName(title: string, value: string) {
    try {
        const result: any = await feedback.prompt('请输入项目名称', title, {
            inputValue: value,
            inputPlaceholder: '请输入项目名称',
            inputValidator(input: string) {
                return input.trim() ? true : '项目名称不能为空'
            },
            customClass: 'aigc-canvas-message-box',
            zIndex: 15400
        })
        return String(result?.value || '').trim()
    } catch {
        return ''
    }
}

onMounted(() => {
    lockHomePageScroll()
    pinHomeScrollForFirstFrames()
    window.addEventListener('pointermove', handleProjectPointerMove, true)
    window.addEventListener('pointerup', handleProjectPointerUp, true)
    window.addEventListener('pointercancel', handleProjectPointerCancel, true)
    window.addEventListener('mousemove', handleProjectMouseMove, true)
    window.addEventListener('mouseup', handleProjectMouseUp, true)
    window.addEventListener('blur', handleProjectMouseCancel, true)
    window.addEventListener('keydown', handleProjectKeydown, true)
    window.addEventListener('scroll', keepHomeWindowPinned, true)
    window.addEventListener('resize', resetHomeScroll, true)
    window.addEventListener('pointerdown', handleProjectDocumentPointerDown)
    document.addEventListener('touchmove', handleHomeTouchMove, { passive: false })
    loadProjectOrg()
    hydrateActiveFolderFromRoute()
    getAigcCanvasConfig().then((config: any) => {
        appConfig.value = config || {}
    }).catch(() => {
        appConfig.value = {}
    })
    loadProjects().then(() => nextTick(() => pinHomeScrollForFirstFrames(4)))
    loadHomeAgentConfigs()
})

onBeforeUnmount(() => {
    window.removeEventListener('pointermove', handleProjectPointerMove, true)
    window.removeEventListener('pointerup', handleProjectPointerUp, true)
    window.removeEventListener('pointercancel', handleProjectPointerCancel, true)
    window.removeEventListener('mousemove', handleProjectMouseMove, true)
    window.removeEventListener('mouseup', handleProjectMouseUp, true)
    window.removeEventListener('blur', handleProjectMouseCancel, true)
    window.removeEventListener('keydown', handleProjectKeydown, true)
    window.removeEventListener('scroll', keepHomeWindowPinned, true)
    window.removeEventListener('resize', resetHomeScroll, true)
    window.removeEventListener('pointerdown', handleProjectDocumentPointerDown)
    document.removeEventListener('touchmove', handleHomeTouchMove)
    cancelAnimationFrame(homeScrollPinFrame)
    if (shareToastTimer) {
        window.clearTimeout(shareToastTimer)
        shareToastTimer = null
    }
    restoreHomePageScroll()
})

watch(() => userStore.isLogin, loadProjects)
watch(() => route.query.folder, hydrateActiveFolderFromRoute)
</script>

<style scoped lang="scss">
.canvas-home {
    --bg: #0f0f0f;
    --surface: #1d1d1d;
    --surface-muted: #171717;
    --surface-hover: #232323;
    --canvas-dot: #474747;
    --border: rgba(255, 255, 255, 0.1);
    --text: #fff;
    --muted: rgba(255, 255, 255, 0.56);
    --soft: rgba(255, 255, 255, 0.06);
    --shadow: 0 22px 56px rgba(0, 0, 0, 0.42);
    --z-topbar: 120;
    --z-projects: 200;
    --z-composer: 300;
    --z-floating: 15020;
    --z-dialog: 15200;
    --z-toast: 15300;
    --z-system-dialog: 15400;
    position: fixed;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100dvh;
    min-height: 100dvh;
    max-height: 100dvh;
    overflow-x: hidden;
    overflow-y: hidden;
    overscroll-behavior: contain;
    background:
        radial-gradient(circle, var(--canvas-dot) 0.62px, transparent 0.82px),
        var(--bg);
    background-size:
        20px 20px,
        auto;
    background-position:
        center top,
        center top;
    color: var(--text);
}

:global(html),
:global(body),
:global(#__nuxt),
:global(.layout-blank) {
    min-width: 0 !important;
    min-height: 100%;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
}

:global(body) {
    overflow-x: hidden;
}

:global(html.aigc-canvas-home-scroll-lock),
:global(body.aigc-canvas-home-scroll-lock) {
    height: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
    overscroll-behavior: none !important;
}

:global(body.aigc-canvas-home-scroll-lock) {
    position: fixed !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
}

.canvas-home::before,
.canvas-home::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
}

.canvas-home::before {
    background: linear-gradient(180deg, rgba(15, 15, 15, 0.06), rgba(15, 15, 15, 0.64) 82%, #0f0f0f 100%);
}

.canvas-home::after {
    background: linear-gradient(90deg, #0f0f0f 0%, rgba(15, 15, 15, 0.22) 18%, rgba(15, 15, 15, 0.22) 82%, #0f0f0f 100%);
}

.project-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-dialog, 15200);
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.48);
    backdrop-filter: blur(8px);
}

.project-dialog {
    display: grid;
    width: min(480px, 100%);
    max-height: min(620px, calc(100vh - 48px));
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    background: #171717;
    color: #fff;
    box-shadow: 0 26px 72px rgba(0, 0, 0, 0.5);
}

.project-move-dialog {
    width: min(350px, calc(100vw - 32px));
    gap: 16px;
    padding: 24px;
    border-radius: 20px;
    outline: 2px solid rgba(255, 255, 255, 0.1);
    outline-offset: -2px;
    background: rgba(23, 23, 23, 0.94);
    backdrop-filter: blur(44px);
}

.project-delete-dialog,
.project-team-dialog {
    width: min(420px, calc(100vw - 40px));
}

.project-delete-dialog.is-project,
.project-delete-dialog.is-batch {
    width: min(384px, calc(100vw - 40px));
}

.project-delete-dialog.is-folder {
    width: min(448px, calc(100vw - 40px));
}

.project-team-dialog {
    width: min(450px, calc(100vw - 40px));
}

.project-dialog header,
.project-dialog footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
}

.project-dialog header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.project-move-dialog header {
    padding: 0;
    border-bottom: 0;
}

.project-move-dialog header button {
    display: none !important;
}

.project-move-dialog header strong {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.5;
}

.project-dialog header button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
}

.project-dialog header button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.project-dialog-body {
    display: grid;
    gap: 4px;
    overflow: auto;
    padding: 8px;
}

.project-move-dialog .project-dialog-body {
    max-height: 220px;
    gap: 8px;
    padding: 0;
}

.project-delete-body,
.project-confirm-body {
    padding: 18px 20px 4px;
}

.project-delete-body p,
.project-confirm-body p {
    margin: 0;
    color: rgba(255, 255, 255, 0.76);
    font-size: 14px;
    line-height: 1.7;
}

.project-delete-body p span,
.project-confirm-body p span {
    color: #fff;
    font-weight: 700;
}

.project-folder-choice {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-height: 64px;
    padding: 12px;
    border: 0;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.86);
    text-align: left;
    cursor: pointer;
}

.project-folder-choice:hover,
.project-folder-choice.active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.project-folder-choice.active {
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.6);
}

.project-folder-choice.is-create {
    border: 2px dashed rgba(255, 255, 255, 0.26);
    background: transparent;
}

.project-folder-choice.is-move-out {
    border: 2px dashed rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.06);
}

.project-folder-choice.is-move-out:hover,
.project-folder-choice.is-move-out.active {
    background: rgba(255, 255, 255, 0.1);
}

.project-folder-choice-icon,
.project-folder-choice-preview {
    position: relative;
    display: grid;
    place-items: center;
    width: 44px;
    height: 34px;
    overflow: hidden;
    border-radius: 8px;
    background:
        linear-gradient(136deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%),
        #1a1e20;
    color: rgba(255, 255, 255, 0.72);
}

.project-folder-choice-icon {
    order: 2;
    background: rgba(255, 255, 255, 0.08);
}

.project-folder-choice-copy {
    display: grid;
    min-width: 0;
    gap: 3px;
}

.project-folder-choice-copy strong,
.project-folder-choice-copy em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.project-folder-choice-copy strong {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
}

.project-folder-choice-copy em {
    color: rgba(255, 255, 255, 0.42);
    font-style: normal;
    font-size: 12px;
    line-height: 1.2;
}

.project-folder-choice-page {
    position: absolute;
    overflow: hidden;
    border-radius: 3px;
    outline: 1px solid rgba(204, 204, 204, 0.38);
    outline-offset: -1px;
    box-shadow: -1px -1px 6px rgba(0, 0, 0, 0.38);
    transform-origin: top left;
}

.project-folder-choice-page::before {
    display: block;
    content: '';
    aspect-ratio: 100 / 134;
}

.project-folder-choice-page img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-folder-choice-page.is-0 {
    top: 32%;
    left: 54%;
    z-index: 3;
    width: 22%;
    transform: rotate(15deg);
}

.project-folder-choice-page.is-1 {
    top: 20%;
    left: 34%;
    z-index: 2;
    width: 23%;
}

.project-folder-choice-page.is-2 {
    top: 38%;
    left: 14%;
    z-index: 1;
    width: 22%;
    transform: rotate(-15deg);
}

.project-dialog-empty {
    padding: 14px 10px;
    color: rgba(255, 255, 255, 0.42);
    text-align: center;
    font-size: 13px;
}

.project-folder-create {
    display: grid;
    gap: 8px;
    margin-top: 4px;
    padding: 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
}

.project-folder-create span {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 700;
}

.project-folder-create input {
    height: 36px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    outline: none;
    background: rgba(0, 0, 0, 0.22);
    color: #fff;
}

.project-dialog footer {
    justify-content: flex-end;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.project-move-dialog footer {
    gap: 8px;
    padding: 8px 0 0;
    border-top: 0;
}

.project-dialog footer button {
    height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.82);
    font-weight: 700;
    cursor: pointer;
}

.project-move-dialog footer button {
    flex: 1;
    height: 36px;
}

.project-dialog footer button:last-child {
    background: #f5f5f5;
    color: #111;
}

.project-move-dialog footer button:first-child {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
}

.project-move-dialog footer button:last-child {
    border: 0;
    background: #f5f5f5;
    color: #111;
}

.project-dialog footer button.danger,
.project-dialog footer button.danger:last-child {
    background: #f04444;
    color: #fff;
}

.project-dialog footer button.danger:hover,
.project-dialog footer button.danger:last-child:hover {
    background: #ff5a5a;
}

.project-dialog footer button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
}

.project-share-toast {
    position: fixed;
    top: 82px;
    right: 24px;
    z-index: var(--z-toast, 15300);
    display: grid;
    gap: 4px;
    width: min(320px, calc(100vw - 48px));
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    background: rgba(28, 28, 28, 0.96);
    color: #fff;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38);
    backdrop-filter: blur(18px);
}

.project-share-toast strong {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.25;
}

.project-share-toast span {
    color: rgba(255, 255, 255, 0.58);
    font-size: 13px;
    line-height: 1.35;
}

.home-topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-topbar);
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
    padding: 0 22px;
    background: rgba(15, 15, 15, 0.72);
    backdrop-filter: blur(18px) saturate(1.12);
}

.home-icon-button,
.project-card,
.empty-projects {
    border: 1px solid var(--border);
    background: var(--surface);
}

.home-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 38px;
    border-radius: 10px;
    color: var(--text);
    cursor: pointer;
    transition:
        border-color 0.18s ease,
        background 0.18s ease,
        transform 0.18s ease;
}

.home-icon-button {
    width: 38px;
    background: rgba(255, 255, 255, 0.04);
}

.home-icon-button:hover {
    transform: translateY(-1px);
}

.home-icon-button:hover {
    border-color: rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.08);
}

.home-main {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(100%, 1500px);
    height: 100%;
    min-height: 0;
    margin: 0 auto;
    overflow: hidden;
    padding: 104px 28px 28px;
    box-sizing: border-box;
}

.home-compose {
    position: relative;
    z-index: var(--z-composer);
    display: grid;
    flex: 0 0 auto;
    gap: 16px;
    width: 780px;
    max-width: calc(100vw - 56px);
    margin: 0 auto 42px;
}

.home-compose__heading {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-width: 0;
}

.home-compose__mark {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background:
        linear-gradient(135deg, transparent 0 32%, #fff 32% 46%, transparent 46% 54%, #fff 54% 68%, transparent 68%),
        radial-gradient(circle, rgba(255, 255, 255, 0.22), transparent 68%);
    box-shadow: 0 0 28px rgba(255, 255, 255, 0.08);
}

.home-compose__heading h1 {
    margin: 0;
    font-size: 36px;
    font-weight: 500;
    line-height: 1.22;
    letter-spacing: 0;
}

.home-agent-panel {
    width: 100%;
    min-width: 0;
}

.projects-section {
    position: relative;
    z-index: var(--z-projects);
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    gap: 19px;
    overflow: hidden;
}

.projects-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
}

.projects-head h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
}

.projects-head span {
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
}

.project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    align-content: start;
    flex: 1 1 auto;
    gap: 18px;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 6px 6px 18px;
}

.project-card {
    overflow: hidden;
    border-radius: 12px;
    background: #1f1f1f;
    transition:
        transform 0.16s ease,
        border-color 0.16s ease,
        background 0.16s ease;
}

.project-card:hover {
    border-color: rgba(255, 255, 255, 0.28);
    background: #232323;
    transform: translateY(-2px);
}

.project-thumb {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    border: 0;
    background: linear-gradient(180deg, #242424, #191919);
    cursor: pointer;
}

.project-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-thumb span {
    position: absolute;
    right: 12px;
    bottom: 12px;
    padding: 6px 11px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    backdrop-filter: blur(10px);
}

.project-placeholder {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--muted);
    font-size: 36px;
}

.project-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 13px 14px;
}

.project-meta > button {
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
}

.project-meta strong,
.project-meta small {
    display: block;
}

.project-meta strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    line-height: 1.2;
}

.project-meta small {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12px;
}

.project-actions {
    display: flex;
    gap: 6px;
}

.project-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
    cursor: pointer;
    transition:
        border-color 0.18s ease,
        background 0.18s ease;
}

.project-actions button:hover {
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.14);
}

.empty-projects {
    display: grid;
    place-items: center;
    flex: 1 1 auto;
    gap: 12px;
    min-height: 0;
    height: 100%;
    border-style: dashed;
    border-radius: 16px;
    color: var(--muted);
    text-align: center;
    background: rgba(29, 29, 29, 0.72);
}

.empty-projects strong {
    color: var(--text);
}

.empty-projects p {
    margin: 0;
}

.empty-projects button {
    height: 38px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: #f5f5f5;
    color: #111;
    font-weight: 600;
    cursor: pointer;
}

.projects-section {
    gap: 24px;
}

.project-folder-crumb {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    color: rgba(255, 255, 255, 0.44);
    font-size: 13px;
}

.project-folder-crumb button {
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
}

.project-folder-crumb button:hover,
.project-folder-crumb strong {
    color: #fff;
}

.projects-head {
    align-items: center;
}

.project-tabs {
    display: flex;
    align-items: center;
    gap: 28px;
}

.project-tabs button {
    position: relative;
    height: 34px;
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.42);
    font-size: 18px;
    font-weight: 500;
    cursor: pointer;
}

.project-tabs button.active {
    color: #fff;
}

.project-tabs button.active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -3px;
    height: 2px;
    border-radius: 999px;
    background: #fff;
}

.project-tabs button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
}

.project-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
}

.project-search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 164px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.42);
    transition:
        width 0.28s ease,
        border-color 0.18s ease,
        background 0.18s ease;
}

.project-search:focus-within,
.project-search.is-expanded {
    width: 220px;
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.08);
}

.project-search input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-size: 14px;
}

.project-search input::placeholder {
    color: rgba(255, 255, 255, 0.36);
}

.project-filter,
.project-icon-action,
.project-create-action,
.project-view-toggle {
    height: 40px;
    border: 0;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.project-filter,
.project-icon-action,
.project-create-action,
.project-view-toggle button {
    cursor: pointer;
    transition: background 0.18s ease;
}

.project-filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    font-size: 14px;
    font-weight: 600;
}

.project-filter-wrap {
    position: relative;
}

.project-filter-menu {
    position: fixed;
    z-index: var(--z-floating, 15020);
    display: grid;
    min-width: 180px;
    overflow: auto;
    padding: 7px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(35, 35, 35, 0.98);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38);
}

.project-filter-menu strong {
    padding: 6px 8px 5px;
    color: rgba(255, 255, 255, 0.32);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
}

.project-filter-menu strong:not(:first-child) {
    margin-top: 6px;
    padding-top: 11px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.project-filter-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.76);
    text-align: left;
    cursor: pointer;
}

.project-filter-menu button:hover,
.project-filter-menu button.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.project-menu-check {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.56);
    font-size: 14px;
}

.project-view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
}

.project-view-toggle button,
.project-icon-action {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
}

.project-view-toggle button.active,
.project-view-toggle button:hover,
.project-icon-action:hover,
.project-filter:hover,
.project-create-action:hover {
    background: rgba(255, 255, 255, 0.13);
}

.project-icon-action {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.08);
}

.project-create-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 104px;
    padding: 0 13px;
    font-size: 14px;
    font-weight: 700;
}

.project-grid {
    grid-template-columns: repeat(auto-fill, minmax(242px, 1fr));
    gap: 16px;
    padding: 6px 6px 24px;
}

.project-card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 272px;
    padding: 8px 8px 0;
    border-radius: 16px;
    border-color: transparent;
    outline: 1px solid rgba(255, 255, 255, 0.08);
    outline-offset: -1px;
    background: #1f1f1f;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
}

.project-card:hover {
    border-color: transparent;
    background: #1f1f1f;
    transform: none;
}

.project-card.selected {
    border-color: transparent;
    outline-color: transparent;
    box-shadow:
        0 0 0 2px #fff,
        0 1px 0 rgba(255, 255, 255, 0.03);
}

.project-card.is-dragging,
.project-row.is-dragging {
    opacity: 0.5;
}

.project-card.is-drop-target {
    border-color: transparent;
    outline-color: rgba(255, 255, 255, 0.08);
    background: rgba(31, 31, 31, 0.98);
    box-shadow:
        0 0 0 2px rgba(255, 255, 255, 0.72),
        0 0 0 4px rgba(15, 15, 15, 0.82),
        0 1px 0 rgba(255, 255, 255, 0.03);
}

.project-card.is-project-drop-target > :not(.project-collection-morph) {
    opacity: 0;
    transition: opacity 0.2s ease;
}

.project-grid-skeleton {
    pointer-events: none;
}

.project-card-skeleton {
    padding-bottom: 8px;
}

.project-skeleton-preview,
.project-skeleton-meta span,
.project-skeleton-meta small {
    display: block;
    overflow: hidden;
    border-radius: 8px;
    background:
        linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent),
        rgba(255, 255, 255, 0.06);
    background-size: 220% 100%;
    animation: project-skeleton-shimmer 1.2s ease-in-out infinite;
}

.project-skeleton-preview {
    aspect-ratio: 4 / 3;
}

.project-skeleton-meta {
    display: grid;
    gap: 6px;
    padding: 8px 4px 0;
}

.project-skeleton-meta span {
    width: 74%;
    height: 20px;
}

.project-skeleton-meta small {
    width: 48%;
    height: 16px;
}

@keyframes project-skeleton-shimmer {
    0% {
        background-position: 120% 0;
    }

    100% {
        background-position: -120% 0;
    }
}

.project-card-create {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    cursor: pointer;
}

.project-create-card-sizer {
    width: 100%;
    visibility: hidden;
    pointer-events: none;
    user-select: none;
}

.project-create-card-sizer div {
    width: 100%;
    aspect-ratio: 4 / 3;
}

.project-create-card-sizer span,
.project-create-card-sizer small {
    display: block;
    padding-inline: 4px;
}

.project-create-card-sizer span {
    padding-top: 8px;
    font-size: 14px;
    font-weight: 700;
}

.project-create-card-sizer small {
    padding-bottom: 8px;
    font-size: 12px;
}

.project-create-card-body {
    position: absolute;
    inset: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    transition: background 0.18s ease;
}

.project-card-create:hover .project-create-card-body {
    background: rgba(255, 255, 255, 0.08);
}

.project-create-card-body span {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #fff;
    color: #111;
    font-size: 24px;
    transition: transform 0.2s ease;
}

.project-card-create:hover .project-create-card-body span {
    transform: scale(1.08);
}

.project-thumb {
    position: relative;
    z-index: 2;
    flex: 0 0 auto;
    aspect-ratio: 4 / 3;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.24);
    cursor: pointer;
}

.project-thumb.is-collection {
    isolation: isolate;
    background:
        linear-gradient(136deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%),
        #1d242a;
}

.project-collection-morph {
    position: absolute;
    inset: 8px 8px 0;
    z-index: 20;
    overflow: hidden;
    border-radius: 16px;
    background: #1f1f1f;
    pointer-events: none;
    animation: project-morph-in 0.24s ease-out both;
}

.project-morph-preview {
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 12px;
    background:
        linear-gradient(136deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%),
        #1d242a;
}

.project-morph-page {
    position: absolute;
    top: 16%;
    left: 50%;
    width: 38%;
    overflow: hidden;
    border-radius: 10px;
    outline: 1px solid rgba(204, 204, 204, 0.52);
    outline-offset: -1px;
    background:
        radial-gradient(circle at 26% 18%, color-mix(in srgb, var(--marble-d, #a3a7ae) 82%, transparent), transparent 34%),
        radial-gradient(circle at 72% 74%, color-mix(in srgb, var(--marble-b, #3f66a2) 74%, transparent), transparent 35%),
        linear-gradient(180deg, var(--marble-d, #cccece), var(--marble-b, #939e9e));
    box-shadow: -2px -1px 10.5px rgba(0, 0, 0, 0.4);
    transform: translateX(-50%) rotate(4deg);
}

.project-morph-page::before {
    display: block;
    aspect-ratio: 100 / 134;
    content: '';
}

.project-morph-page img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-morph-pocket {
    height: 30%;
}

.project-morph-meta {
    position: absolute;
    right: 16px;
    bottom: 8px;
    left: 16px;
    z-index: 22;
    display: grid;
    gap: 4px;
}

.project-morph-meta strong,
.project-morph-meta small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.project-morph-meta strong {
    color: rgba(255, 255, 255, 0.82);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
}

.project-morph-meta small {
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
    line-height: 1.2;
}

@keyframes project-morph-in {
    0% {
        opacity: 0;
        transform: scale(0.96);
    }

    100% {
        opacity: 1;
        transform: scale(1);
    }
}

.project-select-toggle {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 5;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.16);
    color: #111;
    opacity: 0;
    cursor: pointer;
    transition:
        opacity 0.18s ease,
        background 0.18s ease,
        border-color 0.18s ease;
}

.project-card:hover .project-select-toggle,
.project-card.is-selection-mode .project-select-toggle,
.project-select-toggle.checked {
    opacity: 1;
}

.project-select-toggle.checked {
    border-color: #fff;
    background: #fff;
}

.project-select-toggle .el-icon {
    font-size: 14px;
    stroke-width: 3;
}

.project-thumb span {
    display: none;
}

.project-marble,
.project-placeholder {
    background:
        radial-gradient(circle at 22% 18%, color-mix(in srgb, var(--marble-d, #a3a7ae) 82%, transparent), transparent 32%),
        radial-gradient(circle at 78% 68%, color-mix(in srgb, var(--marble-b, #3f66a2) 72%, transparent), transparent 34%),
        linear-gradient(136deg, var(--marble-a, #3e3e41) 0%, var(--marble-b, #3f66a2) 36%, var(--marble-c, #567ebb) 62%, var(--marble-e, #a3a7ae) 100%);
    font-size: 34px;
}

.project-marble {
    width: 100%;
    height: 100%;
    transition: transform 0.22s ease;
}

.project-card:hover .project-marble {
    transform: scale(1.06);
}

.project-card.is-folder .project-placeholder {
    color: #fff;
    font-size: 42px;
}

.project-card.is-folder {
    padding-bottom: 8px;
}

.project-card.is-folder .project-more {
    background: transparent;
}

.project-card.is-folder .project-more:hover {
    background: rgba(255, 255, 255, 0.08);
}

.project-collection-stack {
    position: absolute;
    inset: 0;
    perspective: 400px;
}

.project-collection-page {
    position: absolute;
    width: 37.3%;
    overflow: hidden;
    border-radius: 10px;
    outline: 1px solid rgba(204, 204, 204, 0.5);
    outline-offset: -1px;
    background:
        radial-gradient(circle at 26% 18%, color-mix(in srgb, var(--marble-d, #a3a7ae) 82%, transparent), transparent 34%),
        radial-gradient(circle at 72% 74%, color-mix(in srgb, var(--marble-b, #3f66a2) 74%, transparent), transparent 35%),
        linear-gradient(180deg, var(--marble-d, #cccece), var(--marble-b, #939e9e));
    box-shadow: -2px -1px 10.5px rgba(0, 0, 0, 0.4);
    transform-origin: top left;
    transition:
        left 0.3s ease,
        top 0.3s ease,
        transform 0.3s ease;
}

.project-collection-page::before {
    display: block;
    aspect-ratio: 100 / 134;
    content: '';
}

.project-collection-page img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-collection-page.is-0 {
    top: 24.6%;
    left: 58.5%;
    z-index: 3;
    transform: rotate(15deg);
}

.project-collection-page.is-1 {
    top: 18.5%;
    left: 31.3%;
    z-index: 2;
}

.project-collection-page.is-2 {
    top: 37.9%;
    left: 5.6%;
    z-index: 1;
    transform: rotate(-15deg);
}

.project-card.is-folder:hover .project-collection-page.is-0,
.project-card.is-folder.is-drop-target .project-collection-page.is-0 {
    top: 17.9%;
    left: 63.7%;
}

.project-card.is-folder:hover .project-collection-page.is-1,
.project-card.is-folder.is-drop-target .project-collection-page.is-1 {
    top: 6.7%;
}

.project-card.is-folder:hover .project-collection-page.is-2,
.project-card.is-folder.is-drop-target .project-collection-page.is-2 {
    top: 31.2%;
    left: 0.4%;
}

.project-collection-pocket {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 6;
    height: 45%;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(57, 72, 76, 0.54) 0%, rgba(38, 48, 51, 0.62) 100%);
    backdrop-filter: blur(10px) saturate(1.14);
    -webkit-backdrop-filter: blur(10px) saturate(1.14);
    mask:
        url("data:image/svg+xml,%3Csvg width='284' height='116' viewBox='0 0 284 116' preserveAspectRatio='none' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 12C0 5.37258 5.37258 0 12 0H97.5617C103.047 0 108.435 1.4556 113.174 4.2182L137.578 18.4446C141.095 20.4942 145.092 21.5742 149.162 21.5742H272C278.627 21.5742 284 26.9468 284 33.5742V100C284 108.837 276.837 116 268 116H16C7.16345 116 0 108.837 0 100V12Z' fill='black'/%3E%3C/svg%3E")
        0 / 100% 100% no-repeat;
    -webkit-mask:
        url("data:image/svg+xml,%3Csvg width='284' height='116' viewBox='0 0 284 116' preserveAspectRatio='none' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 12C0 5.37258 5.37258 0 12 0H97.5617C103.047 0 108.435 1.4556 113.174 4.2182L137.578 18.4446C141.095 20.4942 145.092 21.5742 149.162 21.5742H272C278.627 21.5742 284 26.9468 284 33.5742V100C284 108.837 276.837 116 268 116H16C7.16345 116 0 108.837 0 100V12Z' fill='black'/%3E%3C/svg%3E")
        0 / 100% 100% no-repeat;
    filter: drop-shadow(0 -8px 18px rgba(0, 0, 0, 0.35));
    transform: scaleX(1.08);
    transform-origin: center bottom;
    transition: height 0.3s ease;
}

.project-card.is-folder:hover .project-collection-pocket,
.project-card.is-folder.is-drop-target .project-collection-pocket {
    height: 35%;
}

.project-collection-meta {
    position: absolute;
    right: 16px;
    bottom: 10px;
    left: 16px;
    z-index: 7;
    display: grid;
    gap: 5px;
}

.project-collection-meta small {
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
    line-height: 1.2;
}

.project-more {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 4;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.82);
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.18s ease, background 0.18s ease;
}

.project-card:hover .project-more,
.project-more:focus-visible,
.project-menu {
    opacity: 1;
}

.project-more:hover {
    background: rgba(0, 0, 0, 0.72);
}

.project-menu {
    position: fixed;
    z-index: var(--z-floating, 15020);
    display: grid;
    min-width: 116px;
    overflow: auto;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    background: rgba(28, 28, 28, 0.98);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38);
}

.project-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    text-align: left;
    cursor: pointer;
}

.project-menu button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.project-menu > span {
    display: block;
    height: 1px;
    margin: 5px 3px;
    background: rgba(255, 255, 255, 0.1);
}

.project-meta {
    position: relative;
    z-index: 3;
    display: grid;
    gap: 4px;
    margin-block: auto;
    padding: 0 4px;
}

.project-name-row {
    display: flex;
    align-items: center;
    min-width: 0;
}

.project-name-row > button:first-child {
    min-width: 0;
    border: 0;
    background: transparent;
    color: #fff;
    text-align: left;
    cursor: pointer;
}

.project-rename-input,
.project-row-rename-input {
    width: 100%;
    min-width: 0;
    height: 24px;
    padding: 0 6px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 5px;
    outline: none;
    background: rgba(0, 0, 0, 0.22);
    color: #fff;
    font-size: 15px;
    font-weight: 750;
    line-height: 24px;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.project-rename-input:focus,
.project-row-rename-input:focus {
    border-color: rgba(255, 255, 255, 0.42);
    background: rgba(0, 0, 0, 0.3);
}

.project-rename-input:disabled,
.project-row-rename-input:disabled {
    opacity: 0.58;
}

.project-name-row strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 800;
    line-height: 1.2;
}

.project-name-row > button:last-child {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    margin-left: 6px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.18s ease, background 0.18s ease;
}

.project-card:hover .project-name-row > button:last-child,
.project-name-row > button:last-child:focus-visible {
    opacity: 1;
}

.project-name-row > button:last-child:hover {
    background: rgba(255, 255, 255, 0.08);
}

.project-meta small {
    margin: 0;
    color: rgba(255, 255, 255, 0.56);
    font-size: 13px;
    line-height: 1.25;
}

.project-list {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0;
    min-height: 0;
    overflow: hidden;
    padding: 16px 0 0;
}

.project-list-create {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    width: fit-content;
    min-height: 58px;
    padding: 0 16px 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(35, 35, 35, 0.88);
    color: #fff;
    cursor: pointer;
}

.project-list-create span {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #fff;
    color: #111;
}

.project-table {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    min-width: 920px;
    min-height: 0;
    overflow: hidden;
    border: 0;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
}

.project-table-head,
.project-row {
    display: grid;
    grid-template-columns: 32px 72px minmax(0, 1fr) 120px 150px 180px 180px;
    align-items: center;
    gap: 24px;
}

.project-table-head {
    position: relative;
    z-index: 2;
    flex: 0 0 auto;
    min-height: 60px;
    padding: 20px 56px 0 16px;
    border-bottom: 0;
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
    font-weight: 700;
}

.project-table-head > span:last-child {
    display: none;
}

.project-table-body {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 14px;
    scrollbar-gutter: stable;
}

.project-row {
    position: relative;
    min-height: 72px;
    padding: 12px 56px 0 16px;
    border-bottom: 0;
    color: rgba(255, 255, 255, 0.66);
}

.project-table-head::after,
.project-row::after {
    position: absolute;
    right: 16px;
    bottom: 0;
    left: 48px;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    content: '';
}

.project-row:last-of-type::after {
    display: none;
}

.project-row:hover,
.project-row.selected {
    background: rgba(255, 255, 255, 0.055);
}

.project-row.is-drop-target {
    background: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.72);
}

.project-row-skeleton {
    pointer-events: none;
}

.project-row-skeleton span {
    display: block;
    height: 16px;
    overflow: hidden;
    border-radius: 8px;
    background:
        linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent),
        rgba(255, 255, 255, 0.06);
    background-size: 220% 100%;
    animation: project-skeleton-shimmer 1.2s ease-in-out infinite;
}

.project-row-skeleton span:first-child {
    width: 20px;
    height: 20px;
    opacity: 0.4;
}

.project-row-skeleton span:nth-child(2) {
    width: 72px;
    height: 48px;
    border-radius: 8px;
}

.project-row-skeleton span:nth-child(3) {
    width: min(220px, 78%);
}

.project-row-skeleton span:nth-child(4) {
    width: 72px;
}

.project-row-skeleton span:nth-child(5) {
    width: 96px;
}

.project-row-skeleton span:nth-child(6),
.project-row-skeleton span:nth-child(7) {
    width: 138px;
}

.project-row {
    cursor: pointer;
}

.project-row-select {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.56);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: #111;
    opacity: 0;
    cursor: pointer;
    transition:
        opacity 0.18s ease,
        background 0.18s ease;
}

.project-row:hover .project-row-select,
.project-row.is-selection-mode .project-row-select,
.project-row-select.checked {
    opacity: 1;
}

.project-row-select.checked {
    border-color: #fff;
    background: #fff;
}

.project-row-select-spacer {
    width: 20px;
    height: 20px;
}

.project-row-thumb {
    display: grid;
    place-items: center;
    width: 72px;
    height: 48px;
    overflow: hidden;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.56);
    cursor: pointer;
}

.project-row-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-row-thumb .project-marble {
    width: 100%;
    height: 100%;
}

.project-row-thumb.is-collection {
    position: relative;
    isolation: isolate;
    background:
        linear-gradient(136deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%),
        #1a1e20;
}

.project-row-collection-page {
    position: absolute;
    overflow: hidden;
    border-radius: 4px;
    outline: 1px solid rgba(204, 204, 204, 0.4);
    outline-offset: -1px;
    box-shadow: -2px -1px 10.5px rgba(0, 0, 0, 0.4);
    transform-origin: top left;
}

.project-row-collection-page img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-row-collection-page::before {
    display: block;
    content: '';
    aspect-ratio: 100 / 134;
}

.project-row-collection-page.is-0 {
    top: 15.87%;
    left: 12.8%;
    z-index: 1;
    width: 19.56%;
    transform: rotate(-15deg);
}

.project-row-collection-page.is-1 {
    top: 8.8%;
    left: 25.6%;
    z-index: 2;
    width: 20%;
}

.project-row-collection-page.is-2 {
    top: 10.87%;
    left: 40.4%;
    z-index: 3;
    width: 19.56%;
    transform: rotate(15deg);
}

.project-row-name {
    min-width: 0;
    border: 0;
    background: transparent;
    color: #fff;
    text-align: left;
    cursor: pointer;
}

.project-row-rename-input {
    align-self: center;
}

.project-row-name strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 750;
}

.project-row-type,
.project-row-content,
.project-row-date {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
}

.project-row-type {
    color: rgba(255, 255, 255, 0.78);
}

.project-row-content,
.project-row-date {
    color: rgba(255, 255, 255, 0.42);
}

.project-row-more {
    position: absolute;
    top: 50%;
    right: 12px;
    z-index: 4;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    opacity: 0;
    cursor: pointer;
    transform: translateY(-50%);
    transition:
        opacity 0.18s ease,
        background 0.18s ease,
        color 0.18s ease;
}

.project-row:hover .project-row-more,
.project-row-more:focus-visible,
.project-row-more.active,
.project-menu.is-row {
    opacity: 1;
}

.project-row-more:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.project-menu.is-row {
    top: auto;
    right: auto;
}

.project-bulk-bar {
    position: fixed;
    left: calc(50% - 175px);
    bottom: 32px;
    z-index: calc(var(--z-floating, 15020) - 20);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    background: rgba(38, 38, 38, 0.5);
    color: #fff;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(44px);
}

.project-bulk-bar > button,
.project-bulk-actions button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    transition:
        color 0.18s ease,
        background 0.18s ease;
}

.project-bulk-bar > button:hover,
.project-bulk-actions button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.project-bulk-bar strong {
    flex: 1;
    min-width: 230px;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
}

.project-bulk-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

@media (min-width: 1440px) {
    .home-main {
        width: min(100%, 1500px);
    }

    .project-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}

@media (max-width: 1180px) {
    .home-main {
        width: min(100%, 940px);
    }

    .project-grid {
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }
}

@media (max-width: 760px) {
    .home-main {
        padding-inline: 22px;
    }
}
</style>

<style lang="scss">
.aigc-canvas-message-box {
    --el-bg-color: #171717;
    --el-bg-color-overlay: #171717;
    --el-text-color-primary: #f4f4f5;
    --el-text-color-regular: #d4d4d8;
    --el-border-color-light: #333;
    --el-fill-color-blank: #111;
    width: min(420px, calc(100vw - 40px));
    z-index: var(--z-system-dialog, 15400);
    border: 1px solid #333;
    border-radius: 12px;
    background: #171717;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
}

.aigc-canvas-message-box .el-message-box__title,
.aigc-canvas-message-box .el-message-box__message {
    color: #f4f4f5;
}

.aigc-canvas-message-box .el-input__wrapper {
    background: #111;
    box-shadow: 0 0 0 1px #333 inset;
}

.aigc-canvas-message-box .el-input__inner {
    color: #f4f4f5;
}
</style>
