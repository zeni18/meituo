<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form ref="formRef" :model="queryParams" inline>
                <el-form-item label="公告标题">
                    <el-input
                        v-model="queryParams.title"
                        placeholder="请输入公告标题"
                        clearable
                        class="w-[240px]"
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="状态">
                    <el-select v-model="queryParams.status" placeholder="全部" clearable class="w-[160px]">
                        <el-option label="启用" :value="1" />
                        <el-option label="停用" :value="0" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">查询</el-button>
                    <el-button @click="resetParams">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <div class="mb-4">
                <el-button v-perms="['notice.pc_notice/add']" type="primary" @click="openEdit()">
                    新增公告
                </el-button>
            </div>
            <el-table size="large" :data="pager.lists" v-loading="pager.loading">
                <el-table-column label="公告标题" min-width="180">
                    <template #default="{ row }">
                        <div class="font-medium">{{ row.title }}</div>
                        <div class="text-tx-secondary text-xs mt-1 truncate max-w-[420px]">
                            {{ row.summary || '-' }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="封面图" min-width="90">
                    <template #default="{ row }">
                        <el-image
                            v-if="row.image"
                            :src="row.image"
                            class="w-[54px] h-[54px] rounded"
                            fit="cover"
                            :preview-src-list="[row.image]"
                            preview-teleported
                        />
                        <span v-else>-</span>
                    </template>
                </el-table-column>
                <el-table-column label="进入弹窗" min-width="100">
                    <template #default="{ row }">
                        <el-tag :type="row.is_popup ? 'success' : 'info'">
                            {{ row.is_popup ? '是' : '否' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="状态" min-width="100">
                    <template #default="{ row }">
                        <el-switch
                            v-perms="['notice.pc_notice/status']"
                            :model-value="row.status"
                            :active-value="1"
                            :inactive-value="0"
                            @change="changeStatus(row, $event)"
                        />
                        <el-tag class="ml-2" :type="row.status ? 'success' : 'danger'">
                            {{ row.status ? '启用' : '停用' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" min-width="80" />
                <el-table-column label="发布时间" prop="publish_time" min-width="170" />
                <el-table-column label="操作" min-width="170" fixed="right">
                    <template #default="{ row }">
                        <el-button v-perms="['notice.pc_notice/detail']" type="primary" link @click="openPreview(row)">
                            查看
                        </el-button>
                        <el-button v-perms="['notice.pc_notice/edit']" type="primary" link @click="openEdit(row)">
                            编辑
                        </el-button>
                        <el-button v-perms="['notice.pc_notice/delete']" type="danger" link @click="deleteNotice(row)">
                            删除
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <popup
            ref="popupRef"
            :title="formData.id ? '编辑消息公告' : '新增消息公告'"
            width="860px"
            async
            @confirm="submitForm"
            @close="closeEdit"
        >
            <el-form ref="editFormRef" :model="formData" :rules="rules" label-width="110px">
                <el-form-item label="公告标题" prop="title">
                    <el-input v-model="formData.title" maxlength="120" show-word-limit placeholder="请输入公告标题" />
                </el-form-item>
                <el-form-item label="公告摘要" prop="summary">
                    <el-input
                        v-model="formData.summary"
                        type="textarea"
                        maxlength="255"
                        show-word-limit
                        :rows="3"
                        placeholder="请输入公告摘要"
                    />
                </el-form-item>
                <el-form-item label="封面图">
                    <material-picker v-model="formData.image" :limit="1" />
                </el-form-item>
                <el-form-item label="公告正文" prop="content">
                    <editor v-model="formData.content" height="360px" />
                </el-form-item>
                <el-form-item label="进入弹窗">
                    <el-switch v-model="formData.is_popup" :active-value="1" :inactive-value="0" />
                    <span class="form-tip ml-3">启用后，PC用户首次进入时自动弹出一次。</span>
                </el-form-item>
                <el-form-item label="状态">
                    <el-radio-group v-model="formData.status">
                        <el-radio :label="1">启用</el-radio>
                        <el-radio :label="0">停用</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="formData.sort" :min="0" :max="999999" />
                </el-form-item>
            </el-form>
        </popup>

        <el-dialog v-model="previewVisible" title="公告详情" width="720px">
            <div v-if="previewData.id" class="notice-preview">
                <h3>{{ previewData.title }}</h3>
                <p class="notice-preview__time">{{ previewData.publish_time || previewData.create_time }}</p>
                <el-image
                    v-if="previewData.image"
                    :src="previewData.image"
                    class="notice-preview__image"
                    fit="cover"
                    :preview-src-list="[previewData.image]"
                    preview-teleported
                />
                <div class="notice-preview__summary" v-if="previewData.summary">{{ previewData.summary }}</div>
                <div class="notice-preview__content" v-html="previewData.content"></div>
            </div>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="pcNotice">
import type { FormInstance, FormRules } from 'element-plus'
import {
    pcNoticeAdd,
    pcNoticeDelete,
    pcNoticeDetail,
    pcNoticeEdit,
    pcNoticeLists,
    pcNoticeStatus
} from '@/api/message'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'
import Popup from '@/components/popup/index.vue'
import Editor from '@/components/editor/index.vue'
import MaterialPicker from '@/components/material/picker.vue'

const queryParams = reactive({
    title: '',
    status: ''
})

const formRef = shallowRef<FormInstance>()
const editFormRef = shallowRef<FormInstance>()
const popupRef = shallowRef<InstanceType<typeof Popup>>()
const previewVisible = ref(false)
const previewData = ref<any>({})
const submitting = ref(false)

const defaultForm = () => ({
    id: 0,
    title: '',
    summary: '',
    content: '',
    image: '',
    is_popup: 0,
    status: 1,
    sort: 0
})
const formData = reactive(defaultForm())

const rules: FormRules = {
    title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
    content: [{ required: true, message: '请输入公告正文', trigger: 'blur' }]
}

const { pager, getLists, resetPage, resetParams } = usePaging({
    fetchFun: pcNoticeLists,
    params: queryParams
})

const assignForm = (data: any = {}) => {
    Object.assign(formData, defaultForm(), data, {
        is_popup: Number(data.is_popup || 0),
        status: Number(data.status ?? 1),
        sort: Number(data.sort || 0)
    })
}

const openEdit = async (row?: any) => {
    if (row?.id) {
        const detail = await pcNoticeDetail({ id: row.id })
        assignForm(detail)
    } else {
        assignForm()
    }
    popupRef.value?.open()
}

const closeEdit = () => {
    editFormRef.value?.clearValidate()
    assignForm()
}

const submitForm = async () => {
    if (submitting.value) return
    try {
        submitting.value = true
        await editFormRef.value?.validate()
        const api = formData.id ? pcNoticeEdit : pcNoticeAdd
        await api({ ...formData })
        feedback.msgSuccess('保存成功')
        popupRef.value?.close()
        getLists()
    } finally {
        submitting.value = false
    }
}

const deleteNotice = async (row: any) => {
    await feedback.confirm('确定删除该公告吗？')
    await pcNoticeDelete({ id: row.id })
    feedback.msgSuccess('删除成功')
    getLists()
}

const changeStatus = async (row: any, value: string | number | boolean) => {
    await pcNoticeStatus({ id: row.id, status: Number(value) })
    feedback.msgSuccess('操作成功')
    getLists()
}

const openPreview = async (row: any) => {
    previewData.value = await pcNoticeDetail({ id: row.id })
    previewVisible.value = true
}

onActivated(() => {
    getLists()
})

getLists()
</script>

<style lang="scss" scoped>
.notice-preview {
    h3 {
        margin: 0;
        color: var(--el-text-color-primary);
        font-size: 20px;
        line-height: 1.5;
    }
}

.notice-preview__time {
    margin: 8px 0 16px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.notice-preview__image {
    width: 100%;
    max-height: 260px;
    margin-bottom: 16px;
    border-radius: 8px;
    overflow: hidden;
}

.notice-preview__summary {
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-regular);
    line-height: 1.7;
}

.notice-preview__content {
    line-height: 1.8;
    color: var(--el-text-color-primary);

    :deep(img) {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
    }
}
</style>
