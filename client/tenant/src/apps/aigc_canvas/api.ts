import request from '@/utils/request'

export function getAigcCanvasStat() {
    return request.get({ url: '/app.aigc_canvas.admin/stat' })
}

export function getAigcCanvasProjects(params?: any) {
    return request.get({ url: '/app.aigc_canvas.admin_project/lists', params })
}

export function deleteAigcCanvasProject(params: any) {
    return request.post({ url: '/app.aigc_canvas.admin_project/delete', params })
}

export function clearAigcCanvasProjects(params?: any) {
    return request.post({ url: '/app.aigc_canvas.admin_project/clear', params })
}

export function getAigcCanvasRuns(params?: any) {
    return request.get({ url: '/app.aigc_canvas.admin_run/lists', params })
}

export function getAigcCanvasRunDetail(params: any) {
    return request.get({ url: '/app.aigc_canvas.admin_run/detail', params })
}

export function getAigcCanvasDependencies() {
    return request.get({ url: '/app.aigc_canvas.config/dependencies' })
}

export function getAigcCanvasConfig() {
    return request.get({ url: '/app.aigc_canvas.config/detail' })
}

export function setAigcCanvasConfig(params: any) {
    return request.post({ url: '/app.aigc_canvas.config/setup', params })
}

export function getAigcCanvasSkills(params?: any) {
    return request.get({ url: '/app.aigc_canvas.skill/lists', params })
}

export function getAigcCanvasSkillDetail(params: any) {
    return request.get({ url: '/app.aigc_canvas.skill/detail', params })
}

export function createAigcCanvasSkill(params: any) {
    return request.post({ url: '/app.aigc_canvas.skill/create', params })
}

export function updateAigcCanvasSkill(params: any) {
    return request.post({ url: '/app.aigc_canvas.skill/update', params })
}

export function setAigcCanvasSkillStatus(params: any) {
    return request.post({ url: '/app.aigc_canvas.skill/status', params })
}

export function deleteAigcCanvasSkill(params: any) {
    return request.post({ url: '/app.aigc_canvas.skill/delete', params })
}
