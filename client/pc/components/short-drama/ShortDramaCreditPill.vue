<template>
    <Teleport to="body" :disabled="!fixed">
        <div :class="creditPillClasses" :style="creditPillStyle">
            <button class="short-drama-credit-pill__points" type="button" @click="openCreditsPurchaseModal">
                <img class="short-drama-credit-pill__icon" :src="creditPointIcon" alt="" />
                <span>{{ points }}</span>
            </button>
            <span class="short-drama-credit-pill__divider" aria-hidden="true"></span>
            <button class="short-drama-credit-pill__member" type="button" @click="openMembershipModal">
                {{ actionText }}
            </button>
        </div>
    </Teleport>

    <AiWorkspaceCreditPurchaseModal
        :model-value="showCreditsPurchaseModal"
        :remaining-credits="normalizedPoints"
        :membership-enabled="membershipEnabled"
        @update:model-value="showCreditsPurchaseModal = $event"
        @purchase="handleCreditsPurchase"
        @renew-membership="openMembershipModal"
        @view-agreement="openCreditAgreement('paid')"
    />
    <AiWorkspaceCreditAgreementModal v-model="showCreditAgreementModal" :policy-type="creditAgreementPolicyType" />
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
import { computed, ref, useAttrs, watch } from 'vue'
import creditPointIcon from '@/assets/images/icon/credit-point.svg'
import { PolicyAgreementEnum } from '@/enums/appEnums'
import { createMembershipOrder, getMembershipPlans } from '@/api/membership'
import type { MembershipPlanDefinition, MembershipPlanId } from '@/constants/membership-plans'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { usePcRequestCache } from '@/composables/usePcRequestCache'
import { useUserStore } from '@/stores/user'
import feedback from '@/utils/feedback'
import AiWorkspaceCreditAgreementModal from '~/components/ai-workspace/credit-agreement-modal.vue'
import AiWorkspaceCreditPurchaseModal from '~/components/ai-workspace/credit-purchase-modal.vue'
import AiWorkspaceMembershipModal from '~/components/ai-workspace/membership-modal.vue'
import AiWorkspaceMembershipPayModal from '~/components/ai-workspace/membership-pay-modal.vue'

defineOptions({
    inheritAttrs: false
})

const props = withDefaults(defineProps<{
    points: number | string
    actionText: string
    membershipEnabled?: boolean
    fixed?: boolean
}>(), {
    fixed: true,
    membershipEnabled: false
})

const emit = defineEmits<{
    (event: 'refresh'): void
}>()

const route = useRoute()
const attrs = useAttrs()
const userStore = useUserStore()
const { ensurePcLogin } = usePcLoginGate()
const membershipCacheKey = 'pc:ai-workspace:membership-plans'

const showCreditsPurchaseModal = ref(false)
const showCreditAgreementModal = ref(false)
const showMembershipModal = ref(false)
const showMembershipPayModal = ref(false)
const creditAgreementPolicyType = ref<PolicyAgreementEnum>(PolicyAgreementEnum.POINTS_RULE)
const selectedMembershipPlan = ref<MembershipPlanId>(props.membershipEnabled ? 'advanced' : 'free')
const membershipPlans = ref<MembershipPlanDefinition[]>([])
const membershipPayOrderId = ref(0)
const payModalFrom = ref<'membership' | 'recharge'>('membership')
const pendingMembershipPlan = ref<MembershipPlanId | null>(null)

const fixed = computed(() => props.fixed !== false)
const creditPillClasses = computed(() => [
    'short-drama-credit-pill',
    attrs.class,
    { 'is-fixed': fixed.value }
])
const creditPillStyle = computed(() => fixed.value ? ({
    position: 'fixed',
    top: '24px',
    right: '24px',
    left: 'auto',
    zIndex: 12
}) : undefined)
const membershipEnabled = computed(() => Boolean(props.membershipEnabled))
const normalizedPoints = computed(() => {
    const value = Number(props.points)
    return Number.isFinite(value) ? value : 0
})

const ensureLogin = (warning: string) => {
    if (ensurePcLogin({ redirect: route.fullPath })) return true
    feedback.msgWarning(warning)
    return false
}

const openCreditAgreement = (type: 'points' | 'paid') => {
    creditAgreementPolicyType.value = type === 'paid' ? PolicyAgreementEnum.PAID : PolicyAgreementEnum.POINTS_RULE
    showCreditAgreementModal.value = true
}

const openCreditsPurchaseModal = () => {
    if (!ensureLogin('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u5145\u503c\u70b9\u6570')) return
    showMembershipModal.value = false
    showCreditAgreementModal.value = false
    showCreditsPurchaseModal.value = true
}

const openMembershipModal = () => {
    if (!ensureLogin('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u5f00\u901a\u4f1a\u5458')) return
    loadMembershipPlans({ force: false })
    showCreditsPurchaseModal.value = false
    showCreditAgreementModal.value = false
    showMembershipModal.value = true
}

const handleCreditsPurchase = async (order?: { orderId?: number; from?: string }) => {
    if (order?.orderId) {
        membershipPayOrderId.value = Number(order.orderId)
        payModalFrom.value = order.from === 'membership' ? 'membership' : 'recharge'
        showMembershipPayModal.value = true
        return
    }
    await refreshUser()
}

const handleMembershipSubscribe = async (plan: MembershipPlanId, cycle: 'package') => {
    if (!ensureLogin('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u8ba2\u9605\u4f1a\u5458')) return
    try {
        const order = await createMembershipOrder({ plan_id: plan, cycle })
        membershipPayOrderId.value = Number(order?.order_id || 0)
        payModalFrom.value = 'membership'
        pendingMembershipPlan.value = plan
        showMembershipPayModal.value = true
    } catch (error: any) {
        feedback.msgError(error?.msg || error?.message || error || '\u4f1a\u5458\u8ba2\u5355\u521b\u5efa\u5931\u8d25')
    }
}

const handleMembershipPaySuccess = async () => {
    await refreshUser()
    if (payModalFrom.value === 'membership' && pendingMembershipPlan.value != null) {
        selectedMembershipPlan.value = pendingMembershipPlan.value
        pendingMembershipPlan.value = null
    }
}

const refreshUser = async () => {
    if (userStore.isLogin) {
        await userStore.getUser(true).catch(() => undefined)
    }
    emit('refresh')
}

const mapMembershipPlan = (row: any): MembershipPlanDefinition => ({
    id: row.id,
    name: row.name,
    title: row.name,
    description: row.description || '',
    monthlyPrice: String(row.monthly_price ?? '0.00'),
    yearlyPrice: String(row.yearly_price ?? '0.00'),
    durationMonths: Number(row.duration_months || 1),
    button: Number(row.monthly_price || 0) <= 0 && Number(row.yearly_price || 0) <= 0 ? '\u5f53\u524d\u5957\u9910' : `\u8ba2\u9605${row.name || '\u4f1a\u5458'}`,
    outline: !row.is_recommend,
    free: Number(row.monthly_price || 0) <= 0 && Number(row.yearly_price || 0) <= 0,
    isRecommended: Number(row.is_recommend || 0) === 1,
    monthlyMarketPrice: Number(row.monthly_market_price || 0) > 0 ? String(row.monthly_market_price) : '',
    yearlyMarketPrice: Number(row.yearly_market_price || 0) > 0 ? String(row.yearly_market_price) : '',
    monthlyBonus: Number(row.monthly_bonus_points || 0) > 0 ? String(Number(row.monthly_bonus_points)) : '',
    yearlyBonus: Number(row.yearly_bonus_points || 0) > 0 ? String(Number(row.yearly_bonus_points)) : '',
    monthlyBonusTip: '\u4f1a\u5458\u5957\u9910\u8d60\u9001\u79ef\u5206',
    yearlyBonusTip: '\u4f1a\u5458\u5957\u9910\u8d60\u9001\u79ef\u5206',
    features: Array.isArray(row.features) ? row.features : []
})

const loadMembershipPlans = async (options: { force?: boolean } = {}) => {
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

watch(membershipEnabled, (enabled) => {
    if (enabled && selectedMembershipPlan.value === 'free') {
        selectedMembershipPlan.value = 'advanced'
    }
    if (!enabled) {
        selectedMembershipPlan.value = 'free'
    }
}, { immediate: true })

</script>

<style scoped>
.short-drama-credit-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: auto;
    height: 32px;
    padding: 0 16px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 20px;
    background: rgba(42, 43, 44, 0.46);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-sizing: border-box;
    color: #fff;
    font-size: 16px;
    line-height: 16px;
    white-space: nowrap;
}

.short-drama-credit-pill.is-fixed {
    position: fixed;
    top: 24px;
    right: 24px;
    left: auto;
    z-index: 12;
}

.short-drama-credit-pill__points {
    display: inline-flex;
    align-items: center;
    gap: 7px;
}

.short-drama-credit-pill__divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.35);
    pointer-events: none;
}

.short-drama-credit-pill__icon {
    display: block;
    width: 16px;
    height: 16px;
    filter: brightness(0) invert(1);
    object-fit: contain;
}

.short-drama-credit-pill__points,
.short-drama-credit-pill__member {
    border: 0;
    padding: 0;
    background: transparent;
    font: inherit;
    font-size: 16px;
    line-height: 16px;
    cursor: pointer;
}

.short-drama-credit-pill__points {
    color: #fff;
}

.short-drama-credit-pill__member {
    color: #ffbe32;
}

@media (max-width: 920px) {
    .short-drama-credit-pill.is-fixed {
        top: 14px;
        right: 14px;
        transform: scale(0.9);
        transform-origin: top right;
    }
}

@media (max-width: 620px) {
    .short-drama-credit-pill.is-fixed {
        display: none;
    }
}
</style>
