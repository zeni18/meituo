import feedback from '@/utils/feedback'

const resultKeys = ['image_url', 'video_url', 'audio_url', 'file_url', 'url', 'result_url']

const hasResultValue = (value: any): boolean => {
    if (!value) return false
    if (typeof value === 'string') return value.trim() !== ''
    if (Array.isArray(value)) return value.some(hasResultValue)
    if (typeof value === 'object') {
        return resultKeys.some((key) => hasResultValue(value[key])) || hasResultValue(value.results)
    }
    return false
}

export function useAppTaskManualQuery(refreshLists: () => Promise<any> | any) {
    const queryingTaskId = ref('')

    const isTaskQuerying = (row: any) => queryingTaskId.value === String(row?.id || '')

    const handleTaskQuery = async (row: any, detailFetcher: (params: any) => Promise<any>) => {
        const taskId = Number(row?.id || 0)
        if (!taskId) return null

        queryingTaskId.value = String(taskId)
        try {
            const latest = await detailFetcher({ id: taskId })
            await refreshLists()
            feedback.msgSuccess(hasResultValue(latest) ? '已查询到结果' : '查询完成')
            return latest
        } finally {
            queryingTaskId.value = ''
        }
    }

    return {
        handleTaskQuery,
        isTaskQuerying
    }
}
