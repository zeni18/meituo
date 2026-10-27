<template>
    <el-card class="!border-none" shadow="never">
        <div class="mb-4">
            <el-button type="primary" @click="handleAdd">新增公共音色</el-button>
        </div>
        <el-table v-loading="pager.loading" size="large" :data="pager.lists">
            <el-table-column label="ID" prop="id" width="80" />
            <el-table-column label="封面" width="110">
                <template #default="{ row }">
                    <el-image
                        v-if="row.cover_url"
                        class="w-[64px] h-[64px] rounded"
                        :src="row.cover_url"
                        :preview-src-list="[row.cover_url]"
                        preview-teleported
                        fit="cover"
                    />
                    <div v-else class="voice-cover-empty">未配置</div>
                </template>
            </el-table-column>
            <el-table-column label="名称" prop="name" min-width="160" />
            <el-table-column
                label="音色ID"
                prop="provider_asset_id"
                min-width="200"
                show-overflow-tooltip
            />
            <el-table-column
                label="音频样本"
                prop="audio_uri"
                min-width="220"
                show-overflow-tooltip
            />
            <el-table-column label="排序" prop="sort" width="90" />
            <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                    <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
                    <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
                </template>
            </el-table-column>
        </el-table>
        <div class="flex justify-end mt-4">
            <pagination v-model="pager" @change="getLists" />
        </div>
        <el-dialog
            v-model="dialogVisible"
            :title="form.id ? '编辑公共音色' : '新增公共音色'"
            width="560px"
        >
            <el-form label-width="120px">
                <el-form-item label="名称">
                    <el-input v-model="form.name" placeholder="请输入音色名称" />
                </el-form-item>
                <el-form-item label="音色ID">
                    <el-input v-model="form.provider_asset_id" placeholder="已有音色ID可直接填写" />
                </el-form-item>
                <el-form-item label="克隆音频URI">
                    <el-input
                        v-model="form.audio_uri"
                        placeholder="未填音色ID时，使用该音频调用克隆接口"
                    />
                </el-form-item>
                <el-form-item label="封面图">
                    <div class="public-voice-field">
                        <div class="public-voice-field__row">
                            <material-picker
                                v-model="form.cover_uri"
                                :limit="1"
                                type="image"
                                exclude-domain
                                size="84px"
                                @change="handleCoverMaterialChange"
                            >
                                <template #upload>
                                    <el-button>素材库上传</el-button>
                                </template>
                            </material-picker>
                            <el-input
                                v-model="form.cover_uri"
                                class="public-voice-field__input"
                                placeholder="可选，用于PC端音色卡片展示"
                                @change="
                                    coverPreviewUrl = form.cover_uri
                                        ? getImageUrl(form.cover_uri)
                                        : ''
                                "
                            />
                        </div>
                        <el-image
                            v-if="coverPreviewUrl"
                            class="w-[96px] h-[96px] rounded"
                            :src="coverPreviewUrl"
                            fit="cover"
                        />
                    </div>
                </el-form-item>
                <el-form-item label="性别">
                    <el-input v-model="form.gender" placeholder="female / male" />
                </el-form-item>
                <el-form-item label="年龄段">
                    <el-input v-model="form.age_group" placeholder="young / middle" />
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="form.sort" :min="0" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
            </template>
        </el-dialog>
    </el-card>
</template>

<script lang="ts" setup name="tenant-aigc-digital-human-public-voice">
import {
    deleteAigcDigitalHumanPublicVoice,
    getAigcDigitalHumanPublicVoices,
    saveAigcDigitalHumanPublicVoice
} from '@/apps/aigc_digital_human/api'
import MaterialPicker from '@/components/material/picker.vue'
import { usePaging } from '@/hooks/usePaging'
import useAppStore from '@/stores/modules/app'
import feedback from '@/utils/feedback'

const saving = ref(false)
const dialogVisible = ref(false)
const { getImageUrl } = useAppStore()
const form = reactive<any>({
    id: 0,
    name: '',
    provider_asset_id: '',
    audio_uri: '',
    cover_uri: '',
    gender: '',
    age_group: '',
    sort: 0
})
const coverPreviewUrl = ref('')
const resetForm = (row: any = {}) => {
    Object.assign(
        form,
        {
            id: 0,
            name: '',
            provider_asset_id: '',
            audio_uri: '',
            cover_uri: '',
            gender: '',
            age_group: '',
            sort: 0
        },
        row
    )
    coverPreviewUrl.value = row.cover_url || ''
}
const handleCoverMaterialChange = (value: string | string[]) => {
    const cover = Array.isArray(value) ? value[0] || '' : value || ''
    form.cover_uri = cover
    coverPreviewUrl.value = cover ? getImageUrl(cover) : ''
}
const { pager, getLists } = usePaging({
    fetchFun: getAigcDigitalHumanPublicVoices
})
const handleAdd = () => {
    resetForm()
    dialogVisible.value = true
}
const handleEdit = (row: any) => {
    resetForm(row)
    dialogVisible.value = true
}
const handleSave = async () => {
    saving.value = true
    try {
        await saveAigcDigitalHumanPublicVoice(form)
        dialogVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}
const handleDelete = async (id: number) => {
    await feedback.confirm('确定删除该公共音色？')
    await deleteAigcDigitalHumanPublicVoice({ id })
    getLists()
}
getLists()
</script>

<style lang="scss" scoped>
.voice-cover-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    font-size: 12px;
}

.public-voice-field {
    min-width: 0;
    width: 100%;
}

.public-voice-field__row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    width: 100%;
}

.public-voice-field__input {
    min-width: 0;
    flex: 1;
}
</style>
