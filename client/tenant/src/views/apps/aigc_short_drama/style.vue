<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <div class="library-toolbar">
                <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                    <el-form-item label="关键词">
                        <el-input
                            v-model="queryParams.keyword"
                            class="w-[240px]"
                            placeholder="画风名称/描述"
                            clearable
                            @keyup.enter="resetPage"
                        />
                    </el-form-item>
                    <el-form-item label="状态">
                        <el-select v-model="queryParams.status" class="library-select" @change="resetPage">
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
                <el-button type="primary" @click="openEdit()">新增画风</el-button>
            </div>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column label="ID" prop="id" width="80" />
                <el-table-column label="预览图" width="110">
                    <template #default="{ row }">
                        <el-image
                            v-if="row.image"
                            class="library-cover"
                            :src="row.image"
                            fit="cover"
                            :preview-src-list="[row.image]"
                            preview-teleported
                        />
                        <span v-else class="text-tx-secondary">-</span>
                    </template>
                </el-table-column>
                <el-table-column label="画风" min-width="220" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div class="style-name">
                            <span>{{ row.name || '-' }}</span>
                            <el-tag v-if="row.is_new" size="small" type="danger">New</el-tag>
                        </div>
                        <div class="text-xs text-tx-secondary">{{ row.description || '-' }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                        <el-switch
                            v-model="row.status"
                            :active-value="1"
                            :inactive-value="0"
                            @change="handleStatus(row)"
                        />
                    </template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="更新时间" prop="update_time" width="170" />
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
                        <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-dialog
            v-model="dialogVisible"
            :title="formData.id ? '编辑画风' : '新增画风'"
            width="680px"
        >
            <el-form label-width="96px" :model="formData">
                <el-form-item label="画风名称" required>
                    <el-input v-model="formData.name" placeholder="请输入画风名称" maxlength="80" show-word-limit />
                </el-form-item>
                <el-form-item label="预览图">
                    <material-picker v-model="formData.image" type="image" :limit="1" exclude-domain size="96px" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input
                        v-model="formData.description"
                        type="textarea"
                        :rows="4"
                        maxlength="500"
                        show-word-limit
                        placeholder="用于帮助剧本生成理解画面风格"
                    />
                </el-form-item>
                <el-form-item label="New 标记">
                    <el-switch v-model="formData.is_new" :active-value="1" :inactive-value="0" />
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

<script lang="ts" setup name="tenant-aigc-short-drama-style">
import {
    deleteAigcShortDramaStyle,
    getAigcShortDramaStyleLists,
    saveAigcShortDramaStyle,
    setAigcShortDramaStyleStatus
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
    name: '',
    image: '',
    description: '',
    is_new: 0,
    status: 1,
    sort: 0
})
const formData = reactive<any>(defaultForm())

const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcShortDramaStyleLists,
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
            ...row,
            image: row.raw_image || row.image || ''
        })
    }
    dialogVisible.value = true
}
const handleSubmit = async () => {
    await saveAigcShortDramaStyle(formData)
    dialogVisible.value = false
    getLists()
}
const handleStatus = async (row: any) => {
    await setAigcShortDramaStyleStatus({ id: row.id, status: row.status })
}
const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该画风？')
    await deleteAigcShortDramaStyle({ id })
    getLists()
}

getLists()
</script>

<style lang="scss" scoped>
.library-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.library-select {
    width: 120px;
}

.library-cover {
    width: 64px;
    height: 64px;
    border-radius: 6px;
}

.style-name {
    display: flex;
    align-items: center;
    gap: 8px;
}
</style>
