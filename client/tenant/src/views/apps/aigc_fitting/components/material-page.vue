<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form :inline="true" :model="queryParams">
                <el-form-item label="名称">
                    <el-input
                        v-model="queryParams.keyword"
                        class="w-[220px]"
                        clearable
                        placeholder="请输入名称"
                        @keyup.enter="handleSearch"
                    />
                </el-form-item>
                <el-form-item :label="isModelPage ? '模特服饰' : '分类'">
                    <el-select
                        v-model="queryParams.category"
                        class="material-page__select material-page__select--md"
                        clearable
                        :placeholder="isModelPage ? '全部模特服饰' : '全部分类'"
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                    >
                        <el-option
                            v-for="item in categoryQueryOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item v-if="isModelPage" label="类型">
                    <el-select
                        v-model="queryParams.mode"
                        class="material-page__select material-page__select--sm"
                        clearable
                        placeholder="全部类型"
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                    >
                        <el-option
                            v-for="item in modelModeOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item v-if="showGender" label="性别">
                    <el-select
                        v-model="queryParams.gender"
                        class="material-page__select material-page__select--sm"
                        clearable
                        placeholder="全部模特"
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                    >
                        <el-option
                            v-for="item in genderQueryOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item v-if="isModelPage" label="姿势">
                    <el-select
                        v-model="queryParams.pose"
                        class="material-page__select material-page__select--sm"
                        clearable
                        placeholder="全部姿势"
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                    >
                        <el-option
                            v-for="item in poseQueryOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="状态">
                    <el-select
                        v-model="queryParams.status"
                        class="material-page__select material-page__select--sm"
                        clearable
                        placeholder="全部状态"
                        :empty-values="selectEmptyValues"
                        :value-on-clear="undefined"
                    >
                        <el-option label="启用" :value="1" />
                        <el-option label="停用" :value="0" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="handleSearch">查询</el-button>
                    <el-button @click="handleReset">重置</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <div class="material-page__toolbar">
                <div>
                    <el-button type="primary" @click="openForm()">新增{{ defaultName }}</el-button>
                    <el-button
                        type="danger"
                        :disabled="!selectedRows.length"
                        :loading="saving"
                        @click="handleBatchDelete"
                    >
                        批量删除
                    </el-button>
                </div>
                <div class="material-page__tip">{{ helperText }}</div>
            </div>

            <el-table
                v-loading="loading"
                :data="pagedLists"
                empty-text="暂无数据"
                size="large"
                @selection-change="handleSelectionChange"
            >
                <el-table-column type="selection" width="55" />
                <el-table-column label="图片" width="100">
                    <template #default="{ row }">
                        <el-image
                            class="material-page__image"
                            :src="row.image_url || row.image"
                            fit="cover"
                            :preview-src-list="row.image_urls?.length ? row.image_urls : [row.image_url || row.image]"
                            preview-teleported
                        />
                    </template>
                </el-table-column>
                <el-table-column label="名称" prop="name" min-width="160" show-overflow-tooltip />
                <el-table-column v-if="isModelPage" label="类型" width="90">
                    <template #default="{ row }">{{ getModelModeLabel(row.mode) }}</template>
                </el-table-column>
                <el-table-column v-if="isModelPage" label="图片数" width="90">
                    <template #default="{ row }">{{ row.images?.length || 1 }}</template>
                </el-table-column>
                <el-table-column :label="isModelPage ? '模特服饰' : '分类'" width="110">
                    <template #default="{ row }">{{ getCategoryLabel(row.category) }}</template>
                </el-table-column>
                <el-table-column v-if="showGender" label="性别" width="90">
                    <template #default="{ row }">{{ getGenderLabel(row.gender) || '-' }}</template>
                </el-table-column>
                <el-table-column :label="poseLabel" width="120" show-overflow-tooltip>
                    <template #default="{ row }">{{ getPoseLabel(row.pose) }}</template>
                </el-table-column>
                <el-table-column v-if="!isModelPage" label="分组" prop="group" width="110" show-overflow-tooltip />
                <el-table-column label="VIP" width="80">
                    <template #default="{ row }">
                        <el-tag v-if="Number(row.vip) === 1" type="warning">VIP</el-tag>
                        <span v-else>-</span>
                    </template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="状态" width="90">
                    <template #default="{ row }">
                        <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'">
                            {{ Number(row.status) === 1 ? '启用' : '停用' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openForm(row)">编辑</el-button>
                        <el-button type="danger" link :loading="deletingId === row.id" @click="handleDelete(row)">
                            删除
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>

            <div class="flex justify-end mt-4">
                <el-pagination
                    v-model:current-page="pageNo"
                    v-model:page-size="pageSize"
                    :total="filteredLists.length"
                    :page-sizes="[10, 15, 20, 50]"
                    layout="total, sizes, prev, pager, next, jumper"
                />
            </div>
        </el-card>

        <el-dialog
            v-model="dialogVisible"
            :title="formData.id ? `编辑${defaultName}` : `新增${defaultName}`"
            width="640px"
            destroy-on-close
        >
            <el-form label-width="100px" :model="formData">
                <el-form-item v-if="isModelPage" label="模特类型" required>
                    <el-radio-group v-model="formData.mode" @change="handleModeChange">
                        <el-radio-button
                            v-for="item in modelModeOptions"
                            :key="item.value"
                            :label="item.value"
                        >
                            {{ item.label }}
                        </el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="图片" required>
                    <material-picker
                        v-model="formData.images"
                        :limit="imageLimit"
                        width="96px"
                        height="96px"
                        exclude-domain
                        @change="handleMaterialChange"
                    >
                        <template #upload>
                            <el-button type="primary">{{ uploadText }}</el-button>
                        </template>
                    </material-picker>
                    <div v-if="isModelPage" class="form-tips">
                        {{ formData.mode === 'group' ? '组图需上传2-4张不同姿势图' : '单图需上传1张模特图' }}
                    </div>
                </el-form-item>
                <el-form-item label="名称" required>
                    <el-input v-model="formData.name" placeholder="请输入名称" />
                </el-form-item>
                <el-form-item :label="isModelPage ? '模特服饰' : '分类'" required>
                    <el-select
                        v-model="formData.category"
                        class="material-page__select material-page__select--full"
                        :filterable="isModelPage"
                        :allow-create="isModelPage"
                        default-first-option
                        :placeholder="isModelPage ? '请选择或输入模特服饰' : '请选择分类'"
                    >
                        <el-option
                            v-for="item in categoryFormOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item v-if="showGender" label="性别" required>
                    <el-select
                        v-model="formData.gender"
                        class="material-page__select material-page__select--full"
                        placeholder="请选择性别"
                    >
                        <el-option
                            v-for="item in genderFormOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item :label="poseLabel" :required="isModelPage">
                    <el-select
                        v-if="isModelPage"
                        v-model="formData.pose"
                        class="material-page__select material-page__select--full"
                        placeholder="请选择姿势"
                    >
                        <el-option
                            v-for="item in poseFormOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                    <el-input v-else v-model="formData.pose" :placeholder="`请输入${poseLabel}`" />
                </el-form-item>
                <el-form-item v-if="!isModelPage" label="分组">
                    <el-input v-model="formData.group" placeholder="请输入分组" />
                </el-form-item>
                <el-form-item label="VIP">
                    <el-switch v-model="formData.vip" :active-value="1" :inactive-value="0" />
                    <div v-if="isModelPage" class="form-tips">开启后该模特仅 VIP 用户可使用</div>
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="formData.sort" :min="0" controls-position="right" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-switch
                        v-model="formData.status"
                        :active-value="1"
                        :inactive-value="0"
                        active-text="启用"
                        inactive-text="停用"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import feedback from '@/utils/feedback'

type MaterialItem = {
    id: string
    name: string
    mode: 'single' | 'group'
    image: string
    images: string[]
    image_url?: string
    image_urls?: string[]
    category: string
    gender: string
    pose: string
    group: string
    vip: number
    sort: number
    status: number
}

const props = defineProps<{
    uploadText: string
    defaultName: string
    helperText: string
    showGender?: boolean
    fetchData: () => Promise<any>
    saveData: (params: { lists: MaterialItem[] }) => Promise<any>
}>()

const loading = ref(false)
const saving = ref(false)
const deletingId = ref('')
const dialogVisible = ref(false)
const categoryOptions = ref<any[]>([])
const genderOptions = ref<any[]>([])
const poseOptions = ref<any[]>([])
const modelModeOptions = ref<any[]>([
    { value: 'single', label: '单图' },
    { value: 'group', label: '组图' }
])
const lists = ref<MaterialItem[]>([])
const selectedRows = ref<MaterialItem[]>([])
const pageNo = ref(1)
const pageSize = ref(15)
const selectEmptyValues = [undefined, null, '']
const queryParams = reactive({
    keyword: '',
    mode: undefined as 'single' | 'group' | undefined,
    category: undefined as string | undefined,
    gender: undefined as string | undefined,
    pose: undefined as string | undefined,
    status: undefined as 0 | 1 | undefined
})
const formData = reactive<MaterialItem>({
    id: '',
    name: '',
    mode: 'single',
    image: '',
    images: [],
    image_url: '',
    image_urls: [],
    category: 'full',
    gender: '',
    pose: '',
    group: '',
    vip: 0,
    sort: 0,
    status: 1
})

const isModelPage = computed(() => Boolean(props.showGender))
const poseLabel = computed(() => props.showGender ? '姿势' : '风格')
const withoutAllOption = (items: any[]) => items.filter((item) => item.value !== 'all')
const categoryQueryOptions = computed(() => isModelPage.value ? withoutAllOption(categoryOptions.value) : categoryOptions.value)
const genderQueryOptions = computed(() => isModelPage.value ? withoutAllOption(genderOptions.value) : genderOptions.value)
const categoryFormOptions = computed(() => isModelPage.value ? withoutAllOption(categoryOptions.value) : categoryOptions.value)
const genderFormOptions = computed(() => isModelPage.value ? withoutAllOption(genderOptions.value) : genderOptions.value)
const poseFormOptions = computed(() => isModelPage.value ? withoutAllOption(poseOptions.value) : poseOptions.value)
const poseQueryOptions = computed(() => isModelPage.value ? withoutAllOption(poseOptions.value) : poseOptions.value)
const getCategoryLabel = (value: string) => categoryOptions.value.find((item) => item.value === value)?.label || value || '-'
const getGenderLabel = (value: string) => genderOptions.value.find((item) => item.value === value)?.label || value || ''
const getPoseLabel = (value: string) => poseOptions.value.find((item) => item.value === value)?.label || value || '-'
const getModelModeLabel = (value: string) => modelModeOptions.value.find((item) => item.value === value)?.label || value || '-'
const imageLimit = computed(() => (isModelPage.value && formData.mode === 'group' ? 4 : 1))
const normalizeImageList = (item: any) => {
    const images = Array.isArray(item?.images)
        ? item.images
        : [item?.image, item?.url, item?.uri]
    return images.map((value: any) => String(value || '').trim()).filter(Boolean)
}

const normalizeItems = (items: any[] = []) => (Array.isArray(items) ? items : [])
    .map((item: any, index: number) => {
        const images = normalizeImageList(item).slice(0, String(item?.mode || 'single') === 'group' ? 4 : 1)
        const imageUrls = Array.isArray(item?.image_urls)
            ? item.image_urls.map((value: any) => String(value || '').trim()).filter(Boolean)
            : images
        return {
            id: String(item?.id || images[0] || Date.now() + index),
            name: String(item?.name || `${props.defaultName}${index + 1}`),
            mode: String(item?.mode || 'single') === 'group' ? 'group' : 'single',
            image: String(images[0] || ''),
            images,
            image_url: String(item?.image_url || imageUrls[0] || images[0] || ''),
            image_urls: imageUrls.length ? imageUrls : images,
            category: String(item?.category || 'full'),
            gender: String(item?.gender || ''),
            pose: String(item?.pose || ''),
            group: String(item?.group || ''),
            vip: Number(item?.vip || 0),
            sort: Number(item?.sort ?? index),
            status: Number(item?.status ?? 1)
        } as MaterialItem
    })
    .filter((item) => item.image)
    .sort((a, b) => Number(a.sort) - Number(b.sort))

const filteredLists = computed(() => {
    const keyword = queryParams.keyword.trim().toLowerCase()
    return lists.value.filter((item) => {
        if (keyword && ![item.name, item.pose, item.group, getCategoryLabel(item.category), getGenderLabel(item.gender)].some((value) => String(value || '').toLowerCase().includes(keyword))) {
            return false
        }
        if (isModelPage.value && queryParams.mode && item.mode !== queryParams.mode) return false
        if (queryParams.category && item.category !== queryParams.category) return false
        if (props.showGender && queryParams.gender && item.gender !== queryParams.gender) return false
        if (isModelPage.value && queryParams.pose && item.pose !== queryParams.pose) return false
        if (queryParams.status !== undefined && Number(item.status) !== Number(queryParams.status)) return false
        return true
    })
})
const pagedLists = computed(() => {
    const start = (pageNo.value - 1) * pageSize.value
    return filteredLists.value.slice(start, start + pageSize.value)
})

watch(filteredLists, () => {
    const totalPage = Math.max(1, Math.ceil(filteredLists.value.length / pageSize.value))
    if (pageNo.value > totalPage) pageNo.value = totalPage
})

const getData = async () => {
    loading.value = true
    try {
        const data: any = await props.fetchData()
        modelModeOptions.value = data?.model_mode_options || [
            { value: 'single', label: '单图' },
            { value: 'group', label: '组图' }
        ]
        categoryOptions.value = data?.category_options || []
        genderOptions.value = data?.gender_options || [
            { value: 'all', label: '全部模特' },
            { value: 'male', label: '男' },
            { value: 'female', label: '女' },
            { value: 'child', label: '儿童' }
        ]
        poseOptions.value = data?.pose_options || [
            { value: 'full', label: '全身' },
            { value: 'half', label: '半身' }
        ]
        lists.value = normalizeItems(data?.lists)
    } finally {
        loading.value = false
    }
}

const persistLists = async (nextLists = lists.value) => {
    saving.value = true
    try {
        const normalized = nextLists.map((item, index) => ({
            ...item,
            image: item.images?.[0] || item.image,
            sort: Number(item.sort ?? index),
            image_url: undefined,
            image_urls: undefined
        }))
        await props.saveData({ lists: normalized as MaterialItem[] })
        feedback.msgSuccess('保存成功')
        await getData()
    } finally {
        saving.value = false
    }
}

const resetForm = (row?: Partial<MaterialItem>) => {
    Object.assign(formData, {
        id: '',
        name: '',
        mode: 'single',
        image: '',
        images: [],
        image_url: '',
        image_urls: [],
        category: isModelPage.value ? (categoryFormOptions.value[0]?.value || '') : (categoryOptions.value[0]?.value || 'full'),
        gender: isModelPage.value ? (genderFormOptions.value[0]?.value || '') : '',
        pose: isModelPage.value ? (poseFormOptions.value[0]?.value || '') : '',
        group: '',
        vip: 0,
        sort: lists.value.length,
        status: 1,
        ...(row || {})
    })
    formData.images = normalizeImageList(formData).slice(0, formData.mode === 'group' ? 4 : 1)
    formData.image = formData.images[0] || formData.image
    formData.image_url = formData.image_url || formData.image
}

const openForm = (row?: MaterialItem) => {
    resetForm(row ? { ...row } : undefined)
    dialogVisible.value = true
}

const handleSelectionChange = (rows: MaterialItem[]) => {
    selectedRows.value = rows
}

const pickImageValue = (value: any) => String(
    typeof value === 'object' && value !== null
        ? (value.image || value.url || value.uri || value.path || '')
        : value || ''
).trim()

const handleMaterialChange = (value: string | string[] | any[]) => {
    const images = (Array.isArray(value) ? value : [value])
        .map((item) => pickImageValue(item))
        .filter(Boolean)
        .slice(0, imageLimit.value)
    formData.images = images
    formData.image = images[0] || ''
    formData.image_url = formData.image
    formData.image_urls = images
    if (!formData.name) {
        formData.name = `${props.defaultName}${lists.value.length + 1}`
    }
}

const handleModeChange = () => {
    formData.images = formData.images.slice(0, imageLimit.value)
    formData.image = formData.images[0] || ''
    formData.image_url = formData.image
    formData.image_urls = [...formData.images]
}

const handleSave = async () => {
    const images = formData.images.filter(Boolean)
    if (!images.length) {
        feedback.msgError('请上传图片')
        return
    }
    if (isModelPage.value && formData.mode === 'single' && images.length !== 1) {
        feedback.msgError('单图模特需上传1张图片')
        return
    }
    if (isModelPage.value && formData.mode === 'group' && (images.length < 2 || images.length > 4)) {
        feedback.msgError('组图模特需上传2-4张不同姿势图')
        return
    }
    if (!formData.name.trim()) {
        feedback.msgError('请输入名称')
        return
    }
    if (isModelPage.value) {
        if (!formData.gender) {
            feedback.msgError('请选择性别')
            return
        }
        if (!formData.category) {
            feedback.msgError('请选择或输入模特服饰')
            return
        }
        if (!formData.pose) {
            feedback.msgError('请选择姿势')
            return
        }
    }
    if (!formData.id && lists.value.length >= 60) {
        feedback.msgError('最多添加 60 条数据')
        return
    }
    const nextItem = {
        ...formData,
        name: formData.name.trim(),
        id: formData.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        image: images[0],
        images,
        sort: Number(formData.sort || 0),
        vip: Number(formData.vip || 0),
        status: Number(formData.status ?? 1)
    }
    const index = lists.value.findIndex((item) => item.id === nextItem.id)
    const nextLists = [...lists.value]
    if (index >= 0) {
        nextLists.splice(index, 1, nextItem)
    } else {
        nextLists.push(nextItem)
    }
    await persistLists(nextLists)
    dialogVisible.value = false
}

const handleDelete = async (row: MaterialItem) => {
    await feedback.confirm(`确定删除「${row.name}」？`)
    deletingId.value = row.id
    try {
        await persistLists(lists.value.filter((item) => item.id !== row.id))
    } finally {
        deletingId.value = ''
    }
}

const handleBatchDelete = async () => {
    if (!selectedRows.value.length) return
    await feedback.confirm(`确定删除选中的 ${selectedRows.value.length} 条数据？`)
    const ids = new Set(selectedRows.value.map((item) => item.id))
    await persistLists(lists.value.filter((item) => !ids.has(item.id)))
    selectedRows.value = []
}

const handleSearch = () => {
    pageNo.value = 1
}

const handleReset = () => {
    Object.assign(queryParams, {
        keyword: '',
        mode: undefined,
        category: undefined,
        gender: undefined,
        pose: undefined,
        status: undefined
    })
    pageNo.value = 1
}

getData()
</script>

<style lang="scss" scoped>
.material-page__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
}

.material-page__tip {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.material-page__select {
    width: 100%;
}

.material-page__select--sm {
    width: 150px;
}

.material-page__select--md {
    width: 180px;
}

.material-page__select--full {
    width: 100%;
}

.material-page__image {
    width: 64px;
    height: 64px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
}

</style>
