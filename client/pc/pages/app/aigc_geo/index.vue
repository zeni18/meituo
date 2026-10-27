<template>
    <div class="geo-landing">
        <header :class="['landing-header', { 'is-scrolled': landingScrolled }]">
            <button class="brand" type="button" @click="scrollTo('hero')">
                <span class="brand__mark">G</span>
                <span class="brand__text">GEO营销优化系统</span>
            </button>
            <nav class="header-nav">
                <button v-for="item in navItems" :key="item.id" type="button" @click="scrollTo(item.id)">
                    {{ item.label }}
                </button>
            </nav>
            <div class="header-actions">
                <button class="btn btn-ghost" type="button" @click="router.push(getGeoRoute('diagnosis'))">免费诊断</button>
                <button class="btn btn-primary" type="button" @click="router.push('/app/aigc_geo/console')">进入应用</button>
            </div>
        </header>

        <main class="landing-main" @scroll.passive="handleLandingScroll">
            <section id="hero" class="hero-section">
                <div class="hero-bg">
                    <span class="mesh mesh-a"></span>
                    <span class="mesh mesh-b"></span>
                    <span class="mesh mesh-c"></span>
                </div>
                <div class="hero-inner">
                    <div class="hero-copy">
                        <p class="eyebrow">AI Search Marketing</p>
                        <h1>AI给你的答案，从何而来？</h1>
                        <p class="hero-desc">
                            追踪品牌在 DeepSeek、豆包、Kimi、通义千问等 AI 答案中的推荐排名、引用来源与竞品占位，形成内容生产、品牌管理、发布投稿的一体化工作台。
                        </p>
                    </div>

                    <div class="search-console">
                        <div class="platform-tabs">
                            <button
                                v-for="item in aiPlatformTabs"
                                :key="item"
                                :class="{ active: activePlatform === item }"
                                type="button"
                                @click="activePlatform = item"
                            >
                                {{ item }}
                            </button>
                        </div>
                        <div class="search-title">输入你想验证的问题，看看AI引用了谁</div>
                        <div class="search-row">
                            <label class="search-field">
                                <span></span>
                                <input
                                    v-model="searchText"
                                    placeholder="向AI咨询的问题，如：白酒品牌推荐？"
                                    type="text"
                                    @keyup.enter="runSearch"
                                />
                            </label>
                            <button class="search-submit" type="button" @click="runSearch">实时搜索</button>
                        </div>
                        <div class="quick-tags">
                            <span class="quick-tags__label">猜你想搜</span>
                            <button v-for="item in quickQuestions" :key="item" type="button" @click="useQuestion(item)">
                                {{ item }}
                            </button>
                        </div>
                    </div>

                    <div class="hero-stats">
                        <article v-for="item in animatedStats" :key="item.key">
                            <strong>{{ formatNumber(item.current) }}</strong>
                            <span>{{ item.label }}</span>
                        </article>
                    </div>
                </div>
            </section>

            <section id="ranking" class="rank-section page-section">
                <div class="section-head centered">
                    <p>Brand Ranking</p>
                    <h2>GEO行业品牌排行榜</h2>
                    <span>基于 AI 答案提及率、排名、引用来源质量和内容覆盖度综合评估。</span>
                </div>
                <div class="rank-layout">
                    <div class="rank-card">
                        <div class="card-header">
                            <div>
                                <strong>行业品牌可见度</strong>
                                <span>{{ activePlatform }} · 近30天样本</span>
                            </div>
                            <em>实时更新</em>
                        </div>
                        <table class="rank-table">
                            <thead>
                                <tr>
                                    <th>排名</th>
                                    <th>品牌</th>
                                    <th>AI提及率</th>
                                    <th>提及次数</th>
                                    <th>趋势</th>
                                    <th>得分</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in rankingRows" :key="row.brand">
                                    <td><span class="rank-no">{{ row.rank }}</span></td>
                                    <td>{{ row.brand }}</td>
                                    <td>{{ row.mention }}</td>
                                    <td>{{ row.count }}</td>
                                    <td><span class="trend-up">{{ row.trend }}</span></td>
                                    <td>
                                        <div class="score-line">
                                            <span :style="{ width: `${row.score}%` }"></span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="rank-side">
                        <article v-for="item in reportPoints" :key="item.title">
                            <i>{{ item.icon }}</i>
                            <strong>{{ item.title }}</strong>
                            <p>{{ item.desc }}</p>
                        </article>
                    </div>
                </div>
            </section>

            <section id="sources" class="source-section page-section">
                <div class="section-head">
                    <p>Reference Source</p>
                    <h2>GEO引用来源倾向</h2>
                    <span>不同 AI 平台的引用来源并不一致，内容发布和媒体投稿需要按平台拆解。</span>
                </div>
                <div class="source-shell">
                    <div class="source-tabs">
                        <button
                            v-for="item in sourcePlatformTabs"
                            :key="item"
                            :class="{ active: activeSourceKey === item }"
                            type="button"
                            @click="activeSourceKey = item"
                        >
                            {{ item }}
                        </button>
                    </div>
                    <div class="source-content">
                        <div class="donut-panel">
                            <div class="source-donut" :style="sourceChartStyle">
                                <div>
                                    <strong>{{ currentSourceRows[0]?.value }}%</strong>
                                    <span>{{ currentSourceRows[0]?.name }}</span>
                                </div>
                            </div>
                            <p>{{ activeSourceKey }} 更偏好引用{{ currentSourceRows[0]?.name }}、{{ currentSourceRows[1]?.name }}等来源，建议优先布局高权重内容阵地。</p>
                        </div>
                        <div class="source-list">
                            <article v-for="item in currentSourceRows" :key="item.name">
                                <i :style="{ background: item.color }"></i>
                                <strong>{{ item.name }}</strong>
                                <div><span :style="{ width: `${item.value}%`, background: item.color }"></span></div>
                                <em>{{ item.value }}%</em>
                            </article>
                        </div>
                    </div>
                </div>
            </section>

            <section id="workflow" class="workflow-section page-section">
                <div class="section-head centered">
                    <p>Workflow</p>
                    <h2>自动化GEO优化流程</h2>
                    <span>从诊断、情报、意图到内容生产和发布监控，形成可执行的增长闭环。</span>
                </div>
                <div class="workflow-grid">
                    <article v-for="item in workflowSteps" :key="item.title" class="workflow-card" @click="router.push(item.path)">
                        <div class="workflow-card__top">
                            <span>{{ item.index }}</span>
                            <i>{{ item.icon }}</i>
                        </div>
                        <strong>{{ item.title }}</strong>
                        <p>{{ item.desc }}</p>
                        <button type="button">{{ item.action }}<span></span></button>
                    </article>
                </div>
            </section>

            <section id="compare" class="compare-section page-section">
                <div class="compare-card">
                    <div class="compare-copy">
                        <p>Why GEO</p>
                        <h2>不是多发文章，而是让AI愿意引用你</h2>
                        <span>系统把品牌资料、产品服务、客户案例、媒体背书和官网内容组织成 AI 友好的引用依据，避免内容生产和投放互相割裂。</span>
                        <button class="btn btn-primary" type="button" @click="router.push('/app/aigc_geo/console')">进入控制台</button>
                    </div>
                    <div class="compare-table">
                        <article v-for="item in compareRows" :key="item.label">
                            <span>{{ item.label }}</span>
                            <strong>{{ item.before }}</strong>
                            <em>{{ item.after }}</em>
                        </article>
                    </div>
                </div>
            </section>

            <section id="features" class="feature-section page-section">
                <div class="section-head centered">
                    <p>Capability</p>
                    <h2>内容生产、品牌管理、素材库与付费投稿</h2>
                </div>
                <div class="feature-grid">
                    <article v-for="item in capabilityCards" :key="item.title">
                        <i>{{ item.icon }}</i>
                        <strong>{{ item.title }}</strong>
                        <p>{{ item.desc }}</p>
                    </article>
                </div>
            </section>

            <footer class="landing-footer">
                <div class="footer-inner">
                    <div class="footer-brand">
                        <button class="brand dark" type="button" @click="scrollTo('hero')">
                            <span class="brand__mark">G</span>
                            <span class="brand__text">GEO营销优化系统</span>
                        </button>
                        <p>面向 AI 搜索时代的品牌可见度、内容生产和媒体分发工作台。</p>
                    </div>
                    <div v-for="group in footerGroups" :key="group.title" class="footer-group">
                        <strong>{{ group.title }}</strong>
                        <button v-for="item in group.items" :key="item.label" type="button" @click="router.push(item.path)">
                            {{ item.label }}
                        </button>
                    </div>
                    <div class="footer-qr">
                        <strong>服务支持</strong>
                        <div>
                            <span>GEO</span>
                            <span>咨询</span>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <span>© 2026 GEO营销优化系统</span>
                    <span>AI搜索营销 · 品牌可见度优化 · 内容分发</span>
                </div>
            </footer>
        </main>
    </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getGeoRoute } from '@/apps/aigc_geo/mock'
import feedback from '@/utils/feedback'

definePageMeta({ layout: false })

const router = useRouter()
const searchText = ref('')
const landingScrolled = ref(false)
const activePlatform = ref('豆包')
const activeSourceKey = ref('豆包')

const navItems = [
    { label: '首页', id: 'hero' },
    { label: '实时搜索', id: 'hero' },
    { label: '品牌诊断/报告', id: 'ranking' },
    { label: '品牌监测/文章创作', id: 'workflow' },
    { label: '工具箱', id: 'features' },
    { label: 'GEO游学', id: 'compare' },
    { label: 'API服务', id: 'sources' }
]

const aiPlatformTabs = ['豆包', 'DeepSeek', '元宝', '千问']
const quickQuestions = ['本地生活品牌怎么做GEO？', '白酒品牌推荐？', 'AI搜索优化和SEO区别？']

const heroStats = [
    { key: 'dialogs', label: '监测AI对话', value: 10760052 },
    { key: 'brands', label: '追踪AI提及品牌', value: 32998330 },
    { key: 'articles', label: '收录引用文章', value: 27210218 }
]

const animatedStats = ref(heroStats.map((item) => ({ ...item, current: 0 })))
let animationFrame = 0

const rankingRows = [
    { rank: 1, brand: '演示品牌', mention: '66%', count: '3,422', score: 67, trend: '+12.4%' },
    { rank: 2, brand: 'GEO增长', mention: '52%', count: '1,659', score: 55, trend: '+8.1%' },
    { rank: 3, brand: '云启增长', mention: '37%', count: '967', score: 44, trend: '+5.7%' },
    { rank: 4, brand: '启明内容', mention: '37%', count: '971', score: 44, trend: '+4.8%' },
    { rank: 5, brand: '小鹿智行', mention: '31%', count: '1,031', score: 39, trend: '+3.2%' }
]

const reportPoints = [
    { title: '答案排名', desc: '识别品牌在AI推荐结果中的出现位置和波动。', icon: '01' },
    { title: '竞品占位', desc: '拆解竞品被推荐的内容依据和引用来源。', icon: '02' },
    { title: '优化建议', desc: '输出官网、媒体、问答、案例的内容补齐方向。', icon: '03' }
]

const sourcePlatformTabs = ['豆包', 'DeepSeek', '元宝', '千问']
const sourcePalette = ['#6b28ff', '#8067ff', '#23b26d', '#f59e0b', '#0ea5e9', '#ef5da8']
const sourceMediaSets: Record<string, Array<{ name: string; value: number }>> = {
    豆包: [
        { name: '抖音', value: 72 },
        { name: '今日头条', value: 64 },
        { name: '搜狐', value: 58 },
        { name: '百家号', value: 51 },
        { name: '知乎', value: 43 },
        { name: '微信公众号', value: 39 }
    ],
    DeepSeek: [
        { name: '知乎', value: 76 },
        { name: '百度百科', value: 61 },
        { name: '官网文章', value: 56 },
        { name: '搜狐', value: 49 },
        { name: '百家号', value: 42 },
        { name: '行业媒体', value: 37 }
    ],
    元宝: [
        { name: '微信公众号', value: 69 },
        { name: '腾讯新闻', value: 62 },
        { name: '知乎', value: 54 },
        { name: '官网文章', value: 48 },
        { name: '搜狐', value: 40 },
        { name: '视频号', value: 34 }
    ],
    千问: [
        { name: '官网文章', value: 74 },
        { name: '百家号', value: 63 },
        { name: '知乎', value: 55 },
        { name: '行业媒体', value: 52 },
        { name: '搜狐', value: 45 },
        { name: '小红书', value: 31 }
    ]
}

const currentSourceRows = computed(() =>
    (sourceMediaSets[activeSourceKey.value] || sourceMediaSets.豆包).map((item, index) => ({
        ...item,
        color: sourcePalette[index]
    }))
)

const sourceChartStyle = computed<CSSProperties>(() => {
    const rows = currentSourceRows.value
    const total = rows.reduce((sum, item) => sum + item.value, 0)
    let start = 0
    const parts = rows.map((item) => {
        const end = start + (item.value / total) * 360
        const part = `${item.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`
        start = end
        return part
    })
    return { background: `conic-gradient(${parts.join(', ')})` }
})

const workflowSteps = [
    { index: '01', title: '自我诊断', desc: '分析品牌在AI答案里的提及现状、推荐排名和缺失问题。', action: '开始诊断', path: getGeoRoute('diagnosis'), icon: 'D' },
    { index: '02', title: '情报分析', desc: '拆解竞品占位、引用源、内容结构和平台偏好。', action: '查看分析', path: getGeoRoute('analysis'), icon: 'A' },
    { index: '03', title: '用户意图分析', desc: '从问题词、场景词和转化目标中找到内容机会。', action: '管理关键词', path: getGeoRoute('keywords'), icon: 'I' },
    { index: '04', title: '内容创作', desc: '生产官网文章、问答稿、新闻稿和媒体投稿内容。', action: '新建创作', path: getGeoRoute('creation'), icon: 'C' },
    { index: '05', title: '发布与监控', desc: '管理发布计划、投稿记录、收录检测和效果复盘。', action: '发布计划', path: getGeoRoute('plans'), icon: 'P' }
]

const compareRows = [
    { label: '传统SEO', before: '围绕搜索引擎排名', after: 'GEO关注AI答案推荐' },
    { label: '内容生产', before: '单篇文章产出', after: '围绕意图组织内容集群' },
    { label: '品牌管理', before: '资料分散维护', after: '品牌、产品、案例统一引用' },
    { label: '媒体投放', before: '只看发布完成', after: '同步看AI引用和收录贡献' }
]

const capabilityCards = [
    { title: '内容发布', desc: '官网文章、官方媒体、自媒体和海外媒体统一排期。', icon: '发' },
    { title: '付费投稿', desc: '按行业、价格、收录友好度筛选可投稿媒体资源。', icon: '投' },
    { title: '内容生产', desc: '围绕关键词、转化目标和知识库生成AI友好内容。', icon: '写' },
    { title: '品牌管理', desc: '集中维护品牌资料、产品服务、竞品和品牌词库。', icon: '品' }
]

const footerGroups = [
    {
        title: '产品',
        items: [
            { label: 'AI诊断', path: getGeoRoute('diagnosis') },
            { label: '营销报表', path: getGeoRoute('reports') },
            { label: 'AI创作', path: getGeoRoute('creation') }
        ]
    },
    {
        title: '分发',
        items: [
            { label: '官方媒体', path: getGeoRoute('official_media') },
            { label: '自媒体', path: getGeoRoute('self_media') },
            { label: '海外媒体', path: getGeoRoute('overseas_media') }
        ]
    },
    {
        title: '资源',
        items: [
            { label: '品牌图库', path: getGeoRoute('gallery') },
            { label: '知识库', path: getGeoRoute('knowledge') },
            { label: '收录记录', path: getGeoRoute('index_records') }
        ]
    }
]

function runSearch() {
    if (!searchText.value.trim()) {
        feedback.msgError('请输入你想验证的问题')
        return
    }
    router.push(getGeoRoute('diagnosis'))
}

function useQuestion(question: string) {
    searchText.value = question
}

function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleLandingScroll(event: Event) {
    landingScrolled.value = (event.currentTarget as HTMLElement).scrollTop > 24
}

function formatNumber(value: number) {
    return Math.round(value).toLocaleString('en-US')
}

function animateStats() {
    const startTime = performance.now()
    const duration = 1400
    const run = (time: number) => {
        const progress = Math.min((time - startTime) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        animatedStats.value = heroStats.map((item) => ({
            ...item,
            current: item.value * ease
        }))
        if (progress < 1) {
            animationFrame = requestAnimationFrame(run)
        }
    }
    animationFrame = requestAnimationFrame(run)
}

onMounted(() => {
    animateStats()
})

onBeforeUnmount(() => {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame)
    }
})
</script>

<style scoped lang="scss">
.geo-landing {
    height: 100vh;
    overflow: hidden;
    color: #111827;
    background: #f7f8fb;
    font-family: -apple-system, BlinkMacSystemFont, 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

button,
input {
    font: inherit;
}

button {
    cursor: pointer;
}

.landing-main {
    height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    scroll-behavior: smooth;
}

.landing-header {
    position: fixed;
    z-index: 20;
    top: 0;
    right: 0;
    left: 0;
    display: grid;
    height: 72px;
    grid-template-columns: minmax(230px, 1fr) auto minmax(230px, 1fr);
    align-items: center;
    padding: 0 42px;
    background: transparent;
    transition: background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;

    &.is-scrolled {
        border-bottom: 1px solid #edf0f6;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 10px 28px rgba(17, 24, 39, 0.06);
        backdrop-filter: blur(12px);
    }
}

.brand {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 10px;
    border: 0;
    color: #111827;
    background: transparent;

    &.dark {
        color: #fff;
    }
}

.brand__mark {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 9px;
    color: #fff;
    background: #6b28ff;
    font-size: 17px;
    font-weight: 900;
}

.brand__text {
    font-size: 16px;
    font-weight: 900;
}

.header-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 30px;

    button {
        padding: 0;
        border: 0;
        color: #273142;
        background: transparent;
        font-size: 14px;
        font-weight: 700;
        line-height: 72px;
        transition: color 0.18s ease;

        &:hover {
            color: #6b28ff;
        }
    }
}

.header-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn {
    display: inline-flex;
    height: 36px;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 800;
    transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;

    &:hover {
        transform: translateY(-1px);
    }
}

.btn-primary {
    border: 1px solid #6b28ff;
    color: #fff;
    background: #6b28ff;
    box-shadow: 0 10px 24px rgba(107, 40, 255, 0.2);
}

.btn-ghost {
    border: 1px solid rgba(107, 40, 255, 0.22);
    color: #6b28ff;
    background: rgba(255, 255, 255, 0.62);
}

.hero-section {
    position: relative;
    min-height: 720px;
    padding: 104px 24px 52px;
    overflow: hidden;
    background: linear-gradient(100deg, #dfe8ff 0%, #eef2ff 42%, #f8f5ff 73%, #fff7f1 100%);
}

.hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;

    &::after {
        position: absolute;
        right: 8%;
        bottom: 34px;
        left: 8%;
        height: 1px;
        content: '';
        background: linear-gradient(90deg, transparent, rgba(107, 40, 255, 0.16), transparent);
    }
}

.mesh {
    position: absolute;
    display: block;
    border-radius: 999px;
    filter: blur(16px);
    opacity: 0.42;
}

.mesh-a {
    top: 130px;
    left: 10%;
    width: 250px;
    height: 250px;
    background: #b7c5ff;
}

.mesh-b {
    right: 18%;
    bottom: 160px;
    width: 220px;
    height: 220px;
    background: #e0d0ff;
}

.mesh-c {
    top: 210px;
    right: 8%;
    width: 180px;
    height: 180px;
    background: #ffd8c8;
}

.hero-inner {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: center;
    max-width: 1120px;
    margin: 0 auto;
    text-align: center;
}

.eyebrow,
.section-head p,
.compare-copy p {
    margin: 0;
    color: #6b28ff;
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
}

.hero-copy h1 {
    margin: 12px 0 0;
    color: #0f172a;
    font-size: 56px;
    font-weight: 900;
    line-height: 1.14;
}

.hero-desc {
    max-width: 820px;
    margin: 18px auto 0;
    color: #475467;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.85;
}

.search-console {
    width: min(850px, 92vw);
    margin-top: 28px;
    padding: 20px;
    border: 1px solid rgba(107, 40, 255, 0.14);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 24px 70px rgba(89, 86, 139, 0.15);
    backdrop-filter: blur(12px);
}

.platform-tabs,
.source-tabs {
    display: flex;
    justify-content: center;
    gap: 8px;

    button {
        height: 32px;
        padding: 0 16px;
        border: 1px solid #e7e9f2;
        border-radius: 8px;
        color: #667085;
        background: #fff;
        font-size: 13px;
        font-weight: 800;
        transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;

        &.active,
        &:hover {
            border-color: rgba(107, 40, 255, 0.28);
            color: #6b28ff;
            background: #f4f0ff;
        }
    }
}

.search-title {
    margin-top: 16px;
    color: #111827;
    font-size: 18px;
    font-weight: 900;
}

.search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 124px;
    gap: 10px;
    margin-top: 14px;
}

.search-field {
    display: flex;
    height: 52px;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    border: 1px solid #e5e7ef;
    border-radius: 9px;
    background: #fff;

    span {
        position: relative;
        width: 14px;
        height: 14px;
        flex: 0 0 auto;
        border: 2px solid #a5adbd;
        border-radius: 999px;

        &::after {
            position: absolute;
            right: -5px;
            bottom: -4px;
            width: 7px;
            height: 2px;
            content: '';
            border-radius: 999px;
            background: #a5adbd;
            transform: rotate(45deg);
        }
    }

    input {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: none;
        color: #111827;
        background: transparent;
        font-size: 15px;
        font-weight: 600;

        &::placeholder {
            color: #98a2b3;
        }
    }
}

.search-submit {
    height: 52px;
    border: 1px solid #6b28ff;
    border-radius: 9px;
    color: #fff;
    background: #6b28ff;
    font-size: 15px;
    font-weight: 900;
}

.quick-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-top: 16px;

    .quick-tags__label {
        color: #98a2b3;
        font-size: 12px;
        font-weight: 800;
    }

    button {
        height: 28px;
        padding: 0 10px;
        border: 1px solid transparent;
        border-radius: 999px;
        color: #667085;
        background: rgba(246, 247, 252, 0.78);
        font-size: 12px;
        font-weight: 800;
        transition: color 0.16s ease, background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;

        &:hover {
            border-color: rgba(107, 40, 255, 0.16);
            color: #6b28ff;
            background: #f4f0ff;
            transform: translateY(-1px);
        }
    }
}

.hero-stats {
    display: grid;
    width: min(850px, 92vw);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-top: 20px;

    article {
        padding: 20px 22px;
        border: 1px solid rgba(107, 40, 255, 0.12);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.68);
        text-align: left;
    }

    strong,
    span {
        display: block;
    }

    strong {
        color: #111827;
        font-size: 24px;
        font-weight: 900;
        line-height: 1.2;
    }

    span {
        margin-top: 7px;
        color: #667085;
        font-size: 13px;
        font-weight: 800;
    }
}

.page-section {
    width: min(1180px, calc(100vw - 56px));
    margin: 0 auto;
    padding: 74px 0;
}

.section-head {
    max-width: 680px;
    margin-bottom: 26px;

    &.centered {
        margin-right: auto;
        margin-left: auto;
        text-align: center;
    }

    h2 {
        margin: 9px 0 0;
        color: #101828;
        font-size: 34px;
        font-weight: 900;
        line-height: 1.25;
    }

    span {
        display: block;
        margin-top: 12px;
        color: #667085;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.75;
    }
}

.rank-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 18px;
}

.rank-card,
.source-shell,
.compare-card {
    border: 1px solid #e5e7ef;
    border-radius: 10px;
    background: #fff;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid #eef0f6;

    strong,
    span {
        display: block;
    }

    strong {
        font-size: 16px;
        font-weight: 900;
    }

    span {
        margin-top: 5px;
        color: #98a2b3;
        font-size: 12px;
        font-weight: 700;
    }

    em {
        padding: 5px 10px;
        border: 1px solid #ded7ff;
        border-radius: 999px;
        color: #6b28ff;
        font-size: 12px;
        font-style: normal;
        font-weight: 800;
    }
}

.rank-table {
    width: 100%;
    border-spacing: 0;
    border-collapse: collapse;

    th {
        height: 48px;
        padding: 0 16px;
        color: #667085;
        background: #fafbfe;
        font-size: 13px;
        font-weight: 800;
        text-align: left;
    }

    td {
        height: 58px;
        padding: 0 16px;
        border-top: 1px solid #eef0f6;
        color: #344054;
        font-size: 14px;
        font-weight: 700;
    }

    tr:hover td {
        background: #fbfaff;
    }
}

.rank-no {
    display: inline-grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border-radius: 8px;
    color: #6b28ff;
    background: #f4f0ff;
    font-weight: 900;
}

.trend-up {
    color: #12a150;
    font-weight: 900;
}

.score-line {
    width: 112px;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: #eef1f7;

    span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #6b28ff, #9a7cff);
    }
}

.rank-side {
    display: grid;
    gap: 12px;

    article {
        padding: 18px;
        border: 1px solid #e5e7ef;
        border-radius: 10px;
        background: #fff;
        transition: transform 0.18s ease, border-color 0.18s ease;

        &:hover {
            border-color: rgba(107, 40, 255, 0.26);
            transform: translateY(-3px);
        }
    }

    i,
    strong {
        display: block;
    }

    i {
        display: grid;
        width: 36px;
        height: 36px;
        place-items: center;
        border-radius: 9px;
        color: #6b28ff;
        background: #f4f0ff;
        font-size: 13px;
        font-style: normal;
        font-weight: 900;
    }

    strong {
        margin-top: 14px;
        font-size: 15px;
        font-weight: 900;
    }

    p {
        margin: 8px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.7;
    }
}

.source-section {
    width: 100%;
    max-width: none;
    padding-right: max(28px, calc((100vw - 1180px) / 2));
    padding-left: max(28px, calc((100vw - 1180px) / 2));
    background: #fff;
}

.source-shell {
    padding: 22px;
}

.source-tabs {
    justify-content: flex-start;
    padding-bottom: 18px;
    border-bottom: 1px solid #eef0f6;
}

.source-content {
    display: grid;
    grid-template-columns: 380px minmax(0, 1fr);
    gap: 34px;
    align-items: center;
    padding-top: 28px;
}

.donut-panel {
    display: grid;
    justify-items: center;
    text-align: center;

    p {
        max-width: 320px;
        margin: 18px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.8;
    }
}

.source-donut {
    position: relative;
    display: grid;
    width: 236px;
    height: 236px;
    place-items: center;
    border-radius: 999px;
    transition: background 0.3s ease;

    &::before {
        position: absolute;
        inset: 26px;
        content: '';
        border-radius: inherit;
        background: #fff;
        box-shadow: inset 0 0 0 1px #eef0f6;
    }

    > div {
        position: relative;
        z-index: 1;
    }

    strong,
    span {
        display: block;
    }

    strong {
        font-size: 34px;
        font-weight: 900;
    }

    span {
        margin-top: 4px;
        color: #667085;
        font-size: 13px;
        font-weight: 800;
    }
}

.source-list {
    display: grid;
    gap: 14px;

    article {
        display: grid;
        grid-template-columns: 12px 110px minmax(0, 1fr) 48px;
        align-items: center;
        gap: 12px;
    }

    i {
        width: 10px;
        height: 10px;
        border-radius: 999px;
    }

    strong {
        color: #344054;
        font-size: 14px;
        font-weight: 800;
    }

    div {
        height: 9px;
        overflow: hidden;
        border-radius: 999px;
        background: #f0f2f8;
    }

    div span {
        display: block;
        height: 100%;
        border-radius: inherit;
        transition: width 0.28s ease;
    }

    em {
        color: #667085;
        font-size: 13px;
        font-style: normal;
        font-weight: 800;
        text-align: right;
    }
}

.workflow-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
}

.workflow-card {
    min-height: 230px;
    padding: 20px;
    border: 1px solid #e5e7ef;
    border-radius: 10px;
    background: #fff;
    transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

    &:hover {
        border-color: rgba(107, 40, 255, 0.28);
        box-shadow: 0 20px 45px rgba(39, 49, 66, 0.1);
        transform: scale(1.035);

        button {
            color: #6b28ff;
        }
    }

    strong {
        display: block;
        margin-top: 22px;
        color: #111827;
        font-size: 17px;
        font-weight: 900;
    }

    p {
        min-height: 70px;
        margin: 10px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.72;
    }

    button {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin-top: 16px;
        padding: 0;
        border: 0;
        color: #98a2b3;
        background: transparent;
        font-size: 13px;
        font-weight: 900;

        span {
            width: 18px;
            height: 1px;
            background: currentColor;

            &::after {
                display: block;
                width: 6px;
                height: 6px;
                margin-top: -3px;
                margin-left: 11px;
                content: '';
                border-top: 1px solid currentColor;
                border-right: 1px solid currentColor;
                transform: rotate(45deg);
            }
        }
    }
}

.workflow-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;

    span {
        color: #6b28ff;
        font-size: 28px;
        font-weight: 900;
        line-height: 1;
    }

    i {
        display: grid;
        width: 36px;
        height: 36px;
        place-items: center;
        border-radius: 9px;
        color: #6b28ff;
        background: #f4f0ff;
        font-size: 16px;
        font-style: normal;
        font-weight: 900;
    }
}

.compare-section {
    padding-top: 20px;
}

.compare-card {
    display: grid;
    grid-template-columns: 0.78fr 1fr;
    gap: 36px;
    padding: 34px;
}

.compare-copy {
    h2 {
        margin: 10px 0 0;
        color: #111827;
        font-size: 32px;
        font-weight: 900;
        line-height: 1.3;
    }

    span {
        display: block;
        margin-top: 14px;
        color: #667085;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.8;
    }

    .btn {
        margin-top: 22px;
    }
}

.compare-table {
    display: grid;
    gap: 10px;

    article {
        display: grid;
        grid-template-columns: 98px minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        padding: 14px;
        border: 1px solid #eef0f6;
        border-radius: 8px;
        background: #fafbfe;
    }

    span,
    strong,
    em {
        font-size: 13px;
        font-style: normal;
        font-weight: 800;
    }

    span {
        color: #111827;
    }

    strong {
        color: #98a2b3;
        text-decoration: line-through;
    }

    em {
        color: #6b28ff;
    }
}

.feature-section {
    padding-top: 44px;
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;

    article {
        padding: 22px;
        border: 1px solid #e5e7ef;
        border-radius: 10px;
        background: #fff;
        transition: transform 0.18s ease, border-color 0.18s ease;

        &:hover {
            border-color: rgba(107, 40, 255, 0.28);
            transform: translateY(-4px);
        }
    }

    i {
        display: grid;
        width: 38px;
        height: 38px;
        place-items: center;
        border-radius: 9px;
        color: #6b28ff;
        background: #f4f0ff;
        font-size: 15px;
        font-style: normal;
        font-weight: 900;
    }

    strong {
        display: block;
        margin-top: 18px;
        font-size: 16px;
        font-weight: 900;
    }

    p {
        margin: 9px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.75;
    }
}

.landing-footer {
    color: #fff;
    background: #121019;
}

.footer-inner {
    display: grid;
    width: min(1180px, calc(100vw - 56px));
    grid-template-columns: minmax(280px, 1.3fr) repeat(3, minmax(120px, 0.6fr)) 140px;
    gap: 28px;
    margin: 0 auto;
    padding: 42px 0 32px;
}

.footer-brand p {
    max-width: 320px;
    margin: 16px 0 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.8;
}

.footer-group {
    display: grid;
    align-content: flex-start;
    gap: 10px;

    strong,
    button {
        font-size: 13px;
        font-weight: 800;
    }

    strong {
        color: #fff;
    }

    button {
        width: fit-content;
        padding: 0;
        border: 0;
        color: rgba(255, 255, 255, 0.58);
        background: transparent;

        &:hover {
            color: #fff;
        }
    }
}

.footer-qr {
    strong {
        display: block;
        font-size: 13px;
        font-weight: 800;
    }

    div {
        display: grid;
        width: 84px;
        height: 84px;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 12px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
    }

    span {
        display: grid;
        place-items: center;
        border-radius: 4px;
        color: #fff;
        background: rgba(107, 40, 255, 0.8);
        font-size: 12px;
        font-weight: 900;
    }
}

.footer-bottom {
    display: flex;
    width: min(1180px, calc(100vw - 56px));
    align-items: center;
    justify-content: space-between;
    margin: 0 auto;
    padding: 18px 0 22px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.44);
    font-size: 12px;
    font-weight: 700;
}

@media (max-width: 1180px) {
    .landing-header {
        grid-template-columns: auto minmax(0, 1fr) auto;
        padding: 0 24px;
    }

    .header-nav {
        gap: 18px;
    }

    .workflow-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .feature-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 900px) {
    .landing-header {
        grid-template-columns: 1fr auto;
    }

    .header-nav {
        display: none;
    }

    .hero-copy h1 {
        font-size: 40px;
    }

    .search-row,
    .hero-stats,
    .rank-layout,
    .source-content,
    .compare-card,
    .feature-grid,
    .footer-inner {
        grid-template-columns: 1fr;
    }

    .workflow-grid {
        grid-template-columns: 1fr;
    }

    .footer-bottom {
        display: grid;
        gap: 8px;
    }
}
</style>
