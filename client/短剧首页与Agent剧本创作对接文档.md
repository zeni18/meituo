# 短剧首页与 Agent 剧本创作对接文档

本文用于新会话继续对接短剧首页和 Agent 剧本创作功能。新会话建议先读本文，再读：

- `pc/pages/ai/short-drama/index.vue`
- `pc/pages/ai/short-drama/plan.vue`
- `pc/components/ai-workspace/GlassSurface.vue`
- `pc/components/ai-workspace/app-home.vue`
- `pc/components/ai-workspace/chrome.vue`
- `pc/components/ai-workspace/sidebar.vue`
- `pc/utils/ai-sidebar.ts`

## 当前定位

短剧是 PC 端 AI 工作台左侧菜单里的独立应用入口。点击左侧“短剧”后打开浏览器新标签页，进入 `/ai/short-drama`，不是工作台内部标签页。

当前只做了前端静态首版，功能接口、后台配置、真实任务流、计费、存储、Agent 生成都还没有对接。

推荐后端应用编码：

```text
app_code = aigc_short_drama
```

说明：

- 前端 sidebar key 继续使用 `short_drama`。
- PC 路由继续使用 `/ai/short-drama` 和 `/ai/short-drama/plan`。
- 后端业务 API 建议统一放到 `/api/app/aigc_short_drama/...` 或项目当前 app API 约定的等价路径下。
- 不要把业务 API 放到普通 `/api/...` 根路径，也不要从前端直连第三方 AI 服务。

## 已确认的首页体验

首页文件是 `pc/pages/ai/short-drama/index.vue`。

页面是全新独立页面，使用 `layout: 'blank'`，不包 `AiWorkspaceChrome`。只复用灵感页的沉浸式背景思路和 `GlassSurface` 液态玻璃效果，布局和控件按 Figma/截图迭代后的短剧页为准。

顶部 UI：

- 左上角“返回首页”，点击回 `/ai`。
- 右上角点数区域，点数图标使用灵感页同款点数图标并置白，显示 `100` 和“开通会员”。
- 左侧短剧内部导航有首页、角色、项目三个 icon；选中背景和背后背景距离要一致。
- 左下角设置入口和弹窗已去掉。

背景：

- 使用视频背景，不要再使用模糊图片背景。
- 当前视频循环列表：
  - `https://aigclikeadmin.oss-cn-shenzhen.aliyuncs.com/uploads/video/20260702/20260702030949da9924540.mp4`
  - `https://aigclikeadmin.oss-cn-shenzhen.aliyuncs.com/uploads/video/20260601/20260601112012e02b49571.mov`
- 视频自动播放、静音、playsinline，单个视频结束后切下一个。
- 背景前有两层遮罩：
  - 动态纯色遮罩颜色 `#0C0C0D`，页面最顶部 opacity 为 `20%`，向下滚动时逐渐加深，到“最近项目”区域即将移出顶部时达到 `100%`。
  - 固定渐变遮罩在动态遮罩前面，顶部约 `10%` 到底部 `100%`。
- 这段交互参考灵感页 `updateImmersiveScrollMask` 的滚动体验：鼠标往下滚动时背景视频逐渐被隐藏。

首页首屏：

- 标题文案：`有什么新的故事灵感？`
- 主输入框文案：`输入你的灵感，AI会为你自动策划内容生成视频`
- 输入框字体按用户批注：
  - `font-family: Inter`
  - `font-size: 14px`
  - `font-weight: 400`
  - `line-height: 28px`
  - `color: #FFF`
- 输入框、下拉层、部分顶部按钮复用 `GlassSurface` 液态玻璃。
- 液态玻璃背景框描边最终以 `1px` 为准；项目卡片背景不是液态玻璃，使用背景模糊和相同描边。
- 输入框滚出顶部后，底部出现胶囊输入框；点击胶囊要平滑展开为原输入框形态。没有输入文字时，再次滚动后会回到胶囊状态。

创作栏控件：

- 工具按钮顺序：文件、模型、主体、风格。
- “智能选择”不要，已清理。
- 比例按钮在工具栏上方视觉层级要清楚，不被遮罩压暗。
- 比例支持下拉选择并回填，当前静态比例：
  - `9:16`
  - `16:9`
  - `3:4`
  - `4:3`
  - `21:9`
  - `1:1`
- 比例图标要按真实比例绘制，描边 `1.5px`。
- 比例箭头使用 `Down.svg`。
- 比例下拉框放在比例按钮下面，和比例按钮居中对齐，下拉距离与模型选择一致。
- 模型选择下拉框左边和输入框左边对齐。
- 所有下拉框层级必须在最上面，背景使用最近项目的背景效果或已确认的液态/模糊风格，不要出现透明度不对、看不清、被内容压住的状态。
- 主体选择后，以 `@+名字` 回填到输入框，例如 `@清冷师妹`。
- 风格选择后替换风格图标位置，显示风格图片和名称；点击 `x` 后恢复为风格图标。
- 风格选择后的按钮区域不能上下跳动，以已选中状态的位置为准固定。
- 多剧集开关：
  - 未打开时小白点为白色。
  - 打开状态背景为白色，小白点为深色。
- 发送箭头：
  - 用白色圆形背景。
  - 输入框有文字后箭头变黑色。
  - 多剧集紧挨发送按钮。

模型、主体、风格静态数据当前都用一张共享图占位，后续应改为接口返回。

## 已确认的列表体验

最近项目：

- 标题：`最近项目`
- 一行 5 个，参考 `https://seko.sensetime.com/explore` 的自适应布局。
- 卡片间距 `12px`。
- 背景框圆角 `12px`，图片圆角 `8px`。
- 图片距离背景框左、右、上都是 `4px`。
- 背景框高度保持当前长方形比例，图片高度在此前基础上减少 `20px`。
- 最近项目卡片宽高比例保持之前的长方形，不要被真实图片比例撑变形。
- 最近项目卡片的液态玻璃效果已去掉，改为背景模糊和描边。
- “查看更多”文字后面要有箭头。
- 当前静态第一张是“创建新项目”，后面是项目卡片。

灵感广场：

- 标题：`灵感广场`
- 一列 5 个，瀑布流效果。
- 作品卡片间距 `2px`。
- 圆角为直角。
- 宽高比例根据真实视频元数据/资源自然比例，不要写死。
- 不要使用静态兜底图片，封面直接用作品详情里的真实视频。
- 鼠标移入作品卡片播放视频，移出暂停并回到开头。
- 点击作品进入视频详情页，复用灵感页里的视频详情体验，底部只保留“生成同款”。
- “生成同款”当前逻辑是把作品 prompt 回填到首页输入框，并关闭详情。

## 当前静态字段

首页当前静态状态和字段：

```ts
prompt: string
activeNav: 'home' | 'role' | 'project'
multiEpisode: boolean
selectedModel: ModelOption
selectedStyle: StyleOption | null
selectedRatio: RatioOption
recentProjects: Project[]
inspirationTiles: InspirationTile[]
activeInspirationDetail: InspirationTile | null
```

当前类型可作为后端字段参考：

```ts
type RatioOption = {
    label: string
    width: number
    height: number
}

type ModelOption = {
    id: string
    name: string
    description: string
    image: string
    badge?: string
}

type SubjectOption = {
    id: string
    name: string
    image: string
    isCreate?: boolean
}

type StyleOption = {
    id: string
    name: string
    image: string
    isNew?: boolean
}

type InspirationTile = {
    id: string
    title: string
    video: string
    prompt: string
    author: string
    date: string
    config: string[]
}
```

## 首页建议接口

接口命名可以按项目最终路由约定调整，但业务边界建议保持下面这样。

### 首页初始化

```text
GET /api/app/aigc_short_drama/home
```

用途：一次性返回首页所需配置、点数、选项、最近项目、灵感广场首屏数据。

建议返回：

```json
{
  "user": {
    "points": 100,
    "vip_enabled": false
  },
  "background": {
    "type": "video",
    "items": [
      {
        "url": "https://...",
        "poster_url": ""
      }
    ]
  },
  "ratios": [
    { "label": "9:16", "width": 9, "height": 16 }
  ],
  "models": [
    {
      "id": "g2",
      "name": "全能图片 G2",
      "description": "顶级响应能力，卓越的真实感",
      "image": "https://...",
      "enabled": true,
      "sort": 10
    }
  ],
  "subjects": [
    {
      "id": "subject_1",
      "name": "清冷师妹",
      "image": "https://...",
      "source": "public"
    }
  ],
  "styles": [
    {
      "id": "style_1",
      "name": "邵氏电影",
      "image": "https://...",
      "is_new": true,
      "sort": 10
    }
  ],
  "recent_projects": [],
  "inspirations": []
}
```

前端接入要求：

- 首页加载时请求一次。
- 接口失败时保留当前静态兜底，但要给用户友好提示，不展示后端原始错误。
- 图片、视频都使用后端返回的授权 URL 或可访问 URL，不在前端拼 OSS 地址。

### 最近项目列表

```text
GET /api/app/aigc_short_drama/projects
```

参数：

```json
{
  "page_no": 1,
  "page_size": 10,
  "keyword": ""
}
```

返回项目字段建议：

```json
{
  "id": 1,
  "title": "赤壁前夜:周瑜的抉择_v3_7",
  "cover_url": "https://...",
  "status": "draft",
  "updated_at": "2026-07-02 10:00:00",
  "ratio": "9:16",
  "episode_count": 3
}
```

状态建议：

```text
draft | planning | planned | generating | success | failed | canceled
```

### 灵感广场列表

```text
GET /api/app/aigc_short_drama/inspirations
```

参数：

```json
{
  "page_no": 1,
  "page_size": 20,
  "ratio": "",
  "style_id": "",
  "keyword": ""
}
```

返回作品字段建议：

```json
{
  "id": 1,
  "title": "灵感作品 1",
  "video_url": "https://...",
  "cover_url": "",
  "width": 1080,
  "height": 1920,
  "duration": 8.2,
  "prompt": "赤壁前夜，周瑜在风雨中面对抉择...",
  "author": {
    "id": 1,
    "nickname": "岩井俊二电影",
    "avatar": "https://..."
  },
  "config": {
    "ratio": "9:16",
    "multi_episode": true,
    "style_name": "电影感",
    "model_name": "全能图片 G2"
  },
  "created_at": "2026-07-02"
}
```

前端接入要求：

- 卡片直接用 `video_url` 渲染 `<video>`。
- 宽高比例优先用 `width / height`，没有时等 `loadedmetadata` 后按真实视频比例展示。
- hover 播放，mouseleave 暂停。
- 点击打开详情弹层，不跳新页。

### 灵感详情

```text
GET /api/app/aigc_short_drama/inspirations/{id}
```

用途：点击灵感广场作品后获取详情。

详情底部只保留一个操作：`生成同款`。

生成同款行为：

- 关闭详情。
- 将详情里的 `prompt` 回填首页输入框。
- 同步回填比例、模型、风格、多剧集配置；如果接口缺字段，只回填 prompt。
- 滚动回主输入框或展开底部输入框。

## Agent 剧本创作页

页面文件是 `pc/pages/ai/short-drama/plan.vue`。

当前入口：

```ts
router.push({
    path: '/ai/short-drama/plan',
    query: prompt ? { prompt } : undefined
})
```

后续应改为提交创建 Agent 任务后进入计划页，推荐路径仍保留 `/ai/short-drama/plan`，通过 `project_id` 或 `task_id` 查询真实任务。

### 首页提交创建剧本任务

```text
POST /api/app/aigc_short_drama/script-plans
```

请求建议：

```json
{
  "prompt": "用户输入的故事灵感",
  "ratio": "9:16",
  "multi_episode": true,
  "model_id": "g2",
  "style_id": "style_1",
  "subject_ids": ["subject_1"],
  "subject_mentions": ["清冷师妹"],
  "source": "home",
  "inspiration_id": null
}
```

返回建议：

```json
{
  "project_id": 1,
  "task_id": "sd_plan_202607020001",
  "status": "queued",
  "redirect_url": "/ai/short-drama/plan?project_id=1&task_id=sd_plan_202607020001"
}
```

前端行为：

- prompt 为空时仍可进入，但后端最好返回明确提示或使用默认灵感占位，这点需产品确认。
- 提交中禁用发送按钮，避免重复提交。
- 点数不足时显示余额不足或开通会员引导。
- 成功后跳转到 `redirect_url`。
- 失败时保留用户输入和已选配置。

### 查询 Agent 计划任务

```text
GET /api/app/aigc_short_drama/script-plans/{task_id}
```

返回建议：

```json
{
  "project_id": 1,
  "task_id": "sd_plan_202607020001",
  "status": "running",
  "progress": 45,
  "current_step": "拆分关键场景并规划分镜脚本",
  "steps": [
    { "key": "expand_story", "title": "将角色与场景设定扩展为完整剧本", "status": "success" },
    { "key": "visual_style", "title": "确定视觉基调", "status": "running" },
    { "key": "storyboard", "title": "拆分关键场景并规划分镜脚本", "status": "pending" }
  ],
  "result": null,
  "error": ""
}
```

终态：

```text
queued | running | success | failed | canceled
```

轮询要求：

- `queued/running` 才轮询。
- 建议 2 秒一次，失败退避，终态停止。
- 用户离开页面时停止轮询。
- 后端错误不要展示原始供应商报错，统一映射用户可理解文案。

### Agent 成功结果结构

`plan.vue` 当前静态结果可作为后端返回结构的基础。

```json
{
  "title": "冬日河畔的静默",
  "created_at": "2026-07-02 10:00:00",
  "opening_feedback": "这是一个充满诗意与静谧感的校园故事...",
  "planning_steps": [
    "将角色与场景设定扩展为完整剧本",
    "确定冬日纽约上州的视觉基调",
    "拆分关键场景并规划分镜脚本"
  ],
  "script_lines": [
    "纽约州上州，冬日的黄昏。",
    "灰白色的河水穿过两岸光秃的冬树..."
  ],
  "art_style": {
    "base_style": "岩井俊二电影",
    "visual_description": "整体采用低饱和胶片电影质感..."
  },
  "subjects": [
    {
      "id": "annabelle",
      "name": "安妮贝尔",
      "description": "来自中国的国际学生..."
    }
  ],
  "locations": [
    {
      "id": "river",
      "name": "冬日河畔",
      "description": "纽约上州清冷的河畔..."
    }
  ],
  "storyboard": [
    {
      "shot_id": "1",
      "act": "第 1 幕：河畔黄昏 外景",
      "visual_description": "纽约上州，一条灰白色的河流...",
      "composition": "全景，三分法构图",
      "camera_movement": "缓慢拉镜头，展现环境的空旷与寂静",
      "voice_role": "",
      "dialogue": "",
      "frame_type": "normal",
      "recommended_duration_seconds": 4
    }
  ]
}
```

分镜字段说明：

- `shot_id`：前端显示“分镜 N”，可用字符串。
- `act`：用于分组折叠，例如“第 1 幕：河畔黄昏 外景”。
- `visual_description`：画面描述，可编辑。
- `composition`：构图，可编辑。
- `camera_movement`：镜头运动，可编辑。
- `voice_role`：配音角色，空字符串代表无。
- `dialogue`：台词，可编辑。
- `frame_type`：`normal` 或 `lip_sync`。
- `recommended_duration_seconds`：推荐时长，数字。

### 保存编辑后的分镜

当前 `plan.vue` 支持前端本地编辑分镜。后续需要保存接口。

```text
PUT /api/app/aigc_short_drama/script-plans/{task_id}/storyboard/{shot_id}
```

请求：

```json
{
  "visual_description": "...",
  "composition": "...",
  "camera_movement": "...",
  "voice_role": "安妮贝尔",
  "dialogue": "谢谢你。",
  "frame_type": "lip_sync",
  "recommended_duration_seconds": 3
}
```

返回：

```json
{
  "shot": {}
}
```

也可以做批量保存：

```text
PUT /api/app/aigc_short_drama/script-plans/{task_id}/storyboard
```

### Agent 对话续写

`plan.vue` 左侧有对话输入框，当前是静态。后续建议接口：

```text
POST /api/app/aigc_short_drama/script-plans/{task_id}/messages
```

请求：

```json
{
  "message": "把主角改成民国女记者，整体更悬疑。",
  "mode": "revise_plan"
}
```

返回：

```json
{
  "message_id": "msg_1",
  "task_id": "sd_plan_revision_1",
  "status": "queued"
}
```

后端可复用任务轮询结构，完成后更新剧本、主体、场景和分镜。

## 后台配置建议

短剧后续需要租户后台或平台后台配置，但首轮可先做用户端接口。

建议配置项：

- 首页背景视频列表，支持排序、启用/禁用、poster。
- 比例选项。
- 模型列表。
- 风格列表：名称、封面、是否 New、排序。
- 公共主体列表：名称、封面、描述、标签、排序。
- 灵感广场作品：视频、标题、prompt、作者、配置、排序、是否上架。
- Agent 剧本创作模型/provider 配置。
- 单次剧本规划消耗点数。

配置资源不要写死在 PC 前端；图片和视频统一走素材/上传体系。

## 数据表建议

按 LikeAdmin AIGC 规范，表名前缀建议：

```text
la_aigc_short_drama_*
```

建议表：

- `la_aigc_short_drama_project`
  - 项目主表，保存用户、租户、标题、prompt、比例、多剧集、状态、封面、最近更新时间。
- `la_aigc_short_drama_script_task`
  - Agent 剧本规划任务，保存输入快照、模型快照、计费快照、任务状态、错误、结果 JSON。
- `la_aigc_short_drama_storyboard`
  - 分镜明细，保存每个 shot 的可编辑字段。
- `la_aigc_short_drama_subject`
  - 主体库，区分公共主体和用户主体。
- `la_aigc_short_drama_style`
  - 风格库。
- `la_aigc_short_drama_inspiration`
  - 灵感广场作品。
- `la_aigc_short_drama_asset`
  - 如果短剧后续生成视频/图片结果，资源记录必须包含 `storage_scope`、`storage_engine`、`storage_domain`。

所有业务表都需要：

- `tenant_id`
- `user_id`，如果是用户私有数据
- `delete_time` 或项目现有软删除字段
- `create_time`
- `update_time`

## 计费、任务、存储边界

Agent 剧本创作属于真实 AI 任务后，需要接入共享点数逻辑：

- 提交前检查租户点数和用户点数。
- 扣费、退款、失败回滚走项目共享 point service。
- 不要直接扣 `user_money` 或 `tenant.point_balance`。
- 任务表保留价格快照和输入参数快照。
- 生成结果或上传资源必须使用统一存储记录，不要只保存裸 URL。
- 后端统一处理 provider 调用，前端只提交业务参数并轮询任务。

## 前端对接改造清单

首页：

1. 新增 `pc/api` 或 app API wrapper，所有短剧接口集中维护。
2. `index.vue` 的静态 `backgroundVideos`、`modelOptions`、`subjectOptions`、`styleOptions`、`recentProjects`、`inspirationTiles` 改为接口数据。
3. 保留静态数据作为接口失败兜底，但不要覆盖真实接口数据。
4. “开始生成/发送箭头”从直接跳 `plan` 改为调用 `POST script-plans`。
5. `生成同款` 改为回填详情接口返回的 prompt 和配置。
6. 最近项目“查看更多”接分页或跳项目列表。
7. 灵感广场支持分页加载，保持 `2px` 间距和真实视频比例。
8. 登录态、点数不足、应用未开通/未上架状态要有友好提示。

Agent 剧本页：

1. 用 `task_id/project_id` 查询真实任务。
2. 用任务状态控制左侧步骤、生成中动效、右侧文档展开。
3. 成功后用接口 result 渲染剧本、风格、主体、场景、分镜。
4. 分镜编辑从本地状态改为可保存接口。
5. 左侧对话框接 Agent 修改接口。
6. 失败状态展示错误和重试按钮。
7. 离开页面停止轮询。

## 后端对接清单

1. 建立 `aigc_short_drama` 应用骨架和 manifest。
2. 用户端 API 放到 `/api/app/aigc_short_drama/...`。
3. 新建必要表和 migration。
4. 做首页聚合接口。
5. 做项目列表、灵感列表、灵感详情。
6. 做剧本规划任务创建接口。
7. 做任务查询和轮询接口。
8. 接入 Agent/provider 服务，生成结构化 JSON。
9. 做分镜编辑保存接口。
10. 接入点数预检、扣费、失败回滚。
11. 接入统一存储和授权 URL。
12. 写入 `api_schema.json`、菜单、权限、frontend entry。

## 验收要点

首页视觉不因接口接入回退：

- 新标签页打开 `/ai/short-drama`。
- 背景视频循环播放，遮罩滚动加深。
- 主输入框和底部胶囊输入框逻辑保留。
- 最近项目一行 5 个，卡片间距 `12px`。
- 灵感广场一列 5 个，作品间距 `2px`，真实视频比例。
- 下拉框层级、位置、背景效果正确。

功能：

- 首页数据来自接口。
- 主体选择能把 `@名字` 写入 prompt。
- 风格选择、比例选择、多剧集提交参数正确。
- 点击发送创建 Agent 任务并进入 `/ai/short-drama/plan`。
- Agent 生成中有步骤状态，成功后展示真实结果。
- 分镜编辑可保存。
- 灵感作品 hover 播放、点击详情、生成同款回填。
- 点数不足、失败、取消、重试都有明确状态。

构建验证：

```powershell
cd pc
$env:NUXT_API_URL='http://uanaaaaaa.cn'
$env:NUXT_API_PREFIX='/api'
$env:NUXT_CLIENT='4'
$env:NUXT_BASE_URL='/'
$env:NUXT_PUBLIC_API_HOST='uanaaaaaa.cn'
$env:NUXT_DEV_PROXY_HOST='uanaaaaaa.cn'
$env:NUXT_SSR=''
npm.cmd run build
```

历史构建通过时常见警告：

- Node `DEP0180`
- experimental payload extraction
- Browserslist outdated
- `ssr: false`

这些不是短剧页对接阻塞项。
