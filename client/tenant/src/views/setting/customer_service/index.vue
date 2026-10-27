<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-tabs v-model="activeTab">
                <el-tab-pane label="客服与帮助" name="config">
                    <el-form ref="formRef" :model="formData" label-width="130px" class="ls-form">
                        <el-form-item label="客服二维码">
                            <div>
                                <material-picker v-model="formData.qr_code" :limit="1" />
                                <div class="form-tips">用于 PC 帮助面板和移动端客服页展示</div>
                            </div>
                        </el-form-item>
                        <el-form-item label="客服微信">
                            <el-input v-model.trim="formData.wechat" class="w-[360px]" placeholder="请输入客服微信号" />
                        </el-form-item>
                        <el-form-item label="客服电话">
                            <el-input v-model.trim="formData.phone" class="w-[360px]" placeholder="请输入客服电话" />
                        </el-form-item>
                        <el-form-item label="服务时间">
                            <el-input v-model.trim="formData.service_time" class="w-[360px]" placeholder="例如：9:00 - 18:00" />
                        </el-form-item>
                        <el-form-item label="企业微信链接">
                            <el-input v-model.trim="formData.enterprise_wechat_url" class="w-[520px]" placeholder="请输入企业微信客服跳转链接" />
                        </el-form-item>
                        <el-form-item label="PC帮助浮层">
                            <el-switch v-model="formData.pc_help_enabled" :active-value="1" :inactive-value="0" />
                        </el-form-item>
                    </el-form>

                    <div class="faq-head">
                        <div>
                            <div class="text-xl font-medium">常见问题</div>
                            <div class="form-tips">配置后会展示在 PC 一级页帮助面板中，停用的问题不会展示给用户</div>
                        </div>
                        <el-button type="primary" @click="addFaq">新增问题</el-button>
                    </div>
                    <el-table :data="formData.pc_help_faqs" size="large">
                        <el-table-column label="排序" width="120">
                            <template #default="{ row }">
                                <el-input-number v-model="row.sort" :min="0" :controls="false" class="w-[88px]" />
                            </template>
                        </el-table-column>
                        <el-table-column label="问题" min-width="220">
                            <template #default="{ row }">
                                <el-input v-model="row.question" maxlength="120" placeholder="请输入问题" />
                            </template>
                        </el-table-column>
                        <el-table-column label="答案" min-width="320">
                            <template #default="{ row }">
                                <el-input v-model="row.answer" type="textarea" :rows="3" placeholder="请输入答案" />
                            </template>
                        </el-table-column>
                        <el-table-column label="状态" width="100">
                            <template #default="{ row }">
                                <el-switch v-model="row.status" :active-value="1" :inactive-value="0" />
                            </template>
                        </el-table-column>
                        <el-table-column label="操作" width="90" fixed="right">
                            <template #default="{ $index }">
                                <el-button type="danger" link @click="removeFaq($index)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>

                <el-tab-pane label="反馈管理" name="feedback">
                    <div class="feedback-filter">
                        <el-form :inline="true" :model="queryParams">
                            <el-form-item label="类型">
                                <el-select v-model="queryParams.type" class="w-[150px]" clearable @change="resetPage">
                                    <el-option v-for="item in feedbackTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="状态">
                                <el-select v-model="queryParams.status" class="w-[150px]" clearable @change="resetPage">
                                    <el-option label="待处理" :value="0" />
                                    <el-option label="处理中" :value="1" />
                                    <el-option label="已处理" :value="2" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="关键词">
                                <el-input v-model.trim="queryParams.keyword" class="w-[220px]" clearable placeholder="反馈内容/联系方式" @keyup.enter="resetPage" />
                            </el-form-item>
                            <el-form-item>
                                <el-button @click="resetPage">查询</el-button>
                                <el-button @click="resetQuery">重置</el-button>
                            </el-form-item>
                        </el-form>
                    </div>
                    <el-table v-loading="pager.loading" :data="pager.lists" size="large">
                        <el-table-column label="用户" min-width="140">
                            <template #default="{ row }">
                                <div>{{ row.user_id > 0 ? (row.user?.nickname || row.user?.sn || `用户${row.user_id}`) : '游客' }}</div>
                                <div class="text-tx-secondary text-xs">ID：{{ row.user_id || '-' }}</div>
                            </template>
                        </el-table-column>
                        <el-table-column label="类型" width="110">
                            <template #default="{ row }">
                                <el-tag>{{ row.type_label }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="内容" min-width="260" prop="content" show-overflow-tooltip />
                        <el-table-column label="图片" width="140">
                            <template #default="{ row }">
                                <div v-if="row.images_url?.length" class="feedback-images">
                                    <el-image
                                        v-for="image in row.images_url"
                                        :key="image"
                                        class="feedback-image"
                                        :src="image"
                                        fit="cover"
                                        :preview-src-list="row.images_url"
                                        preview-teleported
                                    />
                                </div>
                                <span v-else class="text-tx-secondary">-</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="联系方式" prop="contact" min-width="130" show-overflow-tooltip />
                        <el-table-column label="状态" width="100">
                            <template #default="{ row }">
                                <el-tag :type="statusTagType(row.status)">{{ row.status_label }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="提交时间" prop="create_time" min-width="170" />
                        <el-table-column label="操作" width="100" fixed="right">
                            <template #default="{ row }">
                                <el-button type="primary" link @click="openReply(row)">处理</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                    <div class="flex justify-end mt-4">
                        <pagination v-model="pager" @change="getLists" />
                    </div>
                </el-tab-pane>
            </el-tabs>
        </el-card>

        <footer-btns v-if="activeTab === 'config'" v-perms="['setting.customer_service/setConfig']">
            <el-button type="primary" @click="handleSubmit">保存</el-button>
        </footer-btns>

        <el-dialog v-model="replyVisible" title="处理反馈" width="560px">
            <el-form label-width="90px" :model="replyForm">
                <el-form-item label="状态">
                    <el-radio-group v-model="replyForm.status">
                        <el-radio :value="0">待处理</el-radio>
                        <el-radio :value="1">处理中</el-radio>
                        <el-radio :value="2">已处理</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="回复">
                    <el-input v-model="replyForm.reply" type="textarea" :rows="5" maxlength="500" show-word-limit />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="replyVisible = false">取消</el-button>
                <el-button type="primary" @click="handleReply">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="customerServiceSetting">
import {
    getCustomerServiceConfig,
    getPcFeedbackLists,
    replyPcFeedback,
    setCustomerServiceConfig
} from '@/api/setting/customer_service'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'
import { getPointUnit } from '@/utils/point-unit'

const activeTab = ref('config')
const formRef = ref()
const formData = reactive<any>({
    qr_code: '',
    wechat: '',
    phone: '',
    service_time: '',
    enterprise_wechat_url: '',
    pc_help_enabled: 1,
    pc_help_faqs: []
})
const queryParams = reactive({
    type: '',
    status: '',
    keyword: ''
})
const replyVisible = ref(false)
const replyForm = reactive({
    id: 0,
    status: 2,
    reply: ''
})

const pointUnit = computed(() => getPointUnit())
const feedbackTypeOptions = computed(() => [
    { label: '图片生成', value: 'image' },
    { label: '视频生成', value: 'video' },
    { label: '数字人', value: 'avatar' },
    { label: '智能画布', value: 'canvas' },
    { label: '故事创作', value: 'story' },
    { label: `会员与${pointUnit.value}`, value: 'membership' },
    { label: '开具发票', value: 'invoice' },
    { label: '其他咨询/建议', value: 'other' },
    { label: '功能反馈', value: 'feature' },
    { label: '优化建议', value: 'suggestion' }
])

const { pager, getLists, resetPage } = usePaging({
    fetchFun: getPcFeedbackLists,
    params: queryParams
})

const normalizeFaqs = (items: any[]) => {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
        id: item.id || `faq_${Date.now()}_${index}`,
        question: item.question || '',
        answer: item.answer || '',
        sort: Number(item.sort ?? (items.length - index)),
        status: Number(item.status ?? 1)
    }))
}

const getData = async () => {
    const data = await getCustomerServiceConfig()
    Object.assign(formData, {
        qr_code: data.qr_code || '',
        wechat: data.wechat || '',
        phone: data.phone || '',
        service_time: data.service_time || '',
        enterprise_wechat_url: data.enterprise_wechat_url || '',
        pc_help_enabled: Number(data.pc_help_enabled ?? 1),
        pc_help_faqs: normalizeFaqs(data.pc_help_faqs)
    })
}

const addFaq = () => {
    formData.pc_help_faqs.push({
        id: `faq_${Date.now()}`,
        question: '',
        answer: '',
        sort: formData.pc_help_faqs.length + 1,
        status: 1
    })
}

const removeFaq = async (index: number) => {
    await feedback.confirm('确定要删除该问题？')
    formData.pc_help_faqs.splice(index, 1)
}

const handleSubmit = async () => {
    const faqs = normalizeFaqs(formData.pc_help_faqs)
        .filter((item) => item.question.trim() || item.answer.trim())
        .sort((a, b) => b.sort - a.sort)
    await setCustomerServiceConfig({
        ...formData,
        pc_help_faqs: faqs
    })
    await getData()
}

const resetQuery = () => {
    Object.assign(queryParams, {
        type: '',
        status: '',
        keyword: ''
    })
    resetPage()
}

const statusTagType = (status: number) => {
    if (Number(status) === 2) return 'success'
    if (Number(status) === 1) return 'warning'
    return 'info'
}

const openReply = (row: any) => {
    Object.assign(replyForm, {
        id: row.id,
        status: Number(row.status ?? 2),
        reply: row.reply || ''
    })
    replyVisible.value = true
}

const handleReply = async () => {
    await replyPcFeedback({ ...replyForm })
    replyVisible.value = false
    getLists()
}

watch(activeTab, (value) => {
    if (value === 'feedback' && !pager.lists.length) {
        getLists()
    }
})

getData()
</script>

<style lang="scss" scoped>
.faq-head,
.feedback-filter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 22px 0 16px;
}

.feedback-images {
    display: flex;
    gap: 6px;
}

.feedback-image {
    width: 36px;
    height: 36px;
    border-radius: 4px;
}
</style>
