<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" :model="queryParams">
                <el-form-item label="状态">
                    <el-select v-model="queryParams.status" class="w-[150px]" clearable placeholder="全部">
                        <el-option label="排队中" value="pending" />
                        <el-option label="生成中" value="running" />
                        <el-option label="成功" value="success" />
                        <el-option label="失败" value="failed" />
                        <el-option label="已取消" value="canceled" />
                    </el-select>
                </el-form-item>
                <el-form-item label="视频类型">
                    <el-input v-model="queryParams.type_code" class="w-[160px]" clearable placeholder="类型标识" @keyup.enter="getLists" />
                </el-form-item>
                <el-form-item label="用户">
                    <el-input v-model="queryParams.user_keyword" class="w-[220px]" clearable placeholder="昵称/账号/手机号/ID" @keyup.enter="getLists" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="getLists">
                            查询
                        </el-button>
                        <el-button @click="resetQuery">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="loading" :data="lists" size="large">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="源图" width="110">
                    <template #default="{ row }">
                        <el-image v-if="row.source_image_url" class="task-image" :src="row.source_image_url" fit="cover" :preview-src-list="[row.source_image_url]" preview-teleported />
                        <span v-else>-</span>
                    </template>
                </el-table-column>
                <el-table-column label="结果视频" width="130">
                    <template #default="{ row }">
                        <button v-if="row.video_url" class="video-thumb" type="button" @click="openVideo(row.video_url)">
                            <video :src="row.video_url" muted preload="metadata"></video>
                            <span>播放</span>
                        </button>
                        <span v-else>-</span>
                    </template>
                </el-table-column>
                <el-table-column label="用户" min-width="160">
                    <template #default="{ row }">{{ row.user_nickname || row.user_account || row.user_mobile || row.user_id || '-' }}</template>
                </el-table-column>
                <el-table-column label="视频类型" prop="type_name" min-width="140" />
                <el-table-column label="模型" prop="channel" min-width="120" />
                <el-table-column label="规格" prop="size_label" min-width="180" />
                <el-table-column label="消耗" width="140"><template #default="{ row }">{{ formatPointAmount(row.user_charge_points || 0) }}</template></el-table-column>
                <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="statusTag(row.status)">{{ row.status_label || row.status }}</el-tag></template></el-table-column>
                <el-table-column label="创建时间" width="170"><template #default="{ row }">{{ formatTime(row.create_time) }}</template></el-table-column>
                <el-table-column label="操作" width="230" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            link
                            :loading="isTaskQuerying(row)"
                            @click="handleQuery(row)"
                        >
                            查询
                        </el-button>
                        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
                        <el-button type="primary" link @click="handleRetry(row)">重试</el-button>
                        <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="mt-4 flex justify-end"><pagination v-model="pager" @change="getLists" /></div>
        </el-card>

        <el-dialog v-model="detailVisible" title="任务详情" width="760px">
            <el-descriptions :column="2" border>
                <el-descriptions-item label="任务ID">{{ detail.id || '-' }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ detail.status_label || detail.status || '-' }}</el-descriptions-item>
                <el-descriptions-item label="视频类型">{{ detail.type_name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="规格">{{ detail.size_label || '-' }}</el-descriptions-item>
                <el-descriptions-item label="用户消耗">{{ formatPointAmount(detail.user_charge_points || 0) }}</el-descriptions-item>
                <el-descriptions-item label="租户成本">{{ formatPointAmount(detail.tenant_cost_points || 0) }}</el-descriptions-item>
            </el-descriptions>
            <el-alert v-if="detail.error" class="mt-4" type="error" :title="detail.error" :closable="false" />
            <div class="detail-media mt-4">
                <div>
                    <div class="detail-title">源图</div>
                    <el-image v-if="detail.source_image_url" class="detail-image" :src="detail.source_image_url" fit="contain" :preview-src-list="[detail.source_image_url]" preview-teleported />
                </div>
                <div>
                    <div class="detail-title">结果视频</div>
                    <video v-if="detail.video_url" class="detail-video" :src="detail.video_url" controls preload="metadata"></video>
                    <div v-else class="detail-empty">暂无结果</div>
                </div>
            </div>
            <el-input class="mt-4" :model-value="detail.prompt || ''" type="textarea" :rows="5" readonly />
        </el-dialog>

        <el-dialog v-model="videoVisible" title="视频预览" width="860px" destroy-on-close>
            <video v-if="previewVideo" class="preview-video" :src="previewVideo" controls autoplay></video>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-product-promo-video-task">
import { formatPointAmount } from '@/utils/point-unit'

import {
    deleteAigcProductPromoVideoTask,
    getAigcProductPromoVideoTaskDetail,
    getAigcProductPromoVideoTaskLists,
    retryAigcProductPromoVideoTask
} from '@/apps/aigc_product_promo_video/api'
import { useAppTaskManualQuery } from '@/composables/useAppTaskManualQuery'
import feedback from '@/utils/feedback'

const loading = ref(false)
const detailVisible = ref(false)
const videoVisible = ref(false)
const lists = ref<any[]>([])
const detail = ref<any>({})
const previewVideo = ref('')
const pager = reactive({ page: 1, size: 15, count: 0 })
const queryParams = reactive({ status: '', type_code: '', user_keyword: '' })

const getLists = async () => {
    loading.value = true
    try {
        const res: any = await getAigcProductPromoVideoTaskLists({ page_no: pager.page, page_size: pager.size, ...queryParams })
        lists.value = res?.lists || []
        pager.count = Number(res?.count || 0)
    } finally {
        loading.value = false
    }
}
const { handleTaskQuery, isTaskQuerying } = useAppTaskManualQuery(getLists)
const handleQuery = (row: any) => handleTaskQuery(row, getAigcProductPromoVideoTaskDetail)

const resetQuery = () => { Object.assign(queryParams, { status: '', type_code: '', user_keyword: '' }); pager.page = 1; getLists() }
const openDetail = async (row: any) => { detail.value = await getAigcProductPromoVideoTaskDetail({ id: row.id }); detailVisible.value = true }
const openVideo = (url: string) => { previewVideo.value = url; videoVisible.value = true }
const handleRetry = async (row: any) => { await feedback.confirm('确定重试该任务？'); await retryAigcProductPromoVideoTask({ id: row.id }); feedback.msgSuccess('已提交重试'); getLists() }
const handleDelete = async (row: any) => { await feedback.confirm('确定删除该任务？'); await deleteAigcProductPromoVideoTask({ id: row.id }); feedback.msgSuccess('删除成功'); getLists() }
const statusTag = (status: string) => status === 'success' ? 'success' : status === 'failed' ? 'danger' : status === 'canceled' ? 'info' : 'warning'
const formatTime = (value: any) => {
    const num = Number(value || 0)
    if (!num) return '-'
    const date = new Date(num * 1000)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
getLists()
</script>

<style lang="scss" scoped>
.task-image { width: 64px; height: 64px; border-radius: 8px; background: #f5f7fa; overflow: hidden; }
.video-thumb { position: relative; width: 86px; height: 64px; padding: 0; overflow: hidden; border: 0; border-radius: 8px; background: #111; color: #fff; }
.video-thumb video { width: 100%; height: 100%; object-fit: cover; }
.video-thumb span { position: absolute; inset: auto 0 0; height: 24px; background: rgba(0,0,0,.58); font-size: 12px; line-height: 24px; }
.detail-media { display: grid; grid-template-columns: 220px 1fr; gap: 20px; }
.detail-title { margin-bottom: 8px; font-weight: 600; }
.detail-image { width: 200px; height: 200px; border-radius: 10px; background: #f5f7fa; }
.detail-video { width: 100%; max-height: 360px; border-radius: 10px; background: #111; }
.detail-empty { display: flex; align-items: center; justify-content: center; height: 200px; border-radius: 10px; background: #f5f7fa; color: var(--el-text-color-secondary); }
.preview-video { width: 100%; max-height: 70vh; border-radius: 10px; background: #111; }
</style>
