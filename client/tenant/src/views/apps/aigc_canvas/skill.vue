<template>
    <div>
        <el-card class="!border-none" shadow="never">
            <el-form class="mb-[-16px]" :model="queryParams" :inline="true">
                <el-form-item label="关键词">
                    <el-input
                        v-model="queryParams.keyword"
                        class="w-[220px]"
                        placeholder="名称 / 标识 / 简介"
                        clearable
                        @keyup.enter="resetPage"
                    />
                </el-form-item>
                <el-form-item label="类型">
                    <el-select
                        v-model="queryParams.skill_type"
                        class="!w-[180px]"
                        placeholder="全部"
                        clearable
                        @change="resetPage"
                    >
                        <el-option label="Agent Prompt" value="agent_prompt" />
                        <el-option label="Agent Workflow" value="agent_workflow" />
                        <el-option label="Workflow Template" value="workflow_template" />
                    </el-select>
                </el-form-item>
                <el-form-item label="状态">
                    <el-select
                        v-model="queryParams.status"
                        class="!w-[130px]"
                        placeholder="全部"
                        clearable
                        @change="resetPage"
                    >
                        <el-option label="全部" value="all" />
                        <el-option label="启用" value="1" />
                        <el-option label="停用" value="0" />
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="resetPage">查询</el-button>
                    <el-button @click="resetQuery">重置</el-button>
                    <el-button type="primary" @click="openEditor()">新增 Skill</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!border-none mt-4" shadow="never">
            <el-table v-loading="pager.loading" size="large" :data="pager.lists">
                <el-table-column label="名称" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div class="font-medium">{{ row.name }}</div>
                        <div class="text-xs text-tx-secondary">{{ row.skill_key }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="类型" width="170">
                    <template #default="{ row }">
                        <el-tag>{{ skillTypeText(row.skill_type) }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="分类" prop="category" width="120" />
                <el-table-column
                    label="简介"
                    prop="description"
                    min-width="260"
                    show-overflow-tooltip
                />
                <el-table-column label="来源" width="100">
                    <template #default="{ row }">
                        {{ row.source_type === 'builtin' ? '内置' : '租户' }}
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-switch
                            :model-value="Boolean(row.status)"
                            @change="changeStatus(row, $event)"
                        />
                    </template>
                </el-table-column>
                <el-table-column label="排序" prop="sort" width="90" />
                <el-table-column label="版本" prop="version" width="80" />
                <el-table-column label="操作" width="160" fixed="right">
                    <template #default="{ row }">
                        <el-button type="primary" link @click="openEditor(row)">编辑</el-button>
                        <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="flex justify-end mt-4">
                <pagination v-model="pager" @change="getLists" />
            </div>
        </el-card>

        <el-dialog
            v-model="editorVisible"
            :title="form.id ? '编辑 Skill' : '新增 Skill'"
            width="760px"
            destroy-on-close
        >
            <el-form label-width="110px" :model="form">
                <el-form-item label="名称" required>
                    <el-input v-model="form.name" placeholder="例如：发布会策划" />
                </el-form-item>
                <el-form-item label="标识" required>
                    <el-input
                        v-model="form.skill_key"
                        placeholder="例如：launch_event_plan"
                        :disabled="Boolean(form.id)"
                    />
                </el-form-item>
                <el-form-item label="简介">
                    <el-input v-model="form.description" type="textarea" :rows="2" />
                </el-form-item>
                <el-form-item label="分类">
                    <el-input
                        v-model="form.category"
                        placeholder="general / marketing / workflow"
                    />
                </el-form-item>
                <el-form-item label="类型">
                    <el-radio-group v-model="form.skill_type">
                        <el-radio-button label="agent_prompt">Agent Prompt</el-radio-button>
                        <el-radio-button label="agent_workflow">Agent Workflow</el-radio-button>
                        <el-radio-button label="workflow_template"
                            >Workflow Template</el-radio-button
                        >
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="触发描述">
                    <el-input v-model="form.trigger_description" type="textarea" :rows="2" />
                </el-form-item>
                <el-form-item label="示例 JSON">
                    <el-input v-model="policyText.examples_json" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="反例 JSON">
                    <el-input
                        v-model="policyText.negative_examples_json"
                        type="textarea"
                        :rows="3"
                    />
                </el-form-item>
                <el-form-item label="必填槽位">
                    <el-input v-model="policyText.required_slots_json" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="可选槽位">
                    <el-input v-model="policyText.optional_slots_json" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="默认值 JSON">
                    <el-input v-model="policyText.defaults_json" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="追问策略">
                    <el-input
                        v-model="policyText.clarification_policy_json"
                        type="textarea"
                        :rows="4"
                    />
                </el-form-item>
                <el-form-item label="工具策略">
                    <el-input v-model="policyText.tool_policy_json" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="输出策略">
                    <el-input v-model="policyText.output_policy_json" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="Agent 策略">
                    <el-input v-model="policyText.agent_policy_json" type="textarea" :rows="4" />
                </el-form-item>
                <el-form-item label="工具 Schema">
                    <el-input v-model="policyText.tool_schema_json" type="textarea" :rows="4" />
                </el-form-item>
                <el-form-item label="画布输出策略">
                    <el-input
                        v-model="policyText.canvas_output_policy_json"
                        type="textarea"
                        :rows="4"
                    />
                </el-form-item>
                <el-form-item v-if="form.skill_type !== 'workflow_template'" label="Markdown">
                    <el-input
                        v-model="form.content_markdown"
                        type="textarea"
                        :rows="8"
                        placeholder="写入该 Skill 的系统提示词、步骤和输出格式"
                    />
                </el-form-item>
                <el-form-item v-else label="工作流 JSON">
                    <el-input
                        v-model="workflowText"
                        type="textarea"
                        :rows="12"
                        placeholder='{"nodes":[],"connections":[]}'
                    />
                </el-form-item>
                <el-form-item label="封面 URL">
                    <el-input v-model="form.cover_url" />
                </el-form-item>
                <el-form-item label="排序">
                    <el-input-number v-model="form.sort" :min="0" :max="9999" />
                </el-form-item>
                <el-form-item label="启用">
                    <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="editorVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="saveSkill">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup name="tenant-aigc-canvas-skill">
import {
    createAigcCanvasSkill,
    deleteAigcCanvasSkill,
    getAigcCanvasSkillDetail,
    getAigcCanvasSkills,
    setAigcCanvasSkillStatus,
    updateAigcCanvasSkill
} from '@/apps/aigc_canvas/api'
import { usePaging } from '@/hooks/usePaging'
import feedback from '@/utils/feedback'

const queryParams = reactive({
    keyword: '',
    skill_type: '',
    status: 'all'
})

const { pager, getLists, resetPage } = usePaging({
    fetchFun: getAigcCanvasSkills,
    params: queryParams
})

const editorVisible = ref(false)
const saving = ref(false)
const workflowText = ref('')
const policyFields = [
    'examples_json',
    'negative_examples_json',
    'required_slots_json',
    'optional_slots_json',
    'defaults_json',
    'clarification_policy_json',
    'tool_policy_json',
    'output_policy_json',
    'agent_policy_json',
    'tool_schema_json',
    'canvas_output_policy_json'
]
const policyText = reactive<Record<string, string>>({
    examples_json: '[]',
    negative_examples_json: '[]',
    required_slots_json: '[]',
    optional_slots_json: '[]',
    defaults_json: '{}',
    clarification_policy_json: '{}',
    tool_policy_json: '{"allowed_tools":["generate_text"]}',
    output_policy_json: '{}',
    agent_policy_json: '{}',
    tool_schema_json: '{}',
    canvas_output_policy_json: '{}'
})
const form = reactive<any>({
    id: 0,
    name: '',
    skill_key: '',
    description: '',
    category: 'general',
    skill_type: 'agent_prompt',
    trigger_description: '',
    content_markdown: '',
    workflow_json: {},
    examples_json: [],
    negative_examples_json: [],
    required_slots_json: [],
    optional_slots_json: [],
    defaults_json: {},
    clarification_policy_json: {},
    tool_policy_json: {},
    output_policy_json: {},
    agent_policy_json: {},
    tool_schema_json: {},
    canvas_output_policy_json: {},
    cover_url: '',
    status: 1,
    sort: 0
})

const defaultForm = () => ({
    id: 0,
    name: '',
    skill_key: '',
    description: '',
    category: 'general',
    skill_type: 'agent_prompt',
    trigger_description: '',
    content_markdown: '',
    workflow_json: {},
    examples_json: [],
    negative_examples_json: [],
    required_slots_json: [],
    optional_slots_json: [],
    defaults_json: {},
    clarification_policy_json: {},
    tool_policy_json: {},
    output_policy_json: {},
    agent_policy_json: {},
    tool_schema_json: {},
    canvas_output_policy_json: {},
    cover_url: '',
    status: 1,
    sort: 0
})

const skillTypeText = (type: string) =>
    type === 'workflow_template'
        ? 'Workflow Template'
        : type === 'agent_workflow'
          ? 'Agent Workflow'
          : 'Agent Prompt'

const resetQuery = () => {
    Object.assign(queryParams, {
        keyword: '',
        skill_type: '',
        status: 'all'
    })
    resetPage()
}

const syncPolicyText = (detail: any = {}) => {
    policyFields.forEach((field) => {
        const fallback = field.includes('slots') || field.includes('examples') ? [] : {}
        policyText[field] = JSON.stringify(detail[field] ?? fallback, null, 2)
    })
}

const openEditor = async (row?: any) => {
    Object.assign(form, defaultForm())
    workflowText.value = ''
    syncPolicyText(defaultForm())
    if (row?.id) {
        const detail: any = await getAigcCanvasSkillDetail({ id: row.id })
        Object.assign(form, defaultForm(), detail)
        workflowText.value = JSON.stringify(detail.workflow_json || {}, null, 2)
        syncPolicyText(detail)
    }
    editorVisible.value = true
}

const parseWorkflow = () => {
    if (form.skill_type !== 'workflow_template') return {}
    try {
        return workflowText.value.trim() ? JSON.parse(workflowText.value) : {}
    } catch {
        feedback.msgError('工作流 JSON 格式不正确')
        throw new Error('Invalid workflow JSON')
    }
}

const parsePolicyJson = () => {
    const result: Record<string, any> = {}
    for (const field of policyFields) {
        try {
            result[field] = policyText[field].trim() ? JSON.parse(policyText[field]) : {}
        } catch {
            feedback.msgError(`${field} JSON 格式不正确`)
            throw new Error(`Invalid ${field}`)
        }
    }
    return result
}

const saveSkill = async () => {
    saving.value = true
    try {
        const payload = {
            ...form,
            workflow_json: parseWorkflow(),
            ...parsePolicyJson()
        }
        if (form.id) {
            await updateAigcCanvasSkill(payload)
        } else {
            await createAigcCanvasSkill(payload)
        }
        feedback.msgSuccess('保存成功')
        editorVisible.value = false
        getLists()
    } finally {
        saving.value = false
    }
}

const changeStatus = async (row: any, value: any) => {
    await setAigcCanvasSkillStatus({ id: row.id, status: value ? 1 : 0 })
    getLists()
}

const handleDelete = async (row: any) => {
    await feedback.confirm(`确认删除 Skill「${row.name}」？`)
    await deleteAigcCanvasSkill({ id: row.id })
    feedback.msgSuccess('删除成功')
    getLists()
}

getLists()
</script>
