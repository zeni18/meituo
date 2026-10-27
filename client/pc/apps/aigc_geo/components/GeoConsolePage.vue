<template>
    <div class="geo-console-page">
        <el-card v-if="pageKey !== 'dashboard'" class="geo-workbar" shadow="never">
            <div class="geo-workbar__product">
                <span>推广产品</span>
                <el-select v-model="currentProduct" class="geo-product-select" size="large">
                    <el-option label="q w" value="q w" />
                    <el-option label="GEO营销优化系统" value="GEO营销优化系统" />
                </el-select>
                <el-button @click="productDialogVisible = true">创建产品</el-button>
            </div>
            <div class="geo-workbar__meta">
                <div>
                    <span>{{ pageMeta.group }}</span>
                    <strong>{{ pageMeta.title }}</strong>
                    <p>{{ pageMeta.desc }}</p>
                </div>
                <small>{{ visibleCount }} 条结果 · {{ lastUpdated }}</small>
            </div>
        </el-card>

        <template v-if="pageKey === 'dashboard'">
            <el-card class="geo-product-hero" shadow="never">
                <div>
                    <span class="geo-kicker">推广产品 · q w</span>
                    <h2>让品牌重复成为 AI 的答案</h2>
                    <p>从公司信息和素材开始，生成用户真实会问的问题，再生产文章、分发发布，并持续检测品牌在 AI 答案里的出现率和引用来源。</p>
                    <div class="geo-product-actions">
                        <el-button type="primary" @click="productDialogVisible = true">创建新产品</el-button>
                        <el-button @click="router.push('/app/aigc_geo/console/brand')">继续完善信息</el-button>
                    </div>
                </div>
                <div class="geo-product-stats">
                    <article v-for="item in productStats" :key="item.label">
                        <strong>{{ item.value }}</strong>
                        <span>{{ item.label }}</span>
                    </article>
                </div>
            </el-card>

            <div class="geo-workflow-board">
                <button
                    v-for="item in workflowSteps"
                    :key="item.title"
                    type="button"
                    :class="{ active: item.active }"
                    @click="router.push(item.path)"
                >
                    <i>{{ item.step }}</i>
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.desc }}</span>
                    <em>{{ item.status }}</em>
                </button>
            </div>

            <el-card class="geo-task-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>近期任务</strong>
                        <el-button text type="primary" @click="mockAction('任务中心将在任务系统接入后启用')">查看全部</el-button>
                    </div>
                </template>
                <div class="geo-task-list">
                    <article v-for="item in taskRows" :key="item.title">
                        <el-tag effect="plain" :type="item.tone">{{ item.status }}</el-tag>
                        <div>
                            <strong>{{ item.title }}</strong>
                            <p>{{ item.desc }}</p>
                        </div>
                        <span>{{ item.time }}</span>
                    </article>
                </div>
            </el-card>

            <el-card class="geo-detect-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>GEO 检测</strong>
                        <el-button type="primary" @click="mockAction('检测任务将在接口接入后启用')">开始检测</el-button>
                    </div>
                </template>
                <div class="geo-detect-form">
                    <el-input v-model="detectForm.question" size="large" placeholder="输入 AI 提问，或不清楚问什么问题" />
                    <el-input v-model="detectForm.brand" size="large" placeholder="品牌（必填） 例如：GEO营销优化系统" />
                    <el-input v-model="detectForm.competitor" size="large" placeholder="竞品（选填） 例如：竞品名称" />
                    <div>
                        <span>AI 平台</span>
                        <el-checkbox-group v-model="detectPlatforms">
                            <el-checkbox-button v-for="item in aiPlatformOptions" :key="item" :label="item" />
                        </el-checkbox-group>
                    </div>
                </div>
            </el-card>

            <el-row :gutter="16" class="geo-section-row">
                <el-col :span="14">
                    <el-card class="geo-product-form-card" shadow="never">
                        <template #header>
                            <div class="geo-card-head">
                                <strong>当前产品资料</strong>
                                <el-button text type="primary" @click="router.push('/app/aigc_geo/console/brand')">编辑</el-button>
                            </div>
                        </template>
                        <div class="geo-mini-form">
                            <label><span>产品名称</span><el-input v-model="productForm.name" size="large" /></label>
                            <label><span>公司名称</span><el-input v-model="productForm.company" size="large" /></label>
                            <label><span>所属行业</span><el-input v-model="productForm.industry" size="large" /></label>
                            <label><span>公司网站</span><el-input v-model="productForm.website" size="large" /></label>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="10">
                    <el-card class="geo-check-card" shadow="never">
                        <template #header>
                            <div class="geo-card-head">
                                <strong>知识库完整度</strong>
                                <span>0 / 4</span>
                            </div>
                        </template>
                        <el-progress :percentage="0" :stroke-width="10" color="#6b28ff" />
                        <div class="geo-check-list">
                            <p v-for="item in setupChecklist" :key="item"><i></i>{{ item }}<span>待完善</span></p>
                        </div>
                    </el-card>
                </el-col>
            </el-row>
        </template>

        <template v-else-if="activePage.layout === 'company'">
            <el-row :gutter="16" class="geo-company-layout">
                <el-col :span="17">
                    <el-card class="geo-product-form-card" shadow="never">
                        <template #header>
                            <div class="geo-card-head">
                                <strong>企业概述</strong>
                                <el-button type="primary" plain @click="mockAction('AI智能填写将在模型接入后启用')">AI 智能填写</el-button>
                            </div>
                        </template>
                        <div class="geo-form-grid">
                            <label><span>产品名称 *</span><el-input v-model="productForm.name" size="large" placeholder="如 GEO营销优化系统" /></label>
                            <label><span>公司名称</span><el-input v-model="productForm.company" size="large" placeholder="请输入公司全称" /></label>
                            <label><span>所属行业</span><el-input v-model="productForm.industry" size="large" placeholder="请选择行业" /></label>
                            <label><span>公司网站</span><el-input v-model="productForm.website" size="large" placeholder="https://example.com" /></label>
                            <label class="wide"><span>企业介绍 *</span><el-input v-model="productForm.intro" type="textarea" :rows="5" placeholder="请描述企业主营业务、核心优势、发展历程、品牌定位等" /></label>
                            <label class="wide"><span>产品与服务 *</span><el-input v-model="productForm.service" type="textarea" :rows="5" placeholder="请描述产品定位、核心功能、服务边界、差异化优势等" /></label>
                            <label><span>业务城市</span><el-input v-model="productForm.city" size="large" placeholder="全国 / 华东 / 杭州" /></label>
                            <label><span>目标客户</span><el-input v-model="productForm.customer" size="large" placeholder="企业主、市场负责人、内容运营" /></label>
                            <label class="wide"><span>竞争对手</span><el-input v-model="productForm.competitor" size="large" placeholder="每行一个竞品名称，便于后续检测对比" /></label>
                            <label class="wide"><span>资料文档</span><el-input v-model="productForm.docs" size="large" placeholder="营业执照、白皮书、案例PDF、产品手册等，静态阶段仅展示入口" /></label>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="7">
                    <el-card class="geo-check-card" shadow="never">
                        <template #header><strong>检查清单</strong></template>
                        <div class="geo-check-list">
                            <p v-for="item in setupChecklist" :key="item"><i></i>{{ item }}<span>待完善</span></p>
                        </div>
                    </el-card>
                    <el-card class="geo-ai-advice" shadow="never">
                        <template #header><strong>AI 建议</strong></template>
                        <p v-for="item in aiAdvice" :key="item">{{ item }}</p>
                    </el-card>
                </el-col>
            </el-row>
        </template>

        <template v-else-if="activePage.layout === 'question'">
            <el-card v-if="pageKey === 'keywords'" class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>创建问题</strong>
                        <el-button type="primary" @click="mockAction('已生成一组静态演示问题')">生成问题</el-button>
                    </div>
                </template>
                <div class="geo-question-builder">
                    <div>
                        <h3>生成设置</h3>
                        <el-radio-group v-model="questionMode" size="large">
                            <el-radio-button label="AI生成" />
                            <el-radio-button label="手动录入" />
                        </el-radio-group>
                        <label><span>目标场景</span><el-input v-model="questionSeed.scene" size="large" /></label>
                        <label><span>目标客户</span><el-input v-model="questionSeed.audience" size="large" /></label>
                        <label><span>核心关键词</span><el-input v-model="questionSeed.keyword" size="large" /></label>
                        <label><span>平台偏好</span><el-input v-model="questionSeed.platform" size="large" /></label>
                        <div class="geo-keyword-chips">
                            <button v-for="item in recommendedKeywords" :key="item" type="button" @click="questionSeed.keyword = item">{{ item }}</button>
                        </div>
                    </div>
                    <div>
                        <h3>问题集合</h3>
                        <article v-for="item in generatedQuestions" :key="item.title">
                            <strong>{{ item.title }}</strong>
                            <p>{{ item.desc }}</p>
                            <span>{{ item.count }} 条问题</span>
                        </article>
                    </div>
                </div>
            </el-card>
            <el-card v-else class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>问题集合</strong>
                        <el-button type="primary" @click="mockAction('已保存到静态问题集合')">保存集合</el-button>
                    </div>
                </template>
                <el-table :data="questionRows" size="large">
                    <el-table-column prop="question" label="问题" min-width="300" />
                    <el-table-column prop="intent" label="意图" width="130" />
                    <el-table-column prop="platform" label="平台" width="140" />
                    <el-table-column prop="status" label="状态" width="120" />
                    <el-table-column label="操作" width="150">
                        <template #default>
                            <el-button link type="primary" @click="mockAction('已加入文章生成队列')">生成文章</el-button>
                            <el-button link @click="mockAction('已标记为暂缓')">暂缓</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>
        </template>

        <template v-else-if="activePage.layout === 'article'">
            <el-card v-if="pageKey === 'creation'" class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>文章生成</strong>
                        <el-button type="primary" @click="mockAction('文章生成将在模型接入后启用')">批量生成文章</el-button>
                    </div>
                </template>
                <div class="geo-article-builder">
                    <div>
                        <h3>生成配置</h3>
                        <label><span>问题集合</span><el-select v-model="articleConfig.collection" size="large"><el-option label="品牌认知问题" value="品牌认知问题" /><el-option label="产品选型问题" value="产品选型问题" /></el-select></label>
                        <label><span>文章类型</span><el-select v-model="articleConfig.type" size="large"><el-option label="问答科普" value="问答科普" /><el-option label="选型对比" value="选型对比" /><el-option label="案例背书" value="案例背书" /></el-select></label>
                        <label><span>配图策略</span><el-select v-model="articleConfig.image" size="large"><el-option label="智能搜图" value="智能搜图" /><el-option label="素材库固定图" value="素材库固定图" /><el-option label="不配图" value="不配图" /></el-select></label>
                        <label><span>写作要求</span><el-input v-model="articleConfig.rule" type="textarea" :rows="4" /></label>
                    </div>
                    <div>
                        <h3>生成队列</h3>
                        <article v-for="item in articleRows" :key="item.title">
                            <strong>{{ item.title }}</strong>
                            <p>{{ item.question }}</p>
                            <el-progress :percentage="item.score" :stroke-width="7" color="#6b28ff" />
                            <span>{{ item.status }}</span>
                        </article>
                    </div>
                </div>
            </el-card>
            <el-card v-else class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>文章编辑</strong>
                        <el-button type="primary" @click="mockAction('文章已保存为静态草稿')">保存文章</el-button>
                    </div>
                </template>
                <div class="geo-editor-layout">
                    <div class="geo-editor-list">
                        <button v-for="item in articleRows" :key="item.title" type="button" :class="{ active: item.status === '待审核' }">
                            <strong>{{ item.title }}</strong>
                            <span>{{ item.status }} · GEO评分 {{ item.score }}</span>
                        </button>
                    </div>
                    <div class="geo-editor-pane">
                        <el-input v-model="editorTitle" size="large" />
                        <el-input v-model="editorContent" type="textarea" :rows="14" />
                        <div class="geo-editor-actions">
                            <el-button @click="mockAction('已执行静态优化建议')">AI优化</el-button>
                            <el-button @click="mockAction('已加入发布队列')">加入发布</el-button>
                            <el-button type="primary" @click="mockAction('已提交审核')">提交审核</el-button>
                        </div>
                    </div>
                </div>
            </el-card>
        </template>

        <template v-else-if="activePage.layout === 'publish'">
            <el-card v-if="pageKey === 'site_articles'" class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>文章发布</strong>
                        <el-button type="primary" @click="mockAction('发布任务将在接口接入后启用')">创建发布计划</el-button>
                    </div>
                </template>
                <div class="geo-publish-builder">
                    <div class="geo-publish-grid">
                        <article v-for="item in publishChannels" :key="item.name">
                            <strong>{{ item.name }}</strong>
                            <p>{{ item.desc }}</p>
                            <el-progress :percentage="item.score" :stroke-width="8" color="#6b28ff" />
                            <span>{{ item.status }}</span>
                        </article>
                    </div>
                    <el-table :data="articleRows" size="large">
                        <el-table-column prop="title" label="待发布文章" min-width="280" />
                        <el-table-column prop="status" label="审核状态" width="120" />
                        <el-table-column label="发布方式" width="180">
                            <template #default>
                                <el-tag effect="plain">官网</el-tag>
                                <el-tag effect="plain">媒体</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="操作" width="130">
                            <template #default>
                                <el-button link type="primary" @click="mockAction('已加入静态发布队列')">发布</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
            </el-card>
            <el-card v-else-if="pageKey === 'official_media'" shadow="never" class="geo-table-card">
                <template #header>
                    <div class="geo-card-head">
                        <strong>媒体分发</strong>
                        <el-button type="primary" @click="mockAction('媒体投稿将在订单系统接入后启用')">提交媒体</el-button>
                    </div>
                </template>
                <el-table :data="geoMediaRows" size="large">
                    <el-table-column prop="name" label="媒体" min-width="160" />
                    <el-table-column prop="type" label="类型" width="120" />
                    <el-table-column prop="area" label="地区" width="100" />
                    <el-table-column label="标签" min-width="200">
                        <template #default="{ row }">
                            <el-tag v-for="tag in row.tags" :key="tag" class="geo-tag" effect="plain">{{ tag }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="价格/速度" width="150">
                        <template #default="{ row }">{{ row.price }} · {{ row.speed }}</template>
                    </el-table-column>
                    <el-table-column label="操作" width="110">
                        <template #default="{ row }">
                            <el-button link type="primary" @click="mockAction('已选择媒体：' + row.name)">{{ row.status }}</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>
            <el-card v-else shadow="never" class="geo-table-card">
                <template #header><strong>发布管理</strong></template>
                <el-table :data="publishRecordRows" size="large">
                    <el-table-column prop="time" label="时间" width="120" />
                    <el-table-column prop="article" label="文章" min-width="260" />
                    <el-table-column prop="channel" label="渠道" width="120" />
                    <el-table-column prop="result" label="结果" width="120" />
                    <el-table-column prop="url" label="回填URL/失败原因" min-width="180" />
                    <el-table-column label="操作" width="120">
                        <template #default="{ row }">
                            <el-button link type="primary" @click="mockAction(row.result === '失败' ? '已加入重试队列' : '详情将在接口接入后启用')">{{ row.result === '失败' ? '重试' : '查看' }}</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>
        </template>

        <template v-else-if="activePage.layout === 'monitor'">
            <el-row :gutter="16" class="geo-monitor-grid">
                <el-col v-for="item in monitorStats" :key="item.label" :span="6">
                    <el-card shadow="never">
                        <small>{{ item.label }}</small>
                        <strong>{{ item.value }}</strong>
                        <p>{{ item.trend }}</p>
                    </el-card>
                </el-col>
            </el-row>
            <el-card class="geo-table-card" shadow="never">
                <template #header><strong>平台检测结果</strong></template>
                <el-table :data="monitorRows" size="large">
                    <el-table-column prop="platform" label="AI平台" width="140" />
                    <el-table-column prop="question" label="检测问题" min-width="260" />
                    <el-table-column prop="rank" label="品牌排名" width="120" />
                    <el-table-column prop="source" label="引用来源" min-width="160" />
                    <el-table-column prop="status" label="状态" width="120" />
                </el-table>
            </el-card>
        </template>

        <template v-else-if="activePage.layout === 'package'">
            <el-card class="geo-package-hero" shadow="never">
                <div>
                    <span>当前套餐</span>
                    <h2>试用版 <em>当前使用中</em></h2>
                    <p>有效期至 2027-07-06 · 剩余 365 天</p>
                </div>
                <el-button type="primary" @click="mockAction('升级套餐将在支付系统接入后启用')">升级套餐</el-button>
            </el-card>
            <el-row :gutter="16">
                <el-col :span="12">
                    <el-card class="geo-quota-card" shadow="never">
                        <template #header><strong>配额使用情况</strong></template>
                        <div v-for="item in quotaRows" :key="item.label" class="geo-quota-row">
                            <span>{{ item.label }}</span>
                            <strong>{{ item.used }} / {{ item.total }}</strong>
                            <el-progress :percentage="item.percent" :stroke-width="8" :color="item.color" />
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="12">
                    <el-card class="geo-benefit-card" shadow="never">
                        <template #header><strong>套餐权益</strong></template>
                        <article v-for="item in packageBenefits" :key="item.title">
                            <i>{{ item.icon }}</i>
                            <div><strong>{{ item.title }}</strong><p>{{ item.desc }}</p></div>
                        </article>
                    </el-card>
                </el-col>
            </el-row>
        </template>

        <template v-else-if="activePage.layout === 'auto'">
            <el-row :gutter="16">
                <el-col :span="7">
                    <el-card class="geo-work-card" shadow="never">
                        <template #header><strong>生产批次</strong></template>
                        <div class="geo-batch-list">
                            <button v-for="item in autoBatches" :key="item.name" type="button" :class="{ active: item.active }">
                                <strong>{{ item.name }}</strong>
                                <span>{{ item.status }} · {{ item.count }} 篇</span>
                            </button>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="17">
                    <el-card class="geo-work-card" shadow="never">
                        <template #header>
                            <div class="geo-card-head">
                                <strong>文章预览与编辑</strong>
                                <div>
                                    <el-button @click="mockAction('导入问题将在接口接入后启用')">导入问题</el-button>
                                    <el-button type="primary" @click="mockAction('已加入静态生成队列')">启动生成</el-button>
                                </div>
                            </div>
                        </template>
                        <div class="geo-production-board">
                            <article v-for="item in productionRows" :key="item.title">
                                <el-tag effect="plain">{{ item.status }}</el-tag>
                                <strong>{{ item.title }}</strong>
                                <p>{{ item.question }}</p>
                                <footer>
                                    <span>{{ item.image }}</span>
                                    <el-button link type="primary" @click="mockAction('文章预览将在编辑器接入后启用')">预览</el-button>
                                </footer>
                            </article>
                        </div>
                    </el-card>
                </el-col>
            </el-row>
        </template>

        <template v-else-if="activePage.layout === 'hot'">
            <el-card class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>热点订阅</strong>
                        <el-button type="primary" @click="mockAction('热点关键词已保存到静态状态')">设置热点关键词</el-button>
                    </div>
                </template>
                <div class="geo-hot-layout">
                    <div>
                        <el-input v-model="hotKeyword" size="large" placeholder="每行一个关键词，如 GEO优化 / AI搜索 / 品牌曝光" />
                        <div class="geo-platform-pills">
                            <span v-for="item in hotPlatforms" :key="item">{{ item }}</span>
                        </div>
                    </div>
                    <article v-for="item in hotRows" :key="item.title">
                        <el-tag :type="item.tone">{{ item.signal }}</el-tag>
                        <strong>{{ item.title }}</strong>
                        <p>{{ item.source }} · {{ item.metric }}</p>
                        <el-button link type="primary" @click="mockAction('已提取观点并进入创作草稿')">生成文案</el-button>
                    </article>
                </div>
            </el-card>
        </template>

        <template v-else-if="activePage.layout === 'productDetect'">
            <el-card class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>新增商品检测</strong>
                        <el-button type="primary" @click="mockAction('商品检测任务已创建到静态列表')">确定</el-button>
                    </div>
                </template>
                <div class="geo-product-detect">
                    <el-input v-model="productDetectInput" size="large" placeholder="抖音商品链接 / 商品ID / 商品名称 / 品牌名称" />
                    <el-alert title="商品链接目前仅支持抖音；其它平台可直接输入商品名称或品牌名。" type="info" :closable="false" />
                    <el-table :data="productDetectRows" size="large">
                        <el-table-column prop="name" label="商品信息" min-width="220" />
                        <el-table-column prop="platform" label="检测平台" width="120" />
                        <el-table-column prop="recommend" label="推荐度" width="120" />
                        <el-table-column prop="rank" label="平均排名" width="120" />
                        <el-table-column prop="status" label="状态" width="120" />
                    </el-table>
                </div>
            </el-card>
        </template>

        <template v-else-if="activePage.layout === 'account'">
            <el-row :gutter="16">
                <el-col :span="12">
                    <el-card class="geo-work-card" shadow="never">
                        <template #header><strong>账号安全</strong></template>
                        <div class="geo-setting-list">
                            <article v-for="item in accountSecurityRows" :key="item.title">
                                <div><strong>{{ item.title }}</strong><p>{{ item.desc }}</p></div>
                                <el-button @click="mockAction(item.action + '将在用户接口接入后启用')">{{ item.action }}</el-button>
                            </article>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="12">
                    <el-card class="geo-work-card" shadow="never">
                        <template #header>
                            <div class="geo-card-head">
                                <strong>API Key / 技能安装</strong>
                                <el-button type="primary" @click="mockAction('API Key 创建将在接口接入后启用')">创建 API Key</el-button>
                            </div>
                        </template>
                        <div class="geo-api-box">
                            <p>复制安装指令或下载技能包，用于配置外部工具调用。</p>
                            <code>请帮我安装 GEO营销优化系统 Skills。技能地址：https://example.com/aigc_geo</code>
                            <div>
                                <el-button @click="mockAction('安装指令已复制')">一键复制</el-button>
                                <el-button @click="mockAction('技能包下载将在文件服务接入后启用')">手动下载技能包</el-button>
                            </div>
                        </div>
                    </el-card>
                </el-col>
            </el-row>
        </template>

        <template v-else-if="activePage.layout === 'team'">
            <el-card class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>成员与权限</strong>
                        <el-button type="primary" @click="mockAction('邀请短信将在团队接口接入后发送')">邀请成员</el-button>
                    </div>
                </template>
                <el-table :data="teamRows" size="large">
                    <el-table-column prop="phone" label="手机号" width="150" />
                    <el-table-column prop="name" label="显示名" width="150" />
                    <el-table-column prop="status" label="状态" width="100" />
                    <el-table-column prop="quota" label="额度使用" width="160" />
                    <el-table-column prop="permission" label="已授权权限" min-width="260" />
                    <el-table-column label="操作" width="160">
                        <template #default>
                            <el-button link type="primary">权限设置</el-button>
                            <el-button link>停用</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>
        </template>

        <template v-else-if="activePage.layout === 'invite'">
            <el-row :gutter="16">
                <el-col :span="8" v-for="item in inviteStats" :key="item.label">
                    <el-card class="geo-finance-card" shadow="never">
                        <strong>{{ item.value }}</strong>
                        <p>{{ item.label }}</p>
                        <small>{{ item.desc }}</small>
                    </el-card>
                </el-col>
            </el-row>
            <el-card class="geo-work-card" shadow="never">
                <template #header>
                    <div class="geo-card-head">
                        <strong>邀请与佣金</strong>
                        <el-button type="primary" @click="mockAction('提现申请将在财务接口接入后启用')">申请提现</el-button>
                    </div>
                </template>
                <div class="geo-invite-link">
                    <span>专属邀请链接</span>
                    <strong>https://g1geo.example/invite/aigc_geo</strong>
                    <el-button @click="mockAction('邀请链接已复制')">复制链接</el-button>
                </div>
                <el-table :data="inviteRows" size="large">
                    <el-table-column prop="target" label="邀请对象" />
                    <el-table-column prop="time" label="邀请时间" />
                    <el-table-column prop="type" label="类别" />
                    <el-table-column prop="amount" label="佣金" />
                    <el-table-column prop="status" label="状态" />
                </el-table>
            </el-card>
        </template>

        <template v-else>
            <el-card class="geo-toolbar" shadow="never">
                <el-tabs v-model="selectedTab">
                    <el-tab-pane v-for="tab in activePage.tabs" :key="tab" :label="tab" :name="tab" />
                </el-tabs>
                <div class="geo-filter-line">
                    <el-input
                        v-model="pageQuery"
                        class="geo-page-search"
                        :prefix-icon="Search"
                        :placeholder="pageMeta.searchPlaceholder"
                        clearable
                    />
                    <el-radio-group v-model="selectedPlatform" size="small">
                        <el-radio-button v-for="platform in platformFilters" :key="platform" :label="platform" />
                    </el-radio-group>
                </div>
            </el-card>

            <el-row :gutter="14" class="geo-stat-row">
                <el-col v-for="item in activePage.stats" :key="item.label" :span="8">
                    <el-card shadow="never">
                        <small>{{ item.label }}</small>
                        <strong>{{ item.value }}</strong>
                        <p>{{ item.trend }}</p>
                    </el-card>
                </el-col>
            </el-row>

            <el-row v-if="activePage.layout === 'diagnosis'" :gutter="14" class="geo-card-grid">
                <el-col v-for="item in filteredRows" :key="item.title" :span="8">
                    <el-card class="geo-insight-card" shadow="never">
                        <header>
                            <strong>{{ item.title }}</strong>
                            <el-tag effect="light">{{ item.status }}</el-tag>
                        </header>
                        <p>{{ item.desc }}</p>
                        <el-progress :percentage="Number(item.value)" :stroke-width="7" :show-text="false" color="#6b28ff" />
                        <footer>
                            <small>{{ item.platform }} · {{ item.owner }}</small>
                            <el-button text type="primary" @click="mockAction('详情将在接口接入后启用')">查看</el-button>
                        </footer>
                    </el-card>
                </el-col>
            </el-row>

            <el-row v-else-if="activePage.layout === 'gallery'" :gutter="14" class="geo-section-row">
                <el-col :span="5">
                    <el-card shadow="never">
                        <template #header>
                            <div class="geo-card-head">
                                <strong>分组</strong>
                                <el-button text type="primary" @click="mockAction('新增分组将在素材接口接入后启用')">新增</el-button>
                            </div>
                        </template>
                        <el-menu :default-active="selectedTab" class="geo-group-menu" @select="selectedTab = $event">
                            <el-menu-item v-for="tab in activePage.tabs" :key="tab" :index="tab">
                                <span>{{ tab }}</span>
                                <el-tag size="small" effect="plain">{{ tab === '全部' ? geoAssets.length : 3 }}</el-tag>
                            </el-menu-item>
                        </el-menu>
                    </el-card>
                </el-col>
                <el-col :span="19">
                    <el-row :gutter="12">
                        <el-col v-for="item in geoAssets" :key="item.name" :span="6">
                            <el-card class="geo-asset-card" shadow="never">
                                <div>{{ item.group.slice(0, 2) }}</div>
                                <strong>{{ item.name }}</strong>
                                <p>{{ item.group }} · {{ item.size }}</p>
                                <small>引用 {{ item.used }} 次</small>
                            </el-card>
                        </el-col>
                    </el-row>
                </el-col>
            </el-row>

            <el-card v-else-if="activePage.layout === 'media'" shadow="never" class="geo-table-card">
                <el-table :data="filteredMediaRows" size="small">
                    <el-table-column prop="name" label="媒体" min-width="160" />
                    <el-table-column prop="type" label="类型" width="120" />
                    <el-table-column prop="area" label="地区" width="100" />
                    <el-table-column label="标签" min-width="180">
                        <template #default="{ row }">
                            <el-tag v-for="tag in row.tags" :key="tag" class="geo-tag" effect="plain">{{ tag }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="售价" width="140">
                        <template #default="{ row }">{{ row.price }} · {{ row.speed }}</template>
                    </el-table-column>
                    <el-table-column label="操作" width="100">
                        <template #default="{ row }">
                            <el-button link type="primary" @click="mockAction('投稿下单将在订单系统接入后启用')">{{ row.status }}</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>

            <el-row v-else-if="activePage.layout === 'finance'" :gutter="14" class="geo-card-grid">
                <el-col v-for="item in filteredRows" :key="item.title" :span="8">
                    <el-card class="geo-finance-card" shadow="never">
                        <el-tag effect="plain">{{ item.status }}</el-tag>
                        <strong>{{ item.value }}</strong>
                        <p>{{ item.title }}</p>
                        <small>{{ item.desc }}</small>
                    </el-card>
                </el-col>
            </el-row>

            <el-row v-else-if="activePage.layout === 'settings'" :gutter="14" class="geo-card-grid">
                <el-col v-for="item in filteredRows" :key="item.title" :span="8">
                    <el-card class="geo-setting-card" shadow="never">
                        <div>
                            <strong>{{ item.title }}</strong>
                            <p>{{ item.desc }}</p>
                        </div>
                        <el-button type="primary" plain @click="mockAction('设置保存将在接口接入后启用')">{{ item.status }}</el-button>
                    </el-card>
                </el-col>
            </el-row>

            <el-card v-else shadow="never" class="geo-table-card">
                <el-table :data="filteredRows" size="small">
                    <el-table-column label="名称" min-width="280" show-overflow-tooltip>
                        <template #default="{ row }">
                            <div class="geo-table-title">
                                <strong>{{ row.title }}</strong>
                                <small>{{ row.desc }}</small>
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column prop="status" label="状态" width="110" />
                    <el-table-column prop="owner" label="负责人" width="110" />
                    <el-table-column prop="platform" label="平台" width="110" />
                    <el-table-column label="指标" width="120">
                        <template #default="{ row }">{{ row.value }} · {{ row.trend }}</template>
                    </el-table-column>
                    <el-table-column label="操作" width="90">
                        <template #default>
                            <el-button link type="primary" @click="mockAction('详情将在接口接入后启用')">查看</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>

            <el-empty v-if="visibleCount === 0" description="暂无匹配数据" />
        </template>

        <el-dialog v-model="disclaimerVisible" title="AI 生成内容免责声明" width="520px" class="geo-disclaimer-dialog" :show-close="false">
            <p>本系统的文案生成、文章生成、内容优化、检测分析等功能可能包含由人工智能生成或辅助生成的内容。</p>
            <div>
                用户在采纳、编辑、发布或对外使用相关内容前，应自行进行人工审核、事实核验和合规判断。平台生成结果不构成法律、医疗、金融、投资等专业建议。
            </div>
            <template #footer>
                <el-button type="primary" @click="acceptDisclaimer">我已知悉并同意</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="productDialogVisible" title="创建新产品" width="460px">
            <p class="geo-dialog-tip">请先创建产品后再进入工作台。每个产品的数据独立管理，包括公司信息、素材、文章等。</p>
            <el-input v-model="newProductName" placeholder="请输入产品名称" />
            <template #footer>
                <el-button @click="productDialogVisible = false">取消</el-button>
                <el-button type="primary" :disabled="!newProductName.trim()" @click="createProduct">创建产品</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import feedback from '@/utils/feedback'
import {
    geoAssets,
    geoConsolePages,
    geoMediaRows,
    getGeoPageMeta
} from '@/apps/aigc_geo/mock'

const props = defineProps<{
    pageKey: string
    lastUpdated: string
}>()

const router = useRouter()
const pageQuery = ref('')
const selectedTab = ref('全部')
const selectedPlatform = ref('全平台')
const currentProduct = ref('q w')
const disclaimerVisible = ref(false)
const productDialogVisible = ref(false)
const newProductName = ref('')
const detectPlatforms = ref(['豆包', 'DeepSeek', '千问'])
const detectForm = ref({
    question: '',
    brand: '',
    competitor: ''
})
const hotKeyword = ref('GEO优化\nAI搜索\n品牌曝光')
const productDetectInput = ref('')
const productForm = ref({
    name: 'q w',
    company: '',
    industry: '',
    website: 'https://example.com',
    intro: '',
    service: '',
    city: '',
    customer: '',
    competitor: '',
    docs: ''
})
const questionSeed = ref({
    scene: '品牌搜索、产品选型、价格咨询',
    audience: '企业主、市场负责人、内容运营',
    keyword: 'GEO营销优化',
    platform: 'DeepSeek / 豆包 / Kimi'
})
const questionMode = ref('AI生成')
const articleConfig = ref({
    collection: '品牌认知问题',
    type: '问答科普',
    image: '智能搜图',
    rule: '语气专业克制，标题明确回答问题，正文需要出现品牌名、适用场景和行动建议。'
})
const editorTitle = ref('GEO是什么？企业为什么要关注AI答案排名')
const editorContent = ref('GEO营销优化系统用于管理企业在AI搜索答案中的品牌可见度。企业先补齐公司信息、素材和客户案例，再生成用户真实会问的问题，并围绕这些问题生产可引用、可发布、可持续检测的内容。')

const activePage = computed(() => geoConsolePages[props.pageKey] || geoConsolePages.dashboard)
const pageMeta = computed(() => getGeoPageMeta(props.pageKey))
const productStats = [
    { label: '累计 AI 问答', value: '42,211' },
    { label: '品牌被提及量', value: '44,708' },
    { label: '资产沉淀数量', value: '234,429' }
]
const aiPlatformOptions = ['豆包', '腾讯元宝', 'DeepSeek', '千问', 'Kimi', '文心']
const workflowSteps = [
    { step: '01', title: '完善信息', desc: '公司、产品、素材', status: '2/4 待完善', path: '/app/aigc_geo/console/brand', active: true },
    { step: '02', title: '问题生成', desc: '生成用户会问AI的问题', status: '未生成', path: '/app/aigc_geo/console/keywords', active: false },
    { step: '03', title: '内容生产', desc: '基于问题生成文章', status: '待开始', path: '/app/aigc_geo/console/creation', active: false },
    { step: '04', title: '分发发布', desc: '发布官网与媒体', status: '待发布', path: '/app/aigc_geo/console/site-articles', active: false },
    { step: '05', title: '品牌检测', desc: '追踪AI答案效果', status: '待检测', path: '/app/aigc_geo/console/diagnosis', active: false }
]
const setupChecklist = ['企业概述', '产品与服务', '目标客户', '竞争对手']
const taskRows = [
    { title: '完善 q w 公司信息', desc: '还缺企业介绍、目标客户和竞争对手字段。', status: '待处理', time: '今天 16:30', tone: 'warning' },
    { title: '生成品牌认知问题集合', desc: '建议先覆盖品牌认知、产品选型、转化决策三类问题。', status: '建议', time: '今天 15:10', tone: 'primary' },
    { title: '审核 3 篇待发布文章', desc: '确认后可发布到官网并提交媒体分发。', status: '待审核', time: '昨天 19:42', tone: 'success' }
]
const aiAdvice = [
    '补充更多业务范围关键词，有助于提升知识库检索覆盖。',
    '上传资料文档或白皮书，可增强知识库权威性与可信度。',
    '完善目标客户画像，让报告中的场景建议更聚焦。'
]
const recommendedKeywords = ['AI搜索优化', 'GEO营销系统', '品牌AI可见度', 'AI答案引用来源']
const generatedQuestions = [
    { title: '品牌认知问题', desc: '用户首次了解品牌和行业方案时会问的问题。', count: 18 },
    { title: '产品选型问题', desc: '用户比较方案、功能、适用场景时会问的问题。', count: 24 },
    { title: '转化决策问题', desc: '用户关注价格、案例、服务和实施周期的问题。', count: 18 }
]
const questionRows = [
    { question: 'GEO营销系统适合什么类型的企业使用？', intent: '品牌认知', platform: 'DeepSeek', status: '可生成' },
    { question: 'AI搜索优化和SEO优化有什么区别？', intent: '需求教育', platform: '豆包', status: '已生成' },
    { question: '企业如何让品牌出现在Kimi的推荐答案里？', intent: '产品选型', platform: 'Kimi', status: '可生成' },
    { question: '品牌被AI错误引用应该怎么修正？', intent: '风险处理', platform: '通义千问', status: '待确认' }
]
const articleRows = [
    { title: 'GEO是什么？企业为什么要关注AI答案排名', question: '企业如何进入AI推荐结果？', status: '待审核', score: 92 },
    { title: 'AI搜索时代，品牌如何被DeepSeek推荐', question: 'DeepSeek会引用哪些内容来源？', status: '草稿', score: 88 },
    { title: 'GEO优化和SEO优化有什么区别', question: 'GEO和SEO应该怎么一起做？', status: '已定稿', score: 94 }
]
const publishChannels = [
    { name: '官网发布', desc: '沉淀自有内容阵地，便于AI引用稳定内容。', score: 82, status: '2篇待发布' },
    { name: '官方媒体', desc: '发布权威背书稿件，提升引用来源可信度。', score: 68, status: '3家媒体可选' },
    { name: '自媒体分发', desc: '覆盖知乎、百家号、头条等问答友好渠道。', score: 74, status: '5个账号待授权' }
]
const publishRecordRows = [
    { time: '16:20', article: 'GEO是什么？企业为什么要关注AI答案排名', channel: '官网', result: '成功', url: 'https://example.com/a/geo-intro' },
    { time: '15:48', article: '品牌AI可见度提升方案', channel: '知乎', result: '排队', url: '-' },
    { time: '14:32', article: 'AI答案引用来源分析', channel: '头条号', result: '成功', url: '已回填' },
    { time: '11:16', article: 'GEO优化和SEO优化区别', channel: '小红书', result: '失败', url: '授权过期' }
]
const monitorStats = [
    { label: 'AI出现率', value: '42%', trend: '+8% vs 上周' },
    { label: '最佳排名', value: '2', trend: 'DeepSeek答案' },
    { label: '引用来源', value: '36', trend: '新增6条' },
    { label: '竞品占位', value: '12', trend: '需优化' }
]
const monitorRows = [
    { platform: 'DeepSeek', question: 'GEO营销系统怎么选？', rank: '第2位', source: '官网文章 / 知乎', status: '已命中' },
    { platform: '豆包', question: 'AI搜索优化和SEO区别？', rank: '第4位', source: '百家号 / 头条', status: '待提升' },
    { platform: 'Kimi', question: '品牌如何进入AI答案？', rank: '未出现', source: '-', status: '需补内容' }
]
const quotaRows = [
    { label: '产品数量', used: 1, total: 1, percent: 100, color: '#6b28ff' },
    { label: '问题生成', used: 0, total: 60, percent: 2, color: '#409eff' },
    { label: '文章生成', used: 0, total: 60, percent: 2, color: '#35c98b' }
]
const packageBenefits = [
    { icon: '品', title: '多产品管理', desc: '套餐内可管理 1 个产品' },
    { icon: '问', title: '问题生成额度', desc: '套餐内可生成 60 条问题' },
    { icon: '文', title: '文章生成额度', desc: '套餐内可生成 60 篇文章' },
    { icon: '检', title: 'GEO 深度分析', desc: '支持品牌检测与趋势分析' },
    { icon: '服', title: '专属客户支持', desc: '优先响应与专属服务' },
    { icon: '权', title: '高级功能权限', desc: '解锁全部高级能力' }
]
const autoBatches = [
    { name: 'GEO基础认知批次', status: '已生成', count: 12, active: true },
    { name: '竞品对比批次', status: '生成中', count: 8, active: false },
    { name: '转化问题批次', status: '待生成', count: 20, active: false }
]
const productionRows = [
    { title: 'GEO是什么？企业为什么要关注AI答案', question: '用户如何理解GEO优化价值？', status: '已审核未发布', image: '图库配图 3 张' },
    { title: 'AI搜索时代品牌如何被推荐', question: '品牌如何进入DeepSeek推荐结果？', status: '待生成', image: '智能搜图' },
    { title: 'GEO和SEO的核心区别', question: 'GEO和SEO应该怎么一起做？', status: '生成中', image: '固定位配图' }
]
const hotPlatforms = ['抖音', '小红书', 'B站', '新闻热点', '公众号']
const hotRows = [
    { title: 'AI搜索优化成为企业服务热门话题', source: '新闻热点', metric: '关联新闻 18 篇', signal: '机会', tone: 'success' },
    { title: 'DeepSeek 推荐来源变化引发讨论', source: '公众号跟踪', metric: '阅读增长 42%', signal: '上升', tone: 'warning' },
    { title: '品牌内容被AI误引的风险案例', source: '小红书', metric: '互动 2.6万', signal: '风险', tone: 'danger' }
]
const productDetectRows = [
    { name: 'GEO营销优化系统 专业版', platform: '豆包', recommend: '82%', rank: '2.4', status: '检测完成' },
    { name: 'AI搜索品牌优化服务', platform: '豆包', recommend: '58%', rank: '4.8', status: '检测中' },
    { name: '企业内容分发工具', platform: '豆包', recommend: '-', rank: '-', status: '待检测' }
]
const accountSecurityRows = [
    { title: '登录密码', desc: '已设置，可随时修改；验证码登录不受影响。', action: '修改密码' },
    { title: '微信登录', desc: '绑定后可使用微信扫码登录当前账号。', action: '绑定微信' },
    { title: 'API Key', desc: '用于外部工具调用当前账号授权能力。', action: '创建' }
]
const teamRows = [
    { phone: '187****9420', name: '运营-张三', status: '正常', quota: '问题 12 / 文章 8 / 算力 260', permission: '查看产品、生成问题、编辑文章、发起检测' },
    { phone: '139****7012', name: '内容-李四', status: '待接受', quota: '未使用', permission: '查看素材、生成文章、查看发布' },
    { phone: '156****3321', name: '投放-王五', status: '已停用', quota: '算力 40', permission: '查看发布、发起发布、重试发布' }
]
const inviteStats = [
    { label: '累计佣金', value: '¥12,860', desc: '好友购买套餐后的已结算佣金' },
    { label: '可提现', value: '¥3,240', desc: '满 100 元可申请人工审核打款' },
    { label: '审核中', value: '¥860', desc: '等待财务审核的提现申请' }
]
const inviteRows = [
    { target: '杭州某科技公司', time: '2026-07-05', type: '购买用户', amount: '¥680', status: '已返佣' },
    { target: '上海品牌顾问', time: '2026-07-03', type: '注册用户', amount: '-', status: '待转化' },
    { target: '深圳运营团队', time: '2026-06-28', type: '购买用户', amount: '¥1,280', status: '待审核' }
]
const platformFilters = computed(() => {
    const platforms = activePage.value.rows.map((item) => item.platform)
    return ['全平台', ...Array.from(new Set(platforms)).filter(Boolean)]
})
const filteredRows = computed(() => {
    const query = pageQuery.value.trim().toLowerCase()
    return activePage.value.rows.filter((item) => {
        const tabMatched = selectedTab.value === '全部' || item.status === selectedTab.value || item.tags.includes(selectedTab.value)
        const platformMatched = selectedPlatform.value === '全平台' || item.platform === selectedPlatform.value
        const queryMatched = !query || [item.title, item.desc, item.status, item.owner, item.platform, ...item.tags].join(' ').toLowerCase().includes(query)
        return tabMatched && platformMatched && queryMatched
    })
})
const filteredMediaRows = computed(() => {
    const query = pageQuery.value.trim().toLowerCase()
    return geoMediaRows.filter((item) => {
        const tabMatched = selectedTab.value === '全部' || item.type.includes(selectedTab.value) || item.tags.includes(selectedTab.value)
        const queryMatched = !query || [item.name, item.type, item.area, item.price, item.speed, item.status, ...item.tags].join(' ').toLowerCase().includes(query)
        return tabMatched && queryMatched
    })
})
const visibleCount = computed(() => {
    if (props.pageKey === 'dashboard') {
        return workflowSteps.length
    }
    if (activePage.value.layout === 'question') {
        return generatedQuestions.reduce((sum, item) => sum + item.count, 0)
    }
    if (activePage.value.layout === 'article') {
        return articleRows.length
    }
    if (activePage.value.layout === 'publish') {
        return publishChannels.length
    }
    if (activePage.value.layout === 'auto') {
        return productionRows.length
    }
    if (activePage.value.layout === 'hot') {
        return hotRows.length
    }
    if (activePage.value.layout === 'productDetect') {
        return productDetectRows.length
    }
    if (activePage.value.layout === 'account') {
        return accountSecurityRows.length
    }
    if (activePage.value.layout === 'team') {
        return teamRows.length
    }
    if (activePage.value.layout === 'invite') {
        return inviteRows.length
    }
    if (activePage.value.layout === 'monitor') {
        return monitorRows.length
    }
    if (activePage.value.layout === 'media') {
        return filteredMediaRows.value.length
    }
    if (activePage.value.layout === 'gallery') {
        return geoAssets.length
    }
    return filteredRows.value.length
})

watch(() => props.pageKey, () => {
    pageQuery.value = ''
    selectedTab.value = '全部'
    selectedPlatform.value = '全平台'
})

function mockAction(message: string) {
    feedback.msgSuccess(message)
}

function acceptDisclaimer() {
    disclaimerVisible.value = false
    if (process.client) {
        localStorage.setItem('aigc_geo_disclaimer_accepted', '1')
    }
}

function createProduct() {
    productForm.value.name = newProductName.value.trim()
    productDialogVisible.value = false
    feedback.msgSuccess('已创建静态演示产品')
}

onMounted(() => {
    if (process.client && localStorage.getItem('aigc_geo_disclaimer_accepted') !== '1') {
        disclaimerVisible.value = true
    }
})
</script>

<style scoped lang="scss">
.geo-console-page {
    display: grid;
    gap: 16px;
}

.geo-workbar {
    :deep(.el-card__body) {
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr);
        align-items: center;
        gap: 24px;
        min-height: 92px;
        padding: 18px 22px;
    }
}

.geo-workbar__product {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 10px;

    > span {
        grid-column: 1 / -1;
        color: #98a2b3;
        font-size: 12px;
        font-weight: 900;
    }
}

.geo-product-select {
    width: 100%;
}

.geo-workbar__meta {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 18px;

    > div {
        min-width: 0;
    }

    span {
        display: block;
        color: #98a2b3;
        font-size: 12px;
        font-weight: 800;
    }

    strong {
        display: block;
        margin-top: 4px;
        color: #111827;
        font-size: 20px;
        font-weight: 900;
    }

    p {
        margin: 7px 0 0;
        overflow: hidden;
        color: #667085;
        font-size: 14px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    small {
        flex: 0 0 auto;
        color: #98a2b3;
        font-size: 12px;
        font-weight: 800;
    }
}

.geo-dashboard,
.geo-section-row,
.geo-stat-row,
.geo-card-grid {
    margin-top: 0;
}

.geo-kicker {
    display: inline-flex;
    margin-bottom: 12px;
    color: #6b28ff;
    font-size: 13px;
    font-weight: 900;
}

.geo-product-hero {
    :deep(.el-card__body) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 520px;
        gap: 24px;
        align-items: center;
        min-height: 188px;
        padding: 32px;
        background: linear-gradient(110deg, #fff 0%, #fbf9ff 58%, #f0e8ff 100%);
    }

    h2 {
        margin: 0;
        color: #111827;
        font-size: 36px;
        font-weight: 900;
    }

    p {
        max-width: 720px;
        margin: 14px 0 0;
        color: #667085;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.8;
    }
}

.geo-product-actions {
    display: flex;
    gap: 10px;
    margin-top: 22px;
}

.geo-detect-card {
    border-radius: 8px;
    border-color: #e5e7ef;
}

.geo-detect-form {
    display: grid;
    gap: 14px;

    > div {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
    }

    span {
        color: #111827;
        font-size: 14px;
        font-weight: 900;
    }

    :deep(.el-input__wrapper) {
        border-radius: 12px;
        box-shadow: 0 0 0 1px #dfe3ec inset;
    }
}

.geo-product-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    article {
        padding: 22px;
        border: 1px solid rgba(107, 40, 255, 0.12);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.82);
    }

    strong,
    span {
        display: block;
    }

    strong {
        color: #111827;
        font-size: 30px;
        font-weight: 900;
    }

    span {
        margin-top: 8px;
        color: #667085;
        font-size: 13px;
        font-weight: 800;
    }
}

.geo-workflow-board {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;

    button {
        display: grid;
        min-height: 150px;
        align-content: flex-start;
        gap: 9px;
        padding: 20px;
        border: 1px solid #e5e7ef;
        border-radius: 10px;
        color: #111827;
        background: #fff;
        text-align: left;
        cursor: pointer;
        transition: border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;

        &:hover,
        &.active {
            border-color: rgba(107, 40, 255, 0.34);
            box-shadow: 0 14px 30px rgba(107, 40, 255, 0.09);
            transform: translateY(-2px);
        }
    }

    i {
        width: fit-content;
        padding: 4px 9px;
        border-radius: 999px;
        color: #6b28ff;
        background: #f4f0ff;
        font-size: 12px;
        font-style: normal;
        font-weight: 900;
    }

    strong {
        font-size: 17px;
        font-weight: 900;
    }

    span,
    em {
        color: #667085;
        font-size: 13px;
        font-style: normal;
        font-weight: 700;
        line-height: 1.55;
    }

    em {
        margin-top: auto;
        color: #98a2b3;
    }
}

.geo-product-form-card,
.geo-check-card,
.geo-ai-advice,
.geo-work-card,
.geo-task-card,
.geo-package-hero,
.geo-quota-card,
.geo-benefit-card {
    border-radius: 8px;
    border-color: #e5e7ef;
}

.geo-task-list {
    display: grid;
    gap: 10px;

    article {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr) auto;
        gap: 14px;
        align-items: center;
        padding: 14px 16px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fff;
        transition: border-color 0.16s ease, background 0.16s ease;

        &:hover {
            border-color: #d9ccff;
            background: #fbf9ff;
        }
    }

    strong {
        color: #111827;
        font-size: 14px;
        font-weight: 900;
    }

    p,
    span {
        margin: 4px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 700;
    }

    span {
        margin: 0;
        color: #98a2b3;
    }
}

.geo-mini-form,
.geo-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.geo-mini-form label,
.geo-form-grid label,
.geo-question-builder label {
    display: grid;
    gap: 8px;

    span {
        color: #667085;
        font-size: 13px;
        font-weight: 800;
    }

    :deep(.el-input__wrapper),
    :deep(.el-textarea__inner) {
        border-radius: 8px;
        font-weight: 700;
        box-shadow: 0 0 0 1px #d9dee9 inset;
    }

    :deep(.el-input__wrapper.is-focus),
    :deep(.el-textarea__inner:focus) {
        box-shadow: 0 0 0 1px rgba(107, 40, 255, 0.52) inset, 0 0 0 3px rgba(107, 40, 255, 0.08);
    }
}

.geo-form-grid .wide {
    grid-column: 1 / -1;
}

.geo-check-list {
    display: grid;
    gap: 12px;
    margin-top: 16px;

    p {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        color: #667085;
        font-size: 14px;
        font-weight: 800;
    }

    i {
        width: 16px;
        height: 16px;
        border: 2px solid #a66a19;
        border-radius: 50%;
    }

    span {
        margin-left: auto;
        color: #a66a19;
        font-size: 13px;
    }
}

.geo-ai-advice {
    margin-top: 16px;

    p {
        margin: 0 0 14px;
        color: #667085;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.7;
    }
}

.geo-question-builder {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 22px;

    h3 {
        margin: 0 0 16px;
        font-size: 18px;
        font-weight: 900;
    }

    > div {
        display: grid;
        align-content: flex-start;
        gap: 14px;
    }

    article {
        padding: 16px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fafbff;

        strong {
            font-size: 15px;
            font-weight: 900;
        }

        p {
            margin: 8px 0;
            color: #667085;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.6;
        }

        span {
            color: #6b28ff;
            font-size: 13px;
            font-weight: 900;
        }
    }
}

.geo-keyword-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    button {
        padding: 7px 10px;
        border: 1px solid #e5e7ef;
        border-radius: 999px;
        color: #667085;
        background: #fff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;

        &:hover {
            color: #6b28ff;
            border-color: #d9ccff;
            background: #f4f0ff;
        }
    }
}

.geo-article-builder {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 18px;

    > div {
        display: grid;
        align-content: flex-start;
        gap: 14px;
        padding: 16px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fff;
    }

    h3 {
        margin: 0 0 2px;
        font-size: 17px;
        font-weight: 900;
    }

    label {
        display: grid;
        gap: 8px;

        span {
            color: #667085;
            font-size: 13px;
            font-weight: 800;
        }
    }

    article {
        display: grid;
        gap: 8px;
        padding: 14px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fafbff;

        strong {
            font-size: 15px;
            font-weight: 900;
        }

        p,
        span {
            margin: 0;
            color: #667085;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.6;
        }
    }
}

.geo-editor-layout {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 18px;
}

.geo-editor-list {
    display: grid;
    align-content: flex-start;
    gap: 10px;

    button {
        display: grid;
        gap: 6px;
        padding: 14px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fff;
        text-align: left;
        cursor: pointer;

        &.active,
        &:hover {
            border-color: #c7b4ff;
            background: #f7f3ff;
        }
    }

    strong {
        font-size: 14px;
        font-weight: 900;
    }

    span {
        color: #667085;
        font-size: 13px;
        font-weight: 700;
    }
}

.geo-editor-pane {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid #e5e7ef;
    border-radius: 8px;
    background: #fff;
}

.geo-editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.geo-publish-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;

    article {
        padding: 18px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fff;
    }

    strong {
        font-size: 16px;
        font-weight: 900;
    }

    p {
        min-height: 46px;
        margin: 10px 0 16px;
        color: #667085;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.6;
    }

    span {
        display: block;
        margin-top: 12px;
        color: #6b28ff;
        font-size: 13px;
        font-weight: 900;
    }
}

.geo-publish-builder {
    display: grid;
    gap: 16px;
}

.geo-batch-list {
    display: grid;
    gap: 10px;

    button {
        display: grid;
        gap: 6px;
        width: 100%;
        padding: 14px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fff;
        text-align: left;
        cursor: pointer;

        &.active,
        &:hover {
            border-color: #c7b4ff;
            background: #f7f3ff;
        }
    }

    strong {
        font-size: 14px;
        font-weight: 900;
    }

    span {
        color: #667085;
        font-size: 13px;
        font-weight: 700;
    }
}

.geo-production-board,
.geo-hot-layout {
    display: grid;
    gap: 12px;
}

.geo-production-board article,
.geo-hot-layout article {
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid #e5e7ef;
    border-radius: 8px;
    background: #fff;

    strong {
        color: #111827;
        font-size: 15px;
        font-weight: 900;
    }

    p {
        margin: 0;
        color: #667085;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.65;
    }

    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #98a2b3;
        font-size: 13px;
    }
}

.geo-production-board :deep(.el-tag),
.geo-hot-layout :deep(.el-tag) {
    width: fit-content;
}

.geo-hot-layout {
    grid-template-columns: 320px repeat(3, minmax(0, 1fr));

    > div {
        display: grid;
        align-content: flex-start;
        gap: 14px;
        padding: 16px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        background: #fafbff;
    }
}

.geo-platform-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    span {
        padding: 6px 10px;
        border-radius: 999px;
        color: #6b28ff;
        background: #f4f0ff;
        font-size: 12px;
        font-weight: 900;
    }
}

.geo-product-detect {
    display: grid;
    gap: 14px;
}

.geo-setting-list {
    display: grid;
    gap: 12px;

    article {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px;
        border-radius: 8px;
        background: #f8f9fd;
    }

    strong {
        font-size: 15px;
        font-weight: 900;
    }

    p {
        margin: 5px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 700;
    }
}

.geo-api-box {
    display: grid;
    gap: 14px;

    p {
        margin: 0;
        color: #667085;
        font-size: 14px;
        font-weight: 700;
    }

    code {
        display: block;
        padding: 14px;
        border: 1px solid #e5e7ef;
        border-radius: 8px;
        color: #344054;
        background: #f8f9fd;
        font-size: 13px;
        line-height: 1.7;
        white-space: normal;
    }
}

.geo-invite-link {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    margin-bottom: 14px;
    padding: 14px;
    border-radius: 8px;
    background: #f8f9fd;

    span {
        color: #667085;
        font-size: 13px;
        font-weight: 900;
    }

    strong {
        overflow: hidden;
        color: #111827;
        font-size: 14px;
        font-weight: 900;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.geo-monitor-grid {
    :deep(.el-card__body) {
        min-height: 128px;
    }

    small {
        color: #98a2b3;
        font-size: 13px;
        font-weight: 900;
    }

    strong {
        display: block;
        margin-top: 10px;
        font-size: 28px;
        font-weight: 900;
    }

    p {
        margin: 8px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 700;
    }
}

.geo-package-hero {
    :deep(.el-card__body) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 28px 34px;
        background: linear-gradient(100deg, #f1e8ff 0%, #fff 58%, #f5f8ff 100%);
    }

    span {
        color: #667085;
        font-size: 13px;
        font-weight: 900;
    }

    h2 {
        margin: 10px 0;
        font-size: 30px;
        font-weight: 900;
    }

    em {
        margin-left: 10px;
        padding: 4px 9px;
        border-radius: 6px;
        color: #6b28ff;
        background: #f4f0ff;
        font-size: 13px;
        font-style: normal;
    }

    p {
        margin: 0;
        color: #667085;
        font-size: 14px;
        font-weight: 700;
    }
}

.geo-quota-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    margin-bottom: 22px;

    span,
    strong {
        font-size: 15px;
        font-weight: 900;
    }

    .el-progress {
        grid-column: 1 / -1;
    }
}

.geo-benefit-card {
    :deep(.el-card__body) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
    }

    article {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        padding: 14px;
        border-radius: 8px;
        background: #f8f9fd;
    }

    i {
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border-radius: 8px;
        color: #6b28ff;
        background: #f4f0ff;
        font-style: normal;
        font-weight: 900;
    }

    strong {
        font-size: 15px;
        font-weight: 900;
    }

    p {
        margin: 4px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 700;
    }
}

.geo-dialog-tip {
    margin: 0 0 16px;
    color: #667085;
    font-size: 14px;
    line-height: 1.7;
}

.geo-disclaimer-dialog {
    p {
        margin: 0 0 14px;
        color: #475467;
        font-size: 14px;
        line-height: 1.8;
    }

    div {
        padding: 16px;
        border-radius: 10px;
        color: #475467;
        background: #f5f7fb;
        font-size: 14px;
        line-height: 1.8;
    }
}

.geo-brand-card {
    :deep(.el-card__body) {
        display: grid;
        align-items: center;
        grid-template-columns: 54px minmax(0, 1fr);
        gap: 14px;
        min-height: 132px;
    }

    h2 {
        margin: 4px 0;
        color: #111827;
        font-size: 18px;
        font-weight: 900;
    }

    p {
        margin: 0;
        color: #667085;
        font-size: 13px;
        line-height: 1.5;
    }
}

.geo-avatar {
    display: grid;
    width: 54px;
    height: 54px;
    place-items: center;
    border-radius: 50%;
    color: #fff;
    background: #6b28ff;
    font-size: 15px;
    font-weight: 900;
}

.geo-metric-card,
.geo-stat-row :deep(.el-card) {
    min-height: 142px;

    small {
        color: #98a2b3;
        font-size: 13px;
        font-weight: 800;
    }

    strong {
        display: block;
        margin-top: 8px;
        color: #111827;
        font-size: 27px;
        font-weight: 900;
    }

    i {
        margin-left: 2px;
        color: #667085;
        font-size: 13px;
        font-style: normal;
    }

    p {
        margin: 8px 0 0;
        color: #667085;
        font-size: 13px;
    }
}

.geo-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;

    strong {
        font-size: 16px;
        font-weight: 900;
    }
}

.geo-todo-list {
    display: grid;
    gap: 8px;

    button {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        gap: 4px 10px;
        width: 100%;
        padding: 10px;
        border: 0;
        border-radius: 8px;
        color: #111827;
        background: #f9fafc;
        text-align: left;
        cursor: pointer;

        &:hover {
            background: #f4f0ff;
        }
    }

    .el-tag {
        grid-row: span 2;
        align-self: center;
        justify-self: start;
    }

    strong {
        font-size: 13px;
    }

    small {
        color: #667085;
        font-size: 12px;
    }
}

.geo-toolbar {
    :deep(.el-card__body) {
        display: grid;
        gap: 12px;
        padding: 18px 20px;
    }

    :deep(.el-tabs__header) {
        margin: 0;
    }
}

.geo-filter-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}

.geo-page-search {
    max-width: 400px;

    :deep(.el-input__wrapper) {
        min-height: 40px;
    }
}

.geo-insight-card,
.geo-finance-card,
.geo-setting-card,
.geo-asset-card {
    transition: border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;

    &:hover {
        border-color: #d9ccff;
        transform: translateY(-2px);
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
    }
}

.geo-insight-card {
    header,
    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }

    strong {
        color: #111827;
        font-size: 16px;
        font-weight: 900;
    }

    p {
        min-height: 50px;
        margin: 12px 0;
        color: #667085;
        font-size: 14px;
        line-height: 1.6;
    }

    footer {
        margin-top: 10px;
    }

    small {
        color: #98a2b3;
        font-size: 13px;
    }
}

.geo-group-menu {
    border-right: 0;

    :deep(.el-menu-item) {
        height: 36px;
        border-radius: 7px;
        color: #667085;
        font-size: 13px;
        font-weight: 700;
        line-height: 36px;
    }

    :deep(.el-menu-item.is-active),
    :deep(.el-menu-item:hover) {
        color: #6b28ff;
        background: #f4f0ff;
    }
}

.geo-asset-card {
    margin-bottom: 12px;

    div {
        display: grid;
        width: 100%;
        height: 96px;
        place-items: center;
        border-radius: 8px;
        color: #6b28ff;
        background: #f4f0ff;
        font-size: 16px;
        font-weight: 900;
    }

    strong {
        display: block;
        margin-top: 10px;
        color: #111827;
        font-size: 14px;
    }

    p,
    small {
        display: block;
        margin: 6px 0 0;
        color: #667085;
        font-size: 12px;
    }
}

.geo-table-card,
.geo-stat-row :deep(.el-card),
.geo-section-row :deep(.el-card),
.geo-card-grid :deep(.el-card),
.geo-workbar,
.geo-toolbar {
    border-radius: 8px;
    border-color: #e5e7ef;
}

.geo-tag {
    margin-right: 6px;
}

.geo-table-title {
    display: grid;
    gap: 4px;

    strong {
        color: #111827;
        font-size: 14px;
        font-weight: 900;
    }

    small {
        overflow: hidden;
        color: #98a2b3;
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.geo-finance-card,
.geo-setting-card {
    min-height: 160px;

    strong {
        display: block;
        margin: 12px 0 8px;
        color: #111827;
        font-size: 24px;
        font-weight: 900;
    }

    p,
    small {
        color: #667085;
        font-size: 14px;
        line-height: 1.6;
    }
}

.geo-setting-card :deep(.el-card__body) {
    display: flex;
    min-height: 138px;
    flex-direction: column;
    justify-content: space-between;
}

@media (max-width: 1480px) {
    .geo-dashboard :deep(.el-col),
    .geo-stat-row :deep(.el-col),
    .geo-card-grid :deep(.el-col) {
        max-width: 50%;
        flex: 0 0 50%;
    }
}
</style>
