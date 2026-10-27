import { ref } from 'vue'
import feedback from '@/utils/feedback'
import { downloadPcAssets } from '@/utils/download'

const getDownloadErrorMessage = (error: any, fallback = '打包下载失败，请稍后重试') => {
    if (typeof error === 'string') return error || fallback
    const message = error?.msg
        || error?.message
        || error?.data?.msg
        || error?.data?.message
        || error?.response?._data?.msg
        || error?.response?.data?.msg
    const text = message ? String(message) : fallback
    if (/Failed to fetch|NetworkError|Load failed|跨域|CORS|资源不可读取/i.test(text)) {
        return '作品资源跨域不可读取，请检查存储桶或 CDN 的 CORS 配置'
    }
    return text
}

type AiToolDownloadItem = {
    url?: unknown
    downloadUrl?: unknown
    fileName?: string
    downloadName?: string
}

const normalizeDownloadItems = (items: unknown): AiToolDownloadItem[] => {
    if (!Array.isArray(items)) return []
    return items
        .map((item: any, index) => ({
            url: item?.url,
            downloadUrl: item?.downloadUrl || item?.url,
            fileName: item?.fileName || item?.downloadName || `生成作品-${index + 1}`,
            downloadName: item?.downloadName || item?.fileName || `生成作品-${index + 1}`,
        }))
        .filter((item) => item.downloadUrl || item.url)
}

export const useAiToolDownload = (_appCode: string) => {
    const downloadingTaskIds = ref<any[]>([])

    const downloadTaskResults = async (taskId: unknown, items: AiToolDownloadItem[] = [], zipName = `生成作品-${taskId || Date.now()}.zip`) => {
        const assets = normalizeDownloadItems(items)
        if (!assets.length) {
            feedback.msgError('暂无可下载作品')
            return
        }
        const rawTaskId = Number(taskId || 0)
        const downloadKey = String(taskId || zipName || Date.now())
        if (downloadingTaskIds.value.includes(downloadKey) || (rawTaskId > 0 && downloadingTaskIds.value.includes(rawTaskId))) return
        downloadingTaskIds.value = rawTaskId > 0
            ? [...downloadingTaskIds.value, rawTaskId, downloadKey]
            : [...downloadingTaskIds.value, downloadKey]
        try {
            const downloaded = await downloadPcAssets(assets, zipName)
            if (!downloaded) {
                feedback.msgError('打包下载失败，请稍后重试')
            }
        } catch (error: any) {
            feedback.msgError(getDownloadErrorMessage(error))
        } finally {
            downloadingTaskIds.value = downloadingTaskIds.value.filter((id) => id !== downloadKey && id !== rawTaskId)
        }
    }

    return {
        downloadingTaskIds,
        downloadTaskResults
    }
}
