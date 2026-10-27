<template>
    <Teleport to="body">
        <transition name="ai-help-fade">
            <div v-if="enabled" class="ai-help-float">
                <button v-if="showBackTop" class="ai-help-float__btn" type="button" title="返回顶部" aria-label="返回顶部" @click="$emit('backTop')">
                    <span>↑</span>
                </button>
                <button class="ai-help-float__btn ai-help-float__btn--primary" type="button" title="帮助" aria-label="帮助" @click="openPanel">
                    <span>?</span>
                </button>
            </div>
        </transition>

        <transition name="ai-help-panel">
            <aside v-if="panelOpen && !dialogOpen" class="ai-help-panel">
                <div v-if="viewMode === 'list'" class="ai-help-panel__head">
                    <div>
                        <strong>Hi，{{ nickname }}</strong>
                        <span>很高兴为您服务</span>
                    </div>
                    <PcCloseButton aria-label="关闭" @click="closePanel" />
                </div>

                <template v-if="viewMode === 'list'">
                    <div class="ai-help-search">
                        <span>⌕</span>
                        <input v-model.trim="keyword" type="text" placeholder="搜索常见问题" />
                    </div>
                    <div class="ai-help-section">
                        <div class="ai-help-section__title">常见问题</div>
                        <button
                            v-for="item in filteredFaqs"
                            :key="item.id"
                            class="ai-help-faq"
                            type="button"
                            @click="openFaq(item)"
                        >
                            <span>{{ item.question }}</span>
                            <i>›</i>
                        </button>
                        <div v-if="!filteredFaqs.length" class="ai-help-empty">暂无匹配的问题</div>
                    </div>
                    <div class="ai-help-panel__footer">
                        <button type="button" @click="openFeedback">
                            <span>意见反馈</span>
                        </button>
                        <button v-if="userStore.isLogin" type="button" @click="openService">
                            <span>在线客服</span>
                        </button>
                    </div>
                </template>

                <template v-else>
                    <div class="ai-help-detail-head">
                        <button class="ai-help-back" type="button" aria-label="返回" @click="viewMode = 'list'">
                            <span class="ai-help-back__icon" aria-hidden="true"></span>
                        </button>
                    </div>
                    <article class="ai-help-answer">
                        <h3>{{ activeFaq?.question }}</h3>
                        <div class="ai-help-answer__body" v-html="formatAnswer(activeFaq?.answer || '')"></div>
                    </article>
                    <div class="ai-help-resolve">
                        <button type="button" @click="markResolved(true)">已解决</button>
                        <button type="button" @click="markResolved(false)">未解决</button>
                    </div>
                </template>
            </aside>
        </transition>

        <transition name="ai-help-mask">
            <div v-if="feedbackOpen || serviceOpen" class="ai-help-mask" @click.self="closeDialogs">
                <section v-if="feedbackOpen" class="ai-help-dialog ai-help-dialog--feedback">
                    <div class="ai-help-dialog__head">
                        <strong>反馈</strong>
                        <PcCloseButton aria-label="关闭" @click="feedbackOpen = false" />
                    </div>
                    <div class="ai-help-feedback-form">
                        <div class="ai-help-form-row">
                            <span>类型 <b>*</b></span>
                            <div class="ai-help-type">
                                <button
                                    v-for="item in feedbackTypes"
                                    :key="item.value"
                                    type="button"
                                    :class="{ 'is-active': feedbackForm.type === item.value }"
                                    @click="feedbackForm.type = item.value"
                                >
                                    {{ item.label }}
                                </button>
                            </div>
                        </div>
                        <div class="ai-help-form-row">
                            <span>描述 <b>*</b></span>
                            <div class="ai-help-textarea">
                                <textarea v-model="feedbackForm.content" maxlength="400" placeholder="请输入你的问题或建议" />
                                <div>{{ feedbackForm.content.length }}/400</div>
                            </div>
                        </div>
                        <div class="ai-help-form-row">
                            <span>联系方式</span>
                            <input v-model.trim="feedbackForm.contact" class="ai-help-contact" type="text" placeholder="请留下您的联系方式方便反馈" />
                        </div>
                        <div class="ai-help-form-row">
                            <span>上传图片 <b>*</b></span>
                            <div class="ai-help-upload-wrap">
                                <div class="ai-help-upload">
                                    <button v-if="feedbackForm.images.length < 4" type="button" :disabled="uploading" @click="triggerFeedbackUpload">
                                        {{ uploading ? '上传中' : '+' }}
                                    </button>
                                    <span v-for="(image, index) in feedbackForm.images" :key="image" class="ai-help-upload__item">
                                        <img :src="imageUrl(image)" alt="" />
                                        <button type="button" @click="feedbackForm.images.splice(index, 1)">×</button>
                                    </span>
                                    <input ref="uploadInputRef" type="file" accept="image/*" multiple @change="handleFeedbackUpload" />
                                </div>
                                <em>({{ feedbackForm.images.length }}/4)</em>
                            </div>
                        </div>
                        <button class="ai-help-submit" type="button" :disabled="!canSubmitFeedback" @click="submitFeedback">
                            {{ submitting ? '提交中...' : '提交' }}
                        </button>
                    </div>
                </section>

                <section v-if="serviceOpen" class="ai-help-dialog ai-help-dialog--service">
                    <div class="ai-help-dialog__head">
                        <strong>在线客服</strong>
                        <PcCloseButton aria-label="关闭" @click="serviceOpen = false" />
                    </div>
                    <div class="ai-help-service">
                        <div class="ai-help-service__qr">
                            <img v-if="customerService.qr_code" :src="customerService.qr_code" alt="客服二维码" />
                            <span v-else>暂无二维码</span>
                        </div>
                        <p v-if="customerService.wechat">微信：{{ customerService.wechat }}</p>
                        <p v-if="customerService.phone">电话：{{ customerService.phone }}</p>
                        <p v-if="customerService.service_time">服务时间：{{ customerService.service_time }}</p>
                        <button type="button" :disabled="!customerService.enterprise_wechat_url" @click="openEnterpriseWechat">
                            联系企业微信客户
                        </button>
                    </div>
                </section>
            </div>
        </transition>
    </Teleport>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import { submitPcFeedback, uploadPcFeedbackImage } from '@/api/app'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import feedback from '@/utils/feedback'

type HelpFaq = {
    id: string
    question: string
    answer: string
    sort?: number
    status?: number
}

defineProps<{
    showBackTop: boolean
}>()

defineEmits<{
    (event: 'backTop'): void
}>()

const appStore = useAppStore()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()
const { pointUnit } = usePointUnit()

const panelOpen = ref(false)
const feedbackOpen = ref(false)
const serviceOpen = ref(false)
const dialogOpen = computed(() => feedbackOpen.value || serviceOpen.value)
const viewMode = ref<'list' | 'detail'>('list')
const keyword = ref('')
const activeFaq = ref<HelpFaq | null>(null)
const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const submitting = ref(false)

const feedbackTypes = computed(() => [
    { label: '图片生成', value: 'image' },
    { label: '视频生成', value: 'video' },
    { label: '数字人', value: 'avatar' },
    { label: '智能画布', value: 'canvas' },
    { label: '故事创作', value: 'story' },
    { label: `会员与${pointUnit.value}`, value: 'membership' },
    { label: '开具发票', value: 'invoice' },
    { label: '其他咨询/建议', value: 'other' }
])
const feedbackForm = reactive({
    type: 'image',
    content: '',
    images: [] as string[],
    contact: ''
})

const config = computed(() => appStore.config || {})
const enabled = computed(() => Number(config.value.pc_help?.enabled ?? 1) === 1)
const faqs = computed<HelpFaq[]>(() => Array.isArray(config.value.pc_help?.faqs) ? config.value.pc_help.faqs : [])
const customerService = computed(() => config.value.customer_service || {})
const nickname = computed(() => userStore.isLogin ? (userStore.userInfo?.nickname || '亲爱的用户') : '亲爱的用户')
const canSubmitFeedback = computed(() =>
    Boolean(feedbackForm.type)
    && Boolean(feedbackForm.content.trim())
    && feedbackForm.images.length > 0
    && !submitting.value
    && !uploading.value
)
const filteredFaqs = computed(() => {
    const q = keyword.value.trim().toLowerCase()
    const rows = faqs.value.filter((item) => item.question || item.answer)
    if (!q) return rows
    return rows.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(q))
})

const openPanel = () => {
    panelOpen.value = true
    viewMode.value = 'list'
}

const closePanel = () => {
    panelOpen.value = false
    viewMode.value = 'list'
    activeFaq.value = null
}

const openFaq = (item: HelpFaq) => {
    activeFaq.value = item
    viewMode.value = 'detail'
}

const markResolved = (resolved: boolean) => {
    feedback.msgSuccess(resolved ? '感谢反馈，很高兴帮到您' : '已收到反馈，您也可以继续提交意见')
}

const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatAnswer = (text: string) => escapeHtml(text).replace(/\n/g, '<br>')

const openFeedback = () => {
    feedbackOpen.value = true
}

const openService = () => {
    if (!ensurePcLogin()) return
    serviceOpen.value = true
}

const resetFeedbackForm = () => {
    feedbackForm.type = 'image'
    feedbackForm.content = ''
    feedbackForm.images = []
    feedbackForm.contact = ''
}

const triggerFeedbackUpload = () => {
    uploadInputRef.value?.click()
}

const imageUrl = (uri: string) => {
    if (/^(https?:)?\/\//i.test(uri) || uri.startsWith('data:') || uri.startsWith('/')) return uri
    const domain = config.value.domain || ''
    return domain ? `${domain}${uri}` : uri
}

const handleFeedbackUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || []).slice(0, Math.max(4 - feedbackForm.images.length, 0))
    input.value = ''
    if (!files.length) return
    uploading.value = true
    try {
        for (const file of files) {
            const res: any = await uploadPcFeedbackImage({ file })
            const uri = res?.uri || res?.url || res
            if (uri && feedbackForm.images.length < 4) {
                feedbackForm.images.push(String(uri))
            }
        }
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '图片上传失败')
    } finally {
        uploading.value = false
    }
}

const submitFeedback = async () => {
    const content = feedbackForm.content.trim()
    if (!content) {
        feedback.msgWarning('请输入反馈内容')
        return
    }
    if (!feedbackForm.images.length) {
        feedback.msgWarning('请上传反馈图片')
        return
    }
    submitting.value = true
    try {
        await submitPcFeedback({
            type: feedbackForm.type,
            content,
            images: feedbackForm.images,
            contact: feedbackForm.contact
        })
        feedback.msgSuccess('反馈已提交')
        resetFeedbackForm()
        feedbackOpen.value = false
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || '反馈提交失败')
    } finally {
        submitting.value = false
    }
}

const closeDialogs = () => {
    feedbackOpen.value = false
    serviceOpen.value = false
}

const openEnterpriseWechat = () => {
    const url = String(customerService.value.enterprise_wechat_url || '')
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<style lang="scss" scoped>
.ai-help-float {
    position: fixed;
    right: 26px;
    bottom: 24px;
    z-index: 1800;
    display: grid;
    gap: 10px;
}

.ai-help-float__btn {
    width: 52px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 10px;
    background: rgba(34, 35, 40, 0.92);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32);
    backdrop-filter: blur(14px);
}

.ai-help-float__btn span {
    font-size: 18px;
    line-height: 1;
}

.ai-help-float__btn--primary {
    background: #f4f4f5;
    color: #15161a;
    font-weight: 700;
}

.ai-help-panel {
    position: fixed;
    right: 26px;
    bottom: 82px;
    z-index: 1810;
    width: min(380px, calc(100vw - 40px));
    max-height: min(680px, calc(100vh - 120px));
    display: flex;
    flex-direction: column;
    border: 0;
    border-radius: 14px;
    background: #17181d;
    color: #fff;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.46);
    overflow: hidden;
}

.ai-help-panel__head,
.ai-help-dialog__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 18px 14px;
}

.ai-help-panel__head strong,
.ai-help-dialog__head strong {
    display: block;
    font-size: 18px;
}

.ai-help-panel__head span {
    display: block;
    margin-top: 4px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
}

.ai-help-detail-head {
    min-height: 58px;
    display: flex;
    align-items: center;
    padding: 0 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
}

.ai-help-search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 18px 16px;
    padding: 0 12px;
    height: 42px;
    border: 0;
    border-radius: 9px;
    background: #25272e;
}

.ai-help-search input {
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
}

.ai-help-section {
    flex: 1;
    min-height: 220px;
    padding: 0 18px 14px;
    overflow: auto;
}

.ai-help-section__title {
    margin-bottom: 10px;
    font-weight: 700;
}

.ai-help-faq {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    padding: 10px 12px;
    border: 0;
    border-radius: 8px;
    background: #22242b;
    color: #fff;
    text-align: left;
    cursor: pointer;
}

.ai-help-faq span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ai-help-panel__footer {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    padding: 14px 18px 18px;
    border-top: 0;
}

.ai-help-panel__footer button,
.ai-help-submit,
.ai-help-service button {
    height: 42px;
    border: 0;
    border-radius: 9px;
    background: #f4f4f5;
    color: #15161a;
    font-weight: 700;
    cursor: pointer;
}

.ai-help-panel__footer button:only-child {
    grid-column: 1 / -1;
}

.ai-help-back {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: #fff;
    cursor: pointer;
}

.ai-help-back__icon {
    width: 13px;
    height: 13px;
    border-left: 4px solid currentColor;
    border-bottom: 4px solid currentColor;
    border-radius: 1px;
    transform: rotate(45deg);
}

.ai-help-answer {
    flex: 1;
    padding: 18px 18px 16px;
    overflow: auto;
}

.ai-help-answer h3 {
    margin: 0 0 14px;
    font-size: 18px;
    line-height: 1.5;
}

.ai-help-answer__body {
    color: rgba(255, 255, 255, 0.74);
    line-height: 1.8;
    word-break: break-word;
}

.ai-help-resolve {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    padding: 14px 18px 18px;
}

.ai-help-resolve button {
    height: 38px;
    border: 0;
    border-radius: 9px;
    background: #25272e;
    color: #fff;
    cursor: pointer;
}

.ai-help-mask {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.58);
}

.ai-help-dialog {
    width: min(760px, calc(100vw - 40px));
    max-height: calc(100vh - 80px);
    border: 0;
    border-radius: 14px;
    background: #17181d;
    color: #fff;
    overflow: auto;
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5);
}

.ai-help-dialog--service {
    width: min(390px, calc(100vw - 40px));
}

.ai-help-feedback-form {
    display: grid;
    gap: 26px;
    padding: 22px 28px 28px;
}

.ai-help-form-row {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: flex-start;
    gap: 22px;
}

.ai-help-form-row > span {
    padding-top: 9px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 15px;
}

.ai-help-form-row b {
    color: #ff4d64;
}

.ai-help-type {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
}

.ai-help-type button {
    height: 40px;
    padding: 0 18px;
    border: 0;
    border-radius: 8px;
    background: #25272e;
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
}

.ai-help-type button.is-active {
    background: #f4f4f5;
    color: #15161a;
}

.ai-help-textarea {
    position: relative;
}

.ai-help-textarea textarea {
    display: block;
    width: 100%;
    min-height: 160px;
    padding: 16px 16px 34px;
    border: 0;
    border-radius: 9px;
    background: #24262e;
    color: #fff;
    outline: none;
    resize: vertical;
}

.ai-help-textarea div {
    position: absolute;
    right: 14px;
    bottom: 12px;
    color: rgba(255, 255, 255, 0.42);
    font-size: 12px;
}

.ai-help-upload {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
}

.ai-help-upload-wrap {
    display: flex;
    align-items: flex-end;
    gap: 10px;
}

.ai-help-upload-wrap em {
    padding-bottom: 8px;
    color: rgba(255, 255, 255, 0.42);
    font-style: normal;
}

.ai-help-upload > button,
.ai-help-upload__item {
    width: 76px;
    height: 76px;
    border: 0;
    border-radius: 9px;
    background: #24262e;
    color: rgba(255, 255, 255, 0.72);
}

.ai-help-upload input {
    display: none;
}

.ai-help-upload__item {
    position: relative;
    overflow: hidden;
}

.ai-help-upload__item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.ai-help-upload__item button {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.58);
    color: #fff;
}

.ai-help-contact {
    width: 100%;
    height: 42px;
    margin: 0;
    padding: 0 16px;
    border: 0;
    border-radius: 9px;
    background: #24262e;
    color: #fff;
    outline: none;
}

.ai-help-submit {
    width: 136px;
    margin: 0 0 0 auto;
    background: #f4f4f5;
}

.ai-help-empty {
    padding: 40px 18px;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
}

.ai-help-service {
    padding: 0 18px 20px;
    text-align: center;
}

.ai-help-service__qr {
    width: 188px;
    height: 188px;
    display: grid;
    place-items: center;
    margin: 0 auto 14px;
    border-radius: 8px;
    background: #fff;
    color: #101012;
    overflow: hidden;
}

.ai-help-service__qr img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.ai-help-service p {
    margin: 6px 0;
    color: rgba(255, 255, 255, 0.66);
}

.ai-help-service button {
    width: 100%;
    margin-top: 14px;
}

.ai-help-service button:disabled,
.ai-help-submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.ai-help-fade-enter-active,
.ai-help-fade-leave-active,
.ai-help-mask-enter-active,
.ai-help-mask-leave-active,
.ai-help-panel-enter-active,
.ai-help-panel-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.ai-help-fade-enter-from,
.ai-help-fade-leave-to,
.ai-help-mask-enter-from,
.ai-help-mask-leave-to {
    opacity: 0;
}

.ai-help-panel-enter-from,
.ai-help-panel-leave-to {
    opacity: 0;
    transform: translateY(12px);
}
</style>
