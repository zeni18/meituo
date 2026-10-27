<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-tabs v-model="activeType" class="canvas-task-tabs">
                <el-tab-pane label="生图任务" name="image" />
                <el-tab-pane label="视频任务" name="video" />
                <el-tab-pane label="音频任务" name="music" />
            </el-tabs>
            <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                <el-form-item label="任务ID">
                    <el-input
                        v-model="queryParams.task_id"
                        class="w-[180px]"
                        placeholder="画布任务/源任务ID"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="用户搜索">
                    <el-input
                        v-model="queryParams.user_keyword"
                        class="w-[240px]"
                        placeholder="用户ID/昵称/账号/手机号"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="项目ID">
                    <el-input
                        v-model="queryParams.project_id"
                        class="w-[160px]"
                        placeholder="请输入项目ID"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="完成状态">
                    <el-select
                        v-model="queryParams.status"
                        class="!w-[150px]"
                        placeholder="全部"
                        clearable
                        @change="resetPage"
                    >
                        <el-option label="全部" value="all" />
                        <el-option label="运行中" value="running" />
                        <el-option label="已完成" value="success" />
                        <el-option label="已失败" value="failed" />
                        <el-option label="已取消" value="canceled" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">查询</el-button>
                    <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column label="画布任务ID" prop="id" width="110" />
                <el-table-column label="结果预览" width="240">
                    <template #default="{ row }">
                        <div
                            v-if="row.run_type === 'image' && resultImageUrls(row).length"
                            class="canvas-image-results"
                        >
                            <a
                                v-for="url in resultImageUrls(row).slice(0, 3)"
                                :key="url"
                                class="canvas-image-thumb"
                                :href="url"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <img
                                    :src="url"
                                    alt=""
                                    loading="lazy"
                                    referrerpolicy="no-referrer"
                                    @error="markMediaError(row)"
                                />
                            </a>
                            <el-link
                                v-if="mediaErrors[row.id]"
                                type="danger"
                                :href="resultImageUrls(row)[0]"
                                target="_blank"
                            >
                                打开源图
                            </el-link>
                        </div>
                        <div
                            v-else-if="row.run_type === 'video' && resultVideoUrl(row)"
                            class="space-y-1"
                        >
                            <video
                                class="w-[192px] h-[108px] rounded bg-black object-contain"
                                :src="resultVideoUrl(row)"
                                controls
                                preload="metadata"
                                @error="markMediaError(row)"
                            ></video>
                            <el-link
                                v-if="mediaErrors[row.id]"
                                type="danger"
                                :href="resultVideoUrl(row)"
                                target="_blank"
                            >
                                打开源文件
                            </el-link>
                        </div>
                        <div
                            v-else-if="row.run_type === 'music' && resultAudioUrl(row)"
                            class="canvas-audio-result"
                        >
                            <audio
                                class="canvas-audio-player"
                                :src="resultAudioUrl(row)"
                                controls
                                preload="metadata"
                                @error="markMediaError(row)"
                            ></audio>
                            <el-link type="primary" :href="resultAudioUrl(row)" target="_blank">
                                下载音频
                            </el-link>
                            <el-link
                                v-if="mediaErrors[row.id]"
                                type="danger"
                                :href="resultAudioUrl(row)"
                                target="_blank"
                            >
                                打开源文件
                            </el-link>
                        </div>
                        <span v-else class="text-tx-secondary">暂无结果</span>
                    </template>
                </el-table-column>
                <el-table-column label="任务ID" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        {{ row.provider_task_id || row.source_task_id || '-' }}
                    </template>
                </el-table-column>
                <el-table-column label="源任务ID" prop="source_task_id" width="110" />
                <el-table-column label="用户ID" prop="user_id" width="100" />
                <el-table-column label="用户" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>{{ row.user_nickname || row.user_account || '-' }}</div>
                        <div class="text-xs text-tx-secondary">
                            {{ row.user_mobile || row.user_account || '-' }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="项目/节点" min-width="210" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div>{{ row.project_name || `项目#${row.project_id || '-'}` }}</div>
                        <div class="text-xs text-tx-secondary">节点：{{ row.node_id || '-' }}</div>
                    </template>
                </el-table-column>
                <el-table-column
                    label="提示词"
                    prop="prompt"
                    min-width="280"
                    show-overflow-tooltip
                />
                <el-table-column label="耗时" width="110">
                    <template #default="{ row }">{{ formatDuration(row.duration_ms) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-tag :type="statusTagType(row.status)">{{
                            statusText(row.status)
                        }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column
                    label="错误信息"
                    prop="error"
                    min-width="180"
                    show-overflow-tooltip
                />
                <el-table-column label="创建时间" width="170">
                    <template #default="{ row }">{{
                        formatTime(row.display_create_time || row.create_time)
                    }}</template>
                </el-table-column>
                <el-table-column label="更新时间" width="170">
                    <template #default="{ row }">{{
                        formatTime(row.display_update_time || row.update_time)
                    }}</template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            link
                            :disabled="!row.source_task_id"
                            :loading="isTaskQuerying(row)"
                            @click="handleQuery(row)"
                        >
                            查询
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-canvas-run">
import { getAigcCanvasRunDetail, getAigcCanvasRuns } from '@/apps/aigc_canvas/api'
import { useAppTaskManualQuery } from '@/composables/useAppTaskManualQuery'
import { usePaging } from '@/hooks/usePaging'

const activeType = ref('image')
const queryParams = reactive({
    run_type: 'image',
    task_id: '',
    user_keyword: '',
    project_id: '',
    status: 'all'
})
const mediaErrors = reactive<Record<number, boolean>>({})

const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcCanvasRuns,
    params: queryParams
})
const { handleTaskQuery, isTaskQuerying } = useAppTaskManualQuery(getLists)
const handleQuery = (row: any) => handleTaskQuery(row, getAigcCanvasRunDetail)

watch(activeType, (value) => {
    queryParams.run_type = value
    resetPage()
})

const resetQuery = () => {
    Object.assign(queryParams, {
        run_type: activeType.value,
        task_id: '',
        user_keyword: '',
        project_id: '',
        status: 'all'
    })
    resetPage()
}

const uniqueUrls = (urls: string[]) => {
    const seen = new Set<string>()
    const result: string[] = []
    urls.forEach((url) => {
        const value = normalizeMediaUrl(url)
        const key = mediaUrlKey(value)
        if (!key || seen.has(key)) return
        seen.add(key)
        result.push(value)
    })
    return result
}

const normalizeMediaUrl = (url: string) => {
    let value = String(url || '')
        .trim()
        .replace(/\\/g, '/')
    if (!value) return ''
    if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
        return value
    }
    if (/^(uploads|storage|resource|public|static)\b/i.test(value)) {
        value = `/${value.replace(/^\/+/, '')}`
    }
    return value
}

const mediaUrlKey = (url: string) => {
    const value = normalizeMediaUrl(url)
    if (!value) return ''
    if (value.startsWith('data:') || value.startsWith('blob:')) return value
    try {
        const parsed = new URL(value, window.location.origin)
        return parsed.pathname.replace(/^\/+/, '').toLowerCase()
    } catch {
        return value.replace(/^\/+/, '').split('?')[0].toLowerCase()
    }
}

const collectMediaUrls = (value: any, keys: string[], bucket: string[] = []) => {
    if (!value) return bucket
    if (typeof value === 'string') {
        if (
            /^(https?:|data:image\/|\/|uploads\/|storage\/|resource\/|public\/|static\/)/i.test(
                value.trim()
            )
        ) {
            bucket.push(normalizeMediaUrl(value))
        }
        return bucket
    }
    if (Array.isArray(value)) {
        value.forEach((item) => collectMediaUrls(item, keys, bucket))
        return bucket
    }
    if (typeof value !== 'object') return bucket
    const direct = keys.map((key) => String(value?.[key] || '').trim()).find(Boolean)
    if (direct) {
        bucket.push(normalizeMediaUrl(direct))
    }
    ;['results', 'images', 'videos', 'audios', 'data', 'result', 'output'].forEach((key) =>
        collectMediaUrls(value?.[key], keys, bucket)
    )
    return bucket
}

const resultImageUrls = (row: any) =>
    uniqueUrls(
        (Array.isArray(row.image_urls)
            ? row.image_urls
            : collectMediaUrls(row, ['image_url', 'url', 'image', 'result_url'])
        ).filter(Boolean)
    )
const resultVideoUrl = (row: any) =>
    row.video_url ||
    row.file_url ||
    row.result_url ||
    row.results?.[0]?.video_url ||
    row.results?.[0]?.url ||
    ''
const resultAudioUrl = (row: any) =>
    row.audio_url ||
    row.file_url ||
    row.result_url ||
    row.results?.[0]?.audio_url ||
    row.results?.[0]?.url ||
    ''
const markMediaError = (row: any) => {
    mediaErrors[Number(row.id)] = true
}
const formatTime = (value: number | string) => {
    if (!value) return '-'
    if (typeof value === 'string' && Number.isNaN(Number(value))) {
        return value
    }
    const timestamp = Number(value)
    if (!timestamp) return '-'
    return new Date(timestamp > 100000000000 ? timestamp : timestamp * 1000).toLocaleString()
}
const formatDuration = (value: number) => {
    const duration = Number(value || 0)
    if (!duration) return '-'
    return duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`
}
const statusText = (status: string) => {
    const map: Record<string, string> = {
        running: '运行中',
        success: '已完成',
        failed: '已失败',
        canceled: '已取消'
    }
    return map[status] || status || '-'
}
const statusTagType = (status: string) => {
    const map: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
        running: 'warning',
        success: 'success',
        failed: 'danger',
        canceled: 'info'
    }
    return map[status] || 'info'
}

getLists()
</script>

<style scoped>
.canvas-task-tabs {
    margin-bottom: 14px;
}

.canvas-audio-result {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.canvas-audio-player {
    width: 210px;
    height: 34px;
}

.canvas-image-results {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.canvas-image-thumb {
    display: block;
    width: 56px;
    height: 56px;
    overflow: hidden;
    border-radius: 6px;
    background: #f5f7fa;
}

.canvas-image-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>
