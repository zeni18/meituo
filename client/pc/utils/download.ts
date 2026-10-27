import { getApiUrl } from '@/utils/env'
import { normalizeFileUrl } from '@/utils/file-url'
import JSZip from 'jszip'

export const resolvePcDownloadUrl = (url: unknown) => {
    const raw = String(url || '').trim()
    if (!raw) return ''
    if (/^\/\//.test(raw)) {
        if (typeof window !== 'undefined' && window.location?.protocol) {
            return `${window.location.protocol}${raw}`
        }
        return `https:${raw}`
    }

    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw
    }

    const normalized = normalizeFileUrl(raw)

    if (/^\/\//.test(normalized)) {
        if (typeof window !== 'undefined' && window.location?.protocol) {
            return `${window.location.protocol}${normalized}`
        }
        return `https:${normalized}`
    }

    if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:') || normalized.startsWith('blob:')) {
        return normalized
    }

    if (normalized.startsWith('/')) {
        const apiUrl = String(getApiUrl() || '').replace(/\/+$/, '')
        if (apiUrl) return `${apiUrl}${normalized}`
        if (typeof window !== 'undefined' && window.location?.origin) {
            return `${window.location.origin}${normalized}`
        }
    }

    return normalized
}

export const getPcDownloadExtension = (url: unknown, fallback = 'png') => {
    const pathname = String(url || '').split('?')[0] || ''
    const match = pathname.match(/\.([a-z0-9]{2,8})$/i)
    return match?.[1] || fallback
}

const safeDownloadFileName = (fileName: string) => {
    const normalized = String(fileName || 'download')
        .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
        .trim()
    return normalized || 'download'
}

const ensureZipFileName = (fileName: string) => {
    const safeName = safeDownloadFileName(fileName || '作品打包下载.zip')
    return /\.zip$/i.test(safeName) ? safeName : `${safeName}.zip`
}

const clickDownloadLink = (href: string, fileName: string) => {
    const link = document.createElement('a')
    link.href = href
    link.download = safeDownloadFileName(fileName)
    link.rel = 'noopener noreferrer'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

export const downloadPcAsset = (url: unknown, fileName = 'download') => {
    if (!import.meta.client || typeof window === 'undefined') return false
    const href = resolvePcDownloadUrl(url)
    if (!href) return false

    clickDownloadLink(href, fileName)
    return true
}

type PcDownloadAssetItem = {
    url?: unknown
    fileName?: string
    downloadUrl?: unknown
    downloadName?: string
}

const uniqueZipFileName = (fileName: string, usedNames: Set<string>, index: number) => {
    const fallback = `生成作品-${index + 1}.png`
    const safeName = safeDownloadFileName(fileName || fallback)
    const dotIndex = safeName.lastIndexOf('.')
    const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName
    const extension = dotIndex > 0 ? safeName.slice(dotIndex) : ''
    let candidate = safeName
    let duplicateIndex = 2
    while (usedNames.has(candidate)) {
        candidate = `${base}-${duplicateIndex}${extension}`
        duplicateIndex += 1
    }
    usedNames.add(candidate)
    return candidate
}

const fetchAssetBlob = async (href: string, fileName: string) => {
    try {
        const response = await fetch(href, {
            credentials: 'omit',
            mode: 'cors',
            cache: 'no-store'
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.blob()
    } catch (error: any) {
        const message = error?.message ? `（${error.message}）` : ''
        throw new Error(`作品资源跨域不可读取：${fileName}${message}`)
    }
}

const createZipBlob = async (items: { href: string; fileName: string }[]) => {
    const zip = new JSZip()
    for (const item of items) {
        zip.file(item.fileName, await fetchAssetBlob(item.href, item.fileName))
    }
    return zip.generateAsync({ type: 'blob' })
}

export const downloadPcAssets = async (items: PcDownloadAssetItem[], zipName = '作品打包下载.zip') => {
    if (!import.meta.client || typeof window === 'undefined') return false
    const usedNames = new Set<string>()
    const assets = items
        .map((item, index) => {
            const href = resolvePcDownloadUrl(item.downloadUrl || item.url)
            if (!href) return null
            return {
                href,
                fileName: uniqueZipFileName(item.downloadName || item.fileName || `生成作品-${index + 1}.${getPcDownloadExtension(href, 'png')}`, usedNames, index)
            }
        })
        .filter(Boolean) as { href: string; fileName: string }[]

    if (!assets.length) throw new Error('暂无可下载作品')
    if (assets.length === 1) return downloadPcAsset(assets[0].href, assets[0].fileName)

    const zipBlob = await createZipBlob(assets)
    const objectUrl = URL.createObjectURL(zipBlob)
    try {
        clickDownloadLink(objectUrl, ensureZipFileName(zipName))
    } finally {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    }
    return true
}

export const openPcAsset = (url: unknown) => {
    if (!import.meta.client || typeof window === 'undefined') return false
    const href = resolvePcDownloadUrl(url)
    if (!href) return false
    const win = window.open(href, '_blank', 'noopener,noreferrer')
    if (!win) {
        window.location.href = href
        return true
    }
    return true
}
