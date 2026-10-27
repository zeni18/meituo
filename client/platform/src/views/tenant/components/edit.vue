<template>
    <el-drawer
        v-model="drawer"
        destroy-on-close
        title="租户信息"
        direction="rtl"
        size="50%"
        @close="afterClose"
        :before-close="beforeClose"
    >
        <div
            class="h-full flex flex-col"
            v-loading="loading"
            element-loading-text="加载中..."
            element-loading-background="var(--el-bg-color)"
        >
            <div class="flex flex-col pb-1">
                <div class="bg-page p-4 rounded flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <el-avatar :src="formData.avatar" :size="58" />
                        <div class="flex flex-col justify-center gap-1">
                            <span class="font-bold text-lg">{{ formData.name }}</span>
                            <span class="text-info text-xs">编号：{{ formData.sn }}</span>
                        </div>
                    </div>
                    <div>
                        <el-button type="info" size="small" @click="handleEnterTenant">
                            登录
                        </el-button>
                        <el-button
                            v-if="editStatus"
                            type="default"
                            size="small"
                            @click="handleEdit()"
                        >
                            取消
                        </el-button>
                        <el-button
                            type="primary"
                            size="small"
                            :loading="isLock"
                            @click="handleEdit(true)"
                        >
                            {{ editStatus ? '保存' : '编辑' }}
                        </el-button>
                    </div>
                </div>
            </div>

            <el-tabs class="flex-1" v-model="activeName" :before-leave="beforeLeave">
                <el-tab-pane label="基础信息" name="profile">
                    <el-form
                        ref="formRef"
                        class="profile grid grid-cols-2 gap-x-4 pt-2"
                        :class="{
                            '!grid-cols-1': editStatus
                        }"
                        label-position="right"
                        :model="formData"
                        label-width="100px"
                        :rules="formRules"
                    >
                        <el-form-item v-if="editStatus" label="头像：" prop="avatar">
                            <material-picker v-model="formData.avatar" :limit="1" />
                        </el-form-item>
                        <el-form-item
                            v-if="!editStatus"
                            label="ID后台："
                            class="col-span-2"
                        >
                            <a
                                :href="formData.links?.id_query?.admin || formData.tenant_id_domain"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {{ formData.links?.id_query?.admin || formData.tenant_id_domain || '--' }}
                            </a>
                            <span
                                class="flex items-center ml-2 cursor-pointer"
                                v-copy="formData.links?.id_query?.admin || formData.tenant_id_domain"
                            >
                                <icon name="el-icon-DocumentCopy" />
                                复制
                            </span>
                        </el-form-item>
                        <el-form-item
                            v-if="!editStatus"
                            label="ID路径后台："
                            class="col-span-2"
                        >
                            <a
                                :href="formData.links?.id_path?.admin"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {{ formData.links?.id_path?.admin || '--' }}
                            </a>
                            <span
                                class="flex items-center ml-2 cursor-pointer"
                                v-copy="formData.links?.id_path?.admin"
                            >
                                <icon name="el-icon-DocumentCopy" />
                                复制
                            </span>
                        </el-form-item>
                        <el-form-item label="租户名称：" prop="name" :required="editStatus">
                            <el-input
                                v-if="editStatus"
                                v-model="formData.name"
                                placeholder="请输入租户名称"
                                style="max-width: 250px"
                            />
                            <span v-else class="break-all">
                                {{ formData.name || '--' }}
                            </span>
                        </el-form-item>
                        <el-form-item label="联系方式：" prop="tel">
                            <el-input
                                v-if="editStatus"
                                v-model="formData.tel"
                                placeholder="请输入联系方式"
                                style="max-width: 250px"
                            />
                            <span v-else>
                                {{ formData.tel || '--' }}
                            </span>
                        </el-form-item>
                        <el-form-item label="访问方式：" prop="access_mode">
                            <el-tag type="primary">别名访问</el-tag>
                        </el-form-item>
                        <el-form-item label="域名别名：" prop="domain_alias">
                            <el-input
                                v-if="editStatus"
                                v-model="formData.domain_alias"
                                placeholder="请输入域名别名"
                                style="max-width: 250px"
                            />
                            <span v-else class="break-all">
                                {{ formData.domain_alias || '--' }}
                            </span>
                        </el-form-item>
                        <el-form-item label="备用域名：">
                            <div v-if="editStatus" class="w-full max-w-[620px]">
                                <div
                                    v-for="(item, index) in formData.domain_aliases"
                                    :key="index"
                                    class="alias-row"
                                >
                                    <el-input
                                        v-model="item.domain"
                                        placeholder="请输入备用域名"
                                        clearable
                                    />
                                    <el-switch
                                        v-model="item.status"
                                        :active-value="1"
                                        :inactive-value="0"
                                        active-text="启用"
                                        inactive-text="禁用"
                                    />
                                    <el-button text type="danger" @click="removeAlias(index)">
                                        <icon name="el-icon-Delete" />
                                    </el-button>
                                </div>
                                <el-button link type="primary" @click="addAlias">
                                    <icon name="el-icon-Plus" />
                                    添加备用域名
                                </el-button>
                            </div>
                            <div v-else class="flex flex-wrap gap-2">
                                <el-tag
                                    v-for="(item, index) in formData.domain_aliases"
                                    :key="index"
                                    type="info"
                                >
                                    {{ item.domain }}
                                    <span class="ml-1 text-xs">
                                        {{ item.status === 1 ? '启用' : '禁用' }}
                                    </span>
                                </el-tag>
                                <span v-if="!formData.domain_aliases.length">--</span>
                            </div>
                        </el-form-item>
                        <el-form-item label="租户状态：" prop="disable">
                            <el-radio-group v-if="editStatus" v-model="formData.disable">
                                <el-radio :value="0">开启</el-radio>
                                <el-radio :value="1">关闭</el-radio>
                            </el-radio-group>
                            <el-tag
                                v-else
                                disable-transitions
                                :type="formData.disable === 0 ? 'primary' : 'info'"
                            >
                                {{ formData.disable === 0 ? '开启' : '关闭' }}
                            </el-tag>
                        </el-form-item>
                        <el-form-item label="租户套餐：" prop="contract_package_id">
                            <el-select
                                v-if="editStatus"
                                v-model="formData.contract_package_id"
                                class="!w-[280px]"
                                clearable
                                filterable
                                :loading="packageLoading"
                                placeholder="请选择租户套餐"
                                @change="handlePackageChange"
                                @clear="handlePackageClear"
                            >
                                <el-option
                                    v-for="item in packageOptions"
                                    :key="item.id"
                                    :label="`${item.name}（${item.duration_desc || item.duration_days + '天'}）`"
                                    :value="item.id"
                                />
                            </el-select>
                            <span v-else>{{ formData.contract_package_name || '--' }}</span>
                        </el-form-item>
                        <el-form-item label="到期时间：" prop="contract_expire_time">
                            <el-date-picker
                                v-if="editStatus"
                                v-model="formData.contract_expire_time"
                                type="datetime"
                                value-format="YYYY-MM-DD HH:mm:ss"
                                placeholder="请选择到期时间"
                            />
                            <span v-else>{{ contractExpireText }}</span>
                        </el-form-item>
                        <el-form-item label="套餐状态：">
                            <el-tag :type="formData.contract_status === 1 ? 'success' : formData.contract_status === 2 ? 'danger' : 'info'">
                                {{ contractStatusText }}
                            </el-tag>
                        </el-form-item>
                        <el-form-item label="自定义存储：" prop="allow_custom_storage">
                            <div v-if="editStatus">
                                <el-radio-group v-model="formData.allow_custom_storage">
                                    <el-radio :value="1">允许</el-radio>
                                    <el-radio :value="0">不允许</el-radio>
                                </el-radio-group>
                                <p class="text-info text-sm">
                                    开启后，租户可在后台系统设置中配置自己的文件存储；关闭时统一使用平台存储。
                                </p>
                            </div>
                            <el-tag
                                v-else
                                disable-transitions
                                :type="formData.allow_custom_storage === 1 ? 'primary' : 'info'"
                            >
                                {{ formData.allow_custom_storage === 1 ? '允许' : '不允许' }}
                            </el-tag>
                        </el-form-item>
                        <el-form-item
                            v-if="editStatus ? formData.allow_custom_storage === 1 : true"
                            label="本地存储："
                            prop="allow_local_storage"
                        >
                            <div v-if="editStatus">
                                <el-radio-group v-model="formData.allow_local_storage">
                                    <el-radio :value="1">允许</el-radio>
                                    <el-radio :value="0">不允许</el-radio>
                                </el-radio-group>
                                <p class="text-info text-sm">
                                    关闭后，租户只能配置对象存储，后台不显示本地存储入口。
                                </p>
                            </div>
                            <el-tag
                                v-else
                                disable-transitions
                                :type="formData.allow_local_storage === 1 ? 'primary' : 'info'"
                            >
                                {{ formData.allow_local_storage === 1 ? '允许' : '不允许' }}
                            </el-tag>
                        </el-form-item>
                        <el-form-item v-if="!editStatus" :label="`租户${getPointUnit()}：`">
                            {{ formData.point_balance || '0.00' }}
                        </el-form-item>
                        <el-form-item v-if="!editStatus" label="创建时间：">
                            {{ formData.create_time }}
                        </el-form-item>
                        <el-form-item label="租户备注：" prop="notes">
                            <el-input
                                v-if="editStatus"
                                v-model="formData.notes"
                                placeholder="请输入租户备注"
                                style="max-width: 250px"
                                type="textarea"
                                :maxlength="100"
                            />
                            <span class="break-all" v-else>
                                {{ formData.notes || '--' }}
                            </span>
                        </el-form-item>
                        <el-form-item
                            v-if="!editStatus"
                            label="主访问地址："
                            class="col-span-2"
                        >
                            <a
                                :href="formData.links?.current?.admin || formData.domain"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {{ formData.links?.current?.admin || formData.domain || '--' }}
                            </a>
                            <span
                                class="flex items-center ml-2 cursor-pointer"
                                v-copy="formData.links?.current?.admin || formData.domain"
                            >
                                <icon name="el-icon-DocumentCopy" />
                                复制
                            </span>
                        </el-form-item>
                        <el-form-item
                            v-if="!editStatus"
                            label="默认域名："
                            class="col-span-2"
                            prop="default_domain"
                        >
                            <a
                                :href="formData.default_domain"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {{ formData.default_domain || '--' }}
                            </a>
                            <span
                                class="flex items-center ml-2 cursor-pointer"
                                v-copy="formData.default_domain"
                            >
                                <icon name="el-icon-DocumentCopy" />
                                复制
                            </span>
                        </el-form-item>
                        <el-form-item
                            v-if="!editStatus"
                            label="前台PC："
                            class="col-span-2"
                            prop="default_domain"
                        >
                            <a
                                :href="tenantPcUrl"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {{ tenantPcUrl || '--' }}
                            </a>
                            <span
                                class="flex items-center ml-2 cursor-pointer"
                                v-copy="tenantPcUrl"
                            >
                                <icon name="el-icon-DocumentCopy" />
                                复制
                            </span>
                        </el-form-item>
                        <el-form-item
                            v-if="!editStatus"
                            label="移动端："
                            class="col-span-2"
                            prop="default_domain"
                        >
                            <a
                                :href="tenantMobileUrl"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {{ tenantMobileUrl || '--' }}
                            </a>
                            <span
                                class="flex items-center ml-2 cursor-pointer"
                                v-copy="tenantMobileUrl"
                            >
                                <icon name="el-icon-DocumentCopy" />
                                复制
                            </span>
                        </el-form-item>
                    </el-form>
                </el-tab-pane>
                <el-tab-pane lazy label="账号列表" name="accounts">
                    <Accounts :tenant_id="formData.id" />
                </el-tab-pane>
                <el-tab-pane lazy label="用户列表" name="users">
                    <Users :tenant_id="formData.id" />
                </el-tab-pane>
            </el-tabs>
        </div>
    </el-drawer>
</template>

<script lang="ts" setup>
import { getPointUnit } from '@/utils/point-unit'

import type { FormInstance, FormRules } from 'element-plus'
import { cloneDeep } from 'lodash-es'

import { getUserDetail, tenantSso, userEdit } from '@/api/consumer'
import { tenantPackageLists } from '@/api/tenant_package'
import { useLockFn } from '@/hooks/useLockFn'

import Accounts from './account/index.vue'
import Users from './user/index.vue'

interface DetailType {
    avatar: string
    create_time: string
    name: string
    sn: string
    domain: string
    default_domain: string
    id: number
    disable: number
    tel: string
    domain_alias: string
    domain_aliases: DomainAliasType[]
    domain_alias_enable: number
    access_mode: 'subdomain' | 'id' | 'alias'
    contract_package_id?: number | string
    contract_package_name?: string
    contract_expire_time?: number | string
    contract_expire_time_text?: string
    contract_status?: number
    allow_custom_storage: number
    allow_local_storage: number
    notes: string
    point_balance: string
    tenant_id_domain?: string
    links?: Record<string, any>
}

interface DomainAliasType {
    domain: string
    status: number
    is_primary?: number
}

interface TenantPackageOption {
    id: number
    name: string
    duration_days: number
    duration_desc?: string
}

const drawer = ref(false)
const formRef = shallowRef<FormInstance>()
const tenantId = ref<number>(0)
const activeName = ref<'profile' | 'accounts' | 'users'>('profile')
const editStatus = ref<boolean>(false)
const tempFormData = ref<DetailType>()
const loading = ref<boolean>(true)
const packageLoading = ref(false)
const packageOptions = ref<TenantPackageOption[]>([])
const formData = ref<DetailType>({
    avatar: '',
    create_time: '',
    name: '',
    sn: '',
    domain: '',
    default_domain: '',
    id: 0,
    disable: 0,
    tel: '',
    domain_alias: '',
    domain_aliases: [],
    domain_alias_enable: 1,
    access_mode: 'subdomain',
    contract_package_id: 0,
    allow_custom_storage: 0,
    allow_local_storage: 1,
    notes: '',
    point_balance: '0.00',
    contract_package_name: '',
    contract_expire_time: 0,
    contract_status: 0
})

const addAlias = () => {
    formData.value.domain_aliases.push({
        domain: '',
        status: 1
    })
}

const removeAlias = (index: number) => {
    formData.value.domain_aliases.splice(index, 1)
}

const buildDomainAliases = () => {
    const aliases = [
        {
            domain: formData.value.domain_alias,
            is_primary: 1,
            status: 1
        },
        ...formData.value.domain_aliases.map((item) => ({
            domain: item.domain,
            is_primary: 0,
            status: item.status
        }))
    ]
    const unique: DomainAliasType[] = []
    const seen = new Set<string>()
    aliases.forEach((item) => {
        const domain = String(item.domain || '').trim()
        if (!domain || seen.has(domain)) {
            return
        }
        seen.add(domain)
        unique.push({
            domain,
            status: item.status,
            is_primary: item.is_primary
        })
    })
    return unique
}

const formRules: FormRules = {
    name: [
        {
            required: true,
            message: '请输入租户名称',
            trigger: ['blur']
        }
    ],
    domain_alias: [
        {
            validator: (rule, value, callback) => {
                if (!String(value || '').trim()) {
                    callback(new Error('请设置域名别名'))
                    return
                }
                callback()
            },
            trigger: ['blur', 'change']
        }
    ]
}

const emits = defineEmits(['refresh'])
const toDateTimeString = (value: any) => {
    if (!value) {
        return ''
    }
    if (!Number.isFinite(Number(value))) {
        return String(value)
    }
    const date = new Date(Number(value) * 1000)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
const formatDateTime = (date: Date) => {
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
const loadTenantPackages = async () => {
    if (packageLoading.value) {
        return
    }
    packageLoading.value = true
    try {
        const data = await tenantPackageLists({
            page_no: 1,
            page_size: 100,
            status: 1
        })
        packageOptions.value = Array.isArray(data?.lists) ? data.lists : []
    } finally {
        packageLoading.value = false
    }
}
const handlePackageChange = (packageId: number | string) => {
    const item = packageOptions.value.find((option) => Number(option.id) === Number(packageId))
    formData.value.contract_package_name = item?.name || ''
    if (item && !formData.value.contract_expire_time) {
        const expireDate = new Date(Date.now() + Math.max(1, Number(item.duration_days) || 1) * 86400 * 1000)
        formData.value.contract_expire_time = formatDateTime(expireDate)
    }
}
const handlePackageClear = () => {
    formData.value.contract_package_id = 0
    formData.value.contract_package_name = ''
}
const contractExpireText = computed(() => toDateTimeString(formData.value.contract_expire_time) || '--')
const contractStatusText = computed(() => {
    if (formData.value.contract_status === 1) return '有效'
    if (formData.value.contract_status === 2) return '已到期'
    return '未签约'
})

const openHandle = (id: number, status?: boolean, tabIndex?: 'profile' | 'accounts' | 'users') => {
    loading.value = true
    activeName.value = tabIndex || 'profile'
    editStatus.value = status || false
    if (editStatus.value) {
        loadTenantPackages()
    }
    getDetails(id)
    tenantId.value = id
    drawer.value = true
}

const beforeLeave = async () => {
    if (editStatus.value) {
        try {
            await ElMessageBox.confirm('修改还未保存，确认退出编辑吗？')
            handleEdit()
        } catch (error) {
            return false
        }
    }
}
const getDetails = async (id: number) => {
    const data: DetailType = await getUserDetail({
        id: id
    })
    loading.value = false
    data.access_mode = 'alias'
    const aliases = Array.isArray(data.domain_aliases) ? data.domain_aliases : []
    const primaryAlias = aliases.find((item) => Number(item.is_primary) === 1)
        || aliases.find((item) => Number(item.status) === 1 && item.domain === data.domain_alias)
        || aliases.find((item) => Number(item.status) === 1)
        || aliases[0]
    data.domain_alias = primaryAlias?.domain || data.domain_alias || ''
    data.domain_aliases = aliases
        .filter((item) => item.domain !== data.domain_alias)
        .map((item) => ({
            domain: item.domain,
            status: Number(item.status) === 0 ? 0 : 1
        }))
    data.contract_expire_time = toDateTimeString(data.contract_expire_time)
    formData.value = data
    tempFormData.value = cloneDeep(formData.value)
}

const beforeClose = (done: () => void) => {
    if (editStatus.value) {
        ElMessageBox.confirm('修改还未保存，确认退出编辑吗？')
            .then(() => {
                done()
            })
            .catch(() => {
                console.log('取消')
            })
    } else {
        done()
    }
}

const afterClose = () => {
    formRef.value?.resetFields()
}

const handleEdit = async (save?: boolean) => {
    if (editStatus.value) {
        if (save) {
            await formRef.value?.validate()
            await lockSubmit()
        } else {
            formData.value = tempFormData.value as DetailType
            formRef.value?.clearValidate()
        }
    } else {
        activeName.value = 'profile'
        loadTenantPackages()
        await nextTick()
    }
    editStatus.value = !editStatus.value
}

const submitEdit = async () => {
    loading.value = true
    try {
        const payload = {
            ...formData.value,
            contract_package_id: Number(formData.value.contract_package_id) || 0,
            domain_alias_enable: 0,
            domain_aliases: buildDomainAliases()
        }
        if (payload.allow_custom_storage !== 1) {
            payload.allow_local_storage = 1
        }
        await userEdit(payload)
        await getDetails(tenantId.value)
        emits('refresh')
    } catch (error) {
        loading.value = false
    }
}

const tenantPcUrl = computed(() => {
    return (
        formData.value.links?.current?.pc ||
        formData.value.links?.subdomain?.pc ||
        formData.value.default_domain?.replace('/admin/', '/')
    )
})

const tenantMobileUrl = computed(() => {
    return (
        formData.value.links?.current?.mobile ||
        formData.value.links?.subdomain?.mobile ||
        formData.value.default_domain?.replace('/admin/', '/mobile/')
    )
})

const handleEnterTenant = async () => {
    if (!formData.value.id) {
        return
    }
    const data = await tenantSso({
        tenant_id: formData.value.id,
        target: 'admin'
    })
    window.open(data.url, '_blank')
}

const { isLock, lockFn: lockSubmit } = useLockFn(submitEdit)

defineExpose({
    openHandle
})
</script>

<style lang="scss" scoped>
:deep(.el-tabs__content) {
    flex: 1;

    .el-tab-pane {
        height: 100%;
    }
}

.profile {
    :deep(.el-form-item__content) {
        align-items: center;
    }
}

.alias-row {
    @apply flex items-center gap-3 mb-3;

    :deep(.el-input) {
        flex: 1;
    }
}
</style>
