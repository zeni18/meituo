<template>
    <div class="canvas-account-actions">
        <div class="canvas-account-actions__pill">
            <button class="canvas-account-actions__points" type="button" @click="openCreditsPurchaseModal">
                <img :src="creditPointIcon" alt="" />
                <span>{{ remainingCredits }}</span>
            </button>
            <button class="canvas-account-actions__member" type="button" @click="openMembershipModal">
                {{ membershipEnabled ? '会员中心' : '开会员' }}
            </button>
        </div>
        <button class="canvas-account-actions__avatar" type="button" title="个人中心" @click="openUserCenter">
            <img v-if="avatarSrc && !avatarBroken" :src="avatarSrc" alt="" @error="avatarBroken = true" />
            <span v-else>{{ avatarText }}</span>
        </button>
    </div>

    <AiWorkspaceCreditPurchaseModal
        :model-value="showCreditsPurchaseModal"
        :remaining-credits="remainingCredits"
        :membership-enabled="membershipEnabled"
        @update:model-value="showCreditsPurchaseModal = $event"
        @purchase="handleCreditsPurchase"
        @renew-membership="openMembershipModal"
        @view-agreement="openCreditAgreement('paid')"
    />
    <AiWorkspaceCreditAgreementModal
        v-model="showCreditAgreementModal"
        :policy-type="creditAgreementPolicyType"
    />
    <AiWorkspaceMembershipModal
        v-model="showMembershipModal"
        :membership-enabled="membershipEnabled"
        :current-plan="selectedMembershipPlan"
        :plans="membershipPlans"
        @recharge="openCreditsPurchaseModal"
        @subscribe="handleMembershipSubscribe"
    />
    <AiWorkspaceMembershipPayModal
        v-model="showMembershipPayModal"
        :order-id="membershipPayOrderId"
        :from="payModalFrom"
        @success="handleMembershipPaySuccess"
    />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createMembershipOrder, getMembershipPlans } from '@/api/membership'
import type { MembershipPlanDefinition, MembershipPlanId } from '@/constants/membership-plans'
import { PolicyAgreementEnum } from '@/enums/appEnums'
import { usePcCredits } from '@/composables/usePcCredits'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { usePcRequestCache } from '@/composables/usePcRequestCache'
import { useUserStore } from '@/stores/user'
import { normalizeFileUrl } from '@/utils/file-url'
import AiWorkspaceCreditAgreementModal from '~/components/ai-workspace/credit-agreement-modal.vue'
import AiWorkspaceCreditPurchaseModal from '~/components/ai-workspace/credit-purchase-modal.vue'
import AiWorkspaceMembershipModal from '~/components/ai-workspace/membership-modal.vue'
import AiWorkspaceMembershipPayModal from '~/components/ai-workspace/membership-pay-modal.vue'
import creditPointIcon from '@/assets/images/icon/credit-point.svg'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()
const { remainingCredits, membershipEnabled, refreshCredits } = usePcCredits()

const showCreditsPurchaseModal = ref(false)
const showCreditAgreementModal = ref(false)
const showMembershipModal = ref(false)
const showMembershipPayModal = ref(false)
const avatarBroken = ref(false)
const creditAgreementPolicyType = ref<PolicyAgreementEnum>(PolicyAgreementEnum.POINTS_RULE)
const selectedMembershipPlan = ref<MembershipPlanId>(membershipEnabled.value ? 'advanced' : 'free')
const membershipPlans = ref<MembershipPlanDefinition[]>([])
const membershipPayOrderId = ref(0)
const payModalFrom = ref<'membership' | 'recharge'>('membership')
const pendingMembershipPlan = ref<MembershipPlanId | null>(null)
const membershipCacheKey = 'pc:ai-workspace:membership-plans'

const avatarSrc = computed(() =>
    normalizeFileUrl(String((userStore.userInfo as any)?.avatar || ''), (userStore as any).avatarVersion)
)
const avatarText = computed(() =>
    String(
        (userStore.userInfo as any)?.nickname ||
            (userStore.userInfo as any)?.account ||
            (userStore.userInfo as any)?.sn ||
            'U'
    )
        .slice(0, 1)
        .toUpperCase()
)

function ensureTopbarLogin(warning: string) {
    if (ensurePcLogin({ redirect: route.fullPath })) return true
    ElMessage.warning(warning)
    return false
}

function openUserCenter() {
    if (!ensureTopbarLogin('请先登录后再进入个人中心')) return
    router.push('/user/info').catch(() => {})
}

function openCreditAgreement(type: 'points' | 'paid') {
    creditAgreementPolicyType.value =
        type === 'paid' ? PolicyAgreementEnum.PAID : PolicyAgreementEnum.POINTS_RULE
    showCreditAgreementModal.value = true
}

function openCreditsPurchaseModal() {
    if (!ensureTopbarLogin('请先登录后再充值积分')) return
    showMembershipModal.value = false
    showCreditAgreementModal.value = false
    showCreditsPurchaseModal.value = true
}

function openMembershipModal() {
    if (!ensureTopbarLogin('请先登录后再开通会员')) return
    loadMembershipPlans({ force: false })
    showCreditsPurchaseModal.value = false
    showCreditAgreementModal.value = false
    showMembershipModal.value = true
}

async function handleCreditsPurchase(order?: { orderId?: number; from?: string }) {
    if (order?.orderId) {
        membershipPayOrderId.value = Number(order.orderId)
        payModalFrom.value = order.from === 'membership' ? 'membership' : 'recharge'
        showMembershipPayModal.value = true
        return
    }
    await refreshCredits(true)
}

async function handleMembershipSubscribe(plan: MembershipPlanId, cycle: 'package') {
    if (!ensureTopbarLogin('请先登录后再订阅会员')) return
    try {
        const order = await createMembershipOrder({ plan_id: plan, cycle })
        membershipPayOrderId.value = Number(order?.order_id || 0)
        payModalFrom.value = 'membership'
        pendingMembershipPlan.value = plan
        showMembershipPayModal.value = true
    } catch (error: any) {
        ElMessage.error(error?.msg || error?.message || error || '会员订单创建失败')
    }
}

async function handleMembershipPaySuccess() {
    await refreshCredits(true)
    if (payModalFrom.value === 'membership' && pendingMembershipPlan.value != null) {
        selectedMembershipPlan.value = pendingMembershipPlan.value
        pendingMembershipPlan.value = null
    }
}

function mapMembershipPlan(row: any): MembershipPlanDefinition {
    const isFree = Number(row.monthly_price || 0) <= 0 && Number(row.yearly_price || 0) <= 0
    return {
        id: row.id,
        name: row.name,
        title: row.name,
        description: row.description || '',
        monthlyPrice: String(row.monthly_price ?? '0.00'),
        yearlyPrice: String(row.yearly_price ?? '0.00'),
        durationMonths: Number(row.duration_months || 1),
        button: isFree ? '当前套餐' : `订阅${row.name || '会员'}`,
        outline: !row.is_recommend,
        free: isFree,
        isRecommended: Number(row.is_recommend || 0) === 1,
        monthlyMarketPrice:
            Number(row.monthly_market_price || 0) > 0 ? String(row.monthly_market_price) : '',
        yearlyMarketPrice:
            Number(row.yearly_market_price || 0) > 0 ? String(row.yearly_market_price) : '',
        monthlyBonus:
            Number(row.monthly_bonus_points || 0) > 0
                ? String(Number(row.monthly_bonus_points))
                : '',
        yearlyBonus:
            Number(row.yearly_bonus_points || 0) > 0 ? String(Number(row.yearly_bonus_points)) : '',
        monthlyBonusTip: '会员套餐赠送积分',
        yearlyBonusTip: '会员套餐赠送积分',
        features: Array.isArray(row.features) ? row.features : []
    }
}

async function loadMembershipPlans(options: { force?: boolean } = {}) {
    try {
        const rows = await usePcRequestCache(membershipCacheKey, () => getMembershipPlans(), {
            ttl: 10 * 60 * 1000,
            force: options.force,
            staleWhileRevalidate: true
        })
        membershipPlans.value = Array.isArray(rows) ? rows.map(mapMembershipPlan) : []
    } catch (error) {
        console.error('load membership plans failed', error)
    }
}

watch(
    membershipEnabled,
    (enabled) => {
        if (enabled && selectedMembershipPlan.value === 'free') selectedMembershipPlan.value = 'advanced'
        if (!enabled) selectedMembershipPlan.value = 'free'
    },
    { immediate: true }
)

watch(avatarSrc, () => {
    avatarBroken.value = false
})
</script>

<style scoped lang="scss">
.canvas-account-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
}

.canvas-account-actions__pill,
.canvas-account-actions__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(36, 36, 36, 0.42);
    color: #fff;
    -webkit-backdrop-filter: blur(20px) saturate(1.25);
    backdrop-filter: blur(20px) saturate(1.25);
}

.canvas-account-actions__pill {
    height: 34px;
    gap: 0;
    padding: 0 12px;
    border-radius: 10px;
}

.canvas-account-actions__pill button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
}

.canvas-account-actions__points {
    gap: 8px;
    padding: 0 8px 0 0;
}

.canvas-account-actions__points img {
    display: block;
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(1);
    object-fit: contain;
}

.canvas-account-actions__member {
    padding: 0 0 0 8px;
}

.canvas-account-actions__avatar {
    width: 34px;
    height: 34px;
    padding: 0;
    overflow: hidden;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
}

.canvas-account-actions__avatar img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>
