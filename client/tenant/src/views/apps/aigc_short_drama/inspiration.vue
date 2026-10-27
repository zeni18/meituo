<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <div class="inspiration-toolbar">
                <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                    <el-form-item label="关键词">
                        <el-input
                            v-model="queryParams.keyword"
                            class="w-[240px]"
                            placeholder="标题/提示词"
                            clearable
                            @keyup.enter="resetPage"
                        />
                    </el-form-item>
                    <el-form-item label="状态">
                        <el-select v-model="queryParams.status" class="inspiration-select" @change="resetPage">
                            <el-option label="全部" value="" />
                            <el-option label="启用" value="1" />
                            <el-option label="停用" value="0" />
                        </el-select>
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" @click="resetPage">查询</el-button>
                        <el-button @click="resetQuery">重置</el-button>
                    </el-form-item>
                </el-form>
                <el-button type="primary" @click="openEdit()">新增灵感素材</el-button>
            </div>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="封面" width="100">
                    <template #default="{ row }">
                        <el-image
                            v-if="row.cover_url"
                            class="inspiration-cover"
                            :src="row.cover_url"
                            fit="cover"
                            :preview-src-list="[row.cover_url]"
                            preview-teleported
                        />
                        <span v-else class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
                <el-table-column label="标题" min-width="180" prop="title" show-overflow-tooltip />
                <el-table-column label="提示词" min-width="260" prop="prompt" show-overflow-tooltip />
                <el-table-column label="比例" width="90">
                    <template #default="{ row }">{{ row.config?.ratio || '-' }}</template>
                </el-table-column>
                <el-table-column label="时长" width="90">
                    <template #default="{ row }">{{ row.duration || 0 }}s</template>
                </el-table-column>
                <el-table-column label="来源" width="100">
                    <template #default="{ row }">
                        <el-tag :type="row.tenant_id > 0 ? 'success' : 'info'">
                            {{ row.tenant_id > 0 ? '租户' : '系统' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="120">
                    <template #default="{ row }">
                        <el-switch
                            :model-value="row.status"
                            :active-value="1"
                            :inactive-value="0"
                            :disabled="row.tenant_id <= 0"
                            @change="(value) => handleStatus(row, Number(value))"
                        />
                    </template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" width="80" />
                <el-table-column label="更新时间" prop="update_time" width="170" />
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button v-if="row.tenant_id > 0" type="primary" link @click="openEdit(row)">编辑</el-button>
                        <el-button v-if="row.tenant_id > 0" type="danger" link @click="handleDelete(row.id)">删除</el-button>
                        <span v-else class="text-tx-secondary">系统素材</span>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-dialog
            v-model="dialogVisible"
            :title="formData.id ? '编辑灵感素材' : '新增灵感素材'"
            width="760px"
        >
            <el-form label-width="96px" :model="formData">
                <el-form-item label="标题" required>
                    <el-input v-model="formData.title" placeholder="请输入灵感标题" maxlength="120" show-word-limit />
                </el-form-item>
                <el-form-item label="封面">
                    <material-picker v-model="formData.cover_url" type="image" :limit="1" exclude-domain size="96px" />
                </el-form-item>
                <el-form-item label="视频素材">
                    <material-picker v-model="formData.video_url" type="video" :limit="1" exclude-domain size="96px" />
                </el-form-item>
                <el-form-item label="提示词" required>
                    <el-input
                        v-model="formData.prompt"
                        type="textarea"
                        :rows="5"
                        maxlength="3000"
                        show-word-limit
                        placeholder="请输入用于生成短剧的故事灵感、人物、场景、风格等提示词"
                    />
                </el-form-item>
                <el-form-item label="比例">
                    <el-select v-model="formData.ratio" class="w-[180px]" clearable placeholder="请选择比例">
                        <el-option label="9:16" value="9:16" />
                        <el-option label="16:9" value="16:9" />
                        <el-option label="1:1" value="1:1" />
                        <el-option label="4:3" value="4:3" />
                        <el-option label="3:4" value="3:4" />
                    </el-select>
                </el-form-item>
                <el-form-item label="时长">
                    <el-input-number v-model="formData.duration" :min="0" :precision="1" />
                    <span class="ml-2 text-tx-secondary">秒</span>
                </el-form-item>
                <el-form-item label="尺寸">
                    <div class="inspiration-size-row">
                        <el-input-number v-model="formData.width" :min="0" placeholder="宽" />
                        <span>×</span>
                        <el-input-number v-model="formData.height" :min="0" placeholder="高" />
                    </div>
                </el-form-item>
                <el-form-item label="风格">
                    <el-input v-model="formData.style_name" placeholder="可选，例如电影感、写实、国风" maxlength="80" />
                </el-form-item>
                <el-form-item label="模型">
                    <el-input v-model="formData.model_name" placeholder="可选，用于前台展示素材参考模型" maxlength="80" />
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="formData.sort" :min="0" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-switch v-model="formData.status" :active-value="1" :inactive-value="0" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleSubmit">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-short-drama-inspiration">
import {
    deleteAigcShortDramaInspiration,
    getAigcShortDramaInspirationLists,
    saveAigcShortDramaInspiration,
    setAigcShortDramaInspirationStatus
} from '@/apps/aigc_short_drama/api'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const dialogVisible = ref(false)
const queryParams = reactive({
    keyword: '',
    status: ''
})
const defaultForm = () => ({
    id: 0,
    title: '',
    cover_url: '',
    video_url: '',
    prompt: '',
    ratio: '',
    duration: 0,
    width: 0,
    height: 0,
    style_name: '',
    model_name: '',
    status: 1,
    sort: 0
})
const formData = reactive<any>(defaultForm())

const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcShortDramaInspirationLists,
    params: queryParams
})

const resetQuery = () => {
    Object.assign(queryParams, { keyword: '', status: '' })
    resetPage()
}

const openEdit = (row?: any) => {
    Object.assign(formData, defaultForm())
    if (row) {
        Object.assign(formData, {
            id: row.id,
            title: row.title || '',
            cover_url: row.raw_cover_url || row.cover_url || '',
            video_url: row.raw_video_url || row.video_url || '',
            prompt: row.prompt || '',
            ratio: row.config?.ratio || '',
            duration: Number(row.duration || 0),
            width: Number(row.width || 0),
            height: Number(row.height || 0),
            style_name: row.config?.style_name || '',
            model_name: row.config?.model_name || '',
            status: Number(row.status ?? 1),
            sort: Number(row.sort || 0)
        })
    }
    dialogVisible.value = true
}

const handleSubmit = async () => {
    if (!formData.title.trim()) {
        feedback.msgError('请输入标题')
        return
    }
    if (!formData.prompt.trim()) {
        feedback.msgError('请输入提示词')
        return
    }
    await saveAigcShortDramaInspiration(formData)
    dialogVisible.value = false
    getLists()
}

const handleStatus = async (row: any, status: number) => {
    if (row.tenant_id <= 0) {
        return
    }
    await setAigcShortDramaInspirationStatus({ id: row.id, status })
    getLists()
}

const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该灵感素材？')
    await deleteAigcShortDramaInspiration({ id })
    getLists()
}

getLists()
</script>

<style lang="scss" scoped>
.inspiration-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.inspiration-select {
    width: 140px;
}

.inspiration-cover {
    width: 54px;
    height: 72px;
    border-radius: 6px;
}

.inspiration-size-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
</style>
