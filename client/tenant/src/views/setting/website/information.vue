<!-- 网站信息 -->
<template>
    <div class="website-information">
        <el-form
            ref="formRef"
            :rules="rules"
            class="ls-form"
            :model="formData"
            label-width="120px"
            scroll-to-error
        >
            <el-card shadow="never" class="!border-none">
                <div class="text-xl font-medium mb-[20px]">后台设置</div>
                <el-form-item label="网站名称" prop="name">
                    <div class="w-80">
                        <el-input
                            v-model.trim="formData.name"
                            placeholder="请输入网站名称"
                            maxlength="30"
                            show-word-limit
                        />
                    </div>
                </el-form-item>
                <el-form-item label="网站图标" prop="web_favicon" required>
                    <div>
                        <material-picker v-model="formData.web_favicon" :limit="1" />
                        <div class="form-tips">建议尺寸：100*100像素，支持jpg，jpeg，png格式</div>
                    </div>
                </el-form-item>
                <el-form-item label="网站LOGO" prop="web_logo" required>
                    <div>
                        <material-picker v-model.trim="formData.web_logo" :limit="1" />
                        <div class="form-tips">建议尺寸：100*100像素，支持jpg，jpeg，png格式</div>
                    </div>
                </el-form-item>
                <el-form-item label="后台登录图" prop="login_image">
                    <div>
                        <material-picker v-model.trim="formData.login_image" :limit="1" />
                        <div class="form-tips">用于后台登录页兜底展示，支持jpg，jpeg，png格式</div>
                    </div>
                </el-form-item>
            </el-card>
            <el-card shadow="never" class="!border-none mt-4">
                <div class="text-xl font-medium mb-[20px]">前台设置</div>
                <el-form-item label="前台名称" prop="shop_name">
                    <div class="w-80">
                        <el-input
                            v-model.trim="formData.shop_name"
                            placeholder="请输入前台名称"
                            maxlength="30"
                            show-word-limit
                        ></el-input>
                    </div>
                </el-form-item>
                <el-form-item label="网站图标" prop="web_favicon" required>
                    <div>
                        <material-picker v-model="formData.h5_favicon" :limit="1" />
                        <div class="form-tips">建议尺寸：100*100像素，支持jpg，jpeg，png格式</div>
                    </div>
                </el-form-item>
                <el-form-item label="前台LOGO" prop="shop_logo">
                    <div>
                        <material-picker v-model="formData.shop_logo" :limit="1" />
                        <div class="form-tips">建议尺寸：100*100px，支持jpg，jpeg，png格式</div>
                    </div>
                </el-form-item>
            </el-card>
            <el-card shadow="never" class="!border-none mt-4">
                <div class="text-xl font-medium mb-[20px]">PC端设置</div>
                <el-form-item label="PC端LOGO" prop="pc_logo">
                    <div>
                        <material-picker v-model="formData.pc_logo" :limit="1" />
                        <div class="form-tips">建议尺寸：120*28px，支持jpg，jpeg，png格式</div>
                    </div>
                </el-form-item>
                <el-form-item label="网站标题" prop="pc_title">
                    <div class="w-80">
                        <el-input
                            v-model.trim="formData.pc_title"
                            placeholder="请输入PC端网站标题"
                            maxlength="30"
                            show-word-limit
                        />
                    </div>
                </el-form-item>
                <el-form-item label="网站图标" prop="pc_ico">
                    <div>
                        <material-picker v-model="formData.pc_ico" :limit="1" />
                        <div class="form-tips">建议尺寸：100*100像素，支持jpg，jpeg，png格式</div>
                    </div>
                </el-form-item>
                <el-form-item label="网站描述" prop="pc_desc">
                    <div class="w-80">
                        <el-input
                            v-model.trim="formData.pc_desc"
                            placeholder="请输入PC端网站描述"
                        />
                    </div>
                </el-form-item>
                <el-form-item label="网站关键词" prop="pc_keywords">
                    <div class="w-80">
                        <el-input
                            v-model.trim="formData.pc_keywords"
                            placeholder="请输入PC端网站关键词"
                        />
                    </div>
                </el-form-item>
                <el-form-item label="登录背景类型" prop="pc_login_bg_type">
                    <div class="mode-options">
                        <button
                            v-for="item in loginBgTypeOptions"
                            :key="item.value"
                            type="button"
                            class="mode-option"
                            :class="{ 'is-active': formData.pc_login_bg_type === item.value }"
                            @click="formData.pc_login_bg_type = item.value"
                        >
                            {{ item.label }}
                        </button>
                    </div>
                </el-form-item>
                <el-form-item v-if="formData.pc_login_bg_type !== 'none'" label="登录背景" prop="pc_login_bg">
                    <div>
                        <material-picker
                            v-model="formData.pc_login_bg"
                            :type="formData.pc_login_bg_type"
                            :limit="1"
                            width="180px"
                            height="108px"
                        />
                        <div class="form-tips">
                            图片建议 1920*1080，视频建议 mp4/webm，资源上传后不会进入系统更新包
                        </div>
                    </div>
                </el-form-item>
                <el-form-item v-if="formData.pc_login_bg_type === 'video'" label="视频封面" prop="pc_login_bg_poster">
                    <div>
                        <material-picker
                            v-model="formData.pc_login_bg_poster"
                            :limit="1"
                            width="180px"
                            height="108px"
                        />
                        <div class="form-tips">视频加载前展示的封面图，可不填</div>
                    </div>
                </el-form-item>
                <el-form-item label="PC首页风格" prop="pc_home_style">
                    <div class="style-options">
                        <button
                            v-for="item in homeStyleOptions"
                            :key="item.value"
                            type="button"
                            class="style-option"
                            :class="{ 'is-active': formData.pc_home_style === item.value }"
                            @click="formData.pc_home_style = item.value"
                        >
                            <span class="style-option__title">{{ item.label }}</span>
                            <span class="style-option__desc">{{ item.desc }}</span>
                        </button>
                    </div>
                </el-form-item>
                <template v-if="formData.pc_home_style === 'immersive'">
                    <el-form-item label="首页大标题" prop="pc_home_immersive_title">
                        <div class="w-80">
                            <el-input
                                v-model.trim="formData.pc_home_immersive_title"
                                placeholder="请输入沉浸式首页大标题"
                                maxlength="80"
                                show-word-limit
                            />
                        </div>
                    </el-form-item>
                    <el-form-item label="首页小标题" prop="pc_home_immersive_subtitle">
                        <div class="w-80">
                            <el-input
                                v-model.trim="formData.pc_home_immersive_subtitle"
                                placeholder="请输入沉浸式首页小标题"
                                maxlength="120"
                                show-word-limit
                            />
                        </div>
                    </el-form-item>
                    <el-form-item label="首页背景类型" prop="pc_home_bg_type">
                        <div class="mode-options">
                            <button
                                v-for="item in homeBgTypeOptions"
                                :key="item.value"
                                type="button"
                                class="mode-option"
                                :class="{ 'is-active': formData.pc_home_bg_type === item.value }"
                                @click="formData.pc_home_bg_type = item.value"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </el-form-item>
                    <el-form-item v-if="formData.pc_home_bg_type !== 'none'" label="首页背景" prop="pc_home_bg">
                        <div>
                            <material-picker
                                v-model="formData.pc_home_bg"
                                :type="formData.pc_home_bg_type"
                                :limit="8"
                                width="180px"
                                height="108px"
                            />
                            <div class="form-tips">
                                最多选择 8 个资源，PC 首页会按顺序轮换；图片建议 1920*1080，视频建议 mp4/webm
                            </div>
                        </div>
                    </el-form-item>
                    <el-form-item v-if="formData.pc_home_bg_type === 'video'" label="视频封面" prop="pc_home_bg_poster">
                        <div>
                            <material-picker
                                v-model="formData.pc_home_bg_poster"
                                :limit="8"
                                width="180px"
                                height="108px"
                            />
                            <div class="form-tips">视频加载前或播放失败时展示的封面图，可按视频顺序选择，可不填</div>
                        </div>
                    </el-form-item>
                </template>
            </el-card>
        </el-form>
        <footer-btns v-perms="['setting.web.web_setting/setWebsite']">
            <el-button type="primary" @click="handleSubmit">保存</el-button>
        </footer-btns>
    </div>
</template>

<script lang="ts" setup name="webInformation">
import type { FormInstance } from 'element-plus'

import { getWebsite, setWebsite } from '@/api/setting/website'
import useAppStore from '@/stores/modules/app'

const formRef = ref<FormInstance>()

const appStore = useAppStore()

type HomeStyle = 'default' | 'immersive'
type BackgroundType = 'image' | 'video' | 'none'

const homeStyleOptions: Array<{ value: HomeStyle; label: string; desc: string }> = [
    { value: 'default', label: '默认风格', desc: '使用常规工具首页布局' },
    { value: 'immersive', label: '沉浸式风格', desc: '展示大标题、背景图/视频和推荐入口' }
]

const loginBgTypeOptions: Array<{ value: BackgroundType; label: string }> = [
    { value: 'image', label: '图片' },
    { value: 'video', label: '视频' },
    { value: 'none', label: '不设置' }
]

const homeBgTypeOptions: Array<{ value: BackgroundType; label: string }> = [
    { value: 'video', label: '视频' },
    { value: 'image', label: '图片' },
    { value: 'none', label: '无背景' }
]

const defaultFormData = {
    name: '',
    web_favicon: '',
    web_logo: '',
    login_image: '',
    h5_favicon: '',
    shop_name: '',
    shop_logo: '',
    pc_logo: '',
    pc_title: '',
    pc_desc: '',
    pc_ico: '',
    pc_keywords: '',
    pc_login_bg_type: 'image' as BackgroundType,
    pc_login_bg: '',
    pc_login_bg_poster: '',
    pc_home_style: 'default' as HomeStyle,
    pc_home_immersive_title: 'OPC社区专属，AI创业平台',
    pc_home_immersive_subtitle: '一个人就是一支团队',
    pc_home_bg_type: 'none' as BackgroundType,
    pc_home_bg: [] as string[],
    pc_home_bg_poster: [] as string[]
}

// 表单数据
const formData = reactive({ ...defaultFormData })

const normalizeFileList = (value: string | string[] | null | undefined) => {
    if (Array.isArray(value)) return value.filter(Boolean)
    return value ? [value] : []
}

const normalizeHomeStyle = (value: unknown): HomeStyle => {
    return value === 'immersive' ? 'immersive' : 'default'
}

const normalizeBgType = (value: unknown, fallback: BackgroundType = 'none'): BackgroundType => {
    return value === 'image' || value === 'video' || value === 'none' ? value : fallback
}

// 表单验证
const rules = {
    name: [
        {
            required: true,
            message: '请输入网站名称',
            trigger: ['blur']
        }
    ],
    web_favicon: [
        {
            required: true,
            message: '请选择网站图标',
            trigger: ['change']
        }
    ],
    web_logo: [
        {
            required: true,
            message: '请选择网站logo',
            trigger: ['change']
        }
    ],
    shop_name: [
        {
            required: true,
            message: '请输入店铺/商城名称',
            trigger: ['blur']
        }
    ],
    shop_logo: [
        {
            required: true,
            message: '请选择商城LOGO',
            trigger: ['change']
        }
    ],
    pc_logo: [
        {
            required: true,
            message: '请选择PC端LOGO',
            trigger: ['change']
        }
    ],
    pc_title: [
        {
            required: true,
            message: '请输入PC端网站标题',
            trigger: ['blur']
        }
    ],
    pc_ico: [
        {
            required: true,
            message: '请选择PC端网站图标',
            trigger: ['change']
        }
    ]
}

// 获取备案信息
const getData = async () => {
    const data = await getWebsite()
    Object.assign(formData, {
        ...defaultFormData,
        ...data,
        pc_login_bg_type: normalizeBgType(data.pc_login_bg_type, 'image'),
        pc_home_style: normalizeHomeStyle(data.pc_home_style),
        pc_home_bg_type: normalizeBgType(data.pc_home_bg_type, 'none')
    })
    formData.pc_home_bg = normalizeFileList(data.pc_home_bg || data.pc_home_bg_url)
    formData.pc_home_bg_poster = normalizeFileList(data.pc_home_bg_poster || data.pc_home_bg_poster_url)
}

// 设置备案信息
const handleSubmit = async () => {
    await formRef.value?.validate()
    const params = {
        ...formData,
        pc_home_style: normalizeHomeStyle(formData.pc_home_style),
        pc_login_bg_type: normalizeBgType(formData.pc_login_bg_type, 'image'),
        pc_home_bg_type: normalizeBgType(formData.pc_home_bg_type, 'none'),
        pc_home_bg: [...formData.pc_home_bg],
        pc_home_bg_poster: [...formData.pc_home_bg_poster]
    }
    if (params.pc_home_style !== 'immersive') {
        params.pc_home_bg_type = 'none'
        params.pc_home_bg = []
        params.pc_home_bg_poster = []
    } else if (params.pc_home_bg_type === 'none') {
        params.pc_home_bg = []
        params.pc_home_bg_poster = []
    } else if (params.pc_home_bg_type !== 'video') {
        params.pc_home_bg_poster = []
    }
    await setWebsite(params)
    await appStore.getConfig()
    await getData()
}

getData()
</script>

<style lang="scss" scoped>
.style-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(180px, 240px));
    gap: 12px;
}

.style-option,
.mode-option {
    border: 1px solid var(--el-border-color);
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
    cursor: pointer;
    transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease,
        box-shadow 0.18s ease;

    &.is-active {
        border-color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
        box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
    }
}

.style-option {
    min-height: 78px;
    padding: 14px 16px;
    border-radius: 8px;
    text-align: left;
}

.style-option__title {
    display: block;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
}

.style-option__desc {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
}

.mode-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.mode-option {
    min-width: 72px;
    height: 32px;
    padding: 0 14px;
    border-radius: 6px;
    font-size: 13px;
}
</style>
