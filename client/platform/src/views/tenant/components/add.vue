<template>
    <el-drawer
        v-model="drawer"
        title="新增租户"
        direction="rtl"
        size="50%"
        :destroy-on-close="true"
        :before-close="beforeClose"
        @close="afterClose"
    >
        <el-form
            ref="formRef"
            class="ls-form"
            label-position="right"
            :model="formData"
            :rules="rules"
            label-width="100px"
        >
            <div class="form_header">基础信息</div>
            <el-form-item label="头像：" prop="avatar">
                <material-picker v-model="formData.avatar" :limit="1" />
            </el-form-item>
            <el-form-item label="租户名称：" prop="name">
                <el-input
                    v-model="formData.name"
                    placeholder="请输入租户名称"
                    style="width: 280px"
                />
            </el-form-item>
            <el-form-item label="租户状态：" prop="disable">
                <el-radio-group v-model="formData.disable">
                    <el-radio :value="0">开启</el-radio>
                    <el-radio :value="1">关闭</el-radio>
                </el-radio-group>
            </el-form-item>
            <el-form-item label="自定义存储：" prop="allow_custom_storage">
                <div>
                    <el-radio-group v-model="formData.allow_custom_storage">
                        <el-radio :value="1">允许</el-radio>
                        <el-radio :value="0">不允许</el-radio>
                    </el-radio-group>
                    <p class="text-info text-sm">
                        开启后，租户可在后台系统设置中配置自己的文件存储；关闭时统一使用平台存储。
                    </p>
                </div>
            </el-form-item>
            <el-form-item
                v-if="formData.allow_custom_storage === 1"
                label="本地存储："
                prop="allow_local_storage"
            >
                <div>
                    <el-radio-group v-model="formData.allow_local_storage">
                        <el-radio :value="1">允许</el-radio>
                        <el-radio :value="0">不允许</el-radio>
                    </el-radio-group>
                    <p class="text-info text-sm">
                        关闭后，租户只能配置对象存储，后台不显示本地存储入口。
                    </p>
                </div>
            </el-form-item>
            <el-form-item label="联系方式：" prop="tel">
                <el-input
                    v-model="formData.tel"
                    :maxlength="30"
                    placeholder="请输入联系方式"
                    style="max-width: 250px"
                />
            </el-form-item>
            <el-form-item label="访问方式：" prop="access_mode">
                <div>
                    <el-tag type="primary">别名访问</el-tag>
                    <p class="text-info text-sm">新建租户默认使用别名访问，且必须配置别名。</p>
                </div>
            </el-form-item>
            <el-form-item label="域名别名：" prop="domain_alias">
                <el-input
                    v-model="formData.domain_alias"
                    placeholder="请输入域名别名"
                    style="max-width: 250px"
                />
            </el-form-item>
            <el-form-item label="备用域名：">
                <div class="w-full max-w-[620px]">
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
                    <p class="text-info text-sm mt-2">
                        启用后，租户可通过多个域名访问；主域名仍使用上面的域名别名。
                    </p>
                </div>
            </el-form-item>
            <el-form-item label="到期时间：" prop="contract_expire_time">
                <el-date-picker
                    v-model="formData.contract_expire_time"
                    type="datetime"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    placeholder="请选择到期时间"
                />
            </el-form-item>
            <el-form-item label="租户备注：" prop="notes">
                <el-input
                    v-model="formData.notes"
                    placeholder="请输入租户备注"
                    style="max-width: 250px"
                    type="textarea"
                    :maxlength="100"
                />
            </el-form-item>
            <div class="form_header">
                账号信息
                <span class="text-xs font-normal text-info opacity-70">
                    （不填则生成默认账号，账号默认为sn编码，密码默认123456）
                </span>
            </div>
            <el-form-item label="管理员账号：" prop="account">
                <el-input
                    v-model="formData.account"
                    placeholder="请输入管理员账号"
                    style="max-width: 250px"
                />
            </el-form-item>
            <el-form-item label="密码：" prop="password">
                <el-input
                    v-model="formData.password"
                    type="password"
                    placeholder="请输入密码"
                    style="max-width: 250px"
                />
            </el-form-item>
            <el-form-item label="确认密码：" prop="password_confirm">
                <el-input
                    v-model="formData.password_confirm"
                    type="password"
                    placeholder="请再次输入密码"
                    style="max-width: 250px"
                />
            </el-form-item>
            <el-form-item>
                <el-button type="primary" :loading="isLock" @click="lockSubmit">提交</el-button>
            </el-form-item>
        </el-form>
    </el-drawer>
</template>

<script lang="ts" setup>
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { userAdd } from '@/api/consumer'
import { useLockFn } from '@/hooks/useLockFn'

interface DetailType {
    contract_expire_time: string
    avatar: string
    create_time: string
    name: string
    sn: string
    id: string
    disable: number
    tel: string
    tactics: number
    domain_alias: string
    domain_aliases: DomainAliasType[]
    domain_alias_enable: number
    access_mode: 'subdomain' | 'id' | 'alias'
    allow_custom_storage: number
    allow_local_storage: number
    notes: string
    account: string
    password: string
    password_confirm: string
}

interface DomainAliasType {
    domain: string
    status: number
    is_primary?: number
}

const drawer = ref<boolean>(false)
const formRef = shallowRef<FormInstance>()
const submited = ref<boolean>(false)
const formData = ref<DetailType>({
    avatar: '',
    create_time: '',
    name: '',
    sn: '',
    id: '',
    disable: 0,
    tel: '',
    tactics: 0,
    domain_alias: '',
    domain_aliases: [],
    domain_alias_enable: 1,
    access_mode: 'alias',
    allow_custom_storage: 0,
    allow_local_storage: 1,
    notes: '',
    contract_expire_time: '',
    account: '',
    password: '',
    password_confirm: ''
})

const rules: FormRules = {
    name: [
        {
            required: true,
            message: '请输入租户名称',
            trigger: ['blur']
        }
    ],
    disable: [
        {
            required: true,
            message: '请选择租户状态',
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

const openHandle = () => {
    submited.value = false
    drawer.value = true
}

const beforeClose = (done: () => void) => {
    if (submited.value) done()
    ElMessageBox.confirm('表单未提交，确认退出编辑吗？')
        .then(() => {
            done()
        })
        .catch(() => {})
}

const afterClose = () => {
    formRef.value?.resetFields()
}

const submitAdd = async () => {
    await formRef.value?.validate()
    if (formData.value.password !== formData.value.password_confirm) {
        return ElMessage.error('两次密码输入不一致')
    }
    const payload = {
        ...formData.value,
        domain_alias_enable: 0,
        domain_aliases: buildDomainAliases()
    }
    if (payload.allow_custom_storage !== 1) {
        payload.allow_local_storage = 1
    }
    await userAdd(payload)
    submited.value = true
    drawer.value = false
    emits('refresh')
}

const { isLock, lockFn: lockSubmit } = useLockFn(submitAdd)

defineExpose({
    openHandle
})
</script>

<style lang="scss" scoped>
.form_header {
    @apply text-lg font-bold mb-4 p-2 rounded;
    background-color: rgba(204, 204, 204, 0.2);
}

.alias-row {
    @apply flex items-center gap-3 mb-3;

    :deep(.el-input) {
        flex: 1;
    }
}
</style>
